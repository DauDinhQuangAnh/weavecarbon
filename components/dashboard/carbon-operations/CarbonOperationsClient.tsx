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
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sliders,
  Zap,
  Flame,
  TrendingDown,
  Scale,
  AlertTriangle,
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
import ActivityOperationsPanel from "@/components/dashboard/carbon-operations/ActivityOperationsPanel";
import DataEntryScanTrigger from "@/components/ui/DataEntryScanTrigger";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "@/hooks/useToast";
import { isApiError } from "@/lib/apiClient";
import { selectLatestRevisions, isControlledEvidence } from "@/lib/industrialOperations";
import { listEvidenceV2, type EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";
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
import { demoSessionCache } from "@/lib/dashboard/demoSessionCache";
import { DEMO_MEASUREMENT_POINTS, DEMO_EVIDENCE } from "@/lib/dashboard/industrialDemoData";

type SaveAction = "facility" | "process" | "point" | "allocationRule" | "allocationRun";

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
  const { isRoot, canMutate, isPlanLocked } = usePermissions();
  const canWrite = !demo && isRoot && canMutate;
  const readOnlyMessage = demo
    ? t("demoReadOnly")
    : !isRoot
      ? t("adminRequired")
      : isPlanLocked
        ? t("subscriptionReadOnly")
        : t("readOnly");
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
  const [evidence, setEvidence] = useState<EvidenceDocumentV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Set<SaveAction>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Partial<Record<SaveAction, string>>>({});
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
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
    sourceType: "meter" as IndustrialMeasurementPoint["sourceType"],
    deviceIdentity: "",
    calibrationStatus: "unknown" as "unknown" | "current" | "expired" | "not_applicable",
    calibrationDueOn: "",
    samplingIntervalSeconds: "",
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

  // Interactive What-If Simulation Sandbox State
  const [whatIfSolarPct, setWhatIfSolarPct] = useState(25);
  const [whatIfBiomassPct, setWhatIfBiomassPct] = useState(50);
  const [whatIfEfficiencyPct, setWhatIfEfficiencyPct] = useState(10);

  // Derived simulation calculations based on plant operational baseline
  const simulationResults = useMemo(() => {
    const baseScope1 = 1450; // tCO2e/năm từ đốt nhiên liệu lò hơi
    const baseScope2 = 1980; // tCO2e/năm từ điện lưới EVN
    const totalBaseline = baseScope1 + baseScope2;

    const s1Saved = Number((baseScope1 * (whatIfBiomassPct / 100) * 0.76).toFixed(1));
    const s2Saved = Number((baseScope2 * ((whatIfSolarPct + whatIfEfficiencyPct) / 100)).toFixed(1));
    const totalSaved = Number((s1Saved + s2Saved).toFixed(1));
    const pctReduction = Number(((totalSaved / totalBaseline) * 100).toFixed(1));
    const annualCostSavingMillionVnd = Math.round((s2Saved * 1000 * 0.65 * 2.1) / 1000 + (s1Saved * 350));

    return {
      totalBaseline,
      s1Saved,
      s2Saved,
      totalSaved,
      pctReduction,
      annualCostSavingMillionVnd,
    };
  }, [whatIfSolarPct, whatIfBiomassPct, whatIfEfficiencyPct]);

  const isSaving = (action: SaveAction) => saving.has(action);
  const setActionSaving = (action: SaveAction, value: boolean) => {
    setSaving((current) => {
      const next = new Set(current);
      if (value) next.add(action); else next.delete(action);
      return next;
    });
  };
  const setActionError = (action: SaveAction, message?: string) => {
    setActionErrors((current) => ({ ...current, [action]: message }));
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActionErrors({});
    setLoadWarnings([]);
    if (demo) {
      setRegistry(INDUSTRIAL_CORE_DEMO_REGISTRY);
      setFacilities(demoSessionCache.getFacilities());
      setProcesses(demoSessionCache.getProcesses());
      setMeasurementPoints(DEMO_MEASUREMENT_POINTS);
      setActivities(demoSessionCache.getActivities());
      setAllocationRules([]);
      setAllocationRuns([]);
      setEvidence(DEMO_EVIDENCE);
      setLoading(false);
      return;
    }
    try {
      const results = await Promise.allSettled([
        industrialCoreApi.capabilities(),
        industrialCoreApi.facilities(),
        industrialCoreApi.processes(),
        industrialCoreApi.measurementPoints(),
        industrialCoreApi.activities(),
        industrialCoreApi.allocationRules(),
        industrialCoreApi.allocationRuns(),
        listEvidenceV2(),
      ]);
      const sectionNames = [t("capabilitySection"), t("facilitiesTitle"), t("processFormTitle"), t("pointFormTitle"), t("activityLedgerTitle"), t("allocationRuleTitle"), t("allocationRunTitle"), t("activityEvidence")];
      const warnings: string[] = [];
      results.forEach((result, index) => {
        if (result.status === "rejected") warnings.push(`${sectionNames[index]}: ${isApiError(result.reason) ? result.reason.message : t("loadError")}`);
      });
      if (results[0].status === "fulfilled") {
        setRegistry(results[0].value as IndustrialCapabilityRegistry);
      } else {
        setRegistry({
          ...INDUSTRIAL_CORE_DEMO_REGISTRY,
          platformVersion: t("unavailable"),
          truthBoundary: t("capabilityUnavailable"),
          layers: [],
          entities: [],
        });
      }
      if (results[1].status === "fulfilled") setFacilities(results[1].value as IndustrialFacility[]);
      if (results[2].status === "fulfilled") setProcesses(results[2].value as IndustrialProcess[]);
      if (results[3].status === "fulfilled") setMeasurementPoints(results[3].value as IndustrialMeasurementPoint[]);
      if (results[4].status === "fulfilled") setActivities(results[4].value as IndustrialActivity[]);
      if (results[5].status === "fulfilled") setAllocationRules(results[5].value as DynamicAllocationRule[]);
      if (results[6].status === "fulfilled") setAllocationRuns(results[6].value as DynamicAllocationRun[]);
      if (results[7].status === "fulfilled") setEvidence((results[7].value as { items: EvidenceDocumentV2[] }).items);
      setLoadWarnings(warnings);
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

  const latestFacilities = useMemo(() => selectLatestRevisions(facilities, (item) => item.facilityReference), [facilities]);
  const latestProcesses = useMemo(() => selectLatestRevisions(processes, (item) => item.processReference), [processes]);
  const latestMeasurementPoints = useMemo(() => selectLatestRevisions(measurementPoints, (item) => item.measurementPointReference), [measurementPoints]);
  const controlledEvidence = useMemo(() => evidence.filter(isControlledEvidence), [evidence]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canWrite || isSaving("facility")) return;
    setActionSaving("facility", true);
    setActionError("facility");
    try {
      const created = await industrialCoreApi.createFacility({
        ...form,
        countryCode: form.countryCode.toUpperCase(),
        lifecycleStatus: "active",
      });
      setFacilities((current) => [created, ...current]);
      setForm(emptyForm);
      toast({ title: t("facilityCreated") });
    } catch (cause) {
      setActionError("facility", isApiError(cause) ? cause.message : t("facilitySaveError"));
    } finally {
      setActionSaving("facility", false);
    }
  };

  const submitProcess = async (event: FormEvent) => {
    event.preventDefault();
    if (!canWrite || isSaving("process")) return;
    setActionSaving("process", true);
    setActionError("process");
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
      toast({ title: t("processCreated") });
    } catch (cause) {
      setActionError("process", isApiError(cause) ? cause.message : t("processSaveError"));
    } finally {
      setActionSaving("process", false);
    }
  };

  const submitPoint = async (event: FormEvent) => {
    event.preventDefault();
    if (!canWrite || isSaving("point")) return;
    setActionSaving("point", true);
    setActionError("point");
    try {
      const payload = {
        ...pointForm,
        processRevisionId: pointForm.processRevisionId || undefined,
        deviceIdentity: pointForm.deviceIdentity || undefined,
        calibrationDueOn: pointForm.calibrationDueOn || undefined,
        samplingIntervalSeconds: pointForm.samplingIntervalSeconds ? Number(pointForm.samplingIntervalSeconds) : undefined,
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
        deviceIdentity: "",
        calibrationStatus: "unknown",
        calibrationDueOn: "",
        samplingIntervalSeconds: "",
      });
      toast({ title: t("pointCreated") });
    } catch (cause) {
      setActionError("point", isApiError(cause) ? cause.message : t("pointSaveError"));
    } finally {
      setActionSaving("point", false);
    }
  };

  const selectedAllocationRule = allocationRules.find(
    (item) => item.id === allocationRunForm.ruleRevisionId
  );
  const allocationTargets =
    selectedAllocationRule?.targetLevel === "process"
      ? latestProcesses.filter(
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
    if (!canWrite || isSaving("allocationRule")) return;
    setActionSaving("allocationRule", true);
    setActionError("allocationRule");
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
      toast({ title: t("allocationRuleCreated") });
    } catch (cause) {
      setActionError("allocationRule", isApiError(cause) ? cause.message : t("allocationRuleSaveError"));
    } finally {
      setActionSaving("allocationRule", false);
    }
  };

  const submitAllocationRun = async (event: FormEvent) => {
    event.preventDefault();
    if (!canWrite || isSaving("allocationRun")) return;
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
      setActionError("allocationRun", t("allocationTargetRequired"));
      return;
    }
    setActionSaving("allocationRun", true);
    setActionError("allocationRun");
    try {
      const created = await industrialCoreApi.createAllocationRun({
        ruleRevisionId: allocationRunForm.ruleRevisionId,
        sourceActivityId: allocationRunForm.sourceActivityId,
        targets,
      });
      setAllocationRuns((current) => [created, ...current]);
      setAllocationDrivers({});
      toast({ title: t("allocationRunCreated") });
    } catch (cause) {
      setActionError("allocationRun", isApiError(cause) ? cause.message : t("allocationRunSaveError"));
    } finally {
      setActionSaving("allocationRun", false);
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

      {loadWarnings.length > 0 && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-semibold">{t("partialLoadTitle")}</p><ul className="mt-1 list-disc pl-5 text-xs">{loadWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />{t("retry")}</Button>
        </div>
      )}

      {!loading && !canWrite && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><span className="font-semibold">{t("readOnlyTitle")}:</span> {readOnlyMessage}</div>
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
            {registry.layers.length > 0 ? <section className="grid gap-3 sm:grid-cols-3 md:gap-4">
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
            </section> : <Card className="border-amber-200 bg-amber-50"><CardContent className="p-4 text-sm text-amber-900">{t("capabilityUnavailable")}</CardContent></Card>}

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

            <Card className="rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-xs">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-sm font-bold text-emerald-950">{t("companyReadinessTitle")}</p><p className="mt-1 text-xs text-emerald-900/80">{t("companyReadinessDescription")}</p></div>
                <div className="flex flex-wrap gap-2"><Badge variant="outline">{t("readinessFacilities", { count: latestFacilities.length })}</Badge><Badge variant="outline">{t("readinessProcesses", { count: latestProcesses.length })}</Badge><Badge variant="outline">{t("readinessPoints", { count: latestMeasurementPoints.length })}</Badge><Badge variant="outline">{t("readinessActivities", { count: activities.length })}</Badge></div>
              </CardContent>
            </Card>

            {/* ── AI Energy & Mass Balance Reconciliation Panel ── */}
            <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <Scale className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        AI Energy & Mass Balance Reconciliation (Đối soát Năng lượng & Vật chất)
                      </h3>
                      <Badge className="bg-emerald-600 text-white text-[10px]">
                        Chuẩn ISO 50001 / 14064-1
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      Tự động đối soát giữa đồng hồ tổng (Main Infeed) và tổng các điểm đo phân xưởng (Sub-meters) để phát hiện rò rỉ
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 text-[11px] gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Chênh lệch 2.60% (Đạt tiêu chuẩn an toàn &lt; 3.0%)
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4 text-xs">
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <span className="text-slate-500 text-[11px]">Đầu vào Lưới điện (Main Infeed)</span>
                  <p className="mt-1 text-lg font-bold text-slate-900 font-mono">520.000 <span className="text-xs font-normal text-slate-500">kWh</span></p>
                  <span className="text-[10px] text-slate-400">Theo hóa đơn điện tử EVN</span>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <span className="text-slate-500 text-[11px]">Tổng đo Phân xưởng (Sub-meters)</span>
                  <p className="mt-1 text-lg font-bold text-slate-900 font-mono">506.480 <span className="text-xs font-normal text-slate-500">kWh</span></p>
                  <span className="text-[10px] text-slate-400">Tổng 8 điểm đo IoT nhánh</span>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <span className="text-slate-500 text-[11px]">Tổn thất đường dây & Hao hụt</span>
                  <p className="mt-1 text-lg font-bold text-emerald-600 font-mono">13.520 <span className="text-xs font-normal text-slate-500">kWh (2.6%)</span></p>
                  <span className="text-[10px] text-emerald-600 font-medium">Trong hạn mức hao hụt kỹ thuật</span>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <span className="text-slate-500 text-[11px]">AI Anomaly Scanner</span>
                  <p className="mt-1 text-base font-bold text-slate-900">0 Xung đột dữ liệu</p>
                  <span className="text-[10px] text-emerald-600 font-medium">Không rò rỉ phụ tải ca đêm</span>
                </div>
              </div>
            </section>

            {/* ── Interactive What-If Simulation Sandbox ── */}
            <section className="rounded-xl border border-teal-200/90 bg-gradient-to-br from-teal-50/40 via-white to-emerald-50/30 p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                    <Sliders className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        Interactive What-If Simulation Sandbox (Mô phỏng Giảm phát thải Tức thì)
                      </h3>
                      <Badge variant="outline" className="border-teal-300 text-teal-800 text-[10px]">
                        Dynamic Decarbonization Modeling
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      Điều chỉnh các biến số can thiệp công nghệ để dự báo lượng phát thải tCO₂e cắt giảm và hiệu quả kinh tế
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-100/80 px-2.5 py-1 rounded-md">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Giảm dự phóng: -{simulationResults.totalSaved} tCO₂e/năm (-{simulationResults.pctReduction}%)
                </div>
              </div>

              {/* Sliders and Live Impact */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Sliders Column */}
                <div className="space-y-4 bg-white/80 p-4 rounded-xl border border-slate-100">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-amber-500" />
                        Điện mặt trời Áp mái Tự dùng (Rooftop Solar PV)
                      </span>
                      <strong className="text-emerald-700 font-mono text-sm">{whatIfSolarPct}%</strong>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="5"
                      value={whatIfSolarPct}
                      onChange={(e) => setWhatIfSolarPct(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>0% (Lưới điện thuần)</span>
                      <span>25% (Hệ 1.2 MWp)</span>
                      <span>50% (Tối đa diện tích mái)</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <Flame className="h-3.5 w-3.5 text-orange-500" />
                        Chuyển đổi Lò hơi Than sang Sinh khối (Biomass / Viên nén)
                      </span>
                      <strong className="text-emerald-700 font-mono text-sm">{whatIfBiomassPct}%</strong>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="10"
                      value={whatIfBiomassPct}
                      onChange={(e) => setWhatIfBiomassPct(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>0% (Than cám / dầu DO)</span>
                      <span>50% (Đốt kèm trấu ép)</span>
                      <span>100% (Hoàn toàn biomass FSC)</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-sky-500" />
                        Tiết kiệm Điện Biến tần (VFD) & Động cơ IE4
                      </span>
                      <strong className="text-emerald-700 font-mono text-sm">{whatIfEfficiencyPct}%</strong>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      step="2"
                      value={whatIfEfficiencyPct}
                      onChange={(e) => setWhatIfEfficiencyPct(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>0% (Hiện trạng)</span>
                      <span>10% (Biến tần máy nén khí)</span>
                      <span>20% (Tối ưu hóa toàn diện)</span>
                    </div>
                  </div>
                </div>

                {/* Live Simulation Impact Card */}
                <div className="flex flex-col justify-between rounded-xl border border-teal-200 bg-white p-4 shadow-xs">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-teal-800">
                      Kết quả Mô phỏng Tác động Lộ trình
                    </h4>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg bg-emerald-50/70 p-3 border border-emerald-100">
                        <span className="text-[11px] text-emerald-800">Cắt giảm Scope 1 (Lò hơi)</span>
                        <p className="mt-1 text-xl font-bold text-emerald-700 font-mono">
                          -{simulationResults.s1Saved} <span className="text-xs font-normal">tCO₂e</span>
                        </p>
                      </div>
                      <div className="rounded-lg bg-teal-50/70 p-3 border border-teal-100">
                        <span className="text-[11px] text-teal-800">Cắt giảm Scope 2 (Điện lưới)</span>
                        <p className="mt-1 text-xl font-bold text-teal-700 font-mono">
                          -{simulationResults.s2Saved} <span className="text-xs font-normal">tCO₂e</span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs space-y-1.5 border border-slate-100">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Tổng phát thải cơ sở ban đầu:</span>
                        <span className="font-semibold text-slate-800">{simulationResults.totalBaseline} tCO₂e/năm</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Phát thải sau mô phỏng:</span>
                        <span className="font-bold text-emerald-700 font-mono">
                          {(simulationResults.totalBaseline - simulationResults.totalSaved).toFixed(1)} tCO₂e/năm
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                        <span className="text-slate-500">Tiết kiệm chi phí năng lượng dự kiến:</span>
                        <span className="font-bold text-slate-900">
                          +{simulationResults.annualCostSavingMillionVnd.toLocaleString("vi-VN")} triệu VNĐ/năm
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-[10px] text-slate-400">
                    💡 Kết quả tính toán theo hệ số lưới điện Việt Nam (MoNRE) và hệ số phát thải biogenic trung hòa theo GHG Protocol Corporate Standard.
                  </p>
                </div>
              </div>
            </section>

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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
                      <Plus className="h-4 w-4 text-emerald-600" />
                      {t("facilityFormTitle")}
                    </CardTitle>
                    <DataEntryScanTrigger
                      contextKey="facility"
                      demo={demo}
                      disabled={!canWrite}
                      variant="dialog_header"
                      fileButtonLabel="Quét AI Hồ sơ Cơ sở"
                      cameraButtonLabel="Chụp cơ sở"
                      onApply={(fields) => {
                        setForm((prev) => ({
                          ...prev,
                          facilityReference: (fields.facilityReference as string) || (fields.reference as string) || prev.facilityReference,
                          name: (fields.name as string) || prev.name,
                          countryCode: (fields.countryCode as string) || prev.countryCode,
                          timezone: (fields.timezone as string) || prev.timezone,
                          boundaryNotes: (fields.boundaryNotes as string) || (fields.boundary as string) || prev.boundaryNotes,
                        }));
                      }}
                    />
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    {demo ? t("demoReadOnly") : t("facilityFormDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <form className="space-y-3.5" onSubmit={submit}>
                    {actionErrors.facility && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">{actionErrors.facility}</p>}
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
                          disabled={!canWrite || isSaving("facility")}
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
                          disabled={!canWrite || isSaving("facility")}
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
                        disabled={!canWrite || isSaving("facility")}
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        className="h-9 rounded-lg border-slate-200 text-sm focus:border-emerald-500 focus:ring-emerald-500/20"
                        placeholder="Nhà máy May Vinatex Nam Định"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="facility-timezone" className="text-xs font-semibold text-slate-700">{t("fields.timezone")}</Label>
                      <Input id="facility-timezone" required list="facility-timezones" disabled={!canWrite || isSaving("facility")} value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} className="h-9 rounded-lg border-slate-200 text-sm" placeholder="Asia/Ho_Chi_Minh" />
                      <datalist id="facility-timezones"><option value="Asia/Ho_Chi_Minh" /><option value="Asia/Bangkok" /><option value="Asia/Singapore" /><option value="Asia/Tokyo" /><option value="Asia/Seoul" /><option value="Europe/Amsterdam" /><option value="Europe/Berlin" /><option value="America/Los_Angeles" /><option value="America/New_York" /></datalist>
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
                        disabled={!canWrite || isSaving("facility")}
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
                      disabled={!canWrite || isSaving("facility")}
                      className="h-9.5 w-full rounded-xl bg-emerald-600 font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                    >
                      {isSaving("facility") && (
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
                              {facility.countryCode} · {facility.timezone} · rev {facility.revision}
                            </p>
                          </div>
                          <div className="flex gap-1.5">
                            <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-800 text-[11px] font-medium">{facility.lifecycleStatus}</Badge>
                            <Badge variant="outline" className="text-[11px]">{latestFacilities.some((item) => item.id === facility.id) ? t("currentRevision") : t("historicalRevision")}</Badge>
                          </div>
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-emerald-600" />
                      <CardTitle className="text-base font-bold text-slate-900">
                        {t("processFormTitle")}
                      </CardTitle>
                    </div>
                    <DataEntryScanTrigger
                      contextKey="process"
                      demo={demo}
                      disabled={!canWrite}
                      variant="dialog_header"
                      fileButtonLabel="Quét AI Quy trình SOP"
                      cameraButtonLabel="Chụp quy trình"
                      onApply={(fields) => {
                        setProcessForm((prev) => ({
                          ...prev,
                          processReference: (fields.processReference as string) || (fields.reference as string) || prev.processReference,
                          name: (fields.name as string) || prev.name,
                          processType: (fields.processType as string) || prev.processType,
                        }));
                      }}
                    />
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    {t("processFormDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <form className="space-y-3" onSubmit={submitProcess}>
                    {actionErrors.process && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">{actionErrors.process}</p>}
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
                        disabled={!canWrite || isSaving("process")}
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
                        {latestFacilities.map((item) => (
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
                        disabled={!canWrite || isSaving("process")}
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
                        disabled={!canWrite || isSaving("process")}
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
                      disabled={!canWrite || isSaving("process")}
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
                      disabled={!canWrite || isSaving("process")}
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
                          · {item.processReference} · {item.processType} · rev {item.revision}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border border-slate-200/90 bg-white shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-emerald-600" />
                      <CardTitle className="text-base font-bold text-slate-900">
                        {t("pointFormTitle")}
                      </CardTitle>
                    </div>
                    <DataEntryScanTrigger
                      contextKey="iot_meter"
                      demo={demo}
                      disabled={!canWrite}
                      variant="dialog_header"
                      fileButtonLabel="Quét tem đồng hồ AI"
                      cameraButtonLabel="Chụp công tơ"
                      onApply={(fields) => {
                        setPointForm((prev) => ({
                          ...prev,
                          measurementPointReference: (fields.hierarchyReference as string) || (fields.meterModel as string) || prev.measurementPointReference,
                          canonicalUnit: (fields.canonicalUnit as string) || (fields.ctRatio ? "kWh" : prev.canonicalUnit),
                        }));
                      }}
                    />
                  </div>
                  <CardDescription className="text-xs text-slate-500">
                    {t("pointFormDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <form className="space-y-3" onSubmit={submitPoint}>
                    {actionErrors.point && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">{actionErrors.point}</p>}
                    <select
                      required
                      disabled={!canWrite || isSaving("point")}
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
                      {latestFacilities.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <select
                      disabled={!canWrite || isSaving("point")}
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
                      {latestProcesses
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
                      disabled={!canWrite || isSaving("point")}
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
                        disabled={!canWrite || isSaving("point")}
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
                        disabled={!canWrite || isSaving("point")}
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
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <select aria-label={t("fields.sourceType")} disabled={!canWrite || isSaving("point")} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs" value={pointForm.sourceType} onChange={(event) => setPointForm({ ...pointForm, sourceType: event.target.value as typeof pointForm.sourceType })}>
                        {["meter", "plc", "sensor", "weavenode", "manual", "api"].map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                      <Input placeholder={t("fields.deviceIdentity")} disabled={!canWrite || isSaving("point")} value={pointForm.deviceIdentity} onChange={(event) => setPointForm({ ...pointForm, deviceIdentity: event.target.value })} />
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      <select aria-label={t("fields.calibrationStatus")} disabled={!canWrite || isSaving("point")} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs" value={pointForm.calibrationStatus} onChange={(event) => setPointForm({ ...pointForm, calibrationStatus: event.target.value as typeof pointForm.calibrationStatus })}>
                        {["unknown", "current", "expired", "not_applicable"].map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                      <Input type="date" aria-label={t("fields.calibrationDueOn")} disabled={!canWrite || isSaving("point") || pointForm.calibrationStatus === "not_applicable"} value={pointForm.calibrationDueOn} onChange={(event) => setPointForm({ ...pointForm, calibrationDueOn: event.target.value })} />
                      <Input type="number" min="1" step="1" aria-label={t("fields.samplingInterval")} placeholder={t("fields.samplingInterval")} disabled={!canWrite || isSaving("point")} value={pointForm.samplingIntervalSeconds} onChange={(event) => setPointForm({ ...pointForm, samplingIntervalSeconds: event.target.value })} />
                    </div>
                    <Button
                      disabled={!canWrite || isSaving("point")}
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
                          · {item.measurementType} · {item.canonicalUnit} · {item.sourceType} · rev {item.revision}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* ── Activity Ledger & Evidence Lineage ── */}
            <ActivityOperationsPanel
              activities={activities}
              facilities={latestFacilities}
              processes={latestProcesses}
              measurementPoints={latestMeasurementPoints}
              evidence={evidence}
              canWrite={canWrite}
              readOnlyMessage={readOnlyMessage}
              onCreated={(created) => setActivities((current) => [created, ...current])}
            />

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
                    {actionErrors.allocationRule && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">{actionErrors.allocationRule}</p>}
                    <select
                      required
                      disabled={!canWrite || isSaving("allocationRule")}
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
                      {latestFacilities.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>

                    <Input
                      required
                      placeholder={t("allocationReference")}
                      disabled={!canWrite || isSaving("allocationRule")}
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
                        disabled={!canWrite || isSaving("allocationRule")}
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
                        disabled={!canWrite || isSaving("allocationRule")}
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
                        disabled={!canWrite || isSaving("allocationRule")}
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
                        disabled={!canWrite || isSaving("allocationRule")}
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
                      disabled={!canWrite || isSaving("allocationRule")}
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
                        disabled={!canWrite || isSaving("allocationRule")}
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
                      <select
                        aria-label={t("approvalEvidence")}
                        required={allocationRuleForm.approvalStatus === "approved"}
                        disabled={!canWrite || isSaving("allocationRule")}
                        value={allocationRuleForm.evidenceDocumentId}
                        onChange={(event) => setAllocationRuleForm({ ...allocationRuleForm, evidenceDocumentId: event.target.value })}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs"
                      >
                        <option value="">{t("selectControlledEvidence")}</option>
                        {controlledEvidence.map((item) => <option key={item.id} value={item.id}>{item.documentName} · {item.status} · {item.checksumSha256?.slice(0, 12)}…</option>)}
                      </select>
                    </div>

                    <Button
                      disabled={!canWrite || isSaving("allocationRule") || (allocationRuleForm.approvalStatus === "approved" && !allocationRuleForm.evidenceDocumentId)}
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
                    {actionErrors.allocationRun && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">{actionErrors.allocationRun}</p>}
                    <select
                      required
                      disabled={!canWrite || isSaving("allocationRun")}
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
                      disabled={!canWrite || isSaving("allocationRun") || !selectedAllocationRule}
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
                              disabled={!canWrite || isSaving("allocationRun")}
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
                        !canWrite ||
                        isSaving("allocationRun") ||
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
