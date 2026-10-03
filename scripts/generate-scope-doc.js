/**
 * Generate Scope of Work document for AMS (Attendance Management System)
 * Mirrors the customer's example layout (Thai, tabular).
 *
 * Output: docs/AMS-Scope-of-Work.docx
 */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageOrientation, LevelFormat, PageBreak, VerticalAlign,
} = require("docx");

// ---------- Helpers ----------
const FONT = "TH Sarabun New"; // Thai-friendly; falls back gracefully if unavailable

const border = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };
const allBorders = { top: border, bottom: border, left: border, right: border };
const headerShading = { fill: "BFBFBF", type: ShadingType.CLEAR, color: "auto" };
const summaryHeaderShading = { fill: "BFBFBF", type: ShadingType.CLEAR, color: "auto" };

/** Create a simple paragraph with default font */
const P = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: 60, before: 0 },
    ...opts,
    children: [new TextRun({ text, font: FONT, size: opts.size || 24, bold: opts.bold || false, italics: opts.italics || false })],
  });

/** Bold paragraph */
const PB = (text, size = 26) => P(text, { bold: true, size });

/** Empty spacer line */
const SPACER = () => new Paragraph({ spacing: { after: 80 }, children: [new TextRun("")] });

/** Sub-section heading inside a cell */
const SUB = (text) => P(text, { bold: true, size: 26, spacing: { before: 160, after: 80 } });

/** Numbered list item inside a cell */
const LI = (n, text) => P(`${n}. ${text}`, { size: 24, spacing: { after: 60 } });

/** Plain detail line inside a cell */
const DASH = (text) => P(`- ${text}`, { size: 24, spacing: { after: 40 } });

/** Build a normal cell */
const cell = (children, opts = {}) =>
  new TableCell({
    borders: allBorders,
    width: { size: opts.width, type: WidthType.DXA },
    shading: opts.shading,
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    verticalAlign: opts.va || VerticalAlign.TOP,
    children: Array.isArray(children) ? children : [children],
  });

// ---------- Page dimensions ----------
const PAGE_W = 11906;   // A4 portrait DXA
const PAGE_H = 16838;
const MARGIN = 1000;
const CONTENT_W = PAGE_W - MARGIN * 2; // 9906

// Main table column widths (sum = CONTENT_W)
const COL_NO = 700;
const COL_DESC = 5800;
const COL_QTY = 900;
const COL_UNIT = 1200;
const COL_SUM = 1306;
const COLS = [COL_NO, COL_DESC, COL_QTY, COL_UNIT, COL_SUM];

// Header row helper
const headerCell = (text, width, align = AlignmentType.LEFT) =>
  new TableCell({
    borders: allBorders,
    width: { size: width, type: WidthType.DXA },
    shading: headerShading,
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ text, font: FONT, size: 26, bold: true })],
    })],
  });

const numCell = (text, width) =>
  new TableCell({
    borders: allBorders,
    width: { size: width, type: WidthType.DXA },
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    verticalAlign: VerticalAlign.TOP,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, font: FONT, size: 24 })],
    })],
  });

// ---------- Build main scope table ----------
const headerRow = new TableRow({
  tableHeader: true,
  children: [
    headerCell("ลำดับ", COL_NO, AlignmentType.CENTER),
    headerCell("รายละเอียด", COL_DESC),
    headerCell("จำนวน", COL_QTY, AlignmentType.CENTER),
    headerCell("ราคาต่อหน่วย", COL_UNIT, AlignmentType.CENTER),
    headerCell("รวม", COL_SUM, AlignmentType.CENTER),
  ],
});

