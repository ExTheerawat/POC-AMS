import { prisma } from "@/lib/db";
import { LeaveTypesClient } from "./leave-types-client";

export default async function LeaveTypesPage() {
  const types = await prisma.leaveType.findMany({ orderBy: { code: "asc" } });
  return (
    <LeaveTypesClient
      items={types.map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        daysPerYear: t.daysPerYear,
        hasProRate: t.hasProRate,
        canCarryOver: t.canCarryOver,
        isPaid: t.isPaid,
        includesHolidays: t.includesHolidays,
        maxDays: t.maxDays,
        note: t.note ?? "",
        isActive: t.isActive,
      }))}
    />
  );
}
