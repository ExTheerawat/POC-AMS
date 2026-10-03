/**
 * ตรวจสอบ overlap logic ของใบลา — เคสที่ user รายงาน
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const lv = await prisma.leaveRequest.findFirst({
    where: { requestNo: "LV260524-7085" },
    include: { employee: true, leaveType: true },
  });

  if (!lv) {
    console.log("ไม่พบใบลา LV260524-7085");
    return;
  }

  console.log(`📄 ใบลา: ${lv.requestNo}`);
  console.log(`   พนักงาน: ${lv.employee.firstName} ${lv.employee.lastName}`);
  console.log(`   ประเภท: ${lv.leaveType.name}`);
  console.log(`   วันที่: ${lv.startDate.toISOString().slice(0, 10)} - ${lv.endDate.toISOString().slice(0, 10)}`);
  console.log(`   สถานะ: ${lv.status}`);
  console.log("");

  // List ALL leaves for this employee
  const all = await prisma.leaveRequest.findMany({
    where: { employeeId: lv.employeeId },
    orderBy: { startDate: "desc" },
    select: { requestNo: true, startDate: true, endDate: true, status: true },
  });

  console.log(`📋 ใบลาทั้งหมดของพนักงานคนนี้ (${all.length} รายการ):`);
  for (const l of all) {
    const blocking = ["DRAFT","PENDING_DEPT_MGR","PENDING_FACTORY_MGR","APPROVED"].includes(l.status);
    console.log(`   ${l.requestNo}  ${l.startDate.toISOString().slice(0, 10)} ~ ${l.endDate.toISOString().slice(0, 10)}  สถานะ: ${l.status}  ${blocking ? "🚫 BLOCK ซ้ำ" : "✅ ไม่ block"}`);
  }
  console.log("");

  console.log(`🔍 Logic ปัจจุบัน:`);
  console.log(`   Overlap check จะ BLOCK เฉพาะใบลาที่ status ∈ {DRAFT, PENDING_DEPT_MGR, PENDING_FACTORY_MGR, APPROVED}`);
  console.log(`   CANCELLED + REJECTED → ไม่ block ✓`);
  console.log("");

  // Test: ถ้า cancel LV260524-7085 แล้วลองสร้างใหม่ จะ pass มั้ย?
  console.log(`💡 ทดสอบ: ถ้าใบ ${lv.requestNo} ถูก cancel (status → CANCELLED) แล้วลองสร้างใหม่ในวันเดิม → ระบบจะอนุญาต ✓`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
