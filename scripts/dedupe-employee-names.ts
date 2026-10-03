/**
 * Rename employees that share the same firstName + lastName so every
 * employee has a unique full name.
 *
 * Strategy:
 *   - For each duplicate group, keep the employee with the smallest
 *     employeeCode (typically the "real" one).
 *   - Rename the others by picking a fresh unused (firstName, lastName)
 *     combination from a large pool.
 *
 * Run with: npx tsx scripts/dedupe-employee-names.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const FIRST_NAMES = [
  "มาลี", "สมหญิง", "สมพร", "วราภรณ์", "ธนากร", "สุรชัย", "อรุณ", "พรพิมล",
  "กิตติ", "อนุชา", "ภัทรา", "สุดา", "วิภา", "ชาญ", "ศุภชัย", "ปริญญา",
  "พิชญา", "ณัฐพล", "จิราภรณ์", "ธวัชชัย", "อาภา", "สมบูรณ์", "ปนัดดา", "นพดล",
  "เกศินี", "มานพ", "อรวรรณ", "วิชัย", "ปวีณา", "ภาคิน", "ธิดา", "สุริยา",
  "นิรมล", "ธีรพล", "อัจฉรา", "ภาณุวัฒน์", "รัตนา", "สมเกียรติ", "เพชรรัตน์", "กมลพร",
];

const LAST_NAMES = [
  "รักงาน", "ขยัน", "ตั้งใจ", "มั่นคง", "ใจกล้า", "พากเพียร", "สู้ชีวิต", "มีน้ำใจ",
  "อดทน", "ทรัพย์มาก", "ดีงาม", "สุขใจ", "มีบุญ", "วงศ์ดี", "ทองดี", "ศรีสุข",
  "แสนดี", "พงษ์ภูมิ", "วิเศษ", "มงคล", "ทรงธรรม", "สมานมิตร", "บุญมา", "พิทักษ์",
  "เจริญสุข", "สมหวัง", "รุ่งเรือง", "ใจดี", "จันทร์เพ็ญ", "ก้าวหน้า",
];

const norm = (e: { firstName: string; lastName: string }) => `${e.firstName.trim()} ${e.lastName.trim()}`;

async function main() {
  const all = await prisma.employee.findMany({
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
  });

  // Build current used-names set
  const usedNames = new Set(all.map(norm));

  // Find duplicate groups
  const groups = new Map<string, typeof all>();
  for (const e of all) {
    const key = norm(e);
    if (!groups.has(key)) groups.set(key, [] as any);
    (groups.get(key) as any[]).push(e);
  }
  const dups = [...groups.entries()].filter(([, list]) => list.length > 1);

  if (dups.length === 0) {
    console.log("✓ No duplicate names found — nothing to do.");
    return;
  }

  console.log(`Found ${dups.length} duplicate name group(s):\n`);

  // Pre-shuffle name combinations for variety (seeded by index)
  function* nameCombinations() {
    for (const fn of FIRST_NAMES) {
      for (const ln of LAST_NAMES) {
        yield { firstName: fn, lastName: ln };
      }
    }
  }
  const iter = nameCombinations();

  const nextUnused = (): { firstName: string; lastName: string } | null => {
    while (true) {
      const next = iter.next();
      if (next.done) return null;
      const key = norm(next.value);
      if (!usedNames.has(key)) return next.value;
    }
  };

  let renamed = 0;
  for (const [name, list] of dups) {
    // Keep the one with the smallest employeeCode (alphabetically); rename the rest
    const sorted = [...list].sort((a, b) => a.employeeCode.localeCompare(b.employeeCode));
    const [keep, ...rename] = sorted;
    console.log(`  "${name}" (${list.length}):`);
    console.log(`    keep    → ${keep.employeeCode}`);
    for (const e of rename) {
      const fresh = nextUnused();
      if (!fresh) {
        console.log(`    ⚠ no more unique combinations available for ${e.employeeCode} — skipped`);
        continue;
      }
      const oldName = `${e.firstName} ${e.lastName}`;
      const newName = `${fresh.firstName} ${fresh.lastName}`;
      await prisma.employee.update({
        where: { id: e.id },
        data: { firstName: fresh.firstName, lastName: fresh.lastName },
      });
      usedNames.delete(norm(e));
      usedNames.add(norm(fresh));
      console.log(`    rename  → ${e.employeeCode}: "${oldName}" → "${newName}"`);
      renamed++;
    }
  }

  console.log(`\n✅ Renamed ${renamed} employee(s).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
