"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Network, Plus, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
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
import { demoSessionCache } from "@/lib/dashboard/demoSessionCache";
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

  // Dialog open states
  const [openProfileDialog, setOpenProfileDialog] = useState(false);
  const [openSiteDialog, setOpenSiteDialog] = useState(false);
  const [openRelationshipDialog, setOpenRelationshipDialog] = useState(false);
  const [openClimateDialog, setOpenClimateDialog] = useState(false);
  const [openCarbonDialog, setOpenCarbonDialog] = useState(false);
  const [openModelDialog, setOpenModelDialog] = useState(false);
  const [openCriticalityDialog, setOpenCriticalityDialog] = useState(false);
  const [openPortfolioDialog, setOpenPortfolioDialog] = useState(false);

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
    if (demo) {
      const sups: SupplierProfile[] = demoSessionCache.getSuppliers().map((s) => ({
        id: s.id,
        supplierReference: s.id,
        revision: 1,
        legalName: s.name,
        tradingName: s.name,
        countryCode: s.country,
        sector: s.category,
        supplierTier: s.tier,
        lifecycleStatus: (["prospective", "active", "inactive"].includes(s.status) ? s.status : "active") as SupplierProfile["lifecycleStatus"],
        evidenceSnapshot: { id: "demo-evidence-1", checksumSha256: "demo-sha256" },
        profileSha256: "demo-sha256",
        createdAt: new Date().toISOString(),
      }));
      setProfiles(sups);
      setFacilities(demoSessionCache.getFacilities());
      setModels([
        {
          id: "demo-model-1",
          modelReference: "CRIT-MODEL-DEFAULT",
          revision: 1,
          carbonWeightPercent: 35,
          climateWeightPercent: 35,
          dependencyWeightPercent: 30,
          mediumThreshold: 40,
          highThreshold: 70,
          normalizationPolicy: "min_max",
          rationale: "Default demo model",
          approvalStatus: "approved",
          modelSha256: "demo-sha256",
          createdAt: new Date().toISOString(),
        },
      ]);
      setLoading(false);
      return;
    }
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
  const submit = (event: FormEvent, action: () => Promise<unknown>, reset?: () => void, demoHandler?: () => void) => {
    event.preventDefault();
    if (demo) {
      demoHandler?.();
      reset?.();
      return;
    }
    void run(action, reset);
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
    <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950 p-7 text-white shadow-sm">
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[.15em] text-emerald-200"><Network className="h-5 w-5" />G2-11 · Supplier Network</p>
      <h2 className="mt-3 text-3xl font-bold">Carbon + Climate Criticality</h2>
      <p className="mt-3 max-w-4xl text-slate-200">Quản trị hồ sơ, địa điểm và quan hệ nhà cung ứng; liên kết carbon, khí hậu và phụ thuộc kinh doanh bằng mô hình trọng số minh bạch.</p>
    </div>
    <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p>Đây là công cụ sàng lọc có kiểm soát, không phải dự báo rủi ro vật lý hoặc kết luận đảm bảo tự động. Điểm chuẩn hóa do người được phân quyền cung cấp theo chính sách đã phê duyệt; mọi kết quả vẫn cần chuyên gia rà soát.</p></div>
    {demo && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">💡 <strong>Chế độ Demo tương tác</strong>: Bạn có thể tạo hồ sơ nhà cung ứng, địa điểm, liên kết carbon và xây dựng mô hình trọng số. Dữ liệu lưu trong bộ nhớ tạm (tự động xóa sau 1 giờ hoặc khi đăng xuất).</div>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

    {/* Section 1: Hồ sơ và quan hệ nhà cung ứng */}
    <Card className="rounded-xl border border-slate-200/80 bg-white shadow-xs">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-slate-900">1. Hồ sơ và quan hệ nhà cung ứng</CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-1">Mỗi thay đổi tạo một revision bất biến và yêu cầu bằng chứng đã khóa.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 border-emerald-300 text-xs text-emerald-800 hover:bg-emerald-50" onClick={() => setOpenProfileDialog(true)} disabled={saving}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Tạo hồ sơ
            </Button>
            <Button size="sm" variant="outline" className="h-8 border-emerald-300 text-xs text-emerald-800 hover:bg-emerald-50" onClick={() => setOpenSiteDialog(true)} disabled={profiles.length === 0 || saving}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Thêm địa điểm
            </Button>
            <Button size="sm" variant="outline" className="h-8 border-emerald-300 text-xs text-emerald-800 hover:bg-emerald-50" onClick={() => setOpenRelationshipDialog(true)} disabled={profiles.length === 0 || saving}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Thêm quan hệ
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hồ sơ nhà cung ứng ({profiles.length})</h4>
          </div>
          {profiles.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-slate-500">Chưa có hồ sơ nhà cung ứng nào. Bấm &quot;Tạo hồ sơ&quot; để thêm.</p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3">
              {profiles.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5 text-sm hover:border-slate-300 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <b className="truncate text-slate-900">{item.legalName}</b>
                    <Badge variant="outline" className="shrink-0 text-xs">Tier {item.supplierTier}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 font-mono">{item.supplierReference} · rev {item.revision}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{item.countryCode} · {item.sector}</span>
                    <span className="font-medium text-emerald-700 capitalize">{item.lifecycleStatus}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Địa điểm đã ghi nhận ({sites.length})</h4>
          </div>
          {sites.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 py-5 text-center text-xs text-slate-500">Chưa có địa điểm nào được tạo.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sites.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200/70 p-3 text-xs text-slate-700">
                  <div className="font-semibold text-slate-900">{item.siteName}</div>
                  <div className="text-slate-500">{item.siteReference} · {item.countryCode}</div>
                  <div className="mt-1 text-slate-400 font-mono">Tọa độ: {item.latitude}, {item.longitude} (±{item.precisionMeters}m)</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Phụ thuộc kinh doanh ({relationships.length})</h4>
          </div>
          {relationships.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 py-5 text-center text-xs text-slate-500">Chưa có quan hệ kinh doanh nào.</p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {relationships.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200/80 p-3.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <b className="truncate text-slate-900">{item.supplierName || item.supplierRevisionId}</b>
                    <Badge variant="outline" className={item.singleSource ? "border-amber-300 text-amber-800 bg-amber-50" : "border-slate-200 text-slate-600"}>
                      {item.singleSource ? "Nguồn duy nhất" : "Đa nguồn"}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{item.materialOrService} · {item.procurementCategory}</p>
                  <p className="mt-1 text-xs text-slate-500">Chi tiêu: <span className="font-semibold text-slate-800">{item.spendPercent}%</span> · Sản xuất: <span className="font-semibold text-slate-800">{item.productionDependencyPercent}%</span></p>
                  <p className="text-xs text-slate-400 mt-1">{item.dependentSkuCount} SKU · {item.dependentRouteCount} tuyến · {item.effectiveFrom}–{item.effectiveTo || "mở"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>

    {/* Section 2: Dữ liệu khí hậu và carbon */}
    <Card className="rounded-xl border border-slate-200/80 bg-white shadow-xs">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-slate-900">2. Dữ liệu khí hậu và carbon</CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-1">Giữ riêng dữ liệu nguồn, bất định, vị trí và biên carbon trước khi chuẩn hóa điểm.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 border-emerald-300 text-xs text-emerald-800 hover:bg-emerald-50" onClick={() => setOpenClimateDialog(true)} disabled={profiles.length === 0 || saving}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Đánh giá khí hậu
            </Button>
            <Button size="sm" variant="outline" className="h-8 border-emerald-300 text-xs text-emerald-800 hover:bg-emerald-50" onClick={() => setOpenCarbonDialog(true)} disabled={saving}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Cơ sở carbon
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Đánh giá khí hậu đã ghi nhận ({supplierClimate.length})</h4>
          {supplierClimate.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 py-5 text-center text-xs text-slate-500">Chưa có đánh giá khí hậu nào. Bấm &quot;Đánh giá khí hậu&quot; để bổ sung.</p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {supplierClimate.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200/80 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 capitalize">{item.hazardType}</span>
                    <Badge variant="outline" className={priorityClass[item.priorityBand]}>{item.priorityBand}</Badge>
                  </div>
                  <p className="text-slate-600">{item.scenarioReference} ({item.scenarioKind})</p>
                  <p className="text-slate-500">Thời gian: {item.horizonStart}–{item.horizonEnd}</p>
                  <p className="text-slate-500">Exposure: {item.exposureRating}/5 · Vulnerability: {item.vulnerabilityRating}/5</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Cơ sở carbon ({carbon.length})</h4>
          {carbon.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 py-5 text-center text-xs text-slate-500">Chưa có snapshot carbon nào. Bấm &quot;Cơ sở carbon&quot; để tạo.</p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {carbon.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200/80 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{item.grossKgCo2e.toLocaleString()} kgCO₂e</span>
                    <Badge variant="outline">{item.dataQualityLevel}</Badge>
                  </div>
                  <p className="text-slate-600">Đối tượng: {item.subjectKind} · {item.sourceKind}</p>
                  <p className="text-slate-500">Kỳ: {item.reportingPeriodStart}–{item.reportingPeriodEnd}</p>
                  <p className="text-slate-400 truncate">Phương pháp: {item.methodologyReference}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>

    {/* Section 3: Mô hình và snapshot criticality */}
    <Card className="rounded-xl border border-slate-200/80 bg-white shadow-xs">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-slate-900">3. Mô hình và snapshot criticality</CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-1">Trọng số phải tổng đúng 100%; chỉ model approved mới được dùng để tính điểm.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 border-emerald-300 text-xs text-emerald-800 hover:bg-emerald-50" onClick={() => setOpenModelDialog(true)} disabled={saving}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Mô hình trọng số
            </Button>
            <Button size="sm" variant="outline" className="h-8 border-emerald-300 text-xs text-emerald-800 hover:bg-emerald-50" onClick={() => setOpenCriticalityDialog(true)} disabled={models.filter(m => m.approvalStatus === "approved").length === 0 || saving}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Tính snapshot ưu tiên
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Mô hình đã định nghĩa ({models.length})</h4>
          {models.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 py-5 text-center text-xs text-slate-500">Chưa có mô hình trọng số nào. Bấm &quot;Mô hình trọng số&quot; để tạo.</p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3">
              {models.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200/80 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <b className="text-slate-900">{item.modelReference}</b>
                    <Badge variant="outline" className={item.approvalStatus === "approved" ? "border-emerald-300 text-emerald-800 bg-emerald-50" : "border-slate-200 text-slate-600"}>{item.approvalStatus}</Badge>
                  </div>
                  <p className="text-slate-600">Trọng số: C {item.carbonWeightPercent}% · Khí hậu {item.climateWeightPercent}% · Phụ thuộc {item.dependencyWeightPercent}%</p>
                  <p className="text-slate-500">Ngưỡng: Med {item.mediumThreshold} · High {item.highThreshold}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Snapshot ưu tiên ({criticality.length})</h4>
          {criticality.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 py-5 text-center text-xs text-slate-500">Chưa có snapshot criticality nào.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {criticality.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200/80 p-4 text-sm bg-slate-50/30">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-slate-900">{item.supplierName || item.facilityName || (item.supplierRevisionId ?? item.facilityRevisionId)}</b>
                    <Badge variant="outline" className={priorityClass[item.priorityBand]}>{item.priorityBand}</Badge>
                  </div>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{item.weightedScore.toFixed(2)}</p>
                  <p className="text-xs text-slate-600 mt-1">C: {item.normalizedCarbonScore} · Khí hậu: {item.normalizedClimateScore} · Phụ thuộc: {item.normalizedDependencyScore}</p>
                  <p className="mt-2 text-xs text-slate-500 font-mono">{item.modelReference || item.modelRevisionId} · {item.reviewStatus}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>

    {/* Section 4: Danh mục ưu tiên */}
    <Card className="rounded-xl border border-slate-200/80 bg-white shadow-xs">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-slate-900">4. Danh mục ưu tiên</CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-1">Chỉ tổng hợp các đối tượng dùng cùng model và kỳ đánh giá; coverage là phạm vi đã chọn, không phải toàn chuỗi cung ứng.</CardDescription>
          </div>
          <Button size="sm" variant="outline" className="h-8 border-emerald-300 text-xs text-emerald-800 hover:bg-emerald-50" onClick={() => setOpenPortfolioDialog(true)} disabled={criticality.length === 0 || saving}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Khóa danh mục mới
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        {portfolios.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-slate-500">Chưa có danh mục nào được khóa.</p>
        ) : (
          <div className="grid gap-3.5 md:grid-cols-2">
            {portfolios.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200/80 p-4 text-sm bg-white shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <b className="text-slate-900 font-semibold">{item.portfolioReference}</b>
                  <Badge variant="outline" className="border-emerald-200 text-emerald-800 bg-emerald-50">
                    <ShieldCheck className="mr-1 h-3 w-3" />{item.prioritySummary.reviewStatus}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-slate-700">{item.subjectCount} đối tượng · Điểm trung bình: <span className="font-bold text-slate-900">{item.prioritySummary.averageWeightedScore}</span></p>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                  <span className="text-red-700 font-medium">Cao: {item.prioritySummary.countByPriority.high}</span> ·
                  <span className="text-amber-700 font-medium">Vừa: {item.prioritySummary.countByPriority.medium}</span> ·
                  <span className="text-emerald-700 font-medium">Thấp: {item.prioritySummary.countByPriority.low}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                  Supplier-specific carbon {item.coverageSummary.supplierSpecificCarbonCount}/{item.coverageSummary.supplierCount} · Đủ 3 hiểm họa {item.coverageSummary.completeThreeHazardCount}/{item.coverageSummary.subjectCount} · Chi tiêu nhà cung ứng: {item.coverageSummary.selectedSupplierSpendPercent}%
                </p>
                <Button type="button" size="sm" variant="outline" className="mt-3 h-8 text-xs border-slate-200 hover:bg-slate-50" onClick={() => {
                  if (demo) {
                    const p = portfolios.find((x) => x.id === item.id);
                    setPortfolioDetail(p || null);
                    return;
                  }
                  void supplierNetworkApi.portfolio(item.id).then(setPortfolioDetail).catch((cause) => setError(isApiError(cause) ? cause.message : "Không thể tải chi tiết danh mục."));
                }}>
                  Xem thành viên ({item.subjectCount})
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    {/* DIALOG 1: Tạo hồ sơ nhà cung ứng */}
    <Dialog open={openProfileDialog} onOpenChange={setOpenProfileDialog}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tạo revision hồ sơ nhà cung ứng</DialogTitle>
          <DialogDescription>Mỗi thay đổi tạo một revision bất biến và yêu cầu bằng chứng đã khóa.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3 md:grid-cols-2 pt-2" onSubmit={(event) => submit(event, () => supplierNetworkApi.createProfile({ ...profileForm, supplierTier: Number(profileForm.supplierTier) }), () => { setProfileForm(emptyProfile); setOpenProfileDialog(false); }, () => {
          const newProfile: SupplierProfile = {
            id: `demo-sup-${Date.now()}`,
            supplierReference: profileForm.supplierReference,
            revision: 1,
            legalName: profileForm.legalName,
            tradingName: profileForm.tradingName || profileForm.legalName,
            countryCode: profileForm.countryCode,
            sector: profileForm.sector,
            supplierTier: Number(profileForm.supplierTier) as 1 | 2 | 3 | 4,
            lifecycleStatus: profileForm.lifecycleStatus as "prospective" | "active" | "inactive",
            evidenceSnapshot: { id: profileForm.evidenceDocumentId, checksumSha256: "demo-sha256" },
            profileSha256: "demo-sha256",
            createdAt: new Date().toISOString(),
          };
          demoSessionCache.addSupplier({ name: profileForm.legalName, country: profileForm.countryCode, tier: Number(profileForm.supplierTier), category: profileForm.sector });
          setProfiles((prev) => [newProfile, ...prev]);
        })}>
          <Field label="Mã nhà cung ứng"><Input required disabled={saving} value={profileForm.supplierReference} onChange={(event) => setProfileForm({ ...profileForm, supplierReference: event.target.value })} placeholder="SUP-001" /></Field>
          <Field label="Tên pháp lý"><Input required disabled={saving} value={profileForm.legalName} onChange={(event) => setProfileForm({ ...profileForm, legalName: event.target.value })} placeholder="Công ty TNHH Dệt..." /></Field>
          <Field label="Tên giao dịch"><Input disabled={saving} value={profileForm.tradingName} onChange={(event) => setProfileForm({ ...profileForm, tradingName: event.target.value })} placeholder="Tên thương mại" /></Field>
          <Field label="Quốc gia"><Input required disabled={saving} minLength={2} maxLength={2} value={profileForm.countryCode} onChange={(event) => setProfileForm({ ...profileForm, countryCode: event.target.value.toUpperCase() })} placeholder="VN" /></Field>
          <Field label="Ngành"><Input required disabled={saving} value={profileForm.sector} onChange={(event) => setProfileForm({ ...profileForm, sector: event.target.value })} placeholder="Dệt may, Nhuộm..." /></Field>
          <Field label="Tầng (Tier)"><Input required disabled={saving} type="number" min="1" max="4" value={profileForm.supplierTier} onChange={(event) => setProfileForm({ ...profileForm, supplierTier: event.target.value })} /></Field>
          <Field label="Trạng thái"><select disabled={saving} className={selectClass} value={profileForm.lifecycleStatus} onChange={(event) => setProfileForm({ ...profileForm, lifecycleStatus: event.target.value })}><option value="prospective">Tiềm năng</option><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option></select></Field>
          <Field label="Bằng chứng"><EvidenceSelect disabled={saving} evidence={evidence} value={profileForm.evidenceDocumentId} onChange={(value) => setProfileForm({ ...profileForm, evidenceDocumentId: value })} /></Field>
          <div className="md:col-span-2 pt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpenProfileDialog(false)}>Hủy</Button>
            <Button disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tạo revision hồ sơ
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* DIALOG 2: Thêm địa điểm nhà cung ứng */}
    <Dialog open={openSiteDialog} onOpenChange={setOpenSiteDialog}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Thêm địa điểm nhà cung ứng</DialogTitle>
          <DialogDescription>Ghi nhận vị trí và tọa độ địa lý chính xác kèm chứng từ khóa.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3 md:grid-cols-2 pt-2" onSubmit={(event) => submit(event, () => supplierNetworkApi.createSite({ ...siteForm, latitude: Number(siteForm.latitude), longitude: Number(siteForm.longitude), precisionMeters: Number(siteForm.precisionMeters) }), () => { setSiteForm(emptySite); setOpenSiteDialog(false); }, () => {
          const newSite: SupplierSite = {
            id: `demo-site-${Date.now()}`,
            supplierRevisionId: siteForm.supplierRevisionId,
            revision: 1,
            siteReference: siteForm.siteReference,
            siteName: siteForm.siteName,
            countryCode: siteForm.countryCode,
            latitude: Number(siteForm.latitude),
            longitude: Number(siteForm.longitude),
            precisionMeters: Number(siteForm.precisionMeters),
            locationBasis: siteForm.locationBasis,
            evidenceSnapshot: { id: siteForm.evidenceDocumentId, checksumSha256: "demo-sha256" },
            siteSha256: "demo-sha256",
            createdAt: new Date().toISOString(),
          };
          setSites((prev) => [newSite, ...prev]);
        })}>
          <Field label="Nhà cung ứng"><select required disabled={saving} className={selectClass} value={siteForm.supplierRevisionId} onChange={(event) => setSiteForm({ ...siteForm, supplierRevisionId: event.target.value })}><option value="">Chọn revision</option>{profiles.map((item) => <option key={item.id} value={item.id}>{item.legalName} · rev {item.revision}</option>)}</select></Field>
          <Field label="Mã địa điểm"><Input required disabled={saving} value={siteForm.siteReference} onChange={(event) => setSiteForm({ ...siteForm, siteReference: event.target.value })} placeholder="SITE-001" /></Field>
          <Field label="Tên địa điểm"><Input required disabled={saving} value={siteForm.siteName} onChange={(event) => setSiteForm({ ...siteForm, siteName: event.target.value })} placeholder="Nhà máy số 1" /></Field>
          <Field label="Quốc gia"><Input required disabled={saving} minLength={2} maxLength={2} value={siteForm.countryCode} onChange={(event) => setSiteForm({ ...siteForm, countryCode: event.target.value.toUpperCase() })} placeholder="VN" /></Field>
          <Field label="Vĩ độ (Latitude)"><Input required disabled={saving} type="number" min="-90" max="90" step="0.000001" value={siteForm.latitude} onChange={(event) => setSiteForm({ ...siteForm, latitude: event.target.value })} placeholder="10.8231" /></Field>
          <Field label="Kinh độ (Longitude)"><Input required disabled={saving} type="number" min="-180" max="180" step="0.000001" value={siteForm.longitude} onChange={(event) => setSiteForm({ ...siteForm, longitude: event.target.value })} placeholder="106.6297" /></Field>
          <Field label="Độ chính xác (m)"><Input required disabled={saving} type="number" min="1" max="100000" value={siteForm.precisionMeters} onChange={(event) => setSiteForm({ ...siteForm, precisionMeters: event.target.value })} /></Field>
          <Field label="Cơ sở vị trí"><Input required disabled={saving} value={siteForm.locationBasis} onChange={(event) => setSiteForm({ ...siteForm, locationBasis: event.target.value })} placeholder="Giấy chứng nhận đăng ký" /></Field>
          <div className="md:col-span-2">
            <Field label="Bằng chứng"><EvidenceSelect disabled={saving} evidence={evidence} value={siteForm.evidenceDocumentId} onChange={(value) => setSiteForm({ ...siteForm, evidenceDocumentId: value })} /></Field>
          </div>
          <div className="md:col-span-2 pt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpenSiteDialog(false)}>Hủy</Button>
            <Button disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tạo revision địa điểm
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* DIALOG 3: Thêm quan hệ phụ thuộc kinh doanh */}
    <Dialog open={openRelationshipDialog} onOpenChange={setOpenRelationshipDialog}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Thêm phụ thuộc kinh doanh</DialogTitle>
          <DialogDescription>Mô hình hóa tỷ lệ chi tiêu, phụ thuộc sản xuất và số SKU bị ảnh hưởng.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3 md:grid-cols-2 pt-2" onSubmit={(event) => submit(event, () => supplierNetworkApi.createRelationship({ ...relationshipForm, spendPercent: Number(relationshipForm.spendPercent), productionDependencyPercent: Number(relationshipForm.productionDependencyPercent), dependentSkuCount: Number(relationshipForm.dependentSkuCount), dependentRouteCount: Number(relationshipForm.dependentRouteCount), effectiveTo: relationshipForm.effectiveTo || null }), () => { setRelationshipForm(emptyRelationship); setOpenRelationshipDialog(false); }, () => {
          const newRel: SupplierRelationship = {
            id: `demo-rel-${Date.now()}`,
            supplierRevisionId: relationshipForm.supplierRevisionId,
            revision: 1,
            relationshipReference: relationshipForm.relationshipReference,
            materialOrService: relationshipForm.materialOrService,
            procurementCategory: relationshipForm.procurementCategory,
            spendPercent: Number(relationshipForm.spendPercent),
            productionDependencyPercent: Number(relationshipForm.productionDependencyPercent),
            singleSource: relationshipForm.singleSource,
            dependentSkuCount: Number(relationshipForm.dependentSkuCount),
            dependentRouteCount: Number(relationshipForm.dependentRouteCount),
            effectiveFrom: relationshipForm.effectiveFrom,
            effectiveTo: relationshipForm.effectiveTo || null,
            relationshipSha256: "demo-sha256",
            createdAt: new Date().toISOString(),
          };
          setRelationships((prev) => [newRel, ...prev]);
        })}>
          <Field label="Nhà cung ứng"><select required disabled={saving} className={selectClass} value={relationshipForm.supplierRevisionId} onChange={(event) => setRelationshipForm({ ...relationshipForm, supplierRevisionId: event.target.value })}><option value="">Chọn revision</option>{profiles.map((item) => <option key={item.id} value={item.id}>{item.legalName} · rev {item.revision}</option>)}</select></Field>
          <Field label="Mã quan hệ"><Input required disabled={saving} value={relationshipForm.relationshipReference} onChange={(event) => setRelationshipForm({ ...relationshipForm, relationshipReference: event.target.value })} placeholder="REL-001" /></Field>
          <Field label="Vật liệu / dịch vụ"><Input required disabled={saving} value={relationshipForm.materialOrService} onChange={(event) => setRelationshipForm({ ...relationshipForm, materialOrService: event.target.value })} placeholder="Vải Cotton sợi chải kỹ" /></Field>
          <Field label="Nhóm mua sắm"><Input required disabled={saving} value={relationshipForm.procurementCategory} onChange={(event) => setRelationshipForm({ ...relationshipForm, procurementCategory: event.target.value })} placeholder="Raw Materials" /></Field>
          <Field label="% chi tiêu"><Input required disabled={saving} type="number" min="0" max="100" step="0.001" value={relationshipForm.spendPercent} onChange={(event) => setRelationshipForm({ ...relationshipForm, spendPercent: event.target.value })} placeholder="15.5" /></Field>
          <Field label="% phụ thuộc sản xuất"><Input required disabled={saving} type="number" min="0" max="100" step="0.001" value={relationshipForm.productionDependencyPercent} onChange={(event) => setRelationshipForm({ ...relationshipForm, productionDependencyPercent: event.target.value })} placeholder="20.0" /></Field>
          <Field label="Số SKU phụ thuộc"><Input required disabled={saving} type="number" min="0" value={relationshipForm.dependentSkuCount} onChange={(event) => setRelationshipForm({ ...relationshipForm, dependentSkuCount: event.target.value })} /></Field>
          <Field label="Số tuyến phụ thuộc"><Input required disabled={saving} type="number" min="0" value={relationshipForm.dependentRouteCount} onChange={(event) => setRelationshipForm({ ...relationshipForm, dependentRouteCount: event.target.value })} /></Field>
          <Field label="Hiệu lực từ"><Input required disabled={saving} type="date" value={relationshipForm.effectiveFrom} onChange={(event) => setRelationshipForm({ ...relationshipForm, effectiveFrom: event.target.value })} /></Field>
          <Field label="Hiệu lực đến"><Input disabled={saving} type="date" value={relationshipForm.effectiveTo} onChange={(event) => setRelationshipForm({ ...relationshipForm, effectiveTo: event.target.value })} /></Field>
          <div className="md:col-span-2 flex items-center gap-2 py-1">
            <input id="singleSourceCheck" disabled={saving} type="checkbox" className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" checked={relationshipForm.singleSource} onChange={(event) => setRelationshipForm({ ...relationshipForm, singleSource: event.target.checked })} />
            <label htmlFor="singleSourceCheck" className="text-sm font-medium text-slate-700">Nguồn cung duy nhất (Single Source)</label>
          </div>
          <div className="md:col-span-2">
            <Field label="Bằng chứng"><EvidenceSelect disabled={saving} evidence={evidence} value={relationshipForm.evidenceDocumentId} onChange={(value) => setRelationshipForm({ ...relationshipForm, evidenceDocumentId: value })} /></Field>
          </div>
          <div className="md:col-span-2 pt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpenRelationshipDialog(false)}>Hủy</Button>
            <Button disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tạo revision quan hệ
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* DIALOG 4: Đánh giá hiểm họa khí hậu */}
    <Dialog open={openClimateDialog} onOpenChange={setOpenClimateDialog}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Sàng lọc khí hậu tại địa điểm nhà cung ứng</DialogTitle>
          <DialogDescription>Ghi nhận hiểm họa vật lý, độ phơi nhiễm và tính dễ bị tổn thương theo kịch bản chuẩn hóa.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4 pt-2" onSubmit={(event) => submit(event, () => supplierNetworkApi.createClimateAssessment({ ...climateForm, metricValue: Number(climateForm.metricValue), exposureRating: Number(climateForm.exposureRating), vulnerabilityRating: Number(climateForm.vulnerabilityRating), modelName: climateForm.modelName || null, scenarioName: climateForm.scenarioName || null }), () => { setClimateForm(emptyClimate); setOpenClimateDialog(false); }, () => {
          const newClimate: SupplierClimateAssessment = {
            id: `demo-clim-${Date.now()}`,
            supplierRevisionId: climateForm.supplierRevisionId,
            siteRevisionId: climateForm.siteRevisionId,
            hazardType: climateForm.hazardType as SupplierClimateAssessment["hazardType"],
            scenarioKind: climateForm.scenarioKind as SupplierClimateAssessment["scenarioKind"],
            scenarioReference: climateForm.scenarioReference,
            sourceKind: climateForm.sourceKind as SupplierClimateAssessment["sourceKind"],
            datasetIdentifier: climateForm.datasetIdentifier,
            datasetVersion: climateForm.datasetVersion,
            spatialResolution: climateForm.spatialResolution,
            temporalResolution: climateForm.temporalResolution,
            gridReference: climateForm.gridReference,
            horizonStart: climateForm.horizonStart,
            horizonEnd: climateForm.horizonEnd,
            sourceUrl: climateForm.sourceUrl,
            modelName: climateForm.modelName || null,
            scenarioName: climateForm.scenarioName || null,
            hazardMetric: climateForm.hazardMetric,
            metricValue: Number(climateForm.metricValue),
            metricUnit: climateForm.metricUnit,
            exposureRating: Number(climateForm.exposureRating),
            vulnerabilityRating: Number(climateForm.vulnerabilityRating),
            priorityBand: climateForm.priorityBand as SupplierClimateAssessment["priorityBand"],
            spatialMatchNotes: climateForm.spatialMatchNotes,
            uncertaintyNotes: climateForm.uncertaintyNotes,
            ratingRationale: climateForm.ratingRationale,
            screeningStatus: "completed",
            inputSha256: "demo-sha256",
            createdAt: new Date().toISOString(),
          };
          setSupplierClimate((prev) => [newClimate, ...prev]);
        })}>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <Field label="Nhà cung ứng"><select required disabled={saving} className={selectClass} value={climateForm.supplierRevisionId} onChange={(event) => setClimateForm({ ...climateForm, supplierRevisionId: event.target.value, siteRevisionId: "" })}><option value="">Chọn revision</option>{profiles.map((item) => <option key={item.id} value={item.id}>{item.legalName} · rev {item.revision}</option>)}</select></Field>
            <Field label="Địa điểm"><select required disabled={saving} className={selectClass} value={climateForm.siteRevisionId} onChange={(event) => setClimateForm({ ...climateForm, siteRevisionId: event.target.value })}><option value="">Chọn địa điểm</option>{selectedSupplierSites.map((item) => <option key={item.id} value={item.id}>{item.siteName} · rev {item.revision}</option>)}</select></Field>
            <Field label="Hiểm họa"><select disabled={saving} className={selectClass} value={climateForm.hazardType} onChange={(event) => setClimateForm({ ...climateForm, hazardType: event.target.value })}><option value="heat">Nhiệt</option><option value="drought">Hạn hán</option><option value="extreme_rainfall">Mưa cực đoan</option></select></Field>
            <Field label="Loại kịch bản"><select disabled={saving} className={selectClass} value={climateForm.scenarioKind} onChange={(event) => setClimateForm({ ...climateForm, scenarioKind: event.target.value, sourceKind: event.target.value === "historical" ? "ERA5_LAND" : "CMIP6" })}><option value="historical">Lịch sử</option><option value="projection">Dự phóng</option></select></Field>
            <Field label="Mã kịch bản"><Input required disabled={saving} value={climateForm.scenarioReference} onChange={(event) => setClimateForm({ ...climateForm, scenarioReference: event.target.value })} placeholder="SSP2-4.5" /></Field>
            <Field label="Nguồn dữ liệu"><select disabled={saving} className={selectClass} value={climateForm.sourceKind} onChange={(event) => setClimateForm({ ...climateForm, sourceKind: event.target.value })}><option value="ERA5_LAND">ERA5-Land</option><option value="CMIP6">CMIP6</option><option value="OTHER">Khác</option></select></Field>
            <Field label="Thời gian từ"><Input required disabled={saving} type="date" value={climateForm.horizonStart} onChange={(event) => setClimateForm({ ...climateForm, horizonStart: event.target.value })} /></Field>
            <Field label="Thời gian đến"><Input required disabled={saving} type="date" value={climateForm.horizonEnd} onChange={(event) => setClimateForm({ ...climateForm, horizonEnd: event.target.value })} /></Field>
            <Field label="URL nguồn"><Input required disabled={saving} type="url" value={climateForm.sourceUrl} onChange={(event) => setClimateForm({ ...climateForm, sourceUrl: event.target.value })} placeholder="https://..." /></Field>
            {(["datasetIdentifier", "datasetVersion", "spatialResolution", "temporalResolution", "gridReference"] as const).map((key) => <Field key={key} label={{ datasetIdentifier: "Bộ dữ liệu", datasetVersion: "Phiên bản", spatialResolution: "Độ phân giải không gian", temporalResolution: "Độ phân giải thời gian", gridReference: "Ô lưới" }[key]}><Input required disabled={saving} value={climateForm[key]} onChange={(event) => setClimateForm({ ...climateForm, [key]: event.target.value })} /></Field>)}
            {climateForm.scenarioKind === "projection" && <><Field label="Mô hình"><Input required disabled={saving} value={climateForm.modelName} onChange={(event) => setClimateForm({ ...climateForm, modelName: event.target.value })} /></Field><Field label="Tên kịch bản"><Input required disabled={saving} value={climateForm.scenarioName} onChange={(event) => setClimateForm({ ...climateForm, scenarioName: event.target.value })} /></Field></>}
            <Field label="Chỉ số hiểm họa"><Input required disabled={saving} value={climateForm.hazardMetric} onChange={(event) => setClimateForm({ ...climateForm, hazardMetric: event.target.value })} placeholder="Số ngày nóng >35°C" /></Field>
            <Field label="Giá trị"><Input required disabled={saving} type="number" step="0.00000001" value={climateForm.metricValue} onChange={(event) => setClimateForm({ ...climateForm, metricValue: event.target.value })} /></Field>
            <Field label="Đơn vị"><Input required disabled={saving} value={climateForm.metricUnit} onChange={(event) => setClimateForm({ ...climateForm, metricUnit: event.target.value })} placeholder="ngày/năm" /></Field>
            <Field label="Exposure (1–5)"><Input required disabled={saving} type="number" min="1" max="5" value={climateForm.exposureRating} onChange={(event) => setClimateForm({ ...climateForm, exposureRating: event.target.value })} /></Field>
            <Field label="Vulnerability (1–5)"><Input required disabled={saving} type="number" min="1" max="5" value={climateForm.vulnerabilityRating} onChange={(event) => setClimateForm({ ...climateForm, vulnerabilityRating: event.target.value })} /></Field>
            <Field label="Ưu tiên tác giả"><select disabled={saving} className={selectClass} value={climateForm.priorityBand} onChange={(event) => setClimateForm({ ...climateForm, priorityBand: event.target.value })}><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option></select></Field>
          </div>
          <Field label="Bằng chứng nguồn"><EvidenceSelect disabled={saving} evidence={evidence} value={climateForm.evidenceDocumentId} onChange={(value) => setClimateForm({ ...climateForm, evidenceDocumentId: value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Khớp không gian"><Textarea required disabled={saving} value={climateForm.spatialMatchNotes} onChange={(event) => setClimateForm({ ...climateForm, spatialMatchNotes: event.target.value })} rows={2} /></Field>
            <Field label="Bất định"><Textarea required disabled={saving} value={climateForm.uncertaintyNotes} onChange={(event) => setClimateForm({ ...climateForm, uncertaintyNotes: event.target.value })} rows={2} /></Field>
            <Field label="Lý do xếp hạng"><Textarea required disabled={saving} value={climateForm.ratingRationale} onChange={(event) => setClimateForm({ ...climateForm, ratingRationale: event.target.value })} rows={2} /></Field>
          </div>
          <div className="pt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpenClimateDialog(false)}>Hủy</Button>
            <Button disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu đánh giá khí hậu
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* DIALOG 5: Cơ sở carbon bất biến */}
    <Dialog open={openCarbonDialog} onOpenChange={setOpenCarbonDialog}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Cơ sở carbon bất biến</DialogTitle>
          <DialogDescription>Ghi nhận phát thải Scope 1/2 và chất lượng dữ liệu nguồn.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4 pt-2" onSubmit={(event) => submit(event, () => supplierNetworkApi.createCarbonSnapshot({ ...carbonForm, facilityRevisionId: carbonForm.subjectKind === "facility" ? carbonForm.facilityRevisionId : null, supplierRevisionId: carbonForm.subjectKind === "supplier" ? carbonForm.supplierRevisionId : null, grossKgCo2e: Number(carbonForm.grossKgCo2e), activityQuantity: carbonForm.activityQuantity ? Number(carbonForm.activityQuantity) : null, activityUnit: carbonForm.activityUnit || null, intensityKgCo2e: carbonForm.intensityKgCo2e ? Number(carbonForm.intensityKgCo2e) : null }), () => { setCarbonForm(emptyCarbon); setOpenCarbonDialog(false); }, () => {
          const newCarbon: CarbonCriticalitySnapshot = {
            id: `demo-carb-${Date.now()}`,
            subjectKind: carbonForm.subjectKind as CarbonCriticalitySnapshot["subjectKind"],
            facilityRevisionId: carbonForm.subjectKind === "facility" ? carbonForm.facilityRevisionId : null,
            supplierRevisionId: carbonForm.subjectKind === "supplier" ? carbonForm.supplierRevisionId : null,
            reportingPeriodStart: carbonForm.reportingPeriodStart,
            reportingPeriodEnd: carbonForm.reportingPeriodEnd,
            boundary: carbonForm.boundary,
            grossKgCo2e: Number(carbonForm.grossKgCo2e),
            activityQuantity: carbonForm.activityQuantity ? Number(carbonForm.activityQuantity) : null,
            activityUnit: carbonForm.activityUnit || null,
            intensityKgCo2e: carbonForm.intensityKgCo2e ? Number(carbonForm.intensityKgCo2e) : null,
            sourceKind: carbonForm.sourceKind as CarbonCriticalitySnapshot["sourceKind"],
            dataQualityLevel: carbonForm.dataQualityLevel as CarbonCriticalitySnapshot["dataQualityLevel"],
            methodologyReference: carbonForm.methodologyReference,
            carbonSha256: "demo-sha256",
            createdAt: new Date().toISOString(),
          };
          setCarbon((prev) => [newCarbon, ...prev]);
        })}>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <Field label="Loại đối tượng"><select disabled={saving} className={selectClass} value={carbonForm.subjectKind} onChange={(event) => setCarbonForm({ ...carbonForm, subjectKind: event.target.value, facilityRevisionId: "", supplierRevisionId: "", sourceKind: event.target.value === "supplier" ? "supplier_specific" : "facility_inventory" })}><option value="supplier">Nhà cung ứng</option><option value="facility">Cơ sở</option></select></Field>
            {carbonForm.subjectKind === "supplier" ? <Field label="Nhà cung ứng"><select required disabled={saving} className={selectClass} value={carbonForm.supplierRevisionId} onChange={(event) => setCarbonForm({ ...carbonForm, supplierRevisionId: event.target.value })}><option value="">Chọn revision</option>{profiles.map((item) => <option key={item.id} value={item.id}>{item.legalName} · rev {item.revision}</option>)}</select></Field> : <Field label="Cơ sở"><select required disabled={saving} className={selectClass} value={carbonForm.facilityRevisionId} onChange={(event) => setCarbonForm({ ...carbonForm, facilityRevisionId: event.target.value })}><option value="">Chọn cơ sở</option>{facilities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
            <Field label="Kỳ từ"><Input required disabled={saving} type="date" value={carbonForm.reportingPeriodStart} onChange={(event) => setCarbonForm({ ...carbonForm, reportingPeriodStart: event.target.value })} /></Field>
            <Field label="Kỳ đến"><Input required disabled={saving} type="date" value={carbonForm.reportingPeriodEnd} onChange={(event) => setCarbonForm({ ...carbonForm, reportingPeriodEnd: event.target.value })} /></Field>
            <Field label="kgCO₂e gộp"><Input required disabled={saving} type="number" min="0" step="0.000001" value={carbonForm.grossKgCo2e} onChange={(event) => setCarbonForm({ ...carbonForm, grossKgCo2e: event.target.value })} placeholder="125000" /></Field>
            <Field label="Lượng hoạt động"><Input disabled={saving} type="number" min="0" step="0.000001" value={carbonForm.activityQuantity} onChange={(event) => setCarbonForm({ ...carbonForm, activityQuantity: event.target.value })} /></Field>
            <Field label="Đơn vị hoạt động"><Input disabled={saving} value={carbonForm.activityUnit} onChange={(event) => setCarbonForm({ ...carbonForm, activityUnit: event.target.value })} placeholder="tấn SP" /></Field>
            <Field label="Cường độ kgCO₂e"><Input disabled={saving} type="number" min="0" step="0.000001" value={carbonForm.intensityKgCo2e} onChange={(event) => setCarbonForm({ ...carbonForm, intensityKgCo2e: event.target.value })} /></Field>
            <Field label="Loại nguồn"><select disabled={saving} className={selectClass} value={carbonForm.sourceKind} onChange={(event) => setCarbonForm({ ...carbonForm, sourceKind: event.target.value })}>{carbonForm.subjectKind === "supplier" && <option value="supplier_specific">Supplier-specific</option>}{carbonForm.subjectKind === "facility" && <option value="facility_inventory">Facility inventory</option>}<option value="estimated">Ước tính</option><option value="proxy">Proxy</option></select></Field>
            <Field label="DQL (Data Quality)"><select disabled={saving} className={selectClass} value={carbonForm.dataQualityLevel} onChange={(event) => setCarbonForm({ ...carbonForm, dataQualityLevel: event.target.value })}>{[1, 2, 3, 4, 5].map((level) => <option key={level} value={`L${level}`}>L{level}</option>)}</select></Field>
            <Field label="Phương pháp"><Input required disabled={saving} value={carbonForm.methodologyReference} onChange={(event) => setCarbonForm({ ...carbonForm, methodologyReference: event.target.value })} placeholder="GHG Protocol Scope 1 & 2" /></Field>
            <Field label="Bằng chứng"><EvidenceSelect disabled={saving} evidence={evidence} value={carbonForm.evidenceDocumentId} onChange={(value) => setCarbonForm({ ...carbonForm, evidenceDocumentId: value })} /></Field>
          </div>
          <Field label="Biên tính"><Textarea required disabled={saving} value={carbonForm.boundary} onChange={(event) => setCarbonForm({ ...carbonForm, boundary: event.target.value })} rows={2} placeholder="Toàn bộ phát thải trực tiếp và điện năng tiêu thụ..." /></Field>
          <div className="pt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpenCarbonDialog(false)}>Hủy</Button>
            <Button disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu cơ sở carbon
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* DIALOG 6: Mô hình trọng số */}
    <Dialog open={openModelDialog} onOpenChange={setOpenModelDialog}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-4">
            <DialogTitle>Tạo mô hình trọng số</DialogTitle>
            <Badge variant="outline" className={weightTotal === 100 ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"}>
              Tổng {weightTotal}%
            </Badge>
          </div>
          <DialogDescription>Trọng số Carbon + Climate + Dependency phải có tổng bằng 100%.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4 pt-2" onSubmit={(event) => submit(event, () => supplierNetworkApi.createModel({ ...modelForm, carbonWeightPercent: Number(modelForm.carbonWeightPercent), climateWeightPercent: Number(modelForm.climateWeightPercent), dependencyWeightPercent: Number(modelForm.dependencyWeightPercent), mediumThreshold: Number(modelForm.mediumThreshold), highThreshold: Number(modelForm.highThreshold) }), () => { setModelForm(emptyModel); setOpenModelDialog(false); }, () => {
          const newModel: CriticalityModel = {
            id: `demo-model-${Date.now()}`,
            modelReference: modelForm.modelReference,
            revision: 1,
            carbonWeightPercent: Number(modelForm.carbonWeightPercent),
            climateWeightPercent: Number(modelForm.climateWeightPercent),
            dependencyWeightPercent: Number(modelForm.dependencyWeightPercent),
            mediumThreshold: Number(modelForm.mediumThreshold),
            highThreshold: Number(modelForm.highThreshold),
            normalizationPolicy: modelForm.normalizationPolicy,
            rationale: modelForm.rationale,
            approvalStatus: modelForm.approvalStatus as CriticalityModel["approvalStatus"],
            modelSha256: "demo-sha256",
            createdAt: new Date().toISOString(),
          };
          setModels((prev) => [newModel, ...prev]);
        })}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mã model"><Input required disabled={saving} value={modelForm.modelReference} onChange={(event) => setModelForm({ ...modelForm, modelReference: event.target.value })} placeholder="MODEL-2026-V1" /></Field>
            <Field label="Phê duyệt"><select disabled={saving} className={selectClass} value={modelForm.approvalStatus} onChange={(event) => setModelForm({ ...modelForm, approvalStatus: event.target.value })}><option value="draft">Draft</option><option value="approved">Approved</option></select></Field>
            <Field label="Carbon %"><Input required disabled={saving} type="number" min="0" max="100" step="0.001" value={modelForm.carbonWeightPercent} onChange={(event) => setModelForm({ ...modelForm, carbonWeightPercent: event.target.value })} /></Field>
            <Field label="Climate %"><Input required disabled={saving} type="number" min="0" max="100" step="0.001" value={modelForm.climateWeightPercent} onChange={(event) => setModelForm({ ...modelForm, climateWeightPercent: event.target.value })} /></Field>
            <Field label="Dependency %"><Input required disabled={saving} type="number" min="0" max="100" step="0.001" value={modelForm.dependencyWeightPercent} onChange={(event) => setModelForm({ ...modelForm, dependencyWeightPercent: event.target.value })} /></Field>
            <Field label="Ngưỡng medium"><Input required disabled={saving} type="number" min="0" max="100" step="0.0001" value={modelForm.mediumThreshold} onChange={(event) => setModelForm({ ...modelForm, mediumThreshold: event.target.value })} /></Field>
            <Field label="Ngưỡng high"><Input required disabled={saving} type="number" min="0" max="100" step="0.0001" value={modelForm.highThreshold} onChange={(event) => setModelForm({ ...modelForm, highThreshold: event.target.value })} /></Field>
            <Field label="Bằng chứng"><EvidenceSelect disabled={saving} evidence={evidence} value={modelForm.evidenceDocumentId} onChange={(value) => setModelForm({ ...modelForm, evidenceDocumentId: value })} /></Field>
          </div>
          <Field label="Chính sách chuẩn hóa"><Textarea required disabled={saving} value={modelForm.normalizationPolicy} onChange={(event) => setModelForm({ ...modelForm, normalizationPolicy: event.target.value })} rows={2} /></Field>
          <Field label="Lý do"><Textarea required disabled={saving} value={modelForm.rationale} onChange={(event) => setModelForm({ ...modelForm, rationale: event.target.value })} rows={2} /></Field>
          <div className="pt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpenModelDialog(false)}>Hủy</Button>
            <Button disabled={saving || weightTotal !== 100} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tạo revision model
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* DIALOG 7: Tính & khóa snapshot ưu tiên */}
    <Dialog open={openCriticalityDialog} onOpenChange={setOpenCriticalityDialog}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tính và khóa Snapshot ưu tiên</DialogTitle>
          <DialogDescription>Tổng hợp điểm chuẩn hóa Carbon, Climate và Dependency dựa trên model đã duyệt.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4 pt-2" onSubmit={(event) => submit(event, () => supplierNetworkApi.createCriticalitySnapshot({ ...criticalityForm, facilityRevisionId: criticalityForm.subjectKind === "facility" ? criticalityForm.facilityRevisionId : null, supplierRevisionId: criticalityForm.subjectKind === "supplier" ? criticalityForm.supplierRevisionId : null, relationshipRevisionId: criticalityForm.subjectKind === "supplier" ? criticalityForm.relationshipRevisionId : null, climateAssessmentIds: selectedClimateIds, normalizedCarbonScore: Number(criticalityForm.normalizedCarbonScore), normalizedClimateScore: Number(criticalityForm.normalizedClimateScore), normalizedDependencyScore: Number(criticalityForm.normalizedDependencyScore) }), () => { setCriticalityForm(emptyCriticality); setSelectedClimateIds([]); setOpenCriticalityDialog(false); }, () => {
          const chosenModel = models.find((m) => m.id === criticalityForm.modelRevisionId);
          const carbWeight = (chosenModel?.carbonWeightPercent ?? 35) / 100;
          const climWeight = (chosenModel?.climateWeightPercent ?? 35) / 100;
          const depWeight = (chosenModel?.dependencyWeightPercent ?? 30) / 100;
          const cScore = Number(criticalityForm.normalizedCarbonScore);
          const clScore = Number(criticalityForm.normalizedClimateScore);
          const dScore = Number(criticalityForm.normalizedDependencyScore);
          const weighted = cScore * carbWeight + clScore * climWeight + dScore * depWeight;
          const mediumThresh = chosenModel?.mediumThreshold ?? 40;
          const highThresh = chosenModel?.highThreshold ?? 70;
          const priorityBand = weighted >= highThresh ? "high" : weighted >= mediumThresh ? "medium" : "low";
          const supObj = profiles.find((p) => p.id === criticalityForm.supplierRevisionId);
          const facObj = facilities.find((f) => f.id === criticalityForm.facilityRevisionId);
          const newCrit: CriticalitySnapshot = {
            id: `demo-crit-${Date.now()}`,
            subjectKind: criticalityForm.subjectKind as CriticalitySnapshot["subjectKind"],
            facilityRevisionId: criticalityForm.subjectKind === "facility" ? criticalityForm.facilityRevisionId : null,
            supplierRevisionId: criticalityForm.subjectKind === "supplier" ? criticalityForm.supplierRevisionId : null,
            relationshipRevisionId: criticalityForm.subjectKind === "supplier" ? criticalityForm.relationshipRevisionId : null,
            carbonSnapshotId: criticalityForm.carbonSnapshotId,
            modelRevisionId: criticalityForm.modelRevisionId,
            assessmentPeriodStart: criticalityForm.assessmentPeriodStart,
            assessmentPeriodEnd: criticalityForm.assessmentPeriodEnd,
            normalizedCarbonScore: cScore,
            normalizedClimateScore: clScore,
            normalizedDependencyScore: dScore,
            weightedScore: weighted,
            priorityBand,
            reviewStatus: "demo_locked",
            inputSnapshot: {
              climateAssessmentIds: selectedClimateIds,
              carbonScoreRationale: criticalityForm.carbonScoreRationale,
              climateScoreRationale: criticalityForm.climateScoreRationale,
              dependencyScoreRationale: criticalityForm.dependencyScoreRationale,
            },
            inputSha256: "demo-sha256",
            supplierName: supObj?.legalName,
            facilityName: facObj?.name,
            createdAt: new Date().toISOString(),
          };
          setCriticality((prev) => [newCrit, ...prev]);
        })}>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <Field label="Loại đối tượng"><select disabled={saving} className={selectClass} value={criticalityForm.subjectKind} onChange={(event) => { setCriticalityForm({ ...emptyCriticality, subjectKind: event.target.value }); setSelectedClimateIds([]); }}><option value="supplier">Nhà cung ứng</option><option value="facility">Cơ sở</option></select></Field>
            {criticalityForm.subjectKind === "supplier" ? <Field label="Nhà cung ứng"><select required disabled={saving} className={selectClass} value={criticalityForm.supplierRevisionId} onChange={(event) => { setCriticalityForm({ ...criticalityForm, supplierRevisionId: event.target.value, relationshipRevisionId: "", carbonSnapshotId: "" }); setSelectedClimateIds([]); }}><option value="">Chọn revision</option>{profiles.map((item) => <option key={item.id} value={item.id}>{item.legalName} · rev {item.revision}</option>)}</select></Field> : <Field label="Cơ sở"><select required disabled={saving} className={selectClass} value={criticalityForm.facilityRevisionId} onChange={(event) => { setCriticalityForm({ ...criticalityForm, facilityRevisionId: event.target.value, carbonSnapshotId: "" }); setSelectedClimateIds([]); }}><option value="">Chọn cơ sở</option>{facilities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}
            {criticalityForm.subjectKind === "supplier" && <Field label="Quan hệ"><select required disabled={saving} className={selectClass} value={criticalityForm.relationshipRevisionId} onChange={(event) => setCriticalityForm({ ...criticalityForm, relationshipRevisionId: event.target.value })}><option value="">Chọn quan hệ</option>{selectedSupplierRelationships.map((item) => <option key={item.id} value={item.id}>{item.materialOrService} · rev {item.revision}</option>)}</select></Field>}
            <Field label="Cơ sở carbon"><select required disabled={saving} className={selectClass} value={criticalityForm.carbonSnapshotId} onChange={(event) => setCriticalityForm({ ...criticalityForm, carbonSnapshotId: event.target.value })}><option value="">Chọn snapshot</option>{compatibleCarbon.map((item) => <option key={item.id} value={item.id}>{item.reportingPeriodStart}–{item.reportingPeriodEnd} · {item.grossKgCo2e} kgCO₂e · {item.dataQualityLevel}</option>)}</select></Field>
            <Field label="Model approved"><select required disabled={saving} className={selectClass} value={criticalityForm.modelRevisionId} onChange={(event) => setCriticalityForm({ ...criticalityForm, modelRevisionId: event.target.value })}><option value="">Chọn model</option>{models.filter((item) => item.approvalStatus === "approved").map((item) => <option key={item.id} value={item.id}>{item.modelReference} · rev {item.revision}</option>)}</select></Field>
            <Field label="Kỳ đánh giá từ"><Input required disabled={saving} type="date" value={criticalityForm.assessmentPeriodStart} onChange={(event) => setCriticalityForm({ ...criticalityForm, assessmentPeriodStart: event.target.value })} /></Field>
            <Field label="Kỳ đánh giá đến"><Input required disabled={saving} type="date" value={criticalityForm.assessmentPeriodEnd} onChange={(event) => setCriticalityForm({ ...criticalityForm, assessmentPeriodEnd: event.target.value })} /></Field>
            <Field label="Điểm carbon"><Input required disabled={saving} type="number" min="0" max="100" step="0.0001" value={criticalityForm.normalizedCarbonScore} onChange={(event) => setCriticalityForm({ ...criticalityForm, normalizedCarbonScore: event.target.value })} placeholder="65.5" /></Field>
            <Field label="Điểm climate"><Input required disabled={saving} type="number" min="0" max="100" step="0.0001" value={criticalityForm.normalizedClimateScore} onChange={(event) => setCriticalityForm({ ...criticalityForm, normalizedClimateScore: event.target.value })} placeholder="50.0" /></Field>
            <Field label="Điểm dependency"><Input required disabled={saving} type="number" min="0" max="100" step="0.0001" value={criticalityForm.normalizedDependencyScore} onChange={(event) => setCriticalityForm({ ...criticalityForm, normalizedDependencyScore: event.target.value })} placeholder="80.0" /></Field>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
            <p className="mb-2 text-xs font-semibold text-slate-700">Chọn 1–3 hiểm họa cùng kịch bản/horizon:</p>
            {compatibleClimate.length === 0 ? (
              <p className="text-xs text-slate-500">Chưa có đánh giá khí hậu nào tương thích với đối tượng đã chọn.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {compatibleClimate.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input disabled={saving} type="checkbox" className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" checked={selectedClimateIds.includes(item.id)} onChange={(event) => setSelectedClimateIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
                    <span>{item.hazardType} · {item.scenarioReference} ({item.horizonStart}–{item.horizonEnd})</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Lý do điểm carbon"><Textarea required disabled={saving} value={criticalityForm.carbonScoreRationale} onChange={(event) => setCriticalityForm({ ...criticalityForm, carbonScoreRationale: event.target.value })} rows={2} /></Field>
            <Field label="Lý do điểm climate"><Textarea required disabled={saving} value={criticalityForm.climateScoreRationale} onChange={(event) => setCriticalityForm({ ...criticalityForm, climateScoreRationale: event.target.value })} rows={2} /></Field>
            <Field label="Lý do điểm dependency"><Textarea required disabled={saving} value={criticalityForm.dependencyScoreRationale} onChange={(event) => setCriticalityForm({ ...criticalityForm, dependencyScoreRationale: event.target.value })} rows={2} /></Field>
          </div>
          <div className="pt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpenCriticalityDialog(false)}>Hủy</Button>
            <Button disabled={saving || selectedClimateIds.length < 1 || selectedClimateIds.length > 3} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tính và khóa snapshot
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* DIALOG 8: Khóa danh mục ưu tiên */}
    <Dialog open={openPortfolioDialog} onOpenChange={setOpenPortfolioDialog}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tạo và Khóa danh mục ưu tiên</DialogTitle>
          <DialogDescription>Chọn tối thiểu 2 snapshot để nhóm thành danh mục phân tích chuỗi cung ứng.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4 pt-2" onSubmit={(event) => submit(event, () => supplierNetworkApi.createPortfolio({ portfolioReference, criticalitySnapshotIds: selectedCriticalityIds, methodologyNotes: portfolioNotes }), () => { setPortfolioReference(""); setPortfolioNotes(""); setSelectedCriticalityIds([]); setOpenPortfolioDialog(false); }, () => {
          const selectedMembers = criticality.filter((c) => selectedCriticalityIds.includes(c.id));
          const avgScore = selectedMembers.length > 0 ? selectedMembers.reduce((acc, m) => acc + m.weightedScore, 0) / selectedMembers.length : 0;
          const highCount = selectedMembers.filter((m) => m.priorityBand === "high").length;
          const medCount = selectedMembers.filter((m) => m.priorityBand === "medium").length;
          const lowCount = selectedMembers.filter((m) => m.priorityBand === "low").length;
          const newPortfolio: CriticalityPortfolio = {
            id: `demo-port-${Date.now()}`,
            portfolioReference,
            modelRevisionId: criticality[0]?.modelRevisionId || "demo-model-1",
            assessmentPeriodStart: "2026-01-01",
            assessmentPeriodEnd: "2026-12-31",
            methodologyNotes: portfolioNotes,
            subjectCount: selectedMembers.length,
            prioritySummary: {
              averageWeightedScore: Number(avgScore.toFixed(2)),
              reviewStatus: "demo_locked",
              countByPriority: { high: highCount, medium: medCount, low: lowCount },
            },
            coverageSummary: {
              method: "demo",
              facilityCount: selectedMembers.filter((m) => m.subjectKind === "facility").length,
              supplierCount: selectedMembers.filter((m) => m.subjectKind === "supplier").length,
              supplierSpecificCarbonCount: selectedMembers.filter((m) => m.subjectKind === "supplier").length,
              completeThreeHazardCount: selectedMembers.length,
              supplierDependencyRecordCount: selectedMembers.length,
              singleSourceSupplierCount: 0,
              selectedSupplierSpendPercent: 85,
              subjectCount: selectedMembers.length,
            },
            inputSha256: "demo-sha256",
            createdAt: new Date().toISOString(),
            members: selectedMembers.map((m) => ({
              ...m,
              reviewStatus: "approved",
            })),
          };
          setPortfolios((prev) => [newPortfolio, ...prev]);
        })}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mã danh mục"><Input required disabled={saving} value={portfolioReference} onChange={(event) => setPortfolioReference(event.target.value)} placeholder="PORTFOLIO-Q1-2026" /></Field>
            <Field label="Ghi chú phương pháp"><Input required disabled={saving} value={portfolioNotes} onChange={(event) => setPortfolioNotes(event.target.value)} placeholder="Tập trung top nhà cung ứng vải..." /></Field>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Chọn các đối tượng vào danh mục:</label>
            <div className="max-h-60 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3 bg-slate-50/40">
              {criticality.map((item) => (
                <label key={item.id} className="flex items-center gap-3 text-xs cursor-pointer p-1.5 rounded hover:bg-slate-100 transition-colors">
                  <input disabled={saving} type="checkbox" className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" checked={selectedCriticalityIds.includes(item.id)} onChange={(event) => setSelectedCriticalityIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
                  <span className="font-medium text-slate-900">{item.supplierName || item.facilityName || item.id.slice(0, 8)}</span>
                  <span className="text-slate-500">Điểm: {item.weightedScore.toFixed(2)} ({item.priorityBand}) · {item.assessmentPeriodStart}–{item.assessmentPeriodEnd}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="pt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpenPortfolioDialog(false)}>Hủy</Button>
            <Button disabled={saving || selectedCriticalityIds.length < 2} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Khóa danh mục ({selectedCriticalityIds.length} đã chọn)
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* DIALOG 9: Xem chi tiết thành viên danh mục */}
    <Dialog open={Boolean(portfolioDetail)} onOpenChange={(open) => !open && setPortfolioDetail(null)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Thành viên danh mục: {portfolioDetail?.portfolioReference}</DialogTitle>
          <DialogDescription>Danh sách các đối tượng và điểm số trọng số đã khóa.</DialogDescription>
        </DialogHeader>
        {portfolioDetail?.members && (
          <div className="space-y-3 pt-2">
            <div className="grid gap-2 sm:grid-cols-2">
              {portfolioDetail.members.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200/80 p-3.5 text-xs bg-slate-50/50 space-y-1">
                  <b className="text-sm font-semibold text-slate-900">{item.supplierName || item.facilityName || item.id}</b>
                  <p className="text-slate-600">Điểm trọng số: <span className="font-bold text-slate-900">{item.weightedScore.toFixed(2)}</span></p>
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant="outline" className={priorityClass[item.priorityBand]}>{item.priorityBand}</Badge>
                    <span className="text-slate-500 font-mono text-[11px]">{item.reviewStatus}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-3 flex justify-end">
              <Button variant="outline" onClick={() => setPortfolioDetail(null)}>Đóng</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  </section>;
}
