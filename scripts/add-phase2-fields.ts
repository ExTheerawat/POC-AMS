/**
 * Phase 2 schema additions (all in one script, idempotent — run multiple times safely):
 *
 *   1. LeaveRequest.halfDayType         — "MORNING" | "AFTERNOON" | null
 *   2. LeaveRejectReason                — new master table
 *   3. LeaveApproval.rejectReasonId     — FK → LeaveRejectReason
 *   4. Employee.defaultBusRouteId       — FK → BusRoute (pre-fill OT)
 *   5. OTRequest.shift                  — "DAY" | "NIGHT" (default DAY)
 *   6. OTRequestEmployee.workDescription — per-employee override
 *
 * Each ALTER/CREATE is wrapped in a try/catch that swallows the
 * "already exists" error so the script is safe to re-run.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function exec(sql: string, label: string) {
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log(`✓ ${label}`);
  } catch (e: any) {
    if (/already exists|There is already an object|Column names in each table must be unique|name already used/i.test(e.message ?? "")) {
      console.log(`⊙ ${label} (already exists, skipped)`);
    } else {
      throw e;
    }
  }
}

async function main() {
  console.log("Phase 2 migrations starting...\n");

  // 1. LeaveRequest.halfDayType
  await exec(
    `ALTER TABLE [LeaveRequest] ADD [halfDayType] NVARCHAR(50);`,
    "Add LeaveRequest.halfDayType",
  );

  // 2. LeaveRejectReason table
  await exec(
    `CREATE TABLE [LeaveRejectReason] (
      [id]        NVARCHAR(1000) NOT NULL,
      [code]      NVARCHAR(1000) NOT NULL,
      [label]     NVARCHAR(1000) NOT NULL,
      [isActive]  BIT NOT NULL CONSTRAINT [LeaveRejectReason_isActive_df] DEFAULT 1,
      [sortOrder] INT NOT NULL CONSTRAINT [LeaveRejectReason_sortOrder_df] DEFAULT 0,
      [createdAt] DATETIME2 NOT NULL CONSTRAINT [LeaveRejectReason_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
      [updatedAt] DATETIME2 NOT NULL,
      CONSTRAINT [LeaveRejectReason_pkey] PRIMARY KEY CLUSTERED ([id])
    );`,
    "Create LeaveRejectReason table",
  );
  await exec(
    `CREATE UNIQUE INDEX [LeaveRejectReason_code_key] ON [LeaveRejectReason]([code]);`,
    "Create unique index on LeaveRejectReason.code",
  );

  // 3. LeaveApproval.rejectReasonId (+ FK)
  await exec(
    `ALTER TABLE [LeaveApproval] ADD [rejectReasonId] NVARCHAR(1000);`,
    "Add LeaveApproval.rejectReasonId",
  );
  await exec(
    `ALTER TABLE [LeaveApproval] ADD CONSTRAINT [LeaveApproval_rejectReasonId_fkey]
       FOREIGN KEY ([rejectReasonId]) REFERENCES [LeaveRejectReason]([id])
       ON DELETE NO ACTION ON UPDATE NO ACTION;`,
    "Add FK LeaveApproval.rejectReasonId → LeaveRejectReason.id",
  );

  // 4. Employee.defaultBusRouteId (+ FK)
  await exec(
    `ALTER TABLE [Employee] ADD [defaultBusRouteId] NVARCHAR(1000);`,
    "Add Employee.defaultBusRouteId",
  );
  await exec(
    `ALTER TABLE [Employee] ADD CONSTRAINT [Employee_defaultBusRouteId_fkey]
       FOREIGN KEY ([defaultBusRouteId]) REFERENCES [BusRoute]([id])
       ON DELETE NO ACTION ON UPDATE NO ACTION;`,
    "Add FK Employee.defaultBusRouteId → BusRoute.id",
  );

  // 5. OTRequest.shift
  // Use a non-null default so existing rows pick it up; SQL Server requires a default for NOT NULL adds.
  await exec(
    `ALTER TABLE [OTRequest] ADD [shift] NVARCHAR(50) NOT NULL CONSTRAINT [OTRequest_shift_df] DEFAULT 'DAY';`,
    "Add OTRequest.shift",
  );

  // 6. OTRequestEmployee.workDescription
  await exec(
    `ALTER TABLE [OTRequestEmployee] ADD [workDescription] NVARCHAR(MAX);`,
    "Add OTRequestEmployee.workDescription",
  );

  console.log("\n✅ Done. Now run: npx prisma generate");
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
