"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { generateRequestNo, calculateOTHours, formatDate } from "@/lib/utils";
import { isCutOffPassed } from "@/lib/cut-off";
import { sendEmail, emailTemplate, otDetailsBlock } from "@/lib/email";

const createSchema = z.object({
  otDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  shift: z.enum(["DAY", "NIGHT"]).default("DAY"),
  workDescription: z.string().optional(),
  // OT-level default bus route (optional now — each employee can choose their own)
  busRouteId: z.string().optional(),
  // Each employee can have their own bus route + optional per-emp work description + note
  employees: z.array(z.object({
    id: z.string(),
    busRouteId: z.string().min(1, "กรุณาเลือกสายรถ"),
    workDescription: z.string().optional(),
    note: z.string().optional(),
  })).min(1, "กรุณาเลือกพนักงานอย่างน้อย 1 คน"),
});

export async function createOT(input: z.infer<typeof createSchema>) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const cutoff = await isCutOffPassed("CUTOFF_OT_CREATE");
  if (cutoff.passed) return { error: `เกินเวลาสร้าง OT (${cutoff.cutoffTime})` };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  const creator = session.user.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.user.employeeId }, include: { department: true } })
    : null;
  if (!creator) return { error: "ไม่พบผู้สร้าง" };

  // Block OT for system users (supervisor/manager/HR/admin) — they handle their own OT
  // through a different process outside this system.
  const empIds = parsed.data.employees.map((e) => e.id);
  const systemUserCount = await prisma.employee.count({
    where: { id: { in: empIds }, userId: { not: null } },
  });
  if (systemUserCount > 0) {
    return { error: "บางคนในรายชื่อเป็นผู้ใช้ระบบ (หัวหน้า/ผจก./HR/Admin) — ไม่สามารถลง OT ในระบบนี้ได้" };
  }

  const otDate = new Date(parsed.data.otDate);
  const dow = otDate.getDay(); // 0 sun, 6 sat
  const holiday = await prisma.holiday.findUnique({ where: { date: new Date(otDate.toISOString().slice(0, 10)) } }).catch(() => null);
  const isHoliday = dow === 0 || dow === 6 || !!holiday;

  // Auto-calculate hours: weekday 2.5h, holiday 11h (8+3) — but allow user override via time range
  let totalHours = calculateOTHours(parsed.data.startTime, parsed.data.endTime);
  if (totalHours <= 0) totalHours = isHoliday ? 11 : 2.5;

  const requestNo = generateRequestNo("OT");

  // OT-level "primary" bus route = the most-common one (or first) — used as display fallback
  const routeCounts = new Map<string, number>();
  for (const e of parsed.data.employees) {
    routeCounts.set(e.busRouteId, (routeCounts.get(e.busRouteId) ?? 0) + 1);
  }
  const primaryRouteId = parsed.data.busRouteId
    || [...routeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    || null;

  const ot = await prisma.oTRequest.create({
    data: {
      requestNo,
      creatorId: creator.id,
      side: creator.side,
      otDate,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      shift: parsed.data.shift,
      totalHours,
      isHoliday,
      workDescription: parsed.data.workDescription,
      busRouteId: primaryRouteId,
      status: "PENDING_DEPT_MGR",
      employees: {
        create: parsed.data.employees.map((e) => ({
          employeeId: e.id,
          busRouteId: e.busRouteId,
          workDescription: e.workDescription || null,
          note: e.note || null,
        })),
      },
    },
  });

  // Email
  const mgr = creator.department?.managerId
    ? await prisma.employee.findUnique({ where: { id: creator.department.managerId } })
    : null;
  const hrEmail = process.env.HR_ADMIN_EMAIL || "hr@example.com";
  if (mgr?.email) {
    // Fetch employee names + bus route names to pair them up in the email
    const empIds = parsed.data.employees.map((e) => e.id);
    const [empRecords, routeRecords] = await Promise.all([
      prisma.employee.findMany({
        where: { id: { in: empIds } },
        select: { id: true, employeeCode: true, firstName: true, lastName: true },
      }),
      prisma.busRoute.findMany({
        where: { id: { in: [...routeCounts.keys()] } },
        select: { id: true, name: true },
      }),
    ]);
    const empMap = new Map(empRecords.map((e) => [e.id, e]));
    const routeNameMap = new Map(routeRecords.map((r) => [r.id, r.name]));

    // Per-employee list: "ชื่อ (รหัส) — 🚌 สายรถ"
    const empLines = parsed.data.employees.map((e) => {
      const emp = empMap.get(e.id);
      const empName = emp ? `${emp.firstName} ${emp.lastName} (${emp.employeeCode})` : "?";
      const routeName = routeNameMap.get(e.busRouteId) ?? "?";
      return `<li style="margin:2px 0">${empName} — 🚌 ${routeName}</li>`;
    }).join("");

    const employeeHtml = `<b>${parsed.data.employees.length} คน</b>
      <ul style="margin:6px 0 0;padding-left:18px">${empLines}</ul>`;

    await sendEmail({
      to: mgr.email,
      cc: hrEmail,
      subject: `[AMS] OT ใหม่รออนุมัติ — ${requestNo}`,
      html: emailTemplate(
        "OT รออนุมัติ",
        `<p style="margin-top:0">มี OT ใหม่รออนุมัติของคุณ — กรุณาเข้าระบบเพื่อพิจารณา</p>
         ${otDetailsBlock({
           requestNo,
           otDate,
           startTime: parsed.data.startTime,
           endTime: parsed.data.endTime,
           totalHours,
           isHoliday,
           workDescription: parsed.data.workDescription,
           employeeSummary: employeeHtml,
           status: "PENDING_DEPT_MGR",
         })}`,
        "info",
        { label: "ดู OT ในระบบ", url: "/ot/approval" },
      ),
    });
  }

  // ── Cross-dept FYI emails ──
  // For any employee not in the creator's department, notify the manager of that dept
  // (informational only — they don't need to approve)
  const creatorDeptId = creator.departmentId;
  const empDetails = await prisma.employee.findMany({
    where: { id: { in: empIds } },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      departmentId: true,
      department: { select: { id: true, name: true, managerId: true } },
    },
  });
  const borrowedByDept = new Map<string, { deptName: string; managerId: string; empNames: string[] }>();
  for (const e of empDetails) {
    if (!e.department || e.department.id === creatorDeptId) continue;
    if (!e.department.managerId) continue;
    const key = e.department.id;
    const entry = borrowedByDept.get(key) ?? { deptName: e.department.name, managerId: e.department.managerId, empNames: [] };
    entry.empNames.push(`${e.firstName} ${e.lastName} (${e.employeeCode})`);
    borrowedByDept.set(key, entry);
  }
  if (borrowedByDept.size > 0) {
    const managerIds = Array.from(borrowedByDept.values()).map((v) => v.managerId);
    const managers = await prisma.employee.findMany({
      where: { id: { in: managerIds } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    const managerMap = new Map(managers.map((m) => [m.id, m]));
    for (const [, entry] of borrowedByDept) {
      const m = managerMap.get(entry.managerId);
      if (!m?.email) continue;
      const empList = entry.empNames.map((n) => `<li>${n}</li>`).join("");
      await sendEmail({
        to: m.email,
        subject: `[AMS] FYI: พนักงานในแผนกของคุณถูก request ทำ OT — ${requestNo}`,
        html: emailTemplate(
          "FYI: พนักงานในแผนกของคุณถูก request ทำ OT",
          `<p style="margin-top:0">เรียน <b>${m.firstName} ${m.lastName}</b></p>
           <p>หัวหน้า <b>${creator.firstName} ${creator.lastName}</b> ได้ request พนักงานในแผนก <b>${entry.deptName}</b> ของคุณไปทำ OT แล้ว — แจ้งเพื่อทราบ (ไม่ต้องอนุมัติ)</p>
           ${otDetailsBlock({
             requestNo,
             otDate,
             startTime: parsed.data.startTime,
             endTime: parsed.data.endTime,
             totalHours,
             isHoliday,
             workDescription: parsed.data.workDescription,
             employeeSummary: `<ul style="margin:6px 0 0;padding-left:18px">${empList}</ul>`,
             status: "PENDING_DEPT_MGR",
           })}`,
          "info",
          { label: "ดูรายละเอียด OT", url: `/ot/${ot.id}` },
        ),
      });
    }
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "CREATE_OT", entity: "OTRequest", entityId: ot.id, detail: requestNo },
  });

  revalidatePath("/ot");
  return { ok: true, id: ot.id, requestNo };
}

