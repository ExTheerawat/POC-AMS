"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { USER_ROLES, type UserRole } from "@/types/enums";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" } as const;
  if (session.user.role !== "SYSTEM_ADMIN" && session.user.role !== "HR_ADMIN")
    return { error: "ต้องเป็น System Admin หรือ HR Admin" } as const;
  return { session } as const;
}

const createSchema = z.object({
  username: z.string().min(3, "ขั้นต่ำ 3 ตัวอักษร").max(50),
  password: z.string().min(6, "รหัสผ่านขั้นต่ำ 6 ตัวอักษร"),
  role: z.enum(USER_ROLES as [UserRole, ...UserRole[]]),
  employeeId: z.string().optional(),
  isActive: z.boolean().default(true),
});

export async function createUser(input: z.infer<typeof createSchema>) {
  const a = await requireAdmin();
  if ("error" in a) return a;

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const existing = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (existing) return { error: "Username นี้มีอยู่แล้ว" };

  if (parsed.data.employeeId) {
    const empWithUser = await prisma.employee.findUnique({
      where: { id: parsed.data.employeeId },
      select: { userId: true },
    });
    if (empWithUser?.userId) return { error: "พนักงานนี้มี User อยู่แล้ว" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      username: parsed.data.username,
      passwordHash,
      role: parsed.data.role,
      isActive: parsed.data.isActive,
    },
  });

  if (parsed.data.employeeId) {
    await prisma.employee.update({
      where: { id: parsed.data.employeeId },
      data: { userId: user.id },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: a.session.user.id,
      action: "CREATE_USER",
      entity: "User",
      entityId: user.id,
      detail: `${parsed.data.username} (${parsed.data.role})`,
    },
  });

  revalidatePath("/settings/users");
  return { ok: true };
}

const updateSchema = z.object({
  id: z.string(),
  role: z.enum(USER_ROLES as [UserRole, ...UserRole[]]),
  isActive: z.boolean(),
  employeeId: z.string().nullable().optional(),
});

export async function updateUser(input: z.infer<typeof updateSchema>) {
  const a = await requireAdmin();
  if ("error" in a) return a;

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: "ข้อมูลไม่ถูกต้อง" };

  // Unlink old employee if different
  const current = await prisma.user.findUnique({
    where: { id: parsed.data.id },
    include: { employee: true },
  });
  if (!current) return { error: "ไม่พบ User" };

  await prisma.user.update({
    where: { id: parsed.data.id },
    data: { role: parsed.data.role, isActive: parsed.data.isActive },
  });

  const oldEmpId = current.employee?.id ?? null;
  const newEmpId = parsed.data.employeeId ?? null;
  if (oldEmpId !== newEmpId) {
    if (oldEmpId) await prisma.employee.update({ where: { id: oldEmpId }, data: { userId: null } });
    if (newEmpId) {
      const target = await prisma.employee.findUnique({ where: { id: newEmpId }, select: { userId: true } });
      if (target?.userId && target.userId !== parsed.data.id) return { error: "พนักงานปลายทางถูกผูกกับ User อื่น" };
      await prisma.employee.update({ where: { id: newEmpId }, data: { userId: parsed.data.id } });
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: a.session.user.id,
      action: "UPDATE_USER",
      entity: "User",
      entityId: parsed.data.id,
      detail: `role=${parsed.data.role} active=${parsed.data.isActive}`,
    },
  });

  revalidatePath("/settings/users");
  return { ok: true };
}

export async function resetPassword(userId: string, newPassword: string) {
  const a = await requireAdmin();
  if ("error" in a) return a;
  if (newPassword.length < 6) return { error: "รหัสผ่านขั้นต่ำ 6 ตัวอักษร" };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  await prisma.auditLog.create({
    data: { userId: a.session.user.id, action: "RESET_PASSWORD", entity: "User", entityId: userId },
  });

  revalidatePath("/settings/users");
  return { ok: true };
}

export async function toggleUserActive(userId: string): Promise<{ error: string } | { ok: true; isActive: boolean }> {
  const a = await requireAdmin();
  if ("error" in a) return { error: a.error as string };
  if (userId === a.session.user.id) return { error: "ห้าม disable ตัวเอง" };

  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return { error: "ไม่พบ User" };

  await prisma.user.update({ where: { id: userId }, data: { isActive: !u.isActive } });

  revalidatePath("/settings/users");
  return { ok: true, isActive: !u.isActive };
}

export async function deleteUser(userId: string) {
  const a = await requireAdmin();
  if ("error" in a) return a;
  if (userId === a.session.user.id) return { error: "ห้ามลบตัวเอง" };

  // Soft delete = set isActive=false + unlink employee
  const u = await prisma.user.findUnique({ where: { id: userId }, include: { employee: true } });
  if (!u) return { error: "ไม่พบ User" };

  if (u.employee) {
    await prisma.employee.update({ where: { id: u.employee.id }, data: { userId: null } });
  }
  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });

  await prisma.auditLog.create({
    data: { userId: a.session.user.id, action: "DELETE_USER", entity: "User", entityId: userId },
  });

  revalidatePath("/settings/users");
  return { ok: true };
}
