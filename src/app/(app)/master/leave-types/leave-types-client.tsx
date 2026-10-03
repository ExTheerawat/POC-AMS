"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { upsertLeaveType, deleteLeaveType } from "@/server/actions/master";
import { DataTable, type Column } from "@/components/ui/data-table";

type Item = {
  id: string;
  code: string;
  name: string;
  daysPerYear: number;
  hasProRate: boolean;
  canCarryOver: boolean;
  isPaid: boolean;
  includesHolidays: boolean;
  maxDays: number | null;
  note: string;
  isActive: boolean;
};

type SaveInput = {
  id?: string;
  code: string;
  name: string;
  daysPerYear: number;
  hasProRate: boolean;
  canCarryOver: boolean;
  isPaid: boolean;
  includesHolidays: boolean;
  maxDays: number | null;
  note: string | null;
};

export function LeaveTypesClient({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Item | null>(null);
  const [delTarget, setDelTarget] = useState<Item | null>(null);

  const save = (input: SaveInput) => {
    startTransition(async () => {
      const res = await upsertLeaveType(input);
      if ((res as any)?.error) toast.error((res as any).error);
      else { toast.success(input.id ? "อัปเดตเรียบร้อย" : "เพิ่มประเภทการลาสำเร็จ"); setCreateOpen(false); setEditTarget(null); router.refresh(); }
    });
  };

  const remove = () => {
    if (!delTarget) return;
    startTransition(async () => {
      const res = await deleteLeaveType(delTarget.id);
      if ((res as any)?.error) toast.error((res as any).error);
      else { toast.success("ลบเรียบร้อย (ตั้งเป็น Inactive)"); setDelTarget(null); router.refresh(); }
    });
  };

  const columns: Column<Item>[] = useMemo(() => [
    {
      key: "seq", header: "ลำดับ", width: 60, hideable: false,
      cell: (_t, idx) => <span className="text-muted-foreground tabular-nums">{idx + 1}</span>,
    },
    { key: "code", header: "รหัส", sortable: true, accessor: (t) => t.code },
    {
      key: "name", header: "ชื่อ", sortable: true, accessor: (t) => t.name, align: "left",
      cell: (t) => <span title={t.note || undefined}>{t.name}</span>,
    },
    { key: "daysPerYear", header: "วัน/ปี", sortable: true, accessor: (t) => t.daysPerYear, className: "tabular-nums" },
    {
      key: "maxDays", header: "เพดาน", sortable: true,
      accessor: (t) => t.maxDays ?? -1,
      cell: (t) => <span className="tabular-nums">{t.maxDays ?? "-"}</span>,
    },
    {
      key: "isPaid", header: "ค่าจ้าง", sortable: true, accessor: (t) => (t.isPaid ? 1 : 0),
      cell: (t) => t.isPaid ? <Badge variant="success">Paid</Badge> : <Badge variant="secondary">Unpaid</Badge>,
    },
    {
      key: "includesHolidays", header: "นับวันหยุด", sortable: true, accessor: (t) => (t.includesHolidays ? 1 : 0),
      cell: (t) => t.includesHolidays ? <Badge variant="info">ใช่</Badge> : <Badge variant="secondary">ไม่</Badge>,
    },
    {
      key: "hasProRate", header: "Pro-Rate", sortable: true, accessor: (t) => (t.hasProRate ? 1 : 0),
      cell: (t) => t.hasProRate ? <Badge variant="info">ใช่</Badge> : <Badge variant="secondary">ไม่</Badge>,
    },
    {
      key: "canCarryOver", header: "Carry Over", sortable: true, accessor: (t) => (t.canCarryOver ? 1 : 0),
      cell: (t) => t.canCarryOver ? <Badge variant="info">ใช่</Badge> : <Badge variant="secondary">ไม่</Badge>,
      defaultHidden: true,
    },
    {
      key: "isActive", header: "สถานะ", sortable: true, accessor: (t) => (t.isActive ? 1 : 0),
      cell: (t) => t.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>,
    },
    {
      key: "actions", header: "การกระทำ", align: "right", hideable: false,
      cell: (t) => (
        <>
          <Button size="icon" variant="ghost" onClick={() => setEditTarget(t)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" onClick={() => setDelTarget(t)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
        </>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center"><CalendarDays className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold">ประเภทการลา</h1>
            <p className="text-muted-foreground">{items.length} รายการ</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> เพิ่มประเภท</Button>
      </div>

      <DataTable<Item>
        data={items}
        getRowId={(t) => t.id}
        columns={columns}
        searchKeys={["code", "name", "note"]}
        searchPlaceholder="ค้นหา รหัส / ชื่อ / หมายเหตุ..."
        defaultSort={{ key: "code", direction: "asc" }}
        emptyText="ยังไม่มีข้อมูล"
      />

      <LeaveTypeFormDialog open={createOpen} onClose={() => setCreateOpen(false)} title="เพิ่มประเภทการลา" onSubmit={save} pending={pending} />
      <LeaveTypeFormDialog open={!!editTarget} onClose={() => setEditTarget(null)} title="แก้ไขประเภทการลา" initial={editTarget ?? undefined} onSubmit={save} pending={pending} />

      <Dialog open={!!delTarget} onOpenChange={(v) => !v && setDelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
            <DialogDescription><b>{delTarget?.code}</b> — {delTarget?.name} จะถูกตั้งเป็น Inactive</DialogDescription>
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

function LeaveTypeFormDialog({
  open, onClose, title, initial, onSubmit, pending,
}: {
  open: boolean; onClose: () => void; title: string;
  initial?: Item; pending: boolean;
  onSubmit: (input: SaveInput) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [days, setDays] = useState("0");
  const [maxDays, setMaxDays] = useState("");
  const [proRate, setProRate] = useState(false);
  const [carryOver, setCarryOver] = useState(false);
  const [isPaid, setIsPaid] = useState(true);
  const [includesHolidays, setIncludesHolidays] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setCode(initial?.code ?? "");
      setName(initial?.name ?? "");
      setDays(String(initial?.daysPerYear ?? 0));
      setMaxDays(initial?.maxDays != null ? String(initial.maxDays) : "");
      setProRate(initial?.hasProRate ?? false);
      setCarryOver(initial?.canCarryOver ?? false);
      setIsPaid(initial?.isPaid ?? true);
      setIncludesHolidays(initial?.includesHolidays ?? false);
      setNote(initial?.note ?? "");
    }
  }, [open, initial?.id]);

  const submit = () => {
    if (!code || !name) { toast.error("กรอก รหัส และ ชื่อ"); return; }
    const max = maxDays.trim() === "" ? null : Number(maxDays);
    if (max != null && (!Number.isFinite(max) || max < 0)) { toast.error("เพดาน (max) ไม่ถูกต้อง"); return; }
    onSubmit({
      id: initial?.id, code, name,
      daysPerYear: Number(days) || 0,
      hasProRate: proRate, canCarryOver: carryOver,
      isPaid, includesHolidays, maxDays: max,
      note: note || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>รหัส *</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="VACATION" /></div>
            <div className="space-y-1.5"><Label>ชื่อ *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ลาพักร้อน" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>วัน/ปี (พื้นฐาน)</Label><Input type="number" value={days} onChange={(e) => setDays(e.target.value)} min={0} step={0.5} /></div>
            <div className="space-y-1.5"><Label>เพดานสูงสุด (max) — ถ้าไม่ระบุ = ไม่จำกัด</Label><Input type="number" value={maxDays} onChange={(e) => setMaxDays(e.target.value)} min={0} step={1} placeholder="(ไม่บังคับ)" /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div><Label>ได้รับค่าจ้าง</Label><p className="text-xs text-muted-foreground mt-1">isPaid</p></div>
              <Switch checked={isPaid} onCheckedChange={setIsPaid} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div><Label>นับรวมวันหยุด</Label><p className="text-xs text-muted-foreground mt-1">เสาร์-อาทิตย์ + วันหยุด</p></div>
              <Switch checked={includesHolidays} onCheckedChange={setIncludesHolidays} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div><Label>Pro-Rate</Label><p className="text-xs text-muted-foreground mt-1">คำนวณตามอายุงาน (ใช้ VacationTier)</p></div>
              <Switch checked={proRate} onCheckedChange={setProRate} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div><Label>Carry Over</Label><p className="text-xs text-muted-foreground mt-1">โอนวันลาคงเหลือไปปีหน้าได้</p></div>
              <Switch checked={carryOver} onCheckedChange={setCarryOver} />
            </div>
          </div>
          <div className="space-y-1.5"><Label>หมายเหตุ / เงื่อนไข</Label><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เงื่อนไขพิเศษ" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "กำลังบันทึก..." : "บันทึก"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
