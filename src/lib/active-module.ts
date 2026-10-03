import { cookies } from "next/headers";

export type ActiveModule = "leave" | "ot";
export const MODULE_COOKIE = "activeModule";

export async function getActiveModule(): Promise<ActiveModule | null> {
  const v = cookies().get(MODULE_COOKIE)?.value;
  return v === "leave" || v === "ot" ? v : null;
}