/**
 * Approve or reject an OT request — per-employee or whole-document.
 *
 * Asymmetric semantics by design (matches business intent):
 *
 *   APPROVE button — "include these specific employees"
 *     Checked   → APPROVED (or PENDING if multi-step continues)
 *     Unchecked → DELETED from this OT (not approved, just removed)
 *
 *   REJECT button — "reject these specific employees"
 *     Checked   → REJECTED (kept for audit trail)
 *     Unchecked → APPROVED (kept, OT continues for them)
 *
 * @param employeeIds Optional list of OTRequestEmployee.id (not Employee.id!) that the action applies to.
 *   - If omitted / empty / contains all pending employees → whole-document mode (acts on every pending row).
 *   - If after the operation no APPROVED / PENDING employee remains → OT becomes REJECTED.
 */
export async function approveOT(
  otId: string,
  action: "APPROVE" | "REJECT",
  comment?: string,
  employeeIds?: string[],
) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const cutoff = await isCutOffPassed("CUTOFF_OT_APPROVE");
  if (cutoff.passed && action === "APPROVE") return { error: `เกินเวลาอนุมัติ (${cutoff.cutoffTime})` };

  const ot = await prisma.oTRequest.findUnique({
    where: { id: otId },
    include: {
      creator: { include: { department: true } },
      busRoute: true,
      employees: { include: { employee: true, busRoute: true } },
    },
  });
  if (!ot) return { error: "ไม่พบ OT" };

  // Resolve per-employee selection
  const pendingEmps = ot.employees.filter((e) => e.approvalStatus === "PENDING");
  const isPerEmp = Array.isArray(employeeIds) && employeeIds.length > 0 && employeeIds.length < pendingEmps.length;
  const selectedSet = new Set(employeeIds ?? []);

  // Decide who gets APPROVED / REJECTED / DELETED at this step
  const willApprove: string[] = [];
  const willReject: string[] = [];
  const willDelete: string[] = [];
  if (isPerEmp) {
    for (const e of pendingEmps) {
      const picked = selectedSet.has(e.id);
      if (action === "APPROVE") {
        // Picked = approve, unchecked = remove from doc
        if (picked) willApprove.push(e.id);
        else        willDelete.push(e.id);
      } else {
        // REJECT: Picked = reject, unchecked = stays approved (continues)
        if (picked) willReject.push(e.id);
        else        willApprove.push(e.id);
      }
    }
  } else {
    // Whole-doc mode — acts on every pending row, never deletes
    for (const e of pendingEmps) {
      (action === "APPROVE" ? willApprove : willReject).push(e.id);
    }
  }

  const role = session.user.role;
  const isAdminOverride = role === "HR_ADMIN" || role === "SYSTEM_ADMIN";
  let step = 1;
  let nextStatus: "PENDING_FACTORY_MGR" | "APPROVED" | "REJECTED" = "APPROVED";

  // Determine which workflow step this approval represents (auth check)
  if (ot.status === "PENDING_DEPT_MGR") {
    if (role !== "DEPT_MANAGER" && !isAdminOverride) return { error: "ไม่มีสิทธิ์" };
    if (role === "DEPT_MANAGER") {
      const creatorDept = ot.creator.departmentId
        ? await prisma.department.findUnique({ where: { id: ot.creator.departmentId } })
        : null;
      const isManagerOfDept = creatorDept?.managerId && creatorDept.managerId === session.user.employeeId;
      if (!isManagerOfDept) {
        return { error: "อนุมัติได้เฉพาะเอกสารของแผนกที่คุณเป็นผู้จัดการ" };
      }
    }
    step = 1;
  } else if (ot.status === "PENDING_FACTORY_MGR") {
    if (role !== "FACTORY_MANAGER" && !isAdminOverride) return { error: "ไม่มีสิทธิ์" };
    if (role === "FACTORY_MANAGER" && ot.side !== "PRODUCTION") {
      return { error: "ผู้จัดการโรงงานอนุมัติได้เฉพาะฝ่ายผลิต" };
    }
    step = 2;
  } else return { error: "OT นี้ไม่อยู่ในสถานะที่อนุมัติได้" };

  // Decide OT-level next status based on workflow + per-emp outcome.
  // Count APPROVED/PENDING after the operation — if zero, OT is effectively cancelled.
  const previouslyApprovedOrPending = ot.employees.filter(
    (e) => e.approvalStatus === "APPROVED" || (e.approvalStatus === "PENDING" && !pendingEmps.find((p) => p.id === e.id)),
  ).length;
  const stillActiveAfter = previouslyApprovedOrPending + willApprove.length;

  if (stillActiveAfter === 0) {
    // ไม่มีคนอนุมัติ/รออนุมัติเหลือเลย → ใบ OT ถูกปฏิเสธ (โดยผู้อนุมัติ — ไม่ใช่การยกเลิกโดยผู้สร้าง)
    nextStatus = "REJECTED";
  } else if (step === 1) {
    // Step 1: Office จบ, Production ส่งต่อ Factory Mgr (HR/Admin fast-track ข้ามไป APPROVED)
    nextStatus = isAdminOverride
      ? "APPROVED"
      : (ot.side === "PRODUCTION" ? "PENDING_FACTORY_MGR" : "APPROVED");
  } else {
    // Step 2 (Factory Mgr) → final
    nextStatus = "APPROVED";
  }

  // For step 1 of Production with employees still pending Factory approval, keep them PENDING.
  // Everywhere else (Office step 1, any step 2), approved-here means final APPROVED.
  const stayPending = step === 1 && nextStatus === "PENDING_FACTORY_MGR";
  const approvedFinalStatus = stayPending ? "PENDING" : "APPROVED";

  await prisma.$transaction([
    prisma.oTApproval.create({
      data: {
        otRequestId: otId, step, approverRole: role,
        approverId: session.user.employeeId ?? null,
        action, comment,
      },
    }),
    prisma.oTRequest.update({ where: { id: otId }, data: { status: nextStatus } }),
    ...(willDelete.length > 0 ? [prisma.oTRequestEmployee.deleteMany({
      where: { id: { in: willDelete } },
    })] : []),
    ...(willApprove.length > 0 ? [prisma.oTRequestEmployee.updateMany({
      where: { id: { in: willApprove } },
      data: { approvalStatus: approvedFinalStatus },
    })] : []),
    ...(willReject.length > 0 ? [prisma.oTRequestEmployee.updateMany({
      where: { id: { in: willReject } },
      data: { approvalStatus: "REJECTED" },
    })] : []),
  ]);

  const hrEmail = process.env.HR_ADMIN_EMAIL || "hr@example.com";
  if (ot.creator.email) {
    // Title/variant driven by OT-level outcome, not just the button label —
    // because REJECT can leave the OT alive when only some employees were rejected.
    const isRejectedWhole = nextStatus === "REJECTED";
    const isFinalApproved = nextStatus === "APPROVED";
    const hasPartialReject = willReject.length > 0 && !isRejectedWhole;
    const title = isRejectedWhole
      ? "OT ถูกปฏิเสธ"
      : isFinalApproved
        ? (hasPartialReject ? `OT ได้รับอนุมัติ (ปฏิเสธ ${willReject.length} คน)` : "OT ได้รับอนุมัติ")
        : (hasPartialReject ? `OT ผ่านขั้นแรก รออนุมัติขั้นต่อไป (ปฏิเสธ ${willReject.length} คน)` : "OT ผ่านขั้นแรก รออนุมัติขั้นต่อไป");
    const variant: "success" | "info" | "danger" = isRejectedWhole
      ? "danger"
      : isFinalApproved ? "success" : "info";
    const approverName = session.user.firstName && session.user.lastName
      ? `${session.user.firstName} ${session.user.lastName}`
      : session.user.username;
    // Build per-employee list with bus route — same format as the new-OT email.
    // Exclude employees that were deleted in this transaction (user unchecked them on APPROVE).
    const deletedSet = new Set(willDelete);
    const emailEmps = ot.employees.filter((e) => !deletedSet.has(e.id));
    const empLines = emailEmps.length === 0
      ? ""
      : emailEmps.map((e) => {
          const empName = `${e.employee.firstName} ${e.employee.lastName} (${e.employee.employeeCode})`;
          const routeName = e.busRoute?.name ?? ot.busRoute?.name ?? "-";
          const notAttending = e.attended === false ? ` <span style="color:#dc2626;font-size:11px">(ไม่มาทำ OT)</span>` : "";
          // Mark REJECTED rows so the creator sees who was rejected at this step
          const isRejected = willReject.includes(e.id);
          const rejectedTag = isRejected ? ` <span style="color:#dc2626;font-size:11px">(ปฏิเสธ)</span>` : "";
          return `<li style="margin:2px 0">${empName} — 🚌 ${routeName}${rejectedTag}${notAttending}</li>`;
        }).join("");
    const empSummary = emailEmps.length === 0
      ? "-"
      : `<b>${emailEmps.length} คน</b>
         <ul style="margin:6px 0 0;padding-left:18px">${empLines}</ul>`;

    const subjectStatus = isRejectedWhole
      ? "ถูกปฏิเสธ"
      : isFinalApproved
        ? (hasPartialReject ? `อนุมัติแล้ว (ปฏิเสธ ${willReject.length} คน)` : "อนุมัติแล้ว")
        : (hasPartialReject ? `ผ่านขั้นแรก (ปฏิเสธ ${willReject.length} คน)` : "ผ่านขั้นแรก");

    await sendEmail({
      to: ot.creator.email,
      cc: hrEmail,
      subject: `[AMS] OT ${ot.requestNo} ${subjectStatus}`,
      html: emailTemplate(
        title,
        otDetailsBlock({
          requestNo: ot.requestNo,
          otDate: ot.otDate,
          startTime: ot.startTime,
          endTime: ot.endTime,
          totalHours: ot.totalHours,
          isHoliday: ot.isHoliday,
          workDescription: ot.workDescription,
          employeeSummary: empSummary,
          status: nextStatus,
          approverName,
          comment,
        }),
        variant,
        nextStatus === "PENDING_FACTORY_MGR"
          ? { label: "ดู OT ที่รออนุมัติ", url: "/ot/approval" }
          : { label: "ดูรายละเอียด OT", url: `/ot/${ot.id}` },
      ),
    });
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: action === "APPROVE" ? "APPROVE_OT" : "REJECT_OT", entity: "OTRequest", entityId: otId, detail: comment },
  });

  revalidatePath("/ot");
  return { ok: true };
}

