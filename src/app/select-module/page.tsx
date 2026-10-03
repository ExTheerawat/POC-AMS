import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { Building2, CalendarDays, Clock, LogOut, ArrowRight } from "lucide-react";
import { selectModule } from "@/server/actions/module";

export const metadata = { title: "เลือก Module — AMS" };

export default async function SelectModulePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const fullName =
    [session.user.firstName, session.user.lastName].filter(Boolean).join(" ") ||
    session.user.username;

  const roleLabel: Record<string, string> = {
    SUPERVISOR: "หัวหน้า",
    DEPT_MANAGER: "ผู้จัดการแผนก",
    FACTORY_MANAGER: "ผู้จัดการโรงงาน",
    HR_ADMIN: "HR Admin",
    SYSTEM_ADMIN: "System Admin",
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white grid place-items-center shadow-lg">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="text-left">
              <div className="text-lg font-bold">AMS</div>
              <div className="text-xs text-muted-foreground">Attendance Management System</div>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">สวัสดี, {fullName} 👋</h1>
          <p className="text-muted-foreground mt-2">
            {roleLabel[session.user.role] ?? session.user.role} · เลือก Module ที่ต้องการใช้งาน
          </p>
        </div>

        {/* 2 Module Cards */}
        <div className="grid sm:grid-cols-2 gap-6">
          {/* Leave Module */}
          <form action={async () => { "use server"; await selectModule("leave"); }}>
            <button
              type="submit"
              className="group relative w-full h-full rounded-2xl border-2 border-border bg-card p-8 text-left hover:border-blue-500 hover:shadow-2xl transition-all overflow-hidden"
            >
              <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors" />
              <div className="relative">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white grid place-items-center mb-5 shadow-lg group-hover:scale-110 transition-transform">
                  <CalendarDays className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-bold mb-2">ระบบลา</h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  จัดการใบลาของพนักงาน — สร้างใบลา, อนุมัติ, ตรวจสอบประวัติ
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 mb-6">
                  <li>✓ สร้างใบลาแทนพนักงาน</li>
                  <li>✓ Workflow อนุมัติ 2-3 ขั้น</li>
                  <li>✓ คำนวณวันลาคงเหลือ Pro-Rate</li>
                </ul>
                <div className="flex items-center gap-2 text-blue-600 font-semibold group-hover:gap-3 transition-all">
                  เข้าใช้งาน <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </button>
          </form>

          {/* OT Module */}
          <form action={async () => { "use server"; await selectModule("ot"); }}>
            <button
              type="submit"
              className="group relative w-full h-full rounded-2xl border-2 border-border bg-card p-8 text-left hover:border-violet-500 hover:shadow-2xl transition-all overflow-hidden"
            >
              <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors" />
              <div className="relative">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white grid place-items-center mb-5 shadow-lg group-hover:scale-110 transition-transform">
                  <Clock className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-bold mb-2">ระบบ OT</h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  จัดการ OT — สร้างกะ, อนุมัติ, ขอยกเลิก, รายงาน
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 mb-6">
                  <li>✓ สร้าง OT พร้อมเลือกพนักงาน + สายรถ</li>
                  <li>✓ คำนวณชั่วโมงอัตโนมัติ (2.5 ชม. / 11 ชม.)</li>
                  <li>✓ Bulk approve + รายงาน Person-Hours</li>
                </ul>
                <div className="flex items-center gap-2 text-violet-600 font-semibold group-hover:gap-3 transition-all">
                  เข้าใช้งาน <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </button>
          </form>
        </div>

        {/* Logout link */}
        <div className="text-center mt-8">
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" /> ออกจากระบบ
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
