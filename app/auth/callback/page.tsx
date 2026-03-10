"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { api, authTokenStore, isApiError, isUnauthorizedApiError } from "@/lib/apiClient";
import {
  clearGoogleOAuthInflightState,
  getGoogleRememberPreference
} from "@/lib/auth/googleOAuth";

const PRICING_PROMPT_ON_LOGIN_KEY = "weavecarbon_show_pricing_on_login";

type CompanyCheckPayload = {
  is_b2b?: boolean;
  has_company?: boolean;
  user_type?: "b2b" | "b2c" | "admin";
  data?: {
    is_b2b?: boolean;
    has_company?: boolean;
    user_type?: "b2b" | "b2c" | "admin";
  };
};

const normalizeCompanyCheck = (payload: CompanyCheckPayload | null) => {
  const nested = payload?.data;
  const source = nested || payload || {};
  const isB2b =
    typeof source.is_b2b === "boolean" ? source.is_b2b : source.user_type === "b2b";
  const hasCompany =
    typeof source.has_company === "boolean" ? source.has_company : false;
  return { isB2b, hasCompany };
};

const clearStoredAuthUser = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("weavecarbon_user");
};

const clearCallbackHash = () => {
  if (typeof window === "undefined") return;
  if (!window.location.hash && !window.location.search) return;
  window.history.replaceState({}, document.title, window.location.pathname);
};

const buildCheckEmailUrl = (params: {
  email?: string | null;
  source?: "google" | "email";
  intent?: "signin" | "signup";
}) => {
  const query = new URLSearchParams();
  if (params.email?.trim()) {
    query.set("email", params.email.trim());
  }
  if (params.source) {
    query.set("source", params.source);
  }
  if (params.intent) {
    query.set("intent", params.intent);
  }
  const serialized = query.toString();
  return serialized ? `/auth/check-email?${serialized}` : "/auth/check-email";
};

const mapGoogleErrorMessage = (
errorCode: string,
t: ReturnType<typeof useTranslations>,
fallback?: string) =>
{
  switch (errorCode) {
    case "GOOGLE_ACCOUNT_NOT_FOUND":
      return t("errors.accountNotFound");
    case "GOOGLE_EMAIL_ALREADY_REGISTERED":
      return t("errors.emailExists");
    case "INVALID_OAUTH_STATE":
      return t("errors.invalidState");
    case "GOOGLE_TOKEN_EXCHANGE_FAILED":
    case "GOOGLE_USERINFO_FAILED":
    case "GOOGLE_AUTH_FAILED":
      return t("errors.authUnavailable");
    case "MISSING_CODE":
      return t("errors.missingCode");
    case "EMAIL_NOT_VERIFIED":
      return t("errors.emailNotVerified");
    default:
      return fallback || errorCode;
  }
};

const isTruthyFlag = (value: string | null) =>
["1", "true"].includes((value || "").toLowerCase());

