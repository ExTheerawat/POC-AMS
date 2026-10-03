"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { generateRequestNo, calculateDaysBetween, formatDate } from "@/lib/utils";
import { isCutOffPassed } from "@/lib/cut-off";
import { sendEmail, emailTemplate, leaveDetailsBlock } from "@/lib/email";
import { calculateVacationDays, calculateCarryOverForEmployee } from "@/lib/pro-rate";

/**
 * Verify the employee has enough entitled days remaining for `newDays` of leave.
 * Returns { ok: true } if within limit (or unlimited), otherwise { error }.
 *
 * Rules:
 *  - VACATION (hasProRate) → entitlement from VacationTier (by hireDate + year)
 *  - Others → leaveType.daysPerYear
 *  - leaveType.maxDays (if set) is an absolute upper bound that overrides
 *  - Hard limit = 0 → unlimited (case-by-case, e.g. TRAINING, MILITARY_SERVICE)
 *  - "Used" counts both APPROVED and PENDING requests in the same calendar year
 *    (so two pending requests can't combine to exceed the limit)
 */
async function checkEntitlement(
  employee: { id: string; hireDate: Date },
  leaveType: { id: string; name: string; daysPerYear: number; hasProRate: boolean; maxDays: number | null },
  year: number,
  newDays: number,
  excludeLeaveId?: string,
): Promise<{ ok: true } | { error: string }> {
  let baseLimit: number;
  if (leaveType.hasProRate) {
    baseLimit = await calculateVacationDays(employee.hireDate, year);
  } else {
    baseLimit = leaveType.daysPerYear;
  }
  if (leaveType.maxDays != null && leaveType.maxDays > 0) {
    baseLimit = leaveType.maxDays;
  }
  if (baseLimit <= 0) return { ok: true }; // unlimited / case-by-case

  // Auto-carry-over: VACATION-type leaves carry leftover from year (Y-1) up to CARRY_OVER_MAX_DAYS
  const carryOver = await calculateCarryOverForEmployee({
    employeeId: employee.id,
    hireDate: employee.hireDate,
    leaveTypeId: leaveType.id,
    hasProRate: leaveType.hasProRate,
    daysPerYear: leaveType.daysPerYear,
    maxDays: leaveType.maxDays,
    year,
  });
  const limit = baseLimit + carryOver;

  const startYear = new Date(`${year}-01-01`);
  const endYear = new Date(`${year}-12-31`);
  const agg = await prisma.leaveRequest.aggregate({
    where: {
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      status: { in: ["PENDING_DEPT_MGR", "PENDING_FACTORY_MGR", "APPROVED"] },
      startDate: { gte: startYear, lte: endYear },
      ...(excludeLeaveId ? { id: { not: excludeLeaveId } } : {}),
    },
    _sum: { totalDays: true },
  });
  const usedSoFar = agg._sum.totalDays ?? 0;
  if (usedSoFar + newDays > limit) {
    const available = Math.max(0, limit - usedSoFar);
    const carryNote = carryOver > 0 ? ` (สิทธิ์ปีนี้ ${baseLimit} + โอนจากปีก่อน ${carryOver})` : "";
    return {
      error:
        `ลาเกินสิทธิ์ — ${leaveType.name} มีสิทธิ์ ${limit} วัน/ปี${carryNote}, ` +
        `ใช้/รออนุมัติแล้ว ${usedSoFar} วัน, ` +
        `เหลือสิทธิ์อีก ${available} วัน (ต้องการลา ${newDays} วัน)`,
    };
  }
  return { ok: true };
}

const createSchema = z.object({
  employeeId: z.string().min(1),
  leaveTypeId: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  /** JSON string: array of "YYYY-MM-DD" — set ONLY for multi-date (non-contiguous) leaves */
  selectedDates: z.string().optional(),
  /** "MORNING" | "AFTERNOON" — set ONLY for half-day mode (single day, 0.5 totalDays) */
  halfDayType: z.enum(["MORNING", "AFTERNOON"]).optional(),
  reason: z.string().optional(),
  hasAttachment: z.boolean().optional(),
  attachmentNote: z.string().optional(),
});

/** Expand a date range [start..end] inclusive into an array of YYYY-MM-DD strings. */
function expandRange(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cur <= last) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/**
 * Per-date entry — each picked date can be full day or half day.
 * Stored in LeaveRequest.selectedDates as JSON.
 */
export type DateEntry = { date: string; half: "MORNING" | "AFTERNOON" | null };

/**
 * Parse and normalize the selectedDates JSON. Accepts BOTH formats:
 *   - Old: ["2026-06-11", "2026-06-15"]  → all full days
 *   - New: [{ date: "2026-06-16", half: "MORNING" }, ...]
 * Returns sorted-by-date unique entries (dedupe — last one wins per date).
 */
