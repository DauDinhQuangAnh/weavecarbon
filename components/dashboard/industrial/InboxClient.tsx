"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lightbulb,
  Search,
  Sparkles,
} from "lucide-react";
import { industrialCoreApi } from "@/lib/industrialCoreApi";
import { dataGovernanceApi } from "@/lib/dataGovernanceApi";
import { listEvidenceV2 } from "@/lib/weave-v2/evidenceV2Api";
import { useIndustrialWorkspaceQuery } from "@/hooks/useIndustrialWorkspaceQuery";
import { useAppRoutes } from "@/lib/demo/routes";
import { workspaceTasks } from "@/lib/dashboard/industrialWorkspace";
import { resolveInboxTaskWithAi, type TaskResolutionAiAdvice } from "@/lib/ai/carbonDataAiService";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import WorkspaceFrame, { EmptyWorkspace } from "./WorkspaceFrame";

type TaskStatus = "pending" | "in_progress" | "resolved";

export default function InboxClient({ demo = false }: { demo?: boolean }) {
  const routes = useAppRoutes();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusMap, setStatusMap] = useState<Record<string, TaskStatus>>({});
  const [activeTaskAi, setActiveTaskAi] = useState<{
    id: string;
    title: string;
    reason: string;
    path: string;
    category: string;
    priority: string;
    advice: TaskResolutionAiAdvice;
  } | null>(null);

  const load = useCallback(async () => {
    if (demo) {
      const { INDUSTRIAL_DEMO, DEMO_EVIDENCE, DEMO_FACTORS } = await import("@/lib/dashboard/industrialDemoData");
      return workspaceTasks(INDUSTRIAL_DEMO.activities, DEMO_EVIDENCE, DEMO_FACTORS);
    }
    const [activities, evidence, factors] = await Promise.all([
      industrialCoreApi.activities(500),
      listEvidenceV2(),
      dataGovernanceApi.factorProposals(),
    ]);
    return workspaceTasks(activities, evidence.items, factors);
  }, [demo]);

  const query = useIndustrialWorkspaceQuery(load, demo);
  const dataList = query.data;
  const baseTasks = useMemo(() => dataList || [], [dataList]);

  // Categorize tasks
  const enrichedTasks = useMemo(() => {
    return baseTasks.map((t) => {
      let category = "general";
      let priority: "critical" | "high" | "medium" | "low" = "medium";

      if (t.path.includes("evidence") || t.reason.toLowerCase().includes("chứng từ") || t.reason.toLowerCase().includes("checksum")) {
        category = "evidence";
        priority = "critical";
      } else if (t.path.includes("data-quality") || t.reason.toLowerCase().includes("factor")) {
        category = "factor";
        priority = "high";
      } else if (t.path.includes("activity") || t.reason.toLowerCase().includes("nguồn")) {
        category = "activity";
        priority = "high";
      }

      const status = statusMap[t.id] || "pending";
      return {
        ...t,
        category,
        priority,
        status,
      };
    });
  }, [baseTasks, statusMap]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return enrichedTasks.filter((t) => {
      const matchSearch = `${t.title} ${t.reason}`.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;

      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      return true;
    });
  }, [enrichedTasks, search, categoryFilter]);

  // Run AI Advisor on a task
  const handleConsultAi = (task: typeof enrichedTasks[0], e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const advice = resolveInboxTaskWithAi({
      id: task.id,
      title: task.title,
      reason: task.reason,
      category: task.category,
      priority: task.priority,
    });
    setActiveTaskAi({
      ...task,
      advice,
    });
  };

  // Update status
  const handleUpdateStatus = (taskId: string, newStatus: TaskStatus, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStatusMap((prev) => ({ ...prev, [taskId]: newStatus }));
    toast.success(
      newStatus === "resolved"
        ? "Đã đánh dấu công việc Hoàn thành."
        : newStatus === "in_progress"
        ? "Đã chuyển sang Đang xử lý."
        : "Đã chuyển về Chờ xử lý."
    );
  };

  const pendingCount = enrichedTasks.filter((t) => t.status === "pending").length;
  const resolvedCount = enrichedTasks.filter((t) => t.status === "resolved").length;

  return (
    <WorkspaceFrame
      title="Hộp thư công việc"
      description="Trung tâm điều phối công việc và kiểm tra tính toàn vẹn dữ liệu phát thải. Tự động phát hiện các hoạt động thiếu bằng chứng, hệ số chưa phê duyệt và đề xuất hướng xử lý bằng AI."
      demo={demo}
      loading={query.loading}
      error={query.error}
      reload={query.reload}
    >
      {/* 1. Header Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">Việc cần xử lý</span>
          <p className="mt-1 text-2xl font-bold text-foreground">{pendingCount}</p>
          <span className="text-[11px] text-amber-600 font-medium">Human-in-the-loop review</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">Bằng chứng cần đối soát</span>
          <p className="mt-1 text-2xl font-bold text-primary">
            {enrichedTasks.filter((t) => t.category === "evidence").length}
          </p>
          <span className="text-[11px] text-muted-foreground">Kiểm tra SHA-256</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">Hệ số chờ phê chuẩn</span>
          <p className="mt-1 text-2xl font-bold text-blue-600">
            {enrichedTasks.filter((t) => t.category === "factor").length}
          </p>
          <span className="text-[11px] text-muted-foreground">Phê duyệt quản trị DQL</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">Đã giải quyết</span>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{resolvedCount}</p>
          <span className="text-[11px] text-muted-foreground">Hoàn tất trong kỳ</span>
        </div>
      </div>

      {/* 2. Filter & Search Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Tìm công việc"
            placeholder="Tìm công việc cần xử lý…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <select
          aria-label="Lọc theo phân loại"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-xs"
        >
          <option value="all">Tất cả phân loại</option>
          <option value="evidence">Bằng chứng & Hóa đơn</option>
          <option value="factor">Hệ số phát thải</option>
          <option value="activity">Dữ liệu hoạt động</option>
        </select>
      </div>

      {/* 3. AI Task Copilot Drawer / Card (if active) */}
      {activeTaskAi && (
        <Card className="border border-primary/40 bg-primary/5 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-sm font-bold text-foreground">
                AI Task Copilot: Hướng dẫn xử lý &ldquo;{activeTaskAi.title}&rdquo;
              </h2>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setActiveTaskAi(null)}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              Đóng
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border bg-white p-3 space-y-1">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                Nguyên nhân gốc rễ & Rủi ro kiểm toán:
              </span>
              <p className="text-muted-foreground">{activeTaskAi.advice.rootCause}</p>
              <p className="text-amber-800 font-medium mt-1">⚠️ {activeTaskAi.advice.auditExposure}</p>
            </div>

            <div className="rounded-lg border bg-white p-3 space-y-1">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-primary" />
                Soạn sẵn giải pháp / Email yêu cầu:
              </span>
              <p className="italic text-muted-foreground bg-slate-50 p-2 rounded border border-slate-100">
                &ldquo;{activeTaskAi.advice.draftActionText}&rdquo;
              </p>
              {activeTaskAi.advice.suggestedProxyOrFactor && (
                <p className="text-primary font-medium mt-1">
                  💡 Gợi ý hệ số: {activeTaskAi.advice.suggestedProxyOrFactor}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1 text-xs">
            <span className="font-semibold text-foreground">Các bước giải quyết đề xuất:</span>
            <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
              {activeTaskAi.advice.stepByStepAction.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-primary/20">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => handleUpdateStatus(activeTaskAi.id, "resolved", e)}
                className="h-8 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Đánh dấu Đã hoàn thành
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => handleUpdateStatus(activeTaskAi.id, "in_progress", e)}
                className="h-8 text-xs"
              >
                <Clock className="h-3.5 w-3.5 mr-1" />
                Chuyển sang Đang xử lý
              </Button>
            </div>

            <Link
              prefetch={false}
              href={routes.toAppPath(activeTaskAi.path)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              Mở trực tiếp trang xử lý ({activeTaskAi.path}) →
            </Link>
          </div>
        </Card>
      )}

      {/* 4. Tasks List */}
      {!filteredTasks.length ? (
        <EmptyWorkspace>Không có công việc phù hợp trong dữ liệu đã tải.</EmptyWorkspace>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <Link
              key={task.id}
              prefetch={false}
              href={routes.toAppPath(task.path)}
              className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 transition-all hover:border-primary/80 ${
                task.status === "resolved"
                  ? "border-emerald-200 bg-emerald-50/20 opacity-80"
                  : task.priority === "critical"
                  ? "border-amber-200 bg-card hover:bg-amber-50/20"
                  : "border-border bg-card hover:bg-muted/30"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {task.path.replace("/", "")}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold uppercase ${
                      task.priority === "critical"
                        ? "border-red-300 bg-red-50 text-red-800"
                        : task.priority === "high"
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-blue-300 bg-blue-50 text-blue-800"
                    }`}
                  >
                    {task.priority === "critical" ? "Khẩn cấp" : task.priority === "high" ? "Ưu tiên cao" : "Tiêu chuẩn"}
                  </Badge>
                  {task.status === "resolved" && (
                    <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold">
                      Đã giải quyết
                    </Badge>
                  )}
                  {task.status === "in_progress" && (
                    <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-800 font-semibold">
                      Đang xử lý
                    </Badge>
                  )}
                  <h2 className="font-semibold text-foreground text-sm">{task.title}</h2>
                </div>
                <p className="text-xs text-muted-foreground">{task.reason}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => handleConsultAi(task, e)}
                  className="h-8 border-primary/30 text-primary hover:bg-primary/10 text-xs font-medium flex items-center gap-1 shadow-2xs"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Trợ lý AI
                </Button>

                <span className="text-xs font-semibold text-primary inline-flex items-center gap-1">
                  Mở để xử lý →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </WorkspaceFrame>
  );
}