function canMutateOT(session: any, ot: { creatorId: string; status: string }): { ok: true } | { error: string } {
  const role = session.user.role;
  const isAdmin = role === "HR_ADMIN" || role === "SYSTEM_ADMIN";
  const isOwner = session.user.employeeId === ot.creatorId;
  if (!isAdmin && !isOwner) return { error: "ไม่มีสิทธิ์แก้ไข/ลบ OT นี้ (เฉพาะผู้สร้างหรือ Admin)" };
  return { ok: true };
}

export async function cancelOT(otId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const ot = await prisma.oTRequest.findUnique({
    where: { id: otId },
    include: {
      creator: { include: { department: true } },
      busRoute: true,
      employees: { include: { employee: true, busRoute: true } },
    },
  });
  if (!ot) return { error: "ไม่พบ OT" };
  if (ot.status === "CANCELLED") return { error: "OT นี้ถูกยกเลิกอยู่แล้ว" };
  if (ot.status === "REJECTED") return { error: "OT นี้ถูกปฏิเสธแล้ว" };

  // Policy: ยกเลิกได้เฉพาะก่อน manager approve เท่านั้น
  // หลัง APPROVED แล้ว ต้องใช้ flow "ขอยกเลิก OT" (cancel-request) ที่ HR review
  const isAdmin = session.user.role === "HR_ADMIN" || session.user.role === "SYSTEM_ADMIN";
  const cancellableByOwner = ["DRAFT", "PENDING_DEPT_MGR", "PENDING_FACTORY_MGR"];
  if (!cancellableByOwner.includes(ot.status) && !isAdmin) {
    return {
      error: `OT นี้ ${ot.status === "APPROVED" ? "อนุมัติแล้ว" : "ผ่านขั้นตอนนี้แล้ว"} — กรุณาใช้เมนู "ขอยกเลิก OT" เพื่อส่งคำขอให้ HR อนุมัติแทน`,
    };
  }

  const auth_ = canMutateOT(session, ot);
  if ("error" in auth_) return auth_;

  await prisma.oTRequest.update({ where: { id: otId }, data: { status: "CANCELLED" } });
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: "CANCEL_OT", entity: "OTRequest", entityId: otId },
  });

  // Notify: creator + dept manager + all assigned employees + HR
  const mgr = ot.creator.department?.managerId
    ? await prisma.employee.findUnique({ where: { id: ot.creator.department.managerId } })
    : null;
  const hrEmail = process.env.HR_ADMIN_EMAIL || "hr@ams.local";
  const recipients = [
    ot.creator.email,
    mgr?.email,
    ...ot.employees.map((e) => e.employee.email),
  ].filter(Boolean) as string[];
  // Per-employee list with bus route
  const cancelEmpLines = ot.employees.map((e) => {
    const empName = `${e.employee.firstName} ${e.employee.lastName} (${e.employee.employeeCode})`;
    const routeName = e.busRoute?.name ?? ot.busRoute?.name ?? "-";
    return `<li style="margin:2px 0">${empName} — 🚌 ${routeName}</li>`;
  }).join("");
  const cancelEmpSummary = `<b>${ot.employees.length} คน</b>
    <ul style="margin:6px 0 0;padding-left:18px">${cancelEmpLines}</ul>`;

  await sendEmail({
    to: recipients,
    cc: hrEmail,
    subject: `[AMS] OT ${ot.requestNo} ถูกยกเลิก`,
    html: emailTemplate(
      "OT ถูกยกเลิก",
      otDetailsBlock({
        requestNo: ot.requestNo,
        otDate: ot.otDate,
        startTime: ot.startTime,
        endTime: ot.endTime,
        totalHours: ot.totalHours,
        isHoliday: ot.isHoliday,
        workDescription: ot.workDescription,
        employeeSummary: cancelEmpSummary,
        status: "CANCELLED",
        approverName: session.user.username,
      }),
      "danger",
      { label: "ดูรายละเอียด OT", url: `/ot/${ot.id}` },
    ),
  });

  revalidatePath("/ot");
  return { ok: true };
}

