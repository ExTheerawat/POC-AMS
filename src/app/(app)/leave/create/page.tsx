import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { LeaveCreateForm } from "./leave-create-form";
import { isCutOffPassed } from "@/lib/cut-off";

export default async function LeaveCreatePage() {
  const session = await auth();
  const role = session!.user.role;
  const myEmployeeId = session!.user.employeeId;

  // ดึงข้อมูล employee ตัวเอง (เพื่อหา departmentId)
  const me = myEmployeeId
    ? await prisma.employee.findUnique({ where: { id: myEmployeeId }, select: { id: true, departmentId: true } })
    : null;

  // System is "supervisors file leave on behalf of employees" —
  // dropdown shows ONLY regular employees (no user account).
  // Supervisors / managers / HR / Admin take leave through a different process
  // outside this system, so they should never appear in the picker.
  const employeeOnlyFilter = { user: null };

  // Role-based scoping for the "เลือกพนักงาน" dropdown:
  //   - HR_ADMIN / SYSTEM_ADMIN → all active employees (no scope)
  //   - DEPT_MANAGER           → employees in departments I manage (managerId = me)
  //   - SUPERVISOR              → my direct subordinates (supervisorId = me) — ข้ามแผนกได้
  //   - Other roles             → none
  let where: any;
  if (role === "HR_ADMIN" || role === "SYSTEM_ADMIN") {
    where = { isActive: true, ...employeeOnlyFilter };
  } else if (role === "DEPT_MANAGER" && me) {
    const managed = await prisma.department.findMany({
      where: { managerId: me.id },
      select: { id: true },
    });
    const managedIds = managed.map((d) => d.id);
    where = managedIds.length > 0
      ? { isActive: true, departmentId: { in: managedIds }, ...employeeOnlyFilter }
      : { id: "__none__" };
  } else if (role === "SUPERVISOR" && me) {
    // ลูกน้องของฉัน (ข้ามแผนกได้)
    where = { supervisorId: me.id, isActive: true, ...employeeOnlyFilter };
  } else {
    where = { id: "__none__" };
  }

  const employees = await prisma.employee.findMany({
    where: where as any,
    orderBy: [{ employeeCode: "asc" }],
    include: { department: true },
  });

  const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  const cutoff = await isCutOffPassed("CUTOFF_LEAVE_CREATE");

  return (
    <LeaveCreateForm
      employees={employees.map((e) => ({
        id: e.id, code: e.employeeCode, name: `${e.firstName} ${e.lastName}`,
        department: e.department?.name ?? "", side: e.side,
      }))}
      leaveTypes={leaveTypes.map((t) => ({ id: t.id, name: t.name, code: t.code }))}
      cutoffPassed={cutoff.passed}
      cutoffTime={cutoff.cutoffTime}
    />
  );
}
