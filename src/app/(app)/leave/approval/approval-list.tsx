"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, X, Paperclip, Calendar, Eye, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { approveLeave, approveLeaveBatch } from "@/server/actions/leave";
import { formatDate } from "@/lib/utils";

type RejectReason = { id: string; code: string; label: string };

type Leave = {
  id: string; requestNo: string; employeeName: string; employeeCode: string;
  department: string; leaveType: string; leaveTypeCode: string;
  startDate: string; endDate: string;
  selectedDates: string | null;
  totalDays: number; reason: string; hasAttachment: boolean; attachmentNote: string;
  status: string; side: string; createdAt: string;
};

type DateEntry = { date: string; half: "MORNING" | "AFTERNOON" | null };

/** Parse selectedDates JSON — supports old string[] and new [{date, half}] formats */
function parseDates(raw: string | null): DateEntry[] | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const out: DateEntry[] = [];
    for (const item of arr) {
      if (typeof item === "string") out.push({ date: item, half: null });
      else if (item && typeof item === "object" && typeof item.date === "string") {
        const half = item.half === "MORNING" || item.half === "AFTERNOON" ? item.half : null;
        out.push({ date: item.date, half });
      }
    }
    return out.length > 0 ? out : null;
  } catch { /* ignore */ }
  return null;
}

function halfLabel(h: string | null) {
  return h === "MORNING" ? " (ครึ่งเช้า)" : h === "AFTERNOON" ? " (ครึ่งบ่าย)" : "";
}

