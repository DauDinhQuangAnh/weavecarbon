"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  CloudSun,
  Loader2,
  MapPin,
  ShieldAlert,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  ShieldCheck,
  Grid,
  Flame,
  Droplets,
  Sun,
  Layers,
  Sparkles,
  Wand2,
  Shield,
  Thermometer,
  CloudRain,
  Waves,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EvidenceSelector } from "@/components/evidence/EvidenceSelector";
import { GisCoordinateMap } from "@/components/dashboard/climate-risk/GisCoordinateMap";
import { isApiError } from "@/lib/apiClient";
import { industrialCoreApi, type IndustrialFacility } from "@/lib/industrialCoreApi";
import { listEvidenceV2, type EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";
import {
  climateRiskApi,
  type ClimateAssessment,
  type ClimateLocation,
  type ClimatePortfolio,
} from "@/lib/climateRiskApi";
import { demoSessionCache } from "@/lib/dashboard/demoSessionCache";
import {
  simulateClimatePhysicalHazards,
  type ClimateHazardSimulationResult,
} from "@/lib/ai/supplyChainAndClimateAiService";
import DataEntryScanTrigger from "@/components/ui/DataEntryScanTrigger";

const selectClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors";

const evidenceReady = (item: EvidenceDocumentV2) =>
  ["locked", "third_party_verified"].includes(item.status) &&
  /^[a-f0-9]{64}$/i.test(item.checksumSha256 || "") &&
  item.fileSizeBytes > 0;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-slate-700">
      <span className="font-medium text-xs uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const initialLocation = {
  facilityRevisionId: "",
  latitude: "",
  longitude: "",
  precisionMeters: "100",
  locationBasis: "",
  evidenceDocumentId: "",
};

const initialAssessment = {
  facilityRevisionId: "",
  locationRevisionId: "",
  hazardType: "heat" as "heat" | "drought" | "extreme_rainfall",
  scenarioKind: "historical",
  scenarioReference: "",
  horizonStart: "",
  horizonEnd: "",
  sourceKind: "ERA5_LAND",
  sourceUrl: "",
  datasetIdentifier: "",
  datasetVersion: "",
  spatialResolution: "",
  temporalResolution: "",
  gridReference: "",
  spatialMatchNotes: "",
  modelName: "",
  scenarioName: "",
  hazardMetric: "",
  metricValue: "",
  metricUnit: "",
  uncertaintyNotes: "",
  exposureRating: "3",
  vulnerabilityRating: "3",
  businessDependencyPercent: "",
  priorityBand: "medium",
  ratingRationale: "",
  evidenceDocumentId: "",
};

