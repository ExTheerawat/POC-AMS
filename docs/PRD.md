# PRD: Attendance Management System (AMS)

## 1. Context / ภาพรวม

ระบบ **Attendance Management System (AMS)** เป็นระบบบริหารจัดการการลาและการทำงานล่วงเวลา (OT) ของพนักงานภายในองค์กร โดยมีพนักงานทั้งหมดประมาณ **460 คน** แบ่งออกเป็น 2 ฝั่งคือ **Office** และ **ผลิต (Production)**

**ปัญหาที่ต้องการแก้:**
- ปัจจุบันการลาใช้วิธีโทรหาหัวหน้าให้ลาแทน ทำให้ไม่มีระบบบันทึกที่เป็นทางการ
- การจัดการ OT ไม่มีระบบกลาง ทำให้ตรวจสอบ/เปรียบเทียบยาก
- ไม่มีการแจ้งเตือนอัตโนมัติ และไม่มี Workflow Approval ที่ชัดเจน
- ไม่สามารถ Export ข้อมูลออกมาเป็น Report ได้สะดวก

**เป้าหมาย:**
- ระบบรวมการจัดการ Leave + OT ในเว็บแอปเดียว แต่แยกเป็น 2 Module
- มี Workflow Approval ตาม Hierarchy แยกฝั่ง Office / ผลิต
- มีระบบแจ้งเตือนอีเมล, Master Data, Dashboard, Export Excel
- Time-based control (ตัด 11:00 / 13:00)

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+ (App Router), React, TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Backend | Next.js API Routes / Server Actions |
| Database | **Microsoft SQL Server** |
| ORM | Prisma (มี SQL Server driver) หรือ Drizzle |
| Authentication | NextAuth.js (Credentials / AD-LDAP ถ้าต้องการ) |
| Email | Nodemailer + SMTP (หรือ Resend) |
| Excel Export | ExcelJS / SheetJS |
| Scheduler | node-cron (สำหรับเช็คเวลา 11:00 / 13:00 / Carry Over ปลายปี) |
| Charts (Dashboard) | Recharts |

---

## 3. User Roles

| Role | คำอธิบาย | สิทธิ์หลัก |
|------|---------|-----------|
| **Employee** | พนักงานทั่วไป (460 คน) | ดูข้อมูลการลา/OT ของตัวเอง |
| **Supervisor (หัวหน้า)** | หัวหน้าแผนก (ฝั่ง Office) / หัวหน้างาน (ฝั่งผลิต) | สร้างใบลา/OT ให้ลูกน้อง |
| **Department Manager (ผู้จัดการแผนก)** | ผู้จัดการแผนก | Approve ขั้นที่ 1 |
| **Factory Manager (ผู้จัดการโรงงาน)** | ผู้จัดการโรงงาน | Approve ขั้นสุดท้าย (เฉพาะฝั่งผลิต) |
| **HR Admin** | ฝ่ายบุคคล | จัดการ Master Data, Import พนักงาน, แก้ไข OT, รับเรื่องยกเลิก, ออก Report |
| **System Admin** | ผู้ดูแลระบบ | ตั้งค่าระบบทั้งหมด, จัดการสิทธิ์, ตั้งค่า Cut-off Time |

---

## 4. Approval Workflow

### 4.1 ฝั่ง Office (2 Steps)
```
หัวหน้าแผนก (สร้างใบลา/OT)
   ↓
ผู้จัดการแผนก (Approve)
   ↓
Completed ✅  (CC: HR Admin)
```

### 4.2 ฝั่ง Production / ผลิต (3 Steps)
```
หัวหน้างาน (สร้างใบลา/OT)
   ↓
ผู้จัดการแผนก (Approve)
   ↓
ผู้จัดการโรงงาน (Approve - Final)
   ↓
Completed ✅  (CC: HR Admin)
```

> **ทุกสเตปแจ้งเตือนทางอีเมล** และ CC ไปยัง HR Admin

---

## 5. Module 1: Leave Management (ระบบลา)

### 5.1 Features

