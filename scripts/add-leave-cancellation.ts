/**
 * Create LeaveCancellation table — สำหรับ flow "ขอยกเลิกใบลา"
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
  console.log("Creating LeaveCancellation table...\n");

  await exec(
    `CREATE TABLE [LeaveCancellation] (
      [id] NVARCHAR(1000) NOT NULL PRIMARY KEY,
      [leaveRequestId] NVARCHAR(1000) NOT NULL,
      [requestedById] NVARCHAR(1000) NOT NULL,
      [reason] NVARCHAR(MAX) NOT NULL,
      [status] NVARCHAR(1000) NOT NULL CONSTRAINT [LeaveCancellation_status_df] DEFAULT 'PENDING',
      [hrComment] NVARCHAR(MAX),
      [createdAt] DATETIME2 NOT NULL CONSTRAINT [LeaveCancellation_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
      [updatedAt] DATETIME2 NOT NULL
    );`,
    "Create LeaveCancellation table",
  );

  await exec(
    `CREATE INDEX [LeaveCancellation_leaveRequestId_idx] ON [LeaveCancellation]([leaveRequestId]);`,
    "Create index on leaveRequestId",
  );

  await exec(
    `CREATE INDEX [LeaveCancellation_status_idx] ON [LeaveCancellation]([status]);`,
    "Create index on status",
  );

  await exec(
    `ALTER TABLE [LeaveCancellation] ADD CONSTRAINT [LeaveCancellation_leaveRequestId_fkey]
      FOREIGN KEY ([leaveRequestId]) REFERENCES [LeaveRequest]([id])
      ON DELETE CASCADE ON UPDATE CASCADE;`,
    "Add FK constraint",
  );

  console.log("\n✅ Done. Run: npx prisma generate");
}

main().catch((e) => { console.error("❌", e); process.exit(1); }).finally(() => prisma.$disconnect());