// ---------- Item 1: Development ----------
const devContent = [
  PB("Development"),
  P("[DEV] การพัฒนาระบบ Attendance Management System (AMS)", { size: 24 }),

  // 1) ระบบจัดการการลา
  SUB("ระบบจัดการการลา (Leave Management)"),
  LI(1, "หัวหน้าทีมเป็นผู้รวบรวมและสร้างใบลาแทนพนักงานในระบบ (Proxy creation)"),
  LI(2, "เลือกวันลาแบบรายวันได้หลายวันในใบเดียว — แต่ละวันเลือกได้ว่า เต็มวัน / ครึ่งเช้า / ครึ่งบ่าย"),
  LI(3, "ระบบป้องกันการลาทับซ้อน (ลาวันเดิมเวลาเดียวกันไม่ได้ — แต่ลาเช้า+บ่ายในวันเดียวกันได้)"),
  LI(4, "แยกขั้นตอนอนุมัติพนักงานสำนักงาน (จบที่ผู้จัดการแผนก) กับสายการผลิต (จบที่ผู้จัดการโรงงาน)"),
  LI(5, "อนุมัติแบบครั้งละหลายรายการ (Bulk Approve/Reject) เลือกผ่าน Checkbox"),
  LI(6, "เหตุผลการปฏิเสธ (Reject Reasons) มาจาก Master CRUD ที่ HR กำหนดเอง"),
  LI(7, "ระบบคำนวณวันลาตามอายุงาน (Pro-rate) อัตโนมัติ + รองรับ Carry Over วันลาคงเหลือข้ามปี"),
  LI(8, "หัวหน้าและผู้จัดการดูสิทธิ์การลาคงเหลือของลูกน้องในทีมตัวเองได้"),
  LI(9, "พนักงาน/หัวหน้ายกเลิกใบลาที่ยังไม่อนุมัติได้ และขอยกเลิกใบลาที่อนุมัติแล้วได้ (ส่งให้ผู้อนุมัติพิจารณา)"),
  LI(10, "Notification แจ้งเตือนทุก step ผ่าน E-mail (สร้าง / อนุมัติ / ปฏิเสธ / ยกเลิก) — มี CC HR Admin"),
  LI(11, "HR Export ข้อมูลการลารายเดือนเป็น Excel เพื่อนำไปใช้ในระบบ Payroll"),
  LI(12, "HR ดูข้อมูลวันลาที่พนักงานใช้ในแต่ละปีเพื่อนำไปคำนวณ KPI ได้"),
  LI(13, "รองรับการแนบเอกสารประกอบการลา (เช่น ใบรับรองแพทย์)"),

  // 2) ระบบ OT
  SUB("ระบบ OT และรถรับ-ส่ง (OT & Bus Routes)"),
  LI(1, "หัวหน้าทีมลิสต์รายชื่อพนักงานที่ทำ OT และเลือกรอบรถที่จะโดยสารกลับ"),
  LI(2, "ระบุได้ทั้งพนักงานในแผนกตัวเองและพนักงานข้ามแผนก (Cross-department) — มี FYI E-mail ส่งให้ผู้จัดการแผนกต้นสังกัด"),
  LI(3, "ระบบ Pre-fill สายรถจาก Default ของพนักงานแต่ละคน (ตั้งค่าไว้ใน Master) — Override ได้รายคน"),
  LI(4, "กำหนดลักษณะงานและหมายเหตุได้รายคน ไม่ใช่แค่ใบ OT-level"),
  LI(5, "ระบุกะการทำงาน (Day / Night) ได้ตอนสร้าง OT"),
  LI(6, "ขั้นตอนอนุมัติ: พนักงานสำนักงานจบที่ผู้จัดการแผนก / พนักงานสายการผลิตจบที่ผู้จัดการโรงงาน"),
  LI(7, "แผนก Admin ดูสรุปจำนวนคนทำ OT และสายรถที่ต้องใช้ — เพื่อนับจำนวนรถที่ต้องเตรียม"),
  LI(8, "แผนก Admin / HR แก้ไขข้อมูลได้ (เพิ่ม / ลด / ยกเลิก) ในแต่ละใบ OT"),
  LI(9, "ส่ง E-mail สรุปการทำ OT ให้ผู้บริหารและ HR ทราบทุกวัน"),
  LI(10, "เรียกสรุปข้อมูลการทำ OT และการใช้สายรถเป็นรายเดือน + Filter ตามกะ (Day/Night)"),
  LI(11, "Export Excel มี Sheet สรุปสายรถ × คน × วัน แยก Sheet ออกจาก Sheet หลัก"),
  LI(12, "ระบบ Cut-off Time: ปิดการสร้าง OT/Leave หลังเวลาที่กำหนด (ปรับ Setting ได้)"),

  // 3) Master Data
  SUB("ระบบจัดการข้อมูลพื้นฐาน (Master Data)"),
  LI(1, "ข้อมูลพนักงาน (Employee) — เก็บรหัสพนักงาน, ชื่อ-สกุล, แผนก, ตำแหน่ง, วันที่เริ่มงาน, หัวหน้า, สายรถ Default"),
  LI(2, "แผนก (Department) — กำหนดผู้จัดการแผนก, ฝ่าย Office/Production"),
  LI(3, "ประเภทการลา (Leave Type) — รหัส, ชื่อ, จำนวนวันต่อปี, เปิด/ปิดใช้งาน"),
  LI(4, "สายรถรับ-ส่ง (Bus Route)"),
  LI(5, "เหตุผลการปฏิเสธใบลา (Leave Reject Reason)"),
  LI(6, "ทุก Master รองรับการ Create / Update / Soft Delete + Sort Order"),

  // 4) Reports
  SUB("ระบบรายงาน (Reports)"),
  LI(1, "รายงานสรุปการลารายเดือน — แยกตามประเภทการลา, แผนก, พนักงาน + Export Excel"),
  LI(2, "รายงานสรุปการทำ OT รายเดือน — แยกตามแผนก, พนักงาน, กะ + Export Excel"),
  LI(3, "สรุปการใช้สายรถ × คน × วัน (Bus Route Summary) ใน Sheet แยก"),
  LI(4, "Dashboard ภาพรวม: จำนวนใบลา / OT รออนุมัติ, จำนวนวันลาที่ใช้แล้ว, Chart รายเดือน"),
  LI(5, "Filter ในทุกรายงาน: ช่วงวันที่, แผนก, สถานะ, กะ"),

  // 5) Workflow & Notification
  SUB("ระบบ Workflow และการแจ้งเตือน"),
  LI(1, "Workflow 2 ขั้นตอนสำหรับ Office: หัวหน้าสร้าง → ผู้จัดการแผนกอนุมัติ → จบ"),
  LI(2, "Workflow 3 ขั้นตอนสำหรับ Production: หัวหน้าสร้าง → ผู้จัดการแผนกอนุมัติ → ผู้จัดการโรงงานอนุมัติ → จบ"),
  LI(3, "ส่ง E-mail แจ้งเตือนทุก Step (สร้าง / อนุมัติ / ปฏิเสธ / ยกเลิก) — CC HR Admin"),
  LI(4, "บันทึก Email Log ทุกฉบับในระบบ — ตรวจสอบย้อนหลังได้"),
  LI(5, "Audit Trail บันทึกประวัติการอนุมัติพร้อมผู้กระทำและเวลา"),

  // 6) Settings
  SUB("ระบบตั้งค่า (Settings)"),
  LI(1, "ตั้งค่า Cut-off Time แยกระหว่างการสร้าง (11:00) และการอนุมัติ (13:00) — แก้ไขได้"),
  LI(2, "Toggle เปิด-ปิดการบังคับใช้ Cut-off (Enforce / Disable)"),
  LI(3, "ตั้งค่า Carry Over ของแต่ละประเภทการลา — กำหนดเพดานวันคงเหลือยกไปปีถัดไป"),
  LI(4, "ตั้งค่า SMTP สำหรับการส่ง E-mail"),

  // 7) Security
  SUB("ระบบความปลอดภัยและสิทธิ์ผู้ใช้ (Security & Roles)"),
  LI(1, "Login ด้วย Username / Password (รหัสผ่านเข้ารหัสด้วย bcrypt)"),
  LI(2, "แบ่งสิทธิ์ 5 Role: SUPERVISOR / DEPT_MANAGER / FACTORY_MANAGER / HR_ADMIN / SYSTEM_ADMIN"),
  LI(3, "Middleware ป้องกัน Route ที่ต้อง Login + แสดงเมนูตาม Role"),
  LI(4, "Session Management ผ่าน NextAuth.js"),
  LI(5, "บันทึก Audit Log การเข้าใช้งานและการแก้ไขข้อมูล Master"),

  // 8) Tech Stack
  SUB("เทคโนโลยีที่ใช้ในการพัฒนา (Tech Stack)"),
  DASH("Framework: Next.js 14 (App Router) + React 18 + TypeScript"),
  DASH("UI: Tailwind CSS + shadcn/ui + Framer Motion"),
  DASH("Database: Microsoft SQL Server 2019"),
  DASH("ORM: Prisma 5"),
  DASH("Authentication: NextAuth.js v5"),
  DASH("E-mail: Nodemailer (SMTP)"),
  DASH("Excel Export: ExcelJS"),
  DASH("Charts: Recharts"),
];

