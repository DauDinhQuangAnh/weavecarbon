"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Building2,
  CheckCircle2,
  CircleDashed,
  Clock,
  Cpu,
  Database,
  Gauge,
  GitBranch,
  Layers,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/apiClient";
import {
  INDUSTRIAL_CORE_DEMO_REGISTRY,
  industrialCoreApi,
  type CapabilityStatus,
  type IndustrialActivity,
  type DynamicAllocationRule,
  type DynamicAllocationRun,
  type IndustrialCapabilityRegistry,
  type IndustrialFacility,
  type IndustrialMeasurementPoint,
  type IndustrialProcess,
} from "@/lib/industrialCoreApi";

const statusStyles: Record<CapabilityStatus, string> = {
  implemented: "border-emerald-200 bg-emerald-50 text-emerald-800",
  partial: "border-amber-200 bg-amber-50 text-amber-800",
  planned: "border-slate-200 bg-slate-50 text-slate-700",
};

const emptyForm = {
  facilityReference: "",
  name: "",
  countryCode: "VN",
  timezone: "Asia/Ho_Chi_Minh",
  boundaryNotes: "",
};

export default function CarbonOperationsClient({
  demo = false,
}: {
  demo?: boolean;
}) {
  const t = useTranslations("carbonOperations");
  const [registry, setRegistry] =
    useState<IndustrialCapabilityRegistry | null>(null);
  const [facilities, setFacilities] = useState<IndustrialFacility[]>([]);
  const [processes, setProcesses] = useState<IndustrialProcess[]>([]);
  const [measurementPoints, setMeasurementPoints] = useState<
    IndustrialMeasurementPoint[]
  >([]);
  const [activities, setActivities] = useState<IndustrialActivity[]>([]);
  const [allocationRules, setAllocationRules] = useState<
    DynamicAllocationRule[]
  >([]);
  const [allocationRuns, setAllocationRuns] = useState<
    DynamicAllocationRun[]
  >([]);
  const [lineage, setLineage] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [processForm, setProcessForm] = useState({
    facilityRevisionId: "",
    processReference: "",
    name: "",
    processType: "",
  });
  const [pointForm, setPointForm] = useState({
    facilityRevisionId: "",
    processRevisionId: "",
    measurementPointReference: "",
    measurementType: "electricity",
    canonicalUnit: "kWh",
    sourceType: "meter" as const,
  });
  const [allocationRuleForm, setAllocationRuleForm] = useState({
    facilityRevisionId: "",
    allocationReference: "",
    allocationMethod: "output" as const,
    driverUnit: "unit",
    methodologyReference: "",
    methodologyVersion: "1.0",
    rationale: "",
    approvalStatus: "draft" as "draft" | "approved",
    evidenceDocumentId: "",
  });
  const [allocationRunForm, setAllocationRunForm] = useState({
    ruleRevisionId: "",
    sourceActivityId: "",
  });
  const [allocationDrivers, setAllocationDrivers] = useState<
    Record<string, string>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (demo) {
      setRegistry(INDUSTRIAL_CORE_DEMO_REGISTRY);
      setFacilities([]);
      setProcesses([]);
      setMeasurementPoints([]);
      setActivities([]);
      setAllocationRules([]);
      setAllocationRuns([]);
      setLoading(false);
      return;
    }
    try {
      const [
        capabilityData,
        facilityData,
        processData,
        pointData,
        activityData,
        ruleData,
        runData,
      ] = await Promise.all([
        industrialCoreApi.capabilities(),
        industrialCoreApi.facilities(),
        industrialCoreApi.processes(),
        industrialCoreApi.measurementPoints(),
        industrialCoreApi.activities(),
        industrialCoreApi.allocationRules(),
        industrialCoreApi.allocationRuns(),
      ]);
      setRegistry(capabilityData);
      setFacilities(facilityData);
      setProcesses(processData);
      setMeasurementPoints(pointData);
      setActivities(activityData);
      setAllocationRules(ruleData);
      setAllocationRuns(runData);
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [demo, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () =>
      registry?.layers.reduce<Record<CapabilityStatus, number>>(
        (sum, item) => {
          sum[item.status] += 1;
          return sum;
        },
        { implemented: 0, partial: 0, planned: 0 }
      ) ?? { implemented: 0, partial: 0, planned: 0 },
    [registry]
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (demo || saving) return;
    setSaving(true);
    setError(null);
    try {
      const created = await industrialCoreApi.createFacility({
        ...form,
        countryCode: form.countryCode.toUpperCase(),
        lifecycleStatus: "active",
      });
      setFacilities((current) => [created, ...current]);
      setForm(emptyForm);
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const submitProcess = async (event: FormEvent) => {
    event.preventDefault();
    if (demo || saving) return;
    setSaving(true);
    setError(null);
    try {
      const created = await industrialCoreApi.createProcess({
        ...processForm,
        lifecycleStatus: "active",
      });
      setProcesses((current) => [created, ...current]);
      setProcessForm({
        facilityRevisionId: "",
        processReference: "",
        name: "",
        processType: "",
      });
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const submitPoint = async (event: FormEvent) => {
    event.preventDefault();
    if (demo || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...pointForm,
        processRevisionId: pointForm.processRevisionId || undefined,
      };
      const created = await industrialCoreApi.createMeasurementPoint(payload);
      setMeasurementPoints((current) => [created, ...current]);
      setPointForm({
        facilityRevisionId: "",
        processRevisionId: "",
        measurementPointReference: "",
        measurementType: "electricity",
        canonicalUnit: "kWh",
        sourceType: "meter",
      });
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const inspectLineage = async (activityId: string) => {
    try {
      setLineage(await industrialCoreApi.activityLineage(activityId));
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("loadError"));
    }
  };

  const selectedAllocationRule = allocationRules.find(
    (item) => item.id === allocationRunForm.ruleRevisionId
  );
  const allocationTargets =
    selectedAllocationRule?.targetLevel === "process"
      ? processes.filter(
          (item) =>
            item.facilityRevisionId ===
            selectedAllocationRule.facilityRevisionId
        )
      : [];
  const allocationSources = selectedAllocationRule
    ? activities.filter(
        (item) =>
          item.facilityRevisionId ===
          selectedAllocationRule.facilityRevisionId
      )
    : [];

  const submitAllocationRule = async (event: FormEvent) => {
    event.preventDefault();
    if (demo || saving) return;
    setSaving(true);
    setError(null);
    try {
      const created = await industrialCoreApi.createAllocationRule({
        ...allocationRuleForm,
        sourceLevel: "facility", targetLevel: "process",
        evidenceDocumentId:
          allocationRuleForm.evidenceDocumentId || undefined,
      });
      setAllocationRules((current) => [created, ...current]);
      setAllocationRuleForm({
        facilityRevisionId: "",
        allocationReference: "",
        allocationMethod: "output",
        driverUnit: "unit",
        methodologyReference: "",
        methodologyVersion: "1.0",
        rationale: "",
        approvalStatus: "draft",
        evidenceDocumentId: "",
      });
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("allocationSaveError"));
    } finally {
      setSaving(false);
    }
  };

  const submitAllocationRun = async (event: FormEvent) => {
    event.preventDefault();
    if (demo || saving) return;
    const targets = allocationTargets
      .map((target) => ({
        targetEntityId: target.id,
        driverValue: Number(allocationDrivers[target.id]),
      }))
      .filter(
        (target) =>
          Number.isFinite(target.driverValue) && target.driverValue > 0
      );
    if (!targets.length) {
      setError(t("allocationTargetRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await industrialCoreApi.createAllocationRun({
        ruleRevisionId: allocationRunForm.ruleRevisionId,
        sourceActivityId: allocationRunForm.sourceActivityId,
        targets,
      });
      setAllocationRuns((current) => [created, ...current]);
      setAllocationDrivers({});
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("allocationSaveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 p-4 md:space-y-6 md:p-6">
      {/* ── Hero Banner ── */}
      <section className="overflow-hidden rounded-2xl border border-emerald-800/40 bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 p-6 text-white shadow-sm md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              <Database className="h-4 w-4" />
              {t("eyebrow")}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
              {t("title")}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-emerald-100/80 md:text-base">
              {t("description")}
            </p>
          </div>
          {registry && (
            <div className="rounded-xl border border-emerald-500/20 bg-white/10 px-4 py-3 backdrop-blur-sm self-start lg:self-auto shrink-0">
              <p className="text-[11px] font-medium text-emerald-200">
                {t("version")}
              </p>
              <p className="mt-0.5 font-mono text-sm font-bold text-white">
                {registry.platformVersion}
              </p>
            </div>
          )}
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 shadow-xs"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600 mb-2" />
            <span className="text-sm font-medium text-slate-500">
              {t("loading")}
            </span>
          </div>
        </div>
      ) : (
        registry && (
          <>
            {/* ── KPI Capability Cards ── */}
            <section className="grid gap-3 sm:grid-cols-3 md:gap-4">
              {(["implemented", "partial", "planned"] as CapabilityStatus[]).map(
                (status) => {
                  const icon =
                    status === "implemented" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : status === "partial" ? (
                      <Clock className="h-5 w-5 text-amber-500" />
                    ) : (
                      <CircleDashed className="h-5 w-5 text-slate-400" />
                    );

                  return (
                    <Card
                      key={status}
                      className="rounded-xl border border-slate-200/90 bg-white shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200"
                    >
                      <CardHeader className="pb-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {icon}
                            <CardTitle className="text-sm font-semibold text-slate-800">
                              {t(`status.${status}`)}
                            </CardTitle>
                          </div>
                          <Badge
                            variant="outline"
                            className={`font-mono font-semibold text-xs px-2.5 py-0.5 shadow-none ${statusStyles[status]}`}
                          >
                            {counts[status]}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs leading-relaxed text-slate-500">
                          {t(`statusDescription.${status}`)}
                        </p>
                      </CardContent>
                    </Card>
                  );
                }
              )}
            </section>

            {/* ── Truth Boundary Alert ── */}
            <Card className="rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/70 via-amber-50/40 to-orange-50/30 shadow-xs">
              <CardContent className="flex items-start gap-3.5 p-4 sm:p-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 border border-amber-200/80">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-950">
                    {t("truthTitle")}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900/90 sm:text-sm">
                    {registry.truthBoundary}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* ── Layers & Standardized Entities ── */}
            <section className="grid gap-4 md:gap-6 xl:grid-cols-[1.35fr_0.65fr]">
              <Card className="rounded-xl border border-slate-200/90 bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-emerald-600" />
                    <CardTitle className="text-base font-bold text-slate-900">
                      {t("layersTitle")}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    {t("layersDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {registry.layers.map((layer) => (
                    <div
                      key={layer.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {layer.status === "implemented" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <CircleDashed className="h-4 w-4 text-amber-500" />
                          )}
                          <p className="font-semibold text-sm text-slate-900">
                            {layer.label}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-medium shadow-none ${statusStyles[layer.status]}`}
                        >
                          {t(`status.${layer.status}`)}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">
                          {t("nextGate")}:
                        </span>{" "}
                        {layer.nextGate}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-slate-200/90 bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-600" />
                    <CardTitle className="text-base font-bold text-slate-900">
                      {t("entitiesTitle")}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    {t("entitiesDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 flex flex-wrap gap-2">
                  {registry.entities.map((entity) => (
                    <Badge
                      key={entity.id}
                      variant="outline"
                      className={`text-xs px-2.5 py-1 font-mono font-medium shadow-none ${statusStyles[entity.status]}`}
                    >
                      {entity.id}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            </section>

            {/* ── Facilities: Declaration & Catalog ── */}
            <section className="grid gap-4 md:gap-6 xl:grid-cols-[0.85fr_1.15fr]">
              <Card className="rounded-xl border border-slate-200/90 bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <Plus className="h-4 w-4 text-emerald-600" />
                    {t("facilityFormTitle")}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    {demo ? t("demoReadOnly") : t("facilityFormDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <form className="space-y-3.5" onSubmit={submit}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="facility-reference"
                          className="text-xs font-semibold text-slate-700"
                        >
                          {t("fields.reference")}
                        </Label>
                        <Input
                          id="facility-reference"
                          required
                          maxLength={120}
                          disabled={demo || saving}
                          value={form.facilityReference}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              facilityReference: e.target.value,
                            })
                          }
                          className="h-9 rounded-lg border-slate-200 text-sm focus:border-emerald-500 focus:ring-emerald-500/20"
                          placeholder="FAC-01"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="facility-country"
                          className="text-xs font-semibold text-slate-700"
                        >
                          {t("fields.country")}
                        </Label>
                        <Input
                          id="facility-country"
                          required
                          maxLength={2}
                          disabled={demo || saving}
                          value={form.countryCode}
                          onChange={(e) =>
                            setForm({ ...form, countryCode: e.target.value })
                          }
                          className="h-9 rounded-lg border-slate-200 text-sm focus:border-emerald-500 focus:ring-emerald-500/20 uppercase"
                          placeholder="VN"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="facility-name"
                        className="text-xs font-semibold text-slate-700"
                      >
                        {t("fields.name")}
                      </Label>
                      <Input
                        id="facility-name"
                        required
                        maxLength={240}
                        disabled={demo || saving}
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        className="h-9 rounded-lg border-slate-200 text-sm focus:border-emerald-500 focus:ring-emerald-500/20"
                        placeholder="Nhà máy May Vinatex Nam Định"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="facility-boundary"
                        className="text-xs font-semibold text-slate-700"
                      >
                        {t("fields.boundary")}
                      </Label>
                      <Textarea
                        id="facility-boundary"
                        disabled={demo || saving}
                        value={form.boundaryNotes}
                        onChange={(e) =>
                          setForm({ ...form, boundaryNotes: e.target.value })
                        }
                        className="rounded-lg border-slate-200 text-xs focus:border-emerald-500 focus:ring-emerald-500/20 min-h-[60px]"
                        placeholder="Ghi chú về phạm vi ranh giới hoạt động cơ sở..."
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={demo || saving}
                      className="h-9.5 w-full rounded-xl bg-emerald-600 font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                    >
                      {saving && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {t("createFacility")}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-slate-200/90 bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <Building2 className="h-4 w-4 text-emerald-600" />
                    {t("facilitiesTitle")}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    {t("facilitiesDescription", {
                      count: facilities.length,
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {facilities.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 bg-slate-50/50">
                      <Activity className="mx-auto mb-2 h-6 w-6 text-slate-400" />
                      {t("emptyFacilities")}
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                      {facilities.map((facility) => (
                        <div
                          key={facility.id}
                          className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50 transition-colors"
                        >
                          <div>
                            <p className="font-semibold text-sm text-slate-900">
                              {facility.name}
                            </p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">
                              {facility.facilityReference} ·{" "}
                              {facility.countryCode} · rev {facility.revision}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="w-fit border-emerald-200 bg-emerald-50 text-emerald-800 text-[11px] font-medium"
                          >
                            {facility.lifecycleStatus}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* ── Industrial Processes & Measurement Points ── */}
            <section className="grid gap-4 md:gap-6 lg:grid-cols-2">
              <Card className="rounded-xl border border-slate-200/90 bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-emerald-600" />
                    <CardTitle className="text-base font-bold text-slate-900">
                      {t("processFormTitle")}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    {t("processFormDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <form className="space-y-3" onSubmit={submitProcess}>
                    <div className="space-y-1">
                      <Label
                        htmlFor="process-facility"
                        className="text-xs font-semibold text-slate-700"
                      >
                        {t("fields.facility")}
                      </Label>
                      <select
                        id="process-facility"
                        required
                        disabled={demo || saving}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        value={processForm.facilityRevisionId}
                        onChange={(e) =>
                          setProcessForm({
                            ...processForm,
                            facilityRevisionId: e.target.value,
                          })
                        }
                      >
                        <option value="">{t("selectFacility")}</option>
                        {facilities.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} · rev {item.revision}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <Input
                        required
                        placeholder={t("fields.processReference")}
                        disabled={demo || saving}
                        value={processForm.processReference}
                        onChange={(e) =>
                          setProcessForm({
                            ...processForm,
                            processReference: e.target.value,
                          })
                        }
                        className="h-9 rounded-lg border-slate-200 text-xs"
                      />
                      <Input
                        required
                        placeholder={t("fields.processType")}
                        disabled={demo || saving}
                        value={processForm.processType}
                        onChange={(e) =>
                          setProcessForm({
                            ...processForm,
                            processType: e.target.value,
                          })
                        }
                        className="h-9 rounded-lg border-slate-200 text-xs"
                      />
                    </div>
                    <Input
                      required
                      placeholder={t("fields.processName")}
                      disabled={demo || saving}
                      value={processForm.name}
                      onChange={(e) =>
                        setProcessForm({
                          ...processForm,
                          name: e.target.value,
                        })
                      }
                      className="h-9 rounded-lg border-slate-200 text-xs"
                    />
                    <Button
                      disabled={demo || saving}
                      className="h-9 w-full rounded-xl bg-emerald-600 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                    >
                      {t("createProcess")}
                    </Button>
                  </form>

                  <div className="mt-4 space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                    {processes.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 text-xs text-slate-800"
                      >
                        <span className="font-semibold">{item.name}</span>
                        <span className="text-slate-500 font-mono">
                          {" "}
                          · {item.processReference} · {item.processType}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-slate-200/90 bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-emerald-600" />
                    <CardTitle className="text-base font-bold text-slate-900">
                      {t("pointFormTitle")}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    {t("pointFormDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <form className="space-y-3" onSubmit={submitPoint}>
                    <select
                      required
                      disabled={demo || saving}
                      aria-label={t("fields.facility")}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      value={pointForm.facilityRevisionId}
                      onChange={(e) =>
                        setPointForm({
                          ...pointForm,
                          facilityRevisionId: e.target.value,
                          processRevisionId: "",
                        })
                      }
                    >
                      <option value="">{t("selectFacility")}</option>
                      {facilities.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <select
                      disabled={demo || saving}
                      aria-label={t("fields.processName")}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      value={pointForm.processRevisionId}
                      onChange={(e) =>
                        setPointForm({
                          ...pointForm,
                          processRevisionId: e.target.value,
                        })
                      }
                    >
                      <option value="">{t("optionalProcess")}</option>
                      {processes
                        .filter(
                          (item) =>
                            item.facilityRevisionId ===
                            pointForm.facilityRevisionId
                        )
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                    <Input
                      required
                      placeholder={t("fields.pointReference")}
                      disabled={demo || saving}
                      value={pointForm.measurementPointReference}
                      onChange={(e) =>
                        setPointForm({
                          ...pointForm,
                          measurementPointReference: e.target.value,
                        })
                      }
                      className="h-9 rounded-lg border-slate-200 text-xs"
                    />
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <Input
                        required
                        placeholder={t("fields.measurementType")}
                        disabled={demo || saving}
                        value={pointForm.measurementType}
                        onChange={(e) =>
                          setPointForm({
                            ...pointForm,
                            measurementType: e.target.value,
                          })
                        }
                        className="h-9 rounded-lg border-slate-200 text-xs"
                      />
                      <Input
                        required
                        placeholder={t("fields.unit")}
                        disabled={demo || saving}
                        value={pointForm.canonicalUnit}
                        onChange={(e) =>
                          setPointForm({
                            ...pointForm,
                            canonicalUnit: e.target.value,
                          })
                        }
                        className="h-9 rounded-lg border-slate-200 text-xs"
                      />
                    </div>
                    <Button
                      disabled={demo || saving}
                      className="h-9 w-full rounded-xl bg-emerald-600 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                    >
                      {t("createPoint")}
                    </Button>
                  </form>

                  <div className="mt-4 space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                    {measurementPoints.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 text-xs text-slate-800"
                      >
                        <span className="font-semibold">
                          {item.measurementPointReference}
                        </span>
                        <span className="text-slate-500">
                          {" "}
                          · {item.measurementType} · {item.canonicalUnit}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* ── Activity Ledger & Evidence Lineage ── */}
            <Card className="rounded-xl border border-slate-200/90 bg-white shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-base font-bold text-slate-900">
                    {t("activityLedgerTitle")}
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-slate-500">
                  {t("activityLedgerDescription", {
                    count: activities.length,
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  {activities.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
                      {t("emptyActivities")}
                    </p>
                  ) : (
                    activities.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 hover:bg-slate-50 transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-sm text-slate-900 font-mono">
                            {item.activityReference}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {item.quantity} {item.canonicalUnit} ·{" "}
                            <span className="text-emerald-700 font-medium">
                              {item.dataQualityLevel}
                            </span>
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void inspectLineage(item.id)}
                          className="h-8 rounded-lg border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          {t("viewLineage")}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                {lineage !== null && (
                  <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-xs text-emerald-300 border border-emerald-950">
                    {JSON.stringify(lineage, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>

            {/* ── Governed Allocation Rules & Deterministic Runs ── */}
            <section className="grid gap-4 md:gap-6 xl:grid-cols-2">
              <Card className="rounded-xl border border-slate-200/90 bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-emerald-600" />
                    <CardTitle className="text-base font-bold text-slate-900">
                      {t("allocationRuleTitle")}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    {t("allocationRuleDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <form className="space-y-3" onSubmit={submitAllocationRule}>
                    <select
                      required
                      disabled={demo || saving}
                      aria-label={t("fields.facility")}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      value={allocationRuleForm.facilityRevisionId}
                      onChange={(e) =>
                        setAllocationRuleForm({
                          ...allocationRuleForm,
                          facilityRevisionId: e.target.value,
                        })
                      }
                    >
                      <option value="">{t("selectFacility")}</option>
                      {facilities.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>

                    <Input
                      required
                      placeholder={t("allocationReference")}
                      disabled={demo || saving}
                      value={allocationRuleForm.allocationReference}
                      onChange={(e) =>
                        setAllocationRuleForm({
                          ...allocationRuleForm,
                          allocationReference: e.target.value,
                        })
                      }
                      className="h-9 rounded-lg border-slate-200 text-xs"
                    />

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <select
                        disabled={demo || saving}
                        aria-label={t("allocationMethod")}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        value={allocationRuleForm.allocationMethod}
                        onChange={(e) =>
                          setAllocationRuleForm({
                            ...allocationRuleForm,
                            allocationMethod: e.target
                              .value as typeof allocationRuleForm.allocationMethod,
                          })
                        }
                      >
                        <option value="output">
                          {t("allocationMethods.output")}
                        </option>
                        <option value="mass">
                          {t("allocationMethods.mass")}
                        </option>
                        <option value="energy">
                          {t("allocationMethods.energy")}
                        </option>
                        <option value="machine_hour">
                          {t("allocationMethods.machineHour")}
                        </option>
                        <option value="economic">
                          {t("allocationMethods.economic")}
                        </option>
                        <option value="custom_driver">
                          {t("allocationMethods.custom")}
                        </option>
                      </select>
                      <Input
                        required
                        placeholder={t("driverUnit")}
                        disabled={demo || saving}
                        value={allocationRuleForm.driverUnit}
                        onChange={(e) =>
                          setAllocationRuleForm({
                            ...allocationRuleForm,
                            driverUnit: e.target.value,
                          })
                        }
                        className="h-9 rounded-lg border-slate-200 text-xs"
                      />
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <Input
                        required
                        placeholder={t("methodologyReference")}
                        disabled={demo || saving}
                        value={allocationRuleForm.methodologyReference}
                        onChange={(e) =>
                          setAllocationRuleForm({
                            ...allocationRuleForm,
                            methodologyReference: e.target.value,
                          })
                        }
                        className="h-9 rounded-lg border-slate-200 text-xs"
                      />
                      <Input
                        required
                        placeholder={t("methodologyVersion")}
                        disabled={demo || saving}
                        value={allocationRuleForm.methodologyVersion}
                        onChange={(e) =>
                          setAllocationRuleForm({
                            ...allocationRuleForm,
                            methodologyVersion: e.target.value,
                          })
                        }
                        className="h-9 rounded-lg border-slate-200 text-xs"
                      />
                    </div>

                    <Textarea
                      required
                      placeholder={t("allocationRationale")}
                      disabled={demo || saving}
                      value={allocationRuleForm.rationale}
                      onChange={(e) =>
                        setAllocationRuleForm({
                          ...allocationRuleForm,
                          rationale: e.target.value,
                        })
                      }
                      className="rounded-lg border-slate-200 text-xs min-h-[50px]"
                    />

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <select
                        disabled={demo || saving}
                        aria-label={t("approvalStatus")}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        value={allocationRuleForm.approvalStatus}
                        onChange={(e) =>
                          setAllocationRuleForm({
                            ...allocationRuleForm,
                            approvalStatus: e.target.value as
                              | "draft"
                              | "approved",
                          })
                        }
                      >
                        <option value="draft">{t("draft")}</option>
                        <option value="approved">{t("approved")}</option>
                      </select>
                      <Input
                        placeholder={t("approvalEvidence")}
                        disabled={demo || saving}
                        value={allocationRuleForm.evidenceDocumentId}
                        onChange={(e) =>
                          setAllocationRuleForm({
                            ...allocationRuleForm,
                            evidenceDocumentId: e.target.value,
                          })
                        }
                        className="h-9 rounded-lg border-slate-200 text-xs"
                      />
                    </div>

                    <Button
                      disabled={demo || saving}
                      className="h-9 w-full rounded-xl bg-emerald-600 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                    >
                      {t("createAllocationRule")}
                    </Button>
                  </form>

                  <div className="mt-4 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {allocationRules.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 font-mono">
                            {item.allocationReference} · rev {item.revision}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              item.approvalStatus === "approved"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border-slate-200 bg-slate-100 text-slate-600"
                            }
                          >
                            {item.approvalStatus}
                          </Badge>
                        </div>
                        <p className="mt-1 text-slate-500">
                          {item.sourceLevel} → {item.targetLevel} ·{" "}
                          {item.allocationMethod} · {item.driverUnit}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-slate-200/90 bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-600" />
                    <CardTitle className="text-base font-bold text-slate-900">
                      {t("allocationRunTitle")}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    {t("allocationRunDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <form className="space-y-3" onSubmit={submitAllocationRun}>
                    <select
                      required
                      disabled={demo || saving}
                      aria-label={t("allocationRuleTitle")}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      value={allocationRunForm.ruleRevisionId}
                      onChange={(e) => {
                        setAllocationRunForm({
                          ruleRevisionId: e.target.value,
                          sourceActivityId: "",
                        });
                        setAllocationDrivers({});
                      }}
                    >
                      <option value="">{t("selectAllocationRule")}</option>
                      {allocationRules
                        .filter(
                          (item) =>
                            item.approvalStatus === "approved" &&
                            item.targetLevel === "process"
                        )
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.allocationReference} · rev {item.revision}
                          </option>
                        ))}
                    </select>

                    <select
                      required
                      disabled={demo || saving || !selectedAllocationRule}
                      aria-label={t("sourceActivity")}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      value={allocationRunForm.sourceActivityId}
                      onChange={(e) =>
                        setAllocationRunForm({
                          ...allocationRunForm,
                          sourceActivityId: e.target.value,
                        })
                      }
                    >
                      <option value="">{t("selectSourceActivity")}</option>
                      {allocationSources.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.activityReference} · {item.quantity}{" "}
                          {item.canonicalUnit}
                        </option>
                      ))}
                    </select>

                    <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                      <p className="text-xs font-semibold text-slate-700">
                        {t("targetDrivers")}
                      </p>
                      {allocationTargets.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-200 bg-white p-3 text-center text-xs text-slate-500">
                          {t("noAllocationTargets")}
                        </p>
                      ) : (
                        allocationTargets.map((target) => (
                          <div
                            key={target.id}
                            className="grid grid-cols-[1fr_8rem] items-center gap-2"
                          >
                            <Label
                              htmlFor={`driver-${target.id}`}
                              className="text-xs font-medium text-slate-700 truncate"
                            >
                              {target.name}
                            </Label>
                            <Input
                              id={`driver-${target.id}`}
                              type="number"
                              min="0"
                              step="any"
                              disabled={demo || saving}
                              value={allocationDrivers[target.id] || ""}
                              onChange={(e) =>
                                setAllocationDrivers({
                                  ...allocationDrivers,
                                  [target.id]: e.target.value,
                                })
                              }
                              className="h-8 rounded-lg border-slate-200 bg-white text-xs"
                              placeholder="0.00"
                            />
                          </div>
                        ))
                      )}
                    </div>

                    <Button
                      disabled={
                        demo ||
                        saving ||
                        !selectedAllocationRule ||
                        !allocationRunForm.sourceActivityId
                      }
                      className="h-9 w-full rounded-xl bg-emerald-600 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                    >
                      {t("createAllocationRun")}
                    </Button>
                  </form>

                  <div className="mt-4 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {allocationRuns.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 font-mono">
                            {item.allocationReference} · {item.sourceQuantity}{" "}
                            {item.sourceUnit}
                          </span>
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-800"
                          >
                            {item.reconciliationStatus}
                          </Badge>
                        </div>
                        <p className="mt-1 text-slate-500">
                          {item.lines.length} {t("allocationLines")} · Δ{" "}
                          {item.reconciliationDifference}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>
          </>
        )
      )}
    </main>
  );
}
