"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscriptionLock } from "@/hooks/useSubscriptionLock";
import {
  getStandardSkuLimitFromPlan,
  getSubscriptionPlanFamily
} from "@/lib/subscriptionPlans";
import {
  prepareAnalyticsEvent,
  prepareAnalyticsPageView,
  resolveAnalyticsPageGroup,
  setAnalyticsIdentity,
  setAnalyticsUserProperties,
  shouldTrackAnalyticsPageView,
  trackPageView,
  trackTestEvent,
  trackTestPageView,
  type AnalyticsPayloadMapV2
} from "@/lib/analytics";
import {
  buildAnalyticsLabJobUrl,
  ANALYTICS_LAB_JOB_QUERY_PARAM,
  ANALYTICS_LAB_STEP_QUERY_PARAM,
  parseAnalyticsLabStepIndex,
  readAnalyticsLabJob,
  readAnalyticsLabResult,
  normalizeAnalyticsLabPath,
  writeAnalyticsLabResult,
  type AnalyticsLabSessionJob,
  type AnalyticsLabSessionResult
} from "@/tools/analytics-lab/storage";

const buildPendingStepResult = (
  job: AnalyticsLabSessionJob,
  stepIndex: number
) => {
  const step = job.steps[stepIndex];
  if (!step) {
    return null;
  }

  return {
    currentPath: "",
    debugMode: job.debugMode,
    eventName: step.eventName,
    eventSent: false,
    pageViewSent: false,
    status: "pending" as const,
    stepId: step.id,
    stepIndex,
    targetPath: normalizeAnalyticsLabPath(step.targetPath),
    updatedAt: job.createdAt
  };
};

const buildBaseLabResult = (
  job: AnalyticsLabSessionJob,
  activeStepIndex: number,
  currentPath: string
): AnalyticsLabSessionResult => ({
  activeStepIndex,
  completedStepCount: 0,
  currentPath,
  debugMode: job.debugMode,
  id: job.id,
  status: "pending",
  stepResults:
    job.steps
      .map((_, stepIndex) => buildPendingStepResult(job, stepIndex))
      .filter((step): step is NonNullable<typeof step> => Boolean(step)),
  stepsTotal: job.steps.length,
  updatedAt: new Date().toISOString(),
  windowHref: typeof window !== "undefined" ? window.location.href : undefined
});

const deriveLabSessionStatus = (
  stepResults: AnalyticsLabSessionResult["stepResults"]
): AnalyticsLabSessionResult["status"] => {
  if (stepResults.some((step) => step.status === "path_mismatch")) {
    return "path_mismatch";
  }
  if (stepResults.some((step) => step.status === "failed")) {
    return "failed";
  }
  if (stepResults.length > 0 && stepResults.every((step) => step.status === "completed")) {
    return "completed";
  }
  if (stepResults.some((step) => step.status === "running")) {
    return "running";
  }
  if (
    stepResults.some((step) => step.status === "completed") &&
    stepResults.some((step) => step.status === "pending")
  ) {
    return "running";
  }
  return "pending";
};