function parseSelectedDates(raw?: string | null): DateEntry[] | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const out: DateEntry[] = [];
    for (const item of arr) {
      if (typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item)) {
        out.push({ date: item, half: null });
      } else if (item && typeof item === "object" && typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
        const half = item.half === "MORNING" || item.half === "AFTERNOON" ? item.half : null;
        out.push({ date: item.date, half });
      }
    }
    if (out.length === 0) return null;
    // Dedupe by date (last write wins) then sort
    const map = new Map<string, DateEntry>();
    for (const e of out) map.set(e.date, e);
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return null;
  }
}

/** Sum total days from entries — full = 1, half = 0.5 */
function totalDaysFromEntries(entries: DateEntry[]): number {
  return entries.reduce((s, e) => s + (e.half ? 0.5 : 1), 0);
}

/** True if two half-day flags on the same date would overlap each other. */
function halfDayConflict(a: string | null, b: string | null): boolean {
  // null = full day → conflicts with anything else on same date
  if (a === null || b === null) return true;
  return a === b;
}

export async function createLeave(formData: FormData) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = createSchema.safeParse({
    employeeId: formData.get("employeeId"),
    leaveTypeId: formData.get("leaveTypeId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    selectedDates: (formData.get("selectedDates") as string) || undefined,
    halfDayType: (formData.get("halfDayType") as string) || undefined,
    reason: formData.get("reason") || undefined,
    hasAttachment: formData.get("hasAttachment") === "true",
    attachmentNote: formData.get("attachmentNote") || undefined,
  });
  if (!parsed.success) return { error: "ข้อมูลไม่ถูกต้อง" };

  // If multi-date mode → use the selected dates list (instead of range)
  const selectedDatesArr = parseSelectedDates(parsed.data.selectedDates);
  const halfDayType = parsed.data.halfDayType ?? null;

  const cutoff = await isCutOffPassed("CUTOFF_LEAVE_CREATE");
  if (cutoff.passed) return { error: `เกินเวลาสร้างใบลา (${cutoff.cutoffTime})` };

  const employee = await prisma.employee.findUnique({
    where: { id: parsed.data.employeeId },
    include: { department: true },
  });
  if (!employee) return { error: "ไม่พบพนักงาน" };

  // Block leave for system users (supervisor/manager/HR/admin) — they handle
  // their own leave through a different process outside this system.
  if (employee.userId) {
    return { error: "พนักงานคนนี้เป็นผู้ใช้ระบบ (หัวหน้า/ผจก./HR/Admin) — ไม่สามารถสร้างใบลาในระบบนี้ได้" };
  }

  const creator = session.user.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.user.employeeId } })
    : null;
  if (!creator) return { error: "ไม่พบข้อมูลผู้สร้าง (กรุณา login ด้วยบัญชีที่มี employee)" };

  // Compute start/end/totalDays — pick-mode (selectedDates entries) / range / legacy half-day
  let start: Date;
  let end: Date;
  let totalDays: number;
  if (selectedDatesArr && selectedDatesArr.length > 0) {
    // Pick mode — entries may have per-date half-day flags
    start = new Date(selectedDatesArr[0].date);
    end = new Date(selectedDatesArr[selectedDatesArr.length - 1].date);
    totalDays = totalDaysFromEntries(selectedDatesArr);
  } else if (halfDayType) {
    // Legacy single half-day mode (kept for backward compat / explicit single half)
    start = new Date(parsed.data.startDate);
    end = start;
    totalDays = 0.5;
  } else {
    start = new Date(parsed.data.startDate);
    end = new Date(parsed.data.endDate);
    totalDays = calculateDaysBetween(start, end);
  }
  if (totalDays <= 0) return { error: "วันที่ไม่ถูกต้อง" };

  // Enforce entitlement: cannot exceed days allowed for this leave type
  const leaveType = await prisma.leaveType.findUnique({
    where: { id: parsed.data.leaveTypeId },
    select: { id: true, name: true, daysPerYear: true, hasProRate: true, maxDays: true },
  });
  if (!leaveType) return { error: "ไม่พบประเภทการลา" };
  const ent = await checkEntitlement(employee, leaveType, start.getFullYear(), totalDays);
  if ("error" in ent) return { error: ent.error };

  // ── Prevent overlapping leaves for the same employee ──
  // (skip REJECTED and CANCELLED — only check active/pending/approved)
  // Build the new leave's day-set with each day's half-day flag.
  const newEntries: DateEntry[] = selectedDatesArr ?? (
    halfDayType
      ? [{ date: parsed.data.startDate, half: halfDayType }]
      : expandRange(start, end).map((d) => ({ date: d, half: null }))
  );
  const newMap = new Map(newEntries.map((e) => [e.date, e.half]));

  const candidates = await prisma.leaveRequest.findMany({
    where: {
      employeeId: employee.id,
      status: { in: ["DRAFT", "PENDING_DEPT_MGR", "PENDING_FACTORY_MGR", "APPROVED"] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
    include: { leaveType: true },
  });
  // Find any existing leave whose day-set intersects ours AND the half-day flags collide
  const overlapping = candidates.find((c) => {
    const existing: DateEntry[] = c.selectedDates
      ? (parseSelectedDates(c.selectedDates) ?? expandRange(c.startDate, c.endDate).map((d) => ({ date: d, half: null })))
      : c.halfDayType
        ? [{ date: c.startDate.toISOString().slice(0, 10), half: c.halfDayType as "MORNING" | "AFTERNOON" }]
        : expandRange(c.startDate, c.endDate).map((d) => ({ date: d, half: null }));
    return existing.some((e) => {
      if (!newMap.has(e.date)) return false;
      const newHalf = newMap.get(e.date) ?? null;
      return halfDayConflict(newHalf, e.half);
    });
  });

  if (overlapping) {
    const ds = formatDate(overlapping.startDate);
    const de = formatDate(overlapping.endDate);
    const statusLabel: Record<string, string> = {
      DRAFT: "ฉบับร่าง",
      PENDING_DEPT_MGR: "รออนุมัติ (แผนก)",
      PENDING_FACTORY_MGR: "รออนุมัติ (โรงงาน)",
      APPROVED: "อนุมัติแล้ว",
    };
    return {
      error: `พนักงาน ${employee.firstName} ${employee.lastName} มีใบลา ${overlapping.requestNo} (${overlapping.leaveType.name}) วันที่ ${ds}${ds !== de ? ` - ${de}` : ""} สถานะ "${statusLabel[overlapping.status] ?? overlapping.status}" ที่ทับวันที่นี้อยู่แล้ว`,
    };
  }

  const requestNo = generateRequestNo("LV");

  const leave = await prisma.leaveRequest.create({
    data: {
      requestNo,
      employeeId: employee.id,
      creatorId: creator.id,
      leaveTypeId: parsed.data.leaveTypeId,
      startDate: start,
      endDate: end,
      // Persist the picked dates if multi-date mode; null otherwise (range mode)
      selectedDates: selectedDatesArr ? JSON.stringify(selectedDatesArr) : null,
      halfDayType,
      totalDays,
      reason: parsed.data.reason,
      hasAttachment: parsed.data.hasAttachment ?? false,
      attachmentNote: parsed.data.attachmentNote,
      side: employee.side,
      status: "PENDING_DEPT_MGR",
    },
    include: { employee: true, leaveType: true, creator: true },
  });

  // Email
  const mgr = employee.department?.managerId
    ? await prisma.employee.findUnique({ where: { id: employee.department.managerId } })
    : null;
  const hrEmail = process.env.HR_ADMIN_EMAIL || "hr@example.com";
  if (mgr?.email) {
    await sendEmail({
      to: mgr.email,
      cc: hrEmail,
      subject: `[AMS] ใบลาใหม่รออนุมัติ — ${employee.firstName} ${employee.lastName}`,
      html: emailTemplate(
        "ใบลารออนุมัติ",
        `<p style="margin-top:0">มีใบลาใหม่รออนุมัติของคุณ — กรุณาเข้าระบบเพื่อพิจารณา</p>
         ${leaveDetailsBlock({
           requestNo,
           employeeName: `${employee.firstName} ${employee.lastName}`,
           employeeCode: employee.employeeCode,
           leaveTypeName: leave.leaveType.name,
           leaveTypeCode: leave.leaveType.code,
          halfDayType: leave.halfDayType,
           startDate: start,
           endDate: end,
           totalDays,
           reason: parsed.data.reason,
           status: "PENDING_DEPT_MGR",
           selectedDates: selectedDatesArr,
         })}`,
        "info",
        { label: "ดูใบลาในระบบ", url: "/leave/approval" },
      ),
    });
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "CREATE_LEAVE", entity: "LeaveRequest", entityId: leave.id, detail: requestNo },
  });

  revalidatePath("/leave");
  return { ok: true, id: leave.id, requestNo };
}