export default function ClimateRiskClient({ demo = false }: { demo?: boolean }) {
  const t = useTranslations("climateRisk");
  const { user } = useAuth();
  const isCompanyAdmin = user?.company_role === "root" || user?.is_root === true;
  const isViewer = user?.company_role === "viewer";

  const [facilities, setFacilities] = useState<IndustrialFacility[]>([]);
  const [evidence, setEvidence] = useState<EvidenceDocumentV2[]>([]);
  const [locations, setLocations] = useState<ClimateLocation[]>([]);
  const [assessments, setAssessments] = useState<ClimateAssessment[]>([]);
  const [portfolios, setPortfolios] = useState<ClimatePortfolio[]>([]);
  const [portfolioDetail, setPortfolioDetail] = useState<
    (ClimatePortfolio & { assessments: ClimateAssessment[] }) | null
  >(null);
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationForm, setLocationForm] = useState(initialLocation);
  const [assessmentForm, setAssessmentForm] = useState(initialAssessment);
  const [portfolioReference, setPortfolioReference] = useState("");
  const [methodologyNotes, setMethodologyNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // AI Tools & Document Extraction States
  const [aiScenario, setAiScenario] = useState<"historical" | "SSP2-4.5" | "SSP5-8.5">("SSP2-4.5");
  const [aiSelectedFacilityId, setAiSelectedFacilityId] = useState<string>("");
  const [aiHazardSimulation, setAiHazardSimulation] = useState<ClimateHazardSimulationResult | null>(null);
  const [aiSimulating, setAiSimulating] = useState(false);

  const load = useCallback(async () => {
    if (demo) {
      const cachedFacilities = demoSessionCache.getFacilities() as unknown as IndustrialFacility[];
      setFacilities(cachedFacilities);
      setEvidence([]);
      setLocations(demoSessionCache.getClimateLocations());
      setAssessments(demoSessionCache.getClimateAssessments());
      setPortfolios(demoSessionCache.getClimatePortfolios());
      if (cachedFacilities.length > 0 && !aiSelectedFacilityId) {
        setAiSelectedFacilityId(cachedFacilities[0].id);
      }
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const [facilityRows, evidenceResponse, locationRows, assessmentRows, portfolioRows] =
        await Promise.all([
          industrialCoreApi.facilities(),
          listEvidenceV2(),
          climateRiskApi.locations(),
          climateRiskApi.assessments(),
          climateRiskApi.portfolios(),
        ]);
      setFacilities(facilityRows);
      setEvidence(evidenceResponse.items.filter(evidenceReady));
      setLocations(locationRows);
      setAssessments(assessmentRows);
      setPortfolios(portfolioRows);
      if (facilityRows.length > 0 && !aiSelectedFacilityId) {
        setAiSelectedFacilityId(facilityRows[0].id);
      }
      setError(null);
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [demo, t, aiSelectedFacilityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    if (demo || saving) return;
    setSaving(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const createLocation = (event: FormEvent) => {
    event.preventDefault();
    if (!isCompanyAdmin && !demo) {
      setError("Chỉ Company Admin / Quản trị viên mới có quyền tạo vị trí cơ sở rủi ro khí hậu.");
      return;
    }
    if (demo) {
      const newLoc = demoSessionCache.addClimateLocation({
        facilityRevisionId: locationForm.facilityRevisionId,
        latitude: Number(locationForm.latitude),
        longitude: Number(locationForm.longitude),
        precisionMeters: Number(locationForm.precisionMeters),
        locationBasis: locationForm.locationBasis,
      });
      setLocations((prev) => [newLoc, ...prev]);
      setLocationForm(initialLocation);
      return;
    }
    void run(async () => {
      await climateRiskApi.createLocation({
        ...locationForm,
        latitude: Number(locationForm.latitude),
        longitude: Number(locationForm.longitude),
        precisionMeters: Number(locationForm.precisionMeters),
      });
      setLocationForm(initialLocation);
    });
  };

  const createAssessment = (event: FormEvent) => {
    event.preventDefault();
    if (!isCompanyAdmin && !demo) {
      setError("Chỉ Company Admin / Quản trị viên mới có quyền tạo đánh giá hiểm họa khí hậu.");
      return;
    }
    if (demo) {
      const newAss = demoSessionCache.addClimateAssessment({
        facilityRevisionId: assessmentForm.facilityRevisionId,
        locationRevisionId: assessmentForm.locationRevisionId,
        hazardType: assessmentForm.hazardType as "heat" | "drought" | "extreme_rainfall",
        scenarioKind: assessmentForm.scenarioKind as "historical" | "projection",
        scenarioReference: assessmentForm.scenarioReference,
        horizonStart: assessmentForm.horizonStart,
        horizonEnd: assessmentForm.horizonEnd,
        sourceKind: assessmentForm.sourceKind as "ERA5_LAND" | "CMIP6" | "OTHER",
        sourceUrl: assessmentForm.sourceUrl,
        datasetIdentifier: assessmentForm.datasetIdentifier,
        datasetVersion: assessmentForm.datasetVersion,
        spatialResolution: assessmentForm.spatialResolution,
        temporalResolution: assessmentForm.temporalResolution,
        gridReference: assessmentForm.gridReference,
        spatialMatchNotes: assessmentForm.spatialMatchNotes,
        modelName: assessmentForm.modelName || undefined,
        scenarioName: assessmentForm.scenarioName || undefined,
        hazardMetric: assessmentForm.hazardMetric,
        metricValue: Number(assessmentForm.metricValue),
        metricUnit: assessmentForm.metricUnit,
        uncertaintyNotes: assessmentForm.uncertaintyNotes,
        exposureRating: Number(assessmentForm.exposureRating),
        vulnerabilityRating: Number(assessmentForm.vulnerabilityRating),
        businessDependencyPercent: Number(assessmentForm.businessDependencyPercent),
        priorityBand: assessmentForm.priorityBand as "low" | "medium" | "high",
        ratingRationale: assessmentForm.ratingRationale,
      });
      setAssessments((prev) => [newAss, ...prev]);
      setAssessmentForm(initialAssessment);
      return;
    }
    void run(async () => {
      await climateRiskApi.createAssessment({
        ...assessmentForm,
        metricValue: Number(assessmentForm.metricValue),
        exposureRating: Number(assessmentForm.exposureRating),
        vulnerabilityRating: Number(assessmentForm.vulnerabilityRating),
        businessDependencyPercent: Number(assessmentForm.businessDependencyPercent),
      });
      setAssessmentForm(initialAssessment);
    });
  };

  const createPortfolio = (event: FormEvent) => {
    event.preventDefault();
    if (!isCompanyAdmin && !demo) {
      setError("Chỉ Company Admin / Quản trị viên mới có quyền lập danh mục rủi ro khí hậu.");
      return;
    }
    if (demo) {
      const newPort = demoSessionCache.addClimatePortfolio({
        portfolioReference,
        methodologyNotes,
        assessmentIds: selectedIds,
      });
      setPortfolios((prev) => [newPort, ...prev]);
      setPortfolioReference("");
      setMethodologyNotes("");
      setSelectedIds([]);
      return;
    }
    void run(async () => {
      await climateRiskApi.createPortfolio({
        portfolioReference,
        methodologyNotes,
        assessmentIds: selectedIds,
      });
      setPortfolioReference("");
      setMethodologyNotes("");
      setSelectedIds([]);
    });
  };

  const inspectPortfolio = async (id: string) => {
    if (demo) {
      const p = portfolios.find((item) => item.id === id);
      if (p) {
        setPortfolioDetail({
          ...p,
          assessments: assessments.slice(0, 3),
        });
      }
      return;
    }
    try {
      setPortfolioDetail(await climateRiskApi.portfolio(id));
      setError(null);
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("loadError"));
    }
  };

  const handleAiExtractedLocation = (data: Record<string, unknown>) => {
    setLocationForm((prev) => ({
      ...prev,
      latitude: data.latitude ? String(data.latitude) : prev.latitude,
      longitude: data.longitude ? String(data.longitude) : prev.longitude,
      precisionMeters: data.precisionMeters ? String(data.precisionMeters) : prev.precisionMeters,
      locationBasis: data.locationBasis ? String(data.locationBasis) : (data.referenceDocument ? String(data.referenceDocument) : prev.locationBasis),
      facilityRevisionId: facilities[0]?.id || prev.facilityRevisionId,
    }));
  };

  const runAiSimulation = () => {
    const targetFacility = facilities.find((f) => f.id === aiSelectedFacilityId) || facilities[0];
    if (!targetFacility) return;
    setAiSimulating(true);
    const facLoc = locations.find((l) => l.facilityRevisionId === targetFacility.id);
    const lat = facLoc?.latitude || 10.8231;
    const lon = facLoc?.longitude || 106.6297;
    const result = simulateClimatePhysicalHazards(
      { id: targetFacility.id, name: targetFacility.name, latitude: lat, longitude: lon },
      aiScenario
    );
    setTimeout(() => {
      setAiHazardSimulation(result);
      setAiSimulating(false);
    }, 350);
  };

  const applyHazardToForm = (hazardType: "heat" | "drought" | "extreme_rainfall") => {
    if (!aiHazardSimulation) return;
    const metricInfo = {
      heat: {
        name: "Số ngày nắng nóng cực đoan (Tmax > 35°C)",
        value: aiHazardSimulation.projectedMetrics.extremeHeatDaysPerYear,
        unit: "ngày/năm",
        model: "EC-Earth3-Veg",
        grid: "GRID-CMIP6-ERA5-HEAT-01",
      },
      extreme_rainfall: {
        name: "Lượng mưa cực đoan ngày lớn nhất (Rx1day)",
        value: aiHazardSimulation.projectedMetrics.maxDailyRainfallMm,
        unit: "mm/ngày",
        model: "MPI-ESM1-2-HR",
        grid: "GRID-CMIP6-RAIN-02",
      },
      drought: {
        name: "Chuỗi ngày khô hạn liên tục (CDD)",
        value: aiHazardSimulation.projectedMetrics.consecutiveDryDays,
        unit: "ngày",
        model: "MIROC6",
        grid: "GRID-CMIP6-DROUGHT-03",
      },
    }[hazardType];

    const targetFacility = facilities.find((f) => f.id === aiSelectedFacilityId) || facilities[0];
    const targetLoc = locations.find((l) => l.facilityRevisionId === targetFacility?.id) || locations[0];

    setAssessmentForm((prev) => ({
      ...prev,
      facilityRevisionId: targetFacility?.id || prev.facilityRevisionId,
      locationRevisionId: targetLoc?.id || prev.locationRevisionId,
      hazardType,
      scenarioKind: aiScenario === "historical" ? "historical" : "projection",
      scenarioReference: `CMIP6-${aiScenario}-2040`,
      horizonStart: "2026",
      horizonEnd: "2040",
      sourceKind: aiScenario === "historical" ? "ERA5_LAND" : "CMIP6",
      sourceUrl: "https://cds.climate.copernicus.eu",
      datasetIdentifier: `cmip6-${hazardType}-projection`,
      datasetVersion: "v2.1",
      spatialResolution: "0.25 deg",
      temporalResolution: "daily",
      gridReference: metricInfo.grid,
      spatialMatchNotes: "Ghép tọa độ cơ sở vào lưới CMIP6 khu vực",
      modelName: metricInfo.model,
      scenarioName: aiScenario,
      hazardMetric: metricInfo.name,
      metricValue: String(metricInfo.value),
      metricUnit: metricInfo.unit,
      uncertaintyNotes: "Sai số mô hình CMIP6 ±15% hiệu chỉnh theo chuẩn WMO",
      exposureRating: String(aiHazardSimulation.exposureScore),
      vulnerabilityRating: String(aiHazardSimulation.vulnerabilityScore),
      businessDependencyPercent: "60",
      priorityBand: aiHazardSimulation.priorityBand,
      ratingRationale: `Đánh giá AI CMIP6 (${aiScenario}): ${aiHazardSimulation.overallRiskRationale}`,
    }));
  };

  // 5x5 Heatmap Matrix Calculation (Exposure 1-5 vs Vulnerability 1-5)
  const heatmapData = useMemo(() => {
    const grid: Record<string, ClimateAssessment[]> = {};
    for (let exp = 1; exp <= 5; exp++) {
      for (let vuln = 1; vuln <= 5; vuln++) {
        grid[`${exp}-${vuln}`] = [];
      }
    }
    for (const item of assessments) {
      const exp = Math.min(5, Math.max(1, Math.round(item.exposureRating || 3)));
      const vuln = Math.min(5, Math.max(1, Math.round(item.vulnerabilityRating || 3)));
      const key = `${exp}-${vuln}`;
      if (grid[key]) {
        grid[key].push(item);
      }
    }
    return grid;
  }, [assessments]);

  // Export Dossier Functions
  const downloadPortfolioCsv = (portfolio: ClimatePortfolio, members: ClimateAssessment[] = []) => {
    const rows = [
      ["DANH_MUC_RUI_RO", "THONG_TIN", "GIA_TRI"],
      ["PORTFOLIO", "Ma danh muc", portfolio.portfolioReference],
      ["PORTFOLIO", "Kich ban tham chieu", portfolio.scenarioReference || ""],
      ["PORTFOLIO", "So luong co so", String(portfolio.facilityCount || 0)],
      ["PORTFOLIO", "Trang thai tham dinh", portfolio.prioritySummary?.reviewStatus || ""],
      ["PORTFOLIO", "Ty le phu thuoc rui ro cao (High)", `${portfolio.prioritySummary?.dependencyPercentByPriority?.high ?? 0}%`],
      ["PORTFOLIO", "Ty le phu thuoc rui ro trung binh (Medium)", `${portfolio.prioritySummary?.dependencyPercentByPriority?.medium ?? 0}%`],
      ["PORTFOLIO", "Ty le phu thuoc rui ro thap (Low)", `${portfolio.prioritySummary?.dependencyPercentByPriority?.low ?? 0}%`],
      ["PORTFOLIO", "Ghi chu phuong phap luan", (portfolio.methodologyNotes || "").replace(/"/g, '""')],
      ["PORTFOLIO", "Ma dinh danh Portfolio ID", portfolio.id],
      ["---", "---", "---"],
      ["CHI_TIET_HIEM_HOA", "CO_SO", "LOAI_HIEM_HOA", "NGUON", "MO_HINH", "CHI_SO", "GIA_TRI", "PHOI_NHIEM", "TON_THUONG", "PHU_THUOC_%", "MUC_UU_TIEN", "MA_BAM_HO_SO"],
      ...members.map((m) => [
        "ASSESSMENT",
        m.facilityName || m.facilityRevisionId,
        m.hazardType,
        m.sourceKind,
        m.modelName || "—",
        m.hazardMetric,
        `${m.metricValue} ${m.metricUnit}`,
        String(m.exposureRating),
        String(m.vulnerabilityRating),
        `${m.businessDependencyPercent}%`,
        m.priorityBand,
        m.evidenceSnapshot?.checksumSha256 || m.id,
      ]),
    ];

    const csvContent = "\uFEFF" + rows.map((r) => r.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TCFD_ClimateRisk_${portfolio.portfolioReference}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadPortfolioAuditJson = (portfolio: ClimatePortfolio, members: ClimateAssessment[] = []) => {
    const auditData = {
      standard: "TCFD / IFRS S2 Physical Climate Risk Assessment",
      exportedAt: new Date().toISOString(),
      portfolioId: portfolio.id,
      portfolioReference: portfolio.portfolioReference,
      methodologyNotes: portfolio.methodologyNotes,
      prioritySummary: portfolio.prioritySummary,
      assessmentsCount: members.length,
      assessments: members,
      legalDisclaimer:
        "Báo cáo sàng lọc rủi ro khí hậu vật lý nội bộ tuân thủ khuyến nghị TCFD và chuẩn mực công bố phát triển bền vững IFRS S2.",
    };

    const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TCFD_Audit_${portfolio.portfolioReference}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPortfolio = async (portfolio: ClimatePortfolio, type: "csv" | "json") => {
    try {
      const full = await climateRiskApi.portfolio(portfolio.id);
      if (type === "csv") {
        downloadPortfolioCsv(full, full.assessments || []);
      } else {
        downloadPortfolioAuditJson(full, full.assessments || []);
      }
    } catch {
      if (type === "csv") {
        downloadPortfolioCsv(portfolio, []);
      } else {
        downloadPortfolioAuditJson(portfolio, []);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm text-slate-500">Đang tải dữ liệu rủi ro khí hậu...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      {/* Top Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-sky-950 to-teal-950 p-6 md:p-8 text-white shadow-md border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300 ring-1 ring-inset ring-sky-500/30">
                <CloudSun className="h-3.5 w-3.5" />
                G2-07 · Climate Risk
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-300 border border-emerald-500/20">
                TCFD / IFRS S2 Aligned
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">{t("title")}</h1>
            <p className="max-w-3xl text-sm md:text-base text-slate-300 leading-relaxed">{t("description")}</p>
          </div>

          <div>
            {isCompanyAdmin ? (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-3 py-1 text-xs">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Company Admin (Quyền quản trị rủi ro khí hậu)
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-300 border-amber-500/30 px-3 py-1 text-xs">
                <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                Chế độ xem ({user?.company_role || "member"})
              </Badge>
            )}
          </div>
        </div>
      </section>

      {/* Caution & notices */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 shadow-xs">
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-950">Lưu ý ranh giới đánh giá rủi ro vật lý</p>
          <p className="text-xs text-amber-800 leading-relaxed">{t("caution")}</p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-xs"
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {demo && (
        <div className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 shadow-xs">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-sky-600" />
          <span>{t("demoReadOnly")}</span>
        </div>
      )}

      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cơ sở đánh giá</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{facilities.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Nhà máy / chi nhánh</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tọa độ định vị</p>
          <p className="mt-1 text-2xl font-bold text-sky-700">{locations.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Vị trí GIS xác minh</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Đánh giá hiểm họa</p>
          <p className="mt-1 text-2xl font-bold text-teal-700">{assessments.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Kịch bản khí hậu</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Danh mục rủi ro</p>
          <p className="mt-1 text-2xl font-bold text-indigo-700">{portfolios.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Portfolio báo cáo</p>
        </div>
      </div>

      {/* 1. Location Form with GIS Map */}
      <Card className="shadow-xs border-slate-200/80">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
                <MapPin className="h-5 w-5 text-sky-600" />
                {t("locationTitle")}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">{t("locationDescription")}</CardDescription>
            </div>
            <DataEntryScanTrigger
              contextKey="climate_location"
              demo={demo}
              variant="dialog_header"
              fileButtonLabel="Quét trích lục GIS AI"
              cameraButtonLabel="Chụp sơ đồ tọa độ"
              onApply={handleAiExtractedLocation}
            />
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Interactive GIS Map */}
          <GisCoordinateMap
            latitude={locationForm.latitude}
            longitude={locationForm.longitude}
            precisionMeters={locationForm.precisionMeters}
            existingLocations={locations}
            onSelectCoordinates={(lat, lng) =>
              setLocationForm({
                ...locationForm,
                latitude: lat.toFixed(6),
                longitude: lng.toFixed(6),
              })
            }
            disabled={(saving || isViewer) && !demo}
          />

          <form className="grid gap-4 md:grid-cols-3" onSubmit={createLocation}>
            <Field label={t("facility")}>
              <select
                required
                disabled={(saving || isViewer) && !demo}
                className={selectClass}
                value={locationForm.facilityRevisionId}
                onChange={(event) =>
                  setLocationForm({ ...locationForm, facilityRevisionId: event.target.value })
                }
              >
                <option value="">{t("selectFacility")}</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} · {f.facilityReference}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t("latitude")}>
              <Input
                required
                disabled={(saving || isViewer) && !demo}
                type="number"
                min="-90"
                max="90"
                step="0.000001"
                placeholder="Ví dụ: 10.823099"
                value={locationForm.latitude}
                onChange={(event) => setLocationForm({ ...locationForm, latitude: event.target.value })}
              />
            </Field>

            <Field label={t("longitude")}>
              <Input
                required
                disabled={(saving || isViewer) && !demo}
                type="number"
                min="-180"
                max="180"
                step="0.000001"
                placeholder="Ví dụ: 106.629664"
                value={locationForm.longitude}
                onChange={(event) => setLocationForm({ ...locationForm, longitude: event.target.value })}
              />
            </Field>

            <Field label={t("precision")}>
              <Input
                required
                disabled={(saving || isViewer) && !demo}
                type="number"
                min="1"
                max="100000"
                value={locationForm.precisionMeters}
                onChange={(event) =>
                  setLocationForm({ ...locationForm, precisionMeters: event.target.value })
                }
              />
            </Field>

            <Field label={t("locationBasis")}>
              <Input
                required
                disabled={(saving || isViewer) && !demo}
                placeholder="Ví dụ: GPS khảo sát thực địa, Trích lục địa chính"
                value={locationForm.locationBasis}
                onChange={(event) => setLocationForm({ ...locationForm, locationBasis: event.target.value })}
              />
            </Field>

            <Field label={t("locationEvidence")}>
              <EvidenceSelector
                value={locationForm.evidenceDocumentId}
                onChange={(id) => setLocationForm({ ...locationForm, evidenceDocumentId: id })}
                disabled={(saving || isViewer) && !demo}
                placeholder="Chọn chứng từ thực địa từ Vault..."
                required={!demo}
              />
            </Field>

            <div className="md:col-span-3 pt-2">
              <Button disabled={(saving || isViewer) && !demo} className="bg-sky-600 hover:bg-sky-700 text-white font-medium">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                {t("saveLocation")}
              </Button>
            </div>
          </form>

          {locations.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Vị trí đã lưu ({locations.length})
              </p>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {locations.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-sm hover:border-sky-300 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-slate-900 font-semibold">{item.facilityName || item.facilityRevisionId}</b>
                      <Badge variant="outline" className="text-xs bg-white text-slate-700 font-medium">
                        ±{item.precisionMeters} m
                      </Badge>
                    </div>
                    <p className="mt-1 text-slate-600 text-xs font-mono">
                      {item.latitude}, {item.longitude}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-400 font-mono truncate">{item.id}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Copilot: CMIP6 Climate Physical Hazard Simulator & TCFD Adaptation */}
      <Card className="shadow-xs border-indigo-200/80 bg-gradient-to-br from-indigo-50/40 via-white to-sky-50/30">
        <CardHeader className="border-b border-indigo-100/80 bg-indigo-50/60 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-indigo-950">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                AI Copilot: Dự báo Hiểm họa Khí hậu CMIP6 & Thích ứng TCFD
              </CardTitle>
              <CardDescription className="text-xs text-indigo-800/80 mt-0.5">
                Mô phỏng hiểm họa vật lý cấp cơ sở dựa trên dữ liệu lưới toàn cầu CMIP6 kết hợp hiệu chỉnh khí hậu 3 miền Việt Nam.
              </CardDescription>
            </div>
            {aiHazardSimulation && (
              <Badge
                variant="outline"
                className={`text-xs font-semibold px-2.5 py-1 ${
                  aiHazardSimulation.priorityBand === "high"
                    ? "border-red-300 bg-red-100 text-red-800"
                    : aiHazardSimulation.priorityBand === "medium"
                    ? "border-amber-300 bg-amber-100 text-amber-800"
                    : "border-emerald-300 bg-emerald-100 text-emerald-800"
                }`}
              >
                Rủi ro vật lý: {aiHazardSimulation.priorityBand.toUpperCase()} (TCFD Score: {aiHazardSimulation.compositeRiskScore}/100)
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          {/* Controls */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Cơ sở sản xuất cần dự báo">
              <select
                className={selectClass}
                value={aiSelectedFacilityId}
                onChange={(e) => setAiSelectedFacilityId(e.target.value)}
              >
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Kịch bản biến đổi khí hậu (CMIP6 / IPCC)">
              <select
                className={selectClass}
                value={aiScenario}
                onChange={(e) => setAiScenario(e.target.value as typeof aiScenario)}
              >
                <option value="SSP2-4.5">SSP2-4.5 (Kịch bản trung bình - Tham vọng NDCs)</option>
                <option value="SSP5-8.5">SSP5-8.5 (Kịch bản phát thải cao - Xấu nhất)</option>
                <option value="historical">Historical (Đối chiếu thời kỳ chuẩn 1995–2014)</option>
              </select>
            </Field>

            <div className="flex items-end">
              <Button
                type="button"
                onClick={runAiSimulation}
                disabled={aiSimulating || facilities.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium h-10 flex items-center justify-center gap-2"
              >
                {aiSimulating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Chạy mô phỏng AI (CMIP6)
              </Button>
            </div>
          </div>

          {/* Results display */}
          {aiHazardSimulation ? (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl border border-indigo-200/80 bg-white p-4 shadow-2xs">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900">
                      Kết luận sàng lọc rủi ro vật lý: {aiHazardSimulation.facilityName}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {aiHazardSimulation.overallRiskRationale}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3 Physical Hazards Cards */}
              <div className="grid gap-3 md:grid-cols-3">
                {/* 1. Extreme Heat */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-amber-900 flex items-center gap-1.5">
                        <Thermometer className="h-4 w-4 text-amber-600" />
                        Nắng nóng cực đoan (Tmax &gt; 35°C)
                      </span>
                      <Badge variant="outline" className="text-[11px] bg-white text-amber-800 border-amber-300">
                        {aiHazardSimulation.hazardSpecificAssessments.heat.riskBand}
                      </Badge>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-amber-950">
                      {aiHazardSimulation.projectedMetrics.extremeHeatDaysPerYear}{" "}
                      <span className="text-xs font-normal text-amber-700">ngày/năm</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      {aiHazardSimulation.hazardSpecificAssessments.heat.operationalImpact}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyHazardToForm("heat")}
                    className="mt-3 w-full border-amber-300 bg-white text-xs text-amber-900 hover:bg-amber-100"
                  >
                    Áp dụng vào Form Đánh giá
                  </Button>
                </div>

                {/* 2. Extreme Rainfall */}
                <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-sky-900 flex items-center gap-1.5">
                        <CloudRain className="h-4 w-4 text-sky-600" />
                        Mưa cực đoan ngày (Rx1day)
                      </span>
                      <Badge variant="outline" className="text-[11px] bg-white text-sky-800 border-sky-300">
                        {aiHazardSimulation.hazardSpecificAssessments.extreme_rainfall.riskBand}
                      </Badge>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-sky-950">
                      {aiHazardSimulation.projectedMetrics.maxDailyRainfallMm}{" "}
                      <span className="text-xs font-normal text-sky-700">mm/ngày</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      {aiHazardSimulation.hazardSpecificAssessments.extreme_rainfall.operationalImpact}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyHazardToForm("extreme_rainfall")}
                    className="mt-3 w-full border-sky-300 bg-white text-xs text-sky-900 hover:bg-sky-100"
                  >
                    Áp dụng vào Form Đánh giá
                  </Button>
                </div>

                {/* 3. Drought */}
                <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-orange-900 flex items-center gap-1.5">
                        <Waves className="h-4 w-4 text-orange-600" />
                        Khô hạn kéo dài (CDD)
                      </span>
                      <Badge variant="outline" className="text-[11px] bg-white text-orange-800 border-orange-300">
                        {aiHazardSimulation.hazardSpecificAssessments.drought.riskBand}
                      </Badge>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-orange-950">
                      {aiHazardSimulation.projectedMetrics.consecutiveDryDays}{" "}
                      <span className="text-xs font-normal text-orange-700">ngày</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      {aiHazardSimulation.hazardSpecificAssessments.drought.operationalImpact}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyHazardToForm("drought")}
                    className="mt-3 w-full border-orange-300 bg-white text-xs text-orange-900 hover:bg-orange-100"
                  >
                    Áp dụng vào Form Đánh giá
                  </Button>
                </div>
              </div>

              {/* TCFD Adaptation Measures */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-indigo-600" />
                  Kế hoạch Thích ứng & Nâng cao Khả năng Chống chịu Khí hậu (TCFD / IFRS S2)
                </h4>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {aiHazardSimulation.tcfdRecommendations.map((rec, i) => (
                    <div key={i} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs">
                      <div className="font-semibold text-slate-900 mb-1">
                        {i + 1}. {rec.measure}
                      </div>
                      <div className="text-slate-600 leading-relaxed">{rec.justification}</div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span>Chi phí ước tính: {rec.estimatedCostUsd}</span>
                        <span className="text-indigo-600">Thời gian triển khai: {rec.timeframe}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-indigo-200 bg-white/60 p-6 text-center text-xs text-slate-500">
              Chọn cơ sở và kịch bản phát thải để AI tính toán hiểm họa thời tiết cực đoan (CMIP6 SSP2-4.5 / SSP5-8.5) và đưa ra khuyến nghị thích ứng TCFD.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Assessment Form */}
      <Card className="shadow-xs border-slate-200/80">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
            <ShieldAlert className="h-5 w-5 text-teal-600" />
            {t("assessmentTitle")}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">{t("assessmentDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form className="space-y-4" onSubmit={createAssessment}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label={t("facility")}>
                <select
                  required
                  disabled={(saving || isViewer) && !demo}
                  className={selectClass}
                  value={assessmentForm.facilityRevisionId}
                  onChange={(event) =>
                    setAssessmentForm({
                      ...assessmentForm,
                      facilityRevisionId: event.target.value,
                      locationRevisionId: "",
                    })
                  }
                >
                  <option value="">{t("selectFacility")}</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("locationRevision")}>
                <select
                  required
                  disabled={(saving || isViewer) && !demo}
                  className={selectClass}
                  value={assessmentForm.locationRevisionId}
                  onChange={(event) =>
                    setAssessmentForm({ ...assessmentForm, locationRevisionId: event.target.value })
                  }
                >
                  <option value="">{t("selectLocation")}</option>
                  {locations
                    .filter((l) => l.facilityRevisionId === assessmentForm.facilityRevisionId)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.latitude}, {l.longitude} · {l.id.slice(0, 8)}
                      </option>
                    ))}
                </select>
              </Field>

              <Field label={t("hazard")}>
                <select
                  disabled={(saving || isViewer) && !demo}
                  className={selectClass}
                  value={assessmentForm.hazardType}
                  onChange={(event) =>
                    setAssessmentForm({
                      ...assessmentForm,
                      hazardType: event.target.value as "heat" | "drought" | "extreme_rainfall",
                    })
                  }
                >
                  <option value="heat">{t("heat")}</option>
                  <option value="drought">{t("drought")}</option>
                  <option value="extreme_rainfall">{t("rainfall")}</option>
                </select>
              </Field>

              <Field label={t("scenarioKind")}>
                <select
                  disabled={(saving || isViewer) && !demo}
                  className={selectClass}
                  value={assessmentForm.scenarioKind}
                  onChange={(event) =>
                    setAssessmentForm({
                      ...assessmentForm,
                      scenarioKind: event.target.value,
                      sourceKind: event.target.value === "historical" ? "ERA5_LAND" : "CMIP6",
                    })
                  }
                >
                  <option value="historical">{t("historical")}</option>
                  <option value="projection">{t("projection")}</option>
                </select>
              </Field>

              <Field label={t("scenarioReference")}>
                <Input
                  required
                  disabled={(saving || isViewer) && !demo}
                  placeholder="Ví dụ: SSP2-4.5 / Historical 1991-2020"
                  value={assessmentForm.scenarioReference}
                  onChange={(event) =>
                    setAssessmentForm({ ...assessmentForm, scenarioReference: event.target.value })
                  }
                />
              </Field>

              <Field label={t("sourceKind")}>
                <select
                  disabled={(saving || isViewer) && !demo}
                  className={selectClass}
                  value={assessmentForm.sourceKind}
                  onChange={(event) =>
                    setAssessmentForm({ ...assessmentForm, sourceKind: event.target.value })
                  }
                >
                  {assessmentForm.scenarioKind === "historical" ? (
                    <option value="ERA5_LAND">ERA5-Land</option>
                  ) : (
                    <option value="CMIP6">CMIP6</option>
                  )}
                  <option value="OTHER">{t("otherSource")}</option>
                </select>
              </Field>

              <Field label={t("horizonStart")}>
                <Input
                  required
                  disabled={(saving || isViewer) && !demo}
                  type="date"
                  value={assessmentForm.horizonStart}
                  onChange={(event) =>
                    setAssessmentForm({ ...assessmentForm, horizonStart: event.target.value })
                  }
                />
              </Field>

              <Field label={t("horizonEnd")}>
                <Input
                  required
                  disabled={(saving || isViewer) && !demo}
                  type="date"
                  value={assessmentForm.horizonEnd}
                  onChange={(event) =>
                    setAssessmentForm({ ...assessmentForm, horizonEnd: event.target.value })
                  }
                />
              </Field>

              <Field label={t("sourceUrl")}>
                <Input
                  required
                  disabled={(saving || isViewer) && !demo}
                  type="url"
                  placeholder="https://cds.climate.copernicus.eu/..."
                  value={assessmentForm.sourceUrl}
                  onChange={(event) =>
                    setAssessmentForm({ ...assessmentForm, sourceUrl: event.target.value })
                  }
                />
              </Field>

              {(
                ["datasetIdentifier", "datasetVersion", "spatialResolution", "temporalResolution"] as const
              ).map((key) => (
                <Field key={key} label={t(key)}>
                  <Input
                    required
                    disabled={(saving || isViewer) && !demo}
                    value={assessmentForm[key]}
                    onChange={(event) =>
                      setAssessmentForm({ ...assessmentForm, [key]: event.target.value })
                    }
                  />
                </Field>
              ))}

              <Field label={t("gridReference")}>
                <Input
                  required
                  disabled={(saving || isViewer) && !demo}
                  placeholder="Grid ID / cell reference"
                  value={assessmentForm.gridReference}
                  onChange={(event) =>
                    setAssessmentForm({ ...assessmentForm, gridReference: event.target.value })
                  }
                />
              </Field>

              {assessmentForm.scenarioKind === "projection" &&
                (["modelName", "scenarioName"] as const).map((key) => (
                  <Field key={key} label={t(key)}>
                    <Input
                      required
                      disabled={(saving || isViewer) && !demo}
                      value={assessmentForm[key]}
                      onChange={(event) =>
                        setAssessmentForm({ ...assessmentForm, [key]: event.target.value })
                      }
                    />
                  </Field>
                ))}

              {(["hazardMetric", "metricUnit"] as const).map((key) => (
                <Field key={key} label={t(key)}>
                  <Input
                    required
                    disabled={(saving || isViewer) && !demo}
                    placeholder={key === "hazardMetric" ? "VD: annual_consecutive_dry_days" : "VD: days, mm, °C"}
                    value={assessmentForm[key]}
                    onChange={(event) =>
                      setAssessmentForm({ ...assessmentForm, [key]: event.target.value })
                    }
                  />
                </Field>
              ))}

              <Field label={t("metricValue")}>
                <Input
                  required
                  disabled={(saving || isViewer) && !demo}
                  type="number"
                  step="0.00000001"
                  value={assessmentForm.metricValue}
                  onChange={(event) =>
                    setAssessmentForm({ ...assessmentForm, metricValue: event.target.value })
                  }
                />
              </Field>

              <Field label={t("exposure")}>
                <Input
                  required
                  disabled={(saving || isViewer) && !demo}
                  type="number"
                  min="1"
                  max="5"
                  value={assessmentForm.exposureRating}
                  onChange={(event) =>
                    setAssessmentForm({ ...assessmentForm, exposureRating: event.target.value })
                  }
                />
              </Field>

              <Field label={t("vulnerability")}>
                <Input
                  required
                  disabled={(saving || isViewer) && !demo}
                  type="number"
                  min="1"
                  max="5"
                  value={assessmentForm.vulnerabilityRating}
                  onChange={(event) =>
                    setAssessmentForm({ ...assessmentForm, vulnerabilityRating: event.target.value })
                  }
                />
              </Field>

              <Field label={t("dependency")}>
                <Input
                  required
                  disabled={(saving || isViewer) && !demo}
                  type="number"
                  min="0"
                  max="100"
                  step="0.001"
                  placeholder="VD: 45 (%)"
                  value={assessmentForm.businessDependencyPercent}
                  onChange={(event) =>
                    setAssessmentForm({
                      ...assessmentForm,
                      businessDependencyPercent: event.target.value,
                    })
                  }
                />
              </Field>

              <Field label={t("priority")}>
                <select
                  disabled={(saving || isViewer) && !demo}
                  className={selectClass}
                  value={assessmentForm.priorityBand}
                  onChange={(event) =>
                    setAssessmentForm({ ...assessmentForm, priorityBand: event.target.value })
                  }
                >
                  <option value="low">{t("low")}</option>
                  <option value="medium">{t("medium")}</option>
                  <option value="high">{t("high")}</option>
                </select>
              </Field>

              <Field label={t("sourceEvidence")}>
                <EvidenceSelector
                  value={assessmentForm.evidenceDocumentId}
                  onChange={(id) => setAssessmentForm({ ...assessmentForm, evidenceDocumentId: id })}
                  disabled={(saving || isViewer) && !demo}
                  placeholder="Chọn chứng từ khoa học từ Vault..."
                  required={!demo}
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3 pt-2">
              <Field label={t("spatialMatchNotes")}>
                <Textarea
                  required
                  disabled={(saving || isViewer) && !demo}
                  rows={3}
                  className="rounded-lg border-slate-200 bg-white text-sm"
                  value={assessmentForm.spatialMatchNotes}
                  onChange={(event) =>
                    setAssessmentForm({ ...assessmentForm, spatialMatchNotes: event.target.value })
                  }
                />
              </Field>
              <Field label={t("uncertainty")}>
                <Textarea
                  required
                  disabled={(saving || isViewer) && !demo}
                  rows={3}
                  className="rounded-lg border-slate-200 bg-white text-sm"
                  value={assessmentForm.uncertaintyNotes}
                  onChange={(event) =>
                    setAssessmentForm({ ...assessmentForm, uncertaintyNotes: event.target.value })
                  }
                />
              </Field>
              <Field label={t("ratingRationale")}>
                <Textarea
                  required
                  disabled={(saving || isViewer) && !demo}
                  rows={3}
                  className="rounded-lg border-slate-200 bg-white text-sm"
                  value={assessmentForm.ratingRationale}
                  onChange={(event) =>
                    setAssessmentForm({ ...assessmentForm, ratingRationale: event.target.value })
                  }
                />
              </Field>
            </div>

            <Button disabled={(saving || isViewer) && !demo} className="bg-teal-600 hover:bg-teal-700 text-white font-medium">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
              {t("saveAssessment")}
            </Button>
          </form>

          {assessments.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Đánh giá hiểm họa ({assessments.length})
              </p>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {assessments.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-sm hover:border-teal-300 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-slate-900 font-semibold">{item.facilityName || item.facilityRevisionId}</b>
                      <Badge
                        variant="outline"
                        className={
                          item.priorityBand === "high"
                            ? "bg-red-50 text-red-700 border-red-200 font-medium"
                            : item.priorityBand === "medium"
                            ? "bg-amber-50 text-amber-700 border-amber-200 font-medium"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200 font-medium"
                        }
                      >
                        {item.priorityBand}
                      </Badge>
                    </div>
                    <p className="mt-1 text-slate-600 text-xs">
                      {item.scenarioReference} · {item.horizonStart}–{item.horizonEnd} · {item.sourceKind}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.datasetIdentifier} {item.datasetVersion} · {item.gridReference} · {item.spatialResolution}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>{item.id.slice(0, 12)}…</span>
                      <span className="text-slate-600 font-medium">Trạng thái: {item.screeningStatus}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* TCFD / IFRS S2 5x5 Heatmap Matrix */}
      <Card className="shadow-xs border-slate-200/80">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                <Grid className="h-4 w-4 text-indigo-600" />
                Ma trận Rủi ro TCFD / IFRS S2 (5x5 Heatmap Matrix)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Phân bổ hiểm họa khí hậu theo Mức độ phơi nhiễm (Exposure) và Tính tổn thương (Vulnerability)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Low
              </span>
              <span className="flex items-center gap-1 text-amber-700 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Medium
              </span>
              <span className="flex items-center gap-1 text-red-700 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> High Priority
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="max-w-2xl mx-auto space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pb-1">
              <span>↑ Phơi nhiễm (Exposure 5 → 1)</span>
              <span>Tính tổn thương (Vulnerability 1 → 5) →</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 text-center text-xs font-mono">
              {[5, 4, 3, 2, 1].map((exp) =>
                [1, 2, 3, 4, 5].map((vuln) => {
                  const key = `${exp}-${vuln}`;
                  const count = heatmapData[key]?.length || 0;
                  const isHigh = exp >= 4 && vuln >= 4;
                  const isMedium = (exp >= 3 && vuln >= 2) || (exp >= 2 && vuln >= 3);
                  const bg = isHigh
                    ? "bg-red-100 hover:bg-red-200 border-red-300 text-red-900 font-bold"
                    : isMedium
                    ? "bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-900 font-semibold"
                    : "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-900";

                  return (
                    <div
                      key={key}
                      className={`h-12 rounded-lg border flex flex-col items-center justify-center transition-all p-1 ${bg}`}
                      title={`Exposure: ${exp}, Vulnerability: ${vuln} (${count} đánh giá)`}
                    >
                      <span className="text-[10px] text-slate-500 opacity-70">
                        {exp}x{vuln}
                      </span>
                      {count > 0 ? (
                        <span className="text-sm font-bold">{count}</span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Portfolio Form */}
      <Card className="shadow-xs border-slate-200/80">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            {t("portfolioTitle")}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">{t("portfolioDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form className="space-y-4" onSubmit={createPortfolio}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("portfolioReference")}>
                <Input
                  required
                  disabled={(saving || isViewer) && !demo}
                  placeholder="Ví dụ: PORTFOLIO-VN-TEXTILE-2030"
                  value={portfolioReference}
                  onChange={(event) => setPortfolioReference(event.target.value)}
                />
              </Field>
              <Field label={t("methodologyNotes")}>
                <Textarea
                  required
                  disabled={(saving || isViewer) && !demo}
                  rows={2}
                  className="rounded-lg border-slate-200 bg-white text-sm"
                  placeholder="Mô tả phương pháp tiếp cận danh mục TCFD..."
                  value={methodologyNotes}
                  onChange={(event) => setMethodologyNotes(event.target.value)}
                />
              </Field>
            </div>

            <div className="space-y-2">
              <span className="font-medium text-xs uppercase tracking-wide text-slate-500 block">
                {t("selectAssessments")} (Chọn tối thiểu 2 đánh giá)
              </span>
              <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-sm">
                {assessments.map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 hover:bg-slate-50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      disabled={(saving || isViewer) && !demo}
                      checked={selectedIds.includes(item.id)}
                      onChange={(event) =>
                        setSelectedIds((current) =>
                          event.target.checked
                            ? [...current, item.id]
                            : current.filter((id) => id !== item.id)
                        )
                      }
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-slate-900">{item.facilityName || item.facilityRevisionId}</span>
                      <span className="text-slate-500 text-xs ml-2">
                        · {item.hazardType} · {item.scenarioReference} · Phụ thuộc: {item.businessDependencyPercent}%
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs font-semibold">
                      {item.priorityBand}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>

            <Button
              disabled={((saving || isViewer) && !demo) || selectedIds.length < 2}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-2 h-4 w-4" />}
              {t("createPortfolio")}
            </Button>
          </form>

          {portfolios.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Danh mục rủi ro ({portfolios.length})
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {portfolios.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-sm hover:border-indigo-300 transition-colors space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-slate-900 font-bold">{item.portfolioReference}</b>
                      <Badge variant="outline" className="bg-white font-semibold">
                        {item.prioritySummary.reviewStatus}
                      </Badge>
                    </div>
                    <p className="text-slate-600 text-xs">
                      {item.scenarioReference} · {item.facilityCount} {t("facilityCount")}
                    </p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-red-700 font-medium">
                        {t("high")}: {item.prioritySummary.dependencyPercentByPriority.high}%
                      </span>
                      <span className="text-amber-700 font-medium">
                        {t("medium")}: {item.prioritySummary.dependencyPercentByPriority.medium}%
                      </span>
                      <span className="text-emerald-700 font-medium">
                        {t("low")}: {item.prioritySummary.dependencyPercentByPriority.low}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {t("incompleteCoverage")}: {item.prioritySummary.incompleteHazardCoverageFacilities}
                    </p>

                    {/* Actions & Export Buttons */}
                    <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-slate-200/60">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 bg-white hover:bg-slate-100 text-xs text-slate-700"
                        onClick={() => void inspectPortfolio(item.id)}
                      >
                        <ChevronRight className="mr-1 h-3.5 w-3.5" />
                        {t("inspectPortfolio")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 border-sky-300 text-sky-700 hover:bg-sky-50 text-xs"
                        onClick={() => void handleDownloadPortfolio(item, "csv")}
                      >
                        <Download className="mr-1 h-3.5 w-3.5" />
                        Tải Báo cáo (CSV)
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 border-slate-300 text-slate-700 hover:bg-slate-100 text-xs"
                        onClick={() => void handleDownloadPortfolio(item, "json")}
                      >
                        <FileText className="mr-1 h-3.5 w-3.5" />
                        Audit JSON
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {portfolioDetail && (
            <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-indigo-950 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-700" />
                  {portfolioDetail.portfolioReference} · {t("portfolioMembers")}
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-white text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                    onClick={() => downloadPortfolioCsv(portfolioDetail, portfolioDetail.assessments)}
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Xuất CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-white text-slate-700 hover:bg-slate-100 border-slate-200"
                    onClick={() => downloadPortfolioAuditJson(portfolioDetail, portfolioDetail.assessments)}
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    Audit JSON
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {portfolioDetail.assessments.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3.5 text-sm shadow-2xs">
                    <div className="flex items-center justify-between">
                      <b className="text-slate-900 font-semibold">
                        {item.facilityName || item.facilityRevisionId} · {item.hazardType}
                      </b>
                      <Badge variant="outline" className="font-semibold">{item.priorityBand}</Badge>
                    </div>
                    <p className="mt-1 text-slate-600 text-xs">
                      {item.hazardMetric}: {item.metricValue} {item.metricUnit} · Tỷ lệ phụ thuộc doanh nghiệp: {item.businessDependencyPercent}%
                    </p>
                    <p className="mt-1 text-slate-500 text-xs">{item.uncertaintyNotes}</p>
                    <p className="mt-2 text-[11px] text-slate-400 font-mono">
                      {item.sourceKind} · {item.modelName || "—"} · {item.scenarioName || "—"} · {item.spatialResolution} · {item.gridReference}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
