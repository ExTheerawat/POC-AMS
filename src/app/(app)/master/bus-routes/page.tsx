import { prisma } from "@/lib/db";
import { BusRoutesClient } from "./bus-routes-client";

export default async function BusRoutesPage() {
  const routes = await prisma.busRoute.findMany({ orderBy: { code: "asc" } });
  return (
    <BusRoutesClient
      items={routes.map((r) => ({
        id: r.id, code: r.code, name: r.name,
        route: r.route ?? "", note: r.note ?? "", isActive: r.isActive,
      }))}
    />
  );
}
