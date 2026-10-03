/**
 * เพิ่ม column `busRouteId` ใน `OTRequestEmployee` (nullable)
 * — สำหรับให้พนักงานแต่ละคนใน OT 1 ใบเลือกสายรถได้ต่างกัน
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
  console.log("Adding busRouteId to OTRequestEmployee...\n");
  await exec(
    `ALTER TABLE [OTRequestEmployee] ADD [busRouteId] NVARCHAR(1000);`,
    "Add OTRequestEmployee.busRouteId column",
  );
  await exec(
    `CREATE INDEX [OTRequestEmployee_busRouteId_idx] ON [OTRequestEmployee]([busRouteId]);`,
    "Create index on busRouteId",
  );
  console.log("\n✅ Done. Don't forget to: npx prisma generate");
}

main().catch((e) => { console.error("❌", e); process.exit(1); }).finally(() => prisma.$disconnect());
