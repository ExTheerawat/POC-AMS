/**
 * Quick Reset — ลบข้อมูลการลา + OT ทั้งหมด เพื่อทดสอบใหม่
 * Master data (Employee/User/Department/LeaveType/VacationTier/BusRoute/Holiday) ยังอยู่
 *
 * วิธีใช้:  npx tsx scripts/reset-transactions.ts
 *
 * ⚠️ DEV/UAT เท่านั้น — อย่ารันบน production
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function counts(label: string) {
  const [lv, lva, ot, ote, ota, otc, otm, em, al, lb] = await Promise.all([
    prisma.leaveRequest.count(),
    prisma.leaveApproval.count(),
    prisma.oTRequest.count(),
    prisma.oTRequestEmployee.count(),
    prisma.oTApproval.count(),
    prisma.oTCancellation.count(),
    prisma.oTMemo.count(),
    prisma.emailLog.count(),
    prisma.auditLog.count(),
    prisma.leaveBalance.count(),
  ]);
  console.log(`\n--- ${label} ---`);
  console.log(`  LeaveRequest        ${lv}`);
  console.log(`  LeaveApproval       ${lva}`);
  console.log(`  OTRequest           ${ot}`);
  console.log(`  OTRequestEmployee   ${ote}`);
  console.log(`  OTApproval          ${ota}`);
  console.log(`  OTCancellation      ${otc}`);
  console.log(`  OTMemo              ${otm}`);
  console.log(`  EmailLog            ${em}`);
  console.log(`  AuditLog            ${al}`);
  console.log(`  LeaveBalance        ${lb}  (preserved — usedDays reset)`);
}

async function main() {
  await counts("BEFORE");

  // เรียงลำดับการลบ: children → parent (FK)
  console.log("\n→ Deleting...");

  // Leave
  await prisma.leaveApproval.deleteMany({});
  console.log("  ✓ LeaveApproval cleared");
  await prisma.leaveRequest.deleteMany({});
  console.log("  ✓ LeaveRequest cleared");
  await prisma.leaveBalance.updateMany({
    data: { usedDays: 0 },
  });
  // remainingDays = totalDays + carriedOver (raw because Prisma can't reference other columns in update)
  await prisma.$executeRawUnsafe(
    `UPDATE LeaveBalance SET remainingDays = totalDays + carriedOver`,
  );
  console.log("  ✓ LeaveBalance reset (usedDays = 0)");

  // OT
  await prisma.oTMemo.deleteMany({});
  await prisma.oTCancellation.deleteMany({});
  await prisma.oTApproval.deleteMany({});
  await prisma.oTRequestEmployee.deleteMany({});
  await prisma.oTRequest.deleteMany({});
  console.log("  ✓ OT data cleared");

  // Logs
  await prisma.emailLog.deleteMany({});
  await prisma.auditLog.deleteMany({
    where: {
      action: {
        in: [
          "CREATE_LEAVE", "APPROVE_LEAVE", "REJECT_LEAVE", "UPDATE_LEAVE", "CANCEL_LEAVE",
          "CREATE_OT", "APPROVE_OT", "REJECT_OT", "UPDATE_OT", "CANCEL_OT",
          "APPROVE_OT_CANCEL", "REJECT_OT_CANCEL", "ACK_OT_MEMO", "REJECT_OT_MEMO",
        ],
      },
    },
  });
  console.log("  ✓ EmailLog + AuditLog (Leave/OT) cleared");

  await counts("AFTER");

  // Verify master data intact
  const [emp, dept, lt, vt, br, hol] = await Promise.all([
    prisma.employee.count({ where: { isActive: true } }),
    prisma.department.count(),
    prisma.leaveType.count({ where: { isActive: true } }),
    prisma.vacationTier.count(),
    prisma.busRoute.count({ where: { isActive: true } }),
    prisma.holiday.count(),
  ]);
  console.log("\n--- Master data (untouched) ---");
  console.log(`  Employee (active)    ${emp}`);
  console.log(`  Department           ${dept}`);
  console.log(`  LeaveType (active)   ${lt}`);
  console.log(`  VacationTier         ${vt}`);
  console.log(`  BusRoute (active)    ${br}`);
  console.log(`  Holiday              ${hol}`);

  console.log("\n✅ Reset เสร็จเรียบร้อย — สามารถ login ทดสอบสร้างใบลา/OT ใหม่ได้เลย");
}

main()
  .catch((e) => { console.error("❌", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