export async function approveLeave(
  leaveId: string,
  action: "APPROVE" | "REJECT",
  comment?: string,
  rejectReasonId?: string,
) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const cutoff = await isCutOffPassed("CUTOFF_LEAVE_APPROVE");
  if (cutoff.passed && action === "APPROVE") return { error: `เกินเวลาอนุมัติ (${cutoff.cutoffTime})` };

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: { employee: { include: { department: true, supervisor: true } }, leaveType: true, creator: true, approvals: true },
  });
  if (!leave) return { error: "ไม่พบใบลา" };

  // For REJECT, rejectReasonId is required (UI enforces this; backend validates)
  if (action === "REJECT" && !rejectReasonId) {
    return { error: "กรุณาเลือกเหตุผลปฏิเสธจาก dropdown" };
  }
  // Validate rejectReasonId exists if provided
  let rejectReasonLabel: string | null = null;
  if (rejectReasonId) {
    const reason = await prisma.leaveRejectReason.findUnique({ where: { id: rejectReasonId } });
    if (!reason) return { error: "ไม่พบเหตุผลปฏิเสธที่เลือก" };
    rejectReasonLabel = reason.label;
  }

  const role = session.user.role;
  const isAdminOverride = role === "HR_ADMIN" || role === "SYSTEM_ADMIN";
  let step = 1;
  let nextStatus: "PENDING_FACTORY_MGR" | "APPROVED" | "REJECTED" = "APPROVED";

  if (action === "REJECT") {
    nextStatus = "REJECTED";
  } else if (leave.status === "PENDING_DEPT_MGR") {
    if (role !== "DEPT_MANAGER" && !isAdminOverride) return { error: "ไม่มีสิทธิ์อนุมัติ" };
    // DEPT_MANAGER: approve if I'm the manager of the leave-owner's department
    if (role === "DEPT_MANAGER") {
      const empDept = leave.employee.departmentId
        ? await prisma.department.findUnique({ where: { id: leave.employee.departmentId } })
        : null;
      const isManagerOfDept = empDept?.managerId && empDept.managerId === session.user.employeeId;
      if (!isManagerOfDept) {
        return { error: "อนุมัติได้เฉพาะเอกสารของแผนกที่คุณเป็นผู้จัดการ" };
      }
    }
    step = 1;
    // HR/Admin fast-track: skip directly to APPROVED in a single click (skip the Factory Mgr step)
    nextStatus = isAdminOverride
      ? "APPROVED"
      : (leave.side === "PRODUCTION" ? "PENDING_FACTORY_MGR" : "APPROVED");
  } else if (leave.status === "PENDING_FACTORY_MGR") {
    if (role !== "FACTORY_MANAGER" && !isAdminOverride) return { error: "ไม่มีสิทธิ์อนุมัติ" };
    // FACTORY_MANAGER: enforce Production side only
    if (role === "FACTORY_MANAGER" && leave.side !== "PRODUCTION") {
      return { error: "ผู้จัดการโรงงานอนุมัติได้เฉพาะฝ่ายผลิต" };
    }
    step = 2;
    nextStatus = "APPROVED";
  } else {
    return { error: "ใบลานี้ไม่อยู่ในสถานะที่อนุมัติได้" };
  }

  await prisma.$transaction([
    prisma.leaveApproval.create({
      data: {
        leaveRequestId: leave.id,
        step,
        approverRole: role,
        approverId: session.user.employeeId ?? null,
        action,
        comment,
        rejectReasonId: action === "REJECT" ? rejectReasonId : null,
      },
    }),
    prisma.leaveRequest.update({ where: { id: leave.id }, data: { status: nextStatus } }),
  ]);

  // Update balance if approved final
  if (nextStatus === "APPROVED") {
    const year = leave.startDate.getFullYear();
    const balance = await prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId: leave.employeeId, leaveTypeId: leave.leaveTypeId, year } },
    });
    if (balance) {
      const used = balance.usedDays + leave.totalDays;
      await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: { usedDays: used, remainingDays: balance.totalDays + balance.carriedOver - used },
      });
    }
  }

  const hrEmail = process.env.HR_ADMIN_EMAIL || "hr@example.com";
  if (leave.creator.email) {
    // Pick title + variant by action/result
    const isApproved = action === "APPROVE";
    const isFinal = nextStatus === "APPROVED";
    const title = isApproved
      ? (isFinal ? "ใบลาได้รับอนุมัติ" : "ใบลาผ่านขั้นแรก รออนุมัติขั้นต่อไป")
      : "ใบลาถูกปฏิเสธ";
    const variant: "success" | "info" | "danger" = isApproved
      ? (isFinal ? "success" : "info")
      : "danger";
    const approverName = session.user.firstName && session.user.lastName
      ? `${session.user.firstName} ${session.user.lastName}`
      : session.user.username;

    await sendEmail({
      to: leave.creator.email,
      cc: hrEmail,
      subject: `[AMS] ใบลา ${leave.requestNo} ${isApproved ? (isFinal ? "ได้รับอนุมัติ" : "ผ่านขั้นแรก") : "ถูกปฏิเสธ"}`,
      html: emailTemplate(
        title,
        leaveDetailsBlock({
          requestNo: leave.requestNo,
          employeeName: `${leave.employee.firstName} ${leave.employee.lastName}`,
          employeeCode: leave.employee.employeeCode,
          leaveTypeName: leave.leaveType.name,
          leaveTypeCode: leave.leaveType.code,
          halfDayType: leave.halfDayType,
          startDate: leave.startDate,
          endDate: leave.endDate,
          totalDays: leave.totalDays,
          reason: leave.reason,
          status: nextStatus,
          approverName,
          comment,
          selectedDates: leave.selectedDates,
          rejectReasonLabel,
        }),
        variant,
        // If still pending → take approver to approval queue; else → leave detail
        nextStatus === "PENDING_FACTORY_MGR"
          ? { label: "ดูใบลาที่รออนุมัติ", url: "/leave/approval" }
          : { label: "ดูรายละเอียดใบลา", url: `/leave/${leave.id}` },
      ),
    });
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: action === "APPROVE" ? "APPROVE_LEAVE" : "REJECT_LEAVE", entity: "LeaveRequest", entityId: leave.id, detail: comment },
  });

  revalidatePath("/leave");
  return { ok: true };
}

