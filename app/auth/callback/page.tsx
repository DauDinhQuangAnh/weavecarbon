"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { authTokenStore, isApiError, isUnauthorizedApiError } from "@/lib/apiClient";
import {
  buildAuthErrorUrl,
  buildCheckEmailUrl,
  normalizeAuthUserType,
  resolveAuthenticatedUserType,
  resolvePostLoginPath,
  type AuthUserType
} from "@/lib/auth/routing";
import {
  clearGoogleOAuthInflightState,
  getGoogleRememberPreference,
  getGoogleRequestedRole
} from "@/lib/auth/googleOAuth";

const PRICING_PROMPT_ON_LOGIN_KEY = "weavecarbon_show_pricing_on_login";

const clearStoredAuthUser = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("weavecarbon_user");
};

const clearCallbackHash = () => {
  if (typeof window === "undefined") return;
  if (!window.location.hash && !window.location.search) return;
  window.history.replaceState({}, document.title, window.location.pathname);
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

    const handleCallback = async () => {
      let callbackRequestedRole: AuthUserType | null =
        getGoogleRequestedRole();

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
        callbackRequestedRole =
          normalizeAuthUserType(
            hash.get("type") ||
            query.get("type") ||
            hash.get("role") ||
            query.get("role")
          ) || callbackRequestedRole;

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
                intent: authIntent,
                type: callbackRequestedRole
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
          router.replace(
            buildAuthErrorUrl({
              type: callbackRequestedRole,
              error: errorCode,
              errorDescription
            })
          );
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
              intent: authIntent,
              type: callbackRequestedRole
            })
          );
          return;
        }

        if (!accessToken) {
          clearGoogleOAuthInflightState();
          clearCallbackHash();
          const message = mapGoogleErrorMessage("MISSING_CODE", t);
          if (!cancelled) {
            setErrorMessage(message);
          }
          router.replace(
            buildAuthErrorUrl({
              type: callbackRequestedRole,
              error: "MISSING_CODE"
            })
          );
          return;
        }

        const rememberMe = getGoogleRememberPreference();
        const requestedRole = getGoogleRequestedRole();

        authTokenStore.setTokens({
          access_token: accessToken,
          refresh_token: refreshToken || undefined
        }, {
          persist: rememberMe,
          cookieBacked: true,
          storeRefreshToken: false
        });
        sessionStorage.setItem(PRICING_PROMPT_ON_LOGIN_KEY, "1");
        clearGoogleOAuthInflightState();
        clearCallbackHash();

        const actualRole = await resolveAuthenticatedUserType({
          shouldIgnoreAccountError: (error) => !isUnauthorizedApiError(error)
        });
        if (
          requestedRole &&
          actualRole &&
          requestedRole !== actualRole
        ) {
          authTokenStore.clear();
          clearStoredAuthUser();
          router.replace(
            buildAuthErrorUrl({
              type: requestedRole,
              error: "ACCOUNT_TYPE_MISMATCH",
              errorDescription: actualRole
            })
          );
          return;
        }

        await refreshUser();
        const destination = await resolvePostLoginPath({
          accountType: actualRole,
          onboardingPath: "/onboarding?source=google",
          requestedType: callbackRequestedRole || requestedRole,
          onCompanyCheckError: (error, context) => {
            if (isApiError(error) && error.code === "EMAIL_NOT_VERIFIED") {
              authTokenStore.clear();
              clearStoredAuthUser();
              return buildCheckEmailUrl({
                source: "google",
                intent: "signin",
                type: context.requestedType
              });
            }

            if (isUnauthorizedApiError(error)) {
              authTokenStore.clear();
              clearStoredAuthUser();
              return buildAuthErrorUrl({
                type: context.requestedType,
                error: "UNAUTHORIZED"
              });
            }

            return null;
          }
        });
        router.replace(destination);
      } catch {
        clearGoogleOAuthInflightState();
        clearCallbackHash();
        if (!cancelled) {
          setErrorMessage(mapGoogleErrorMessage("GOOGLE_AUTH_FAILED", t));
        }
        authTokenStore.clear();
        clearStoredAuthUser();
        router.replace(
          buildAuthErrorUrl({
            type: callbackRequestedRole,
            error: "GOOGLE_AUTH_FAILED"
          })
        );
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
