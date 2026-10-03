"use client";

import Link from "next/link";
import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Clock, FilePlus, Eye, Pencil, Trash2, Bus, X, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { formatDate, calculateOTHours } from "@/lib/utils";
import { updateOT, cancelOT } from "@/server/actions/ot";
import { DataTable, type Column } from "@/components/ui/data-table";
import { BEDatePicker } from "@/components/ui/be-date-picker";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "ฉบับร่าง", PENDING_DEPT_MGR: "รอ ผจก.แผนก", PENDING_FACTORY_MGR: "รอ ผจก.โรงงาน",
  APPROVED: "อนุมัติแล้ว", COMPLETED: "เสร็จสิ้น", REJECTED: "ปฏิเสธ", CANCELLED: "ยกเลิก", MODIFIED_BY_HR: "HR แก้ไข",
};
const STATUS_VARIANT: Record<string, any> = {
  PENDING_DEPT_MGR: "warning", PENDING_FACTORY_MGR: "warning",
  APPROVED: "success", COMPLETED: "success", REJECTED: "destructive", CANCELLED: "secondary", MODIFIED_BY_HR: "info",
};

type OTEmployee = {
  otEmployeeId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  busRouteId: string;
  workDescription: string;
  note: string;
};
type OT = {
  id: string; requestNo: string; otDate: string;
  startTime: string; endTime: string; totalHours: number;
  isHoliday: boolean; workDescription: string;
  busRouteId: string; busRouteName: string;
  side: string; status: string; creatorId: string;
  employeeCount: number;
  otEmployees: OTEmployee[];
};
type BusRoute = { id: string; name: string; route: string };
type AvailableEmployee = { id: string; code: string; name: string; dept: string; defaultBusRouteId: string | null };

const EDITABLE = new Set(["DRAFT", "PENDING_DEPT_MGR", "PENDING_FACTORY_MGR"]);
// Policy: ยกเลิกได้เฉพาะก่อน manager approve เท่านั้น
// หลัง APPROVED → ใช้ flow "ขอยกเลิก OT" (cancel-request) ที่ HR review
const CANCELLABLE = new Set(["DRAFT", "PENDING_DEPT_MGR", "PENDING_FACTORY_MGR"]);
// HR/Admin override — ยกเลิกได้ทุก status (ยกเว้นที่ยกเลิกอยู่แล้ว)
const ADMIN_CANCELLABLE = new Set([
  "DRAFT", "PENDING_DEPT_MGR", "PENDING_FACTORY_MGR", "APPROVED", "MODIFIED_BY_HR",
]);

