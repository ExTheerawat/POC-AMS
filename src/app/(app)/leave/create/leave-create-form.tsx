"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, FilePlus, Paperclip, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { BEDatePicker } from "@/components/ui/be-date-picker";
import { createLeave } from "@/server/actions/leave";
import { formatDate } from "@/lib/utils";

type Props = {
  employees: { id: string; code: string; name: string; department: string; side: string }[];
  leaveTypes: { id: string; name: string; code: string }[];
  cutoffPassed: boolean;
  cutoffTime: string;
};

type HalfType = "FULL" | "MORNING" | "AFTERNOON";
type DateEntry = { date: string; half: HalfType };

const HALF_OPTIONS: { value: HalfType; label: string; color: "primary" | "amber" | "indigo" }[] = [
  { value: "FULL",      label: "เต็มวัน",  color: "primary" },
  { value: "MORNING",   label: "ครึ่งเช้า", color: "amber" },
  { value: "AFTERNOON", label: "ครึ่งบ่าย", color: "indigo" },
];

export function LeaveCreateForm({ employees, leaveTypes, cutoffPassed, cutoffTime }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [employeeId, setEmployeeId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [hasAttachment, setHasAttachment] = useState(false);

  // Picked dates — each with full/morning/afternoon flag
  const [entries, setEntries] = useState<DateEntry[]>([]);
  const [pickerDate, setPickerDate] = useState("");

  const addEntry = (d: string) => {
    if (!d) return;
    if (entries.some((e) => e.date === d)) {
      toast.info("เลือกวันนี้ไปแล้ว");
      return;
    }
    setEntries((prev) => [...prev, { date: d, half: "FULL" as HalfType }].sort((a, b) => a.date.localeCompare(b.date)));
    setPickerDate("");
  };

  const removeEntry = (d: string) => {
    setEntries((prev) => prev.filter((e) => e.date !== d));
  };

  const setEntryHalf = (d: string, half: HalfType) => {
    setEntries((prev) => prev.map((e) => e.date === d ? { ...e, half } : e));
  };

  const totalDays = useMemo(
    () => entries.reduce((s, e) => s + (e.half === "FULL" ? 1 : 0.5), 0),
    [entries],
  );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (entries.length === 0) { toast.error("กรุณาเลือกวันลาอย่างน้อย 1 วัน"); return; }

    const fd = new FormData(e.currentTarget);
    fd.set("employeeId", employeeId);
    fd.set("leaveTypeId", leaveTypeId);
    fd.set("hasAttachment", String(hasAttachment));

    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    fd.set("startDate", sorted[0].date);
    fd.set("endDate", sorted[sorted.length - 1].date);
    fd.set("selectedDates", JSON.stringify(
      sorted.map((e) => ({ date: e.date, half: e.half === "FULL" ? null : e.half }))
    ));
    fd.set("halfDayType", "");

    startTransition(async () => {
      const res = await createLeave(fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(`สร้างใบลาสำเร็จ — ${res.requestNo}`);
        router.push("/leave/list");
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center">
          <FilePlus className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">สร้างใบลา</h1>
          <p className="text-sm text-muted-foreground">หัวหน้าสร้างใบลาแทนพนักงาน</p>
        </div>
      </div>

      {cutoffPassed && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-warning/30 bg-warning/10 text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <div><b>เกินเวลา Cut-off ({cutoffTime})</b> — การสร้างใบลาถูกระงับ</div>
            <div className="opacity-90">📞 กรุณาติดต่อ HR เพื่อสร้างใบลาให้</div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลการลา</CardTitle>
          <CardDescription>กรอกข้อมูลให้ครบถ้วน</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>พนักงาน *</Label>
                <Select value={employeeId} onValueChange={setEmployeeId} required>
                  <SelectTrigger><SelectValue placeholder="เลือกพนักงาน" /></SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">ไม่มีพนักงานในความรับผิดชอบ</div>
                    ) : employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.code} — {e.name} ({e.department})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>ประเภทการลา *</Label>
                <Select value={leaveTypeId} onValueChange={setLeaveTypeId} required>
                  <SelectTrigger><SelectValue placeholder="เลือกประเภท" /></SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.code}-{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pick dates — per-day with half-day toggle */}
            <div className="space-y-2">
              <Label>เลือกวันลา *</Label>
              <BEDatePicker
                value={pickerDate}
                onChange={(d) => {
                  setPickerDate(d);
                  if (d) addEntry(d);
                }}
                placeholder="คลิกเพื่อเลือกวัน — จะถูกเพิ่มลงรายการอัตโนมัติ"
              />

              {entries.length === 0 ? (
                <div className="text-sm text-muted-foreground border rounded-lg p-4 text-center bg-muted/30">
                  💡 ยังไม่ได้เลือกวันลา — คลิกที่ช่องด้านบนเพื่อเลือกวัน <br />
                  <span className="text-xs">ลาต่อเนื่องก็แค่คลิกหลายๆ วัน — แต่ละวันเลือกได้ว่าจะลาเต็มวันหรือครึ่งวัน</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      เลือกแล้ว {entries.length} รายการ ({totalDays} วัน)
                    </span>
                    <button
                      type="button"
                      onClick={() => setEntries([])}
                      className="text-xs text-destructive hover:underline"
                    >
                      ล้างทั้งหมด
                    </button>
                  </div>
                  <div className="border rounded-lg divide-y">
                    {entries.map((entry) => (
                      <div key={entry.date} className="flex items-center gap-2 p-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">📅 {formatDate(entry.date)}</div>
                        </div>
                        <div className="flex gap-1">
                          {HALF_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setEntryHalf(entry.date, opt.value)}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                entry.half === opt.value
                                  ? opt.color === "amber"   ? "bg-amber-500 text-white"
                                  : opt.color === "indigo"  ? "bg-indigo-500 text-white"
                                  : "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground hover:bg-muted-foreground/10"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeEntry(entry.date)}
                          className="text-destructive hover:bg-destructive/10 rounded-md p-1 ml-1"
                          title="เอาออก"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    💡 คลิก <b>เต็มวัน</b> / <b>ครึ่งเช้า</b> / <b>ครึ่งบ่าย</b> เพื่อเปลี่ยนสำหรับแต่ละวัน
                  </p>
                </div>
              )}
            </div>

            {totalDays > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                <span className="text-sm text-muted-foreground">รวมวันลา</span>
                <Badge variant="info" className="text-base font-bold">{totalDays} วัน</Badge>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="reason">เหตุผลการลา</Label>
              <Textarea id="reason" name="reason" rows={3} placeholder="ระบุเหตุผล (ถ้ามี)" />
            </div>

            <div className="space-y-3 p-4 rounded-lg border bg-accent/30">
              <div className="flex items-center gap-2">
                <Checkbox id="hasAttachment" checked={hasAttachment} onCheckedChange={(v) => setHasAttachment(!!v)} />
                <Label htmlFor="hasAttachment" className="flex items-center gap-2 cursor-pointer">
                  <Paperclip className="h-4 w-4" /> มีเอกสารแนบประกอบการลา
                </Label>
              </div>
              {hasAttachment && (
                <Textarea name="attachmentNote" rows={2} placeholder="หมายเหตุเอกสารแนบ (เช่น ใบรับรองแพทย์, ใบส่งตัว)" />
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>ยกเลิก</Button>
              <Button type="submit" disabled={pending || cutoffPassed}>
                <CalendarDays className="h-4 w-4" />
                {pending ? "กำลังบันทึก..." : "บันทึกและส่งอนุมัติ"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
