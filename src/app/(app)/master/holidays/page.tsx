import { prisma } from "@/lib/db";
import { HolidaysClient } from "./holidays-client";

export default async function HolidaysPage() {
  const holidays = await prisma.holiday.findMany({ orderBy: { date: "asc" } });
  return (
    <HolidaysClient
      items={holidays.map((h) => ({
        id: h.id,
        date: h.date.toISOString(),
        weekday: h.date.toLocaleDateString("th-TH", { weekday: "long" }),
        name: h.name,
      }))}
    />
  );
}