/**
 * Approve or reject multiple leaves in one go.
 * - Each leave goes through the full approveLeave logic (validation, email, audit, etc.)
 * - Sequential processing — collects per-leave success/failure
 * - REJECT: same rejectReasonId + comment applied to all selected leaves
 */
export async function approveLeaveBatch(
  leaveIds: string[],
  action: "APPROVE" | "REJECT",
  comment?: string,
  rejectReasonId?: string,
) {
  if (leaveIds.length === 0) return { error: "ไม่มีรายการที่เลือก" };

  let succeeded = 0;
  const failures: { id: string; error: string }[] = [];
  for (const id of leaveIds) {
    const res = await approveLeave(id, action, comment, rejectReasonId);
    if (res && "error" in res && res.error) {
      failures.push({ id, error: res.error });
    } else {
      succeeded++;
    }
  }
  return { ok: true, succeeded, failed: failures.length, failures };
}

function canMutateLeave(session: any, leave: { creatorId: string; status: string }): { ok: true } | { error: string } {
  const role = session.user.role;
  const isAdmin = role === "HR_ADMIN" || role === "SYSTEM_ADMIN";
  const isOwner = session.user.employeeId === leave.creatorId;
  if (!isAdmin && !isOwner) return { error: "ไม่มีสิทธิ์แก้ไข/ลบใบลานี้ (เฉพาะผู้สร้างหรือ Admin)" };
  return { ok: true };
}

