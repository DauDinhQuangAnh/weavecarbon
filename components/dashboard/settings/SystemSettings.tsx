"use client";

import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { api, authTokenStore, isApiError } from "@/lib/apiClient";
import {
  TARGET_MARKET_OPTIONS,
  formatTargetMarketLabel,
  normalizeDomesticMarketCode,
  normalizeTargetMarkets } from
"@/lib/targetMarkets";
import {
  resolveSubscriptionState,
  type SubscriptionApiPayload } from
"@/lib/subscriptionState";
import { PRODUCT_USAGE_UPDATED_EVENT } from "@/lib/productUsageEvents";
import {
  getStandardSkuLimitFromPlan,
  getSubscriptionPlanFamily,
  normalizeSubscriptionPlan } from
"@/lib/subscriptionPlans";
import { writeSubscriptionLockState } from "@/lib/subscriptionLockState";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription } from
"@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
import { Building2, Save, X, Zap, User, KeyRound } from "lucide-react";
import { toast } from "sonner";

interface CompanyData {
  id: string;
  name: string;
  business_type: "shop_online" | "brand" | "factory";
  domestic_market?: string | null;
  target_markets: string[] | null;
  current_plan: string;
  created_at?: string;
}

interface AccountData {
  profile?: {
    created_at?: string;
  } | null;
  company?: CompanyData | null;
}

interface UsageLimits {
  productsUsed: number;
  productsLimit: number;
  membersUsed: number;
  membersLimit: number;
  apiCallsUsed: number;
  apiCallsLimit: number;
}

interface SubscriptionData extends SubscriptionApiPayload {
  limits?: {
    products?: number;
    members?: number;
    api_calls_per_month?: number;
  };
  usage?: {
    products?: number;
    products_count?: number;
    products_limit?: number;
    members?: number;
    members_count?: number;
    members_limit?: number;
    api_calls_this_month?: number;
    api_calls_used?: number;
    api_calls_limit?: number;
  };
}

const ACCOUNT_ENDPOINT_ENABLED =
process.env.NEXT_PUBLIC_ACCOUNT_ENDPOINT !== "0";
const PRICING_MODAL_OPEN_EVENT = "weavecarbon:open-pricing-modal";
const TRIAL_PRODUCTS_LIMIT = 5;
const TRIAL_MEMBERS_LIMIT = 1;

const isEndpointUnavailableError = (error: unknown) => {
  if (isApiError(error)) {
    return error.status === 404 || error.status === 501;
  }
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("not found") ||
    message.includes("route") ||
    message.includes("not implemented"));
};

