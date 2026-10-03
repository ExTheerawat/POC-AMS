import { prisma } from "./db";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * The first calendar year (CE) where auto carry-over takes effect.
 * Looking at year Y: carry-over from (Y-1) only applies when Y >= CARRY_OVER_START_YEAR.
 *
 * In Buddhist Era this is พ.ศ. 2570 — i.e. leftover days from 2569 are the first
 * batch that carry into 2570. Years 2568 and 2569 do NOT receive any carry-over
 * (the AMS system's "year 1" is 2569 — there is no real history before it).
 */
export const CARRY_OVER_START_YEAR = 2027;

/**
 * Calculate the annual vacation days an employee is entitled to in `year`,
 * using the configurable VacationTier table (see /master/vacation-tiers).
 *
 * Lookup rule: pick the row with the largest `daysOfServiceFrom` that is
 * ≤ the employee's days of service as of Dec 31 of `year`.
 *
 * Returns 0 if no tier matches (i.e. brand-new hire with very low service).
 */
export async function calculateVacationDays(hireDate: Date, year: number): Promise<number> {
  const endOfYear = new Date(`${year}-12-31`);
  const daysOfService = Math.max(
    0,
    Math.floor((endOfYear.getTime() - hireDate.getTime()) / MS_PER_DAY),
  );

  const tier = await prisma.vacationTier.findFirst({
    where: { daysOfServiceFrom: { lte: daysOfService }, isActive: true },
    orderBy: { daysOfServiceFrom: "desc" },
  });
  return tier?.vacationDays ?? 0;
}

/**
 * Backward-compat wrapper for the previous hardcoded function name.
 * Now delegates to the configurable VacationTier lookup.
 */
export async function calculateProRateLeaveDays(hireDate: Date, year: number): Promise<number> {
  return calculateVacationDays(hireDate, year);
}

/**
 * Cap unused leave at year-end before carrying into next year.
 */
export function calculateCarryOver(remainingDays: number, maxCarryOver = 5): number {
  return Math.min(remainingDays, maxCarryOver);
}

/**
 * Read the CARRY_OVER_MAX_DAYS system setting (default 5 if unset/invalid).
 */
export async function getCarryOverMaxDays(): Promise<number> {
  const s = await prisma.systemSetting.findUnique({ where: { key: "CARRY_OVER_MAX_DAYS" } });
  const n = s ? Number(s.value) : 5;
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

/**
 * Calculate carry-over days from year (Y-1) into year Y for a single employee
 * + leave type. Returns 0 if leave type does not pro-rate (only VACATION carries).
 *
 * Rule: carryOver_Y = min(entitled_Y-1 - used_Y-1, CARRY_OVER_MAX_DAYS)
 *   - We use ONLY base entitlement (from tier) for Y-1, NOT including Y-1's own
 *     carry-over. This means leftover days are "use it or lose it" after one year.
 */
export async function calculateCarryOverForEmployee(input: {
  employeeId: string;
  hireDate: Date;
  leaveTypeId: string;
  hasProRate: boolean;
  daysPerYear: number;
  maxDays: number | null;
  year: number;
  maxCarryOver?: number; // pass pre-fetched setting to save a query
}): Promise<number> {
  if (!input.hasProRate) return 0; // only VACATION carries over
  // System started in CARRY_OVER_START_YEAR — no historical carry-over before that
  if (input.year < CARRY_OVER_START_YEAR) return 0;

  const prevYear = input.year - 1;
  let prevEntitled = await calculateVacationDays(input.hireDate, prevYear);
  if (input.maxDays != null && input.maxDays > 0) prevEntitled = input.maxDays;
  if (prevEntitled <= 0) return 0;

  // Approved used in previous year
  const startPrev = new Date(`${prevYear}-01-01`);
  const endPrev = new Date(`${prevYear}-12-31`);
  const agg = await prisma.leaveRequest.aggregate({
    where: {
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      status: "APPROVED",
      startDate: { gte: startPrev, lte: endPrev },
    },
    _sum: { totalDays: true },
  });
  const usedPrev = agg._sum.totalDays ?? 0;
  const remainingPrev = Math.max(0, prevEntitled - usedPrev);

  const maxCO = input.maxCarryOver ?? (await getCarryOverMaxDays());
  return Math.min(remainingPrev, maxCO);
}
