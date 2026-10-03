/**
 * AMS — Attendance Management System
 * Customer-facing presentation (6 slides)
 *
 * Design notes:
 *  - Color palette matches the actual app (indigo/violet gradient + ice background)
 *  - Tahoma font (renders Thai cleanly across Windows/Mac PowerPoint)
 *  - Visual motif: rounded cards + circular icon badges (used on every slide)
 *  - Dark cover + light content + dark closing (sandwich)
 */

const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";       // 13.33 × 7.5 inches
pres.title = "AMS — Attendance Management System";
pres.author = "AMS Team";
pres.company = "AMS";

// ── Brand colors ───────────────────────────────────────────────
const C = {
  navy:      "1E1B4B",  // dark indigo — cover background
  indigo:    "4F46E5",  // primary brand
  violet:    "7C3AED",  // secondary
  cyan:      "06B6D4",  // accent / highlight
  bg:        "F8FAFC",  // light slate (content bg)
  panel:     "FFFFFF",  // white card
  border:    "E2E8F0",  // light divider
  text:      "0F172A",  // near-black
  muted:     "64748B",  // gray text
  success:   "10B981",  // green
  amber:     "F59E0B",  // orange (warnings, OT)
  rose:      "EF4444",  // red (cancel/reject)
};

const F = { head: "Tahoma", body: "Tahoma" }; // Tahoma handles Thai well

// ── Helpers ────────────────────────────────────────────────────
function addFooter(slide, num, total) {
  slide.addText("AMS — Attendance Management System", {
    x: 0.4, y: 7.15, w: 6, h: 0.3,
    fontFace: F.body, fontSize: 9, color: C.muted,
  });
  slide.addText(`${num} / ${total}`, {
    x: 12.5, y: 7.15, w: 0.5, h: 0.3,
    fontFace: F.body, fontSize: 9, color: C.muted, align: "right",
  });
}

// Rounded card with shadow-like effect via subtle border
function card(slide, x, y, w, h, opts = {}) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: opts.fill ?? C.panel },
    line: { color: opts.borderColor ?? C.border, width: 0.75 },
    rectRadius: opts.radius ?? 0.12,
  });
}

// Colored circular icon badge with a single character/glyph
function iconBadge(slide, x, y, size, color, glyph) {
  slide.addShape(pres.ShapeType.ellipse, {
    x, y, w: size, h: size,
    fill: { color },
    line: { color, width: 0 },
  });
  slide.addText(glyph, {
    x, y, w: size, h: size,
    fontFace: F.head, fontSize: size * 22, bold: true,
    color: "FFFFFF", align: "center", valign: "middle",
  });
}

const TOTAL = 6;

