"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileLock2,
  FileText,
  Info,
  Loader2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EvidenceSelector } from "@/components/evidence/EvidenceSelector";
import { isApiError } from "@/lib/apiClient";
import { dataGovernanceApi, type DqlAssessment } from "@/lib/dataGovernanceApi";
import { industrialCoreApi, type IndustrialFacility } from "@/lib/industrialCoreApi";
import { fetchCorporateGhgInventories, type CorporateGhgInventory } from "@/lib/weave-v2/corporateGhgInventoryApi";
import { vnMrvApi, type VnMrvCase, type VnMrvFiling, type VnMrvPlan } from "@/lib/vnMrvApi";

const today = "2026-09-15";

const BLOCKER_MAP: Record<string, { title: string; desc: string }> = {
  MRV_APPLICABILITY_UNRESOLVED: {
    title: "Chưa chốt tính áp dụng bắt buộc",
    desc: "Cơ sở chưa chốt trạng thái danh mục theo QĐ 42/2026/QĐ-TTg (cần chọn 'confirmed_listed' hoặc 'not_listed').",
  },
  MRV_MEASUREMENT_PLAN_REQUIRED: {
    title: "Thiếu kế hoạch giám sát",
    desc: "Chưa thiết lập kế hoạch đo đạc / giám sát phát thải được phê duyệt cho cơ sở.",
  },
  MRV_INVENTORY_NOT_READY: {
    title: "Kiểm kê KNK chưa sẵn sàng",
    desc: "Bản kiểm kê khí nhà kính doanh nghiệp chưa đạt trạng thái sẵn sàng cho thẩm tra (inventory_review_required).",
  },
  MRV_INVENTORY_BLOCKERS: {
    title: "Rào cản kiểm kê chưa xử lý",
    desc: "Bản chụp kết quả kiểm kê KNK còn chứa các điểm cần bổ sung thông tin (needs_information).",
  },
  MRV_DQL_GATE_FAILED: {
    title: "Cổng chất lượng DQL không đạt",
    desc: "Thiếu hồ sơ đánh giá DQL hoặc tồn tại chỉ số chất lượng dữ liệu ở mức không đạt chuẩn (L1 hoặc L2).",
  },
};