const updateOTSchema = z.object({
  id: z.string(),
  otDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  workDescription: z.string().optional(),
  // Each employee in this list = final desired state.
  //   - otEmployeeId present  → existing row (update busRoute if changed)
  //   - otEmployeeId absent   → new row (add)
  //   - existing rows NOT in this list → delete
  employees: z.array(z.object({
    otEmployeeId: z.string().optional(),
    employeeId: z.string().min(1),
    busRouteId: z.string().min(1, "กรุณาเลือกสายรถ"),
    workDescription: z.string().optional(),
    note: z.string().optional(),
  })).min(1, "ต้องมีพนักงานอย่างน้อย 1 คน"),
});

export async function updateOT(input: z.infer<typeof updateOTSchema>) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const parsed = updateOTSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const ot = await prisma.oTRequest.findUnique({
    where: { id: parsed.data.id },
    include: { employees: { select: { id: true, employeeId: true, busRouteId: true } } },
  });
  if (!ot) return { error: "ไม่พบ OT" };

  if (!["DRAFT", "PENDING_DEPT_MGR", "PENDING_FACTORY_MGR"].includes(ot.status))
    return { error: "OT ที่อนุมัติ/ยกเลิกแล้วไม่สามารถแก้ไขได้" };

  const auth_ = canMutateOT(session, ot);
  if ("error" in auth_) return auth_;

  // ── Scope check for ADDED employees ──
  // Cross-dept request: SUPERVISOR/DEPT_MANAGER can pick from any active employee
  // (excluding system users). HR/Admin = unrestricted.
  const employeeOnlyFilter = { user: null as null };
  const role = session.user.role;
  const me = session.user.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.user.employeeId }, select: { id: true } })
    : null;
  let allowedEmployeeIds: Set<string> | null = null; // null = unrestricted (HR/Sys)
  if (role === "HR_ADMIN" || role === "SYSTEM_ADMIN") {
    const emps = await prisma.employee.findMany({ where: { isActive: true, ...employeeOnlyFilter }, select: { id: true } });
    allowedEmployeeIds = new Set(emps.map((e) => e.id));
  } else if ((role === "DEPT_MANAGER" || role === "SUPERVISOR") && me) {
    // Cross-dept allowed — pool is all active non-system employees
    const emps = await prisma.employee.findMany({ where: { isActive: true, ...employeeOnlyFilter }, select: { id: true } });
    allowedEmployeeIds = new Set(emps.map((e) => e.id));
  } else {
    return { error: "ไม่มีสิทธิ์แก้ไข OT" };
  }

  // ── Diff: keep / add / remove ──
  const existingById = new Map(ot.employees.map((e) => [e.id, e]));
  const keepIds = new Set<string>();
  const toAdd: { employeeId: string; busRouteId: string; workDescription: string | null; note: string | null }[] = [];
  const toUpdate: { id: string; busRouteId: string; workDescription: string | null; note: string | null }[] = [];

  for (const e of parsed.data.employees) {
    if (e.otEmployeeId) {
      const row = existingById.get(e.otEmployeeId);
      if (!row) return { error: "พนักงานบางคนไม่อยู่ใน OT นี้" };
      keepIds.add(e.otEmployeeId);
      // Always update — change detection happens via prisma diff
      toUpdate.push({
        id: e.otEmployeeId,
        busRouteId: e.busRouteId,
        workDescription: e.workDescription || null,
        note: e.note || null,
      });
    } else {
      // New employee — scope guard
      if (allowedEmployeeIds && !allowedEmployeeIds.has(e.employeeId)) {
        return { error: "ไม่มีสิทธิ์เพิ่มพนักงานคนนี้เข้า OT" };
      }
      toAdd.push({
        employeeId: e.employeeId,
        busRouteId: e.busRouteId,
        workDescription: e.workDescription || null,
        note: e.note || null,
      });
    }
  }
  // Prevent duplicate employee entries
  const allEmpIds = parsed.data.employees.map((e) => e.employeeId);
  if (new Set(allEmpIds).size !== allEmpIds.length) {
    return { error: "มีพนักงานซ้ำกัน" };
  }
  // Prevent adding an employee that already exists in this OT (by employeeId)
  const existingEmpIds = new Set(ot.employees.map((e) => e.employeeId));
  for (const a of toAdd) {
    if (existingEmpIds.has(a.employeeId)) {
      return { error: "พนักงานบางคนอยู่ใน OT นี้อยู่แล้ว" };
    }
  }
  const toRemove = ot.employees.filter((e) => !keepIds.has(e.id)).map((e) => e.id);

  const otDate = new Date(parsed.data.otDate);
  const dow = otDate.getDay();
  const holiday = await prisma.holiday.findUnique({ where: { date: new Date(otDate.toISOString().slice(0, 10)) } }).catch(() => null);
  const isHoliday = dow === 0 || dow === 6 || !!holiday;

  let totalHours = calculateOTHours(parsed.data.startTime, parsed.data.endTime);
  if (totalHours <= 0) totalHours = isHoliday ? 11 : 2.5;

  // Compute primary route from final assignments (for display fallback)
  const routeCounts = new Map<string, number>();
  for (const e of parsed.data.employees) {
    routeCounts.set(e.busRouteId, (routeCounts.get(e.busRouteId) ?? 0) + 1);
  }
  const primaryRouteId = [...routeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  await prisma.$transaction([
    prisma.oTRequest.update({
      where: { id: parsed.data.id },
      data: {
        otDate,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        totalHours,
        isHoliday,
        workDescription: parsed.data.workDescription,
        busRouteId: primaryRouteId,
      },
    }),
    // Update existing rows that changed
    ...toUpdate.map((r) =>
      prisma.oTRequestEmployee.update({
        where: { id: r.id },
        data: {
          busRouteId: r.busRouteId,
          workDescription: r.workDescription,
          note: r.note,
        },
      }),
    ),
    // Add new employees
    ...toAdd.map((a) =>
      prisma.oTRequestEmployee.create({
        data: {
          otRequestId: parsed.data.id,
          employeeId: a.employeeId,
          busRouteId: a.busRouteId,
          workDescription: a.workDescription,
          note: a.note,
        },
      }),
    ),
    // Remove employees no longer in list
    ...(toRemove.length > 0
      ? [prisma.oTRequestEmployee.deleteMany({ where: { id: { in: toRemove } } })]
      : []),
  ]);

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_OT",
      entity: "OTRequest",
      entityId: parsed.data.id,
      detail: JSON.stringify({
        added: toAdd.length,
        removed: toRemove.length,
        updated: toUpdate.length,
      }),
    },
  });

  // Notify dept manager — OT changed
  const updated = await prisma.oTRequest.findUnique({
    where: { id: parsed.data.id },
    include: {
      creator: { include: { department: true } },
      busRoute: true,
      employees: { include: { employee: true, busRoute: true } },
    },
  });
  if (updated) {
    const mgr = updated.creator.department?.managerId
      ? await prisma.employee.findUnique({ where: { id: updated.creator.department.managerId } })
      : null;
    const hrEmail = process.env.HR_ADMIN_EMAIL || "hr@ams.local";
    if (mgr?.email) {
      const changes: string[] = [];
      if (toAdd.length > 0) changes.push(`+${toAdd.length} คน`);
      if (toRemove.length > 0) changes.push(`-${toRemove.length} คน`);
      if (toUpdate.length > 0) changes.push(`แก้สายรถ ${toUpdate.length} คน`);
      const changesText = changes.length > 0 ? ` (${changes.join(", ")})` : "";

      // Per-employee list with bus route — current state after edit
      const updateEmpLines = updated.employees.map((e) => {
        const empName = `${e.employee.firstName} ${e.employee.lastName} (${e.employee.employeeCode})`;
        const routeName = e.busRoute?.name ?? updated.busRoute?.name ?? "-";
        return `<li style="margin:2px 0">${empName} — 🚌 ${routeName}</li>`;
      }).join("");
      const updateEmpSummary = `<b>${updated.employees.length} คน</b>${changesText ? ` <span style="color:#d97706;font-size:12px">${changesText}</span>` : ""}
        <ul style="margin:6px 0 0;padding-left:18px">${updateEmpLines}</ul>`;

      await sendEmail({
        to: mgr.email,
        cc: hrEmail,
        subject: `[AMS] OT ${updated.requestNo} ถูกแก้ไข`,
        html: emailTemplate(
          "OT ถูกแก้ไข — กรุณาตรวจสอบ",
          `<p style="margin-top:0;color:#d97706"><b>⚠️ OT นี้ถูกแก้ไข — กรุณาตรวจสอบและอนุมัติใหม่</b></p>
           ${otDetailsBlock({
             requestNo: updated.requestNo,
             otDate,
             startTime: parsed.data.startTime,
             endTime: parsed.data.endTime,
             totalHours,
             isHoliday,
             workDescription: parsed.data.workDescription,
             employeeSummary: updateEmpSummary,
             status: updated.status,
             approverName: session.user.username,
           })}`,
          "warning",
          { label: "ตรวจสอบ OT", url: "/ot/approval" },
        ),
      });
    }
  }

  revalidatePath("/ot");
  return { ok: true };
}

