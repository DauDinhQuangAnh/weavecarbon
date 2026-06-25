"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api, authTokenStore, isApiError, isUnauthorizedApiError } from "@/lib/apiClient";
import { getSubscriptionApiPayload } from "@/lib/subscriptionApi";
import {
  resolveSubscriptionState,
  type SubscriptionApiPayload } from
"@/lib/subscriptionState";
import { writeSubscriptionLockState } from "@/lib/subscriptionLockState";
import {
  getStandardSkuLimitFromPlan,
  getSubscriptionPlanFamily,
  getSubscriptionPlanRank,
  normalizeSubscriptionPlan,
  type StandardSkuLimit,
  type SubscriptionPlanId } from
"@/lib/subscriptionPlans";
import PricingModal from "@/components/dashboard/PricingModal";
import { useToast } from "@/hooks/useToast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
import { Button } from "@/components/ui/button";const PRICING_MODAL_OPEN_EVENT = "weavecarbon:open-pricing-modal";
const PENDING_UPGRADE_PLAN_KEY = "weavecarbon_pending_upgrade_plan";
const PENDING_UPGRADE_DISPLAY_PLAN_KEY = "weavecarbon_pending_upgrade_display_plan";
const PENDING_UPGRADE_EXPECTED_PRODUCTS_LIMIT_KEY =
  "weavecarbon_pending_upgrade_expected_products_limit";
const PENDING_UPGRADE_SESSION_ID_KEY = "weavecarbon_pending_upgrade_session_id";
const PAYMENT_STATUS_POLL_INTERVAL_MS = 15000;
const PAYMENT_STATUS_MAX_ATTEMPTS = 12;
const PAYMENT_STATUS_RATE_LIMIT_BACKOFF_MS = 60000;

type NormalizedPlanId = SubscriptionPlanId;

interface PricingSelection {
  planId: "trial" | "standard" | "export";
  standardSkuLimit?: StandardSkuLimit;
}

interface SubscriptionSnapshot {
  currentPlan: string | null;
  productsLimit: number;
  featuresLocked: boolean;
  trialEndsAt: string | null;
  trialExpired: boolean;
  trialDaysRemaining: number | null;
}

interface PaymentStatusSnapshot {
  session_id: string;
  status: "pending" | "paid" | "failed" | "expired";
  target_plan?: string | null;
  standard_sku_limit?: number;
}

const INITIAL_SUBSCRIPTION_SNAPSHOT: SubscriptionSnapshot = {
  currentPlan: null,
  productsLimit: 0,
  featuresLocked: false,
  trialEndsAt: null,
  trialExpired: false,
  trialDaysRemaining: null
};

const toPlanDisplayName = (plan: string | null | undefined) => {
  const normalized = normalizeSubscriptionPlan(plan, "free");
  if (normalized === "trial") return "Trial";
  if (getSubscriptionPlanFamily(normalized) === "standard") return "Standard";
  if (normalized === "standard") return "Standard";
  if (normalized === "export") return "Export";
  return "Trial";
};

const toPlanActivationLabel = (
  plan: string | null | undefined,
  productsLimit?: number | null
) => {
  const displayName = toPlanDisplayName(plan);
  if (
    getSubscriptionPlanFamily(plan) === "standard" &&
    typeof productsLimit === "number" &&
    Number.isFinite(productsLimit) &&
    productsLimit > 0
  ) {
    return `${displayName} (${Math.round(productsLimit)} SKU)`;
  }
  return displayName;
};

