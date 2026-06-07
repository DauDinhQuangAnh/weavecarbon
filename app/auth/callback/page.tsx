"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  api,
  authTokenStore,
  clearPersistedAuthState,
  isApiError,
  isUnauthorizedApiError,
  syncAuthUserSnapshotFromPayload
} from "@/lib/apiClient";
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
  getGoogleRequestedRole
} from "@/lib/auth/googleOAuth";

const PRICING_PROMPT_ON_LOGIN_KEY = "weavecarbon_show_pricing_on_login";

const clearStoredAuthUser = () => {
  clearPersistedAuthState();
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

type AuthIntent = "signin" | "signup";

interface CallbackSessionPayload {
  roles?: AuthUserType[];
  company?: {
    id?: string | null;
  } | null;
  profile?: {
    company_id?: string | null;
  } | null;
  company_membership?: {
    company_id?: string | null;
  } | null;
}

const getSessionCompanyId = (session: CallbackSessionPayload | null) =>
  session?.company?.id ||
  session?.profile?.company_id ||
  session?.company_membership?.company_id ||
  null;

const parseCallbackParams = () => {
  const url = new URL(window.location.href);
  const query = url.searchParams;
  const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");
  const readParam = (key: string) => hash.get(key) || query.get(key);
  const authIntent: AuthIntent = readParam("auth_intent") === "signup" ? "signup" : "signin";
  const nextStep = (readParam("next_step") || "").toLowerCase();
  const requiresEmailVerification =
    isTruthyFlag(readParam("requires_email_verification")) ||
    isTruthyFlag(readParam("email_verification_required"));

  return {
    accessToken: readParam("access_token"),
    authIntent,
    callbackEmail: readParam("email"),
    errorCode: readParam("error"),
    errorDescription: readParam("error_description"),
    refreshToken: readParam("refresh_token"),
    requiresCompanySetup: isTruthyFlag(readParam("requires_company_setup")),
    requestedRole: normalizeAuthUserType(
      readParam("type") ||
      readParam("role")
    ),
    shouldGoToCheckEmail:
      requiresEmailVerification ||
      nextStep === "verify_email" ||
      nextStep === "email_verification" ||
      nextStep === "check_email"
  };
};

const storeCallbackTokens = (accessToken: string, refreshToken: string | null) => {
  authTokenStore.setTokens({
    access_token: accessToken,
    refresh_token: refreshToken || undefined
  }, {
    persist: false,
    storageScope: "storage",
    storeRefreshToken: true
  });
};

const hydrateCallbackSession = async () => {
  try {
    const sessionPayload = await api.get<CallbackSessionPayload>("/auth/session", {
      disableResponseCache: true
    });
    syncAuthUserSnapshotFromPayload(sessionPayload);
    return sessionPayload;
  } catch (error) {
    console.error("[auth] Google callback session bootstrap failed:", error);
    return null;
  }
};

const resolveCallbackRole = async (
  sessionPayload: CallbackSessionPayload | null,
  effectiveRequestedRole?: AuthUserType
) => {
  const sessionRole = normalizeAuthUserType(sessionPayload?.roles?.[0]);
  if (sessionRole || effectiveRequestedRole) {
    return sessionRole || effectiveRequestedRole;
  }

  try {
    return await resolveAuthenticatedUserType({
      fallbackRole: effectiveRequestedRole,
      shouldIgnoreAccountError: (error) => !isUnauthorizedApiError(error),
      shouldIgnoreCompanyCheckError: (error) => !isUnauthorizedApiError(error)
    });
  } catch {
    return effectiveRequestedRole;
  }
};

const resolveCallbackDestination = async ({
  actualRole,
  effectiveRequestedRole,
  requiresCompanySetup,
  sessionPayload
}: {
  actualRole?: AuthUserType;
  effectiveRequestedRole?: AuthUserType;
  requiresCompanySetup: boolean;
  sessionPayload: CallbackSessionPayload | null;
}) => {
  const sessionCompanyId = getSessionCompanyId(sessionPayload);
  const shouldRouteToCompanySetup =
    actualRole === "b2b" ?
      requiresCompanySetup || (sessionPayload ? !sessionCompanyId : false) :
      false;

  return resolvePostLoginPath({
    accountType: actualRole,
    companyCheckPayload: actualRole ? {
      has_company: actualRole === "b2b" ? !shouldRouteToCompanySetup : false,
      is_b2b: actualRole === "b2b",
      user_type: actualRole
    } : undefined,
    onboardingPath: "/onboarding?source=google",
    requestedType: effectiveRequestedRole,
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
          error: "GOOGLE_AUTH_FAILED"
        });
      }

      return null;
    }
  });
};

