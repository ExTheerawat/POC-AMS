import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Render all dates in Buddhist Era (พ.ศ.). Forces calendar=buddhist regardless
// of the runtime's ICU defaults (Node.js sometimes returns Gregorian for th-TH).
export function formatDate(date: Date | string, locale = "th-TH"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale, { calendar: "buddhist", year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(date: Date | string, locale = "th-TH"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(locale, { calendar: "buddhist", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Convert a Christian Era (ค.ศ.) year to Buddhist Era (พ.ศ.) for display only
export function toBEYear(yearCE: number | string): number {
  return Number(yearCE) + 543;
}

export function generateRequestNo(prefix: "LV" | "OT"): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const r = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${prefix}${y}${m}${d}-${r}`;
}

export function calculateDaysBetween(start: Date, end: Date): number {
  const s = new Date(start); s.setHours(0, 0, 0, 0);
  const e = new Date(end); e.setHours(0, 0, 0, 0);
  return Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export function calculateOTHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  if (endMinutes < startMinutes) endMinutes += 24 * 60;
  return Math.round(((endMinutes - startMinutes) / 60) * 100) / 100;
}