export default function VnMrvClient({ demo = false }: { demo?: boolean }) {
  const t = useTranslations("vnMrv");
  const { user } = useAuth();
  const isCompanyAdmin = user?.company_role === "root" || user?.is_root === true;
  const isViewer = user?.company_role === "viewer";

  const [facilities, setFacilities] = useState<IndustrialFacility[]>([]);
  const [cases, setCases] = useState<VnMrvCase[]>([]);
  const [plans, setPlans] = useState<VnMrvPlan[]>([]);
  const [filings, setFilings] = useState<VnMrvFiling[]>([]);
  const [inventories, setInventories] = useState<CorporateGhgInventory[]>([]);
  const [dqlAssessments, setDqlAssessments] = useState<DqlAssessment[]>([]);

  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [caseForm, setCaseForm] = useState({
    caseReference: "",
    facilityRevisionId: "",
    reportingYear: 2026,
    sector: "industry_trade",
    applicabilityStatus: "undetermined",
    listingReference: "",
    listingEvidenceDocumentId: "",
    assessmentDate: today,
    rationale: "",
  });

  const [planForm, setPlanForm] = useState({
    caseId: "",
    planReference: "",
    sourceReference: "",
    methodology: "",
    qaqc: "",
    uncertainty: "",
    dqlIds: "",
    evidenceIds: "",
  });

  const [filingForm, setFilingForm] = useState({
    caseId: "",
    measurementPlanId: "",
    corporateInventoryId: "",
  });

  const load = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    try {
      const [f, c, p, i, g, d] = await Promise.all([
        industrialCoreApi.facilities(),
        vnMrvApi.cases(),
        vnMrvApi.plans(),
        vnMrvApi.filings(),
        fetchCorporateGhgInventories(),
        dataGovernanceApi.dql().catch(() => [] as DqlAssessment[]),
      ]);
      setFacilities(f);
      setCases(c);
      setPlans(p);
      setFilings(i);
      setInventories(g);
      setDqlAssessments(d);
    } catch (e) {
      setError(isApiError(e) ? e.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [demo, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveCase = async (e: FormEvent) => {
    e.preventDefault();
    if (demo || saving) return;
    if (!isCompanyAdmin && !demo) {
      setError("Chỉ Company Admin / Quản trị viên mới có quyền tạo hồ sơ MRV.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...caseForm,
        listingReference: caseForm.listingReference || null,
        listingEvidenceDocumentId: caseForm.listingEvidenceDocumentId || null,
      };
      const x = await vnMrvApi.createCase(payload);
      setCases((v) => [x, ...v]);
      setCaseForm({
        caseReference: "",
        facilityRevisionId: "",
        reportingYear: 2026,
        sector: "industry_trade",
        applicabilityStatus: "undetermined",
        listingReference: "",
        listingEvidenceDocumentId: "",
        assessmentDate: today,
        rationale: "",
      });
    } catch (x) {
      setError(isApiError(x) ? x.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const savePlan = async (e: FormEvent) => {
    e.preventDefault();
    if (demo || saving) return;
    if (!isCompanyAdmin && !demo) {
      setError("Chỉ Company Admin / Quản trị viên mới có quyền tạo kế hoạch giám sát MRV.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const ids = (s: string) =>
        s
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
      const x = await vnMrvApi.createPlan({
        caseId: planForm.caseId,
        planReference: planForm.planReference,
        organizationalBoundary: { approach: "operational_control" },
        operationalBoundary: { scopes: ["scope1", "scope2"] },
        sourceMap: [{ reference: planForm.sourceReference }],
        methodology: { description: planForm.methodology },
        qaqcPlan: { description: planForm.qaqc },
        uncertaintyPlan: { description: planForm.uncertainty },
        dqlAssessmentIds: ids(planForm.dqlIds),
        evidenceDocumentIds: ids(planForm.evidenceIds),
      });
      setPlans((v) => [x, ...v]);
      setPlanForm({
        caseId: "",
        planReference: "",
        sourceReference: "",
        methodology: "",
        qaqc: "",
        uncertainty: "",
        dqlIds: "",
        evidenceIds: "",
      });
    } catch (x) {
      setError(isApiError(x) ? x.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const prepare = async (e: FormEvent) => {
    e.preventDefault();
    if (demo || saving) return;
    if (!isCompanyAdmin && !demo) {
      setError("Chỉ Company Admin / Quản trị viên mới có quyền chuẩn bị hồ sơ nộp MRV.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const x = await vnMrvApi.prepareFiling(filingForm);
      setFilings((v) => [x, ...v]);
    } catch (x) {
      setError(isApiError(x) ? x.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const downloadFilingCsv = (filing: VnMrvFiling) => {
    const c = cases.find((item) => item.id === filing.caseId);
    const p = plans.find((item) => item.id === filing.measurementPlanId);
    const inv = inventories.find((item) => item.id === filing.corporateInventoryId);
    const fac = facilities.find((item) => item.id === c?.facilityRevisionId);

    const rows = [
      ["MUC_BAO_CAO", "THONG_TIN", "GIA_TRI"],
      ["HO_SO_MRV", "Ma ho so (Case Reference)", c?.caseReference || ""],
      ["HO_SO_MRV", "Co so san xuat", fac?.name || c?.facilityRevisionId || ""],
      ["HO_SO_MRV", "Nam bao cao", String(c?.reportingYear || "")],
      ["HO_SO_MRV", "Linh vuc", c?.sector || ""],
      ["HO_SO_MRV", "Trang thai ap dung", c?.applicabilityStatus || ""],
      ["HO_SO_MRV", "Giai trinh phap ly", (c?.rationale || "").replace(/"/g, '""')],
      ["KE_HOACH_GIAM_SAT", "Ma ke hoach (Plan Reference)", p?.planReference || ""],
      ["KE_HOACH_GIAM_SAT", "Revision", String(p?.revision || "1")],
      ["KE_HOACH_GIAM_SAT", "Ma bam toan ven SHA-256", p?.planSha256 || ""],
      ["KIEM_KE_KNK", "Ma kiem ke doanh nghiep", inv?.inventoryReference || ""],
      ["KIEM_KE_KNK", "Tong phat thai Scope 1 + 2 (tCO2e)", String(inv?.result?.totals?.grossScope1AndLocationScope2KgCo2e ? (inv.result.totals.grossScope1AndLocationScope2KgCo2e / 1000).toFixed(2) : "0")],
      ["DANH_GIA_SAN_SANG", "Trang thai san sang nop", filing.readinessStatus],
      ["DANH_GIA_SAN_SANG", "Danh sach rao can (Blockers)", (filing.blockers || []).join("; ") || "Khong co rao can"],
      ["DANH_GIA_SAN_SANG", "Ma bam ho so (Payload SHA-256)", filing.payloadSha256 || ""],
      ["TUAN_THU_PHAP_LY", "Khung phap ly", "Nghi dinh 06/2022/ND-CP, Nghi dinh 119/2025/ND-CP, Nghi dinh 83/2026/ND-CP, Quyet dinh 42/2026/QD-TTg"],
      ["TUAN_THU_PHAP_LY", "Tuyen bo phap ly", (filing.disclaimer || "Internal preparation workflow only").replace(/"/g, '""')],
    ];

    const csvContent = "\uFEFF" + rows.map((r) => r.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MRV_HoSoNop_${c?.caseReference || filing.id}_${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadFilingAuditJson = (filing: VnMrvFiling) => {
    const c = cases.find((item) => item.id === filing.caseId);
    const p = plans.find((item) => item.id === filing.measurementPlanId);
    const inv = inventories.find((item) => item.id === filing.corporateInventoryId);
    const fac = facilities.find((item) => item.id === c?.facilityRevisionId);

    const dossier = {
      filingId: filing.id,
      exportTimestamp: new Date().toISOString(),
      readinessStatus: filing.readinessStatus,
      blockers: filing.blockers,
      payloadSha256: filing.payloadSha256,
      disclaimer: filing.disclaimer,
      case: c || null,
      facility: fac || null,
      plan: p || null,
      inventorySummary: inv
        ? {
            id: inv.id,
            inventoryReference: inv.inventoryReference,
            revision: inv.revision,
            status: inv.automatedStatus,
            result: inv.result,
          }
        : null,
      legalFramework: {
        standards: [
          "Nghị định 06/2022/NĐ-CP",
          "Nghị định 119/2025/NĐ-CP",
          "Nghị định 83/2026/NĐ-CP",
          "Quyết định 42/2026/QĐ-TTg",
        ],
        notice: "Bản sao lưu kiểm toán hồ sơ MRV chuẩn bị nội bộ của doanh nghiệp.",
      },
    };

    const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MRV_Dossier_${c?.caseReference || filing.id}_audit_${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleDqlSelection = (dqlId: string) => {
    const current = planForm.dqlIds
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const exists = current.includes(dqlId);
    const updated = exists ? current.filter((id) => id !== dqlId) : [...current, dqlId];
    setPlanForm({ ...planForm, dqlIds: updated.join(", ") });
  };

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      </div>
    );
  }

  const select = "h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <section className="rounded-3xl bg-gradient-to-br from-red-950 via-slate-950 to-emerald-950 p-7 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.15em] text-emerald-200">
              G2-03 · Báo cáo MRV Quốc gia (Nghị định 06/2022/NĐ-CP)
            </p>
            <h1 className="mt-3 text-3xl font-bold">{t("title")}</h1>
            <p className="mt-3 max-w-3xl text-slate-200 text-sm leading-relaxed">{t("description")}</p>
          </div>
          {isCompanyAdmin ? (
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-3 py-1 text-xs">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              Company Admin (Toàn quyền quản trị MRV)
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-300 border-amber-500/30 px-3 py-1 text-xs">
              <ShieldAlert className="w-3.5 h-3.5 mr-1" />
              Chế độ xem ({user?.company_role || "member"})
            </Badge>
          )}
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {demo && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {t("demoReadOnly")}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-3">
        {/* Case Card */}
        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">{t("caseTitle")}</CardTitle>
            <CardDescription className="text-xs text-slate-600">{t("caseDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <form className="space-y-3" onSubmit={saveCase}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mã hồ sơ (Case Reference)</label>
                <Input
                  required
                  disabled={demo || isViewer}
                  placeholder={t("caseReference")}
                  value={caseForm.caseReference}
                  onChange={(e) => setCaseForm({ ...caseForm, caseReference: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectFacility")}</label>
                <select
                  required
                  disabled={demo || isViewer}
                  className={select}
                  value={caseForm.facilityRevisionId}
                  onChange={(e) => setCaseForm({ ...caseForm, facilityRevisionId: e.target.value })}
                >
                  <option value="">{t("selectFacility")}</option>
                  {facilities.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Trạng thái danh mục bắt buộc</label>
                <select
                  disabled={demo || isViewer}
                  className={select}
                  value={caseForm.applicabilityStatus}
                  onChange={(e) => setCaseForm({ ...caseForm, applicabilityStatus: e.target.value })}
                >
                  <option value="undetermined">undetermined (Chưa xác định)</option>
                  <option value="potentially_listed">potentially listed (Có khả năng thuộc danh mục)</option>
                  <option value="confirmed_listed">confirmed listed (Bắt buộc kiểm kê QĐ 42/2026)</option>
                  <option value="not_listed">not listed (Không thuộc đối tượng)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mã quyết định / danh mục</label>
                <Input
                  disabled={demo || isViewer}
                  placeholder={t("listingReference")}
                  value={caseForm.listingReference}
                  onChange={(e) => setCaseForm({ ...caseForm, listingReference: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Tài liệu pháp lý chứng minh</label>
                <EvidenceSelector
                  value={caseForm.listingEvidenceDocumentId}
                  onChange={(id) => setCaseForm({ ...caseForm, listingEvidenceDocumentId: id })}
                  disabled={demo || isViewer}
                  placeholder="Chọn chứng từ pháp lý từ Vault..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Căn cứ pháp lý & giải trình</label>
                <Textarea
                  required
                  disabled={demo || isViewer}
                  placeholder={t("rationale")}
                  value={caseForm.rationale}
                  onChange={(e) => setCaseForm({ ...caseForm, rationale: e.target.value })}
                />
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                disabled={demo || saving || isViewer}
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("createCase")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Plan Card */}
        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">{t("planTitle")}</CardTitle>
            <CardDescription className="text-xs text-slate-600">{t("planDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <form className="space-y-3" onSubmit={savePlan}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectCase")}</label>
                <select
                  required
                  disabled={demo || isViewer}
                  className={select}
                  value={planForm.caseId}
                  onChange={(e) => setPlanForm({ ...planForm, caseId: e.target.value })}
                >
                  <option value="">{t("selectCase")}</option>
                  {cases.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.caseReference}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mã kế hoạch giám sát</label>
                <Input
                  required
                  disabled={demo || isViewer}
                  placeholder={t("planReference")}
                  value={planForm.planReference}
                  onChange={(e) => setPlanForm({ ...planForm, planReference: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mã nguồn phát thải</label>
                <Input
                  required
                  disabled={demo || isViewer}
                  placeholder={t("sourceReference")}
                  value={planForm.sourceReference}
                  onChange={(e) => setPlanForm({ ...planForm, sourceReference: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Phương pháp đo đạc</label>
                <Textarea
                  required
                  disabled={demo || isViewer}
                  placeholder={t("methodology")}
                  value={planForm.methodology}
                  onChange={(e) => setPlanForm({ ...planForm, methodology: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Kế hoạch QA/QC</label>
                <Textarea
                  required
                  disabled={demo || isViewer}
                  placeholder="Quy trình kiểm soát chất lượng QA/QC..."
                  value={planForm.qaqc}
                  onChange={(e) => setPlanForm({ ...planForm, qaqc: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Độ không đảm bảo đo (Uncertainty)</label>
                <Textarea
                  required
                  disabled={demo || isViewer}
                  placeholder={t("uncertainty")}
                  value={planForm.uncertainty}
                  onChange={(e) => setPlanForm({ ...planForm, uncertainty: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Liên kết hồ sơ DQL</label>
                {dqlAssessments.length > 0 ? (
                  <div className="max-h-36 overflow-y-auto rounded-md border border-slate-200 bg-slate-50/50 p-2 space-y-1.5 text-xs">
                    {dqlAssessments.map((dql) => {
                      const selected = planForm.dqlIds
                        .split(",")
                        .map((x) => x.trim())
                        .includes(dql.id);
                      const isLowQuality = ["L1", "L2"].includes(dql.dataQualityLevel);
                      return (
                        <div
                          key={dql.id}
                          onClick={() => !demo && !isViewer && toggleDqlSelection(dql.id)}
                          className={`flex items-center justify-between p-1.5 rounded cursor-pointer transition-colors ${
                            selected ? "bg-emerald-100 border border-emerald-300" : "bg-white hover:bg-slate-100 border border-slate-100"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={selected}
                              readOnly
                              className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="font-medium text-slate-800 truncate">{dql.subjectReference || dql.id.slice(0, 8)}</span>
                          </div>
                          <Badge
                            variant={isLowQuality ? "destructive" : "outline"}
                            className="text-[10px] shrink-0 font-semibold"
                          >
                            {dql.dataQualityLevel} ({dql.overallScore}/5)
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Input
                    disabled={demo || isViewer}
                    placeholder={t("dqlIds")}
                    value={planForm.dqlIds}
                    onChange={(e) => setPlanForm({ ...planForm, dqlIds: e.target.value })}
                  />
                )}
                {planForm.dqlIds && (
                  <p className="text-[11px] text-slate-500 mt-1 truncate">
                    Đã chọn {planForm.dqlIds.split(",").filter(Boolean).length} DQL: {planForm.dqlIds}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Bằng chứng liên kết</label>
                <EvidenceSelector
                  value=""
                  onChange={(id) => {
                    if (!id) return;
                    const cur = planForm.evidenceIds
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean);
                    if (!cur.includes(id)) {
                      setPlanForm({ ...planForm, evidenceIds: [...cur, id].join(", ") });
                    }
                  }}
                  disabled={demo || isViewer}
                  placeholder="Thêm chứng từ vào kế hoạch..."
                />
                {planForm.evidenceIds && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {planForm.evidenceIds
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean)
                      .map((id) => (
                        <Badge key={id} variant="secondary" className="text-[10px] flex items-center gap-1">
                          {id.slice(0, 8)}...
                          <button
                            type="button"
                            onClick={() => {
                              const remaining = planForm.evidenceIds
                                .split(",")
                                .map((x) => x.trim())
                                .filter((item) => item !== id);
                              setPlanForm({ ...planForm, evidenceIds: remaining.join(", ") });
                            }}
                            className="text-slate-400 hover:text-red-500"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                  </div>
                )}
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                disabled={demo || saving || isViewer}
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("createPlan")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Filing Card */}
        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">{t("filingTitle")}</CardTitle>
            <CardDescription className="text-xs text-slate-600">{t("filingDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <form className="space-y-3" onSubmit={prepare}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectCase")}</label>
                <select
                  required
                  disabled={demo || isViewer}
                  className={select}
                  value={filingForm.caseId}
                  onChange={(e) =>
                    setFilingForm({ ...filingForm, caseId: e.target.value, measurementPlanId: "" })
                  }
                >
                  <option value="">{t("selectCase")}</option>
                  {cases.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.caseReference}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectPlan")}</label>
                <select
                  required
                  disabled={demo || isViewer}
                  className={select}
                  value={filingForm.measurementPlanId}
                  onChange={(e) => setFilingForm({ ...filingForm, measurementPlanId: e.target.value })}
                >
                  <option value="">{t("selectPlan")}</option>
                  {plans
                    .filter((x) => x.caseId === filingForm.caseId)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.planReference}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectInventory")}</label>
                <select
                  required
                  disabled={demo || isViewer}
                  className={select}
                  value={filingForm.corporateInventoryId}
                  onChange={(e) => setFilingForm({ ...filingForm, corporateInventoryId: e.target.value })}
                >
                  <option value="">{t("selectInventory")}</option>
                  {inventories.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.inventoryReference} · rev {x.revision}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                disabled={demo || saving || isViewer}
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("prepareFiling")}
              </Button>
            </form>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Hồ sơ nộp MRV ({filings.length})
                </h4>
              </div>
              {filings.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">Chưa có hồ sơ nào được chuẩn bị</p>
              ) : (
                filings.map((x) => {
                  const isReady = x.readinessStatus === "ready_for_specialist_review";
                  return (
                    <div
                      key={x.id}
                      className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 space-y-2.5 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileLock2 className={`h-4 w-4 ${isReady ? "text-emerald-600" : "text-amber-500"}`} />
                          <span className="text-xs font-semibold text-slate-800">
                            {x.caseId ? cases.find((c) => c.id === x.caseId)?.caseReference || x.id.slice(0, 8) : x.id.slice(0, 8)}
                          </span>
                        </div>
                        <Badge
                          variant={isReady ? "default" : "outline"}
                          className={`font-semibold text-[11px] ${
                            isReady ? "bg-emerald-600 hover:bg-emerald-700" : "border-amber-400 text-amber-800 bg-amber-50"
                          }`}
                        >
                          {x.readinessStatus}
                        </Badge>
                      </div>

                      {x.blockers.length > 0 ? (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Rào cản chất lượng ({x.blockers.length}):
                          </p>
                          <div className="space-y-1">
                            {x.blockers.map((blockerKey) => {
                              const info = BLOCKER_MAP[blockerKey] || {
                                title: blockerKey,
                                desc: "Cần rà soát và bổ sung thông tin.",
                              };
                              return (
                                <div
                                  key={blockerKey}
                                  className="text-[11px] bg-red-50/80 border border-red-100 rounded-lg p-2 text-red-900"
                                >
                                  <span className="font-semibold">{info.title}: </span>
                                  <span className="text-red-700">{info.desc}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {t("noBlockers")}
                        </p>
                      )}

                      {/* Export Dossier Buttons */}
                      <div className="pt-2 flex flex-wrap gap-2 border-t border-slate-200/60">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadFilingCsv(x)}
                          className="h-7 text-[11px] border-emerald-300 text-emerald-700 hover:bg-emerald-50 px-2.5"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Tải Hồ sơ Nộp MRV (CSV)
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadFilingAuditJson(x)}
                          className="h-7 text-[11px] border-slate-300 text-slate-700 hover:bg-slate-100 px-2.5"
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          Bằng chứng Audit (JSON)
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border border-slate-200/80 bg-slate-50/50">
        <CardContent className="flex gap-3 p-5">
          <ClipboardCheck className="h-5 w-5 shrink-0 text-emerald-700 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">{t("legalNotice")}</p>
        </CardContent>
      </Card>
    </main>
  );
}
