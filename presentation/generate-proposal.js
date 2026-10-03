/**
 * AMS — Customer Proposal Deck (27 slides, Professional Corporate)
 *
 * Output:  presentation/AMS-Proposal.pptx
 * Run:     cd presentation && node generate-proposal.js
 */
const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";   // 13.33 × 7.5 in
pres.title = "AMS — Proposal";
pres.author = "AMS Team";
pres.company = "AMS";

// ── Brand colors ───────────────────────────────────────────────
const C = {
  navy:       "1E3A5F",  // primary
  navyDark:   "0F1F3D",  // cover bg / section
  steel:      "2C5282",  // accent
  gold:       "B7791F",  // single warm highlight
  bg:         "F8F9FB",  // page background
  panel:      "FFFFFF",  // card
  border:     "E5E7EB",
  borderDark: "D1D5DB",
  text:       "111827",
  muted:      "6B7280",
  mutedLite:  "9CA3AF",
  success:    "166534",
  warning:    "92400E",
  danger:     "991B1B",
  info:       "1E40AF",
  chipBg:     "EEF2F7",
};
const F = { head: "Tahoma", body: "Tahoma" };

const TOTAL = 27;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function addFooter(slide, num, sectionLabel) {
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 7.15, w: 13.33, h: 0.02,
    fill: { color: C.border }, line: { color: C.border, width: 0 },
  });
  slide.addText("AMS  —  Attendance Management System", {
    x: 0.4, y: 7.2, w: 6, h: 0.25,
    fontFace: F.body, fontSize: 9, color: C.muted,
  });
  if (sectionLabel) {
    slide.addText(sectionLabel, {
      x: 5, y: 7.2, w: 4, h: 0.25,
      fontFace: F.body, fontSize: 9, color: C.muted, align: "center", italic: true,
    });
  }
  slide.addText(`${num} / ${TOTAL}`, {
    x: 12.4, y: 7.2, w: 0.6, h: 0.25,
    fontFace: F.body, fontSize: 9, color: C.muted, align: "right",
  });
}

function addSectionStripe(slide, sectionNum, sectionName, color = C.navy) {
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 0.5,
    fill: { color }, line: { color, width: 0 },
  });
  slide.addText(`${sectionNum}`, {
    x: 0.4, y: 0, w: 0.6, h: 0.5,
    fontFace: F.head, fontSize: 18, bold: true, color: C.gold,
    valign: "middle",
  });
  slide.addText(`SECTION ${sectionNum}`, {
    x: 1.0, y: 0.05, w: 3, h: 0.2,
    fontFace: F.body, fontSize: 9, color: "FFFFFF",
    valign: "middle", charSpacing: 2,
  });
  slide.addText(sectionName, {
    x: 1.0, y: 0.22, w: 11, h: 0.3,
    fontFace: F.head, fontSize: 13, bold: true, color: "FFFFFF",
    valign: "middle",
  });
}

function addPageTitle(slide, title, subtitle) {
  slide.addText(title, {
    x: 0.6, y: 0.75, w: 12, h: 0.5,
    fontFace: F.head, fontSize: 26, bold: true, color: C.text,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.6, y: 1.25, w: 12, h: 0.3,
      fontFace: F.body, fontSize: 12, color: C.muted, italic: true,
    });
  }
  // Underline accent
  slide.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 1.65, w: 0.6, h: 0.04,
    fill: { color: C.gold }, line: { color: C.gold, width: 0 },
  });
}

function card(slide, x, y, w, h, opts = {}) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: opts.fill ?? C.panel },
    line: { color: opts.borderColor ?? C.border, width: opts.borderWidth ?? 0.75 },
    rectRadius: opts.radius ?? 0.05,
  });
}

function drawFlowStep(slide, x, y, w, h, title, sub, color, opts = {}) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: opts.fill ?? "FFFFFF" },
    line: { color, width: 1.5 },
    rectRadius: 0.06,
  });
  slide.addText(title, {
    x: x + 0.05, y: y + 0.08, w: w - 0.1, h: 0.32,
    fontFace: F.head, fontSize: 11, bold: true, color, align: "center",
  });
  if (sub) {
    slide.addText(sub, {
      x: x + 0.05, y: y + h - 0.32, w: w - 0.1, h: 0.3,
      fontFace: F.body, fontSize: 9, color: C.muted, align: "center",
    });
  }
}

function drawArrow(slide, x, y, color = C.muted) {
  slide.addText("→", {
    x, y, w: 0.4, h: 0.4,
    fontFace: F.head, fontSize: 22, bold: true, color,
    align: "center", valign: "middle",
  });
}

function drawDownArrow(slide, x, y, color = C.muted) {
  slide.addText("↓", {
    x, y, w: 0.4, h: 0.4,
    fontFace: F.head, fontSize: 22, bold: true, color,
    align: "center", valign: "middle",
  });
}

function drawUseCase(slide, x, y, w, h, label, color = C.steel) {
  slide.addShape(pres.ShapeType.ellipse, {
    x, y, w, h,
    fill: { color: "FFFFFF" },
    line: { color, width: 1.25 },
  });
  slide.addText(label, {
    x: x + 0.05, y, w: w - 0.1, h,
    fontFace: F.body, fontSize: 10, color: C.text,
    align: "center", valign: "middle",
  });
}

function drawActor(slide, x, y, label, color = C.navy) {
  // Simple labeled rounded box representing an actor
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w: 1.4, h: 0.55,
    fill: { color },
    line: { color, width: 0 },
    rectRadius: 0.06,
  });
  slide.addText(label, {
    x: x + 0.05, y, w: 1.3, h: 0.55,
    fontFace: F.head, fontSize: 11, bold: true, color: "FFFFFF",
    align: "center", valign: "middle",
  });
}

function drawConnector(slide, x1, y1, x2, y2, color = C.borderDark) {
  slide.addShape(pres.ShapeType.line, {
    x: Math.min(x1, x2), y: Math.min(y1, y2),
    w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    line: { color, width: 1, dashType: "dash" },
    flipH: x1 > x2, flipV: y1 > y2,
  });
}

function drawBrowserFrame(slide, x, y, w, h, url) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: "FFFFFF" },
    line: { color: C.borderDark, width: 1 },
    rectRadius: 0.06,
  });
  slide.addShape(pres.ShapeType.rect, {
    x, y, w, h: 0.32,
    fill: { color: "F1F5F9" },
    line: { color: C.border, width: 0 },
  });
  ["EF4444", "F59E0B", "10B981"].forEach((c, i) => {
    slide.addShape(pres.ShapeType.ellipse, {
      x: x + 0.1 + i * 0.16, y: y + 0.1, w: 0.1, h: 0.1,
      fill: { color: c }, line: { color: c, width: 0 },
    });
  });
  slide.addText(url, {
    x: x + 0.7, y: y + 0.05, w: w - 0.8, h: 0.22,
    fontFace: F.body, fontSize: 8, color: C.muted, valign: "middle",
  });
}

function drawCheckmark(slide, x, y, size = 0.2, color = C.success) {
  slide.addText("✓", {
    x, y, w: size, h: size,
    fontFace: F.head, fontSize: size * 72, bold: true, color,
    align: "center", valign: "middle",
  });
}

