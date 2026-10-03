import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/ui/back-button";
import { Calendar, Paperclip, User } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "ฉบับร่าง", PENDING_DEPT_MGR: "รอ ผจก.แผนก", PENDING_FACTORY_MGR: "รอ ผจก.โรงงาน",
  APPROVED: "อนุมัติแล้ว", REJECTED: "ปฏิเสธ", CANCELLED: "ยกเลิก",
};
const STATUS_VARIANT: Record<string, any> = {
  PENDING_DEPT_MGR: "warning", PENDING_FACTORY_MGR: "warning",
  APPROVED: "success", REJECTED: "destructive", CANCELLED: "secondary",
};

export default async function LeaveDetailPage({ params }: { params: { id: string } }) {
  const l = await prisma.leaveRequest.findUnique({
    where: { id: params.id },
    include: {
      employee: { include: { department: true } },
      leaveType: true, creator: true,
      approvals: {
        orderBy: { actedAt: "asc" },
        include: { rejectReason: true },
      },
    },
  });
  if (!l) notFound();

  // Lookup approver names
  const approverIds = Array.from(new Set(l.approvals.map((a) => a.approverId).filter(Boolean) as string[]));
  const approvers = approverIds.length > 0
    ? await prisma.employee.findMany({
        where: { id: { in: approverIds } },
        select: { id: true, firstName: true, lastName: true, employeeCode: true },
      })
    : [];
  const approverMap = new Map(approvers.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <BackButton fallback="/leave/list" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-mono text-base">{l.requestNo}</CardTitle>
              <CardDescription>สร้างเมื่อ {formatDateTime(l.createdAt)}</CardDescription>
            </div>
            <Badge variant={STATUS_VARIANT[l.status]}>{STATUS_LABEL[l.status]}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">พนักงาน</div>
              <div className="font-medium">{l.employee.firstName} {l.employee.lastName}</div>
              <div className="text-sm text-muted-foreground">{l.employee.employeeCode} • {l.employee.department?.name}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">ประเภทการลา</div>
              <div className="font-medium">{l.leaveType.code}-{l.leaveType.name}</div>
              <div className="text-sm text-muted-foreground">ฝ่าย: {l.side === "OFFICE" ? "Office" : "ผลิต"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">วันที่ลา</div>
              {(() => {
                // Normalize to [{ date, half }] — supports old string[], new [{date, half}], legacy halfDayType, and plain range
                type Entry = { date: string; half: "MORNING" | "AFTERNOON" | null };
                let entries: Entry[] = [];
                let isPick = false;
                if (l.selectedDates) {
                  try {
                    const arr = JSON.parse(l.selectedDates);
                    if (Array.isArray(arr) && arr.length > 0) {
                      for (const item of arr) {
                        if (typeof item === "string") entries.push({ date: item, half: null });
                        else if (item && typeof item === "object" && typeof item.date === "string") {
                          const half = item.half === "MORNING" || item.half === "AFTERNOON" ? item.half : null;
                          entries.push({ date: item.date, half });
                        }
                      }
                      isPick = entries.length > 0;
                    }
                  } catch { /* ignore */ }
                }
                if (entries.length === 0) {
                  // Range mode — expand into per-day entries (apply legacy halfDayType if single day)
                  const expanded: Entry[] = [];
                  const cur = new Date(l.startDate);
                  cur.setHours(0, 0, 0, 0);
                  const last = new Date(l.endDate);
                  last.setHours(0, 0, 0, 0);
                  while (cur <= last) {
                    const y = cur.getFullYear();
                    const m = String(cur.getMonth() + 1).padStart(2, "0");
                    const d = String(cur.getDate()).padStart(2, "0");
                    expanded.push({ date: `${y}-${m}-${d}`, half: null });
                    cur.setDate(cur.getDate() + 1);
                  }
                  if (expanded.length === 1 && (l.halfDayType === "MORNING" || l.halfDayType === "AFTERNOON")) {
                    expanded[0].half = l.halfDayType;
                  }
                  entries = expanded;
                }
                const halfLabel = (h: string | null) => h === "MORNING" ? " (ครึ่งเช้า)" : h === "AFTERNOON" ? " (ครึ่งบ่าย)" : "";
                const s = formatDate(l.startDate);
                const e = formatDate(l.endDate);
                const summary = isPick
                  ? `${l.totalDays} วัน (เลือกรายวัน)`
                  : `${s}${s !== e ? ` ถึง ${e}` : ""}${halfLabel(l.halfDayType)} (${l.totalDays} วัน)`;
                return (
                  <>
                    <div className="font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      {summary}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {entries.map((entry) => {
                        const bg = entry.half ? "bg-amber-100 text-amber-800" : "bg-primary/10 text-primary";
                        return (
                          <span
                            key={entry.date}
                            className={`inline-block px-2 py-0.5 rounded text-sm tabular-nums ${bg}`}
                            title={`${formatDate(entry.date)}${halfLabel(entry.half)}`}
                          >
                            {formatDate(entry.date)}{halfLabel(entry.half)}
                          </span>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">ผู้สร้างใบลา</div>
              <div className="font-medium flex items-center gap-2"><User className="h-4 w-4" /> {l.creator.firstName} {l.creator.lastName}</div>
            </div>
          </div>
          {l.reason && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">เหตุผล</div>
              <div className="text-sm p-3 rounded-lg bg-muted/50">{l.reason}</div>
            </div>
          )}
          {l.hasAttachment && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <Paperclip className="h-4 w-4" /> มีเอกสารแนบ — {l.attachmentNote || "ไม่ระบุ"}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>ประวัติการอนุมัติ</CardTitle></CardHeader>
        <CardContent>
          {l.approvals.length === 0 ? (
            <div className="text-sm text-muted-foreground">ยังไม่มีประวัติการอนุมัติ</div>
          ) : (
            <div className="space-y-3">
              {l.approvals.map((a) => {
                const approverName = a.approverId ? approverMap.get(a.approverId) : null;
                return (
                  <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border">
                    <div className={`h-8 w-8 rounded-full grid place-items-center shrink-0 ${a.action === "APPROVE" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                      {a.action === "APPROVE" ? "✓" : "✗"}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        Step {a.step} — {a.approverRole.replace("_", " ")} — {a.action === "APPROVE" ? "อนุมัติ" : "ปฏิเสธ"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {approverName ? <>โดย <b>{approverName}</b> · </> : null}
                        {formatDateTime(a.actedAt)}
                      </div>
                      {a.rejectReason && (
                        <div className="text-sm mt-1">
                          <span className="text-muted-foreground">เหตุผล: </span>
                          <span className="font-medium text-destructive">{a.rejectReason.label}</span>
                        </div>
                      )}
                      {a.comment && <div className="text-sm mt-1 italic">&ldquo;{a.comment}&rdquo;</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
