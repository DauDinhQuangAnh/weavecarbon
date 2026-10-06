"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { industrialCoreApi } from "@/lib/industrialCoreApi";
import { dataGovernanceApi } from "@/lib/dataGovernanceApi";
import { listEvidenceV2 } from "@/lib/weave-v2/evidenceV2Api";
import { useIndustrialWorkspaceQuery } from "@/hooks/useIndustrialWorkspaceQuery";
import { useAppRoutes } from "@/lib/demo/routes";
import { WORKSPACE_DEMO, workspaceTasks } from "@/lib/dashboard/industrialWorkspace";
import { Input } from "@/components/ui/input";
import WorkspaceFrame, { EmptyWorkspace } from "./WorkspaceFrame";

export default function InboxClient({ demo = false }: { demo?: boolean }) {
  const routes = useAppRoutes();
  const [search, setSearch] = useState("");
  const load = useCallback(async () => {
    if (demo) return workspaceTasks(WORKSPACE_DEMO.activities, [], []);
    const [activities, evidence, factors] = await Promise.all([industrialCoreApi.activities(500), listEvidenceV2(), dataGovernanceApi.factorProposals()]);
    return workspaceTasks(activities, evidence.items, factors);
  }, [demo]);
  const query = useIndustrialWorkspaceQuery(load, demo);
  const tasks = (query.data || []).filter(task => `${task.title} ${task.reason}`.toLowerCase().includes(search.toLowerCase()));
  return <WorkspaceFrame title="Hộp thư công việc" description="Việc cần xử lý được suy ra từ trạng thái hoạt động, chứng từ và factor đang có. Phạm vi hoạt động là 500 bản ghi gần nhất; đây không phải danh sách đầy đủ các yêu cầu tuân thủ." demo={demo} loading={query.loading} error={query.error} reload={query.reload}>
    <Input aria-label="Tìm công việc" placeholder="Tìm công việc cần xử lý…" value={search} onChange={event => setSearch(event.target.value)} />
    {!tasks.length ? <EmptyWorkspace>Không có công việc phù hợp trong dữ liệu đã tải.</EmptyWorkspace> : <div className="space-y-3">{tasks.map(task => <Link key={task.id} prefetch={false} href={routes.toAppPath(task.path)} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 hover:border-primary"><div><h2 className="font-semibold">{task.title}</h2><p className="mt-1 text-sm text-muted-foreground">{task.reason}</p></div><span className="text-sm text-primary">Mở để xử lý →</span></Link>)}</div>}
  </WorkspaceFrame>;
}
