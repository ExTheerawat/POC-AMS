import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { OTListClient } from "./ot-list-client";

export default async function OTListPage() {
  const session = await auth();
  const role = session!.user.role;
  const empId = session!.user.employeeId;
  const userSide = session!.user.side;

  const me = empId
    ? await prisma.employee.findUnique({ where: { id: empId }, select: { id: true, departmentId: true } })
    : null;

  // Role-based scoping for OT list:
  //   - SUPERVISOR             → OTs I created
  //   - DEPT_MANAGER           → OTs where creator's dept is in MY managed depts
  //   - FACTORY_MANAGER        → all PRODUCTION side
  //   - HR_ADMIN / SYSTEM_ADMIN → all
  const where: any = {};
  if (role === "SUPERVISOR" && empId) {
    where.creatorId = empId;
  } else if (role === "DEPT_MANAGER" && me) {
    const managed = await prisma.department.findMany({
      where: { managerId: me.id },
      select: { id: true },
    });
    const managedIds = managed.map((d) => d.id);
    if (managedIds.length > 0) where.creator = { departmentId: { in: managedIds } };
    else where.id = "__none__";
  } else if (role === "FACTORY_MANAGER") {
    if (userSide) where.side = userSide;
    else where.id = "__none__";
  }
  // HR_ADMIN / SYSTEM_ADMIN — no filter

  // Available employees for ADD (same scope as /ot/create) — exclude system users
  const employeeOnlyFilter = { user: null };
  let availableEmpWhere: any;
  if (role === "HR_ADMIN" || role === "SYSTEM_ADMIN") {
    availableEmpWhere = { isActive: true, ...employeeOnlyFilter };
  } else if (role === "DEPT_MANAGER" && me) {
    const managed = await prisma.department.findMany({
      where: { managerId: me.id }, select: { id: true },
    });
    const managedIds = managed.map((d) => d.id);
    availableEmpWhere = managedIds.length > 0
      ? { isActive: true, departmentId: { in: managedIds }, ...employeeOnlyFilter }
      : { id: "__none__" };
  } else if (role === "SUPERVISOR" && me) {
    availableEmpWhere = { supervisorId: me.id, isActive: true, ...employeeOnlyFilter };
  } else {
    availableEmpWhere = { id: "__none__" };
  }

  const [ots, busRoutes, availableEmployees] = await Promise.all([
    prisma.oTRequest.findMany({
      where, orderBy: { createdAt: "desc" }, take: 500,
      include: {
        creator: true,
        busRoute: true,
        employees: { include: { employee: true, busRoute: true } },
      },
    }),
    prisma.busRoute.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({
      where: availableEmpWhere,
      orderBy: { firstName: "asc" },
      include: { department: true },
    }),
  ]);

  const isAdmin = role === "HR_ADMIN" || role === "SYSTEM_ADMIN";

  return (
    <OTListClient
      role={role}
      currentEmployeeId={empId}
      isAdmin={isAdmin}
      ots={ots.map((o) => {
        // Only count employees that are NOT rejected (rejected ones don't actually do the OT)
        const activeEmps = o.employees.filter((e) => e.approvalStatus !== "REJECTED");
        // Build per-route summary for display
        const routeMap = new Map<string, { name: string; count: number }>();
        for (const e of activeEmps) {
          const r = e.busRoute ?? o.busRoute;
          if (!r) continue;
          const cur = routeMap.get(r.id);
          routeMap.set(r.id, { name: r.name, count: (cur?.count ?? 0) + 1 });
        }
        const routes = [...routeMap.values()];
        const busRouteName = routes.length === 0 ? "-"
          : routes.length === 1 ? routes[0].name
          : `${routes.length} สาย`;

        return {
          id: o.id,
          requestNo: o.requestNo,
          otDate: o.otDate.toISOString(),
          startTime: o.startTime,
          endTime: o.endTime,
          totalHours: o.totalHours,
          isHoliday: o.isHoliday,
          workDescription: o.workDescription ?? "",
          busRouteId: o.busRouteId ?? "",
          busRouteName,
          side: o.side,
          status: o.status,
          creatorId: o.creatorId,
          employeeCount: activeEmps.length,
          // For edit dialog — list of employees with their bus route (active only)
          otEmployees: activeEmps.map((e) => ({
            otEmployeeId: e.id,
            employeeId: e.employeeId,
            employeeName: `${e.employee.firstName} ${e.employee.lastName}`,
            employeeCode: e.employee.employeeCode,
            busRouteId: e.busRouteId ?? o.busRouteId ?? "",
            workDescription: e.workDescription ?? "",
            note: e.note ?? "",
          })),
        };
      })}
      busRoutes={busRoutes.map((b) => ({ id: b.id, name: b.name, route: b.route ?? "" }))}
      availableEmployees={availableEmployees.map((e) => ({
        id: e.id,
        code: e.employeeCode,
        name: `${e.firstName} ${e.lastName}`,
        dept: e.department?.name ?? "",
        defaultBusRouteId: e.defaultBusRouteId ?? null,
      }))}
    />
  );
}
