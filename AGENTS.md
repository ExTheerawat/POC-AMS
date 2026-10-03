# AGENTS.md — AMS (Attendance Management System)

> คู่มือสำหรับ Codex / AI assistant ที่จะ maintain โค้ดต่อจากนี้

## 1. Overview

ระบบบริหารจัดการ **การลา (Leave)** และ **OT** ภายในองค์กร 460 คน
- แยก 2 ฝั่ง: **Office** (Workflow 2 step) และ **Production** (Workflow 3 step)
- หัวหน้าเป็นผู้สร้างใบลา/OT แทนพนักงาน (proxy)
- แจ้งเตือนทุก step ผ่านอีเมล + CC HR Admin
- มี Cut-off Time 11:00 (สร้าง) และ 13:00 (Approve)

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) + React 18 + TypeScript |
| UI | Tailwind CSS + shadcn/ui (manual setup) + Framer Motion |
| Database | **Microsoft SQL Server 2019** |
| ORM | Prisma 5 (provider: sqlserver) |
| Auth | NextAuth.js v5 (Credentials) + bcryptjs |
| Email | Nodemailer (SMTP optional; logs only in dev) |
| Excel | ExcelJS |
| Charts | Recharts |

## 3. Database Connection

อยู่ใน `.env`:

```
DATABASE_URL="sqlserver://CCTH-EX\\SQL2019;database=AttendanceMS;user=sa;password=1@nedevrock;trustServerCertificate=true;encrypt=false"
```

- Server: `CCTH-EX\SQL2019`
- Database: `AttendanceMS`
- User: `sa` / Password อยู่ใน .env (อย่า hardcode)

## 4. Commands ที่ใช้บ่อย

```bash
# Development
npm run dev                    # Start dev server (http://localhost:3001)

# Build / Production
npm run build
npm run start

# Database
npm run db:push                # Push schema → SQL Server (no migration)
npm run db:generate            # Generate Prisma Client
npm run db:seed                # Run prisma/seed.ts (demo accounts + masters)
npm run db:studio              # Open Prisma Studio

# Lint
npm run lint
```

## 5. Folder Structure

```
src/
  app/
    (auth-routes — none, use middleware)
    api/
      auth/[...nextauth]/route.ts    ← NextAuth handlers
      reports/*/route.ts             ← Excel export endpoints
    (app)/                           ← Protected app routes (sidebar + header layout)
      layout.tsx                     ← Auth check + AppShell
      dashboard/                     ← Main dashboard
      leave/                         ← Leave module
      ot/                            ← OT module
      master/                        ← Master data CRUD
      reports/                       ← Excel export pages
      settings/                      ← Cut-off, Carry over
    login/page.tsx                   ← Login + Demo accounts
    layout.tsx                       ← Root (Theme + Toaster)
    page.tsx                         ← Redirect to /dashboard
  auth.ts                            ← NextAuth config
  middleware.ts                      ← Route protection
  components/
    ui/                              ← shadcn-style primitives
    layout/                          ← Sidebar, Header, AppShell
    theme-provider.tsx
  lib/
    db.ts                            ← Prisma singleton
    auth.ts                          ← (reserved)
    cut-off.ts                       ← Cut-off time guard
    email.ts                         ← Nodemailer + email template
    pro-rate.ts                      ← Pro-rate / carry-over calc
    utils.ts                         ← cn, formatDate, generateRequestNo, calcHours
  server/
    actions/
      leave.ts                       ← createLeave, approveLeave, cancelLeave
      ot.ts                          ← createOT, approveOT, requestCancelOT, submitOTMemo
      master.ts                      ← CRUD masters + setSetting
prisma/
  schema.prisma                      ← 16 models
  seed.ts                            ← Demo accounts + master data
```

## 6. Role-Based Access

Source of truth: `src/auth.ts` (session.user.role)
Route protection: `src/middleware.ts` (redirect to /login if no session)
Sidebar filtering: `src/components/layout/sidebar.tsx` (item.roles array)

Roles (พนักงานทั่วไปไม่มี user — หัวหน้าสร้างใบลา/OT แทนให้):
- `SUPERVISOR` — create Leave/OT for subordinates
- `DEPT_MANAGER` — approve step 1
- `FACTORY_MANAGER` — approve step 2 (Production only)
- `HR_ADMIN` — manage masters, see all, export reports
- `SYSTEM_ADMIN` — full access including settings

