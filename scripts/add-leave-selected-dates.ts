/**
 * เพิ่ม column `selectedDates` ใน `LeaveRequest` (nullable NVARCHAR(MAX))
 * — สำหรับเก็บวันลาแบบไม่ต่อเนื่อง เช่น ลา 1, 4, 7 พ.ค. ในใบเดียวกัน
 * — JSON-stringified array of "YYYY-MM-DD" strings
 * — Null/empty → ใช้ startDate/endDate เป็นช่วงต่อเนื่อง (backward compat)
 *
 * Idempotent: รันซ้ำได้
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function exec(sql: string, label: string) {
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log(`✓ ${label}`);
  } catch (e: any) {
    if (/already exists|There is already an object|Column names in each table must be unique/.test(e.message ?? "")) {
      console.log(`⊙ ${label} (already exists, skipped)`);
    } else {
      throw e;
    }
  }
}

async function main() {
  console.log("Adding selectedDates to LeaveRequest...\n");
  await exec(
    `ALTER TABLE [LeaveRequest] ADD [selectedDates] NVARCHAR(MAX);`,
    "Add LeaveRequest.selectedDates column",
  );
  console.log("\n✅ Done. Now run: npx prisma generate");
}

main().catch((e) => { console.error("❌", e); process.exit(1); }).finally(() => prisma.$disconnect());