export default function AuthCallbackPage() {
  const t = useTranslations("authCallback");
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasHandledCallback = useRef(false);

  useEffect(() => {
    if (hasHandledCallback.current) return;
    hasHandledCallback.current = true;

    let cancelled = false;

    const resolvePostLoginPath = async () => {
      try {
        const payload = await api.get<CompanyCheckPayload>("/auth/check-company");
        const { isB2b, hasCompany } = normalizeCompanyCheck(payload);
        if (isB2b && !hasCompany) return "/onboarding?source=google";
        if (!isB2b) return "/b2c";
        return "/overview";
      } catch (error) {
        if (isApiError(error) && error.code === "EMAIL_NOT_VERIFIED") {
          authTokenStore.clear();
          clearStoredAuthUser();
          return buildCheckEmailUrl({ source: "google", intent: "signin" });
        }
        if (isUnauthorizedApiError(error)) {
          authTokenStore.clear();
          clearStoredAuthUser();
          return "/auth?error=UNAUTHORIZED";
        }
        return "/overview";
      }
    };

    const handleCallback = async () => {
      try {
        const url = new URL(window.location.href);
        const query = url.searchParams;
        const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");

        const errorCode = query.get("error") || hash.get("error");
        const errorDescription =
        query.get("error_description") || hash.get("error_description");
        const authIntentRaw = hash.get("auth_intent") || query.get("auth_intent");
        const authIntent =
        authIntentRaw === "signup" ? "signup" as const : "signin" as const;
        const callbackEmail = hash.get("email") || query.get("email");

        if (errorCode) {
          if (errorCode === "EMAIL_NOT_VERIFIED") {
            clearGoogleOAuthInflightState();
            clearCallbackHash();
            authTokenStore.clear();
            clearStoredAuthUser();
            router.replace(
              buildCheckEmailUrl({
                email: callbackEmail || errorDescription,
                source: "google",
                intent: authIntent
              })
            );
            return;
          }

          clearGoogleOAuthInflightState();
          clearCallbackHash();
          const mappedMessage = mapGoogleErrorMessage(
            errorCode,
            t,
            errorDescription || undefined
          );
          if (!cancelled) {
            setErrorMessage(mappedMessage);
          }
          const nextParams = new URLSearchParams();
          nextParams.set("error", errorCode);
          if (errorDescription) {
            nextParams.set("error_description", errorDescription);
          }
          router.replace(`/auth?${nextParams.toString()}`);
          return;
        }

        const accessToken = hash.get("access_token") || query.get("access_token");
        const refreshToken = hash.get("refresh_token") || query.get("refresh_token");
        const requiresEmailVerification = isTruthyFlag(
          hash.get("requires_email_verification") || query.get("requires_email_verification")
        ) || isTruthyFlag(
          hash.get("email_verification_required") || query.get("email_verification_required")
        );
        const nextStep = hash.get("next_step") || query.get("next_step");
        const normalizedNextStep = (nextStep || "").toLowerCase();

        const shouldGoToCheckEmail =
        requiresEmailVerification ||
        normalizedNextStep === "verify_email" ||
        normalizedNextStep === "email_verification" ||
        normalizedNextStep === "check_email";

        if (shouldGoToCheckEmail) {
          clearGoogleOAuthInflightState();
          clearCallbackHash();
          authTokenStore.clear();
          clearStoredAuthUser();
          router.replace(
            buildCheckEmailUrl({
              email: callbackEmail || errorDescription,
              source: "google",
              intent: authIntent
            })
          );
          return;
        }

        if (!accessToken || !refreshToken) {
          clearGoogleOAuthInflightState();
          clearCallbackHash();
          const message = mapGoogleErrorMessage("MISSING_CODE", t);
          if (!cancelled) {
            setErrorMessage(message);
          }
          router.replace("/auth?error=MISSING_CODE");
          return;
        }

        const rememberMe = getGoogleRememberPreference();

        authTokenStore.setTokens({
          access_token: accessToken,
          refresh_token: refreshToken
        }, { persist: rememberMe });
        sessionStorage.setItem(PRICING_PROMPT_ON_LOGIN_KEY, "1");
        clearGoogleOAuthInflightState();
        clearCallbackHash();

        await refreshUser();
        const destination = await resolvePostLoginPath();
        router.replace(destination);
      } catch {
        clearGoogleOAuthInflightState();
        clearCallbackHash();
        if (!cancelled) {
          setErrorMessage(mapGoogleErrorMessage("GOOGLE_AUTH_FAILED", t));
        }
        authTokenStore.clear();
        clearStoredAuthUser();
        router.replace("/auth?error=GOOGLE_AUTH_FAILED");
      }
    };

    void handleCallback();

    return () => {
      cancelled = true;
    };
  }, [refreshUser, router, t]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <h2 className="text-lg font-semibold">{t("processingTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {errorMessage ? t("errorPrefix", { message: errorMessage }) : t("pleaseWait")}
        </p>
      </div>
    </div>);

}
