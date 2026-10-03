import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { OTCreateForm } from "./ot-create-form";
import { isCutOffPassed } from "@/lib/cut-off";

export default async function OTCreatePage() {
  const session = await auth();
  const role = session!.user.role;
  const myEmployeeId = session!.user.employeeId;

  const me = myEmployeeId
    ? await prisma.employee.findUnique({ where: { id: myEmployeeId }, select: { id: true, departmentId: true } })
    : null;

  // Role-based scoping for the employee selector:
  //   - HR_ADMIN / SYSTEM_ADMIN → all active employees
  //   - DEPT_MANAGER           → employees in departments I manage + other depts (marked)
  //   - SUPERVISOR              → my direct subordinates + other-dept employees (marked)
  //   - Other                   → none
  //
  // Always exclude system users (supervisors/managers/HR/admin).
  // Cross-dept request: SUPERVISOR/DEPT_MANAGER can also pick from OTHER depts
  // (those employees show under a separate "แผนกอื่น" group, and their dept manager
  //  gets an informational email when the OT is created).
  const employeeOnlyFilter = { user: null };
  let where: any;
  let crossDeptAllowed = false; // true if dropdown should show "ลูกน้องของฉัน" + "แผนกอื่น" groups
  if (role === "HR_ADMIN" || role === "SYSTEM_ADMIN") {
    where = { isActive: true, ...employeeOnlyFilter };
  } else if (role === "DEPT_MANAGER" && me) {
    // Show all active employees — UI groups managed vs others
    where = { isActive: true, ...employeeOnlyFilter };
    crossDeptAllowed = true;
  } else if (role === "SUPERVISOR" && me) {
    where = { isActive: true, ...employeeOnlyFilter };
    crossDeptAllowed = true;
  } else {
    where = { id: "__none__" };
  }

  const employees = await prisma.employee.findMany({
    where: where as any,
    orderBy: { firstName: "asc" },
    include: { department: true },
  });

  const busRoutes = await prisma.busRoute.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  const cutoff = await isCutOffPassed("CUTOFF_OT_CREATE");

  // Compute which employees are "own" vs "other" for grouping in UI
  let ownIds = new Set<string>();
  if (crossDeptAllowed && me) {
    if (role === "SUPERVISOR") {
      const myDirect = await prisma.employee.findMany({
        where: { supervisorId: me.id, isActive: true },
        select: { id: true },
      });
      ownIds = new Set(myDirect.map((e) => e.id));
    } else if (role === "DEPT_MANAGER") {
      const managedDepts = await prisma.department.findMany({
        where: { managerId: me.id }, select: { id: true },
      });
      const managedIds = new Set(managedDepts.map((d) => d.id));
      ownIds = new Set(
        employees.filter((e) => e.departmentId && managedIds.has(e.departmentId)).map((e) => e.id),
      );
    }
  }

  return (
    <OTCreateForm
      employees={employees.map((e) => ({
        id: e.id, code: e.employeeCode,
        name: `${e.firstName} ${e.lastName}`,
        dept: e.department?.name ?? "",
        defaultBusRouteId: e.defaultBusRouteId ?? null,
        isOwn: crossDeptAllowed ? ownIds.has(e.id) : true,
      }))}
      busRoutes={busRoutes.map((b) => ({ id: b.id, name: b.name, route: b.route ?? "" }))}
      cutoffPassed={cutoff.passed}
      cutoffTime={cutoff.cutoffTime}
      crossDeptAllowed={crossDeptAllowed}
    />
  );
}