// ═══════════════════════════════════════════════════════════════
// SLIDE 1 — COVER
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.navy };

  // Decorative gradient blob (top-right)
  s.addShape(pres.ShapeType.ellipse, {
    x: 10, y: -2, w: 6, h: 6,
    fill: { color: C.violet, transparency: 60 },
    line: { color: C.violet, width: 0 },
  });
  s.addShape(pres.ShapeType.ellipse, {
    x: -2, y: 5, w: 5, h: 5,
    fill: { color: C.indigo, transparency: 70 },
    line: { color: C.indigo, width: 0 },
  });

  // Brand chip
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.7, y: 0.8, w: 1.5, h: 0.4,
    fill: { color: C.cyan },
    line: { color: C.cyan, width: 0 },
    rectRadius: 0.2,
  });
  s.addText("v1.0", {
    x: 0.7, y: 0.8, w: 1.5, h: 0.4,
    fontFace: F.body, fontSize: 12, bold: true, color: "FFFFFF",
    align: "center", valign: "middle",
  });

  s.addText("AMS", {
    x: 0.7, y: 1.8, w: 12, h: 1.8,
    fontFace: F.head, fontSize: 110, bold: true, color: "FFFFFF",
    charSpacing: -2,
  });

  s.addText("Attendance Management System", {
    x: 0.7, y: 3.5, w: 12, h: 0.6,
    fontFace: F.head, fontSize: 28, color: C.cyan,
  });

  s.addText("ระบบบริหารจัดการการลาและ OT ครบวงจร", {
    x: 0.7, y: 4.2, w: 12, h: 0.6,
    fontFace: F.body, fontSize: 22, color: "FFFFFF",
  });

  // Three small feature pills
  const pills = [
    { txt: "📅  ระบบลา", x: 0.7 },
    { txt: "⏰  ระบบ OT", x: 2.9 },
    { txt: "📊  รายงาน", x: 5.0 },
  ];
  pills.forEach((p) => {
    s.addShape(pres.ShapeType.roundRect, {
      x: p.x, y: 5.4, w: 1.9, h: 0.55,
      fill: { color: "FFFFFF", transparency: 85 },
      line: { color: "FFFFFF", width: 0.5 },
      rectRadius: 0.27,
    });
    s.addText(p.txt, {
      x: p.x, y: 5.4, w: 1.9, h: 0.55,
      fontFace: F.body, fontSize: 13, color: "FFFFFF",
      align: "center", valign: "middle",
    });
  });

  s.addText("สำหรับองค์กร 460+ คน · 2 ฝ่าย (Office / ผลิต) · 5 ระดับสิทธิ์", {
    x: 0.7, y: 6.7, w: 12, h: 0.4,
    fontFace: F.body, fontSize: 13, color: "CADCFC",
  });
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 2 — MODULE OVERVIEW (6 cards in 2x3 grid)
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };

  // Title bar
  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 1.1,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 },
  });
  s.addText("Module ทั้งหมดในระบบ", {
    x: 0.6, y: 0.2, w: 12, h: 0.5,
    fontFace: F.head, fontSize: 24, bold: true, color: "FFFFFF",
  });
  s.addText("6 modules ครอบคลุมงาน HR ด้านการลาและ OT ตั้งแต่ต้นจนจบ", {
    x: 0.6, y: 0.7, w: 12, h: 0.3,
    fontFace: F.body, fontSize: 12, color: "CADCFC",
  });

  const modules = [
    { title: "ระบบจัดการการลา",   sub: "Leave Management",       icon: "📅", color: C.indigo,
      bullets: ["ลาครึ่งวัน เช้า/บ่าย ใช้ทุกประเภท", "หัวหน้าเห็นสิทธิ์ลูกน้องทั้งทีม", "รหัสประเภทการลา + Export Excel"] },
    { title: "ระบบจัดการ OT",     sub: "Overtime Management",    icon: "⏰", color: C.amber,
      bullets: ["สายรถผูก default ต่อพนักงาน", "Approve/Reject รายคน + Cross-dept", "สรุปสายรถ · Filter กะ · OT วันหยุด"] },
    { title: "Workflow อนุมัติ",   sub: "Multi-step Approval",    icon: "✓",  color: C.success,
      bullets: ["Office 2 step / ผลิต 3 step", "Bulk + รายคน Approve/Reject", "Email แจ้งทุกขั้นตอน"] },
    { title: "ข้อมูลหลัก",         sub: "Master Data",            icon: "👥", color: C.violet,
      bullets: ["พนักงาน · แผนก · ฝ่าย", "ประเภทการลา + เหตุผลปฏิเสธ", "สายรถ default ต่อพนักงาน"] },
    { title: "รายงาน & ดาวน์โหลด", sub: "Reports & Excel Export", icon: "📊", color: C.cyan,
      bullets: ["Leave Monthly + รหัส code", "OT Summary + สรุปสายรถ", "Filter ตามกะ + Export Excel"] },
    { title: "การแจ้งเตือน",       sub: "Email Notifications",    icon: "📧", color: C.rose,
      bullets: ["Email สีตามสถานะ", "FYI Email ข้ามแผนก", "รายละเอียดครบทุกฉบับ"] },
  ];

  const cardW = 4.05, cardH = 2.7, gapX = 0.3, gapY = 0.3, startX = 0.45, startY = 1.4;

  modules.forEach((m, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    // Card with thin colored top border (visual motif)
    card(s, x, y, cardW, cardH);
    s.addShape(pres.ShapeType.rect, {
      x, y, w: cardW, h: 0.1,
      fill: { color: m.color }, line: { color: m.color, width: 0 },
    });

    // Icon badge
    iconBadge(s, x + 0.3, y + 0.3, 0.7, m.color, m.icon);

    s.addText(m.title, {
      x: x + 1.15, y: y + 0.27, w: cardW - 1.3, h: 0.4,
      fontFace: F.head, fontSize: 16, bold: true, color: C.text,
    });
    s.addText(m.sub, {
      x: x + 1.15, y: y + 0.68, w: cardW - 1.3, h: 0.3,
      fontFace: F.body, fontSize: 10, color: C.muted, italic: true,
    });

    // Bullets
    s.addText(
      m.bullets.map((b) => ({ text: b, options: { bullet: { code: "25CF" }, color: C.text } })),
      {
        x: x + 0.3, y: y + 1.2, w: cardW - 0.6, h: cardH - 1.4,
        fontFace: F.body, fontSize: 11, lineSpacing: 18, color: C.text,
      },
    );
  });

  addFooter(s, 2, TOTAL);
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 3 — LEAVE MODULE (with mockup screen)
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };

  // Side label
  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 0.25, h: 7.5,
    fill: { color: C.indigo }, line: { color: C.indigo, width: 0 },
  });

  // Title row
  iconBadge(s, 0.7, 0.45, 0.7, C.indigo, "📅");
  s.addText("Module 1 · ระบบจัดการการลา", {
    x: 1.55, y: 0.4, w: 8, h: 0.4,
    fontFace: F.body, fontSize: 12, color: C.muted, bold: true,
  });
  s.addText("Leave Management", {
    x: 1.55, y: 0.7, w: 8, h: 0.6,
    fontFace: F.head, fontSize: 28, bold: true, color: C.text,
  });

  // Left content — features
  const features = [
    { h: "ลาครึ่งวัน เช้า/บ่าย + เลือกหลายวัน", d: "ใช้ได้ทุกประเภทการลา ไม่ต้องระบุเวลา — ผสมเต็มวัน + ครึ่งวันในใบเดียวได้" },
    { h: "หัวหน้าเห็นสิทธิ์ลูกน้องทั้งทีม", d: "ดูยอดวันลาคงเหลือของลูกน้องก่อนสร้างใบลาได้ทันที — ไม่ต้องถาม HR" },
    { h: "เหตุผลปฏิเสธ — Dropdown + อธิบายเพิ่ม", d: "HR กำหนด Master เอง (LRR001, LRR002, …) + Bulk Approve/Reject ทีละหลายใบ" },
    { h: "รหัสประเภทการลา (Code) แสดงทุกที่", d: "List · Detail · Email · Excel (export ได้) — เช่น VACATION-ลาพักร้อน" },
  ];

  features.forEach((f, i) => {
    const y = 1.85 + i * 1.15;
    iconBadge(s, 0.7, y, 0.45, C.indigo, (i + 1).toString());
    s.addText(f.h, {
      x: 1.35, y: y - 0.05, w: 5.5, h: 0.4,
      fontFace: F.head, fontSize: 14, bold: true, color: C.text,
    });
    s.addText(f.d, {
      x: 1.35, y: y + 0.35, w: 5.5, h: 0.4,
      fontFace: F.body, fontSize: 11, color: C.muted,
    });
  });

  // Right side — mockup screen (browser-frame style)
  drawLeaveMockup(s, 7.5, 1.6, 5.3, 5.0);

  addFooter(s, 3, TOTAL);
}

