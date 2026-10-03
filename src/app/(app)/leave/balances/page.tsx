import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { getCarryOverMaxDays, CARRY_OVER_START_YEAR } from "@/lib/pro-rate";
import { LeaveBalancesClient } from "./balances-client";

export default async function LeaveBalancesPage({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  const session = await auth();
  const role = session!.user.role;
  const myEmployeeId = session!.user.employeeId;
  const isAdmin = role === "HR_ADMIN" || role === "SYSTEM_ADMIN";

  const year = Number(searchParams.year) || new Date().getFullYear();

  // Scope: HR/Admin see everyone; managers see their depts; supervisors see own + subordinates
  const empWhere: any = { isActive: true };
  if (!isAdmin) {
    if (role === "DEPT_MANAGER" && myEmployeeId) {
      const managed = await prisma.department.findMany({
        where: { managerId: myEmployeeId },
        select: { id: true },
      });
      empWhere.departmentId = { in: managed.map((d) => d.id) };
    } else if (role === "FACTORY_MANAGER") {
      empWhere.side = "PRODUCTION";
    } else if (role === "SUPERVISOR" && myEmployeeId) {
      // ลูกน้องของฉัน (supervisorId = me) + ตัวเอง
      empWhere.OR = [
        { id: myEmployeeId },
        { supervisorId: myEmployeeId },
      ];
    } else if (myEmployeeId) {
      empWhere.id = myEmployeeId;
    } else {
      empWhere.id = "__none__";
    }
  }

  // Fetch all data in parallel — including previous year's approved leaves (for auto carry-over)
  const prevYear = year - 1;
  const [employees, leaveTypes, vacationTiers, approvedLeaves, prevYearApproved, maxCarryOver] = await Promise.all([
    prisma.employee.findMany({
      where: empWhere,
      include: { department: true },
      orderBy: { employeeCode: "asc" },
    }),
    prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: [{ hasProRate: "desc" }, { code: "asc" }], // VACATION first
    }),
    prisma.vacationTier.findMany({
      where: { isActive: true },
      orderBy: { daysOfServiceFrom: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) },
      },
      select: { employeeId: true, leaveTypeId: true, totalDays: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { gte: new Date(`${prevYear}-01-01`), lte: new Date(`${prevYear}-12-31`) },
      },
      select: { employeeId: true, leaveTypeId: true, totalDays: true },
    }),
    getCarryOverMaxDays(),
  ]);

  // Build a fast lookup: usedMap.get(`${empId}::${leaveTypeId}`) → days used
  const usedMap = new Map<string, number>();
  for (const l of approvedLeaves) {
    const key = `${l.employeeId}::${l.leaveTypeId}`;
    usedMap.set(key, (usedMap.get(key) ?? 0) + l.totalDays);
  }
  const usedPrevMap = new Map<string, number>();
  for (const l of prevYearApproved) {
    const key = `${l.employeeId}::${l.leaveTypeId}`;
    usedPrevMap.set(key, (usedPrevMap.get(key) ?? 0) + l.totalDays);
  }

  // Local tier lookup (no DB call)
  const tierLookup = (daysOfService: number) => {
    let best = 0;
    for (const t of vacationTiers) {
      if (t.daysOfServiceFrom <= daysOfService && t.daysOfServiceFrom >= 0) {
        if (best === 0 || t.daysOfServiceFrom > best) best = t.vacationDays;
      }
    }
    return best;
  };
  // simpler: pick the largest tier whose threshold ≤ days
  const tierFor = (days: number): number => {
    let val = 0;
    let bestThresh = -1;
    for (const t of vacationTiers) {
      if (t.daysOfServiceFrom <= days && t.daysOfServiceFrom > bestThresh) {
        bestThresh = t.daysOfServiceFrom;
        val = t.vacationDays;
      }
    }
    return val;
  };

  const endOfYear = new Date(`${year}-12-31`);
  const endOfPrevYear = new Date(`${prevYear}-12-31`);
  const MS_DAY = 1000 * 60 * 60 * 24;

  const rows = employees.map((e) => {
    const daysOfService = Math.max(
      0,
      Math.floor((endOfYear.getTime() - e.hireDate.getTime()) / MS_DAY),
    );
    // Days of service as of end-of-PREV-year, used to compute prev year's vacation tier
    const daysOfServicePrev = Math.max(
      0,
      Math.floor((endOfPrevYear.getTime() - e.hireDate.getTime()) / MS_DAY),
    );
    const yearsOfService = Math.floor(daysOfService / 365.25);
    const extraDays = daysOfService - Math.floor(yearsOfService * 365.25);

    const balances = leaveTypes.map((lt) => {
      let baseEntitled: number;
      if (lt.hasProRate) {
        // VACATION: lookup tier for THIS year's days-of-service
        baseEntitled = tierFor(daysOfService);
      } else {
        baseEntitled = lt.daysPerYear;
      }
      if (lt.maxDays != null && lt.maxDays > 0) baseEntitled = lt.maxDays;

      // ── Auto carry-over (VACATION only, starting CARRY_OVER_START_YEAR) ──
      let carriedOver = 0;
      if (lt.hasProRate && daysOfServicePrev > 0 && year >= CARRY_OVER_START_YEAR) {
        let prevEntitled = tierFor(daysOfServicePrev);
        if (lt.maxDays != null && lt.maxDays > 0) prevEntitled = lt.maxDays;
        if (prevEntitled > 0) {
          const usedPrev = usedPrevMap.get(`${e.id}::${lt.id}`) ?? 0;
          const remainingPrev = Math.max(0, prevEntitled - usedPrev);
          carriedOver = Math.min(remainingPrev, maxCarryOver);
        }
      }

      const entitled = baseEntitled + carriedOver;
      const used = usedMap.get(`${e.id}::${lt.id}`) ?? 0;
      const remaining = Math.max(0, entitled - used);
      return {
        leaveTypeId: lt.id,
        leaveTypeCode: lt.code,
        leaveTypeName: lt.name,
        entitled,
        baseEntitled,
        carriedOver,
        used,
        remaining,
        maxDays: lt.maxDays,
        isPaid: lt.isPaid,
      };
    });

    return {
      id: e.id,
      employeeCode: e.employeeCode,
      name: `${e.firstName} ${e.lastName}`,
      department: e.department?.name ?? "-",
      side: e.side as "OFFICE" | "PRODUCTION",
      hireDate: e.hireDate.toISOString(),
      daysOfService,
      yearsOfService,
      extraDays,
      balances,
    };
  });

  const leaveTypeColumns = leaveTypes.map((lt) => ({
    id: lt.id,
    code: lt.code,
    name: lt.name,
  }));

  return (
    <LeaveBalancesClient
      rows={rows}
      leaveTypes={leaveTypeColumns}
      year={year}
      isAdmin={isAdmin}
    />
  );
}
