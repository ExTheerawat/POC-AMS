import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { formatDate } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = Number(searchParams.get("month") ?? new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());
  const side = searchParams.get("side"); // "OFFICE" | "PRODUCTION" | null
  const department = searchParams.get("department"); // dept name | null
  const shift = searchParams.get("shift"); // "DAY" | "NIGHT" | null
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const where: any = {
    otDate: { gte: start, lt: end },
    status: { in: ["APPROVED", "COMPLETED", "MODIFIED_BY_HR"] },
  };
  if (side === "OFFICE" || side === "PRODUCTION") where.side = side;
  if (shift === "DAY" || shift === "NIGHT") where.shift = shift;
  // Note: department filter is applied per-employee inside the loop because
  // OT can have multiple employees in different depts (rows are flattened per attendance)

  // ── Role-based scoping — applied AFTER user filters so role always wins ──
  const role = session.user.role;
  const empId = session.user.employeeId;
  const userSide = session.user.side;
  const me = empId
    ? await prisma.employee.findUnique({ where: { id: empId }, select: { id: true } })
    : null;

  if (role === "SUPERVISOR" && me) {
    where.creatorId = me.id;
  } else if (role === "DEPT_MANAGER" && me) {
    const managed = await prisma.department.findMany({
      where: { managerId: me.id }, select: { id: true },
    });
    const ids = managed.map((d) => d.id);
    if (ids.length > 0) where.creator = { departmentId: { in: ids } };
    else where.id = "__none__";
  } else if (role === "FACTORY_MANAGER") {
    if (userSide) where.side = userSide;
    else where.id = "__none__";
  }
  // HR_ADMIN / SYSTEM_ADMIN → keep user filters as-is

  // Only OTs that actually happened — exclude CANCELLED/DRAFT/PENDING
  const ots = await prisma.oTRequest.findMany({
    where,
    include: {
      creator: true, busRoute: true,
      employees: {
        include: {
          employee: { include: { department: true } },
          busRoute: true,
        },
      },
    },
    orderBy: { otDate: "asc" },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`OT-${year}-${month}`);
  ws.columns = [
    { header: "เลขที่", key: "no", width: 16 },
    { header: "วันที่", key: "date", width: 12 },
    { header: "วันหยุด", key: "isHoliday", width: 10 },
    { header: "เวลาเริ่ม", key: "start", width: 10 },
    { header: "เวลาสิ้นสุด", key: "end", width: 10 },
    { header: "ชั่วโมง", key: "hours", width: 10 },
    { header: "กะ", key: "shift", width: 8 },
    { header: "ฝ่าย", key: "side", width: 10 },
    { header: "รหัสพนักงาน", key: "emp", width: 12 },
    { header: "ชื่อ-นามสกุล", key: "name", width: 24 },
    { header: "แผนก", key: "dept", width: 20 },
    { header: "สายรถ", key: "bus", width: 18 },
    { header: "สถานะ", key: "status", width: 14 },
    { header: "ลักษณะงาน", key: "desc", width: 32 },
    { header: "หมายเหตุ", key: "note", width: 24 },
  ];
  // Header styling
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;

  // ---- Build rows
  for (const o of ots) {
    for (const emp of o.employees) {
      if (emp.approvalStatus === "REJECTED") continue; // skip rejected at approval
      if (!emp.attended) continue; // skip no-show
      // department filter (per-employee, since OT has multiple emps)
      if (department && (emp.employee.department?.name ?? "-") !== department) continue;

      const hours = emp.actualHours ?? o.totalHours;

      ws.addRow({
        no: o.requestNo,
        date: formatDate(o.otDate),
        isHoliday: o.isHoliday ? "ใช่" : "",
        start: o.startTime,
        end: o.endTime,
        hours,
        shift: o.shift === "NIGHT" ? "Night" : "Day",
        side: o.side === "OFFICE" ? "Office" : "ผลิต",
        emp: emp.employee.employeeCode,
        name: `${emp.employee.firstName} ${emp.employee.lastName}`,
        dept: emp.employee.department?.name ?? "-",
        bus: emp.busRoute?.name ?? o.busRoute?.name ?? "-",
        status: o.status,
        // Per-employee workDescription takes precedence; fallback to OT-level
        desc: emp.workDescription || o.workDescription || "",
        note: emp.note || "",
      });
    }
  }

  // No-data fallback row
  if (ws.rowCount <= 1) {
    const r = ws.addRow({});
    r.getCell(1).value = `ไม่มีข้อมูล OT สำหรับเดือน ${month}/${year}`;
    r.getCell(1).font = { italic: true, color: { argb: "FF6B7280" } };
    ws.mergeCells(`A${r.number}:M${r.number}`);
  }

  // Freeze header
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // ── Bus Route Summary sheet ──
  const summary = new Map<string, { count: number; emps: Set<string>; days: Set<string> }>();
  for (const o of ots) {
    for (const e of o.employees) {
      if (e.approvalStatus === "REJECTED") continue; // skip rejected at approval
      if (!e.attended) continue;
      if (department && (e.employee.department?.name ?? "-") !== department) continue;
      const routeName = e.busRoute?.name ?? o.busRoute?.name ?? "-";
      const entry = summary.get(routeName) ?? { count: 0, emps: new Set<string>(), days: new Set<string>() };
      entry.count += 1;
      entry.emps.add(e.employee.employeeCode);
      entry.days.add(o.otDate.toISOString().slice(0, 10));
      summary.set(routeName, entry);
    }
  }
  const wsSum = wb.addWorksheet("สรุปสายรถ");
  wsSum.columns = [
    { header: "สายรถ", key: "route", width: 28 },
    { header: "คน-ครั้ง", key: "count", width: 12 },
    { header: "คน (ไม่ซ้ำ)", key: "emps", width: 14 },
    { header: "จำนวนวัน", key: "days", width: 12 },
  ];
  const hdr = wsSum.getRow(1);
  hdr.font = { bold: true, color: { argb: "FFFFFFFF" } };
  hdr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  hdr.alignment = { vertical: "middle", horizontal: "center" };
  hdr.height = 22;
  const sorted = Array.from(summary.entries()).sort((a, b) => b[1].count - a[1].count);
  for (const [route, v] of sorted) {
    wsSum.addRow({ route, count: v.count, emps: v.emps.size, days: v.days.size });
  }
  if (wsSum.rowCount <= 1) {
    const r = wsSum.addRow({});
    r.getCell(1).value = "ไม่มีข้อมูล";
    r.getCell(1).font = { italic: true, color: { argb: "FF6B7280" } };
  }
  wsSum.views = [{ state: "frozen", ySplit: 1 }];

  const fileSuffix = [
    side === "OFFICE" ? "Office" : side === "PRODUCTION" ? "Production" : "",
    shift === "DAY" ? "Day" : shift === "NIGHT" ? "Night" : "",
    department ? department.replace(/[^\w\sก-๙]/g, "") : "",
  ].filter(Boolean).join("-");
  const filename = `OT-Summary-${year}-${String(month).padStart(2, "0")}${fileSuffix ? `-${fileSuffix}` : ""}.xlsx`;

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
