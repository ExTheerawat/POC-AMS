"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { setSetting } from "@/server/actions/master";

export function CutOffForm({ defaults }: { defaults: { enforced: string; leaveCreate: string; leaveApprove: string; otCreate: string; otApprove: string } }) {
  const [pending, startTransition] = useTransition();
  const [enforced, setEnforced] = useState(defaults.enforced === "true");
  const [leaveCreate, setLeaveCreate] = useState(defaults.leaveCreate);
  const [leaveApprove, setLeaveApprove] = useState(defaults.leaveApprove);
  const [otCreate, setOtCreate] = useState(defaults.otCreate);
  const [otApprove, setOtApprove] = useState(defaults.otApprove);

  const save = () => {
    startTransition(async () => {
      await Promise.all([
        setSetting("CUTOFF_ENFORCED", String(enforced)),
        setSetting("CUTOFF_LEAVE_CREATE", leaveCreate),
        setSetting("CUTOFF_LEAVE_APPROVE", leaveApprove),
        setSetting("CUTOFF_OT_CREATE", otCreate),
        setSetting("CUTOFF_OT_APPROVE", otApprove),
      ]);
      toast.success("บันทึกค่า Cut-off Time เรียบร้อย");
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>เปิดใช้งานการบังคับ Cut-off</CardTitle>
              <CardDescription>ถ้าปิด ปุ่มจะใช้งานได้ตลอดเวลา</CardDescription>
            </div>
            <Switch checked={enforced} onCheckedChange={setEnforced} />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader><CardTitle>ระบบลา</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>หัวหน้าสร้างใบลา (Cut-off)</Label><Input type="time" value={leaveCreate} onChange={(e) => setLeaveCreate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>ผู้จัดการ Approve (Cut-off)</Label><Input type="time" value={leaveApprove} onChange={(e) => setLeaveApprove(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>ระบบ OT</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>หัวหน้าสร้าง OT (Cut-off)</Label><Input type="time" value={otCreate} onChange={(e) => setOtCreate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>ผู้จัดการ Approve (Cut-off)</Label><Input type="time" value={otApprove} onChange={(e) => setOtApprove(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={pending} size="lg" className="w-full sm:w-auto">
        <Save className="h-4 w-4" /> {pending ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
      </Button>
    </div>
  );
}
