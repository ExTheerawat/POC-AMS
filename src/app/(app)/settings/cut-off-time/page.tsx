import { prisma } from "@/lib/db";
import { Clock4 } from "lucide-react";
import { CutOffForm } from "./cut-off-form";

export default async function CutOffPage() {
  const settings = await prisma.systemSetting.findMany();
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center"><Clock4 className="h-5 w-5" /></div>
        <div><h1 className="text-2xl font-bold">Cut-off Time</h1><p className="text-sm text-muted-foreground">ตั้งค่าเวลาตัดของระบบ</p></div>
      </div>
      <CutOffForm
        defaults={{
          enforced: map.CUTOFF_ENFORCED ?? "true",
          leaveCreate: map.CUTOFF_LEAVE_CREATE ?? "11:00",
          leaveApprove: map.CUTOFF_LEAVE_APPROVE ?? "13:00",
          otCreate: map.CUTOFF_OT_CREATE ?? "11:00",
          otApprove: map.CUTOFF_OT_APPROVE ?? "13:00",
        }}
      />
    </div>
  );
}
