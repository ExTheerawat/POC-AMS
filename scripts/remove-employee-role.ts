/**
 * One-shot migration: remove all User accounts with role = "EMPLOYEE".
 *
 * Why: System redesigned so that ordinary employees DO NOT log in.
 *      Supervisors create leave/OT on their behalf.
 *
 * Behaviour:
 *  - Find every User with role = "EMPLOYEE"
 *  - For each, decouple its Employee link (set employee.userId = null)
 *  - Then delete the User row
 *  - Employee data itself is preserved — only the User account is removed
 *
 * Idempotent: รันซ้ำได้ — ถ้าไม่มี EMPLOYEE user เหลือก็จะรายงานว่า 0 ลบไป
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Finding User accounts with role = EMPLOYEE...\n");

  const empUsers = await prisma.user.findMany({
    where: { role: "EMPLOYEE" },
    include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } },
  });

  if (empUsers.length === 0) {
    console.log("✅ No EMPLOYEE users found — nothing to do.");
    return;
  }

  console.log(`Found ${empUsers.length} EMPLOYEE user(s):`);
  for (const u of empUsers) {
    const emp = u.employee;
    console.log(`  · ${u.username}${emp ? ` → ${emp.employeeCode} ${emp.firstName} ${emp.lastName}` : " (no linked employee)"}`);
  }
  console.log("");

  // Unlink + delete in one transaction per user (Employee.userId is the FK side)
  for (const u of empUsers) {
    if (u.employee) {
      await prisma.employee.update({
        where: { id: u.employee.id },
        data: { userId: null },
      });
    }
    await prisma.user.delete({ where: { id: u.id } });
    console.log(`✓ Removed user "${u.username}"`);
  }

  console.log(`\n✅ Done. Removed ${empUsers.length} EMPLOYEE user(s). Employee records were preserved.`);
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