export async function cancelLeave(leaveId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: { employee: { include: { department: true } }, leaveType: true, creator: true },
  });
  if (!leave) return { error: "ไม่พบใบลา" };
  if (leave.status === "CANCELLED" || leave.status === "REJECTED")
    return { error: "ใบลานี้ถูกยกเลิก/ปฏิเสธอยู่แล้ว" };

  // Policy: ยกเลิกได้เฉพาะก่อน manager approve เท่านั้น
  // หลัง APPROVED แล้ว → ต้องใช้ flow "ขอยกเลิกการลา" (cancel-request) ที่ HR review
  const role = session.user.role;
  const isAdmin = role === "HR_ADMIN" || role === "SYSTEM_ADMIN";
  const cancellableByOwner = ["DRAFT", "PENDING_DEPT_MGR", "PENDING_FACTORY_MGR"];
  if (!cancellableByOwner.includes(leave.status) && !isAdmin) {
    return {
      error: `ใบลานี้อนุมัติแล้ว — กรุณาใช้เมนู "ขอยกเลิกการลา" เพื่อขอ HR review`,
    };
  }

  const auth_ = canMutateLeave(session, leave);
  if ("error" in auth_) return auth_;

  // If was APPROVED, restore the leave balance
  if (leave.status === "APPROVED") {
    const year = leave.startDate.getFullYear();
    const balance = await prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId: leave.employeeId, leaveTypeId: leave.leaveTypeId, year } },
    });
    if (balance) {
      const used = Math.max(0, balance.usedDays - leave.totalDays);
      await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: { usedDays: used, remainingDays: balance.totalDays + balance.carriedOver - used },
      });
    }
  }

  await prisma.leaveRequest.update({ where: { id: leaveId }, data: { status: "CANCELLED" } });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "CANCEL_LEAVE", entity: "LeaveRequest", entityId: leaveId },
  });

  // Notify employee + creator + dept manager + HR
  const mgr = leave.employee.department?.managerId
    ? await prisma.employee.findUnique({ where: { id: leave.employee.department.managerId } })
    : null;
  const hrEmail = process.env.HR_ADMIN_EMAIL || "hr@ams.local";
  const to = [leave.employee.email, leave.creator.email, mgr?.email].filter(Boolean) as string[];
  await sendEmail({
    to,
    cc: hrEmail,
    subject: `[AMS] ใบลา ${leave.requestNo} ถูกยกเลิก`,
    html: emailTemplate(
      "ใบลาถูกยกเลิก",
      leaveDetailsBlock({
        requestNo: leave.requestNo,
        employeeName: `${leave.employee.firstName} ${leave.employee.lastName}`,
        employeeCode: leave.employee.employeeCode,
        leaveTypeName: leave.leaveType.name,
           leaveTypeCode: leave.leaveType.code,
          halfDayType: leave.halfDayType,
        startDate: leave.startDate,
        endDate: leave.endDate,
        totalDays: leave.totalDays,
        reason: leave.reason,
        status: "CANCELLED",
        approverName: session.user.username,
        selectedDates: leave.selectedDates,
      }),
      "danger",
      { label: "ดูรายละเอียดใบลา", url: `/leave/${leave.id}` },
    ),
  });

  revalidatePath("/leave");
  return { ok: true };
}

const updateLeaveSchema = z.object({
  id: z.string(),
  leaveTypeId: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
  hasAttachment: z.boolean().optional(),
  attachmentNote: z.string().optional(),
});

