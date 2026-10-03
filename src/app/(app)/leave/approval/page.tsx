import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ApprovalList } from "./approval-list";
import { isCutOffPassed } from "@/lib/cut-off";

export default async function LeaveApprovalPage() {
  const session = await auth();
  const role = session!.user.role;
  const myEmployeeId = session!.user.employeeId;

  const where: any = {};
  if (role === "DEPT_MANAGER") {
    where.status = "PENDING_DEPT_MGR";
    // Find all departments I manage
    const myDepts = myEmployeeId
      ? await prisma.department.findMany({ where: { managerId: myEmployeeId }, select: { id: true } })
      : [];
    const myDeptIds = myDepts.map((d) => d.id);
    if (myDeptIds.length > 0) where.employee = { departmentId: { in: myDeptIds } };
    else where.id = "__none__";
  } else if (role === "FACTORY_MANAGER") {
    where.status = "PENDING_FACTORY_MGR";
    where.side = "PRODUCTION";
  } else {
    where.status = { in: ["PENDING_DEPT_MGR", "PENDING_FACTORY_MGR"] };
  }

  const [leaves, rejectReasons] = await Promise.all([
    prisma.leaveRequest.findMany({
      where, orderBy: { createdAt: "asc" },
      include: { employee: { include: { department: true } }, leaveType: true, creator: true },
    }),
    prisma.leaveRejectReason.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, label: true },
    }),
  ]);

  const cutoff = await isCutOffPassed("CUTOFF_LEAVE_APPROVE");

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-xl bg-amber-500/10 text-amber-600 grid place-items-center">
          <Inbox className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ใบลารออนุมัติ</h1>
          <p className="text-sm text-muted-foreground">{leaves.length} รายการ {cutoff.passed && <span className="text-warning">• เกินเวลา Cut-off ({cutoff.cutoffTime})</span>}</p>
        </div>
      </div>

      {leaves.length === 0 ? (
        <Card><CardContent className="p-16 text-center text-muted-foreground">ไม่มีรายการรออนุมัติ ✨</CardContent></Card>
      ) : (
        <ApprovalList
          leaves={leaves.map((l) => ({
            id: l.id,
            requestNo: l.requestNo,
            employeeName: `${l.employee.firstName} ${l.employee.lastName}`,
            employeeCode: l.employee.employeeCode,
            department: l.employee.department?.name ?? "-",
            leaveType: l.leaveType.name,
            leaveTypeCode: l.leaveType.code,
            startDate: l.startDate.toISOString(),
            endDate: l.endDate.toISOString(),
            selectedDates: l.selectedDates,
            totalDays: l.totalDays,
            reason: l.reason ?? "",
            hasAttachment: l.hasAttachment,
            attachmentNote: l.attachmentNote ?? "",
            status: l.status,
            side: l.side,
            createdAt: l.createdAt.toISOString(),
          }))}
          cutoffPassed={cutoff.passed}
          rejectReasons={rejectReasons}
        />
      )}
    </div>
  );
}
