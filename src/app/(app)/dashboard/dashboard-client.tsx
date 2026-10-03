"use client";

import { motion } from "framer-motion";
import { Users, CalendarDays, Clock, Building2, TrendingUp, Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { formatDate } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "info" | "success" | "destructive" | "warning" | "secondary"> = {
  PENDING_DEPT_MGR: "warning",
  PENDING_FACTORY_MGR: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  CANCELLED: "secondary",
  DRAFT: "secondary",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "ฉบับร่าง",
  PENDING_DEPT_MGR: "รออนุมัติ (แผนก)",
  PENDING_FACTORY_MGR: "รออนุมัติ (โรงงาน)",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ปฏิเสธ",
  CANCELLED: "ยกเลิก",
  COMPLETED: "เสร็จสิ้น",
  MODIFIED_BY_HR: "HR แก้ไข",
};

type Props = {
  role: string;
  stats: {
    employeeCount: number;
    deptCount: number;
    leavePending: number;
    leaveApproved: number;
    otPending: number;
    otApproved: number;
  };
  chartData: { date: string; office: number; production: number }[];
  recentLeaves: {
    id: string; requestNo: string; employeeName: string; leaveType: string;
    status: string; startDate: string; totalDays: number;
  }[];
};

const STAT_CARDS = [
  { key: "employeeCount", title: "พนักงานทั้งหมด", icon: Users, color: "from-indigo-500 to-blue-500", suffix: "คน" },
  { key: "deptCount", title: "แผนก", icon: Building2, color: "from-emerald-500 to-teal-500", suffix: "แผนก" },
  { key: "leavePending", title: "ใบลารออนุมัติ", icon: Inbox, color: "from-amber-500 to-orange-500", suffix: "รายการ" },
  { key: "leaveApproved", title: "ใบลาอนุมัติแล้ว", icon: CalendarDays, color: "from-green-500 to-emerald-500", suffix: "รายการ" },
  { key: "otPending", title: "OT รออนุมัติ", icon: Clock, color: "from-rose-500 to-pink-500", suffix: "รายการ" },
  { key: "otApproved", title: "OT อนุมัติแล้ว", icon: TrendingUp, color: "from-violet-500 to-purple-500", suffix: "รายการ" },
] as const;

export function DashboardClient({ stats, chartData, recentLeaves }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">ภาพรวมระบบจัดการการลาและ OT</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_CARDS.map((c, i) => {
          const Icon = c.icon;
          const value = stats[c.key as keyof typeof stats];
          return (
            <motion.div
              key={c.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="overflow-hidden">
                <CardContent className="p-4">
                  <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${c.color} grid place-items-center mb-3 shadow-sm`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{c.title}</div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* OT Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>OT รายวัน — เดือนนี้</CardTitle>
            <CardDescription>Person-Hours (ชั่วโมง × คน) จากที่ทำจริง — แยกตามฝ่าย Office / ผลิต</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-72 grid place-items-center text-sm text-muted-foreground">
                ยังไม่มีข้อมูล OT ในเดือนนี้
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="office" name="Office" fill="hsl(238 84% 60%)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="production" name="ผลิต" fill="hsl(142 71% 45%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Leaves */}
        <Card>
          <CardHeader>
            <CardTitle>ใบลาล่าสุด</CardTitle>
            <CardDescription>5 รายการล่าสุด</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentLeaves.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">ยังไม่มีรายการ</div>
            ) : (
              recentLeaves.map((l) => (
                <div key={l.id} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold shrink-0">
                    {l.employeeName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{l.employeeName}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.leaveType} • {l.totalDays} วัน • {formatDate(l.startDate)}
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[l.status] ?? "secondary"} className="text-[10px]">
                    {STATUS_LABEL[l.status] ?? l.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