export default function PricingModalGate() {
  const [open, setOpen] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionSnapshot>(
    INITIAL_SUBSCRIPTION_SNAPSHOT
  );
  const [pendingUpgradePlan, setPendingUpgradePlan] = useState<NormalizedPlanId | null>(null);
  const [pendingUpgradeDisplayPlan, setPendingUpgradeDisplayPlan] = useState<NormalizedPlanId | null>(null);
  const [pendingUpgradeExpectedProductsLimit, setPendingUpgradeExpectedProductsLimit] = useState<number | null>(
    null
  );
  const [pendingUpgradeSessionId, setPendingUpgradeSessionId] = useState<string | null>(null);
  const [upgradeSuccessOpen, setUpgradeSuccessOpen] = useState(false);
  const [upgradeSuccessPlan, setUpgradeSuccessPlan] = useState<NormalizedPlanId>("standard");
  const [upgradeSuccessProductsLimit, setUpgradeSuccessProductsLimit] = useState<number | null>(
    null
  );
  const paymentStatusInFlightRef = useRef(false);
  const paymentStatusRateLimitedUntilRef = useRef(0);

  const { user, loading, authStatus, signOut } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setPendingUpgrade = useCallback((
    plan: string | null,
    displayPlan?: string | null,
    expectedProductsLimit?: number | null,
    sessionId?: string | null
  ) => {
    const normalized = plan ? normalizeSubscriptionPlan(plan, "free") : null;
    const safePlan =
      normalized && normalized !== "free"
        ? getSubscriptionPlanFamily(normalized) === "standard"
          ? "standard"
          : normalized
        : null;
    const normalizedDisplayPlan = displayPlan
      ? normalizeSubscriptionPlan(displayPlan, "free")
      : safePlan;
    const safeDisplayPlan =
      normalizedDisplayPlan && normalizedDisplayPlan !== "free"
        ? getSubscriptionPlanFamily(normalizedDisplayPlan) === "standard"
          ? "standard"
          : normalizedDisplayPlan
        : null;
    const safeExpectedProductsLimit =
      typeof expectedProductsLimit === "number" && Number.isFinite(expectedProductsLimit) &&
      expectedProductsLimit > 0 ?
        Math.round(expectedProductsLimit) :
        null;
    const safeSessionId =
      typeof sessionId === "string" && sessionId.trim().length > 0 ?
        sessionId.trim() :
        null;
    setPendingUpgradePlan(safePlan);
    setPendingUpgradeDisplayPlan(safeDisplayPlan);
    setPendingUpgradeExpectedProductsLimit(safeExpectedProductsLimit);
    setPendingUpgradeSessionId(safeSessionId);

    if (typeof window !== "undefined") {
      if (safePlan) {
        sessionStorage.setItem(PENDING_UPGRADE_PLAN_KEY, safePlan);
      } else {
        sessionStorage.removeItem(PENDING_UPGRADE_PLAN_KEY);
      }

      if (safeDisplayPlan) {
        sessionStorage.setItem(PENDING_UPGRADE_DISPLAY_PLAN_KEY, safeDisplayPlan);
      } else {
        sessionStorage.removeItem(PENDING_UPGRADE_DISPLAY_PLAN_KEY);
      }

      if (safeExpectedProductsLimit !== null) {
        sessionStorage.setItem(
          PENDING_UPGRADE_EXPECTED_PRODUCTS_LIMIT_KEY,
          String(safeExpectedProductsLimit)
        );
      } else {
        sessionStorage.removeItem(PENDING_UPGRADE_EXPECTED_PRODUCTS_LIMIT_KEY);
      }

      if (safeSessionId) {
        sessionStorage.setItem(PENDING_UPGRADE_SESSION_ID_KEY, safeSessionId);
      } else {
        sessionStorage.removeItem(PENDING_UPGRADE_SESSION_ID_KEY);
      }
    }
  }, []);

  const loadCurrentPlan = useCallback(async (options?: { force?: boolean }) => {
    if (loading || authStatus !== "authenticated" || !user || user.user_type === "b2c") {
      setOpen(false);
      return;
    }

    const hasToken = Boolean(
      authTokenStore.getAccessToken() || authTokenStore.getRefreshToken()
    );
    if (!hasToken) {
      setOpen(false);
      return;
    }

    try {
      const payload: SubscriptionApiPayload = await getSubscriptionApiPayload({
        force: options?.force === true
      });
      const resolved = resolveSubscriptionState(payload);
      const productsLimit =
        Number(payload?.plan_details?.products ?? payload?.limits?.products ?? 0) || 0;

      const nextSnapshot: SubscriptionSnapshot = {
        currentPlan: resolved.plan,
        productsLimit,
        featuresLocked: resolved.featuresLocked,
        trialEndsAt: resolved.trialEndsAt,
        trialExpired: resolved.trialExpired,
        trialDaysRemaining: resolved.trialDaysRemaining
      };
      const nextPlan = normalizeSubscriptionPlan(nextSnapshot.currentPlan, "free");
      const matchedPendingUpgrade = (() => {
        if (pendingUpgradePlan === null) {
          return false;
        }
        if (getSubscriptionPlanFamily(pendingUpgradePlan) === "standard") {
          if (pendingUpgradeExpectedProductsLimit !== null) {
            return (
              getSubscriptionPlanFamily(nextPlan) === "standard" &&
              nextSnapshot.productsLimit >= pendingUpgradeExpectedProductsLimit
            );
          }
          return false;
        }
        return nextPlan === pendingUpgradePlan;
      })();

      setSubscription(nextSnapshot);

      if (typeof window !== "undefined") {
        writeSubscriptionLockState({
          current_plan: nextSnapshot.currentPlan,
          trial_ends_at: nextSnapshot.trialEndsAt,
          trial_expired: nextSnapshot.trialExpired,
          features_locked: nextSnapshot.featuresLocked
        });

        if (nextSnapshot.featuresLocked && !open) {
          setOpen(true);
        }
      }

      if (matchedPendingUpgrade) {
        const activatedProductsLimit =
          nextSnapshot.productsLimit > 0 ?
            nextSnapshot.productsLimit :
            pendingUpgradeExpectedProductsLimit;
        setUpgradeSuccessPlan(pendingUpgradeDisplayPlan || nextPlan);
        setUpgradeSuccessProductsLimit(activatedProductsLimit);
        setUpgradeSuccessOpen(true);
        setOpen(false);
        setPendingUpgrade(null, null, null, null);
      }

    } catch (error) {
      if (isUnauthorizedApiError(error)) {
        await signOut();
        return;
      }

      setOpen(false);
    }
  }, [
    loading,
    authStatus,
    pendingUpgradeDisplayPlan,
    pendingUpgradeExpectedProductsLimit,
    pendingUpgradePlan,
    open,
    setPendingUpgrade,
    signOut,
    user
  ]);

  const syncPendingPaymentStatus = useCallback(async (sessionId: string) => {
    const trimmedSessionId = sessionId.trim();
    if (!trimmedSessionId) return "pending" as const;
    if (Date.now() < paymentStatusRateLimitedUntilRef.current) {
      return "pending" as const;
    }
    if (paymentStatusInFlightRef.current) {
      return "pending" as const;
    }

    if (loading || authStatus !== "authenticated" || !user || user.user_type === "b2c") {
      return "pending" as const;
    }

    const hasToken = Boolean(
      authTokenStore.getAccessToken() || authTokenStore.getRefreshToken()
    );
    if (!hasToken) {
      return "pending" as const;
    }

    let paymentStatus: PaymentStatusSnapshot;
    try {
      paymentStatusInFlightRef.current = true;
      paymentStatus = await api.get<PaymentStatusSnapshot>(
        `/subscription/payment-status?session_id=${encodeURIComponent(trimmedSessionId)}`,
        {
          disableResponseCache: true
        }
      );
    } catch (error) {
      if (isApiError(error) && error.status === 429) {
        paymentStatusRateLimitedUntilRef.current =
          Date.now() + PAYMENT_STATUS_RATE_LIMIT_BACKOFF_MS;
        return "pending" as const;
      }
      if (isApiError(error) && error.status === 404) {
        setPendingUpgrade(null, null, null, null);
        return "expired" as const;
      }
      if (isUnauthorizedApiError(error)) {
        await signOut();
      }
      return "pending" as const;
    } finally {
      paymentStatusInFlightRef.current = false;
    }

    paymentStatusRateLimitedUntilRef.current = 0;

    if (paymentStatus.status === "paid") {
      await loadCurrentPlan({ force: true });
      return "paid" as const;
    }

    if (paymentStatus.status === "failed" || paymentStatus.status === "expired") {
      setPendingUpgrade(null, null, null, null);
      toast({
        title:
          paymentStatus.status === "expired" ?
            "Phiên thanh toán đã hết hạn" :
            "Thanh toán chưa thành công",
        description:
          paymentStatus.status === "expired" ?
            "Vui lòng tạo lại giao dịch mới để tiếp tục nâng cấp gói." :
            "Bạn có thể thử lại hoặc liên hệ hỗ trợ nếu cần.",
        variant: "destructive"
      });
      return paymentStatus.status;
    }

    return "pending" as const;
  }, [
    loadCurrentPlan,
    loading,
    authStatus,
    setPendingUpgrade,
    signOut,
    toast,
    user
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pendingPlan = sessionStorage.getItem(PENDING_UPGRADE_PLAN_KEY);
    const pendingDisplayPlan = sessionStorage.getItem(PENDING_UPGRADE_DISPLAY_PLAN_KEY);
    const pendingExpectedProductsLimitRaw = sessionStorage.getItem(
      PENDING_UPGRADE_EXPECTED_PRODUCTS_LIMIT_KEY
    );
    const pendingSessionId = sessionStorage.getItem(PENDING_UPGRADE_SESSION_ID_KEY);
    const pendingExpectedProductsLimit =
      pendingExpectedProductsLimitRaw !== null ? Number(pendingExpectedProductsLimitRaw) : null;
    if (pendingPlan) {
      setPendingUpgrade(
        pendingPlan,
        pendingDisplayPlan,
        Number.isFinite(pendingExpectedProductsLimit) ? pendingExpectedProductsLimit : null,
        pendingSessionId
      );
    }
  }, [setPendingUpgrade]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOpenPricingModal = () => {
      if (!loading && authStatus === "authenticated" && user) {
        setOpen(true);
      }
    };

    window.addEventListener(PRICING_MODAL_OPEN_EVENT, handleOpenPricingModal);
    return () => {
      window.removeEventListener(PRICING_MODAL_OPEN_EVENT, handleOpenPricingModal);
    };
  }, [authStatus, loading, user]);

  useEffect(() => {
    if (loading || authStatus !== "authenticated" || !user) return;
    void loadCurrentPlan();
  }, [authStatus, loadCurrentPlan, loading, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loading || authStatus !== "authenticated" || !user) return;

    const handleWindowFocus = () => {
      if (pendingUpgradeSessionId) {
        void syncPendingPaymentStatus(pendingUpgradeSessionId);
      } else {
        void loadCurrentPlan();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (pendingUpgradeSessionId) {
          void syncPendingPaymentStatus(pendingUpgradeSessionId);
        } else {
          void loadCurrentPlan();
        }
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [authStatus, loadCurrentPlan, loading, pendingUpgradeSessionId, syncPendingPaymentStatus, user]);

  useEffect(() => {
    if (
      !pendingUpgradePlan ||
      typeof window === "undefined" ||
      loading ||
      authStatus !== "authenticated" ||
      !user
    ) return;

    let attempts = 0;
    const pollId = window.setInterval(() => {
      attempts += 1;
      if (document.visibilityState !== "visible") {
        return;
      }
      if (pendingUpgradeSessionId) {
        void syncPendingPaymentStatus(pendingUpgradeSessionId);
      } else {
        void loadCurrentPlan();
      }
      if (attempts >= PAYMENT_STATUS_MAX_ATTEMPTS) {
        window.clearInterval(pollId);
      }
    }, PAYMENT_STATUS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(pollId);
    };
  }, [authStatus, loadCurrentPlan, loading, pendingUpgradePlan, pendingUpgradeSessionId, syncPendingPaymentStatus, user]);

  useEffect(() => {
    if (!searchParams) return;

    const paymentStatus = searchParams.get("payment_status");
    if (!paymentStatus) return;
    if (loading || authStatus !== "authenticated" || !user) return;

    const paymentPlan = normalizeSubscriptionPlan(searchParams.get("plan"), "free");
    const paymentSessionId = searchParams.get("session_id");
    if (paymentStatus === "success" || paymentStatus === "pending") {
      if (paymentPlan !== "free" || paymentSessionId) {
        const pendingDisplayPlan =
          typeof window !== "undefined"
            ? sessionStorage.getItem(PENDING_UPGRADE_DISPLAY_PLAN_KEY)
            : null;
        const pendingExpectedProductsLimitRaw =
          typeof window !== "undefined"
            ? sessionStorage.getItem(PENDING_UPGRADE_EXPECTED_PRODUCTS_LIMIT_KEY)
            : null;
        const pendingExpectedProductsLimit =
          pendingExpectedProductsLimitRaw !== null ? Number(pendingExpectedProductsLimitRaw) : null;
        const storedPendingPlan =
          typeof window !== "undefined"
            ? sessionStorage.getItem(PENDING_UPGRADE_PLAN_KEY)
            : null;
        const resolvedPendingPlan =
          paymentPlan !== "free"
            ? paymentPlan
            : storedPendingPlan
              ? normalizeSubscriptionPlan(storedPendingPlan, "free")
              : "standard";
        setPendingUpgrade(
          resolvedPendingPlan,
          pendingDisplayPlan || resolvedPendingPlan,
          Number.isFinite(pendingExpectedProductsLimit) ? pendingExpectedProductsLimit : null,
          paymentSessionId
        );
      }
      toast({
        title: "Đã ghi nhận thanh toán",
        description: "Đang xác nhận giao dịch và cập nhật gói dịch vụ của bạn..."
      });
      void loadCurrentPlan({ force: true });
    } else {
      setPendingUpgrade(null, null, null, null);
      toast({
        title: "Thanh toán chưa thành công",
        description: "Bạn có thể thử lại hoặc liên hệ hỗ trợ nếu cần.",
        variant: "destructive"
      });
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("payment_status");
    nextParams.delete("plan");
    nextParams.delete("source");
    nextParams.delete("session_id");
    nextParams.delete("transaction_ref");
    nextParams.delete("reason");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }, [
    loadCurrentPlan,
    authStatus,
    loading,
    pathname,
    router,
    searchParams,
    setPendingUpgrade,
    syncPendingPaymentStatus,
    toast,
    user
  ]);

  const handleClose = () => {
    if (subscription.featuresLocked) {
      return;
    }
    setOpen(false);
  };

  const handleSelectPlan = async ({ planId, standardSkuLimit }: PricingSelection) => {
    if (!user) return;

    try {
      const isStandardAddonPurchase = planId === "standard";
      const normalizedTargetPlan =
        isStandardAddonPurchase ?
          "standard" :
          normalizeSubscriptionPlan(planId, "free");
      const targetPlanFamily = getSubscriptionPlanFamily(normalizedTargetPlan);
      if (targetPlanFamily === "trial" || normalizedTargetPlan === "free") {
        toast({
          title: "Trial tự động kích hoạt",
          description: "Tài khoản mới sẽ được Trial miễn phí 14 ngày, không cần đăng ký."
        });
        return;
      }

      const currentPlanId = normalizeSubscriptionPlan(subscription.currentPlan, "free");
      const currentPlanFamily = getSubscriptionPlanFamily(currentPlanId);
      const currentRank = getSubscriptionPlanRank(currentPlanId);
      const targetRank = getSubscriptionPlanRank(normalizedTargetPlan);
      const requestedStandardSkuIncrement =
        standardSkuLimit ?? getStandardSkuLimitFromPlan(normalizedTargetPlan) ?? 20;
      const currentStandardProductsLimit =
        currentPlanFamily === "standard" ? subscription.productsLimit : 0;
      const expectedProductsLimit =
        targetPlanFamily === "standard" ?
          currentStandardProductsLimit + requestedStandardSkuIncrement :
          null;
      if (isStandardAddonPurchase && currentPlanFamily === "export") {
        toast({
          title: "Không thể đăng ký gói thấp hơn",
          description: "Tài khoản của bạn đã ở gói này hoặc cao hơn.",
          variant: "destructive"
        });
        return;
      }

      if (!isStandardAddonPurchase && targetRank <= currentRank && currentPlanId !== "free") {
        toast({
          title: "Không thể đăng ký gói thấp hơn",
          description: "Tài khoản của bạn đã ở gói này hoặc cao hơn.",
          variant: "destructive"
        });
        return;
      }

      const upgrade = await api.post<{
        checkout_url?: string;
        payment_url?: string;
        vnpay_url?: string;
        session_id?: string;
      }>("/subscription/upgrade", {
        target_plan: planId === "standard" ? "standard" : normalizedTargetPlan,
        standard_sku_limit:
          planId === "standard" ?
            standardSkuLimit ?? getStandardSkuLimitFromPlan(normalizedTargetPlan) ?? 20 :
            undefined,
        billing_cycle: "monthly",
        payment_provider:
          targetPlanFamily === "standard" || normalizedTargetPlan === "export"
            ? "vnpay"
            : undefined
      });
      const paymentUrl =
        upgrade?.payment_url || upgrade?.vnpay_url || upgrade?.checkout_url;

      if (paymentUrl && typeof window !== "undefined") {
        setPendingUpgrade(
          isStandardAddonPurchase ? "standard" : normalizedTargetPlan,
          isStandardAddonPurchase ? "standard" : normalizedTargetPlan,
          expectedProductsLimit,
          upgrade?.session_id ?? null
        );
        localStorage.setItem("weavecarbon_pricing_seen", "true");
        setOpen(false);
        window.location.assign(paymentUrl);
        return;
      }

      localStorage.setItem("weavecarbon_pricing_seen", "true");
      setOpen(false);
    } catch (error) {
      if (isUnauthorizedApiError(error)) {
        await signOut();
        return;
      }
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <PricingModal
        open={open}
        onClose={handleClose}
        currentPlan={subscription.currentPlan}
        trialEndsAt={subscription.trialEndsAt}
        trialExpired={subscription.trialExpired}
        trialDaysRemaining={subscription.trialDaysRemaining}
        forceSelection={subscription.featuresLocked}
        onSelectPlan={handleSelectPlan} />

      <Dialog open={upgradeSuccessOpen} onOpenChange={setUpgradeSuccessOpen}>
        <DialogContent className="max-w-sm border-emerald-200 p-5 sm:p-6 max-sm:left-1/2 max-sm:top-1/2 max-sm:h-auto max-sm:w-[calc(100vw-2rem)] max-sm:max-w-sm max-sm:translate-x-[-50%] max-sm:translate-y-[-50%] max-sm:rounded-xl">
          <DialogHeader className="items-center gap-2 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogTitle className="text-lg text-emerald-700 sm:text-xl">
              Nâng cấp thành công
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-700 sm:text-base">
              Gói {toPlanActivationLabel(upgradeSuccessPlan, upgradeSuccessProductsLimit)} đã được kích hoạt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => setUpgradeSuccessOpen(false)}
            >
              Đã hiểu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
