"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Network, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/apiClient";
import { climateRiskApi, type ClimateAssessment } from "@/lib/climateRiskApi";
import { industrialCoreApi, type IndustrialFacility } from "@/lib/industrialCoreApi";
import {
  supplierNetworkApi,
  type CarbonCriticalitySnapshot,
  type CriticalityModel,
  type CriticalityPortfolio,
  type CriticalitySnapshot,
  type SupplierClimateAssessment,
  type SupplierProfile,
  type SupplierRelationship,
  type SupplierSite
} from "@/lib/supplierNetworkApi";
import { listEvidenceV2, type EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";

const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
const evidenceReady = (item: EvidenceDocumentV2) => ["locked", "third_party_verified"].includes(item.status) &&
  /^[a-f0-9]{64}$/i.test(item.checksumSha256 || "") && item.fileSizeBytes > 0;
const priorityClass: Record<string, string> = {
  low: "border-emerald-300 bg-emerald-50 text-emerald-800",
  medium: "border-amber-300 bg-amber-50 text-amber-800",
  high: "border-red-300 bg-red-50 text-red-800"
};
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="space-y-1 text-sm"><span className="font-medium">{label}</span>{children}{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</label>;
}
function EvidenceSelect({ value, onChange, evidence, disabled = false }: {
  value: string; onChange: (value: string) => void; evidence: EvidenceDocumentV2[]; disabled?: boolean;
}) {
  return <select required disabled={disabled} className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="">Chọn bằng chứng đã khóa</option>
    {evidence.map((item) => <option key={item.id} value={item.id}>{item.documentName} · {item.status}</option>)}
  </select>;
}

const emptyProfile = { supplierReference: "", legalName: "", tradingName: "", countryCode: "VN", sector: "", supplierTier: "1", lifecycleStatus: "active", evidenceDocumentId: "" };
const emptySite = { supplierRevisionId: "", siteReference: "", siteName: "", countryCode: "VN", latitude: "", longitude: "", precisionMeters: "100", locationBasis: "", evidenceDocumentId: "" };
const emptyRelationship = { supplierRevisionId: "", relationshipReference: "", materialOrService: "", procurementCategory: "", spendPercent: "", productionDependencyPercent: "", singleSource: false, dependentSkuCount: "0", dependentRouteCount: "0", effectiveFrom: "", effectiveTo: "", evidenceDocumentId: "" };
const emptyClimate = { supplierRevisionId: "", siteRevisionId: "", hazardType: "heat", scenarioKind: "historical", scenarioReference: "", horizonStart: "", horizonEnd: "", sourceKind: "ERA5_LAND", sourceUrl: "", datasetIdentifier: "", datasetVersion: "", spatialResolution: "", temporalResolution: "", gridReference: "", spatialMatchNotes: "", modelName: "", scenarioName: "", hazardMetric: "", metricValue: "", metricUnit: "", uncertaintyNotes: "", exposureRating: "3", vulnerabilityRating: "3", priorityBand: "medium", ratingRationale: "", evidenceDocumentId: "" };
const emptyCarbon = { subjectKind: "supplier", facilityRevisionId: "", supplierRevisionId: "", reportingPeriodStart: "", reportingPeriodEnd: "", grossKgCo2e: "", activityQuantity: "", activityUnit: "", intensityKgCo2e: "", boundary: "", methodologyReference: "", sourceKind: "supplier_specific", dataQualityLevel: "L2", evidenceDocumentId: "" };
const emptyModel = { modelReference: "", carbonWeightPercent: "35", climateWeightPercent: "35", dependencyWeightPercent: "30", mediumThreshold: "40", highThreshold: "70", normalizationPolicy: "", rationale: "", approvalStatus: "draft", evidenceDocumentId: "" };
const emptyCriticality = { subjectKind: "supplier", facilityRevisionId: "", supplierRevisionId: "", relationshipRevisionId: "", carbonSnapshotId: "", modelRevisionId: "", assessmentPeriodStart: "", assessmentPeriodEnd: "", normalizedCarbonScore: "", normalizedClimateScore: "", normalizedDependencyScore: "", carbonScoreRationale: "", climateScoreRationale: "", dependencyScoreRationale: "" };

export default function SupplierNetworkPanel({ demo = false }: { demo?: boolean }) {
  const [profiles, setProfiles] = useState<SupplierProfile[]>([]);
  const [sites, setSites] = useState<SupplierSite[]>([]);
  const [relationships, setRelationships] = useState<SupplierRelationship[]>([]);
  const [supplierClimate, setSupplierClimate] = useState<SupplierClimateAssessment[]>([]);
  const [facilityClimate, setFacilityClimate] = useState<ClimateAssessment[]>([]);
  const [carbon, setCarbon] = useState<CarbonCriticalitySnapshot[]>([]);
  const [models, setModels] = useState<CriticalityModel[]>([]);
  const [criticality, setCriticality] = useState<CriticalitySnapshot[]>([]);
  const [portfolios, setPortfolios] = useState<CriticalityPortfolio[]>([]);
  const [facilities, setFacilities] = useState<IndustrialFacility[]>([]);
  const [evidence, setEvidence] = useState<EvidenceDocumentV2[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState(emptyProfile);
  const [siteForm, setSiteForm] = useState(emptySite);
  const [relationshipForm, setRelationshipForm] = useState(emptyRelationship);
  const [climateForm, setClimateForm] = useState(emptyClimate);
  const [carbonForm, setCarbonForm] = useState(emptyCarbon);
  const [modelForm, setModelForm] = useState(emptyModel);
  const [criticalityForm, setCriticalityForm] = useState(emptyCriticality);
  const [selectedClimateIds, setSelectedClimateIds] = useState<string[]>([]);
  const [portfolioReference, setPortfolioReference] = useState("");
  const [portfolioNotes, setPortfolioNotes] = useState("");
  const [selectedCriticalityIds, setSelectedCriticalityIds] = useState<string[]>([]);
  const [portfolioDetail, setPortfolioDetail] = useState<CriticalityPortfolio | null>(null);

  const load = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    try {
      const [profileRows, siteRows, relationshipRows, supplierClimateRows, facilityClimateRows, carbonRows, modelRows,
        criticalityRows, portfolioRows, facilityRows, evidenceResponse] = await Promise.all([
        supplierNetworkApi.profiles(), supplierNetworkApi.sites(), supplierNetworkApi.relationships(),
        supplierNetworkApi.climateAssessments(), climateRiskApi.assessments(), supplierNetworkApi.carbonSnapshots(),
        supplierNetworkApi.models(), supplierNetworkApi.criticalitySnapshots(), supplierNetworkApi.portfolios(),
        industrialCoreApi.facilities(), listEvidenceV2()
      ]);
      setProfiles(profileRows); setSites(siteRows); setRelationships(relationshipRows); setSupplierClimate(supplierClimateRows);
      setFacilityClimate(facilityClimateRows); setCarbon(carbonRows); setModels(modelRows); setCriticality(criticalityRows);
      setPortfolios(portfolioRows); setFacilities(facilityRows); setEvidence(evidenceResponse.items.filter(evidenceReady)); setError(null);
    } catch (cause) { setError(isApiError(cause) ? cause.message : "Không thể tải không gian quản trị mạng lưới nhà cung ứng."); }
    finally { setLoading(false); }
  }, [demo]);
  useEffect(() => { void load(); }, [load]);

  const run = async (action: () => Promise<unknown>, reset?: () => void) => {
    if (demo || saving) return;
    setSaving(true); setError(null);
    try { await action(); reset?.(); await load(); }
    catch (cause) { setError(isApiError(cause) ? cause.message : "Không thể lưu bản ghi quản trị."); }
    finally { setSaving(false); }
  };
  const submit = (event: FormEvent, action: () => Promise<unknown>, reset?: () => void) => {
    event.preventDefault(); void run(action, reset);
  };
  const selectedSupplierSites = sites.filter((item) => item.supplierRevisionId === climateForm.supplierRevisionId);
  const selectedSupplierRelationships = relationships.filter((item) => item.supplierRevisionId === criticalityForm.supplierRevisionId);
  const compatibleCarbon = carbon.filter((item) => item.subjectKind === criticalityForm.subjectKind &&
    (item.subjectKind === "supplier" ? item.supplierRevisionId === criticalityForm.supplierRevisionId : item.facilityRevisionId === criticalityForm.facilityRevisionId));
  const compatibleClimate = criticalityForm.subjectKind === "supplier"
    ? supplierClimate.filter((item) => item.supplierRevisionId === criticalityForm.supplierRevisionId)
    : facilityClimate.filter((item) => item.facilityRevisionId === criticalityForm.facilityRevisionId);
  const weightTotal = useMemo(() => Number(modelForm.carbonWeightPercent || 0) + Number(modelForm.climateWeightPercent || 0) + Number(modelForm.dependencyWeightPercent || 0), [modelForm]);

  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  return <section className="space-y-6">
    <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950 p-7 text-white">
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[.15em] text-emerald-200"><Network className="h-5 w-5" />G2-11 · Supplier Network</p>
      <h2 className="mt-3 text-3xl font-bold">Carbon + Climate Criticality</h2>
      <p className="mt-3 max-w-4xl text-slate-200">Quản trị hồ sơ, địa điểm và quan hệ nhà cung ứng; liên kết carbon, khí hậu và phụ thuộc kinh doanh bằng mô hình trọng số minh bạch.</p>
    </div>
    <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p>Đây là công cụ sàng lọc có kiểm soát, không phải dự báo rủi ro vật lý hoặc kết luận đảm bảo tự động. Điểm chuẩn hóa do người được phân quyền cung cấp theo chính sách đã phê duyệt; mọi kết quả vẫn cần chuyên gia rà soát.</p></div>
    {demo && <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">Chế độ demo chỉ đọc; không tạo bản ghi quản trị.</div>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

    <Card><CardHeader><CardTitle>1. Hồ sơ và quan hệ nhà cung ứng</CardTitle><CardDescription>Mỗi thay đổi tạo một revision bất biến và yêu cầu bằng chứng đã khóa.</CardDescription></CardHeader><CardContent className="space-y-6">
      <form className="grid gap-3 md:grid-cols-4" onSubmit={(event) => submit(event, () => supplierNetworkApi.createProfile({ ...profileForm, supplierTier: Number(profileForm.supplierTier) }), () => setProfileForm(emptyProfile))}>
        <Field label="Mã nhà cung ứng"><Input required disabled={demo} value={profileForm.supplierReference} onChange={(event) => setProfileForm({ ...profileForm, supplierReference: event.target.value })} /></Field>
        <Field label="Tên pháp lý"><Input required disabled={demo} value={profileForm.legalName} onChange={(event) => setProfileForm({ ...profileForm, legalName: event.target.value })} /></Field>
        <Field label="Tên giao dịch"><Input disabled={demo} value={profileForm.tradingName} onChange={(event) => setProfileForm({ ...profileForm, tradingName: event.target.value })} /></Field>
        <Field label="Quốc gia"><Input required disabled={demo} minLength={2} maxLength={2} value={profileForm.countryCode} onChange={(event) => setProfileForm({ ...profileForm, countryCode: event.target.value.toUpperCase() })} /></Field>
        <Field label="Ngành"><Input required disabled={demo} value={profileForm.sector} onChange={(event) => setProfileForm({ ...profileForm, sector: event.target.value })} /></Field>
        <Field label="Tầng"><Input required disabled={demo} type="number" min="1" max="4" value={profileForm.supplierTier} onChange={(event) => setProfileForm({ ...profileForm, supplierTier: event.target.value })} /></Field>
        <Field label="Trạng thái"><select disabled={demo} className={selectClass} value={profileForm.lifecycleStatus} onChange={(event) => setProfileForm({ ...profileForm, lifecycleStatus: event.target.value })}><option value="prospective">Tiềm năng</option><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option></select></Field>
        <Field label="Bằng chứng"><EvidenceSelect disabled={demo} evidence={evidence} value={profileForm.evidenceDocumentId} onChange={(value) => setProfileForm({ ...profileForm, evidenceDocumentId: value })} /></Field>
        <Button disabled={demo || saving} className="md:col-span-4">Tạo revision hồ sơ</Button>
      </form>
      <div className="grid gap-2 md:grid-cols-3">{profiles.map((item) => <div key={item.id} className="rounded-xl border p-3 text-sm"><b>{item.legalName}</b><p>{item.supplierReference} · Tier {item.supplierTier} · rev {item.revision}</p><p className="text-xs text-muted-foreground">{item.countryCode} · {item.sector} · {item.lifecycleStatus}</p></div>)}</div>
      <div className="grid gap-6 xl:grid-cols-2">
        <form className="grid gap-3 rounded-xl border p-4 md:grid-cols-2" onSubmit={(event) => submit(event, () => supplierNetworkApi.createSite({ ...siteForm, latitude: Number(siteForm.latitude), longitude: Number(siteForm.longitude), precisionMeters: Number(siteForm.precisionMeters) }), () => setSiteForm(emptySite))}>
          <h3 className="font-semibold md:col-span-2">Địa điểm nhà cung ứng</h3>
          <Field label="Nhà cung ứng"><select required disabled={demo} className={selectClass} value={siteForm.supplierRevisionId} onChange={(event) => setSiteForm({ ...siteForm, supplierRevisionId: event.target.value })}><option value="">Chọn revision</option>{profiles.map((item) => <option key={item.id} value={item.id}>{item.legalName} · rev {item.revision}</option>)}</select></Field>
          <Field label="Mã địa điểm"><Input required disabled={demo} value={siteForm.siteReference} onChange={(event) => setSiteForm({ ...siteForm, siteReference: event.target.value })} /></Field>
          <Field label="Tên địa điểm"><Input required disabled={demo} value={siteForm.siteName} onChange={(event) => setSiteForm({ ...siteForm, siteName: event.target.value })} /></Field>
          <Field label="Quốc gia"><Input required disabled={demo} minLength={2} maxLength={2} value={siteForm.countryCode} onChange={(event) => setSiteForm({ ...siteForm, countryCode: event.target.value.toUpperCase() })} /></Field>
          <Field label="Vĩ độ"><Input required disabled={demo} type="number" min="-90" max="90" step="0.000001" value={siteForm.latitude} onChange={(event) => setSiteForm({ ...siteForm, latitude: event.target.value })} /></Field>
          <Field label="Kinh độ"><Input required disabled={demo} type="number" min="-180" max="180" step="0.000001" value={siteForm.longitude} onChange={(event) => setSiteForm({ ...siteForm, longitude: event.target.value })} /></Field>
          <Field label="Độ chính xác (m)"><Input required disabled={demo} type="number" min="1" max="100000" value={siteForm.precisionMeters} onChange={(event) => setSiteForm({ ...siteForm, precisionMeters: event.target.value })} /></Field>
          <Field label="Cơ sở vị trí"><Input required disabled={demo} value={siteForm.locationBasis} onChange={(event) => setSiteForm({ ...siteForm, locationBasis: event.target.value })} /></Field>
          <Field label="Bằng chứng"><EvidenceSelect disabled={demo} evidence={evidence} value={siteForm.evidenceDocumentId} onChange={(value) => setSiteForm({ ...siteForm, evidenceDocumentId: value })} /></Field>
          <Button disabled={demo || saving} className="md:col-span-2">Tạo revision địa điểm</Button>
        </form>
        <form className="grid gap-3 rounded-xl border p-4 md:grid-cols-2" onSubmit={(event) => submit(event, () => supplierNetworkApi.createRelationship({ ...relationshipForm, spendPercent: Number(relationshipForm.spendPercent), productionDependencyPercent: Number(relationshipForm.productionDependencyPercent), dependentSkuCount: Number(relationshipForm.dependentSkuCount), dependentRouteCount: Number(relationshipForm.dependentRouteCount), effectiveTo: relationshipForm.effectiveTo || null }), () => setRelationshipForm(emptyRelationship))}>
          <h3 className="font-semibold md:col-span-2">Phụ thuộc kinh doanh</h3>
          <Field label="Nhà cung ứng"><select required disabled={demo} className={selectClass} value={relationshipForm.supplierRevisionId} onChange={(event) => setRelationshipForm({ ...relationshipForm, supplierRevisionId: event.target.value })}><option value="">Chọn revision</option>{profiles.map((item) => <option key={item.id} value={item.id}>{item.legalName} · rev {item.revision}</option>)}</select></Field>
          <Field label="Mã quan hệ"><Input required disabled={demo} value={relationshipForm.relationshipReference} onChange={(event) => setRelationshipForm({ ...relationshipForm, relationshipReference: event.target.value })} /></Field>
          <Field label="Vật liệu / dịch vụ"><Input required disabled={demo} value={relationshipForm.materialOrService} onChange={(event) => setRelationshipForm({ ...relationshipForm, materialOrService: event.target.value })} /></Field>
          <Field label="Nhóm mua sắm"><Input required disabled={demo} value={relationshipForm.procurementCategory} onChange={(event) => setRelationshipForm({ ...relationshipForm, procurementCategory: event.target.value })} /></Field>
          <Field label="% chi tiêu"><Input required disabled={demo} type="number" min="0" max="100" step="0.001" value={relationshipForm.spendPercent} onChange={(event) => setRelationshipForm({ ...relationshipForm, spendPercent: event.target.value })} /></Field>
          <Field label="% phụ thuộc sản xuất"><Input required disabled={demo} type="number" min="0" max="100" step="0.001" value={relationshipForm.productionDependencyPercent} onChange={(event) => setRelationshipForm({ ...relationshipForm, productionDependencyPercent: event.target.value })} /></Field>
          <Field label="Số SKU phụ thuộc"><Input required disabled={demo} type="number" min="0" value={relationshipForm.dependentSkuCount} onChange={(event) => setRelationshipForm({ ...relationshipForm, dependentSkuCount: event.target.value })} /></Field>
          <Field label="Số tuyến phụ thuộc"><Input required disabled={demo} type="number" min="0" value={relationshipForm.dependentRouteCount} onChange={(event) => setRelationshipForm({ ...relationshipForm, dependentRouteCount: event.target.value })} /></Field>
          <Field label="Hiệu lực từ"><Input required disabled={demo} type="date" value={relationshipForm.effectiveFrom} onChange={(event) => setRelationshipForm({ ...relationshipForm, effectiveFrom: event.target.value })} /></Field>
          <Field label="Hiệu lực đến"><Input disabled={demo} type="date" value={relationshipForm.effectiveTo} onChange={(event) => setRelationshipForm({ ...relationshipForm, effectiveTo: event.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input disabled={demo} type="checkbox" checked={relationshipForm.singleSource} onChange={(event) => setRelationshipForm({ ...relationshipForm, singleSource: event.target.checked })} />Nguồn cung duy nhất</label>
          <Field label="Bằng chứng"><EvidenceSelect disabled={demo} evidence={evidence} value={relationshipForm.evidenceDocumentId} onChange={(value) => setRelationshipForm({ ...relationshipForm, evidenceDocumentId: value })} /></Field>
          <Button disabled={demo || saving} className="md:col-span-2">Tạo revision quan hệ</Button>
        </form>
      </div>
      <div className="grid gap-2 md:grid-cols-2">{relationships.map((item) => <div key={item.id} className="rounded-xl border p-3 text-sm"><b>{item.supplierName || item.supplierRevisionId} · {item.materialOrService}</b><p>Chi tiêu {item.spendPercent}% · sản xuất {item.productionDependencyPercent}% · {item.singleSource ? "nguồn duy nhất" : "đa nguồn"}</p><p className="text-xs text-muted-foreground">{item.dependentSkuCount} SKU · {item.dependentRouteCount} tuyến · {item.effectiveFrom}–{item.effectiveTo || "mở"}</p></div>)}</div>
    </CardContent></Card>

    <Card><CardHeader><CardTitle>2. Dữ liệu khí hậu và carbon</CardTitle><CardDescription>Giữ riêng dữ liệu nguồn, bất định, vị trí và biên carbon trước khi chuẩn hóa điểm.</CardDescription></CardHeader><CardContent className="space-y-6">
      <form className="space-y-3 rounded-xl border p-4" onSubmit={(event) => submit(event, () => supplierNetworkApi.createClimateAssessment({ ...climateForm, metricValue: Number(climateForm.metricValue), exposureRating: Number(climateForm.exposureRating), vulnerabilityRating: Number(climateForm.vulnerabilityRating), modelName: climateForm.modelName || null, scenarioName: climateForm.scenarioName || null }), () => setClimateForm(emptyClimate))}>
        <h3 className="font-semibold">Sàng lọc khí hậu tại địa điểm nhà cung ứng</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Nhà cung ứng"><select required disabled={demo} className={selectClass} value={climateForm.supplierRevisionId} onChange={(event) => setClimateForm({ ...climateForm, supplierRevisionId: event.target.value, siteRevisionId: "" })}><option value="">Chọn revision</option>{profiles.map((item) => <option key={item.id} value={item.id}>{item.legalName} · rev {item.revision}</option>)}</select></Field>
          <Field label="Địa điểm"><select required disabled={demo} className={selectClass} value={climateForm.siteRevisionId} onChange={(event) => setClimateForm({ ...climateForm, siteRevisionId: event.target.value })}><option value="">Chọn địa điểm</option>{selectedSupplierSites.map((item) => <option key={item.id} value={item.id}>{item.siteName} · rev {item.revision}</option>)}</select></Field>
          <Field label="Hiểm họa"><select disabled={demo} className={selectClass} value={climateForm.hazardType} onChange={(event) => setClimateForm({ ...climateForm, hazardType: event.target.value })}><option value="heat">Nhiệt</option><option value="drought">Hạn hán</option><option value="extreme_rainfall">Mưa cực đoan</option></select></Field>
          <Field label="Loại kịch bản"><select disabled={demo} className={selectClass} value={climateForm.scenarioKind} onChange={(event) => setClimateForm({ ...climateForm, scenarioKind: event.target.value, sourceKind: event.target.value === "historical" ? "ERA5_LAND" : "CMIP6" })}><option value="historical">Lịch sử</option><option value="projection">Dự phóng</option></select></Field>
          <Field label="Mã kịch bản"><Input required disabled={demo} value={climateForm.scenarioReference} onChange={(event) => setClimateForm({ ...climateForm, scenarioReference: event.target.value })} /></Field>
          <Field label="Từ"><Input required disabled={demo} type="date" value={climateForm.horizonStart} onChange={(event) => setClimateForm({ ...climateForm, horizonStart: event.target.value })} /></Field>
          <Field label="Đến"><Input required disabled={demo} type="date" value={climateForm.horizonEnd} onChange={(event) => setClimateForm({ ...climateForm, horizonEnd: event.target.value })} /></Field>
          <Field label="Nguồn"><select disabled={demo} className={selectClass} value={climateForm.sourceKind} onChange={(event) => setClimateForm({ ...climateForm, sourceKind: event.target.value })}><option value="ERA5_LAND">ERA5-Land</option><option value="CMIP6">CMIP6</option><option value="OTHER">Khác</option></select></Field>
          <Field label="URL nguồn"><Input required disabled={demo} type="url" value={climateForm.sourceUrl} onChange={(event) => setClimateForm({ ...climateForm, sourceUrl: event.target.value })} /></Field>
          {(["datasetIdentifier", "datasetVersion", "spatialResolution", "temporalResolution", "gridReference"] as const).map((key) => <Field key={key} label={{ datasetIdentifier: "Bộ dữ liệu", datasetVersion: "Phiên bản", spatialResolution: "Độ phân giải không gian", temporalResolution: "Độ phân giải thời gian", gridReference: "Ô lưới" }[key]}><Input required disabled={demo} value={climateForm[key]} onChange={(event) => setClimateForm({ ...climateForm, [key]: event.target.value })} /></Field>)}
          {climateForm.scenarioKind === "projection" && <><Field label="Mô hình"><Input required disabled={demo} value={climateForm.modelName} onChange={(event) => setClimateForm({ ...climateForm, modelName: event.target.value })} /></Field><Field label="Tên kịch bản"><Input required disabled={demo} value={climateForm.scenarioName} onChange={(event) => setClimateForm({ ...climateForm, scenarioName: event.target.value })} /></Field></>}
          <Field label="Chỉ số hiểm họa"><Input required disabled={demo} value={climateForm.hazardMetric} onChange={(event) => setClimateForm({ ...climateForm, hazardMetric: event.target.value })} /></Field>
          <Field label="Giá trị"><Input required disabled={demo} type="number" step="0.00000001" value={climateForm.metricValue} onChange={(event) => setClimateForm({ ...climateForm, metricValue: event.target.value })} /></Field>
          <Field label="Đơn vị"><Input required disabled={demo} value={climateForm.metricUnit} onChange={(event) => setClimateForm({ ...climateForm, metricUnit: event.target.value })} /></Field>
          <Field label="Exposure (1–5)"><Input required disabled={demo} type="number" min="1" max="5" value={climateForm.exposureRating} onChange={(event) => setClimateForm({ ...climateForm, exposureRating: event.target.value })} /></Field>
          <Field label="Vulnerability (1–5)"><Input required disabled={demo} type="number" min="1" max="5" value={climateForm.vulnerabilityRating} onChange={(event) => setClimateForm({ ...climateForm, vulnerabilityRating: event.target.value })} /></Field>
          <Field label="Ưu tiên tác giả"><select disabled={demo} className={selectClass} value={climateForm.priorityBand} onChange={(event) => setClimateForm({ ...climateForm, priorityBand: event.target.value })}><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option></select></Field>
          <Field label="Bằng chứng nguồn"><EvidenceSelect disabled={demo} evidence={evidence} value={climateForm.evidenceDocumentId} onChange={(value) => setClimateForm({ ...climateForm, evidenceDocumentId: value })} /></Field>
        </div>
        <div className="grid gap-3 md:grid-cols-3"><Field label="Khớp không gian"><Textarea required disabled={demo} value={climateForm.spatialMatchNotes} onChange={(event) => setClimateForm({ ...climateForm, spatialMatchNotes: event.target.value })} /></Field><Field label="Bất định"><Textarea required disabled={demo} value={climateForm.uncertaintyNotes} onChange={(event) => setClimateForm({ ...climateForm, uncertaintyNotes: event.target.value })} /></Field><Field label="Lý do xếp hạng"><Textarea required disabled={demo} value={climateForm.ratingRationale} onChange={(event) => setClimateForm({ ...climateForm, ratingRationale: event.target.value })} /></Field></div>
        <Button disabled={demo || saving}>Lưu đánh giá khí hậu</Button>
      </form>
      <form className="space-y-3 rounded-xl border p-4" onSubmit={(event) => submit(event, () => supplierNetworkApi.createCarbonSnapshot({ ...carbonForm, facilityRevisionId: carbonForm.subjectKind === "facility" ? carbonForm.facilityRevisionId : null, supplierRevisionId: carbonForm.subjectKind === "supplier" ? carbonForm.supplierRevisionId : null, grossKgCo2e: Number(carbonForm.grossKgCo2e), activityQuantity: carbonForm.activityQuantity ? Number(carbonForm.activityQuantity) : null, activityUnit: carbonForm.activityUnit || null, intensityKgCo2e: carbonForm.intensityKgCo2e ? Number(carbonForm.intensityKgCo2e) : null }), () => setCarbonForm(emptyCarbon))}>
        <h3 className="font-semibold">Cơ sở carbon bất biến</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Loại đối tượng"><select disabled={demo} className={selectClass} value={carbonForm.subjectKind} onChange={(event) => setCarbonForm({ ...carbonForm, subjectKind: event.target.value, facilityRevisionId: "", supplierRevisionId: "", sourceKind: event.target.value === "supplier" ? "supplier_specific" : "facility_inventory" })}><option value="supplier">Nhà cung ứng</option><option value="facility">Cơ sở</option></select></Field>
          {carbonForm.subjectKind === "supplier" ? <Field label="Nhà cung ứng"><select required disabled={demo} className={selectClass} value={carbonForm.supplierRevisionId} onChange={(event) => setCarbonForm({ ...carbonForm, supplierRevisionId: event.target.value })}><option value="">Chọn revision</option>{profiles.map((item) => <option key={item.id} value={item.id}>{item.legalName} · rev {item.revision}</option>)}</select></Field> : <Field label="Cơ sở"><select required disabled={demo} className={selectClass} value={carbonForm.facilityRevisionId} onChange={(event) => setCarbonForm({ ...carbonForm, facilityRevisionId: event.target.value })}><option value="">Chọn cơ sở</option>{facilities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
          <Field label="Kỳ từ"><Input required disabled={demo} type="date" value={carbonForm.reportingPeriodStart} onChange={(event) => setCarbonForm({ ...carbonForm, reportingPeriodStart: event.target.value })} /></Field>
          <Field label="Kỳ đến"><Input required disabled={demo} type="date" value={carbonForm.reportingPeriodEnd} onChange={(event) => setCarbonForm({ ...carbonForm, reportingPeriodEnd: event.target.value })} /></Field>
          <Field label="kgCO₂e gộp"><Input required disabled={demo} type="number" min="0" step="0.000001" value={carbonForm.grossKgCo2e} onChange={(event) => setCarbonForm({ ...carbonForm, grossKgCo2e: event.target.value })} /></Field>
          <Field label="Lượng hoạt động"><Input disabled={demo} type="number" min="0" step="0.000001" value={carbonForm.activityQuantity} onChange={(event) => setCarbonForm({ ...carbonForm, activityQuantity: event.target.value })} /></Field>
          <Field label="Đơn vị hoạt động"><Input disabled={demo} value={carbonForm.activityUnit} onChange={(event) => setCarbonForm({ ...carbonForm, activityUnit: event.target.value })} /></Field>
          <Field label="Cường độ kgCO₂e"><Input disabled={demo} type="number" min="0" step="0.000001" value={carbonForm.intensityKgCo2e} onChange={(event) => setCarbonForm({ ...carbonForm, intensityKgCo2e: event.target.value })} /></Field>
          <Field label="Loại nguồn"><select disabled={demo} className={selectClass} value={carbonForm.sourceKind} onChange={(event) => setCarbonForm({ ...carbonForm, sourceKind: event.target.value })}>{carbonForm.subjectKind === "supplier" && <option value="supplier_specific">Supplier-specific</option>}{carbonForm.subjectKind === "facility" && <option value="facility_inventory">Facility inventory</option>}<option value="estimated">Ước tính</option><option value="proxy">Proxy</option></select></Field>
          <Field label="DQL"><select disabled={demo} className={selectClass} value={carbonForm.dataQualityLevel} onChange={(event) => setCarbonForm({ ...carbonForm, dataQualityLevel: event.target.value })}>{[1, 2, 3, 4, 5].map((level) => <option key={level} value={`L${level}`}>L{level}</option>)}</select></Field>
          <Field label="Phương pháp"><Input required disabled={demo} value={carbonForm.methodologyReference} onChange={(event) => setCarbonForm({ ...carbonForm, methodologyReference: event.target.value })} /></Field>
          <Field label="Bằng chứng"><EvidenceSelect disabled={demo} evidence={evidence} value={carbonForm.evidenceDocumentId} onChange={(value) => setCarbonForm({ ...carbonForm, evidenceDocumentId: value })} /></Field>
        </div>
        <Field label="Biên tính"><Textarea required disabled={demo} value={carbonForm.boundary} onChange={(event) => setCarbonForm({ ...carbonForm, boundary: event.target.value })} /></Field>
        <Button disabled={demo || saving}>Lưu cơ sở carbon</Button>
      </form>
    </CardContent></Card>

    <Card><CardHeader><CardTitle>3. Mô hình và snapshot criticality</CardTitle><CardDescription>Trọng số phải tổng đúng 100%; chỉ model approved mới được dùng để tính điểm.</CardDescription></CardHeader><CardContent className="space-y-6">
      <form className="space-y-3 rounded-xl border p-4" onSubmit={(event) => submit(event, () => supplierNetworkApi.createModel({ ...modelForm, carbonWeightPercent: Number(modelForm.carbonWeightPercent), climateWeightPercent: Number(modelForm.climateWeightPercent), dependencyWeightPercent: Number(modelForm.dependencyWeightPercent), mediumThreshold: Number(modelForm.mediumThreshold), highThreshold: Number(modelForm.highThreshold) }), () => setModelForm(emptyModel))}>
        <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Mô hình trọng số</h3><Badge variant="outline" className={weightTotal === 100 ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"}>Tổng {weightTotal}%</Badge></div>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Mã model"><Input required disabled={demo} value={modelForm.modelReference} onChange={(event) => setModelForm({ ...modelForm, modelReference: event.target.value })} /></Field>
          <Field label="Carbon %"><Input required disabled={demo} type="number" min="0" max="100" step="0.001" value={modelForm.carbonWeightPercent} onChange={(event) => setModelForm({ ...modelForm, carbonWeightPercent: event.target.value })} /></Field>
          <Field label="Climate %"><Input required disabled={demo} type="number" min="0" max="100" step="0.001" value={modelForm.climateWeightPercent} onChange={(event) => setModelForm({ ...modelForm, climateWeightPercent: event.target.value })} /></Field>
          <Field label="Dependency %"><Input required disabled={demo} type="number" min="0" max="100" step="0.001" value={modelForm.dependencyWeightPercent} onChange={(event) => setModelForm({ ...modelForm, dependencyWeightPercent: event.target.value })} /></Field>
          <Field label="Ngưỡng medium"><Input required disabled={demo} type="number" min="0" max="100" step="0.0001" value={modelForm.mediumThreshold} onChange={(event) => setModelForm({ ...modelForm, mediumThreshold: event.target.value })} /></Field>
          <Field label="Ngưỡng high"><Input required disabled={demo} type="number" min="0" max="100" step="0.0001" value={modelForm.highThreshold} onChange={(event) => setModelForm({ ...modelForm, highThreshold: event.target.value })} /></Field>
          <Field label="Phê duyệt"><select disabled={demo} className={selectClass} value={modelForm.approvalStatus} onChange={(event) => setModelForm({ ...modelForm, approvalStatus: event.target.value })}><option value="draft">Draft</option><option value="approved">Approved</option></select></Field>
          <Field label="Bằng chứng"><EvidenceSelect disabled={demo} evidence={evidence} value={modelForm.evidenceDocumentId} onChange={(value) => setModelForm({ ...modelForm, evidenceDocumentId: value })} /></Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2"><Field label="Chính sách chuẩn hóa"><Textarea required disabled={demo} value={modelForm.normalizationPolicy} onChange={(event) => setModelForm({ ...modelForm, normalizationPolicy: event.target.value })} /></Field><Field label="Lý do"><Textarea required disabled={demo} value={modelForm.rationale} onChange={(event) => setModelForm({ ...modelForm, rationale: event.target.value })} /></Field></div>
        <Button disabled={demo || saving || weightTotal !== 100}>Tạo revision model</Button>
      </form>
      <form className="space-y-3 rounded-xl border p-4" onSubmit={(event) => submit(event, () => supplierNetworkApi.createCriticalitySnapshot({ ...criticalityForm, facilityRevisionId: criticalityForm.subjectKind === "facility" ? criticalityForm.facilityRevisionId : null, supplierRevisionId: criticalityForm.subjectKind === "supplier" ? criticalityForm.supplierRevisionId : null, relationshipRevisionId: criticalityForm.subjectKind === "supplier" ? criticalityForm.relationshipRevisionId : null, climateAssessmentIds: selectedClimateIds, normalizedCarbonScore: Number(criticalityForm.normalizedCarbonScore), normalizedClimateScore: Number(criticalityForm.normalizedClimateScore), normalizedDependencyScore: Number(criticalityForm.normalizedDependencyScore) }), () => { setCriticalityForm(emptyCriticality); setSelectedClimateIds([]); })}>
        <h3 className="font-semibold">Snapshot ưu tiên</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Loại đối tượng"><select disabled={demo} className={selectClass} value={criticalityForm.subjectKind} onChange={(event) => { setCriticalityForm({ ...emptyCriticality, subjectKind: event.target.value }); setSelectedClimateIds([]); }}><option value="supplier">Nhà cung ứng</option><option value="facility">Cơ sở</option></select></Field>
          {criticalityForm.subjectKind === "supplier" ? <Field label="Nhà cung ứng"><select required disabled={demo} className={selectClass} value={criticalityForm.supplierRevisionId} onChange={(event) => { setCriticalityForm({ ...criticalityForm, supplierRevisionId: event.target.value, relationshipRevisionId: "", carbonSnapshotId: "" }); setSelectedClimateIds([]); }}><option value="">Chọn revision</option>{profiles.map((item) => <option key={item.id} value={item.id}>{item.legalName} · rev {item.revision}</option>)}</select></Field> : <Field label="Cơ sở"><select required disabled={demo} className={selectClass} value={criticalityForm.facilityRevisionId} onChange={(event) => { setCriticalityForm({ ...criticalityForm, facilityRevisionId: event.target.value, carbonSnapshotId: "" }); setSelectedClimateIds([]); }}><option value="">Chọn cơ sở</option>{facilities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
          {criticalityForm.subjectKind === "supplier" && <Field label="Quan hệ"><select required disabled={demo} className={selectClass} value={criticalityForm.relationshipRevisionId} onChange={(event) => setCriticalityForm({ ...criticalityForm, relationshipRevisionId: event.target.value })}><option value="">Chọn quan hệ</option>{selectedSupplierRelationships.map((item) => <option key={item.id} value={item.id}>{item.materialOrService} · rev {item.revision}</option>)}</select></Field>}
          <Field label="Cơ sở carbon"><select required disabled={demo} className={selectClass} value={criticalityForm.carbonSnapshotId} onChange={(event) => setCriticalityForm({ ...criticalityForm, carbonSnapshotId: event.target.value })}><option value="">Chọn snapshot</option>{compatibleCarbon.map((item) => <option key={item.id} value={item.id}>{item.reportingPeriodStart}–{item.reportingPeriodEnd} · {item.grossKgCo2e} kgCO₂e · {item.dataQualityLevel}</option>)}</select></Field>
          <Field label="Model approved"><select required disabled={demo} className={selectClass} value={criticalityForm.modelRevisionId} onChange={(event) => setCriticalityForm({ ...criticalityForm, modelRevisionId: event.target.value })}><option value="">Chọn model</option>{models.filter((item) => item.approvalStatus === "approved").map((item) => <option key={item.id} value={item.id}>{item.modelReference} · rev {item.revision}</option>)}</select></Field>
          <Field label="Kỳ đánh giá từ"><Input required disabled={demo} type="date" value={criticalityForm.assessmentPeriodStart} onChange={(event) => setCriticalityForm({ ...criticalityForm, assessmentPeriodStart: event.target.value })} /></Field>
          <Field label="Kỳ đánh giá đến"><Input required disabled={demo} type="date" value={criticalityForm.assessmentPeriodEnd} onChange={(event) => setCriticalityForm({ ...criticalityForm, assessmentPeriodEnd: event.target.value })} /></Field>
          <Field label="Điểm carbon"><Input required disabled={demo} type="number" min="0" max="100" step="0.0001" value={criticalityForm.normalizedCarbonScore} onChange={(event) => setCriticalityForm({ ...criticalityForm, normalizedCarbonScore: event.target.value })} /></Field>
          <Field label="Điểm climate"><Input required disabled={demo} type="number" min="0" max="100" step="0.0001" value={criticalityForm.normalizedClimateScore} onChange={(event) => setCriticalityForm({ ...criticalityForm, normalizedClimateScore: event.target.value })} /></Field>
          <Field label="Điểm dependency"><Input required disabled={demo} type="number" min="0" max="100" step="0.0001" value={criticalityForm.normalizedDependencyScore} onChange={(event) => setCriticalityForm({ ...criticalityForm, normalizedDependencyScore: event.target.value })} /></Field>
        </div>
        <div className="rounded-xl border p-3"><p className="mb-2 text-sm font-medium">Chọn 1–3 hiểm họa cùng kịch bản/horizon</p><div className="grid gap-2 md:grid-cols-2">{compatibleClimate.map((item) => <label key={item.id} className="flex items-center gap-2 text-sm"><input disabled={demo} type="checkbox" checked={selectedClimateIds.includes(item.id)} onChange={(event) => setSelectedClimateIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span>{item.hazardType} · {item.scenarioReference} · {item.horizonStart}–{item.horizonEnd}</span></label>)}</div></div>
        <div className="grid gap-3 md:grid-cols-3"><Field label="Lý do điểm carbon"><Textarea required disabled={demo} value={criticalityForm.carbonScoreRationale} onChange={(event) => setCriticalityForm({ ...criticalityForm, carbonScoreRationale: event.target.value })} /></Field><Field label="Lý do điểm climate"><Textarea required disabled={demo} value={criticalityForm.climateScoreRationale} onChange={(event) => setCriticalityForm({ ...criticalityForm, climateScoreRationale: event.target.value })} /></Field><Field label="Lý do điểm dependency"><Textarea required disabled={demo} value={criticalityForm.dependencyScoreRationale} onChange={(event) => setCriticalityForm({ ...criticalityForm, dependencyScoreRationale: event.target.value })} /></Field></div>
        <Button disabled={demo || saving || selectedClimateIds.length < 1 || selectedClimateIds.length > 3}>Tính và khóa snapshot</Button>
      </form>
      <div className="grid gap-3 md:grid-cols-2">{criticality.map((item) => <div key={item.id} className="rounded-xl border p-4 text-sm"><div className="flex items-center justify-between gap-2"><b>{item.supplierName || item.facilityName || (item.supplierRevisionId ?? item.facilityRevisionId)}</b><Badge variant="outline" className={priorityClass[item.priorityBand]}>{item.priorityBand}</Badge></div><p className="mt-1 text-2xl font-bold">{item.weightedScore.toFixed(2)}</p><p>C {item.normalizedCarbonScore} · khí hậu {item.normalizedClimateScore} · phụ thuộc {item.normalizedDependencyScore}</p><p className="text-xs text-muted-foreground">{item.modelReference || item.modelRevisionId} · {item.reviewStatus}</p></div>)}</div>
    </CardContent></Card>

    <Card><CardHeader><CardTitle>4. Danh mục ưu tiên</CardTitle><CardDescription>Chỉ tổng hợp các đối tượng dùng cùng model và kỳ đánh giá; coverage là phạm vi đã chọn, không phải toàn chuỗi cung ứng.</CardDescription></CardHeader><CardContent className="space-y-4">
      <form className="space-y-3" onSubmit={(event) => submit(event, () => supplierNetworkApi.createPortfolio({ portfolioReference, criticalitySnapshotIds: selectedCriticalityIds, methodologyNotes: portfolioNotes }), () => { setPortfolioReference(""); setPortfolioNotes(""); setSelectedCriticalityIds([]); })}>
        <div className="grid gap-3 md:grid-cols-2"><Field label="Mã danh mục"><Input required disabled={demo} value={portfolioReference} onChange={(event) => setPortfolioReference(event.target.value)} /></Field><Field label="Ghi chú phương pháp"><Textarea required disabled={demo} value={portfolioNotes} onChange={(event) => setPortfolioNotes(event.target.value)} /></Field></div>
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border p-3">{criticality.map((item) => <label key={item.id} className="flex items-center gap-3 text-sm"><input disabled={demo} type="checkbox" checked={selectedCriticalityIds.includes(item.id)} onChange={(event) => setSelectedCriticalityIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span>{item.supplierName || item.facilityName || item.id.slice(0, 8)} · {item.assessmentPeriodStart}–{item.assessmentPeriodEnd} · {item.weightedScore} · {item.priorityBand}</span></label>)}</div>
        <Button disabled={demo || saving || selectedCriticalityIds.length < 2}>Khóa danh mục</Button>
      </form>
      <div className="grid gap-3 md:grid-cols-2">{portfolios.map((item) => <div key={item.id} className="rounded-xl border p-4 text-sm"><div className="flex items-center justify-between gap-2"><b>{item.portfolioReference}</b><Badge variant="outline"><ShieldCheck className="mr-1 h-3 w-3" />{item.prioritySummary.reviewStatus}</Badge></div><p className="mt-2">{item.subjectCount} đối tượng · điểm TB {item.prioritySummary.averageWeightedScore}</p><p>Cao {item.prioritySummary.countByPriority.high} · vừa {item.prioritySummary.countByPriority.medium} · thấp {item.prioritySummary.countByPriority.low}</p><p className="mt-2 text-xs text-muted-foreground">Supplier-specific carbon {item.coverageSummary.supplierSpecificCarbonCount}/{item.coverageSummary.supplierCount} · đủ 3 hiểm họa {item.coverageSummary.completeThreeHazardCount}/{item.coverageSummary.subjectCount} · chi tiêu nhà cung ứng đã chọn {item.coverageSummary.selectedSupplierSpendPercent}%</p><Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void supplierNetworkApi.portfolio(item.id).then(setPortfolioDetail).catch((cause) => setError(isApiError(cause) ? cause.message : "Không thể tải chi tiết danh mục."))}>Xem thành viên</Button></div>)}</div>
      {portfolioDetail?.members && <div className="rounded-xl border p-4"><h3 className="font-semibold">{portfolioDetail.portfolioReference} · thành viên</h3><div className="mt-3 grid gap-2 md:grid-cols-2">{portfolioDetail.members.map((item) => <div key={item.id} className="rounded-lg border p-3 text-sm"><b>{item.supplierName || item.facilityName || item.id}</b><p>{item.weightedScore} · {item.priorityBand} · {item.reviewStatus}</p></div>)}</div></div>}
    </CardContent></Card>
  </section>;
}
