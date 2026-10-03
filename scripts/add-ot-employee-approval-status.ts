/**
 * Add `approvalStatus` column to OTRequestEmployee + backfill existing rows.
 *
 * Backfill logic:
 *   - OT.status = APPROVED                  → approvalStatus = APPROVED
 *   - OT.status = REJECTED / CANCELLED      → approvalStatus = REJECTED
 *   - OT.status = PENDING_DEPT_MGR / etc.   → approvalStatus = PENDING (default)
 *
 * Run:  npx tsx scripts/add-ot-employee-approval-status.ts
 * Idempotent — safe to re-run.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1) Add column if not exists
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE [OTRequestEmployee]
      ADD [approvalStatus] NVARCHAR(50) NOT NULL CONSTRAINT [DF_OTRE_approvalStatus] DEFAULT 'PENDING'
    `);
    console.log("✓ Added column [approvalStatus]");
  } catch (e: any) {
    if (e.message?.includes("Column names in each table must be unique") ||
        e.message?.includes("already exists")) {
      console.log("• Column [approvalStatus] already exists — skip");
    } else {
      throw e;
    }
  }

  // 2) Backfill — APPROVED for finalised approved OTs
  const updatedApproved = await prisma.$executeRawUnsafe(`
    UPDATE ore
    SET [approvalStatus] = 'APPROVED'
    FROM [OTRequestEmployee] ore
    INNER JOIN [OTRequest] o ON ore.[otRequestId] = o.[id]
    WHERE o.[status] = 'APPROVED' AND ore.[approvalStatus] = 'PENDING'
  `);
  console.log(`✓ Backfilled APPROVED — ${updatedApproved} rows`);

  // 3) Backfill — REJECTED for cancelled/rejected OTs
  const updatedRejected = await prisma.$executeRawUnsafe(`
    UPDATE ore
    SET [approvalStatus] = 'REJECTED'
    FROM [OTRequestEmployee] ore
    INNER JOIN [OTRequest] o ON ore.[otRequestId] = o.[id]
    WHERE o.[status] IN ('REJECTED', 'CANCELLED') AND ore.[approvalStatus] = 'PENDING'
  `);
  console.log(`✓ Backfilled REJECTED — ${updatedRejected} rows`);

  console.log("\n✓ Migration complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
