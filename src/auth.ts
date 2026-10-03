import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { UserRole } from "@/types/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: UserRole;
      employeeId?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      side?: "OFFICE" | "PRODUCTION" | null;
      departmentId?: string | null;
    };
  }
}

export const { handlers: { GET, POST }, handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials.password) return null;
        const user = await prisma.user.findUnique({
          where: { username: String(credentials.username) },
          include: { employee: true },
        });
        if (!user || !user.isActive) return null;
        const ok = await bcrypt.compare(String(credentials.password), user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          username: user.username,
          role: user.role as UserRole,
          employeeId: user.employee?.id ?? null,
          firstName: user.employee?.firstName ?? null,
          lastName: user.employee?.lastName ?? null,
          side: (user.employee?.side as any) ?? null,
          departmentId: user.employee?.departmentId ?? null,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.username = (user as any).username;
        token.role = (user as any).role;
        token.employeeId = (user as any).employeeId;
        token.firstName = (user as any).firstName;
        token.lastName = (user as any).lastName;
        token.side = (user as any).side;
        token.departmentId = (user as any).departmentId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.id as string,
        username: token.username as string,
        role: token.role as UserRole,
        employeeId: token.employeeId as string | null,
        firstName: token.firstName as string | null,
        lastName: token.lastName as string | null,
        side: token.side as any,
        departmentId: token.departmentId as string | null,
      };
      return session;
    },
  },
});
