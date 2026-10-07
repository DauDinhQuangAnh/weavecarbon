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
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <span className="text-xs font-medium text-muted-foreground">Việc cần xử lý</span>
        <p className="mt-2 text-2xl font-bold text-foreground">{(query.data || []).length}</p>
        <span className="text-[11px] text-amber-600 font-medium">Human-in-the-loop review</span>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <span className="text-xs font-medium text-muted-foreground">Bằng chứng cần đối soát</span>
        <p className="mt-2 text-2xl font-bold text-primary">{(query.data || []).filter(t => t.path.includes("evidence")).length}</p>
        <span className="text-[11px] text-muted-foreground">Kiểm tra SHA-256</span>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 col-span-2 sm:col-span-1">
        <span className="text-xs font-medium text-muted-foreground">Chất lượng DQL</span>
        <p className="mt-2 text-2xl font-bold text-emerald-600">L3 - L5 Target</p>
        <span className="text-[11px] text-muted-foreground">Mục tiêu kiểm toán</span>
      </div>
    </div>
    <Input aria-label="Tìm công việc" placeholder="Tìm công việc cần xử lý…" value={search} onChange={event => setSearch(event.target.value)} />
    {!tasks.length ? <EmptyWorkspace>Không có công việc phù hợp trong dữ liệu đã tải.</EmptyWorkspace> : <div className="space-y-3">{tasks.map(task => <Link key={task.id} prefetch={false} href={routes.toAppPath(task.path)} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 hover:border-primary transition-colors"><div><div className="flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">{task.path.replace("/", "")}</span><h2 className="font-semibold">{task.title}</h2></div><p className="mt-1 text-sm text-muted-foreground">{task.reason}</p></div><span className="text-sm font-medium text-primary">Mở để xử lý →</span></Link>)}</div>}
  </WorkspaceFrame>;
}
