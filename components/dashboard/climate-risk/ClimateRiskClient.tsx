"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CloudSun, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/apiClient";
import { industrialCoreApi, type IndustrialFacility } from "@/lib/industrialCoreApi";
import { listEvidenceV2, type EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";
import { climateRiskApi, type ClimateAssessment, type ClimateLocation, type ClimatePortfolio } from "@/lib/climateRiskApi";

const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
const evidenceReady = (item: EvidenceDocumentV2) => ["locked", "third_party_verified"].includes(item.status) &&
  /^[a-f0-9]{64}$/i.test(item.checksumSha256 || "") && item.fileSizeBytes > 0;
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-1 text-sm"><span className="font-medium">{label}</span>{children}</label>;
}
const initialLocation = { facilityRevisionId: "", latitude: "", longitude: "", precisionMeters: "100", locationBasis: "", evidenceDocumentId: "" };
const initialAssessment = { facilityRevisionId: "", locationRevisionId: "", hazardType: "heat", scenarioKind: "historical",
  scenarioReference: "", horizonStart: "", horizonEnd: "", sourceKind: "ERA5_LAND", sourceUrl: "",
  datasetIdentifier: "", datasetVersion: "", spatialResolution: "", temporalResolution: "", gridReference: "", spatialMatchNotes: "", modelName: "",
  scenarioName: "", hazardMetric: "", metricValue: "", metricUnit: "", uncertaintyNotes: "",
  exposureRating: "3", vulnerabilityRating: "3", businessDependencyPercent: "", priorityBand: "medium",
  ratingRationale: "", evidenceDocumentId: "" };

