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
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const where: any = { startDate: { gte: start, lt: end } };
  // User-requested filters (applied first, may be overridden by role scope below)
  if (side === "OFFICE" || side === "PRODUCTION") where.side = side;
  if (department) where.employee = { department: { name: department } };

  // ── Role-based scoping — applied AFTER user filters so role always wins ──
  const role = session.user.role;
  const empId = session.user.employeeId;
  const userSide = session.user.side;
  const me = empId
    ? await prisma.employee.findUnique({ where: { id: empId }, select: { id: true } })
    : null;

  if (role === "SUPERVISOR" && me) {
    where.OR = [{ creatorId: me.id }, { employee: { supervisorId: me.id } }];
  } else if (role === "DEPT_MANAGER" && me) {
    const managed = await prisma.department.findMany({
      where: { managerId: me.id }, select: { id: true },
    });
    const ids = managed.map((d) => d.id);
    if (ids.length > 0) {
      where.employee = { ...(where.employee ?? {}), departmentId: { in: ids } };
    } else {
      where.id = "__none__";
    }
  } else if (role === "FACTORY_MANAGER") {
    // Force side to PRODUCTION regardless of user-requested side filter
    if (userSide) where.side = userSide;
    else where.id = "__none__";
  }
  // HR_ADMIN / SYSTEM_ADMIN → keep user filters as-is

  const leaves = await prisma.leaveRequest.findMany({
    where,
    include: { employee: { include: { department: true } }, leaveType: true, creator: true },
    orderBy: { startDate: "asc" },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Leave-${year}-${month}`);
  ws.columns = [
    { header: "เลขที่", key: "no", width: 16 },
    { header: "รหัสพนักงาน", key: "emp", width: 12 },
    { header: "ชื่อ-นามสกุล", key: "name", width: 24 },
    { header: "แผนก", key: "dept", width: 20 },
    { header: "ฝ่าย", key: "side", width: 10 },
    { header: "รหัสประเภท", key: "typeCode", width: 12 },
    { header: "ประเภทการลา", key: "type", width: 18 },
    { header: "วันเริ่ม", key: "start", width: 12 },
    { header: "วันสิ้นสุด", key: "end", width: 12 },
    { header: "จำนวนวัน", key: "days", width: 10 },
    { header: "สถานะ", key: "status", width: 16 },
    { header: "เหตุผล", key: "reason", width: 40 },
    { header: "ผู้สร้าง", key: "creator", width: 20 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  for (const l of leaves) {
    ws.addRow({
      no: l.requestNo, emp: l.employee.employeeCode,
      name: `${l.employee.firstName} ${l.employee.lastName}`,
      dept: l.employee.department?.name ?? "-",
      side: l.side === "OFFICE" ? "Office" : "ผลิต",
      typeCode: l.leaveType.code,
      type: l.leaveType.name + (l.halfDayType === "MORNING" ? " (ครึ่งเช้า)" : l.halfDayType === "AFTERNOON" ? " (ครึ่งบ่าย)" : ""),
      start: formatDate(l.startDate),
      end: formatDate(l.endDate),
      days: l.totalDays, status: l.status,
      reason: l.reason ?? "",
      creator: `${l.creator.firstName} ${l.creator.lastName}`,
    });
  }

  // Filename includes filter info so user knows what's inside
  const fileSuffix = [
    side === "OFFICE" ? "Office" : side === "PRODUCTION" ? "Production" : "",
    department ? department.replace(/[^\w\sก-๙]/g, "") : "",
  ].filter(Boolean).join("-");
  const filename = `Leave-${year}-${String(month).padStart(2, "0")}${fileSuffix ? `-${fileSuffix}` : ""}.xlsx`;

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
