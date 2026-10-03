/**
 * Manually apply the schema changes for VacationTier + LeaveType extensions
 * via raw SQL — works around Prisma db push complaining about pre-existing
 * Employee_userId_key index.
 *
 * Idempotent: safe to re-run.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function exec(sql: string, label: string) {
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log(`✓ ${label}`);
  } catch (e: any) {
    if (/already exists|There is already an object|Column names in each table must be unique|already has/.test(e.message ?? "")) {
      console.log(`⊙ ${label} (already exists, skipped)`);
    } else {
      throw e;
    }
  }
}

async function main() {
  console.log("Applying schema changes...\n");

  // ── VacationTier table
  await exec(`
    CREATE TABLE [VacationTier] (
      [id] NVARCHAR(1000) NOT NULL PRIMARY KEY,
      [daysOfServiceFrom] INT NOT NULL,
      [vacationDays] INT NOT NULL,
      [note] NVARCHAR(1000),
      [isActive] BIT NOT NULL CONSTRAINT [VacationTier_isActive_df] DEFAULT 1,
      [createdAt] DATETIME2 NOT NULL CONSTRAINT [VacationTier_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
      [updatedAt] DATETIME2 NOT NULL
    );
  `, "Create VacationTier table");

  await exec(`
    CREATE UNIQUE INDEX [VacationTier_daysOfServiceFrom_key] ON [VacationTier]([daysOfServiceFrom]);
  `, "Create unique index on VacationTier.daysOfServiceFrom");

  // ── LeaveType new columns
  await exec(`
    ALTER TABLE [LeaveType] ADD [isPaid] BIT NOT NULL CONSTRAINT [LeaveType_isPaid_df] DEFAULT 1;
  `, "Add LeaveType.isPaid");

  await exec(`
    ALTER TABLE [LeaveType] ADD [includesHolidays] BIT NOT NULL CONSTRAINT [LeaveType_includesHolidays_df] DEFAULT 0;
  `, "Add LeaveType.includesHolidays");

  await exec(`
    ALTER TABLE [LeaveType] ADD [maxDays] FLOAT;
  `, "Add LeaveType.maxDays");

  await exec(`
    ALTER TABLE [LeaveType] ADD [note] NVARCHAR(MAX);
  `, "Add LeaveType.note");

  console.log("\n✅ Schema changes applied successfully.");
}

main().catch((e) => { console.error("❌", e); process.exit(1); }).finally(() => prisma.$disconnect());
