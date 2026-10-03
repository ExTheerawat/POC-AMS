"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Search, ChevronUp, ChevronDown, Columns3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { Input } from "./input";
import { Button } from "./button";
import { Pagination } from "./pagination";
import { Checkbox } from "./checkbox";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "./dropdown-menu";

/**
 * Generic, opinionated <DataTable> for the AMS app.
 *
 * Built on top of the existing <Table> primitive (which already provides
 * zebra striping, hover, and consistent row height).
 *
 * Features:
 *  - 🔍 Built-in search box (filters across `searchKeys` or all columns)
 *  - ↕️ Sort by column (click header — asc → desc → none)
 *  - 📄 Pagination footer (default 10, options 10/25/50/100)
 *  - 👁️ Column visibility toggle ("คอลัมน์" dropdown)
 *  - ♿ a11y: aria-labels on interactive elements
 *  - 🎛 Custom toolbar slot (extra filters / actions on the right)
 *
 * @example
 * <DataTable
 *   data={items}
 *   getRowId={(r) => r.id}
 *   searchKeys={["code", "name", "email"]}
 *   columns={[
 *     { key: "code", header: "รหัส", sortable: true },
 *     { key: "name", header: "ชื่อ", sortable: true },
 *     { key: "actions", header: "", align: "right", hideable: false,
 *       cell: (r) => <Button onClick={() => edit(r)}>แก้ไข</Button> },
 *   ]}
 * />
 */

export type Column<T> = {
  /** Unique stable id (also used as object-property key when no `accessor` given). */
  key: string;
  /** Header content (text or JSX). */
  header: React.ReactNode;
  /** Custom cell renderer. Receives the row + its zero-based index in the filtered list. */
  cell?: (row: T, index: number) => React.ReactNode;
  /** How to extract a comparable value for sort/search/default rendering. Defaults to `row[key]`. */
  accessor?: (row: T) => unknown;
  /** Show ↕/↑/↓ arrow and enable click-to-sort. Default: false. */
  sortable?: boolean;
  /** Horizontal alignment. Default: "left". */
  align?: "left" | "center" | "right";
  /** Additional className for the body <td>. */
  className?: string;
  /** Additional className for the header <th>. */
  headerClassName?: string;
  /** Explicit column width (e.g. "120px", "8rem", 200). */
  width?: string | number;
  /** Allow user to toggle visibility in the "คอลัมน์" dropdown. Default: true. */
  hideable?: boolean;
  /** Initially hidden (user can re-enable via dropdown). Default: false. */
  defaultHidden?: boolean;
};

type SearchKey<T> = keyof T | ((row: T) => string | number | null | undefined);

export type DataTableProps<T> = {
  data: T[];
  columns: Column<T>[];
  /** Stable React `key` source for each row. */
  getRowId: (row: T) => string;
  /** Fields searched by the search box. Default: all column accessors. */
  searchKeys?: SearchKey<T>[];
  searchPlaceholder?: string;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  emptyText?: React.ReactNode;
  /** Optional custom controls inserted between search and column-toggle button. */
  toolbar?: React.ReactNode;
  defaultSort?: { key: string; direction: "asc" | "desc" };
  /** Hide the column-visibility toggle button. Default: false. */
  hideColumnToggle?: boolean;
  className?: string;
};