const cancelReqSchema = z.object({ otRequestId: z.string(), employeeId: z.string(), reason: z.string().min(3) });
export async function requestCancelOT(input: z.infer<typeof cancelReqSchema>) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  const parsed = cancelReqSchema.safeParse(input);
  if (!parsed.success) return { error: "ข้อมูลไม่ถูกต้อง" };

  // Scope guard: must match user's side / be the creator (unless HR/Sys admin)
  const role = session.user.role;
  const isAdmin = role === "HR_ADMIN" || role === "SYSTEM_ADMIN";
  if (!isAdmin) {
    const ot = await prisma.oTRequest.findUnique({ where: { id: parsed.data.otRequestId } });
    if (!ot) return { error: "ไม่พบรายการ OT" };
    if (role === "SUPERVISOR" && ot.creatorId !== session.user.employeeId) {
      return { error: "ขอยกเลิกได้เฉพาะ OT ที่ตัวเองสร้างเท่านั้น" };
    }
    if ((role === "DEPT_MANAGER" || role === "FACTORY_MANAGER") && session.user.side && ot.side !== session.user.side) {
      return { error: "ขอยกเลิกได้เฉพาะ OT ของฝ่ายตัวเอง" };
    }
  }

  // Duplicate check: same employee + same OT can't have another PENDING/APPROVED cancel
  const dup = await prisma.oTCancellation.findFirst({
    where: {
      otRequestId: parsed.data.otRequestId,
      employeeId: parsed.data.employeeId,
      status: { in: ["PENDING", "APPROVED"] },
    },
    include: { otRequest: { select: { requestNo: true } } },
  });
  if (dup) {
    const label = dup.status === "APPROVED" ? "ยกเลิกไปแล้ว" : "มีคำขอรอ HR อนุมัติอยู่แล้ว";
    return { error: `พนักงานคนนี้ใน OT ${dup.otRequest.requestNo} ${label}` };
  }

  // Also check: was the employee already marked as not attending?
  const empLink = await prisma.oTRequestEmployee.findUnique({
    where: { otRequestId_employeeId: { otRequestId: parsed.data.otRequestId, employeeId: parsed.data.employeeId } },
  });
  if (empLink && empLink.attended === false) {
    return { error: "พนักงานคนนี้ถูก mark ว่าไม่ทำ OT นี้แล้ว" };
  }

  await prisma.oTCancellation.create({
    data: {
      otRequestId: parsed.data.otRequestId,
      employeeId: parsed.data.employeeId,
      requestedById: session.user.employeeId ?? "",
      reason: parsed.data.reason,
    },
  });

  // Notify HR — cancel request submitted
  const otFull = await prisma.oTRequest.findUnique({
    where: { id: parsed.data.otRequestId },
    select: { requestNo: true, otDate: true },
  });
  const emp = await prisma.employee.findUnique({
    where: { id: parsed.data.employeeId },
    select: { firstName: true, lastName: true, employeeCode: true },
  });
  const hrEmail = process.env.HR_ADMIN_EMAIL || "hr@ams.local";
  await sendEmail({
    to: hrEmail,
    subject: `[AMS] คำขอยกเลิก OT ${otFull?.requestNo} — รอ HR อนุมัติ`,
    html: emailTemplate(
      "คำขอยกเลิก OT พนักงาน — รอ HR อนุมัติ",
      `<p style="margin-top:0">มีคำขอยกเลิก OT ใหม่ส่งถึง HR Admin — กรุณาเข้าระบบเพื่อพิจารณา</p>
       <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">
         <tr><td style="padding:4px 0;color:#6b7280;width:110px">OT เลขที่:</td><td style="padding:4px 0;font-family:'Courier New',monospace"><b>${otFull?.requestNo}</b></td></tr>
         <tr><td style="padding:4px 0;color:#6b7280">วันที่:</td><td style="padding:4px 0">${otFull ? formatDate(otFull.otDate) : "-"}</td></tr>
         <tr><td style="padding:4px 0;color:#6b7280">พนักงาน:</td><td style="padding:4px 0"><b>${emp?.firstName} ${emp?.lastName}</b> (${emp?.employeeCode})</td></tr>
         <tr><td style="padding:4px 0;color:#6b7280;vertical-align:top">เหตุผล:</td><td style="padding:4px 0;font-style:italic">"${parsed.data.reason}"</td></tr>
         <tr><td style="padding:4px 0;color:#6b7280">ส่งโดย:</td><td style="padding:4px 0">${session.user.username}</td></tr>
       </table>`,
      "warning",
      { label: "พิจารณาคำขอ", url: "/ot/cancel-request" },
    ),
  });

  revalidatePath("/ot");
  return { ok: true };
}