export function ApprovalList({
  leaves, cutoffPassed, rejectReasons,
}: {
  leaves: Leave[];
  cutoffPassed: boolean;
  rejectReasons: RejectReason[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<Leave | null>(null);
  const [action, setAction] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [comment, setComment] = useState("");
  const [rejectReasonId, setRejectReasonId] = useState<string>("");

  // Bulk select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"APPROVE" | "REJECT" | null>(null);
  const [bulkComment, setBulkComment] = useState("");
  const [bulkRejectReasonId, setBulkRejectReasonId] = useState("");

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAll = () => {
    if (selectedIds.size === leaves.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(leaves.map((l) => l.id)));
  };

  const open = (l: Leave, a: "APPROVE" | "REJECT") => {
    setTarget(l); setAction(a); setComment(""); setRejectReasonId("");
  };

  const submit = () => {
    if (!target) return;
    if (action === "REJECT" && !rejectReasonId) {
      toast.error("กรุณาเลือกเหตุผลปฏิเสธ");
      return;
    }
    startTransition(async () => {
      const res = await approveLeave(target.id, action, comment, action === "REJECT" ? rejectReasonId : undefined);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(action === "APPROVE" ? "อนุมัติเรียบร้อย" : "ปฏิเสธเรียบร้อย");
        setTarget(null);
        router.refresh();
      }
    });
  };

  const handleBulk = () => {
    if (!bulkAction || selectedIds.size === 0) return;
    if (bulkAction === "REJECT" && !bulkRejectReasonId) {
      toast.error("กรุณาเลือกเหตุผลปฏิเสธ");
      return;
    }
    const ids = Array.from(selectedIds);
    startTransition(async () => {
      const res = await approveLeaveBatch(
        ids, bulkAction, bulkComment,
        bulkAction === "REJECT" ? bulkRejectReasonId : undefined,
      );
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      const succeeded = ("succeeded" in res ? res.succeeded : 0) ?? 0;
      const failed = ("failed" in res ? res.failed : 0) ?? 0;
      if (failed > 0) {
        toast.warning(`${bulkAction === "APPROVE" ? "อนุมัติ" : "ปฏิเสธ"} ${succeeded} รายการ — ล้มเหลว ${failed} รายการ`);
      } else {
        toast.success(`${bulkAction === "APPROVE" ? "อนุมัติ" : "ปฏิเสธ"} ${succeeded} รายการเรียบร้อย`);
      }
      setBulkAction(null);
      setBulkComment("");
      setBulkRejectReasonId("");
      setSelectedIds(new Set());
      router.refresh();
    });
  };

  return (
    <>
      {/* Toolbar — select all + bulk action bar */}
      {leaves.length > 0 && (
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedIds.size === leaves.length && leaves.length > 0}
              onCheckedChange={selectAll}
            />
            <span className="text-sm text-muted-foreground">
              {selectedIds.size === 0
                ? `เลือกทั้งหมด (${leaves.length} รายการ)`
                : `เลือกแล้ว ${selectedIds.size} จาก ${leaves.length} รายการ`}
            </span>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg border-2 border-primary bg-primary/5">
              <Button
                size="sm" variant="success"
                onClick={() => { setBulkAction("APPROVE"); setBulkComment(""); setBulkRejectReasonId(""); }}
                disabled={cutoffPassed}
              >
                <Check className="h-3.5 w-3.5" /> อนุมัติทั้งหมด ({selectedIds.size})
              </Button>
              <Button
                size="sm" variant="destructive"
                onClick={() => { setBulkAction("REJECT"); setBulkComment(""); setBulkRejectReasonId(""); }}
              >
                <X className="h-3.5 w-3.5" /> ปฏิเสธทั้งหมด ({selectedIds.size})
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                ล้างการเลือก
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3">
        {leaves.map((l) => {
          const dates = parseDates(l.selectedDates);
          const isMulti = !!dates;
          const isSelected = selectedIds.has(l.id);
          return (
          <Card key={l.id} className={`hover:border-primary/40 transition-colors ${isSelected ? "border-primary bg-primary/5" : ""}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="pt-1">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(l.id)}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{l.requestNo}</span>
                    <Badge variant="outline">{l.side === "OFFICE" ? "Office" : "ผลิต"}</Badge>
                    <Badge variant="warning">{l.leaveTypeCode}-{l.leaveType}</Badge>
                    {l.hasAttachment && <Badge variant="info"><Paperclip className="h-3 w-3 mr-1" /> มีเอกสารแนบ</Badge>}
                    {isMulti && <Badge variant="info"><ListChecks className="h-3 w-3 mr-1" /> เลือกหลายวัน</Badge>}
                  </div>
                  <div className="font-semibold">{l.employeeName} <span className="text-muted-foreground font-normal text-sm">({l.employeeCode})</span></div>
                  <div className="text-sm text-muted-foreground mt-0.5">{l.department}</div>

                  {/* Date display — chips for multi-date, range otherwise */}
                  {isMulti ? (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">วันที่ลา:</span>
                        <span className="font-medium text-primary">{l.totalDays} วัน</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 ml-6">
                        {dates!.map((entry) => (
                          <span
                            key={entry.date}
                            className={`inline-block px-2 py-0.5 rounded text-xs tabular-nums ${
                              entry.half ? "bg-amber-100 text-amber-800" : "bg-primary/10 text-primary"
                            }`}
                          >
                            {formatDate(entry.date)}{halfLabel(entry.half)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-3 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {formatDate(l.startDate)}
                      {formatDate(l.startDate) !== formatDate(l.endDate) && ` - ${formatDate(l.endDate)}`}
                      <span className="font-medium text-primary">({l.totalDays} วัน)</span>
                    </div>
                  )}

                  {l.reason && <div className="text-sm text-muted-foreground mt-2 italic">"{l.reason}"</div>}
                  {l.attachmentNote && <div className="text-xs text-muted-foreground mt-1">แนบ: {l.attachmentNote}</div>}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/leave/${l.id}`}>
                      <Eye className="h-4 w-4" /> ดูรายละเอียด
                    </Link>
                  </Button>
                  <Button size="sm" variant="success" onClick={() => open(l, "APPROVE")} disabled={cutoffPassed}>
                    <Check className="h-4 w-4" /> อนุมัติ
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => open(l, "REJECT")}>
                    <X className="h-4 w-4" /> ปฏิเสธ
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>

      <Dialog open={!!target} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action === "APPROVE" ? "ยืนยันการอนุมัติ" : "ยืนยันการปฏิเสธ"}</DialogTitle>
            <DialogDescription>
              {target?.employeeName} • {target?.leaveType} • {target?.totalDays} วัน
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {action === "REJECT" && (
              <div className="space-y-1.5">
                <Label>เหตุผลปฏิเสธ *</Label>
                <Select value={rejectReasonId} onValueChange={setRejectReasonId}>
                  <SelectTrigger><SelectValue placeholder="เลือกเหตุผล..." /></SelectTrigger>
                  <SelectContent>
                    {rejectReasons.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        ยังไม่มีเหตุผล — HR สามารถเพิ่มได้ที่ /master/leave-reject-reasons
                      </div>
                    ) : rejectReasons.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{action === "REJECT" ? "หมายเหตุเพิ่มเติม" : "ความเห็น"}{action === "REJECT" ? " (ถ้ามี)" : ""}</Label>
              <Textarea
                placeholder={action === "REJECT" ? "อธิบายเพิ่มเติม (ไม่บังคับ)" : "ความเห็น (ถ้ามี)"}
                rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>ยกเลิก</Button>
            <Button onClick={submit} disabled={pending} variant={action === "APPROVE" ? "success" : "destructive"}>
              {pending ? "กำลังบันทึก..." : action === "APPROVE" ? "อนุมัติ" : "ปฏิเสธ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Dialog */}
      <Dialog open={!!bulkAction} onOpenChange={(v) => !v && setBulkAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAction === "APPROVE"
                ? `ยืนยันอนุมัติ ${selectedIds.size} รายการ`
                : `ยืนยันปฏิเสธ ${selectedIds.size} รายการ`}
            </DialogTitle>
            <DialogDescription>
              {bulkAction === "APPROVE"
                ? "ระบบจะอนุมัติใบลาทั้งหมดที่เลือก (ส่ง email แจ้งผู้สร้างทีละใบ)"
                : "ใช้เหตุผลและความเห็นเดียวกันกับทุกใบที่เลือก"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {bulkAction === "REJECT" && (
              <div className="space-y-1.5">
                <Label>เหตุผลปฏิเสธ * (ใช้ร่วมกันทุกใบ)</Label>
                <Select value={bulkRejectReasonId} onValueChange={setBulkRejectReasonId}>
                  <SelectTrigger><SelectValue placeholder="เลือกเหตุผล..." /></SelectTrigger>
                  <SelectContent>
                    {rejectReasons.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{bulkAction === "REJECT" ? "หมายเหตุเพิ่มเติม (ถ้ามี)" : "ความเห็น (ถ้ามี)"}</Label>
              <Textarea
                placeholder={bulkAction === "REJECT" ? "อธิบายเพิ่มเติม" : "ความเห็น"}
                rows={3} value={bulkComment} onChange={(e) => setBulkComment(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)}>ยกเลิก</Button>
            <Button
              onClick={handleBulk}
              disabled={pending}
              variant={bulkAction === "APPROVE" ? "success" : "destructive"}
            >
              {pending
                ? "กำลังบันทึก..."
                : bulkAction === "APPROVE"
                  ? `อนุมัติ ${selectedIds.size} รายการ`
                  : `ปฏิเสธ ${selectedIds.size} รายการ`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
