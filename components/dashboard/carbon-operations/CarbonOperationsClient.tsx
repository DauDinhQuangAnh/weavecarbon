"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Building2, CheckCircle2, CircleDashed, Database, GitBranch, Loader2, Plus, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/apiClient";
import { INDUSTRIAL_CORE_DEMO_REGISTRY, industrialCoreApi, type CapabilityStatus, type IndustrialActivity,
  type DynamicAllocationRule, type DynamicAllocationRun, type IndustrialCapabilityRegistry, type IndustrialFacility,
  type IndustrialMeasurementPoint, type IndustrialProcess } from "@/lib/industrialCoreApi";

const statusStyles: Record<CapabilityStatus, string> = {
  implemented: "border-emerald-200 bg-emerald-50 text-emerald-800",
  partial: "border-amber-200 bg-amber-50 text-amber-800",
  planned: "border-slate-200 bg-slate-50 text-slate-700"
};

const emptyForm = { facilityReference: "", name: "", countryCode: "VN", timezone: "Asia/Ho_Chi_Minh", boundaryNotes: "" };

export default function CarbonOperationsClient({ demo = false }: { demo?: boolean }) {
  const t = useTranslations("carbonOperations");
  const [registry, setRegistry] = useState<IndustrialCapabilityRegistry | null>(null);
  const [facilities, setFacilities] = useState<IndustrialFacility[]>([]);
  const [processes, setProcesses] = useState<IndustrialProcess[]>([]);
  const [measurementPoints, setMeasurementPoints] = useState<IndustrialMeasurementPoint[]>([]);
  const [activities, setActivities] = useState<IndustrialActivity[]>([]);
  const [allocationRules, setAllocationRules] = useState<DynamicAllocationRule[]>([]);
  const [allocationRuns, setAllocationRuns] = useState<DynamicAllocationRun[]>([]);
  const [lineage, setLineage] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [processForm, setProcessForm] = useState({ facilityRevisionId: "", processReference: "", name: "", processType: "" });
  const [pointForm, setPointForm] = useState({ facilityRevisionId: "", processRevisionId: "", measurementPointReference: "", measurementType: "electricity", canonicalUnit: "kWh", sourceType: "meter" as const });
  const [allocationRuleForm, setAllocationRuleForm] = useState({ facilityRevisionId: "", allocationReference: "", allocationMethod: "output" as const,
    driverUnit: "unit", methodologyReference: "", methodologyVersion: "1.0", rationale: "", approvalStatus: "draft" as "draft" | "approved", evidenceDocumentId: "" });
  const [allocationRunForm, setAllocationRunForm] = useState({ ruleRevisionId: "", sourceActivityId: "" });
  const [allocationDrivers, setAllocationDrivers] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    if (demo) {
      setRegistry(INDUSTRIAL_CORE_DEMO_REGISTRY); setFacilities([]); setProcesses([]); setMeasurementPoints([]); setActivities([]); setAllocationRules([]); setAllocationRuns([]); setLoading(false); return;
    }
    try {
      const [capabilityData, facilityData, processData, pointData, activityData, ruleData, runData] = await Promise.all([
        industrialCoreApi.capabilities(), industrialCoreApi.facilities(), industrialCoreApi.processes(),
        industrialCoreApi.measurementPoints(), industrialCoreApi.activities(), industrialCoreApi.allocationRules(), industrialCoreApi.allocationRuns()
      ]);
      setRegistry(capabilityData); setFacilities(facilityData); setProcesses(processData);
      setMeasurementPoints(pointData); setActivities(activityData); setAllocationRules(ruleData); setAllocationRuns(runData);
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("loadError"));
    } finally { setLoading(false); }
  }, [demo, t]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => registry?.layers.reduce<Record<CapabilityStatus, number>>((sum, item) => {
    sum[item.status] += 1; return sum;
  }, { implemented: 0, partial: 0, planned: 0 }) ?? { implemented: 0, partial: 0, planned: 0 }, [registry]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (demo || saving) return;
    setSaving(true); setError(null);
    try {
      const created = await industrialCoreApi.createFacility({ ...form, countryCode: form.countryCode.toUpperCase(), lifecycleStatus: "active" });
      setFacilities((current) => [created, ...current]); setForm(emptyForm);
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("saveError"));
    } finally { setSaving(false); }
  };

  const submitProcess = async (event: FormEvent) => {
    event.preventDefault(); if (demo || saving) return; setSaving(true); setError(null);
    try {
      const created = await industrialCoreApi.createProcess({ ...processForm, lifecycleStatus: "active" });
      setProcesses((current) => [created, ...current]);
      setProcessForm({ facilityRevisionId: "", processReference: "", name: "", processType: "" });
    } catch (cause) { setError(isApiError(cause) ? cause.message : t("saveError")); } finally { setSaving(false); }
  };

  const submitPoint = async (event: FormEvent) => {
    event.preventDefault(); if (demo || saving) return; setSaving(true); setError(null);
    try {
      const payload = { ...pointForm, processRevisionId: pointForm.processRevisionId || undefined };
      const created = await industrialCoreApi.createMeasurementPoint(payload);
      setMeasurementPoints((current) => [created, ...current]);
      setPointForm({ facilityRevisionId: "", processRevisionId: "", measurementPointReference: "", measurementType: "electricity", canonicalUnit: "kWh", sourceType: "meter" });
    } catch (cause) { setError(isApiError(cause) ? cause.message : t("saveError")); } finally { setSaving(false); }
  };

  const inspectLineage = async (activityId: string) => {
    try { setLineage(await industrialCoreApi.activityLineage(activityId)); }
    catch (cause) { setError(isApiError(cause) ? cause.message : t("loadError")); }
  };

  const selectedAllocationRule = allocationRules.find((item) => item.id === allocationRunForm.ruleRevisionId);
  const allocationTargets = selectedAllocationRule?.targetLevel === "process"
    ? processes.filter((item) => item.facilityRevisionId === selectedAllocationRule.facilityRevisionId) : [];
  const allocationSources = selectedAllocationRule
    ? activities.filter((item) => item.facilityRevisionId === selectedAllocationRule.facilityRevisionId) : [];

  const submitAllocationRule = async (event: FormEvent) => {
    event.preventDefault(); if (demo || saving) return; setSaving(true); setError(null);
    try {
      const created = await industrialCoreApi.createAllocationRule({ ...allocationRuleForm,
        sourceLevel: "facility", targetLevel: "process",
        evidenceDocumentId: allocationRuleForm.evidenceDocumentId || undefined });
      setAllocationRules((current) => [created, ...current]);
      setAllocationRuleForm({ facilityRevisionId: "", allocationReference: "", allocationMethod: "output", driverUnit: "unit",
        methodologyReference: "", methodologyVersion: "1.0", rationale: "", approvalStatus: "draft", evidenceDocumentId: "" });
    } catch (cause) { setError(isApiError(cause) ? cause.message : t("allocationSaveError")); } finally { setSaving(false); }
  };

  const submitAllocationRun = async (event: FormEvent) => {
    event.preventDefault(); if (demo || saving) return;
    const targets = allocationTargets.map((target) => ({ targetEntityId: target.id, driverValue: Number(allocationDrivers[target.id]) }))
      .filter((target) => Number.isFinite(target.driverValue) && target.driverValue > 0);
    if (!targets.length) { setError(t("allocationTargetRequired")); return; }
    setSaving(true); setError(null);
    try {
      const created = await industrialCoreApi.createAllocationRun({ ruleRevisionId: allocationRunForm.ruleRevisionId,
        sourceActivityId: allocationRunForm.sourceActivityId, targets });
      setAllocationRuns((current) => [created, ...current]); setAllocationDrivers({});
    } catch (cause) { setError(isApiError(cause) ? cause.message : t("allocationSaveError")); } finally { setSaving(false); }
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <section className="overflow-hidden rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-950 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200"><Database className="h-4 w-4" />{t("eyebrow")}</div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t("title")}</h1>
            <p className="mt-3 text-sm leading-6 text-emerald-50/90 md:text-base">{t("description")}</p>
          </div>
          {registry && <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur"><p className="text-xs text-emerald-100">{t("version")}</p><p className="mt-1 font-mono text-sm font-semibold">{registry.platformVersion}</p></div>}
        </div>
      </section>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {loading ? <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-emerald-700" /><span className="sr-only">{t("loading")}</span></div> : registry && <>
        <section className="grid gap-4 md:grid-cols-3">
          {(["implemented", "partial", "planned"] as CapabilityStatus[]).map((status) => <Card key={status} className="border-slate-200"><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">{t(`status.${status}`)}</CardTitle><Badge variant="outline" className={statusStyles[status]}>{counts[status]}</Badge></div></CardHeader><CardContent><p className="text-sm text-muted-foreground">{t(`statusDescription.${status}`)}</p></CardContent></Card>)}
        </section>

        <Card className="border-amber-200 bg-amber-50/50"><CardContent className="flex gap-3 p-5"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><p className="font-semibold text-amber-950">{t("truthTitle")}</p><p className="mt-1 text-sm leading-6 text-amber-900">{registry.truthBoundary}</p></div></CardContent></Card>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <Card><CardHeader><CardTitle>{t("layersTitle")}</CardTitle><CardDescription>{t("layersDescription")}</CardDescription></CardHeader><CardContent className="space-y-3">{registry.layers.map((layer) => <div key={layer.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2">{layer.status === "implemented" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <CircleDashed className="h-4 w-4 text-amber-600" />}<p className="font-medium">{layer.label}</p></div><Badge variant="outline" className={statusStyles[layer.status]}>{t(`status.${layer.status}`)}</Badge></div><p className="mt-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">{t("nextGate")}:</span> {layer.nextGate}</p></div>)}</CardContent></Card>

          <Card><CardHeader><CardTitle>{t("entitiesTitle")}</CardTitle><CardDescription>{t("entitiesDescription")}</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">{registry.entities.map((entity) => <Badge key={entity.id} variant="outline" className={statusStyles[entity.status]}>{entity.id}</Badge>)}</CardContent></Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />{t("facilityFormTitle")}</CardTitle><CardDescription>{demo ? t("demoReadOnly") : t("facilityFormDescription")}</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={submit}><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="facility-reference">{t("fields.reference")}</Label><Input id="facility-reference" required maxLength={120} disabled={demo || saving} value={form.facilityReference} onChange={(e) => setForm({ ...form, facilityReference: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="facility-country">{t("fields.country")}</Label><Input id="facility-country" required maxLength={2} disabled={demo || saving} value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} /></div></div><div className="space-y-2"><Label htmlFor="facility-name">{t("fields.name")}</Label><Input id="facility-name" required maxLength={240} disabled={demo || saving} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="facility-boundary">{t("fields.boundary")}</Label><Textarea id="facility-boundary" disabled={demo || saving} value={form.boundaryNotes} onChange={(e) => setForm({ ...form, boundaryNotes: e.target.value })} /></div><Button type="submit" disabled={demo || saving} className="w-full">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("createFacility")}</Button></form></CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />{t("facilitiesTitle")}</CardTitle><CardDescription>{t("facilitiesDescription", { count: facilities.length })}</CardDescription></CardHeader><CardContent>{facilities.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><Activity className="mx-auto mb-3 h-6 w-6" />{t("emptyFacilities")}</div> : <div className="space-y-3">{facilities.map((facility) => <div key={facility.id} className="flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{facility.name}</p><p className="text-sm text-muted-foreground">{facility.facilityReference} · {facility.countryCode} · rev {facility.revision}</p></div><Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-800">{facility.lifecycleStatus}</Badge></div>)}</div>}</CardContent></Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>{t("processFormTitle")}</CardTitle><CardDescription>{t("processFormDescription")}</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={submitProcess}><Label htmlFor="process-facility">{t("fields.facility")}</Label><select id="process-facility" required disabled={demo || saving} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={processForm.facilityRevisionId} onChange={(e) => setProcessForm({ ...processForm, facilityRevisionId: e.target.value })}><option value="">{t("selectFacility")}</option>{facilities.map((item) => <option key={item.id} value={item.id}>{item.name} · rev {item.revision}</option>)}</select><div className="grid gap-3 sm:grid-cols-2"><Input required placeholder={t("fields.processReference")} disabled={demo || saving} value={processForm.processReference} onChange={(e) => setProcessForm({ ...processForm, processReference: e.target.value })} /><Input required placeholder={t("fields.processType")} disabled={demo || saving} value={processForm.processType} onChange={(e) => setProcessForm({ ...processForm, processType: e.target.value })} /></div><Input required placeholder={t("fields.processName")} disabled={demo || saving} value={processForm.name} onChange={(e) => setProcessForm({ ...processForm, name: e.target.value })} /><Button disabled={demo || saving} className="w-full">{t("createProcess")}</Button></form><div className="mt-4 space-y-2">{processes.map((item) => <div key={item.id} className="rounded-lg border p-3 text-sm"><span className="font-semibold">{item.name}</span><span className="text-muted-foreground"> · {item.processReference} · {item.processType}</span></div>)}</div></CardContent></Card>

          <Card><CardHeader><CardTitle>{t("pointFormTitle")}</CardTitle><CardDescription>{t("pointFormDescription")}</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={submitPoint}><select required disabled={demo || saving} aria-label={t("fields.facility")} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={pointForm.facilityRevisionId} onChange={(e) => setPointForm({ ...pointForm, facilityRevisionId: e.target.value, processRevisionId: "" })}><option value="">{t("selectFacility")}</option>{facilities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select disabled={demo || saving} aria-label={t("fields.processName")} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={pointForm.processRevisionId} onChange={(e) => setPointForm({ ...pointForm, processRevisionId: e.target.value })}><option value="">{t("optionalProcess")}</option>{processes.filter((item) => item.facilityRevisionId === pointForm.facilityRevisionId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Input required placeholder={t("fields.pointReference")} disabled={demo || saving} value={pointForm.measurementPointReference} onChange={(e) => setPointForm({ ...pointForm, measurementPointReference: e.target.value })} /><div className="grid gap-3 sm:grid-cols-2"><Input required placeholder={t("fields.measurementType")} disabled={demo || saving} value={pointForm.measurementType} onChange={(e) => setPointForm({ ...pointForm, measurementType: e.target.value })} /><Input required placeholder={t("fields.unit")} disabled={demo || saving} value={pointForm.canonicalUnit} onChange={(e) => setPointForm({ ...pointForm, canonicalUnit: e.target.value })} /></div><Button disabled={demo || saving} className="w-full">{t("createPoint")}</Button></form><div className="mt-4 space-y-2">{measurementPoints.map((item) => <div key={item.id} className="rounded-lg border p-3 text-sm"><span className="font-semibold">{item.measurementPointReference}</span><span className="text-muted-foreground"> · {item.measurementType} · {item.canonicalUnit}</span></div>)}</div></CardContent></Card>
        </section>

        <Card><CardHeader><CardTitle>{t("activityLedgerTitle")}</CardTitle><CardDescription>{t("activityLedgerDescription", { count: activities.length })}</CardDescription></CardHeader><CardContent><div className="space-y-2">{activities.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("emptyActivities")}</p> : activities.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><p className="font-semibold">{item.activityReference}</p><p className="text-sm text-muted-foreground">{item.quantity} {item.canonicalUnit} · {item.dataQualityLevel}</p></div><Button type="button" variant="outline" size="sm" onClick={() => void inspectLineage(item.id)}>{t("viewLineage")}</Button></div>)}</div>{lineage !== null && <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-emerald-100">{JSON.stringify(lineage, null, 2)}</pre>}</CardContent></Card>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><GitBranch className="h-5 w-5" />{t("allocationRuleTitle")}</CardTitle><CardDescription>{t("allocationRuleDescription")}</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={submitAllocationRule}><select required disabled={demo || saving} aria-label={t("fields.facility")} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={allocationRuleForm.facilityRevisionId} onChange={(e) => setAllocationRuleForm({ ...allocationRuleForm, facilityRevisionId: e.target.value })}><option value="">{t("selectFacility")}</option>{facilities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Input required placeholder={t("allocationReference")} disabled={demo || saving} value={allocationRuleForm.allocationReference} onChange={(e) => setAllocationRuleForm({ ...allocationRuleForm, allocationReference: e.target.value })} /><div className="grid gap-3 sm:grid-cols-2"><select disabled={demo || saving} aria-label={t("allocationMethod")} className="h-10 rounded-md border bg-background px-3 text-sm" value={allocationRuleForm.allocationMethod} onChange={(e) => setAllocationRuleForm({ ...allocationRuleForm, allocationMethod: e.target.value as typeof allocationRuleForm.allocationMethod })}><option value="output">{t("allocationMethods.output")}</option><option value="mass">{t("allocationMethods.mass")}</option><option value="energy">{t("allocationMethods.energy")}</option><option value="machine_hour">{t("allocationMethods.machineHour")}</option><option value="economic">{t("allocationMethods.economic")}</option><option value="custom_driver">{t("allocationMethods.custom")}</option></select><Input required placeholder={t("driverUnit")} disabled={demo || saving} value={allocationRuleForm.driverUnit} onChange={(e) => setAllocationRuleForm({ ...allocationRuleForm, driverUnit: e.target.value })} /></div><div className="grid gap-3 sm:grid-cols-2"><Input required placeholder={t("methodologyReference")} disabled={demo || saving} value={allocationRuleForm.methodologyReference} onChange={(e) => setAllocationRuleForm({ ...allocationRuleForm, methodologyReference: e.target.value })} /><Input required placeholder={t("methodologyVersion")} disabled={demo || saving} value={allocationRuleForm.methodologyVersion} onChange={(e) => setAllocationRuleForm({ ...allocationRuleForm, methodologyVersion: e.target.value })} /></div><Textarea required placeholder={t("allocationRationale")} disabled={demo || saving} value={allocationRuleForm.rationale} onChange={(e) => setAllocationRuleForm({ ...allocationRuleForm, rationale: e.target.value })} /><div className="grid gap-3 sm:grid-cols-2"><select disabled={demo || saving} aria-label={t("approvalStatus")} className="h-10 rounded-md border bg-background px-3 text-sm" value={allocationRuleForm.approvalStatus} onChange={(e) => setAllocationRuleForm({ ...allocationRuleForm, approvalStatus: e.target.value as "draft" | "approved" })}><option value="draft">{t("draft")}</option><option value="approved">{t("approved")}</option></select><Input placeholder={t("approvalEvidence")} disabled={demo || saving} value={allocationRuleForm.evidenceDocumentId} onChange={(e) => setAllocationRuleForm({ ...allocationRuleForm, evidenceDocumentId: e.target.value })} /></div><Button disabled={demo || saving} className="w-full">{t("createAllocationRule")}</Button></form><div className="mt-4 space-y-2">{allocationRules.map((item) => <div key={item.id} className="rounded-lg border p-3 text-sm"><div className="flex items-center justify-between gap-2"><span className="font-semibold">{item.allocationReference} · rev {item.revision}</span><Badge variant="outline">{item.approvalStatus}</Badge></div><p className="mt-1 text-muted-foreground">{item.sourceLevel} → {item.targetLevel} · {item.allocationMethod} · {item.driverUnit}</p></div>)}</div></CardContent></Card>

          <Card><CardHeader><CardTitle>{t("allocationRunTitle")}</CardTitle><CardDescription>{t("allocationRunDescription")}</CardDescription></CardHeader><CardContent><form className="space-y-3" onSubmit={submitAllocationRun}><select required disabled={demo || saving} aria-label={t("allocationRuleTitle")} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={allocationRunForm.ruleRevisionId} onChange={(e) => { setAllocationRunForm({ ruleRevisionId: e.target.value, sourceActivityId: "" }); setAllocationDrivers({}); }}><option value="">{t("selectAllocationRule")}</option>{allocationRules.filter((item) => item.approvalStatus === "approved" && item.targetLevel === "process").map((item) => <option key={item.id} value={item.id}>{item.allocationReference} · rev {item.revision}</option>)}</select><select required disabled={demo || saving || !selectedAllocationRule} aria-label={t("sourceActivity")} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={allocationRunForm.sourceActivityId} onChange={(e) => setAllocationRunForm({ ...allocationRunForm, sourceActivityId: e.target.value })}><option value="">{t("selectSourceActivity")}</option>{allocationSources.map((item) => <option key={item.id} value={item.id}>{item.activityReference} · {item.quantity} {item.canonicalUnit}</option>)}</select><div className="space-y-2"><p className="text-sm font-medium">{t("targetDrivers")}</p>{allocationTargets.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t("noAllocationTargets")}</p> : allocationTargets.map((target) => <div key={target.id} className="grid grid-cols-[1fr_9rem] items-center gap-3"><Label htmlFor={`driver-${target.id}`}>{target.name}</Label><Input id={`driver-${target.id}`} type="number" min="0" step="any" disabled={demo || saving} value={allocationDrivers[target.id] || ""} onChange={(e) => setAllocationDrivers({ ...allocationDrivers, [target.id]: e.target.value })} /></div>)}</div><Button disabled={demo || saving || !selectedAllocationRule || !allocationRunForm.sourceActivityId} className="w-full">{t("createAllocationRun")}</Button></form><div className="mt-4 space-y-2">{allocationRuns.map((item) => <div key={item.id} className="rounded-lg border p-3 text-sm"><div className="flex items-center justify-between gap-2"><span className="font-semibold">{item.allocationReference} · {item.sourceQuantity} {item.sourceUnit}</span><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">{item.reconciliationStatus}</Badge></div><p className="mt-1 text-muted-foreground">{item.lines.length} {t("allocationLines")} · Δ {item.reconciliationDifference}</p></div>)}</div></CardContent></Card>
        </section>
      </>}
    </main>
  );
}