const cancelBatchSchema = z.object({
  otRequestId: z.string(),
  employeeIds: z.array(z.string()).min(1, "เลือกพนักงานอย่างน้อย 1 คน"),
  reason: z.string().min(3),
});
export async function requestCancelOTBatch(input: z.infer<typeof cancelBatchSchema>) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };
  const parsed = cancelBatchSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const role = session.user.role;
  const isAdmin = role === "HR_ADMIN" || role === "SYSTEM_ADMIN";
  const ot = await prisma.oTRequest.findUnique({ where: { id: parsed.data.otRequestId } });
  if (!ot) return { error: "ไม่พบรายการ OT" };

  if (!isAdmin) {
    if (role === "SUPERVISOR" && ot.creatorId !== session.user.employeeId) {
      return { error: "ขอยกเลิกได้เฉพาะ OT ที่ตัวเองสร้างเท่านั้น" };
    }
    if ((role === "DEPT_MANAGER" || role === "FACTORY_MANAGER") && session.user.side && ot.side !== session.user.side) {
      return { error: "ขอยกเลิกได้เฉพาะ OT ของฝ่ายตัวเอง" };
    }
  }

  const existingCancels = await prisma.oTCancellation.findMany({
    where: {
      otRequestId: parsed.data.otRequestId,
      employeeId: { in: parsed.data.employeeIds },
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: { employeeId: true },
  });
  const blockedIds = new Set(existingCancels.map((c) => c.employeeId));

  const notAttending = await prisma.oTRequestEmployee.findMany({
    where: {
      otRequestId: parsed.data.otRequestId,
      employeeId: { in: parsed.data.employeeIds },
      attended: false,
    },
    select: { employeeId: true },
  });
  const notAttendingIds = new Set(notAttending.map((e) => e.employeeId));

  const validIds = parsed.data.employeeIds.filter((id) => !blockedIds.has(id) && !notAttendingIds.has(id));
  if (validIds.length === 0) {
    return { error: "พนักงานทุกคนที่เลือกมีคำขอยกเลิกอยู่แล้ว หรือถูก mark ว่าไม่ทำ OT แล้ว" };
  }

  await prisma.oTCancellation.createMany({
    data: validIds.map((empId) => ({
      otRequestId: parsed.data.otRequestId,
      employeeId: empId,
      requestedById: session.user!.employeeId ?? "",
      reason: parsed.data.reason,
    })),
  });

  // Notify HR — bulk cancel requests submitted
  const hrEmail = process.env.HR_ADMIN_EMAIL || "hr@ams.local";
  await sendEmail({
    to: hrEmail,
    subject: `[AMS] คำขอยกเลิก OT ${ot.requestNo} — ${validIds.length} คน รอ HR อนุมัติ`,
    html: emailTemplate(
      "คำขอยกเลิก OT (ชุด) — รอ HR อนุมัติ",
      `<p style="margin-top:0">มีคำขอยกเลิก OT แบบชุด ${validIds.length} รายการ ส่งถึง HR Admin — กรุณาเข้าระบบเพื่อพิจารณา</p>
       <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">
         <tr><td style="padding:4px 0;color:#6b7280;width:140px">OT เลขที่:</td><td style="padding:4px 0;font-family:'Courier New',monospace"><b>${ot.requestNo}</b></td></tr>
         <tr><td style="padding:4px 0;color:#6b7280">วันที่:</td><td style="padding:4px 0">${formatDate(ot.otDate)}</td></tr>
         <tr><td style="padding:4px 0;color:#6b7280">จำนวนที่ขอยกเลิก:</td><td style="padding:4px 0"><b>${validIds.length}</b> คน</td></tr>
         <tr><td style="padding:4px 0;color:#6b7280;vertical-align:top">เหตุผล:</td><td style="padding:4px 0;font-style:italic">"${parsed.data.reason}"</td></tr>
         <tr><td style="padding:4px 0;color:#6b7280">ส่งโดย:</td><td style="padding:4px 0">${session.user.username}</td></tr>
       </table>`,
      "warning",
      { label: "พิจารณาคำขอ", url: "/ot/cancel-request" },
    ),
  });

  const skipped = parsed.data.employeeIds.length - validIds.length;
  revalidatePath("/ot");
  return { ok: true, created: validIds.length, skipped };
}

