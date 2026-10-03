import { Repeat } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { CarryOverForm } from "./carry-over-form";

export default async function CarryOverPage() {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "CARRY_OVER_MAX_DAYS" } });
  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center"><Repeat className="h-5 w-5" /></div>
        <div><h1 className="text-2xl font-bold">Carry Over</h1><p className="text-sm text-muted-foreground">ตั้งค่าการโอนวันลา</p></div>
      </div>
      <Card>
        <CardHeader><CardTitle>เพดานการโอนวันลา</CardTitle><CardDescription>วันลาคงเหลือสูงสุดที่สามารถโอนไปปีหน้าได้</CardDescription></CardHeader>
        <CardContent>
          <CarryOverForm defaultValue={setting?.value ?? "5"} />
        </CardContent>
      </Card>
    </div>
  );
}
