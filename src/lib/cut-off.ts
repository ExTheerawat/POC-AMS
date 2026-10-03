import { prisma } from "./db";

export type CutOffKey = "CUTOFF_LEAVE_CREATE" | "CUTOFF_LEAVE_APPROVE" | "CUTOFF_OT_CREATE" | "CUTOFF_OT_APPROVE" | "CUTOFF_ENFORCED";

export async function getSetting(key: string, defaultValue: string): Promise<string> {
  const s = await prisma.systemSetting.findUnique({ where: { key } });
  return s?.value ?? defaultValue;
}

export async function isCutOffPassed(key: CutOffKey): Promise<{ passed: boolean; cutoffTime: string }> {
  const enforced = await getSetting("CUTOFF_ENFORCED", "true");
  if (enforced !== "true") return { passed: false, cutoffTime: "" };

  const defaults: Record<CutOffKey, string> = {
    CUTOFF_LEAVE_CREATE: "11:00",
    CUTOFF_LEAVE_APPROVE: "13:00",
    CUTOFF_OT_CREATE: "11:00",
    CUTOFF_OT_APPROVE: "13:00",
    CUTOFF_ENFORCED: "true",
  };
  const cutoffTime = await getSetting(key, defaults[key]);
  const [h, m] = cutoffTime.split(":").map(Number);
  const now = new Date();
  const cutoff = new Date();
  cutoff.setHours(h, m, 0, 0);
  return { passed: now > cutoff, cutoffTime };
}
