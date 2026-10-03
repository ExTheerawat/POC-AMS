import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const all = await prisma.employee.findMany({
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
    orderBy: { firstName: "asc" },
  });

  const map = new Map<string, typeof all>();
  for (const e of all) {
    const key = `${e.firstName} ${e.lastName}`;
    if (!map.has(key)) map.set(key, [] as any);
    (map.get(key) as any[]).push(e);
  }

  const dups = [...map.entries()].filter(([, list]) => list.length > 1);
  console.log(`Total employees: ${all.length}`);
  console.log(`Duplicate name groups: ${dups.length}\n`);
  for (const [name, list] of dups) {
    console.log(`  "${name}" appears ${list.length} times:`);
    for (const e of list) console.log(`    - ${e.employeeCode}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
