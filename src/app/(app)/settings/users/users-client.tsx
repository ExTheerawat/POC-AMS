"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, UserPlus, MoreHorizontal, KeyRound, Pencil, Power, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";
import { createUser, updateUser, resetPassword, toggleUserActive, deleteUser } from "@/server/actions/users";
import { USER_ROLES, type UserRole } from "@/types/enums";
import { DataTable, type Column } from "@/components/ui/data-table";

const ROLE_LABEL: Record<UserRole, string> = {
  SUPERVISOR: "หัวหน้า",
  DEPT_MANAGER: "ผู้จัดการแผนก",
  FACTORY_MANAGER: "ผู้จัดการโรงงาน",
  HR_ADMIN: "HR Admin",
  SYSTEM_ADMIN: "System Admin",
};
const ROLE_VARIANT: Record<UserRole, "info" | "success" | "warning" | "destructive" | "secondary" | "default"> = {
  SUPERVISOR: "info",
  DEPT_MANAGER: "success",
  FACTORY_MANAGER: "warning",
  HR_ADMIN: "default",
  SYSTEM_ADMIN: "destructive",
};

type UserRow = {
  id: string; username: string; role: string; isActive: boolean; createdAt: string;
  employee: { id: string; code: string; name: string; email: string; department: string | null; side: string } | null;
};

type EmpRow = { id: string; code: string; name: string; department: string; side: string; linked: boolean };

