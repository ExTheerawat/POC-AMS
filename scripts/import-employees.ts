/**
 * Bulk-import the 100 employees provided by the user.
 *
 * Rules from the user:
 *   - Code starting with "A" → side = OFFICE
 *   - Code starting with "B" → side = PRODUCTION
 *   - supervisorId is NOT set (will be assigned later)
 *   - Email auto-generated, must be unique → uses lowercased code @ams.local
 *   - Hire date is in Buddhist Era (BE = CE + 543), format DD/MM/YYYY
 *
 * Department names are matched against the Department table by `name`. Trailing /
 * leading spaces & double-spaces are normalized.
 *
 * Re-runnable: existing employees (matched by employeeCode) are skipped.
 *
 * Run with: npx tsx scripts/import-employees.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Row = { code: string; nameRaw: string; dept: string; hire: string };

const ROWS: Row[] = [
  { code: "A-188", nameRaw: "นายอำนวย น้อยสารี", dept: "Slitter", hire: "05/06/2532" },
  { code: "A-217", nameRaw: "นายนิรันดร์ จินดาเรืองชัย", dept: "DA", hire: "01/10/2536" },
  { code: "A-238", nameRaw: "นายสมโภชน์ ปุยเจริญ", dept: "Bush & Yoke Assembly", hire: "01/11/2536" },
  { code: "A-270", nameRaw: "นายสุธรรม สมใจ", dept: "Jig", hire: "16/04/2537" },
  { code: "A-092", nameRaw: "น.ส.ศรีไพบูลย์ เขียวสีม่วง", dept: "HR", hire: "16/05/2538" },
  { code: "A-271", nameRaw: "นายราชันย์ แก้วไว", dept: "DM", hire: "01/08/2538" },
  { code: "A-230", nameRaw: "นายวรพงษ์ สุขสวัสดิ์", dept: "Jig", hire: "18/12/2538" },
  { code: "A-206", nameRaw: "นายธานินทร์ งามวงค์", dept: "Bush", hire: "22/01/2539" },
  { code: "A-207", nameRaw: "น.ส.รตาวรากร มันเทศ", dept: "APQP", hire: "20/01/2541" },
  { code: "B-804", nameRaw: "นายธนากร เพ็ชรกลับ", dept: "Admin.", hire: "27/07/2541" },
  { code: "A-211", nameRaw: "นายวุฒิกร ฉันทิยะนันท์", dept: "PRESS", hire: "01/09/2541" },
  { code: "B-327", nameRaw: "นายชินกร พงษ์เมือง", dept: "F/G & Delivery", hire: "16/03/2542" },
  { code: "A-108", nameRaw: "น.ส.นันทวัน พลอนันต์", dept: "MK", hire: "06/09/2542" },
  { code: "B-332", nameRaw: "นายอนุชิต คำจันลาด", dept: "Packing", hire: "01/11/2542" },
  { code: "B-353", nameRaw: "นายสุขสันต์ มากพันธ์ผล", dept: "Infra.", hire: "07/04/2543" },
  { code: "A-244", nameRaw: "นายสมคิด ศรีละคร", dept: "Plating", hire: "04/08/2543" },
  { code: "B-373", nameRaw: "นายพิพัฒน์ ฟักแจ้ง", dept: "PRESS", hire: "04/08/2543" },
  { code: "B-375", nameRaw: "นายสัมฤทธ์ แสงป้อง", dept: "T/W", hire: "04/08/2543" },
  { code: "A-129", nameRaw: "นายธีระ ธนมาก", dept: "Supply W/H", hire: "06/11/2543" },
  { code: "B-387", nameRaw: "นายอภิเชษฐ์ คงคะจันทร์", dept: "PRESS", hire: "29/01/2544" },
  { code: "B-405", nameRaw: "นายเดชณรงค์ ภูสังข์", dept: "DM", hire: "14/05/2544" },
  { code: "B-406", nameRaw: "นายประธาน วังคีรี", dept: "DA", hire: "14/05/2544" },
  { code: "A-118", nameRaw: "นายประภาส ฤทธิ์เต็ม", dept: "APQP", hire: "15/06/2544" },
  { code: "B-419", nameRaw: "นายธวัช ศรีไพร", dept: "DM", hire: "10/08/2544" },
  { code: "A-245", nameRaw: "นายประชิต สัจสุวรรณ์", dept: "PRESS", hire: "01/10/2544" },
  { code: "B-432", nameRaw: "นายธีรวัฒน์ ประเสริฐศิลป์", dept: "DA", hire: "06/12/2544" },
  { code: "B-435", nameRaw: "นายประมวล จันทร", dept: "Plating", hire: "05/01/2545" },
  { code: "A-221", nameRaw: "น.ส.แววตา แสงวงค์", dept: "PURCHASING", hire: "01/04/2545" },
  { code: "A-246", nameRaw: "นายวันชัย วันสุข", dept: "Bush", hire: "17/05/2545" },
  { code: "B-452", nameRaw: "นายสงคราม คาระโส", dept: "Plating", hire: "17/05/2545" },
  { code: "B-455", nameRaw: "นายคมสิงห์ สีทับทิม", dept: "Jig", hire: "20/05/2545" },
  { code: "B-459", nameRaw: "นายจำลอง คำเกิด", dept: "Packing", hire: "15/06/2545" },
  { code: "A-252", nameRaw: "น.ส.นภาวรรณ ไชยหาวงษ์", dept: "PURCHASING", hire: "01/07/2545" },
  { code: "A-320", nameRaw: "นายกิตติศักดิ์ เจือจันทร์", dept: "T/W", hire: "09/08/2545" },
  { code: "B-480", nameRaw: "นายธนดล เสมอศรี", dept: "Bush", hire: "09/08/2545" },
  { code: "B-481", nameRaw: "น.ส.ราตรี นามสาย", dept: "Admin.", hire: "17/08/2545" },
  { code: "A-141", nameRaw: "น.ส.ชฎาพร ชูเรือง", dept: "Production Planning", hire: "16/09/2545" },
  { code: "B-487", nameRaw: "นายสมบัติ นวลปิ่น", dept: "T/W", hire: "16/10/2545" },
  { code: "B-494", nameRaw: "นายนคร สายทอง", dept: "Packing", hire: "15/11/2545" },
  { code: "A-283", nameRaw: "นายวัทนพร เทศดี", dept: "Production Coordinator", hire: "04/12/2545" },
  { code: "B-497", nameRaw: "นายสำเริง ศรีนวล", dept: "DA", hire: "04/12/2545" },
  { code: "A-284", nameRaw: "นายวชิระ หนูสาท", dept: "DM", hire: "13/12/2545" },
  { code: "B-501", nameRaw: "นายประยุทธ แสนทองคำ", dept: "Slitter", hire: "26/12/2545" },
  { code: "B-508", nameRaw: "นายรัตนชัย กงสอน", dept: "DA", hire: "03/03/2546" },
  { code: "B-510", nameRaw: "นายวีรชน คาดีวี", dept: "T/W", hire: "03/03/2546" },
  { code: "B-513", nameRaw: "นายสาคร เดชบรรทม", dept: "DA", hire: "03/03/2546" },
  { code: "B-519", nameRaw: "นายดาวลอย วงค์แก้ว", dept: "T/W", hire: "17/03/2546" },
  { code: "A-145", nameRaw: "น.ส.อัญชนา กองกูล", dept: "MK", hire: "16/04/2546" },
  { code: "A-316", nameRaw: "นายณัทธนกฤต จันชะล้ำ", dept: "Jig", hire: "02/06/2546" },
  { code: "B-554", nameRaw: "นายสมาน ติละ", dept: "PRESS", hire: "02/06/2546" },
  { code: "B-563", nameRaw: "นายภควันต์ สอนธรรม", dept: "DM", hire: "01/07/2546" },
  { code: "B-573", nameRaw: "นายวิริยะ แม้นเดช", dept: "DM", hire: "01/08/2546" },
  { code: "A-150", nameRaw: "นายอรุณ สงวนยวง", dept: "Incoming Control", hire: "01/09/2546" },
  { code: "B-601", nameRaw: "นายศุภณัฐ ฝอยผักแว่น", dept: "DM", hire: "01/10/2546" },
  { code: "B-602", nameRaw: "นายสถาพร ใจอ่อน", dept: "DM", hire: "01/10/2546" },
  { code: "B-604", nameRaw: "นายสมภพ หากระสัง", dept: "PS", hire: "01/10/2546" },
  { code: "B-606", nameRaw: "น.ส.อุไร ยิ้มน้อย", dept: "Inspection", hire: "01/10/2546" },
  { code: "B-618", nameRaw: "น.ส.จินตนา คำจันลาด", dept: "Packing", hire: "16/10/2546" },
  { code: "B-639", nameRaw: "นายสำราญ นาชิน", dept: "Bush", hire: "16/02/2547" },
  { code: "B-643", nameRaw: "นายชัยยุทธ ชนะไชย", dept: "Inspection", hire: "01/03/2547" },
  { code: "B-647", nameRaw: "นายพิทักษ์ ประครองศรี", dept: "DA", hire: "16/03/2547" },
  { code: "A-156", nameRaw: "น.ส.เยาวภา ปิ่นแก้ว", dept: "Safety Center", hire: "08/04/2547" },
  { code: "B-653", nameRaw: "น.ส.สุนี เจริญยิ่ง", dept: "Inspection", hire: "16/04/2547" },
  { code: "B-658", nameRaw: "นายวิทยา คูณตุ้ม", dept: "TOOL", hire: "04/05/2547" },
  { code: "A-247", nameRaw: "นายวัลลภ มณฑา", dept: "QC", hire: "24/05/2547" },
  { code: "A-346", nameRaw: "นายโย ปิ่นศิริ", dept: "T/W", hire: "01/06/2547" },
  { code: "A-286", nameRaw: "นายเฉลิมชัย เสมาทอง", dept: "Production Planning", hire: "16/07/2547" },
  { code: "A-299", nameRaw: "นายพงษ์ศักดิ์ จุลโพธิ์", dept: "Bush", hire: "16/07/2547" },
  { code: "A-273", nameRaw: "น.ส.ออนอิริยา พิมพ์คต", dept: "ACCOUNTING", hire: "02/08/2547" },
  { code: "A-287", nameRaw: "นายวัฒนา พริ้งเพราะ", dept: "Production Planning", hire: "02/08/2547" },
  { code: "A-300", nameRaw: "นายพูลสวัสดิ์ พรมทองดี", dept: "QC", hire: "02/08/2547" },
  { code: "A-347", nameRaw: "นายเอกชัย จารัตน์", dept: "Bush", hire: "02/08/2547" },
  { code: "B-691", nameRaw: "น.ส.ฐิติยา ว่องไว", dept: "QC", hire: "02/08/2547" },
  { code: "B-702", nameRaw: "นายณรงค์ ช่วยอุระชน", dept: "DA", hire: "09/08/2547" },
  { code: "B-703", nameRaw: "นายธนากร เหลาแตว", dept: "DA", hire: "09/08/2547" },
  { code: "A-164", nameRaw: "น.ส.สุรินยา มานแม", dept: "ACCOUNTING", hire: "20/09/2547" },
  { code: "B-713", nameRaw: "นายกิติศักดิ์ วงษ์ษา", dept: "T/W", hire: "29/09/2547" },
  { code: "B-720", nameRaw: "นายพรเทพ จันทร์ลอย", dept: "PS", hire: "21/10/2547" },
  { code: "A-165", nameRaw: "นายเสกสรร ปานมณี", dept: "Supply W/H", hire: "01/11/2547" },
  { code: "B-727", nameRaw: "นายสมพงษ์ คงทนชาติ", dept: "F/G & Delivery", hire: "01/12/2547" },
  { code: "B-729", nameRaw: "นางปิ่นนรินทร์ ทวีโชติ", dept: "Inspection", hire: "10/12/2547" },
  { code: "B-735", nameRaw: "นายวัชรพงศ์ ช่างสลัก", dept: "Jig", hire: "21/01/2548" },
  { code: "B-740", nameRaw: "น.ส.กิติญาดา บุราณสาร", dept: "Inspection", hire: "12/02/2548" },
  { code: "A-301", nameRaw: "นายศักดิธัช นิวงษา", dept: "F/G & Delivery", hire: "07/03/2548" },
  { code: "B-749", nameRaw: "น.ส.ปณิตา วิริจิตร", dept: "Packing", hire: "07/03/2548" },
  { code: "B-763", nameRaw: "นายสุรศักดิ์ คำหงษ์", dept: "DM", hire: "23/03/2548" },
  { code: "A-321", nameRaw: "น.ส.ณิชารีย์นาถ ศรีโนนยาง", dept: "Production Planning", hire: "30/03/2548" },
  { code: "A-350", nameRaw: "นายจรูญ ละหม่อม", dept: "T/W", hire: "08/04/2548" },
  { code: "B-779", nameRaw: "นายคมสันต์ ระวิวรรณ", dept: "TOOL", hire: "21/04/2548" },
  { code: "A-175", nameRaw: "น.ส.นริสา ปานมณี", dept: "ACCOUNTING", hire: "09/05/2548" },
  { code: "B-790", nameRaw: "นายไวยศิลป์ สิมลา", dept: "T/W", hire: "18/05/2548" },
  { code: "A-288", nameRaw: "นายปริม แดงเจริญ", dept: "Supply W/H", hire: "19/05/2548" },
  { code: "B-795", nameRaw: "นายชัยนัด เสือมั่น", dept: "QC", hire: "01/06/2548" },
  { code: "B-796", nameRaw: "น.ส.ลำพูน แก้วฝ่ายนอก", dept: "Packing", hire: "08/06/2548" },
  { code: "B-800", nameRaw: "นายปรีดี ตลับแก้ว", dept: "Inspection", hire: "11/06/2548" },
  { code: "B-806", nameRaw: "นายโชคชัย พุทธสาเดช", dept: "Inspection", hire: "21/07/2548" },
  { code: "A-179", nameRaw: "นางอมรรัตน์ ช่างสลัก", dept: "F/G & Delivery", hire: "01/08/2548" },
  { code: "A-329", nameRaw: "นายพานิชย์ เดชทะสร", dept: "DA", hire: "15/08/2548" },
  { code: "A-339", nameRaw: "นายภาณุมาศ พันทะสาร", dept: "PM", hire: "15/08/2548" },
  { code: "B-828", nameRaw: "นายสุรสิทธิ์ เกิดพระ", dept: "PS", hire: "05/09/2548" },
];

// Parse "นายอำนวย น้อยสารี" → { first, last }; strips title prefix
function parseName(raw: string): { first: string; last: string } {
  const m = raw.match(/^(นาย|นาง|น\.ส\.|นางสาว)\s*/);
  const rest = m ? raw.slice(m[0].length) : raw;
  const parts = rest.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") || "-" };
}

