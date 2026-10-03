"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Bus, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { upsertBusRoute, deleteBusRoute } from "@/server/actions/master";
import { DataTable, type Column } from "@/components/ui/data-table";

type Item = { id: string; code: string; name: string; route: string; note: string; isActive: boolean };

export function BusRoutesClient({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editTarget, setEditTarget] = useState<Item | null>(null);
  const [delTarget, setDelTarget] = useState<Item | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const save = (input: { id?: string; code: string; name: string; route: string; note: string }) => {
    startTransition(async () => {
      const res = await upsertBusRoute(input);
      if ((res as any)?.error) toast.error((res as any).error);
      else {
        toast.success(input.id ? "อัปเดตเรียบร้อย" : "เพิ่มสายรถสำเร็จ");
        setCreateOpen(false); setEditTarget(null);
        router.refresh();
      }
    });
  };

  const remove = () => {
    if (!delTarget) return;
    startTransition(async () => {
      const res = await deleteBusRoute(delTarget.id);
      if ((res as any)?.error) toast.error((res as any).error);
      else { toast.success("ลบเรียบร้อย"); setDelTarget(null); router.refresh(); }
    });
  };

  const columns: Column<Item>[] = useMemo(() => [
    {
      key: "seq", header: "ลำดับ", width: 60, hideable: false,
      cell: (_r, idx) => <span className="text-muted-foreground tabular-nums">{idx + 1}</span>,
    },
    { key: "code", header: "รหัส", sortable: true, accessor: (r) => r.code },
    { key: "name", header: "ชื่อ", sortable: true, accessor: (r) => r.name, align: "left" },
    { key: "route", header: "เส้นทาง", accessor: (r) => r.route || "-", align: "left" },
    {
      key: "note", header: "หมายเหตุ", align: "left",
      cell: (r) => <span className="text-muted-foreground">{r.note || "-"}</span>,
    },
    {
      key: "status", header: "สถานะ", sortable: true, accessor: (r) => (r.isActive ? "Active" : "Inactive"),
      cell: (r) => r.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>,
    },
    {
      key: "actions", header: "การกระทำ", align: "right", hideable: false,
      cell: (r) => (
        <>
          <Button size="icon" variant="ghost" onClick={() => setEditTarget(r)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" onClick={() => setDelTarget(r)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
        </>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center"><Bus className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold">สายรถ</h1>
            <p className="text-muted-foreground">Master สายรถสำหรับ OT — {items.length} รายการ</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> เพิ่มสายรถ</Button>
      </div>

      <DataTable<Item>
        data={items}
        getRowId={(r) => r.id}
        columns={columns}
        searchKeys={["code", "name", "route", "note"]}
        searchPlaceholder="ค้นหา รหัส / ชื่อ / เส้นทาง / หมายเหตุ..."
        defaultSort={{ key: "code", direction: "asc" }}
        emptyText="ยังไม่มีสายรถ"
      />

      <BusRouteFormDialog open={createOpen} onClose={() => setCreateOpen(false)} title="เพิ่มสายรถ" onSubmit={save} pending={pending} />
      <BusRouteFormDialog open={!!editTarget} onClose={() => setEditTarget(null)} title="แก้ไขสายรถ" initial={editTarget ?? undefined} onSubmit={save} pending={pending} />

      <Dialog open={!!delTarget} onOpenChange={(v) => !v && setDelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบสายรถ</DialogTitle>
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

function BusRouteFormDialog({
  open, onClose, title, initial, onSubmit, pending,
}: {
  open: boolean; onClose: () => void; title: string;
  initial?: Item; pending: boolean;
  onSubmit: (input: { id?: string; code: string; name: string; route: string; note: string }) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [route, setRoute] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setCode(initial?.code ?? ""); setName(initial?.name ?? "");
      setRoute(initial?.route ?? ""); setNote(initial?.note ?? "");
    }
  }, [open, initial?.id]);

  const submit = () => {
    if (!code || !name) { toast.error("กรอก รหัส และ ชื่อ"); return; }
    onSubmit({ id: initial?.id, code, name, route, note });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>รหัส *</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="B05" /></div>
            <div className="space-y-1.5"><Label>ชื่อ *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="สายรังสิต" /></div>
          </div>
          <div className="space-y-1.5"><Label>เส้นทาง</Label><Input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="นิคม → รังสิต → ลำลูกกา" /></div>
          <div className="space-y-1.5"><Label>หมายเหตุ</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "กำลังบันทึก..." : "บันทึก"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
