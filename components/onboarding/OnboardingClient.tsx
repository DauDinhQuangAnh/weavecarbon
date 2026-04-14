"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/useToast";
import { api } from "@/lib/apiClient";
import { toAnalyticsErrorCode, trackEvent } from "@/lib/analytics";
import { clearSubscriptionLockStateCache } from "@/lib/subscriptionLockState";
import { resolveDomesticMarketCode } from "@/lib/targetMarkets";
import OnboardingHeader from "./OnboardingHeader";
import OnboardingForm from "./OnboardingForm";
import { useLocale, useTranslations } from "next-intl";

const PRICING_PROMPT_ON_LOGIN_KEY = "weavecarbon_show_pricing_on_login";

interface CompanyMutationResponse {
  id?: string;
}

const OnboardingClient: React.FC = () => {
  const { user, loading, refreshUser, updateUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const locale = useLocale();
  const t = useTranslations("onboarding");
  const isGoogleFlow = searchParams.get("source") === "google";
  const defaultDomesticMarket = resolveDomesticMarketCode(locale);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [businessType, setBusinessType] = useState<string>("");
  const [domesticMarket, setDomesticMarket] = useState<string>(defaultDomesticMarket);

  useEffect(() => {
    if (!domesticMarket) {
      setDomesticMarket(defaultDomesticMarket);
    }
  }, [defaultDomesticMarket, domesticMarket]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/auth");
      return;
    }

    router.prefetch("/overview");

    if (user.company_id && !isGoogleFlow) {
      router.replace("/overview");
    }
  }, [user, loading, router, isGoogleFlow]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim() || !businessType) {
      toast({
        title: t("error"),
        description: t("fillRequired"),
        variant: "destructive"
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: t("error"),
        description: t("userNotAuthenticated"),
        variant: "destructive"
      });
      return;
    }

    const analyticsPayload = {
      business_type: businessType as "brand" | "factory" | "shop_online",
      domestic_market: domesticMarket || defaultDomesticMarket
    } as const;
    trackEvent("wc_onboarding_submit", analyticsPayload);
    setIsSubmitting(true);

    try {
      let company: CompanyMutationResponse | null = null;
      const companyPayload = {
        name: companyName,
        business_type: businessType as "shop_online" | "brand" | "factory",
        domestic_market: domesticMarket || defaultDomesticMarket,
        target_markets: []
      };

      if (user.company_id) {
        company = await api.put<CompanyMutationResponse>("/account/company", companyPayload);
      } else {
        try {
          company = await api.post<CompanyMutationResponse>("/account/company", companyPayload);
        } catch (error) {
          const message =
          error instanceof Error ? error.message.toLowerCase() : "";
          const canFallbackToUpdate =
          message.includes("already") ||
          message.includes("duplicate") ||
          message.includes("exists");

          if (!canFallbackToUpdate) {
            throw error;
          }

          company = await api.put<CompanyMutationResponse>("/account/company", companyPayload);
        }
      }

      toast({
        title: t("success"),
        description: t("companySaved")
      });
      trackEvent("wc_onboarding_completed", analyticsPayload);

      if (typeof window !== "undefined") {
        sessionStorage.setItem(PRICING_PROMPT_ON_LOGIN_KEY, "1");
      }

      clearSubscriptionLockStateCache();

      const nextCompanyId = company?.id || user.company_id || null;

      if (!nextCompanyId) {
        await refreshUser();
        router.replace("/overview");
        return;
      }

      updateUser({
        company_id: nextCompanyId
      });
      router.replace("/overview");
      void refreshUser().catch(() => undefined);
    } catch (error) {
      const message =
      error instanceof Error ? error.message : "Something went wrong";
      trackEvent("wc_onboarding_error", {
        ...analyticsPayload,
        error_code: toAnalyticsErrorCode(error)
      });
      console.error("Onboarding error:", error);
      toast({
        title: t("error"),
        description: message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background via-background to-primary/5">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">{t("loadingProfile")}</p>
        </div>
      </div>);

  }

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-primary/5 flex items-center justify-center p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center">
        <OnboardingHeader />
        <OnboardingForm
          companyName={companyName}
          setCompanyName={setCompanyName}
          businessType={businessType}
          setBusinessType={setBusinessType}
          domesticMarket={domesticMarket}
          setDomesticMarket={setDomesticMarket}
          defaultDomesticMarket={defaultDomesticMarket}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit} />

      </div>
    </div>);

};

export default OnboardingClient;
