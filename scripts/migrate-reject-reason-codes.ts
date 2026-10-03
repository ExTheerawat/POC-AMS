/**
 * Migrate existing reject reason codes to LRR### format.
 *
 *   OVER_QUOTA          → LRR001
 *   STAFFING            → LRR002
 *   OVERLAP             → LRR003
 *   INSUFFICIENT_NOTICE → LRR004
 *   INCOMPLETE_INFO     → LRR005
 *   OTHER               → LRR006
 *
 * Order: by createdAt asc (first created → LRR001).
 * Skips rows that already match LRR\d+ — idempotent, safe to re-run.
 *
 * Foreign-key safe: LeaveApproval.rejectReasonId references id (cuid),
 * not code, so renaming code does not break referential integrity.
 *
 * Run:  npx tsx scripts/migrate-reject-reason-codes.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const all = await prisma.leaveRejectReason.findMany({
    orderBy: { createdAt: "asc" },
  });

  if (all.length === 0) {
    console.log("No reject reasons found — nothing to migrate.");
    return;
  }

  // First pass — find what's already LRR### and what's not
  const usedNumbers = new Set<number>();
  const toRename: typeof all = [];
  for (const r of all) {
    const m = r.code.match(/^LRR(\d+)$/);
    if (m) {
      usedNumbers.add(parseInt(m[1], 10));
    } else {
      toRename.push(r);
    }
  }

  if (toRename.length === 0) {
    console.log(`✓ All ${all.length} codes already in LRR### format — nothing to do.`);
    return;
  }

  // Assign next available numbers to the ones that need renaming
  let nextNum = 1;
  let renamed = 0;
  for (const r of toRename) {
    while (usedNumbers.has(nextNum)) nextNum++;
    const newCode = `LRR${String(nextNum).padStart(3, "0")}`;
    usedNumbers.add(nextNum);
    nextNum++;

    await prisma.leaveRejectReason.update({
      where: { id: r.id },
      data: { code: newCode },
    });
    console.log(`  ${r.code.padEnd(22)} → ${newCode}  (${r.label})`);
    renamed++;
  }

  console.log(`\n✓ Migrated ${renamed} reject reason code${renamed > 1 ? "s" : ""}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
