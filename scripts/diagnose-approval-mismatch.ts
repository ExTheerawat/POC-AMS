/**
 * Diagnose why mgr.office sees a leave in /leave/list but not in /leave/approval.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("=== ตรวจสอบสถานการณ์ ===\n");

  const lv = await prisma.leaveRequest.findFirst({
    where: { requestNo: "LV260524-6532" },
    include: { employee: { include: { department: true } }, leaveType: true, creator: true },
  });

  if (!lv) {
    console.log("ไม่พบใบลา LV260524-6532");
    return;
  }

  console.log(`ใบลา: ${lv.requestNo}`);
  console.log(`  พนักงาน: ${lv.employee.firstName} ${lv.employee.lastName} (${lv.employee.employeeCode})`);
  console.log(`  อยู่แผนก: ${lv.employee.department?.name} (${lv.employee.department?.code})`);
  console.log(`  ฝ่าย: ${lv.side}`);
  console.log(`  สถานะ: ${lv.status}`);
  console.log("");

  const empDept = lv.employee.department;
  if (empDept) {
    const mgrOfEmpDept = empDept.managerId
      ? await prisma.employee.findUnique({ where: { id: empDept.managerId } })
      : null;
    console.log(`📌 ผู้จัดการของแผนก "${empDept.name}":`);
    console.log(`   ${mgrOfEmpDept ? `${mgrOfEmpDept.firstName} ${mgrOfEmpDept.lastName} (${mgrOfEmpDept.employeeCode})` : "❌ ไม่มี"}`);
  }
  console.log("");

  const mgrOffice = await prisma.user.findUnique({
    where: { username: "mgr.office" },
    include: { employee: { include: { department: true } } },
  });
  console.log(`📌 วิชัย บริหารดี (mgr.office):`);
  console.log(`   employeeCode: ${mgrOffice?.employee?.employeeCode}`);
  console.log(`   ฝ่ายตัวเอง: ${mgrOffice?.employee?.side}`);
  console.log(`   อยู่ในแผนก: ${mgrOffice?.employee?.department?.name}`);
  if (mgrOffice?.employee) {
    const managed = await prisma.department.findMany({
      where: { managerId: mgrOffice.employee.id },
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    });
    console.log(`   เป็น manager ของ ${managed.length} แผนก:`);
    managed.forEach((d) => console.log(`     - ${d.code}: ${d.name}`));
  }
  console.log("");

  // Check if mgr.office manages the leave employee's dept
  if (empDept && mgrOffice?.employee) {
    const isManager = empDept.managerId === mgrOffice.employee.id;
    console.log(`🔍 วิชัย เป็น manager ของแผนก "${empDept.name}" หรือไม่? → ${isManager ? "✅ ใช่" : "❌ ไม่"}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