export default function ClimateRiskClient({ demo = false }: { demo?: boolean }) {
  const t = useTranslations("climateRisk");
  const [facilities, setFacilities] = useState<IndustrialFacility[]>([]);
  const [evidence, setEvidence] = useState<EvidenceDocumentV2[]>([]);
  const [locations, setLocations] = useState<ClimateLocation[]>([]);
  const [assessments, setAssessments] = useState<ClimateAssessment[]>([]);
  const [portfolios, setPortfolios] = useState<ClimatePortfolio[]>([]);
  const [portfolioDetail, setPortfolioDetail] = useState<(ClimatePortfolio & { assessments: ClimateAssessment[] }) | null>(null);
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationForm, setLocationForm] = useState(initialLocation);
  const [assessmentForm, setAssessmentForm] = useState(initialAssessment);
  const [portfolioReference, setPortfolioReference] = useState("");
  const [methodologyNotes, setMethodologyNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const load = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    try {
      const [facilityRows, evidenceResponse, locationRows, assessmentRows, portfolioRows] = await Promise.all([
        industrialCoreApi.facilities(), listEvidenceV2(), climateRiskApi.locations(), climateRiskApi.assessments(), climateRiskApi.portfolios()
      ]);
      setFacilities(facilityRows); setEvidence(evidenceResponse.items.filter(evidenceReady));
      setLocations(locationRows); setAssessments(assessmentRows); setPortfolios(portfolioRows);
      setError(null);
    } catch (cause) { setError(isApiError(cause) ? cause.message : t("loadError")); }
    finally { setLoading(false); }
  }, [demo, t]);
  useEffect(() => { void load(); }, [load]);
  const run = async (action: () => Promise<unknown>) => {
    if (demo || saving) return;
    setSaving(true); setError(null);
    try { await action(); await load(); }
    catch (cause) { setError(isApiError(cause) ? cause.message : t("saveError")); }
    finally { setSaving(false); }
  };
  const createLocation = (event: FormEvent) => { event.preventDefault(); void run(async () => {
    await climateRiskApi.createLocation({ ...locationForm, latitude: Number(locationForm.latitude), longitude: Number(locationForm.longitude),
      precisionMeters: Number(locationForm.precisionMeters) });
    setLocationForm(initialLocation);
  }); };
  const createAssessment = (event: FormEvent) => { event.preventDefault(); void run(async () => {
    await climateRiskApi.createAssessment({ ...assessmentForm, metricValue: Number(assessmentForm.metricValue),
      exposureRating: Number(assessmentForm.exposureRating), vulnerabilityRating: Number(assessmentForm.vulnerabilityRating),
      businessDependencyPercent: Number(assessmentForm.businessDependencyPercent) });
    setAssessmentForm(initialAssessment);
  }); };
  const createPortfolio = (event: FormEvent) => { event.preventDefault(); void run(async () => {
    await climateRiskApi.createPortfolio({ portfolioReference, methodologyNotes, assessmentIds: selectedIds });
    setPortfolioReference(""); setMethodologyNotes(""); setSelectedIds([]);
  }); };
  const inspectPortfolio = async (id: string) => {
    try { setPortfolioDetail(await climateRiskApi.portfolio(id)); setError(null); }
    catch (cause) { setError(isApiError(cause) ? cause.message : t("loadError")); }
  };
  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  return <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
    <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-sky-950 to-teal-950 p-7 text-white">
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[.15em] text-sky-200"><CloudSun className="h-5 w-5" />G2-07 · Climate Risk</p>
      <h1 className="mt-3 text-3xl font-bold">{t("title")}</h1><p className="mt-3 max-w-3xl text-slate-200">{t("description")}</p>
    </section>
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">{t("caution")}</div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
    {demo && <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-900">{t("demoReadOnly")}</div>}
    <Card><CardHeader><CardTitle>{t("locationTitle")}</CardTitle><CardDescription>{t("locationDescription")}</CardDescription></CardHeader><CardContent>
      <form className="grid gap-3 md:grid-cols-3" onSubmit={createLocation}>
        <Field label={t("facility")}><select required disabled={demo} className={selectClass} value={locationForm.facilityRevisionId} onChange={(event) => setLocationForm({ ...locationForm, facilityRevisionId: event.target.value })}><option value="">{t("selectFacility")}</option>{facilities.map((f) => <option key={f.id} value={f.id}>{f.name} · {f.facilityReference}</option>)}</select></Field>
        <Field label={t("latitude")}><Input required disabled={demo} type="number" min="-90" max="90" step="0.000001" value={locationForm.latitude} onChange={(event) => setLocationForm({ ...locationForm, latitude: event.target.value })} /></Field>
        <Field label={t("longitude")}><Input required disabled={demo} type="number" min="-180" max="180" step="0.000001" value={locationForm.longitude} onChange={(event) => setLocationForm({ ...locationForm, longitude: event.target.value })} /></Field>
        <Field label={t("precision")}><Input required disabled={demo} type="number" min="1" max="100000" value={locationForm.precisionMeters} onChange={(event) => setLocationForm({ ...locationForm, precisionMeters: event.target.value })} /></Field>
        <Field label={t("locationBasis")}><Input required disabled={demo} value={locationForm.locationBasis} onChange={(event) => setLocationForm({ ...locationForm, locationBasis: event.target.value })} /></Field>
        <Field label={t("locationEvidence")}><select required disabled={demo} className={selectClass} value={locationForm.evidenceDocumentId} onChange={(event) => setLocationForm({ ...locationForm, evidenceDocumentId: event.target.value })}><option value="">{t("selectEvidence")}</option>{evidence.map((item) => <option key={item.id} value={item.id}>{item.documentName}</option>)}</select></Field>
        <Button disabled={demo || saving} className="md:col-span-3">{t("saveLocation")}</Button>
      </form>
      <div className="mt-5 grid gap-2 md:grid-cols-2">{locations.map((item) => <div key={item.id} className="rounded-xl border p-3 text-sm"><b>{item.facilityName || item.facilityRevisionId}</b><p>{item.latitude}, {item.longitude} · ±{item.precisionMeters} m</p><p className="text-xs text-muted-foreground">{item.id}</p></div>)}</div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>{t("assessmentTitle")}</CardTitle><CardDescription>{t("assessmentDescription")}</CardDescription></CardHeader><CardContent>
      <form className="space-y-4" onSubmit={createAssessment}>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label={t("facility")}><select required disabled={demo} className={selectClass} value={assessmentForm.facilityRevisionId} onChange={(event) => setAssessmentForm({ ...assessmentForm, facilityRevisionId: event.target.value, locationRevisionId: "" })}><option value="">{t("selectFacility")}</option>{facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>
          <Field label={t("locationRevision")}><select required disabled={demo} className={selectClass} value={assessmentForm.locationRevisionId} onChange={(event) => setAssessmentForm({ ...assessmentForm, locationRevisionId: event.target.value })}><option value="">{t("selectLocation")}</option>{locations.filter((l) => l.facilityRevisionId === assessmentForm.facilityRevisionId).map((l) => <option key={l.id} value={l.id}>{l.latitude}, {l.longitude} · {l.id.slice(0, 8)}</option>)}</select></Field>
          <Field label={t("hazard")}><select disabled={demo} className={selectClass} value={assessmentForm.hazardType} onChange={(event) => setAssessmentForm({ ...assessmentForm, hazardType: event.target.value })}><option value="heat">{t("heat")}</option><option value="drought">{t("drought")}</option><option value="extreme_rainfall">{t("rainfall")}</option></select></Field>
          <Field label={t("scenarioKind")}><select disabled={demo} className={selectClass} value={assessmentForm.scenarioKind} onChange={(event) => setAssessmentForm({ ...assessmentForm, scenarioKind: event.target.value, sourceKind: event.target.value === "historical" ? "ERA5_LAND" : "CMIP6" })}><option value="historical">{t("historical")}</option><option value="projection">{t("projection")}</option></select></Field>
          <Field label={t("scenarioReference")}><Input required disabled={demo} value={assessmentForm.scenarioReference} onChange={(event) => setAssessmentForm({ ...assessmentForm, scenarioReference: event.target.value })} /></Field>
          <Field label={t("sourceKind")}><select disabled={demo} className={selectClass} value={assessmentForm.sourceKind} onChange={(event) => setAssessmentForm({ ...assessmentForm, sourceKind: event.target.value })}>{assessmentForm.scenarioKind === "historical" ? <option value="ERA5_LAND">ERA5-Land</option> : <option value="CMIP6">CMIP6</option>}<option value="OTHER">{t("otherSource")}</option></select></Field>
          <Field label={t("horizonStart")}><Input required disabled={demo} type="date" value={assessmentForm.horizonStart} onChange={(event) => setAssessmentForm({ ...assessmentForm, horizonStart: event.target.value })} /></Field>
          <Field label={t("horizonEnd")}><Input required disabled={demo} type="date" value={assessmentForm.horizonEnd} onChange={(event) => setAssessmentForm({ ...assessmentForm, horizonEnd: event.target.value })} /></Field>
          <Field label={t("sourceUrl")}><Input required disabled={demo} type="url" value={assessmentForm.sourceUrl} onChange={(event) => setAssessmentForm({ ...assessmentForm, sourceUrl: event.target.value })} /></Field>
          {(["datasetIdentifier", "datasetVersion", "spatialResolution", "temporalResolution"] as const).map((key) => <Field key={key} label={t(key)}><Input required disabled={demo} value={assessmentForm[key]} onChange={(event) => setAssessmentForm({ ...assessmentForm, [key]: event.target.value })} /></Field>)}
          <Field label={t("gridReference")}><Input required disabled={demo} value={assessmentForm.gridReference} onChange={(event) => setAssessmentForm({ ...assessmentForm, gridReference: event.target.value })} /></Field>
          {assessmentForm.scenarioKind === "projection" && (["modelName", "scenarioName"] as const).map((key) => <Field key={key} label={t(key)}><Input required disabled={demo} value={assessmentForm[key]} onChange={(event) => setAssessmentForm({ ...assessmentForm, [key]: event.target.value })} /></Field>)}
          {(["hazardMetric", "metricUnit"] as const).map((key) => <Field key={key} label={t(key)}><Input required disabled={demo} value={assessmentForm[key]} onChange={(event) => setAssessmentForm({ ...assessmentForm, [key]: event.target.value })} /></Field>)}
          <Field label={t("metricValue")}><Input required disabled={demo} type="number" step="0.00000001" value={assessmentForm.metricValue} onChange={(event) => setAssessmentForm({ ...assessmentForm, metricValue: event.target.value })} /></Field>
          <Field label={t("exposure")}><Input required disabled={demo} type="number" min="1" max="5" value={assessmentForm.exposureRating} onChange={(event) => setAssessmentForm({ ...assessmentForm, exposureRating: event.target.value })} /></Field>
          <Field label={t("vulnerability")}><Input required disabled={demo} type="number" min="1" max="5" value={assessmentForm.vulnerabilityRating} onChange={(event) => setAssessmentForm({ ...assessmentForm, vulnerabilityRating: event.target.value })} /></Field>
          <Field label={t("dependency")}><Input required disabled={demo} type="number" min="0" max="100" step="0.001" value={assessmentForm.businessDependencyPercent} onChange={(event) => setAssessmentForm({ ...assessmentForm, businessDependencyPercent: event.target.value })} /></Field>
          <Field label={t("priority")}><select disabled={demo} className={selectClass} value={assessmentForm.priorityBand} onChange={(event) => setAssessmentForm({ ...assessmentForm, priorityBand: event.target.value })}><option value="low">{t("low")}</option><option value="medium">{t("medium")}</option><option value="high">{t("high")}</option></select></Field>
          <Field label={t("sourceEvidence")}><select required disabled={demo} className={selectClass} value={assessmentForm.evidenceDocumentId} onChange={(event) => setAssessmentForm({ ...assessmentForm, evidenceDocumentId: event.target.value })}><option value="">{t("selectEvidence")}</option>{evidence.map((item) => <option key={item.id} value={item.id}>{item.documentName}</option>)}</select></Field>
        </div>
        <div className="grid gap-3 md:grid-cols-3"><Field label={t("spatialMatchNotes")}><Textarea required disabled={demo} value={assessmentForm.spatialMatchNotes} onChange={(event) => setAssessmentForm({ ...assessmentForm, spatialMatchNotes: event.target.value })} /></Field><Field label={t("uncertainty")}><Textarea required disabled={demo} value={assessmentForm.uncertaintyNotes} onChange={(event) => setAssessmentForm({ ...assessmentForm, uncertaintyNotes: event.target.value })} /></Field><Field label={t("rationale")}><Textarea required disabled={demo} value={assessmentForm.ratingRationale} onChange={(event) => setAssessmentForm({ ...assessmentForm, ratingRationale: event.target.value })} /></Field></div>
        <Button disabled={demo || saving}>{t("saveAssessment")}</Button>
      </form>
      <div className="mt-5 grid gap-2 md:grid-cols-2">{assessments.map((item) => <div key={item.id} className="rounded-xl border p-3 text-sm"><div className="flex items-center justify-between gap-2"><b>{item.facilityName || item.facilityRevisionId} · {item.hazardType}</b><Badge variant="outline">{item.priorityBand}</Badge></div><p>{item.scenarioReference} · {item.horizonStart}–{item.horizonEnd} · {item.sourceKind}</p><p className="text-xs text-muted-foreground">{item.datasetIdentifier} {item.datasetVersion} · {item.gridReference} · {item.spatialResolution}</p><p className="text-xs text-muted-foreground">{item.id} · {item.screeningStatus}</p></div>)}</div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>{t("portfolioTitle")}</CardTitle><CardDescription>{t("portfolioDescription")}</CardDescription></CardHeader><CardContent>
      <form className="space-y-3" onSubmit={createPortfolio}><div className="grid gap-3 md:grid-cols-2"><Field label={t("portfolioReference")}><Input required disabled={demo} value={portfolioReference} onChange={(event) => setPortfolioReference(event.target.value)} /></Field><Field label={t("methodologyNotes")}><Textarea required disabled={demo} value={methodologyNotes} onChange={(event) => setMethodologyNotes(event.target.value)} /></Field></div>
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border p-3">{assessments.map((item) => <label key={item.id} className="flex items-center gap-3 text-sm"><input disabled={demo} type="checkbox" checked={selectedIds.includes(item.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span>{item.facilityName || item.facilityRevisionId} · {item.hazardType} · {item.scenarioReference} · {item.businessDependencyPercent}%</span></label>)}</div>
        <Button disabled={demo || saving || selectedIds.length < 2}>{t("createPortfolio")}</Button></form>
      <div className="mt-5 grid gap-3 md:grid-cols-2">{portfolios.map((item) => <div key={item.id} className="rounded-xl border p-4 text-sm"><div className="flex items-center justify-between gap-2"><b>{item.portfolioReference}</b><Badge variant="outline">{item.prioritySummary.reviewStatus}</Badge></div><p className="mt-1">{item.scenarioReference} · {item.facilityCount} {t("facilityCount")}</p><p className="mt-1">{t("high")}: {item.prioritySummary.dependencyPercentByPriority.high}% · {t("medium")}: {item.prioritySummary.dependencyPercentByPriority.medium}% · {t("low")}: {item.prioritySummary.dependencyPercentByPriority.low}%</p><p className="text-xs text-muted-foreground">{t("incompleteCoverage")}: {item.prioritySummary.incompleteHazardCoverageFacilities}</p><Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void inspectPortfolio(item.id)}>{t("inspectPortfolio")}</Button></div>)}</div>
      {portfolioDetail && <div className="mt-4 rounded-xl border p-4"><h3 className="font-semibold">{portfolioDetail.portfolioReference} · {t("portfolioMembers")}</h3><div className="mt-3 space-y-2">{portfolioDetail.assessments.map((item) => <div key={item.id} className="rounded-lg border p-3 text-sm"><b>{item.facilityName || item.facilityRevisionId} · {item.hazardType} · {item.priorityBand}</b><p>{item.hazardMetric}: {item.metricValue} {item.metricUnit} · {item.businessDependencyPercent}%</p><p className="text-muted-foreground">{item.uncertaintyNotes}</p><p className="text-xs text-muted-foreground">{item.sourceKind} · {item.modelName || "—"} · {item.scenarioName || "—"} · {item.spatialResolution} · {item.gridReference}</p></div>)}</div></div>}
    </CardContent></Card>
  </main>;
}