| # | Feature | รายละเอียด |
|---|---------|-----------|
| L1 | สร้างใบลาแทนพนักงาน | หัวหน้าเป็นผู้สร้างใบลาให้ลูกน้อง (proxy) — ไม่ใช่ลูกน้องสร้างเอง |
| L2 | แยก Workflow Office/ผลิต | ตามหัวข้อ 4.1, 4.2 |
| L3 | Email Notification | แจ้งทุกขั้นตอน: สร้าง, รออนุมัติ, อนุมัติ, ปฏิเสธ |
| L4 | Master ประเภทการลา | ลาป่วย, ลากิจ, ลาพักร้อน, ลาคลอด, ลาบวช ฯลฯ (Configurable) |
| L5 | Pro-Rate ตามอายุงาน | จำนวนวันลาเพิ่มตามอายุงาน คำนวณแบบ Pro-Rate |
| L6 | Carry Over | วันลาคงเหลือปีนี้ → โอนไปปีหน้า (กำหนดเพดานได้) |
| L7 | Export Excel รายเดือน | ดาวน์โหลดสรุปข้อมูลการลาแต่ละเดือน |
| L8 | Import พนักงาน | HR Admin Import ข้อมูลพนักงาน 460 คนผ่านไฟล์ Excel |
| L9 | Cut-off Time 11:00 | หัวหน้าต้องสร้างใบลาภายใน 11:00 น. |
| L10 | Cut-off Time 13:00 | ผู้จัดการแผนกต้อง Approve ภายใน 13:00 น. |
| L11 | ลาย้อนหลัง | สามารถสร้างใบลาย้อนหลังได้ (ระบุวันที่ในอดีต) |
| L12 | เอกสารแนบ | ใส่หมายเหตุว่ามีเอกสารแนบการลา (เช่น ใบรับรองแพทย์) — Note field |

### 5.2 Pro-Rate Rule (ตัวอย่าง — ปรับได้ใน Master)
- อายุงาน < 1 ปี: ลาพักร้อนแบบ Pro-Rate ตามเดือนที่เริ่มงาน
- อายุงาน 1–3 ปี: 6 วัน/ปี
- อายุงาน 3–5 ปี: 8 วัน/ปี
- อายุงาน 5+ ปี: 10 วัน/ปี
- *(ค่าจริงจะกำหนดผ่าน Master Setting — ปรับได้ทาง UI)*

### 5.3 Carry Over Rule
- ปลายปี (31 ธ.ค.) ระบบคำนวณวันลาคงเหลือ
- โอนไปปีถัดไป (ตั้งเพดานสูงสุดได้ เช่น ไม่เกิน 5 วัน)
- มี job อัตโนมัติทุกวันที่ 1 ม.ค.

### 5.4 Leave Status
`DRAFT` → `PENDING_DEPT_MGR` → `PENDING_FACTORY_MGR` (เฉพาะผลิต) → `APPROVED` / `REJECTED` / `CANCELLED`

---

## 6. Module 2: OT Management (ระบบ OT)

### 6.1 Features

| # | Feature | รายละเอียด |
|---|---------|-----------|
| O1 | สร้าง OT | หัวหน้าเป็นผู้สร้างรายการ OT |
| O2 | กรอกช่วงเวลา + รายละเอียด | วันที่, เวลาเริ่ม-จบ, ลักษณะงาน |
| O3 | เลือกพนักงาน | Multi-select พนักงานที่จะทำ OT ครั้งนี้ |
| O4 | เลือกสายรถ | Dropdown สายรถ (ต้องมี Master สายรถ) |
| O5 | Workflow Approval | เหมือน Leave: Office 2 step / ผลิต 3 step |
| O6 | Email + CC HR Admin | แจ้งเตือนทุกสเตป และ CC HR Admin ทุกครั้ง |
| O7 | Dashboard | สรุปข้อมูล OT รายวัน + Filter ตามแผนก/ฝั่ง/วันที่/พนักงาน |
| O8 | แก้ไข / ยกเลิก | หัวหน้าสามารถสร้าง / แก้ไข / ยกเลิกรายการ OT ของตัวเองได้ (ก่อน Approve) |
| O9 | กรณีไม่มาทำ OT | หัวหน้าต้องแจ้ง HR Admin (เป็นลายลักษณ์อักษรในระบบ — Memo Form) เพื่อให้ HR Admin แก้ไข |
| O10 | ขอยกเลิก OT พนักงาน | มีหน้าจอแยก: หัวหน้ายื่นเรื่องยกเลิก OT ของพนักงานคนหนึ่งในกะหนึ่ง ส่งไปที่ HR Admin |
| O11 | Cut-off 11:00 | หัวหน้าสร้าง OT เสร็จก่อน 11:00 |
| O12 | Cut-off 13:00 | ผู้จัดการแผนก Approve ก่อน 13:00 |
| O13 | Setting หน้าจอ | System Admin ปรับเวลา Cut-off ได้ |
| O14 | HR Admin View All | HR เห็นรายการตั้งแต่ขั้นขออนุมัติ + ดูรายละเอียดได้ทั้งหมด |
| O15 | Report เปรียบเทียบ | Export Report เพื่อตรวจสอบเทียบกับการทำ OT จริง |