async function requireHRAdmin() {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" as const };
  const role = session.user.role;
  if (role !== "HR_ADMIN" && role !== "SYSTEM_ADMIN")
    return { error: "เฉพาะ HR Admin เท่านั้น" as const };
  return { session };
}

export async function approveCancelOT(cancelId: string, comment?: string) {
  const a = await requireHRAdmin();
  if ("error" in a) return { error: a.error };

  const c = await prisma.oTCancellation.findUnique({ where: { id: cancelId } });
  if (!c) return { error: "ไม่พบคำขอ" };
  if (c.status !== "PENDING") return { error: "คำขอนี้ถูกประมวลผลแล้ว" };

  await prisma.$transaction([
    prisma.oTCancellation.update({
      where: { id: cancelId },
      data: { status: "APPROVED", hrComment: comment },
    }),
    // Mark the employee as not attending this OT
    prisma.oTRequestEmployee.updateMany({
      where: { otRequestId: c.otRequestId, employeeId: c.employeeId },
      data: { attended: false, actualHours: 0, note: `ยกเลิกโดย HR: ${comment ?? "อนุมัติคำขอยกเลิก"}` },
    }),
  ]);

  // ── After cancel: if ALL employees are now not-attending,
  //    the OT itself becomes a "cancelled" document.
  const remaining = await prisma.oTRequestEmployee.count({
    where: { otRequestId: c.otRequestId, attended: { not: false } },
  });
  if (remaining === 0) {
    await prisma.oTRequest.update({
      where: { id: c.otRequestId },
      data: { status: "CANCELLED" },
    });
  }

  await prisma.auditLog.create({
    data: { userId: a.session.user.id, action: "APPROVE_OT_CANCEL", entity: "OTCancellation", entityId: cancelId, detail: comment },
  });

  // Notify: requester (supervisor) + employee that was cancelled
  const cInfo = await prisma.oTCancellation.findUnique({
    where: { id: cancelId },
    include: {
      otRequest: { select: { id: true, requestNo: true, otDate: true } },
    },
  });
  if (cInfo) {
    const [requester, emp] = await Promise.all([
      prisma.employee.findUnique({ where: { id: cInfo.requestedById }, select: { email: true } }).catch(() => null),
      prisma.employee.findUnique({ where: { id: cInfo.employeeId }, select: { email: true, firstName: true, lastName: true } }),
    ]);
    await sendEmail({
      to: [requester?.email, emp?.email].filter(Boolean) as string[],
      subject: `[AMS] คำขอยกเลิก OT ${cInfo.otRequest.requestNo} ได้รับการอนุมัติ`,
      html: emailTemplate("HR อนุมัติคำขอยกเลิก OT",
        `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 0;color:#6b7280;width:110px">OT เลขที่:</td><td style="padding:4px 0;font-family:'Courier New',monospace"><b>${cInfo.otRequest.requestNo}</b></td></tr>
          <tr><td style="padding:4px 0;color:#6b7280">วันที่:</td><td style="padding:4px 0">${formatDate(cInfo.otRequest.otDate)}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280">พนักงาน:</td><td style="padding:4px 0"><b>${emp?.firstName} ${emp?.lastName}</b></td></tr>
          ${comment ? `<tr><td style="padding:4px 0;color:#6b7280;vertical-align:top">หมายเหตุ HR:</td><td style="padding:4px 0;font-style:italic">"${comment}"</td></tr>` : ""}
         </table>
         <p style="margin-top:12px;padding:10px;background:#ecfdf5;border-left:3px solid #10b981;color:#065f46">✅ อนุมัติยกเลิก — ตัดชื่อพนักงานออกจาก OT แล้ว (ชั่วโมงจริง = 0)</p>`,
        "success",
        { label: "ดูรายละเอียด OT", url: `/ot/${cInfo.otRequest.id}` }),
    });
  }

  revalidatePath("/ot");
  return { ok: true };
}

/**
 * Approve multiple cancel-OT requests in one go.
 * - Processes each PENDING row sequentially within a transaction
 * - After processing, checks each affected OT and auto-cancels if all employees are now removed
 * - Sends ONE summary email per requester (de-duplicated)
 */
export async function approveCancelOTBatch(cancelIds: string[], comment?: string) {
  const a = await requireHRAdmin();
  if ("error" in a) return { error: a.error };
  if (cancelIds.length === 0) return { error: "ไม่มีรายการที่เลือก" };

  // Fetch all + filter to PENDING
  const rows = await prisma.oTCancellation.findMany({
    where: { id: { in: cancelIds }, status: "PENDING" },
    include: { otRequest: { select: { id: true, requestNo: true, otDate: true } } },
  });
  if (rows.length === 0) return { error: "ไม่มีรายการที่รอ HR — อาจถูกประมวลผลแล้ว" };

  // Update all in one transaction
  await prisma.$transaction([
    // Mark all cancellations as APPROVED
    prisma.oTCancellation.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { status: "APPROVED", hrComment: comment },
    }),
    // Mark each employee as not attending — one updateMany per row (different employeeId/otRequestId)
    ...rows.map((r) =>
      prisma.oTRequestEmployee.updateMany({
        where: { otRequestId: r.otRequestId, employeeId: r.employeeId },
        data: { attended: false, actualHours: 0, note: `ยกเลิกโดย HR: ${comment ?? "อนุมัติคำขอยกเลิก (batch)"}` },
      }),
    ),
  ]);

  // After bulk: for each affected OT, check if all employees are now not-attending
  const uniqueOtIds = Array.from(new Set(rows.map((r) => r.otRequestId)));
  const fullyCancelled: string[] = [];
  for (const otId of uniqueOtIds) {
    const remaining = await prisma.oTRequestEmployee.count({
      where: { otRequestId: otId, attended: { not: false } },
    });
    if (remaining === 0) {
      await prisma.oTRequest.update({ where: { id: otId }, data: { status: "CANCELLED" } });
      fullyCancelled.push(otId);
    }
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: a.session.user.id,
      action: "APPROVE_OT_CANCEL_BATCH",
      entity: "OTCancellation",
      entityId: rows.map((r) => r.id).join(","),
      detail: JSON.stringify({ count: rows.length, fullyCancelledOts: fullyCancelled.length, comment }),
    },
  });

  // Lookup all employees + requesters for email notification
  const empIds = Array.from(new Set(rows.flatMap((r) => [r.employeeId, r.requestedById])));
  const empMap = new Map(
    (await prisma.employee.findMany({
      where: { id: { in: empIds } },
      select: { id: true, email: true, firstName: true, lastName: true },
    })).map((e) => [e.id, e]),
  );

  // One email per requester (group their approved cancels together)
  const groupedByRequester = new Map<string, typeof rows>();
  for (const r of rows) {
    const cur = groupedByRequester.get(r.requestedById) ?? [];
    cur.push(r);
    groupedByRequester.set(r.requestedById, cur);
  }

  for (const [requesterId, items] of groupedByRequester) {
    const requester = empMap.get(requesterId);
    if (!requester?.email) continue;
    const lines = items.map((r) => {
      const emp = empMap.get(r.employeeId);
      return `<li><b>${r.otRequest.requestNo}</b> (${formatDate(r.otRequest.otDate)}) — ${emp?.firstName ?? "-"} ${emp?.lastName ?? ""}</li>`;
    }).join("");
    await sendEmail({
      to: requester.email,
      subject: `[AMS] คำขอยกเลิก OT ${items.length} รายการได้รับการอนุมัติ`,
      html: emailTemplate("HR อนุมัติคำขอยกเลิก OT (ชุด)",
        `<p>HR อนุมัติคำขอยกเลิก OT ของคุณ ${items.length} รายการ:</p>
         <ul>${lines}</ul>
         ${comment ? `<p><b>หมายเหตุ HR:</b> ${comment}</p>` : ""}
         ${fullyCancelled.length > 0 ? `<p style="color:#dc2626"><b>หมายเหตุ:</b> มี OT ${fullyCancelled.length} ใบที่ถูกตั้งเป็น "ยกเลิก" เพราะพนักงานออกหมด</p>` : ""}`,
        "success",
        { label: "ดูรายการ OT", url: "/ot/list" }),
    });
  }

  revalidatePath("/ot");
  return { ok: true, approved: rows.length, fullyCancelled: fullyCancelled.length };
}

