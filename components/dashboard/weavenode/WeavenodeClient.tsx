"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { Cpu, Loader2, RadioTower, ShieldCheck, Activity, Layers, Key, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/apiClient";
import { industrialCoreApi, type IndustrialMeasurementPoint } from "@/lib/industrialCoreApi";
import { listEvidenceV2, type EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";
import {
  weavenodeApi,
  type MeterHierarchy,
  type MeterReconciliation,
  type ReleaseKey,
  type WeavenodeDevice,
  type WeavenodeHealth,
  type WeavenodeUpdate
} from "@/lib/weavenodeApi";

const selectClass = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-slate-700">
      <span className="font-medium text-xs uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const evidenceReady = (item: EvidenceDocumentV2) =>
  ["locked", "third_party_verified"].includes(item.status) &&
  /^[a-f0-9]{64}$/i.test(item.checksumSha256 || "") &&
  item.fileSizeBytes > 0;

const initialHierarchy = {
  hierarchyReference: "",
  facilityRevisionId: "",
  parentMeasurementPointRevisionId: "",
  childMeasurementPointRevisionId: "",
  relationKind: "sub_meter",
  tolerancePercent: "2",
  effectiveFrom: "",
  evidenceDocumentId: ""
};

const initialReconciliation = {
  parentMeasurementPointRevisionId: "",
  periodStart: "",
  periodEnd: ""
};

const initialUpdate = {
  deviceId: "",
  updateReference: "",
  updateKind: "firmware",
  targetVersion: "",
  rolloutStage: "staged",
  artifactSha256: "",
  signingKeyId: "",
  manifest: "{}",
  signatureBase64: "",
  rollbackOfUpdateId: "",
  reason: ""
};

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
        weavenodeApi.devices(),
        industrialCoreApi.measurementPoints(),
        listEvidenceV2(),
        weavenodeApi.hierarchies(),
        weavenodeApi.reconciliations(),
        weavenodeApi.releaseKeys().catch(() => [] as ReleaseKey[])
      ]);
      setDevices(deviceRows);
      setPoints(pointRows);
      setEvidence(evidenceResponse.items.filter(evidenceReady));
      setHierarchies(hierarchyRows);
      setReconciliations(reconciliationRows);
      setReleaseKeys(keyRows);
      setError(null);
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [demo, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedDevice || demo) {
      setHealth([]);
      setUpdates([]);
      return;
    }
    void Promise.all([
      weavenodeApi.health(selectedDevice),
      weavenodeApi.updates(selectedDevice).catch(() => [] as WeavenodeUpdate[])
    ])
      .then(([healthRows, updateRows]) => {
        setHealth(healthRows);
        setUpdates(updateRows);
      })
      .catch((cause) => setError(isApiError(cause) ? cause.message : t("loadError")));
  }, [demo, selectedDevice, t]);

  const run = async (action: () => Promise<unknown>) => {
    if (demo || saving) return;
    setSaving(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : cause instanceof Error ? cause.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const saveHierarchy = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await weavenodeApi.createHierarchy({
        ...hierarchyForm,
        tolerancePercent: Number(hierarchyForm.tolerancePercent),
        effectiveFrom: new Date(hierarchyForm.effectiveFrom).toISOString()
      });
      setHierarchyForm(initialHierarchy);
    });
  };

  const saveReconciliation = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await weavenodeApi.reconcile({
        parentMeasurementPointRevisionId: reconciliationForm.parentMeasurementPointRevisionId,
        periodStart: new Date(reconciliationForm.periodStart).toISOString(),
        periodEnd: new Date(reconciliationForm.periodEnd).toISOString()
      });
      setReconciliationForm(initialReconciliation);
    });
  };

  const saveKey = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await weavenodeApi.createReleaseKey(keyForm);
      setKeyForm({ keyReference: "", publicKeyPem: "" });
    });
  };

  const saveUpdate = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const manifest = JSON.parse(updateForm.manifest) as Record<string, unknown>;
      await weavenodeApi.createUpdate(updateForm.deviceId, {
        ...updateForm,
        deviceId: undefined,
        manifest,
        rollbackOfUpdateId: updateForm.rollbackOfUpdateId || undefined
      });
      setSelectedDevice(updateForm.deviceId);
      setUpdateForm(initialUpdate);
    });
  };

  const pointLabel = (id: string) => points.find((point) => point.id === id)?.measurementPointReference || id;

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm text-slate-500">Đang tải dữ liệu thiết bị WeaveNode...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      {/* Top Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 p-6 md:p-8 text-white shadow-sm border border-slate-800">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
              <RadioTower className="h-3.5 w-3.5" />
              G2-10 · WeaveNode
            </span>
            <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs text-cyan-300 border border-cyan-500/20">
              Hardware Telemetry &amp; Signed OTA
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">{t("title")}</h1>
          <p className="max-w-3xl text-sm md:text-base text-slate-300 leading-relaxed">{t("description")}</p>
        </div>
      </section>

      {/* Boundary Alert */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 shadow-sm">
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-950">Ranh giới vận hành thiết bị đo kiểm</p>
          <p className="text-xs text-amber-800 leading-relaxed">{t("boundary")}</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {demo && (
        <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 shadow-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-sky-600" />
          <span>{t("demoReadOnly")}</span>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Thiết bị đo</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{devices.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">WeaveNode gateways</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Điểm đo lường</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{points.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Measurement Points</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cấu trúc phân cấp</p>
          <p className="mt-1 text-2xl font-bold text-cyan-700">{hierarchies.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Sub-metering chains</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Khóa ký phát hành</p>
          <p className="mt-1 text-2xl font-bold text-indigo-700">{releaseKeys.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">RSA / Ed25519 keys</p>
        </div>
      </div>

      {/* Fleet Overview Card */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Cpu className="h-5 w-5 text-emerald-600" />
                {t("fleet")}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">{t("fleetDescription")}</CardDescription>
            </div>
            <Badge variant="outline" className="bg-white">{devices.length} {t("devices") || "thiết bị"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {devices.map((device) => (
              <button
                type="button"
                key={device.id}
                onClick={() => setSelectedDevice(device.id)}
                className={`rounded-xl border p-4 text-left transition-all ${
                  selectedDevice === device.id
                    ? "border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <b className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                    <Cpu className="h-4 w-4 text-emerald-600" />
                    {device.deviceReference}
                  </b>
                  <Badge
                    variant="outline"
                    className={
                      device.revoked
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }
                  >
                    {device.revoked ? t("revoked") : device.protocolVersion.endsWith("v2") ? "v2" : "v1"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-slate-600 font-medium">
                  {device.measurementPointReference} · {device.canonicalUnit}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <span>{t("accepted")}: <strong className="text-slate-700 font-mono">{device.lastAcceptedSequence}</strong></span>
                  <span>{t("buffered")}: <strong className="text-slate-700 font-mono">{device.bufferedCount}</strong></span>
                </div>
              </button>
            ))}
          </div>

          {!devices.length && (
            <p className="text-center py-8 text-sm text-slate-500">{t("noDevices")}</p>
          )}

          {selectedDevice && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-4 w-4 text-emerald-600" />
                <h3 className="font-semibold text-slate-900 text-sm">
                  Chi tiết thiết bị: <span className="font-mono text-emerald-700">{selectedDevice}</span>
                </h3>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wider mb-3">{t("health")}</h4>
                  <div className="space-y-2">
                    {health.slice(0, 10).map((item) => (
                      <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-2xs">
                        <div className="flex items-center justify-between">
                          <b className="text-slate-900 text-xs font-mono">
                            FW: {item.firmwareVersion} / CFG: {item.configVersion}
                          </b>
                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700">{item.sensorStatus}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          {t("drift")}: <span className="font-mono">{item.clockDriftSeconds}s</span> · {t("buffered")}: <span className="font-mono">{item.bufferDepth}</span>
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400 font-mono">{item.gatewayReceivedAt}</p>
                      </div>
                    ))}
                    {!health.length && (
                      <p className="text-xs text-slate-500 py-3 text-center">{t("noHealth")}</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wider mb-3">{t("updateHistory")}</h4>
                  <div className="space-y-2">
                    {updates.slice(0, 10).map((item) => (
                      <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-2xs">
                        <div className="flex items-center justify-between">
                          <b className="text-slate-900 text-xs font-medium">
                            {item.updateReference} · r{item.revision}
                          </b>
                          <Badge variant="outline" className="text-xs bg-cyan-50 text-cyan-700">{item.rolloutStage}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 font-mono">
                          {item.updateKind} → {item.targetVersion}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-slate-400 font-mono">{item.manifestSha256}</p>
                      </div>
                    ))}
                    {!updates.length && (
                      <p className="text-xs text-slate-500 py-3 text-center">{t("noUpdates")}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Meter Hierarchy and Reconciliation Side-by-Side */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Layers className="h-5 w-5 text-cyan-600" />
              {t("hierarchy")}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">{t("hierarchyDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form className="grid gap-3 md:grid-cols-2" onSubmit={saveHierarchy}>
              <Field label={t("reference")}>
                <Input
                  required
                  disabled={demo}
                  placeholder="VD: HIER-LINE-A-01"
                  value={hierarchyForm.hierarchyReference}
                  onChange={(e) => setHierarchyForm({ ...hierarchyForm, hierarchyReference: e.target.value })}
                />
              </Field>

              <Field label={t("relation")}>
                <select
                  className={selectClass}
                  disabled={demo}
                  value={hierarchyForm.relationKind}
                  onChange={(e) => setHierarchyForm({ ...hierarchyForm, relationKind: e.target.value })}
                >
                  <option value="sub_meter">sub_meter</option>
                  <option value="line_meter">line_meter</option>
                  <option value="machine_meter">machine_meter</option>
                </select>
              </Field>

              <Field label={t("parentMeter")}>
                <select
                  required
                  className={selectClass}
                  disabled={demo}
                  value={hierarchyForm.parentMeasurementPointRevisionId}
                  onChange={(e) => {
                    const point = points.find((item) => item.id === e.target.value);
                    setHierarchyForm({
                      ...hierarchyForm,
                      parentMeasurementPointRevisionId: e.target.value,
                      facilityRevisionId: point?.facilityRevisionId || ""
                    });
                  }}
                >
                  <option value="">— Chọn đồng hồ cha —</option>
                  {points.map((point) => (
                    <option key={point.id} value={point.id}>
                      {point.measurementPointReference} · {point.canonicalUnit}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("childMeter")}>
                <select
                  required
                  className={selectClass}
                  disabled={demo}
                  value={hierarchyForm.childMeasurementPointRevisionId}
                  onChange={(e) => setHierarchyForm({ ...hierarchyForm, childMeasurementPointRevisionId: e.target.value })}
                >
                  <option value="">— Chọn đồng hồ con —</option>
                  {points
                    .filter(
                      (point) =>
                        point.facilityRevisionId === hierarchyForm.facilityRevisionId &&
                        point.id !== hierarchyForm.parentMeasurementPointRevisionId
                    )
                    .map((point) => (
                      <option key={point.id} value={point.id}>
                        {point.measurementPointReference} · {point.canonicalUnit}
                      </option>
                    ))}
                </select>
              </Field>

              <Field label={t("tolerance")}>
                <Input
                  required
                  disabled={demo}
                  type="number"
                  min="0"
                  max="100"
                  step="0.0001"
                  placeholder="2 (%)"
                  value={hierarchyForm.tolerancePercent}
                  onChange={(e) => setHierarchyForm({ ...hierarchyForm, tolerancePercent: e.target.value })}
                />
              </Field>

              <Field label={t("effectiveFrom")}>
                <Input
                  required
                  disabled={demo}
                  type="datetime-local"
                  value={hierarchyForm.effectiveFrom}
                  onChange={(e) => setHierarchyForm({ ...hierarchyForm, effectiveFrom: e.target.value })}
                />
              </Field>

              <div className="md:col-span-2">
                <Field label={t("evidence")}>
                  <select
                    required
                    className={selectClass}
                    disabled={demo}
                    value={hierarchyForm.evidenceDocumentId}
                    onChange={(e) => setHierarchyForm({ ...hierarchyForm, evidenceDocumentId: e.target.value })}
                  >
                    <option value="">— Chọn chứng từ đối chiếu —</option>
                    {evidence.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.documentName}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Button disabled={demo || saving} className="md:col-span-2 bg-cyan-600 hover:bg-cyan-700 text-white mt-1">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Layers className="mr-2 h-4 w-4" />}
                {t("saveHierarchy")}
              </Button>
            </form>

            {hierarchies.length > 0 && (
              <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 max-h-56 overflow-y-auto">
                {hierarchies.slice(0, 20).map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <b className="text-slate-900 font-semibold">{item.hierarchyReference} · r{item.revision}</b>
                      <Badge variant="outline" className="bg-white text-slate-700">±{item.tolerancePercent}%</Badge>
                    </div>
                    <p className="mt-1 text-slate-600">
                      {item.parentReference || pointLabel(item.parentMeasurementPointRevisionId)} →{" "}
                      {item.childReference || pointLabel(item.childMeasurementPointRevisionId)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reconciliation Form */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-teal-600" />
              {t("reconciliation")}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">{t("reconciliationDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form className="grid gap-3" onSubmit={saveReconciliation}>
              <Field label={t("parentMeter")}>
                <select
                  required
                  className={selectClass}
                  disabled={demo}
                  value={reconciliationForm.parentMeasurementPointRevisionId}
                  onChange={(e) => setReconciliationForm({ ...reconciliationForm, parentMeasurementPointRevisionId: e.target.value })}
                >
                  <option value="">— Chọn đồng hồ tổng để đối chiếu —</option>
                  {[...new Set(hierarchies.map((item) => item.parentMeasurementPointRevisionId))].map((id) => (
                    <option key={id} value={id}>
                      {pointLabel(id)}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label={t("periodStart")}>
                  <Input
                    required
                    disabled={demo}
                    type="datetime-local"
                    value={reconciliationForm.periodStart}
                    onChange={(e) => setReconciliationForm({ ...reconciliationForm, periodStart: e.target.value })}
                  />
                </Field>
                <Field label={t("periodEnd")}>
                  <Input
                    required
                    disabled={demo}
                    type="datetime-local"
                    value={reconciliationForm.periodEnd}
                    onChange={(e) => setReconciliationForm({ ...reconciliationForm, periodEnd: e.target.value })}
                  />
                </Field>
              </div>

              <Button disabled={demo || saving} className="bg-teal-600 hover:bg-teal-700 text-white mt-1">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {t("runReconciliation")}
              </Button>
            </form>

            {reconciliations.length > 0 && (
              <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 max-h-56 overflow-y-auto">
                {reconciliations.slice(0, 20).map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <b className="text-slate-900 font-semibold">{pointLabel(item.parentMeasurementPointRevisionId)}</b>
                      <Badge
                        variant="outline"
                        className={
                          item.status === "reconciled"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }
                      >
                        {item.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-slate-700 font-mono">
                      {item.parentQuantity} − {item.childQuantity} = {item.differenceQuantity} {item.canonicalUnit}
                    </p>
                    <p className="mt-0.5 text-slate-500">
                      Chênh lệch: <strong className="text-slate-700">{item.differencePercent ?? "—"}%</strong> / Sai số cho phép: ±{item.tolerancePercent}%
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Signed Updates Card */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Key className="h-5 w-5 text-indigo-600" />
            {t("signedUpdates")}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">{t("signedUpdatesDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Key Registration */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Đăng ký khóa ký phát hành</p>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={saveKey}>
              <Field label={t("keyReference")}>
                <Input
                  required
                  disabled={demo}
                  placeholder="VD: WEAVENODE-RELEASE-ED25519-2026"
                  value={keyForm.keyReference}
                  onChange={(e) => setKeyForm({ ...keyForm, keyReference: e.target.value })}
                />
              </Field>
              <Field label={t("publicKey")}>
                <Textarea
                  required
                  disabled={demo}
                  rows={2}
                  className="font-mono text-xs"
                  placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                  value={keyForm.publicKeyPem}
                  onChange={(e) => setKeyForm({ ...keyForm, publicKeyPem: e.target.value })}
                />
              </Field>
              <Button disabled={demo || saving} className="md:col-span-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
                {t("registerKey")}
              </Button>
            </form>

            {releaseKeys.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-200">
                {releaseKeys.map((key) => (
                  <Badge
                    key={key.id}
                    variant="outline"
                    className={
                      key.revoked
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-white text-slate-700 border-slate-200"
                    }
                  >
                    {key.keyReference}
                    {key.revoked ? ` · ${t("revoked")}` : ""}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Update Record Form */}
          <form className="grid gap-4 md:grid-cols-3" onSubmit={saveUpdate}>
            <Field label={t("device")}>
              <select
                required
                disabled={demo}
                className={selectClass}
                value={updateForm.deviceId}
                onChange={(e) => setUpdateForm({ ...updateForm, deviceId: e.target.value })}
              >
                <option value="">— Chọn thiết bị —</option>
                {devices
                  .filter((item) => !item.revoked)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.deviceReference}
                    </option>
                  ))}
              </select>
            </Field>

            <Field label={t("reference")}>
              <Input
                required
                disabled={demo}
                placeholder="VD: OTA-2026-Q1-V2.1.0"
                value={updateForm.updateReference}
                onChange={(e) => setUpdateForm({ ...updateForm, updateReference: e.target.value })}
              />
            </Field>

            <Field label={t("targetVersion")}>
              <Input
                required
                disabled={demo}
                placeholder="VD: 2.1.0"
                value={updateForm.targetVersion}
                onChange={(e) => setUpdateForm({ ...updateForm, targetVersion: e.target.value })}
              />
            </Field>

            <Field label={t("updateKind")}>
              <select
                disabled={demo}
                className={selectClass}
                value={updateForm.updateKind}
                onChange={(e) => setUpdateForm({ ...updateForm, updateKind: e.target.value })}
              >
                <option value="firmware">firmware</option>
                <option value="configuration">configuration</option>
              </select>
            </Field>

            <Field label={t("rolloutStage")}>
              <select
                disabled={demo}
                className={selectClass}
                value={updateForm.rolloutStage}
                onChange={(e) => setUpdateForm({ ...updateForm, rolloutStage: e.target.value })}
              >
                <option value="staged">staged</option>
                <option value="canary">canary</option>
                <option value="production">production</option>
                <option value="rollback">rollback</option>
              </select>
            </Field>

            <Field label={t("signingKey")}>
              <select
                required
                disabled={demo}
                className={selectClass}
                value={updateForm.signingKeyId}
                onChange={(e) => setUpdateForm({ ...updateForm, signingKeyId: e.target.value })}
              >
                <option value="">— Chọn khóa ký —</option>
                {releaseKeys
                  .filter((key) => !key.revoked)
                  .map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.keyReference}
                    </option>
                  ))}
              </select>
            </Field>

            <Field label="artifactSha256">
              <Input
                required
                disabled={demo}
                pattern="[a-fA-F0-9]{64}"
                placeholder="64 ký tự hex SHA256"
                className="font-mono text-xs"
                value={updateForm.artifactSha256}
                onChange={(e) => setUpdateForm({ ...updateForm, artifactSha256: e.target.value })}
              />
            </Field>

            <Field label={t("manifest")}>
              <Textarea
                required
                disabled={demo}
                rows={2}
                className="font-mono text-xs"
                value={updateForm.manifest}
                onChange={(e) => setUpdateForm({ ...updateForm, manifest: e.target.value })}
              />
            </Field>

            <Field label={t("signature")}>
              <Textarea
                required
                disabled={demo}
                rows={2}
                className="font-mono text-xs"
                value={updateForm.signatureBase64}
                onChange={(e) => setUpdateForm({ ...updateForm, signatureBase64: e.target.value })}
              />
            </Field>

            {updateForm.rolloutStage === "rollback" && (
              <Field label={t("rollbackOf")}>
                <Input
                  required
                  disabled={demo}
                  value={updateForm.rollbackOfUpdateId}
                  onChange={(e) => setUpdateForm({ ...updateForm, rollbackOfUpdateId: e.target.value })}
                />
              </Field>
            )}

            <div className="md:col-span-3">
              <Field label={t("reason")}>
                <Textarea
                  required
                  disabled={demo}
                  rows={2}
                  placeholder="Lý do cập nhật firmware hoặc điều chỉnh cấu hình..."
                  value={updateForm.reason}
                  onChange={(e) => setUpdateForm({ ...updateForm, reason: e.target.value })}
                />
              </Field>
            </div>

            <div className="md:col-span-3 pt-2">
              <Button disabled={demo || saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                {t("recordUpdate")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
