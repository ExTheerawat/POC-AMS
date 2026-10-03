import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

type UserRole = "SUPERVISOR" | "DEPT_MANAGER" | "FACTORY_MANAGER" | "HR_ADMIN" | "SYSTEM_ADMIN";
type Side = "OFFICE" | "PRODUCTION";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ----- System Settings
  const settings = [
    ["CUTOFF_ENFORCED", "false"], // Disabled by default for demo
    ["CUTOFF_LEAVE_CREATE", "11:00"],
    ["CUTOFF_LEAVE_APPROVE", "13:00"],
    ["CUTOFF_OT_CREATE", "11:00"],
    ["CUTOFF_OT_APPROVE", "13:00"],
    ["CARRY_OVER_MAX_DAYS", "5"],
  ];
  for (const [key, value] of settings) {
    await prisma.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  // ----- Leave Types (ตาม doc บริษัท: 13 ประเภท)
  const leaveTypes = [
    { code: "VACATION",         name: "ลาพักร้อน",                                  daysPerYear: 0,   hasProRate: true,  canCarryOver: true,  isPaid: true,  includesHolidays: false, maxDays: null,  color: "#3b82f6", note: "คำนวณตาม VacationTier — รอบ 1 ธ.ค. ปีก่อน ถึง 30 พ.ย. ปีนี้" },
    { code: "PERSONAL",         name: "ลากิจรายเดือน",                              daysPerYear: 6,   hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: false, maxDays: null,  color: "#f59e0b", note: "ได้รับค่าจ้าง" },
    { code: "PERSONAL_UNPAID",  name: "ลากิจรายวัน",                                daysPerYear: 0,   hasProRate: false, canCarryOver: false, isPaid: false, includesHolidays: false, maxDays: null,  color: "#fbbf24", note: "ลาได้แต่ไม่ได้รับค่าจ้าง" },
    { code: "SICK",             name: "ลาป่วย",                                     daysPerYear: 30,  hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: false, maxDays: null,  color: "#ef4444", note: "ได้รับค่าจ้าง (รวมป่วยอุบัติเหตุในงาน + ป่วยทั่วไป)" },
    { code: "MATERNITY",        name: "ลาเพื่อคลอดบุตร",                            daysPerYear: 60,  hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: true,  maxDays: 120,   color: "#ec4899", note: "ได้รับค่าจ้าง 60 วัน ลาได้สูงสุด 120 วัน นับรวมวันหยุด" },
    { code: "MARRIAGE",         name: "ลาเพื่อการสมรส",                             daysPerYear: 3,   hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: false, maxDays: null,  color: "#f472b6", note: "ได้รับค่าจ้าง 3 วันทำงาน" },
    { code: "ORDINATION",       name: "ลาอุปสมบท",                                  daysPerYear: 15,  hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: true,  maxDays: null,  color: "#a855f7", note: "ลาได้ 15 วัน นับรวมวันหยุด" },
    { code: "FUNERAL",          name: "ลาบิดา/มารดา/สามี/ภรรยา/บุตร เสียชีวิต",     daysPerYear: 5,   hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: false, maxDays: null,  color: "#6b7280", note: "ลาได้ 5 วันทำงาน (รวมบิดามารดาคู่สมรส)" },
    { code: "PATERNITY",        name: "ลาเพื่อดูแลภรรยาคลอดบุตร",                   daysPerYear: 15,  hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: false, maxDays: null,  color: "#0ea5e9", note: "ได้รับค่าจ้าง 15 วัน" },
    { code: "MILITARY_SELECT",  name: "ลาเพื่อคัดเลือกทหาร",                        daysPerYear: 1,   hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: false, maxDays: null,  color: "#16a34a", note: "ลาได้ 1 วัน" },
    { code: "STERILIZATION",    name: "ลาเพื่อทำหมัน",                              daysPerYear: 0,   hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: false, maxDays: null,  color: "#14b8a6", note: "ตามใบรับรองแพทย์" },
    { code: "TRAINING",         name: "ลาเพื่อฝึกอบรมหรือพัฒนาความรู้ความสามารถ",   daysPerYear: 0,   hasProRate: false, canCarryOver: false, isPaid: true,  includesHolidays: false, maxDays: null,  color: "#8b5cf6", note: "ตามที่ได้รับอนุมัติ" },
    { code: "MILITARY_SERVICE", name: "ลารับราชการทหาร",                            daysPerYear: 0,   hasProRate: false, canCarryOver: false, isPaid: false, includesHolidays: false, maxDays: null,  color: "#475569", note: "ตามระยะเวลาที่ทางราชการกำหนด" },
  ];
  for (const t of leaveTypes) {
    await prisma.leaveType.upsert({ where: { code: t.code }, update: t, create: t });
  }

  // ----- Leave Reject Reasons (default 6)
  const rejectReasons = [
    { code: "OVER_QUOTA",          label: "ลาเกินสิทธิ์",                       sortOrder: 1 },
    { code: "STAFFING",            label: "งานช่วงนั้นด่วน ขาดคน",              sortOrder: 2 },
    { code: "OVERLAP",             label: "ทับซ้อนกับใบลาอื่น",                  sortOrder: 3 },
    { code: "INSUFFICIENT_NOTICE", label: "ใบลาเร่งด่วนเกินไป (ไม่แจ้งล่วงหน้า)", sortOrder: 4 },
    { code: "INCOMPLETE_INFO",     label: "ข้อมูลไม่ครบถ้วน",                    sortOrder: 5 },
    { code: "OTHER",               label: "อื่นๆ",                              sortOrder: 99 },
  ];
  for (const r of rejectReasons) {
    await prisma.leaveRejectReason.upsert({
      where: { code: r.code }, update: r, create: r,
    });
  }

  // ----- Vacation Tiers (สิทธิ์ลาพักร้อนตามอายุงาน — รูปที่ 1: 16 ระดับ 0-15 วัน)
  const vacationTiers = [
    { daysOfServiceFrom: 22,   vacationDays: 0 },
    { daysOfServiceFrom: 23,   vacationDays: 1 },
    { daysOfServiceFrom: 75,   vacationDays: 2 },
    { daysOfServiceFrom: 127,  vacationDays: 3 },
    { daysOfServiceFrom: 178,  vacationDays: 4 },
    { daysOfServiceFrom: 229,  vacationDays: 5 },
    { daysOfServiceFrom: 280,  vacationDays: 6 },
    { daysOfServiceFrom: 331,  vacationDays: 7 },
    { daysOfServiceFrom: 853,  vacationDays: 8 },
    { daysOfServiceFrom: 975,  vacationDays: 9 },
    { daysOfServiceFrom: 1583, vacationDays: 10 },
    { daysOfServiceFrom: 1705, vacationDays: 11 },
    { daysOfServiceFrom: 3408, vacationDays: 12 },
    { daysOfServiceFrom: 3530, vacationDays: 13 },
    { daysOfServiceFrom: 5233, vacationDays: 14 },
    { daysOfServiceFrom: 5355, vacationDays: 15 },
  ];
  for (const t of vacationTiers) {
    await prisma.vacationTier.upsert({
      where: { daysOfServiceFrom: t.daysOfServiceFrom }, update: t, create: t,
    });
  }

  // ----- Bus Routes
  const buses = [
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
  // Soft-deactivate any old codes that aren't in the new list (preserves FK refs in OTRequest)
  await prisma.busRoute.updateMany({
    where: { code: { notIn: buses.map((b) => b.code) } },
    data: { isActive: false },
  });
  for (const b of buses) {
    await prisma.busRoute.upsert({
      where: { code: b.code },
      update: { name: b.name, isActive: true },
      create: { ...b, isActive: true },
    });
  }

  // ----- Holidays (sample 2026)
  const holidays = [
    { date: "2026-01-01", name: "วันขึ้นปีใหม่" },
    { date: "2026-04-13", name: "วันสงกรานต์" },
    { date: "2026-04-14", name: "วันสงกรานต์" },
    { date: "2026-04-15", name: "วันสงกรานต์" },
    { date: "2026-05-01", name: "วันแรงงาน" },
    { date: "2026-12-05", name: "วันคล้ายวันเฉลิมพระชนมพรรษา ร.9" },
    { date: "2026-12-10", name: "วันรัฐธรรมนูญ" },
    { date: "2026-12-31", name: "วันสิ้นปี" },
  ];
  for (const h of holidays) {
    const d = new Date(h.date);
    await prisma.holiday.upsert({ where: { date: d }, update: { name: h.name }, create: { date: d, name: h.name } });
  }

  // ----- Departments (no manager yet)
  const depts = [
    { code: "HR", name: "ฝ่ายบุคคล", side: "OFFICE" as Side },
    { code: "FIN", name: "ฝ่ายการเงิน", side: "OFFICE" as Side },
    { code: "IT", name: "ฝ่ายไอที", side: "OFFICE" as Side },
    { code: "SALES", name: "ฝ่ายขาย", side: "OFFICE" as Side },
    { code: "PROD1", name: "ผลิต Line 1", side: "PRODUCTION" as Side },
    { code: "PROD2", name: "ผลิต Line 2", side: "PRODUCTION" as Side },
    { code: "QC", name: "ควบคุมคุณภาพ", side: "PRODUCTION" as Side },
    { code: "WH", name: "คลังสินค้า", side: "PRODUCTION" as Side },
  ];
  const deptMap = new Map<string, string>();
  for (const d of depts) {
    const created = await prisma.department.upsert({ where: { code: d.code }, update: d, create: d });
    deptMap.set(d.code, created.id);
  }

  // ----- Demo Users + Employees
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  type DemoUser = {
    username: string; password: string; role: UserRole;
    employeeCode: string; firstName: string; lastName: string; email: string;
    deptCode: string; side: Side; supervisorCode?: string; position: string;
  };

  const demoUsers: DemoUser[] = [
    { username: "admin", password: "admin123", role: "SYSTEM_ADMIN", employeeCode: "SYS001", firstName: "System", lastName: "Admin", email: "admin@ams.local", deptCode: "IT", side: "OFFICE", position: "System Administrator" },
    { username: "hr", password: "hr123", role: "HR_ADMIN", employeeCode: "HR001", firstName: "สมศรี", lastName: "สวัสดี", email: "hr@ams.local", deptCode: "HR", side: "OFFICE", position: "HR Admin" },
    { username: "mgr.office", password: "mgr123", role: "DEPT_MANAGER", employeeCode: "MO001", firstName: "วิชัย", lastName: "บริหารดี", email: "mgr.office@ams.local", deptCode: "SALES", side: "OFFICE", position: "ผู้จัดการแผนกขาย" },
    { username: "mgr.prod", password: "mgr123", role: "DEPT_MANAGER", employeeCode: "MP001", firstName: "สมศักดิ์", lastName: "จัดการผลิต", email: "mgr.prod@ams.local", deptCode: "PROD1", side: "PRODUCTION", position: "ผู้จัดการแผนกผลิต" },
    { username: "mgr.factory", password: "mgr123", role: "FACTORY_MANAGER", employeeCode: "MF001", firstName: "ประเสริฐ", lastName: "โรงงานเดช", email: "mgr.factory@ams.local", deptCode: "PROD1", side: "PRODUCTION", position: "ผู้จัดการโรงงาน" },
    { username: "sup.office", password: "sup123", role: "SUPERVISOR", employeeCode: "SO001", firstName: "อนันต์", lastName: "นำทีม", email: "sup.office@ams.local", deptCode: "SALES", side: "OFFICE", supervisorCode: "MO001", position: "หัวหน้าทีมขาย" },
    { username: "sup.prod", password: "sup123", role: "SUPERVISOR", employeeCode: "SP001", firstName: "บุญมี", lastName: "ผลิตเก่ง", email: "sup.prod@ams.local", deptCode: "PROD1", side: "PRODUCTION", supervisorCode: "MP001", position: "หัวหน้างานผลิต" },
  ];

  // Pass 1: create users + employees without supervisor
  const empMap = new Map<string, string>();
  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: { passwordHash: hash(u.password), role: u.role },
      create: { username: u.username, passwordHash: hash(u.password), role: u.role },
    });

    const emp = await prisma.employee.upsert({
      where: { employeeCode: u.employeeCode },
      update: {
        firstName: u.firstName, lastName: u.lastName, email: u.email, side: u.side,
        position: u.position, departmentId: deptMap.get(u.deptCode), userId: user.id,
      },
      create: {
        employeeCode: u.employeeCode, firstName: u.firstName, lastName: u.lastName, email: u.email,
        side: u.side, position: u.position, departmentId: deptMap.get(u.deptCode),
        hireDate: new Date("2020-01-15"), userId: user.id,
      },
    });
    empMap.set(u.employeeCode, emp.id);
  }

  // Pass 2: assign supervisors
  for (const u of demoUsers) {
    if (u.supervisorCode) {
      await prisma.employee.update({
        where: { employeeCode: u.employeeCode },
        data: { supervisorId: empMap.get(u.supervisorCode) },
      });
    }
  }

  // Set dept managers (PROD1 manager = MP001 DEPT_MANAGER, not MF001 FACTORY_MANAGER)
  await prisma.department.update({ where: { code: "SALES" }, data: { managerId: empMap.get("MO001") } });
  await prisma.department.update({ where: { code: "PROD1" }, data: { managerId: empMap.get("MP001") } });
  await prisma.department.update({ where: { code: "HR" }, data: { managerId: empMap.get("HR001") } });

  // ----- Extra employees (สร้างตัวอย่างเพิ่ม 20 คนทั้ง 2 ฝั่ง)
  const firstNames = ["มาลี","สมหญิง","สมพร","วราภรณ์","ธนากร","สุรชัย","อรุณ","พรพิมล","กิตติ","อนุชา","ภัทรา","สุดา","วิภา","ชาญ","ศุภชัย","ปริญญา","พิชญา","ณัฐพล","จิราภรณ์","ธวัชชัย"];
  const lastNames = ["รักงาน","ขยัน","ตั้งใจ","มั่นคง","ใจกล้า","พากเพียร","สู้ชีวิต","มีน้ำใจ","อดทน","ทรัพย์มาก","ดีงาม","สุขใจ","มีบุญ","วงศ์ดี","ทองดี","ศรีสุข","แสนดี","พงษ์ภูมิ","วิเศษ","มงคล"];
  for (let i = 0; i < 20; i++) {
    const isOffice = i < 8;
    const code = `${isOffice ? "OF" : "PR"}${String(i + 2).padStart(3, "0")}`;
    if (empMap.has(code)) continue;
    const deptCode = isOffice ? (i % 2 === 0 ? "SALES" : "IT") : (i % 2 === 0 ? "PROD2" : "QC");
    const supervisorCode = isOffice ? "SO001" : "SP001";
    const exists = await prisma.employee.findUnique({ where: { employeeCode: code } });
    if (exists) continue;
    await prisma.employee.create({
      data: {
        employeeCode: code,
        firstName: firstNames[i % firstNames.length],
        lastName: lastNames[i % lastNames.length],
        email: `${code.toLowerCase()}@ams.local`,
        side: isOffice ? "OFFICE" : "PRODUCTION",
        position: isOffice ? "พนักงานทั่วไป" : "พนักงานผลิต",
        departmentId: deptMap.get(deptCode),
        supervisorId: empMap.get(supervisorCode),
        hireDate: new Date(2021, i % 12, 1),
      },
    }).catch(() => null);
  }

  // ----- Leave Balances สำหรับปีปัจจุบัน
  const year = new Date().getFullYear();
  const allEmps = await prisma.employee.findMany();
  const allLeaveTypes = await prisma.leaveType.findMany();
  for (const emp of allEmps) {
    for (const lt of allLeaveTypes) {
      await prisma.leaveBalance.upsert({
        where: { employeeId_leaveTypeId_year: { employeeId: emp.id, leaveTypeId: lt.id, year } },
        update: {},
        create: {
          employeeId: emp.id, leaveTypeId: lt.id, year,
          totalDays: lt.daysPerYear, usedDays: 0, carriedOver: 0, remainingDays: lt.daysPerYear,
        },
      });
    }
  }

  console.log("✅ Seeding completed");
  console.log("👥 Demo Accounts:");
  for (const u of demoUsers) {
    console.log(`   ${u.username.padEnd(14)} / ${u.password.padEnd(10)} → ${u.role}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
