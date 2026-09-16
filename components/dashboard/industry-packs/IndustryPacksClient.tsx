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

type Category = "process" | "fuel" | "electricity";
type Line = { category: Category; sourceReference: string; activityQuantity: number; activityUnit: string; factorProposalId: string; evidenceDocumentIds: string };
const categories: Category[] = ["process", "fuel", "electricity"];
const initialLines = (): Line[] => categories.map((category) => ({ category, sourceReference: "", activityQuantity: 0, activityUnit: "", factorProposalId: "", evidenceDocumentIds: "" }));
const splitIds = (value: string) => value.split(",").map((id) => id.trim()).filter(Boolean);
const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

export default function IndustryPacksClient({ demo = false }: { demo?: boolean }) {
  const t = useTranslations("industryPacks");
  const [manifests, setManifests] = useState<IndustryPackManifest[]>([]);
  const [facilities, setFacilities] = useState<IndustrialFacility[]>([]);
  const [processes, setProcesses] = useState<IndustrialProcess[]>([]);
  const [factors, setFactors] = useState<FactorProposal[]>([]);
  const [pilots, setPilots] = useState<IndustryPackPilot[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ packId: "steel", facilityRevisionId: "", processRevisionId: "", studyReference: "", periodStart: "2026-01-01", periodEnd: "2026-12-31", outputTonnes: 0, productReference: "", methodologyBoundary: "", methodologySource: "", productionEvidenceDocumentIds: "" });
  const [lines, setLines] = useState<Line[]>(initialLines);
  const load = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    try {
      const [packs, facilityRows, processRows, factorRows, pilotRows] = await Promise.all([industryPacksApi.manifests(), industrialCoreApi.facilities(), industrialCoreApi.processes(), dataGovernanceApi.factorProposals(), industryPacksApi.pilots()]);
      setManifests(packs); setFacilities(facilityRows); setProcesses(processRows); setFactors(factorRows); setPilots(pilotRows);
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
      await industryPacksApi.createPilot({ ...form, allocation: { method: "single_product", share: 1 }, methodology: { boundary: form.methodologyBoundary, source: form.methodologySource }, productionEvidenceDocumentIds: splitIds(form.productionEvidenceDocumentIds), activityLines: lines.map((line) => ({ ...line, evidenceDocumentIds: splitIds(line.evidenceDocumentIds) })) });
      await load();
    } catch (cause) { setError(isApiError(cause) ? cause.message : t("saveError")); }
    finally { setSaving(false); }
  };
  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  return <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
    <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-zinc-900 to-amber-950 p-7 text-white"><p className="text-sm font-semibold uppercase tracking-[.15em] text-amber-200">G2-05 · Industry Packs</p><h1 className="mt-3 text-3xl font-bold">{t("title")}</h1><p className="mt-3 max-w-3xl text-slate-200">{t("description")}</p></section>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
    {demo && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">{t("demoReadOnly")}</div>}
    <div className="grid gap-5 md:grid-cols-2">{manifests.map((pack) => <Card key={pack.id}><CardHeader><CardTitle className="flex items-center gap-2"><Factory className="h-5 w-5" />{pack.id === "steel" ? t("steel") : t("cement")}</CardTitle><CardDescription>{pack.version} · {pack.approvalStatus}</CardDescription></CardHeader><CardContent><p className="text-sm">{pack.processes.join(" · ")}</p><p className="mt-3 text-xs text-muted-foreground">{t("targetCaution")}: {pack.targetMappings.join(" · ")}</p></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>{t("pilotTitle")}</CardTitle><CardDescription>{t("pilotDescription")}</CardDescription></CardHeader><CardContent><form className="space-y-5" onSubmit={submit}>
      <div className="grid gap-3 md:grid-cols-3"><select className={selectClass} disabled={demo} value={form.packId} onChange={(event) => setForm({ ...form, packId: event.target.value, processRevisionId: "" })}><option value="steel">{t("steel")}</option><option value="cement">{t("cement")}</option></select><select required className={selectClass} disabled={demo} value={form.facilityRevisionId} onChange={(event) => setForm({ ...form, facilityRevisionId: event.target.value, processRevisionId: "" })}><option value="">{t("selectFacility")}</option>{facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select><select required className={selectClass} disabled={demo} value={form.processRevisionId} onChange={(event) => setForm({ ...form, processRevisionId: event.target.value })}><option value="">{t("selectProcess")}</option>{processes.filter((process) => process.facilityRevisionId === form.facilityRevisionId && selectedPack?.pilotProcesses.includes(process.processType)).map((process) => <option key={process.id} value={process.id}>{process.name} · {process.processType}</option>)}</select><Input required disabled={demo} placeholder={t("studyReference")} value={form.studyReference} onChange={(event) => setForm({ ...form, studyReference: event.target.value })} /><Input required disabled={demo} placeholder={t("productReference")} value={form.productReference} onChange={(event) => setForm({ ...form, productReference: event.target.value })} /><Input required disabled={demo} type="number" min="0.000001" step="any" placeholder={t("outputTonnes")} value={form.outputTonnes || ""} onChange={(event) => setForm({ ...form, outputTonnes: Number(event.target.value) })} /><Input required disabled={demo} type="date" value={form.periodStart} onChange={(event) => setForm({ ...form, periodStart: event.target.value })} /><Input required disabled={demo} type="date" value={form.periodEnd} onChange={(event) => setForm({ ...form, periodEnd: event.target.value })} /><Input required disabled={demo} placeholder={t("productionEvidence")} value={form.productionEvidenceDocumentIds} onChange={(event) => setForm({ ...form, productionEvidenceDocumentIds: event.target.value })} /></div>
      <div className="grid gap-3 md:grid-cols-2"><Textarea required disabled={demo} placeholder={t("methodologyBoundary")} value={form.methodologyBoundary} onChange={(event) => setForm({ ...form, methodologyBoundary: event.target.value })} /><Textarea required disabled={demo} placeholder={t("methodologySource")} value={form.methodologySource} onChange={(event) => setForm({ ...form, methodologySource: event.target.value })} /></div>
      <div className="space-y-3">{lines.map((line, index) => <div key={line.category} className="rounded-xl border p-4"><h3 className="mb-3 font-semibold">{t(line.category)}</h3><div className="grid gap-3 md:grid-cols-3"><Input required disabled={demo} placeholder={t("sourceReference")} value={line.sourceReference} onChange={(event) => patchLine(index, { sourceReference: event.target.value })} /><Input required disabled={demo} type="number" min="0" step="any" placeholder={t("quantity")} value={line.activityQuantity || ""} onChange={(event) => patchLine(index, { activityQuantity: Number(event.target.value) })} /><Input required disabled={demo} placeholder={t("unit")} value={line.activityUnit} onChange={(event) => patchLine(index, { activityUnit: event.target.value })} /><select required className={selectClass} disabled={demo} value={line.factorProposalId} onChange={(event) => patchLine(index, { factorProposalId: event.target.value })}><option value="">{t("selectFactor")}</option>{factors.filter((factor) => factor.governanceStatus === "approved_for_release_candidate" && factor.unit === `kgCO2e/${line.activityUnit}`).map((factor) => <option key={factor.id} value={factor.id}>{factor.label} · {factor.unit}</option>)}</select><Input required disabled={demo} className="md:col-span-2" placeholder={t("lineEvidence")} value={line.evidenceDocumentIds} onChange={(event) => patchLine(index, { evidenceDocumentIds: event.target.value })} /></div></div>)}</div>
      <Button disabled={demo || saving}>{t("createPilot")}</Button></form></CardContent></Card>
    <Card><CardHeader><CardTitle>{t("resultsTitle")}</CardTitle></CardHeader><CardContent className="space-y-3">{pilots.map((pilot) => <div key={pilot.id} className="rounded-xl border p-4"><div className="flex items-center justify-between gap-2"><b>{pilot.studyReference} · rev {pilot.revision}</b><Badge variant="outline">{pilot.status}</Badge></div><p className="mt-2 text-sm">{pilot.result.totals ? `${pilot.result.totals.grossTco2e} tCO₂e · ${pilot.result.totals.intensityKgCo2ePerTonne} kgCO₂e/t` : t("noTotals")}</p><p className="mt-2 text-xs text-muted-foreground">{pilot.result.findings.map((finding) => finding.code).join(" · ")}</p></div>)}</CardContent></Card>
    <p className="text-sm text-muted-foreground">{t("legalNotice")}</p>
  </main>;
}
