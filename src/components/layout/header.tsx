"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Bell, Moon, Sun, LogOut, User as UserIcon, CalendarDays, Clock, FileX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { PendingCounts } from "@/lib/notifications";
import type { ActiveModule } from "./sidebar";

const ROLE_LABEL: Record<string, string> = {
  SUPERVISOR: "หัวหน้า",
  DEPT_MANAGER: "ผู้จัดการแผนก",
  FACTORY_MANAGER: "ผู้จัดการโรงงาน",
  HR_ADMIN: "HR Admin",
  SYSTEM_ADMIN: "System Admin",
};

// Which counters belong to which module — used to scope the bell badge
const MODULE_KEYS: Record<ActiveModule, Array<keyof PendingCounts>> = {
  leave: ["leaveApproval", "leaveCancelRequest"],
  ot: ["otApproval", "otCancelRequest"],
};

export function Header({
  username, firstName, lastName, role, pendingCounts, activeModule,
}: {
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  pendingCounts: PendingCounts;
  activeModule: ActiveModule;
}) {
  const { theme, setTheme } = useTheme();
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || username;
  const initials = (firstName?.[0] ?? username[0] ?? "?").toUpperCase();

  // Scope total + items to the currently-active module only
  const moduleKeys = MODULE_KEYS[activeModule];
  const total = moduleKeys.reduce((sum, k) => sum + (pendingCounts[k] as number), 0);

  const handleSignOut = () => {
    window.location.href = "/api/logout";
  };

  const ALL_ITEMS = [
    { key: "leaveApproval" as const, label: "ใบลารออนุมัติ", href: "/leave/approval", icon: CalendarDays, color: "text-blue-600" },
    { key: "leaveCancelRequest" as const, label: "คำขอยกเลิกใบลา", href: "/leave/cancel-request", icon: FileX, color: "text-rose-600" },
    { key: "otApproval" as const, label: "OT รออนุมัติ", href: "/ot/approval", icon: Clock, color: "text-violet-600" },
    { key: "otCancelRequest" as const, label: "คำขอยกเลิก OT", href: "/ot/cancel-request", icon: FileX, color: "text-rose-600" },
  ];
  const notificationItems = ALL_ITEMS.filter(
    (i) => moduleKeys.includes(i.key) && pendingCounts[i.key] > 0
  );

  return (
    <header className="sticky top-0 z-30 h-16 border-b bg-background/80 backdrop-blur-xl">
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            <Sun className="h-4 w-4 dark:hidden" />
            <Moon className="h-4 w-4 hidden dark:block" />
          </Button>

          {/* Notification Bell */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                {total > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold ring-2 ring-background tabular-nums">
                    {total > 99 ? "99+" : total}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>
                <div className="flex items-center justify-between">
                  <span>การแจ้งเตือน</span>
                  {total > 0 && <Badge variant="destructive" className="text-[10px]">{total}</Badge>}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notificationItems.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  ไม่มีรายการรอดำเนินการ
                </div>
              ) : (
                notificationItems.map((item) => {
                  const Icon = item.icon;
                  const count = pendingCounts[item.key];
                  return (
                    <DropdownMenuItem asChild key={item.key}>
                      <Link href={item.href} className="flex items-center gap-3 cursor-pointer">
                        <div className={`h-8 w-8 rounded-lg grid place-items-center bg-accent ${item.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">{item.label}</div>
                        </div>
                        <Badge variant="destructive" className="tabular-nums">{count}</Badge>
                      </Link>
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-lg pl-1 pr-3 py-1 hover:bg-accent transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <div className="text-sm font-medium leading-none">{fullName}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{ROLE_LABEL[role] ?? role}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm">{fullName}</span>
                  <span className="text-xs text-muted-foreground">@{username}</span>
                  <Badge variant="info" className="mt-2 w-fit">{ROLE_LABEL[role] ?? role}</Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem><UserIcon className="h-4 w-4 mr-2" /> โปรไฟล์</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleSignOut} className="text-destructive cursor-pointer focus:text-destructive focus:bg-destructive/10">
                <LogOut className="h-4 w-4 mr-2" /> ออกจากระบบ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