function drawCross(slide, x, y, size = 0.2, color = C.muted) {
  slide.addText("—", {
    x, y, w: size, h: size,
    fontFace: F.body, fontSize: size * 60, color,
    align: "center", valign: "middle",
  });
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 1 — COVER
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.navyDark };

  // Gold accent line (thin, left)
  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 1.4, w: 0.06, h: 1.8,
    fill: { color: C.gold }, line: { color: C.gold, width: 0 },
  });

  s.addText("PROPOSAL", {
    x: 0.9, y: 1.4, w: 8, h: 0.4,
    fontFace: F.body, fontSize: 12, color: C.gold, charSpacing: 6, bold: true,
  });
  s.addText("AMS", {
    x: 0.9, y: 1.85, w: 12, h: 1.5,
    fontFace: F.head, fontSize: 96, bold: true, color: "FFFFFF",
    charSpacing: -2,
  });
  s.addText("Attendance Management System", {
    x: 0.9, y: 3.3, w: 12, h: 0.5,
    fontFace: F.head, fontSize: 22, color: "CADCFC",
  });
  s.addText("ระบบบริหารจัดการการลาและ OT สำหรับองค์กรขนาดกลาง-ใหญ่", {
    x: 0.9, y: 3.85, w: 12, h: 0.4,
    fontFace: F.body, fontSize: 14, color: "FFFFFF",
  });

  // Customer / date / version block
  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 5.4, w: 6, h: 0.02,
    fill: { color: C.gold }, line: { color: C.gold, width: 0 },
  });
  const meta = [
    { label: "Prepared for", value: "____________________________________" },
    { label: "Prepared by",  value: "____________________________________" },
    { label: "Date",         value: "____________________________________" },
    { label: "Version",      value: "1.0" },
  ];
  meta.forEach((m, i) => {
    s.addText(m.label.toUpperCase(), {
      x: 0.6, y: 5.6 + i * 0.32, w: 1.6, h: 0.25,
      fontFace: F.body, fontSize: 9, color: "9CA3AF", charSpacing: 1,
    });
    s.addText(m.value, {
      x: 2.0, y: 5.6 + i * 0.32, w: 5, h: 0.25,
      fontFace: F.body, fontSize: 11, color: "FFFFFF",
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 2 — EXECUTIVE SUMMARY
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 1, "INTRODUCTION");
  addPageTitle(s, "Executive Summary", "ภาพรวมของระบบ AMS — ปัญหาที่แก้ และวิธีการ");

  // Two columns
  const colY = 2.0, colH = 4.6;

  // Problem column
  card(s, 0.6, colY, 6.0, colH);
  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: colY, w: 6.0, h: 0.06,
    fill: { color: C.danger }, line: { color: C.danger, width: 0 },
  });
  s.addText("ปัญหาที่พบในระบบเดิม", {
    x: 0.85, y: colY + 0.2, w: 5.5, h: 0.35,
    fontFace: F.head, fontSize: 16, bold: true, color: C.danger,
  });
  const problems = [
    "การลา / OT ใช้กระดาษหรือ Excel แยกกัน ผิดพลาดง่าย",
    "ไม่มี audit trail — ตามไม่ได้ว่าใครอนุมัติเมื่อไหร่",
    "คำนวณวันลาคงเหลือ + carry-over ด้วยมือ ใช้เวลานาน",
    "HR ไม่เห็นภาพรวมทันที — รายงานต้องรอ end-of-month",
    "ไม่มีการแจ้งเตือน — ผู้อนุมัติลืม / ใบลาค้าง",
    "ขอยกเลิกใบลา/OT หลังอนุมัติ ไม่มีกระบวนการชัดเจน",
  ];
  s.addText(
    problems.map((p) => ({ text: p, options: { bullet: { code: "25A0" }, color: C.text } })),
    {
      x: 0.85, y: colY + 0.7, w: 5.5, h: colH - 0.9,
      fontFace: F.body, fontSize: 12, color: C.text, lineSpacing: 22,
    },
  );

  // Solution column
  card(s, 6.75, colY, 6.0, colH);
  s.addShape(pres.ShapeType.rect, {
    x: 6.75, y: colY, w: 6.0, h: 0.06,
    fill: { color: C.success }, line: { color: C.success, width: 0 },
  });
  s.addText("AMS แก้ไขปัญหาได้อย่างไร", {
    x: 7.0, y: colY + 0.2, w: 5.5, h: 0.35,
    fontFace: F.head, fontSize: 16, bold: true, color: C.success,
  });
  const solutions = [
    "Web-based ทุกขั้นตอน — สร้าง / อนุมัติ / รายงาน ครบในที่เดียว",
    "Audit log บันทึกทุก action พร้อมเวลา + ผู้กระทำ",
    "Auto pro-rate ตามอายุงาน + carry-over อัตโนมัติทุกปี",
    "Dashboard + รายงานเรียลไทม์ + Export Excel ได้ทุกเมื่อ",
    "Email แจ้งทุก step — ลด pending ที่ตกค้าง",
    "Cancellation Workflow — HR review + คืน balance อัตโนมัติ",
  ];
  s.addText(
    solutions.map((p) => ({ text: p, options: { bullet: { code: "25A0" }, color: C.success } })),
    {
      x: 7.0, y: colY + 0.7, w: 5.5, h: colH - 0.9,
      fontFace: F.body, fontSize: 12, color: C.text, lineSpacing: 22,
    },
  );

  addFooter(s, 2, "Introduction");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 3 — WHY AMS / VALUE PROPOSITION
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 1, "INTRODUCTION");
  addPageTitle(s, "ทำไมต้อง AMS", "Value Proposition — 6 จุดเด่นของระบบ");

  const items = [
    { num: "01", title: "ครอบคลุมทั้งฝ่าย",
      desc: "รองรับทั้ง Office (อนุมัติ 2 ขั้น) และ Production (3 ขั้น) ในระบบเดียว" },
    { num: "02", title: "Audit Trail ครบทุก Action",
      desc: "บันทึกทุกการ สร้าง / อนุมัติ / ปฏิเสธ / ยกเลิก พร้อมเวลา และผู้ทำ" },
    { num: "03", title: "Approve / Reject รายคน",
      desc: "OT ใบเดียวมีหลายคน ผู้อนุมัติเลือกได้ว่าจะอนุมัติใคร / ปฏิเสธใคร / ตัดออก" },
    { num: "04", title: "Auto Calculation",
      desc: "Pro-rate วันลาตามอายุงาน + Carry-over วันลาเหลือสู่ปีถัดไปอัตโนมัติ" },
    { num: "05", title: "Email Notification ครบ",
      desc: "แจ้งทุก step + CC HR + FYI หัวหน้าแผนกข้ามแผนก — ลด pending ตกค้าง" },
    { num: "06", title: "พร้อมใช้งาน 460+ คน",
      desc: "Performance + Security + Role-based access — รองรับองค์กรขนาดกลาง-ใหญ่" },
  ];
  const cw = 3.95, ch = 2.0, sx = 0.6, sy = 2.0, gx = 0.27, gy = 0.27;
  items.forEach((it, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = sx + col * (cw + gx);
    const y = sy + row * (ch + gy);
    card(s, x, y, cw, ch);
    s.addText(it.num, {
      x: x + 0.2, y: y + 0.15, w: 1.0, h: 0.4,
      fontFace: F.head, fontSize: 28, bold: true, color: C.gold,
    });
    s.addText(it.title, {
      x: x + 0.2, y: y + 0.7, w: cw - 0.4, h: 0.35,
      fontFace: F.head, fontSize: 13, bold: true, color: C.text,
    });
    s.addText(it.desc, {
      x: x + 0.2, y: y + 1.1, w: cw - 0.4, h: ch - 1.2,
      fontFace: F.body, fontSize: 10.5, color: C.muted, lineSpacing: 16,
    });
  });

  addFooter(s, 3, "Introduction");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 4 — SYSTEM ARCHITECTURE
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 2, "SYSTEM OVERVIEW");
  addPageTitle(s, "System Architecture", "สถาปัตยกรรมระบบแบบ 3-tier + บริการเสริม");

  // 3-tier: Browser → App Server → DB
  const layers = [
    { name: "Client Layer",       sub: "Browser (Chrome / Edge / Safari)", color: C.steel,
      items: ["Next.js 14 — React 18", "Tailwind CSS + shadcn/ui", "Responsive Desktop + Tablet"] },
    { name: "Application Layer",  sub: "Node.js 20 — Next.js App Server",  color: C.navy,
      items: ["NextAuth.js v5 — Session + bcrypt", "Server Actions + Prisma 5", "Nodemailer (SMTP)", "ExcelJS (Reports)"] },
    { name: "Data Layer",         sub: "Microsoft SQL Server 2019",        color: C.gold,
      items: ["16 Master/Transaction Tables", "Audit Log + Email Log", "Backup (SQL Maintenance Plan)"] },
  ];
  const lw = 3.7, lh = 4.0, sx = 0.85, sy = 2.0, gx = 0.55;
  layers.forEach((l, i) => {
    const x = sx + i * (lw + gx);
    // Header
    s.addShape(pres.ShapeType.roundRect, {
      x, y: sy, w: lw, h: 0.65,
      fill: { color: l.color }, line: { color: l.color, width: 0 },
      rectRadius: 0.06,
    });
    s.addText(l.name, {
      x: x + 0.15, y: sy + 0.06, w: lw - 0.3, h: 0.3,
      fontFace: F.head, fontSize: 13, bold: true, color: "FFFFFF",
    });
    s.addText(l.sub, {
      x: x + 0.15, y: sy + 0.36, w: lw - 0.3, h: 0.25,
      fontFace: F.body, fontSize: 10, color: "CADCFC", italic: true,
    });
    // Body
    card(s, x, sy + 0.75, lw, lh - 0.75);
    s.addText(
      l.items.map((it) => ({ text: it, options: { bullet: { code: "25A0" }, color: l.color } })),
      {
        x: x + 0.2, y: sy + 0.9, w: lw - 0.4, h: lh - 1.0,
        fontFace: F.body, fontSize: 11, color: C.text, lineSpacing: 22,
      },
    );
    // Connector arrow between layers
    if (i < layers.length - 1) {
      const ax = x + lw + 0.05;
      s.addText("→", {
        x: ax, y: sy + 1.7, w: 0.4, h: 0.4,
        fontFace: F.head, fontSize: 22, bold: true, color: C.muted,
        align: "center", valign: "middle",
      });
    }
  });

  // Bottom: SMTP + HR Cloud (optional services)
  card(s, 0.85, 6.15, 11.6, 0.7, { fill: C.chipBg });
  s.addText("บริการเสริม:", {
    x: 1.0, y: 6.2, w: 1.5, h: 0.6,
    fontFace: F.head, fontSize: 11, bold: true, color: C.navy, valign: "middle",
  });
  s.addText("• SMTP Server (Email)   • Internal LAN / VPN   • Active Directory Integration (optional)   • Daily Backup", {
    x: 2.5, y: 6.2, w: 10, h: 0.6,
    fontFace: F.body, fontSize: 11, color: C.text, valign: "middle",
  });

  addFooter(s, 4, "System Overview");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 5 — USER ROLES & PERMISSIONS
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 2, "SYSTEM OVERVIEW");
  addPageTitle(s, "User Roles & Permissions", "5 ระดับสิทธิ์ × สิทธิ์การเข้าถึงแต่ละโมดูล");

  const roles = [
    { name: "Supervisor",        sub: "หัวหน้าทีม / Line Manager",      perms: { createLeave: true, approveLeave: false, createOT: true, approveOT: false, reports: false, master: false, settings: false } },
    { name: "Dept Manager",      sub: "ผู้จัดการแผนก",                  perms: { createLeave: true, approveLeave: "S1", createOT: true, approveOT: "S1", reports: "own", master: false, settings: false } },
    { name: "Factory Manager",   sub: "ผู้จัดการโรงงาน (Production)",   perms: { createLeave: false, approveLeave: "S2", createOT: false, approveOT: "S2", reports: "own", master: false, settings: false } },
    { name: "HR Admin",          sub: "ฝ่ายบุคคล",                       perms: { createLeave: true, approveLeave: "fast", createOT: true, approveOT: "fast", reports: "all", master: true, settings: false } },
    { name: "System Admin",      sub: "ผู้ดูแลระบบ",                     perms: { createLeave: true, approveLeave: "fast", createOT: true, approveOT: "fast", reports: "all", master: true, settings: true } },
  ];
  const cols = [
    { key: "createLeave",  label: "สร้างใบลา",      w: 1.4 },
    { key: "approveLeave", label: "อนุมัติใบลา",    w: 1.6 },
    { key: "createOT",     label: "สร้างใบ OT",     w: 1.4 },
    { key: "approveOT",    label: "อนุมัติ OT",     w: 1.6 },
    { key: "reports",      label: "รายงาน",         w: 1.2 },
    { key: "master",       label: "Master",         w: 1.1 },
    { key: "settings",     label: "Settings",       w: 1.1 },
  ];

  const tableX = 0.6, tableY = 2.0, roleW = 2.4;

  // Header row
  s.addShape(pres.ShapeType.rect, {
    x: tableX, y: tableY, w: 13.33 - 2*0.6, h: 0.5,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 },
  });
  s.addText("Role", {
    x: tableX + 0.1, y: tableY, w: roleW, h: 0.5,
    fontFace: F.head, fontSize: 11, bold: true, color: "FFFFFF", valign: "middle",
  });
  let cx = tableX + roleW;
  cols.forEach((c) => {
    s.addText(c.label, {
      x: cx, y: tableY, w: c.w, h: 0.5,
      fontFace: F.head, fontSize: 11, bold: true, color: "FFFFFF",
      align: "center", valign: "middle",
    });
    cx += c.w;
  });

  // Role rows
  const renderPerm = (v) => {
    if (v === true)   return { text: "✓",       color: C.success, isText: true };
    if (v === false)  return { text: "—",       color: C.mutedLite, isText: true };
    if (v === "S1")   return { text: "Step 1",  color: C.steel,  isText: false };
    if (v === "S2")   return { text: "Step 2",  color: C.steel,  isText: false };
    if (v === "fast") return { text: "Fast-track", color: C.gold, isText: false };
    if (v === "all")  return { text: "ทั้งหมด", color: C.success, isText: false };
    if (v === "own")  return { text: "เฉพาะที่ดูแล", color: C.steel, isText: false };
    return { text: String(v), color: C.text, isText: false };
  };

  roles.forEach((r, i) => {
    const y = tableY + 0.5 + i * 0.85;
    if (i % 2 === 0) {
      s.addShape(pres.ShapeType.rect, {
        x: tableX, y, w: 13.33 - 1.2, h: 0.85,
        fill: { color: "FFFFFF" }, line: { color: "FFFFFF", width: 0 },
      });
    } else {
      s.addShape(pres.ShapeType.rect, {
        x: tableX, y, w: 13.33 - 1.2, h: 0.85,
        fill: { color: C.chipBg }, line: { color: C.chipBg, width: 0 },
      });
    }
    s.addText(r.name, {
      x: tableX + 0.15, y: y + 0.08, w: roleW - 0.2, h: 0.35,
      fontFace: F.head, fontSize: 12, bold: true, color: C.navy,
    });
    s.addText(r.sub, {
      x: tableX + 0.15, y: y + 0.42, w: roleW - 0.2, h: 0.35,
      fontFace: F.body, fontSize: 9.5, color: C.muted, italic: true,
    });
    let px = tableX + roleW;
    cols.forEach((c) => {
      const perm = renderPerm(r.perms[c.key]);
      if (perm.isText) {
        s.addText(perm.text, {
          x: px, y, w: c.w, h: 0.85,
          fontFace: F.head, fontSize: 16, bold: true, color: perm.color,
          align: "center", valign: "middle",
        });
      } else {
        s.addShape(pres.ShapeType.roundRect, {
          x: px + 0.1, y: y + 0.25, w: c.w - 0.2, h: 0.35,
          fill: { color: "FFFFFF" }, line: { color: perm.color, width: 1 },
          rectRadius: 0.04,
        });
        s.addText(perm.text, {
          x: px + 0.1, y: y + 0.25, w: c.w - 0.2, h: 0.35,
          fontFace: F.body, fontSize: 10, bold: true, color: perm.color,
          align: "center", valign: "middle",
        });
      }
      px += c.w;
    });
  });

  // Border line under table
  s.addShape(pres.ShapeType.rect, {
    x: tableX, y: tableY + 0.5 + roles.length * 0.85, w: 13.33 - 1.2, h: 0.02,
    fill: { color: C.borderDark }, line: { color: C.borderDark, width: 0 },
  });

  addFooter(s, 5, "System Overview");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 6 — MODULE MAP
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 2, "SYSTEM OVERVIEW");
  addPageTitle(s, "Module Map", "6 modules ที่ทำงานสัมพันธ์กัน");

  const modules = [
    { title: "Leave Management",       sub: "ระบบจัดการการลา",       color: C.steel,
      items: ["ลาครึ่งวัน/เต็มวัน", "Carry-over อัตโนมัติ", "Reject Reasons Master"] },
    { title: "OT Management",          sub: "ระบบจัดการ OT",          color: C.navy,
      items: ["Day/Night Shift", "Per-emp Approve/Reject", "Cross-dept FYI"] },
    { title: "Approval Workflow",      sub: "ขั้นตอนอนุมัติหลายระดับ", color: C.gold,
      items: ["Office 2-step / ผลิต 3-step", "Bulk + รายคน", "HR fast-track"] },
    { title: "Master Data",            sub: "ข้อมูลพื้นฐาน",          color: C.steel,
      items: ["พนักงาน · แผนก", "ประเภทการลา + Code", "สายรถ default"] },
    { title: "Reports & Excel",        sub: "รายงานและส่งออก",        color: C.navy,
      items: ["Leave Monthly Report", "OT Summary + สรุปสายรถ", "Filter ทุกมิติ"] },
    { title: "Notifications & Audit",  sub: "แจ้งเตือน + บันทึก",     color: C.gold,
      items: ["Email ทุก step", "FYI ข้ามแผนก", "Audit Log ครบ"] },
  ];
  const cw = 3.95, ch = 1.95, sx = 0.6, sy = 2.0, gx = 0.27, gy = 0.27;
  modules.forEach((m, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = sx + col * (cw + gx);
    const y = sy + row * (ch + gy);
    card(s, x, y, cw, ch);
    s.addShape(pres.ShapeType.rect, {
      x, y, w: cw, h: 0.06,
      fill: { color: m.color }, line: { color: m.color, width: 0 },
    });
    s.addText(m.title, {
      x: x + 0.25, y: y + 0.18, w: cw - 0.5, h: 0.35,
      fontFace: F.head, fontSize: 14, bold: true, color: C.text,
    });
    s.addText(m.sub, {
      x: x + 0.25, y: y + 0.55, w: cw - 0.5, h: 0.3,
      fontFace: F.body, fontSize: 10, color: C.muted, italic: true,
    });
    s.addText(
      m.items.map((it) => ({ text: it, options: { bullet: { code: "25A0" }, color: m.color } })),
      {
        x: x + 0.3, y: y + 0.95, w: cw - 0.55, h: ch - 1.05,
        fontFace: F.body, fontSize: 10.5, color: C.text, lineSpacing: 16,
      },
    );
  });

  addFooter(s, 6, "System Overview");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 7 — LEAVE USE CASES
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 3, "LEAVE MODULE", C.steel);
  addPageTitle(s, "Leave Module — Use Cases", "ผู้เกี่ยวข้องและการใช้งานหลัก");

  // System boundary box
  s.addShape(pres.ShapeType.roundRect, {
    x: 2.8, y: 2.0, w: 7.7, h: 5.0,
    fill: { color: "FFFFFF" }, line: { color: C.borderDark, width: 1 },
    rectRadius: 0.08,
  });
  s.addText("Leave Management Module", {
    x: 2.8, y: 2.05, w: 7.7, h: 0.3,
    fontFace: F.body, fontSize: 10, color: C.muted, italic: true,
    align: "center", valign: "middle",
  });

  // Actors on left
  drawActor(s, 0.6, 2.3, "Supervisor", C.steel);
  drawActor(s, 0.6, 3.3, "Dept Manager", C.navy);
  drawActor(s, 0.6, 4.3, "Factory Mgr", C.navy);
  drawActor(s, 0.6, 5.3, "HR Admin", C.gold);

  // Use cases (ovals) in system
  const ucs = [
    { x: 3.1, y: 2.6, w: 2.2, h: 0.6, label: "สร้างใบลา (proxy)" },
    { x: 5.6, y: 2.6, w: 2.2, h: 0.6, label: "เลือกลาครึ่งวัน" },
    { x: 8.1, y: 2.6, w: 2.2, h: 0.6, label: "ดูสิทธิ์ลูกน้อง" },
    { x: 3.1, y: 3.5, w: 2.2, h: 0.6, label: "อนุมัติ Step 1" },
    { x: 5.6, y: 3.5, w: 2.2, h: 0.6, label: "ปฏิเสธ + เหตุผล" },
    { x: 8.1, y: 3.5, w: 2.2, h: 0.6, label: "Bulk Approve/Reject" },
    { x: 3.1, y: 4.4, w: 2.2, h: 0.6, label: "อนุมัติ Step 2 (ผลิต)" },
    { x: 5.6, y: 4.4, w: 2.2, h: 0.6, label: "ขอยกเลิกใบลา" },
    { x: 8.1, y: 4.4, w: 2.2, h: 0.6, label: "ดูประวัติ + Detail" },
    { x: 3.1, y: 5.3, w: 2.2, h: 0.6, label: "จัดการ Master Data" },
    { x: 5.6, y: 5.3, w: 2.2, h: 0.6, label: "อนุมัติยกเลิก + คืนสิทธิ์" },
    { x: 8.1, y: 5.3, w: 2.2, h: 0.6, label: "Export Excel + Reports" },
    { x: 5.6, y: 6.2, w: 2.2, h: 0.6, label: "HR Fast-track อนุมัติ" },
  ];
  ucs.forEach((u) => drawUseCase(s, u.x, u.y, u.w, u.h, u.label));

  // Right side legend
  card(s, 10.7, 2.0, 2.05, 5.0, { fill: C.chipBg });
  s.addText("คำอธิบาย", {
    x: 10.8, y: 2.1, w: 1.85, h: 0.3,
    fontFace: F.head, fontSize: 11, bold: true, color: C.navy,
  });
  s.addText([
    { text: "▢", options: { color: C.steel, bold: true } },
    { text: "  Actor (ผู้ใช้)\n", options: { color: C.text } },
    { text: "◯", options: { color: C.steel, bold: true } },
    { text: "  Use Case\n", options: { color: C.text } },
    { text: "—", options: { color: C.borderDark } },
    { text: "  Boundary\n", options: { color: C.text } },
    { text: "\n", options: {} },
    { text: "Supervisor / Dept Mgr / Factory Mgr / HR Admin = 4 actors หลักของ Leave Module", options: { color: C.muted, fontSize: 9, italic: true } },
  ], {
    x: 10.8, y: 2.5, w: 1.85, h: 4.4,
    fontFace: F.body, fontSize: 10, color: C.text,
  });

  addFooter(s, 7, "Leave Module");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 8 — LEAVE WORKFLOW (Office, 2-step)
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 3, "LEAVE MODULE", C.steel);
  addPageTitle(s, "Leave Workflow — Office (2-step)", "ขั้นตอนการอนุมัติใบลาฝ่ายสำนักงาน");

  // Happy path
  const stepY = 2.4, stepW = 2.0, stepH = 0.95;
  let sx = 0.7;
  const happy = [
    { title: "หัวหน้า", sub: "สร้างใบลา", color: C.steel },
    { title: "Email แจ้ง", sub: "ผจก.แผนก",  color: C.muted },
    { title: "ผจก.แผนก", sub: "อนุมัติ", color: C.navy },
    { title: "Email แจ้ง", sub: "ผู้สร้าง + CC HR", color: C.muted },
    { title: "APPROVED", sub: "เสร็จสิ้น", color: C.success },
  ];
  happy.forEach((st, i) => {
    drawFlowStep(s, sx, stepY, stepW, stepH, st.title, st.sub, st.color);
    if (i < happy.length - 1) drawArrow(s, sx + stepW + 0.05, stepY + 0.3);
    sx += stepW + 0.45;
  });

  // Reject branch (downward from Dept Mgr)
  drawDownArrow(s, 5.3, 3.55, C.danger);
  drawFlowStep(s, 4.3, 4.05, 2.0, 0.85, "REJECTED", "พร้อมเหตุผล (LRR001…)", C.danger);
  s.addText("→  Email แจ้งผู้สร้าง + CC HR", {
    x: 6.5, y: 4.25, w: 4, h: 0.4,
    fontFace: F.body, fontSize: 11, color: C.danger, valign: "middle",
  });

  // Bulk Approve callout (top-right)
  card(s, 9.2, 1.95, 3.55, 1.3, { fill: C.chipBg });
  s.addText("Bulk Approve / Reject", {
    x: 9.35, y: 2.0, w: 3.3, h: 0.3,
    fontFace: F.head, fontSize: 11, bold: true, color: C.navy,
  });
  s.addText("ผจก.เลือก checkbox หลายใบ → กดอนุมัติ/ปฏิเสธทีเดียว — ลดการคลิก", {
    x: 9.35, y: 2.35, w: 3.3, h: 0.85,
    fontFace: F.body, fontSize: 10, color: C.muted, lineSpacing: 14,
  });

  // Cancel-before-approve callout (below Reject)
  card(s, 0.7, 5.15, 12.05, 1.45, { fill: "FFF9E6", borderColor: C.gold });
  s.addText("Cancel ใบลา (ก่อนอนุมัติ)", {
    x: 0.85, y: 5.2, w: 5, h: 0.3,
    fontFace: F.head, fontSize: 12, bold: true, color: C.warning,
  });
  s.addText("ผู้สร้าง / Admin สามารถยกเลิกใบลาที่ยังไม่ได้รับการอนุมัติได้ทันที — ระบบเปลี่ยนสถานะเป็น CANCELLED + ไม่หักวันลา + ส่ง Email แจ้ง", {
    x: 0.85, y: 5.6, w: 12, h: 0.9,
    fontFace: F.body, fontSize: 11, color: C.text, lineSpacing: 18,
  });

  // Cut-off note
  s.addText("⚠  Cut-off Time: สร้าง 11:00 / อนุมัติ 13:00 (ปรับได้ใน Settings)", {
    x: 0.7, y: 6.75, w: 12, h: 0.35,
    fontFace: F.body, fontSize: 10, color: C.warning, italic: true, valign: "middle",
  });

  addFooter(s, 8, "Leave Module");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 9 — LEAVE WORKFLOW (Production, 3-step) + Cancel Flow
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 3, "LEAVE MODULE", C.steel);
  addPageTitle(s, "Leave Workflow — Production (3-step) + Cancel", "ขั้นตอนการอนุมัติฝ่ายผลิต + กระบวนการยกเลิกหลังอนุมัติ");

  // Production happy path
  s.addText("Production Workflow", {
    x: 0.7, y: 1.95, w: 6, h: 0.3,
    fontFace: F.head, fontSize: 13, bold: true, color: C.navy,
  });
  const stepY = 2.4, stepW = 1.85, stepH = 0.9;
  const happy = [
    { title: "หัวหน้า", sub: "สร้าง", color: C.steel },
    { title: "ผจก.แผนก", sub: "Step 1", color: C.navy },
    { title: "ผจก.โรงงาน", sub: "Step 2", color: C.navy },
    { title: "APPROVED", sub: "เสร็จสิ้น", color: C.success },
  ];
  let sx = 0.7;
  happy.forEach((st, i) => {
    drawFlowStep(s, sx, stepY, stepW, stepH, st.title, st.sub, st.color);
    if (i < happy.length - 1) drawArrow(s, sx + stepW + 0.05, stepY + 0.25);
    sx += stepW + 0.4;
  });

  // HR fast-track box (right)
  card(s, 9.5, 2.4, 3.25, 0.9, { fill: "FEF3C7", borderColor: C.gold });
  s.addText("HR Fast-track", {
    x: 9.65, y: 2.45, w: 3, h: 0.3,
    fontFace: F.head, fontSize: 11, bold: true, color: C.warning,
  });
  s.addText("ข้าม 2-3 step → APPROVED ทันที", {
    x: 9.65, y: 2.78, w: 3, h: 0.4,
    fontFace: F.body, fontSize: 10, color: C.text,
  });

  // Cancel flow
  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 3.7, w: 12.13, h: 0.04,
    fill: { color: C.borderDark }, line: { color: C.borderDark, width: 0 },
  });
  s.addText("Cancel Workflow — ขอยกเลิกใบลาหลังได้รับการอนุมัติแล้ว", {
    x: 0.7, y: 3.9, w: 12, h: 0.3,
    fontFace: F.head, fontSize: 13, bold: true, color: C.navy,
  });

  const cancelY = 4.4, cancelW = 1.85, cancelH = 0.85;
  const cancel = [
    { title: "เจ้าของใบ", sub: "ขอยกเลิก", color: C.steel },
    { title: "ระบุเหตุผล", sub: "Required", color: C.warning },
    { title: "HR Admin", sub: "Review", color: C.gold },
    { title: "Approve", sub: "คืน Balance", color: C.success },
    { title: "Reject", sub: "ใบลายังคงอยู่", color: C.danger },
  ];
  let cx = 0.7;
  cancel.forEach((st, i) => {
    drawFlowStep(s, cx, cancelY, cancelW, cancelH, st.title, st.sub, st.color);
    if (i < cancel.length - 2) drawArrow(s, cx + cancelW + 0.05, cancelY + 0.25);
    cx += cancelW + 0.4;
  });

  // Branch from HR
  s.addShape(pres.ShapeType.line, {
    x: 6.95, y: 4.85, w: 0, h: 0.55,
    line: { color: C.borderDark, width: 1, dashType: "dash" },
  });

  // Result boxes
  card(s, 0.7, 5.8, 5.85, 1.15, { fill: "ECFDF5", borderColor: C.success });
  s.addText("ถ้า HR Approve", {
    x: 0.85, y: 5.85, w: 5.5, h: 0.3,
    fontFace: F.head, fontSize: 12, bold: true, color: C.success,
  });
  s.addText("• สถานะใบลา → CANCELLED\n• คืนวันลาเข้า balance ของพนักงาน\n• Email แจ้งผู้ขอยกเลิก + CC HR", {
    x: 0.85, y: 6.15, w: 5.5, h: 0.75,
    fontFace: F.body, fontSize: 10.5, color: C.text, lineSpacing: 16,
  });

  card(s, 6.85, 5.8, 5.85, 1.15, { fill: "FEF2F2", borderColor: C.danger });
  s.addText("ถ้า HR Reject", {
    x: 7.0, y: 5.85, w: 5.5, h: 0.3,
    fontFace: F.head, fontSize: 12, bold: true, color: C.danger,
  });
  s.addText("• สถานะใบลายังคง APPROVED (ไม่ยกเลิก)\n• แสดงเหตุผล HR ในประวัติ\n• Email แจ้งผู้ขอยกเลิก พร้อม comment", {
    x: 7.0, y: 6.15, w: 5.5, h: 0.75,
    fontFace: F.body, fontSize: 10.5, color: C.text, lineSpacing: 16,
  });

  addFooter(s, 9, "Leave Module");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 10 — LEAVE FEATURES + MOCKUP
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 3, "LEAVE MODULE", C.steel);
  addPageTitle(s, "Leave — Key Features", "ความสามารถหลักของโมดูลการลา");

  // Left: features
  const features = [
    { h: "ลาครึ่งวัน เช้า/บ่าย", d: "ใช้ได้ทุกประเภทการลา ไม่ต้องระบุเวลา ผสมเต็มวัน + ครึ่งวันในใบเดียว" },
    { h: "เลือกหลายวันในใบเดียว", d: "พนักงานคนเดียวลาวันที่ 1, 4, 7 ในใบลาเดียว — ระบบนับวันให้ถูก" },
    { h: "หัวหน้าเห็นสิทธิ์ลูกน้อง", d: "ดูยอดวันลาคงเหลือของลูกน้องทั้งทีมได้ทันที ก่อนสร้างใบลา" },
    { h: "เหตุผลปฏิเสธ — Master CRUD", d: "HR กำหนดเหตุผล (LRR001, LRR002, ...) + Bulk Approve/Reject" },
    { h: "Pro-rate + Carry-over อัตโนมัติ", d: "คำนวณวันลาตามอายุงาน + โอนวันเหลือสู่ปีถัดไป (เพดาน 5 วัน)" },
    { h: "รหัสประเภทการลา (Code)", d: "แสดงทุกที่ List/Detail/Email/Excel เช่น VACATION-ลาพักร้อน" },
  ];
  features.forEach((f, i) => {
    const y = 2.0 + i * 0.78;
    // Number badge
    s.addShape(pres.ShapeType.ellipse, {
      x: 0.7, y, w: 0.35, h: 0.35,
      fill: { color: C.steel }, line: { color: C.steel, width: 0 },
    });
    s.addText(String(i + 1), {
      x: 0.7, y, w: 0.35, h: 0.35,
      fontFace: F.head, fontSize: 11, bold: true, color: "FFFFFF",
      align: "center", valign: "middle",
    });
    s.addText(f.h, {
      x: 1.2, y: y - 0.05, w: 5.5, h: 0.35,
      fontFace: F.head, fontSize: 12, bold: true, color: C.text,
    });
    s.addText(f.d, {
      x: 1.2, y: y + 0.28, w: 5.5, h: 0.4,
      fontFace: F.body, fontSize: 10, color: C.muted, lineSpacing: 14,
    });
  });

  // Right: mockup of /leave/create
  drawLeaveMockup(s, 7.3, 1.95, 5.45, 5.0);

  addFooter(s, 10, "Leave Module");
}

