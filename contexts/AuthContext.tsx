"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback } from
"react";
import { usePathname } from "next/navigation";
import {
  AUTH_INVALIDATED_EVENT,
  AUTH_INVALIDATED_STORAGE_KEY,
  API_BASE_URL,
  authTokenStore,
  ensureAccessToken,
  invalidateApiResponseCache,
  setApiSessionEpoch,
  setAuthUserSnapshot,
  syncAuthUserSnapshotFromPayload } from
"@/lib/apiClient";
import { AUTH_DISABLED } from "@/lib/env";
import {
  clearSubscriptionLockStateCache } from
"@/lib/subscriptionLockState";
import { invalidateSubscriptionApiCache } from "@/lib/subscriptionApi";
import { isDemoPath } from "@/lib/demo/routes";
import { ensureDemoDataset } from "@/lib/demo/storage";
import {
  clearDemoSession,
  ensureDemoSession } from
"@/lib/demo/session";
import { DEMO_SESSION_STORAGE_KEY, B2C_DEMO_SESSION_KEY } from "@/lib/demo/constants";
import {
  clearGoogleOAuthInflightState,
  hasActiveGoogleOAuthInflight,
  markGoogleOAuthInflight
} from "@/lib/auth/googleOAuth";
import type {
  AccountPayload,
  AuthContextType,
  AuthSessionStatus,
  DemoPayload,
  GoogleAuthIntent,
  RefreshUserOptions,
  SignInOptions,
  SignInPayload,
  SignUpOptions,
  SignUpPayload,
  User
} from "./auth/types";
import {
  buildUserFromAccount,
  buildUserFromDemo,
  buildUserFromSignIn,
  buildUserFromSignUp,
  getCurrentFrontendOrigin,
  loadB2CDemoUser,
  loadDemoUser,
  normalizeStoredUser,
  writeDemoLockState
} from "./auth/userBuilders";
import {
  getAccountSafely,
  getSessionSafely,
  isAuthFailureError,
  isEmailNotVerifiedError,
  loadStoredAuthUser,
  postWithFallback,
  resolveAuthenticatedUserType,
  syncUserCompanyRole
} from "./auth/session";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PRICING_PROMPT_ON_LOGIN_KEY = "weavecarbon_show_pricing_on_login";

const isAuthCallbackPath = (path?: string | null) =>
  (path || "").toLowerCase().startsWith("/auth/callback");

