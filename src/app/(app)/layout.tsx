import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getPendingCounts } from "@/lib/notifications";
import { getActiveModule } from "@/lib/active-module";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const activeModule = await getActiveModule();
  if (!activeModule) redirect("/select-module");

  const pendingCounts = await getPendingCounts(session);

  return (
    <AppShell
      user={{
        username: session.user.username,
        role: session.user.role,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
      }}
      pendingCounts={pendingCounts}
      activeModule={activeModule}
    >
      {children}
    </AppShell>
  );
}
