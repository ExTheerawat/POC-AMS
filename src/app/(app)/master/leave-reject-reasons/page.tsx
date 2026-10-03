import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { LeaveRejectReasonsClient } from "./leave-reject-reasons-client";

export default async function LeaveRejectReasonsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "HR_ADMIN" && role !== "SYSTEM_ADMIN") redirect("/dashboard");

  const items = await prisma.leaveRejectReason.findMany({
    orderBy: { code: "asc" },
  });
  return (
    <LeaveRejectReasonsClient
      items={items.map((r) => ({
        id: r.id,
        code: r.code,
        label: r.label,
        isActive: r.isActive,
      }))}
    />
  );
}
