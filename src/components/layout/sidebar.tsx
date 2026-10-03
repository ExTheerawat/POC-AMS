"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, CalendarDays, Clock, Settings,
  Building2, ChevronLeft, ChevronRight, Users, Briefcase, Bus, CalendarOff,
  Inbox, FilePlus, ListChecks, FileX, FileText, FileBarChart,
  Clock4, Repeat, Shield, RefreshCcw, TrendingUp, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/enums";
import { HREF_TO_BADGE, type PendingCounts } from "@/lib/notifications";

export type ActiveModule = "leave" | "ot";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: UserRole[];
  module?: ActiveModule;   // restrict to module ("leave" or "ot"). undefined = both.
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV: NavGroup[] = [
  {
    label: "หลัก",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "ระบบลา",
    items: [
      { label: "สร้างใบลา", href: "/leave/create", icon: FilePlus, roles: ["SUPERVISOR", "DEPT_MANAGER", "HR_ADMIN", "SYSTEM_ADMIN"], module: "leave" },
      { label: "รายการใบลา", href: "/leave/list", icon: ListChecks, module: "leave" },
      { label: "สิทธิ์การลาพนักงาน", href: "/leave/balances", icon: FileBarChart, module: "leave" },
      { label: "ขอยกเลิกการลา", href: "/leave/cancel-request", icon: FileX, roles: ["SUPERVISOR", "DEPT_MANAGER", "HR_ADMIN", "SYSTEM_ADMIN"], module: "leave" },
      { label: "รออนุมัติ", href: "/leave/approval", icon: Inbox, roles: ["DEPT_MANAGER", "FACTORY_MANAGER", "HR_ADMIN", "SYSTEM_ADMIN"], module: "leave" },
    ],
  },
  {
    label: "ระบบ OT",
    items: [
      { label: "สร้าง OT", href: "/ot/create", icon: FilePlus, roles: ["SUPERVISOR", "DEPT_MANAGER", "HR_ADMIN", "SYSTEM_ADMIN"], module: "ot" },
      { label: "รายการ OT", href: "/ot/list", icon: Clock, module: "ot" },
      { label: "รออนุมัติ OT", href: "/ot/approval", icon: Inbox, roles: ["DEPT_MANAGER", "FACTORY_MANAGER", "HR_ADMIN", "SYSTEM_ADMIN"], module: "ot" },
      { label: "ขอยกเลิก OT", href: "/ot/cancel-request", icon: FileX, roles: ["SUPERVISOR", "DEPT_MANAGER", "HR_ADMIN", "SYSTEM_ADMIN"], module: "ot" },
    ],
  },
  {
    label: "Master Data",
    items: [
      { label: "พนักงาน", href: "/master/employees", icon: Users, roles: ["HR_ADMIN", "SYSTEM_ADMIN"] },
      { label: "แผนก", href: "/master/departments", icon: Briefcase, roles: ["HR_ADMIN", "SYSTEM_ADMIN"] },
      { label: "ประเภทการลา", href: "/master/leave-types", icon: CalendarDays, roles: ["HR_ADMIN", "SYSTEM_ADMIN"], module: "leave" },
      { label: "เหตุผลปฏิเสธใบลา", href: "/master/leave-reject-reasons", icon: XCircle, roles: ["HR_ADMIN", "SYSTEM_ADMIN"], module: "leave" },
      { label: "สิทธิ์ลาพักร้อน", href: "/master/vacation-tiers", icon: TrendingUp, roles: ["HR_ADMIN", "SYSTEM_ADMIN"], module: "leave" },
      { label: "สายรถ", href: "/master/bus-routes", icon: Bus, roles: ["HR_ADMIN", "SYSTEM_ADMIN"], module: "ot" },
      { label: "วันหยุด", href: "/master/holidays", icon: CalendarOff, roles: ["HR_ADMIN", "SYSTEM_ADMIN"] },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Leave Report", href: "/reports/leave-monthly", icon: FileText, roles: ["HR_ADMIN", "SYSTEM_ADMIN", "DEPT_MANAGER", "FACTORY_MANAGER"], module: "leave" },
      { label: "OT Summary", href: "/reports/ot-summary", icon: FileBarChart, roles: ["HR_ADMIN", "SYSTEM_ADMIN", "DEPT_MANAGER", "FACTORY_MANAGER"], module: "ot" },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "จัดการผู้ใช้", href: "/settings/users", icon: Shield, roles: ["SYSTEM_ADMIN", "HR_ADMIN"] },
      { label: "Cut-off Time", href: "/settings/cut-off-time", icon: Clock4, roles: ["SYSTEM_ADMIN"] },
      { label: "Carry Over", href: "/settings/carry-over", icon: Repeat, roles: ["SYSTEM_ADMIN", "HR_ADMIN"], module: "leave" },
    ],
  },
];

export function Sidebar({
  role, pendingCounts, activeModule,
}: {
  role: UserRole;
  pendingCounts: PendingCounts;
  activeModule: ActiveModule;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const canSee = (item: NavItem) => {
    if (item.roles && !item.roles.includes(role)) return false;
    if (item.module && item.module !== activeModule) return false;
    return true;
  };
  const badgeOf = (href: string): number => {
    const key = HREF_TO_BADGE[href];
    return key ? pendingCounts[key] : 0;
  };

  const moduleColor = activeModule === "leave"
    ? "from-blue-500 to-indigo-600"
    : "from-violet-500 to-purple-600";
  const moduleLabel = activeModule === "leave" ? "ระบบลา" : "ระบบ OT";

  return (
    <aside className={cn(
      "sticky top-0 h-screen flex flex-col border-r bg-card transition-all duration-300",
      collapsed ? "w-[68px]" : "w-64"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 h-16 border-b px-4">
        <div className={cn("h-9 w-9 rounded-lg bg-gradient-to-br grid place-items-center shrink-0 shadow-sm", moduleColor)}>
          <Building2 className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-bold text-sm tracking-tight">AMS</div>
            <div className="text-[10px] text-muted-foreground truncate">{moduleLabel}</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV.map((group) => {
          const visible = group.items.filter(canSee);
          if (visible.length === 0) return null;
          return (
            <div key={group.label} className="mb-4">
              {!collapsed && (
                <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {visible.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  const count = badgeOf(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? `${item.label}${count > 0 ? ` (${count})` : ""}` : undefined}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <span className="relative">
                        <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                        {/* When collapsed: show small red dot on icon */}
                        {collapsed && count > 0 && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
                        )}
                      </span>
                      {!collapsed && (
                        <>
                          <span className="truncate flex-1">{item.label}</span>
                          {count > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold tabular-nums">
                              {count > 99 ? "99+" : count}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Switch Module button */}
      <Link
        href="/select-module"
        title={collapsed ? "เปลี่ยน Module" : undefined}
        className={cn(
          "mx-2 mb-1 h-9 rounded-lg border bg-background hover:bg-accent flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors",
          collapsed ? "justify-center" : "px-3"
        )}
      >
        <RefreshCcw className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">เปลี่ยน Module</span>}
      </Link>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mx-2 mb-2 h-9 rounded-lg border bg-background hover:bg-accent grid place-items-center text-muted-foreground"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