function drawLeaveMockup(s, x, y, w, h) {
  drawBrowserFrame(s, x, y, w, h, "ams.local / leave / create");

  s.addText("สร้างใบลา", {
    x: x + 0.2, y: y + 0.5, w: w - 0.4, h: 0.35,
    fontFace: F.head, fontSize: 14, bold: true, color: C.text,
  });

  // Employee row
  s.addText("พนักงาน *", { x: x + 0.2, y: y + 0.95, w: 2, h: 0.2, fontFace: F.body, fontSize: 8, color: C.muted });
  s.addShape(pres.ShapeType.roundRect, {
    x: x + 0.2, y: y + 1.15, w: (w - 0.5) / 2, h: 0.32,
    fill: { color: "F8FAFC" }, line: { color: C.border, width: 0.5 }, rectRadius: 0.04,
  });
  s.addText("A-092 — ศรีไพบูลย์ เ.", {
    x: x + 0.3, y: y + 1.15, w: 2.4, h: 0.32,
    fontFace: F.body, fontSize: 9, color: C.text, valign: "middle",
  });

  // Leave type
  s.addText("ประเภทการลา *", { x: x + 2.85, y: y + 0.95, w: 2.5, h: 0.2, fontFace: F.body, fontSize: 8, color: C.muted });
  s.addShape(pres.ShapeType.roundRect, {
    x: x + 2.85, y: y + 1.15, w: w - 3.05, h: 0.32,
    fill: { color: "F8FAFC" }, line: { color: C.border, width: 0.5 }, rectRadius: 0.04,
  });
  s.addText("VACATION-ลาพักร้อน", {
    x: x + 2.95, y: y + 1.15, w: w - 3.2, h: 0.32,
    fontFace: F.body, fontSize: 9, color: C.text, valign: "middle",
  });

  // Date picker
  s.addText("เลือกวันลา *", { x: x + 0.2, y: y + 1.6, w: 2, h: 0.2, fontFace: F.body, fontSize: 8, color: C.muted });
  s.addShape(pres.ShapeType.roundRect, {
    x: x + 0.2, y: y + 1.8, w: w - 0.4, h: 0.32,
    fill: { color: "FFFFFF" }, line: { color: C.border, width: 0.75 }, rectRadius: 0.04,
  });
  s.addText("คลิกเพื่อเลือกวัน — เพิ่มอัตโนมัติ", {
    x: x + 0.3, y: y + 1.8, w: w - 0.8, h: 0.32,
    fontFace: F.body, fontSize: 8, color: C.muted, italic: true, valign: "middle",
  });

  // Selected dates list
  s.addText("เลือกแล้ว 3 รายการ (2.5 วัน)", {
    x: x + 0.2, y: y + 2.25, w: 3.5, h: 0.2,
    fontFace: F.body, fontSize: 8, bold: true, color: C.text,
  });
  s.addShape(pres.ShapeType.roundRect, {
    x: x + 0.2, y: y + 2.5, w: w - 0.4, h: 1.15,
    fill: { color: "FFFFFF" }, line: { color: C.border, width: 0.5 }, rectRadius: 0.04,
  });

  const entries = [
    { date: "11 ก.ค. 2569", sel: "FULL" },
    { date: "15 ก.ค. 2569", sel: "FULL" },
    { date: "16 ก.ค. 2569", sel: "AFTERNOON" },
  ];
  const halfBtns = [
    { key: "FULL", label: "เต็มวัน", color: C.steel },
    { key: "MORNING", label: "ครึ่งเช้า", color: C.warning },
    { key: "AFTERNOON", label: "ครึ่งบ่าย", color: C.info },
  ];
  entries.forEach((e, i) => {
    const ey = y + 2.55 + i * 0.35;
    s.addText("📅 " + e.date, {
      x: x + 0.3, y: ey, w: 1.6, h: 0.3,
      fontFace: F.body, fontSize: 9, color: C.text, valign: "middle",
    });
    const bx0 = x + 1.95;
    const bw = 0.7, bgap = 0.04;
    halfBtns.forEach((b, bi) => {
      const bx = bx0 + bi * (bw + bgap);
      const isSel = e.sel === b.key;
      s.addShape(pres.ShapeType.roundRect, {
        x: bx, y: ey + 0.04, w: bw, h: 0.22,
        fill: { color: isSel ? b.color : "F1F5F9" },
        line: { color: isSel ? b.color : C.border, width: 0.5 },
        rectRadius: 0.04,
      });
      s.addText(b.label, {
        x: bx, y: ey + 0.04, w: bw, h: 0.22,
        fontFace: F.body, fontSize: 7.5, bold: isSel,
        color: isSel ? "FFFFFF" : C.muted,
        align: "center", valign: "middle",
      });
    });
  });

  // Total
  s.addShape(pres.ShapeType.roundRect, {
    x: x + 0.2, y: y + 3.85, w: w - 0.4, h: 0.45,
    fill: { color: "F0F9FF" }, line: { color: "BAE6FD", width: 0.5 }, rectRadius: 0.04,
  });
  s.addText("รวมวันลา", {
    x: x + 0.35, y: y + 3.85, w: 3, h: 0.45,
    fontFace: F.body, fontSize: 11, color: C.muted, valign: "middle",
  });
  s.addText("2.5 วัน", {
    x: x + w - 1.3, y: y + 3.85, w: 1.0, h: 0.45,
    fontFace: F.head, fontSize: 14, bold: true, color: C.steel, align: "right", valign: "middle",
  });

  // Submit
  s.addShape(pres.ShapeType.roundRect, {
    x: x + w - 2.2, y: y + h - 0.6, w: 2.0, h: 0.4,
    fill: { color: C.steel }, line: { color: C.steel, width: 0 }, rectRadius: 0.04,
  });
  s.addText("บันทึกและส่งอนุมัติ", {
    x: x + w - 2.2, y: y + h - 0.6, w: 2.0, h: 0.4,
    fontFace: F.body, fontSize: 10, bold: true, color: "FFFFFF", align: "center", valign: "middle",
  });
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 11 — LEAVE REPORTS & MASTER
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 3, "LEAVE MODULE", C.steel);
  addPageTitle(s, "Leave — Reports & Master Data", "รายงาน + ข้อมูลพื้นฐานที่ HR จัดการเอง");

  // Reports panel (left)
  card(s, 0.6, 1.95, 6.15, 5.05);
  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 1.95, w: 6.15, h: 0.06,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 },
  });
  s.addText("Reports & Excel Export", {
    x: 0.8, y: 2.1, w: 5.8, h: 0.35,
    fontFace: F.head, fontSize: 14, bold: true, color: C.text,
  });
  s.addText("กรองข้อมูลก่อน → preview → Export Excel ได้ทันที", {
    x: 0.8, y: 2.45, w: 5.8, h: 0.3,
    fontFace: F.body, fontSize: 10, color: C.muted, italic: true,
  });

  const reports = [
    { name: "Leave Monthly Report",   cols: "รหัสประเภท · ประเภท · พนักงาน · วัน · สถานะ", excel: true },
    { name: "Leave Balance Report",   cols: "พนักงาน × ประเภท × คงเหลือ + Pro-rate", excel: true },
    { name: "Cancellation Report",    cols: "ใบที่ขอยกเลิก + HR comment + ผลลัพธ์", excel: true },
    { name: "Audit Trail (per ใบ)",   cols: "ทุก action + เวลา + ผู้กระทำ", excel: false },
  ];
  reports.forEach((r, i) => {
    const y = 2.95 + i * 0.95;
    card(s, 0.8, y, 5.75, 0.8, { fill: C.chipBg });
    s.addText(r.name, {
      x: 0.95, y: y + 0.08, w: 4.5, h: 0.3,
      fontFace: F.head, fontSize: 11, bold: true, color: C.navy,
    });
    s.addText(r.cols, {
      x: 0.95, y: y + 0.4, w: 4.5, h: 0.35,
      fontFace: F.body, fontSize: 9.5, color: C.muted,
    });
    if (r.excel) {
      s.addShape(pres.ShapeType.roundRect, {
        x: 5.45, y: y + 0.22, w: 1.0, h: 0.35,
        fill: { color: C.success }, line: { color: C.success, width: 0 }, rectRadius: 0.04,
      });
      s.addText("XLSX ↓", {
        x: 5.45, y: y + 0.22, w: 1.0, h: 0.35,
        fontFace: F.body, fontSize: 9, bold: true, color: "FFFFFF",
        align: "center", valign: "middle",
      });
    }
  });

  // Master Data panel (right)
  card(s, 6.95, 1.95, 5.8, 5.05);
  s.addShape(pres.ShapeType.rect, {
    x: 6.95, y: 1.95, w: 5.8, h: 0.06,
    fill: { color: C.gold }, line: { color: C.gold, width: 0 },
  });
  s.addText("Master Data (ที่เกี่ยวกับการลา)", {
    x: 7.15, y: 2.1, w: 5.5, h: 0.35,
    fontFace: F.head, fontSize: 14, bold: true, color: C.text,
  });
  s.addText("HR Admin จัดการรายการได้เองทั้งหมด — ไม่ต้องรอ Developer", {
    x: 7.15, y: 2.45, w: 5.5, h: 0.3,
    fontFace: F.body, fontSize: 10, color: C.muted, italic: true,
  });

  const masters = [
    { name: "Leave Type",         desc: "Code · ชื่อ · จำนวนวันต่อปี · มี/ไม่มี Pro-rate" },
    { name: "Leave Reject Reason", desc: "Auto-gen Code (LRR001...) · ข้อความ · Active/Inactive" },
    { name: "Carry Over Settings", desc: "Max วันที่ยกไปปีถัดไปต่อประเภท" },
    { name: "Cut-off Time",        desc: "เวลาตัดยอดสร้าง (11:00) / อนุมัติ (13:00)" },
    { name: "Holiday Calendar",    desc: "วันหยุดประจำปี — ไม่นับเป็นวันลา" },
  ];
  masters.forEach((m, i) => {
    const y = 2.95 + i * 0.75;
    s.addShape(pres.ShapeType.rect, {
      x: 7.15, y, w: 0.06, h: 0.6,
      fill: { color: C.gold }, line: { color: C.gold, width: 0 },
    });
    s.addText(m.name, {
      x: 7.35, y, w: 5.3, h: 0.3,
      fontFace: F.head, fontSize: 11, bold: true, color: C.text,
    });
    s.addText(m.desc, {
      x: 7.35, y: y + 0.3, w: 5.3, h: 0.3,
      fontFace: F.body, fontSize: 9.5, color: C.muted,
    });
  });

  addFooter(s, 11, "Leave Module");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 12 — OT USE CASES
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 4, "OT MODULE", C.gold);
  addPageTitle(s, "OT Module — Use Cases", "ผู้เกี่ยวข้องและการใช้งานหลัก");

  // System boundary
  s.addShape(pres.ShapeType.roundRect, {
    x: 2.8, y: 2.0, w: 7.7, h: 5.0,
    fill: { color: "FFFFFF" }, line: { color: C.borderDark, width: 1 },
    rectRadius: 0.08,
  });
  s.addText("OT Management Module", {
    x: 2.8, y: 2.05, w: 7.7, h: 0.3,
    fontFace: F.body, fontSize: 10, color: C.muted, italic: true,
    align: "center", valign: "middle",
  });

  drawActor(s, 0.6, 2.3, "Supervisor", C.gold);
  drawActor(s, 0.6, 3.3, "Dept Manager", C.navy);
  drawActor(s, 0.6, 4.3, "Factory Mgr", C.navy);
  drawActor(s, 0.6, 5.3, "HR Admin", C.steel);

  const ucs = [
    { x: 3.1, y: 2.6, w: 2.2, h: 0.6, label: "สร้างใบ OT (proxy)" },
    { x: 5.6, y: 2.6, w: 2.2, h: 0.6, label: "เลือกพนักงาน + สายรถ" },
    { x: 8.1, y: 2.6, w: 2.2, h: 0.6, label: "Cross-dept Request" },
    { x: 3.1, y: 3.5, w: 2.2, h: 0.6, label: "Approve/Reject รายคน" },
    { x: 5.6, y: 3.5, w: 2.2, h: 0.6, label: "อนุมัติ Step 1" },
    { x: 8.1, y: 3.5, w: 2.2, h: 0.6, label: "Bulk Approve/Reject" },
    { x: 3.1, y: 4.4, w: 2.2, h: 0.6, label: "อนุมัติ Step 2 (ผลิต)" },
    { x: 5.6, y: 4.4, w: 2.2, h: 0.6, label: "ขอยกเลิก OT" },
    { x: 8.1, y: 4.4, w: 2.2, h: 0.6, label: "Memo ไม่มาทำ OT" },
    { x: 3.1, y: 5.3, w: 2.2, h: 0.6, label: "จัดการสายรถ + ค่า default" },
    { x: 5.6, y: 5.3, w: 2.2, h: 0.6, label: "อนุมัติยกเลิก OT" },
    { x: 8.1, y: 5.3, w: 2.2, h: 0.6, label: "Bus Route Summary" },
    { x: 5.6, y: 6.2, w: 2.2, h: 0.6, label: "Export Excel + Filter กะ" },
  ];
  ucs.forEach((u) => drawUseCase(s, u.x, u.y, u.w, u.h, u.label, C.gold));

  // Right legend
  card(s, 10.7, 2.0, 2.05, 5.0, { fill: C.chipBg });
  s.addText("Highlights", {
    x: 10.8, y: 2.1, w: 1.85, h: 0.3,
    fontFace: F.head, fontSize: 11, bold: true, color: C.navy,
  });
  s.addText([
    { text: "Approve/Reject\n", options: { bold: true, color: C.navy } },
    { text: "รายคน — ผู้อนุมัติเลือกได้\n\n", options: { color: C.text } },
    { text: "Cross-dept\n", options: { bold: true, color: C.navy } },
    { text: "ยืมพนักงานข้ามแผนก + FYI Email\n\n", options: { color: C.text } },
    { text: "Bus Route\n", options: { bold: true, color: C.navy } },
    { text: "Default ต่อพนักงาน + Override รายคน", options: { color: C.text } },
  ], {
    x: 10.8, y: 2.5, w: 1.85, h: 4.4,
    fontFace: F.body, fontSize: 10, color: C.text, lineSpacing: 14,
  });

  addFooter(s, 12, "OT Module");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 13 — OT WORKFLOW (Per-emp Approve/Reject)
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 4, "OT MODULE", C.gold);
  addPageTitle(s, "OT Workflow — Per-employee Approve/Reject", "ผู้อนุมัติเลือกได้ว่าจะ approve/reject ใครภายในใบเดียว");

  // Top: standard approval flow
  s.addText("Standard Flow (Office 2-step / Production 3-step)", {
    x: 0.7, y: 1.95, w: 12, h: 0.3,
    fontFace: F.head, fontSize: 12, bold: true, color: C.navy,
  });
  const stepY = 2.4, stepW = 1.85, stepH = 0.8;
  const flow = [
    { title: "หัวหน้า", sub: "สร้าง + เลือกคน", color: C.gold },
    { title: "ผจก.แผนก", sub: "อนุมัติ Step 1", color: C.navy },
    { title: "ผจก.โรงงาน", sub: "Step 2 (ผลิต)", color: C.navy },
    { title: "APPROVED", sub: "OT พร้อมทำ", color: C.success },
  ];
  let sx = 0.7;
  flow.forEach((st, i) => {
    drawFlowStep(s, sx, stepY, stepW, stepH, st.title, st.sub, st.color);
    if (i < flow.length - 1) drawArrow(s, sx + stepW + 0.05, stepY + 0.2);
    sx += stepW + 0.4;
  });
  // HR fast-track
  card(s, 9.7, 2.4, 3.05, 0.8, { fill: "FEF3C7", borderColor: C.gold });
  s.addText("HR Fast-track", {
    x: 9.85, y: 2.45, w: 2.8, h: 0.25,
    fontFace: F.head, fontSize: 11, bold: true, color: C.warning,
  });
  s.addText("ข้ามทุก step → APPROVED", {
    x: 9.85, y: 2.72, w: 2.8, h: 0.3,
    fontFace: F.body, fontSize: 10, color: C.text,
  });

  // Decision: per-emp approve/reject explanation
  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 3.6, w: 12.13, h: 0.04,
    fill: { color: C.borderDark }, line: { color: C.borderDark, width: 0 },
  });
  s.addText("Per-employee Approve/Reject Logic", {
    x: 0.7, y: 3.8, w: 12, h: 0.3,
    fontFace: F.head, fontSize: 13, bold: true, color: C.navy,
  });
  s.addText("ในใบ OT 1 ใบที่มีหลายคน ผู้อนุมัติเปิด dialog แล้วเลือก (ติ๊ก) รายชื่อ — ระบบประมวลตามปุ่มที่กด:", {
    x: 0.7, y: 4.15, w: 12, h: 0.3,
    fontFace: F.body, fontSize: 11, color: C.muted, italic: true,
  });

  // Two outcome boxes
  card(s, 0.7, 4.6, 5.95, 2.3, { fill: "ECFDF5", borderColor: C.success });
  s.addText("เมื่อกด ✓ อนุมัติ", {
    x: 0.9, y: 4.7, w: 5.5, h: 0.35,
    fontFace: F.head, fontSize: 13, bold: true, color: C.success,
  });
  s.addText([
    { text: "ติ๊ก", options: { bold: true } },
    { text: " → APPROVED  (Office จบ / ผลิต รอ Step ถัดไป)\n", options: {} },
    { text: "ไม่ติ๊ก", options: { bold: true } },
    { text: " → ", options: {} },
    { text: "ลบออกจากใบ OT", options: { bold: true, color: C.muted } },
    { text: " (หายไป ไม่นับ ไม่แสดง)\n\n", options: {} },
    { text: "เช่น ใบ OT มี 5 คน → ติ๊ก 3 → 3 คน APPROVED, อีก 2 คนถูกลบ", options: { color: C.muted, fontSize: 10, italic: true } },
  ], {
    x: 0.9, y: 5.1, w: 5.6, h: 1.7,
    fontFace: F.body, fontSize: 11, color: C.text, lineSpacing: 18,
  });

  card(s, 6.8, 4.6, 5.95, 2.3, { fill: "FEF2F2", borderColor: C.danger });
  s.addText("เมื่อกด ✗ ปฏิเสธ", {
    x: 7.0, y: 4.7, w: 5.5, h: 0.35,
    fontFace: F.head, fontSize: 13, bold: true, color: C.danger,
  });
  s.addText([
    { text: "ติ๊ก", options: { bold: true } },
    { text: " → REJECTED  (มี audit trail + แสดงเหตุผล)\n", options: {} },
    { text: "ไม่ติ๊ก", options: { bold: true } },
    { text: " → ", options: {} },
    { text: "ผ่าน (APPROVED)", options: { bold: true, color: C.success } },
    { text: " ทำ OT ต่อตามปกติ\n\n", options: {} },
    { text: "เช่น ใบ OT มี 5 คน → ติ๊ก 1 → 1 คน REJECTED, อีก 4 คน APPROVED", options: { color: C.muted, fontSize: 10, italic: true } },
  ], {
    x: 7.0, y: 5.1, w: 5.6, h: 1.7,
    fontFace: F.body, fontSize: 11, color: C.text, lineSpacing: 18,
  });

  addFooter(s, 13, "OT Module");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 14 — OT SPECIAL FLOWS (Cross-dept + Cancel/Memo)
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 4, "OT MODULE", C.gold);
  addPageTitle(s, "OT — Special Flows", "Cross-dept Request + Cancel / Memo");

  // ── LEFT: Cross-dept ──
  s.addText("1.  Cross-department OT Request", {
    x: 0.7, y: 1.95, w: 6, h: 0.3,
    fontFace: F.head, fontSize: 13, bold: true, color: C.navy,
  });
  s.addText("หัวหน้ายืมพนักงานต่างแผนกมาทำ OT ได้ — หัวหน้าแผนกต้นสังกัดเป็น FYI", {
    x: 0.7, y: 2.3, w: 6, h: 0.3,
    fontFace: F.body, fontSize: 10.5, color: C.muted, italic: true,
  });

  // Cross-dept diagram
  drawFlowStep(s, 0.7, 2.85, 1.95, 0.8, "หัวหน้า A", "แผนกตน", C.gold);
  drawFlowStep(s, 0.7, 3.85, 1.95, 0.8, "เลือกพนักงาน", "แผนก A + แผนก B", C.steel);
  drawArrow(s, 2.7, 4.05);
  drawFlowStep(s, 3.15, 3.85, 1.95, 0.8, "สร้างใบ OT", "ส่งอนุมัติ", C.navy);

  // Two branches
  s.addShape(pres.ShapeType.line, {
    x: 4.13, y: 4.65, w: 0, h: 0.4,
    line: { color: C.borderDark, width: 1, dashType: "dash" },
  });
  drawFlowStep(s, 0.7, 5.1, 2.85, 0.8, "ผจก.แผนก A", "อนุมัติ (Standard)", C.success);
  drawFlowStep(s, 3.75, 5.1, 2.85, 0.8, "ผจก.แผนก B", "FYI Email (ไม่ต้อง approve)", C.warning);

  s.addText("ผลลัพธ์:", {
    x: 0.7, y: 6.1, w: 1.5, h: 0.3,
    fontFace: F.head, fontSize: 10, bold: true, color: C.text,
  });
  s.addText("ใบ OT เดินตาม workflow ปกติ (ผจก.A ตัดสิน) + ผจก.B รับทราบว่าลูกน้องไปทำ OT", {
    x: 1.7, y: 6.1, w: 5, h: 0.6,
    fontFace: F.body, fontSize: 10, color: C.muted, lineSpacing: 14,
  });

  // ── RIGHT: Cancel / Memo ──
  s.addText("2.  Cancel + Memo Flow", {
    x: 7.0, y: 1.95, w: 6, h: 0.3,
    fontFace: F.head, fontSize: 13, bold: true, color: C.navy,
  });
  s.addText("ยกเลิกใบ OT หลังอนุมัติ + Memo เมื่อพนักงานไม่มาทำ OT", {
    x: 7.0, y: 2.3, w: 6, h: 0.3,
    fontFace: F.body, fontSize: 10.5, color: C.muted, italic: true,
  });

  // Cancel (after approve)
  card(s, 7.0, 2.85, 5.75, 1.65, { fill: "FFF9E6", borderColor: C.gold });
  s.addText("Cancel หลังได้รับอนุมัติ", {
    x: 7.2, y: 2.9, w: 5.5, h: 0.3,
    fontFace: F.head, fontSize: 12, bold: true, color: C.warning,
  });
  s.addText("เจ้าของ → ขอยกเลิก (พร้อมเหตุผล) → HR review → ถ้าอนุมัติ ใบ OT เป็น CANCELLED + พนักงานในใบไม่ได้เงิน OT", {
    x: 7.2, y: 3.25, w: 5.5, h: 1.1,
    fontFace: F.body, fontSize: 10.5, color: C.text, lineSpacing: 16,
  });

  // Memo (no-show)
  card(s, 7.0, 4.7, 5.75, 1.75, { fill: "FEF2F2", borderColor: C.danger });
  s.addText("Memo ไม่มาทำ OT (ระหว่าง/หลัง OT)", {
    x: 7.2, y: 4.75, w: 5.5, h: 0.3,
    fontFace: F.head, fontSize: 12, bold: true, color: C.danger,
  });
  s.addText([
    { text: "หัวหน้า / HR ระบุพนักงานที่ไม่มาทำ OT (Memo) → ระบบ:\n", options: { color: C.text } },
    { text: "• ตั้ง attended = false สำหรับคนนั้น\n", options: { color: C.text } },
    { text: "• ตัดออกจากรายงานชั่วโมง OT\n", options: { color: C.text } },
    { text: "• Email แจ้ง HR เพื่อใช้คำนวณ payroll ที่ถูกต้อง", options: { color: C.text } },
  ], {
    x: 7.2, y: 5.05, w: 5.5, h: 1.4,
    fontFace: F.body, fontSize: 10.5, color: C.text, lineSpacing: 16,
  });

  addFooter(s, 14, "OT Module");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 15 — OT FEATURES + MOCKUP
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 4, "OT MODULE", C.gold);
  addPageTitle(s, "OT — Key Features", "ความสามารถหลักของโมดูล OT");

  const features = [
    { h: "Day / Night Shift + Preset เวลา", d: "เลือกกะแล้วได้ preset เวลา 6 ช่วงมาตรฐาน — คลิกครั้งเดียวจบ" },
    { h: "สายรถผูก default ต่อพนักงาน", d: "ติ๊กพนักงาน → สายรถ auto-fill — Override รายคนได้ถ้ามีเปลี่ยนแปลง" },
    { h: "ลักษณะงาน + Remark รายคน", d: "แต่ละคนกรอกงานต่างกันได้ + Remark กรณีอยู่ต่อ/เลิกก่อนเวลา" },
    { h: "Per-emp Approve/Reject", d: "ผู้อนุมัติเลือกได้รายคน — Approve→ลบไม่ติ๊ก / Reject→ผ่านไม่ติ๊ก" },
    { h: "Cross-dept + FYI Email", d: "ยืมพนักงานต่างแผนก ส่ง email แจ้งหัวหน้าต้นสังกัด (ไม่ต้องอนุมัติ)" },
    { h: "OT วันหยุด + Memo No-show", d: "รองรับ OT วันหยุด + Memo ตัดชื่อพนักงานที่ไม่มาออกจากรายงาน" },
  ];
  features.forEach((f, i) => {
    const y = 2.0 + i * 0.78;
    s.addShape(pres.ShapeType.ellipse, {
      x: 0.7, y, w: 0.35, h: 0.35,
      fill: { color: C.gold }, line: { color: C.gold, width: 0 },
    });
    s.addText(String(i + 1), {
      x: 0.7, y, w: 0.35, h: 0.35,
      fontFace: F.head, fontSize: 11, bold: true, color: "FFFFFF",
      align: "center", valign: "middle",
    });
    s.addText(f.h, {
      x: 1.2, y: y - 0.05, w: 5.5, h: 0.35,
      fontFace: F.head, fontSize: 12, bold: true, color: C.text,
    });
    s.addText(f.d, {
      x: 1.2, y: y + 0.28, w: 5.5, h: 0.4,
      fontFace: F.body, fontSize: 10, color: C.muted, lineSpacing: 14,
    });
  });

  drawOTMockup(s, 7.3, 1.95, 5.45, 5.0);

  addFooter(s, 15, "OT Module");
}

