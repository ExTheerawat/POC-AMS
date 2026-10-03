/**
 * One-time script to replace the bus route master data with the new list.
 *
 * - Codes B01..B18 are upserted by `code` (existing rows keep their id so any
 *   OTRequest.busRouteId references stay valid).
 * - Any other existing routes are soft-deactivated (isActive=false) rather than
 *   deleted, to preserve FK references from OTRequest.
 *
 * Run with: npx tsx scripts/update-bus-routes.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROUTES: { code: string; name: string }[] = [
  { code: "B01", name: "ทางด่วนมีนบุรี" },
  { code: "B02", name: "รายทางมีนบุรี" },
  { code: "B03", name: "นำรถมาเอง" },
  { code: "B04", name: "ธ.กรุงเทพ บางนา" },
  { code: "B05", name: "ซอย สันตินคร" },
  { code: "B06", name: "บางโฉลง" },
  { code: "B07", name: "ม.หัวเฉียว" },
  { code: "B08", name: "รพ.บางนา2" },
  { code: "B09", name: "ซอยเอแบค" },
  { code: "B10", name: "บางบ่อ" },
  { code: "B11", name: "วัดบางบ่อ" },
  { code: "B12", name: "เกียรติธานี" },
  { code: "B13", name: "วัดระกาศ" },
  { code: "B14", name: "บางพลีน้อย" },
  { code: "B15", name: "ซอยอนามัย" },
  { code: "B16", name: "หมู่บ้านสิรารมย์" },
  { code: "B17", name: "หมู่บ้านศรีเทพไทย" },
  { code: "B18", name: "หน้าวัดบางวัว" },
];

async function main() {
  console.log("→ Updating bus routes...");

  const keepCodes = ROUTES.map((r) => r.code);

  // Deactivate routes that aren't in the new list (keeps FK refs intact)
  const deactivated = await prisma.busRoute.updateMany({
    where: { code: { notIn: keepCodes } },
    data: { isActive: false },
  });
  console.log(`  Deactivated ${deactivated.count} obsolete route(s)`);

  // Upsert the 18 routes — keep `route` and `note` columns empty/null
  let created = 0, updated = 0;
  for (const r of ROUTES) {
    const existing = await prisma.busRoute.findUnique({ where: { code: r.code } });
    if (existing) {
      await prisma.busRoute.update({
        where: { code: r.code },
        data: { name: r.name, route: null, note: null, isActive: true },
      });
      updated++;
    } else {
      await prisma.busRoute.create({ data: { code: r.code, name: r.name, isActive: true } });
      created++;
    }
  }
  console.log(`  Created ${created}, Updated ${updated}`);

  // Final summary
  const all = await prisma.busRoute.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });
  console.log("\nActive bus routes:");
  for (const r of all) console.log(`  ${r.code}  ${r.name}`);
  console.log(`\nTotal active: ${all.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
