import { prisma } from "./db";
import type { Session } from "next-auth";

export type PendingCounts = {
  leaveApproval: number;
  leaveCancelRequest: number;
  otApproval: number;
  otCancelRequest: number;
  total: number;
};

/**
 * Compute pending approval counts for the current user, scoped to their role:
 * - DEPT_MANAGER: only own department, pending dept approval
 * - FACTORY_MANAGER: production side, pending factory approval
 * - HR_ADMIN / SYSTEM_ADMIN: see everything pending (+ cancel queues)
 * - Others (SUPERVISOR): no approval queue (counts return 0)
 */
export async function getPendingCounts(session: Session): Promise<PendingCounts> {
  const role = session.user.role;
  const myEmployeeId = session.user.employeeId;
  const isAdmin = role === "HR_ADMIN" || role === "SYSTEM_ADMIN";

  let leaveApproval = 0;
  let leaveCancelRequest = 0;
  let otApproval = 0;
  let otCancelRequest = 0;

  // For DEPT_MANAGER: find all departments where I'm the manager (one query, reused below)
  let managedDeptIds: string[] = [];
  if (role === "DEPT_MANAGER" && myEmployeeId) {
    const myDepts = await prisma.department.findMany({
      where: { managerId: myEmployeeId },
      select: { id: true },
    });
    managedDeptIds = myDepts.map((d) => d.id);
  }

  // ---- Leave approval count
  if (role === "DEPT_MANAGER") {
    if (managedDeptIds.length > 0) {
      leaveApproval = await prisma.leaveRequest.count({
        where: {
          status: "PENDING_DEPT_MGR",
          employee: { departmentId: { in: managedDeptIds } },
        },
      });
    }
  } else if (role === "FACTORY_MANAGER") {
    leaveApproval = await prisma.leaveRequest.count({
      where: { status: "PENDING_FACTORY_MGR", side: "PRODUCTION" },
    });
  } else if (isAdmin) {
    leaveApproval = await prisma.leaveRequest.count({
      where: { status: { in: ["PENDING_DEPT_MGR", "PENDING_FACTORY_MGR"] } },
    });
  }

  // ---- OT approval count
  if (role === "DEPT_MANAGER") {
    if (managedDeptIds.length > 0) {
      otApproval = await prisma.oTRequest.count({
        where: {
          status: "PENDING_DEPT_MGR",
          creator: { departmentId: { in: managedDeptIds } },
        },
      });
    }
  } else if (role === "FACTORY_MANAGER") {
    otApproval = await prisma.oTRequest.count({
      where: { status: "PENDING_FACTORY_MGR", side: "PRODUCTION" },
    });
  } else if (isAdmin) {
    otApproval = await prisma.oTRequest.count({
      where: { status: { in: ["PENDING_DEPT_MGR", "PENDING_FACTORY_MGR"] } },
    });
  }

  // ---- HR-only queues: cancel-request waiting for action
  if (isAdmin) {
    [otCancelRequest, leaveCancelRequest] = await Promise.all([
      prisma.oTCancellation.count({ where: { status: "PENDING" } }),
      prisma.leaveCancellation.count({ where: { status: "PENDING" } }),
    ]);
  }

  return {
    leaveApproval,
    leaveCancelRequest,
    otApproval,
    otCancelRequest,
    total: leaveApproval + leaveCancelRequest + otApproval + otCancelRequest,
  };
}

// Map href → which counter to read from PendingCounts
export const HREF_TO_BADGE: Record<string, keyof PendingCounts> = {
  "/leave/approval": "leaveApproval",
  "/leave/cancel-request": "leaveCancelRequest",
  "/ot/approval": "otApproval",
  "/ot/cancel-request": "otCancelRequest",
};
