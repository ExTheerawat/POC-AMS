import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { FileX } from "lucide-react";
import { CancelRequestForm } from "./cancel-form";

export default async function OTCancelRequestPage() {
  const session = await auth();
  const role = session!.user.role;
  const userSide = session!.user.side;
  const employeeId = session!.user.employeeId;
  const isHR = role === "HR_ADMIN" || role === "SYSTEM_ADMIN";

  // Scope: only OTs the current user is allowed to act on
  //  - SUPERVISOR: own OTs (creatorId = me)
  //  - DEPT_MANAGER / FACTORY_MANAGER: same side only
  //  - HR_ADMIN / SYSTEM_ADMIN: all
  const otWhere: any = { status: { in: ["APPROVED", "PENDING_DEPT_MGR", "PENDING_FACTORY_MGR"] } };
  if (role === "SUPERVISOR") {
    if (employeeId) otWhere.creatorId = employeeId;
    else otWhere.id = "__none__";
  } else if (role === "DEPT_MANAGER" || role === "FACTORY_MANAGER") {
    if (userSide) otWhere.side = userSide;
    else otWhere.id = "__none__";
  }

  // OT records that are still active (not cancelled)
  const ots = await prisma.oTRequest.findMany({
    where: otWhere,
    orderBy: { otDate: "desc" }, take: 50,
    include: { employees: { include: { employee: true } } },
  });

  // Employees that already have PENDING or APPROVED cancellation per OT — should be excluded from the dropdown
  const existingCancels = await prisma.oTCancellation.findMany({
    where: {
      otRequestId: { in: ots.map((o) => o.id) },
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: { otRequestId: true, employeeId: true },
  });
  const blockedSet = new Set(existingCancels.map((c) => `${c.otRequestId}::${c.employeeId}`));

  // Show only PENDING requests — APPROVED/REJECTED ones go to email,
  //   not the working list (avoids clutter when there's a long history)
  const cancellations = await prisma.oTCancellation.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      otRequest: { select: { requestNo: true, otDate: true, startTime: true, endTime: true } },
    },
  });

  // Load employee + requestedBy info per cancellation
  const empIds = Array.from(new Set(cancellations.flatMap((c) => [c.employeeId, c.requestedById]).filter(Boolean)));
  const emps = await prisma.employee.findMany({ where: { id: { in: empIds } } });
  const empMap = new Map(emps.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-xl bg-rose-500/10 text-rose-600 grid place-items-center"><FileX className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ขอยกเลิก OT พนักงาน</h1>
          <p className="text-sm text-muted-foreground">
            {isHR
              ? "รับเรื่องขอยกเลิก OT จากหัวหน้า — Approve/Reject ได้"
              : "ส่งคำขอยกเลิก OT ของพนักงานในกะนี้ไปยัง HR Admin"}
          </p>
        </div>
      </div>
      <CancelRequestForm
        isHR={isHR}
        ots={ots.map((o) => ({
          id: o.id, requestNo: o.requestNo, otDate: o.otDate.toISOString(),
          startTime: o.startTime, endTime: o.endTime,
          employees: o.employees
            // Hide already-cancelled employees + those marked not attended (attended=false)
            .filter((e) => !blockedSet.has(`${o.id}::${e.employeeId}`) && e.attended !== false)
            .map((e) => ({ id: e.employeeId, name: `${e.employee.firstName} ${e.employee.lastName}`, code: e.employee.employeeCode })),
        }))}
        cancellations={cancellations.map((c) => ({
          id: c.id,
          otRequestNo: c.otRequest.requestNo,
          otDate: c.otRequest.otDate.toISOString(),
          otTime: `${c.otRequest.startTime}-${c.otRequest.endTime}`,
          employeeName: empMap.get(c.employeeId) ?? "-",
          requestedByName: empMap.get(c.requestedById) ?? "-",
          reason: c.reason,
          status: c.status,
          hrComment: c.hrComment ?? "",
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
