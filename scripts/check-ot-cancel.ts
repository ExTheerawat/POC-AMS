import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const ot = await prisma.oTRequest.findFirst({
    where: { requestNo: "OT260524-6389" },
    include: {
      employees: { include: { employee: true } },
      cancellations: true,
      memos: true,
    },
  });
  if (!ot) { console.log("ไม่พบ OT260524-6389"); return; }

  console.log(`📄 OT: ${ot.requestNo}`);
  console.log(`   วันที่: ${ot.otDate.toISOString().slice(0, 10)} ${ot.startTime}-${ot.endTime}`);
  console.log(`   สถานะ OTRequest: ${ot.status}`);
  console.log("");

  console.log(`👥 พนักงานในใบ (${ot.employees.length} คน):`);
  for (const e of ot.employees) {
    console.log(`   ${e.employee.employeeCode} - ${e.employee.firstName} ${e.employee.lastName}  | attended: ${e.attended ?? "(null)"} | actualHours: ${e.actualHours ?? "(null)"} | note: ${e.note ?? "-"}`);
  }
  console.log("");

  console.log(`📝 Cancellation requests (${ot.cancellations.length}):`);
  for (const c of ot.cancellations) {
    console.log(`   ${c.id.slice(-8)}  empId: ${c.employeeId.slice(-8)}  status: ${c.status}  reason: ${c.reason}`);
  }
  console.log("");

  console.log(`📋 Memos (${ot.memos.length}):`);
  for (const m of ot.memos) {
    console.log(`   ${m.id.slice(-8)}  status: ${m.status}  memo: ${m.memoText.slice(0, 40)}...`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
