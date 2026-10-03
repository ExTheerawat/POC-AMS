/**
 * Diagnose why DEPT_MANAGER can't approve a leave request.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("=== Department Manager Setup ===\n");

  // Find mgr.prod
  const mgrProd = await prisma.user.findUnique({
    where: { username: "mgr.prod" },
    include: { employee: { include: { department: true } } },
  });
  console.log(`mgr.prod (${mgrProd?.employee?.firstName} ${mgrProd?.employee?.lastName})`);
  console.log(`  Role: ${mgrProd?.role}`);
  console.log(`  Belongs to dept: ${mgrProd?.employee?.department?.code} — ${mgrProd?.employee?.department?.name}\n`);

  // Find sup.prod
  const supProd = await prisma.user.findUnique({
    where: { username: "sup.prod" },
    include: { employee: { include: { department: true } } },
  });
  console.log(`sup.prod (${supProd?.employee?.firstName} ${supProd?.employee?.lastName})`);
  console.log(`  Role: ${supProd?.role}`);
  console.log(`  Belongs to dept: ${supProd?.employee?.department?.code} — ${supProd?.employee?.department?.name}\n`);

  // Find the leave request creator's employee (ชินกร พงษ์เมือง)
  const leaveEmp = await prisma.employee.findFirst({
    where: { firstName: "ชินกร" },
    include: { department: true, supervisor: true },
  });
  console.log(`Employee on leave: ${leaveEmp?.firstName} ${leaveEmp?.lastName} (${leaveEmp?.employeeCode})`);
  console.log(`  Belongs to dept: ${leaveEmp?.department?.code} — ${leaveEmp?.department?.name}`);
  console.log(`  Supervisor: ${leaveEmp?.supervisor?.firstName} ${leaveEmp?.supervisor?.lastName}\n`);

  console.log("=== Production-side Departments — Manager Status ===\n");
  const prodDepts = await prisma.department.findMany({
    where: { side: "PRODUCTION" },
    orderBy: { code: "asc" },
  });
  const empMap = new Map<string, { name: string; code: string }>();
  const managerIds = Array.from(new Set(prodDepts.map((d) => d.managerId).filter(Boolean) as string[]));
  if (managerIds.length > 0) {
    const mgrs = await prisma.employee.findMany({ where: { id: { in: managerIds } } });
    for (const m of mgrs) empMap.set(m.id, { name: `${m.firstName} ${m.lastName}`, code: m.employeeCode });
  }

  let withMgr = 0, withoutMgr = 0;
  for (const d of prodDepts) {
    const mgr = d.managerId ? empMap.get(d.managerId) : null;
    const empCount = await prisma.employee.count({ where: { departmentId: d.id, isActive: true } });
    if (mgr) withMgr++;
    else withoutMgr++;
    console.log(`  ${d.code.padEnd(18)} ${d.name.padEnd(28)} | mgr: ${mgr ? `${mgr.name} (${mgr.code})` : "❌ ไม่มี"} | พนง: ${empCount}`);
  }

  console.log(`\nSummary:`);
  console.log(`  Production depts WITH manager:    ${withMgr}`);
  console.log(`  Production depts WITHOUT manager: ${withoutMgr}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => prisma.$disconnect());