// Parse "05/06/2532" (BE) → Date in CE
function parseHireDate(s: string): Date {
  const [dd, mm, yyyyBE] = s.split("/").map(Number);
  const yyyyCE = yyyyBE - 543;
  return new Date(Date.UTC(yyyyCE, mm - 1, dd));
}

// Normalize department lookup name
function normDept(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

async function main() {
  // Build dept name → id map (normalized lookup)
  const allDepts = await prisma.department.findMany();
  const deptByName = new Map<string, string>();
  for (const d of allDepts) deptByName.set(normDept(d.name), d.id);

  console.log(`→ Importing ${ROWS.length} employees...`);
  let created = 0;
  let skipped = 0;
  const notFoundDepts = new Set<string>();

  for (const r of ROWS) {
    const codeNorm = r.code.trim();
    const exists = await prisma.employee.findUnique({ where: { employeeCode: codeNorm } });
    if (exists) {
      skipped++;
      continue;
    }

    const deptKey = normDept(r.dept);
    const deptId = deptByName.get(deptKey);
    if (!deptId) {
      notFoundDepts.add(deptKey);
      continue;
    }

    const { first, last } = parseName(r.nameRaw);
    const side = codeNorm.startsWith("A") ? "OFFICE" : "PRODUCTION";
    const email = `${codeNorm.toLowerCase()}@ams.local`;
    const hireDate = parseHireDate(r.hire);

    await prisma.employee.create({
      data: {
        employeeCode: codeNorm,
        firstName: first,
        lastName: last,
        email,
        side,
        departmentId: deptId,
        hireDate,
        isActive: true,
        // supervisorId intentionally left null — user will assign later
      },
    });
    created++;
  }

  console.log(`  Created: ${created}`);
  console.log(`  Skipped (already exists): ${skipped}`);
  if (notFoundDepts.size > 0) {
    console.log(`  ⚠ Departments NOT FOUND (skipped):`);
    for (const d of notFoundDepts) console.log(`    - "${d}"`);
  }

  // Summary by side
  const allEmp = await prisma.employee.findMany({
    where: { employeeCode: { startsWith: "A-" } },
  });
  const allEmpB = await prisma.employee.findMany({
    where: { employeeCode: { startsWith: "B-" } },
  });
  console.log(`\nTotal A-* (Office): ${allEmp.length}`);
  console.log(`Total B-* (Production): ${allEmpB.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
