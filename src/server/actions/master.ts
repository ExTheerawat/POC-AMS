"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";

// Departments
export async function upsertDepartment(input: { id?: string; code: string; name: string; side: "OFFICE" | "PRODUCTION"; managerId?: string }) {
  if (input.id) {
    await prisma.department.update({ where: { id: input.id }, data: { code: input.code, name: input.name, side: input.side, managerId: input.managerId || null } });
  } else {
    await prisma.department.create({ data: { code: input.code, name: input.name, side: input.side, managerId: input.managerId || null } });
  }
  revalidatePath("/master/departments");
  return { ok: true };
}

export async function deleteDepartment(id: string) {
  await prisma.department.delete({ where: { id } }).catch(() => null);
  revalidatePath("/master/departments");
  return { ok: true };
}

// Leave Types
export async function upsertLeaveType(input: {
  id?: string;
  code: string;
  name: string;
  daysPerYear: number;
  hasProRate: boolean;
  canCarryOver: boolean;
  isPaid?: boolean;
  includesHolidays?: boolean;
  maxDays?: number | null;
  note?: string | null;
}) {
  const data = {
    code: input.code,
    name: input.name,
    daysPerYear: input.daysPerYear,
    hasProRate: input.hasProRate,
    canCarryOver: input.canCarryOver,
    isPaid: input.isPaid ?? true,
    includesHolidays: input.includesHolidays ?? false,
    maxDays: input.maxDays ?? null,
    note: input.note ?? null,
  };
  if (input.id) {
    await prisma.leaveType.update({ where: { id: input.id }, data });
  } else {
    await prisma.leaveType.create({ data });
  }
  revalidatePath("/master/leave-types");
  return { ok: true };
}
export async function deleteLeaveType(id: string) {
  await prisma.leaveType.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/master/leave-types");
  return { ok: true };
}

// Vacation Tiers (สิทธิ์ลาพักร้อนตามอายุงาน)
export async function upsertVacationTier(input: {
  id?: string;
  daysOfServiceFrom: number;
  vacationDays: number;
  note?: string | null;
}) {
  const data = {
    daysOfServiceFrom: input.daysOfServiceFrom,
    vacationDays: input.vacationDays,
    note: input.note ?? null,
  };
  try {
    if (input.id) await prisma.vacationTier.update({ where: { id: input.id }, data });
    else await prisma.vacationTier.create({ data });
  } catch (e: any) {
    if (/Unique constraint|unique/i.test(e.message ?? "")) {
      return { error: `อายุงาน ${input.daysOfServiceFrom} วัน มีอยู่แล้ว` };
    }
    throw e;
  }
  revalidatePath("/master/vacation-tiers");
  return { ok: true };
}

export async function deleteVacationTier(id: string) {
  await prisma.vacationTier.delete({ where: { id } }).catch(() => null);
  revalidatePath("/master/vacation-tiers");
  return { ok: true };
}

// Reset vacation tiers to factory defaults (16 rows from the rule book)
export async function resetVacationTiers() {
  const DEFAULTS = [
    { daysOfServiceFrom: 22, vacationDays: 0 },
    { daysOfServiceFrom: 23, vacationDays: 1 },
    { daysOfServiceFrom: 75, vacationDays: 2 },
    { daysOfServiceFrom: 127, vacationDays: 3 },
    { daysOfServiceFrom: 178, vacationDays: 4 },
    { daysOfServiceFrom: 229, vacationDays: 5 },
    { daysOfServiceFrom: 280, vacationDays: 6 },
    { daysOfServiceFrom: 331, vacationDays: 7 },
    { daysOfServiceFrom: 853, vacationDays: 8 },
    { daysOfServiceFrom: 975, vacationDays: 9 },
    { daysOfServiceFrom: 1583, vacationDays: 10 },
    { daysOfServiceFrom: 1705, vacationDays: 11 },
    { daysOfServiceFrom: 3408, vacationDays: 12 },
    { daysOfServiceFrom: 3530, vacationDays: 13 },
    { daysOfServiceFrom: 5233, vacationDays: 14 },
    { daysOfServiceFrom: 5355, vacationDays: 15 },
  ];
  await prisma.vacationTier.deleteMany({});
  await prisma.vacationTier.createMany({ data: DEFAULTS });
  revalidatePath("/master/vacation-tiers");
  return { ok: true, count: DEFAULTS.length };
}

// Bus Routes
export async function upsertBusRoute(input: { id?: string; code: string; name: string; route?: string; note?: string }) {
  if (input.id) await prisma.busRoute.update({ where: { id: input.id }, data: input });
  else await prisma.busRoute.create({ data: input });
  revalidatePath("/master/bus-routes");
  return { ok: true };
}
export async function deleteBusRoute(id: string) {
  await prisma.busRoute.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/master/bus-routes");
  return { ok: true };
}