### 6.2 OT Hour Rules

| ประเภทวัน | ชั่วโมง OT มาตรฐาน |
|----------|---------------------|
| วันธรรมดา (จันทร์-ศุกร์) | **2.5 ชั่วโมง** |
| วันหยุด (เสาร์ / อาทิตย์ / นักขัตฤกษ์) | **8 ชั่วโมง + 3 ชั่วโมง = 11 ชั่วโมง** |

> ระบบต้องมี Master วันหยุด (Public Holiday Calendar) เพื่อใช้คำนวณอัตโนมัติ

### 6.3 OT Status
`DRAFT` → `PENDING_DEPT_MGR` → `PENDING_FACTORY_MGR` (เฉพาะผลิต) → `APPROVED` → `COMPLETED` / `CANCELLED` / `MODIFIED_BY_HR`

### 6.4 Cancel OT Request (พิเศษ)
- หน้าจอแยก เรียก `OT Cancellation Request`
- หัวหน้าเลือก พนักงาน + กะ/วันที่ → ส่ง HR Admin
- HR Admin Approve → ระบบ Update OT record

---

## 7. Master Data (จัดการโดย HR Admin / System Admin)

| Master | Fields |
|--------|--------|
| **Employee** | EmployeeCode, ชื่อ, แผนก, ตำแหน่ง, ฝั่ง (Office/Production), หัวหน้า, วันเริ่มงาน, Email |
| **Department** | Code, ชื่อแผนก, ฝั่ง, ผู้จัดการแผนก |
| **Leave Type** | Code, ชื่อ, จำนวนวันต่อปี, มี Pro-Rate ไหม, Carry Over ได้ไหม |
| **Bus Route (สายรถ)** | Code, ชื่อสายรถ, เส้นทาง, หมายเหตุ |
| **Public Holiday** | วันที่, ชื่อวันหยุด |
| **System Setting** | Cut-off Leave Create, Cut-off Leave Approve, Cut-off OT Create, Cut-off OT Approve, Carry Over Max Days |

---

## 8. ข้อมูลพนักงาน (Import)

- HR Admin Import ผ่านไฟล์ Excel (Template ระบบเตรียมให้)
- จำนวนพนักงานเริ่มต้น: **460 คน**
- รองรับ Update ทับ (ใช้ EmployeeCode เป็น Key)
- Validate Email + แผนก + หัวหน้า ก่อน Insert

---

## 9. Cut-off Time Logic

| เวลา | เหตุการณ์ | ผลกระทบ |
|------|-----------|---------|
| 11:00 | หัวหน้าต้องสร้าง Leave/OT ครบ | หลังเวลานี้ปุ่มสร้างถูก Disable (ปรับเปิด/ปิดได้ใน Setting) |
| 13:00 | ผู้จัดการแผนก Approve ครบ | หลังเวลานี้ปุ่ม Approve อาจถูก Disable / แจ้งเตือน |

- หน้าจอ Setting (System Admin) → ปรับเวลาได้
- มี Toggle เปิด/ปิด การบังคับ Cut-off

---

## 10. Notifications (Email)

| Event | ผู้รับ | CC |
|-------|--------|-----|
| สร้างใบลา/OT | ผู้จัดการแผนก | HR Admin |
| Approve ขั้น 1 | ผู้จัดการโรงงาน (ผลิต) หรือผู้สร้าง (Office) | HR Admin |
| Approve ขั้น 2 (ผลิต) | หัวหน้า + พนักงาน | HR Admin |
| Reject | หัวหน้า | HR Admin |
| ขอยกเลิก OT | HR Admin | - |
| ใกล้ Cut-off Time | หัวหน้า / ผู้จัดการ | - |

---

## 11. Dashboard & Reports

### 11.1 OT Dashboard
- สรุปจำนวนชั่วโมง OT รายวัน / สัปดาห์ / เดือน
- Group by แผนก / ฝั่ง (Office / ผลิต) / พนักงาน
- Filter: ช่วงวันที่, แผนก, สถานะ, สายรถ
- Chart: Bar / Line