export async function updateLeave(input: z.infer<typeof updateLeaveSchema>) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = updateLeaveSchema.safeParse(input);
  if (!parsed.success) return { error: "ข้อมูลไม่ถูกต้อง" };

  const leave = await prisma.leaveRequest.findUnique({ where: { id: parsed.data.id } });
  if (!leave) return { error: "ไม่พบใบลา" };

  // Only allow edit while PENDING (or DRAFT) — once APPROVED/REJECTED/CANCELLED, locked
  if (!["DRAFT", "PENDING_DEPT_MGR", "PENDING_FACTORY_MGR"].includes(leave.status))
    return { error: "ใบลาที่อนุมัติ/ปฏิเสธ/ยกเลิกแล้วไม่สามารถแก้ไขได้" };

  const auth_ = canMutateLeave(session, leave);
  if ("error" in auth_) return auth_;

  const start = new Date(parsed.data.startDate);
  const end = new Date(parsed.data.endDate);
  const totalDays = calculateDaysBetween(start, end);
  if (totalDays <= 0) return { error: "วันที่ไม่ถูกต้อง" };

  // Overlap check (exclude self)
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      id: { not: parsed.data.id },
      employeeId: leave.employeeId,
      status: { in: ["DRAFT", "PENDING_DEPT_MGR", "PENDING_FACTORY_MGR", "APPROVED"] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
    include: { leaveType: true },
  });
  if (overlapping) {
    return { error: `ทับกับใบลา ${overlapping.requestNo} (${overlapping.leaveType.name}) อยู่แล้ว` };
  }

  await prisma.leaveRequest.update({
    where: { id: parsed.data.id },
    data: {
      leaveTypeId: parsed.data.leaveTypeId,
      startDate: start,
      endDate: end,
      totalDays,
      reason: parsed.data.reason,
      hasAttachment: parsed.data.hasAttachment ?? false,
      attachmentNote: parsed.data.attachmentNote,
    },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "UPDATE_LEAVE", entity: "LeaveRequest", entityId: parsed.data.id },
  });

  // Notify dept manager (approver) + HR — the leave has changed and they need to re-check
  const updatedLeave = await prisma.leaveRequest.findUnique({
    where: { id: parsed.data.id },
    include: { employee: { include: { department: true } }, leaveType: true },
  });
  if (updatedLeave) {
    const mgr = updatedLeave.employee.department?.managerId
      ? await prisma.employee.findUnique({ where: { id: updatedLeave.employee.department.managerId } })
      : null;
    const hrEmail = process.env.HR_ADMIN_EMAIL || "hr@ams.local";
    if (mgr?.email) {
      await sendEmail({
        to: mgr.email,
        cc: hrEmail,
        subject: `[AMS] ใบลา ${updatedLeave.requestNo} ถูกแก้ไข`,
        html: emailTemplate(
          "ใบลาถูกแก้ไข — กรุณาตรวจสอบ",
          `<p style="margin-top:0;color:#d97706"><b>⚠️ ใบลานี้ถูกแก้ไข — กรุณาตรวจสอบและอนุมัติใหม่</b></p>
           ${leaveDetailsBlock({
             requestNo: updatedLeave.requestNo,
             employeeName: `${updatedLeave.employee.firstName} ${updatedLeave.employee.lastName}`,
             employeeCode: updatedLeave.employee.employeeCode,
             leaveTypeName: updatedLeave.leaveType.name,
             leaveTypeCode: updatedLeave.leaveType.code,
             halfDayType: updatedLeave.halfDayType,
             startDate: start,
             endDate: end,
             totalDays,
             reason: parsed.data.reason,
             status: updatedLeave.status,
             approverName: session.user.username,
             selectedDates: updatedLeave.selectedDates,
           })}`,
          "warning",
          { label: "ตรวจสอบใบลา", url: "/leave/approval" },
        ),
      });
    }
  }

  revalidatePath("/leave");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Cancel Request flow — for APPROVED leaves (HR review required)
// Mirrors OT cancel-request pattern in ot.ts
// ─────────────────────────────────────────────────────────────────────────

async function requireHRAdminLeave() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" as const };
  const role = session.user.role;
  if (role !== "HR_ADMIN" && role !== "SYSTEM_ADMIN")
    return { error: "เฉพาะ HR Admin เท่านั้น" as const };
  return { session };
}

const cancelLeaveReqSchema = z.object({
  leaveRequestId: z.string(),
  reason: z.string().min(3, "กรุณาระบุเหตุผล (อย่างน้อย 3 ตัวอักษร)"),
});

