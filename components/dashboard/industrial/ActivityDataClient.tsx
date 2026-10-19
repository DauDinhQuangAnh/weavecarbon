"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Download,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { useAppRoutes } from "@/lib/demo/routes";
import { industrialCoreApi } from "@/lib/industrialCoreApi";
import { listEvidenceV2 } from "@/lib/weave-v2/evidenceV2Api";
import { usePermissions } from "@/hooks/usePermissions";
import { useIndustrialWorkspaceQuery } from "@/hooks/useIndustrialWorkspaceQuery";
import { workspaceCanWrite, csvText } from "@/lib/dashboard/industrialWorkspace";
import { demoSessionCache } from "@/lib/dashboard/demoSessionCache";
import { analyzeActivityAnomalies, type ActivityAnomalyResult } from "@/lib/ai/carbonDataAiService";
import { sha256CanonicalJson } from "@/lib/industrialOperations";
import { AiDocumentImportModal } from "@/components/ui/AiDocumentImportModal";
import CameraScanner from "@/components/ui/CameraScanner";
import {
  DATA_QUALITY_LADDER,
  normalizeDataQualityTier,
  calculateDatasetDqi,
  type DataQualityTier,
} from "@/lib/design-system/dataQualityLadder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import WorkspaceFrame from "./WorkspaceFrame";

const emptyForm = {
  activityReference: "",
  facilityRevisionId: "",
  processRevisionId: "",
  measurementPointRevisionId: "",
  activityType: "electricity",
  periodStart: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  periodEnd: new Date().toISOString().slice(0, 10),
  quantity: "",
  canonicalUnit: "kWh",
  sourceKind: "invoice" as "invoice" | "meter" | "plc" | "sensor" | "supplier" | "manual",
  dataQualityLevel: "L2" as "L1" | "L2" | "L3" | "L4" | "L5",
};