export function DataTable<T>({
  data,
  columns,
  getRowId,
  searchKeys,
  searchPlaceholder = "ค้นหา...",
  defaultPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  emptyText = "ไม่พบข้อมูล",
  toolbar,
  defaultSort,
  hideColumnToggle,
  className,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(
    defaultSort ?? null,
  );
  const [hidden, setHidden] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const c of columns) if (c.defaultHidden) s.add(c.key);
    return s;
  });

  // Auto-reset page on filter/page-size change
  useEffect(() => { setPage(1); }, [search, pageSize, sort]);

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hidden.has(c.key)),
    [columns, hidden],
  );

  // ── filter (search) ─────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    // If user didn't pass searchKeys, generate from columns (accessor or row[key])
    const keys: SearchKey<T>[] =
      searchKeys ??
      columns.map((c) => {
        const accessor = c.accessor ?? ((r: T) => (r as any)[c.key]);
        return (row: T) => {
          const v = accessor(row);
          return v == null ? "" : String(v);
        };
      });
    return data.filter((row) => {
      const hay = keys
        .map((k) => {
          const v = typeof k === "function" ? k(row) : (row as any)[k];
          return v == null ? "" : String(v);
        })
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, search, searchKeys, columns]);

  // ── sort ────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const accessor = col.accessor ?? ((r: T) => (r as any)[col.key]);
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);
      if (va == null && vb == null) return 0;
      if (va == null) return sort.direction === "asc" ? -1 : 1;
      if (vb == null) return sort.direction === "asc" ? 1 : -1;
      if (typeof va === "number" && typeof vb === "number") {
        return sort.direction === "asc" ? va - vb : vb - va;
      }
      const cmp = String(va).localeCompare(String(vb), "th", { numeric: true });
      return sort.direction === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort, columns]);

  const paginated = useMemo(
    () => sorted.slice((page - 1) * pageSize, page * pageSize),
    [sorted, page, pageSize],
  );

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null; // 3rd click clears
    });
  };

  const toggleHidden = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="ค้นหา"
          />
        </div>
        {toolbar}
        {!hideColumnToggle && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="แสดง/ซ่อนคอลัมน์" className="shrink-0">
                <Columns3 className="h-4 w-4" /> คอลัมน์
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>แสดงคอลัมน์</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns
                .filter((c) => c.hideable !== false)
                .map((c) => (
                  <DropdownMenuItem
                    key={c.key}
                    onSelect={(e) => { e.preventDefault(); toggleHidden(c.key); }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={!hidden.has(c.key)}
                      onCheckedChange={() => toggleHidden(c.key)}
                    />
                    <span className="flex-1">
                      {typeof c.header === "string" ? c.header : c.key}
                    </span>
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((c) => {
                const alignClass =
                  c.align === "right" ? "text-right"
                  : c.align === "left" ? "text-left"
                  : "text-center";
                return (
                  <TableHead
                    key={c.key}
                    className={cn(alignClass, c.headerClassName)}
                    style={c.width ? { width: typeof c.width === "number" ? `${c.width}px` : c.width } : undefined}
                  >
                    {c.sortable ? (
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1 hover:text-foreground transition-colors uppercase tracking-wider text-xs font-bold",
                          sort?.key === c.key ? "text-foreground" : "text-muted-foreground",
                        )}
                        onClick={() => toggleSort(c.key)}
                        aria-label={`เรียงตาม ${typeof c.header === "string" ? c.header : c.key}`}
                        aria-sort={
                          sort?.key === c.key
                            ? sort.direction === "asc" ? "ascending" : "descending"
                            : "none"
                        }
                      >
                        <span>{c.header}</span>
                        {sort?.key === c.key ? (
                          sort.direction === "asc"
                            ? <ChevronUp className="h-3 w-3" />
                            : <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronUp className="h-3 w-3 opacity-25" />
                        )}
                      </button>
                    ) : c.header}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground py-10">
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : paginated.map((row, i) => {
              const id = getRowId(row);
              const globalIndex = (page - 1) * pageSize + i;
              return (
                <TableRow key={id}>
                  {visibleColumns.map((c) => {
                    const accessor = c.accessor ?? ((r: T) => (r as any)[c.key]);
                    const content = c.cell ? c.cell(row, globalIndex) : (accessor(row) as React.ReactNode);
                    // Default body cell align matches header default (center) so number
                    // columns like "ลำดับ" line up under their centered headers.
                    // Columns that need left/right must set `align` explicitly.
                    const alignClass =
                      c.align === "right" ? "text-right"
                      : c.align === "left" ? "text-left"
                      : "text-center";
                    return (
                      <TableCell key={c.key} className={cn(alignClass, c.className)}>
                        {content}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Pagination
          page={page}
          pageSize={pageSize}
          total={sorted.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={pageSizeOptions}
        />
      </div>
    </div>
  );
}
