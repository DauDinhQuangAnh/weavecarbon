"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { Cpu, Loader2, RadioTower } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/apiClient";
import { industrialCoreApi, type IndustrialMeasurementPoint } from "@/lib/industrialCoreApi";
import { listEvidenceV2, type EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";
import { weavenodeApi, type MeterHierarchy, type MeterReconciliation, type ReleaseKey, type WeavenodeDevice, type WeavenodeHealth, type WeavenodeUpdate } from "@/lib/weavenodeApi";

const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-1 text-sm"><span className="font-medium">{label}</span>{children}</label>;
}
const evidenceReady = (item: EvidenceDocumentV2) => ["locked", "third_party_verified"].includes(item.status) &&
  /^[a-f0-9]{64}$/i.test(item.checksumSha256 || "") && item.fileSizeBytes > 0;
const initialHierarchy = { hierarchyReference: "", facilityRevisionId: "", parentMeasurementPointRevisionId: "",
  childMeasurementPointRevisionId: "", relationKind: "sub_meter", tolerancePercent: "2", effectiveFrom: "", evidenceDocumentId: "" };
const initialReconciliation = { parentMeasurementPointRevisionId: "", periodStart: "", periodEnd: "" };
const initialUpdate = { deviceId: "", updateReference: "", updateKind: "firmware", targetVersion: "", rolloutStage: "staged",
  artifactSha256: "", signingKeyId: "", manifest: "{}", signatureBase64: "", rollbackOfUpdateId: "", reason: "" };

