"use client";

import { useMemo } from "react";
import { CalendarOff } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";

type Item = { id: string; date: string; weekday: string; name: string };

export function HolidaysClient({ items }: { items: Item[] }) {
  const columns: Column<Item>[] = useMemo(() => [
    {
      key: "seq",
      header: "ลำดับ",
      width: 60,
      hideable: false,
      cell: (_h, idx) => <span className="text-muted-foreground tabular-nums">{idx + 1}</span>,
    },
    {
      key: "date",
      header: "วันที่",
      sortable: true,
      accessor: (h) => h.date,
      cell: (h) => formatDate(h.date),
    },
    { key: "weekday", header: "วัน", sortable: true, accessor: (h) => h.weekday },
    { key: "name", header: "ชื่อ", sortable: true, accessor: (h) => h.name, align: "left" },
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center"><CalendarOff className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-bold">วันหยุด</h1>
          <p className="text-muted-foreground">วันหยุดราชการ/นักขัตฤกษ์ ({items.length} วัน)</p>
        </div>
      </div>
      <DataTable<Item>
        data={items}
        getRowId={(h) => h.id}
        columns={columns}
        searchKeys={["name", "weekday"]}
        searchPlaceholder="ค้นหา ชื่อวันหยุด / วัน..."
        defaultSort={{ key: "date", direction: "asc" }}
        emptyText="ยังไม่มีข้อมูลวันหยุด"
      />
    </div>
  );
}