const row1 = new TableRow({
  children: [
    numCell("1", COL_NO),
    cell(devContent, { width: COL_DESC }),
    numCell("1 Job", COL_QTY),
    numCell("", COL_UNIT),
    numCell("", COL_SUM),
  ],
});

// ---------- Item 2: Implementation Fee ----------
const implContent = [
  PB("Implementation Fee"),
  P("Scope of Work", { size: 24, spacing: { after: 80 } }),
  DASH("Installation OS to server"),
  DASH("Deploy program on Server"),
  DASH("On the job training admin and user"),
  DASH("Migrate Master data จาก Excel เข้าระบบ (Bulk Import)"),
  DASH("Setup E-mail Server (SMTP) และทดสอบการส่ง E-mail"),
  DASH("Setup สิทธิ์ User เริ่มต้น และจัดทำคู่มือการใช้งาน"),
];

const row2 = new TableRow({
  children: [
    numCell("2", COL_NO),
    cell(implContent, { width: COL_DESC }),
    numCell("1 Job", COL_QTY),
    numCell("", COL_UNIT),
    numCell("", COL_SUM),
  ],
});

// ---------- Item 3: Service & Support ----------
const supportContent = [
  PB("Service and Support by C Nex for 1 year"),
  P("Service and Support by C Nex for 1 year", { size: 24, spacing: { after: 80 } }),
  DASH("Troubleshoot system problems, diagnosing and solving software faults"),
  DASH("Standby and consultants on call and response depending on SLA level"),
  DASH("Remote diagnostics (In case of customer provides remote desktop connection)"),
  DASH("On-site investigation and support in case of critical problem occurred (Maximum 2 time / year)"),
  DASH("NBD (Next business day) response, 12 hours a day, 5 days a week"),
];