export async function requestCancelLeave(input: z.infer<typeof cancelLeaveReqSchema>) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  const parsed = cancelLeaveReqSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: parsed.data.leaveRequestId },
    include: { employee: { include: { department: true } }, leaveType: true, creator: true },
  });
  if (!leave) return { error: "ไม่พบใบลา" };

  // Per spec: ขอยกเลิกได้เฉพาะใบลาที่ APPROVED แล้วเท่านั้น
  if (leave.status !== "APPROVED") {
    return { error: "ขอยกเลิกได้เฉพาะใบลาที่อนุมัติแล้วเท่านั้น" };
  }

  // Scope guard
  const role = session.user.role;
  const isAdmin = role === "HR_ADMIN" || role === "SYSTEM_ADMIN";
  const myEmployeeId = session.user.employeeId;
  if (!isAdmin && myEmployeeId) {
    if (role === "SUPERVISOR") {
      const isCreator = leave.creatorId === myEmployeeId;
      const isSubordinate = leave.employee.supervisorId === myEmployeeId;
      if (!isCreator && !isSubordinate) {
        return { error: "ขอยกเลิกได้เฉพาะใบลาของลูกน้องหรือที่ตัวเองสร้างเท่านั้น" };
      }
    } else if (role === "DEPT_MANAGER") {
      const managed = await prisma.department.findMany({
        where: { managerId: myEmployeeId },
        select: { id: true },
      });
      const managedIds = new Set(managed.map((d) => d.id));
      if (!leave.employee.departmentId || !managedIds.has(leave.employee.departmentId)) {
        return { error: "ขอยกเลิกได้เฉพาะใบลาในแผนกที่คุณดูแล" };
      }
    } else {
      return { error: "ไม่มีสิทธิ์ขอยกเลิก" };
    }
  }

  // Duplicate check
  const dup = await prisma.leaveCancellation.findFirst({
    where: {
      leaveRequestId: parsed.data.leaveRequestId,
      status: { in: ["PENDING", "APPROVED"] },
    },
  });
  if (dup) {
    const label = dup.status === "APPROVED" ? "ถูกยกเลิกไปแล้ว" : "มีคำขอรอ HR อนุมัติอยู่แล้ว";
    return { error: `ใบลา ${leave.requestNo} ${label}` };
  }

  await prisma.leaveCancellation.create({
    data: {
      leaveRequestId: parsed.data.leaveRequestId,
      requestedById: myEmployeeId ?? "",
      reason: parsed.data.reason,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "REQUEST_CANCEL_LEAVE",
      entity: "LeaveCancellation",
      entityId: parsed.data.leaveRequestId,
      detail: parsed.data.reason,
    },
  });

  // Notify HR
  const hrEmail = process.env.HR_ADMIN_EMAIL || "hr@ams.local";
  await sendEmail({
    to: hrEmail,
    subject: `[AMS] คำขอยกเลิกใบลา ${leave.requestNo} — รอ HR อนุมัติ`,
    html: emailTemplate(
      "คำขอยกเลิกใบลา — รอ HR อนุมัติ",
      `<p style="margin-top:0">มีคำขอยกเลิกใบลาใหม่ส่งถึง HR Admin — กรุณาเข้าระบบเพื่อพิจารณา</p>
       ${leaveDetailsBlock({
         requestNo: leave.requestNo,
         employeeName: `${leave.employee.firstName} ${leave.employee.lastName}`,
         employeeCode: leave.employee.employeeCode,
         leaveTypeName: leave.leaveType.name,
           leaveTypeCode: leave.leaveType.code,
          halfDayType: leave.halfDayType,
         startDate: leave.startDate,
         endDate: leave.endDate,
         totalDays: leave.totalDays,
         reason: parsed.data.reason,
         status: "PENDING_DEPT_MGR",
         approverName: session.user.username,
         comment: `เหตุผลที่ขอยกเลิก: ${parsed.data.reason}`,
         selectedDates: leave.selectedDates,
       })}`,
      "warning",
      { label: "พิจารณาคำขอ", url: "/leave/cancel-request" },
    ),
  });

  revalidatePath("/leave");
  return { ok: true };
}

