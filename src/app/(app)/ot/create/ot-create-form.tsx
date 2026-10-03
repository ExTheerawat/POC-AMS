"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Clock, AlertTriangle, Users, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { createOT } from "@/server/actions/ot";
import { calculateOTHours } from "@/lib/utils";

type Props = {
  employees: { id: string; code: string; name: string; dept: string; defaultBusRouteId: string | null; isOwn: boolean }[];
  busRoutes: { id: string; name: string; route: string }[];
  cutoffPassed: boolean;
  cutoffTime: string;
  crossDeptAllowed: boolean;
};

type Shift = "DAY" | "NIGHT";
type TimeSlot = { start: string; end: string; label?: string };

const SHIFT_SLOTS: Record<Shift, TimeSlot[]> = {
  DAY: [
    { start: "07:30", end: "16:10" },
    { start: "07:30", end: "19:30" },
    { start: "17:00", end: "19:30" },
  ],
  NIGHT: [
    { start: "19:30", end: "04:10" },
    { start: "19:30", end: "07:30" },
    { start: "05:00", end: "07:30" },
  ],
};

export function OTCreateForm({ employees, busRoutes, cutoffPassed, cutoffTime, crossDeptAllowed }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Selection state: employeeId → busRouteId (or "" if not chosen yet)
  const [selected, setSelected] = useState<Map<string, string>>(new Map());

  // Per-employee fields (employeeId → text)
  const [empWorkDesc, setEmpWorkDesc] = useState<Map<string, string>>(new Map());
  const [empNote, setEmpNote] = useState<Map<string, string>>(new Map());

  const [otDate, setOtDate] = useState("");
  const [shift, setShift] = useState<Shift>("DAY");
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("19:30");
  const [search, setSearch] = useState("");

  const pickSlot = (s: TimeSlot) => {
    setStartTime(s.start);
    setEndTime(s.end);
  };
  const isSelectedSlot = (s: TimeSlot) => s.start === startTime && s.end === endTime;

  const hours = useMemo(() => calculateOTHours(startTime, endTime), [startTime, endTime]);
  const isHoliday = useMemo(() => {
    if (!otDate) return false;
    const d = new Date(otDate).getDay();
    return d === 0 || d === 6;
  }, [otDate]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q));
  }, [search, employees]);

  // For cross-dept allowed roles → split filtered list into "ลูกน้องของฉัน" and "แผนกอื่น"
  const groupedFiltered = useMemo(() => {
    if (!crossDeptAllowed) return { own: filtered, other: [] as typeof filtered };
    return {
      own: filtered.filter((e) => e.isOwn),
      other: filtered.filter((e) => !e.isOwn),
    };
  }, [filtered, crossDeptAllowed]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else {
        // Pre-fill: employee's defaultBusRouteId → blank (เลือกเองทีหลังได้)
        const emp = employees.find((e) => e.id === id);
        next.set(id, emp?.defaultBusRouteId ?? "");
      }
      return next;
    });
  };

  const setRouteFor = (id: string, routeId: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.set(id, routeId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const allSelected = filtered.length > 0 && filtered.every((e) => prev.has(e.id));
      if (allSelected) {
        // Deselect all visible
        const next = new Map(prev);
        for (const e of filtered) next.delete(e.id);
        return next;
      }
      // Select all visible (pre-fill route จาก default ของแต่ละคน)
      const next = new Map(prev);
      for (const e of filtered) {
        if (!next.has(e.id)) next.set(e.id, e.defaultBusRouteId ?? "");
      }
      return next;
    });
  };

  // Group summary — how many people per route
  const routeSummary = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of selected.values()) {
      if (r) m.set(r, (m.get(r) ?? 0) + 1);
    }
    return m;
  }, [selected]);

  const missingRouteCount = useMemo(
    () => Array.from(selected.values()).filter((v) => !v).length,
    [selected],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.size === 0) { toast.error("กรุณาเลือกพนักงานอย่างน้อย 1 คน"); return; }
    if (!otDate) { toast.error("กรุณาเลือกวันที่"); return; }
    if (missingRouteCount > 0) {
      toast.error(`ยังมีพนักงาน ${missingRouteCount} คนที่ยังไม่ได้เลือกสายรถ`);
      return;
    }
    const empArr = Array.from(selected.entries()).map(([id, busRouteId]) => ({
      id,
      busRouteId,
      workDescription: empWorkDesc.get(id) || undefined,
      note: empNote.get(id) || undefined,
    }));
    startTransition(async () => {
      const res = await createOT({
        otDate, startTime, endTime, shift,
        workDescription: "",
        busRouteId: undefined,
        employees: empArr,
      });
      if (res?.error) toast.error(res.error);
      else { toast.success(`สร้าง OT สำเร็จ — ${res.requestNo}`); router.push("/ot/list"); }
    });
  };

  return (
    <div className="max-w-6xl mx-auto w-full flex flex-col gap-4 h-[calc(100vh-7rem)]">
      <div className="flex items-start gap-4 shrink-0">
        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center"><Clock className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">สร้าง OT</h1>
          <p className="text-muted-foreground">เลือกพนักงาน + กำหนดสายรถกลับบ้านให้แต่ละคน</p>
        </div>
      </div>

      {cutoffPassed && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-warning/30 bg-warning/10 text-warning shrink-0">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <div><b>เกินเวลา Cut-off ({cutoffTime})</b> — ปุ่มสร้าง OT ถูกระงับ</div>
            <div className="opacity-90">📞 กรุณาติดต่อ HR เพื่อสร้าง OT ให้</div>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col flex-1 min-h-0 gap-4">
       <div className="grid lg:grid-cols-[400px_1fr] gap-4 flex-1 min-h-0">
        <Card className="flex flex-col min-h-0 overflow-hidden">
          <CardHeader className="shrink-0 py-3">
            <CardTitle className="text-base">ข้อมูล OT</CardTitle>
            <CardDescription>กรอกช่วงเวลาและรายละเอียด</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 overflow-y-auto flex-1">
            <div className="space-y-1.5">
              <Label htmlFor="otDate">วันที่ทำ OT *</Label>
              <BEDatePicker id="otDate" value={otDate} onChange={setOtDate} required />
              {otDate && (
                <div className="flex gap-2 mt-2">
                  {isHoliday ? (
                    <Badge variant="warning">วันหยุด (เสาร์-อาทิตย์) — มาตรฐาน 8+3 = 11 ชม.</Badge>
                  ) : (
                    <Badge variant="info">วันทำงาน — มาตรฐาน 2.5 ชม.</Badge>
                  )}
                </div>
              )}
            </div>

            {/* Shift selector — Day / Night */}
            <div className="space-y-2">
              <Label>กะ *</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShift("DAY")}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm transition-colors ${
                    shift === "DAY"
                      ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : "border-muted hover:border-muted-foreground/30"
                  }`}
                >
                  <Sun className="h-4 w-4" />
                  <span className="font-medium">Day (กะกลางวัน)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShift("NIGHT")}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm transition-colors ${
                    shift === "NIGHT"
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                      : "border-muted hover:border-muted-foreground/30"
                  }`}
                >
                  <Moon className="h-4 w-4" />
                  <span className="font-medium">Night (กะกลางคืน)</span>
                </button>
              </div>
            </div>

            {/* Time slot quick-picks for the selected shift */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">เลือกช่วงเวลามาตรฐาน (หรือกำหนดเองด้านล่าง)</Label>
              <div className="space-y-1.5">
                {SHIFT_SLOTS[shift].map((s) => {
                  const slotHours = calculateOTHours(s.start, s.end);
                  const selected = isSelectedSlot(s);
                  return (
                    <button
                      key={`${s.start}-${s.end}`}
                      type="button"
                      onClick={() => pickSlot(s)}
                      className={`w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        selected
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-muted hover:border-muted-foreground/30"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">{selected ? "●" : "○"}</span>
                        <span className="tabular-nums">ช่วงเวลา {s.start} - {s.end} น.</span>
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">{slotHours.toFixed(2)} ชม.</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>เวลาเริ่ม *</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>เวลาสิ้นสุด *</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="text-sm text-muted-foreground">ชั่วโมง OT ที่คำนวณได้</div>
              <div className="text-2xl font-bold text-primary tabular-nums">{hours.toFixed(2)} ชั่วโมง</div>
            </div>

            {/* Route summary */}
            {routeSummary.size > 0 && (
              <div className="space-y-1 pt-2 border-t">
                <div className="text-xs font-medium text-muted-foreground">สรุปสายรถ:</div>
                {[...routeSummary.entries()].map(([routeId, count]) => {
                  const route = busRoutes.find((b) => b.id === routeId);
                  return (
                    <div key={routeId} className="flex items-center justify-between text-sm">
                      <span>🚌 {route?.name ?? "?"}</span>
                      <Badge variant="info">{count} คน</Badge>
                    </div>
                  );
                })}
                {missingRouteCount > 0 && (
                  <div className="flex items-center justify-between text-sm text-warning">
                    <span>⚠️ ยังไม่ได้เลือกสายรถ</span>
                    <Badge variant="warning">{missingRouteCount} คน</Badge>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col min-h-0 overflow-hidden">
          <CardHeader className="shrink-0 py-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><Users className="h-5 w-5" /> เลือกพนักงาน + สายรถ</CardTitle>
                <CardDescription>เลือกแล้ว {selected.size} จาก {employees.length} คน</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={toggleAll}>
                {filtered.length > 0 && filtered.every((e) => selected.has(e.id)) ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 flex flex-col">
            <Input placeholder="ค้นหาพนักงาน..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3 shrink-0" />
            <div className="border rounded-lg overflow-y-auto flex-1 min-h-0">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">ไม่พบพนักงาน</div>
              ) : (() => {
                const renderEmp = (emp: typeof filtered[number]) => {
                const isSelected = selected.has(emp.id);
                const routeId = selected.get(emp.id) ?? "";
                const isMissing = isSelected && !routeId;
                const wd = empWorkDesc.get(emp.id) ?? "";
                const nt = empNote.get(emp.id) ?? "";
                return (
                  <div
                    key={emp.id}
                    className={`border-b last:border-0 hover:bg-accent/30 ${isMissing ? "bg-warning/5" : ""}`}
                  >
                    <div className="flex items-center gap-3 px-3 py-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggle(emp.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate flex items-center gap-2">
                          {emp.name}
                          {!emp.isOwn && <Badge variant="warning" className="text-[10px]">แผนกอื่น</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{emp.code} • {emp.dept}</div>
                      </div>
                      {isSelected ? (
                        <Select value={routeId} onValueChange={(v) => setRouteFor(emp.id, v)}>
                          <SelectTrigger className={`w-48 h-8 ${isMissing ? "border-warning" : ""}`}>
                            <SelectValue placeholder="เลือกสายรถ *" />
                          </SelectTrigger>
                          <SelectContent>
                            {busRoutes.map((b) => (
                              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="w-48" />
                      )}
                    </div>
                    {isSelected && (
                      <div className="grid grid-cols-2 gap-2 px-3 pb-2 -mt-1">
                        <Input
                          value={wd}
                          onChange={(e) => setEmpWorkDesc((prev) => new Map(prev).set(emp.id, e.target.value))}
                          placeholder="ลักษณะงาน"
                          className="h-8 text-xs"
                        />
                        <Input
                          value={nt}
                          onChange={(e) => setEmpNote((prev) => new Map(prev).set(emp.id, e.target.value))}
                          placeholder="หมายเหตุ (เช่น อยู่ต่อถึง 22:00)"
                          className="h-8 text-xs"
                        />
                      </div>
                    )}
                  </div>
                );
                };
                if (!crossDeptAllowed) {
                  return <>{filtered.map(renderEmp)}</>;
                }
                return (
                  <>
                    {groupedFiltered.own.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-muted/50 text-xs font-semibold text-muted-foreground sticky top-0">
                          ลูกน้องของฉัน ({groupedFiltered.own.length})
                        </div>
                        {groupedFiltered.own.map(renderEmp)}
                      </>
                    )}
                    {groupedFiltered.other.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-amber-500/10 text-xs font-semibold text-amber-700 dark:text-amber-400">
                          🔄 แผนกอื่น (ผจก.แผนกจะได้ email reference) — {groupedFiltered.other.length} คน
                        </div>
                        {groupedFiltered.other.map(renderEmp)}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>

       </div>

        <div className="flex justify-end gap-3 shrink-0 pt-3 border-t">
          <Button type="button" variant="outline" onClick={() => router.back()}>ยกเลิก</Button>
          <Button type="submit" disabled={pending || cutoffPassed}>
            {pending ? "กำลังบันทึก..." : "บันทึกและส่งอนุมัติ"}
          </Button>
        </div>
      </form>
    </div>
  );
}
