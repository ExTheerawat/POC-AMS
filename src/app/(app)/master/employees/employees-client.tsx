"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { upsertEmployee, deleteEmployee } from "@/server/actions/master";
import { DataTable, type Column } from "@/components/ui/data-table";
import { BEDatePicker } from "@/components/ui/be-date-picker";

type Item = {
  id: string; employeeCode: string; firstName: string; lastName: string; email: string;
  position: string; side: "OFFICE" | "PRODUCTION";
  departmentId: string | null; departmentName: string | null;
  supervisorId: string | null; supervisorName: string | null;
  defaultBusRouteId: string | null; defaultBusRouteName: string | null;
  hireDate: string; isActive: boolean; username: string | null;
};
type Dept = { id: string; code: string; name: string; side: "OFFICE" | "PRODUCTION" };
type Sup = { id: string; code: string; name: string; side: string };
type BusRouteOpt = { id: string; name: string };

export function EmployeesClient({
  items, departments, supervisors, busRoutes,
}: {
  items: Item[]; departments: Dept[]; supervisors: Sup[]; busRoutes: BusRouteOpt[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sideFilter, setSideFilter] = useState<"ALL" | "OFFICE" | "PRODUCTION">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ACTIVE");

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Item | null>(null);
  const [delTarget, setDelTarget] = useState<Item | null>(null);

  // Pre-filter (toolbar filters) then pass to DataTable for search/sort/page
  const filtered = useMemo(() => items.filter((e) => {
    if (statusFilter === "ACTIVE" && !e.isActive) return false;
    if (statusFilter === "INACTIVE" && e.isActive) return false;
    if (sideFilter !== "ALL" && e.side !== sideFilter) return false;
    return true;
  }), [items, sideFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter((e) => e.isActive).length,
    office: items.filter((e) => e.side === "OFFICE" && e.isActive).length,
    production: items.filter((e) => e.side === "PRODUCTION" && e.isActive).length,
  }), [items]);

  const save = (input: any) => {
    startTransition(async () => {
      const res = await upsertEmployee(input);
      if ((res as any)?.error) toast.error((res as any).error);
      else { toast.success(input.id ? "อัปเดตเรียบร้อย" : "เพิ่มพนักงานสำเร็จ"); setCreateOpen(false); setEditTarget(null); router.refresh(); }
    });
  };

  const remove = () => {
    if (!delTarget) return;
    startTransition(async () => {
      const res = await deleteEmployee(delTarget.id);
      if ((res as any)?.error) toast.error((res as any).error);
      else { toast.success("ตั้งเป็น Inactive เรียบร้อย"); setDelTarget(null); router.refresh(); }
    });
  };

  const columns: Column<Item>[] = useMemo(() => [
    {
      key: "seq", header: "ลำดับ", width: 60, hideable: false,
      cell: (_e, idx) => <span className="text-muted-foreground tabular-nums">{idx + 1}</span>,
    },
    { key: "code", header: "รหัส", sortable: true, accessor: (e) => e.employeeCode },
    {
      key: "name", header: "ชื่อ-นามสกุล", sortable: true,
      accessor: (e) => `${e.firstName} ${e.lastName}`, align: "left",
    },
    { key: "department", header: "แผนก", sortable: true, accessor: (e) => e.departmentName ?? "-", align: "left" },
    { key: "position", header: "ตำแหน่ง", accessor: (e) => e.position || "-", align: "left" },
    {
      key: "side", header: "ฝ่าย", sortable: true, accessor: (e) => e.side,
      cell: (e) => <Badge variant="outline">{e.side === "OFFICE" ? "Office" : "ผลิต"}</Badge>,
    },
    { key: "supervisor", header: "หัวหน้า", sortable: true, accessor: (e) => e.supervisorName ?? "-", align: "left" },
    { key: "defaultBusRoute", header: "สายรถ", sortable: true, accessor: (e) => e.defaultBusRouteName ?? "-", align: "left" },
    { key: "email", header: "Email", accessor: (e) => e.email, align: "left" },
    { key: "username", header: "User", accessor: (e) => e.username ?? "-" },
    {
      key: "status", header: "สถานะ", sortable: true, accessor: (e) => (e.isActive ? 1 : 0),
      cell: (e) => e.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>,
    },
    {
      key: "actions", header: "การกระทำ", align: "right", hideable: false,
      cell: (e) => (
        <span className="whitespace-nowrap">
          <Button size="icon" variant="ghost" onClick={() => setEditTarget(e)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" onClick={() => setDelTarget(e)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
        </span>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center"><Users className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold">พนักงาน</h1>
            <p className="text-muted-foreground">{stats.total} คน • Active {stats.active}</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> เพิ่มพนักงาน</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">ทั้งหมด</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Active</div><div className="text-2xl font-bold text-success">{stats.active}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Office</div><div className="text-2xl font-bold text-primary">{stats.office}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">ผลิต</div><div className="text-2xl font-bold text-emerald-600">{stats.production}</div></CardContent></Card>
      </div>

      <DataTable<Item>
        data={filtered}
        getRowId={(e) => e.id}
        columns={columns}
        searchKeys={[
          "employeeCode", "firstName", "lastName", "email", "position",
          (e) => e.departmentName ?? "",
          (e) => e.supervisorName ?? "",
          (e) => e.username ?? "",
          (e) => `${e.firstName} ${e.lastName}`,
          (e) => e.side === "OFFICE" ? "office" : "ผลิต production",
          (e) => e.isActive ? "active ใช้งาน" : "inactive ปิดใช้งาน",
        ]}
        searchPlaceholder="ค้นหา รหัส / ชื่อ / email / แผนก / ตำแหน่ง / หัวหน้า / user / สถานะ..."
        defaultSort={{ key: "code", direction: "asc" }}
        emptyText="ไม่พบพนักงาน"
        toolbar={
          <>
            <Select value={sideFilter} onValueChange={(v: any) => setSideFilter(v)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทุกฝ่าย</SelectItem>
                <SelectItem value="OFFICE">Office</SelectItem>
                <SelectItem value="PRODUCTION">ผลิต</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทั้งหมด</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <EmployeeFormDialog open={createOpen} onClose={() => setCreateOpen(false)} title="เพิ่มพนักงาน"
        departments={departments} supervisors={supervisors} busRoutes={busRoutes} onSubmit={save} pending={pending} />
      <EmployeeFormDialog open={!!editTarget} onClose={() => setEditTarget(null)} title="แก้ไขพนักงาน"
        initial={editTarget ?? undefined} departments={departments} supervisors={supervisors} busRoutes={busRoutes} onSubmit={save} pending={pending} />

      <Dialog open={!!delTarget} onOpenChange={(v) => !v && setDelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบพนักงาน</DialogTitle>
            <DialogDescription>
              <b>{delTarget?.firstName} {delTarget?.lastName}</b> ({delTarget?.employeeCode}) จะถูกตั้งเป็น Inactive และ User ที่ผูกอยู่จะถูกปิดใช้งานด้วย
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

function EmployeeFormDialog({
  open, onClose, title, initial, departments, supervisors, busRoutes, onSubmit, pending,
}: {
  open: boolean; onClose: () => void; title: string;
  initial?: Item; departments: Dept[]; supervisors: Sup[]; busRoutes: BusRouteOpt[]; pending: boolean;
  onSubmit: (input: any) => void;
}) {
  const [code, setCode] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [side, setSide] = useState<"OFFICE" | "PRODUCTION">("OFFICE");
  const [departmentId, setDepartmentId] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [defaultBusRouteId, setDefaultBusRouteId] = useState("");
  const [hireDate, setHireDate] = useState("");

  useEffect(() => {
    if (open) {
      setCode(initial?.employeeCode ?? "");
      setFirst(initial?.firstName ?? ""); setLast(initial?.lastName ?? "");
      setEmail(initial?.email ?? ""); setPosition(initial?.position ?? "");
      setSide(initial?.side ?? "OFFICE");
      setDepartmentId(initial?.departmentId ?? "");
      setSupervisorId(initial?.supervisorId ?? "");
      setDefaultBusRouteId(initial?.defaultBusRouteId ?? "");
      setHireDate(initial?.hireDate ? initial.hireDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
    }
  }, [open, initial?.id]);

  const filteredDepts = departments.filter((d) => d.side === side);
  const filteredSups = supervisors.filter((s) => s.side === side && s.id !== initial?.id);

  const submit = () => {
    if (!code || !first || !last || !email || !hireDate) { toast.error("กรอกข้อมูลที่จำเป็น"); return; }
    onSubmit({
      id: initial?.id, employeeCode: code, firstName: first, lastName: last, email,
      position, side, departmentId: departmentId || undefined,
      supervisorId: supervisorId || undefined,
      defaultBusRouteId: defaultBusRouteId || undefined,
      hireDate,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>รหัสพนักงาน *</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EMP001" /></div>
            <div className="space-y-1.5"><Label>ฝ่าย *</Label>
              <Select value={side} onValueChange={(v: any) => { setSide(v); setDepartmentId(""); setSupervisorId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OFFICE">Office</SelectItem>
                  <SelectItem value="PRODUCTION">ผลิต</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>ชื่อ *</Label><Input value={first} onChange={(e) => setFirst(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>นามสกุล *</Label><Input value={last} onChange={(e) => setLast(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Email *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="employee@company.com" /></div>
          <div className="space-y-1.5"><Label>ตำแหน่ง</Label><Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="พนักงานทั่วไป" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>แผนก</Label>
              <Select value={departmentId || " "} onValueChange={(v) => setDepartmentId(v === " " ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="— เลือก —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">— ไม่ระบุ —</SelectItem>
                  {filteredDepts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>วันเริ่มงาน *</Label><BEDatePicker value={hireDate} onChange={setHireDate} /></div>
          </div>
          <div className="space-y-1.5"><Label>หัวหน้า</Label>
            <Select value={supervisorId || " "} onValueChange={(v) => setSupervisorId(v === " " ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="— เลือก —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">— ไม่ระบุ —</SelectItem>
                {filteredSups.map((s) => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">กรองตามฝ่ายที่เลือก</p>
          </div>
          <div className="space-y-1.5"><Label>สายรถ default (ใช้ pre-fill ตอนลง OT)</Label>
            <Select value={defaultBusRouteId || " "} onValueChange={(v) => setDefaultBusRouteId(v === " " ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="— เลือก —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">— ไม่ระบุ —</SelectItem>
                {busRoutes.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">เมื่อเลือกพนักงานคนนี้ลง OT จะ pre-fill สายรถนี้ให้ (แก้ override ได้)</p>
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
