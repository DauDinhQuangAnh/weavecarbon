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
  return <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
    <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-emerald-900 p-7 text-white"><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.15em] text-emerald-200"><DatabaseZap className="h-4 w-4" />G2-02</p><h1 className="mt-3 text-3xl font-bold">{t("title")}</h1><p className="mt-3 max-w-3xl text-emerald-50/90">{t("description")}</p></section>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
    {demo && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{t("demoReadOnly")}</div>}
    <section className="grid gap-6 xl:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5" />{t("dqlTitle")}</CardTitle><CardDescription>{t("dqlDescription")}</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={submitDql}><div className="grid gap-3 sm:grid-cols-2"><select className="h-10 rounded-md border bg-background px-3 text-sm" disabled={demo || saving} value={dqlForm.subjectType} onChange={(e) => setDqlForm({ ...dqlForm, subjectType: e.target.value })}><option value="activity">activity</option><option value="facility">facility</option><option value="process">process</option><option value="measurement_point">measurement point</option><option value="emission_factor">emission factor</option></select><Input required disabled={demo || saving} placeholder={t("subjectReference")} value={dqlForm.subjectReference} onChange={(e) => setDqlForm({ ...dqlForm, subjectReference: e.target.value })} /></div><div className="grid grid-cols-5 gap-2">{(["temporal", "geographic", "technological", "completeness", "reliability"] as const).map((key) => { const field = `${key}Score` as keyof typeof dqlForm; return <div key={key}><Label className="text-xs">{t(`dimensions.${key}`)}</Label><Input type="number" min={1} max={5} disabled={demo || saving} value={String(dqlForm[field])} onChange={(e) => setDqlForm({ ...dqlForm, [field]: Number(e.target.value) })} /></div>; })}</div><Input type="number" min={0} max={100} required disabled={demo || saving} aria-label={t("completenessPercent")} value={dqlForm.completenessPercent} onChange={(e) => setDqlForm({ ...dqlForm, completenessPercent: Number(e.target.value) })} /><Textarea required disabled={demo || saving} placeholder={t("rationale")} value={dqlForm.rationale} onChange={(e) => setDqlForm({ ...dqlForm, rationale: e.target.value })} /><Button disabled={demo || saving} className="w-full">{t("score")}</Button></form><div className="mt-5 space-y-2">{dql.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{item.subjectReference}</p><p className="text-xs text-muted-foreground">{item.methodologyVersion} · {item.overallScore}/5</p></div><Badge>{item.dataQualityLevel}</Badge></div>)}</div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />{t("factorTitle")}</CardTitle><CardDescription>{t("factorDescription")}</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={submitFactor}><div className="grid gap-3 sm:grid-cols-2"><Input required disabled={demo || saving} placeholder={t("proposalReference")} value={factorForm.proposalReference} onChange={(e) => setFactorForm({ ...factorForm, proposalReference: e.target.value })} /><Input required disabled={demo || saving} placeholder="factorId" value={factorForm.factorId} onChange={(e) => setFactorForm({ ...factorForm, factorId: e.target.value })} /></div><Input required disabled={demo || saving} placeholder={t("factorLabel")} value={factorForm.label} onChange={(e) => setFactorForm({ ...factorForm, label: e.target.value })} /><div className="grid gap-3 sm:grid-cols-2"><Input required type="number" min={0} step="any" disabled={demo || saving} placeholder={t("factorValue")} value={factorForm.factorValue} onChange={(e) => setFactorForm({ ...factorForm, factorValue: e.target.value })} /><Input required disabled={demo || saving} placeholder={t("unit")} value={factorForm.unit} onChange={(e) => setFactorForm({ ...factorForm, unit: e.target.value })} /></div><Input required disabled={demo || saving} placeholder={t("sourceName")} value={factorForm.sourceName} onChange={(e) => setFactorForm({ ...factorForm, sourceName: e.target.value })} /><Input required disabled={demo || saving} placeholder="https://..." value={factorForm.sourceUrl} onChange={(e) => setFactorForm({ ...factorForm, sourceUrl: e.target.value })} /><Input required disabled={demo || saving} placeholder={t("boundary")} value={factorForm.boundary} onChange={(e) => setFactorForm({ ...factorForm, boundary: e.target.value })} /><Input required disabled={demo || saving} placeholder={t("evidenceIds")} value={factorForm.evidenceDocumentIds} onChange={(e) => setFactorForm({ ...factorForm, evidenceDocumentIds: e.target.value })} /><Button disabled={demo || saving} className="w-full">{t("submitFactor")}</Button></form><div className="mt-5 space-y-2">{factors.map((item) => <div key={item.id} className="rounded-lg border p-3"><div className="flex justify-between gap-3"><p className="font-medium">{item.label}</p><Badge variant="outline">{item.governanceStatus}</Badge></div><p className="text-xs text-muted-foreground">{item.factorValue} {item.unit} · {item.sourceName}</p></div>)}</div></CardContent></Card>
    </section>
  </main>;
}