const SystemSettings: React.FC = () => {
  const t = useTranslations("settings.system");
  const tPricing = useTranslations("pricingModal");
  const locale = useLocale();
  const isVi = locale === "vi";
  const router = useRouter();
  const displayLocale = locale === "vi" ? "vi-VN" : "en-US";
  const { user, updateUser, refreshUser } = useAuth();
  const { canAccessSystemSettings } = usePermissions();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [accountCreatedAt, setAccountCreatedAt] = useState<string | null>(null);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    plan: string;
    trialStartedAt: string | null;
    trialEndsAt: string | null;
    trialExpired: boolean;
    trialDaysRemaining: number | null;
    standardStartedAt: string | null;
    standardExpiresAt: string | null;
    standardExpired: boolean;
    standardDaysRemaining: number | null;
  }>({
    plan: "free",
    trialStartedAt: null,
    trialEndsAt: null,
    trialExpired: false,
    trialDaysRemaining: null,
    standardStartedAt: null,
    standardExpiresAt: null,
    standardExpired: false,
    standardDaysRemaining: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [personalEditMode, setPersonalEditMode] = useState(false);
  const [personalSaving, setPersonalSaving] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const createdDateSource = accountCreatedAt || subscriptionInfo.trialStartedAt;
  const createdDateLabel = createdDateSource ?
  new Date(createdDateSource).toLocaleDateString(displayLocale) :
  t("notUpdated");

  const [personalForm, setPersonalForm] = useState({
    full_name: "",
    email: ""
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: ""
  });

  const [formData, setFormData] = useState({
    name: "",
    business_type: "brand" as "shop_online" | "brand" | "factory",
    domestic_market: "VN",
    target_markets: [] as string[]
  });

  const businessTypeLabel =
  company?.business_type === "brand" ?
  t("businessTypeBrand") :
  company?.business_type === "factory" ?
  t("businessTypeFactory") :
  company?.business_type === "shop_online" ?
  t("businessTypeShop") :
  t("notUpdated");

  const selectedTargetMarkets = normalizeTargetMarkets(formData.target_markets);
  const selectedDomesticMarket = normalizeDomesticMarketCode(
    formData.domestic_market,
    formData.target_markets
  );

  const resetCompanyForm = () => {
    setFormData({
      name: company?.name || "",
      business_type: company?.business_type || "brand",
      domestic_market: normalizeDomesticMarketCode(
        company?.domestic_market,
        company?.target_markets || []
      ),
      target_markets: normalizeTargetMarkets(company?.target_markets || [])
    });
  };

  const handleCancelCompanyEdit = () => {
    resetCompanyForm();
    setEditMode(false);
  };

  const handleToggleTargetMarket = (marketCode: string) => {
    const currentPlan = normalizeSubscriptionPlan(
      subscriptionInfo.plan || company?.current_plan || "free",
      "free"
    );
    const currentPlanFamily = getSubscriptionPlanFamily(currentPlan);

    setFormData((prev) => {
      if (currentPlanFamily === "trial") return prev;

      const alreadySelected = prev.target_markets.includes(marketCode);
      const nextMarkets = alreadySelected ?
      prev.target_markets.filter((code) => code !== marketCode) :
      [...prev.target_markets, marketCode];

      return {
        ...prev,
        target_markets: normalizeTargetMarkets(nextMarkets)
      };
    });
  };

  const loadCompany = React.useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }

    if (!user || user.user_type === "b2c") {
      setUsageLimits(null);
      setLoading(false);
      return;
    }

    const hasToken = Boolean(
      authTokenStore.getAccessToken() || authTokenStore.getRefreshToken()
    );
    if (!hasToken) {
      setUsageLimits(null);
      setLoading(false);
      return;
    }

    try {
      const subscriptionResult = await api.
      get<SubscriptionData>("/subscription", { disableResponseCache: true }).
      then((data) => ({ status: "fulfilled" as const, value: data })).
      catch((reason) => ({ status: "rejected" as const, reason }));
      let accountCreatedAtFromApi: string | null = null;
      let companyPlanFromAccount: string | null = null;

      if (ACCOUNT_ENDPOINT_ENABLED) {
        const accountResult = await api.
        get<AccountData>("/account", { disableResponseCache: true }).
        then((data) => ({ status: "fulfilled" as const, value: data })).
        catch((reason) => ({ status: "rejected" as const, reason }));

        if (accountResult.status === "fulfilled") {
          const account = accountResult.value;
          const companyData = account.company || null;
          accountCreatedAtFromApi = account.profile?.created_at || companyData?.created_at || null;
          companyPlanFromAccount = companyData?.current_plan || null;
          setCompany(companyData);
          setAccountCreatedAt(accountCreatedAtFromApi);
          setFormData((prev) => ({
            ...prev,
            name: companyData?.name || "",
            business_type: companyData?.business_type || "brand",
            domestic_market: normalizeDomesticMarketCode(
              companyData?.domestic_market,
              companyData?.target_markets || []
            ),
            target_markets: normalizeTargetMarkets(companyData?.target_markets || [])
          }));
        } else {
          setCompany(null);
          setAccountCreatedAt(null);
        }
      } else {
        setCompany(null);
        setAccountCreatedAt(null);
      }

      if (subscriptionResult.status === "fulfilled") {
        const subscription = subscriptionResult.value;
        const resolvedSubscription = resolveSubscriptionState(
          subscription,
          {
            fallbackPlan: companyPlanFromAccount || null,
            fallbackTrialStartedAt: accountCreatedAtFromApi
          }
        );
        const planFromSubscription = resolvedSubscription.plan;
        const normalizedPlan = normalizeSubscriptionPlan(planFromSubscription, "free");
        const isTrialSubscriptionPlan =
          getSubscriptionPlanFamily(normalizedPlan) === "trial";
        const usage = subscription.usage;
        const limits = subscription.limits;
        const productsUsed = usage?.products ?? usage?.products_count ?? 0;
        const membersUsed = usage?.members ?? usage?.members_count ?? 0;
        const apiCallsUsed =
          usage?.api_calls_this_month ?? usage?.api_calls_used ?? 0;
        const productsLimitFromApi =
          limits?.products ?? usage?.products_limit ?? 0;
        const membersLimitFromApi =
          limits?.members ?? usage?.members_limit ?? 0;
        const apiCallsLimitFromApi =
          limits?.api_calls_per_month ?? usage?.api_calls_limit ?? 0;

        setUsageLimits({
          productsUsed,
          productsLimit:
            isTrialSubscriptionPlan ? TRIAL_PRODUCTS_LIMIT : productsLimitFromApi,
          membersUsed:
            isTrialSubscriptionPlan ? Math.max(membersUsed, 1) : membersUsed,
          membersLimit:
            isTrialSubscriptionPlan ? TRIAL_MEMBERS_LIMIT : membersLimitFromApi,
          apiCallsUsed,
          apiCallsLimit: apiCallsLimitFromApi
        });
        setCompany((prev) =>
        prev ?
        {
          ...prev,
          current_plan:
          planFromSubscription ||
          prev.current_plan
        } :
        prev
        );

        setSubscriptionInfo({
          plan: planFromSubscription,
          trialStartedAt: resolvedSubscription.trialStartedAt,
          trialEndsAt: resolvedSubscription.trialEndsAt,
          trialExpired: resolvedSubscription.trialExpired,
          trialDaysRemaining: resolvedSubscription.trialDaysRemaining,
          standardStartedAt: resolvedSubscription.standardStartedAt,
          standardExpiresAt: resolvedSubscription.standardExpiresAt,
          standardExpired: resolvedSubscription.standardExpired,
          standardDaysRemaining: resolvedSubscription.standardDaysRemaining
        });

        if (typeof window !== "undefined") {
          writeSubscriptionLockState({
            current_plan: planFromSubscription,
            trial_ends_at: resolvedSubscription.trialEndsAt,
            trial_expired: resolvedSubscription.trialExpired,
            features_locked: resolvedSubscription.featuresLocked
          });
        }
      } else {
        setUsageLimits(null);
        const fallbackPlan = companyPlanFromAccount || null;
        const fallbackResolved = resolveSubscriptionState(null, {
          fallbackPlan,
          fallbackTrialStartedAt: accountCreatedAtFromApi
        });

        setSubscriptionInfo({
          plan: fallbackResolved.plan,
          trialStartedAt: fallbackResolved.trialStartedAt,
          trialEndsAt: fallbackResolved.trialEndsAt,
          trialExpired: fallbackResolved.trialExpired,
          trialDaysRemaining: fallbackResolved.trialDaysRemaining,
          standardStartedAt: fallbackResolved.standardStartedAt,
          standardExpiresAt: fallbackResolved.standardExpiresAt,
          standardExpired: fallbackResolved.standardExpired,
          standardDaysRemaining: fallbackResolved.standardDaysRemaining
        });

        if (typeof window !== "undefined") {
          writeSubscriptionLockState({
            current_plan: fallbackResolved.plan,
            trial_ends_at: fallbackResolved.trialEndsAt,
            trial_expired: fallbackResolved.trialExpired,
            features_locked: fallbackResolved.featuresLocked
          });
        }
      }
    } catch (error) {
      console.error("Error fetching company:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setPersonalForm({
      full_name: user?.full_name?.trim() || "",
      email: user?.email?.trim() || ""
    });
  }, [user?.email, user?.full_name]);

  useEffect(() => {
    void loadCompany(true);
  }, [loadCompany]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleProductUsageUpdated = () => {
      void loadCompany(false);
    };

    const handleWindowFocus = () => {
      void loadCompany(false);
    };

    window.addEventListener(PRODUCT_USAGE_UPDATED_EVENT, handleProductUsageUpdated);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener(PRODUCT_USAGE_UPDATED_EVENT, handleProductUsageUpdated);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [loadCompany]);

  const handlePersonalSave = async () => {
    const email = personalForm.email.trim();
    const fullName = personalForm.full_name.trim();

    if (!fullName) {
      toast.error(t("validationFullNameRequired"));
      return;
    }

    if (!email) {
      toast.error(t("validationEmailRequired"));
      return;
    }

    setPersonalSaving(true);
    try {
      const updated = await api.put<{
        email?: string;
        full_name?: string;
      }>("/account/profile", {
        full_name: fullName,
        email
      });

      updateUser({
        full_name:
        typeof updated?.full_name === "string" && updated.full_name.trim() ?
        updated.full_name :
        fullName,
        email:
        typeof updated?.email === "string" && updated.email.trim() ?
        updated.email :
        email
      });
      await refreshUser();
      setPersonalEditMode(false);
      toast.success(t("personalUpdateSuccess"));
    } catch (error) {
      console.error("Error saving personal profile:", error);
      toast.error(error instanceof Error ? error.message : t("updateError"));
    } finally {
      setPersonalSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.current_password || !passwordForm.new_password) {
      toast.error(t("validationPasswordRequired"));
      return;
    }

    if (passwordForm.new_password.length < 8) {
      toast.error(t("validationPasswordMinLength"));
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error(t("validationPasswordConfirmMismatch"));
      return;
    }

    const endpoints = [
    "/account/change-password",
    "/account/company/password",
    "/account/password",
    "/auth/change-password"];

    setPasswordSaving(true);
    try {
      let changed = false;
      let lastError: unknown = null;

      for (const path of endpoints) {
        try {
          await api.post(path, {
            current_password: passwordForm.current_password,
            new_password: passwordForm.new_password
          });
          changed = true;
          break;
        } catch (error) {
          lastError = error;
          if (isEndpointUnavailableError(error)) {
            continue;
          }
          throw error;
        }
      }

      if (!changed) {
        throw (
          lastError instanceof Error ?
          lastError :
          new Error(t("changePasswordUnavailable"))
        );
      }

      setPasswordDialogOpen(false);
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: ""
      });
      toast.success(t("passwordChangeSuccess"));
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error(error instanceof Error ? error.message : t("changePasswordUnavailable"));
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleCancelPersonalEdit = () => {
    setPersonalEditMode(false);
    setPersonalForm({
      full_name: user?.full_name?.trim() || "",
      email: user?.email?.trim() || ""
    });
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit <= 0) return 0;
    return Math.min(100, Math.max(0, used / limit * 100));
  };

  const handleUpgradeNow = () => {
    if (typeof window === "undefined") return;
    if (!company?.id) {
      toast.error("Tài khoản chưa có thông tin công ty. Vui lòng hoàn tất onboarding trước.");
      router.push("/onboarding");
      return;
    }
    window.dispatchEvent(new Event(PRICING_MODAL_OPEN_EVENT));
  };

  const toDisplayDate = (value: string | null) => {
    if (!value) return t("notUpdated");
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return t("notUpdated");
    return parsed.toLocaleDateString(displayLocale);
  };
  const activePlan = normalizeSubscriptionPlan(
    subscriptionInfo.plan || company?.current_plan || "free",
    "free"
  );
  const activePlanFamily = getSubscriptionPlanFamily(activePlan);
  const isTrialPlan = activePlanFamily === "trial";
  const effectiveTargetMarkets = isTrialPlan ? [] : selectedTargetMarkets;
  const activeStandardSkuLimit =
    getStandardSkuLimitFromPlan(activePlan) ??
    (activePlanFamily === "standard" && usageLimits?.productsLimit ?
      usageLimits.productsLimit :
      null);
  const activePlanLabel =
    isTrialPlan ?
      "TRIAL" :
    activePlanFamily === "standard" ?
      "STANDARD" :
      activePlan.toUpperCase();
  const subscriptionNoticeLabel =
    isTrialPlan ?
      subscriptionInfo.trialExpired ?
        `${tPricing("trialExpiredBadge")} ${toDisplayDate(subscriptionInfo.trialEndsAt)}` :
      subscriptionInfo.trialDaysRemaining === null ?
        tPricing("trialPendingHint") :
        tPricing("trialRemainingHint", {
          days: subscriptionInfo.trialDaysRemaining,
          suffix: ""
        }) :
    activePlanFamily === "standard" ?
      subscriptionInfo.standardExpired ?
        `${isVi ? "Standard \u0111\u00e3 h\u1ebft h\u1ea1n" : "Standard expired"}${activeStandardSkuLimit ? ` - ${activeStandardSkuLimit} SKU` : ""}` :
      subscriptionInfo.standardDaysRemaining === null ?
        `${isVi ? "Standard \u0111ang ho\u1ea1t \u0111\u1ed9ng" : "Standard active"}${activeStandardSkuLimit ? ` - ${activeStandardSkuLimit} SKU` : ""}` :
        `${isVi ? "C\u00f2n" : "Remaining"} ${subscriptionInfo.standardDaysRemaining} ${isVi ? "ng\u00e0y" : "day(s)"}${activeStandardSkuLimit ? ` - ${activeStandardSkuLimit} SKU` : ""}` :
      isVi ? "G\u00f3i Export \u0111ang ho\u1ea1t \u0111\u1ed9ng" : "Export plan active";
  if (!canAccessSystemSettings) {
    return null;
  }

  const handleSave = async () => {
    if (!company) return;

    setSaving(true);
    try {
      await api.put("/account/company", {
        name: formData.name,
        business_type: formData.business_type,
        domestic_market: selectedDomesticMarket,
        target_markets: effectiveTargetMarkets
      });

      toast.success(t("updateSuccess"));
      setEditMode(false);
      setCompany((prev) =>
      prev ?
        {
          ...prev,
          name: formData.name,
          business_type: formData.business_type,
          domestic_market: selectedDomesticMarket,
          target_markets: effectiveTargetMarkets
        } :
      null
      );
    } catch (error) {
      console.error("Error saving company:", error);
      toast.error(t("updateError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-lg border border-slate-200 bg-slate-100/70 animate-pulse" />
        <div className="h-32 rounded-lg border border-slate-200 bg-slate-100/70 animate-pulse" />
      </div>);

  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border border-indigo-200 border-l-4 border-l-indigo-500 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
        <CardHeader className="rounded-t-[inherit] border-b border-indigo-200 bg-indigo-50 p-4 sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl text-indigo-900">
                <User className="w-5 h-5 text-indigo-700" />
                {t("personalInfo")}
              </CardTitle>
              <CardDescription className="text-indigo-800/80">
                {t("personalInfoDesc")}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {!personalEditMode ?
              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                type="button"
                onClick={() => setPersonalEditMode(true)}>

                  {t("edit")}
                </Button> :

              <>
                  <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-700 hover:bg-slate-200"
                  onClick={handleCancelPersonalEdit}>

                    <X className="w-4 h-4 mr-1" /> {t("cancel")}
                  </Button>
                  <Button
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={handlePersonalSave}
                  disabled={personalSaving}>

                    <Save className="w-4 h-4 mr-1" /> {t("save")}
                  </Button>
                </>
              }
              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                type="button"
                onClick={() => setPasswordDialogOpen(true)}>

                <KeyRound className="w-4 h-4" />
                {t("changePassword")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-4">
          <div className={`grid gap-3 ${isTrialPlan ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
            <div className="space-y-1.5">
              <Label>{t("fullName")}</Label>
              <Input
                value={personalEditMode ? personalForm.full_name : user?.full_name?.trim() || t("notUpdated")}
                className={`border-slate-300 text-slate-800 ${personalEditMode ? "bg-white" : "bg-slate-100 disabled:text-slate-800 disabled:opacity-100"}`}
                disabled={!personalEditMode}
                onChange={(e) =>
                setPersonalForm((prev) => ({ ...prev, full_name: e.target.value }))
                } />

            </div>
            <div className="space-y-1.5">
              <Label>{t("email")}</Label>
              <Input
                value={personalEditMode ? personalForm.email : user?.email?.trim() || t("noEmail")}
                className={`border-slate-300 text-slate-800 ${personalEditMode ? "bg-white" : "bg-slate-100 disabled:text-slate-800 disabled:opacity-100"}`}
                disabled={!personalEditMode}
                onChange={(e) =>
                setPersonalForm((prev) => ({ ...prev, email: e.target.value }))
                } />

            </div>
            <div className="space-y-1.5">
              <Label>{t("accountCreated")}</Label>
              <Input
                value={createdDateLabel}
                className="border-slate-300 bg-slate-100 text-slate-800 disabled:text-slate-800 disabled:opacity-100"
                disabled />

            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="border border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle>{t("changePassword")}</DialogTitle>
            <DialogDescription>
              {t("changePasswordDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("currentPassword")}</Label>
              <Input
                type="password"
                value={passwordForm.current_password}
                onChange={(e) =>
                setPasswordForm((prev) => ({
                  ...prev,
                  current_password: e.target.value
                }))
                }
                className="border-slate-300 bg-white" />
            </div>
            <div className="space-y-2">
              <Label>{t("newPassword")}</Label>
              <Input
                type="password"
                value={passwordForm.new_password}
                onChange={(e) =>
                setPasswordForm((prev) => ({
                  ...prev,
                  new_password: e.target.value
                }))
                }
                className="border-slate-300 bg-white" />
            </div>
            <div className="space-y-2">
              <Label>{t("confirmNewPassword")}</Label>
              <Input
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) =>
                setPasswordForm((prev) => ({
                  ...prev,
                  confirm_password: e.target.value
                }))
                }
                className="border-slate-300 bg-white" />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPasswordDialogOpen(false)}
              disabled={passwordSaving}>
              {t("cancel")}
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleChangePassword}
              disabled={passwordSaving}>
              {t("changePassword")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="overflow-hidden border border-emerald-200 border-l-4 border-l-emerald-500 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
        <CardHeader className="rounded-t-[inherit] border-b border-emerald-200 bg-emerald-50 p-4 sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl text-emerald-900">
                <Building2 className="w-5 h-5 text-emerald-700" />
                {t("companyInfo")}
              </CardTitle>
              <CardDescription className="text-emerald-800/80">
                {t("companyInfoDesc")}
              </CardDescription>
            </div>
            {!editMode ?
            <Button
              size="sm"
              variant="outline"
              className="border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
              onClick={() => setEditMode(true)}>

                {t("edit")}
              </Button> :

            <div className="flex gap-2">
                <Button
                size="sm"
                variant="ghost"
                className="text-slate-700 hover:bg-slate-200"
                onClick={handleCancelCompanyEdit}>

                  <X className="w-4 h-4 mr-1" /> {t("cancel")}
                </Button>
                <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleSave}
                disabled={saving}>

                  <Save className="w-4 h-4 mr-1" /> {t("save")}
                </Button>
              </div>
            }
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("companyName")}</Label>
              {editMode ?
              <Input
                value={formData.name}
                className="border-slate-300 bg-white"
                onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
                } /> :


              <p className="rounded border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm text-slate-800">
                  {company?.name || t("notUpdated")}
                </p>
              }
            </div>

            <div className="space-y-1.5">
              <Label>{t("businessType")}</Label>
              {editMode ?
              <Select
                value={formData.business_type}
                onValueChange={(value: "shop_online" | "brand" | "factory") =>
                setFormData((prev) => ({ ...prev, business_type: value }))
                }>

                  <SelectTrigger className="border-slate-300 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brand">{t("businessTypeBrand")}</SelectItem>
                    <SelectItem value="factory">
                      {t("businessTypeFactory")}
                    </SelectItem>
                    <SelectItem value="shop_online">
                      {t("businessTypeShop")}
                    </SelectItem>
                  </SelectContent>
                </Select> :

              <p className="rounded border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm text-slate-800">
                  {businessTypeLabel}
                </p>
              }
            </div>

            <div className="space-y-1.5">
              <Label>{t("domesticMarket")}</Label>
              {editMode ?
                <Select
                  value={selectedDomesticMarket}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, domestic_market: value }))
                  }>
                  <SelectTrigger className="border-slate-300 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_MARKET_OPTIONS.map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {formatTargetMarketLabel(option.code, locale)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select> :
                <p className="rounded border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm text-slate-800">
                  {formatTargetMarketLabel(
                    normalizeDomesticMarketCode(
                      company?.domestic_market,
                      company?.target_markets || []
                    ),
                    locale
                  )}
                </p>
              }
            </div>

            <div className="space-y-1.5">
              <Label>{t("targetMarkets")}</Label>
              {editMode ?
                isTrialPlan ?
                  <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {t("trialDomesticOnlyHint")}
                  </p> :
                  <div className="flex flex-wrap gap-2">
                    {TARGET_MARKET_OPTIONS.map((option) => {
                      const isSelected = effectiveTargetMarkets.includes(option.code);

                      return (
                        <button
                          key={option.code}
                          type="button"
                          onClick={() => handleToggleTargetMarket(option.code)}
                          className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                            isSelected ?
                              "border-emerald-500 bg-emerald-600 text-white" :
                              "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                          }`}>
                          {option.code}
                        </button>
                      );
                    })}
                  </div> :
                effectiveTargetMarkets.length > 0 ?
                  <div className="flex flex-wrap gap-2 rounded border border-slate-300 bg-slate-100 px-3 py-2">
                    {effectiveTargetMarkets.map((marketCode) => (
                      <span
                        key={marketCode}
                        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700">
                        {formatTargetMarketLabel(marketCode, locale)}
                      </span>
                    ))}
                  </div> :
                  <p className="rounded border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm text-slate-800">
                    {isTrialPlan ? t("trialDomesticOnlyHint") : t("targetMarketsEmpty")}
                  </p>
              }
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>{t("servicePlan")}</Label>
              <p className="rounded border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm text-slate-800">
                {activePlanLabel}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border border-amber-200 border-l-4 border-l-amber-500 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
        <CardHeader className="rounded-t-[inherit] border-b border-amber-200 bg-amber-50 p-4 sm:p-5">
          <CardTitle className="flex items-center gap-2 text-xl text-amber-900">
            <Zap className="w-5 h-5 text-amber-700" />
            {t("usageLimits")}
          </CardTitle>
          <CardDescription className="text-amber-800/80">
            {t("usageLimitsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-4">
          <div className="mb-3">
            <p className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">{subscriptionNoticeLabel}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <Label className="text-slate-700">{t("products")}</Label>
                <span className="text-sm font-medium">
                  {usageLimits ?
                  `${usageLimits.productsUsed} / ${usageLimits.productsLimit}` :
                  t("notUpdated")}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-300">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${getUsagePercentage(
                      usageLimits?.productsUsed || 0,
                      usageLimits?.productsLimit || 0
                    )}%`
                  }} />

              </div>
            </div>

            <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <Label className="text-slate-700">{t("members")}</Label>
                <span className="text-sm font-medium">
                  {usageLimits ?
                  `${usageLimits.membersUsed} / ${usageLimits.membersLimit}` :
                  t("notUpdated")}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-300">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${getUsagePercentage(
                      usageLimits?.membersUsed || 0,
                      usageLimits?.membersLimit || 0
                    )}%`
                  }} />

              </div>
            </div>

            {!isTrialPlan && (
              <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <Label className="text-slate-700">{t("apiCalls")}</Label>
                <span className="text-sm font-medium">
                  {usageLimits ?
                  `${usageLimits.apiCallsUsed.toLocaleString(displayLocale)} / ${usageLimits.apiCallsLimit.toLocaleString(displayLocale)}` :
                  t("notUpdated")}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-300">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${getUsagePercentage(
                      usageLimits?.apiCallsUsed || 0,
                      usageLimits?.apiCallsLimit || 0
                    )}%`
                  }} />

              </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-3 rounded-lg border border-emerald-300 bg-emerald-100/70 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-slate-900">{t("upgradeTitle")}</p>
              <p className="text-sm text-slate-700">{t("upgradeDesc")}</p>
            </div>
            <Button
              size="sm"
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
              onClick={handleUpgradeNow}
            >
              {t("upgradeNow")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>);

};

export default SystemSettings;
