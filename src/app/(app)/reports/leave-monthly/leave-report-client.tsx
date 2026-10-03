"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, FileText, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { formatDate, toBEYear } from "@/lib/utils";

const MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "ฉบับร่าง", PENDING_DEPT_MGR: "รอ ผจก.แผนก", PENDING_FACTORY_MGR: "รอ ผจก.โรงงาน",
  APPROVED: "อนุมัติแล้ว", REJECTED: "ปฏิเสธ", CANCELLED: "ยกเลิก",
};
const STATUS_VARIANT: Record<string, any> = {
  APPROVED: "success", REJECTED: "destructive", CANCELLED: "secondary",
  PENDING_DEPT_MGR: "warning", PENDING_FACTORY_MGR: "warning", DRAFT: "secondary",
};

type Row = {
  id: string;
  requestNo: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  side: "OFFICE" | "PRODUCTION";
  leaveType: string;
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string;
  reason: string;
  creator: string;
};

export function LeaveReportClient({ month, year, rows }: { month: number; year: number; rows: Row[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Toolbar filters (client-side)
  const [sideFilter, setSideFilter] = useState<"ALL" | "OFFICE" | "PRODUCTION">("ALL");
  const [deptFilter, setDeptFilter] = useState<string>("ALL");

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.department && r.department !== "-") set.add(r.department);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
  }, [rows]);

  const filteredRows = useMemo(() => rows.filter((r) => {
    if (sideFilter !== "ALL" && r.side !== sideFilter) return false;
    if (deptFilter !== "ALL" && r.department !== deptFilter) return false;
    return true;
  }), [rows, sideFilter, deptFilter]);

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
    window.open(`/api/reports/leave-monthly?${params.toString()}`, "_blank");
  };

  // Summary stats — คำนวณจาก filtered data เพื่อให้ตรงกับตาราง
  const stats = useMemo(() => {
    const total = filteredRows.length;
    const approved = filteredRows.filter((r) => r.status === "APPROVED").length;
    const totalDays = filteredRows.reduce((s, r) => s + (r.status === "APPROVED" ? r.totalDays : 0), 0);
    const office = filteredRows.filter((r) => r.side === "OFFICE" && r.status === "APPROVED").length;
    const production = filteredRows.filter((r) => r.side === "PRODUCTION" && r.status === "APPROVED").length;
    return { total, approved, totalDays, office, production };
  }, [filteredRows]);

  const columns: Column<Row>[] = useMemo(() => [
    {
      key: "seq", header: "ลำดับ", width: 60, hideable: false,
      cell: (_r, idx) => <span className="text-muted-foreground tabular-nums">{idx + 1}</span>,
    },
    { key: "requestNo", header: "เลขที่", sortable: true, accessor: (r) => r.requestNo },
    { key: "employeeCode", header: "รหัส", sortable: true, accessor: (r) => r.employeeCode },
    { key: "employeeName", header: "ชื่อ-นามสกุล", sortable: true, accessor: (r) => r.employeeName, align: "left" },
    { key: "department", header: "แผนก", sortable: true, accessor: (r) => r.department, align: "left" },
    {
      key: "side", header: "ฝ่าย", sortable: true, accessor: (r) => r.side,
      cell: (r) => <Badge variant="outline">{r.side === "OFFICE" ? "Office" : "ผลิต"}</Badge>,
    },
    {
      key: "leaveTypeCode", header: "รหัส", sortable: true, accessor: (r) => r.leaveTypeCode,
      cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.leaveTypeCode}</span>,
    },
    { key: "leaveType", header: "ประเภท", sortable: true, accessor: (r) => r.leaveType, align: "left" },
    {
      key: "startDate", header: "วันเริ่ม", sortable: true, accessor: (r) => r.startDate,
      cell: (r) => formatDate(r.startDate),
    },
    {
      key: "endDate", header: "วันสิ้นสุด", sortable: true, accessor: (r) => r.endDate,
      cell: (r) => formatDate(r.endDate),
    },
    {
      key: "totalDays", header: "จำนวน", sortable: true, accessor: (r) => r.totalDays,
      cell: (r) => `${r.totalDays} วัน`,
    },
    {
      key: "status", header: "สถานะ", sortable: true, accessor: (r) => STATUS_LABEL[r.status] ?? r.status,
      cell: (r) => <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>,
    },
    {
      key: "reason", header: "เหตุผล", accessor: (r) => r.reason || "-", align: "left",
      cell: (r) => <span className="text-muted-foreground">{r.reason || "-"}</span>,
      defaultHidden: true,
    },
    { key: "creator", header: "ผู้สร้าง", accessor: (r) => r.creator, align: "left", defaultHidden: true },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Leave Report (รายเดือน)</h1>
            <p className="text-muted-foreground">
              ข้อมูลการลาประจำเดือน <b>{MONTHS[month - 1]} {toBEYear(year)}</b> —{" "}
              {filteredRows.length !== rows.length
                ? <>{filteredRows.length} จาก {rows.length} รายการ</>
                : <>{rows.length} รายการ</>}
            </p>
          </div>
        </div>
        <Button onClick={download} disabled={filteredRows.length === 0}>
          <Download className="h-4 w-4" /> ดาวน์โหลด Excel{filteredRows.length !== rows.length ? ` (${filteredRows.length} แถว)` : ""}
        </Button>
      </div>

      {/* Filters Card */}
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
        </CardContent>
      </Card>

      {/* Stats */}
      {filteredRows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">ใบลาทั้งหมด</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">อนุมัติแล้ว</div><div className="text-2xl font-bold text-success">{stats.approved}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">วันลาที่อนุมัติ</div><div className="text-2xl font-bold text-primary">{stats.totalDays}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Office (อนุมัติ)</div><div className="text-2xl font-bold">{stats.office}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">ผลิต (อนุมัติ)</div><div className="text-2xl font-bold text-emerald-600">{stats.production}</div></CardContent></Card>
        </div>
      )}

      <DataTable<Row>
        data={filteredRows}
        getRowId={(r) => r.id}
        columns={columns}
        searchKeys={["requestNo", "employeeCode", "employeeName", "department", "leaveType", "reason", "creator"]}
        searchPlaceholder="ค้นหา เลขที่ / รหัส / ชื่อ / แผนก / ประเภท / เหตุผล..."
        defaultSort={{ key: "startDate", direction: "asc" }}
        emptyText={`ไม่มีข้อมูลการลาในเดือน ${MONTHS[month - 1]} ${toBEYear(year)}`}
      />
    </div>
  );
}
