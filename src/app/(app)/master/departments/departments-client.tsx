"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { upsertDepartment, deleteDepartment } from "@/server/actions/master";
import { DataTable, type Column } from "@/components/ui/data-table";

type Item = {
  id: string; code: string; name: string; side: "OFFICE" | "PRODUCTION";
  managerId: string | null; managerName: string | null; employeeCount: number;
};
type Emp = { id: string; code: string; name: string; side: string; position: string; departmentId: string | null };

export function DepartmentsClient({ items, employees }: { items: Item[]; employees: Emp[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Item | null>(null);
  const [delTarget, setDelTarget] = useState<Item | null>(null);
  const [employeesTarget, setEmployeesTarget] = useState<Item | null>(null);

  const save = (input: { id?: string; code: string; name: string; side: "OFFICE" | "PRODUCTION"; managerId?: string }) => {
    startTransition(async () => {
      const res = await upsertDepartment(input);
      if ((res as any)?.error) toast.error((res as any).error);
      else { toast.success(input.id ? "อัปเดตเรียบร้อย" : "เพิ่มแผนกสำเร็จ"); setCreateOpen(false); setEditTarget(null); router.refresh(); }
    });
  };

  const remove = () => {
    if (!delTarget) return;
    if (delTarget.employeeCount > 0) { toast.error("ลบไม่ได้ มีพนักงานในแผนกนี้"); return; }
    startTransition(async () => {
      const res = await deleteDepartment(delTarget.id);
      if ((res as any)?.error) toast.error((res as any).error);
      else { toast.success("ลบเรียบร้อย"); setDelTarget(null); router.refresh(); }
    });
  };

  const columns: Column<Item>[] = useMemo(() => [
    {
      key: "seq", header: "ลำดับ", width: 60, hideable: false,
      cell: (_d, idx) => <span className="text-muted-foreground tabular-nums">{idx + 1}</span>,
    },
    { key: "code", header: "รหัส", sortable: true, accessor: (d) => d.code },
    { key: "name", header: "ชื่อแผนก", sortable: true, accessor: (d) => d.name, align: "left" },
    {
      key: "side", header: "ฝ่าย", sortable: true, accessor: (d) => d.side,
      cell: (d) => <Badge variant="outline">{d.side === "OFFICE" ? "Office" : "ผลิต"}</Badge>,
    },
    {
      key: "manager", header: "ผู้จัดการ", sortable: true,
      accessor: (d) => d.managerName ?? "",
      cell: (d) => <span>{d.managerName ?? "-"}</span>,
    },
    {
      key: "employeeCount", header: "พนักงาน", sortable: true, accessor: (d) => d.employeeCount,
      cell: (d) => (
        <button
          type="button"
          onClick={() => setEmployeesTarget(d)}
          disabled={d.employeeCount === 0}
          className="inline-flex disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110 transition-transform"
          title={d.employeeCount === 0 ? "ไม่มีพนักงาน" : "คลิกเพื่อดูรายชื่อพนักงาน"}
        >
          <Badge variant="info" className="cursor-pointer">{d.employeeCount}</Badge>
        </button>
      ),
    },
    {
      key: "actions", header: "การกระทำ", align: "right", hideable: false,
      cell: (d) => (
        <>
          <Button size="icon" variant="ghost" onClick={() => setEditTarget(d)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" onClick={() => setDelTarget(d)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
        </>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center"><Briefcase className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold">แผนก</h1>
            <p className="text-muted-foreground">{items.length} แผนก</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> เพิ่มแผนก</Button>
      </div>

      <DataTable<Item>
        data={items}
        getRowId={(d) => d.id}
        columns={columns}
        searchKeys={[
          "code", "name",
          (d) => d.managerName ?? "",
          (d) => d.side === "OFFICE" ? "office" : "ผลิต production",
          (d) => String(d.employeeCount),
        ]}
        searchPlaceholder="ค้นหา รหัส / ชื่อแผนก / ฝ่าย / ผู้จัดการ..."
        defaultSort={{ key: "code", direction: "asc" }}
        emptyText="ยังไม่มีข้อมูล"
      />

      <DeptFormDialog open={createOpen} onClose={() => setCreateOpen(false)} title="เพิ่มแผนก" employees={employees} onSubmit={save} pending={pending} />
      <DeptFormDialog open={!!editTarget} onClose={() => setEditTarget(null)} title="แก้ไขแผนก" initial={editTarget ?? undefined} employees={employees} onSubmit={save} pending={pending} />

      <Dialog open={!!delTarget} onOpenChange={(v) => !v && setDelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบแผนก</DialogTitle>
            <DialogDescription>
              <b>{delTarget?.code}</b> — {delTarget?.name}
              {delTarget && delTarget.employeeCount > 0 && (
                <span className="block mt-2 text-destructive">⚠️ ไม่สามารถลบได้ มีพนักงาน {delTarget.employeeCount} คนในแผนกนี้</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelTarget(null)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={remove} disabled={pending || (delTarget?.employeeCount ?? 0) > 0}>ยืนยันลบ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DepartmentEmployeesDialog dept={employeesTarget} employees={employees} onClose={() => setEmployeesTarget(null)} />
    </div>
  );
}

function DepartmentEmployeesDialog({
  dept, employees, onClose,
}: {
  dept: Item | null;
  employees: Emp[];
  onClose: () => void;
}) {
  const list = useMemo(
    () => dept ? employees.filter((e) => e.departmentId === dept.id) : [],
    [dept, employees],
  );

  return (
    <Dialog open={!!dept} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            พนักงานในแผนก <span className="text-primary">{dept?.name}</span>
          </DialogTitle>
          <DialogDescription>
            <b>{dept?.code}</b> · {dept?.side === "OFFICE" ? "Office" : "ผลิต"} ·
            ผู้จัดการ: {dept?.managerName ?? "—"} · รวม <b>{list.length}</b> คน
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
          {list.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">ยังไม่มีพนักงานในแผนกนี้</div>
          ) : (
            <div className="rounded-lg border divide-y">
              {list.map((e, idx) => (
                <div key={e.id} className="flex items-center gap-3 px-3 py-2 hover:bg-accent/30">
                  <span className="text-muted-foreground tabular-nums text-xs w-6">{idx + 1}</span>
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white grid place-items-center text-xs">
                    {e.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{e.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.code}{e.position ? ` · ${e.position}` : ""}
                    </div>
                  </div>
                  <Badge variant="outline">{e.side === "OFFICE" ? "Office" : "ผลิต"}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ปิด</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeptFormDialog({
  open, onClose, title, initial, employees, onSubmit, pending,
}: {
  open: boolean; onClose: () => void; title: string;
  initial?: Item; employees: Emp[]; pending: boolean;
  onSubmit: (input: { id?: string; code: string; name: string; side: "OFFICE" | "PRODUCTION"; managerId?: string }) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [side, setSide] = useState<"OFFICE" | "PRODUCTION">("OFFICE");
  const [managerId, setManagerId] = useState<string>("");

  useEffect(() => {
    if (open) {
      setCode(initial?.code ?? ""); setName(initial?.name ?? "");
      setSide(initial?.side ?? "OFFICE"); setManagerId(initial?.managerId ?? "");
    }
  }, [open, initial?.id]);

  const submit = () => {
    if (!code || !name) { toast.error("กรอก รหัส และ ชื่อ"); return; }
    onSubmit({ id: initial?.id, code, name, side, managerId: managerId || undefined });
  };

  const filteredEmps = employees.filter((e) => e.side === side);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>รหัส *</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="HR" /></div>
            <div className="space-y-1.5"><Label>ฝ่าย *</Label>
              <Select value={side} onValueChange={(v: any) => setSide(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OFFICE">Office</SelectItem>
                  <SelectItem value="PRODUCTION">ผลิต</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>ชื่อแผนก *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ฝ่ายบุคคล" /></div>
          <div className="space-y-1.5"><Label>ผู้จัดการแผนก</Label>
            <Select value={managerId || " "} onValueChange={(v) => setManagerId(v === " " ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="— ไม่ระบุ —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">— ไม่ระบุ —</SelectItem>
                {filteredEmps.map((e) => <SelectItem key={e.id} value={e.id}>{e.code} — {e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">กรองตามฝ่ายที่เลือก</p>
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
