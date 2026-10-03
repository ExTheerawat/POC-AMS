"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { XCircle, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { upsertLeaveRejectReason, deleteLeaveRejectReason } from "@/server/actions/master";
import { DataTable, type Column } from "@/components/ui/data-table";

type Item = {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
};

type SaveInput = {
  id?: string;
  label: string;
  isActive: boolean;
};

export function LeaveRejectReasonsClient({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Item | null>(null);
  const [delTarget, setDelTarget] = useState<Item | null>(null);

  const save = (input: SaveInput) => {
    startTransition(async () => {
      const res = await upsertLeaveRejectReason(input);
      if ((res as any)?.error) toast.error((res as any).error);
      else {
        toast.success(input.id ? "อัปเดตเรียบร้อย" : "เพิ่มเหตุผลสำเร็จ");
        setCreateOpen(false); setEditTarget(null); router.refresh();
      }
    });
  };

  const remove = () => {
    if (!delTarget) return;
    startTransition(async () => {
      const res = await deleteLeaveRejectReason(delTarget.id);
      if ((res as any)?.error) toast.error((res as any).error);
      else { toast.success("ลบเรียบร้อย (ตั้งเป็น Inactive)"); setDelTarget(null); router.refresh(); }
    });
  };

  const columns: Column<Item>[] = useMemo(() => [
    {
      key: "seq", header: "ลำดับ", width: 60, hideable: false,
      cell: (_r, idx) => <span className="text-muted-foreground tabular-nums">{idx + 1}</span>,
    },
    {
      key: "code", header: "รหัส", sortable: true, accessor: (r) => r.code,
      cell: (r) => <span className="font-mono text-xs">{r.code}</span>,
    },
    { key: "label", header: "ข้อความที่แสดง", sortable: true, accessor: (r) => r.label, align: "left" },
    {
      key: "isActive", header: "สถานะ", sortable: true, accessor: (r) => r.isActive,
      cell: (r) => r.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>,
    },
    {
      key: "actions", header: "การกระทำ", align: "right", hideable: false,
      cell: (r) => (
        <span className="whitespace-nowrap">
          <Button size="icon" variant="ghost" onClick={() => setEditTarget(r)} title="แก้ไข">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setDelTarget(r)} className="text-destructive hover:text-destructive" title="ลบ" disabled={!r.isActive}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </span>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-rose-500/10 text-rose-600 grid place-items-center">
            <XCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">เหตุผลปฏิเสธใบลา</h1>
            <p className="text-sm text-muted-foreground">
              จัดการรายการเหตุผลที่ใช้ตอนปฏิเสธใบลา ({items.length} รายการ)
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> เพิ่มเหตุผล
        </Button>
      </div>

      <DataTable<Item>
        data={items}
        getRowId={(r) => r.id}
        columns={columns}
        searchKeys={["code", "label"]}
        searchPlaceholder="ค้นหา รหัส / ข้อความ..."
        emptyText="ยังไม่มีเหตุผลปฏิเสธ — กดเพิ่มเหตุผลเพื่อเริ่ม"
        defaultSort={{ key: "code", direction: "asc" }}
      />

      <ReasonForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSave={save}
        pending={pending}
      />
      <ReasonForm
        open={!!editTarget}
        onOpenChange={(v) => !v && setEditTarget(null)}
        onSave={save}
        pending={pending}
        initial={editTarget}
      />

      <Dialog open={!!delTarget} onOpenChange={(v) => !v && setDelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
            <DialogDescription>
              <b>{delTarget?.code}</b> — {delTarget?.label} จะถูกตั้งเป็น Inactive (ประวัติที่อ้างถึงยังคงอยู่)
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelTarget(null)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>ยืนยันลบ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReasonForm({
  open, onOpenChange, onSave, pending, initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (input: SaveInput) => void;
  pending: boolean;
  initial?: Item | null;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  // Reset state when initial changes
  useMemo(() => {
    setLabel(initial?.label ?? "");
    setIsActive(initial?.isActive ?? true);
  }, [initial?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (!label.trim()) return toast.error("กรุณาระบุข้อความ");
    onSave({
      id: initial?.id,
      label: label.trim(),
      isActive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "แก้ไขเหตุผล" : "เพิ่มเหตุผลใหม่"}</DialogTitle>
          <DialogDescription>เหตุผลนี้จะปรากฏใน dropdown ตอน ผจก. ปฏิเสธใบลา</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {initial?.code && (
            <div className="space-y-1.5">
              <Label>รหัส</Label>
              <div className="flex h-10 items-center rounded-md border bg-muted px-3 font-mono text-sm text-muted-foreground">
                {initial.code}
              </div>
              <p className="text-xs text-muted-foreground">รหัสนี้สร้างอัตโนมัติ — แก้ไขไม่ได้</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>ข้อความที่แสดง *</Label>
            <Input
              value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="เช่น ลาเกินสิทธิ์"
            />
            {!initial?.code && (
              <p className="text-xs text-muted-foreground">รหัสจะถูกสร้างให้อัตโนมัติ (LRR001, LRR002, ...)</p>
            )}
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label className="cursor-pointer">{isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "กำลังบันทึก..." : "บันทึก"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