const row3 = new TableRow({
  children: [
    numCell("3", COL_NO),
    cell(supportContent, { width: COL_DESC }),
    numCell("1 Job", COL_QTY),
    numCell("", COL_UNIT),
    numCell("", COL_SUM),
  ],
});

const mainTable = new Table({
  width: { size: CONTENT_W, type: WidthType.DXA },
  columnWidths: COLS,
  rows: [headerRow, row1, row2, row3],
});

// ---------- Footer: Summary box + Note ----------
// Two-column layout: left = หมายเหตุ, right = สรุปจำนวนเงิน

const NOTE_COL = 5800;
const SUM_COL = CONTENT_W - NOTE_COL; // 4106

const noteCellContent = [
  PB("หมายเหตุ", 26),
  P("Lead Time : 4.5 - 5.5 Months", { size: 24 }),
  P("ระยะเวลารับประกัน : 1 ปี นับจากวันส่งมอบงาน", { size: 24 }),
];

// Summary box (inner table)
const summaryInner = new Table({
  width: { size: SUM_COL - 200, type: WidthType.DXA },
  columnWidths: [Math.round((SUM_COL - 200) * 0.6), Math.round((SUM_COL - 200) * 0.4)],
  rows: [
    new TableRow({
      children: [
        new TableCell({
          borders: allBorders, shading: summaryHeaderShading,
          width: { size: SUM_COL - 200, type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: "สรุปจำนวนเงิน", font: FONT, size: 26, bold: true })],
          })],
          columnSpan: 2,
        }),
      ],
    }),
    ...[
      "จำนวนเงินก่อนภาษี",
      "หัก ณ ที่จ่าย 3%",
      "ภาษีมูลค่าเพิ่ม 7%",
      "ยอดจ่ายสุทธิ",
    ].map((label, i, arr) => new TableRow({
      children: [
        new TableCell({
          borders: allBorders,
          width: { size: Math.round((SUM_COL - 200) * 0.6), type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({
            children: [new TextRun({ text: label, font: FONT, size: 24, bold: i === arr.length - 1 })],
          })],
        }),
        new TableCell({
          borders: allBorders,
          width: { size: Math.round((SUM_COL - 200) * 0.4), type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "", font: FONT, size: 24 })],
          })],
        }),
      ],
    })),
  ],
});

const footerTable = new Table({
  width: { size: CONTENT_W, type: WidthType.DXA },
  columnWidths: [NOTE_COL, SUM_COL],
  rows: [
    new TableRow({
      children: [
        new TableCell({
          borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
          width: { size: NOTE_COL, type: WidthType.DXA },
          margins: { top: 200, bottom: 100, left: 100, right: 100 },
          verticalAlign: VerticalAlign.TOP,
          children: noteCellContent,
        }),
        new TableCell({
          borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
          width: { size: SUM_COL, type: WidthType.DXA },
          margins: { top: 100, bottom: 100, left: 100, right: 0 },
          verticalAlign: VerticalAlign.TOP,
          children: [summaryInner],
        }),
      ],
    }),
  ],
});

// ---------- Title / Header section ----------
const titleParagraphs = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: "Scope of Work / ขอบเขตงาน", font: FONT, size: 36, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: "ระบบบริหารจัดการการลาและ OT (Attendance Management System - AMS)", font: FONT, size: 28, bold: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [
      new TextRun({ text: "ลูกค้า: __________________________________   ", font: FONT, size: 24 }),
      new TextRun({ text: "วันที่: __________________________________", font: FONT, size: 24 }),
    ],
  }),
];

// ---------- Build document ----------
const doc = new Document({
  creator: "AMS Project",
  title: "AMS - Scope of Work",
  description: "Scope of Work for Attendance Management System",
  styles: {
    default: {
      document: { run: { font: FONT, size: 24 } },
    },
  },
  sections: [{
    properties: {
      page: {
        size: { width: PAGE_W, height: PAGE_H, orientation: PageOrientation.PORTRAIT },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      },
    },
    children: [
      ...titleParagraphs,
      mainTable,
      SPACER(),
      SPACER(),
      footerTable,
      SPACER(),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 400 },
        children: [new TextRun({ text: "หน้าที่ 1 / 1", font: FONT, size: 20, italics: true })],
      }),
    ],
  }],
});

// ---------- Write file ----------
const outPath = path.join(__dirname, "..", "docs", "AMS-Scope-of-Work.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outPath, buf);
  console.log("Wrote:", outPath, "(" + buf.length + " bytes)");
}).catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