### 11.2 Leave Report
- รายการลาทั้งหมดในเดือน → Export Excel
- สรุปวันลาคงเหลือต่อพนักงาน
- สรุปการลาตามประเภท

### 11.3 OT Compare Report
- รายการที่ขอ OT vs. รายการที่ทำจริง (หลัง HR Adjust)
- Export Excel

---

## 12. โครงสร้างหน้าจอ (Pages)

```
/login
/dashboard                      ← หน้าหลัก (Dashboard OT + สรุปการลาเดือนนี้)

/leave
  /leave/create                 ← หัวหน้าสร้างใบลาให้ลูกน้อง
  /leave/list                   ← รายการใบลา (Filter ตาม Role)
  /leave/approval               ← รายการรออนุมัติ
  /leave/[id]                   ← รายละเอียด

/ot
  /ot/create                    ← สร้าง OT
  /ot/list                      ← รายการ OT
  /ot/approval                  ← รออนุมัติ
  /ot/[id]                      ← รายละเอียด
  /ot/cancel-request            ← ขอยกเลิก OT (ส่ง HR Admin)
  /ot/memo                      ← แจ้ง HR Admin กรณีพนักงานไม่มาทำ OT

/master
  /master/employees             ← จัดการพนักงาน + Import
  /master/departments
  /master/leave-types
  /master/bus-routes
  /master/holidays

/reports
  /reports/leave-monthly        ← Export Excel
  /reports/ot-compare
  /reports/ot-summary

/settings
  /settings/cut-off-time
  /settings/carry-over
  /settings/users-roles
```

---

## 13. Database Schema (สรุปตารางหลัก — SQL Server)

| Table | คำอธิบาย |
|-------|---------|
| `Users` | ผู้ใช้ระบบ (Auth) — link กับ Employees |
| `Employees` | พนักงานทั้งหมด 460 คน |
| `Departments` | แผนก |
| `LeaveTypes` | ประเภทการลา (Master) |
| `LeaveBalances` | ยอดวันลาคงเหลือต่อปี ต่อพนักงาน ต่อประเภท |
| `LeaveRequests` | ใบลา |
| `LeaveApprovals` | ประวัติการอนุมัติแต่ละขั้น |
| `OTRequests` | คำขอ OT (Header) |
| `OTRequestEmployees` | พนักงานที่ทำ OT ในรายการนั้น (Detail) |
| `OTApprovals` | ประวัติการอนุมัติ OT |
| `OTCancellations` | คำขอยกเลิก OT |
| `OTMemos` | บันทึกแจ้ง HR กรณีพนักงานไม่มาทำ OT |
| `BusRoutes` | Master สายรถ |
| `Holidays` | วันหยุดราชการ |
| `SystemSettings` | Cut-off time, ค่า config ทั่วไป |
| `EmailLogs` | Log การส่ง Email |
| `AuditLogs` | Log การ create/edit/cancel |

---

## 14. Security & Permissions

- Role-Based Access Control (RBAC)
- Session-based auth (NextAuth.js)
- ทุก action สำคัญต้อง log ลง `AuditLogs`
- ป้องกัน SQL Injection (ใช้ ORM)
- Password ต้อง hash (bcrypt / argon2)

---

## 15. Non-Functional Requirements

| ด้าน | ข้อกำหนด |
|-----|----------|
| Performance | รองรับ 460 user, concurrent ~50 |
| Availability | 99% (เวลาทำการ) |
| Browser | Chrome, Edge (เวอร์ชันใหม่) |
| Responsive | รองรับ Desktop + Tablet (Mobile read-only) |
| Language | ไทย (UI) |
| Backup | Daily backup SQL Server |

---

## 16. Out of Scope (เฟสนี้)

- ระบบลงเวลาเข้า-ออก (Time Clock) — เป็นอีกระบบ
- Payroll Integration
- Mobile App (Native)
- การลาที่พนักงานยื่นเอง (ใช้วิธีหัวหน้าลาให้แทน)

---

## 17. Phase / Milestone (แนะนำ)

| Phase | Scope | ระยะเวลา (ประมาณ) |
|-------|-------|------------------|
| 1 | Setup + Auth + Master Data + Import Employee | 2 สัปดาห์ |
| 2 | Module Leave (Create + Approval + Email) | 3 สัปดาห์ |
| 3 | Module OT (Create + Approval + Cancel + Memo) | 3 สัปดาห์ |
| 4 | Dashboard + Report + Export Excel | 2 สัปดาห์ |
| 5 | Cut-off Logic + Settings + Carry Over Scheduler | 1 สัปดาห์ |
| 6 | UAT + Bug Fix | 2 สัปดาห์ |
| **รวม** | | **~13 สัปดาห์** |

