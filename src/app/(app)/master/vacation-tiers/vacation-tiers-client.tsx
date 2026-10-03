"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Plus, Pencil, Trash2, Calculator, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { upsertVacationTier, deleteVacationTier, resetVacationTiers } from "@/server/actions/master";
import { DataTable, type Column } from "@/components/ui/data-table";

type Item = {
  id: string;
  daysOfServiceFrom: number;
  vacationDays: number;
  note: string;
  isActive: boolean;
};

export function VacationTiersClient({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Item | null>(null);
  const [delTarget, setDelTarget] = useState<Item | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const [previewDays, setPreviewDays] = useState<string>("");
  const previewResult = useMemo(() => {
    const days = Number(previewDays);
    if (!Number.isFinite(days) || days < 0) return null;
    const matches = items.filter((i) => i.daysOfServiceFrom <= days);
    if (matches.length === 0) return { tier: null, vacationDays: 0 };
    const best = matches.reduce((a, b) => (a.daysOfServiceFrom > b.daysOfServiceFrom ? a : b));
    return { tier: best, vacationDays: best.vacationDays };
  }, [previewDays, items]);

  const save = (input: { id?: string; daysOfServiceFrom: number; vacationDays: number; note?: string }) => {
    startTransition(async () => {
      const res = await upsertVacationTier(input);
      if ("error" in res) toast.error(res.error);
      else { toast.success(input.id ? "อัปเดตเรียบร้อย" : "เพิ่ม Tier สำเร็จ"); setCreateOpen(false); setEditTarget(null); router.refresh(); }
    });
  };

  const remove = () => {
    if (!delTarget) return;
    startTransition(async () => {
      const res = await deleteVacationTier(delTarget.id);
      if ("error" in (res as any)) toast.error((res as any).error);
      else { toast.success("ลบเรียบร้อย"); setDelTarget(null); router.refresh(); }
    });
  };

  const reset = () => {
    startTransition(async () => {
      const res = await resetVacationTiers();
      if ("error" in (res as any)) toast.error((res as any).error);
      else { toast.success(`รีเซ็ตเป็นค่าตั้งต้น 16 รายการเรียบร้อย`); setResetOpen(false); router.refresh(); }
    });
  };

  const columns: Column<Item>[] = useMemo(() => [
    {
      key: "seq", header: "ลำดับ", width: 60, hideable: false,
      cell: (_t, idx) => <span className="text-muted-foreground tabular-nums">{idx + 1}</span>,
    },
    {
      key: "daysOfServiceFrom", header: "อายุงาน (วัน) ตั้งแต่", sortable: true,
      accessor: (t) => t.daysOfServiceFrom,
      cell: (t) => <span className="tabular-nums">≥ {t.daysOfServiceFrom.toLocaleString()} วัน</span>,
    },
    {
      key: "vacationDays", header: "สิทธิ์ลาพักร้อน (วัน/ปี)", sortable: true,
      accessor: (t) => t.vacationDays,
      cell: (t) => (
        <span className="tabular-nums"><span className="text-primary font-semibold text-lg">{t.vacationDays}</span> วัน</span>
      ),
    },
    {
      key: "note", header: "หมายเหตุ", align: "left",
      cell: (t) => <span className="text-muted-foreground">{t.note || "-"}</span>,
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
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">สิทธิ์ลาพักร้อน (ตามอายุงาน)</h1>
            <p className="text-muted-foreground">{items.length} ระดับ — ระบบใช้ค่านี้คำนวณสิทธิ์ลาพักร้อนของพนักงานอัตโนมัติ</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setResetOpen(true)}>
            <RotateCcw className="h-4 w-4" /> รีเซ็ตเป็นค่าตั้งต้น
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> เพิ่ม Tier
          </Button>
        </div>
      </div>

      {/* Calculator preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calculator className="h-4 w-4" /> เครื่องคิดเลขทดสอบ</CardTitle>
          <CardDescription>ใส่จำนวนวันอายุงาน เพื่อดูว่าพนักงานคนนั้นจะได้สิทธิ์ลาพักร้อนกี่วัน</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3 flex-wrap">
          <Label className="shrink-0">อายุงาน (วัน)</Label>
          <Input
            type="number"
            min={0}
            value={previewDays}
            onChange={(e) => setPreviewDays(e.target.value)}
            placeholder="เช่น 100"
            className="max-w-[180px]"
          />
          {previewResult && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">→ สิทธิ์ลาพักร้อน:</span>
              <span className="text-2xl font-bold text-primary tabular-nums">{previewResult.vacationDays}</span>
              <span className="text-muted-foreground">วัน</span>
              {previewResult.tier && (
                <span className="text-xs text-muted-foreground ml-2">
                  (ตรงกับ tier ≥ {previewResult.tier.daysOfServiceFrom} วัน)
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <DataTable<Item>
        data={items}
        getRowId={(t) => t.id}
        columns={columns}
        searchKeys={[(t) => String(t.daysOfServiceFrom), (t) => String(t.vacationDays), "note"]}
        searchPlaceholder="ค้นหาอายุงาน / สิทธิ์ลา / หมายเหตุ..."
        defaultSort={{ key: "daysOfServiceFrom", direction: "asc" }}
        emptyText={`ยังไม่มี Tier — กด "รีเซ็ตเป็นค่าตั้งต้น" เพื่อใส่ค่ามาตรฐาน 16 รายการ`}
      />

      <TierFormDialog open={createOpen} onClose={() => setCreateOpen(false)} title="เพิ่ม Vacation Tier" onSubmit={save} pending={pending} />
      <TierFormDialog open={!!editTarget} onClose={() => setEditTarget(null)} title="แก้ไข Vacation Tier" initial={editTarget ?? undefined} onSubmit={save} pending={pending} />

      <Dialog open={!!delTarget} onOpenChange={(v) => !v && setDelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ Tier</DialogTitle>
            <DialogDescription>
              <span>≥ <b>{delTarget?.daysOfServiceFrom.toLocaleString()} วัน</b> → <b>{delTarget?.vacationDays} วันลา</b></span>
              <span className="block mt-2 text-warning">⚠️ การลบจะทำให้ช่วงอายุงานนี้คำนวณตาม Tier ก่อนหน้า — ตรวจสอบให้ดีก่อน</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelTarget(null)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>ยืนยันลบ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={(v) => !v && setResetOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>รีเซ็ตเป็นค่าตั้งต้น</DialogTitle>
            <DialogDescription>
              ระบบจะลบ Tier ทั้งหมดที่มีอยู่ และใส่ค่ามาตรฐาน <b>16 รายการ</b> ตามคู่มือบริษัท (22 วัน → 0, ... 5,355 วัน → 15)
              <span className="block mt-2 text-warning">⚠️ ไม่สามารถ undo ได้</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>ยกเลิก</Button>
            <Button onClick={reset} disabled={pending}>ยืนยันรีเซ็ต</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TierFormDialog({
  open, onClose, title, initial, onSubmit, pending,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  initial?: Item;
  pending: boolean;
  onSubmit: (input: { id?: string; daysOfServiceFrom: number; vacationDays: number; note?: string }) => void;
}) {
  const [days, setDays] = useState("");
  const [vacation, setVacation] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setDays(initial?.daysOfServiceFrom != null ? String(initial.daysOfServiceFrom) : "");
      setVacation(initial?.vacationDays != null ? String(initial.vacationDays) : "");
      setNote(initial?.note ?? "");
    }
  }, [open, initial?.id]);

  const submit = () => {
    const d = Number(days);
    const v = Number(vacation);
    if (!Number.isFinite(d) || d < 0) { toast.error("อายุงาน (วัน) ต้อง ≥ 0"); return; }
    if (!Number.isFinite(v) || v < 0) { toast.error("สิทธิ์ลาพักร้อนต้อง ≥ 0"); return; }
    onSubmit({ id: initial?.id, daysOfServiceFrom: d, vacationDays: v, note: note || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>อายุงาน (วัน) ตั้งแต่ *</Label>
              <Input type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} placeholder="22" />
            </div>
            <div className="space-y-1.5">
              <Label>สิทธิ์ลาพักร้อน (วัน) *</Label>
              <Input type="number" min={0} value={vacation} onChange={(e) => setVacation(e.target.value)} placeholder="7" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>หมายเหตุ</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="(ไม่บังคับ)" />
          </div>
          <p className="text-xs text-muted-foreground">
            💡 พนักงานที่มีอายุงาน ≥ ค่านี้ จะได้สิทธิ์ลาตามจำนวนวันที่ระบุ — เว้นแต่จะมี tier ที่ใหญ่กว่ามาแทน
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "กำลังบันทึก..." : "บันทึก"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