export default function AuthCallbackPage() {
  const t = useTranslations("authCallback");
  const router = useRouter();
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
        const callbackParams = parseCallbackParams();
        callbackRequestedRole = callbackParams.requestedRole || callbackRequestedRole;

        if (callbackParams.errorCode) {
          if (callbackParams.errorCode === "EMAIL_NOT_VERIFIED") {
            clearGoogleOAuthInflightState();
            clearCallbackHash();
            authTokenStore.clear();
            clearStoredAuthUser();
            router.replace(
              buildCheckEmailUrl({
                email: callbackParams.callbackEmail || callbackParams.errorDescription,
                source: "google",
                intent: callbackParams.authIntent,
                type: callbackRequestedRole
              })
            );
            return;
          }

          clearGoogleOAuthInflightState();
          clearCallbackHash();
          const mappedMessage = mapGoogleErrorMessage(
            callbackParams.errorCode,
            t,
            callbackParams.errorDescription || undefined
          );
          if (!cancelled) {
            setErrorMessage(mappedMessage);
          }
          router.replace(
            buildAuthErrorUrl({
              type: callbackRequestedRole,
              error: callbackParams.errorCode,
              errorDescription: callbackParams.errorDescription
            })
          );
          return;
        }

        if (callbackParams.shouldGoToCheckEmail) {
          clearGoogleOAuthInflightState();
          clearCallbackHash();
          authTokenStore.clear();
          clearStoredAuthUser();
          router.replace(
            buildCheckEmailUrl({
              email: callbackParams.callbackEmail || callbackParams.errorDescription,
              source: "google",
              intent: callbackParams.authIntent,
              type: callbackRequestedRole
            })
          );
          return;
        }

        const requestedRole = getGoogleRequestedRole();
        const effectiveRequestedRole = callbackRequestedRole || requestedRole || undefined;

        if (callbackParams.accessToken) {
          storeCallbackTokens(callbackParams.accessToken, callbackParams.refreshToken);
        }
        sessionStorage.setItem(PRICING_PROMPT_ON_LOGIN_KEY, "1");
        clearGoogleOAuthInflightState();
        clearCallbackHash();

        if (!callbackParams.accessToken) {
          throw new Error("GOOGLE_SESSION_BOOTSTRAP_FAILED");
        }

        const sessionPayload = await hydrateCallbackSession();
        const actualRole =
          await resolveCallbackRole(sessionPayload, effectiveRequestedRole) ||
          effectiveRequestedRole;

        if (
          effectiveRequestedRole &&
          actualRole &&
          effectiveRequestedRole !== actualRole
        ) {
          authTokenStore.clear();
          clearStoredAuthUser();
          router.replace(
            buildAuthErrorUrl({
              type: effectiveRequestedRole,
              error: "ACCOUNT_TYPE_MISMATCH",
              errorDescription: actualRole
            })
          );
          return;
        }

        const destination = await resolveCallbackDestination({
          actualRole,
          effectiveRequestedRole,
          requiresCompanySetup: callbackParams.requiresCompanySetup,
          sessionPayload
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
  }, [router, t]);

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
