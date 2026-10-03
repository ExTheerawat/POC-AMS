"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Send, Check, X, Calendar, User, Users, UserX, FileX } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { requestCancelOTBatch, approveCancelOT, rejectCancelOT, approveCancelOTBatch, rejectCancelOTBatch } from "@/server/actions/ot";
import { formatDate, formatDateTime } from "@/lib/utils";

type OT = {
  id: string; requestNo: string; otDate: string; startTime: string; endTime: string;
  employees: { id: string; name: string; code: string }[];
};

type Cancellation = {
  id: string; otRequestNo: string; otDate: string; otTime: string;
  employeeName: string; requestedByName: string;
  reason: string; status: string; hrComment: string; createdAt: string;
};

type Props = { isHR: boolean; ots: OT[]; cancellations: Cancellation[] };

type CancelMode = "ALL" | "SELECT";

const STATUS_VARIANT: Record<string, any> = {
  PENDING: "warning", APPROVED: "success", REJECTED: "destructive",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "รอ HR", APPROVED: "อนุมัติแล้ว", REJECTED: "ปฏิเสธ",
};

export function CancelRequestForm({ isHR, ots, cancellations }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [otId, setOtId] = useState("");
  const [cancelMode, setCancelMode] = useState<CancelMode>("ALL");
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");

  const [actionTarget, setActionTarget] = useState<{ c: Cancellation; type: "APPROVE" | "REJECT" } | null>(null);
  const [comment, setComment] = useState("");

  // Bulk-select state (HR only)
  const [selectedCancelIds, setSelectedCancelIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"APPROVE" | "REJECT" | null>(null);
  const [bulkComment, setBulkComment] = useState("");

  const pendingCancellations = useMemo(
    () => cancellations.filter((c) => c.status === "PENDING"),
    [cancellations],
  );

  // Group pending cancellations by OT number — used for "select whole document"
  const pendingByOt = useMemo(() => {
    const m = new Map<string, Cancellation[]>();
    for (const c of pendingCancellations) {
      const arr = m.get(c.otRequestNo) ?? [];
      arr.push(c);
      m.set(c.otRequestNo, arr);
    }
    return m;
  }, [pendingCancellations]);

  const toggleCancelId = (id: string) => {
    setSelectedCancelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllPending = () => {
    if (selectedCancelIds.size === pendingCancellations.length) {
      setSelectedCancelIds(new Set());
    } else {
      setSelectedCancelIds(new Set(pendingCancellations.map((c) => c.id)));
    }
  };

  const selectWholeDoc = (otRequestNo: string) => {
    const ids = (pendingByOt.get(otRequestNo) ?? []).map((c) => c.id);
    setSelectedCancelIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const isWholeDocSelected = (otRequestNo: string) => {
    const ids = pendingByOt.get(otRequestNo) ?? [];
    return ids.length > 0 && ids.every((c) => selectedCancelIds.has(c.id));
  };

  const handleBulkAction = () => {
    if (!bulkAction || selectedCancelIds.size === 0) return;
    const ids = Array.from(selectedCancelIds);
    startTransition(async () => {
      const fn = bulkAction === "APPROVE" ? approveCancelOTBatch : rejectCancelOTBatch;
      const res = await fn(ids, bulkComment);
      if ("error" in res) toast.error(res.error);
      else {
        const count = "approved" in res ? res.approved : res.rejected;
        const extra = "fullyCancelled" in res && res.fullyCancelled > 0
          ? ` (OT ${res.fullyCancelled} ใบถูกตั้งเป็นยกเลิก)`
          : "";
        toast.success(`${bulkAction === "APPROVE" ? "อนุมัติ" : "ปฏิเสธ"} ${count} รายการ${extra}`);
        setSelectedCancelIds(new Set());
        setBulkAction(null);
        setBulkComment("");
        router.refresh();
      }
    });
  };

  const selectedOT = useMemo(() => ots.find((o) => o.id === otId), [otId, ots]);
  const employees = selectedOT?.employees ?? [];

  const toggleEmp = (empId: string) => {
    setSelectedEmpIds((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedEmpIds.size === employees.length) {
      setSelectedEmpIds(new Set());
    } else {
      setSelectedEmpIds(new Set(employees.map((e) => e.id)));
    }
  };

  const effectiveIds = cancelMode === "ALL" ? employees.map((e) => e.id) : Array.from(selectedEmpIds);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otId) { toast.error("กรุณาเลือก OT"); return; }
    if (employees.length === 0) { toast.error("ไม่มีพนักงานที่สามารถยกเลิกได้ใน OT นี้"); return; }
    if (cancelMode === "SELECT" && selectedEmpIds.size === 0) { toast.error("กรุณาเลือกพนักงานอย่างน้อย 1 คน"); return; }
    if (reason.length < 3) { toast.error("กรุณาระบุเหตุผล (อย่างน้อย 3 ตัวอักษร)"); return; }

    startTransition(async () => {
      const res = await requestCancelOTBatch({
        otRequestId: otId,
        employeeIds: effectiveIds,
        reason,
      });
      if ("error" in res) {
        toast.error(res.error);
      } else {
        const msg = res.skipped && res.skipped > 0
          ? `ส่งคำขอ ${res.created} คน (ข้าม ${res.skipped} คนที่มีคำขอแล้ว)`
          : `ส่งคำขอยกเลิก ${res.created} คนไปยัง HR Admin แล้ว`;
        toast.success(msg);
        setOtId(""); setCancelMode("ALL"); setSelectedEmpIds(new Set()); setReason("");
        router.refresh();
      }
    });
  };

  const handleAction = () => {
    if (!actionTarget) return;
    startTransition(async () => {
      const fn = actionTarget.type === "APPROVE" ? approveCancelOT : rejectCancelOT;
      const res = await fn(actionTarget.c.id, comment);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success(actionTarget.type === "APPROVE" ? "อนุมัติเรียบร้อย — ตัดชื่อพนักงานออกแล้ว" : "ปฏิเสธคำขอเรียบร้อย");
        setActionTarget(null); setComment(""); router.refresh();
      }
    });
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{isHR ? "ยกเลิก OT" : "ส่งคำขอยกเลิก"}</CardTitle>
          <CardDescription>
            {isHR
              ? "เลือก OT แล้วเลือกว่าจะยกเลิกทั้งเอกสาร หรือเลือกเฉพาะบางคน"
              : "เลือก OT แล้วเลือกว่าจะยกเลิกทั้งเอกสาร หรือเลือกเฉพาะพนักงาน"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {/* Step 1: Cancel mode — always visible so the option is obvious */}
            <div className="space-y-2">
              <Label>รูปแบบการยกเลิก *</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setCancelMode("ALL"); setSelectedEmpIds(new Set()); }}
                  className={`flex items-center gap-2 rounded-lg border-2 p-3 text-sm transition-colors ${
                    cancelMode === "ALL"
                      ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                      : "border-muted hover:border-muted-foreground/30"
                  }`}
                >
                  <Users className="h-4 w-4 shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">ยกเลิกทั้งเอกสาร</div>
                    <div className="text-xs text-muted-foreground">
                      {employees.length > 0 ? `ทุกคน (${employees.length} คน)` : "ทุกคนใน OT ที่เลือก"}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCancelMode("SELECT")}
                  className={`flex items-center gap-2 rounded-lg border-2 p-3 text-sm transition-colors ${
                    cancelMode === "SELECT"
                      ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                      : "border-muted hover:border-muted-foreground/30"
                  }`}
                >
                  <UserX className="h-4 w-4 shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">เลือกหลายคน</div>
                    <div className="text-xs text-muted-foreground">เลือกพนักงานเฉพาะบางคน</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 2: Select OT */}
            <div className="space-y-1.5">
              <Label>เลือก OT *</Label>
              <Select value={otId} onValueChange={(v) => { setOtId(v); setSelectedEmpIds(new Set()); }}>
                <SelectTrigger><SelectValue placeholder="เลือกรายการ OT" /></SelectTrigger>
                <SelectContent>
                  {ots.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.requestNo} — {formatDate(o.otDate)} {o.startTime}-{o.endTime} ({o.employees.length} คน)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!otId && (
                <p className="text-xs text-muted-foreground">เลือก OT ก่อนเพื่อดูพนักงาน</p>
              )}
            </div>

            {/* Step 3: Employee list — based on mode */}
            {selectedOT && employees.length > 0 && (
              cancelMode === "ALL" ? (
                <div className="rounded-lg border bg-rose-500/5 p-3">
                  <div className="text-sm font-medium text-rose-700 dark:text-rose-400 mb-2">
                    พนักงานทั้งหมดที่จะถูกยกเลิก ({employees.length} คน)
                  </div>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {employees.map((e) => (
                      <div key={e.id} className="flex items-center gap-2 text-sm py-0.5">
                        <span className="text-muted-foreground font-mono text-xs w-16">{e.code}</span>
                        <span>{e.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      เลือกพนักงาน ({selectedEmpIds.size}/{employees.length})
                    </span>
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="text-xs text-primary hover:underline"
                    >
                      {selectedEmpIds.size === employees.length ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
                    </button>
                  </div>
                  <div className="space-y-1 max-h-[240px] overflow-y-auto">
                    {employees.map((e) => (
                      <label
                        key={e.id}
                        className={`flex items-center gap-3 rounded-md p-2 text-sm cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedEmpIds.has(e.id) ? "bg-rose-500/5" : ""
                        }`}
                      >
                        <Checkbox
                          checked={selectedEmpIds.has(e.id)}
                          onCheckedChange={() => toggleEmp(e.id)}
                        />
                        <span className="text-muted-foreground font-mono text-xs w-16">{e.code}</span>
                        <span>{e.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            )}

            {selectedOT && employees.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                ไม่มีพนักงานที่สามารถยกเลิกได้ใน OT นี้ (อาจถูกยกเลิกไปแล้วทั้งหมด)
              </div>
            )}

            {/* Step 4: Reason */}
            <div className="space-y-1.5">
              <Label>เหตุผล *</Label>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ระบุเหตุผลการขอยกเลิก" required />
            </div>

            <Button
              type="submit"
              disabled={pending || !otId || employees.length === 0 || (cancelMode === "SELECT" && selectedEmpIds.size === 0)}
              className="w-full"
              variant="destructive"
            >
              <Send className="h-4 w-4" />
              {pending
                ? "กำลังส่ง..."
                : isHR
                  ? `ส่งคำขอยกเลิก ${effectiveIds.length} คน (รออนุมัติโดย HR)`
                  : `ส่งคำขอยกเลิก ${effectiveIds.length} คน ไปยัง HR Admin`}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>{isHR ? "รายการรอ Approve" : "คำขอยกเลิกที่กำลังรอ HR"}</CardTitle>
              <CardDescription>
                {cancellations.length === 0
                  ? "ไม่มีรายการรอ HR"
                  : `${cancellations.length} รายการรอ HR`}
              </CardDescription>
            </div>
            {isHR && pendingCancellations.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={selectAllPending}>
                {selectedCancelIds.size === pendingCancellations.length ? "ยกเลิกการเลือก" : "เลือกทั้งหมด"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {cancellations.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              {isHR ? "✅ ไม่มีคำขอที่รออนุมัติ" : "ยังไม่มีคำขอยกเลิกที่กำลังรอ"}
            </div>
          ) : (
            <>
              {/* Bulk action bar — sticky-ish at top when items selected */}
              {isHR && selectedCancelIds.size > 0 && (
                <div className="mb-3 flex items-center justify-between gap-2 p-3 rounded-lg border-2 border-primary bg-primary/5">
                  <span className="text-sm font-medium">
                    เลือกแล้ว <b>{selectedCancelIds.size}</b> รายการ
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="success" onClick={() => { setBulkAction("APPROVE"); setBulkComment(""); }}>
                      <Check className="h-3.5 w-3.5" /> อนุมัติทั้งหมด
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { setBulkAction("REJECT"); setBulkComment(""); }}>
                      <X className="h-3.5 w-3.5" /> ปฏิเสธทั้งหมด
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {cancellations.map((c) => {
                  const isPending = c.status === "PENDING";
                  const isSelected = selectedCancelIds.has(c.id);
                  const docCount = pendingByOt.get(c.otRequestNo)?.length ?? 0;
                  const isFirstOfGroup =
                    isPending && docCount > 1 &&
                    pendingByOt.get(c.otRequestNo)?.[0]?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      className={`p-3 rounded-lg border text-sm transition-colors ${
                        isSelected ? "border-primary bg-primary/5"
                        : isPending ? "border-warning/40 bg-warning/5" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          {isHR && isPending && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleCancelId(c.id)}
                            />
                          )}
                          <span className="font-mono text-xs">{c.otRequestNo}</span>
                          {docCount > 1 && isPending && (
                            <Badge variant="outline" className="text-[10px]">
                              เอกสารนี้มี {docCount} รายการ
                            </Badge>
                          )}
                        </div>
                        <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                      </div>

                      {/* "Select whole document" link (only first row of multi-row group) */}
                      {isHR && isFirstOfGroup && (
                        <div className="mb-2">
                          <button
                            type="button"
                            onClick={() => selectWholeDoc(c.otRequestNo)}
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <FileX className="h-3 w-3" />
                            {isWholeDocSelected(c.otRequestNo)
                              ? `ยกเลิกการเลือกทั้งเอกสาร (${docCount})`
                              : `เลือกทั้งเอกสาร (${docCount} รายการ)`}
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(c.otDate)} • {c.otTime}</span>
                        <span className="flex items-center gap-1"><User className="h-3 w-3" /> {c.employeeName}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">โดย: {c.requestedByName} • {formatDateTime(c.createdAt)}</div>
                      <div className="italic text-sm">&ldquo;{c.reason}&rdquo;</div>
                      {c.hrComment && <div className="text-xs mt-2 p-2 rounded bg-muted/50"><b>HR Comment:</b> {c.hrComment}</div>}

                      {isHR && isPending && (
                        <div className="flex gap-2 mt-3 pt-3 border-t">
                          <Button size="sm" variant="success" onClick={() => { setActionTarget({ c, type: "APPROVE" }); setComment(""); }}>
                            <Check className="h-3.5 w-3.5" /> อนุมัติ
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => { setActionTarget({ c, type: "REJECT" }); setComment(""); }}>
                            <X className="h-3.5 w-3.5" /> ปฏิเสธ
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* HR Action Dialog */}
      <Dialog open={!!actionTarget} onOpenChange={(v) => !v && setActionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionTarget?.type === "APPROVE" ? "ยืนยันการอนุมัติยกเลิก OT" : "ยืนยันการปฏิเสธคำขอ"}
            </DialogTitle>
            <DialogDescription>
              <b>{actionTarget?.c.otRequestNo}</b> · {actionTarget?.c.employeeName}
              {actionTarget?.type === "APPROVE" && (
                <span className="block mt-2 text-warning">⚠️ ระบบจะตัดชื่อพนักงานคนนี้ออกจาก OT (attended = false, ชั่วโมงจริง = 0)</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="ความเห็น (ถ้ามี)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionTarget(null)}>ยกเลิก</Button>
            <Button onClick={handleAction} disabled={pending} variant={actionTarget?.type === "APPROVE" ? "success" : "destructive"}>
              {pending ? "กำลังบันทึก..." : (actionTarget?.type === "APPROVE" ? "อนุมัติ" : "ปฏิเสธ")}
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
                ? `ยืนยันอนุมัติคำขอยกเลิก ${selectedCancelIds.size} รายการ`
                : `ยืนยันปฏิเสธคำขอ ${selectedCancelIds.size} รายการ`}
            </DialogTitle>
            <DialogDescription>
              {bulkAction === "APPROVE" ? (
                <span className="block text-warning">⚠️ ระบบจะตัดชื่อพนักงานทุกคนที่เลือกออกจาก OT — ถ้าใบ OT ใบไหนไม่เหลือคน ระบบจะตั้งเป็น "ยกเลิก" ให้อัตโนมัติ</span>
              ) : (
                <span>ผู้ขอ ({selectedCancelIds.size} รายการ) จะได้รับ email แจ้งว่าคำขอถูกปฏิเสธ</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-sm">ความเห็น (ใช้ร่วมกันทุกรายการ)</Label>
            <Textarea
              rows={3}
              value={bulkComment}
              onChange={(e) => setBulkComment(e.target.value)}
              placeholder={bulkAction === "APPROVE" ? "หมายเหตุ (ถ้ามี)" : "เหตุผลที่ปฏิเสธ"}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)}>ยกเลิก</Button>
            <Button
              onClick={handleBulkAction}
              disabled={pending}
              variant={bulkAction === "APPROVE" ? "success" : "destructive"}
            >
              {pending
                ? "กำลังบันทึก..."
                : bulkAction === "APPROVE"
                  ? `อนุมัติ ${selectedCancelIds.size} รายการ`
                  : `ปฏิเสธ ${selectedCancelIds.size} รายการ`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