export async function approveCancelLeave(cancelId: string, comment?: string) {
  const a = await requireHRAdminLeave();
  if ("error" in a) return { error: a.error };

  const c = await prisma.leaveCancellation.findUnique({
    where: { id: cancelId },
    include: {
      leaveRequest: {
        include: { employee: { include: { department: true } }, leaveType: true, creator: true },
      },
    },
  });
  if (!c) return { error: "ไม่พบคำขอ" };
  if (c.status !== "PENDING") return { error: "คำขอนี้ถูกประมวลผลแล้ว" };

  const leave = c.leaveRequest;
  const year = leave.startDate.getFullYear();
  const balance = await prisma.leaveBalance.findUnique({
    where: { employeeId_leaveTypeId_year: { employeeId: leave.employeeId, leaveTypeId: leave.leaveTypeId, year } },
  });

  // Transaction: cancel approval + leave status + restore balance
  const updates: any[] = [
    prisma.leaveCancellation.update({
      where: { id: cancelId },
      data: { status: "APPROVED", hrComment: comment },
    }),
    prisma.leaveRequest.update({
      where: { id: leave.id },
      data: { status: "CANCELLED" },
    }),
  ];
  if (balance && leave.status === "APPROVED") {
    const newUsed = Math.max(0, balance.usedDays - leave.totalDays);
    updates.push(
      prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          usedDays: newUsed,
          remainingDays: balance.totalDays + balance.carriedOver - newUsed,
        },
      }),
    );
  }
  await prisma.$transaction(updates);

  await prisma.auditLog.create({
    data: {
      userId: a.session.user.id,
      action: "APPROVE_LEAVE_CANCEL",
      entity: "LeaveCancellation",
      entityId: cancelId,
      detail: comment,
    },
  });

  // Notify: requester + employee + creator + dept manager (cc HR)
  const requester = await prisma.employee.findUnique({
    where: { id: c.requestedById }, select: { email: true },
  }).catch(() => null);
  const mgr = leave.employee.department?.managerId
    ? await prisma.employee.findUnique({ where: { id: leave.employee.department.managerId }, select: { email: true } })
    : null;
  const hrEmail = process.env.HR_ADMIN_EMAIL || "hr@ams.local";
  const recipients = [
    requester?.email,
    leave.employee.email,
    leave.creator.email,
    mgr?.email,
  ].filter(Boolean) as string[];

  await sendEmail({
    to: recipients,
    cc: hrEmail,
    subject: `[AMS] คำขอยกเลิกใบลา ${leave.requestNo} อนุมัติแล้ว`,
    html: emailTemplate(
      "HR อนุมัติคำขอยกเลิกใบลา",
      `${leaveDetailsBlock({
         requestNo: leave.requestNo,
         employeeName: `${leave.employee.firstName} ${leave.employee.lastName}`,
         employeeCode: leave.employee.employeeCode,
         leaveTypeName: leave.leaveType.name,
           leaveTypeCode: leave.leaveType.code,
          halfDayType: leave.halfDayType,
         startDate: leave.startDate,
         endDate: leave.endDate,
         totalDays: leave.totalDays,
         reason: leave.reason,
         status: "CANCELLED",
         approverName: a.session.user.username,
         comment,
         selectedDates: leave.selectedDates,
       })}
       <p style="margin-top:12px;padding:10px;background:#ecfdf5;border-left:3px solid #10b981;color:#065f46">
         ✅ ใบลาถูกยกเลิกแล้ว + คืน leave balance <b>${leave.totalDays} วัน</b> ให้พนักงานเรียบร้อย
       </p>`,
      "success",
      { label: "ดูรายละเอียดใบลา", url: `/leave/${leave.id}` },
    ),
  });

  revalidatePath("/leave");
  return { ok: true };
}

export async function rejectCancelLeave(cancelId: string, comment?: string) {
  const a = await requireHRAdminLeave();
  if ("error" in a) return { error: a.error };

  const c = await prisma.leaveCancellation.findUnique({
    where: { id: cancelId },
    include: {
      leaveRequest: { include: { employee: true, leaveType: true } },
    },
  });
  if (!c) return { error: "ไม่พบคำขอ" };
  if (c.status !== "PENDING") return { error: "คำขอนี้ถูกประมวลผลแล้ว" };

  await prisma.leaveCancellation.update({
    where: { id: cancelId },
    data: { status: "REJECTED", hrComment: comment },
  });

  await prisma.auditLog.create({
    data: {
      userId: a.session.user.id,
      action: "REJECT_LEAVE_CANCEL",
      entity: "LeaveCancellation",
      entityId: cancelId,
      detail: comment,
    },
  });

  // Notify requester
  const requester = await prisma.employee.findUnique({
    where: { id: c.requestedById }, select: { email: true },
  }).catch(() => null);
  if (requester?.email) {
    await sendEmail({
      to: requester.email,
      subject: `[AMS] คำขอยกเลิกใบลา ${c.leaveRequest.requestNo} ถูกปฏิเสธ`,
      html: emailTemplate(
        "HR ปฏิเสธคำขอยกเลิกใบลา",
        `${leaveDetailsBlock({
           requestNo: c.leaveRequest.requestNo,
           employeeName: `${c.leaveRequest.employee.firstName} ${c.leaveRequest.employee.lastName}`,
           employeeCode: c.leaveRequest.employee.employeeCode,
           leaveTypeName: c.leaveRequest.leaveType.name,
           leaveTypeCode: c.leaveRequest.leaveType.code,
           halfDayType: c.leaveRequest.halfDayType,
           startDate: c.leaveRequest.startDate,
           endDate: c.leaveRequest.endDate,
           totalDays: c.leaveRequest.totalDays,
           reason: c.leaveRequest.reason,
           status: "APPROVED",
           approverName: a.session.user.username,
           comment,
           selectedDates: c.leaveRequest.selectedDates,
         })}
         <p style="margin-top:12px;padding:10px;background:#fef2f2;border-left:3px solid #ef4444;color:#7f1d1d">
           ❌ คำขอยกเลิกถูกปฏิเสธ — ใบลายังคงสถานะ <b>อนุมัติแล้ว</b> ตามเดิม
         </p>`,
        "danger",
        { label: "ดูรายละเอียดใบลา", url: `/leave/${c.leaveRequest.id}` },
      ),
    });
  }

  revalidatePath("/leave");
  return { ok: true };
}
