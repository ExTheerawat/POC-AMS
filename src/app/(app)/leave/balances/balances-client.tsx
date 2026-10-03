"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { toBEYear } from "@/lib/utils";

type Balance = {
  leaveTypeId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  entitled: number;        // base + carriedOver (total budget for this year)
  baseEntitled: number;    // this year's entitlement only
  carriedOver: number;     // days carried over from previous year
  used: number;
  remaining: number;
  maxDays: number | null;
  isPaid: boolean;
};

type Row = {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  side: "OFFICE" | "PRODUCTION";
  hireDate: string;
  daysOfService: number;
  yearsOfService: number;
  extraDays: number;
  balances: Balance[];
};

type LeaveTypeCol = { id: string; code: string; name: string };

export function LeaveBalancesClient({
  rows, leaveTypes, year,
}: {
  rows: Row[];
  leaveTypes: LeaveTypeCol[];
  year: number;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const yearOptions = useMemo(() => {
    const cur = new Date().getFullYear();
    return [cur + 1, cur, cur - 1, cur - 2, cur - 3];
  }, []);

  const setYear = (y: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("year", y);
    router.push(`?${sp.toString()}`);
  };

  // Build columns dynamically (fixed columns + one per leave type)
  const columns: Column<Row>[] = useMemo(() => {
    const fixed: Column<Row>[] = [
      {
        key: "seq",
        header: "ลำดับ",
        width: 48,
        hideable: false,
        cell: (_r, idx) => <span className="text-muted-foreground tabular-nums">{idx + 1}</span>,
      },
      {
        key: "name",
        header: "รหัส / ชื่อ",
        width: 170,
        accessor: (r) => r.name,
        sortable: true,
        align: "left",
        cell: (r) => (
          <div className="leading-tight">
            <div className="whitespace-nowrap">{r.name}</div>
            <div className="text-xs text-muted-foreground font-mono">{r.employeeCode}</div>
          </div>
        ),
      },
      {
        key: "department",
        header: "แผนก",
        width: 96,
        accessor: (r) => r.department,
        sortable: true,
        align: "left",
        cell: (r) => <span className="whitespace-nowrap">{r.department}</span>,
      },
      {
        key: "side",
        header: "ฝ่าย",
        width: 64,
        accessor: (r) => r.side,
        sortable: true,
        cell: (r) => <Badge variant="outline" className="text-[10px]">{r.side === "OFFICE" ? "Office" : "ผลิต"}</Badge>,
      },
      {
        key: "service",
        header: "อายุงาน",
        width: 100,
        accessor: (r) => r.daysOfService,
        sortable: true,
        align: "left",
        cell: (r) => (
          <span className="text-muted-foreground tabular-nums whitespace-nowrap text-xs">
            {r.yearsOfService} ปี {r.extraDays} วัน
          </span>
        ),
      },
    ];

    const dynamic: Column<Row>[] = leaveTypes.map((lt) => ({
      key: `lt-${lt.id}`,
      header: lt.name,
      width: 92,
      align: "center",
      // Sort by remaining (smaller remaining first when desc) - meaningful metric
      accessor: (r) => r.balances.find((b) => b.leaveTypeId === lt.id)?.remaining ?? null,
      sortable: true,
      cell: (r) => {
        const b = r.balances.find((x) => x.leaveTypeId === lt.id);
        if (!b) return <span className="text-muted-foreground">-</span>;
        return <BalanceCell
          entitled={b.entitled}
          baseEntitled={b.baseEntitled}
          carriedOver={b.carriedOver}
          used={b.used}
          remaining={b.remaining}
          maxDays={b.maxDays}
        />;
      },
    }));

    return [...fixed, ...dynamic];
  }, [leaveTypes]);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">สิทธิ์การลาของพนักงาน</h1>
          <p className="text-muted-foreground">
            สรุปสิทธิ์ / ใช้ไป / คงเหลือ — ปี <b>{toBEYear(year)}</b> ({rows.length} คน)
          </p>
        </div>
      </div>

      {/* Color legend */}
      <Card>
        <CardContent className="p-3 flex items-center justify-center gap-6 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-blue-500" /> สิทธิ์ที่ได้
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-rose-500" /> ใช้ไป
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-emerald-500" /> คงเหลือ
          </span>
          <span className="text-muted-foreground hidden sm:inline">|</span>
          <span className="text-xs text-muted-foreground">
            💡 ลาพักร้อนคำนวณจากอายุงาน (ดู /master/vacation-tiers)
          </span>
        </CardContent>
      </Card>

      <DataTable<Row>
        data={rows}
        getRowId={(r) => r.id}
        columns={columns}
        searchKeys={["employeeCode", "name", "department"]}
        searchPlaceholder="ค้นหา รหัส / ชื่อ / แผนก..."
        emptyText="ไม่พบพนักงานที่ตรงกับการค้นหา"
        defaultSort={{ key: "name", direction: "asc" }}
        toolbar={
          <div className="flex items-center gap-2">
            <Label className="shrink-0 flex items-center gap-1 text-sm">
              <Calendar className="h-3.5 w-3.5" /> ปี
            </Label>
            <Select value={String(year)} onValueChange={setYear}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{toBEYear(y)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
    </div>
  );
}

function BalanceCell({
  entitled, baseEntitled, carriedOver, used, remaining, maxDays,
}: {
  entitled: number;
  baseEntitled: number;
  carriedOver: number;
  used: number;
  remaining: number;
  maxDays: number | null;
}) {
  if (entitled === 0 && used === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const overUsed = used > entitled && entitled > 0;
  const carryNote = carriedOver > 0
    ? ` (สิทธิ์ปีนี้ ${baseEntitled} + โอนจากปีก่อน ${carriedOver})`
    : "";
  return (
    <div
      className="inline-flex flex-col items-center gap-0 tabular-nums text-sm whitespace-nowrap"
      title={`สิทธิ์รวม ${entitled} วัน${carryNote} · ใช้ไป ${used} วัน · คงเหลือ ${remaining} วัน${maxDays ? ` (เพดาน ${maxDays})` : ""}`}
    >
      <div className="inline-flex items-baseline gap-0.5">
        <span className="font-bold text-blue-600 dark:text-blue-400">{entitled}</span>
        <span className="text-muted-foreground text-[10px]">/</span>
        <span className={`font-bold ${overUsed ? "text-rose-700" : "text-rose-500"} dark:text-rose-400`}>{used}</span>
        <span className="text-muted-foreground text-[10px]">/</span>
        <span className="font-bold text-emerald-600 dark:text-emerald-400">{remaining}</span>
      </div>
      {carriedOver > 0 && (
        <span className="text-[10px] text-amber-600 dark:text-amber-400 leading-none">
          +{carriedOver} โอนปีก่อน
        </span>
      )}
    </div>
  );
}
