import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SYSTEM_ADMIN" && session.user.role !== "HR_ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { username: "asc" }],
    include: { employee: { include: { department: true } } },
  });

  // Employees that are not linked yet (for picking when creating new user)
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    orderBy: { employeeCode: "asc" },
    include: { department: true, user: true },
  });

  return (
    <UsersClient
      currentUserId={session.user.id}
      users={users.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
        employee: u.employee
          ? {
              id: u.employee.id,
              code: u.employee.employeeCode,
              name: `${u.employee.firstName} ${u.employee.lastName}`,
              email: u.employee.email,
              department: u.employee.department?.name ?? null,
              side: u.employee.side,
            }
          : null,
      }))}
      employees={employees.map((e) => ({
        id: e.id,
        code: e.employeeCode,
        name: `${e.firstName} ${e.lastName}`,
        department: e.department?.name ?? "",
        side: e.side,
        linked: !!e.user,
      }))}
    />
  );
}
