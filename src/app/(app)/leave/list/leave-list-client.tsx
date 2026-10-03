"use client";

import Link from "next/link";
import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, FilePlus, Eye, Pencil, Trash2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { updateLeave, cancelLeave } from "@/server/actions/leave";
import { DataTable, type Column } from "@/components/ui/data-table";
import { BEDatePicker } from "@/components/ui/be-date-picker";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "ฉบับร่าง", PENDING_DEPT_MGR: "รอ ผจก.แผนก", PENDING_FACTORY_MGR: "รอ ผจก.โรงงาน",
  APPROVED: "อนุมัติแล้ว", REJECTED: "ปฏิเสธ", CANCELLED: "ยกเลิก",
};
const STATUS_VARIANT: Record<string, any> = {
  PENDING_DEPT_MGR: "warning", PENDING_FACTORY_MGR: "warning",
  APPROVED: "success", REJECTED: "destructive", CANCELLED: "secondary", DRAFT: "secondary",
};

type Leave = {
  id: string; requestNo: string; employeeName: string; department: string;
  leaveTypeId: string; leaveTypeName: string; leaveTypeCode: string;
  halfDayType: string | null;
  startDate: string; endDate: string; totalDays: number;
  reason: string; hasAttachment: boolean; attachmentNote: string;
  side: string; status: string; creatorId: string;
};

type LeaveType = { id: string; name: string; code: string };

const EDITABLE_STATUSES = new Set(["DRAFT", "PENDING_DEPT_MGR", "PENDING_FACTORY_MGR"]);
// Policy: ยกเลิกได้เฉพาะก่อน manager approve เท่านั้น
// หลัง APPROVED → ใช้ flow "ขอยกเลิกการลา" (cancel-request) ที่ HR review
const CANCELLABLE_STATUSES = new Set(["DRAFT", "PENDING_DEPT_MGR", "PENDING_FACTORY_MGR"]);
// HR/Admin override — ยกเลิกได้ทุก status ที่ยังไม่ปิด
const ADMIN_CANCELLABLE_STATUSES = new Set(["DRAFT", "PENDING_DEPT_MGR", "PENDING_FACTORY_MGR", "APPROVED"]);

