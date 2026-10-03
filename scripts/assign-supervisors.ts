/**
 * Bulk-assign supervisors to the 100 imported employees.
 *
 * Rules:
 *   - Employees with employeeCode starting with "A-" → supervisor = SO001 (อนันต์ นำทีม)
 *   - Employees with employeeCode starting with "B-" → supervisor = SP001 (บุญมี ผลิตเก่ง)
 *
 * Run with: npx tsx scripts/assign-supervisors.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Look up supervisor IDs by their employeeCode
  const supOffice = await prisma.employee.findUnique({ where: { employeeCode: "SO001" } });
  const supProd = await prisma.employee.findUnique({ where: { employeeCode: "SP001" } });

  if (!supOffice) throw new Error("ไม่พบหัวหน้า Office (SO001 — อนันต์ นำทีม) — รัน prisma/seed.ts ก่อน");
  if (!supProd) throw new Error("ไม่พบหัวหน้า Production (SP001 — บุญมี ผลิตเก่ง) — รัน prisma/seed.ts ก่อน");

  console.log(`Supervisors:`);
  console.log(`  A-* → ${supOffice.firstName} ${supOffice.lastName} (${supOffice.employeeCode})`);
  console.log(`  B-* → ${supProd.firstName} ${supProd.lastName} (${supProd.employeeCode})\n`);

  // Bulk-update A-* employees
  const aUpdate = await prisma.employee.updateMany({
    where: { employeeCode: { startsWith: "A-" } },
    data: { supervisorId: supOffice.id },
  });
  console.log(`✓ Updated ${aUpdate.count} A-* employees → supervisor = ${supOffice.firstName} ${supOffice.lastName}`);

  // Bulk-update B-* employees
  const bUpdate = await prisma.employee.updateMany({
    where: { employeeCode: { startsWith: "B-" } },
    data: { supervisorId: supProd.id },
  });
  console.log(`✓ Updated ${bUpdate.count} B-* employees → supervisor = ${supProd.firstName} ${supProd.lastName}`);

  // Verification
  const aCount = await prisma.employee.count({
    where: { employeeCode: { startsWith: "A-" }, supervisorId: supOffice.id },
  });
  const bCount = await prisma.employee.count({
    where: { employeeCode: { startsWith: "B-" }, supervisorId: supProd.id },
  });
  console.log(`\nVerification:`);
  console.log(`  A-* with supervisor ${supOffice.employeeCode}: ${aCount}`);
  console.log(`  B-* with supervisor ${supProd.employeeCode}: ${bCount}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
