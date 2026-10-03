/**
 * Bulk-assign department managers (only for depts that don't have one yet).
 *
 * Rules:
 *   - PRODUCTION depts with no manager  → สมศักดิ์ จัดการผลิต (MP001)
 *   - OFFICE depts with no manager      → วิชัย บริหารดี      (MO001)
 *   - Depts that already have a manager → SKIP (don't overwrite)
 *
 * Run with: npx tsx scripts/assign-dept-managers.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Look up the two managers by employeeCode
  const mgrProd = await prisma.employee.findUnique({ where: { employeeCode: "MP001" } });
  const mgrOffice = await prisma.employee.findUnique({ where: { employeeCode: "MO001" } });

  if (!mgrProd) throw new Error("ไม่พบ MP001 (สมศักดิ์ จัดการผลิต) — รัน prisma/seed.ts ก่อน");
  if (!mgrOffice) throw new Error("ไม่พบ MO001 (วิชัย บริหารดี) — รัน prisma/seed.ts ก่อน");

  console.log(`Managers:`);
  console.log(`  PRODUCTION → ${mgrProd.firstName} ${mgrProd.lastName} (${mgrProd.employeeCode})`);
  console.log(`  OFFICE     → ${mgrOffice.firstName} ${mgrOffice.lastName} (${mgrOffice.employeeCode})\n`);

  // Update only departments WITHOUT a manager
  const prodUpdate = await prisma.department.updateMany({
    where: { side: "PRODUCTION", managerId: null },
    data: { managerId: mgrProd.id },
  });
  console.log(`✓ Production: assigned manager to ${prodUpdate.count} dept(s)`);

  const officeUpdate = await prisma.department.updateMany({
    where: { side: "OFFICE", managerId: null },
    data: { managerId: mgrOffice.id },
  });
  console.log(`✓ Office:     assigned manager to ${officeUpdate.count} dept(s)\n`);

  // Final summary
  const all = await prisma.department.findMany({
    orderBy: [{ side: "asc" }, { code: "asc" }],
  });
  const managerIds = Array.from(new Set(all.map((d) => d.managerId).filter(Boolean) as string[]));
  const mgrs = await prisma.employee.findMany({ where: { id: { in: managerIds } } });
  const mgrMap = new Map(mgrs.map((m) => [m.id, `${m.firstName} ${m.lastName}`]));

  console.log(`=== ผลลัพธ์สุดท้าย ===`);
  console.log(`\nOFFICE:`);
  for (const d of all.filter((x) => x.side === "OFFICE")) {
    console.log(`  ${d.code.padEnd(18)} ${d.name.padEnd(28)} → ${d.managerId ? mgrMap.get(d.managerId) : "❌"}`);
  }
  console.log(`\nPRODUCTION:`);
  for (const d of all.filter((x) => x.side === "PRODUCTION")) {
    console.log(`  ${d.code.padEnd(18)} ${d.name.padEnd(28)} → ${d.managerId ? mgrMap.get(d.managerId) : "❌"}`);
  }

  const noMgr = all.filter((d) => !d.managerId).length;
  console.log(`\nTotal depts without manager: ${noMgr}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => prisma.$disconnect());
