import { prisma } from "@/lib/db";
import { DepartmentsClient } from "./departments-client";

export default async function DepartmentsPage() {
  const [departments, employees] = await Promise.all([
    prisma.department.findMany({
      orderBy: { code: "asc" },
      include: { manager: true, _count: { select: { employees: true } } },
    }),
    prisma.employee.findMany({
      where: { isActive: true },
      orderBy: { firstName: "asc" },
      select: {
        id: true, employeeCode: true, firstName: true, lastName: true,
        side: true, position: true, departmentId: true,
      },
    }),
  ]);

  return (
    <DepartmentsClient
      items={departments.map((d) => ({
        id: d.id, code: d.code, name: d.name, side: d.side as "OFFICE" | "PRODUCTION",
        managerId: d.managerId ?? null,
        managerName: d.manager ? `${d.manager.firstName} ${d.manager.lastName}` : null,
        employeeCount: d._count.employees,
      }))}
      employees={employees.map((e) => ({
        id: e.id,
        code: e.employeeCode,
        name: `${e.firstName} ${e.lastName}`,
        side: e.side,
        position: e.position ?? "",
        departmentId: e.departmentId ?? null,
      }))}
    />
  );
}