function drawLeaveMockup(s, x, y, w, h) {
  // Browser chrome
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: "FFFFFF" },
    line: { color: C.border, width: 1 },
    rectRadius: 0.08,
  });
  s.addShape(pres.ShapeType.rect, {
    x, y, w, h: 0.35,
    fill: { color: "F1F5F9" }, line: { color: C.border, width: 0 },
  });
  // Traffic lights
  ["EF4444", "F59E0B", "10B981"].forEach((c, i) => {
    s.addShape(pres.ShapeType.ellipse, {
      x: x + 0.1 + i * 0.18, y: y + 0.1, w: 0.12, h: 0.12,
      fill: { color: c }, line: { color: c, width: 0 },
    });
  });
  s.addText("ams.local / leave / create", {
    x: x + 1.0, y: y + 0.05, w: w - 1.2, h: 0.25,
    fontFace: F.body, fontSize: 8, color: C.muted, valign: "middle",
  });

  // Form header
  s.addText("สร้างใบลา", {
    x: x + 0.25, y: y + 0.5, w: w - 0.5, h: 0.35,
    fontFace: F.head, fontSize: 14, bold: true, color: C.text,
  });

  // Field: พนักงาน
  s.addText("พนักงาน", { x: x + 0.25, y: y + 1.0, w: 2, h: 0.2, fontFace: F.body, fontSize: 8, color: C.muted });
  s.addShape(pres.ShapeType.roundRect, {
    x: x + 0.25, y: y + 1.2, w: w - 0.5, h: 0.32,
    fill: { color: "F8FAFC" }, line: { color: C.border, width: 0.5 }, rectRadius: 0.05,
  });
  s.addText("A-092 — ศรีไพบูลย์ เขียวสีม่วง", {
    x: x + 0.4, y: y + 1.2, w: w - 0.7, h: 0.32,
    fontFace: F.body, fontSize: 9, color: C.text, valign: "middle",
  });

  // Date picker — single input (no mode toggle)
  s.addText("เลือกวันลา *", { x: x + 0.25, y: y + 1.7, w: 3, h: 0.2, fontFace: F.body, fontSize: 8, color: C.muted });
  s.addShape(pres.ShapeType.roundRect, {
    x: x + 0.25, y: y + 1.9, w: w - 0.5, h: 0.32,
    fill: { color: "FFFFFF" }, line: { color: C.border, width: 0.75 }, rectRadius: 0.05,
  });
  s.addText("คลิกเพื่อเลือกวัน — จะถูกเพิ่มลงรายการอัตโนมัติ", {
    x: x + 0.4, y: y + 1.9, w: w - 1.0, h: 0.32,
    fontFace: F.body, fontSize: 8, color: C.muted, italic: true, valign: "middle",
  });
  s.addText("🗓", {
    x: x + w - 0.55, y: y + 1.9, w: 0.3, h: 0.32,
    fontFace: F.body, fontSize: 11, color: C.muted, align: "center", valign: "middle",
  });

  // List header — count + clear link
  s.addText("เลือกแล้ว 3 รายการ (2.5 วัน)", {
    x: x + 0.25, y: y + 2.35, w: 3.5, h: 0.2,
    fontFace: F.body, fontSize: 8, bold: true, color: C.text,
  });
  s.addText("ล้างทั้งหมด", {
    x: x + w - 1.0, y: y + 2.35, w: 0.75, h: 0.2,
    fontFace: F.body, fontSize: 8, color: C.rose, align: "right",
  });

  // Selected dates list container
  s.addShape(pres.ShapeType.roundRect, {
    x: x + 0.25, y: y + 2.6, w: w - 0.5, h: 1.1,
    fill: { color: "FFFFFF" }, line: { color: C.border, width: 0.5 }, rectRadius: 0.05,
  });

  // 3 rows: full / full / afternoon — demonstrates 2.5 days
  const entries = [
    { date: "11 ก.ค. 2569", half: "FULL" },
    { date: "15 ก.ค. 2569", half: "FULL" },
    { date: "16 ก.ค. 2569", half: "AFTERNOON" },
  ];
  const buttons = [
    { label: "เต็มวัน",   key: "FULL",      selFill: C.indigo, selText: "FFFFFF" },
    { label: "ครึ่งเช้า",  key: "MORNING",  selFill: "F59E0B", selText: "FFFFFF" },
    { label: "ครึ่งบ่าย",  key: "AFTERNOON", selFill: "6366F1", selText: "FFFFFF" },
  ];
  entries.forEach((e, i) => {
    const ry = y + 2.65 + i * 0.34;
    // Divider line between rows
    if (i > 0) {
      s.addShape(pres.ShapeType.rect, {
        x: x + 0.35, y: ry - 0.01, w: w - 0.7, h: 0.005,
        fill: { color: C.border }, line: { color: C.border, width: 0 },
      });
    }
    // Date label
    s.addText(`📅 ${e.date}`, {
      x: x + 0.35, y: ry + 0.02, w: 1.6, h: 0.3,
      fontFace: F.body, fontSize: 9, color: C.text, valign: "middle",
    });
    // 3 half-day toggle buttons
    const bx0 = x + 1.95;
    const bw = 0.75, bgap = 0.04;
    buttons.forEach((b, bi) => {
      const bx = bx0 + bi * (bw + bgap);
      const isSel = e.half === b.key;
      s.addShape(pres.ShapeType.roundRect, {
        x: bx, y: ry + 0.05, w: bw, h: 0.22,
        fill: { color: isSel ? b.selFill : "F1F5F9" },
        line: { color: isSel ? b.selFill : C.border, width: 0.5 },
        rectRadius: 0.04,
      });
      s.addText(b.label, {
        x: bx, y: ry + 0.05, w: bw, h: 0.22,
        fontFace: F.body, fontSize: 7.5, bold: isSel,
        color: isSel ? b.selText : C.muted,
        align: "center", valign: "middle",
      });
    });
    // X remove button
    s.addText("✕", {
      x: x + w - 0.5, y: ry + 0.02, w: 0.25, h: 0.3,
      fontFace: F.body, fontSize: 10, color: C.rose, align: "center", valign: "middle",
    });
  });

  // Hint
  s.addText("💡 คลิก เต็มวัน / ครึ่งเช้า / ครึ่งบ่าย เพื่อเปลี่ยนสำหรับแต่ละวัน", {
    x: x + 0.25, y: y + 3.78, w: w - 0.5, h: 0.2,
    fontFace: F.body, fontSize: 7.5, color: C.muted, italic: true,
  });

  // Summary
  s.addShape(pres.ShapeType.roundRect, {
    x: x + 0.25, y: y + 4.05, w: w - 0.5, h: 0.5,
    fill: { color: "F0F9FF" }, line: { color: "BAE6FD", width: 0.5 }, rectRadius: 0.05,
  });
  s.addText("รวมวันลา", {
    x: x + 0.4, y: y + 4.05, w: 3, h: 0.5,
    fontFace: F.body, fontSize: 11, color: C.muted, valign: "middle",
  });
  s.addText("2.5 วัน", {
    x: x + w - 1.4, y: y + 4.05, w: 1.1, h: 0.5,
    fontFace: F.head, fontSize: 15, bold: true, color: C.indigo, align: "right", valign: "middle",
  });

  // CTA
  s.addShape(pres.ShapeType.roundRect, {
    x: x + w - 2.4, y: y + h - 0.7, w: 2.1, h: 0.45,
    fill: { color: C.indigo }, line: { color: C.indigo, width: 0 }, rectRadius: 0.05,
  });
  s.addText("บันทึกและส่งอนุมัติ →", {
    x: x + w - 2.4, y: y + h - 0.7, w: 2.1, h: 0.45,
    fontFace: F.body, fontSize: 10, bold: true, color: "FFFFFF", align: "center", valign: "middle",
  });
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 4 — OT MODULE
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };

  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 0.25, h: 7.5,
    fill: { color: C.amber }, line: { color: C.amber, width: 0 },
  });

  iconBadge(s, 0.7, 0.45, 0.7, C.amber, "⏰");
  s.addText("Module 2 · ระบบจัดการ OT", {
    x: 1.55, y: 0.4, w: 8, h: 0.4,
    fontFace: F.body, fontSize: 12, color: C.muted, bold: true,
  });
  s.addText("Overtime Management", {
    x: 1.55, y: 0.7, w: 8, h: 0.6,
    fontFace: F.head, fontSize: 28, bold: true, color: C.text,
  });

  const features = [
    { h: "สายรถผูก default ต่อพนักงาน", d: "ติ๊กพนักงาน → สายรถ auto-fill จาก default — Override รายคนได้ถ้ามีการเปลี่ยนแปลง" },
    { h: "ลักษณะงาน + Remark รายคน", d: "แต่ละคนกรอกลักษณะงานต่างกันได้ + Remark กรณีอยู่ต่อ/เลิกก่อนเวลา · รองรับ OT วันหยุด" },
    { h: "Approve/Reject รายคน + Cross-dept", d: "ผู้อนุมัติเลือกรายชื่อ → คนติ๊ก approved, ไม่ติ๊ก ผ่าน · ส่ง FYI email หัวหน้าแผนกต้นสังกัด" },
    { h: "รายงาน OT ครบทุกมุม", d: "สรุปสายรถ × คน × วัน + Filter ตามกะ Day/Night + Excel 2 sheet" },
  ];

  features.forEach((f, i) => {
    const y = 1.85 + i * 1.15;
    iconBadge(s, 0.7, y, 0.45, C.amber, (i + 1).toString());
    s.addText(f.h, {
      x: 1.35, y: y - 0.05, w: 5.5, h: 0.4,
      fontFace: F.head, fontSize: 14, bold: true, color: C.text,
    });
    s.addText(f.d, {
      x: 1.35, y: y + 0.35, w: 5.5, h: 0.4,
      fontFace: F.body, fontSize: 11, color: C.muted,
    });
  });

  drawOTMockup(s, 7.5, 1.6, 5.3, 5.0);

  addFooter(s, 4, TOTAL);
}

