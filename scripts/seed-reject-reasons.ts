import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Auto-generated LRR### codes — order = insertion order
  const labels = [
    "ลาเกินสิทธิ์",
    "งานช่วงนั้นด่วน ขาดคน",
    "ทับซ้อนกับใบลาอื่น",
    "ใบลาเร่งด่วนเกินไป (ไม่แจ้งล่วงหน้า)",
    "ข้อมูลไม่ครบถ้วน",
    "อื่นๆ",
  ];

  // Find max existing LRR number so re-seeding doesn't collide
  const existing = await prisma.leaveRejectReason.findMany({
    where: { code: { startsWith: "LRR" } },
    select: { code: true, label: true },
  });
  const labelToCode = new Map(existing.map((r) => [r.label, r.code] as const));
  let maxNum = 0;
  for (const r of existing) {
    const m = r.code.match(/^LRR(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }

  let created = 0;
  let skipped = 0;
  for (const label of labels) {
    if (labelToCode.has(label)) {
      skipped++;
      continue;
    }
    maxNum++;
    const code = `LRR${String(maxNum).padStart(3, "0")}`;
    await prisma.leaveRejectReason.create({
      data: { code, label, isActive: true },
    });
    console.log(`  + ${code} — ${label}`);
    created++;
  }
  console.log(`\n✓ Seeded ${created} new reject reason${created !== 1 ? "s" : ""} (skipped ${skipped} existing)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
