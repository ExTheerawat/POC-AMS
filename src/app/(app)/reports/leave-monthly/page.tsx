import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { LeaveReportClient } from "./leave-report-client";

export default async function LeaveReportPage({
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

  // ── Role-based scoping (mirrors /leave/list) ──
  //   SUPERVISOR        → leaves they created OR of their subordinates
  //   DEPT_MANAGER      → only employees in dept(s) they manage
  //   FACTORY_MANAGER   → only Production side
  //   HR_ADMIN / SYSTEM_ADMIN → all
  const role = session.user.role;
  const empId = session.user.employeeId;
  const userSide = session.user.side;
  const me = empId
    ? await prisma.employee.findUnique({ where: { id: empId }, select: { id: true } })
    : null;

  const where: any = { startDate: { gte: start, lt: end } };
  if (role === "SUPERVISOR" && me) {
    where.OR = [{ creatorId: me.id }, { employee: { supervisorId: me.id } }];
  } else if (role === "DEPT_MANAGER" && me) {
    const managed = await prisma.department.findMany({
      where: { managerId: me.id }, select: { id: true },
    });
    const ids = managed.map((d) => d.id);
    if (ids.length > 0) where.employee = { departmentId: { in: ids } };
    else where.id = "__none__";
  } else if (role === "FACTORY_MANAGER") {
    if (userSide) where.side = userSide;
    else where.id = "__none__";
  }
  // HR_ADMIN / SYSTEM_ADMIN → no filter (see all)

  const leaves = await prisma.leaveRequest.findMany({
    where,
    include: { employee: { include: { department: true } }, leaveType: true, creator: true },
    orderBy: { startDate: "asc" },
  });

  return (
    <LeaveReportClient
      month={month}
      year={year}
      rows={leaves.map((l) => ({
        id: l.id,
        requestNo: l.requestNo,
        employeeCode: l.employee.employeeCode,
        employeeName: `${l.employee.firstName} ${l.employee.lastName}`,
        department: l.employee.department?.name ?? "-",
        side: l.side as "OFFICE" | "PRODUCTION",
        leaveType: l.leaveType.name,
        leaveTypeCode: l.leaveType.code,
        startDate: l.startDate.toISOString(),
        endDate: l.endDate.toISOString(),
        totalDays: l.totalDays,
        status: l.status,
        reason: l.reason ?? "",
        creator: `${l.creator.firstName} ${l.creator.lastName}`,
      }))}
    />
  );
}
