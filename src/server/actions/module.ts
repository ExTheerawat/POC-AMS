"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MODULE_COOKIE, type ActiveModule } from "@/lib/active-module";

export async function selectModule(mod: ActiveModule) {
  const c = cookies();
  c.set(MODULE_COOKIE, mod, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: "lax",
  });
  redirect(mod === "leave" ? "/leave/list" : "/ot/list");
}

export async function clearModule() {
  cookies().delete(MODULE_COOKIE);
  redirect("/select-module");
}
