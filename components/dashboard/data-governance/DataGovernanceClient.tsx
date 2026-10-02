"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, DatabaseZap, Eye, Gauge, Info, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EvidenceSelector } from "@/components/evidence/EvidenceSelector";
import { isApiError } from "@/lib/apiClient";
import { dataGovernanceApi, type DqlAssessment, type FactorProposal } from "@/lib/dataGovernanceApi";

const initialDql = { subjectType: "activity", subjectReference: "", temporalScore: 3, geographicScore: 3,
  technologicalScore: 3, completenessScore: 3, reliabilityScore: 3, completenessPercent: 100, rationale: "" };
const initialFactor = { proposalReference: "", factorId: "", label: "", factorValue: "", unit: "kgCO2e/kWh",
  sourceName: "", sourceUrl: "", sourceYear: "", geography: "VN", boundary: "", gwpBasis: "IPCC AR6 100-year",
  uncertaintyCv: "0", evidenceDocumentIds: "" };

export default function DataGovernanceClient({ demo = false }: { demo?: boolean }) {
  const t = useTranslations("dataGovernance");
  const { user } = useAuth();
  const isViewer = user?.company_role === "viewer";
  const isCompanyAdmin = user?.company_role === "root" || user?.is_root === true;

  const [dql, setDql] = useState<DqlAssessment[]>([]); const [factors, setFactors] = useState<FactorProposal[]>([]);
  const [dqlForm, setDqlForm] = useState(initialDql); const [factorForm, setFactorForm] = useState(initialFactor);
  const [loading, setLoading] = useState(!demo); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);

  const [reviewingProposal, setReviewingProposal] = useState<FactorProposal | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"approved_for_release_candidate" | "needs_information" | "rejected">("approved_for_release_candidate");
  const [reviewNotes, setReviewNotes] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [selectedDql, setSelectedDql] = useState<DqlAssessment | null>(null);

  const load = useCallback(async () => { if (demo) return; setLoading(true); setError(null); try {
    const [dqlRows, factorRows] = await Promise.all([dataGovernanceApi.dql(), dataGovernanceApi.factorProposals()]);
    setDql(dqlRows); setFactors(factorRows);
  } catch (cause) { setError(isApiError(cause) ? cause.message : t("loadError")); } finally { setLoading(false); } }, [demo, t]);
  useEffect(() => { void load(); }, [load]);

  const submitDql = async (event: FormEvent) => { event.preventDefault(); if (demo || saving) return; setSaving(true); setError(null); try {
    const created = await dataGovernanceApi.createDql({ ...dqlForm, improvementActions: [], evidenceDocumentIds: [] });
    setDql((rows) => [created, ...rows]); setDqlForm(initialDql);
  } catch (cause) { setError(isApiError(cause) ? cause.message : t("saveError")); } finally { setSaving(false); } };
  const submitFactor = async (event: FormEvent) => { event.preventDefault(); if (demo || saving) return; setSaving(true); setError(null); try {
    const evidenceDocumentIds = factorForm.evidenceDocumentIds.split(",").map((item) => item.trim()).filter(Boolean);
    const created = await dataGovernanceApi.createFactorProposal({ ...factorForm, factorValue: Number(factorForm.factorValue),
      uncertaintyCv: Number(factorForm.uncertaintyCv), sourceYear: factorForm.sourceYear ? Number(factorForm.sourceYear) : null,
      evidenceDocumentIds, isProxy: false, validFrom: null, validTo: null });
    setFactors((rows) => [created, ...rows]); setFactorForm(initialFactor);
  } catch (cause) { setError(isApiError(cause) ? cause.message : t("saveError")); } finally { setSaving(false); } };

  const handleOpenReview = (proposal: FactorProposal) => {
    setReviewingProposal(proposal);
    setReviewDecision("approved_for_release_candidate");
    setReviewNotes("");
    setReviewError(null);
  };

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!reviewingProposal || submittingReview) return;
    setSubmittingReview(true);
    setReviewError(null);
    try {
      await dataGovernanceApi.reviewFactorProposal(reviewingProposal.id, {
        reviewerRole: "emission_factor_reviewer",
        decision: reviewDecision,
        notes: reviewNotes,
      });
      setReviewingProposal(null);
      await load();
    } catch (cause) {
      setReviewError(isApiError(cause) ? cause.message : "Có lỗi khi ghi nhận phê duyệt.");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-emerald-700" /></div>;
  const getDqlBadgeClass = (level: string) => {
    switch (level) {
      case "L1":
        return "border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold";
      case "L2":
        return "border-sky-300 bg-sky-50 text-sky-800 font-semibold";
      case "L3":
        return "border-amber-300 bg-amber-50 text-amber-800 font-semibold";
      default:
        return "border-rose-300 bg-rose-50 text-rose-800 font-semibold";
    }
  };

  const getProposalStatusBadgeClass = (status: string) => {
    switch (status) {
      case "approved_for_release_candidate":
        return "border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold";
      case "rejected":
        return "border-rose-300 bg-rose-50 text-rose-800 font-semibold";
      case "needs_information":
        return "border-amber-300 bg-amber-50 text-amber-800 font-semibold";
      case "pending_review":
        return "border-sky-300 bg-sky-50 text-sky-800 font-semibold";
      default:
        return "border-slate-300 bg-slate-50 text-slate-700 font-semibold";
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950 p-7 text-white shadow-md">
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.15em] text-emerald-300">
          <DatabaseZap className="h-4 w-4" /> G2-02 · Quản trị Dữ liệu & Hệ số
        </p>
        <h1 className="mt-3 text-3xl font-bold">{t("title")}</h1>
        <p className="mt-3 max-w-3xl text-emerald-100/90 text-sm leading-relaxed">{t("description")}</p>
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

      <section className="grid gap-6 xl:grid-cols-2">
        {/* DQL Card */}
        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Gauge className="h-5 w-5 text-emerald-600" />
              {t("dqlTitle")}
            </CardTitle>
            <CardDescription className="text-slate-600">{t("dqlDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <form className="space-y-4" onSubmit={submitDql}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Đối tượng đánh giá</Label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-200 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    disabled={demo || saving}
                    value={dqlForm.subjectType}
                    onChange={(e) => setDqlForm({ ...dqlForm, subjectType: e.target.value })}
                  >
                    <option value="activity">Hoạt động (Activity)</option>
                    <option value="facility">Cơ sở sản xuất (Facility)</option>
                    <option value="process">Quy trình (Process)</option>
                    <option value="measurement_point">Điểm đo lường (Measurement Point)</option>
                    <option value="emission_factor">Hệ số phát thải (Emission Factor)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">{t("subjectReference")}</Label>
                  <Input
                    required
                    disabled={demo || saving}
                    placeholder="Mã đối tượng..."
                    value={dqlForm.subjectReference}
                    onChange={(e) => setDqlForm({ ...dqlForm, subjectReference: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">5 Chiều DQL (Thang điểm 1-5)</Label>
                <div className="grid grid-cols-5 gap-2">
                  {(["temporal", "geographic", "technological", "completeness", "reliability"] as const).map((key) => {
                    const field = `${key}Score` as keyof typeof dqlForm;
                    return (
                      <div key={key} className="space-y-1 text-center">
                        <Label className="text-[11px] text-slate-500 truncate block">{t(`dimensions.${key}`)}</Label>
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          disabled={demo || saving}
                          className="text-center font-bold"
                          value={String(dqlForm[field])}
                          onChange={(e) => setDqlForm({ ...dqlForm, [field]: Number(e.target.value) })}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Tỷ lệ đầy đủ (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  required
                  disabled={demo || saving}
                  aria-label={t("completenessPercent")}
                  value={dqlForm.completenessPercent}
                  onChange={(e) => setDqlForm({ ...dqlForm, completenessPercent: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Cơ sở lý luận & Bằng chứng</Label>
                <Textarea
                  required
                  disabled={demo || saving}
                  placeholder={t("rationale")}
                  value={dqlForm.rationale}
                  onChange={(e) => setDqlForm({ ...dqlForm, rationale: e.target.value })}
                />
              </div>

              {!isCompanyAdmin && !demo && (
                <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Chỉ Quản trị viên (Company Admin) mới có quyền lưu đánh giá DQL.</span>
                </div>
              )}
              <Button disabled={demo || saving || !isCompanyAdmin} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("score")}
              </Button>
            </form>

            <div className="mt-6 space-y-2.5">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hồ sơ DQL đã lưu</h4>
              {dql.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">Chưa có đánh giá DQL nào</p>
              ) : (
                dql.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="font-semibold text-sm text-slate-900">{item.subjectReference}</p>
                      <p className="text-xs text-slate-500">{item.methodologyVersion} · Điểm tổng: <span className="font-bold text-slate-700">{item.overallScore}/5</span></p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getDqlBadgeClass(item.dataQualityLevel)}>
                        {item.dataQualityLevel}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                        onClick={() => setSelectedDql(item)}
                        title="Xem chi tiết"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Factor Proposal Card */}
        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              {t("factorTitle")}
            </CardTitle>
            <CardDescription className="text-slate-600">{t("factorDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <form className="space-y-4" onSubmit={submitFactor}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Mã đề xuất</Label>
                  <Input
                    required
                    disabled={demo || saving}
                    placeholder={t("proposalReference")}
                    value={factorForm.proposalReference}
                    onChange={(e) => setFactorForm({ ...factorForm, proposalReference: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Mã hệ số (ID)</Label>
                  <Input
                    required
                    disabled={demo || saving}
                    placeholder="VD: EF-ELEC-VN-2026"
                    value={factorForm.factorId}
                    onChange={(e) => setFactorForm({ ...factorForm, factorId: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Tên nhãn hệ số</Label>
                <Input
                  required
                  disabled={demo || saving}
                  placeholder={t("factorLabel")}
                  value={factorForm.label}
                  onChange={(e) => setFactorForm({ ...factorForm, label: e.target.value })}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Giá trị phát thải</Label>
                  <Input
                    required
                    type="number"
                    min={0}
                    step="any"
                    disabled={demo || saving}
                    placeholder={t("factorValue")}
                    value={factorForm.factorValue}
                    onChange={(e) => setFactorForm({ ...factorForm, factorValue: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Đơn vị đo</Label>
                  <Input
                    required
                    disabled={demo || saving}
                    placeholder={t("unit")}
                    value={factorForm.unit}
                    onChange={(e) => setFactorForm({ ...factorForm, unit: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Nguồn dữ liệu</Label>
                  <Input
                    required
                    disabled={demo || saving}
                    placeholder={t("sourceName")}
                    value={factorForm.sourceName}
                    onChange={(e) => setFactorForm({ ...factorForm, sourceName: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Đường dẫn nguồn (URL)</Label>
                  <Input
                    disabled={demo || saving}
                    placeholder="https://..."
                    value={factorForm.sourceUrl}
                    onChange={(e) => setFactorForm({ ...factorForm, sourceUrl: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Ranh giới tính toán</Label>
                <Input
                  required
                  disabled={demo || saving}
                  placeholder={t("boundary")}
                  value={factorForm.boundary}
                  onChange={(e) => setFactorForm({ ...factorForm, boundary: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700">Tài liệu chứng minh (Evidence Vault)</Label>
                  <span className="text-[11px] text-slate-500">ISO 14064-1 Bắt buộc</span>
                </div>
                <EvidenceSelector
                  value={factorForm.evidenceDocumentIds.split(",")[0]?.trim() || null}
                  onChange={(evidenceId) => {
                    setFactorForm((prev) => ({
                      ...prev,
                      evidenceDocumentIds: evidenceId || "",
                    }));
                  }}
                  placeholder="Chọn chứng từ đã xác minh từ Evidence Vault..."
                  disabled={demo || saving || !isCompanyAdmin}
                  required
                />
                <Input
                  required
                  disabled={demo || saving || !isCompanyAdmin}
                  placeholder={t("evidenceIds")}
                  value={factorForm.evidenceDocumentIds}
                  onChange={(e) => setFactorForm({ ...factorForm, evidenceDocumentIds: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>

              {!isCompanyAdmin && !demo && (
                <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Chỉ Quản trị viên (Company Admin) mới có quyền tạo đề xuất hệ số.</span>
                </div>
              )}
              <Button disabled={demo || saving || !isCompanyAdmin} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("submitFactor")}
              </Button>
            </form>

            <div className="mt-6 space-y-2.5">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hệ số trong danh mục</h4>
              {factors.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">Chưa có đề xuất hệ số nào</p>
              ) : (
                factors.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 hover:bg-slate-50 transition-colors space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm text-slate-900">{item.label}</p>
                        <p className="text-xs text-slate-500 font-mono">{item.proposalReference} (rev {item.revision})</p>
                      </div>
                      <Badge variant="outline" className={`text-xs font-mono ${getProposalStatusBadgeClass(item.governanceStatus)}`}>
                        {item.governanceStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50">
                      <div>
                        <span className="text-emerald-800 font-mono font-bold">{item.factorValue} {item.unit}</span>
                        <span className="text-slate-400 ml-2">· {item.sourceName} ({item.geography})</span>
                      </div>
                      {isCompanyAdmin && !demo && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-emerald-600/30 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => handleOpenReview(item)}
                        >
                          <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                          Đánh giá & Duyệt
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Factor Review Modal */}
      <Dialog open={Boolean(reviewingProposal)} onOpenChange={(open) => { if (!open) setReviewingProposal(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Thẩm định & Phê duyệt Hệ số
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {reviewingProposal?.label} ({reviewingProposal?.proposalReference}) · Giá trị: {reviewingProposal?.factorValue} {reviewingProposal?.unit}
            </DialogDescription>
          </DialogHeader>

          {reviewError && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{reviewError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitReview} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Quyết định thẩm định</Label>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={reviewDecision}
                onChange={(e) => setReviewDecision(e.target.value as 'approved_for_release_candidate' | 'needs_information' | 'rejected')}
                disabled={submittingReview}
              >
                <option value="approved_for_release_candidate">Phê duyệt (Release Candidate)</option>
                <option value="needs_information">Yêu cầu bổ sung chứng từ / thông tin</option>
                <option value="rejected">Từ chối đề xuất</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Vai trò kiểm duyệt</Label>
              <Input
                disabled
                value="emission_factor_reviewer"
                className="bg-slate-100 font-mono text-xs text-slate-600"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Giải trình thẩm định & Ghi chú kiểm toán</Label>
              <Textarea
                required
                rows={3}
                placeholder="Nêu rõ lý do phê duyệt, đối chiếu tài liệu nguồn hoặc yêu cầu bổ sung theo ISO 14064..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                disabled={submittingReview}
                className="text-xs"
              />
              <p className="text-[11px] text-slate-400">Ghi chú này sẽ được lưu bất biến vào nhật ký kiểm toán (Audit Trail).</p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReviewingProposal(null)}
                disabled={submittingReview}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={submittingReview}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submittingReview && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Xác nhận Quyết định
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DQL Detail Dialog */}
      <Dialog open={Boolean(selectedDql)} onOpenChange={(open) => { if (!open) setSelectedDql(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Gauge className="h-5 w-5 text-emerald-600" />
              Chi tiết Hồ sơ DQL · {selectedDql?.subjectReference}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {selectedDql?.methodologyVersion} · Đối tượng: {selectedDql?.subjectType}
            </DialogDescription>
          </DialogHeader>

          {selectedDql && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100/70 border border-slate-200">
                <div>
                  <p className="text-xs text-slate-500">Xếp hạng DQL</p>
                  <p className="text-xl font-bold text-slate-900">{selectedDql.dataQualityLevel}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Điểm tổng hợp</p>
                  <p className="text-xl font-bold text-emerald-700">{selectedDql.overallScore} / 5</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Độ đầy đủ</p>
                  <p className="text-xl font-bold text-sky-700">{selectedDql.completenessPercent}%</p>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Cơ sở lý luận & Bằng chứng</Label>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed max-h-40 overflow-y-auto">
                  {selectedDql.rationale}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setSelectedDql(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