export default function ActivityDataClient({ demo = false }: { demo?: boolean }) {
  const routes = useAppRoutes();
  const permissions = usePermissions();
  const canWrite = demo || workspaceCanWrite(permissions, demo);

  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [dqlFilter, setDqlFilter] = useState<string>("all");
  const [facilityFilter, setFacilityFilter] = useState<string>("all");
  const [showAiModal, setShowAiModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [anomalyResult, setAnomalyResult] = useState<ActivityAnomalyResult | null>(null);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);

  const load = useCallback(async () => {
    if (demo) {
      const demoData = (await import("@/lib/dashboard/industrialDemoData")).INDUSTRIAL_DEMO;
      const activities = demoSessionCache.getActivities();
      const facilities = demoSessionCache.getFacilities();
      const processes = demoSessionCache.getProcesses();
      return {
        facilities,
        processes,
        activities,
        measurementPoints: demoData.measurementPoints,
        evidence: (await import("@/lib/dashboard/industrialDemoData")).DEMO_EVIDENCE,
      };
    }
    const [facilities, processes, activities, measurementPoints, evidence] = await Promise.all([
      industrialCoreApi.facilities(),
      industrialCoreApi.processes(),
      industrialCoreApi.activities(500),
      industrialCoreApi.measurementPoints(),
      listEvidenceV2(),
    ]);
    return { facilities, processes, activities, measurementPoints, evidence: evidence.items };
  }, [demo]);

  const query = useIndustrialWorkspaceQuery(load, demo);
  const rawActivities = query.data?.activities;
  const rawFacilities = query.data?.facilities;
  const activities = useMemo(() => rawActivities || [], [rawActivities]);
  const facilities = useMemo(() => rawFacilities || [], [rawFacilities]);

  // Compute anomaly analysis once data is loaded
  const runAiAnomalyAudit = useCallback(() => {
    if (!activities.length) return;
    setAnalyzingAi(true);
    setTimeout(() => {
      const result = analyzeActivityAnomalies(activities);
      setAnomalyResult(result);
      setAnalyzingAi(false);
      if (result.outliers.length > 0) {
        toast.warning(`AI đã phát hiện ${result.outliers.length} điểm dị thường / rủi ro dữ liệu.`);
      } else {
        toast.success("AI xác nhận dữ liệu hoạt động nhất quán, không có đột biến bất thường.");
      }
    }, 400);
  }, [activities]);

  // Handle AI Document import apply
  const handleApplyAiData = (data: Record<string, unknown>) => {
    setForm((prev) => ({
      ...prev,
      activityReference: String(data.activityReference || `ACT-AI-${Date.now().toString().slice(-4)}`),
      activityType: String(data.activityType || prev.activityType),
      quantity: data.quantity ? String(data.quantity) : prev.quantity,
      canonicalUnit: String(data.canonicalUnit || prev.canonicalUnit),
      periodStart: String(data.periodStart || prev.periodStart),
      periodEnd: String(data.periodEnd || prev.periodEnd),
      sourceKind: (data.sourceKind as typeof prev.sourceKind) || "invoice",
      dataQualityLevel: (data.dataQualityLevel as typeof prev.dataQualityLevel) || "L2",
    }));
    setShowAddModal(true);
    toast.success("Đã nạp dữ liệu trích xuất từ AI vào biểu mẫu.");
  };

  // Handle Camera Scanner capture
  const handleCameraCaptured = (imageData: string) => {
    setShowCamera(false);
    toast.success("Đã chụp ảnh chứng từ thành công. Đang liên kết vào dữ liệu hoạt động...");
    setForm((prev) => ({
      ...prev,
      activityReference: `ACT-CAM-${Date.now().toString().slice(-4)}`,
      sourceKind: "meter",
      dataQualityLevel: "L3",
    }));
    setShowAddModal(true);
  };

  // Submit manual/demo activity
  const handleSaveActivity = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.activityReference.trim() || !form.quantity) {
      toast.error("Vui lòng điền mã hoạt động và số lượng.");
      return;
    }

    if (demo) {
      demoSessionCache.addActivity({
        activityReference: form.activityReference.trim(),
        facilityRevisionId: form.facilityRevisionId || facilities[0]?.id || "demo-fac",
        processRevisionId: form.processRevisionId || null,
        activityType: form.activityType,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        quantity: Number(form.quantity),
        canonicalUnit: form.canonicalUnit,
        sourceKind: form.sourceKind,
        dataQualityLevel: form.dataQualityLevel,
      });
      setShowAddModal(false);
      setForm(emptyForm);
      toast.success("Đã ghi nhận hoạt động vào sổ cái demo (lưu cache 1 giờ).");
      await query.reload();
      return;
    }

    try {
      const facilityId = form.facilityRevisionId || facilities[0]?.id || "";
      const quantity = Number(form.quantity);
      const provenance = {
        activityReference: form.activityReference.trim(),
        facilityRevisionId: facilityId,
        processRevisionId: form.processRevisionId || null,
        measurementPointRevisionId: form.measurementPointRevisionId || null,
        activityType: form.activityType,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        quantity,
        canonicalUnit: form.canonicalUnit,
        sourceKind: form.sourceKind,
        dataQualityLevel: form.dataQualityLevel,
        evidenceDocumentIds: [],
      };
      const sourceSha256 = await sha256CanonicalJson(provenance);
      await industrialCoreApi.createActivity({
        activityReference: form.activityReference.trim(),
        facilityRevisionId: facilityId,
        processRevisionId: form.processRevisionId || undefined,
        measurementPointRevisionId: form.measurementPointRevisionId || undefined,
        activityType: form.activityType,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        quantity,
        canonicalUnit: form.canonicalUnit,
        sourceKind: form.sourceKind,
        dataQualityLevel: form.dataQualityLevel,
        rawPayload: { entryMode: "activity_data_client", provenance },
        sourceSha256,
        evidenceDocumentIds: [],
      });
      setShowAddModal(false);
      setForm(emptyForm);
      toast.success("Đã tạo bản ghi hoạt động sản xuất mới.");
      await query.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi khi lưu hoạt động.");
    }
  };

  // Filtering activities
  const filteredActivities = useMemo(() => {
    const outlierIds = new Set(anomalyResult?.outliers.map((o) => o.activityId) || []);
    return activities.filter((act) => {
      if (showAnomaliesOnly && !outlierIds.has(act.id)) return false;

      // Search text
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          act.activityReference.toLowerCase().includes(q) ||
          act.activityType.toLowerCase().includes(q) ||
          (act.facilityName && act.facilityName.toLowerCase().includes(q)) ||
          act.canonicalUnit.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Scope filter
      if (scopeFilter !== "all") {
        const type = act.activityType.toLowerCase();
        const isScope1 = type.includes("fuel") || type.includes("diesel") || type.includes("gas") || type.includes("boiler");
        const isScope2 = type.includes("electricity") || type.includes("steam") || type.includes("grid");
        if (scopeFilter === "scope1" && !isScope1) return false;
        if (scopeFilter === "scope2" && !isScope2) return false;
        if (scopeFilter === "scope3" && (isScope1 || isScope2)) return false;
      }

      // DQL filter
      if (dqlFilter !== "all" && normalizeDataQualityTier(act.dataQualityLevel) !== dqlFilter) return false;

      // Facility filter
      if (facilityFilter !== "all" && act.facilityRevisionId !== facilityFilter) return false;

      return true;
    });
  }, [activities, search, scopeFilter, dqlFilter, facilityFilter, showAnomaliesOnly, anomalyResult]);

  // Data Quality Index (DQI) according to Section 13 Data Quality Ladder
  const dqiStats = useMemo(() => calculateDatasetDqi(activities), [activities]);

  // Aggregate stats
  const stats = useMemo(() => {
    let s1 = 0;
    let s2 = 0;
    activities.forEach((act) => {
      const q = Number(act.quantity) || 0;
      const type = act.activityType.toLowerCase();
      if (type.includes("fuel") || type.includes("diesel") || type.includes("gas") || type.includes("boiler")) {
        s1 += q;
      } else if (type.includes("electricity") || type.includes("steam") || type.includes("grid")) {
        s2 += q;
      }
    });
    return { s1, s2 };
  }, [activities]);

  const downloadCsv = () => {
    const csvRows = [
      [
        "Mã hoạt động",
        "Loại phát thải",
        "Sản lượng",
        "Đơn vị",
        "Cơ sở",
        "Quy trình",
        "Điểm đo",
        "Chu kỳ bắt đầu",
        "Chu kỳ kết thúc",
        "Nguồn gốc",
        "Cấp chất lượng (DQL)",
        "Mã băm SHA-256",
      ],
      ...filteredActivities.map((act) => {
        const fac = facilities.find((f) => f.id === act.facilityRevisionId);
        const proc = query.data?.processes?.find((p) => p.id === act.processRevisionId);
        const pt = query.data?.measurementPoints?.find((m) => m.id === act.measurementPointRevisionId);
        return [
          act.activityReference,
          act.activityType,
          String(act.quantity),
          act.canonicalUnit,
          fac ? `${fac.name} (${fac.facilityReference})` : act.facilityReference || act.facilityRevisionId || "—",
          proc ? `${proc.name} (${proc.processReference})` : act.processRevisionId || "—",
          pt ? `${pt.measurementPointReference} (${pt.measurementType})` : act.measurementPointRevisionId || "—",
          act.periodStart,
          act.periodEnd,
          act.sourceKind,
          act.dataQualityLevel,
          act.sourceSha256 || "—",
        ];
      }),
    ];
    const url = URL.createObjectURL(new Blob([csvText(csvRows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-data-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Đã xuất ${filteredActivities.length} dòng dữ liệu hoạt động (CSV).`);
  };

  return (
    <WorkspaceFrame
      title="Dữ liệu hoạt động"
      description="Sổ cái thu thập dữ liệu phát thải Scope 1, 2 và 3 theo chuẩn GHG Protocol và ISO 14064. Tích hợp AI quét hóa đơn, tự động đối soát sản lượng và phát hiện dữ liệu dị thường."
      demo={demo}
      loading={query.loading}
      error={query.error}
      reload={query.reload}
    >
      {/* 1. Executive Metric Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">Tổng hoạt động ghi nhận</span>
          <p className="mt-1 text-2xl font-bold text-foreground">{activities.length}</p>
          <span className="text-[11px] text-muted-foreground">Phạm vi 500 bản ghi gần nhất</span>
        </Card>

        <Card className="border-border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">Scope 1 · Nhiên liệu đốt</span>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {stats.s1.toLocaleString("vi-VN")} <span className="text-xs font-normal text-muted-foreground">L / kg</span>
          </p>
          <span className="text-[11px] text-muted-foreground">Phát thải trực tiếp lò hơi & xe máy</span>
        </Card>

        <Card className="border-border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">Scope 2 · Điện lưới tiêu thụ</span>
          <p className="mt-1 text-2xl font-bold text-blue-600">
            {stats.s2.toLocaleString("vi-VN")} <span className="text-xs font-normal text-muted-foreground">kWh</span>
          </p>
          <span className="text-[11px] text-muted-foreground">Hóa đơn EVN & công tơ phụ</span>
        </Card>

        <Card className="border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Chỉ số chất lượng DQI</span>
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold ${
                dqiStats.overallDqi >= 75
                  ? "text-emerald-700 border-emerald-300 bg-emerald-50"
                  : dqiStats.overallDqi >= 50
                  ? "text-blue-700 border-blue-300 bg-blue-50"
                  : "text-amber-700 border-amber-300 bg-amber-50"
              }`}
            >
              {dqiStats.overallDqi >= 75 ? "Tin cậy cao" : dqiStats.overallDqi >= 50 ? "Khá (L2-L3)" : "Cần đối soát"}
            </Badge>
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {dqiStats.overallDqi} <span className="text-xs font-normal text-muted-foreground">/ 100</span>
          </p>
          <span className="text-[11px] text-muted-foreground">
            {dqiStats.tierDistribution.L3 + dqiStats.tierDistribution.L4 + dqiStats.tierDistribution.L5} / {activities.length || 0} bản ghi có chứng từ bảo chứng
          </span>
        </Card>
      </div>

      {/* 2. AI Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Trợ lý AI Quản trị Dữ liệu Hoạt động</h2>
            <p className="text-xs text-muted-foreground">
              Tự động trích xuất hóa đơn EVN / biên bản giao nhận và phát hiện đột biến tiêu thụ bất thường.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={runAiAnomalyAudit}
            disabled={analyzingAi || !activities.length}
            className="border-primary/40 text-primary hover:bg-primary/10 text-xs font-medium"
          >
            <Activity className="h-3.5 w-3.5 mr-1.5" />
            {analyzingAi ? "Đang quét dị thường…" : "Phân tích dị thường bằng AI"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCamera(true)}
            className="border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 text-xs font-medium"
          >
            <Camera className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
            Chụp chứng từ (Camera)
          </Button>

          <Button
            size="sm"
            onClick={() => setShowAiModal(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium shadow-xs"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Quét Hóa đơn / Công tơ AI
          </Button>

          {canWrite && (
            <Button
              size="sm"
              variant="default"
              onClick={() => setShowAddModal(true)}
              className="text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Thêm thủ công
            </Button>
          )}
        </div>
      </div>

      {/* 3. AI Anomaly Alert Banner (if analyzed) */}
      {anomalyResult && (
        <Card className={`border ${anomalyResult.outliers.length ? "border-amber-300 bg-amber-50/50" : "border-emerald-300 bg-emerald-50/50"}`}>
          <CardHeader className="py-3 px-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {anomalyResult.outliers.length ? (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                )}
                <CardTitle className="text-sm font-bold text-foreground">
                  Kết quả phân tích dị thường AI ({anomalyResult.outliers.length} cảnh báo)
                </CardTitle>
                <Badge variant="outline" className="text-xs font-mono">
                  Độ sẵn sàng: {anomalyResult.auditReadinessTier}
                </Badge>
              </div>

              {anomalyResult.outliers.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAnomaliesOnly(!showAnomaliesOnly)}
                  className="h-7 text-xs text-amber-800 hover:bg-amber-100"
                >
                  {showAnomaliesOnly ? "Hiển thị tất cả bản ghi" : "Lọc chỉ xem bản ghi dị thường"}
                </Button>
              )}
            </div>
            <CardDescription className="text-xs text-foreground/80 mt-1">
              {anomalyResult.summary}
            </CardDescription>
          </CardHeader>

          {anomalyResult.outliers.length > 0 && (
            <CardContent className="pt-0 pb-3 px-4 space-y-2">
              {anomalyResult.outliers.slice(0, 3).map((outlier, idx) => (
                <div key={idx} className="rounded-lg border border-amber-200 bg-white p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-900">{outlier.activityReference}</span>
                    <Badge variant="secondary" className="text-[10px] uppercase bg-amber-100 text-amber-800">
                      {outlier.severity}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">{outlier.reason}</p>
                  <p className="text-primary font-medium">💡 Khuyến nghị: {outlier.recommendation}</p>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* 4. Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo mã hoạt động, loại phát thải, cơ sở…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <select
            aria-label="Lọc theo Scope"
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs"
          >
            <option value="all">Tất cả Scope</option>
            <option value="scope1">Scope 1 · Nhiên liệu trực tiếp</option>
            <option value="scope2">Scope 2 · Điện lưới / Hơi</option>
            <option value="scope3">Scope 3 · Chuỗi giá trị</option>
          </select>

          <select
            aria-label="Lọc theo DQL"
            value={dqlFilter}
            onChange={(e) => setDqlFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs"
          >
            <option value="all">Tất cả cấp DQL</option>
            <option value="L0">L0 · Thiếu dữ liệu (Missing)</option>
            <option value="L1">L1 · Dữ liệu ước lượng / Proxy</option>
            <option value="L2">L2 · Tự khai báo (Self-reported)</option>
            <option value="L3">L3 · Có chứng từ bảo chứng (Evidence-backed)</option>
            <option value="L4">L4 · Đã đối soát chéo (Reconciled)</option>
            <option value="L5">L5 · Thẩm tra độc lập (Verified)</option>
          </select>

          {facilities.length > 1 && (
            <select
              aria-label="Lọc theo cơ sở"
              value={facilityFilter}
              onChange={(e) => setFacilityFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs"
            >
              <option value="all">Tất cả cơ sở</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={downloadCsv}
          disabled={!filteredActivities.length}
          className="h-9 text-xs gap-1.5 shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          Xuất CSV ({filteredActivities.length})
        </Button>
      </div>

      {/* 5. Activities Data Table */}
      {!filteredActivities.length ? (
        <Card className="p-8 text-center border-dashed">
          <Activity className="h-8 w-8 mx-auto text-muted-foreground opacity-50 mb-2" />
          <p className="text-sm font-semibold text-foreground">Không tìm thấy bản ghi hoạt động phù hợp</p>
          <p className="text-xs text-muted-foreground mt-1">
            Thử thay đổi bộ lọc hoặc dùng tính năng Quét Hóa đơn AI để tạo bản ghi mới.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="p-3">Mã hoạt động</th>
                  <th className="p-3">Loại phát thải</th>
                  <th className="p-3">Sản lượng</th>
                  <th className="p-3">Chu kỳ ghi nhận</th>
                  <th className="p-3">Nguồn gốc</th>
                  <th className="p-3">Chất lượng (DQL)</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredActivities.map((act) => {
                  const isSpike = anomalyResult?.outliers.some((o) => o.activityId === act.id);
                  const tier = normalizeDataQualityTier(act.dataQualityLevel);
                  const dqlDef = DATA_QUALITY_LADDER[tier];
                  return (
                    <tr
                      key={act.id}
                      className={`hover:bg-muted/30 transition-colors ${isSpike ? "bg-amber-50/30" : ""}`}
                    >
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-1.5">
                          {isSpike && <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />}
                          <span className="text-foreground">{act.activityReference}</span>
                        </div>
                        {act.facilityName && (
                          <span className="text-[10px] text-muted-foreground block">{act.facilityName}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px] uppercase font-normal">
                          {act.activityType}
                        </Badge>
                      </td>
                      <td className="p-3 font-semibold text-foreground">
                        {Number(act.quantity).toLocaleString("vi-VN")} {act.canonicalUnit}
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        {act.periodStart} → {act.periodEnd}
                      </td>
                      <td className="p-3">
                        <span className="text-[11px] capitalize text-muted-foreground">
                          {act.sourceKind}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="space-y-0.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${dqlDef.badgeClass}`}
                            title={dqlDef.descriptionVi}
                          >
                            <span>{tier}</span>
                            <span className="hidden sm:inline font-normal text-[9px] opacity-85">
                              · {dqlDef.labelVi.replace(`${tier} `, "")}
                            </span>
                          </span>
                          <div
                            className="text-[10px] text-muted-foreground truncate max-w-[170px]"
                            title={dqlDef.nextActionVi}
                          >
                            💡 {dqlDef.nextActionVi}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <Link
                          prefetch={false}
                          href={routes.toAppPath("/evidence-graph")}
                          className="text-primary hover:underline text-xs font-medium"
                        >
                          {demo ? "Xem chuỗi bằng chứng minh họa →" : "Xem phả hệ bằng chứng →"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            Hiển thị {filteredActivities.length} / {activities.length} bản ghi
          </div>
        </div>
      )}

      {/* 6. AI Document Scanner Modal */}
      <AiDocumentImportModal
        open={showAiModal}
        onOpenChange={setShowAiModal}
        contextKey="activity"
        onApply={handleApplyAiData}
        demo={demo}
      />

      {/* 6.1 Camera Scanner Modal (Section 28 Mobile/Camera Spec) */}
      <CameraScanner
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCaptured}
        language="vi"
      />

      {/* 7. Manual Add / Review Activity Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Thêm bản ghi hoạt động phát thải</DialogTitle>
            <DialogDescription className="text-xs">
              Ghi nhận số lượng tiêu thụ năng lượng/nhiên liệu vào sổ cái carbon nội bộ.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveActivity} className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Cơ sở sản xuất</label>
              <select
                aria-label="Cơ sở sản xuất"
                value={form.facilityRevisionId}
                onChange={(e) => setForm({ ...form, facilityRevisionId: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="">Chọn cơ sở...</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Mã hoạt động (Ref)</label>
                <Input
                  required
                  placeholder="ACT-ELEC-2026-01"
                  value={form.activityReference}
                  onChange={(e) => setForm({ ...form, activityReference: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Loại hoạt động</label>
                <select
                  aria-label="Loại hoạt động"
                  value={form.activityType}
                  onChange={(e) => setForm({ ...form, activityType: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="electricity">Điện lưới (Scope 2)</option>
                  <option value="fuel_diesel">Dầu Diesel lò hơi/xe (Scope 1)</option>
                  <option value="fuel_biomass">Sinh khối mùn cưa/trấu (Scope 1)</option>
                  <option value="steam">Hơi nước mua ngoài (Scope 2)</option>
                  <option value="freight">Vận chuyển logistics (Scope 3)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Sản lượng tiêu thụ</label>
                <Input
                  required
                  type="number"
                  step="any"
                  min="0"
                  placeholder="45000"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Đơn vị đo lường</label>
                <Input
                  required
                  placeholder="kWh, L, kg, m3"
                  value={form.canonicalUnit}
                  onChange={(e) => setForm({ ...form, canonicalUnit: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Ngày bắt đầu</label>
                <Input
                  type="date"
                  value={form.periodStart}
                  onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Ngày kết thúc</label>
                <Input
                  type="date"
                  value={form.periodEnd}
                  onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Nguồn gốc</label>
                <select
                  aria-label="Nguồn gốc chứng từ"
                  value={form.sourceKind}
                  onChange={(e) => setForm({ ...form, sourceKind: e.target.value as typeof form.sourceKind })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="invoice">Hóa đơn VAT (Invoice)</option>
                  <option value="meter">Công tơ điện tử (Meter)</option>
                  <option value="sensor">Cảm biến IoT (Sensor)</option>
                  <option value="supplier">Nhà cung cấp khai báo</option>
                  <option value="manual">Nhập tay đối soát</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Cấp chất lượng DQL</label>
                <select
                  aria-label="Cấp chất lượng dữ liệu"
                  value={form.dataQualityLevel}
                  onChange={(e) => setForm({ ...form, dataQualityLevel: e.target.value as typeof form.dataQualityLevel })}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="L1">L1 · Dữ liệu ước lượng / Proxy</option>
                  <option value="L2">L2 · Tự khai báo (Chưa chứng từ)</option>
                  <option value="L3">L3 · Có chứng từ bảo chứng (Hóa đơn/Biên bản)</option>
                  <option value="L4">L4 · Đã đối soát chéo (Công tơ/Sản lượng)</option>
                  <option value="L5">L5 · Thẩm tra độc lập (Bên thứ ba)</option>
                </select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
                Hủy
              </Button>
              <Button type="submit" size="sm" className="bg-primary text-primary-foreground">
                Lưu vào sổ cái
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </WorkspaceFrame>
  );
}
