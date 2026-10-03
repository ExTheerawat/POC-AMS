"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, KeyRound, User, Loader2, ShieldCheck, Briefcase, Users, Factory, Cog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const DEMO_ACCOUNTS = [
  { username: "admin", password: "admin123", name: "System Admin", role: "System Admin", icon: Cog, color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  { username: "hr", password: "hr123", name: "สมศรี สวัสดี", role: "HR Admin", icon: ShieldCheck, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  { username: "mgr.office", password: "mgr123", name: "วิชัย บริหารดี", role: "ผู้จัดการแผนก (Office — Sales)", icon: Briefcase, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  { username: "mgr.prod", password: "mgr123", name: "สมศักดิ์ จัดการผลิต", role: "ผู้จัดการแผนก (ผลิต — PROD1)", icon: Briefcase, color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300" },
  { username: "mgr.factory", password: "mgr123", name: "ประเสริฐ โรงงานเดช", role: "ผู้จัดการโรงงาน", icon: Factory, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  { username: "sup.office", password: "sup123", name: "อนันต์ นำทีม", role: "หัวหน้า (Office)", icon: Users, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  { username: "sup.prod", password: "sup123", name: "บุญมี ผลิตเก่ง", role: "หัวหน้า (ผลิต)", icon: Users, color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!username || !password) {
      toast.error("กรุณากรอก Username และ Password");
      return;
    }
    setLoading(true);
    const res = await signIn("credentials", { username, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      toast.error("Username หรือ Password ไม่ถูกต้อง");
    } else {
      toast.success("เข้าสู่ระบบสำเร็จ");
      router.push("/select-module");
      router.refresh();
    }
  };

  const fillDemo = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-5xl grid lg:grid-cols-2 gap-6"
      >
        {/* Left — Brand panel */}
        <div className="hidden lg:flex flex-col justify-between rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 p-10 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-purple-400/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-8">
              <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur grid place-items-center">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">AMS</h1>
                <p className="text-xs text-indigo-100">Attendance Management System</p>
              </div>
            </div>
            <h2 className="text-4xl font-bold leading-tight mb-4">
              จัดการ <span className="text-yellow-300">การลา</span> และ <span className="text-emerald-300">OT</span><br />
              อย่างเป็นระบบ
            </h2>
            <p className="text-indigo-100 text-lg leading-relaxed">
              ระบบบริหารจัดการการลาและการทำงานล่วงเวลา พร้อม Workflow อนุมัติ
              แจ้งเตือนทางอีเมล และ Dashboard สำหรับ HR
            </p>
          </div>

          <div className="relative grid grid-cols-3 gap-4 mt-8">
            {[
              { label: "พนักงาน", value: "460+" },
              { label: "Modules", value: "2" },
              { label: "Workflow", value: "2-3 Steps" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-white/10 backdrop-blur p-4 border border-white/10">
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-indigo-100">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Login form */}
        <Card className="shadow-2xl border-0 lg:shadow-xl">
          <CardContent className="p-8 sm:p-10">
            <div className="lg:hidden flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-primary grid place-items-center">
                <Building2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-lg">AMS</h1>
                <p className="text-xs text-muted-foreground">Attendance Management</p>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-1">ยินดีต้อนรับกลับ 👋</h2>
            <p className="text-sm text-muted-foreground mb-6">เข้าสู่ระบบเพื่อใช้งาน AMS</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="username" autoComplete="username" placeholder="กรอก username"
                    value={username} onChange={(e) => setUsername(e.target.value)} className="pl-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type="password" autoComplete="current-password" placeholder="กรอก password"
                    value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" />
                </div>
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              </Button>
            </form>

            <div className="mt-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Demo Accounts</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <p className="text-xs text-muted-foreground mb-3 text-center">คลิกเพื่อกรอกอัตโนมัติ</p>
              <div className="grid gap-2 max-h-64 overflow-y-auto pr-1">
                {DEMO_ACCOUNTS.map((acc) => {
                  const Icon = acc.icon;
                  return (
                    <button
                      key={acc.username}
                      type="button"
                      onClick={() => fillDemo(acc.username, acc.password)}
                      className="group flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left hover:border-primary/40 hover:bg-accent/40 transition-all"
                    >
                      <div className={`h-9 w-9 rounded-lg grid place-items-center ${acc.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {acc.name}
                          <span className="ml-2 text-[10px] font-normal text-muted-foreground">— {acc.role}</span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono">{acc.username}</span>
                          <span className="opacity-50">/</span>
                          <span className="font-mono">{acc.password}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">คลิก</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
