"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Download,
  Factory,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Target,
  TrendingDown,
  Layers,
  Scale,
  AlertTriangle,
  Calculator,
  Sliders,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DataEntryScanTrigger from "@/components/ui/DataEntryScanTrigger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/apiClient";
import { industrialCoreApi, type IndustrialFacility, type IndustrialProcess } from "@/lib/industrialCoreApi";
import { dataGovernanceApi, type FactorProposal } from "@/lib/dataGovernanceApi";
import { industryPacksApi, type IndustryPackManifest, type IndustryPackPilot } from "@/lib/industryPacksApi";
import { listEvidenceV2, type EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";
import { DEMO_EVIDENCE, DEMO_FACTORS } from "@/lib/dashboard/industrialDemoData";
import { demoSessionCache } from "@/lib/dashboard/demoSessionCache";

type Line = { category: string; sourceReference: string; activityQuantity: number; activityUnit: string; factorProposalId: string; evidenceDocumentIds: string };
const initialLines = (categories: string[] = ["process", "fuel", "electricity"]): Line[] => categories.map((category) => ({ category, sourceReference: "", activityQuantity: 0, activityUnit: "", factorProposalId: "", evidenceDocumentIds: "" }));
const splitIds = (value: string) => value.split(",").map((id) => id.trim()).filter(Boolean);
const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
const evidenceReady = (item: EvidenceDocumentV2) => ["locked", "third_party_verified"].includes(item.status) && /^[a-f0-9]{64}$/i.test(item.checksumSha256 || "") && item.fileSizeBytes > 0;
const categoryLabel: Record<string, string> = { process: "Phát thải quá trình", fuel: "Nhiên liệu", electricity: "Điện", material: "Nguyên vật liệu", feedstock: "Feedstock", steam: "Hơi", transport: "Vận tải", waste: "Chất thải", water: "Nước" };

const FALLBACK_MANIFESTS: IndustryPackManifest[] = [
  {
    id: "steel",
    label: "Thép & Hợp kim sắt (Steel)",
    version: "G2-STEEL-PILOT-1.1.0",
    approvalStatus: "expert_review_required",
    processes: ["raw_material", "coke", "sinter", "pellet", "bf", "bof", "eaf", "rolling"],
    pilotProcesses: ["bf", "bof", "eaf"],
    requiredCategories: ["process", "fuel", "electricity"],
    requiredFields: ["facilityRevisionId", "processRevisionId", "outputTonnes", "activityLines", "allocation"],
    requiredContextFields: [],
    contextFieldDescriptions: {},
    allocationPolicy: "single_product_100_percent_only",
    validationRules: ["governed_non_proxy_factors", "locked_activity_and_production_evidence", "process_taxonomy_match"],
    evidenceChecklist: ["production", "activity", "factor", "methodology"],
    targetMappings: ["domestic_mrv_candidate", "cbam_goods_scope_check_required"],
    disclaimer: "Pilot calculation for internal specialist review only.",
  },
  {
    id: "cement",
    label: "Xi măng & Clinker (Cement)",
    version: "G2-CEMENT-PILOT-1.1.0",
    approvalStatus: "expert_review_required",
    processes: ["raw_meal", "kiln", "clinker", "grinding", "additives"],
    pilotProcesses: ["kiln", "clinker"],
    requiredCategories: ["process", "fuel", "electricity"],
    requiredFields: ["facilityRevisionId", "processRevisionId", "outputTonnes", "activityLines", "allocation"],
    requiredContextFields: [],
    contextFieldDescriptions: {},
    allocationPolicy: "single_product_100_percent_only",
    validationRules: ["governed_non_proxy_factors", "locked_activity_and_production_evidence", "process_taxonomy_match"],
    evidenceChecklist: ["production", "carbonate_or_clinker", "fuel", "electricity", "factor", "methodology"],
    targetMappings: ["domestic_mrv_candidate", "cbam_goods_scope_check_required"],
    disclaimer: "Pilot calculation for internal specialist review only.",
  },
  {
    id: "textile_apparel",
    label: "Dệt may & Da giày (Textile & Apparel)",
    version: "G2-TEXTILE-APPAREL-PILOT-1.0.0",
    approvalStatus: "expert_review_required",
    processes: ["spinning", "weaving", "knitting", "dyeing", "finishing", "garment"],
    pilotProcesses: ["spinning", "weaving", "knitting", "dyeing", "finishing", "garment"],
    requiredCategories: ["material", "fuel", "electricity"],
    requiredFields: ["facilityRevisionId", "processRevisionId", "outputTonnes", "activityLines", "sectorContext", "allocation"],
    requiredContextFields: ["batchOrSkuReference", "materialOrBomReference", "buyerOrProductBoundary"],
    contextFieldDescriptions: {
      batchOrSkuReference: "Mã lô sản xuất, Batch, Lot hoặc SKU",
      materialOrBomReference: "Nguồn nguyên phụ liệu / Định mức BOM",
      buyerOrProductBoundary: "Ranh giới yêu cầu nhãn hàng / Scope 3 PCF",
    },
    allocationPolicy: "single_product_100_percent_only",
    validationRules: ["material_and_bom_context", "governed_non_proxy_factors", "locked_activity_and_production_evidence", "process_taxonomy_match"],
    evidenceChecklist: ["production", "material_bom", "supplier", "energy", "product_boundary", "factor", "methodology"],
    targetMappings: ["buyer_pcf_scope3_traceability_candidate", "domestic_inventory_applicability_check_required"],
    disclaimer: "Pilot calculation for internal specialist review only.",
  },
  {
    id: "aluminium",
    label: "Nhôm & Đúc kim loại (Aluminium)",
    version: "G2-ALUMINIUM-PILOT-1.0.0",
    approvalStatus: "expert_review_required",
    processes: ["alumina", "smelting", "casting", "recycled_input", "electricity"],
    pilotProcesses: ["alumina", "smelting", "casting"],
    requiredCategories: ["material", "process", "electricity"],
    requiredFields: ["facilityRevisionId", "processRevisionId", "outputTonnes", "activityLines", "sectorContext", "allocation"],
    requiredContextFields: ["inputMaterialBasis", "recycledContentPercent", "electricityBoundary"],
    contextFieldDescriptions: {
      inputMaterialBasis: "Nguồn gốc nguyên liệu (Alumina sơ cấp hoặc tái chế)",
      recycledContentPercent: "Tỷ lệ hàm lượng nhôm tái chế PCR (%)",
      electricityBoundary: "Ranh giới nguồn điện điện phân và đúc thỏi",
    },
    allocationPolicy: "single_product_100_percent_only",
    validationRules: ["recycled_content_range", "governed_non_proxy_factors", "locked_activity_and_production_evidence", "process_taxonomy_match"],
    evidenceChecklist: ["production", "alumina_or_recycled_input", "process", "electricity", "factor", "methodology"],
    targetMappings: ["facility_product_carbon_candidate", "cbam_goods_scope_check_required"],
    disclaimer: "Pilot calculation for internal specialist review only.",
  },
  {
    id: "construction_materials",
    label: "Vật liệu xây dựng & Gốm sứ (Construction Materials)",
    version: "G2-CONSTRUCTION-MATERIALS-PILOT-1.0.0",
    approvalStatus: "expert_review_required",
    processes: ["quarry", "crushing", "cutting", "ceramics", "glass", "concrete", "logistics"],
    pilotProcesses: ["quarry", "crushing", "cutting", "ceramics", "glass", "concrete"],
    requiredCategories: ["material", "fuel", "electricity"],
    requiredFields: ["facilityRevisionId", "processRevisionId", "outputTonnes", "activityLines", "sectorContext", "allocation"],
    requiredContextFields: ["materialType", "quarryOrPlantReference", "logisticsBoundary"],
    contextFieldDescriptions: {
      materialType: "Chủng loại vật liệu (Đá, gạch gốm, kính, bê tông)",
      quarryOrPlantReference: "Ranh giới mỏ đá hoặc nhà máy nghiền phối",
      logisticsBoundary: "Phạm vi vận tải nguyên vật liệu nội địa",
    },
    allocationPolicy: "single_product_100_percent_only",
    validationRules: ["material_process_context", "governed_non_proxy_factors", "locked_activity_and_production_evidence", "process_taxonomy_match"],
    evidenceChecklist: ["production", "raw_material", "fuel", "electricity", "waste", "logistics", "factor", "methodology"],
    targetMappings: ["domestic_inventory_resource_tracking_candidate", "buyer_product_data_candidate"],
    disclaimer: "Pilot calculation for internal specialist review only.",
  },
  {
    id: "fertiliser_chemicals",
    label: "Hóa chất & Phân bón (Fertiliser & Chemicals)",
    version: "G2-FERTILISER-CHEMICALS-PILOT-1.0.0",
    approvalStatus: "expert_review_required",
    processes: ["ammonia", "nitric_acid", "urea", "fertiliser_blending", "chemical_processing"],
    pilotProcesses: ["ammonia", "nitric_acid", "urea", "fertiliser_blending", "chemical_processing"],
    requiredCategories: ["feedstock", "process", "steam", "electricity"],
    requiredFields: ["facilityRevisionId", "processRevisionId", "outputTonnes", "activityLines", "sectorContext", "allocation"],
    requiredContextFields: ["productOrIntermediate", "feedstockBasis", "processEmissionBasis"],
    contextFieldDescriptions: {
      productOrIntermediate: "Ranh giới sản phẩm cuối hoặc bán thành phẩm trung gian",
      feedstockBasis: "Nguồn gốc và khối lượng khí thiên nhiên / Feedstock",
      processEmissionBasis: "Phát thải phản ứng hóa học (N2O từ axit nitric)",
    },
    allocationPolicy: "single_product_100_percent_only",
    validationRules: ["feedstock_and_process_emission_context", "governed_non_proxy_factors", "locked_activity_and_production_evidence", "process_taxonomy_match"],
    evidenceChecklist: ["production", "feedstock", "process_parameters", "steam", "electricity", "intermediate", "factor", "methodology"],
    targetMappings: ["domestic_inventory_process_emissions_candidate", "cbam_goods_scope_check_required"],
    disclaimer: "Pilot calculation for internal specialist review only.",
  },
  {
    id: "mining_minerals",
    label: "Khai khoáng & Khoáng sản (Mining & Minerals)",
    version: "G2-MINING-MINERALS-PILOT-1.0.0",
    approvalStatus: "expert_review_required",
    processes: ["extraction", "crushing", "beneficiation", "processing", "logistics"],
    pilotProcesses: ["extraction", "crushing", "beneficiation", "processing"],
    requiredCategories: ["process", "fuel", "electricity", "transport"],
    requiredFields: ["facilityRevisionId", "processRevisionId", "outputTonnes", "activityLines", "sectorContext", "allocation"],
    requiredContextFields: ["mineralOrOre", "extractionMethod", "logisticsBoundary"],
    contextFieldDescriptions: {
      mineralOrOre: "Loại quặng hoặc khoáng sản tinh quặng",
      extractionMethod: "Phương pháp khai thác (Lộ thiên hoặc hầm lò)",
      logisticsBoundary: "Phạm vi vận tải từ khai trường đến cảng",
    },
    allocationPolicy: "single_product_100_percent_only",
    validationRules: ["extraction_and_logistics_context", "governed_non_proxy_factors", "locked_activity_and_production_evidence", "process_taxonomy_match"],
    evidenceChecklist: ["production", "extraction", "diesel_or_fuel", "electricity", "processing", "logistics", "factor", "methodology"],
    targetMappings: ["facility_resource_intensity_candidate", "upstream_supplier_evidence_candidate"],
    disclaimer: "Pilot calculation for internal specialist review only.",
  },
];

const SECTOR_BAT_BENCHMARKS: Record<string, { batKgPerTonne: number; avgKgPerTonne: number; unit: string; cbamCovered: boolean; intervention: string }> = {
  steel: { batKgPerTonne: 1350, avgKgPerTonne: 1980, unit: "kgCO₂e/t thép", cbamCovered: true, intervention: "Chuyển đổi lò hồ quang điện EAF + Hydro xanh (Green H2 DRI)" },
  cement: { batKgPerTonne: 640, avgKgPerTonne: 820, unit: "kgCO₂e/t xi măng", cbamCovered: true, intervention: "Thay thế clinker bằng tro bay / xỉ lò cao & thu hồi nhiệt WHR" },
  textile_apparel: { batKgPerTonne: 1850, avgKgPerTonne: 2450, unit: "kgCO₂e/t thành phẩm", cbamCovered: false, intervention: "Lò hơi sinh khối biomass FSC + Điện mặt trời áp mái 1.5 MWp" },
  aluminium: { batKgPerTonne: 4200, avgKgPerTonne: 6800, unit: "kgCO₂e/t nhôm", cbamCovered: true, intervention: "Công nghệ Anode trơ (Inert Anode) + Tăng 40% nhôm tái chế" },
  construction_materials: { batKgPerTonne: 380, avgKgPerTonne: 560, unit: "kgCO₂e/t vật liệu", cbamCovered: false, intervention: "Lò nung gốm sứ hiệu suất cao + Tối ưu hóa nhiệt bức xạ" },
  fertiliser_chemicals: { batKgPerTonne: 1600, avgKgPerTonne: 2300, unit: "kgCO₂e/t hóa chất", cbamCovered: true, intervention: "Xúc tác phân hủy N2O hiệu suất 98% + Điện phân nước sản xuất H2" },
  mining_minerals: { batKgPerTonne: 120, avgKgPerTonne: 210, unit: "kgCO₂e/t quặng", cbamCovered: false, intervention: "Xe tải mỏ điện hóa thuần pin + Tối ưu hóa tuyến vận chuyển băng tải" },
};

export default function IndustryPacksClient({ demo = false }: { demo?: boolean }) {
  const t = useTranslations("industryPacks");
  const [manifests, setManifests] = useState<IndustryPackManifest[]>(FALLBACK_MANIFESTS);
  const [facilities, setFacilities] = useState<IndustrialFacility[]>([]);
  const [processes, setProcesses] = useState<IndustrialProcess[]>([]);
  const [factors, setFactors] = useState<FactorProposal[]>([]);
  const [evidence, setEvidence] = useState<EvidenceDocumentV2[]>([]);
  const [pilots, setPilots] = useState<IndustryPackPilot[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Workspace Nav Tabs & Calculator States
  const [activeTab, setActiveTab] = useState<"packs" | "compliance" | "calculator">("packs");
  const [calcPackId, setCalcPackId] = useState("steel");
  const [calcOutputTonnes, setCalcOutputTonnes] = useState(10000);

  const calcBenchmark = SECTOR_BAT_BENCHMARKS[calcPackId] || SECTOR_BAT_BENCHMARKS.steel;
  const calcGrossTco2e = Number(((calcOutputTonnes * calcBenchmark.avgKgPerTonne) / 1000).toFixed(1));
  const calcBatTco2e = Number(((calcOutputTonnes * calcBenchmark.batKgPerTonne) / 1000).toFixed(1));
  const calcExcessTco2e = Math.max(0, calcGrossTco2e - calcBatTco2e);
  const calcCbamTaxUsd = calcBenchmark.cbamCovered ? Math.round(calcExcessTco2e * 85) : 0;

  const [form, setForm] = useState({ packId: "steel", facilityRevisionId: "", processRevisionId: "", studyReference: "", periodStart: "2026-01-01", periodEnd: "2026-12-31", outputTonnes: 0, productReference: "", methodologyBoundary: "", methodologySource: "", productionEvidenceDocumentIds: "" });
  const [sectorContext, setSectorContext] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<Line[]>(initialLines);

  const load = useCallback(async () => {
    if (demo) {
      setManifests(FALLBACK_MANIFESTS);
      setFacilities(demoSessionCache.getFacilities());
      setProcesses(demoSessionCache.getProcesses());
      setFactors(DEMO_FACTORS);
      setEvidence(DEMO_EVIDENCE.filter(evidenceReady));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [packs, facilityRows, processRows, factorRows, pilotRows, evidenceResponse] = await Promise.all([
        industryPacksApi.manifests().catch(() => FALLBACK_MANIFESTS),
        industrialCoreApi.facilities().catch(() => []),
        industrialCoreApi.processes().catch(() => []),
        dataGovernanceApi.factorProposals().catch(() => []),
        industryPacksApi.pilots().catch(() => []),
        listEvidenceV2().catch(() => ({ items: [] })),
      ]);
      setManifests(packs && packs.length > 0 ? packs : FALLBACK_MANIFESTS);
      setFacilities(facilityRows);
      setProcesses(processRows);
      setFactors(factorRows);
      setPilots(pilotRows);
      setEvidence((evidenceResponse.items || []).filter(evidenceReady));
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [demo, t]);
  useEffect(() => { void load(); }, [load]);
  const selectedPack = manifests.find((pack) => pack.id === form.packId);
  const patchLine = (index: number, changes: Partial<Line>) => setLines((current) => current.map((line, position) => position === index ? { ...line, ...changes } : line));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (demo || saving) return;
    setSaving(true); setError(null);
    try {
      await industryPacksApi.createPilot({ ...form, sectorContext, allocation: { method: "single_product", share: 1 }, methodology: { boundary: form.methodologyBoundary, source: form.methodologySource }, productionEvidenceDocumentIds: splitIds(form.productionEvidenceDocumentIds), activityLines: lines.map((line) => ({ ...line, evidenceDocumentIds: splitIds(line.evidenceDocumentIds) })) });
      await load();
    } catch (cause) { setError(isApiError(cause) ? cause.message : t("saveError")); }
    finally { setSaving(false); }
  };

  const downloadPilotReportCsv = (pilot: IndustryPackPilot) => {
    const rows = [
      ["WEAVECARBON INDUSTRY STUDY REPORT", "G2-05 & G2-12"],
      ["Study Reference", pilot.studyReference],
      ["Revision", String(pilot.revision)],
      ["Industry Pack", pilot.packId],
      ["Pack Version", pilot.packVersion],
      ["Approval Status", pilot.packApprovalStatus],
      ["Status", pilot.status],
      ["Period", `${pilot.periodStart} to ${pilot.periodEnd}`],
      ["Gross Emissions (tCO2e)", String(pilot.result.totals?.grossTco2e ?? 0)],
      ["Emission Intensity (kgCO2e/t)", String(pilot.result.totals?.intensityKgCo2ePerTonne ?? 0)],
      ["Input SHA-256", pilot.inputSha256],
      ["Result SHA-256", pilot.resultSha256],
      ["Created At", pilot.createdAt],
      [],
      ["--- ACTIVITY LINES BREAKDOWN ---"],
      ["Category", "Source Reference", "Quantity", "Unit", "CO2e (t)", "Factor Label", "Evidence Document IDs"],
      ...((pilot.result.lines || []) as Record<string, unknown>[]).map((l) => [
        String(l.category || ""),
        String(l.sourceReference || ""),
        String(l.activityQuantity || 0),
        String(l.activityUnit || ""),
        String(l.calculatedTco2e || 0),
        String(l.factorLabel || ""),
        Array.isArray(l.evidenceDocumentIds) ? (l.evidenceDocumentIds as unknown[]).join(";") : ""
      ]),
      [],
      ["--- AUDIT FINDINGS & BENCHMARKS ---"],
      ["Finding Code", "Severity", "Message"],
      ...((pilot.result.findings || []) as Record<string, unknown>[]).map((f) => [
        String(f.code || ""),
        String(f.severity || "info"),
        `"${String(f.message || "").replace(/"/g, '""')}"`
      ])
    ];

    const csvContent = "\uFEFF" + rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Industry_Study_${pilot.studyReference}_rev${pilot.revision}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPilotAuditJson = (pilot: IndustryPackPilot) => {
    const jsonStr = JSON.stringify(pilot, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Audit_Evidence_${pilot.studyReference}_rev${pilot.revision}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-zinc-900 to-amber-950 p-7 text-white shadow-md">
        <p className="text-sm font-semibold uppercase tracking-[.15em] text-amber-200">
          G2-05 + G2-12 · Industry Packs
        </p>
        <h1 className="mt-3 text-3xl font-bold">{t("title")}</h1>
        <p className="mt-3 max-w-3xl text-slate-200 text-sm leading-relaxed">{t("description")}</p>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
          {error}
        </div>
      )}

      {demo && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {t("demoReadOnly")}
        </div>
      )}

      {/* Workspace Tabs Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div className="flex items-center rounded-lg border border-input bg-muted/40 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("packs")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "packs"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Factory className="h-3.5 w-3.5" />
            7 Gói Ngành (Industry Packs)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("compliance")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "compliance"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Sẵn sàng Tuân thủ (Multi-Regulation)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("calculator")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "calculator"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calculator className="h-3.5 w-3.5" />
            Máy tính Thử nghiệm & Chuẩn BAT
          </button>
        </div>

        <Badge variant="outline" className="text-xs text-primary gap-1">
          <Sparkles className="h-3.5 w-3.5" /> Chuẩn hóa Thuyết minh 12.09
        </Badge>
      </div>

      {activeTab === "packs" && (
        <div className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {manifests.map((pack) => (
          <Card key={pack.id} className="border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Factory className="h-5 w-5 text-amber-700" />
                {pack.label}
              </CardTitle>
              <CardDescription className="text-xs">
                {pack.version} · <span className="font-semibold text-slate-700">{pack.approvalStatus}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              <p className="text-sm font-medium text-slate-800">{pack.processes.join(" · ")}</p>
              <p className="text-xs text-slate-600">
                <b className="text-slate-800">Activity bắt buộc:</b> {pack.requiredCategories.map((item) => categoryLabel[item] || item).join(" · ")}
              </p>
              <p className="text-xs text-slate-600">
                <b className="text-slate-800">Evidence:</b> {pack.evidenceChecklist.join(" · ")}
              </p>
              <p className="text-xs text-muted-foreground pt-1 border-t border-slate-100">
                {t("targetCaution")}: {pack.targetMappings.join(" · ")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border border-slate-200/80 shadow-xs">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">{t("pilotTitle")}</CardTitle>
              <CardDescription className="text-slate-600 mt-0.5">{t("pilotDescription")}</CardDescription>
            </div>
            <DataEntryScanTrigger
              contextKey="production_batch"
              demo={demo}
              disabled={demo}
              variant="dialog_header"
              fileButtonLabel="Quét Lô sản xuất / Báo cáo LCA"
              cameraButtonLabel="Chụp nhãn lô"
              onApply={(data) => {
                setForm((prev) => ({
                  ...prev,
                  studyReference: (data.studyReference as string) || prev.studyReference,
                  productReference: (data.productReference as string) || (data.batchReference as string) || prev.productReference,
                  outputTonnes: data.outputTonnes != null ? Number(data.outputTonnes) : prev.outputTonnes,
                }));
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <form className="space-y-5" onSubmit={submit}>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Industry Pack</label>
                <select
                  className={selectClass}
                  disabled={demo}
                  value={form.packId}
                  onChange={(event) => {
                    const pack = manifests.find((item) => item.id === event.target.value);
                    setForm({ ...form, packId: event.target.value, processRevisionId: "" });
                    setSectorContext({});
                    setLines(initialLines(pack?.requiredCategories));
                  }}
                >
                  <option value="">Chọn Industry Pack</option>
                  {manifests.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">{t("selectFacility")}</label>
                <select
                  required
                  className={selectClass}
                  disabled={demo}
                  value={form.facilityRevisionId}
                  onChange={(event) => setForm({ ...form, facilityRevisionId: event.target.value, processRevisionId: "" })}
                >
                  <option value="">{t("selectFacility")}</option>
                  {facilities.map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">{t("selectProcess")}</label>
                <select
                  required
                  className={selectClass}
                  disabled={demo}
                  value={form.processRevisionId}
                  onChange={(event) => setForm({ ...form, processRevisionId: event.target.value })}
                >
                  <option value="">{t("selectProcess")}</option>
                  {processes
                    .filter((process) => process.facilityRevisionId === form.facilityRevisionId && selectedPack?.pilotProcesses.includes(process.processType))
                    .map((process) => (
                      <option key={process.id} value={process.id}>
                        {process.name} · {process.processType}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Mã nghiên cứu (Study Ref)</label>
                <Input
                  required
                  disabled={demo}
                  placeholder={t("studyReference")}
                  value={form.studyReference}
                  onChange={(event) => setForm({ ...form, studyReference: event.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Mã sản phẩm (Product Ref)</label>
                <Input
                  required
                  disabled={demo}
                  placeholder={t("productReference")}
                  value={form.productReference}
                  onChange={(event) => setForm({ ...form, productReference: event.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Sản lượng (Tấn)</label>
                <Input
                  required
                  disabled={demo}
                  type="number"
                  min="0.000001"
                  step="any"
                  placeholder={t("outputTonnes")}
                  value={form.outputTonnes || ""}
                  onChange={(event) => setForm({ ...form, outputTonnes: Number(event.target.value) })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Bắt đầu kỳ</label>
                <Input
                  required
                  disabled={demo}
                  type="date"
                  value={form.periodStart}
                  onChange={(event) => setForm({ ...form, periodStart: event.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Kết thúc kỳ</label>
                <Input
                  required
                  disabled={demo}
                  type="date"
                  value={form.periodEnd}
                  onChange={(event) => setForm({ ...form, periodEnd: event.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">{t("productionEvidence")}</label>
                <select
                  required
                  className={selectClass}
                  disabled={demo}
                  value={form.productionEvidenceDocumentIds}
                  onChange={(event) => setForm({ ...form, productionEvidenceDocumentIds: event.target.value })}
                >
                  <option value="">{t("productionEvidence")}</option>
                  {evidence.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.documentName} · {item.status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedPack && selectedPack.requiredContextFields.length > 0 && (
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                <h3 className="mb-3 font-semibold text-sm text-slate-900">Ngữ cảnh bắt buộc của {selectedPack.label}</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {selectedPack.requiredContextFields.map((key) => (
                    <label key={key} className="space-y-1 text-sm block">
                      <span className="font-medium text-xs text-slate-700">{selectedPack.contextFieldDescriptions[key] || key}</span>
                      <Input
                        required
                        disabled={demo}
                        type={key === "recycledContentPercent" ? "number" : "text"}
                        min={key === "recycledContentPercent" ? 0 : undefined}
                        max={key === "recycledContentPercent" ? 100 : undefined}
                        step={key === "recycledContentPercent" ? "0.001" : undefined}
                        value={sectorContext[key] || ""}
                        onChange={(event) => setSectorContext({ ...sectorContext, [key]: event.target.value })}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Ranh giới phương pháp tính</label>
                <Textarea
                  required
                  disabled={demo}
                  placeholder={t("methodologyBoundary")}
                  value={form.methodologyBoundary}
                  onChange={(event) => setForm({ ...form, methodologyBoundary: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Nguồn tham chiếu phương pháp</label>
                <Textarea
                  required
                  disabled={demo}
                  placeholder={t("methodologySource")}
                  value={form.methodologySource}
                  onChange={(event) => setForm({ ...form, methodologySource: event.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hạng mục hoạt động (Activity Lines)</h4>
              {lines.map((line, index) => (
                <div key={line.category} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3">
                  <h3 className="font-semibold text-sm text-slate-900">{categoryLabel[line.category] || line.category}</h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Input
                      required
                      disabled={demo}
                      placeholder={t("sourceReference")}
                      value={line.sourceReference}
                      onChange={(event) => patchLine(index, { sourceReference: event.target.value })}
                    />
                    <Input
                      required
                      disabled={demo}
                      type="number"
                      min="0"
                      step="any"
                      placeholder={t("quantity")}
                      value={line.activityQuantity || ""}
                      onChange={(event) => patchLine(index, { activityQuantity: Number(event.target.value) })}
                    />
                    <Input
                      required
                      disabled={demo}
                      placeholder={t("unit")}
                      value={line.activityUnit}
                      onChange={(event) => patchLine(index, { activityUnit: event.target.value })}
                    />
                    <select
                      required
                      className={selectClass}
                      disabled={demo}
                      value={line.factorProposalId}
                      onChange={(event) => patchLine(index, { factorProposalId: event.target.value })}
                    >
                      <option value="">{t("selectFactor")}</option>
                      {factors
                        .filter((factor) => {
                          if (!(factor.governanceStatus === "approved_for_release_candidate")) return false;
                          const normActivityUnit = line.activityUnit.trim().toLowerCase();
                          if (!normActivityUnit) return true;
                          const normFactorUnit = factor.unit.trim().toLowerCase();
                          return normFactorUnit === `kgco2e/${normActivityUnit}` || normFactorUnit === normActivityUnit;
                        })
                        .map((factor) => (
                          <option key={factor.id} value={factor.id}>
                            {factor.label} · {factor.unit}
                          </option>
                        ))}
                    </select>
                    <select
                      required
                      className={`${selectClass} md:col-span-2`}
                      disabled={demo}
                      value={line.evidenceDocumentIds}
                      onChange={(event) => patchLine(index, { evidenceDocumentIds: event.target.value })}
                    >
                      <option value="">{t("lineEvidence")}</option>
                      {evidence.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.documentName} · {item.status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <Button disabled={demo || saving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("createPilot")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border border-slate-200/80 shadow-xs">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-lg font-bold text-slate-900">{t("resultsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-5 space-y-3">
          {pilots.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center">Chưa có kết quả pilot nào</p>
          ) : (
            pilots.map((pilot) => (
              <div key={pilot.id} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-slate-900">
                    {pilot.studyReference} · rev {pilot.revision}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {pilot.status}
                  </Badge>
                </div>
                <p className="mt-2 text-sm font-semibold text-emerald-800 font-mono">
                  {pilot.result.totals
                    ? `${pilot.result.totals.grossTco2e} tCO₂e · ${pilot.result.totals.intensityKgCo2ePerTonne} kgCO₂e/t`
                    : t("noTotals")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{pilot.result.findings.map((finding) => finding.code).join(" · ")}</p>
                <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-200/60">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-emerald-600/30 text-emerald-800 hover:bg-emerald-50"
                    onClick={() => downloadPilotReportCsv(pilot)}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                    Tải Báo cáo (CSV/Excel)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
                    onClick={() => downloadPilotAuditJson(pilot)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5 text-slate-600" />
                    Bằng chứng Audit (JSON)
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )}

  {/* TAB 2: Multi-Regulation Compliance Matrix */}
  {activeTab === "compliance" && (
    <div className="space-y-6">
      {/* 3 Main Framework Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-slate-200/80 bg-white shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">Cơ chế Biên giới Carbon</span>
              <Badge className="bg-blue-600 text-white text-[10px]">EU Regulation</Badge>
            </div>
            <CardTitle className="text-base font-bold text-slate-900 mt-1">
              EU CBAM (2023/956)
            </CardTitle>
            <CardDescription className="text-xs">
              Phạm vi hàng hóa: Thép, Xi măng, Nhôm, Phân bón
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 text-xs space-y-2.5 text-slate-600">
            <p>
              <strong className="text-slate-900">Yêu cầu hạch toán:</strong> Phát thải trực tiếp (Direct Scope 1) và phát thải gián tiếp (Indirect Scope 2) trên từng mã HS hàng hóa xuất khẩu.
            </p>
            <p>
              <strong className="text-slate-900">Nguyên tắc dữ liệu:</strong> Bắt buộc dùng dữ liệu sơ cấp thực tế (Actual Primary Data) từ cơ sở sản xuất; phạt nặng hệ số mặc định (default values penalty).
            </p>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Hiệu lực áp thuế:</span>
              <strong className="text-amber-600 font-semibold">Từ 01/01/2026</strong>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 bg-white shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Luật BVMT Việt Nam</span>
              <Badge className="bg-emerald-600 text-white text-[10px]">QĐ 13/2024 & QĐ 01/2022</Badge>
            </div>
            <CardTitle className="text-base font-bold text-slate-900 mt-1">
              Kiểm kê KNK Bắt buộc Cấp Cơ sở
            </CardTitle>
            <CardDescription className="text-xs">
              2.166 cơ sở phát thải trọng điểm quốc gia
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 text-xs space-y-2.5 text-slate-600">
            <p>
              <strong className="text-slate-900">Ngưỡng chịu sự điều chỉnh:</strong> Cơ sở phát thải ≥ 3.000 tCO₂e/năm hoặc tiêu thụ năng lượng ≥ 1.000 TOE/năm.
            </p>
            <p>
              <strong className="text-slate-900">Kỳ hạn báo cáo:</strong> Báo cáo định kỳ 2 năm một lần; nộp UBND cấp tỉnh và Bộ quản lý chuyên ngành trước ngày 31 tháng 3.
            </p>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Kỳ kiểm kê đầu tiên:</span>
              <strong className="text-emerald-600 font-semibold">Chốt nộp năm 2025</strong>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 bg-white shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider">Chuẩn mực Toàn cầu</span>
              <Badge className="bg-purple-600 text-white text-[10px]">ISO & GHG Protocol</Badge>
            </div>
            <CardTitle className="text-base font-bold text-slate-900 mt-1">
              ISO 14064-1 & GHG Protocol
            </CardTitle>
            <CardDescription className="text-xs">
              Áp dụng cho chuỗi cung ứng & yêu cầu nhãn hàng
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 text-xs space-y-2.5 text-slate-600">
            <p>
              <strong className="text-slate-900">Ranh giới tổ chức:</strong> Phương pháp Kiểm soát Vận hành (Operational Control) hoặc Tỷ lệ vốn góp (Equity Share).
            </p>
            <p>
              <strong className="text-slate-900">Đảm bảo kiểm toán:</strong> Xác minh độc lập bên thứ 3 (Limited / Reasonable Assurance) theo tiêu chuẩn ISO 14064-3.
            </p>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Tính tương thích:</span>
              <strong className="text-purple-600 font-semibold">100% WeaveCarbon Engine</strong>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sector Readiness Matrix Table */}
      <Card className="border border-slate-200/80 bg-white shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Ma trận Sẵn sàng Tuân thủ theo 7 Ngành Công Nghiệp Trọng Điểm
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Đánh giá mức độ hoàn thiện cấu trúc dữ liệu, bằng chứng số và sự phù hợp với các khung quy định
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs text-primary gap-1 border-emerald-300 bg-emerald-50 text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> 7/7 Ngành đã chuẩn hóa Taxonomy
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold">
              <tr>
                <th className="px-3.5 py-2.5">Ngành công nghiệp</th>
                <th className="px-3.5 py-2.5">Phạm vi CBAM EU</th>
                <th className="px-3.5 py-2.5">Bắt buộc QĐ 13/2024</th>
                <th className="px-3.5 py-2.5 text-center">Độ sẵn sàng Dữ liệu</th>
                <th className="px-3.5 py-2.5">Hành động trọng tâm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { sector: "Thép & Hợp kim sắt (Steel)", cbam: "Bắt buộc (Annex I)", vn: "Nhóm cơ sở cấp 1", score: "88%", action: "Bóc tách phát thải điện phân EAF vs lò cao BF-BOF" },
                { sector: "Xi măng & Clinker (Cement)", cbam: "Bắt buộc (Annex I)", vn: "Nhóm cơ sở cấp 1", score: "86%", action: "Kiểm soát phát thải nung đá vôi CaCO3 & tỷ lệ clinker" },
                { sector: "Dệt may & Da giày (Textile & Apparel)", cbam: "Khảo sát Scope 3", vn: "Cơ sở nhuộm & dệt lớn", score: "94%", action: "BOM nguyên liệu, lò hơi biomass & dữ liệu chuỗi cung ứng" },
                { sector: "Nhôm & Đúc kim loại (Aluminium)", cbam: "Bắt buộc (Annex I)", vn: "Nhóm cơ sở cấp 1", score: "90%", action: "Đo phát thải anode PFCs & tỷ lệ nhôm tái chế" },
                { sector: "Vật liệu xây dựng & Gốm sứ", cbam: "Đang xem xét mở rộng", vn: "Cơ sở gạch gốm kính", score: "82%", action: "Định lượng tiêu hao khí nung và vận tải nội bộ" },
                { sector: "Hóa chất & Phân bón (Fertilisers)", cbam: "Bắt buộc phân bón", vn: "Nhóm hóa chất cơ bản", score: "84%", action: "Giám sát N2O axit nitric & định mức khí thiên nhiên" },
                { sector: "Khai khoáng & Khoáng sản", cbam: "Quặng sắt đầu vào CBAM", vn: "Mỏ khai thác quy mô lớn", score: "80%", action: "Dữ liệu nhiên liệu xe tải mỏ & điện tuyển khoáng" },
              ].map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60">
                  <td className="px-3.5 py-3 font-semibold text-slate-900">{item.sector}</td>
                  <td className="px-3.5 py-3">
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
                      {item.cbam}
                    </span>
                  </td>
                  <td className="px-3.5 py-3">
                    <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {item.vn}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-center">
                    <span className="font-bold text-emerald-700 font-mono">{item.score}</span>
                  </td>
                  <td className="px-3.5 py-3 text-slate-500">{item.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )}

  {/* TAB 3: Interactive Industry Pilot Calculator & BAT Gap Analyzer */}
  {activeTab === "calculator" && (
    <div className="space-y-6">
      <Card className="border border-slate-200/80 bg-white shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <Calculator className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Máy tính Thử nghiệm Ngành Công nghiệp & Đối chiếu Chuẩn BAT
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Mô phỏng tức thời cường độ phát thải theo sản lượng, đối chiếu với ngưỡng Best Available Techniques và ước tính rủi ro thuế CBAM
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="border-emerald-300 text-emerald-800 text-xs gap-1 bg-emerald-50">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> AI Industrial Simulator
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Chọn Gói Ngành Công nghiệp:
              </label>
              <select
                value={calcPackId}
                onChange={(e) => setCalcPackId(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900"
              >
                {manifests.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Sản lượng kế hoạch (Tấn thành phẩm):
              </label>
              <Input
                type="number"
                min="1"
                value={calcOutputTonnes}
                onChange={(e) => setCalcOutputTonnes(Number(e.target.value) || 1)}
                className="h-10 text-sm font-semibold"
              />
            </div>
          </div>

          {/* 4 Calculation Metric Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 shadow-xs">
              <span className="text-xs text-slate-500">Phát thải Ước tính Hiện trạng</span>
              <p className="mt-2 text-2xl font-bold text-slate-900 font-mono">
                {calcGrossTco2e.toLocaleString("vi-VN")} <span className="text-xs font-normal text-slate-500">tCO₂e</span>
              </p>
              <span className="text-[11px] text-slate-500">
                Định mức: {calcBenchmark.avgKgPerTonne} {calcBenchmark.unit}
              </span>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
              <span className="text-xs font-medium text-emerald-800">Ngưỡng chuẩn BAT Châu Âu</span>
              <p className="mt-2 text-2xl font-bold text-emerald-700 font-mono">
                {calcBatTco2e.toLocaleString("vi-VN")} <span className="text-xs font-normal text-slate-500">tCO₂e</span>
              </p>
              <span className="text-[11px] text-emerald-700 font-medium">
                Cận biên tối ưu: {calcBenchmark.batKgPerTonne} {calcBenchmark.unit}
              </span>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
              <span className="text-xs font-medium text-amber-800">Chênh lệch Vượt chuẩn BAT</span>
              <p className="mt-2 text-2xl font-bold text-amber-700 font-mono">
                +{calcExcessTco2e.toLocaleString("vi-VN")} <span className="text-xs font-normal text-slate-500">tCO₂e</span>
              </p>
              <span className="text-[11px] text-amber-700 font-medium">
                Tiềm năng cắt giảm {((calcExcessTco2e / (calcGrossTco2e || 1)) * 100).toFixed(1)}%
              </span>
            </div>

            <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 shadow-xs">
              <span className="text-xs font-medium text-teal-800">Rủi ro Chứng chỉ CBAM EU</span>
              <p className="mt-2 text-2xl font-bold text-teal-700 font-mono">
                ${calcCbamTaxUsd.toLocaleString("en-US")} <span className="text-xs font-normal text-slate-500">USD</span>
              </p>
              <span className="text-[11px] text-slate-500">
                {calcBenchmark.cbamCovered ? "Áp dụng định giá 85 EUR/tấn" : "Chưa thuộc phạm vi bắt buộc"}
              </span>
            </div>
          </div>

          {/* Recommended Decarbonization Breakthrough */}
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50/60 via-slate-50 to-teal-50/60 p-4 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
              <Sparkles className="h-4 w-4 text-emerald-700" />
              <span>Công nghệ Giảm phát thải Đề xuất cho Ngành {manifests.find(p => p.id === calcPackId)?.label}:</span>
            </div>
            <p className="text-slate-900 text-sm font-semibold">
              💡 {calcBenchmark.intervention}
            </p>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Áp dụng giải pháp này giúp đưa cường độ phát thải về sát cận biên BAT Châu Âu, triệt tiêu nguy cơ chịu thuế carbon biên giới khi xuất khẩu.
            </p>
            <div className="pt-2 flex justify-end">
              <Button
                size="sm"
                onClick={() => {
                  setForm((prev) => ({ ...prev, packId: calcPackId, outputTonnes: calcOutputTonnes }));
                  setActiveTab("packs");
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                Khởi tạo Hồ sơ Nghiên cứu Pilot cho Cấu hình này →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )}

  <p className="text-xs text-muted-foreground">{t("legalNotice")}</p>
</main>
);
}
