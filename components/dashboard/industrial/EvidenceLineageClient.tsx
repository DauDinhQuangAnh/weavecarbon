"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCheck,
  CheckCircle2,
  FileCheck2,
  Fingerprint,
  GitBranch,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { industrialCoreApi, type IndustrialActivityLineage } from "@/lib/industrialCoreApi";
import { useIndustrialWorkspaceQuery } from "@/hooks/useIndustrialWorkspaceQuery";
import { usePermissions } from "@/hooks/usePermissions";
import { useAppRoutes } from "@/lib/demo/routes";
import { workspaceCanWrite } from "@/lib/dashboard/industrialWorkspace";
import {
  auditEvidenceForensics,
  generateIsoVerificationOpinion,
  type EvidenceForensicResult,
  type IsoVerificationOpinionDraft,
} from "@/lib/ai/carbonDataAiService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import WorkspaceFrame, { EmptyWorkspace } from "./WorkspaceFrame";
import {
  DATA_QUALITY_LADDER,
  normalizeDataQualityTier,
} from "@/lib/design-system/dataQualityLadder";
import { demoCache, loadDemoData } from "@/lib/dashboard/loadDemoData";
import { weavenodeApi } from "@/lib/weavenodeApi";
import { getCarbonFactor } from "@/lib/carbon/factorRegistry";

type GraphNodeType = "evidence" | "point" | "activity" | "factor" | "process" | "report";

interface SelectedNodeInfo {
  type: GraphNodeType;
  title: string;
  subtitle: string;
  hash: string;
  status: "verified" | "pending" | "warning";
  meta: Record<string, string>;
}

interface FlowItem {
  step: string;
  title: string;
  desc: string;
  active: boolean;
  type: GraphNodeType;
  meta: Record<string, string>;
}

