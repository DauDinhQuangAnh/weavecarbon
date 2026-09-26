"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { DatabaseZap, Gauge, Loader2, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/apiClient";
import { dataGovernanceApi, type DqlAssessment, type FactorProposal } from "@/lib/dataGovernanceApi";

const initialDql = { subjectType: "activity", subjectReference: "", temporalScore: 3, geographicScore: 3,
  technologicalScore: 3, completenessScore: 3, reliabilityScore: 3, completenessPercent: 100, rationale: "" };
const initialFactor = { proposalReference: "", factorId: "", label: "", factorValue: "", unit: "kgCO2e/kWh",
  sourceName: "", sourceUrl: "", sourceYear: "", geography: "VN", boundary: "", gwpBasis: "IPCC AR6 100-year",
  uncertaintyCv: "0", evidenceDocumentIds: "" };

export default function DataGovernanceClient({ demo = false }: { demo?: boolean }) {
  const t = useTranslations("dataGovernance");
  const [dql, setDql] = useState<DqlAssessment[]>([]); const [factors, setFactors] = useState<FactorProposal[]>([]);
  const [dqlForm, setDqlForm] = useState(initialDql); const [factorForm, setFactorForm] = useState(initialFactor);
  const [loading, setLoading] = useState(!demo); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
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

              <Button disabled={demo || saving} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
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
                    <Badge variant="outline" className={getDqlBadgeClass(item.dataQualityLevel)}>
                      {item.dataQualityLevel}
                    </Badge>
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

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Mã tài liệu chứng minh</Label>
                <Input
                  required
                  disabled={demo || saving}
                  placeholder={t("evidenceIds")}
                  value={factorForm.evidenceDocumentIds}
                  onChange={(e) => setFactorForm({ ...factorForm, evidenceDocumentIds: e.target.value })}
                />
              </div>

              <Button disabled={demo || saving} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
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
                  <div key={item.id} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-sm text-slate-900">{item.label}</p>
                      <Badge variant="outline" className="text-xs font-mono">
                        {item.governanceStatus}
                      </Badge>
                    </div>
                    <p className="text-xs text-emerald-800 font-mono font-medium mt-1">
                      {item.factorValue} {item.unit}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{item.sourceName}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
