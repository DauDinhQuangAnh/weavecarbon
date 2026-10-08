"use client";
import { useCallback } from "react";
import Link from "next/link";
import { useAppRoutes } from "@/lib/demo/routes";
import { industrialCoreApi } from "@/lib/industrialCoreApi";
import { listEvidenceV2 } from "@/lib/weave-v2/evidenceV2Api";
import { usePermissions } from "@/hooks/usePermissions";
import { useIndustrialWorkspaceQuery } from "@/hooks/useIndustrialWorkspaceQuery";
import { workspaceCanWrite } from "@/lib/dashboard/industrialWorkspace";
import { demoSessionCache } from "@/lib/dashboard/demoSessionCache";
import ActivityOperationsPanel from "@/components/dashboard/carbon-operations/ActivityOperationsPanel";
import WorkspaceFrame from "./WorkspaceFrame";

export default function ActivityDataClient({ demo = false }: { demo?: boolean }) {
  const routes = useAppRoutes();
  const load = useCallback(async () => {
    if (demo) {
      const demoData = (await import("@/lib/dashboard/industrialDemoData")).INDUSTRIAL_DEMO;
      const activities = demoSessionCache.getActivities();
      return { ...demoData, activities };
    }
    const [facilities, processes, activities, measurementPoints, evidence] = await Promise.all([industrialCoreApi.facilities(), industrialCoreApi.processes(), industrialCoreApi.activities(500), industrialCoreApi.measurementPoints(), listEvidenceV2()]);
    return { facilities, processes, activities, measurementPoints, evidence: evidence.items };
  }, [demo]);
  const query = useIndustrialWorkspaceQuery(load, demo);
  const canWrite = workspaceCanWrite(usePermissions(), demo);
  return <WorkspaceFrame title="Dữ liệu hoạt động" description="Thu thập hoạt động với kỳ báo cáo, đơn vị chuẩn, nguồn và bằng chứng. Danh sách hiển thị tối đa 500 bản ghi gần nhất; số lượng hoạt động chưa phải kết quả phát thải." demo={demo} loading={query.loading} error={query.error} reload={query.reload}>
    {query.data && (demo ? <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="font-semibold">Sổ hoạt động minh họa · chỉ đọc</h2>{query.data.activities.map(row => <article key={row.id} className="rounded-lg bg-muted/30 p-4"><h3 className="font-medium">{row.activityReference}</h3><p className="mt-2 text-sm text-muted-foreground">{row.quantity} {row.canonicalUnit} · {row.sourceKind} · {row.dataQualityLevel}</p><p className="mt-2 text-xs text-muted-foreground">{row.periodStart} → {row.periodEnd}</p><Link prefetch={false} href={routes.toAppPath("/evidence-graph")} className="mt-3 inline-block text-sm text-primary">Xem chuỗi bằng chứng minh họa →</Link></article>)}</section> : <ActivityOperationsPanel {...query.data} canWrite={canWrite} readOnlyMessage="Chỉ quản trị viên có quyền ghi và gói đang hoạt động được thêm hoặc review dữ liệu. Demo chỉ đọc." onCreated={() => void query.reload()} />)}
  </WorkspaceFrame>;
}
