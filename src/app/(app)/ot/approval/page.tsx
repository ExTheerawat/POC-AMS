import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { OTApprovalList } from "./approval-list";
import { isCutOffPassed } from "@/lib/cut-off";

export default async function OTApprovalPage() {
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
    if (myDeptIds.length > 0) where.creator = { departmentId: { in: myDeptIds } };
    else where.id = "__none__";
  } else if (role === "FACTORY_MANAGER") {
    where.status = "PENDING_FACTORY_MGR";
    where.side = "PRODUCTION";
  } else {
    where.status = { in: ["PENDING_DEPT_MGR", "PENDING_FACTORY_MGR"] };
  }

  const ots = await prisma.oTRequest.findMany({
    where, orderBy: { createdAt: "asc" },
    include: { creator: true, busRoute: true, employees: { include: { employee: true, busRoute: true } } },
  });

  const cutoff = await isCutOffPassed("CUTOFF_OT_APPROVE");

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-xl bg-amber-500/10 text-amber-600 grid place-items-center"><Inbox className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">OT รออนุมัติ</h1>
          <p className="text-sm text-muted-foreground">
            {ots.length} รายการ
            {cutoff.passed && <span className="text-warning"> • เกินเวลา Cut-off ({cutoff.cutoffTime})</span>}
          </p>
        </div>
      </div>
      {ots.length === 0 ? (
        <Card><CardContent className="p-16 text-center text-muted-foreground">ไม่มีรายการรออนุมัติ ✨</CardContent></Card>
      ) : (
        <OTApprovalList
          ots={ots.map((o) => {
            // Only show employees that are still PENDING — the approver decides on them this step
            const pendingEmps = o.employees.filter((e) => e.approvalStatus === "PENDING");
            // Per-route summary — count pending employees per route (use OT-level default as fallback)
            const routeMap = new Map<string, number>();
            for (const e of pendingEmps) {
              const name = e.busRoute?.name ?? o.busRoute?.name ?? "-";
              routeMap.set(name, (routeMap.get(name) ?? 0) + 1);
            }
            const busRoutesSummary = [...routeMap.entries()]
              .sort((a, b) => b[1] - a[1])  // most-common first
              .map(([name, count]) => ({ name, count }));

            return {
              id: o.id, requestNo: o.requestNo,
              otDate: o.otDate.toISOString(),
              startTime: o.startTime, endTime: o.endTime, totalHours: o.totalHours,
              isHoliday: o.isHoliday, workDescription: o.workDescription ?? "",
              busRoute: o.busRoute?.name ?? "-",
              busRoutesSummary,
              side: o.side, status: o.status,
              creator: `${o.creator.firstName} ${o.creator.lastName}`,
              employeeCount: pendingEmps.length,
              employeePreview: pendingEmps.slice(0, 3).map((e) => `${e.employee.firstName} ${e.employee.lastName}`),
              employees: pendingEmps.map((e) => ({
                id: e.id,
                employeeCode: e.employee.employeeCode,
                name: `${e.employee.firstName} ${e.employee.lastName}`,
              })),
            };
          })}
          cutoffPassed={cutoff.passed}
        />
      )}
    </div>
  );
}
