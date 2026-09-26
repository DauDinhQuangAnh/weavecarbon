"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Factory, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/apiClient";
import { industrialCoreApi, type IndustrialFacility, type IndustrialProcess } from "@/lib/industrialCoreApi";
import { dataGovernanceApi, type FactorProposal } from "@/lib/dataGovernanceApi";
import { industryPacksApi, type IndustryPackManifest, type IndustryPackPilot } from "@/lib/industryPacksApi";
import { listEvidenceV2, type EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";

type Line = { category: string; sourceReference: string; activityQuantity: number; activityUnit: string; factorProposalId: string; evidenceDocumentIds: string };
const initialLines = (categories: string[] = ["process", "fuel", "electricity"]): Line[] => categories.map((category) => ({ category, sourceReference: "", activityQuantity: 0, activityUnit: "", factorProposalId: "", evidenceDocumentIds: "" }));
const splitIds = (value: string) => value.split(",").map((id) => id.trim()).filter(Boolean);
const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
const evidenceReady = (item: EvidenceDocumentV2) => ["locked", "third_party_verified"].includes(item.status) && /^[a-f0-9]{64}$/i.test(item.checksumSha256 || "") && item.fileSizeBytes > 0;
const categoryLabel: Record<string, string> = { process: "Phát thải quá trình", fuel: "Nhiên liệu", electricity: "Điện", material: "Nguyên vật liệu", feedstock: "Feedstock", steam: "Hơi", transport: "Vận tải", waste: "Chất thải", water: "Nước" };

export default function IndustryPacksClient({ demo = false }: { demo?: boolean }) {
  const t = useTranslations("industryPacks");
  const [manifests, setManifests] = useState<IndustryPackManifest[]>([]);
  const [facilities, setFacilities] = useState<IndustrialFacility[]>([]);
  const [processes, setProcesses] = useState<IndustrialProcess[]>([]);
  const [factors, setFactors] = useState<FactorProposal[]>([]);
  const [evidence, setEvidence] = useState<EvidenceDocumentV2[]>([]);
  const [pilots, setPilots] = useState<IndustryPackPilot[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ packId: "steel", facilityRevisionId: "", processRevisionId: "", studyReference: "", periodStart: "2026-01-01", periodEnd: "2026-12-31", outputTonnes: 0, productReference: "", methodologyBoundary: "", methodologySource: "", productionEvidenceDocumentIds: "" });
  const [sectorContext, setSectorContext] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<Line[]>(initialLines);
  const load = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    try {
      const [packs, facilityRows, processRows, factorRows, pilotRows, evidenceResponse] = await Promise.all([industryPacksApi.manifests(), industrialCoreApi.facilities(), industrialCoreApi.processes(), dataGovernanceApi.factorProposals(), industryPacksApi.pilots(), listEvidenceV2()]);
      setManifests(packs); setFacilities(facilityRows); setProcesses(processRows); setFactors(factorRows); setPilots(pilotRows); setEvidence(evidenceResponse.items.filter(evidenceReady));
    } catch (cause) { setError(isApiError(cause) ? cause.message : t("loadError")); }
    finally { setLoading(false); }
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
          <CardTitle className="text-lg font-bold text-slate-900">{t("pilotTitle")}</CardTitle>
          <CardDescription className="text-slate-600">{t("pilotDescription")}</CardDescription>
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
                        .filter((factor) => factor.governanceStatus === "approved_for_release_candidate" && factor.unit === `kgCO2e/${line.activityUnit}`)
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
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{t("legalNotice")}</p>
    </main>
  );
}
