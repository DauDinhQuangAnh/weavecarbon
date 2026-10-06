"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { industrialCoreApi, type IndustrialActivityLineage } from "@/lib/industrialCoreApi";
import { useIndustrialWorkspaceQuery } from "@/hooks/useIndustrialWorkspaceQuery";
import { usePermissions } from "@/hooks/usePermissions";
import { useAppRoutes } from "@/lib/demo/routes";
import { WORKSPACE_DEMO, workspaceCanWrite } from "@/lib/dashboard/industrialWorkspace";
import { Button } from "@/components/ui/button";
import WorkspaceFrame, { EmptyWorkspace } from "./WorkspaceFrame";

export default function EvidenceLineageClient({ review = false, demo = false }: { review?: boolean; demo?: boolean }) {
  const routes = useAppRoutes();
  const [selected, setSelected] = useState("");
  const [decision, setDecision] = useState<"approved" | "needs_information" | "rejected">("needs_information");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canWrite = workspaceCanWrite(usePermissions(), demo);
  const loadActivities = useCallback(() => demo ? Promise.resolve(WORKSPACE_DEMO.activities) : industrialCoreApi.activities(500), [demo]);
  const activities = useIndustrialWorkspaceQuery(loadActivities, demo);
  const activityId = activities.data?.find(row => row.id === selected)?.id || activities.data?.[0]?.id || "";
  const loadLineage = useCallback(async (): Promise<IndustrialActivityLineage | null> => {
    if (!activityId) return null;
    if (!demo) return industrialCoreApi.activityLineage(activityId);
    return { activity: WORKSPACE_DEMO.activities[0], facility: { id: WORKSPACE_DEMO.facilities[0].id, reference: "DEMO-FACTORY", name: "Cơ sở minh họa" }, process: { id: WORKSPACE_DEMO.processes[0].id, reference: "DEMO-LINE", name: "Dây chuyền minh họa" }, measurementPoint: null, evidence: [], latestReview: null };
  }, [activityId, demo]);
  const lineage = useIndustrialWorkspaceQuery(loadLineage, demo);
  // A pending selection must never show or approve the previous activity's lineage.
  const data = lineage.data?.activity.id === activityId ? lineage.data : null;
  useEffect(() => { setMessage(null); setNotes(""); setDecision("needs_information"); }, [activityId]);
  const canApprove = Boolean(data?.evidence.length) && data!.evidence.every(row => ["locked", "third_party_verified"].includes(row.status) && /^[a-f0-9]{64}$/i.test(row.checksumSha256 || ""));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || busy || !data || (decision === "approved" && !canApprove)) return;
    setBusy(true); setMessage(null);
    try {
      await industrialCoreApi.reviewActivity(data.activity.id, { reviewerRole: "industrial_activity_reviewer", decision, notes: notes.trim() });
      setMessage("Đã lưu review có danh tính và snapshot bằng chứng. Review nội bộ không phải xác minh độc lập.");
      await lineage.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không lưu được review."); }
    finally { setBusy(false); }
  }
  return <WorkspaceFrame title={review ? "Review & xác minh" : "Đồ thị bằng chứng"} description="Truy vết một hoạt động tới cơ sở, quy trình, điểm đo, chứng từ và review có danh tính. Kết nối được đọc từ bản ghi lưu trên hệ thống; phần tính toán và phân bổ được quản lý ở Vận hành carbon." demo={demo} loading={activities.loading} error={activities.error} reload={activities.reload}>
    {!activities.data?.length ? <EmptyWorkspace>Chưa có hoạt động để truy vết. <Link className="text-primary underline" href={routes.toAppPath("/activity-data")} prefetch={false}>Mở dữ liệu hoạt động</Link></EmptyWorkspace> : <>
      <label className="block text-sm">Chọn hoạt động (tối đa 500 bản ghi gần nhất)<select disabled={busy} className="mt-2 w-full rounded-md border bg-background p-3" value={activityId} onChange={event => setSelected(event.target.value)}>{activities.data.map(row => <option key={row.id} value={row.id}>{row.activityReference} · {row.dataQualityLevel}</option>)}</select></label>
      {lineage.loading || !data && !lineage.error ? <p role="status">Đang tải chuỗi bằng chứng…</p> : lineage.error ? <div role="alert" className="space-y-3 rounded-xl border border-red-200 p-5"><p>{lineage.error}</p><Button onClick={lineage.reload}>Thử lại</Button></div> : data && <>
        <div className="grid gap-3 md:grid-cols-3" aria-label="Chuỗi nguồn của hoạt động">
          <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">1 · Ranh giới nguồn</h2><p className="mt-3 text-sm">Cơ sở: {data.facility.name} · {data.facility.reference}</p><p className="mt-2 text-sm">Quy trình: {data.process?.name || "Chưa gắn"}</p><p className="mt-2 text-sm">Điểm đo: {data.measurementPoint?.reference || "Chưa gắn"}</p></section>
          <section className="rounded-xl border border-primary/40 bg-primary/5 p-5"><h2 className="font-semibold">2 · Hoạt động</h2><p className="mt-3 text-sm">{data.activity.activityReference}</p><p className="mt-2 text-sm">{data.activity.quantity} {data.activity.canonicalUnit} · {data.activity.sourceKind} · {data.activity.dataQualityLevel}</p><p className="mt-2 break-all text-xs text-muted-foreground">SHA-256: {data.activity.sourceSha256}</p><p className="mt-2 text-xs text-muted-foreground">{data.activity.periodStart} → {data.activity.periodEnd}</p></section>
          <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">3 · Bằng chứng & review</h2><p className="mt-3 text-sm">{data.evidence.length} chứng từ liên kết · {canApprove ? "Bằng chứng đã kiểm soát" : "Chưa đủ bằng chứng kiểm soát để duyệt"}</p><p className="mt-2 text-sm">Review: {data.latestReview ? `${data.latestReview.decision} · ${data.latestReview.reviewerName}` : "Chưa có"}</p>{data.latestReview && <p className="mt-2 text-sm text-muted-foreground">{data.latestReview.notes}</p>}</section>
        </div>
        <section className="space-y-3"><h2 className="font-semibold">Chứng từ liên kết</h2>{!data.evidence.length ? <EmptyWorkspace>Hoạt động này chưa gắn chứng từ.</EmptyWorkspace> : data.evidence.map(row => <div key={row.id} className="rounded-xl border bg-card p-4"><p className="font-medium">{row.name} · {row.status}</p><p className="mt-2 break-all text-xs text-muted-foreground">{row.checksumSha256 || "Thiếu SHA-256"}</p></div>)}</section>
        {review && <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-5"><h2 className="font-semibold">Review nội bộ có danh tính</h2><p className="text-sm text-muted-foreground">Chỉ quản trị viên có quyền ghi. Duyệt yêu cầu mọi chứng từ được khóa hoặc third_party_verified và có SHA-256 hợp lệ. DQL cao không tự chứng minh đã xác minh độc lập.</p><fieldset disabled={!canWrite || busy} className="space-y-4"><label className="block text-sm">Quyết định<select value={decision} className="mt-2 w-full rounded-md border bg-background p-2" onChange={event => setDecision(event.target.value as typeof decision)}><option value="needs_information">Yêu cầu bổ sung</option><option value="rejected">Từ chối</option><option value="approved" disabled={!canApprove}>Duyệt bằng chứng đã kiểm soát</option></select></label><label className="block text-sm">Lý do review<textarea required minLength={10} maxLength={4000} className="mt-2 min-h-24 w-full rounded-md border bg-background p-2" value={notes} onChange={event => setNotes(event.target.value)} /></label><Button type="submit" disabled={decision === "approved" && !canApprove}>{busy ? "Đang lưu…" : "Lưu review"}</Button></fieldset>{message && <p role="status" className="text-sm">{message}</p>}</form>}
        <div className="flex flex-wrap gap-4 text-sm text-primary"><Link prefetch={false} href={routes.toAppPath("/evidence")}>Mở chứng từ →</Link><Link prefetch={false} href={routes.toAppPath("/carbon-operations")}>Tính toán & phân bổ →</Link><Link prefetch={false} href={routes.toAppPath(review ? "/evidence-graph" : "/verification")}>{review ? "Xem đồ thị" : "Mở review"} →</Link></div>
      </>}
    </>}
  </WorkspaceFrame>;
}
