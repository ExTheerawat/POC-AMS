/**
 * Backfill: ถ้า OT ใดมีพนักงานทั้งหมดถูก mark ว่า attended=false แล้ว
 * → ปรับ OTRequest.status เป็น CANCELLED (เพื่อให้ list แสดงสถานะถูกต้อง)
 *
 * Only affects rows currently in {APPROVED, MODIFIED_BY_HR, COMPLETED}
 * (so we don't touch PENDING/CANCELLED/DRAFT)
 *
 * Run: npx tsx scripts/backfill-ot-cancel-status.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const candidates = await prisma.oTRequest.findMany({
    where: { status: { in: ["APPROVED", "MODIFIED_BY_HR", "COMPLETED"] } },
    include: { employees: { select: { attended: true } } },
  });

  let updated = 0;
  for (const ot of candidates) {
    if (ot.employees.length === 0) continue;
    const allCancelled = ot.employees.every((e) => e.attended === false);
    if (allCancelled) {
      await prisma.oTRequest.update({
        where: { id: ot.id },
        data: { status: "CANCELLED" },
      });
      console.log(`  ✓ ${ot.requestNo}  ${ot.status} → CANCELLED  (employees: ${ot.employees.length})`);
      updated++;
    }
  }

  console.log(`\n✅ Backfill complete — updated ${updated} OT(s)`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