export const AuthProvider: React.FC<{children: React.ReactNode;}> = ({
  children
}) => {
  const pathname = usePathname();
  const isDemoRuntime = isDemoPath(pathname);
  const [user, setUser] = useState<User | null>(null);
  const [demoUser, setDemoUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<AuthSessionStatus>("checking");
  const userRef = useRef<User | null>(null);
  const hasRealSession = Boolean(user?.id || authTokenStore.getAccessToken());
  const effectiveUser = isDemoRuntime ? demoUser || user : user;
  const sessionEpoch = [
    authStatus,
    effectiveUser?.id || "anonymous",
    effectiveUser?.company_id || "no-company"
  ].join(":");

  const applyRuntimeUser = useCallback((nextUser: User | null) => {
    const normalizedUser = normalizeStoredUser(nextUser);
    userRef.current = normalizedUser;
    setAuthUserSnapshot(normalizedUser);
    setUser(normalizedUser);
  }, []);

  const applySessionPayload = useCallback(async (session: SignInPayload) => {
    if (session.tokens) {
      authTokenStore.setTokens(session.tokens, {
        persist: false,
        storageScope: "storage",
        storeRefreshToken: true
      });
    }
    syncAuthUserSnapshotFromPayload(session);
    const nextUser = await syncUserCompanyRole(buildUserFromSignIn(session));
    applyRuntimeUser(nextUser);
    return nextUser;
  }, [applyRuntimeUser]);

  const applyAccountPayload = useCallback(async (account: AccountPayload) => {
    syncAuthUserSnapshotFromPayload(account);
    const nextUser = await syncUserCompanyRole(
      buildUserFromAccount(account, userRef.current)
    );
    applyRuntimeUser(nextUser);
    return nextUser;
  }, [applyRuntimeUser]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    setApiSessionEpoch({
      authStatus,
      companyId: effectiveUser?.company_id || null,
      userId: effectiveUser?.id || null
    });
  }, [authStatus, effectiveUser?.company_id, effectiveUser?.id]);

  useEffect(() => {
    let cancelled = false;

    const bootstrapSession = async () => {
      if (isDemoRuntime) {
        try {
          ensureDemoDataset();
          ensureDemoSession();
          writeDemoLockState();
          if (!cancelled) {
            setDemoUser(loadDemoUser());
            setAuthStatus("authenticated");
            setLoading(false);
          }
        } catch {
          if (!cancelled) {
            setDemoUser(null);
            setAuthStatus("anonymous");
            setLoading(false);
          }
        }
        return;
      }

      if (isAuthCallbackPath(pathname)) {
        if (!cancelled) {
          setDemoUser(null);
          setAuthStatus("checking");
          setLoading(false);
        }
        return;
      }

      // Restore B2C local demo session (offline, no server tokens required)
      const b2cDemoUser = loadB2CDemoUser();
      if (b2cDemoUser) {
        if (!cancelled) {
          writeDemoLockState();
          applyRuntimeUser(b2cDemoUser);
          setAuthStatus("authenticated");
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setDemoUser(null);
      }

      if (AUTH_DISABLED) {
        if (!cancelled) {
          applyRuntimeUser(null);
          setAuthStatus("anonymous");
          setLoading(false);
        }
        return;
      }

      const storedUser = loadStoredAuthUser();
      if (storedUser && !cancelled) {
        applyRuntimeUser(storedUser);
        setAuthStatus("recovering");
      } else if (!cancelled) {
        setAuthStatus("checking");
      }

      try {
        const accessToken = await ensureAccessToken();
        if (!accessToken) {
          clearSubscriptionLockStateCache();
          invalidateSubscriptionApiCache();
          invalidateApiResponseCache("bootstrap-no-token");
          if (!cancelled) {
            applyRuntimeUser(null);
            setAuthStatus(storedUser ? "expired" : "anonymous");
          }
          return;
        }

        const session = await getSessionSafely();
        if (!session) {
          throw new Error("Session bootstrap failed.");
        }
        if (cancelled) return;
        await applySessionPayload(session);
        if (!cancelled) {
          setAuthStatus("authenticated");
        }
      } catch (error) {
        const fallbackBaseUser = userRef.current || storedUser;
        const fallbackUser = isAuthFailureError(error) ?
          null :
          await syncUserCompanyRole(fallbackBaseUser);
        const hasAuthToken = Boolean(authTokenStore.getAccessToken());
        if (!fallbackUser) {
          clearSubscriptionLockStateCache();
          invalidateSubscriptionApiCache();
          invalidateApiResponseCache("bootstrap-no-fallback-user");
        }
        if (!cancelled) {
          if (fallbackUser && hasAuthToken && !isAuthFailureError(error)) {
            applyRuntimeUser(fallbackUser);
            setAuthStatus("authenticated");
          } else {
            applyRuntimeUser(null);
            setAuthStatus(isAuthFailureError(error) ? "expired" : "anonymous");
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, [applyRuntimeUser, applySessionPayload, isDemoRuntime, pathname]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === AUTH_INVALIDATED_STORAGE_KEY) {
        if (!isDemoRuntime) {
          clearSubscriptionLockStateCache();
          invalidateSubscriptionApiCache();
          invalidateApiResponseCache("auth-invalidated-storage");
          applyRuntimeUser(null);
          setAuthStatus("expired");
          setLoading(false);
        }
        return;
      }

      if (event.key !== null && event.key !== DEMO_SESSION_STORAGE_KEY) {
        return;
      }

      if (isDemoRuntime) {
        setDemoUser(loadDemoUser());
      }
    };

    const handleAuthInvalidated = () => {
      if (isDemoRuntime) {
        return;
      }

      clearSubscriptionLockStateCache();
      invalidateSubscriptionApiCache();
      invalidateApiResponseCache("auth-invalidated-event");
      applyRuntimeUser(null);
      setAuthStatus("expired");
      setLoading(false);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(AUTH_INVALIDATED_EVENT, handleAuthInvalidated);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(AUTH_INVALIDATED_EVENT, handleAuthInvalidated);
    };
  }, [applyRuntimeUser, isDemoRuntime]);

  const updateUser = useCallback((updates: Partial<User>) => {
    if (isDemoRuntime) {
      setDemoUser((prev) => (prev ? { ...prev, ...updates } : prev));
      return;
    }

    setUser((prev) => {
      if (!prev) return prev;
      const next = normalizeStoredUser({ ...prev, ...updates });
      userRef.current = next;
      setAuthUserSnapshot(next);
      return next;
    });
  }, [isDemoRuntime]);

  const refreshUser = useCallback(async (options?: RefreshUserOptions) => {
    const preserveUserOnFailure = options?.preserveUserOnFailure === true;
    if (isDemoRuntime) {
      ensureDemoDataset();
      ensureDemoSession();
      writeDemoLockState();
      setDemoUser(loadDemoUser());
      setAuthStatus("authenticated");
      setLoading(false);
      return;
    }

    if (AUTH_DISABLED) {
      applyRuntimeUser(null);
      setAuthStatus("anonymous");
      setLoading(false);
      return;
    }

    try {
      if (preserveUserOnFailure && userRef.current) {
        setAuthStatus("recovering");
      }

      const accessToken = await ensureAccessToken();
      if (!accessToken) {
        clearSubscriptionLockStateCache();
        invalidateSubscriptionApiCache();
        invalidateApiResponseCache("refresh-user-no-token");
        applyRuntimeUser(null);
        setAuthStatus("expired");
        return;
      }

      let nextUser: User | null = null;
      let account: AccountPayload | null = null;
      let accountError: unknown = null;
      try {
        account = await getAccountSafely();
      } catch (error) {
        accountError = error;
      }

      if (account) {
        nextUser = await applyAccountPayload(account);
      }

      if (!nextUser) {
        const session = await getSessionSafely();
        if (session) {
          nextUser = await applySessionPayload(session);
        } else if (accountError) {
          throw accountError;
        }
      }

      if (!nextUser) {
        nextUser = await syncUserCompanyRole(userRef.current);
        applyRuntimeUser(nextUser);
      }

      setAuthStatus(nextUser ? "authenticated" : "anonymous");
    } catch (error) {
      const hasAuthToken = Boolean(authTokenStore.getAccessToken());
      if (!hasAuthToken || isAuthFailureError(error)) {
        clearSubscriptionLockStateCache();
        invalidateSubscriptionApiCache();
        invalidateApiResponseCache("refresh-user-expired");
        applyRuntimeUser(null);
        setAuthStatus(isAuthFailureError(error) ? "expired" : "anonymous");
      } else {
        const nextUser = await syncUserCompanyRole(userRef.current);
        applyRuntimeUser(nextUser);
        setAuthStatus(nextUser ? "authenticated" : "anonymous");
      }
    } finally {
      setLoading(false);
    }
  }, [applyAccountPayload, applyRuntimeUser, applySessionPayload, isDemoRuntime]);

  useEffect(() => {
    if (typeof window === "undefined" || isDemoRuntime || AUTH_DISABLED) {
      return;
    }

    const recoverSession = () => {
      if (!userRef.current && !loadStoredAuthUser()) {
        return;
      }
      void refreshUser({ preserveUserOnFailure: true });
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        recoverSession();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        recoverSession();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isDemoRuntime, refreshUser]);

  const signUp = async (
  email: string,
  password: string,
  fullName: string,
  userType?: "b2b" | "b2c",
  options?: SignUpOptions)
  : Promise<{
    error: Error | null;
    needsConfirmation?: boolean;
  }> => {
    if (AUTH_DISABLED) {
      return { error: new Error("Authentication is disabled.") };
    }

    const role = userType ?? "b2b";
    const payloadBody: Record<string, unknown> = {
      email,
      password,
      full_name: fullName,
      role,
      frontend_origin: getCurrentFrontendOrigin()
    };

    if (role === "b2b") {
      const companyName = options?.companyName?.trim();
      const businessType = options?.businessType;
      if (companyName && businessType) {
        payloadBody.company_name = companyName;
        payloadBody.business_type = businessType;
        payloadBody.target_markets = options?.targetMarkets || [];
      }
    }

    if (options?.phone?.trim()) {
      payloadBody.phone = options.phone.trim();
    }

    try {
      const payload = await postWithFallback<SignUpPayload>(
        ["/auth/signup", "/auth/sign-up"],
        payloadBody
      );
      const needsConfirmation =
      payload?.requires_email_verification ?? payload?.needsConfirmation ?? false;
      const hasAccessToken = Boolean(payload?.tokens?.access_token);

      if (hasAccessToken && payload?.tokens) {
        authTokenStore.setTokens(payload.tokens, {
          persist: false,
          storageScope: "storage",
          storeRefreshToken: true
        });
        clearSubscriptionLockStateCache();
      }

      const nextUser = buildUserFromSignUp(payload, role);
      if (nextUser && hasAccessToken && !needsConfirmation) {
        const syncedUser = await syncUserCompanyRole(nextUser);
        applyRuntimeUser(syncedUser);
        setAuthStatus(syncedUser ? "authenticated" : "anonymous");
        if (typeof window !== "undefined" && syncedUser?.user_type === "b2b") {
          sessionStorage.setItem(PRICING_PROMPT_ON_LOGIN_KEY, "1");
        }
      }

      return {
        error: null,
        needsConfirmation
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error("Sign up failed.")
      };
    }
  };

  const signIn = async (
  email: string,
  password: string,
  userType?: "b2b" | "b2c",
  options?: SignInOptions)
  : Promise<{error: Error | null;needsConfirmation?: boolean;}> => {
    if (AUTH_DISABLED) {
      return { error: new Error("Authentication is disabled.") };
    }

    void options;
    const rememberMe = false;

    try {
      const payload = await postWithFallback<SignInPayload>(
        ["/auth/signin", "/auth/sign-in", "/auth/login"],
        {
          email,
          password,
          remember_me: rememberMe
        }
      );

      authTokenStore.setTokens(payload.tokens, {
        persist: false,
        storageScope: "storage",
        storeRefreshToken: true
      });
      clearSubscriptionLockStateCache();

      const signedInUser = buildUserFromSignIn(payload);
      const resolvedUserType =
        signedInUser.user_type || (await resolveAuthenticatedUserType(userType));
      const nextUser = {
        ...signedInUser,
        user_type: resolvedUserType || userType
      };

      if (userType && resolvedUserType && resolvedUserType !== userType) {
      authTokenStore.clear();
      clearSubscriptionLockStateCache();
      invalidateSubscriptionApiCache();
      invalidateApiResponseCache("signin-type-mismatch");
      applyRuntimeUser(null);
        setAuthStatus("anonymous");
        return {
          error: new Error(`ACCOUNT_TYPE_MISMATCH:${resolvedUserType}:${userType}`)
        };
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem(PRICING_PROMPT_ON_LOGIN_KEY, "1");
      }
      const syncedUser = await syncUserCompanyRole(nextUser);
      applyRuntimeUser(syncedUser);
      setAuthStatus(syncedUser ? "authenticated" : "anonymous");
      return { error: null };
    } catch (error) {
      if (isEmailNotVerifiedError(error)) {
        authTokenStore.clear();
        clearSubscriptionLockStateCache();
        invalidateSubscriptionApiCache();
        invalidateApiResponseCache("signin-email-not-verified");
        applyRuntimeUser(null);
        setAuthStatus("anonymous");
        return { error: null, needsConfirmation: true };
      }
      return {
        error: error instanceof Error ? error : new Error("Sign in failed.")
      };
    }
  };

  const signInWithGoogle = async (
  userType?: "b2b" | "b2c",
  intent: GoogleAuthIntent = "signin",
  options?: SignInOptions)
  : Promise<{error: Error | null;}> => {
    if (AUTH_DISABLED) {
      return { error: new Error("Authentication is disabled.") };
    }

    try {
      if (typeof window === "undefined") {
        return { error: new Error("Google sign-in is only available in browser.") };
      }

      if (hasActiveGoogleOAuthInflight()) {
        return { error: new Error("Google authentication is already in progress.") };
      }

      const role = userType ?? "b2b";
      void options;
      markGoogleOAuthInflight(role);
      const frontendOrigin = window.location.origin;
      if (intent === "signup") {
        window.location.assign(
          `${API_BASE_URL}/auth/google?intent=signup&role=${encodeURIComponent(
            role
          )}&frontend_origin=${encodeURIComponent(frontendOrigin)}`
        );
      } else {
        window.location.assign(
          `${API_BASE_URL}/auth/google?intent=signin&role=${encodeURIComponent(
            role
          )}&frontend_origin=${encodeURIComponent(frontendOrigin)}`
        );
      }

      return { error: null };
    } catch (error) {
      clearGoogleOAuthInflightState();
      return {
        error:
        error instanceof Error ? error : new Error("Google sign-in failed.")
      };
    }
  };

  const signInDemo = async (
  userType: "b2b" | "b2c" = "b2b")
  : Promise<{error: Error | null;}> => {
    if (AUTH_DISABLED) {
      return { error: new Error("Authentication is disabled.") };
    }

    try {
      const payload = await postWithFallback<DemoPayload>(
        ["/auth/demo"],
        {
          role: userType,
          demo_scenario: "sample_data"
        }
      );

      if (!payload?.tokens?.access_token || !payload?.tokens?.refresh_token) {
        return { error: new Error("Demo sign-in did not return valid tokens.") };
      }

      authTokenStore.setTokens(payload.tokens, {
        persist: true,
        storageScope: "storage"
      });
      clearSubscriptionLockStateCache();
      const nextUser = buildUserFromDemo(payload, userType);
      const syncedUser = await syncUserCompanyRole(nextUser);
      applyRuntimeUser(syncedUser);
      setAuthStatus(syncedUser ? "authenticated" : "anonymous");

      return { error: null };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error("Demo sign-in failed.")
      };
    }
  };

  const startLocalDemo = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _scenario: "b2b_standard_20" = "b2b_standard_20")
  : Promise<{error: Error | null;}> => {
    try {
      ensureDemoDataset();
      ensureDemoSession();
      writeDemoLockState();
      setDemoUser(loadDemoUser());
      setAuthStatus("authenticated");
      setLoading(false);
      return { error: null };
    } catch (error) {
      return {
        error:
        error instanceof Error ? error : new Error("Demo session could not be started.")
      };
    }
  };

  const startLocalB2CDemo = async (): Promise<{error: Error | null;}> => {
    try {
      const mockUser: User = {
        id: "demo-b2c-001",
        email: "demo-b2c@weavecarbon.io",
        full_name: "Demo B2C User",
        user_type: "b2c",
        is_demo: true,
        company_id: null,
      };
      window.localStorage.setItem(B2C_DEMO_SESSION_KEY, JSON.stringify(mockUser));
      writeDemoLockState();
      applyRuntimeUser(mockUser);
      setAuthStatus("authenticated");
      setLoading(false);
      return { error: null };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error("B2C demo session could not be started.")
      };
    }
  };

  const exitDemoSession = async () => {
    window.localStorage.removeItem(B2C_DEMO_SESSION_KEY);
    clearDemoSession();
    clearSubscriptionLockStateCache();
    setDemoUser(null);
    setAuthStatus("anonymous");
    setLoading(false);
  };

  const signOut = async () => {
    window.localStorage.removeItem(B2C_DEMO_SESSION_KEY);

    if (isDemoRuntime) {
      await exitDemoSession();
      return;
    }

    if (!AUTH_DISABLED) {
      try {
        await postWithFallback(
          ["/auth/signout", "/auth/sign-out"],
          { all_devices: false }
        );
      } catch {

      }
    }
    authTokenStore.clear({ notify: true });
    clearSubscriptionLockStateCache();
    invalidateSubscriptionApiCache();
    invalidateApiResponseCache("signout");
    applyRuntimeUser(null);
    setAuthStatus("expired");
  };

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        loading,
        authStatus,
        sessionEpoch,
        isDemoSession: isDemoRuntime,
        hasRealSession,
        signUp,
        signIn,
        signInWithGoogle,
        signInDemo,
        startLocalDemo,
        startLocalB2CDemo,
        exitDemoSession,
        signOut,
        refreshUser,
        updateUser
      }}>

      {children}
    </AuthContext.Provider>);

};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