## 7. Approval Workflow

```
Office (2 step):
  SUPERVISOR creates → status PENDING_DEPT_MGR
  DEPT_MANAGER approves → status APPROVED ✅

Production (3 step):
  SUPERVISOR creates → status PENDING_DEPT_MGR
  DEPT_MANAGER approves → status PENDING_FACTORY_MGR
  FACTORY_MANAGER approves → status APPROVED ✅
```

Logic: `src/server/actions/leave.ts:approveLeave()` and `src/server/actions/ot.ts:approveOT()`

## 8. Cut-off Time Logic

- Source: `SystemSetting` table (keys: `CUTOFF_*`)
- Check: `src/lib/cut-off.ts:isCutOffPassed()`
- Settings UI: `/settings/cut-off-time`
- Toggle (enforce/disable): `CUTOFF_ENFORCED` = "true" | "false"
- Default in seed: `CUTOFF_ENFORCED = "false"` (so demo works any time)

## 9. Email Notifications

- Library: `src/lib/email.ts` (Nodemailer)
- Template: `emailTemplate(title, body)` — branded HTML
- If `SMTP_HOST` is empty (dev), logs to `EmailLog` table with status `SKIPPED_DEV`
- Triggered from server actions: leave/OT create + approve

## 10. Pro-Rate & Carry Over

- Pro-rate calc: `src/lib/pro-rate.ts:calculateProRateLeaveDays(hireDate, year)`
- Carry over: `calculateCarryOver(remaining, max=5)`
- Yearly cron: TODO — run on Jan 1 (use node-cron in `src/server/jobs/`)

## 11. Demo Accounts (from seed)

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | SYSTEM_ADMIN |
| hr | hr123 | HR_ADMIN |
| mgr.office | mgr123 | DEPT_MANAGER (Sales — Office) |
| mgr.prod | mgr123 | DEPT_MANAGER (PROD1 — Production) |
| mgr.factory | mgr123 | FACTORY_MANAGER |
| sup.office | sup123 | SUPERVISOR (Office) |
| sup.prod | sup123 | SUPERVISOR (Production) |

## 12. การเพิ่ม Feature / Page ใหม่

1. ถ้าต้อง read DB → ใช้ Server Component (default) + `prisma` จาก `@/lib/db`
2. ถ้าต้อง mutate → สร้าง Server Action ใน `src/server/actions/`
3. UI → ใช้ components จาก `@/components/ui/*`
4. ถ้าเป็น protected page → วางใน `src/app/(app)/`
5. เพิ่มเมนูใน `src/components/layout/sidebar.tsx` (`NAV` array)

## 13. การเพิ่ม Master ใหม่

1. เพิ่ม model ใน `prisma/schema.prisma`
2. `npm run db:push` + `npm run db:generate`
3. สร้าง server action ใน `src/server/actions/master.ts`
4. สร้าง page ใน `src/app/(app)/master/<name>/page.tsx`

## 14. Coding Convention

- TypeScript strict — no `any` unless absolutely necessary
- Server Actions ต้องมี `"use server"` directive
- Client Components ต้องมี `"use client"` directive
- File naming: kebab-case (`leave-create-form.tsx`)
- Component naming: PascalCase (`LeaveCreateForm`)
- Use Tailwind utility classes; avoid inline styles
- ภาษา UI: ไทย (ผสมอังกฤษบ้างได้สำหรับ technical terms)

## 15. Known TODOs

- [ ] Excel Import พนักงาน (Bulk)
- [ ] Carry-over cron job (node-cron) ที่ทำงานวันที่ 1 ม.ค.
- [ ] HR Admin หน้าจอ approve OT Cancellation/Memo
- [ ] Charts เพิ่ม filter ตาม department
- [ ] Audit log viewer page
- [ ] Real SMTP integration testing

## 16. Quick Start

```bash
# 1. Install
npm install

# 2. Push schema to SQL Server (creates AttendanceMS DB if not exists — or create manually first)
npm run db:push

# 3. Seed demo data
npm run db:seed

# 4. Run
npm run dev
```

เปิด http://localhost:3001 → login ด้วย admin/admin123
