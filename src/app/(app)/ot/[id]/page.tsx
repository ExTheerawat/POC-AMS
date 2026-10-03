import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { Calendar, Clock, Users, Bus, User as UserIcon } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  PENDING_DEPT_MGR: "รอ ผจก.แผนก", PENDING_FACTORY_MGR: "รอ ผจก.โรงงาน",
  APPROVED: "อนุมัติแล้ว", COMPLETED: "เสร็จสิ้น", REJECTED: "ปฏิเสธ", CANCELLED: "ยกเลิก", MODIFIED_BY_HR: "HR แก้ไข", DRAFT: "ฉบับร่าง",
};
const STATUS_VARIANT: Record<string, any> = {
  PENDING_DEPT_MGR: "warning", PENDING_FACTORY_MGR: "warning",
  APPROVED: "success", COMPLETED: "success", REJECTED: "destructive", CANCELLED: "secondary", MODIFIED_BY_HR: "info",
};

export default async function OTDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { emp?: string };
}) {
  const o = await prisma.oTRequest.findUnique({
    where: { id: params.id },
    include: {
      creator: true, busRoute: true,
      employees: {
        include: {
          employee: { include: { department: true } },
          busRoute: true,
        },
      },
      approvals: { orderBy: { actedAt: "asc" } },
    },
  });
  if (!o) notFound();

  // Lookup approver names — JOIN on Employee
  const approverIds = Array.from(new Set(o.approvals.map((a) => a.approverId).filter(Boolean) as string[]));
  const approvers = approverIds.length > 0
    ? await prisma.employee.findMany({
        where: { id: { in: approverIds } },
        select: { id: true, firstName: true, lastName: true, employeeCode: true },
      })
    : [];
  const approverMap = new Map(approvers.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));

  // Optional filter: ?emp=<employeeId> → show only that one employee
  const focusedEmp = searchParams.emp
    ? o.employees.find((e) => e.employeeId === searchParams.emp)
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <BackButton fallback="/ot/list" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-mono">{o.requestNo}</CardTitle>
              <CardDescription>สร้างเมื่อ {formatDateTime(o.createdAt)}</CardDescription>
            </div>
            <div className="flex gap-2">
              {o.isHoliday && <Badge variant="warning">วันหยุด</Badge>}
              <Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div><div className="text-xs text-muted-foreground mb-1">วันที่</div><div className="font-medium flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> {formatDate(o.otDate)}</div></div>
          <div><div className="text-xs text-muted-foreground mb-1">ช่วงเวลา</div><div className="font-medium flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> {o.startTime} - {o.endTime} <span className="text-primary">({o.totalHours} ชม.)</span></div></div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">สายรถ</div>
            <div className="font-medium flex items-center gap-2">
              <Bus className="h-4 w-4" />
              {(() => {
                // Bus route summary — count only employees that are NOT rejected
                const activeEmps = o.employees.filter((e) => e.approvalStatus !== "REJECTED");
                const routes = new Map<string, { name: string; count: number }>();
                for (const e of activeEmps) {
                  const r = e.busRoute ?? o.busRoute;
                  if (!r) continue;
                  routes.set(r.id, { name: r.name, count: (routes.get(r.id)?.count ?? 0) + 1 });
                }
                if (routes.size === 0) return "-";
                if (routes.size === 1) return [...routes.values()][0].name;
                return (
                  <span className="text-sm">
                    {routes.size} สาย — {[...routes.values()].map((r) => `${r.name} (${r.count})`).join(", ")}
                  </span>
                );
              })()}
            </div>
          </div>
          <div><div className="text-xs text-muted-foreground mb-1">ฝ่าย</div><div className="font-medium">{o.side === "OFFICE" ? "Office" : "ผลิต"}</div></div>
          {o.workDescription && <div className="sm:col-span-2"><div className="text-xs text-muted-foreground mb-1">ลักษณะงาน</div><div className="text-sm p-3 rounded-lg bg-muted/50">{o.workDescription}</div></div>}
        </CardContent>
      </Card>

      {/* Employees section — focused view or all */}
      {focusedEmp ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserIcon className="h-5 w-5" /> พนักงานที่ทำ OT</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4 p-4 rounded-lg border bg-accent/30">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white grid place-items-center text-lg font-bold shrink-0">
                {focusedEmp.employee.firstName[0]}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <div className="text-lg font-semibold">{focusedEmp.employee.firstName} {focusedEmp.employee.lastName}</div>
                  <div className="text-sm text-muted-foreground">
                    {focusedEmp.employee.employeeCode} • {focusedEmp.employee.department?.name ?? "-"} • {focusedEmp.employee.position ?? "-"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {focusedEmp.attended ? (
                    <Badge variant="success">มาทำ OT</Badge>
                  ) : (
                    <Badge variant="destructive">ไม่มาทำ OT</Badge>
                  )}
                  <Badge variant="info">
                    ชั่วโมงจริง: {focusedEmp.actualHours ?? (focusedEmp.attended ? o.totalHours : 0)} ชม.
                  </Badge>
                  {(focusedEmp.busRoute || o.busRoute) && (
                    <Badge variant="outline" className="gap-1">
                      🚌 {focusedEmp.busRoute?.name ?? o.busRoute?.name}
                    </Badge>
                  )}
                  {focusedEmp.actualHours !== null && focusedEmp.actualHours !== o.totalHours && (
                    <Badge variant="warning">ขอ {o.totalHours} ชม. • จริง {focusedEmp.actualHours} ชม.</Badge>
                  )}
                </div>
                {focusedEmp.workDescription && (
                  <div className="mt-3 text-sm p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                    <div className="text-xs text-muted-foreground mb-1">ลักษณะงาน (เฉพาะคนนี้)</div>
                    {focusedEmp.workDescription}
                  </div>
                )}
                {focusedEmp.note && (
                  <div className="mt-3 text-sm p-3 rounded-lg bg-muted/50 italic">
                    หมายเหตุ: {focusedEmp.note}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {(() => {
            // Split employees by approvalStatus
            const approvedEmps = o.employees.filter((e) => e.approvalStatus === "APPROVED");
            const pendingEmps  = o.employees.filter((e) => e.approvalStatus === "PENDING");
            const rejectedEmps = o.employees.filter((e) => e.approvalStatus === "REJECTED");

            const renderEmpRow = (e: typeof o.employees[number], opts?: { muted?: boolean; trailing?: React.ReactNode }) => (
              <Link
                key={e.id}
                href={`/ot/${o.id}?emp=${e.employeeId}`}
                className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                  opts?.muted
                    ? "opacity-60 hover:opacity-100 hover:bg-accent/30"
                    : "hover:border-primary/40 hover:bg-accent/30"
                }`}
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold">
                  {e.employee.firstName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${opts?.muted ? "line-through" : ""}`}>
                    {e.employee.firstName} {e.employee.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {e.employee.employeeCode} • {e.employee.department?.name}
                    {(e.busRoute || o.busRoute) && <> • 🚌 {e.busRoute?.name ?? o.busRoute?.name}</>}
                  </div>
                </div>
                {opts?.trailing}
                {!e.attended && <Badge variant="destructive" className="text-[10px]">ไม่มา</Badge>}
              </Link>
            );

            return (
              <>
                {/* APPROVED employees (primary list) */}
                {approvedEmps.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" /> พนักงานที่ทำ OT ({approvedEmps.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {approvedEmps.map((e) => renderEmpRow(e))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* PENDING employees — only visible during multi-step workflow */}
                {pendingEmps.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-warning">
                        <Users className="h-5 w-5" /> รออนุมัติขั้นถัดไป ({pendingEmps.length})
                      </CardTitle>
                      <CardDescription>กำลังรอผู้จัดการขั้นต่อไปอนุมัติพนักงานกลุ่มนี้</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {pendingEmps.map((e) => renderEmpRow(e, {
                          trailing: <Badge variant="warning" className="text-[10px]">รออนุมัติ</Badge>,
                        }))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* REJECTED employees — shown muted at bottom for transparency */}
                {rejectedEmps.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-5 w-5" /> ถูกปฏิเสธในขั้นอนุมัติ ({rejectedEmps.length})
                      </CardTitle>
                      <CardDescription>พนักงานกลุ่มนี้ถูกปฏิเสธโดยผู้อนุมัติ — ไม่ได้ทำ OT จริง</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {rejectedEmps.map((e) => renderEmpRow(e, {
                          muted: true,
                          trailing: <Badge variant="destructive" className="text-[10px]">ปฏิเสธ</Badge>,
                        }))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {o.employees.length === 0 && (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground text-sm">
                      ไม่มีพนักงานในใบ OT นี้
                    </CardContent>
                  </Card>
                )}
              </>
            );
          })()}
        </>
      )}

      <Card>
        <CardHeader><CardTitle>ประวัติการอนุมัติ</CardTitle></CardHeader>
        <CardContent>
          {o.approvals.length === 0 ? (
            <div className="text-sm text-muted-foreground">ยังไม่มีประวัติ</div>
          ) : o.approvals.map((a) => {
            const approverName = a.approverId ? approverMap.get(a.approverId) : null;
            const actionLabel = a.action === "APPROVE" ? "อนุมัติ" : "ปฏิเสธ";
            return (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border mb-2">
                <div className={`h-8 w-8 rounded-full grid place-items-center ${a.action === "APPROVE" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                  {a.action === "APPROVE" ? "✓" : "✗"}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    Step {a.step} — {a.approverRole.replace("_", " ")} — {actionLabel}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {approverName ? <>โดย <b>{approverName}</b> · </> : null}
                    {formatDateTime(a.actedAt)}
                  </div>
                  {a.comment && <div className="text-sm mt-1 italic">&ldquo;{a.comment}&rdquo;</div>}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