export default function WeavenodeClient({ demo = false }: { demo?: boolean }) {
  const t = useTranslations("weavenode");
  const [devices, setDevices] = useState<WeavenodeDevice[]>([]);
  const [points, setPoints] = useState<IndustrialMeasurementPoint[]>([]);
  const [evidence, setEvidence] = useState<EvidenceDocumentV2[]>([]);
  const [hierarchies, setHierarchies] = useState<MeterHierarchy[]>([]);
  const [reconciliations, setReconciliations] = useState<MeterReconciliation[]>([]);
  const [releaseKeys, setReleaseKeys] = useState<ReleaseKey[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [health, setHealth] = useState<WeavenodeHealth[]>([]);
  const [updates, setUpdates] = useState<WeavenodeUpdate[]>([]);
  const [hierarchyForm, setHierarchyForm] = useState(initialHierarchy);
  const [reconciliationForm, setReconciliationForm] = useState(initialReconciliation);
  const [keyForm, setKeyForm] = useState({ keyReference: "", publicKeyPem: "" });
  const [updateForm, setUpdateForm] = useState(initialUpdate);
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    try {
      const [deviceRows, pointRows, evidenceResponse, hierarchyRows, reconciliationRows, keyRows] = await Promise.all([
        weavenodeApi.devices(), industrialCoreApi.measurementPoints(), listEvidenceV2(), weavenodeApi.hierarchies(),
        weavenodeApi.reconciliations(), weavenodeApi.releaseKeys().catch(() => [] as ReleaseKey[])
      ]);
      setDevices(deviceRows); setPoints(pointRows); setEvidence(evidenceResponse.items.filter(evidenceReady));
      setHierarchies(hierarchyRows); setReconciliations(reconciliationRows); setReleaseKeys(keyRows); setError(null);
    } catch (cause) { setError(isApiError(cause) ? cause.message : t("loadError")); }
    finally { setLoading(false); }
  }, [demo, t]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!selectedDevice || demo) { setHealth([]); setUpdates([]); return; }
    void Promise.all([weavenodeApi.health(selectedDevice), weavenodeApi.updates(selectedDevice).catch(() => [] as WeavenodeUpdate[])])
      .then(([healthRows, updateRows]) => { setHealth(healthRows); setUpdates(updateRows); })
      .catch((cause) => setError(isApiError(cause) ? cause.message : t("loadError")));
  }, [demo, selectedDevice, t]);
  const run = async (action: () => Promise<unknown>) => {
    if (demo || saving) return;
    setSaving(true); setError(null);
    try { await action(); await load(); }
    catch (cause) { setError(isApiError(cause) ? cause.message : cause instanceof Error ? cause.message : t("saveError")); }
    finally { setSaving(false); }
  };
  const saveHierarchy = (event: FormEvent) => { event.preventDefault(); void run(async () => {
    await weavenodeApi.createHierarchy({ ...hierarchyForm, tolerancePercent: Number(hierarchyForm.tolerancePercent),
      effectiveFrom: new Date(hierarchyForm.effectiveFrom).toISOString() }); setHierarchyForm(initialHierarchy);
  }); };
  const saveReconciliation = (event: FormEvent) => { event.preventDefault(); void run(async () => {
    await weavenodeApi.reconcile({ parentMeasurementPointRevisionId: reconciliationForm.parentMeasurementPointRevisionId,
      periodStart: new Date(reconciliationForm.periodStart).toISOString(), periodEnd: new Date(reconciliationForm.periodEnd).toISOString() });
    setReconciliationForm(initialReconciliation);
  }); };
  const saveKey = (event: FormEvent) => { event.preventDefault(); void run(async () => {
    await weavenodeApi.createReleaseKey(keyForm); setKeyForm({ keyReference: "", publicKeyPem: "" });
  }); };
  const saveUpdate = (event: FormEvent) => { event.preventDefault(); void run(async () => {
    const manifest = JSON.parse(updateForm.manifest) as Record<string, unknown>;
    await weavenodeApi.createUpdate(updateForm.deviceId, { ...updateForm, deviceId: undefined, manifest,
      rollbackOfUpdateId: updateForm.rollbackOfUpdateId || undefined });
    setSelectedDevice(updateForm.deviceId); setUpdateForm(initialUpdate);
  }); };
  const pointLabel = (id: string) => points.find((point) => point.id === id)?.measurementPointReference || id;

  if (loading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  return <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
    <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-cyan-950 p-7 text-white">
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[.15em] text-emerald-200"><RadioTower className="h-5 w-5" />G2-10 · WeaveNode</p>
      <h1 className="mt-3 text-3xl font-bold">{t("title")}</h1><p className="mt-3 max-w-3xl text-slate-200">{t("description")}</p>
    </section>
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">{t("boundary")}</div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
    {demo && <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-900">{t("demoReadOnly")}</div>}

    <Card><CardHeader><CardTitle>{t("fleet")}</CardTitle><CardDescription>{t("fleetDescription")}</CardDescription></CardHeader><CardContent>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{devices.map((device) => <button type="button" key={device.id} onClick={() => setSelectedDevice(device.id)} className="rounded-xl border p-4 text-left hover:border-primary">
        <div className="flex items-center justify-between gap-2"><b className="flex items-center gap-2"><Cpu className="h-4 w-4" />{device.deviceReference}</b><Badge variant="outline">{device.revoked ? t("revoked") : device.protocolVersion.endsWith("v2") ? "v2" : "v1"}</Badge></div>
        <p className="mt-2 text-sm">{device.measurementPointReference} · {device.canonicalUnit}</p>
        <p className="text-xs text-muted-foreground">{t("accepted")}: {device.lastAcceptedSequence} · {t("buffered")}: {device.bufferedCount}</p>
      </button>)}</div>
      {!devices.length && <p className="text-sm text-muted-foreground">{t("noDevices")}</p>}
      {selectedDevice && <div className="mt-5 grid gap-4 lg:grid-cols-2"><div><h3 className="font-semibold">{t("health")}</h3><div className="mt-2 space-y-2">{health.slice(0, 10).map((item) => <div key={item.id} className="rounded-lg border p-3 text-sm"><div className="flex justify-between"><b>{item.firmwareVersion} / {item.configVersion}</b><Badge variant="outline">{item.sensorStatus}</Badge></div><p>{t("drift")}: {item.clockDriftSeconds}s · {t("buffered")}: {item.bufferDepth}</p><p className="text-xs text-muted-foreground">{item.gatewayReceivedAt}</p></div>)}{!health.length && <p className="text-sm text-muted-foreground">{t("noHealth")}</p>}</div></div>
        <div><h3 className="font-semibold">{t("updateHistory")}</h3><div className="mt-2 space-y-2">{updates.slice(0, 10).map((item) => <div key={item.id} className="rounded-lg border p-3 text-sm"><div className="flex justify-between"><b>{item.updateReference} · r{item.revision}</b><Badge variant="outline">{item.rolloutStage}</Badge></div><p>{item.updateKind} → {item.targetVersion}</p><p className="truncate text-xs text-muted-foreground">{item.manifestSha256}</p></div>)}{!updates.length && <p className="text-sm text-muted-foreground">{t("noUpdates")}</p>}</div></div></div>}
    </CardContent></Card>

    <div className="grid gap-6 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>{t("hierarchy")}</CardTitle><CardDescription>{t("hierarchyDescription")}</CardDescription></CardHeader><CardContent>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={saveHierarchy}>
          <Field label={t("reference")}><Input required disabled={demo} value={hierarchyForm.hierarchyReference} onChange={(e) => setHierarchyForm({ ...hierarchyForm, hierarchyReference: e.target.value })} /></Field>
          <Field label={t("relation")}><select className={selectClass} disabled={demo} value={hierarchyForm.relationKind} onChange={(e) => setHierarchyForm({ ...hierarchyForm, relationKind: e.target.value })}><option value="sub_meter">sub_meter</option><option value="line_meter">line_meter</option><option value="machine_meter">machine_meter</option></select></Field>
          <Field label={t("parentMeter")}><select required className={selectClass} disabled={demo} value={hierarchyForm.parentMeasurementPointRevisionId} onChange={(e) => { const point = points.find((item) => item.id === e.target.value); setHierarchyForm({ ...hierarchyForm, parentMeasurementPointRevisionId: e.target.value, facilityRevisionId: point?.facilityRevisionId || "" }); }}><option value="">—</option>{points.map((point) => <option key={point.id} value={point.id}>{point.measurementPointReference} · {point.canonicalUnit}</option>)}</select></Field>
          <Field label={t("childMeter")}><select required className={selectClass} disabled={demo} value={hierarchyForm.childMeasurementPointRevisionId} onChange={(e) => setHierarchyForm({ ...hierarchyForm, childMeasurementPointRevisionId: e.target.value })}><option value="">—</option>{points.filter((point) => point.facilityRevisionId === hierarchyForm.facilityRevisionId && point.id !== hierarchyForm.parentMeasurementPointRevisionId).map((point) => <option key={point.id} value={point.id}>{point.measurementPointReference} · {point.canonicalUnit}</option>)}</select></Field>
          <Field label={t("tolerance")}><Input required disabled={demo} type="number" min="0" max="100" step="0.0001" value={hierarchyForm.tolerancePercent} onChange={(e) => setHierarchyForm({ ...hierarchyForm, tolerancePercent: e.target.value })} /></Field>
          <Field label={t("effectiveFrom")}><Input required disabled={demo} type="datetime-local" value={hierarchyForm.effectiveFrom} onChange={(e) => setHierarchyForm({ ...hierarchyForm, effectiveFrom: e.target.value })} /></Field>
          <Field label={t("evidence")}><select required className={selectClass} disabled={demo} value={hierarchyForm.evidenceDocumentId} onChange={(e) => setHierarchyForm({ ...hierarchyForm, evidenceDocumentId: e.target.value })}><option value="">—</option>{evidence.map((item) => <option key={item.id} value={item.id}>{item.documentName}</option>)}</select></Field>
          <Button disabled={demo || saving} className="md:col-span-2">{t("saveHierarchy")}</Button>
        </form>
        <div className="mt-4 space-y-2">{hierarchies.slice(0, 20).map((item) => <div key={item.id} className="rounded-lg border p-3 text-sm"><b>{item.hierarchyReference} · r{item.revision}</b><p>{item.parentReference || pointLabel(item.parentMeasurementPointRevisionId)} → {item.childReference || pointLabel(item.childMeasurementPointRevisionId)} · ±{item.tolerancePercent}%</p></div>)}</div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>{t("reconciliation")}</CardTitle><CardDescription>{t("reconciliationDescription")}</CardDescription></CardHeader><CardContent>
        <form className="grid gap-3" onSubmit={saveReconciliation}>
          <Field label={t("parentMeter")}><select required className={selectClass} disabled={demo} value={reconciliationForm.parentMeasurementPointRevisionId} onChange={(e) => setReconciliationForm({ ...reconciliationForm, parentMeasurementPointRevisionId: e.target.value })}><option value="">—</option>{[...new Set(hierarchies.map((item) => item.parentMeasurementPointRevisionId))].map((id) => <option key={id} value={id}>{pointLabel(id)}</option>)}</select></Field>
          <div className="grid gap-3 md:grid-cols-2"><Field label={t("periodStart")}><Input required disabled={demo} type="datetime-local" value={reconciliationForm.periodStart} onChange={(e) => setReconciliationForm({ ...reconciliationForm, periodStart: e.target.value })} /></Field><Field label={t("periodEnd")}><Input required disabled={demo} type="datetime-local" value={reconciliationForm.periodEnd} onChange={(e) => setReconciliationForm({ ...reconciliationForm, periodEnd: e.target.value })} /></Field></div>
          <Button disabled={demo || saving}>{t("runReconciliation")}</Button>
        </form>
        <div className="mt-4 space-y-2">{reconciliations.slice(0, 20).map((item) => <div key={item.id} className="rounded-lg border p-3 text-sm"><div className="flex justify-between"><b>{pointLabel(item.parentMeasurementPointRevisionId)}</b><Badge variant="outline">{item.status}</Badge></div><p>{item.parentQuantity} − {item.childQuantity} = {item.differenceQuantity} {item.canonicalUnit}</p><p className="text-xs text-muted-foreground">{item.differencePercent ?? "—"}% / ±{item.tolerancePercent}%</p></div>)}</div>
      </CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>{t("signedUpdates")}</CardTitle><CardDescription>{t("signedUpdatesDescription")}</CardDescription></CardHeader><CardContent className="space-y-6">
      <form className="grid gap-3 md:grid-cols-2" onSubmit={saveKey}><Field label={t("keyReference")}><Input required disabled={demo} value={keyForm.keyReference} onChange={(e) => setKeyForm({ ...keyForm, keyReference: e.target.value })} /></Field><Field label={t("publicKey")}><Textarea required disabled={demo} value={keyForm.publicKeyPem} onChange={(e) => setKeyForm({ ...keyForm, publicKeyPem: e.target.value })} /></Field><Button disabled={demo || saving} className="md:col-span-2">{t("registerKey")}</Button></form>
      <div className="flex flex-wrap gap-2">{releaseKeys.map((key) => <Badge key={key.id} variant="outline">{key.keyReference}{key.revoked ? ` · ${t("revoked")}` : ""}</Badge>)}</div>
      <form className="grid gap-3 md:grid-cols-3" onSubmit={saveUpdate}>
        <Field label={t("device")}><select required disabled={demo} className={selectClass} value={updateForm.deviceId} onChange={(e) => setUpdateForm({ ...updateForm, deviceId: e.target.value })}><option value="">—</option>{devices.filter((item) => !item.revoked).map((item) => <option key={item.id} value={item.id}>{item.deviceReference}</option>)}</select></Field>
        <Field label={t("reference")}><Input required disabled={demo} value={updateForm.updateReference} onChange={(e) => setUpdateForm({ ...updateForm, updateReference: e.target.value })} /></Field>
        <Field label={t("targetVersion")}><Input required disabled={demo} value={updateForm.targetVersion} onChange={(e) => setUpdateForm({ ...updateForm, targetVersion: e.target.value })} /></Field>
        <Field label={t("updateKind")}><select disabled={demo} className={selectClass} value={updateForm.updateKind} onChange={(e) => setUpdateForm({ ...updateForm, updateKind: e.target.value })}><option value="firmware">firmware</option><option value="configuration">configuration</option></select></Field>
        <Field label={t("rolloutStage")}><select disabled={demo} className={selectClass} value={updateForm.rolloutStage} onChange={(e) => setUpdateForm({ ...updateForm, rolloutStage: e.target.value })}><option value="staged">staged</option><option value="canary">canary</option><option value="production">production</option><option value="rollback">rollback</option></select></Field>
        <Field label={t("signingKey")}><select required disabled={demo} className={selectClass} value={updateForm.signingKeyId} onChange={(e) => setUpdateForm({ ...updateForm, signingKeyId: e.target.value })}><option value="">—</option>{releaseKeys.filter((key) => !key.revoked).map((key) => <option key={key.id} value={key.id}>{key.keyReference}</option>)}</select></Field>
        <Field label="artifactSha256"><Input required disabled={demo} pattern="[a-fA-F0-9]{64}" value={updateForm.artifactSha256} onChange={(e) => setUpdateForm({ ...updateForm, artifactSha256: e.target.value })} /></Field>
        <Field label={t("manifest")}><Textarea required disabled={demo} value={updateForm.manifest} onChange={(e) => setUpdateForm({ ...updateForm, manifest: e.target.value })} /></Field>
        <Field label={t("signature")}><Textarea required disabled={demo} value={updateForm.signatureBase64} onChange={(e) => setUpdateForm({ ...updateForm, signatureBase64: e.target.value })} /></Field>
        {updateForm.rolloutStage === "rollback" && <Field label={t("rollbackOf")}><Input required disabled={demo} value={updateForm.rollbackOfUpdateId} onChange={(e) => setUpdateForm({ ...updateForm, rollbackOfUpdateId: e.target.value })} /></Field>}
        <Field label={t("reason")}><Textarea required disabled={demo} value={updateForm.reason} onChange={(e) => setUpdateForm({ ...updateForm, reason: e.target.value })} /></Field>
        <Button disabled={demo || saving} className="md:col-span-3">{t("recordUpdate")}</Button>
      </form>
    </CardContent></Card>
  </main>;
}
