"use client";

import * as React from "react";
import { DayPicker, useNavigation, type CaptionProps } from "react-day-picker";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { cn, formatDate, toBEYear } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./dialog";
import { Button } from "./button";

/**
 * Buddhist-Era date picker — drop-in replacement for <input type="date">.
 *
 * Storage: ISO date string "yyyy-mm-dd" (Christian Era)
 * Display & calendar: Thai/Buddhist Era (e.g. "20 พ.ย. 2568")
 *
 * Material-style modal:
 *  - Header shows the currently-selected date prominently
 *  - Custom caption with clean month/year dropdowns + nav arrows
 *  - Circular day cells; today is outlined, selected is filled
 *  - Cancel/OK — change only commits on OK
 */

export type BEDatePickerProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  min?: string;
  max?: string;
};

const THAI_MONTHS = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
];

const THAI_MONTHS_SHORT = [
  "ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
  "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค.",
];

const toISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseISO = (s?: string): Date | undefined => {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};

/**
 * Custom calendar caption — clean dropdowns + nav arrows, no duplicate labels.
 */
function ThaiCaption({ displayMonth }: CaptionProps) {
  const { goToMonth, nextMonth, previousMonth } = useNavigation();

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    goToMonth(new Date(displayMonth.getFullYear(), Number(e.target.value), 1));
  };
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    goToMonth(new Date(Number(e.target.value), displayMonth.getMonth(), 1));
  };

  const currentYear = new Date().getFullYear();
  // Range: 1990 → currentYear + 5
  const years = React.useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear + 5; y >= 1990; y--) arr.push(y);
    return arr;
  }, [currentYear]);

  return (
    <div className="flex items-center justify-between gap-2 px-1 pb-2">
      <div className="flex gap-2 flex-1">
        <select
          value={displayMonth.getMonth()}
          onChange={handleMonthChange}
          aria-label="เดือน"
          className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm cursor-pointer hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {THAI_MONTHS.map((m, i) => (
            <option key={i} value={i}>{m}</option>
          ))}
        </select>
        <select
          value={displayMonth.getFullYear()}
          onChange={handleYearChange}
          aria-label="ปี"
          className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-sm cursor-pointer hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {years.map((y) => (
            <option key={y} value={y}>{toBEYear(y)}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          type="button"
          onClick={() => previousMonth && goToMonth(previousMonth)}
          disabled={!previousMonth}
          aria-label="เดือนก่อนหน้า"
          className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => nextMonth && goToMonth(nextMonth)}
          disabled={!nextMonth}
          aria-label="เดือนถัดไป"
          className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function BEDatePicker({
  value, onChange, placeholder = "เลือกวันที่", disabled, required,
  className, id, min, max,
}: BEDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const committed = React.useMemo(() => parseISO(value), [value]);

  // Working selection — only commits when OK is pressed
  const [draft, setDraft] = React.useState<Date | undefined>(committed);
  const [month, setMonth] = React.useState<Date>(committed ?? new Date());

  React.useEffect(() => {
    if (open) {
      setDraft(committed);
      if (committed) setMonth(committed);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOK = () => {
    if (draft) onChange?.(toISO(draft));
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
    setDraft(committed);
  };

  const displayText = committed ? formatDate(committed) : "";

  const headerText = draft
    ? `${draft.getDate()} ${THAI_MONTHS_SHORT[draft.getMonth()]} ${toBEYear(draft.getFullYear())}`
    : "เลือกวันที่";

  return (
    <>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-required={required}
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm cursor-pointer hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <span className={cn(!displayText && "text-muted-foreground")}>
          {displayText || placeholder}
        </span>
        <CalendarIcon className="h-4 w-4 opacity-50 shrink-0 ml-2" />
      </button>

      <Dialog open={open} onOpenChange={(v) => !v && handleCancel()}>
        <DialogContent className="sm:max-w-[360px] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-4 pb-3 space-y-1">
            <DialogTitle className="text-xs font-normal text-muted-foreground">เลือกวันที่</DialogTitle>
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xl font-medium tabular-nums">{headerText}</span>
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </div>
          </DialogHeader>

          <div className="border-t" />

          <div className="px-3 pt-3 pb-1">
            <DayPicker
              mode="single"
              selected={draft}
              onSelect={setDraft}
              month={month}
              onMonthChange={setMonth}
              showOutsideDays
              disabled={[
                ...(min ? [{ before: parseISO(min)! }] : []),
                ...(max ? [{ after: parseISO(max)! }] : []),
              ]}
              modifiers={{ today: new Date() }}
              formatters={{
                formatWeekdayName: (d) => ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"][d.getDay()],
              }}
              classNames={{
                months: "flex flex-col",
                month: "space-y-2",
                table: "w-full border-collapse",
                head_row: "flex",
                head_cell: "text-muted-foreground rounded-md w-9 font-normal text-xs",
                row: "flex w-full mt-0.5",
                cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                day: "h-9 w-9 p-0 font-normal rounded-full hover:bg-accent hover:text-accent-foreground cursor-pointer flex items-center justify-center transition-colors",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                day_today: "ring-2 ring-primary ring-inset text-primary font-medium",
                day_outside: "text-muted-foreground opacity-40",
                day_disabled: "text-muted-foreground opacity-30 cursor-not-allowed",
                day_hidden: "invisible",
              }}
              components={{
                Caption: ThaiCaption,
              }}
            />
          </div>

          <DialogFooter className="px-4 py-3 flex-row justify-end gap-1 border-t bg-muted/20">
            <Button variant="ghost" size="sm" onClick={handleCancel} className="text-muted-foreground">
              ยกเลิก
            </Button>
            <Button variant="ghost" size="sm" onClick={handleOK} disabled={!draft} className="text-primary font-medium hover:bg-primary/10 hover:text-primary">
              ตกลง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