export function UsersClient({ currentUserId, users, employees }: { currentUserId: string; users: UserRow[]; employees: EmpRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [pwTarget, setPwTarget] = useState<UserRow | null>(null);
  const [delTarget, setDelTarget] = useState<UserRow | null>(null);

  // Pre-filter (toolbar filters) before DataTable
  const filtered = useMemo(() => users.filter((u) => {
    if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
    if (statusFilter === "ACTIVE" && !u.isActive) return false;
    if (statusFilter === "INACTIVE" && u.isActive) return false;
    return true;
  }), [users, roleFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.isActive).length,
    admin: users.filter((u) => u.role === "SYSTEM_ADMIN" || u.role === "HR_ADMIN").length,
    unlinked: users.filter((u) => !u.employee).length,
  }), [users]);

  const onToggle = (u: UserRow) => {
    if (u.id === currentUserId) { toast.error("ห้าม disable ตัวเอง"); return; }
    startTransition(async () => {
      const res = await toggleUserActive(u.id);
      if ("error" in res) toast.error(res.error);
      else { toast.success(res.isActive ? "เปิดใช้งานแล้ว" : "ปิดใช้งานแล้ว"); router.refresh(); }
    });
  };

  const onDelete = () => {
    if (!delTarget) return;
    startTransition(async () => {
      const res = await deleteUser(delTarget.id);
      if (res?.error) toast.error(res.error);
      else { toast.success("ลบเรียบร้อย (ตั้งเป็น Inactive)"); setDelTarget(null); router.refresh(); }
    });
  };

  const columns: Column<UserRow>[] = useMemo(() => [
    {
      key: "seq", header: "ลำดับ", width: 60, hideable: false,
      cell: (_u, idx) => <span className="text-muted-foreground tabular-nums">{idx + 1}</span>,
    },
    {
      key: "username", header: "Username", sortable: true, accessor: (u) => u.username, align: "left",
      cell: (u) => (
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white grid place-items-center text-xs font-semibold">
            {u.username[0].toUpperCase()}
          </div>
          <span>{u.username}</span>
          {u.id === currentUserId && <Badge variant="info" className="text-[10px]">คุณ</Badge>}
        </div>
      ),
    },
    {
      key: "role", header: "Role", sortable: true, accessor: (u) => u.role,
      cell: (u) => <Badge variant={ROLE_VARIANT[u.role as UserRole] ?? "secondary"}>{ROLE_LABEL[u.role as UserRole] ?? u.role}</Badge>,
    },
    {
      key: "employee", header: "พนักงานที่ผูก", sortable: true,
      accessor: (u) => u.employee?.name ?? "",
      align: "left",
      cell: (u) => u.employee ? (
        <div>
          <div>{u.employee.name}</div>
          <div className="text-muted-foreground text-xs">{u.employee.code}</div>
        </div>
      ) : <span className="text-muted-foreground italic">— ไม่ผูก —</span>,
    },
    {
      key: "department", header: "แผนก", sortable: true,
      accessor: (u) => u.employee?.department ?? "",
      cell: (u) => u.employee?.department ?? "-",
      align: "left",
    },
    {
      key: "side", header: "ฝ่าย", sortable: true, accessor: (u) => u.employee?.side ?? "",
      cell: (u) => u.employee ? <Badge variant="outline">{u.employee.side === "OFFICE" ? "Office" : "ผลิต"}</Badge> : null,
    },
    {
      key: "status", header: "สถานะ", sortable: true, accessor: (u) => (u.isActive ? 1 : 0),
      cell: (u) => u.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>,
    },
    {
      key: "createdAt", header: "สร้างเมื่อ", sortable: true, accessor: (u) => u.createdAt,
      cell: (u) => <span className="text-muted-foreground">{formatDate(u.createdAt)}</span>,
    },
    {
      key: "actions", header: "การกระทำ", align: "right", hideable: false,
      cell: (u) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setEditTarget(u)}><Pencil className="h-4 w-4 mr-2" /> แก้ไข</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPwTarget(u)}><KeyRound className="h-4 w-4 mr-2" /> เปลี่ยนรหัสผ่าน</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggle(u)} disabled={u.id === currentUserId}>
              <Power className="h-4 w-4 mr-2" /> {u.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setDelTarget(u)} disabled={u.id === currentUserId} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> ลบ (Inactive)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [currentUserId]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center"><Shield className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">จัดการผู้ใช้</h1>
            <p className="text-muted-foreground">เพิ่ม / แก้ไข / เปลี่ยน Role / Reset Password</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}><UserPlus className="h-4 w-4" /> เพิ่ม User ใหม่</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">ผู้ใช้ทั้งหมด</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Active</div><div className="text-2xl font-bold text-success">{stats.active}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Admin / HR</div><div className="text-2xl font-bold text-primary">{stats.admin}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">ยังไม่ผูกพนักงาน</div><div className="text-2xl font-bold text-warning">{stats.unlinked}</div></CardContent></Card>
      </div>

      <DataTable<UserRow>
        data={filtered}
        getRowId={(u) => u.id}
        columns={columns}
        searchKeys={[
          "username",
          (u) => u.employee?.name ?? "",
          (u) => u.employee?.code ?? "",
          (u) => u.employee?.department ?? "",
        ]}
        searchPlaceholder="ค้นหา username / ชื่อ / รหัสพนักงาน / แผนก..."
        defaultSort={{ key: "username", direction: "asc" }}
        emptyText="ไม่พบผู้ใช้"
        toolbar={
          <>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทุก Role</SelectItem>
                {USER_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
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

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} employees={employees.filter((e) => !e.linked)} pending={pending} startTransition={startTransition} onDone={() => router.refresh()} />
      <EditUserDialog target={editTarget} onClose={() => setEditTarget(null)} employees={employees} pending={pending} startTransition={startTransition} onDone={() => router.refresh()} />
      <PasswordDialog target={pwTarget} onClose={() => setPwTarget(null)} pending={pending} startTransition={startTransition} />

      <Dialog open={!!delTarget} onOpenChange={(v) => !v && setDelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ User</DialogTitle>
            <DialogDescription>
              <b>{delTarget?.username}</b> จะถูกตั้งเป็น Inactive และยกเลิกการผูกกับพนักงาน
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelTarget(null)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={onDelete} disabled={pending}>ยืนยันลบ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateUserDialog({
  open, onOpenChange, employees, pending, startTransition, onDone,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  employees: EmpRow[]; pending: boolean;
  startTransition: React.TransitionStartFunction; onDone: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("SUPERVISOR");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [isActive, setIsActive] = useState(true);

  const reset = () => { setUsername(""); setPassword(""); setRole("SUPERVISOR"); setEmployeeId(""); setIsActive(true); };

  const submit = () => {
    startTransition(async () => {
      const res = await createUser({ username, password, role, employeeId: employeeId || undefined, isActive });
      if (res?.error) toast.error(res.error);
      else { toast.success(`สร้าง User ${username} สำเร็จ`); onOpenChange(false); reset(); onDone(); }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> เพิ่ม User ใหม่</DialogTitle>
          <DialogDescription>กรอกข้อมูลผู้ใช้ใหม่</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Username *</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="เช่น emp002" />
            </div>
            <div className="space-y-1.5"><Label>Password *</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="ขั้นต่ำ 6 ตัวอักษร" />
            </div>
          </div>
          <div className="space-y-1.5"><Label>Role *</Label>
            <Select value={role} onValueChange={(v: any) => setRole(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>ผูกกับพนักงาน (Optional)</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="— ไม่ผูก —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">— ไม่ผูก —</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.code} — {e.name} ({e.department})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">ผูก User เข้ากับ Employee record (เฉพาะที่ยังไม่ผูกกับ User อื่น)</p>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div><Label>เปิดใช้งานทันที</Label><p className="text-xs text-muted-foreground mt-1">ถ้าปิด User จะ login ไม่ได้</p></div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={submit} disabled={pending || !username || !password}>{pending ? "กำลังบันทึก..." : "บันทึก"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  target, onClose, employees, pending, startTransition, onDone,
}: {
  target: UserRow | null; onClose: () => void; employees: EmpRow[];
  pending: boolean; startTransition: React.TransitionStartFunction; onDone: () => void;
}) {
  const [role, setRole] = useState<UserRole>("SUPERVISOR");
  const [isActive, setIsActive] = useState(true);
  const [employeeId, setEmployeeId] = useState<string>("");

  useEffect(() => {
    if (target) {
      setRole(target.role as UserRole);
      setIsActive(target.isActive);
      setEmployeeId(target.employee?.id ?? "");
    }
  }, [target]);

  const submit = () => {
    if (!target) return;
    startTransition(async () => {
      const res = await updateUser({
        id: target.id, role, isActive,
        employeeId: employeeId && employeeId !== " " ? employeeId : null,
      });
      if (res?.error) toast.error(res.error);
      else { toast.success("บันทึกเรียบร้อย"); onClose(); onDone(); }
    });
  };

  const availableEmployees = employees.filter((e) => !e.linked || e.id === target?.employee?.id);

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5 text-primary" /> แก้ไข User</DialogTitle>
          <DialogDescription className="font-mono">{target?.username}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5"><Label>Role *</Label>
            <Select value={role} onValueChange={(v: any) => setRole(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>พนักงานที่ผูก</Label>
            <Select value={employeeId || " "} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="— ไม่ผูก —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">— ไม่ผูก —</SelectItem>
                {availableEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.code} — {e.name} ({e.department})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div><Label>เปิดใช้งาน</Label></div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
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

function PasswordDialog({
  target, onClose, pending, startTransition,
}: {
  target: UserRow | null; onClose: () => void;
  pending: boolean; startTransition: React.TransitionStartFunction;
}) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const submit = () => {
    if (!target) return;
    if (pw !== pw2) { toast.error("รหัสผ่านสองช่องไม่ตรงกัน"); return; }
    startTransition(async () => {
      const res = await resetPassword(target.id, pw);
      if (res?.error) toast.error(res.error);
      else { toast.success("เปลี่ยนรหัสผ่านสำเร็จ"); setPw(""); setPw2(""); onClose(); }
    });
  };

  return (
    <Dialog open={!!target} onOpenChange={(v) => { if (!v) { onClose(); setPw(""); setPw2(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> เปลี่ยนรหัสผ่าน</DialogTitle>
          <DialogDescription>สำหรับ User: <span className="font-mono">{target?.username}</span></DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label>รหัสผ่านใหม่ *</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="ขั้นต่ำ 6 ตัวอักษร" />
          </div>
          <div className="space-y-1.5"><Label>ยืนยันรหัสผ่าน *</Label>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={submit} disabled={pending || pw.length < 6 || pw !== pw2}>
            {pending ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