function drawOTMockup(s, x, y, w, h) {
  // Browser frame
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: "FFFFFF" }, line: { color: C.border, width: 1 }, rectRadius: 0.08,
  });
  s.addShape(pres.ShapeType.rect, {
    x, y, w, h: 0.35,
    fill: { color: "F1F5F9" }, line: { color: C.border, width: 0 },
  });
  ["EF4444", "F59E0B", "10B981"].forEach((c, i) => {
    s.addShape(pres.ShapeType.ellipse, {
      x: x + 0.1 + i * 0.18, y: y + 0.1, w: 0.12, h: 0.12,
      fill: { color: c }, line: { color: c, width: 0 },
    });
  });
  s.addText("ams.local / ot / create", {
    x: x + 1.0, y: y + 0.05, w: w - 1.2, h: 0.25,
    fontFace: F.body, fontSize: 8, color: C.muted, valign: "middle",
  });

  s.addText("สร้าง OT", {
    x: x + 0.25, y: y + 0.5, w: w - 0.5, h: 0.35,
    fontFace: F.head, fontSize: 14, bold: true, color: C.text,
  });

  // Shift selector — Day selected
  s.addText("กะ", { x: x + 0.25, y: y + 1.0, w: 2, h: 0.2, fontFace: F.body, fontSize: 8, color: C.muted });
  s.addShape(pres.ShapeType.roundRect, {
    x: x + 0.25, y: y + 1.2, w: 2.4, h: 0.6,
    fill: { color: "FFFBEB" }, line: { color: C.amber, width: 1.5 }, rectRadius: 0.05,
  });
  s.addText("☀  Day (กะกลางวัน)", {
    x: x + 0.25, y: y + 1.2, w: 2.4, h: 0.6,
    fontFace: F.body, fontSize: 10, bold: true, color: "92400E", align: "center", valign: "middle",
  });
  s.addShape(pres.ShapeType.roundRect, {
    x: x + 2.75, y: y + 1.2, w: 2.05, h: 0.6,
    fill: { color: "FFFFFF" }, line: { color: C.border, width: 1 }, rectRadius: 0.05,
  });
  s.addText("🌙  Night", {
    x: x + 2.75, y: y + 1.2, w: 2.05, h: 0.6,
    fontFace: F.body, fontSize: 10, color: C.muted, align: "center", valign: "middle",
  });

  // Time slot preset (selected: 17:00-19:30)
  const slots = [
    { t: "07:30 - 16:10", h: "8.67 ชม.", sel: false },
    { t: "07:30 - 19:30", h: "12.00 ชม.", sel: false },
    { t: "17:00 - 19:30", h: "2.50 ชม.", sel: true },
  ];
  slots.forEach((sl, i) => {
    const sy = y + 2.0 + i * 0.45;
    s.addShape(pres.ShapeType.roundRect, {
      x: x + 0.25, y: sy, w: w - 0.5, h: 0.38,
      fill: { color: sl.sel ? "EEF2FF" : "FFFFFF" },
      line: { color: sl.sel ? C.indigo : C.border, width: sl.sel ? 1.5 : 0.5 },
      rectRadius: 0.05,
    });
    s.addText(`${sl.sel ? "●" : "○"}  ${sl.t}`, {
      x: x + 0.4, y: sy, w: 3, h: 0.38,
      fontFace: F.body, fontSize: 10, color: sl.sel ? C.indigo : C.text,
      bold: sl.sel, valign: "middle",
    });
    s.addText(sl.h, {
      x: x + w - 1.4, y: sy, w: 1.0, h: 0.38,
      fontFace: F.body, fontSize: 9, color: C.muted, align: "right", valign: "middle",
    });
  });

  // Employee + bus route row
  s.addShape(pres.ShapeType.roundRect, {
    x: x + 0.25, y: y + 3.6, w: w - 0.5, h: 0.5,
    fill: { color: "F8FAFC" }, line: { color: C.border, width: 0.5 }, rectRadius: 0.05,
  });
  s.addText("🚌  สายรถของแต่ละคน · 5 พนักงาน", {
    x: x + 0.4, y: y + 3.6, w: w - 0.5, h: 0.5,
    fontFace: F.body, fontSize: 10, color: C.text, valign: "middle",
  });

  // Result
  s.addShape(pres.ShapeType.roundRect, {
    x: x + 0.25, y: y + 4.2, w: w - 0.5, h: 0.5,
    fill: { color: "FEF3C7" }, line: { color: C.amber, width: 0.5 }, rectRadius: 0.05,
  });
  s.addText("รวม 2.50 ชั่วโมง × 5 คน", {
    x: x + 0.4, y: y + 4.2, w: w - 0.5, h: 0.5,
    fontFace: F.body, fontSize: 11, bold: true, color: "92400E", valign: "middle",
  });
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 5 — APPROVAL WORKFLOW + REPORTS
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bg };

  s.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 0.25, h: 7.5,
    fill: { color: C.success }, line: { color: C.success, width: 0 },
  });

  iconBadge(s, 0.7, 0.45, 0.7, C.success, "✓");
  s.addText("Module 3 · Workflow อนุมัติ + รายงาน", {
    x: 1.55, y: 0.4, w: 11, h: 0.4,
    fontFace: F.body, fontSize: 12, color: C.muted, bold: true,
  });
  s.addText("Approval Flow & Reports", {
    x: 1.55, y: 0.7, w: 11, h: 0.6,
    fontFace: F.head, fontSize: 28, bold: true, color: C.text,
  });

  // ── Approval flow diagram ──
  s.addText("Workflow การอนุมัติ", {
    x: 0.7, y: 1.7, w: 12, h: 0.35,
    fontFace: F.head, fontSize: 16, bold: true, color: C.text,
  });

  // Office flow (2-step)
  s.addText("Office (2 step)", {
    x: 0.7, y: 2.15, w: 3, h: 0.3,
    fontFace: F.body, fontSize: 11, color: C.muted, italic: true,
  });
  drawFlowStep(s, 0.7, 2.5, "หัวหน้า", "สร้างใบ", C.indigo);
  drawArrow(s, 2.55, 2.7);
  drawFlowStep(s, 2.9, 2.5, "ผจก.แผนก", "อนุมัติ", C.amber);
  drawArrow(s, 4.75, 2.7);
  drawFlowStep(s, 5.1, 2.5, "อนุมัติ ✓", "เสร็จ", C.success);

  // Production flow (3-step)
  s.addText("ผลิต (3 step)", {
    x: 0.7, y: 3.6, w: 3, h: 0.3,
    fontFace: F.body, fontSize: 11, color: C.muted, italic: true,
  });
  drawFlowStep(s, 0.7, 3.95, "หัวหน้า", "สร้างใบ", C.indigo);
  drawArrow(s, 2.55, 4.15);
  drawFlowStep(s, 2.9, 3.95, "ผจก.แผนก", "อนุมัติ", C.amber);
  drawArrow(s, 4.75, 4.15);
  drawFlowStep(s, 5.1, 3.95, "ผจก.โรงงาน", "อนุมัติ", C.amber);
  drawArrow(s, 6.95, 4.15);
  drawFlowStep(s, 7.3, 3.95, "อนุมัติ ✓", "เสร็จ", C.success);

  // HR fast-track note
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.7, y: 5.0, w: 6.0, h: 0.8,
    fill: { color: "F0FDF4" }, line: { color: C.success, width: 1 }, rectRadius: 0.08,
  });
  iconBadge(s, 0.85, 5.18, 0.45, C.success, "★");
  s.addText("HR Admin คลิกเดียวจบ", {
    x: 1.45, y: 5.05, w: 5, h: 0.3,
    fontFace: F.head, fontSize: 12, bold: true, color: "065F46",
  });
  s.addText("ไม่ต้องผ่าน 2-3 step — fast-track ตรงไป APPROVED", {
    x: 1.45, y: 5.35, w: 5, h: 0.3,
    fontFace: F.body, fontSize: 10, color: "065F46",
  });

  // ── Reports panel (right side) ──
  card(s, 7.2, 1.85, 5.6, 4.85);
  s.addShape(pres.ShapeType.rect, {
    x: 7.2, y: 1.85, w: 5.6, h: 0.1,
    fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
  });
  s.addText("📊  รายงาน + Excel Export", {
    x: 7.4, y: 2.05, w: 5.2, h: 0.4,
    fontFace: F.head, fontSize: 14, bold: true, color: C.text,
  });
  s.addText("ดูข้อมูลในตาราง + กรอง + ดาวน์โหลด", {
    x: 7.4, y: 2.4, w: 5.2, h: 0.3,
    fontFace: F.body, fontSize: 10, color: C.muted, italic: true,
  });

  // Mini bar chart
  const bars = [
    { label: "ม.ค.", v: 0.55 },
    { label: "ก.พ.", v: 0.75 },
    { label: "มี.ค.", v: 0.4 },
    { label: "เม.ย.", v: 0.9 },
    { label: "พ.ค.", v: 0.65 },
    { label: "มิ.ย.", v: 0.85 },
  ];
  const chartX = 7.4, chartY = 3.0, chartW = 5.2, chartH = 2.0;
  s.addShape(pres.ShapeType.rect, {
    x: chartX, y: chartY + chartH, w: chartW, h: 0.02,
    fill: { color: C.border }, line: { color: C.border, width: 0 },
  });
  const barW = 0.55, gap = (chartW - bars.length * barW) / (bars.length + 1);
  bars.forEach((b, i) => {
    const bx = chartX + gap + i * (barW + gap);
    const bh = b.v * chartH;
    s.addShape(pres.ShapeType.rect, {
      x: bx, y: chartY + chartH - bh, w: barW, h: bh,
      fill: { color: i % 2 === 0 ? C.indigo : C.cyan },
      line: { color: "FFFFFF", width: 0 },
    });
    s.addText(b.label, {
      x: bx - 0.1, y: chartY + chartH + 0.05, w: barW + 0.2, h: 0.25,
      fontFace: F.body, fontSize: 9, color: C.muted, align: "center",
    });
  });

  // Report types
  const reports = ["Leave Monthly Report", "OT Summary Report"];
  reports.forEach((r, i) => {
    const ry = 5.4 + i * 0.5;
    s.addShape(pres.ShapeType.roundRect, {
      x: 7.4, y: ry, w: 5.2, h: 0.4,
      fill: { color: "F8FAFC" }, line: { color: C.border, width: 0.5 }, rectRadius: 0.05,
    });
    s.addText("📄  " + r, {
      x: 7.55, y: ry, w: 4, h: 0.4,
      fontFace: F.body, fontSize: 11, color: C.text, valign: "middle",
    });
    s.addShape(pres.ShapeType.roundRect, {
      x: 11.5, y: ry + 0.05, w: 1.0, h: 0.3,
      fill: { color: C.success }, line: { color: C.success, width: 0 }, rectRadius: 0.04,
    });
    s.addText("Excel ↓", {
      x: 11.5, y: ry + 0.05, w: 1.0, h: 0.3,
      fontFace: F.body, fontSize: 9, color: "FFFFFF", bold: true, align: "center", valign: "middle",
    });
  });

  addFooter(s, 5, TOTAL);
}

