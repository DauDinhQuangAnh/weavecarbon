"use client";

import React from "react";
import {
  Activity,
  ArrowUpRight,
  Bug,
  Clock3,
  FileJson,
  MonitorPlay,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  ANALYTICS_EVENT_NAMES,
  getAnalyticsRuntimeState,
  prepareAnalyticsEvent,
  prepareAnalyticsPageView,
  resolveAnalyticsPageGroup,
  type AnalyticsEventNameV2,
  type AnalyticsPayloadMapV2,
  type AnalyticsRuntimeState,
  type AnalyticsUserProperties
} from "@/lib/analytics";
import {
  ANALYTICS_LAB_DEFAULT_EVENT,
  ANALYTICS_LAB_UNSET_VALUE,
  createAnalyticsLabIdentity,
  getAnalyticsLabDefaultEventPayload,
  getAnalyticsLabDefaultPagePath,
  parseAnalyticsLabPayloadObject,
  stringifyAnalyticsLabJson
} from "@/tools/analytics-lab/presets";
import {
  ANALYTICS_LAB_SOURCE_PATH,
  AnalyticsLabSessionJob,
  AnalyticsLabSessionResult,
  AnalyticsLabSessionStep,
  buildAnalyticsLabJobUrl,
  createAnalyticsLabJobId,
  createAnalyticsLabStepId,
  normalizeAnalyticsLabPath,
  readAnalyticsLabResult,
  removeAnalyticsLabJob,
  removeAnalyticsLabResult,
  writeAnalyticsLabJob,
  writeAnalyticsLabResult
} from "@/tools/analytics-lab/storage";

const buildPendingResult = (job: AnalyticsLabSessionJob): AnalyticsLabSessionResult => ({
  activeStepIndex: 0,
  completedStepCount: 0,
  id: job.id,
  currentPath: normalizeAnalyticsLabPath(job.steps[0]?.targetPath),
  debugMode: job.debugMode,
  status: "pending",
  stepResults: job.steps.map((step, stepIndex) => ({
    currentPath: "",
    debugMode: job.debugMode,
    eventName: step.eventName,
    eventSent: false,
    pageViewSent: false,
    status: "pending",
    stepId: step.id,
    stepIndex,
    targetPath: normalizeAnalyticsLabPath(step.targetPath),
    updatedAt: job.createdAt
  })),
  stepsTotal: job.steps.length,
  updatedAt: new Date().toISOString()
});

interface AnalyticsLabDraftStep {
  dwellMs: number;
  eventName: AnalyticsEventNameV2;
  eventPayload: Record<string, unknown>;
  targetPath: string;
}

const normalizePlanSkuLimit = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Plan SKU limit must be a non-negative number.");
  }

  return Math.max(0, Math.round(parsed));
};

const normalizeDraftDwellMs = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 1200;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Dwell time must be a non-negative number.");
  }

  return Math.max(0, Math.round(parsed));
};

const parseSequenceStepsInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      error: "Sequence JSON cannot be empty.",
      steps: null as AnalyticsLabDraftStep[] | null
    };
  }

  const parsed = JSON.parse(trimmed);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Sequence JSON must be a non-empty array.");
  }

  const steps = parsed.map((rawStep, stepIndex) => {
    if (!rawStep || typeof rawStep !== "object" || Array.isArray(rawStep)) {
      throw new Error(`Step ${stepIndex + 1} must be an object.`);
    }

    const candidateEventName = String((rawStep as { eventName?: unknown }).eventName || "").trim();
    if (!ANALYTICS_EVENT_NAMES.includes(candidateEventName as AnalyticsEventNameV2)) {
      throw new Error(`Step ${stepIndex + 1} has an invalid eventName.`);
    }

    const candidateTargetPath = normalizeAnalyticsLabPath(
      (rawStep as { targetPath?: unknown }).targetPath as string | undefined
    );
    const candidatePayload = (rawStep as { eventPayload?: unknown }).eventPayload;
    if (
      typeof candidatePayload !== "undefined" &&
      (!candidatePayload || typeof candidatePayload !== "object" || Array.isArray(candidatePayload))
    ) {
      throw new Error(`Step ${stepIndex + 1} eventPayload must be an object.`);
    }

    const candidateDwellMs = normalizeDraftDwellMs(
      String((rawStep as { dwellMs?: unknown }).dwellMs ?? "1200")
    );

    return {
      dwellMs: candidateDwellMs,
      eventName: candidateEventName as AnalyticsEventNameV2,
      eventPayload: (candidatePayload as Record<string, unknown> | undefined) || {},
      targetPath: candidateTargetPath
    } satisfies AnalyticsLabDraftStep;
  });

  return {
    error: "",
    steps
  };
};