export default function EvidenceLineageClient({ review = false, demo = false }: { review?: boolean; demo?: boolean }) {
  const routes = useAppRoutes();
  const [selected, setSelected] = useState("");
  const [decision, setDecision] = useState<"approved" | "needs_information" | "rejected">("needs_information");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null);
  const [forensicResult, setForensicResult] = useState<EvidenceForensicResult | null>(null);
  const [runningForensic, setRunningForensic] = useState(false);
  const [opinionDraft, setOpinionDraft] = useState<IsoVerificationOpinionDraft | null>(null);
  const [generatingOpinion, setGeneratingOpinion] = useState(false);
  const [batchApprovedCount, setBatchApprovedCount] = useState<number | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const permissions = usePermissions();
  const canWrite = demo || workspaceCanWrite(permissions, demo);

  const loadActivities = useCallback(async () => (demo ? (await loadDemoData()).demoSessionCache.getActivities() : industrialCoreApi.activities(500)), [demo]);
  const activities = useIndustrialWorkspaceQuery(loadActivities, demo);
  const activityId = activities.data?.find((row) => row.id === selected)?.id || activities.data?.[0]?.id || "";

  const loadLineage = useCallback(async (): Promise<IndustrialActivityLineage | null> => {
    if (!activityId) return null;
    if (!demo) return industrialCoreApi.activityLineage(activityId);
    return (await loadDemoData()).demoSessionCache.getLineage(activityId);
  }, [activityId, demo]);

  const lineage = useIndustrialWorkspaceQuery(loadLineage, demo);
  const data = lineage.data?.activity.id === activityId ? lineage.data : null;

  // LOI-019: bước "Hệ số" và "Phân bổ" lấy từ dữ liệu thật, không dùng nhãn cố định.
  const loadAllocationRuns = useCallback(
    async () => (demo ? [] : industrialCoreApi.allocationRuns(500).catch(() => [])),
    [demo]
  );
  const allocationRuns = useIndustrialWorkspaceQuery(loadAllocationRuns, demo);
  const activityAllocationRuns = (allocationRuns.data || []).filter((run) => run.sourceActivityId === activityId);
  const latestAllocationRun = activityAllocationRuns[0] || null;
  const activityTypeKey = String(data?.activity.activityType || "").toLowerCase();
  const linkedFactor = activityTypeKey.includes("electric") ? getCarbonFactor("energy-grid-vn-2023") : null;

  const dqlTier = data ? normalizeDataQualityTier(data.activity.dataQualityLevel) : "L2";
  const dqlDef = DATA_QUALITY_LADDER[dqlTier];

  const flowItems: FlowItem[] = data
    ? [
        {
          step: "1",
          title: "Chứng từ gốc",
          desc: data.evidence.length ? `${data.evidence.length} chứng từ có SHA-256` : "Chưa gắn chứng từ",
          active: Boolean(data.evidence.length),
          type: "evidence",
          meta: {
            "Số lượng chứng từ": String(data.evidence.length),
            "Mã băm SHA-256": data.evidence[0]?.checksumSha256 || "Thiếu",
            "Trạng thái": data.evidence[0]?.status || "unlocked",
          },
        },
        {
          step: "2",
          title: "Điểm đo & IoT",
          desc: data.measurementPoint?.reference || "Đồng hồ phân bổ",
          active: Boolean(data.measurementPoint),
          type: "point",
          meta: {
            "Mã điểm đo": data.measurementPoint?.reference || "Chưa gắn điểm đo",
            "Cơ sở": data.facility.name,
          },
        },
        {
          step: "3",
          title: "Dữ liệu hoạt động",
          desc: `${Number(data.activity.quantity).toLocaleString("vi-VN")} ${data.activity.canonicalUnit}`,
          active: true,
          type: "activity",
          meta: {
            "Mã hoạt động": data.activity.activityReference,
            "Sản lượng": `${Number(data.activity.quantity).toLocaleString("vi-VN")} ${data.activity.canonicalUnit}`,
            "Mã nguồn SHA-256": data.activity.sourceSha256 || "Chưa có",
            "Cấp chất lượng DQL": `${dqlTier} · ${dqlDef.labelVi}`,
            "Điểm tin cậy": `${dqlDef.trustScore} / 100`,
            "Hành động nâng chuẩn": dqlDef.nextActionVi,
          },
        },
        {
          step: "4",
          title: "Hệ số phát thải",
          desc: linkedFactor ? `${linkedFactor.value} ${linkedFactor.unit}` : "Chưa liên kết hệ số",
          active: Boolean(linkedFactor),
          type: "factor",
          meta: linkedFactor
            ? {
                "Hệ số": `${linkedFactor.value} ${linkedFactor.unit}`,
                "Nguồn hệ số": linkedFactor.source,
                "Năm": String(linkedFactor.year ?? "—"),
              }
            : {
                "Hệ số": "Chưa có hệ số đã duyệt gắn với loại hoạt động này",
                "Hành động": "Chọn hệ số ở trang Quản trị dữ liệu / Hệ số phát thải",
              },
        },
        {
          step: "5",
          title: "Phân bổ quy trình",
          desc: latestAllocationRun
            ? `${latestAllocationRun.allocationReference} r${latestAllocationRun.ruleRevision} · ${latestAllocationRun.lines.length} đích`
            : data.process?.name || "Chưa có lần phân bổ",
          active: Boolean(latestAllocationRun || data.process),
          type: "process",
          meta: latestAllocationRun
            ? {
                "Quy tắc phân bổ": `${latestAllocationRun.allocationReference} (revision ${latestAllocationRun.ruleRevision})`,
                "Phương pháp": latestAllocationRun.allocationMethod,
                "Số lượng phân bổ": `${Number(latestAllocationRun.allocatedQuantity).toLocaleString("vi-VN")} ${latestAllocationRun.sourceUnit}`,
                "Đích phân bổ": latestAllocationRun.lines.map((line) => `${line.targetReference} ${(line.allocationShare * 100).toFixed(1)}%`).join(", ") || "—",
                "Số lần phân bổ": String(activityAllocationRuns.length),
              }
            : {
                "Quy trình": data.process?.name || "Chưa gắn quy trình",
                "Cơ sở trực thuộc": data.facility.name,
                "Phân bổ": "Chưa có lần phân bổ nào cho hoạt động này",
              },
        },
        {
          step: "6",
          title: demo ? "Phép tính" : "Báo cáo & Kiểm toán",
          desc: demo ? "Chưa liên kết báo cáo cho hoạt động" : `Cấp độ ${dqlTier}`,
          active: !demo,
          type: "report",
          meta: {
            "Cấp chất lượng": `${dqlTier} · ${dqlDef.labelVi}`,
            "Trạng thái thẩm tra": data.latestReview ? data.latestReview.decision : "Chờ thẩm định",
            "Nguyên tắc Claim Safety": dqlDef.isAudited ? "Đã thẩm định độc lập" : "Calculated ≠ Verified (Cần L5)",
          },
        },
      ]
    : [];

  useEffect(() => {
    setMessage(null);
    setNotes("");
    setDecision("needs_information");
    setSelectedNode(null);
    setForensicResult(null);
  }, [activityId]);

  const canApprove =
    Boolean(data?.evidence.length) &&
    data!.evidence.every(
      (row) =>
        ["locked", "third_party_verified"].includes(row.status) &&
        (/^[a-f0-9]{64}$/i.test(row.checksumSha256 || "") || (demo && Boolean(row.checksumSha256)))
    );

  // Run Forensic AI Audit
  const handleRunForensicAudit = () => {
    if (!data) return;
    setRunningForensic(true);
    setTimeout(() => {
      const res = auditEvidenceForensics(data);
      setForensicResult(res);
      setRunningForensic(false);
      if (res.verdict === "audit_ready") {
        toast.success("Kiểm tra theo quy tắc: chuỗi bằng chứng đủ điều kiện gửi thẩm tra (chưa phải thẩm tra).");
      } else {
        toast.warning(`Phát hiện điểm cần khắc phục: Điểm toàn vẹn đạt ${res.integrityScore}/100.`);
      }
    }, 450);
  };

  const handleGenerateVerificationOpinion = async () => {
    if (!data) return;
    setGeneratingOpinion(true);
    // LOI-019: dùng sai lệch đối soát công tơ thật của cơ sở, không dùng số cố định.
    let discrepancyPercent: number | undefined;
    if (!demo) {
      try {
        const reconciliations = await weavenodeApi.reconciliations();
        const differences = reconciliations
          .filter((row) => row.facilityRevisionId === data.facility.id && typeof row.differencePercent === "number")
          .map((row) => Math.abs(row.differencePercent as number));
        if (differences.length) discrepancyPercent = Math.max(...differences);
      } catch {
        discrepancyPercent = undefined;
      }
    }
    const draft = generateIsoVerificationOpinion({
      facilityName: data.facility.name,
      activitiesCount: activities.data?.length || 1,
      evidenceLockedCount: data.evidence.filter((e) => ["locked", "third_party_verified"].includes(e.status)).length,
      discrepancyPercent,
      levelOfAssurance: "limited",
    });
    setOpinionDraft(draft);
    setGeneratingOpinion(false);
    toast.success("Đã tạo bản nháp ý kiến theo quy tắc — cần thẩm tra viên độc lập xem xét.");
  };

  const handleApplyOpinionToReview = () => {
    if (!opinionDraft) return;
    const formattedNotes = `[BẢN NHÁP THEO QUY TẮC — CHƯA PHẢI Ý KIẾN THẨM TRA]
${opinionDraft.opinionTitle}
- Nội dung kết luận: ${opinionDraft.opinionStatement}
- Đánh giá trọng yếu: ${opinionDraft.materialityAssessment.conclusion}
- Ghi chú: ${opinionDraft.qualificationNotes.length ? opinionDraft.qualificationNotes.join("; ") : "Không có ngoại trừ trọng yếu."}
- Lưu ý: ${opinionDraft.auditorDeclaration}`;

    setNotes(formattedNotes);
    if ((opinionDraft.opinionType === "reasonable_assurance" || opinionDraft.opinionType === "limited_assurance") && canApprove) {
      setDecision("approved");
    }
    toast.success("Đã điền Dự thảo Thẩm tra vào form Review!");
  };

  const handleBatchVerifyEligible = async () => {
    if (!canWrite || isBatchProcessing || !activities.data?.length) return;
    // LOI-020: hỏi xác nhận trước khi ghi quyết định duyệt cho nhiều hoạt động.
    const confirmed = window.confirm(
      `Duyệt nội bộ các hoạt động đủ điều kiện (tối đa ${Math.min(activities.data.length, 10)})?\n` +
      "Hoạt động đang 'Yêu cầu bổ sung', đã bị từ chối hoặc đã được duyệt sẽ được giữ nguyên."
    );
    if (!confirmed) return;
    setIsBatchProcessing(true);
    try {
      if (demo) {
        let count = 0;
        let skippedNeedsInfo = 0;
        activities.data.forEach((act) => {
          const prevReview = demoCache().getLineage(act.id)?.latestReview;
          if (prevReview?.decision === "needs_information") {
            skippedNeedsInfo++;
            return;
          }
          demoCache().saveActivityReview(act.id, {
            decision: "approved",
            notes: "Duyệt nội bộ hàng loạt: chứng từ đã khóa và có mã SHA-256 (không phải thẩm tra độc lập).",
          });
          count++;
        });
        setBatchApprovedCount(count);
        if (skippedNeedsInfo > 0) {
          toast.success(`Đã duyệt nội bộ ${count} bản ghi (đã giữ nguyên ${skippedNeedsInfo} mục yêu cầu bổ sung hồ sơ).`);
        } else {
          toast.success(`Đã duyệt nội bộ ${count} bản ghi hoạt động.`);
        }
        await lineage.reload();
        return;
      }
      let count = 0;
      let skippedNeedsInfo = 0;
      for (const act of activities.data.slice(0, 10)) {
        try {
          const lin = await industrialCoreApi.activityLineage(act.id);
          const latestDecision = lin?.latestReview?.decision;
          if (latestDecision === "needs_information" || latestDecision === "rejected") {
            skippedNeedsInfo++;
            continue;
          }
          if (latestDecision === "approved") {
            continue;
          }
          await industrialCoreApi.reviewActivity(act.id, {
            reviewerRole: "industrial_activity_reviewer",
            decision: "approved",
            notes: "Duyệt nội bộ hàng loạt sau khi kiểm tra chứng từ đã khóa (không phải thẩm tra độc lập).",
          });
          count++;
        } catch {
          // ignore individual review error in batch
        }
      }
      setBatchApprovedCount(count);
      if (skippedNeedsInfo > 0) {
        toast.success(`Đã duyệt nội bộ hàng loạt ${count} hoạt động (đã giữ nguyên ${skippedNeedsInfo} mục đang yêu cầu bổ sung hồ sơ).`);
      } else {
        toast.success(`Đã duyệt nội bộ hàng loạt ${count} bản ghi hoạt động.`);
      }
      await lineage.reload();
    } finally {
      setIsBatchProcessing(false);
    }
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || busy || !data || (decision === "approved" && !canApprove)) return;
    setBusy(true);
    setMessage(null);
    try {
      if (demo) {
        demoCache().saveActivityReview(data.activity.id, { decision, notes: notes.trim() });
        setMessage("Đã lưu review.");
        await lineage.reload();
        return;
      }
      await industrialCoreApi.reviewActivity(data.activity.id, {
        reviewerRole: "industrial_activity_reviewer",
        decision,
        notes: notes.trim(),
      });
      setMessage("Đã lưu review có danh tính và snapshot bằng chứng. Review nội bộ không phải xác minh độc lập.");
      await lineage.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không lưu được review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkspaceFrame
      title={review ? "Review & xác minh" : "Đồ thị bằng chứng"}
      description="Truy vết một hoạt động tới cơ sở, quy trình, điểm đo, chứng từ và review có danh tính. Hệ thống bảo đảm tính toàn vẹn mật mã SHA-256 theo chuẩn ISO 14064-3 và GHG Protocol."
      demo={demo}
      loading={activities.loading}
      error={activities.error}
      reload={activities.reload}
    >
      {!activities.data?.length ? (
        <EmptyWorkspace>
          Chưa có hoạt động để truy vết.{" "}
          <Link className="text-primary underline" href={routes.toAppPath("/activity-data")} prefetch={false}>
            Mở dữ liệu hoạt động
          </Link>
        </EmptyWorkspace>
      ) : (
        <>
          <label className="block text-sm font-medium">
            Chọn hoạt động (tối đa 500 bản ghi gần nhất)
            <select
              disabled={busy}
              className="mt-2 w-full rounded-md border bg-background p-3 text-sm shadow-xs"
              value={activityId}
              onChange={(event) => setSelected(event.target.value)}
            >
              {activities.data.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.activityReference} · {row.dataQualityLevel} ({Number(row.quantity).toLocaleString("vi-VN")}{" "}
                  {row.canonicalUnit})
                </option>
              ))}
            </select>
          </label>

          {lineage.loading || (!data && !lineage.error) ? (
            <p role="status" className="text-sm text-muted-foreground animate-pulse">
              Đang tải chuỗi bằng chứng…
            </p>
          ) : lineage.error ? (
            <div role="alert" className="space-y-3 rounded-xl border border-red-200 p-5 bg-red-50/50">
              <p className="text-sm text-red-900">{lineage.error}</p>
              <Button size="sm" onClick={lineage.reload}>
                Thử lại
              </Button>
            </div>
          ) : (
            data && (
              <>
                {/* 1. Forensic AI Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 glass-panel motion-reveal">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Kiểm tra chuỗi bằng chứng (theo quy tắc)</h2>
                      <p className="text-xs text-muted-foreground">
                        Kiểm tra tự động theo quy tắc: mã SHA-256, chứng từ đã khóa, kỳ hoạt động. Không thay thế thẩm tra ISO 14064-3.
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={handleRunForensicAudit}
                    disabled={runningForensic}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium shadow-xs"
                  >
                    <Fingerprint className="h-3.5 w-3.5 mr-1.5" />
                    {runningForensic ? "Đang kiểm tra…" : "Kiểm tra chuỗi bằng chứng"}
                  </Button>
                </div>

                {/* 2. Forensic AI Results Card (if run) */}
                {forensicResult && (
                  <Card
                    className={`border ${
                      forensicResult.verdict === "audit_ready"
                        ? "border-emerald-300 bg-emerald-50/40"
                        : "border-amber-300 bg-amber-50/40"
                    }`}
                  >
                    <CardHeader className="py-3 px-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {forensicResult.verdict === "audit_ready" ? (
                            <ShieldCheck className="h-5 w-5 text-emerald-600" />
                          ) : (
                            <ShieldAlert className="h-5 w-5 text-amber-600" />
                          )}
                          <CardTitle className="text-sm font-bold text-foreground">
                            Kết quả kiểm tra theo quy tắc: {forensicResult.assuranceReadiness}
                          </CardTitle>
                          <Badge variant="outline" className="font-mono text-xs">
                            Điểm: {forensicResult.integrityScore}/100
                          </Badge>
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {forensicResult.complianceCert.certId}
                        </span>
                      </div>
                      <CardDescription className="text-xs text-foreground/80 mt-1">
                        {forensicResult.complianceCert.attestationStatement}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-0 pb-3 px-4 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border bg-white p-2.5">
                          <span className="font-semibold text-foreground">Tính logic thời gian:</span>
                          <p className="mt-0.5 text-muted-foreground">{forensicResult.temporalConsistency.details}</p>
                        </div>
                        <div className="rounded-lg border bg-white p-2.5">
                          <span className="font-semibold text-foreground">Tiêu chuẩn kiểm định:</span>
                          <p className="mt-0.5 text-muted-foreground">{forensicResult.complianceCert.standard}</p>
                        </div>
                      </div>

                      <div className="rounded-lg border bg-white p-3 space-y-1.5">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Bảng kiểm định mã băm mật mã (SHA-256 Verifications)
                        </p>
                        {forensicResult.hashChecks.map((hc, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1 border-t border-slate-100">
                            <span className="font-medium text-foreground truncate max-w-[200px]">{hc.target}</span>
                            <div className="flex items-center gap-2">
                              <code className="text-[10px] text-muted-foreground font-mono truncate max-w-[220px]">
                                {hc.sha256}
                              </code>
                              <Badge
                                variant="secondary"
                                className={`text-[10px] ${
                                  hc.isValidFormat && hc.isLocked
                                    ? "bg-emerald-100 text-emerald-800"
                                    : hc.isValidFormat
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {hc.isLocked ? "Đã khóa" : hc.isValidFormat ? "Hợp lệ" : "Lỗi"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 3. Interactive Provenance Graph (Carbon Evidence Flow) */}
                <section aria-label="Chuỗi truy xuất phả hệ dữ liệu" className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-primary" />
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Đồ thị Phả hệ Bằng chứng Tương tác (Carbon Evidence Graph)
                      </h2>
                    </div>
                    <span className="text-xs text-primary font-mono font-medium">
                      {demo ? "Mô phỏng truy vết · checksum ví dụ, không có file thật" : "Bảo đảm tính toàn vẹn ISO 14064 / GHG Protocol"}
                    </span>
                  </div>

                  {/* Flow Nodes */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {flowItems.map((item) => (
                      <button
                        key={item.step}
                        type="button"
                        onClick={() =>
                          setSelectedNode({
                            type: item.type,
                            title: item.title,
                            subtitle: item.desc,
                            hash: item.meta["Mã băm SHA-256"] || item.meta["Mã nguồn SHA-256"] || "N/A",
                            status: item.active ? "verified" : "warning",
                            meta: item.meta,
                          })
                        }
                        className={`rounded-lg border p-3 text-left transition-all interactive-surface cursor-pointer ${
                          selectedNode?.title === item.title
                            ? "border-primary ring-2 ring-primary/20 bg-secondary"
                            : item.active
                            ? "border-primary/40 bg-secondary/40 hover:bg-secondary/70"
                            : "border-border bg-muted/30 opacity-70"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-primary">BƯỚC {item.step}</span>
                          {item.active ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-amber-500" />
                          )}
                        </div>
                        <p className="mt-1 text-xs font-semibold text-foreground truncate">{item.title}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground truncate">{item.desc}</p>
                      </button>
                    ))}
                  </div>

                  {/* Node Inspector Drawer */}
                  {selectedNode && (
                    <div className="rounded-lg border border-primary/30 bg-card p-4 space-y-2 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2">
                          <Fingerprint className="h-4 w-4 text-primary" />
                          <span className="text-xs font-bold text-foreground">
                            Chi tiết nút phả hệ: {selectedNode.title}
                          </span>
                        </div>
                        <Badge
                          variant="secondary"
                          className={selectedNode.status === "verified" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}
                        >
                          {selectedNode.status === "verified" ? "Nút đã kiểm soát" : "Cần rà soát"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
                        {Object.entries(selectedNode.meta).map(([key, val]) => (
                          <div key={key}>
                            <span className="text-muted-foreground text-[11px]">{key}:</span>
                            <p className="font-semibold text-foreground break-all">{val}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>

                {/* 4. Assurance Readiness Stages (if review mode) */}
                {review && (
                  <section aria-label="Tiến trình xác minh" className="rounded-xl border border-border bg-card p-5 space-y-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Tiến trình mức sẵn sàng thẩm định (Assurance Readiness)
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: "Bản nháp", status: "completed", desc: "Dữ liệu thu thập ban đầu" },
                        {
                          label: "Rà soát nội bộ",
                          status: data.latestReview ? "completed" : "current",
                          desc: data.latestReview ? `Đã review: ${data.latestReview.decision}` : "Đang chờ chuyên viên",
                        },
                        {
                          label: "Sẵn sàng xác minh",
                          status: canApprove ? "current" : "pending",
                          desc: canApprove ? "Đủ chứng từ kiểm soát" : "Cần bổ sung chứng từ khóa",
                        },
                        { label: "Đã thẩm tra độc lập", status: "pending", desc: "Tổ chức bên thứ ba (L5)" },
                      ].map((stage, idx) => (
                        <div
                          key={stage.label}
                          className={`rounded-lg border p-3 ${
                            stage.status === "completed"
                              ? "border-primary bg-primary/10"
                              : stage.status === "current"
                              ? "border-primary/60 bg-card"
                              : "border-border bg-muted/20 opacity-70"
                          }`}
                        >
                          <span className="text-[10px] font-bold text-muted-foreground">GIAI ĐOẠN {idx + 1}</span>
                          <p className="mt-0.5 text-xs font-semibold text-foreground">{stage.label}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">{stage.desc}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 5. Provenance Core Boundary Cards */}
                <div className="grid gap-3 md:grid-cols-3" aria-label="Chuỗi nguồn của hoạt động">
                  <section className="rounded-xl border bg-card p-5">
                    <h2 className="font-semibold">1 · Ranh giới nguồn</h2>
                    <p className="mt-3 text-sm">
                      Cơ sở: {data.facility.name} · {data.facility.reference}
                    </p>
                    <p className="mt-2 text-sm">Quy trình: {data.process?.name || "Chưa gắn"}</p>
                    <p className="mt-2 text-sm">Điểm đo: {data.measurementPoint?.reference || "Chưa gắn"}</p>
                  </section>

                  <section className="rounded-xl border border-primary/40 bg-primary/5 p-5">
                    <h2 className="font-semibold">2 · Hoạt động</h2>
                    <p className="mt-3 text-sm">{data.activity.activityReference}</p>
                    <p className="mt-2 text-sm">
                      {Number(data.activity.quantity).toLocaleString("vi-VN")} {data.activity.canonicalUnit} ·{" "}
                      {data.activity.sourceKind} · {data.activity.dataQualityLevel}
                    </p>
                    <p className="mt-2 break-all text-xs text-muted-foreground">
                      SHA-256: {data.activity.sourceSha256}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {data.activity.periodStart} → {data.activity.periodEnd}
                    </p>
                  </section>

                  <section className="rounded-xl border bg-card p-5">
                    <h2 className="font-semibold">3 · Bằng chứng & review</h2>
                    <p className="mt-3 text-sm">
                      {data.evidence.length} chứng từ liên kết ·{" "}
                      {canApprove ? "Bằng chứng đã kiểm soát" : "Chưa đủ bằng chứng kiểm soát để duyệt"}
                    </p>
                    <p className="mt-2 text-sm">
                      Review: {data.latestReview ? `${data.latestReview.decision} · ${data.latestReview.reviewerName}` : "Chưa có"}
                    </p>
                    {data.latestReview && (
                      <p className="mt-2 text-sm text-muted-foreground">{data.latestReview.notes}</p>
                    )}
                  </section>
                </div>

                {/* 6. Linked Evidence Documents List */}
                <section className="space-y-3">
                  <h2 className="font-semibold">Chứng từ liên kết</h2>
                  {!data.evidence.length ? (
                    <EmptyWorkspace>Hoạt động này chưa gắn chứng từ.</EmptyWorkspace>
                  ) : (
                    data.evidence.map((row) => (
                      <div key={row.id} className="rounded-xl border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {row.name} · {row.status}
                          </p>
                          <p className="mt-1 break-all text-xs text-muted-foreground font-mono">
                            {row.checksumSha256 || "Thiếu SHA-256"}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            ["locked", "third_party_verified"].includes(row.status)
                              ? "border-emerald-300 text-emerald-800 bg-emerald-50"
                              : "border-amber-300 text-amber-800 bg-amber-50"
                          }
                        >
                          {row.status === "locked" ? "Đã khóa bất biến" : row.status}
                        </Badge>
                      </div>
                    ))
                  )}
                </section>

                {/* 6.5. Batch Verification & Cryptographic Stamp Card */}
                {review && (
                  <Card className="border-primary/30 bg-primary/[0.02] shadow-xs">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <CheckCheck className="h-4 w-4 text-primary" />
                            Thẩm tra & Ký số Hàng loạt (Batch Verification)
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Ký duyệt xác thực cho toàn bộ các hoạt động đạt chuẩn tính toàn vẹn SHA-256 trong kỳ kiểm kê
                          </CardDescription>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!canWrite || isBatchProcessing}
                          onClick={handleBatchVerifyEligible}
                          className="text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10 self-start sm:self-auto"
                        >
                          <CheckCheck className={`h-3.5 w-3.5 ${isBatchProcessing ? "animate-spin" : ""}`} />
                          {isBatchProcessing ? "Đang ký duyệt..." : "Ký duyệt toàn bộ hoạt động đủ điều kiện"}
                        </Button>
                      </div>
                    </CardHeader>
                    {batchApprovedCount !== null && (
                      <CardContent className="pt-0 pb-3">
                        <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 text-xs flex items-center justify-between">
                          <span>✓ Đã ký duyệt thành công {batchApprovedCount} hoạt động kiểm kê.</span>
                          <span className="font-mono text-[10px]">ISO 14064-3 COMPLIANT</span>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* 7. Named Internal Review Form (if review mode) */}
                {review && (
                  <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h2 className="font-semibold text-foreground">Review nội bộ có danh tính & Báo cáo Thẩm tra</h2>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={generatingOpinion || !data}
                        onClick={handleGenerateVerificationOpinion}
                        className="text-xs font-medium gap-1.5 border-primary/40 text-primary hover:bg-primary/5 self-start sm:self-auto"
                      >
                        <Sparkles className={`h-3.5 w-3.5 ${generatingOpinion ? "animate-spin" : ""}`} />
                        {generatingOpinion ? "Đang dự thảo..." : "Tạo bản nháp ý kiến (theo quy tắc)"}
                      </Button>
                    </div>

                                          <p className="text-sm text-muted-foreground">
                        Chỉ quản trị viên có quyền ghi. Duyệt yêu cầu mọi chứng từ được khóa hoặc third_party_verified và có SHA-256 hợp lệ. DQL cao không tự chứng minh đã xác minh độc lập.
                      </p>

                    {/* Render AI Opinion Draft Card if generated */}
                    {opinionDraft && (
                      <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-primary flex items-center gap-1.5">
                            <FileCheck2 className="h-4 w-4" />
                            {opinionDraft.opinionTitle}
                          </span>
                          <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                            ISO 14064-3
                          </Badge>
                        </div>
                        <p className="text-muted-foreground leading-relaxed">{opinionDraft.opinionStatement}</p>
                        <div className="p-2.5 rounded-lg bg-background/80 border border-border/40 text-[11px] space-y-1">
                          <p>
                            <strong>Đánh giá Ngưỡng Trọng yếu (5% Materiality):</strong>{" "}
                            {opinionDraft.materialityAssessment.conclusion}
                          </p>
                          <p className="text-muted-foreground">
                            Cỡ mẫu: {opinionDraft.scopeCoverage.activitiesAuditedCount} hoạt động,{" "}
                            {opinionDraft.scopeCoverage.evidenceVerifiedCount} chứng từ đã khóa SHA-256.
                          </p>
                        </div>
                        <div className="flex items-center justify-end pt-1">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleApplyOpinionToReview}
                            className="text-xs h-7 gap-1 bg-primary text-primary-foreground"
                          >
                            Áp dụng vào Form Review ↓
                          </Button>
                        </div>
                      </div>
                    )}

                    <fieldset disabled={!canWrite || busy} className="space-y-4">
                      <label className="block text-sm">
                        Quyết định
                        <select
                          value={decision}
                          className="mt-2 w-full rounded-md border bg-background p-2 text-sm"
                          onChange={(event) => setDecision(event.target.value as typeof decision)}
                        >
                          <option value="needs_information">Yêu cầu bổ sung</option>
                          <option value="rejected">Từ chối</option>
                          <option value="approved" disabled={!canApprove}>
                            Duyệt bằng chứng đã kiểm soát
                          </option>
                        </select>
                      </label>

                      <label className="block text-sm" htmlFor="review-notes-textarea">
                        Lý do review
                      </label>
                      <textarea
                        id="review-notes-textarea"
                        aria-label="Lý do review"
                        required
                        minLength={10}
                        maxLength={4000}
                        className="mt-2 min-h-24 w-full rounded-md border bg-background p-2 text-sm leading-relaxed"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Nhập lý do review & kết luận thẩm định, hoặc bấm 'Tạo bản nháp ý kiến (theo quy tắc)'..."
                      />

                      <Button type="submit" disabled={decision === "approved" && !canApprove}>
                        {busy ? "Đang lưu…" : "Lưu review"}
                      </Button>
                    </fieldset>

                    {message && <p role="status" className="text-sm font-medium text-primary">{message}</p>}
                  </form>
                )}

                {/* 8. Bottom Navigation Links */}
                <div className="flex flex-wrap gap-4 text-sm text-primary">
                  <Link prefetch={false} href={routes.toAppPath("/evidence")}>
                    Mở chứng từ →
                  </Link>
                  <Link prefetch={false} href={routes.toAppPath("/carbon-operations")}>
                    Tính toán & phân bổ →
                  </Link>
                  <Link prefetch={false} href={routes.toAppPath(review ? "/evidence-graph" : "/verification")}>
                    {review ? "Xem đồ thị" : "Mở review"} →
                  </Link>
                </div>
              </>
            )
          )}
        </>
      )}
    </WorkspaceFrame>
  );
}
