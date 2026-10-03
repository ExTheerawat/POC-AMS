import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();
  const role = session!.user.role;
  const userSide = session!.user.side;

  // Side filter applies to managers; HR/Sys admin see all sides
  const isManager = role === "DEPT_MANAGER" || role === "FACTORY_MANAGER";
  const sideFilter = isManager && userSide ? { side: userSide } : {};

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

  const [employeeCount, deptCount, leavePending, leaveApproved, otPending, otApproved, otThisMonth] = await Promise.all([
    prisma.employee.count({ where: { isActive: true, ...(isManager && userSide ? { side: userSide } : {}) } }),
    prisma.department.count({ where: isManager && userSide ? { side: userSide } : {} }),
    prisma.leaveRequest.count({ where: { status: { in: ["PENDING_DEPT_MGR", "PENDING_FACTORY_MGR"] }, ...sideFilter } }),
    prisma.leaveRequest.count({ where: { status: "APPROVED", ...sideFilter } }),
    prisma.oTRequest.count({ where: { status: { in: ["PENDING_DEPT_MGR", "PENDING_FACTORY_MGR"] }, ...sideFilter } }),
    prisma.oTRequest.count({ where: { status: { in: ["APPROVED", "COMPLETED"] }, ...sideFilter } }),
    prisma.oTRequest.findMany({
      where: {
        otDate: { gte: startOfMonth, lte: endOfMonth },
        // Only OTs that actually happened — exclude cancelled/draft/pending
        status: { in: ["APPROVED", "COMPLETED", "MODIFIED_BY_HR"] },
        ...sideFilter,
      },
      select: {
        otDate: true, totalHours: true, side: true,
        employees: { select: { attended: true, actualHours: true } },
      },
    }),
  ]);

  // Person-hours per day: sum of (each attending employee × their actualHours/totalHours)
  const byDay: Record<string, { date: string; office: number; production: number }> = {};
  for (const o of otThisMonth) {
    const k = o.otDate.toISOString().slice(0, 10);
    if (!byDay[k]) byDay[k] = { date: k.slice(5), office: 0, production: 0 };
    let personHours = 0;
    for (const emp of o.employees) {
      if (!emp.attended) continue;                             // skip no-shows
      personHours += emp.actualHours ?? o.totalHours;           // actual first, fallback to planned
    }
    if (o.side === "OFFICE") byDay[k].office += personHours;
    else byDay[k].production += personHours;
  }
  const chartData = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));

  const recentLeaves = await prisma.leaveRequest.findMany({
    where: sideFilter,
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { employee: true, leaveType: true },
  });

  return (
    <DashboardClient
      role={role}
      stats={{ employeeCount, deptCount, leavePending, leaveApproved, otPending, otApproved }}
      chartData={chartData}
      recentLeaves={recentLeaves.map((l) => ({
        id: l.id,
        requestNo: l.requestNo,
        employeeName: `${l.employee.firstName} ${l.employee.lastName}`,
        leaveType: l.leaveType.name,
        status: l.status,
        startDate: l.startDate.toISOString(),
        totalDays: l.totalDays,
      }))}
    />
  );
}
