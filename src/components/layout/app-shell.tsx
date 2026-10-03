"use client";

import { SessionProvider } from "next-auth/react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import type { UserRole } from "@/types/enums";
import type { PendingCounts } from "@/lib/notifications";
import type { ActiveModule } from "./sidebar";

type Props = {
  children: React.ReactNode;
  user: {
    username: string;
    role: UserRole;
    firstName?: string | null;
    lastName?: string | null;
  };
  pendingCounts: PendingCounts;
  activeModule: ActiveModule;
};

export function AppShell({ children, user, pendingCounts, activeModule }: Props) {
  return (
    <SessionProvider>
      <div data-app-shell className="h-screen flex bg-muted/30 overflow-hidden">
        <Sidebar role={user.role} pendingCounts={pendingCounts} activeModule={activeModule} />
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            username={user.username}
            firstName={user.firstName}
            lastName={user.lastName}
            role={user.role}
            pendingCounts={pendingCounts}
            activeModule={activeModule}
          />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6 max-w-[1600px] w-full mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
