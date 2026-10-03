import { prisma } from "@/lib/db";
import { EmployeesClient } from "./employees-client";

export default async function EmployeesPage() {
  const [employees, departments, busRoutes] = await Promise.all([
    prisma.employee.findMany({
      orderBy: { employeeCode: "asc" },
      include: { department: true, supervisor: true, user: true, defaultBusRoute: true },
      take: 500,
    }),
    prisma.department.findMany({ orderBy: { code: "asc" } }),
    prisma.busRoute.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const supervisors = employees.map((e) => ({
    id: e.id, code: e.employeeCode, name: `${e.firstName} ${e.lastName}`, side: e.side,
  }));

  return (
    <EmployeesClient
      items={employees.map((e) => ({
        id: e.id, employeeCode: e.employeeCode,
        firstName: e.firstName, lastName: e.lastName, email: e.email,
        position: e.position ?? "", side: e.side as "OFFICE" | "PRODUCTION",
        departmentId: e.departmentId ?? null,
        departmentName: e.department?.name ?? null,
        supervisorId: e.supervisorId ?? null,
        supervisorName: e.supervisor ? `${e.supervisor.firstName} ${e.supervisor.lastName}` : null,
        defaultBusRouteId: e.defaultBusRouteId ?? null,
        defaultBusRouteName: e.defaultBusRoute?.name ?? null,
        hireDate: e.hireDate.toISOString(),
        isActive: e.isActive,
        username: e.user?.username ?? null,
      }))}
      departments={departments.map((d) => ({ id: d.id, code: d.code, name: d.name, side: d.side as "OFFICE" | "PRODUCTION" }))}
      supervisors={supervisors}
      busRoutes={busRoutes.map((b) => ({ id: b.id, name: b.name }))}
    />
  );
}
