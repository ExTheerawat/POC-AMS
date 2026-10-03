import { prisma } from "@/lib/db";
import { VacationTiersClient } from "./vacation-tiers-client";

export default async function VacationTiersPage() {
  const tiers = await prisma.vacationTier.findMany({
    orderBy: { daysOfServiceFrom: "asc" },
  });
  return (
    <VacationTiersClient
      items={tiers.map((t) => ({
        id: t.id,
        daysOfServiceFrom: t.daysOfServiceFrom,
        vacationDays: t.vacationDays,
        note: t.note ?? "",
        isActive: t.isActive,
      }))}
    />
  );
}
