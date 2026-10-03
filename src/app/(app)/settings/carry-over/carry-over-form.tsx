"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { setSetting } from "@/server/actions/master";

export function CarryOverForm({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      await setSetting("CARRY_OVER_MAX_DAYS", value);
      toast.success("บันทึกเรียบร้อย");
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>จำนวนวันสูงสุด</Label>
        <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} min={0} max={365} />
        <p className="text-xs text-muted-foreground">ระบบจะโอนวันลาคงเหลือไม่เกินจำนวนนี้ไปปีถัดไป (ทำงานวันที่ 1 มกราคม)</p>
      </div>
      <Button onClick={save} disabled={pending}><Save className="h-4 w-4" /> {pending ? "กำลังบันทึก..." : "บันทึก"}</Button>
    </div>
  );
}