function drawOTMockup(s, x, y, w, h) {
  drawBrowserFrame(s, x, y, w, h, "ams.local / ot / create");

  s.addText("สร้าง OT", {
    x: x + 0.2, y: y + 0.5, w: w - 0.4, h: 0.35,
    fontFace: F.head, fontSize: 14, bold: true, color: C.text,
  });

  // Shift selector
  s.addText("กะ", { x: x + 0.2, y: y + 0.95, w: 1, h: 0.2, fontFace: F.body, fontSize: 8, color: C.muted });
  s.addShape(pres.ShapeType.roundRect, {
    x: x + 0.2, y: y + 1.15, w: 2.4, h: 0.4,
    fill: { color: "FFF7E6" }, line: { color: C.gold, width: 1.2 }, rectRadius: 0.04,
  });
  s.addText("Day (กลางวัน)", {
    x: x + 0.2, y: y + 1.15, w: 2.4, h: 0.4,
    fontFace: F.body, fontSize: 10, bold: true, color: C.warning, align: "center", valign: "middle",
  });
  s.addShape(pres.ShapeType.roundRect, {
    x: x + 2.7, y: y + 1.15, w: 2.0, h: 0.4,
    fill: { color: "FFFFFF" }, line: { color: C.border, width: 1 }, rectRadius: 0.04,
  });
  s.addText("Night", {
    x: x + 2.7, y: y + 1.15, w: 2.0, h: 0.4,
    fontFace: F.body, fontSize: 10, color: C.muted, align: "center", valign: "middle",
  });

  // Time slots
  const slots = [
    { t: "07:30 - 16:10", h: "8.67 ชม.", sel: false },
    { t: "07:30 - 19:30", h: "12.00 ชม.", sel: false },
    { t: "17:00 - 19:30", h: "2.50 ชม.", sel: true },
  ];
  slots.forEach((sl, i) => {
    const sy = y + 1.7 + i * 0.4;
    s.addShape(pres.ShapeType.roundRect, {
      x: x + 0.2, y: sy, w: w - 0.4, h: 0.32,
      fill: { color: sl.sel ? "EFF6FF" : "FFFFFF" },
      line: { color: sl.sel ? C.steel : C.border, width: sl.sel ? 1.2 : 0.5 },
      rectRadius: 0.04,
    });
    s.addText((sl.sel ? "●" : "○") + "   " + sl.t, {
      x: x + 0.3, y: sy, w: 3, h: 0.32,
      fontFace: F.body, fontSize: 10, color: sl.sel ? C.steel : C.text,
      bold: sl.sel, valign: "middle",
    });
    s.addText(sl.h, {
      x: x + w - 1.2, y: sy, w: 0.95, h: 0.32,
      fontFace: F.body, fontSize: 9, color: C.muted, align: "right", valign: "middle",
    });
  });

  // Employee + bus route summary
  s.addShape(pres.ShapeType.roundRect, {
    x: x + 0.2, y: y + 3.05, w: w - 0.4, h: 0.45,
    fill: { color: "F8FAFC" }, line: { color: C.border, width: 0.5 }, rectRadius: 0.04,
  });
  s.addText("สายรถของแต่ละคน — 5 พนักงาน (Override ได้รายคน)", {
    x: x + 0.3, y: y + 3.05, w: w - 0.5, h: 0.45,
    fontFace: F.body, fontSize: 10, color: C.text, valign: "middle",
  });

  // Per-emp work desc note
  s.addShape(pres.ShapeType.roundRect, {
    x: x + 0.2, y: y + 3.6, w: w - 0.4, h: 0.45,
    fill: { color: "F8FAFC" }, line: { color: C.border, width: 0.5 }, rectRadius: 0.04,
  });
  s.addText("ลักษณะงาน + Remark แยกตามคน — ใส่ \"อยู่ต่อ 21:00\" ได้รายคน", {
    x: x + 0.3, y: y + 3.6, w: w - 0.5, h: 0.45,
    fontFace: F.body, fontSize: 10, color: C.text, valign: "middle",
  });

  // Total
  s.addShape(pres.ShapeType.roundRect, {
    x: x + 0.2, y: y + 4.15, w: w - 0.4, h: 0.5,
    fill: { color: "FFF7E6" }, line: { color: C.gold, width: 0.5 }, rectRadius: 0.04,
  });
  s.addText("รวม 2.50 ชม. × 5 คน", {
    x: x + 0.3, y: y + 4.15, w: w - 0.5, h: 0.5,
    fontFace: F.body, fontSize: 11, bold: true, color: C.warning, valign: "middle",
  });
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 16 — OT REPORTS
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 4, "OT MODULE", C.gold);
  addPageTitle(s, "OT — Reports & Bus Route Summary", "รายงาน OT + สรุปการใช้สายรถ");

  // Filter card (top)
  card(s, 0.6, 1.95, 12.15, 0.8, { fill: C.chipBg });
  s.addText("Filter:", {
    x: 0.85, y: 1.95, w: 1, h: 0.8,
    fontFace: F.head, fontSize: 11, bold: true, color: C.navy, valign: "middle",
  });
  const chips = ["ทั้งเดือน", "เฉพาะกะ Day", "เฉพาะกะ Night", "แผนก: ทั้งหมด", "OT วันหยุด"];
  let cx = 1.65;
  chips.forEach((ch, i) => {
    const cw = 1.55;
    s.addShape(pres.ShapeType.roundRect, {
      x: cx, y: 2.1, w: cw, h: 0.5,
      fill: { color: i === 0 ? C.gold : "FFFFFF" },
      line: { color: i === 0 ? C.gold : C.border, width: 0.75 },
      rectRadius: 0.05,
    });
    s.addText(ch, {
      x: cx, y: 2.1, w: cw, h: 0.5,
      fontFace: F.body, fontSize: 10, bold: i === 0, color: i === 0 ? "FFFFFF" : C.text,
      align: "center", valign: "middle",
    });
    cx += cw + 0.1;
  });

  // Bus Route Summary table
  s.addText("Bus Route Summary", {
    x: 0.6, y: 3.0, w: 6, h: 0.3,
    fontFace: F.head, fontSize: 13, bold: true, color: C.navy,
  });
  s.addText("สรุปสายรถ × จำนวนคน-ครั้ง × คนต่างๆ × จำนวนวัน", {
    x: 0.6, y: 3.35, w: 6, h: 0.25,
    fontFace: F.body, fontSize: 10, color: C.muted, italic: true,
  });

  // Mini table
  const tbl = {
    x: 0.6, y: 3.7, headers: ["สายรถ", "คน-ครั้ง", "คนต่างๆ", "วัน"],
    cols: [2.5, 1.2, 1.2, 1.0],
    rows: [
      ["ซอย สันติ์นคร", "25", "8", "4"],
      ["เกียรติธานี",   "18", "6", "3"],
      ["วัดบางบ่อ",     "12", "4", "3"],
      ["ซอยอนามัย",   "9",  "3", "2"],
    ],
  };
  const totalW = tbl.cols.reduce((a, b) => a + b, 0);
  // Header
  s.addShape(pres.ShapeType.rect, {
    x: tbl.x, y: tbl.y, w: totalW, h: 0.4,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 },
  });
  let hx = tbl.x;
  tbl.headers.forEach((h, i) => {
    s.addText(h, {
      x: hx + 0.05, y: tbl.y, w: tbl.cols[i] - 0.1, h: 0.4,
      fontFace: F.head, fontSize: 10, bold: true, color: "FFFFFF",
      align: i === 0 ? "left" : "center", valign: "middle",
    });
    hx += tbl.cols[i];
  });
  // Rows
  tbl.rows.forEach((row, ri) => {
    const ry = tbl.y + 0.4 + ri * 0.4;
    s.addShape(pres.ShapeType.rect, {
      x: tbl.x, y: ry, w: totalW, h: 0.4,
      fill: { color: ri % 2 === 0 ? "FFFFFF" : C.chipBg },
      line: { color: C.border, width: 0.25 },
    });
    let rx = tbl.x;
    row.forEach((cell, ci) => {
      s.addText(cell, {
        x: rx + 0.05, y: ry, w: tbl.cols[ci] - 0.1, h: 0.4,
        fontFace: F.body, fontSize: 10, color: C.text,
        align: ci === 0 ? "left" : "center", valign: "middle",
      });
      rx += tbl.cols[ci];
    });
  });

  // Right: Excel structure
  card(s, 7.3, 3.0, 5.45, 4.0);
  s.addShape(pres.ShapeType.rect, {
    x: 7.3, y: 3.0, w: 5.45, h: 0.06,
    fill: { color: C.success }, line: { color: C.success, width: 0 },
  });
  s.addText("Excel Export — 2 Sheets", {
    x: 7.5, y: 3.15, w: 5.05, h: 0.3,
    fontFace: F.head, fontSize: 13, bold: true, color: C.text,
  });

  // Sheet 1
  card(s, 7.5, 3.65, 5.05, 1.55, { fill: C.chipBg });
  s.addText("Sheet 1:  OT-yyyy-mm", {
    x: 7.65, y: 3.7, w: 4.5, h: 0.3,
    fontFace: F.head, fontSize: 11, bold: true, color: C.navy,
  });
  s.addText("รายการ OT ทั้งหมด: วันที่ · พนักงาน · แผนก · กะ · เวลา · ชม. · สายรถ · ลักษณะงาน · Remark", {
    x: 7.65, y: 4.05, w: 4.75, h: 1.1,
    fontFace: F.body, fontSize: 10, color: C.text, lineSpacing: 16,
  });

  // Sheet 2
  card(s, 7.5, 5.4, 5.05, 1.55, { fill: C.chipBg });
  s.addText("Sheet 2:  สรุปสายรถ", {
    x: 7.65, y: 5.45, w: 4.5, h: 0.3,
    fontFace: F.head, fontSize: 11, bold: true, color: C.navy,
  });
  s.addText("Aggregate: สายรถ × จำนวนคน-ครั้ง × คนต่างๆ (unique) × จำนวนวัน — Ready for ฝ่ายรถบริการ", {
    x: 7.65, y: 5.8, w: 4.75, h: 1.1,
    fontFace: F.body, fontSize: 10, color: C.text, lineSpacing: 16,
  });

  addFooter(s, 16, "OT Module");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 17 — NOTIFICATION & EMAIL FLOW
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 5, "CROSS-CUTTING FEATURES");
  addPageTitle(s, "Notification & Email Flow", "การแจ้งเตือนทุก action — ครอบคลุม CC HR + FYI ข้ามแผนก");

  // Triggers table (left)
  s.addText("Trigger → Recipient", {
    x: 0.6, y: 1.95, w: 7, h: 0.3,
    fontFace: F.head, fontSize: 13, bold: true, color: C.navy,
  });

  const triggers = [
    { action: "สร้างใบลา / OT",        to: "ผจก.แผนก",                   cc: "HR" },
    { action: "อนุมัติ Step 1",         to: "ผู้สร้างใบ",                  cc: "HR + (ผจก.โรงงาน ถ้าผลิต)" },
    { action: "อนุมัติ Final",          to: "ผู้สร้าง + พนักงานที่ลา",   cc: "HR" },
    { action: "ปฏิเสธ + เหตุผล",        to: "ผู้สร้างใบ",                  cc: "HR" },
    { action: "ยกเลิกใบลา (pending)",   to: "ผู้อนุมัติ",                   cc: "HR" },
    { action: "ขอยกเลิกใบลา (approved)", to: "HR (review)",                 cc: "ผู้อนุมัติเดิม" },
    { action: "Cross-dept OT",          to: "ผจก.แผนก ของพนักงาน (FYI)", cc: "HR" },
    { action: "Memo ไม่มาทำ OT",        to: "HR + ผจก.แผนก",            cc: "—" },
  ];
  const ty = 2.4;
  // Header row
  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: ty, w: 7.5, h: 0.35,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 },
  });
  ["Action / Trigger", "To", "CC"].forEach((h, i) => {
    const xs = [0.7, 3.7, 5.85];
    const ws = [3.0, 2.15, 2.15];
    s.addText(h, {
      x: xs[i], y: ty, w: ws[i], h: 0.35,
      fontFace: F.head, fontSize: 10, bold: true, color: "FFFFFF",
      valign: "middle",
    });
  });
  triggers.forEach((t, i) => {
    const y = ty + 0.35 + i * 0.4;
    s.addShape(pres.ShapeType.rect, {
      x: 0.6, y, w: 7.5, h: 0.4,
      fill: { color: i % 2 === 0 ? "FFFFFF" : C.chipBg },
      line: { color: C.border, width: 0.25 },
    });
    s.addText(t.action, {
      x: 0.7, y, w: 3.0, h: 0.4,
      fontFace: F.body, fontSize: 9.5, color: C.text, valign: "middle",
    });
    s.addText(t.to, {
      x: 3.7, y, w: 2.15, h: 0.4,
      fontFace: F.body, fontSize: 9.5, color: C.text, valign: "middle",
    });
    s.addText(t.cc, {
      x: 5.85, y, w: 2.15, h: 0.4,
      fontFace: F.body, fontSize: 9.5, color: C.muted, italic: true, valign: "middle",
    });
  });

  // Email preview (right)
  card(s, 8.3, 2.0, 4.45, 5.05);
  s.addShape(pres.ShapeType.rect, {
    x: 8.3, y: 2.0, w: 4.45, h: 0.55,
    fill: { color: C.success }, line: { color: C.success, width: 0 },
  });
  s.addText("OT ได้รับอนุมัติ", {
    x: 8.5, y: 2.1, w: 4, h: 0.35,
    fontFace: F.head, fontSize: 12, bold: true, color: "FFFFFF",
  });

  const lines = [
    ["เลขที่:",   "OT260605-7462"],
    ["วันที่:",    "5 มิ.ย. 2569"],
    ["เวลา:",     "17:00 - 19:30  (2.5 ชม.)"],
    ["พนักงาน:", "1 คน — ชฎาพร ชูเรือง"],
    ["สายรถ:",   "เกียรติธานี"],
    ["สถานะ:",   "อนุมัติแล้ว"],
    ["อนุมัติโดย:", "วิชัย บริหารดี"],
  ];
  lines.forEach((ln, i) => {
    const y = 2.75 + i * 0.42;
    s.addText(ln[0], {
      x: 8.5, y, w: 1.4, h: 0.3,
      fontFace: F.body, fontSize: 10, color: C.muted, valign: "middle",
    });
    s.addText(ln[1], {
      x: 9.85, y, w: 2.85, h: 0.3,
      fontFace: F.body, fontSize: 10, color: C.text, bold: true, valign: "middle",
    });
  });

  // CTA button in email
  s.addShape(pres.ShapeType.roundRect, {
    x: 9.4, y: 6.0, w: 2.25, h: 0.5,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 }, rectRadius: 0.05,
  });
  s.addText("ดู OT ในระบบ →", {
    x: 9.4, y: 6.0, w: 2.25, h: 0.5,
    fontFace: F.body, fontSize: 11, bold: true, color: "FFFFFF",
    align: "center", valign: "middle",
  });

  addFooter(s, 17, "Cross-cutting");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 18 — CUT-OFF + CARRY-OVER LOGIC
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 5, "CROSS-CUTTING FEATURES");
  addPageTitle(s, "Cut-off Time & Carry-over Logic", "การควบคุมเวลา และ Auto carry-over วันลา");

  // Cut-off (top)
  card(s, 0.6, 1.95, 12.15, 2.35);
  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 1.95, w: 12.15, h: 0.06,
    fill: { color: C.warning }, line: { color: C.warning, width: 0 },
  });
  s.addText("Cut-off Time — ตัดยอดการสร้างและอนุมัติแต่ละวัน", {
    x: 0.8, y: 2.1, w: 12, h: 0.35,
    fontFace: F.head, fontSize: 14, bold: true, color: C.text,
  });
  s.addText("เพื่อให้ HR สามารถปิดยอด, รวบรวมรายการ, ส่งเข้า Payroll ได้ตามรอบเวลามาตรฐาน", {
    x: 0.8, y: 2.45, w: 12, h: 0.3,
    fontFace: F.body, fontSize: 11, color: C.muted, italic: true,
  });

  // Timeline visualization
  const tlY = 3.1, tlX = 0.9, tlW = 11.65, tickH = 0.4;
  s.addShape(pres.ShapeType.rect, {
    x: tlX, y: tlY, w: tlW, h: 0.02,
    fill: { color: C.borderDark }, line: { color: C.borderDark, width: 0 },
  });
  const ticks = [
    { time: "08:00", label: "เริ่มงาน",       x: 0.0,  color: C.muted },
    { time: "11:00", label: "Cut-off สร้าง",  x: 0.35, color: C.warning },
    { time: "13:00", label: "Cut-off อนุมัติ", x: 0.55, color: C.danger },
    { time: "17:00", label: "เลิกงาน",       x: 0.95, color: C.muted },
  ];
  ticks.forEach((t) => {
    const tx = tlX + t.x * tlW;
    s.addShape(pres.ShapeType.rect, {
      x: tx - 0.01, y: tlY - 0.15, w: 0.04, h: 0.3,
      fill: { color: t.color }, line: { color: t.color, width: 0 },
    });
    s.addText(t.time, {
      x: tx - 0.5, y: tlY - 0.55, w: 1.0, h: 0.3,
      fontFace: F.head, fontSize: 10, bold: true, color: t.color, align: "center",
    });
    s.addText(t.label, {
      x: tx - 0.7, y: tlY + 0.25, w: 1.4, h: 0.3,
      fontFace: F.body, fontSize: 9.5, color: t.color, align: "center",
    });
  });

  s.addText("ทุก setting แก้ไขได้ใน /settings/cut-off-time · เปิด/ปิด Enforcement ได้ตามต้องการ", {
    x: 0.8, y: 3.85, w: 12, h: 0.3,
    fontFace: F.body, fontSize: 10, color: C.muted, italic: true, align: "center",
  });

  // Carry-over (bottom)
  card(s, 0.6, 4.5, 12.15, 2.5);
  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 4.5, w: 12.15, h: 0.06,
    fill: { color: C.steel }, line: { color: C.steel, width: 0 },
  });
  s.addText("Auto Carry-over — โอนวันลาเหลือสู่ปีถัดไปอัตโนมัติ", {
    x: 0.8, y: 4.65, w: 12, h: 0.35,
    fontFace: F.head, fontSize: 14, bold: true, color: C.text,
  });

  // Visual: 4 employee examples
  const cwd = 2.85, cyy = 5.2, gx2 = 0.15;
  const examples = [
    { name: "นาย ก.", last: "10 → ยก 5 (max)",   next: "10 + 5 = 15", over: 5 },
    { name: "นาง ข.", last: "3 → ยก 3",          next: "10 + 3 = 13", over: 3 },
    { name: "นาย ค.", last: "0 → ไม่ยก",         next: "10 + 0 = 10", over: 0 },
    { name: "นาง ง.", last: "12 → ยก 5 (max)",  next: "10 + 5 = 15", over: 5 },
  ];
  examples.forEach((e, i) => {
    const x = 0.85 + i * (cwd + gx2);
    card(s, x, cyy, cwd, 1.55, { fill: C.chipBg });
    s.addText(e.name, {
      x: x + 0.15, y: cyy + 0.1, w: cwd - 0.3, h: 0.3,
      fontFace: F.head, fontSize: 12, bold: true, color: C.navy,
    });
    s.addText("ปีที่แล้วเหลือ:", {
      x: x + 0.15, y: cyy + 0.5, w: cwd - 0.3, h: 0.25,
      fontFace: F.body, fontSize: 9, color: C.muted,
    });
    s.addText(e.last, {
      x: x + 0.15, y: cyy + 0.72, w: cwd - 0.3, h: 0.25,
      fontFace: F.body, fontSize: 10, color: C.text,
    });
    s.addText("ปีนี้รวม:", {
      x: x + 0.15, y: cyy + 1.0, w: cwd - 0.3, h: 0.25,
      fontFace: F.body, fontSize: 9, color: C.muted,
    });
    s.addText(e.next, {
      x: x + 0.15, y: cyy + 1.22, w: cwd - 0.3, h: 0.3,
      fontFace: F.head, fontSize: 11, bold: true, color: C.success,
    });
  });

  addFooter(s, 18, "Cross-cutting");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 19 — MASTER DATA MANAGEMENT
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 5, "CROSS-CUTTING FEATURES");
  addPageTitle(s, "Master Data Management", "HR Admin จัดการข้อมูลพื้นฐานได้เองทั้งหมด");

  const masters = [
    { name: "Employee",            color: C.navy,
      desc: "รหัสพนักงาน · ชื่อ-สกุล · แผนก · ตำแหน่ง · วันที่เริ่มงาน · หัวหน้า · สายรถ default · Email" },
    { name: "Department",          color: C.navy,
      desc: "รหัส · ชื่อแผนก · ฝ่าย Office/Production · ผู้จัดการแผนก" },
    { name: "Leave Type",          color: C.steel,
      desc: "Code · ชื่อประเภท · จำนวนวันต่อปี · มี Pro-rate · Max Carry-over · Active/Inactive" },
    { name: "Leave Reject Reason", color: C.steel,
      desc: "Code Auto-gen (LRR001, LRR002, ...) · ข้อความ · Active/Inactive" },
    { name: "Bus Route",           color: C.gold,
      desc: "ชื่อสาย · เส้นทาง · ใช้กับฝ่าย · Active/Inactive" },
    { name: "System Settings",     color: C.gold,
      desc: "Cut-off Time · Carry-over Rules · SMTP · HR Email" },
  ];
  const cw = 3.95, ch = 2.0, sx = 0.6, sy = 2.0, gx = 0.27, gy = 0.27;
  masters.forEach((m, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = sx + col * (cw + gx);
    const y = sy + row * (ch + gy);
    card(s, x, y, cw, ch);
    s.addShape(pres.ShapeType.rect, {
      x, y, w: 0.06, h: ch,
      fill: { color: m.color }, line: { color: m.color, width: 0 },
    });
    s.addText(m.name, {
      x: x + 0.25, y: y + 0.2, w: cw - 0.45, h: 0.35,
      fontFace: F.head, fontSize: 15, bold: true, color: C.text,
    });
    s.addText(m.desc, {
      x: x + 0.25, y: y + 0.65, w: cw - 0.45, h: ch - 0.85,
      fontFace: F.body, fontSize: 11, color: C.muted, lineSpacing: 18,
    });
    // CRUD chip bottom-right
    s.addShape(pres.ShapeType.roundRect, {
      x: x + cw - 1.0, y: y + ch - 0.45, w: 0.85, h: 0.3,
      fill: { color: C.chipBg }, line: { color: C.borderDark, width: 0.5 }, rectRadius: 0.04,
    });
    s.addText("CRUD", {
      x: x + cw - 1.0, y: y + ch - 0.45, w: 0.85, h: 0.3,
      fontFace: F.body, fontSize: 9, bold: true, color: C.muted,
      align: "center", valign: "middle",
    });
  });

  addFooter(s, 19, "Cross-cutting");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 20 — AUDIT LOG & SECURITY
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 5, "CROSS-CUTTING FEATURES");
  addPageTitle(s, "Audit Log & Security", "ความปลอดภัย + บันทึกประวัติทุก action");

  // Security (left)
  card(s, 0.6, 1.95, 6.0, 5.05);
  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 1.95, w: 6.0, h: 0.06,
    fill: { color: C.danger }, line: { color: C.danger, width: 0 },
  });
  s.addText("Security", {
    x: 0.8, y: 2.1, w: 5.6, h: 0.35,
    fontFace: F.head, fontSize: 14, bold: true, color: C.text,
  });
  s.addText("Defense-in-depth — ตั้งแต่ login จนถึง action ทุก step", {
    x: 0.8, y: 2.45, w: 5.6, h: 0.3,
    fontFace: F.body, fontSize: 10.5, color: C.muted, italic: true,
  });

  const secs = [
    { t: "Password Hashing",          d: "bcryptjs (salt rounds = 10) — รหัสผ่านไม่เก็บเป็น plain text" },
    { t: "Session Management",        d: "NextAuth.js v5 — JWT signed + httpOnly cookie" },
    { t: "Role-based Middleware",     d: "ตรวจสิทธิ์ทุก route + redirect ถ้าไม่มีสิทธิ์" },
    { t: "Server Action Authorization", d: "ทุก mutation ตรวจ session + role + ownership" },
    { t: "SQL Injection Protection",  d: "Prisma ORM ใช้ prepared statements" },
    { t: "Email Log",                 d: "ทุก email บันทึก log — debug / audit ได้ย้อนหลัง" },
  ];
  secs.forEach((sec, i) => {
    const y = 2.95 + i * 0.65;
    s.addShape(pres.ShapeType.ellipse, {
      x: 0.8, y: y + 0.05, w: 0.22, h: 0.22,
      fill: { color: C.danger }, line: { color: C.danger, width: 0 },
    });
    s.addText("✓", {
      x: 0.8, y: y + 0.05, w: 0.22, h: 0.22,
      fontFace: F.head, fontSize: 9, bold: true, color: "FFFFFF",
      align: "center", valign: "middle",
    });
    s.addText(sec.t, {
      x: 1.15, y, w: 5.0, h: 0.3,
      fontFace: F.head, fontSize: 11, bold: true, color: C.text,
    });
    s.addText(sec.d, {
      x: 1.15, y: y + 0.3, w: 5.0, h: 0.3,
      fontFace: F.body, fontSize: 9.5, color: C.muted,
    });
  });

  // Audit Log (right)
  card(s, 6.75, 1.95, 6.0, 5.05);
  s.addShape(pres.ShapeType.rect, {
    x: 6.75, y: 1.95, w: 6.0, h: 0.06,
    fill: { color: C.steel }, line: { color: C.steel, width: 0 },
  });
  s.addText("Audit Log", {
    x: 6.95, y: 2.1, w: 5.6, h: 0.35,
    fontFace: F.head, fontSize: 14, bold: true, color: C.text,
  });
  s.addText("บันทึกทุก action — ตอบโจทย์ Compliance / Internal Audit", {
    x: 6.95, y: 2.45, w: 5.6, h: 0.3,
    fontFace: F.body, fontSize: 10.5, color: C.muted, italic: true,
  });

  // Audit log table mockup
  const auditRows = [
    { time: "13:42:17", user: "mgr.office", action: "APPROVE_LEAVE", entity: "LV2569-0042" },
    { time: "13:40:05", user: "sup.office", action: "CREATE_LEAVE",  entity: "LV2569-0042" },
    { time: "11:22:30", user: "hr",         action: "CANCEL_OT",     entity: "OT2569-0123" },
    { time: "10:15:08", user: "mgr.prod",   action: "REJECT_LEAVE",  entity: "LV2569-0040" },
    { time: "09:50:14", user: "sup.prod",   action: "CREATE_OT",     entity: "OT2569-0123" },
  ];
  // Table header
  const aty = 3.0;
  s.addShape(pres.ShapeType.rect, {
    x: 6.95, y: aty, w: 5.6, h: 0.32,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 },
  });
  ["เวลา", "ผู้ใช้", "Action", "Entity"].forEach((h, i) => {
    const xs = [7.05, 8.05, 9.25, 11.05];
    const ws = [1.0, 1.2, 1.8, 1.45];
    s.addText(h, {
      x: xs[i], y: aty, w: ws[i], h: 0.32,
      fontFace: F.head, fontSize: 9, bold: true, color: "FFFFFF",
      valign: "middle",
    });
  });
  auditRows.forEach((r, i) => {
    const y = aty + 0.32 + i * 0.45;
    s.addShape(pres.ShapeType.rect, {
      x: 6.95, y, w: 5.6, h: 0.45,
      fill: { color: i % 2 === 0 ? "FFFFFF" : C.chipBg },
      line: { color: C.border, width: 0.25 },
    });
    s.addText(r.time, {
      x: 7.05, y, w: 1.0, h: 0.45,
      fontFace: F.body, fontSize: 9, color: C.muted, valign: "middle",
    });
    s.addText(r.user, {
      x: 8.05, y, w: 1.2, h: 0.45,
      fontFace: F.body, fontSize: 9, color: C.text, valign: "middle",
    });
    const actColor = r.action.startsWith("APPROVE") ? C.success
                  : r.action.startsWith("REJECT") || r.action.startsWith("CANCEL") ? C.danger
                  : C.steel;
    s.addText(r.action, {
      x: 9.25, y, w: 1.8, h: 0.45,
      fontFace: F.body, fontSize: 9, color: actColor, bold: true, valign: "middle",
    });
    s.addText(r.entity, {
      x: 11.05, y, w: 1.45, h: 0.45,
      fontFace: F.body, fontSize: 9, color: C.text, valign: "middle",
    });
  });

  s.addText("ข้อมูล Audit เก็บถาวร — ใช้ตรวจสอบย้อนหลังได้ไม่จำกัด", {
    x: 6.95, y: 5.6, w: 5.6, h: 0.3,
    fontFace: F.body, fontSize: 10, color: C.muted, italic: true,
  });

  addFooter(s, 20, "Cross-cutting");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 21 — TECH STACK
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 6, "IMPLEMENTATION", C.gold);
  addPageTitle(s, "Tech Stack", "เทคโนโลยีที่ใช้พัฒนา — เน้น stable + supportable");

  const stack = [
    { layer: "Frontend",      tech: ["Next.js 14 (App Router)", "React 18 + TypeScript", "Tailwind CSS", "shadcn/ui Components", "Recharts (Charts)"], color: C.steel },
    { layer: "Backend",       tech: ["Node.js 20", "Next.js Server Actions", "Prisma 5 (ORM)", "Zod (Validation)", "Nodemailer (Email)"], color: C.navy },
    { layer: "Database",      tech: ["Microsoft SQL Server 2019", "Prisma Migrate (Schema)", "16 Tables (Master + Transaction)", "Daily Backup (SQL Plan)"], color: C.gold },
    { layer: "Auth + Security", tech: ["NextAuth.js v5 (Credentials)", "bcryptjs (Password)", "JWT Session (httpOnly)", "Role-based Middleware"], color: C.danger },
    { layer: "Reporting",     tech: ["ExcelJS (Multi-sheet)", "Server-side Filter + Export", "Recharts (Dashboard)"], color: C.success },
    { layer: "DevOps",        tech: ["Windows Server / IIS", "PM2 / Node Service", "Git Version Control"], color: C.muted },
  ];
  const cw = 3.95, ch = 2.35, sx = 0.6, sy = 2.0, gx = 0.27, gy = 0.27;
  stack.forEach((st, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = sx + col * (cw + gx);
    const y = sy + row * (ch + gy);
    card(s, x, y, cw, ch);
    s.addShape(pres.ShapeType.rect, {
      x, y, w: cw, h: 0.4,
      fill: { color: st.color }, line: { color: st.color, width: 0 },
    });
    s.addText(st.layer, {
      x: x + 0.2, y, w: cw - 0.4, h: 0.4,
      fontFace: F.head, fontSize: 12, bold: true, color: "FFFFFF", valign: "middle",
    });
    s.addText(
      st.tech.map((t) => ({ text: t, options: { bullet: { code: "25A0" }, color: st.color } })),
      {
        x: x + 0.25, y: y + 0.55, w: cw - 0.5, h: ch - 0.7,
        fontFace: F.body, fontSize: 10.5, color: C.text, lineSpacing: 18,
      },
    );
  });

  addFooter(s, 21, "Implementation");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 22 — PROJECT TIMELINE (Gantt)
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 6, "IMPLEMENTATION", C.gold);
  addPageTitle(s, "Project Timeline", "ระยะเวลาดำเนินงาน 4.5 - 5.5 เดือน");

  // Phases — Gantt-style
  const phases = [
    { name: "Phase 1 — Requirements & Discovery", start: 0,   dur: 2,  color: C.muted },
    { name: "Phase 2 — Setup + Schema + Auth",    start: 2,   dur: 3,  color: C.steel },
    { name: "Phase 3 — Leave Module",             start: 5,   dur: 4,  color: C.steel },
    { name: "Phase 4 — OT Module",                start: 8,   dur: 4,  color: C.gold },
    { name: "Phase 5 — Reports + Master + Email", start: 11,  dur: 3,  color: C.gold },
    { name: "Phase 6 — Testing + UAT",            start: 14,  dur: 3,  color: C.navy },
    { name: "Phase 7 — Migration + Training",     start: 16,  dur: 2,  color: C.success },
    { name: "Go-Live",                            start: 18,  dur: 0.5, color: C.danger, milestone: true },
  ];

  const chartX = 4.2, chartY = 2.2, chartW = 8.4, weeks = 19;
  const colW = chartW / weeks;

  // Week ruler
  for (let w = 0; w <= weeks; w++) {
    const x = chartX + w * colW;
    s.addShape(pres.ShapeType.rect, {
      x: x - 0.005, y: chartY - 0.25, w: 0.01, h: 0.15,
      fill: { color: C.border }, line: { color: C.border, width: 0 },
    });
    if (w % 4 === 0) {
      s.addText(`W${w}`, {
        x: x - 0.25, y: chartY - 0.5, w: 0.5, h: 0.25,
        fontFace: F.body, fontSize: 8, color: C.muted, align: "center",
      });
    }
  }
  // Month labels
  const months = ["เดือน 1", "เดือน 2", "เดือน 3", "เดือน 4", "เดือน 5"];
  months.forEach((m, i) => {
    const x = chartX + (i * 4 + 2) * colW - 0.5;
    s.addText(m, {
      x, y: chartY - 0.75, w: 1.0, h: 0.25,
      fontFace: F.body, fontSize: 8.5, color: C.steel, bold: true, align: "center",
    });
  });

  // Background grid
  s.addShape(pres.ShapeType.rect, {
    x: chartX, y: chartY, w: chartW, h: phases.length * 0.45 + 0.1,
    fill: { color: "FFFFFF" }, line: { color: C.border, width: 0.5 },
  });

  // Bars
  phases.forEach((p, i) => {
    const y = chartY + 0.1 + i * 0.45;
    // Phase name
    s.addText(p.name, {
      x: 0.6, y, w: 3.5, h: 0.35,
      fontFace: F.body, fontSize: 10, color: C.text, valign: "middle",
    });
    const barX = chartX + p.start * colW;
    if (p.milestone) {
      // Diamond marker
      s.addShape(pres.ShapeType.diamond, {
        x: barX - 0.15, y: y + 0.05, w: 0.3, h: 0.25,
        fill: { color: p.color }, line: { color: p.color, width: 0 },
      });
      s.addText("Go-Live", {
        x: barX + 0.2, y: y + 0.05, w: 1.5, h: 0.25,
        fontFace: F.head, fontSize: 9, bold: true, color: p.color, valign: "middle",
      });
    } else {
      const barW = p.dur * colW;
      s.addShape(pres.ShapeType.roundRect, {
        x: barX, y: y + 0.05, w: barW, h: 0.25,
        fill: { color: p.color }, line: { color: p.color, width: 0 },
        rectRadius: 0.03,
      });
      s.addText(`${p.dur}w`, {
        x: barX, y: y + 0.05, w: barW, h: 0.25,
        fontFace: F.body, fontSize: 8.5, bold: true, color: "FFFFFF",
        align: "center", valign: "middle",
      });
    }
  });

  // Notes
  s.addText("หมายเหตุ:", {
    x: 0.6, y: 6.3, w: 1.5, h: 0.3,
    fontFace: F.head, fontSize: 10, bold: true, color: C.text,
  });
  s.addText("ระยะเวลาประมาณ — ขึ้นกับ requirement สุดท้าย + ปริมาณ master data จากระบบเก่า · UAT เผื่อ 1-2 สัปดาห์", {
    x: 1.55, y: 6.3, w: 11, h: 0.3,
    fontFace: F.body, fontSize: 10, color: C.muted,
  });

  addFooter(s, 22, "Implementation");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 23 — MIGRATION & TRAINING
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 6, "IMPLEMENTATION", C.gold);
  addPageTitle(s, "Migration & Training", "การโอนข้อมูลและการอบรมผู้ใช้งาน");

  // Migration (left)
  card(s, 0.6, 1.95, 6.0, 5.05);
  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 1.95, w: 6.0, h: 0.06,
    fill: { color: C.steel }, line: { color: C.steel, width: 0 },
  });
  s.addText("Data Migration", {
    x: 0.8, y: 2.1, w: 5.6, h: 0.35,
    fontFace: F.head, fontSize: 14, bold: true, color: C.text,
  });
  s.addText("โอนข้อมูล 460+ พนักงาน + Master Data จากระบบเดิม", {
    x: 0.8, y: 2.45, w: 5.6, h: 0.3,
    fontFace: F.body, fontSize: 10.5, color: C.muted, italic: true,
  });

  const migSteps = [
    { n: "1", t: "ส่ง Excel Template", d: "ระบบเตรียม template Excel มาตรฐาน — HR กรอกข้อมูลพนักงาน + แผนก + สายรถ" },
    { n: "2", t: "Bulk Import Script", d: "Run script → ตรวจ validation → import เข้า DB พร้อม report สำหรับแถวที่ error" },
    { n: "3", t: "ตั้งสิทธิ์ user เริ่มต้น", d: "สร้าง account ให้หัวหน้า / ผจก. / HR — กำหนดรหัสผ่านเริ่มต้น" },
    { n: "4", t: "โอนวันลาคงเหลือ", d: "ใส่ Balance ปีที่ผ่านมา + Carry-over สำหรับการคำนวณปีปัจจุบัน" },
    { n: "5", t: "Parallel Run 1 สัปดาห์", d: "ใช้ทั้งระบบเก่า + ใหม่พร้อมกัน 1 สัปดาห์ — ตรวจตัวเลขให้ตรง" },
  ];
  migSteps.forEach((st, i) => {
    const y = 3.0 + i * 0.75;
    s.addShape(pres.ShapeType.ellipse, {
      x: 0.8, y, w: 0.35, h: 0.35,
      fill: { color: C.steel }, line: { color: C.steel, width: 0 },
    });
    s.addText(st.n, {
      x: 0.8, y, w: 0.35, h: 0.35,
      fontFace: F.head, fontSize: 11, bold: true, color: "FFFFFF",
      align: "center", valign: "middle",
    });
    s.addText(st.t, {
      x: 1.3, y, w: 5.2, h: 0.3,
      fontFace: F.head, fontSize: 11, bold: true, color: C.text,
    });
    s.addText(st.d, {
      x: 1.3, y: y + 0.3, w: 5.2, h: 0.4,
      fontFace: F.body, fontSize: 9.5, color: C.muted, lineSpacing: 14,
    });
  });

  // Training (right)
  card(s, 6.75, 1.95, 6.0, 5.05);
  s.addShape(pres.ShapeType.rect, {
    x: 6.75, y: 1.95, w: 6.0, h: 0.06,
    fill: { color: C.success }, line: { color: C.success, width: 0 },
  });
  s.addText("Training", {
    x: 6.95, y: 2.1, w: 5.6, h: 0.35,
    fontFace: F.head, fontSize: 14, bold: true, color: C.text,
  });
  s.addText("อบรมแยกตาม role — ครอบคลุมทุกการใช้งานในระบบ", {
    x: 6.95, y: 2.45, w: 5.6, h: 0.3,
    fontFace: F.body, fontSize: 10.5, color: C.muted, italic: true,
  });

  const trainings = [
    { role: "HR Admin",                     dur: "1 วัน",       what: "Master, Settings, Reports, Audit, Migration" },
    { role: "Dept Manager / Factory Mgr",   dur: "ครึ่งวัน",   what: "Approval flow, Bulk + Per-emp, Reports" },
    { role: "Supervisor",                   dur: "ครึ่งวัน",   what: "สร้างใบลา/OT, Cross-dept, Balance ทีม" },
    { role: "End User (พนักงาน)",         dur: "30 นาที",   what: "ดูสถานะ, ดูประวัติ — Optional" },
  ];
  trainings.forEach((t, i) => {
    const y = 3.0 + i * 0.85;
    card(s, 6.95, y, 5.6, 0.75, { fill: C.chipBg });
    s.addText(t.role, {
      x: 7.1, y: y + 0.08, w: 3.5, h: 0.3,
      fontFace: F.head, fontSize: 11, bold: true, color: C.navy,
    });
    s.addText(t.what, {
      x: 7.1, y: y + 0.38, w: 3.6, h: 0.35,
      fontFace: F.body, fontSize: 9.5, color: C.muted,
    });
    // Duration badge
    s.addShape(pres.ShapeType.roundRect, {
      x: 11.0, y: y + 0.2, w: 1.45, h: 0.35,
      fill: { color: C.success }, line: { color: C.success, width: 0 }, rectRadius: 0.04,
    });
    s.addText(t.dur, {
      x: 11.0, y: y + 0.2, w: 1.45, h: 0.35,
      fontFace: F.body, fontSize: 10, bold: true, color: "FFFFFF",
      align: "center", valign: "middle",
    });
  });

  s.addText("+ คู่มือผู้ใช้ + Video Screencast — สำหรับ onboarding พนักงานใหม่", {
    x: 6.95, y: 6.6, w: 5.6, h: 0.3,
    fontFace: F.body, fontSize: 10, color: C.muted, italic: true, align: "center",
  });

  addFooter(s, 23, "Implementation");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 24 — INVESTMENT SUMMARY (PRICING)
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 6, "IMPLEMENTATION", C.gold);
  addPageTitle(s, "Investment Summary", "สรุปค่าใช้จ่าย — เว้นช่องว่างให้กรอกราคา");

  // Main table
  const tx = 0.6, ty = 1.95, tw = 12.15;
  const cols = [
    { label: "ลำดับ",       w: 0.8,  align: "center" },
    { label: "รายการ",       w: 6.85, align: "left" },
    { label: "จำนวน",        w: 1.3,  align: "center" },
    { label: "ราคาต่อหน่วย", w: 1.6,  align: "right" },
    { label: "รวม (บาท)",    w: 1.6,  align: "right" },
  ];

  // Header
  s.addShape(pres.ShapeType.rect, {
    x: tx, y: ty, w: tw, h: 0.5,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 },
  });
  let cx = tx;
  cols.forEach((c) => {
    s.addText(c.label, {
      x: cx + 0.1, y: ty, w: c.w - 0.2, h: 0.5,
      fontFace: F.head, fontSize: 11, bold: true, color: "FFFFFF",
      align: c.align, valign: "middle",
    });
    cx += c.w;
  });

  // Items
  const items = [
    {
      no: "1",
      title: "Development",
      sub: [
        "[DEV] พัฒนาระบบ AMS ตาม Scope ในเอกสารนี้",
        "Leave Module + OT Module + Master + Reports + Audit + Notification",
      ],
      qty: "1 Job",
    },
    {
      no: "2",
      title: "Implementation",
      sub: [
        "Install OS + Deploy Application + SQL Server",
        "Migration ข้อมูลพนักงาน + Master Data",
        "On-the-job Training (HR + Manager + Supervisor)",
      ],
      qty: "1 Job",
    },
    {
      no: "3",
      title: "Service & Support (1 ปี)",
      sub: [
        "Troubleshoot + Remote diagnostics",
        "NBD response · 12 hours/day · 5 days/week",
        "On-site investigation (สูงสุด 2 ครั้ง/ปี)",
      ],
      qty: "1 Job",
    },
  ];

  let ry = ty + 0.5;
  items.forEach((it) => {
    const rowH = 0.4 + it.sub.length * 0.32 + 0.15;
    s.addShape(pres.ShapeType.rect, {
      x: tx, y: ry, w: tw, h: rowH,
      fill: { color: "FFFFFF" }, line: { color: C.border, width: 0.5 },
    });

    // No
    s.addText(it.no, {
      x: tx + 0.1, y: ry + 0.08, w: cols[0].w - 0.2, h: 0.4,
      fontFace: F.head, fontSize: 12, bold: true, color: C.text,
      align: "center",
    });

    // Title + sub
    s.addText(it.title, {
      x: tx + cols[0].w + 0.15, y: ry + 0.08, w: cols[1].w - 0.3, h: 0.32,
      fontFace: F.head, fontSize: 12, bold: true, color: C.navy,
    });
    s.addText(
      it.sub.map((line) => ({ text: line, options: { bullet: { code: "25CB" }, color: C.muted } })),
      {
        x: tx + cols[0].w + 0.3, y: ry + 0.45, w: cols[1].w - 0.5, h: rowH - 0.55,
        fontFace: F.body, fontSize: 10, color: C.text, lineSpacing: 16,
      },
    );

    // Qty
    s.addText(it.qty, {
      x: tx + cols[0].w + cols[1].w + 0.1, y: ry + 0.08, w: cols[2].w - 0.2, h: 0.4,
      fontFace: F.body, fontSize: 11, color: C.text, align: "center",
    });

    // Empty price + total
    const pricesX = tx + cols[0].w + cols[1].w + cols[2].w;
    const totalsX = pricesX + cols[3].w;
    s.addText("___________", {
      x: pricesX + 0.1, y: ry + 0.08, w: cols[3].w - 0.2, h: 0.4,
      fontFace: F.body, fontSize: 11, color: C.mutedLite, align: "right",
    });
    s.addText("___________", {
      x: totalsX + 0.1, y: ry + 0.08, w: cols[4].w - 0.2, h: 0.4,
      fontFace: F.body, fontSize: 11, color: C.mutedLite, align: "right",
    });

    ry += rowH;
  });

  // Summary box (right side, below items)
  const sumX = tx + cols[0].w + cols[1].w + 0.5;
  const sumY = ry + 0.15;
  const sumW = cols[2].w + cols[3].w + cols[4].w - 0.5;
  card(s, sumX, sumY, sumW, 1.6, { fill: C.chipBg });
  s.addShape(pres.ShapeType.rect, {
    x: sumX, y: sumY, w: sumW, h: 0.35,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 },
  });
  s.addText("สรุปจำนวนเงิน", {
    x: sumX + 0.15, y: sumY, w: sumW - 0.3, h: 0.35,
    fontFace: F.head, fontSize: 11, bold: true, color: "FFFFFF", valign: "middle",
  });
  const summaryRows = [
    ["จำนวนเงินก่อนภาษี", "________"],
    ["หัก ณ ที่จ่าย 3%",   "________"],
    ["ภาษีมูลค่าเพิ่ม 7%",  "________"],
    ["ยอดจ่ายสุทธิ",       "________"],
  ];
  summaryRows.forEach((r, i) => {
    const sy = sumY + 0.4 + i * 0.27;
    s.addText(r[0], {
      x: sumX + 0.15, y: sy, w: sumW * 0.55, h: 0.25,
      fontFace: F.body, fontSize: 10, color: i === 3 ? C.text : C.muted, bold: i === 3,
      valign: "middle",
    });
    s.addText(r[1], {
      x: sumX + sumW * 0.55, y: sy, w: sumW * 0.4, h: 0.25,
      fontFace: F.body, fontSize: 10, color: i === 3 ? C.danger : C.text, bold: i === 3,
      align: "right", valign: "middle",
    });
  });

  // Lead time note (left)
  s.addText("Lead Time: 4.5 - 5.5 เดือน", {
    x: 0.6, y: ry + 0.3, w: 6, h: 0.3,
    fontFace: F.head, fontSize: 11, bold: true, color: C.navy,
  });
  s.addText("ระยะรับประกัน: 1 ปี นับจากวันส่งมอบ", {
    x: 0.6, y: ry + 0.65, w: 6, h: 0.3,
    fontFace: F.body, fontSize: 10, color: C.muted,
  });

  addFooter(s, 24, "Implementation");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 25 — SERVICE & SUPPORT SLA
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };
  addSectionStripe(s, 6, "IMPLEMENTATION", C.gold);
  addPageTitle(s, "Service & Support SLA", "การให้บริการหลังส่งมอบ — 1 ปี");

  const services = [
    { t: "NBD Response",              d: "Next Business Day response · 12 hours / day · 5 days / week (Mon-Fri)" },
    { t: "Remote Diagnostics",        d: "เข้าระบบลูกค้าผ่าน remote desktop เพื่อตรวจสอบและแก้ไขปัญหา" },
    { t: "On-site Investigation",     d: "เข้าหน้างานในกรณีปัญหา critical — สูงสุด 2 ครั้งต่อปี" },
    { t: "Software Faults Resolution", d: "แก้ไข bug ของระบบไม่จำกัดจำนวนครั้ง ภายในระยะประกัน 1 ปี" },
    { t: "Standby Consultant",        d: "On-call consultant สำหรับให้คำปรึกษาตาม SLA level" },
    { t: "Version Update",            d: "Patch updates (security + bug fixes) ฟรีตลอดอายุประกัน" },
  ];

  const cw = 5.95, ch = 1.85, sx = 0.6, sy = 2.0, gx = 0.25, gy = 0.25;
  services.forEach((sv, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = sx + col * (cw + gx);
    const y = sy + row * (ch + gy);
    card(s, x, y, cw, ch);
    s.addShape(pres.ShapeType.rect, {
      x, y, w: 0.06, h: ch,
      fill: { color: C.success }, line: { color: C.success, width: 0 },
    });
    s.addShape(pres.ShapeType.ellipse, {
      x: x + 0.25, y: y + 0.25, w: 0.4, h: 0.4,
      fill: { color: "ECFDF5" }, line: { color: C.success, width: 1 },
    });
    s.addText("✓", {
      x: x + 0.25, y: y + 0.25, w: 0.4, h: 0.4,
      fontFace: F.head, fontSize: 14, bold: true, color: C.success,
      align: "center", valign: "middle",
    });
    s.addText(sv.t, {
      x: x + 0.8, y: y + 0.2, w: cw - 0.95, h: 0.4,
      fontFace: F.head, fontSize: 14, bold: true, color: C.text,
    });
    s.addText(sv.d, {
      x: x + 0.8, y: y + 0.65, w: cw - 0.95, h: ch - 0.85,
      fontFace: F.body, fontSize: 10.5, color: C.muted, lineSpacing: 16,
    });
  });

  // Bottom note
  card(s, 0.6, 6.4, 12.15, 0.65, { fill: "FEF3C7", borderColor: C.gold });
  s.addText("Extended Support (Year 2+):", {
    x: 0.85, y: 6.4, w: 4, h: 0.65,
    fontFace: F.head, fontSize: 11, bold: true, color: C.warning, valign: "middle",
  });
  s.addText("ต่ออายุ support เพิ่มได้ทุกปีในอัตราที่ตกลงกัน (ขึ้นกับ scope การ support)", {
    x: 4.5, y: 6.4, w: 8, h: 0.65,
    fontFace: F.body, fontSize: 11, color: C.text, valign: "middle",
  });

  addFooter(s, 25, "Implementation");
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 26 — WHY CHOOSE US
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.navy };

  // Gold accent line
  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 0.7, w: 0.6, h: 0.04,
    fill: { color: C.gold }, line: { color: C.gold, width: 0 },
  });
  s.addText("WHY CHOOSE US", {
    x: 0.6, y: 0.85, w: 8, h: 0.4,
    fontFace: F.body, fontSize: 11, color: C.gold, charSpacing: 4, bold: true,
  });
  s.addText("เลือกเราเพราะอะไร", {
    x: 0.6, y: 1.3, w: 12, h: 0.6,
    fontFace: F.head, fontSize: 30, bold: true, color: "FFFFFF",
  });
  s.addText("ปัจจัยที่ทำให้ AMS เป็น proposal ที่คุ้มค่า", {
    x: 0.6, y: 1.95, w: 12, h: 0.3,
    fontFace: F.body, fontSize: 14, color: "CADCFC",
  });

  const reasons = [
    { num: "01", t: "Built for HR Reality",
      d: "ออกแบบจาก use case จริง — ครึ่งวัน · cross-dept · per-emp approve · cancel-after-approve" },
    { num: "02", t: "Production-tested Logic",
      d: "ทดสอบทั้ง Office (2-step) และ Production (3-step) — รองรับองค์กรขนาด 460+ คน" },
    { num: "03", t: "Audit-ready",
      d: "ทุก action บันทึก — รองรับ ISO / Internal Audit ได้ทันที" },
    { num: "04", t: "HR Self-service",
      d: "Master Data + Settings + Reports — HR จัดการเองทั้งหมด ไม่ต้องรอ Developer" },
    { num: "05", t: "Local Support Team",
      d: "ทีมไทย ตอบ-สื่อสารด้วยภาษาไทย เข้าหน้างานได้จริง" },
    { num: "06", t: "1-year Warranty + Extensible",
      d: "รับประกัน 1 ปี + ขยาย module ในอนาคต (Payroll integration, Mobile app, ฯลฯ)" },
  ];
  const cw = 4.0, ch = 1.85, sx = 0.55, sy = 2.6, gx = 0.25, gy = 0.25;
  reasons.forEach((r, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = sx + col * (cw + gx);
    const y = sy + row * (ch + gy);
    s.addShape(pres.ShapeType.roundRect, {
      x, y, w: cw, h: ch,
      fill: { color: "FFFFFF", transparency: 92 },
      line: { color: "FFFFFF", width: 0.5 },
      rectRadius: 0.06,
    });
    s.addText(r.num, {
      x: x + 0.25, y: y + 0.2, w: 1.0, h: 0.4,
      fontFace: F.head, fontSize: 22, bold: true, color: C.gold,
    });
    s.addText(r.t, {
      x: x + 0.25, y: y + 0.7, w: cw - 0.5, h: 0.3,
      fontFace: F.head, fontSize: 12, bold: true, color: "FFFFFF",
    });
    s.addText(r.d, {
      x: x + 0.25, y: y + 1.05, w: cw - 0.5, h: ch - 1.2,
      fontFace: F.body, fontSize: 10, color: "CADCFC", lineSpacing: 15,
    });
  });

  s.addText("AMS — Ready for Production. Ready for Your Team.", {
    x: 0.6, y: 6.7, w: 12.13, h: 0.4,
    fontFace: F.head, fontSize: 14, bold: true, color: C.gold,
    align: "center",
  });
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 27 — THANK YOU / Q&A
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.navyDark };

  s.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 2.6, w: 0.08, h: 1.5,
    fill: { color: C.gold }, line: { color: C.gold, width: 0 },
  });
  s.addText("ขอบคุณครับ", {
    x: 0.9, y: 2.5, w: 12, h: 1.0,
    fontFace: F.head, fontSize: 60, bold: true, color: "FFFFFF",
  });
  s.addText("Thank You", {
    x: 0.9, y: 3.5, w: 12, h: 0.5,
    fontFace: F.head, fontSize: 22, color: C.gold, italic: true,
  });
  s.addText("พร้อมตอบทุกคำถาม — Next Steps:", {
    x: 0.9, y: 4.3, w: 12, h: 0.4,
    fontFace: F.body, fontSize: 14, color: "CADCFC",
  });

  // Next steps row
  const steps = [
    { n: "1", t: "Demo ระบบจริง",     d: "นัดวันสาธิตการใช้งานจริง" },
    { n: "2", t: "Q&A + ปรับ Scope",  d: "ปรับ feature ให้ตรงโจทย์" },
    { n: "3", t: "ส่ง Quotation",      d: "ราคา + Timeline ละเอียด" },
    { n: "4", t: "เริ่ม Kick-off",     d: "Phase 1 — Requirements" },
  ];
  steps.forEach((st, i) => {
    const x = 0.6 + i * 3.05;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 5.0, w: 2.85, h: 1.5,
      fill: { color: "FFFFFF", transparency: 92 },
      line: { color: C.gold, width: 0.75 },
      rectRadius: 0.06,
    });
    s.addText(st.n, {
      x: x + 0.2, y: 5.1, w: 1, h: 0.4,
      fontFace: F.head, fontSize: 24, bold: true, color: C.gold,
    });
    s.addText(st.t, {
      x: x + 0.2, y: 5.6, w: 2.55, h: 0.35,
      fontFace: F.head, fontSize: 13, bold: true, color: "FFFFFF",
    });
    s.addText(st.d, {
      x: x + 0.2, y: 5.95, w: 2.55, h: 0.5,
      fontFace: F.body, fontSize: 10, color: "CADCFC", lineSpacing: 14,
    });
  });

  // Contact
  s.addText("ติดต่อ:  ________________________  ·  Email:  ________________________  ·  Tel:  ________________________", {
    x: 0.6, y: 6.85, w: 12.13, h: 0.3,
    fontFace: F.body, fontSize: 10, color: "9CA3AF", align: "center",
  });
}

// ── Save ──
pres.writeFile({ fileName: "AMS-Proposal.pptx" })
  .then((fileName) => console.log(`Created: ${fileName}`))
  .catch((err) => { console.error("Error:", err); process.exit(1); });