const INITIAL_RUNTIME_STATE: AnalyticsRuntimeState = {
  measurementId: "",
  hasMeasurementId: false,
  hasGtag: false,
  isProductionRuntime: false,
  canTrackDefault: false,
  canTrackWithDebugOverride: false
};

const DEFAULT_ANALYTICS_LAB_USER_ID = "lab_user_demo";
const DEFAULT_ANALYTICS_LAB_COMPANY_KEY = "lab_company_demo";
const LEGACY_RANDOM_USER_ID_PATTERN = /^lab_user_[a-z0-9]+_[a-z0-9]+$/i;
const LEGACY_RANDOM_COMPANY_KEY_PATTERN = /^lab_company_[a-z0-9]+_[a-z0-9]+$/i;

export default function AnalyticsLabConsole() {
  const [hasHydrated, setHasHydrated] = React.useState(false);
  const [runtimeState, setRuntimeState] = React.useState<AnalyticsRuntimeState>(
    INITIAL_RUNTIME_STATE
  );
  const [selectedEvent, setSelectedEvent] = React.useState<AnalyticsEventNameV2>(
    ANALYTICS_LAB_DEFAULT_EVENT
  );
  const [targetPath, setTargetPath] = React.useState(
    getAnalyticsLabDefaultPagePath(ANALYTICS_LAB_DEFAULT_EVENT)
  );
  const [eventPayloadInput, setEventPayloadInput] = React.useState(
    getAnalyticsLabDefaultEventPayload(ANALYTICS_LAB_DEFAULT_EVENT)
  );
  const [sequenceMode, setSequenceMode] = React.useState(false);
  const [sequenceInput, setSequenceInput] = React.useState("");
  const [debugMode, setDebugMode] = React.useState(true);
  const [dwellMs, setDwellMs] = React.useState("1200");
  const [autoCloseWindow, setAutoCloseWindow] = React.useState(true);

  const [userId, setUserId] = React.useState(DEFAULT_ANALYTICS_LAB_USER_ID);
  const [companyKey, setCompanyKey] = React.useState(DEFAULT_ANALYTICS_LAB_COMPANY_KEY);
  const [locale, setLocale] = React.useState("vi");
  const [accountType, setAccountType] = React.useState("b2b");
  const [companyRole, setCompanyRole] = React.useState("root");
  const [isDemo, setIsDemo] = React.useState(true);
  const [planFamily, setPlanFamily] = React.useState("standard");
  const [planSkuLimit, setPlanSkuLimit] = React.useState("20");
  const [businessType, setBusinessType] = React.useState("factory");
  const [domesticMarket, setDomesticMarket] = React.useState("VN");

  const [activeJobId, setActiveJobId] = React.useState("");
  const [lastSessionResult, setLastSessionResult] = React.useState<AnalyticsLabSessionResult | null>(
    null
  );

  const refreshRuntimeState = React.useCallback(() => {
    setRuntimeState(getAnalyticsRuntimeState());
  }, []);

  React.useEffect(() => {
    setHasHydrated(true);
    refreshRuntimeState();
  }, [refreshRuntimeState]);

  React.useEffect(() => {
    if (LEGACY_RANDOM_USER_ID_PATTERN.test(userId)) {
      setUserId(DEFAULT_ANALYTICS_LAB_USER_ID);
    }

    if (LEGACY_RANDOM_COMPANY_KEY_PATTERN.test(companyKey)) {
      setCompanyKey(DEFAULT_ANALYTICS_LAB_COMPANY_KEY);
    }
  }, [companyKey, userId]);

  React.useEffect(() => {
    if (!activeJobId) {
      return;
    }

    const syncResult = () => {
      setLastSessionResult(readAnalyticsLabResult(activeJobId));
    };

    syncResult();

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || !event.key.endsWith(activeJobId)) {
        return;
      }

      syncResult();
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [activeJobId]);

  const normalizedTargetPath = React.useMemo(
    () => normalizeAnalyticsLabPath(targetPath),
    [targetPath]
  );

  const resolvedPageGroup = React.useMemo(
    () => resolveAnalyticsPageGroup(normalizedTargetPath),
    [normalizedTargetPath]
  );

  const payloadParseState = React.useMemo(() => {
    try {
      const parsedPayload = parseAnalyticsLabPayloadObject(eventPayloadInput);
      return {
        parsedPayload,
        error: ""
      };
    } catch (error) {
      return {
        parsedPayload: null,
        error: error instanceof Error ? error.message : "Invalid payload JSON."
      };
    }
  }, [eventPayloadInput]);

  const previewPayload = React.useMemo(() => {
    if (!payloadParseState.parsedPayload) {
      return null;
    }

    return {
      ...payloadParseState.parsedPayload,
      page_path: normalizedTargetPath
    } as AnalyticsPayloadMapV2[AnalyticsEventNameV2];
  }, [normalizedTargetPath, payloadParseState.parsedPayload]);

  React.useEffect(() => {
    if (!sequenceMode || sequenceInput.trim().length > 0 || !payloadParseState.parsedPayload) {
      return;
    }

    try {
      const singleStepSeed = [
        {
          dwellMs: normalizeDraftDwellMs(dwellMs),
          eventName: selectedEvent,
          eventPayload: payloadParseState.parsedPayload,
          targetPath: normalizedTargetPath
        }
      ];
      setSequenceInput(stringifyAnalyticsLabJson(singleStepSeed));
    } catch {
      // Ignore seed generation until the current single-step inputs are valid.
    }
  }, [
    dwellMs,
    normalizedTargetPath,
    payloadParseState.parsedPayload,
    selectedEvent,
    sequenceInput,
    sequenceMode
  ]);

  const sequenceParseState = React.useMemo(() => {
    if (!sequenceMode) {
      return {
        error: "",
        steps: null as AnalyticsLabDraftStep[] | null
      };
    }

    try {
      return parseSequenceStepsInput(sequenceInput);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Invalid sequence JSON.",
        steps: null as AnalyticsLabDraftStep[] | null
      };
    }
  }, [sequenceInput, sequenceMode]);

  const singleStepDraft = React.useMemo(() => {
    if (!previewPayload) {
      return null;
    }

    try {
      return {
        dwellMs: normalizeDraftDwellMs(dwellMs),
        eventName: selectedEvent,
        eventPayload: payloadParseState.parsedPayload || {},
        targetPath: normalizedTargetPath
      } satisfies AnalyticsLabDraftStep;
    } catch {
      return null;
    }
  }, [dwellMs, normalizedTargetPath, payloadParseState.parsedPayload, previewPayload, selectedEvent]);

  const resolvedDraftSteps = React.useMemo(() => {
    if (sequenceMode) {
      return sequenceParseState.steps || [];
    }

    return singleStepDraft ? [singleStepDraft] : [];
  }, [sequenceMode, sequenceParseState.steps, singleStepDraft]);

  const sequencePreview = React.useMemo(() => {
    if (!hasHydrated) {
      return null;
    }

    return resolvedDraftSteps.map((step, stepIndex) => {
      const normalizedStepPath = normalizeAnalyticsLabPath(step.targetPath);
      const resolvedStepPageGroup = resolveAnalyticsPageGroup(normalizedStepPath);
      const eventPayload = {
        ...step.eventPayload,
        page_path: normalizedStepPath
      } as AnalyticsPayloadMapV2[typeof step.eventName];

      return {
        dwellMs: step.dwellMs,
        eventName: step.eventName,
        pageGroup: resolvedStepPageGroup,
        pageViewPrepared: prepareAnalyticsPageView(resolvedStepPageGroup, normalizedStepPath, {
          debugMode
        }),
        preparedEvent: prepareAnalyticsEvent(step.eventName, eventPayload, {
          debugMode
        }),
        stepIndex: stepIndex + 1,
        targetPath: normalizedStepPath
      };
    });
  }, [debugMode, hasHydrated, resolvedDraftSteps]);

  const handleGenerateIdentity = React.useCallback(() => {
    setUserId(createAnalyticsLabIdentity("lab_user"));
    setCompanyKey(createAnalyticsLabIdentity("lab_company"));
    toast.success("Generated a new fake analytics identity.");
  }, []);

  const applyEventPreset = React.useCallback((eventName: AnalyticsEventNameV2) => {
    setSelectedEvent(eventName);
    setTargetPath(getAnalyticsLabDefaultPagePath(eventName));
    setEventPayloadInput(getAnalyticsLabDefaultEventPayload(eventName));
  }, []);

  const buildUserProperties = React.useCallback(() => {
    const normalizedProperties: AnalyticsUserProperties = {
      locale: locale.trim() || null,
      accountType:
        accountType === ANALYTICS_LAB_UNSET_VALUE ?
          null :
          (accountType as "admin" | "b2b" | "b2c"),
      companyRole:
        companyRole === ANALYTICS_LAB_UNSET_VALUE ?
          null :
          (companyRole as "root" | "member" | "viewer"),
      isDemo,
      planFamily:
        planFamily === ANALYTICS_LAB_UNSET_VALUE ?
          null :
          (planFamily as "export" | "free" | "standard" | "trial"),
      planSkuLimit: normalizePlanSkuLimit(planSkuLimit),
      businessType: businessType === ANALYTICS_LAB_UNSET_VALUE ? null : businessType,
      domesticMarket: domesticMarket.trim() || null
    };

    return normalizedProperties;
  }, [
    accountType,
    businessType,
    companyRole,
    domesticMarket,
    isDemo,
    locale,
    planFamily,
    planSkuLimit
  ]);

  const userPropertiesPreview = React.useMemo(() => {
    try {
      return buildUserProperties();
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Invalid user properties."
      };
    }
  }, [buildUserProperties]);

  const handleRunSession = React.useCallback(() => {
    if (sequenceMode) {
      if (sequenceParseState.error || resolvedDraftSteps.length === 0) {
        toast.error(sequenceParseState.error || "Fix the sequence JSON before running the session.");
        return;
      }
    } else if (payloadParseState.error || !singleStepDraft) {
      toast.error(payloadParseState.error || "Fix the payload JSON before running the session.");
      return;
    }

    if (!runtimeState.hasMeasurementId) {
      toast.error("Missing NEXT_PUBLIC_GA_MEASUREMENT_ID, so no GA4 hit can be sent.");
      return;
    }

    try {
      const sessionSteps = (sequenceMode ? resolvedDraftSteps : singleStepDraft ? [singleStepDraft] : [])
        .map((step) => ({
          dwellMs: step.dwellMs,
          eventName: step.eventName,
          eventPayload: step.eventPayload,
          id: createAnalyticsLabStepId(),
          targetPath: normalizeAnalyticsLabPath(step.targetPath)
        })) satisfies AnalyticsLabSessionStep[];

      if (sessionSteps.length === 0) {
        throw new Error("At least one analytics step is required.");
      }

      const job: AnalyticsLabSessionJob = {
        id: createAnalyticsLabJobId(),
        autoCloseWindow,
        createdAt: new Date().toISOString(),
        debugMode,
        identity: {
          userId: userId.trim() || null,
          companyKey: companyKey.trim() || null
        },
        sourcePath: ANALYTICS_LAB_SOURCE_PATH,
        steps: sessionSteps,
        userProperties: buildUserProperties()
      };

      const pendingResult = buildPendingResult(job);
      writeAnalyticsLabJob(job);
      writeAnalyticsLabResult(pendingResult);
      setActiveJobId(job.id);
      setLastSessionResult(pendingResult);

      const targetUrl = buildAnalyticsLabJobUrl(window.location.origin, job);
      const runnerWindow = window.open(
        targetUrl,
        "weavecarbon-analytics-lab-runner",
        "popup=yes,width=1440,height=960,scrollbars=yes,resizable=yes"
      );

      if (!runnerWindow) {
        throw new Error("Popup was blocked. Allow popups for this site and try again.");
      }

      toast.success(
        `Opened step 1 of ${sessionSteps.length} in a real app window to run the session.`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start analytics session.");
    }
  }, [
    autoCloseWindow,
    buildUserProperties,
    debugMode,
    payloadParseState.error,
    resolvedDraftSteps,
    runtimeState.hasMeasurementId,
    sequenceMode,
    sequenceParseState.error,
    singleStepDraft,
    userId,
    companyKey
  ]);

  const handleRefreshSessionResult = React.useCallback(() => {
    if (!activeJobId) {
      toast.error("No active analytics lab session yet.");
      return;
    }

    setLastSessionResult(readAnalyticsLabResult(activeJobId));
    toast.success("Refreshed session result.");
  }, [activeJobId]);

  const handleClearSessionArtifacts = React.useCallback(() => {
    if (!activeJobId) {
      return;
    }

    removeAnalyticsLabJob(activeJobId);
    removeAnalyticsLabResult(activeJobId);
    setActiveJobId("");
    setLastSessionResult(null);
    toast.success("Cleared stored analytics lab session data.");
  }, [activeJobId]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_38%),linear-gradient(180deg,_#f8fbff_0%,_#f4f7fb_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <Card className="border-sky-200/70 bg-white/90 shadow-lg shadow-sky-100/60 backdrop-blur">
          <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sky-700">
                <Bug className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-[0.2em]">
                  Analytics Tooling
                </span>
              </div>
              <CardTitle className="text-3xl font-semibold text-slate-950">
                Real-route analytics lab
              </CardTitle>
              <CardDescription className="max-w-3xl text-sm text-slate-600">
                This tool opens the actual app route in a separate window, lets that page emit its
                own `page_view`, then fires the target event after a short dwell time so the
                session looks like a real user journey.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={runtimeState.hasMeasurementId ? "border-emerald-300" : "border-rose-300"}>
                Measurement ID {runtimeState.hasMeasurementId ? "ready" : "missing"}
              </Badge>
              <Badge
                variant="outline"
                className={runtimeState.hasGtag ? "border-emerald-300" : "border-amber-300"}>
                gtag {runtimeState.hasGtag ? "loaded" : "not ready"}
              </Badge>
              <Badge variant="outline">
                Runtime {runtimeState.isProductionRuntime ? "production" : "non-production"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button type="button" onClick={handleRunSession}>
              <MonitorPlay className="mr-2 h-4 w-4" />
              Run realistic session
            </Button>
            <Button type="button" onClick={handleGenerateIdentity} variant="outline">
              <Sparkles className="mr-2 h-4 w-4" />
              Generate fake identity
            </Button>
            <Button type="button" onClick={refreshRuntimeState} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh runtime
            </Button>
            <Button type="button" onClick={handleRefreshSessionResult} variant="outline">
              <Activity className="mr-2 h-4 w-4" />
              Refresh session result
            </Button>
            <Button type="button" onClick={handleClearSessionArtifacts} variant="outline">
              Clear session cache
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1.35fr]">
          <Card className="border-slate-200 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl text-slate-950">Simulated User Context</CardTitle>
              <CardDescription>
                These values are injected into the real target page before the session event is
                sent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="analytics-user-id">User ID</Label>
                  <Input
                    id="analytics-user-id"
                    value={userId}
                    onChange={(event) => setUserId(event.target.value)}
                    placeholder="lab_user_..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="analytics-company-key">Company key</Label>
                  <Input
                    id="analytics-company-key"
                    value={companyKey}
                    onChange={(event) => setCompanyKey(event.target.value)}
                    placeholder="lab_company_..." />
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="analytics-locale">Locale</Label>
                  <Input
                    id="analytics-locale"
                    value={locale}
                    onChange={(event) => setLocale(event.target.value)}
                    placeholder="vi" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="analytics-domestic-market">Domestic market</Label>
                  <Input
                    id="analytics-domestic-market"
                    value={domesticMarket}
                    onChange={(event) => setDomesticMarket(event.target.value)}
                    placeholder="VN" />
                </div>
                <div className="space-y-2">
                  <Label>Account type</Label>
                  <Select value={accountType} onValueChange={setAccountType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANALYTICS_LAB_UNSET_VALUE}>Unset</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                      <SelectItem value="b2b">b2b</SelectItem>
                      <SelectItem value="b2c">b2c</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Company role</Label>
                  <Select value={companyRole} onValueChange={setCompanyRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select company role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANALYTICS_LAB_UNSET_VALUE}>Unset</SelectItem>
                      <SelectItem value="root">root</SelectItem>
                      <SelectItem value="member">member</SelectItem>
                      <SelectItem value="viewer">viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plan family</Label>
                  <Select value={planFamily} onValueChange={setPlanFamily}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select plan family" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANALYTICS_LAB_UNSET_VALUE}>Unset</SelectItem>
                      <SelectItem value="free">free</SelectItem>
                      <SelectItem value="trial">trial</SelectItem>
                      <SelectItem value="standard">standard</SelectItem>
                      <SelectItem value="export">export</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="analytics-plan-sku-limit">Plan SKU limit</Label>
                  <Input
                    id="analytics-plan-sku-limit"
                    inputMode="numeric"
                    value={planSkuLimit}
                    onChange={(event) => setPlanSkuLimit(event.target.value)}
                    placeholder="20" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Business type</Label>
                  <Select value={businessType} onValueChange={setBusinessType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select business type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANALYTICS_LAB_UNSET_VALUE}>Unset</SelectItem>
                      <SelectItem value="brand">brand</SelectItem>
                      <SelectItem value="factory">factory</SelectItem>
                      <SelectItem value="shop_online">shop_online</SelectItem>
                      <SelectItem value="unknown">unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <Checkbox
                    id="analytics-is-demo"
                    checked={isDemo}
                    onCheckedChange={(checked) => setIsDemo(checked === true)} />
                  <div className="space-y-1">
                    <Label htmlFor="analytics-is-demo" className="text-sm font-medium text-slate-900">
                      Mark session as demo
                    </Label>
                    <p className="text-xs text-slate-500">Sets `is_demo` in the test session.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <Checkbox
                    id="analytics-debug-mode"
                    checked={debugMode}
                    onCheckedChange={(checked) => setDebugMode(checked === true)} />
                  <div className="space-y-1">
                    <Label
                      htmlFor="analytics-debug-mode"
                      className="text-sm font-medium text-slate-900">
                      Attach `debug_mode`
                    </Label>
                    <p className="text-xs text-slate-500">
                      Helps when checking GA4 DebugView.
                    </p>
                  </div>
                </div>

                {sequenceMode ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Each sequence step controls its own `dwellMs`, so the single-step dwell input
                    is hidden while multi-step mode is active.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="analytics-dwell-ms">Dwell time before event</Label>
                    <Input
                      id="analytics-dwell-ms"
                      inputMode="numeric"
                      value={dwellMs}
                      onChange={(event) => setDwellMs(event.target.value)}
                      placeholder="1200" />
                  </div>
                )}

                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <Checkbox
                    id="analytics-auto-close"
                    checked={autoCloseWindow}
                    onCheckedChange={(checked) => setAutoCloseWindow(checked === true)} />
                  <div className="space-y-1">
                    <Label
                      htmlFor="analytics-auto-close"
                      className="text-sm font-medium text-slate-900">
                      Auto-close runner window
                    </Label>
                    <p className="text-xs text-slate-500">
                      Close the target window after the session finishes.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl text-slate-950">Session Builder</CardTitle>
              <CardDescription>
                Choose the actual route to open, then define the event that should happen on that
                page after the visit starts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Checkbox
                  id="analytics-sequence-mode"
                  checked={sequenceMode}
                  onCheckedChange={(checked) => setSequenceMode(checked === true)} />
                <div className="space-y-1">
                  <Label
                    htmlFor="analytics-sequence-mode"
                    className="text-sm font-medium text-slate-900">
                    Run multiple steps
                  </Label>
                  <p className="text-xs text-slate-500">
                    Keep it off for one event. Turn it on to run a full chain across several real
                    routes.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-2">
                  <Label>Event name</Label>
                  <Select value={selectedEvent} onValueChange={(value) => applyEventPreset(value as AnalyticsEventNameV2)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an analytics event" />
                    </SelectTrigger>
                    <SelectContent>
                      {ANALYTICS_EVENT_NAMES.map((eventName) => (
                        <SelectItem key={eventName} value={eventName}>
                          {eventName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="analytics-target-path">Real target path</Label>
                  <Input
                    id="analytics-target-path"
                    value={targetPath}
                    onChange={(event) => setTargetPath(event.target.value)}
                    placeholder="/reports" />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">page_group: {resolvedPageGroup}</Badge>
                <Badge variant="secondary">runner path: {normalizedTargetPath}</Badge>
                <Badge variant="secondary">tool path: {ANALYTICS_LAB_SOURCE_PATH}</Badge>
                <Badge variant="secondary">steps: {resolvedDraftSteps.length || 0}</Badge>
              </div>

              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                {sequenceMode ? (
                  <>
                    Flow: step through each route in the JSON array
                    <ArrowUpRight className="mx-1 inline h-4 w-4" />
                    send `page_view` on that real page
                    <Clock3 className="mx-1 inline h-4 w-4" />
                    wait that step&apos;s `dwellMs`
                    <Activity className="mx-1 inline h-4 w-4" />
                    then send its event before moving to the next step.
                  </>
                ) : (
                  <>
                    Flow: open real page <ArrowUpRight className="mx-1 inline h-4 w-4" />
                    send `page_view` there <Clock3 className="mx-1 inline h-4 w-4" />
                    wait {dwellMs || "1200"}ms <Activity className="mx-1 inline h-4 w-4" />
                    send `{selectedEvent}` from that page.
                  </>
                )}
              </div>

              {sequenceMode ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="analytics-sequence-json">Sequence JSON</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSequenceInput(
                          stringifyAnalyticsLabJson(
                            singleStepDraft ? [singleStepDraft] : resolvedDraftSteps
                          )
                        )
                      }>
                      Seed from current step
                    </Button>
                  </div>
                  <Textarea
                    id="analytics-sequence-json"
                    value={sequenceInput}
                    onChange={(event) => setSequenceInput(event.target.value)}
                    className="min-h-[320px] font-mono text-xs"
                    spellCheck={false} />
                  {sequenceParseState.error ? (
                    <p className="text-sm text-rose-600">{sequenceParseState.error}</p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Expected shape:{" "}
                      <code>
                        {'[{"targetPath":"/reports","dwellMs":1200,"eventName":"wc_report_generated","eventPayload":{...}}]'}
                      </code>
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="analytics-event-payload">Event payload JSON</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => applyEventPreset(selectedEvent)}>
                      Reset preset
                    </Button>
                  </div>
                  <Textarea
                    id="analytics-event-payload"
                    value={eventPayloadInput}
                    onChange={(event) => setEventPayloadInput(event.target.value)}
                    className="min-h-[260px] font-mono text-xs"
                    spellCheck={false} />
                  {payloadParseState.error ? (
                    <p className="text-sm text-rose-600">{payloadParseState.error}</p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      `page_path` is added automatically from the real route above.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="border-slate-200 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
                <FileJson className="h-5 w-5 text-sky-700" />
                Sequence Preview
              </CardTitle>
              <CardDescription>
                Each step shows the real route, page view payload, and event payload that will be
                sent in order.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[420px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                {sequencePreview ?
                  stringifyAnalyticsLabJson(sequencePreview) :
                  "// Preview available after hydration"}
              </pre>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
                <FileJson className="h-5 w-5 text-emerald-700" />
                Job Summary
              </CardTitle>
              <CardDescription>
                Global settings that will be applied to the full sequence run.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[420px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                {stringifyAnalyticsLabJson({
                  autoCloseWindow,
                  debugMode,
                  identity: {
                    companyKey,
                    userId
                  },
                  sequenceMode,
                  steps: resolvedDraftSteps.length,
                  userProperties: userPropertiesPreview
                })}
              </pre>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
                <MonitorPlay className="h-5 w-5 text-violet-700" />
                Last Session Result
              </CardTitle>
              <CardDescription>
                Status reported back by the real target page after the session runs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeJobId ? (
                <Badge variant="outline">job_id: {activeJobId}</Badge>
              ) : (
                <Badge variant="outline">No session started yet</Badge>
              )}
              <pre className="max-h-[420px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                {lastSessionResult ?
                  stringifyAnalyticsLabJson(lastSessionResult) :
                  "// Session result will appear here"}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
