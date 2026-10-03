/**
 * Update Department master data with the unique department list provided
 * by the user. Strategy:
 *   - Upsert by `code` (existing codes get name/side updated; new codes are created)
 *   - Existing departments NOT in the new list are left alone (they may be
 *     referenced by Employee.departmentId / OTRequest, etc.)
 *   - "side" is assigned heuristically (OFFICE for admin/support roles,
 *     PRODUCTION for shop-floor / manufacturing). Edit via /master/departments UI
 *     if any are wrong.
 *
 * Run with: npx tsx scripts/update-departments.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Side = "OFFICE" | "PRODUCTION";

const DEPARTMENTS: { code: string; name: string; side: Side }[] = [
  // Office / Admin / Support
  { code: "HR", name: "HR", side: "OFFICE" },
  { code: "ADMIN", name: "Admin.", side: "OFFICE" },
  { code: "ACCOUNTING", name: "ACCOUNTING", side: "OFFICE" },
  { code: "PURCHASING", name: "PURCHASING", side: "OFFICE" },
  { code: "IT", name: "IT", side: "OFFICE" },
  { code: "MK", name: "MK", side: "OFFICE" },
  { code: "APQP", name: "APQP", side: "OFFICE" },
  { code: "PS", name: "PS", side: "OFFICE" },
  { code: "QA", name: "QA", side: "OFFICE" },
  { code: "ISO", name: "ISO", side: "OFFICE" },
  { code: "KAIZEN", name: "Kaizen", side: "OFFICE" },
  { code: "SAFETY_CENTER", name: "Safety Center", side: "OFFICE" },
  { code: "PROCESS_DESIGN", name: "Process Design", side: "OFFICE" },
  { code: "PROD_PLAN", name: "Production Planning", side: "OFFICE" },
  { code: "PROD_COORD", name: "Production Coordinator", side: "OFFICE" },

  // Production / Shop floor
  { code: "PRESS", name: "PRESS", side: "PRODUCTION" },
  { code: "SLITTER", name: "Slitter", side: "PRODUCTION" },
  { code: "PLATING", name: "Plating", side: "PRODUCTION" },
  { code: "PLATING_OL", name: "Plating (Overlay)", side: "PRODUCTION" },
  { code: "PACKING", name: "Packing", side: "PRODUCTION" },
  { code: "INSPECTION", name: "Inspection", side: "PRODUCTION" },
  { code: "INSP_BUSH_ASY", name: "Inspection Bush & Ass'y", side: "PRODUCTION" },
  { code: "INSP_PKG_TURBO", name: "Inspection & Packing (Turbo)", side: "PRODUCTION" },
  { code: "INCOMING_CTRL", name: "Incoming Control", side: "PRODUCTION" },
  { code: "QC", name: "QC", side: "PRODUCTION" },
  { code: "TOOL", name: "TOOL", side: "PRODUCTION" },
  { code: "JIG", name: "Jig", side: "PRODUCTION" },
  { code: "PM", name: "PM", side: "PRODUCTION" },
  { code: "DA", name: "DA", side: "PRODUCTION" },
  { code: "DM", name: "DM", side: "PRODUCTION" },
  { code: "TW", name: "T/W", side: "PRODUCTION" },
  { code: "BUSH", name: "Bush", side: "PRODUCTION" },
  { code: "BYA", name: "Bush & Yoke Assembly", side: "PRODUCTION" },
  { code: "FG_DELIVERY", name: "F/G & Delivery", side: "PRODUCTION" },
  { code: "SUPPLY_WH", name: "Supply W/H", side: "PRODUCTION" },
  { code: "INFRA", name: "Infra.", side: "PRODUCTION" },
  { code: "SEAL_TIP", name: "SEAL TIP", side: "PRODUCTION" },
  { code: "FM_PD3", name: "Floating Metal (PD3)", side: "PRODUCTION" },
  { code: "BT_PD3", name: "Bearing Trust (PD3)", side: "PRODUCTION" },
];

async function main() {
  console.log(`→ Upserting ${DEPARTMENTS.length} departments...`);
  let created = 0, updated = 0;

  for (const d of DEPARTMENTS) {
    const existing = await prisma.department.findUnique({ where: { code: d.code } });
    if (existing) {
      await prisma.department.update({
        where: { code: d.code },
        data: { name: d.name, side: d.side },
      });
      updated++;
    } else {
      await prisma.department.create({ data: d });
      created++;
    }
  }

  console.log(`  Created ${created}, Updated ${updated}`);

  // Summary by side
  const all = await prisma.department.findMany({ orderBy: [{ side: "asc" }, { code: "asc" }] });
  const office = all.filter((d) => d.side === "OFFICE");
  const prod = all.filter((d) => d.side === "PRODUCTION");
  console.log(`\nOFFICE (${office.length}):`);
  for (const d of office) console.log(`  ${d.code.padEnd(20)} ${d.name}`);
  console.log(`\nPRODUCTION (${prod.length}):`);
  for (const d of prod) console.log(`  ${d.code.padEnd(20)} ${d.name}`);
  console.log(`\nTotal departments in DB: ${all.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
