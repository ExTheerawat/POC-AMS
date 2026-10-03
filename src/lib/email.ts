import nodemailer from "nodemailer";
import { prisma } from "./db";

const host = process.env.SMTP_HOST;

let transporter: nodemailer.Transporter | null = null;
if (host) {
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false,
    // ignore TLS errors for local dev mail servers
    tls: { rejectUnauthorized: false },
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

type SendOpts = {
  to: string | string[];        // accept string or array — joined with ","
  cc?: string | string[];
  subject: string;
  html: string;
};

const flatten = (v?: string | string[]): string =>
  Array.isArray(v) ? v.filter(Boolean).join(",") : (v ?? "");

/**
 * Send an email — silently skips on missing `to`, never throws.
 * Every attempt is logged to EmailLog regardless of outcome.
 */
export async function sendEmail(opts: SendOpts) {
  const to = flatten(opts.to);
  const cc = flatten(opts.cc);

  if (!to) {
    // No recipient — log as SKIPPED so we know we tried
    await prisma.emailLog.create({
      data: { toEmail: "(no recipient)", ccEmail: cc || null, subject: opts.subject, body: opts.html, status: "SKIPPED_NO_TO" },
    });
    return;
  }

  try {
    if (!transporter) {
      await prisma.emailLog.create({
        data: { toEmail: to, ccEmail: cc || null, subject: opts.subject, body: opts.html, status: "SKIPPED_DEV" },
      });
      console.log("[Email Skipped Dev]", opts.subject, "->", to);
      return;
    }
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "ams-noreply@ams.local",
      to,
      cc: cc || undefined,
      subject: opts.subject,
      html: opts.html,
    });
    await prisma.emailLog.create({
      data: { toEmail: to, ccEmail: cc || null, subject: opts.subject, body: opts.html, status: "SENT" },
    });
    console.log("[Email Sent]", opts.subject, "->", to);
  } catch (err: any) {
    await prisma.emailLog.create({
      data: { toEmail: to, ccEmail: cc || null, subject: opts.subject, body: opts.html, status: "FAILED", errorMsg: String(err?.message ?? err) },
    });
    console.error("[Email Failed]", opts.subject, "->", to, err?.message);
  }
}

/**
 * Resolve the public app URL — used for "view in system" buttons in emails.
 * Falls back to localhost dev port if not set.
 */
export function appUrl(path = ""): string {
  const base = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3001";
  const trimmed = base.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return path ? `${trimmed}${p}` : trimmed;
}

/**
 * Color variants for the email header.
 *  - info     (blue)   → new request awaiting approval / submission
 *  - success  (green)  → approved / acknowledged
 *  - danger   (red)    → rejected / cancelled
 *  - warning  (orange) → cancel-request / memo waiting for HR
 *  - default  (purple) → misc / fallback
 */
export type EmailVariant = "info" | "success" | "danger" | "warning" | "default";

const HEADER_GRADIENTS: Record<EmailVariant, string> = {
  info: "linear-gradient(135deg,#3b82f6,#2563eb)",   // 🔵 primary blue (รออนุมัติ)
  success: "linear-gradient(135deg,#10b981,#059669)",
  danger: "linear-gradient(135deg,#ef4444,#dc2626)",
  warning: "linear-gradient(135deg,#f59e0b,#d97706)",
  default: "linear-gradient(135deg,#4f46e5,#7c3aed)",
};

const BUTTON_COLORS: Record<EmailVariant, string> = {
  info: "#2563eb",   // 🔵 primary blue — matches header gradient
  success: "#059669",
  danger: "#dc2626",
  warning: "#d97706",
  default: "#4f46e5",
};

export function emailTemplate(
  title: string,
  body: string,
  variant: EmailVariant = "default",
  action?: { label: string; url: string },
) {
  // Resolve URL — accept either absolute URL or relative path
  const actionHtml = action
    ? `<div style="padding:0 24px 20px;text-align:center">
         <a href="${action.url.startsWith("http") ? action.url : appUrl(action.url)}"
            style="display:inline-block;padding:11px 28px;background:${BUTTON_COLORS[variant]};color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
           ${action.label} →
         </a>
       </div>`
    : "";

  return `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#f5f6fa;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:${HEADER_GRADIENTS[variant]};padding:20px;color:white">
      <h2 style="margin:0;font-size:18px">${title}</h2>
      <p style="margin:4px 0 0;font-size:12px;opacity:.85">AMS — Attendance Management System</p>
    </div>
    <div style="padding:24px;color:#1f2937;line-height:1.6;font-size:14px">${body}</div>
    ${actionHtml}
    <div style="padding:14px 24px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:11px">
      อีเมลนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับ
    </div>
  </div></body></html>`;
}