export function OTListClient({
  role, currentEmployeeId, isAdmin, ots, busRoutes, availableEmployees,
}: {
  role: string;
  currentEmployeeId: string | null | undefined;
  isAdmin: boolean;
  ots: OT[];
  busRoutes: BusRoute[];
  availableEmployees: AvailableEmployee[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editTarget, setEditTarget] = useState<OT | null>(null);
  const [delTarget, setDelTarget] = useState<OT | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sideFilter, setSideFilter] = useState<string>("ALL");
  const [holidayFilter, setHolidayFilter] = useState<"ALL" | "HOLIDAY" | "WEEKDAY">("ALL");

  const filtered = useMemo(() => ots.filter((o) => {
    if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
    if (sideFilter !== "ALL" && o.side !== sideFilter) return false;
    if (holidayFilter === "HOLIDAY" && !o.isHoliday) return false;
    if (holidayFilter === "WEEKDAY" && o.isHoliday) return false;
    return true;
  }), [ots, statusFilter, sideFilter, holidayFilter]);

  const canEdit = (o: OT) => EDITABLE.has(o.status) && (isAdmin || o.creatorId === currentEmployeeId);
  const canDelete = (o: OT) => {
    // Admin can cancel any active status
    if (isAdmin) return ADMIN_CANCELLABLE.has(o.status);
    // Owner can only cancel BEFORE manager approve
    return CANCELLABLE.has(o.status) && o.creatorId === currentEmployeeId;
  };
  const deleteTooltip = (o: OT): string => {
    if (canDelete(o)) return "ยกเลิก";
    if (o.status === "APPROVED" || o.status === "MODIFIED_BY_HR") {
      return `อนุมัติแล้ว — ใช้เมนู "ขอยกเลิก OT" เพื่อขอ HR review`;
    }
    if (o.status === "CANCELLED") return "ยกเลิกอยู่แล้ว";
    if (o.status === "REJECTED") return "ถูกปฏิเสธอยู่แล้ว";
    return "ยกเลิกไม่ได้";
  };

  const handleDelete = () => {
    if (!delTarget) return;
    startTransition(async () => {
      const res = await cancelOT(delTarget.id);
      if ("error" in res) toast.error(res.error);
      else { toast.success("ยกเลิก OT เรียบร้อย"); setDelTarget(null); router.refresh(); }
    });
  };

  const canCreate = ["SUPERVISOR", "DEPT_MANAGER", "HR_ADMIN", "SYSTEM_ADMIN"].includes(role);

  const columns: Column<OT>[] = useMemo(() => [
    {
      key: "seq", header: "ลำดับ", width: 60, hideable: false,
      cell: (_o, idx) => <span className="text-muted-foreground tabular-nums">{idx + 1}</span>,
    },
    { key: "requestNo", header: "เลขที่", sortable: true, accessor: (o) => o.requestNo },
    {
      key: "otDate", header: "วันที่", sortable: true, accessor: (o) => o.otDate,
      cell: (o) => (
        <span>
          {formatDate(o.otDate)}
          {o.isHoliday && <Badge variant="warning" className="ml-1 text-[10px]">วันหยุด</Badge>}
        </span>
      ),
    },
    {
      key: "time", header: "เวลา", sortable: true, accessor: (o) => o.startTime,
      cell: (o) => `${o.startTime} - ${o.endTime}`,
    },
    { key: "totalHours", header: "ชั่วโมง", sortable: true, accessor: (o) => o.totalHours },
    {
      key: "employeeCount", header: "พนักงาน", sortable: true, accessor: (o) => o.employeeCount,
      cell: (o) => `${o.employeeCount} คน`,
    },
    { key: "busRoute", header: "สายรถ", sortable: true, accessor: (o) => o.busRouteName, align: "left" },
    {
      key: "side", header: "ฝ่าย", sortable: true, accessor: (o) => o.side,
      cell: (o) => <Badge variant="outline">{o.side === "OFFICE" ? "Office" : "ผลิต"}</Badge>,
    },
    {
      key: "status", header: "สถานะ", sortable: true, accessor: (o) => STATUS_LABEL[o.status] ?? o.status,
      cell: (o) => <Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]}</Badge>,
    },
    {
      key: "actions", header: "การกระทำ", align: "right", hideable: false,
      cell: (o) => (
        <span className="whitespace-nowrap">
          <Button asChild size="icon" variant="ghost" title="ดูรายละเอียด">
            <Link href={`/ot/${o.id}`}><Eye className="h-3.5 w-3.5" /></Link>
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setEditTarget(o)} disabled={!canEdit(o)} title={canEdit(o) ? "แก้ไข" : "แก้ไขไม่ได้"}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setDelTarget(o)} disabled={!canDelete(o)} className="text-destructive hover:text-destructive" title={deleteTooltip(o)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </span>
      ),
    },
  ], [isAdmin, currentEmployeeId]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center"><Clock className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">รายการ OT</h1>
            <p className="text-muted-foreground">{filtered.length} จาก {ots.length} รายการ</p>
          </div>
        </div>
        {canCreate && (
          <Button asChild><Link href="/ot/create"><FilePlus className="h-4 w-4" /> สร้าง OT ใหม่</Link></Button>
        )}
      </div>

      <DataTable<OT>
        data={filtered}
        getRowId={(o) => o.id}
        columns={columns}
        searchKeys={["requestNo", "workDescription", "busRouteName"]}
        searchPlaceholder="ค้นหา เลขที่ / ลักษณะงาน / สายรถ..."
        defaultSort={{ key: "otDate", direction: "desc" }}
        emptyText={ots.length === 0 ? "ยังไม่มีรายการ OT" : "ไม่พบรายการที่ตรงกับตัวกรอง"}
        toolbar={
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="สถานะ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทุกสถานะ</SelectItem>
                <SelectItem value="PENDING_DEPT_MGR">รอ ผจก.แผนก</SelectItem>
                <SelectItem value="PENDING_FACTORY_MGR">รอ ผจก.โรงงาน</SelectItem>
                <SelectItem value="APPROVED">อนุมัติแล้ว</SelectItem>
                <SelectItem value="COMPLETED">เสร็จสิ้น</SelectItem>
                <SelectItem value="CANCELLED">ยกเลิก</SelectItem>
              </SelectContent>
            </Select>
            <Select value={holidayFilter} onValueChange={(v: any) => setHolidayFilter(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทุกประเภทวัน</SelectItem>
                <SelectItem value="WEEKDAY">วันธรรมดา</SelectItem>
                <SelectItem value="HOLIDAY">วันหยุด</SelectItem>
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

      <OTEditDialog
        target={editTarget}
        busRoutes={busRoutes}
        availableEmployees={availableEmployees}
        onClose={() => setEditTarget(null)}
        onDone={() => router.refresh()}
        pending={pending}
        startTransition={startTransition}
      />

      <Dialog open={!!delTarget} onOpenChange={(v) => !v && setDelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการยกเลิก OT</DialogTitle>
            <DialogDescription>
              <b>{delTarget?.requestNo}</b> · {delTarget?.totalHours} ชั่วโมง · {delTarget?.employeeCount} คน — จะถูกตั้งเป็น "ยกเลิก"
              <span className="block mt-2 text-xs text-muted-foreground">
                ⚠️ ยกเลิกได้เฉพาะก่อนผู้จัดการอนุมัติ — ระบบจะส่ง email แจ้งทุกคนที่เกี่ยวข้อง
              </span>
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

// Row in the employee editor — represents either an existing OT employee
// (otEmployeeId present) or a newly added one (otEmployeeId undefined).
type EmpRow = {
  rowKey: string;              // stable key for React (otEmployeeId OR `new:${employeeId}`)
  otEmployeeId?: string;       // present if this is an existing OT employee
  employeeId: string;          // master employee id
  employeeName: string;
  employeeCode: string;
  busRouteId: string;          // "" = not yet chosen
  workDescription: string;     // per-employee override
  note: string;
};

function OTEditDialog({
  target, busRoutes, availableEmployees, onClose, onDone, pending, startTransition,
}: {
  target: OT | null;
  busRoutes: BusRoute[];
  availableEmployees: AvailableEmployee[];
  onClose: () => void;
  onDone: () => void;
  pending: boolean;
  startTransition: React.TransitionStartFunction;
}) {
  const [otDate, setOtDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [workDesc, setWorkDesc] = useState("");
  const [rows, setRows] = useState<EmpRow[]>([]);
  const [bulkRouteId, setBulkRouteId] = useState("");
  const [addEmpId, setAddEmpId] = useState("");

  useEffect(() => {
    if (target) {
      setOtDate(target.otDate.slice(0, 10));
      setStartTime(target.startTime);
      setEndTime(target.endTime);
      setWorkDesc(target.workDescription);
      setRows(target.otEmployees.map((e) => ({
        rowKey: e.otEmployeeId,
        otEmployeeId: e.otEmployeeId,
        employeeId: e.employeeId,
        employeeName: e.employeeName,
        employeeCode: e.employeeCode,
        busRouteId: e.busRouteId,
        workDescription: e.workDescription,
        note: e.note,
      })));
      setBulkRouteId("");
      setAddEmpId("");
    }
  }, [target?.id]);

  const hours = useMemo(() => calculateOTHours(startTime || "00:00", endTime || "00:00"), [startTime, endTime]);
  const isHoliday = useMemo(() => {
    if (!otDate) return false;
    const d = new Date(otDate).getDay();
    return d === 0 || d === 6;
  }, [otDate]);

  const setRouteFor = (rowKey: string, routeId: string) => {
    setRows((prev) => prev.map((r) => r.rowKey === rowKey ? { ...r, busRouteId: routeId } : r));
  };

  const removeRow = (rowKey: string) => {
    setRows((prev) => prev.filter((r) => r.rowKey !== rowKey));
  };

  const addRow = () => {
    if (!addEmpId) { toast.error("กรุณาเลือกพนักงานก่อน"); return; }
    const emp = availableEmployees.find((e) => e.id === addEmpId);
    if (!emp) return;
    if (rows.some((r) => r.employeeId === emp.id)) {
      toast.error("พนักงานคนนี้อยู่ใน OT แล้ว"); return;
    }
    setRows((prev) => [...prev, {
      rowKey: `new:${emp.id}`,
      otEmployeeId: undefined,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeCode: emp.code,
      // Pre-fill: bulk route (if set) → employee's default route → blank
      busRouteId: bulkRouteId || emp.defaultBusRouteId || "",
      workDescription: "",
      note: "",
    }]);
    setAddEmpId("");
  };

  const applyBulk = () => {
    if (!bulkRouteId) { toast.error("กรุณาเลือกสายรถก่อน"); return; }
    setRows((prev) => prev.map((r) => ({ ...r, busRouteId: bulkRouteId })));
    toast.success(`ตั้งสายรถให้ทุกคนเป็น "${busRoutes.find((b) => b.id === bulkRouteId)?.name}"`);
  };

  const missingCount = useMemo(() => rows.filter((r) => !r.busRouteId).length, [rows]);

  const routeSummary = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (r.busRouteId) m.set(r.busRouteId, (m.get(r.busRouteId) ?? 0) + 1);
    }
    return m;
  }, [rows]);

  // Employees not yet in the list — for the add picker
  const addCandidates = useMemo(() => {
    const inListEmpIds = new Set(rows.map((r) => r.employeeId));
    return availableEmployees.filter((e) => !inListEmpIds.has(e.id));
  }, [rows, availableEmployees]);

  const submit = () => {
    if (!target) return;
    if (!otDate || !startTime || !endTime) { toast.error("กรอกข้อมูลให้ครบ"); return; }
    if (rows.length === 0) { toast.error("ต้องมีพนักงานอย่างน้อย 1 คน"); return; }
    if (missingCount > 0) {
      toast.error(`ยังมีพนักงาน ${missingCount} คนที่ยังไม่ได้เลือกสายรถ`);
      return;
    }
    const employees = rows.map((r) => ({
      otEmployeeId: r.otEmployeeId,
      employeeId: r.employeeId,
      busRouteId: r.busRouteId,
      workDescription: r.workDescription || undefined,
      note: r.note || undefined,
    }));
    startTransition(async () => {
      const res = await updateOT({
        id: target.id, otDate, startTime, endTime,
        workDescription: workDesc, employees,
      });
      if ("error" in res) toast.error(res.error);
      else { toast.success("บันทึก OT เรียบร้อย"); onClose(); onDone(); }
    });
  };

  const originalCount = target?.otEmployees.length ?? 0;
  const delta = rows.length - originalCount;

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>แก้ไข OT</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{target?.requestNo}</span> · พนักงาน {rows.length} คน
            {delta !== 0 && (
              <Badge variant={delta > 0 ? "info" : "warning"} className="ml-2 text-[10px]">
                {delta > 0 ? `+${delta}` : delta} จากเดิม
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2 overflow-y-auto flex-1">
          <div className="space-y-1.5">
            <Label>วันที่ทำ OT *</Label>
            <BEDatePicker value={otDate} onChange={setOtDate} />
            {otDate && (isHoliday
              ? <Badge variant="warning" className="mt-1">วันหยุด — มาตรฐาน 8+3 = 11 ชม.</Badge>
              : <Badge variant="info" className="mt-1">วันทำงาน — มาตรฐาน 2.5 ชม.</Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>เวลาเริ่ม *</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>เวลาสิ้นสุด *</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          </div>
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="text-sm text-muted-foreground">ชั่วโมง OT ที่คำนวณได้</div>
            <div className="text-xl font-bold text-primary tabular-nums">{hours.toFixed(2)} ชั่วโมง</div>
          </div>
          <div className="space-y-1.5">
            <Label>ลักษณะงาน</Label>
            <Textarea rows={2} value={workDesc} onChange={(e) => setWorkDesc(e.target.value)} />
          </div>

          {/* Per-employee bus route + add/remove */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="flex items-center gap-2"><Bus className="h-4 w-4" /> พนักงาน & สายรถ *</Label>
              <div className="flex items-center gap-2">
                <Select value={bulkRouteId} onValueChange={setBulkRouteId}>
                  <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="เลือกแล้ว Apply ทั้งหมด" /></SelectTrigger>
                  <SelectContent>
                    {busRoutes.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={applyBulk} disabled={!bulkRouteId}>Apply</Button>
              </div>
            </div>

            <div className="border rounded-lg divide-y">
              {rows.map((r) => {
                const missing = !r.busRouteId;
                const isNew = !r.otEmployeeId;
                const setField = (key: "workDescription" | "note", v: string) => {
                  setRows((prev) => prev.map((x) => x.rowKey === r.rowKey ? { ...x, [key]: v } : x));
                };
                return (
                  <div key={r.rowKey} className={`${missing ? "bg-warning/5" : isNew ? "bg-success/5" : ""}`}>
                    <div className="flex items-center gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate flex items-center gap-2">
                          {r.employeeName}
                          {isNew && <Badge variant="success" className="text-[10px]">ใหม่</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{r.employeeCode}</div>
                      </div>
                      <Select value={r.busRouteId} onValueChange={(v) => setRouteFor(r.rowKey, v)}>
                        <SelectTrigger className={`w-44 h-8 ${missing ? "border-warning" : ""}`}>
                          <SelectValue placeholder="เลือกสายรถ *" />
                        </SelectTrigger>
                        <SelectContent>
                          {busRoutes.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                        onClick={() => removeRow(r.rowKey)}
                        title="ลบพนักงาน"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 px-3 pb-2 -mt-1">
                      <Input
                        value={r.workDescription}
                        onChange={(e) => setField("workDescription", e.target.value)}
                        placeholder="ลักษณะงาน (ถ้าต่างจากใบหลัก)"
                        className="h-7 text-xs"
                      />
                      <Input
                        value={r.note}
                        onChange={(e) => setField("note", e.target.value)}
                        placeholder="หมายเหตุ"
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                );
              })}
              {rows.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  ⚠️ ยังไม่มีพนักงาน — เพิ่มอย่างน้อย 1 คน
                </div>
              )}
            </div>

            {/* Add employee picker */}
            <div className="flex items-center gap-2 pt-2">
              <Select value={addEmpId} onValueChange={setAddEmpId}>
                <SelectTrigger className="flex-1 h-9">
                  <SelectValue placeholder={addCandidates.length === 0 ? "ไม่มีพนักงานที่เพิ่มได้" : "+ เลือกพนักงานเพื่อเพิ่ม..."} />
                </SelectTrigger>
                <SelectContent>
                  {addCandidates.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} · {e.code} {e.dept && `· ${e.dept}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRow}
                disabled={!addEmpId}
              >
                <UserPlus className="h-4 w-4" /> เพิ่ม
              </Button>
            </div>

            {routeSummary.size > 0 && (
              <div className="space-y-0.5 pt-1 text-xs">
                <div className="text-muted-foreground font-medium">สรุปสายรถ:</div>
                {[...routeSummary.entries()].map(([routeId, count]) => {
                  const route = busRoutes.find((b) => b.id === routeId);
                  return (
                    <div key={routeId} className="flex items-center justify-between">
                      <span>🚌 {route?.name ?? "?"}</span>
                      <Badge variant="info" className="text-[10px]">{count} คน</Badge>
                    </div>
                  );
                })}
                {missingCount > 0 && (
                  <div className="flex items-center justify-between text-warning">
                    <span>⚠️ ยังไม่ได้เลือก</span>
                    <Badge variant="warning" className="text-[10px]">{missingCount} คน</Badge>
                  </div>
                )}
              </div>
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

