import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { FileX } from "lucide-react";
import { CancelLeaveRequestForm } from "./cancel-form";

export default async function LeaveCancelRequestPage() {
  const session = await auth();
  const role = session!.user.role;
  const myEmployeeId = session!.user.employeeId;
  const isHR = role === "HR_ADMIN" || role === "SYSTEM_ADMIN";

  // Scope: only APPROVED leaves visible per role
  const leaveWhere: any = { status: "APPROVED" };
  if (!isHR && myEmployeeId) {
    if (role === "SUPERVISOR") {
      leaveWhere.OR = [
        { creatorId: myEmployeeId },
        { employee: { supervisorId: myEmployeeId } },
      ];
    } else if (role === "DEPT_MANAGER") {
      const managed = await prisma.department.findMany({
        where: { managerId: myEmployeeId },
        select: { id: true },
      });
      const managedIds = managed.map((d) => d.id);
      if (managedIds.length > 0) leaveWhere.employee = { departmentId: { in: managedIds } };
      else leaveWhere.id = "__none__";
    } else if (role === "FACTORY_MANAGER") {
      leaveWhere.side = "PRODUCTION";
    } else {
      leaveWhere.id = "__none__";
    }
  }

  const leaves = await prisma.leaveRequest.findMany({
    where: leaveWhere,
    orderBy: { startDate: "desc" },
    take: 100,
    include: {
      employee: { include: { department: true } },
      leaveType: true,
    },
  });

  // Filter out leaves that already have PENDING/APPROVED cancellation
  const existingCancels = await prisma.leaveCancellation.findMany({
    where: {
      leaveRequestId: { in: leaves.map((l) => l.id) },
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: { leaveRequestId: true },
  });
  const blockedIds = new Set(existingCancels.map((c) => c.leaveRequestId));
  const eligibleLeaves = leaves.filter((l) => !blockedIds.has(l.id));

  // Show only PENDING requests — APPROVED/REJECTED go to email, not the working list
  const cancellations = await prisma.leaveCancellation.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      leaveRequest: {
        include: {
          employee: true,
          leaveType: true,
        },
      },
    },
  });

  // Lookup requester names
  const requesterIds = Array.from(new Set(cancellations.map((c) => c.requestedById).filter(Boolean)));
  const requesters = await prisma.employee.findMany({ where: { id: { in: requesterIds } } });
  const requesterMap = new Map(requesters.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-xl bg-rose-500/10 text-rose-600 grid place-items-center">
          <FileX className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ขอยกเลิกการลา</h1>
          <p className="text-muted-foreground">
            {isHR
              ? "รับคำขอยกเลิกใบลาจากหัวหน้า/ผจก. — Approve/Reject ได้"
              : "ส่งคำขอยกเลิกใบลา (ที่อนุมัติแล้ว) ไปยัง HR Admin"}
          </p>
        </div>
      </div>

      <CancelLeaveRequestForm
        isHR={isHR}
        leaves={eligibleLeaves.map((l) => ({
          id: l.id,
          requestNo: l.requestNo,
          employeeCode: l.employee.employeeCode,
          employeeName: `${l.employee.firstName} ${l.employee.lastName}`,
          department: l.employee.department?.name ?? "-",
          leaveTypeName: l.leaveType.name,
          startDate: l.startDate.toISOString(),
          endDate: l.endDate.toISOString(),
          totalDays: l.totalDays,
        }))}
        cancellations={cancellations.map((c) => ({
          id: c.id,
          requestNo: c.leaveRequest.requestNo,
          employeeName: `${c.leaveRequest.employee.firstName} ${c.leaveRequest.employee.lastName}`,
          leaveTypeName: c.leaveRequest.leaveType.name,
          startDate: c.leaveRequest.startDate.toISOString(),
          endDate: c.leaveRequest.endDate.toISOString(),
          totalDays: c.leaveRequest.totalDays,
          requestedByName: requesterMap.get(c.requestedById) ?? "-",
          reason: c.reason,
          status: c.status,
          hrComment: c.hrComment ?? "",
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
