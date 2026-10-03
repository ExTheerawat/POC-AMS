"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Calendar, Clock, Bus, Users, Eye, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { approveOT } from "@/server/actions/ot";
import { formatDate } from "@/lib/utils";

type EmpRow = { id: string; employeeCode: string; name: string };

type OT = {
  id: string; requestNo: string; otDate: string; startTime: string; endTime: string;
  totalHours: number; isHoliday: boolean; workDescription: string; busRoute: string;
  busRoutesSummary: { name: string; count: number }[];
  side: string; status: string; creator: string;
  employeeCount: number;
  employeePreview: string[];
  employees: EmpRow[];
};

export function OTApprovalList({ ots, cutoffPassed }: { ots: OT[]; cutoffPassed: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Bulk dialog (multi-OT, whole-doc only)
  const [bulkAction, setBulkAction] = useState<"APPROVE" | "REJECT" | null>(null);
  const [comment, setComment] = useState("");

  // Per-OT dialog (single OT, supports per-employee picking)
  const [perOTTarget, setPerOTTarget] = useState<{ ot: OT; action: "APPROVE" | "REJECT" } | null>(null);
  const [perOTComment, setPerOTComment] = useState("");
  const [perOTPickedIds, setPerOTPickedIds] = useState<Set<string>>(new Set());

  const allSelected = selected.size === ots.length && ots.length > 0;
  const someSelected = selected.size > 0;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((prev) => (prev.size === ots.length ? new Set() : new Set(ots.map((o) => o.id))));
  const clearSelection = () => setSelected(new Set());

  const runBulkAction = () => {
    if (!bulkAction || selected.size === 0) return;
    startTransition(async () => {
      const ids = Array.from(selected);
      const results = await Promise.all(ids.map((id) => approveOT(id, bulkAction, comment)));
      const ok = results.filter((r) => !("error" in r)).length;
      const failed = results.length - ok;
      if (ok > 0) {
        toast.success(
          `${bulkAction === "APPROVE" ? "อนุมัติ" : "ปฏิเสธ"} OT สำเร็จ ${ok} ใบ${failed > 0 ? ` (ล้มเหลว ${failed})` : ""}`
        );
      }
      if (failed === results.length) {
        const firstErr = results.find((r) => "error" in r) as { error: string } | undefined;
        if (firstErr) toast.error(firstErr.error);
      }
      setBulkAction(null);
      setComment("");
      clearSelection();
      router.refresh();
    });
  };

  /** Open per-OT dialog — default all employees picked */
  const openPerOT = (ot: OT, action: "APPROVE" | "REJECT") => {
    setPerOTTarget({ ot, action });
    setPerOTComment("");
    setPerOTPickedIds(new Set(ot.employees.map((e) => e.id)));
  };

  const togglePerOTEmp = (id: string) => {
    setPerOTPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePerOTAll = () => {
    if (!perOTTarget) return;
    const allIds = perOTTarget.ot.employees.map((e) => e.id);
    setPerOTPickedIds((prev) => (prev.size === allIds.length ? new Set() : new Set(allIds)));
  };

  const runPerOTAction = () => {
    if (!perOTTarget) return;
    const { ot, action } = perOTTarget;
    if (perOTPickedIds.size === 0) {
      toast.error(action === "APPROVE" ? "กรุณาเลือกพนักงานที่จะอนุมัติอย่างน้อย 1 คน" : "กรุณาเลือกพนักงานที่จะปฏิเสธอย่างน้อย 1 คน");
      return;
    }
    const isWholeDoc = perOTPickedIds.size === ot.employees.length;
    const ids = isWholeDoc ? undefined : Array.from(perOTPickedIds);
    startTransition(async () => {
      const res = await approveOT(ot.id, action, perOTComment, ids);
      if ("error" in res && res.error) { toast.error(res.error); return; }
      const cntPick = perOTPickedIds.size;
      const cntOther = ot.employees.length - cntPick;
      if (isWholeDoc) {
        toast.success(`${action === "APPROVE" ? "อนุมัติ" : "ปฏิเสธ"} OT ${ot.requestNo} เรียบร้อย`);
      } else if (action === "APPROVE") {
        toast.success(`อนุมัติ ${cntPick} คน · ลบ ${cntOther} คนออกจาก OT`);
      } else {
        toast.success(`ปฏิเสธ ${cntPick} คน · ผ่าน ${cntOther} คน`);
      }
      setPerOTTarget(null);
      setPerOTComment("");
      setPerOTPickedIds(new Set());
      router.refresh();
    });
  };

  return (
    <>
      {/* Action bar — sticky */}
      <Card className="sticky top-16 z-20">
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={toggleAll} className="gap-2">
            {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            {allSelected ? "ยกเลิกเลือกทั้งหมด" : "เลือกทั้งหมด"}
          </Button>
          <div className="text-sm text-muted-foreground">
            เลือก <b className="text-foreground tabular-nums">{selected.size}</b> จาก {ots.length} ใบ OT
          </div>
          <div className="ml-auto flex items-center gap-2">
            {someSelected && (
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="h-4 w-4" /> ล้างการเลือก
              </Button>
            )}
            <Button
              variant="success"
              size="sm"
              disabled={!someSelected || cutoffPassed || pending}
              onClick={() => { setBulkAction("APPROVE"); setComment(""); }}
            >
              <Check className="h-4 w-4" /> อนุมัติที่เลือก ({selected.size})
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!someSelected || pending}
              onClick={() => { setBulkAction("REJECT"); setComment(""); }}
            >
              <X className="h-4 w-4" /> ปฏิเสธที่เลือก ({selected.size})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* OT cards — 1 card per OT */}
      <div className="grid gap-3 mt-4">
        {ots.map((o) => {
          const isChecked = selected.has(o.id);
          return (
            <Card
              key={o.id}
              className={`transition-all ${
                isChecked
                  ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                  : "hover:border-primary/40"
              }`}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggle(o.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">{o.requestNo}</span>
                      <Badge variant="outline">{o.side === "OFFICE" ? "Office" : "ผลิต"}</Badge>
                      {o.isHoliday && <Badge variant="warning">วันหยุด</Badge>}
                      <Badge variant="info"><Clock className="h-3 w-3 mr-1" /> {o.totalHours} ชม.</Badge>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 mt-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDate(o.otDate)} • {o.startTime}-{o.endTime}
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <Bus className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                          <span>สายรถ:</span>
                          {o.busRoutesSummary.length === 0 ? (
                            <span className="text-muted-foreground">-</span>
                          ) : o.busRoutesSummary.length === 1 ? (
                            <span>
                              {o.busRoutesSummary[0].name}
                              <span className="text-muted-foreground"> ({o.busRoutesSummary[0].count} คน)</span>
                            </span>
                          ) : (
                            o.busRoutesSummary.map((r) => (
                              <Badge key={r.name} variant="outline" className="font-normal">
                                {r.name} <span className="ml-1 text-muted-foreground">({r.count})</span>
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm sm:col-span-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <b>{o.employeeCount} คน</b>
                        {o.employeePreview.length > 0 && (
                          <span className="text-muted-foreground truncate">
                            : {o.employeePreview.join(", ")}{o.employeeCount > o.employeePreview.length && ` +${o.employeeCount - o.employeePreview.length}`}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">สร้างโดย: {o.creator}</div>
                    </div>

                    {o.workDescription && (
                      <div className="text-sm text-muted-foreground italic mt-2 pt-2 border-t">
                        "{o.workDescription}"
                      </div>
                    )}
                  </div>

                  {/* Right side: view + quick actions */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button asChild variant="outline" size="sm" title="ดูรายละเอียดพนักงาน">
                      <Link href={`/ot/${o.id}`}><Eye className="h-4 w-4" /> ดูรายชื่อ</Link>
                    </Button>
                    <Button
                      size="sm" variant="success"
                      onClick={() => openPerOT(o, "APPROVE")}
                      disabled={cutoffPassed}
                    >
                      <Check className="h-4 w-4" /> อนุมัติ
                    </Button>
                    <Button
                      size="sm" variant="destructive"
                      onClick={() => openPerOT(o, "REJECT")}
                    >
                      <X className="h-4 w-4" /> ปฏิเสธ
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bulk confirmation dialog */}
      <Dialog open={!!bulkAction} onOpenChange={(v) => !v && setBulkAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAction === "APPROVE" ? "ยืนยันการอนุมัติ OT" : "ยืนยันการปฏิเสธ OT"}
            </DialogTitle>
            <DialogDescription>
              จะ {bulkAction === "APPROVE" ? "อนุมัติ" : "ปฏิเสธ"} OT จำนวน <b>{selected.size}</b> ใบ
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="ความเห็น (ถ้ามี — จะ apply กับทุก OT ที่เลือก)"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAction(null)}>ยกเลิก</Button>
            <Button
              onClick={runBulkAction}
              disabled={pending}
              variant={bulkAction === "APPROVE" ? "success" : "destructive"}
            >
              {pending ? "กำลังบันทึก..." : bulkAction === "APPROVE" ? "อนุมัติ" : "ปฏิเสธ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Per-OT dialog — supports picking individual employees */}
      <Dialog open={!!perOTTarget} onOpenChange={(v) => !v && setPerOTTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {perOTTarget?.action === "APPROVE" ? "อนุมัติ OT" : "ปฏิเสธ OT"} — {perOTTarget?.ot.requestNo}
            </DialogTitle>
            <DialogDescription>
              {perOTTarget && (
                <>
                  {formatDate(perOTTarget.ot.otDate)} • {perOTTarget.ot.startTime}-{perOTTarget.ot.endTime} • {perOTTarget.ot.totalHours} ชม. • สายรถ: {perOTTarget.ot.busRoute}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {perOTTarget && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">
                    {perOTTarget.action === "APPROVE"
                      ? "เลือกพนักงานที่จะอนุมัติ:"
                      : "เลือกพนักงานที่จะปฏิเสธ:"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {perOTTarget.action === "APPROVE"
                      ? <>คนที่ไม่ติ๊กจะถูก <b>ลบออกจากใบ OT</b></>
                      : <>คนที่ไม่ติ๊กจะ <b>ผ่าน</b> และทำ OT ต่อตามปกติ</>}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={togglePerOTAll}>
                  {perOTPickedIds.size === perOTTarget.ot.employees.length ? "ยกเลิกเลือกทั้งหมด" : "เลือกทั้งหมด"}
                </Button>
              </div>

              <div className="max-h-56 overflow-y-auto rounded-lg border divide-y">
                {perOTTarget.ot.employees.map((emp) => {
                  const checked = perOTPickedIds.has(emp.id);
                  return (
                    <label
                      key={emp.id}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm ${checked ? "bg-primary/5" : "hover:bg-muted/50"}`}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => togglePerOTEmp(emp.id)} />
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{emp.employeeCode}</span>
                        {emp.name}
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Action summary */}
              {(() => {
                const total = perOTTarget.ot.employees.length;
                const picked = perOTPickedIds.size;
                const other = total - picked;
                if (perOTTarget.action === "APPROVE") {
                  if (picked === total) {
                    return <div className="text-xs text-muted-foreground">✓ อนุมัติทั้งฉบับ ({total} คน)</div>;
                  }
                  return (
                    <div className="text-xs">
                      <span className="text-success font-medium">✓ อนุมัติ {picked} คน</span>
                      <span className="mx-2 text-muted-foreground">·</span>
                      <span className="text-muted-foreground font-medium">🗑 ลบ {other} คนออกจาก OT</span>
                    </div>
                  );
                }
                if (picked === total) {
                  return <div className="text-xs text-muted-foreground">✗ ปฏิเสธทั้งฉบับ ({total} คน) → OT จะถูกยกเลิก</div>;
                }
                return (
                  <div className="text-xs">
                    <span className="text-destructive font-medium">✗ ปฏิเสธ {picked} คน</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="text-success font-medium">✓ ผ่าน {other} คน (ทำ OT ต่อ)</span>
                  </div>
                );
              })()}

              <Textarea
                placeholder="ความเห็น (ถ้ามี)"
                rows={2}
                value={perOTComment}
                onChange={(e) => setPerOTComment(e.target.value)}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPerOTTarget(null)}>ยกเลิก</Button>
            <Button
              onClick={runPerOTAction}
              disabled={pending || perOTPickedIds.size === 0}
              variant={perOTTarget?.action === "APPROVE" ? "success" : "destructive"}
            >
              {pending ? "กำลังบันทึก..." : perOTTarget?.action === "APPROVE" ? "อนุมัติ" : "ปฏิเสธ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
