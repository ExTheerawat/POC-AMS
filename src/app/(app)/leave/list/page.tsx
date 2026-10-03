import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { LeaveListClient } from "./leave-list-client";

export default async function LeaveListPage() {
  const session = await auth();
  const role = session!.user.role;
  const employeeId = session!.user.employeeId;
  const userSide = session!.user.side;

  // ดึง employee ตัวเอง (เพื่อหา departmentId ของตัวเอง)
  const me = employeeId
    ? await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, departmentId: true } })
    : null;

  // Role-based scoping for leave list:
  //   - SUPERVISOR             → leaves of all subordinates (ข้ามแผนกได้) OR leaves I created
  //   - DEPT_MANAGER           → leaves of employees in departments I manage
  //   - FACTORY_MANAGER        → all PRODUCTION side
  //   - HR_ADMIN / SYSTEM_ADMIN → all
  const where: any = {};
  if (role === "SUPERVISOR" && me) {
    // ลูกน้องของฉัน (ข้ามแผนกได้) หรือใบลาที่ฉันเป็นคนสร้าง
    where.OR = [
      { creatorId: me.id },
      { employee: { supervisorId: me.id } },
    ];
  } else if (role === "DEPT_MANAGER" && me) {
    const managed = await prisma.department.findMany({
      where: { managerId: me.id },
      select: { id: true },
    });
    const managedIds = managed.map((d) => d.id);
    if (managedIds.length > 0) where.employee = { departmentId: { in: managedIds } };
    else where.id = "__none__";
  } else if (role === "FACTORY_MANAGER") {
    if (userSide) where.side = userSide;
    else where.id = "__none__";
  }
  // HR_ADMIN / SYSTEM_ADMIN — no filter (see all)

  const [leaves, leaveTypes] = await Promise.all([
    prisma.leaveRequest.findMany({
      where, orderBy: { createdAt: "desc" }, take: 500,
      include: { employee: { include: { department: true } }, leaveType: true, creator: true },
    }),
    prisma.leaveType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const isAdmin = role === "HR_ADMIN" || role === "SYSTEM_ADMIN";

  return (
    <LeaveListClient
      role={role}
      currentEmployeeId={employeeId}
      isAdmin={isAdmin}
      leaves={leaves.map((l) => ({
        id: l.id,
        requestNo: l.requestNo,
        employeeName: `${l.employee.firstName} ${l.employee.lastName}`,
        department: l.employee.department?.name ?? "-",
        leaveTypeId: l.leaveTypeId,
        leaveTypeName: l.leaveType.name,
        leaveTypeCode: l.leaveType.code,
        halfDayType: l.halfDayType,
        startDate: l.startDate.toISOString(),
        endDate: l.endDate.toISOString(),
        totalDays: l.totalDays,
        reason: l.reason ?? "",
        hasAttachment: l.hasAttachment,
        attachmentNote: l.attachmentNote ?? "",
        side: l.side,
        status: l.status,
        creatorId: l.creatorId,
      }))}
      leaveTypes={leaveTypes.map((t) => ({ id: t.id, name: t.name, code: t.code }))}
    />
  );
}
