"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, FileBarChart, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { formatDate, toBEYear } from "@/lib/utils";

const MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

const STATUS_LABEL: Record<string, string> = {
  APPROVED: "อนุมัติแล้ว", COMPLETED: "เสร็จสิ้น", MODIFIED_BY_HR: "HR แก้ไข",
};
const STATUS_VARIANT: Record<string, any> = {
  APPROVED: "success", COMPLETED: "success", MODIFIED_BY_HR: "info",
};

type Row = {
  id: string;
  requestNo: string;
  otDate: string;
  isHoliday: boolean;
  startTime: string;
  endTime: string;
  shift: "DAY" | "NIGHT";
  hours: number;
  side: "OFFICE" | "PRODUCTION";
  employeeCode: string;
  employeeName: string;
  department: string;
  busRoute: string;
  status: string;
  workDescription: string;
  note: string;
};

export function OTSummaryClient({ month, year, rows }: { month: number; year: number; rows: Row[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sideFilter, setSideFilter] = useState<"ALL" | "OFFICE" | "PRODUCTION">("ALL");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");
  const [shiftFilter, setShiftFilter] = useState<"ALL" | "DAY" | "NIGHT">("ALL");

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.department && r.department !== "-") set.add(r.department);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
  }, [rows]);

  const filteredRows = useMemo(() => rows.filter((r) => {
    if (sideFilter !== "ALL" && r.side !== sideFilter) return false;
    if (deptFilter !== "ALL" && r.department !== deptFilter) return false;
    if (shiftFilter !== "ALL" && r.shift !== shiftFilter) return false;
    return true;
  }), [rows, sideFilter, deptFilter, shiftFilter]);

  // ── Bus route summary: per route, count rows, distinct employees, distinct days ──
  const busRouteSummary = useMemo(() => {
    const map = new Map<string, { count: number; emps: Set<string>; days: Set<string> }>();
    for (const r of filteredRows) {
      const key = r.busRoute || "-";
      const entry = map.get(key) ?? { count: 0, emps: new Set<string>(), days: new Set<string>() };
      entry.count += 1;
      entry.emps.add(r.employeeCode);
      entry.days.add(r.otDate.slice(0, 10));
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, count: v.count, emps: v.emps.size, days: v.days.size }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRows]);

  const setQuery = (key: string, value: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set(key, value);
    router.push(`?${sp.toString()}`);
  };

  const yearOptions = useMemo(() => {
    const cur = new Date().getFullYear();
    return [cur + 1, cur, cur - 1, cur - 2, cur - 3];
  }, []);

  const download = () => {
    const params = new URLSearchParams({ month: String(month), year: String(year) });
    if (sideFilter !== "ALL") params.set("side", sideFilter);
    if (deptFilter !== "ALL") params.set("department", deptFilter);
    if (shiftFilter !== "ALL") params.set("shift", shiftFilter);
    window.open(`/api/reports/ot-summary?${params.toString()}`, "_blank");
  };

  // Summary stats — คำนวณจาก filtered data
  const stats = useMemo(() => {
    const distinctOTs = new Set<string>();
    const distinctEmps = new Set<string>();
    let totalHours = 0;
    let officeHours = 0;
    let productionHours = 0;
    for (const r of filteredRows) {
      distinctOTs.add(r.requestNo);
      distinctEmps.add(r.employeeCode);
      totalHours += r.hours;
      if (r.side === "OFFICE") officeHours += r.hours;
      else productionHours += r.hours;
    }
    return {
      totalOTs: distinctOTs.size,
      totalEmps: distinctEmps.size,
      totalHours: Math.round(totalHours * 100) / 100,
      officeHours: Math.round(officeHours * 100) / 100,
      productionHours: Math.round(productionHours * 100) / 100,
    };
  }, [filteredRows]);

  const columns: Column<Row>[] = useMemo(() => [
    {
      key: "seq", header: "ลำดับ", width: 60, hideable: false,
      cell: (_r, idx) => <span className="text-muted-foreground tabular-nums">{idx + 1}</span>,
    },
    { key: "requestNo", header: "เลขที่", sortable: true, accessor: (r) => r.requestNo },
    {
      key: "otDate", header: "วันที่", sortable: true, accessor: (r) => r.otDate,
      cell: (r) => (
        <span>
          {formatDate(r.otDate)}
          {r.isHoliday && <Badge variant="warning" className="ml-1 text-[10px]">วันหยุด</Badge>}
        </span>
      ),
    },
    {
      key: "time", header: "เวลา", sortable: true, accessor: (r) => r.startTime,
      cell: (r) => `${r.startTime} - ${r.endTime}`,
    },
    {
      key: "shift", header: "กะ", sortable: true, accessor: (r) => r.shift,
      cell: (r) => <Badge variant={r.shift === "DAY" ? "warning" : "info"} className="text-[10px]">{r.shift === "DAY" ? "Day" : "Night"}</Badge>,
    },
    {
      key: "hours", header: "ชั่วโมง", sortable: true, accessor: (r) => r.hours,
      cell: (r) => <span className="tabular-nums font-medium">{r.hours.toFixed(2)}</span>,
    },
    {
      key: "side", header: "ฝ่าย", sortable: true, accessor: (r) => r.side,
      cell: (r) => <Badge variant="outline">{r.side === "OFFICE" ? "Office" : "ผลิต"}</Badge>,
    },
    { key: "employeeCode", header: "รหัส", sortable: true, accessor: (r) => r.employeeCode },
    { key: "employeeName", header: "ชื่อ-นามสกุล", sortable: true, accessor: (r) => r.employeeName, align: "left" },
    { key: "department", header: "แผนก", sortable: true, accessor: (r) => r.department, align: "left" },
    { key: "busRoute", header: "สายรถ", sortable: true, accessor: (r) => r.busRoute, align: "left" },
    {
      key: "status", header: "สถานะ", sortable: true, accessor: (r) => STATUS_LABEL[r.status] ?? r.status,
      cell: (r) => <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status] ?? r.status}</Badge>,
    },
    {
      key: "workDescription", header: "ลักษณะงาน", accessor: (r) => r.workDescription, align: "left",
      cell: (r) => <span className="text-muted-foreground">{r.workDescription || "-"}</span>,
      defaultHidden: true,
    },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <FileBarChart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">OT Summary (รายเดือน)</h1>
            <p className="text-muted-foreground">
              สรุป OT ที่อนุมัติแล้วและพนักงานมาทำจริง — <b>{MONTHS[month - 1]} {toBEYear(year)}</b>
              {filteredRows.length !== rows.length && (
                <> · {filteredRows.length} จาก {rows.length} รายการ</>
              )}
            </p>
          </div>
        </div>
        <Button onClick={download} disabled={filteredRows.length === 0}>
          <Download className="h-4 w-4" /> ดาวน์โหลด Excel{filteredRows.length !== rows.length ? ` (${filteredRows.length} แถว)` : ""}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <Label className="shrink-0 flex items-center gap-1.5"><Calendar className="h-4 w-4" /> เดือน</Label>
          <Select value={String(month)} onValueChange={(v) => setQuery("month", v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Label className="shrink-0">ปี</Label>
          <Select value={String(year)} onValueChange={(v) => setQuery("year", v)}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{toBEYear(y)}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="h-6 w-px bg-border mx-1" />
          <Label className="shrink-0">ฝ่าย</Label>
          <Select value={sideFilter} onValueChange={(v: any) => setSideFilter(v)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ทุกฝ่าย</SelectItem>
              <SelectItem value="OFFICE">Office</SelectItem>
              <SelectItem value="PRODUCTION">ผลิต</SelectItem>
            </SelectContent>
          </Select>
          <Label className="shrink-0">แผนก</Label>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ทุกแผนก</SelectItem>
              {departmentOptions.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Label className="shrink-0">กะ</Label>
          <Select value={shiftFilter} onValueChange={(v: any) => setShiftFilter(v)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ทุกกะ</SelectItem>
              <SelectItem value="DAY">☀ Day</SelectItem>
              <SelectItem value="NIGHT">🌙 Night</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Summary stats */}
      {filteredRows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">จำนวนใบ OT</div><div className="text-2xl font-bold">{stats.totalOTs}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">พนักงาน (ไม่ซ้ำ)</div><div className="text-2xl font-bold text-primary">{stats.totalEmps}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Person-Hours (Office)</div><div className="text-2xl font-bold">{stats.officeHours.toLocaleString()}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Person-Hours (ผลิต)</div><div className="text-2xl font-bold text-emerald-600">{stats.productionHours.toLocaleString()}</div></CardContent></Card>
          <Card><CardContent className="p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl"><div className="text-xs text-muted-foreground">รวมทั้งหมด</div><div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.totalHours.toLocaleString()}</div></CardContent></Card>
        </div>
      )}

      {/* Bus route summary */}
      {busRouteSummary.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="font-semibold mb-3 flex items-center gap-2">
              🚌 สรุปสายรถ ({busRouteSummary.length} สาย)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-semibold">สายรถ</th>
                    <th className="text-right py-2 px-3 font-semibold">คน-ครั้ง</th>
                    <th className="text-right py-2 px-3 font-semibold">คน (ไม่ซ้ำ)</th>
                    <th className="text-right py-2 px-3 font-semibold">จำนวนวัน</th>
                  </tr>
                </thead>
                <tbody>
                  {busRouteSummary.map((b) => (
                    <tr key={b.name} className="border-b hover:bg-muted/40">
                      <td className="py-1.5 px-3">{b.name}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums font-medium">{b.count}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums">{b.emps}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums">{b.days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <DataTable<Row>
        data={filteredRows}
        getRowId={(r) => r.id}
        columns={columns}
        searchKeys={["requestNo", "employeeCode", "employeeName", "department", "busRoute", "workDescription"]}
        searchPlaceholder="ค้นหา เลขที่ / รหัส / ชื่อ / แผนก / สายรถ..."
        defaultSort={{ key: "otDate", direction: "asc" }}
        emptyText={`ไม่มีข้อมูล OT สำหรับเดือน ${MONTHS[month - 1]} ${toBEYear(year)}`}
      />

      <p className="text-xs text-muted-foreground text-center italic">
        * รายงานนี้นับเฉพาะ OT ที่อนุมัติแล้วและพนักงานมาทำจริง (ไม่รวม OT ที่ยกเลิก/ไม่มา)
      </p>
    </div>
  );
}