export default function AnalyticsProvider({
  children
}: Readonly<{children: ReactNode;}>) {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isDemoSession, user } = useAuth();
  const { currentPlan } = useSubscriptionLock();
  const analyticsLabJobId = searchParams.get(ANALYTICS_LAB_JOB_QUERY_PARAM)?.trim() || "";
  const analyticsLabStepIndex = parseAnalyticsLabStepIndex(
    searchParams.get(ANALYTICS_LAB_STEP_QUERY_PARAM)
  );
  const [analyticsLabJob, setAnalyticsLabJob] = useState<AnalyticsLabSessionJob | null | undefined>(
    analyticsLabJobId ? undefined : null
  );
  const processedLabPageViewKeyRef = useRef("");
  const processedLabEventKeyRef = useRef("");
  const search = searchParams.toString();
  const pagePath = `${pathname || "/"}${search ? `?${search}` : ""}`;
  const resolvedPlan = currentPlan || user?.current_plan || null;
  const normalizedCurrentPath = useMemo(
    () => normalizeAnalyticsLabPath(pathname || "/"),
    [pathname]
  );
  const analyticsLabCurrentStep = useMemo(
    () => analyticsLabJob?.steps[analyticsLabStepIndex] || null,
    [analyticsLabJob, analyticsLabStepIndex]
  );
  const analyticsLabTargetPath = useMemo(
    () => normalizeAnalyticsLabPath(analyticsLabCurrentStep?.targetPath),
    [analyticsLabCurrentStep?.targetPath]
  );
  const analyticsLabTargetMatches =
    Boolean(analyticsLabCurrentStep) && normalizedCurrentPath === analyticsLabTargetPath;

  const writeLabResult = useCallback(
    (
      updater: (
        current: AnalyticsLabSessionResult | null
      ) => AnalyticsLabSessionResult | null
    ) => {
      if (!analyticsLabJobId) {
        return;
      }

      const nextResult = updater(readAnalyticsLabResult(analyticsLabJobId));
      if (!nextResult) {
        return;
      }

      writeAnalyticsLabResult(nextResult);
    },
    [analyticsLabJobId]
  );

  const writeLabStepResult = useCallback(
    (
      job: AnalyticsLabSessionJob,
      stepIndex: number,
      updater: (
        current: AnalyticsLabSessionResult["stepResults"][number]
      ) => AnalyticsLabSessionResult["stepResults"][number]
    ) => {
      writeLabResult((current) => {
        const baseResult =
          current && current.id === job.id ?
            current :
            buildBaseLabResult(job, stepIndex, normalizedCurrentPath);
        const nextStepResults =
          baseResult.stepResults.length === job.steps.length ?
            [...baseResult.stepResults] :
            buildBaseLabResult(job, stepIndex, normalizedCurrentPath).stepResults;
        const fallbackStepResult = buildPendingStepResult(job, stepIndex);

        if (!fallbackStepResult) {
          return {
            ...baseResult,
            activeStepIndex: stepIndex,
            currentPath: normalizedCurrentPath,
            error: `Missing analytics lab step at index ${stepIndex}.`,
            status: "failed",
            stepsTotal: job.steps.length,
            updatedAt: new Date().toISOString(),
            windowHref: typeof window !== "undefined" ? window.location.href : undefined
          };
        }

        nextStepResults[stepIndex] = updater(nextStepResults[stepIndex] || fallbackStepResult);

        return {
          ...baseResult,
          activeStepIndex: stepIndex,
          completedStepCount: nextStepResults.filter((step) => step.status === "completed").length,
          currentPath: normalizedCurrentPath,
          debugMode: job.debugMode,
          id: job.id,
          status: deriveLabSessionStatus(nextStepResults),
          stepResults: nextStepResults,
          stepsTotal: job.steps.length,
          updatedAt: new Date().toISOString(),
          windowHref: typeof window !== "undefined" ? window.location.href : undefined
        };
      });
    },
    [normalizedCurrentPath, writeLabResult]
  );

  useEffect(() => {
    if (!analyticsLabJobId) {
      setAnalyticsLabJob(null);
      processedLabPageViewKeyRef.current = "";
      processedLabEventKeyRef.current = "";
      return;
    }

    setAnalyticsLabJob(readAnalyticsLabJob(analyticsLabJobId));
    processedLabPageViewKeyRef.current = "";
    processedLabEventKeyRef.current = "";
  }, [analyticsLabJobId, analyticsLabStepIndex]);

  useEffect(() => {
    setAnalyticsUserProperties({
      locale,
      accountType: user?.user_type || null,
      companyRole: user?.company_role || null,
      isDemo: isDemoSession,
      planFamily: getSubscriptionPlanFamily(resolvedPlan),
      planSkuLimit: getStandardSkuLimitFromPlan(resolvedPlan),
      businessType: user?.business_type || null,
      domesticMarket: user?.domestic_market || null
    });
  }, [
    currentPlan,
    isDemoSession,
    locale,
    resolvedPlan,
    user?.business_type,
    user?.company_role,
    user?.domestic_market,
    user?.user_type
  ]);

  useEffect(() => {
    setAnalyticsIdentity({
      userId: user?.analytics_user_key || null,
      companyKey: user?.analytics_company_key || null
    });
  }, [user?.analytics_company_key, user?.analytics_user_key]);

  useEffect(() => {
    if (!analyticsLabJobId || analyticsLabJob === undefined) {
      return;
    }

    if (!analyticsLabJob) {
      writeLabResult(() => ({
        activeStepIndex: analyticsLabStepIndex,
        completedStepCount: 0,
        id: analyticsLabJobId,
        currentPath: normalizedCurrentPath,
        debugMode: false,
        error: "Analytics lab job was not found in localStorage.",
        status: "failed",
        stepResults: [],
        stepsTotal: 0,
        updatedAt: new Date().toISOString(),
        windowHref: typeof window !== "undefined" ? window.location.href : undefined
      }));
      return;
    }

    if (!analyticsLabCurrentStep) {
      writeLabResult((current) => ({
        ...(current || buildBaseLabResult(analyticsLabJob, analyticsLabStepIndex, normalizedCurrentPath)),
        activeStepIndex: analyticsLabStepIndex,
        currentPath: normalizedCurrentPath,
        debugMode: analyticsLabJob.debugMode,
        error: `Missing analytics lab step at index ${analyticsLabStepIndex}.`,
        status: "failed",
        stepsTotal: analyticsLabJob.steps.length,
        updatedAt: new Date().toISOString(),
        windowHref: typeof window !== "undefined" ? window.location.href : undefined
      }));
      return;
    }

    setAnalyticsUserProperties(analyticsLabJob.userProperties);
    setAnalyticsIdentity(analyticsLabJob.identity);
  }, [
    analyticsLabCurrentStep,
    analyticsLabJob,
    analyticsLabJobId,
    analyticsLabStepIndex,
    normalizedCurrentPath,
    writeLabResult
  ]);

  useEffect(() => {
    if (!shouldTrackAnalyticsPageView(pagePath)) {
      return;
    }

    if (analyticsLabJobId && analyticsLabJob === undefined) {
      return;
    }

    const pageGroup = resolveAnalyticsPageGroup(pagePath);

    if (analyticsLabJob && analyticsLabCurrentStep && analyticsLabTargetMatches) {
      const pageViewKey = `${analyticsLabJob.id}:${analyticsLabStepIndex}:page_view`;
      if (processedLabPageViewKeyRef.current === pageViewKey) {
        return;
      }

      processedLabPageViewKeyRef.current = pageViewKey;
      const preparedPageView = prepareAnalyticsPageView(pageGroup, pagePath, {
        debugMode: analyticsLabJob.debugMode
      });
      const sent = trackTestPageView(pageGroup, pagePath, {
        debugMode: analyticsLabJob.debugMode
      });

      writeLabStepResult(analyticsLabJob, analyticsLabStepIndex, (current) => ({
        ...current,
        currentPath: normalizedCurrentPath,
        debugMode: analyticsLabJob.debugMode,
        eventName: analyticsLabCurrentStep.eventName,
        eventSent: current.eventSent || false,
        eventSentAt: current.eventSentAt,
        pageTitle: typeof document !== "undefined" ? document.title : current.pageTitle,
        pageViewPrepared: preparedPageView,
        pageViewSent: sent,
        pageViewSentAt: sent ? new Date().toISOString() : current.pageViewSentAt,
        preparedEvent: current.preparedEvent,
        status: sent ? "running" : "failed",
        targetPath: analyticsLabTargetPath,
        updatedAt: new Date().toISOString(),
        windowHref: typeof window !== "undefined" ? window.location.href : current.windowHref
      }));
      return;
    }

    trackPageView(pageGroup, pagePath);
  }, [
    analyticsLabCurrentStep,
    analyticsLabJob,
    analyticsLabJobId,
    analyticsLabStepIndex,
    analyticsLabTargetMatches,
    analyticsLabTargetPath,
    normalizedCurrentPath,
    pagePath,
    writeLabStepResult
  ]);

  useEffect(() => {
    if (!analyticsLabJobId || analyticsLabJob === undefined) {
      return;
    }

    if (!analyticsLabJob || !analyticsLabCurrentStep) {
      return;
    }

    const eventKey = `${analyticsLabJob.id}:${analyticsLabStepIndex}:event`;

    if (!analyticsLabTargetMatches) {
      if (processedLabEventKeyRef.current === `${eventKey}:path_mismatch`) {
        return;
      }

      processedLabEventKeyRef.current = `${eventKey}:path_mismatch`;

      writeLabStepResult(analyticsLabJob, analyticsLabStepIndex, (current) => ({
        ...current,
        currentPath: normalizedCurrentPath,
        debugMode: analyticsLabJob.debugMode,
        error: `Opened ${normalizedCurrentPath} instead of ${analyticsLabTargetPath}.`,
        eventName: analyticsLabCurrentStep.eventName,
        eventSent: false,
        pageTitle: typeof document !== "undefined" ? document.title : current.pageTitle,
        pageViewPrepared: current.pageViewPrepared,
        pageViewSent: current.pageViewSent || false,
        pageViewSentAt: current.pageViewSentAt,
        preparedEvent: current.preparedEvent,
        status: "path_mismatch",
        targetPath: analyticsLabTargetPath,
        updatedAt: new Date().toISOString(),
        windowHref: typeof window !== "undefined" ? window.location.href : current.windowHref
      }));

      if (analyticsLabJob.autoCloseWindow) {
        window.setTimeout(() => {
          window.close();
        }, 800);
      }
      return;
    }

    if (processedLabEventKeyRef.current === eventKey) {
      return;
    }

    processedLabEventKeyRef.current = eventKey;

    const timer = window.setTimeout(() => {
      try {
        const eventPayload = {
          ...analyticsLabCurrentStep.eventPayload,
          page_path: normalizedCurrentPath
        } as AnalyticsPayloadMapV2[typeof analyticsLabCurrentStep.eventName];
        const preparedEvent = prepareAnalyticsEvent(analyticsLabCurrentStep.eventName, eventPayload, {
          debugMode: analyticsLabJob.debugMode
        });
        const sent = trackTestEvent(analyticsLabCurrentStep.eventName, eventPayload, {
          debugMode: analyticsLabJob.debugMode
        });

        writeLabStepResult(analyticsLabJob, analyticsLabStepIndex, (current) => ({
          ...current,
          currentPath: normalizedCurrentPath,
          debugMode: analyticsLabJob.debugMode,
          eventName: analyticsLabCurrentStep.eventName,
          eventSent: sent,
          eventSentAt: sent ? new Date().toISOString() : current.eventSentAt,
          pageTitle: typeof document !== "undefined" ? document.title : current.pageTitle,
          pageViewPrepared: current.pageViewPrepared,
          pageViewSent: current.pageViewSent || false,
          pageViewSentAt: current.pageViewSentAt,
          preparedEvent,
          status: sent ? "completed" : "failed",
          targetPath: analyticsLabTargetPath,
          updatedAt: new Date().toISOString(),
          windowHref: typeof window !== "undefined" ? window.location.href : current.windowHref
        }));

        const nextStepIndex = analyticsLabStepIndex + 1;
        if (sent && analyticsLabJob.steps[nextStepIndex]) {
          window.setTimeout(() => {
            window.location.assign(
              buildAnalyticsLabJobUrl(window.location.origin, analyticsLabJob, nextStepIndex)
            );
          }, 250);
          return;
        }

        if (analyticsLabJob.autoCloseWindow) {
          window.setTimeout(() => {
            window.close();
          }, 800);
        }
      } catch (error) {
        writeLabStepResult(analyticsLabJob, analyticsLabStepIndex, (current) => ({
          ...current,
          currentPath: normalizedCurrentPath,
          debugMode: analyticsLabJob.debugMode,
          error: error instanceof Error ? error.message : "Analytics lab session failed.",
          eventName: analyticsLabCurrentStep.eventName,
          eventSent: false,
          pageTitle: typeof document !== "undefined" ? document.title : current.pageTitle,
          pageViewPrepared: current.pageViewPrepared,
          pageViewSent: current.pageViewSent || false,
          pageViewSentAt: current.pageViewSentAt,
          preparedEvent: current.preparedEvent,
          status: "failed",
          targetPath: analyticsLabTargetPath,
          updatedAt: new Date().toISOString(),
          windowHref: typeof window !== "undefined" ? window.location.href : current.windowHref
        }));
      }
    }, analyticsLabCurrentStep.dwellMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    analyticsLabCurrentStep,
    analyticsLabJob,
    analyticsLabJobId,
    analyticsLabStepIndex,
    analyticsLabTargetMatches,
    analyticsLabTargetPath,
    normalizedCurrentPath,
    writeLabStepResult
  ]);

  return <>{children}</>;
}
