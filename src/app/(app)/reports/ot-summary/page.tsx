import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { OTSummaryClient } from "./ot-summary-client";

export default async function OTSummaryPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string };
}) {
  const session = await auth();
  if (!session?.user) return null;

  const now = new Date();
  const month = Number(searchParams.month) || (now.getMonth() + 1);
  const year = Number(searchParams.year) || now.getFullYear();
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  // ── Role-based scoping (mirrors /ot/list) ──
  //   SUPERVISOR        → OTs they created
  //   DEPT_MANAGER      → where creator's dept is in MY managed depts
  //   FACTORY_MANAGER   → only Production side
  //   HR_ADMIN / SYSTEM_ADMIN → all
  const role = session.user.role;
  const empId = session.user.employeeId;
  const userSide = session.user.side;
  const me = empId
    ? await prisma.employee.findUnique({ where: { id: empId }, select: { id: true } })
    : null;

  const where: any = {
    otDate: { gte: start, lt: end },
    status: { in: ["APPROVED", "COMPLETED", "MODIFIED_BY_HR"] },
  };
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
  // HR_ADMIN / SYSTEM_ADMIN → no filter

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

  // Flatten OT × Employee → per-attendance row (เหมือนใน Excel export)
  const rows: {
    id: string;
    requestNo: string;
    otDate: string;
    isHoliday: boolean;
    startTime: string;
    endTime: string;
    shift: "DAY" | "NIGHT";
    hours: number;
    side: "OFFICE" | "PRODUCTION";
    employeeCode: string;
    employeeName: string;
    department: string;
    busRoute: string;
    status: string;
    workDescription: string;
    note: string;
  }[] = [];

  for (const o of ots) {
    for (const emp of o.employees) {
      if (emp.approvalStatus === "REJECTED") continue; // skip rejected at approval
      if (!emp.attended) continue; // skip no-show
      const hours = emp.actualHours ?? o.totalHours;
      rows.push({
        id: `${o.id}::${emp.employeeId}`,
        requestNo: o.requestNo,
        otDate: o.otDate.toISOString(),
        isHoliday: o.isHoliday,
        startTime: o.startTime,
        endTime: o.endTime,
        shift: (o.shift as "DAY" | "NIGHT") ?? "DAY",
        hours,
        side: o.side as "OFFICE" | "PRODUCTION",
        employeeCode: emp.employee.employeeCode,
        employeeName: `${emp.employee.firstName} ${emp.employee.lastName}`,
        department: emp.employee.department?.name ?? "-",
        busRoute: emp.busRoute?.name ?? o.busRoute?.name ?? "-",
        status: o.status,
        workDescription: emp.workDescription || o.workDescription || "",
        note: emp.note ?? "",
      });
    }
  }

  return <OTSummaryClient month={month} year={year} rows={rows} />;
}