---

## 18. Open Questions (ต้องการคำตอบจาก Stakeholder)

1. **Authentication**: ใช้ Active Directory (SSO) หรือ Username/Password ของระบบเอง?
2. **Pro-Rate Formula**: ต้องการสูตรคำนวณแบบไหนแน่ชัด? (รายเดือน / รายวัน)
3. **Carry Over**: เพดานสูงสุดกี่วัน? และ Expire ภายในเมื่อไหร่?
4. **Email Server**: ใช้ SMTP ภายในองค์กรหรือบริการนอก (เช่น Office 365)?
5. **OT Rate**: ต้องคำนวณค่าตอบแทน OT ในระบบนี้ด้วยไหม หรือแค่บันทึกชั่วโมง?
6. **เอกสารแนบใบลา**: ต้องการ Upload ไฟล์จริง หรือแค่หมายเหตุข้อความ?
7. **OT วันหยุด 8+3**: 8 ชั่วโมง = เวลางานปกติ, 3 ชั่วโมง = OT เพิ่มเติม ใช่หรือไม่?
8. **Mobile**: ต้องการให้หัวหน้าสร้าง Leave/OT ผ่านมือถือได้ไหม?

---

## 19. Verification / Acceptance Criteria

- [ ] Import พนักงาน 460 คนได้สำเร็จจากไฟล์ Excel
- [ ] หัวหน้า (Office) สร้างใบลาให้ลูกน้อง → ผู้จัดการแผนก Approve → จบ Workflow + ส่ง Email
- [ ] หัวหน้า (ผลิต) สร้างใบลา → Approve 2 ขั้น → จบ Workflow + Email ทุกขั้น CC HR
- [ ] หลัง 11:00 ปุ่มสร้างใบลา/OT ถูก Disable (ถ้า Setting เปิดอยู่)
- [ ] หลัง 13:00 ปุ่ม Approve ถูก Disable
- [ ] วันที่ 1 ม.ค. ระบบ Carry Over วันลาอัตโนมัติ
- [ ] Pro-Rate คำนวณวันลาตามอายุงานถูกต้อง
- [ ] Export Excel รายการลารายเดือนได้
- [ ] OT Dashboard แสดงผลและ Filter ได้
- [ ] หัวหน้ายื่นยกเลิก OT → HR Admin เห็นและจัดการได้
- [ ] HR Admin แก้ไข OT ตาม Memo จากหัวหน้าได้
- [ ] OT วันธรรมดาคำนวณเป็น 2.5 ชม., วันหยุดคำนวณ 8+3 ชม. อัตโนมัติ
- [ ] System Admin ปรับ Cut-off time ได้ผ่าน UI
- [ ] Report เปรียบเทียบ OT (ขอ vs. จริง) Export ได้

---

## 20. ไฟล์ที่จะต้องสร้างตอน Implement (Reference)

```
/src/app/(auth)/login/page.tsx
/src/app/(dashboard)/dashboard/page.tsx
/src/app/(modules)/leave/...
/src/app/(modules)/ot/...
/src/app/(master)/master/...
/src/app/(reports)/reports/...
/src/app/(settings)/settings/...
/src/app/api/...
/src/lib/db.ts                 ← Prisma client (SQL Server)
/src/lib/email.ts              ← Nodemailer
/src/lib/excel.ts              ← ExcelJS
/src/lib/auth.ts               ← NextAuth config
/src/lib/cut-off.ts            ← Cut-off time guard
/src/lib/pro-rate.ts           ← คำนวณวันลา Pro-Rate
/src/lib/carry-over.ts         ← Cron job carry over
/prisma/schema.prisma          ← Schema สำหรับ SQL Server
```

---

**สรุป:** PRD ฉบับนี้ครอบคลุม Requirement ทุกข้อที่คุณระบุมา ทั้ง Leave Module 15 ข้อ และ OT Module 19 ข้อ พร้อมส่วนเพิ่มเติมที่จำเป็น เช่น Schema, Workflow Diagram, Dashboard, Master Data และคำถามที่ควรเคลียร์กับ Stakeholder ก่อนเริ่มเขียน Code