/**
 * Reject multiple cancel-OT requests in one go.
 * - Marks each PENDING row as REJECTED with the same comment
 * - Sends one summary email per requester
 */
export async function rejectCancelOTBatch(cancelIds: string[], comment?: string) {
  const a = await requireHRAdmin();
  if ("error" in a) return { error: a.error };
  if (cancelIds.length === 0) return { error: "ไม่มีรายการที่เลือก" };

  const rows = await prisma.oTCancellation.findMany({
    where: { id: { in: cancelIds }, status: "PENDING" },
    include: { otRequest: { select: { requestNo: true, otDate: true } } },
  });
  if (rows.length === 0) return { error: "ไม่มีรายการที่รอ HR — อาจถูกประมวลผลแล้ว" };

  await prisma.oTCancellation.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { status: "REJECTED", hrComment: comment },
  });

  await prisma.auditLog.create({
    data: {
      userId: a.session.user.id,
      action: "REJECT_OT_CANCEL_BATCH",
      entity: "OTCancellation",
      entityId: rows.map((r) => r.id).join(","),
      detail: JSON.stringify({ count: rows.length, comment }),
    },
  });

  // Notify requesters (grouped)
  const empIds = Array.from(new Set(rows.flatMap((r) => [r.employeeId, r.requestedById])));
  const empMap = new Map(
    (await prisma.employee.findMany({
      where: { id: { in: empIds } },
      select: { id: true, email: true, firstName: true, lastName: true },
    })).map((e) => [e.id, e]),
  );

  const groupedByRequester = new Map<string, typeof rows>();
  for (const r of rows) {
    const cur = groupedByRequester.get(r.requestedById) ?? [];
    cur.push(r);
    groupedByRequester.set(r.requestedById, cur);
  }

  for (const [requesterId, items] of groupedByRequester) {
    const requester = empMap.get(requesterId);
    if (!requester?.email) continue;
    const lines = items.map((r) => {
      const emp = empMap.get(r.employeeId);
      return `<li><b>${r.otRequest.requestNo}</b> (${formatDate(r.otRequest.otDate)}) — ${emp?.firstName ?? "-"} ${emp?.lastName ?? ""}</li>`;
    }).join("");
    await sendEmail({
      to: requester.email,
      subject: `[AMS] คำขอยกเลิก OT ${items.length} รายการถูกปฏิเสธ`,
      html: emailTemplate("HR ปฏิเสธคำขอยกเลิก OT (ชุด)",
        `<p>HR ปฏิเสธคำขอยกเลิก OT ${items.length} รายการ:</p>
         <ul>${lines}</ul>
         ${comment ? `<p><b>เหตุผล HR:</b> ${comment}</p>` : ""}
         <p>พนักงานยังคงอยู่ใน OT ทุกรายการ</p>`,
        "danger",
        { label: "ดูรายการ OT", url: "/ot/list" }),
    });
  }

  revalidatePath("/ot");
  return { ok: true, rejected: rows.length };
}

export async function rejectCancelOT(cancelId: string, comment?: string) {
  const a = await requireHRAdmin();
  if ("error" in a) return { error: a.error };

  const c = await prisma.oTCancellation.findUnique({
    where: { id: cancelId },
    include: { otRequest: { select: { id: true, requestNo: true, otDate: true } } },
  });
  if (!c) return { error: "ไม่พบคำขอ" };
  if (c.status !== "PENDING") return { error: "คำขอนี้ถูกประมวลผลแล้ว" };

  await prisma.oTCancellation.update({
    where: { id: cancelId },
    data: { status: "REJECTED", hrComment: comment },
  });

  await prisma.auditLog.create({
    data: { userId: a.session.user.id, action: "REJECT_OT_CANCEL", entity: "OTCancellation", entityId: cancelId, detail: comment },
  });

  // Notify requester (supervisor)
  const requester = await prisma.employee.findUnique({
    where: { id: c.requestedById },
    select: { email: true },
  }).catch(() => null);
  const emp = await prisma.employee.findUnique({
    where: { id: c.employeeId }, select: { firstName: true, lastName: true },
  });
  if (requester?.email) {
    await sendEmail({
      to: requester.email,
      subject: `[AMS] คำขอยกเลิก OT ${c.otRequest.requestNo} ถูกปฏิเสธ`,
      html: emailTemplate("HR ปฏิเสธคำขอยกเลิก OT",
        `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 0;color:#6b7280;width:110px">OT เลขที่:</td><td style="padding:4px 0;font-family:'Courier New',monospace"><b>${c.otRequest.requestNo}</b></td></tr>
          <tr><td style="padding:4px 0;color:#6b7280">วันที่:</td><td style="padding:4px 0">${formatDate(c.otRequest.otDate)}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280">พนักงาน:</td><td style="padding:4px 0"><b>${emp?.firstName} ${emp?.lastName}</b></td></tr>
          ${comment ? `<tr><td style="padding:4px 0;color:#6b7280;vertical-align:top">เหตุผล HR:</td><td style="padding:4px 0;font-style:italic">"${comment}"</td></tr>` : ""}
         </table>
         <p style="margin-top:12px;padding:10px;background:#fef2f2;border-left:3px solid #ef4444;color:#7f1d1d">❌ คำขอถูกปฏิเสธ — พนักงานยังคงอยู่ใน OT ตามเดิม</p>`,
        "danger",
        { label: "ดูรายละเอียด OT", url: `/ot/${c.otRequest.id}` }),
    });
  }

  revalidatePath("/ot");
  return { ok: true };
}