function drawFlowStep(s, x, y, title, sub, color) {
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w: 1.85, h: 0.85,
    fill: { color: "FFFFFF" }, line: { color, width: 1.5 }, rectRadius: 0.08,
  });
  s.addText(title, {
    x: x + 0.05, y: y + 0.12, w: 1.75, h: 0.32,
    fontFace: F.head, fontSize: 12, bold: true, color, align: "center",
  });
  s.addText(sub, {
    x: x + 0.05, y: y + 0.45, w: 1.75, h: 0.32,
    fontFace: F.body, fontSize: 9, color: C.muted, align: "center",
  });
}

function drawArrow(s, x, y) {
  s.addText("→", {
    x: x - 0.05, y: y - 0.1, w: 0.4, h: 0.4,
    fontFace: F.head, fontSize: 22, bold: true, color: C.muted,
    align: "center", valign: "middle",
  });
}

// ═══════════════════════════════════════════════════════════════
// SLIDE 6 — KEY HIGHLIGHTS / SUMMARY (closing — dark again)
// ═══════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.navy };

  // Decorative blobs
  s.addShape(pres.ShapeType.ellipse, {
    x: 9, y: -2, w: 6, h: 6,
    fill: { color: C.violet, transparency: 75 },
    line: { color: C.violet, width: 0 },
  });
  s.addShape(pres.ShapeType.ellipse, {
    x: -3, y: 4, w: 6, h: 6,
    fill: { color: C.indigo, transparency: 75 },
    line: { color: C.indigo, width: 0 },
  });

  s.addText("ทำไมต้อง AMS?", {
    x: 0.7, y: 0.6, w: 12, h: 0.55,
    fontFace: F.head, fontSize: 32, bold: true, color: "FFFFFF",
  });
  s.addText("ฟีเจอร์เด่นที่ทำให้ระบบนี้ใช้งานได้จริงในองค์กร", {
    x: 0.7, y: 1.2, w: 12, h: 0.4,
    fontFace: F.body, fontSize: 14, color: "CADCFC",
  });

  // 6 highlight cards
  const highlights = [
    { icon: "🇹🇭", h: "พ.ศ. ทั้งระบบ",        d: "วันที่ทุกหน้าใช้ปฏิทินไทย ผู้ใช้คุ้นเคย",  c: C.cyan },
    { icon: "📧", h: "Email ครบทุกขั้นตอน", d: "หัวเมลสีตามสถานะ + ลิงก์เข้าระบบ",      c: C.rose },
    { icon: "🔐", h: "5 ระดับสิทธิ์",        d: "หัวหน้า · ผจก.แผนก · ผจก.โรงงาน · HR · Admin",   c: C.amber },
    { icon: "⚡", h: "Auto Carry-over",      d: "วันลาเหลือ → โอนปีหน้าอัตโนมัติ",        c: C.indigo },
    { icon: "📅", h: "Cut-off Time",         d: "ตั้งเวลาตัดยอดสร้าง/อนุมัติได้",          c: C.violet },
    { icon: "📊", h: "Reports + Excel",      d: "กรองแล้วดาวน์โหลดได้ทันที",            c: C.success },
  ];

  const cw = 4.0, ch = 1.65, sx = 0.55, sy = 2.1, gx = 0.25, gy = 0.25;
  highlights.forEach((hi, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = sx + col * (cw + gx);
    const y = sy + row * (ch + gy);

    s.addShape(pres.ShapeType.roundRect, {
      x, y, w: cw, h: ch,
      fill: { color: "FFFFFF", transparency: 92 },
      line: { color: "FFFFFF", width: 0.5 },
      rectRadius: 0.1,
    });
    // colored stripe
    s.addShape(pres.ShapeType.rect, {
      x, y, w: 0.08, h: ch,
      fill: { color: hi.c }, line: { color: hi.c, width: 0 },
    });
    iconBadge(s, x + 0.3, y + 0.35, 0.55, hi.c, hi.icon);
    s.addText(hi.h, {
      x: x + 1.0, y: y + 0.28, w: cw - 1.15, h: 0.35,
      fontFace: F.head, fontSize: 14, bold: true, color: "FFFFFF",
    });
    s.addText(hi.d, {
      x: x + 1.0, y: y + 0.65, w: cw - 1.15, h: 0.85,
      fontFace: F.body, fontSize: 11, color: "CADCFC",
    });
  });

  // Closing tagline
  s.addText("พร้อมใช้งานวันนี้ — รองรับ 460+ พนักงาน", {
    x: 0.7, y: 6.55, w: 12, h: 0.4,
    fontFace: F.head, fontSize: 16, bold: true, color: C.cyan,
    align: "center",
  });

  s.addText("ขอบคุณครับ", {
    x: 0.7, y: 7.05, w: 12, h: 0.3,
    fontFace: F.body, fontSize: 11, color: "CADCFC",
    align: "center",
  });
}

// ── Save ── output both filenames so they stay in sync
const fs = require("fs");
pres.writeFile({ fileName: "AMS-Presentation.pptx" })
  .then((fileName) => {
    console.log(`✅ Created: ${fileName}`);
    // Copy to "Klun final" filename so both versions are identical
    const target = "AMS-Presentation Klun final.pptx";
    fs.copyFileSync(fileName, target);
    console.log(`✅ Synced: ${target}`);
  })
  .catch((err) => { console.error("❌", err); process.exit(1); });
