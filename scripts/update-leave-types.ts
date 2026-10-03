/**
 * Update Leave Types + seed Vacation Tiers — runnable standalone (no full seed).
 * Idempotent: uses upsert by unique key.
 *
 * Run with: npx tsx scripts/update-leave-types.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const LEAVE_TYPES = [
  { code: "VACATION",         name: "ลาพักร้อน",                                  daysPerYear: 0,   hasProRate: true,  canCarryOver: true,  isPaid: true,  includesHolidays: false, maxDays: null as number | null, color: "#3b82f6", note: "คำนวณตาม VacationTier — รอบ 1 ธ.ค. ปีก่อน ถึง 30 พ.ย. ปีนี้" },
  { code: "PERSONAL",         name: "ลากิจรายเดือน",                              daysPerYear: 6,   hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: false, maxDays: null, color: "#f59e0b", note: "ได้รับค่าจ้าง" },
  { code: "PERSONAL_UNPAID",  name: "ลากิจรายวัน",                                daysPerYear: 0,   hasProRate: false, canCarryOver: false, isPaid: false, includesHolidays: false, maxDays: null, color: "#fbbf24", note: "ลาได้แต่ไม่ได้รับค่าจ้าง" },
  { code: "SICK",             name: "ลาป่วย",                                     daysPerYear: 30,  hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: false, maxDays: null, color: "#ef4444", note: "ได้รับค่าจ้าง (รวมป่วยอุบัติเหตุในงาน + ป่วยทั่วไป)" },
  { code: "MATERNITY",        name: "ลาเพื่อคลอดบุตร",                            daysPerYear: 60,  hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: true,  maxDays: 120,  color: "#ec4899", note: "ได้รับค่าจ้าง 60 วัน ลาได้สูงสุด 120 วัน นับรวมวันหยุด" },
  { code: "MARRIAGE",         name: "ลาเพื่อการสมรส",                             daysPerYear: 3,   hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: false, maxDays: null, color: "#f472b6", note: "ได้รับค่าจ้าง 3 วันทำงาน" },
  { code: "ORDINATION",       name: "ลาอุปสมบท",                                  daysPerYear: 15,  hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: true,  maxDays: null, color: "#a855f7", note: "ลาได้ 15 วัน นับรวมวันหยุด" },
  { code: "FUNERAL",          name: "ลาบิดา/มารดา/สามี/ภรรยา/บุตร เสียชีวิต",     daysPerYear: 5,   hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: false, maxDays: null, color: "#6b7280", note: "ลาได้ 5 วันทำงาน (รวมบิดามารดาคู่สมรส)" },
  { code: "PATERNITY",        name: "ลาเพื่อดูแลภรรยาคลอดบุตร",                   daysPerYear: 15,  hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: false, maxDays: null, color: "#0ea5e9", note: "ได้รับค่าจ้าง 15 วัน" },
  { code: "MILITARY_SELECT",  name: "ลาเพื่อคัดเลือกทหาร",                        daysPerYear: 1,   hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: false, maxDays: null, color: "#16a34a", note: "ลาได้ 1 วัน" },
  { code: "STERILIZATION",    name: "ลาเพื่อทำหมัน",                              daysPerYear: 0,   hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: false, maxDays: null, color: "#14b8a6", note: "ตามใบรับรองแพทย์" },
  { code: "TRAINING",         name: "ลาเพื่อฝึกอบรมหรือพัฒนาความรู้ความสามารถ",   daysPerYear: 0,   hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: false, maxDays: null, color: "#8b5cf6", note: "ตามที่ได้รับอนุมัติ" },
  { code: "MILITARY_SERVICE", name: "ลารับราชการทหาร",                            daysPerYear: 0,   hasProRate: false, canCarryOver: false, isPaid: false, includesHolidays: false, maxDays: null, color: "#475569", note: "ตามระยะเวลาที่ทางราชการกำหนด" },
];

const VACATION_TIERS = [
  { daysOfServiceFrom: 22,   vacationDays: 0 },
  { daysOfServiceFrom: 23,   vacationDays: 1 },
  { daysOfServiceFrom: 75,   vacationDays: 2 },
  { daysOfServiceFrom: 127,  vacationDays: 3 },
  { daysOfServiceFrom: 178,  vacationDays: 4 },
  { daysOfServiceFrom: 229,  vacationDays: 5 },
  { daysOfServiceFrom: 280,  vacationDays: 6 },
  { daysOfServiceFrom: 331,  vacationDays: 7 },
  { daysOfServiceFrom: 853,  vacationDays: 8 },
  { daysOfServiceFrom: 975,  vacationDays: 9 },
  { daysOfServiceFrom: 1583, vacationDays: 10 },
  { daysOfServiceFrom: 1705, vacationDays: 11 },
  { daysOfServiceFrom: 3408, vacationDays: 12 },
  { daysOfServiceFrom: 3530, vacationDays: 13 },
  { daysOfServiceFrom: 5233, vacationDays: 14 },
  { daysOfServiceFrom: 5355, vacationDays: 15 },
];

async function main() {
  console.log(`→ Upserting ${LEAVE_TYPES.length} leave types...`);
  let lvCreated = 0, lvUpdated = 0;
  for (const t of LEAVE_TYPES) {
    const existing = await prisma.leaveType.findUnique({ where: { code: t.code } });
    await prisma.leaveType.upsert({ where: { code: t.code }, update: t, create: t });
    if (existing) lvUpdated++; else lvCreated++;
  }
  console.log(`  Created ${lvCreated}, Updated ${lvUpdated}\n`);

  console.log(`→ Upserting ${VACATION_TIERS.length} vacation tiers...`);
  let vtCreated = 0, vtUpdated = 0;
  for (const t of VACATION_TIERS) {
    const existing = await prisma.vacationTier.findUnique({ where: { daysOfServiceFrom: t.daysOfServiceFrom } });
    await prisma.vacationTier.upsert({
      where: { daysOfServiceFrom: t.daysOfServiceFrom }, update: t, create: t,
    });
    if (existing) vtUpdated++; else vtCreated++;
  }
  console.log(`  Created ${vtCreated}, Updated ${vtUpdated}\n`);

  // Summary
  const types = await prisma.leaveType.findMany({ orderBy: { code: "asc" } });
  console.log(`✅ Active Leave Types: ${types.filter((t) => t.isActive).length}`);
  for (const t of types) {
    console.log(`  ${t.code.padEnd(20)} ${t.name.padEnd(45)} ${t.daysPerYear} วัน  ${t.isPaid ? "Paid" : "Unpaid"}${t.maxDays ? ` (max ${t.maxDays})` : ""}`);
  }
  const tiers = await prisma.vacationTier.findMany({ orderBy: { daysOfServiceFrom: "asc" } });
  console.log(`\n✅ Vacation Tiers: ${tiers.length}`);
  for (const t of tiers) {
    console.log(`  ≥ ${String(t.daysOfServiceFrom).padStart(4)} วัน → ${t.vacationDays} วันลา`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
