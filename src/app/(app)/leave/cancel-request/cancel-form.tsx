"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Check, X, Calendar, User } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  requestCancelLeave, approveCancelLeave, rejectCancelLeave,
} from "@/server/actions/leave";
import { formatDate, formatDateTime } from "@/lib/utils";

type Leave = {
  id: string;
  requestNo: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
};

type Cancellation = {
  id: string;
  requestNo: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  requestedByName: string;
  reason: string;
  status: string;
  hrComment: string;
  createdAt: string;
};

type Props = { isHR: boolean; leaves: Leave[]; cancellations: Cancellation[] };

const STATUS_VARIANT: Record<string, any> = {
  PENDING: "warning", APPROVED: "success", REJECTED: "destructive",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "รอ HR", APPROVED: "อนุมัติแล้ว", REJECTED: "ปฏิเสธ",
};

export function CancelLeaveRequestForm({ isHR, leaves, cancellations }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [leaveId, setLeaveId] = useState("");
  const [reason, setReason] = useState("");

  const [actionTarget, setActionTarget] = useState<{ c: Cancellation; type: "APPROVE" | "REJECT" } | null>(null);
  const [comment, setComment] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveId) { toast.error("กรุณาเลือกใบลา"); return; }
    if (reason.trim().length < 3) { toast.error("กรุณาระบุเหตุผล (อย่างน้อย 3 ตัวอักษร)"); return; }
    startTransition(async () => {
      const res = await requestCancelLeave({ leaveRequestId: leaveId, reason });
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("ส่งคำขอไปยัง HR Admin แล้ว");
        setLeaveId(""); setReason("");
        router.refresh();
      }
    });
  };

  const handleAction = () => {
    if (!actionTarget) return;
    startTransition(async () => {
      const fn = actionTarget.type === "APPROVE" ? approveCancelLeave : rejectCancelLeave;
      const res = await fn(actionTarget.c.id, comment);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success(actionTarget.type === "APPROVE"
          ? "อนุมัติเรียบร้อย — ใบลายกเลิก + คืน leave balance แล้ว"
          : "ปฏิเสธคำขอเรียบร้อย");
        setActionTarget(null); setComment("");
        router.refresh();
      }
    });
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>ส่งคำขอยกเลิก</CardTitle>
          <CardDescription>เลือกใบลาที่อนุมัติแล้ว + ระบุเหตุผล</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>เลือกใบลา *</Label>
              <Select value={leaveId} onValueChange={setLeaveId}>
                <SelectTrigger><SelectValue placeholder="เลือกใบลาที่อนุมัติแล้ว" /></SelectTrigger>
                <SelectContent>
                  {leaves.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">ไม่มีใบลาที่ขอยกเลิกได้</div>
                  ) : leaves.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.requestNo} — {l.employeeName} ({l.employeeCode}) · {l.leaveTypeName} · {formatDate(l.startDate)} - {formatDate(l.endDate)} ({l.totalDays} วัน)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>เหตุผล *</Label>
              <Textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="ระบุเหตุผลการขอยกเลิกใบลา (อย่างน้อย 3 ตัวอักษร)"
                required
              />
            </div>

            <Button type="submit" disabled={pending || !leaveId} className="w-full" variant="destructive">
              <Send className="h-4 w-4" />
              {pending ? "กำลังส่ง..." : "ส่งคำขอไปยัง HR Admin"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isHR ? "รายการรอ Approve" : "คำขอยกเลิกที่กำลังรอ HR"}</CardTitle>
          <CardDescription>
            {cancellations.length === 0
              ? "ไม่มีคำขอยกเลิกที่รอ HR"
              : `${cancellations.length} รายการรอ HR`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cancellations.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              {isHR ? "✅ ไม่มีคำขอที่รออนุมัติ" : "ยังไม่มีคำขอยกเลิกที่กำลังรอ"}
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {cancellations.map((c) => (
                <div key={c.id} className={`p-3 rounded-lg border text-sm ${c.status === "PENDING" ? "border-warning/40 bg-warning/5" : ""}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-xs">{c.requestNo}</span>
                    <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1 flex-wrap">
                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> {c.employeeName}</span>
                    <span>·</span>
                    <span>{c.leaveTypeName}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(c.startDate)} - {formatDate(c.endDate)} ({c.totalDays} วัน)</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">โดย: {c.requestedByName} • {formatDateTime(c.createdAt)}</div>
                  <div className="italic text-sm">&ldquo;{c.reason}&rdquo;</div>
                  {c.hrComment && (
                    <div className="text-xs mt-2 p-2 rounded bg-muted/50">
                      <b>HR Comment:</b> {c.hrComment}
                    </div>
                  )}

                  {isHR && c.status === "PENDING" && (
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* HR Action Dialog */}
      <Dialog open={!!actionTarget} onOpenChange={(v) => !v && setActionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionTarget?.type === "APPROVE" ? "ยืนยันการอนุมัติยกเลิกใบลา" : "ยืนยันการปฏิเสธคำขอ"}
            </DialogTitle>
            <DialogDescription>
              <b>{actionTarget?.c.requestNo}</b> · {actionTarget?.c.employeeName} · {actionTarget?.c.totalDays} วัน
              {actionTarget?.type === "APPROVE" && (
                <span className="block mt-2 text-warning">
                  ⚠️ ระบบจะตั้งใบลานี้เป็น &quot;ยกเลิก&quot; + คืน leave balance ให้พนักงานทันที
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="ความเห็น (ถ้ามี)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionTarget(null)}>ยกเลิก</Button>
            <Button
              onClick={handleAction}
              disabled={pending}
              variant={actionTarget?.type === "APPROVE" ? "success" : "destructive"}
            >
              {pending ? "กำลังบันทึก..." : (actionTarget?.type === "APPROVE" ? "อนุมัติ" : "ปฏิเสธ")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