export function LeaveListClient({
  role, currentEmployeeId, isAdmin, leaves, leaveTypes,
}: {
  role: string;
  currentEmployeeId: string | null | undefined;
  isAdmin: boolean;
  leaves: Leave[];
  leaveTypes: LeaveType[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editTarget, setEditTarget] = useState<Leave | null>(null);
  const [delTarget, setDelTarget] = useState<Leave | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [sideFilter, setSideFilter] = useState<string>("ALL");

  // Pre-filter (toolbar filters) before passing to DataTable
  const filteredLeaves = useMemo(() => leaves.filter((l) => {
    if (statusFilter !== "ALL" && l.status !== statusFilter) return false;
    if (typeFilter !== "ALL" && l.leaveTypeId !== typeFilter) return false;
    if (sideFilter !== "ALL" && l.side !== sideFilter) return false;
    return true;
  }), [leaves, statusFilter, typeFilter, sideFilter]);

  const canEdit = (l: Leave) =>
    EDITABLE_STATUSES.has(l.status) && (isAdmin || l.creatorId === currentEmployeeId);
  const canDelete = (l: Leave) => {
    if (isAdmin) return ADMIN_CANCELLABLE_STATUSES.has(l.status);
    return CANCELLABLE_STATUSES.has(l.status) && l.creatorId === currentEmployeeId;
  };
  const deleteTooltip = (l: Leave): string => {
    if (canDelete(l)) return "ยกเลิก";
    if (l.status === "APPROVED") {
      return `อนุมัติแล้ว — ใช้เมนู "ขอยกเลิกการลา" เพื่อขอ HR review`;
    }
    if (l.status === "CANCELLED" || l.status === "REJECTED") return "ยกเลิก/ปฏิเสธอยู่แล้ว";
    return "ยกเลิกไม่ได้";
  };

  const handleDelete = () => {
    if (!delTarget) return;
    startTransition(async () => {
      const res = await cancelLeave(delTarget.id);
      if ("error" in res) toast.error(res.error);
      else { toast.success("ยกเลิกใบลาเรียบร้อย"); setDelTarget(null); router.refresh(); }
    });
  };

  const canCreate = ["SUPERVISOR", "DEPT_MANAGER", "HR_ADMIN", "SYSTEM_ADMIN"].includes(role);

  const columns: Column<Leave>[] = useMemo(() => [
    {
      key: "seq", header: "ลำดับ", width: 60, hideable: false,
      cell: (_l, idx) => <span className="text-muted-foreground tabular-nums">{idx + 1}</span>,
    },
    { key: "requestNo", header: "เลขที่", sortable: true, accessor: (l) => l.requestNo },
    { key: "employee", header: "พนักงาน", sortable: true, accessor: (l) => l.employeeName, align: "left" },
    { key: "department", header: "แผนก", sortable: true, accessor: (l) => l.department, align: "left" },
    {
      key: "leaveTypeCode", header: "รหัส", sortable: true, accessor: (l) => l.leaveTypeCode,
      cell: (l) => <span className="font-mono text-xs text-muted-foreground">{l.leaveTypeCode}</span>,
    },
    { key: "type", header: "ประเภท", sortable: true, accessor: (l) => l.leaveTypeName, align: "left" },
    {
      key: "dates", header: "วันที่", sortable: true,
      accessor: (l) => l.startDate,
      cell: (l) => {
        const halfNote = l.halfDayType === "MORNING" ? " (ครึ่งเช้า)"
          : l.halfDayType === "AFTERNOON" ? " (ครึ่งบ่าย)" : "";
        return (
          <span>
            {formatDate(l.startDate)}
            {formatDate(l.startDate) !== formatDate(l.endDate) && ` - ${formatDate(l.endDate)}`}
            {halfNote && <span className="text-xs text-muted-foreground">{halfNote}</span>}
          </span>
        );
      },
    },
    { key: "totalDays", header: "จำนวน", sortable: true, accessor: (l) => l.totalDays, cell: (l) => `${l.totalDays} วัน` },
    {
      key: "side", header: "ฝ่าย", sortable: true, accessor: (l) => l.side,
      cell: (l) => <Badge variant="outline">{l.side === "OFFICE" ? "Office" : "ผลิต"}</Badge>,
    },
    {
      key: "status", header: "สถานะ", sortable: true, accessor: (l) => STATUS_LABEL[l.status] ?? l.status,
      cell: (l) => <Badge variant={STATUS_VARIANT[l.status]}>{STATUS_LABEL[l.status]}</Badge>,
    },
    {
      key: "actions", header: "การกระทำ", align: "right", hideable: false,
      cell: (l) => (
        <span className="whitespace-nowrap">
          <Button asChild size="icon" variant="ghost" title="ดูรายละเอียด">
            <Link href={`/leave/${l.id}`}><Eye className="h-3.5 w-3.5" /></Link>
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setEditTarget(l)} disabled={!canEdit(l)} title={canEdit(l) ? "แก้ไข" : "แก้ไขไม่ได้ (อนุมัติ/ยกเลิก/ปฏิเสธแล้ว)"}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setDelTarget(l)} disabled={!canDelete(l)} className="text-destructive hover:text-destructive" title={deleteTooltip(l)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </span>
      ),
    },
  ], [isAdmin, currentEmployeeId]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <ListChecks className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">รายการใบลา</h1>
            <p className="text-muted-foreground">{filteredLeaves.length} จาก {leaves.length} รายการ</p>
          </div>
        </div>
        {canCreate && (
          <Button asChild><Link href="/leave/create"><FilePlus className="h-4 w-4" /> สร้างใบลาใหม่</Link></Button>
        )}
      </div>

      <DataTable<Leave>
        data={filteredLeaves}
        getRowId={(l) => l.id}
        columns={columns}
        searchKeys={["requestNo", "employeeName", "department", "leaveTypeName", "leaveTypeCode", "reason"]}
        searchPlaceholder="ค้นหา เลขที่ / พนักงาน / แผนก / ประเภท / เหตุผล..."
        defaultSort={{ key: "dates", direction: "desc" }}
        emptyText={leaves.length === 0 ? "ยังไม่มีรายการใบลา" : "ไม่พบใบลาที่ตรงกับตัวกรอง"}
        toolbar={
          <>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="ประเภทการลา" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทุกประเภท</SelectItem>
                {leaveTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.code}-{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="สถานะ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทุกสถานะ</SelectItem>
                <SelectItem value="PENDING_DEPT_MGR">รอ ผจก.แผนก</SelectItem>
                <SelectItem value="PENDING_FACTORY_MGR">รอ ผจก.โรงงาน</SelectItem>
                <SelectItem value="APPROVED">อนุมัติแล้ว</SelectItem>
                <SelectItem value="REJECTED">ปฏิเสธ</SelectItem>
                <SelectItem value="CANCELLED">ยกเลิก</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && (
              <Select value={sideFilter} onValueChange={setSideFilter}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ทุกฝ่าย</SelectItem>
                  <SelectItem value="OFFICE">Office</SelectItem>
                  <SelectItem value="PRODUCTION">ผลิต</SelectItem>
                </SelectContent>
              </Select>
            )}
          </>
        }
      />

      <LeaveEditDialog
        target={editTarget}
        leaveTypes={leaveTypes}
        onClose={() => setEditTarget(null)}
        onDone={() => router.refresh()}
        pending={pending}
        startTransition={startTransition}
      />

      <Dialog open={!!delTarget} onOpenChange={(v) => !v && setDelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการยกเลิกใบลา</DialogTitle>
            <DialogDescription>
              <b>{delTarget?.requestNo}</b> ของ <b>{delTarget?.employeeName}</b> ({delTarget?.leaveTypeName} {delTarget?.totalDays} วัน) จะถูกตั้งเป็น "ยกเลิก"
              {delTarget?.status === "APPROVED" && (
                <span className="block mt-2 text-warning">⚠️ ใบลานี้อนุมัติแล้ว — วันลาที่ใช้ไปจะถูกคืน</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelTarget(null)}>ปิด</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>ยืนยันยกเลิก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeaveEditDialog({
  target, leaveTypes, onClose, onDone, pending, startTransition,
}: {
  target: Leave | null;
  leaveTypes: LeaveType[];
  onClose: () => void;
  onDone: () => void;
  pending: boolean;
  startTransition: React.TransitionStartFunction;
}) {
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [hasAttachment, setHasAttachment] = useState(false);
  const [attachmentNote, setAttachmentNote] = useState("");

  useEffect(() => {
    if (target) {
      setLeaveTypeId(target.leaveTypeId);
      setStartDate(target.startDate.slice(0, 10));
      setEndDate(target.endDate.slice(0, 10));
      setReason(target.reason);
      setHasAttachment(target.hasAttachment);
      setAttachmentNote(target.attachmentNote);
    }
  }, [target?.id]);

  const submit = () => {
    if (!target) return;
    if (!leaveTypeId || !startDate || !endDate) { toast.error("กรอกข้อมูลให้ครบ"); return; }
    startTransition(async () => {
      const res = await updateLeave({
        id: target.id, leaveTypeId, startDate, endDate, reason,
        hasAttachment, attachmentNote: hasAttachment ? attachmentNote : undefined,
      });
      if ("error" in res) toast.error(res.error);
      else { toast.success("บันทึกใบลาเรียบร้อย"); onClose(); onDone(); }
    });
  };

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>แก้ไขใบลา</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{target?.requestNo}</span> · {target?.employeeName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>ประเภทการลา *</Label>
            <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {leaveTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.code}-{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>วันเริ่ม *</Label><BEDatePicker value={startDate} onChange={setStartDate} /></div>
            <div className="space-y-1.5"><Label>วันสิ้นสุด *</Label><BEDatePicker value={endDate} onChange={setEndDate} min={startDate || undefined} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>เหตุผลการลา</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="space-y-3 p-3 rounded-lg border bg-accent/30">
            <div className="flex items-center gap-2">
              <Checkbox id="hasAtt" checked={hasAttachment} onCheckedChange={(v) => setHasAttachment(!!v)} />
              <Label htmlFor="hasAtt" className="flex items-center gap-2 cursor-pointer"><Paperclip className="h-4 w-4" /> มีเอกสารแนบ</Label>
            </div>
            {hasAttachment && (
              <Textarea rows={2} value={attachmentNote} onChange={(e) => setAttachmentNote(e.target.value)} placeholder="หมายเหตุเอกสารแนบ" />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "กำลังบันทึก..." : "บันทึก"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