// ─── Shared formatters (server-safe — no React) ──────────────────────────
const fmtTH = (d: Date | string) => {
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "-";
  const day = date.getDate();
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${day} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "ฉบับร่าง",
  PENDING_DEPT_MGR: "รอผู้จัดการแผนกอนุมัติ",
  PENDING_FACTORY_MGR: "รอผู้จัดการโรงงานอนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ปฏิเสธ",
  CANCELLED: "ยกเลิก",
  COMPLETED: "เสร็จสิ้น",
  MODIFIED_BY_HR: "HR แก้ไข",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING_DEPT_MGR: "#2563eb",     // primary blue
  PENDING_FACTORY_MGR: "#2563eb",  // primary blue
  APPROVED: "#059669",
  REJECTED: "#dc2626",
  CANCELLED: "#6b7280",
  COMPLETED: "#059669",
  MODIFIED_BY_HR: "#2563eb",
  DRAFT: "#6b7280",
};

function statusBadge(status: string) {
  const color = STATUS_COLOR[status] ?? "#6b7280";
  const label = STATUS_LABEL[status] ?? status;
  return `<span style="display:inline-block;padding:2px 10px;border-radius:999px;background:${color};color:white;font-size:11px;font-weight:600">${label}</span>`;
}

/** Standard details block for Leave emails — same shape across every event */
export function leaveDetailsBlock(input: {
  requestNo: string;
  employeeName: string;
  employeeCode: string;
  leaveTypeName: string;
  leaveTypeCode?: string | null;
  startDate: Date | string;
  endDate: Date | string;
  totalDays: number;
  reason?: string | null;
  status: string;
  approverName?: string | null;
  comment?: string | null;
  /** Set for per-day picked leaves. Accepts:
   *   - JSON string (old: "YYYY-MM-DD" array, or new: [{date, half}])
   *   - Array of strings (old format)
   *   - Array of {date, half} entries (new format)
   */
  selectedDates?: string | string[] | Array<{ date: string; half: "MORNING" | "AFTERNOON" | null }> | null;
  /** "MORNING" | "AFTERNOON" — when totalDays = 0.5 */
  halfDayType?: string | null;
  /** Reject reason label (master) — shown when status = REJECTED */
  rejectReasonLabel?: string | null;
}) {
  // Resolve selectedDates → normalized entries (supports both old string[] and new [{date, half}])
  type Entry = { date: string; half: "MORNING" | "AFTERNOON" | null };
  let entries: Entry[] | null = null;
  if (input.selectedDates) {
    try {
      const arr = Array.isArray(input.selectedDates) ? input.selectedDates : JSON.parse(input.selectedDates);
      if (Array.isArray(arr) && arr.length > 0) {
        const norm: Entry[] = [];
        for (const item of arr) {
          if (typeof item === "string") norm.push({ date: item, half: null });
          else if (item && typeof item === "object" && typeof item.date === "string") {
            const half = item.half === "MORNING" || item.half === "AFTERNOON" ? item.half : null;
            norm.push({ date: item.date, half });
          }
        }
        if (norm.length > 0) entries = norm;
      }
    } catch { /* ignore */ }
  }

  const halfLabel = (h: string | null) => h === "MORNING" ? " (ครึ่งเช้า)" : h === "AFTERNOON" ? " (ครึ่งบ่าย)" : "";

  // Build date display — chip list for picked dates, range text for contiguous
  let dateDisplay: string;
  if (entries && entries.length > 0) {
    const chips = entries.map((e) => {
      const bg = e.half ? "#fef3c7" : "#dbeafe";
      const fg = e.half ? "#92400e" : "#1e40af";
      return `<span style="display:inline-block;background:${bg};color:${fg};padding:2px 8px;border-radius:4px;margin:2px 2px 2px 0;font-size:13px">${fmtTH(e.date)}${halfLabel(e.half)}</span>`;
    }).join("");
    dateDisplay = `${chips}<br/><span style="color:#6b7280;font-size:12px;margin-top:4px;display:inline-block">รวม ${input.totalDays} วัน</span>`;
  } else {
    const sf = fmtTH(input.startDate);
    const ef = fmtTH(input.endDate);
    const halfNote = halfLabel(input.halfDayType ?? null);
    dateDisplay = `${sf}${sf !== ef ? ` ถึง ${ef}` : ""}${halfNote} (${input.totalDays} วัน)`;
  }

  const typeDisplay = input.leaveTypeCode
    ? `${input.leaveTypeCode}-${input.leaveTypeName}`
    : input.leaveTypeName;

  return `
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:4px 0;color:#6b7280;width:110px;vertical-align:top">เลขที่:</td><td style="padding:4px 0;font-family:'Courier New',monospace"><b>${input.requestNo}</b></td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;vertical-align:top">พนักงาน:</td><td style="padding:4px 0"><b>${input.employeeName}</b> (${input.employeeCode})</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;vertical-align:top">ประเภท:</td><td style="padding:4px 0">${typeDisplay}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;vertical-align:top">วันที่:</td><td style="padding:4px 0">${dateDisplay}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;vertical-align:top">เหตุผล:</td><td style="padding:4px 0">${input.reason || "-"}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;vertical-align:top">สถานะ:</td><td style="padding:4px 0">${statusBadge(input.status)}</td></tr>
      ${input.rejectReasonLabel
        ? `<tr><td style="padding:4px 0;color:#6b7280;vertical-align:top">เหตุผลปฏิเสธ:</td><td style="padding:4px 0;color:#dc2626"><b>${input.rejectReasonLabel}</b></td></tr>`
        : ""}
      ${input.approverName
        ? `<tr><td style="padding:4px 0;color:#6b7280;vertical-align:top">ดำเนินการโดย:</td><td style="padding:4px 0">${input.approverName}</td></tr>`
        : ""}
      ${input.comment
        ? `<tr><td style="padding:4px 0;color:#6b7280;vertical-align:top">ความเห็น:</td><td style="padding:4px 0;font-style:italic">"${input.comment}"</td></tr>`
        : ""}
    </table>
  `;
}