// Holidays
export async function upsertHoliday(input: { id?: string; date: string; name: string }) {
  const d = new Date(input.date);
  if (input.id) await prisma.holiday.update({ where: { id: input.id }, data: { date: d, name: input.name } });
  else await prisma.holiday.create({ data: { date: d, name: input.name } });
  revalidatePath("/master/holidays");
  return { ok: true };
}
export async function deleteHoliday(id: string) {
  await prisma.holiday.delete({ where: { id } }).catch(() => null);
  revalidatePath("/master/holidays");
  return { ok: true };
}

// Employees
const empSchema = z.object({
  id: z.string().optional(),
  employeeCode: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  position: z.string().optional(),
  side: z.enum(["OFFICE", "PRODUCTION"]),
  departmentId: z.string().optional(),
  supervisorId: z.string().optional(),
  defaultBusRouteId: z.string().optional(),
  hireDate: z.string(),
});

export async function upsertEmployee(input: z.infer<typeof empSchema>) {
  const parsed = empSchema.safeParse(input);
  if (!parsed.success) return { error: "ข้อมูลไม่ถูกต้อง" };
  const data = {
    employeeCode: parsed.data.employeeCode,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    email: parsed.data.email,
    position: parsed.data.position,
    side: parsed.data.side,
    departmentId: parsed.data.departmentId || null,
    supervisorId: parsed.data.supervisorId || null,
    defaultBusRouteId: parsed.data.defaultBusRouteId || null,
    hireDate: new Date(parsed.data.hireDate),
  };
  if (parsed.data.id) await prisma.employee.update({ where: { id: parsed.data.id }, data });
  else await prisma.employee.create({ data });
  revalidatePath("/master/employees");
  return { ok: true };
}

export async function deleteEmployee(id: string) {
  // Soft-delete by setting isActive=false and unlinking user
  const emp = await prisma.employee.findUnique({ where: { id }, select: { userId: true } });
  if (!emp) return { error: "ไม่พบพนักงาน" };
  await prisma.employee.update({ where: { id }, data: { isActive: false, userId: null } });
  if (emp.userId) {
    await prisma.user.update({ where: { id: emp.userId }, data: { isActive: false } });
  }
  revalidatePath("/master/employees");
  return { ok: true };
}

// System Settings
export async function setSetting(key: string, value: string) {
  await prisma.systemSetting.upsert({
    where: { key }, update: { value }, create: { key, value },
  });
  revalidatePath("/settings");
  return { ok: true };
}

// ─── Leave Reject Reasons ────────────────────────────────────────────────
async function requireHRAdmin() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" as const };
  const role = session.user.role;
  if (role !== "HR_ADMIN" && role !== "SYSTEM_ADMIN") {
    return { error: "เฉพาะ HR Admin เท่านั้น" as const };
  }
  return { session };
}

const rejectReasonSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, "กรุณาระบุข้อความ"),
  isActive: z.boolean().default(true),
});

/** Auto-generate next LRR### code (LRR001, LRR002, ...) */
async function getNextLRRCode(): Promise<string> {
  const existing = await prisma.leaveRejectReason.findMany({
    where: { code: { startsWith: "LRR" } },
    select: { code: true },
  });
  let max = 0;
  for (const r of existing) {
    const m = r.code.match(/^LRR(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `LRR${String(max + 1).padStart(3, "0")}`;
}

export async function upsertLeaveRejectReason(input: z.infer<typeof rejectReasonSchema>) {
  const a = await requireHRAdmin();
  if ("error" in a) return { error: a.error };
  const parsed = rejectReasonSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  if (parsed.data.id) {
    // Update — keep code unchanged
    await prisma.leaveRejectReason.update({
      where: { id: parsed.data.id },
      data: { label: parsed.data.label, isActive: parsed.data.isActive },
    });
  } else {
    // Create — auto-generate code
    const code = await getNextLRRCode();
    await prisma.leaveRejectReason.create({
      data: { code, label: parsed.data.label, isActive: parsed.data.isActive },
    });
  }
  revalidatePath("/master/leave-reject-reasons");
  revalidatePath("/leave/approval");
  return { ok: true };
}

export async function deleteLeaveRejectReason(id: string) {
  const a = await requireHRAdmin();
  if ("error" in a) return { error: a.error };
  // Soft delete (set isActive=false) — keep referential integrity with LeaveApproval
  await prisma.leaveRejectReason.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/master/leave-reject-reasons");
  return { ok: true };
}