/** Standard details block for OT emails — same shape across every event */
export function otDetailsBlock(input: {
  requestNo: string;
  otDate: Date | string;
  startTime: string;
  endTime: string;
  totalHours: number;
  isHoliday?: boolean;
  workDescription?: string | null;
  employeeSummary: string;     // "5 คน — ชื่อ A, ชื่อ B, ..."
  status: string;
  approverName?: string | null;
  comment?: string | null;
}) {
  return `
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:4px 0;color:#6b7280;width:110px">เลขที่:</td><td style="padding:4px 0;font-family:'Courier New',monospace"><b>${input.requestNo}</b></td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">วันที่:</td><td style="padding:4px 0">${fmtTH(input.otDate)}${input.isHoliday ? " <span style='color:#d97706;font-size:11px'>(วันหยุด)</span>" : ""}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280">เวลา:</td><td style="padding:4px 0">${input.startTime} - ${input.endTime} <span style="color:#6b7280">(${input.totalHours} ชม.)</span></td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;vertical-align:top">พนักงาน:</td><td style="padding:4px 0">${input.employeeSummary}</td></tr>
      ${input.workDescription
        ? `<tr><td style="padding:4px 0;color:#6b7280;vertical-align:top">ลักษณะงาน:</td><td style="padding:4px 0">${input.workDescription}</td></tr>`
        : ""}
      <tr><td style="padding:4px 0;color:#6b7280">สถานะ:</td><td style="padding:4px 0">${statusBadge(input.status)}</td></tr>
      ${input.approverName
        ? `<tr><td style="padding:4px 0;color:#6b7280">ดำเนินการโดย:</td><td style="padding:4px 0">${input.approverName}</td></tr>`
        : ""}
      ${input.comment
        ? `<tr><td style="padding:4px 0;color:#6b7280;vertical-align:top">ความเห็น:</td><td style="padding:4px 0;font-style:italic">"${input.comment}"</td></tr>`
        : ""}
    </table>
  `;
}
