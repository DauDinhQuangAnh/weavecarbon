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
  api,
  API_BASE_URL,
  authTokenStore,
  AuthTokens,
  ensureAccessToken,
  invalidateApiResponseCache,
  isDefinitiveAuthExpiredCode,
  isApiError,
  isUnauthorizedApiError,
  readAuthUserSnapshot,
  setApiSessionEpoch,
  setAuthUserSnapshot,
  syncAuthUserSnapshotFromPayload } from
"@/lib/apiClient";
import { resolveCompanyRole, type CompanyRole } from "@/lib/permissions";
import {
  clearSubscriptionLockStateCache,
  writeSubscriptionLockState } from
"@/lib/subscriptionLockState";
import { invalidateSubscriptionApiCache } from "@/lib/subscriptionApi";
import { isDemoPath } from "@/lib/demo/routes";
import { ensureDemoDataset } from "@/lib/demo/storage";
import {
  clearDemoSession,
  ensureDemoSession,
  readDemoSession } from
"@/lib/demo/session";
import { DEMO_SESSION_STORAGE_KEY, B2C_DEMO_SESSION_KEY } from "@/lib/demo/constants";
import {
  clearGoogleOAuthInflightState,
  hasActiveGoogleOAuthInflight,
  markGoogleOAuthInflight
} from "@/lib/auth/googleOAuth";
import {
  normalizeAuthUserType,
  resolveAuthenticatedUserType as resolveSharedAuthenticatedUserType,
  type AuthUserType
} from "@/lib/auth/routing";

interface User {
  id: string;
  analytics_company_key?: string | null;
  analytics_user_key?: string | null;
  business_type?: "shop_online" | "brand" | "factory" | null;
  current_plan?: string | null;
  domestic_market?: string | null;
  email: string;
  full_name?: string;
  company_id?: string | null;
  user_type?: "b2b" | "b2c" | "admin";
  company_role?: CompanyRole;
  is_root?: boolean;
  avatar_url?: string | null;
  is_demo?: boolean;
}

type GoogleAuthIntent = "signin" | "signup";

interface SignInOptions {
  rememberMe?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authStatus: AuthSessionStatus;
  sessionEpoch: string;
  isDemoSession: boolean;
  hasRealSession: boolean;
  signUp: (
  email: string,
  password: string,
  fullName: string,
  userType?: "b2b" | "b2c",
  options?: SignUpOptions)
  => Promise<{error: Error | null;needsConfirmation?: boolean;}>;
  signIn: (
  email: string,
  password: string,
  userType?: "b2b" | "b2c",
  options?: SignInOptions)
  => Promise<{error: Error | null;needsConfirmation?: boolean;}>;
  signInWithGoogle: (
  userType?: "b2b" | "b2c",
  intent?: GoogleAuthIntent,
  options?: SignInOptions)
  => Promise<{error: Error | null;}>;
  signInDemo: (
  userType?: "b2b" | "b2c")
  => Promise<{error: Error | null;}>;
  startLocalDemo: (
  _scenario?: "b2b_standard_20")
  => Promise<{error: Error | null;}>;
  startLocalB2CDemo: () => Promise<{error: Error | null;}>;
  exitDemoSession: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: (options?: RefreshUserOptions) => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

type AuthSessionStatus =
  | "checking"
  | "authenticated"
  | "recovering"
  | "anonymous"
  | "expired";

interface RefreshUserOptions {
  preserveUserOnFailure?: boolean;
}

interface BackendUser {
  id: string;
  analytics_user_key?: string | null;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

interface BackendProfile {
  id?: string;
  user_id?: string;
  full_name?: string | null;
  email?: string;
  company_id?: string | null;
}

interface BackendCompany {
  analytics_company_key?: string | null;
  business_type?: "shop_online" | "brand" | "factory" | null;
  current_plan?: string | null;
  domestic_market?: string | null;
  id: string;
  target_markets?: string[] | null;
}

interface BackendCompanyMembership {
  company_id?: string | null;
  role?: string | null;
  status?: string | null;
  is_root?: boolean | null;
  isRoot?: boolean | null;
}

interface BackendCompanyMember {
  id?: string;
  user_id?: string;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  company_id?: string | null;
  is_root?: boolean | null;
  isRoot?: boolean | null;
}

interface SignUpOptions {
  companyName?: string;
  businessType?: "shop_online" | "brand" | "factory";
  targetMarkets?: string[];
  phone?: string;
}

interface SignUpPayload {
  analytics_user_key?: string | null;
  user?: BackendUser;
  profile?: BackendProfile | null;
  role?: "b2b" | "b2c" | "admin";
  company?: BackendCompany | null;
  company_membership?: BackendCompanyMembership | null;
  requires_email_verification?: boolean;
  needsConfirmation?: boolean;
  tokens?: AuthTokens;
}

interface SignInPayload {
  analytics_user_key?: string | null;
  user: BackendUser;
  profile?: BackendProfile | null;
  roles?: Array<"b2b" | "b2c" | "admin">;
  company?: BackendCompany | null;
  company_membership?: BackendCompanyMembership | null;
  tokens?: AuthTokens;
}

interface DemoPayload {
  analytics_user_key?: string | null;
  user: BackendUser & {
    is_demo?: boolean;
    demo_expires_at?: string | null;
  };
  profile?: BackendProfile | null;
  roles?: Array<"b2b" | "b2c" | "admin">;
  company?: BackendCompany | null;
  company_membership?: BackendCompanyMembership | null;
  tokens?: AuthTokens;
}

const getCurrentFrontendOrigin = () =>
  typeof window !== "undefined" ? window.location.origin : undefined;

interface AccountPayload {
  analytics_user_key?: string | null;
  profile?: BackendProfile | null;
  company?: BackendCompany | null;
  roles?: Array<"b2b" | "b2c" | "admin">;
  company_membership?: BackendCompanyMembership | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PRICING_PROMPT_ON_LOGIN_KEY = "weavecarbon_show_pricing_on_login";

const AUTH_DISABLED = process.env.NEXT_PUBLIC_AUTH_DISABLED === "1";
const ACCOUNT_ENDPOINT_ENABLED =
process.env.NEXT_PUBLIC_ACCOUNT_ENDPOINT !== "0";
const isAuthCallbackPath = (path?: string | null) =>
  (path || "").toLowerCase().startsWith("/auth/callback");

const getDefaultCompanyRole = (
userType?: User["user_type"])
: CompanyRole =>
userType === "admin" ? "root" : "member";

const normalizeCompanyMembership = (
membership?: BackendCompanyMembership | null,
fallbackRole: CompanyRole = "member") => {
  const isRoot = Boolean(membership?.is_root ?? membership?.isRoot);
  const companyRole = resolveCompanyRole(
    {
      role: membership?.role,
      isRoot
    },
    fallbackRole
  );

  return {
    company_role: companyRole,
    is_root: isRoot || companyRole === "root"
  };
};

const normalizeStoredUser = (user: User | null): User | null => {
  if (!user) return null;
  const fallbackRole = getDefaultCompanyRole(user.user_type);

  const normalizedRole = resolveCompanyRole(
    {
      role: user.company_role,
      isRoot: user.is_root
    },
    fallbackRole
  );

  return {
    ...user,
    analytics_company_key: user.analytics_company_key || null,
    analytics_user_key: user.analytics_user_key || null,
    business_type: user.business_type || null,
    current_plan: user.current_plan || null,
    company_role: normalizedRole,
    domestic_market: user.domestic_market || null,
    is_root: Boolean(user.is_root || normalizedRole === "root")
  };
};

const loadDemoUser = (): User | null => {
  const session = readDemoSession();
  if (!session) return null;
  return normalizeStoredUser(session.user as User);
};

const loadB2CDemoUser = (): User | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(B2C_DEMO_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.user_type === "b2c" && parsed.is_demo === true) {
      return normalizeStoredUser(parsed as unknown as User);
    }
    return null;
  } catch {
    return null;
  }
};

const writeDemoLockState = () => {
  writeSubscriptionLockState({
    current_plan: "standard",
    trial_ends_at: null,
    trial_expired: false,
    features_locked: false
  });
};

const buildUserFromSignIn = (payload: SignInPayload): User => {
  const role = normalizeAuthUserType(payload.roles?.[0]);
  const membership = normalizeCompanyMembership(
    payload.company_membership,
    getDefaultCompanyRole(role)
  );
  return {
    id: payload.user.id,
    analytics_company_key: payload.company?.analytics_company_key || null,
    analytics_user_key: payload.user.analytics_user_key || payload.analytics_user_key || null,
    business_type: payload.company?.business_type || null,
    current_plan: payload.company?.current_plan || null,
    domestic_market: payload.company?.domestic_market || null,
    email: payload.user.email,
    full_name: payload.user.full_name || payload.profile?.full_name || undefined,
    company_id: payload.company?.id || payload.profile?.company_id || null,
    user_type: role,
    company_role: membership.company_role,
    is_root: membership.is_root,
    avatar_url: payload.user.avatar_url || null
  };
};

const buildUserFromDemo = (
  payload: DemoPayload,
  fallbackRole: "b2b" | "b2c")
: User => {
  const normalizedUserType = normalizeAuthUserType(payload.roles?.[0]) || fallbackRole;
  const membership = normalizeCompanyMembership(
    payload.company_membership,
    getDefaultCompanyRole(normalizedUserType)
  );

  return {
    id: payload.user.id,
    analytics_company_key: payload.company?.analytics_company_key || null,
    analytics_user_key: payload.user.analytics_user_key || payload.analytics_user_key || null,
    business_type: payload.company?.business_type || null,
    current_plan: payload.company?.current_plan || null,
    domestic_market: payload.company?.domestic_market || null,
    email: payload.user.email,
    full_name: payload.user.full_name || payload.profile?.full_name || undefined,
    company_id: payload.company?.id || payload.profile?.company_id || null,
    user_type: normalizedUserType,
    company_role: membership.company_role,
    is_root: membership.is_root,
    avatar_url: payload.user.avatar_url || null,
    is_demo: true
  };
};

const buildUserFromSignUp = (
  payload: SignUpPayload,
  fallbackRole: "b2b" | "b2c")
: User | null => {
  if (!payload.user) return null;
  const normalizedUserType = normalizeAuthUserType(payload.role) || fallbackRole;
  const membership = normalizeCompanyMembership(
    payload.company_membership,
    getDefaultCompanyRole(normalizedUserType)
  );
  return {
    id: payload.user.id,
    analytics_company_key: payload.company?.analytics_company_key || null,
    analytics_user_key: payload.user.analytics_user_key || payload.analytics_user_key || null,
    business_type: payload.company?.business_type || null,
    current_plan: payload.company?.current_plan || null,
    domestic_market: payload.company?.domestic_market || null,
    email: payload.user.email,
    full_name: payload.user.full_name || payload.profile?.full_name || undefined,
    company_id: payload.company?.id || payload.profile?.company_id || null,
    user_type: normalizedUserType,
    company_role: membership.company_role,
    is_root: membership.is_root,
    avatar_url: payload.user.avatar_url || null
  };
};

const buildUserFromAccount = (
  payload: AccountPayload,
  fallbackUser: User | null)
: User | null => {
  const normalizedFallback = normalizeStoredUser(fallbackUser);
  const accountUserType =
  normalizeAuthUserType(payload.roles?.[0]) || normalizedFallback?.user_type;
  const profile = payload.profile;
  const membership = normalizeCompanyMembership(
    payload.company_membership,
    getDefaultCompanyRole(accountUserType)
  );
  if (!profile && !normalizedFallback) return null;

  const nextId = profile?.user_id || normalizedFallback?.id;
  const nextEmail = profile?.email || normalizedFallback?.email;

  if (!nextId || !nextEmail) {
    return normalizedFallback;
  }

  return {
    id: nextId,
    analytics_company_key:
      payload.company?.analytics_company_key || normalizedFallback?.analytics_company_key || null,
    analytics_user_key: payload.analytics_user_key || normalizedFallback?.analytics_user_key || null,
    business_type: payload.company?.business_type || normalizedFallback?.business_type || null,
    current_plan: payload.company?.current_plan || normalizedFallback?.current_plan || null,
    domestic_market:
      payload.company?.domestic_market || normalizedFallback?.domestic_market || null,
    email: nextEmail,
    full_name: profile?.full_name || normalizedFallback?.full_name,
    company_id:
    payload.company?.id || profile?.company_id || normalizedFallback?.company_id || null,
    user_type: accountUserType,
    company_role: membership.company_role,
    is_root: membership.is_root,
    avatar_url: normalizedFallback?.avatar_url || null
  };
};

const postWithFallback = async <T,>(
paths: string[],
body?: unknown)
: Promise<T> => {
  let lastError: Error | null = null;

  for (const path of paths) {
    try {
      return await api.post<T>(path, body);
    } catch (error) {
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        const isNotFound =
        message.includes("not found") || message.includes("route");
        if (!isNotFound) {
          throw error;
        }
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error("No matching endpoint found.");
};

const isNotFoundError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("not found") || message.includes("route");
};

const isUnauthorizedError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("unauthorized") || message.includes("invalid token");
};

const isConfirmedSessionExpiredError = (error: unknown) =>
  isApiError(error) &&
  error.status === 401 &&
  isDefinitiveAuthExpiredCode(error.code);

const isNoActiveSessionError = (error: unknown) =>
  isApiError(error) &&
  error.status === 401 &&
  error.code === "NO_ACTIVE_SESSION";

const isAuthFailureError = (error: unknown) =>
  !isNoActiveSessionError(error) &&
  (
    isConfirmedSessionExpiredError(error) ||
    isUnauthorizedApiError(error) ||
    isUnauthorizedError(error)
  );

const loadStoredAuthUser = (): User | null => {
  const snapshot = readAuthUserSnapshot();
  if (!snapshot) {
    return null;
  }

  return normalizeStoredUser(snapshot as unknown as User);
};

const getAccountSafely = async (): Promise<AccountPayload | null> => {
  if (!ACCOUNT_ENDPOINT_ENABLED) {
    return null;
  }

  const accessToken = await ensureAccessToken();
  if (!accessToken) {
    return null;
  }

  try {
    return await api.get<AccountPayload>("/account");
  } catch (error) {
    if (isNotFoundError(error) || isUnauthorizedError(error)) {
      return null;
    }
    throw error;
  }
};

const getSessionSafely = async (): Promise<SignInPayload | null> => {
  try {
    return await api.get<SignInPayload>("/auth/session", {
      disableResponseCache: true
    });
  } catch (error) {
    if (isAuthFailureError(error)) {
      throw error;
    }

    if (isNotFoundError(error)) {
      return null;
    }

    return null;
  }
};

const resolveAuthenticatedUserType = async (
  fallbackRole?: User["user_type"])
: Promise<User["user_type"] | undefined> => {
  const account = await getAccountSafely();
  return resolveSharedAuthenticatedUserType({
    accountPayload: account
      ? { roles: account.roles as AuthUserType[] | undefined }
      : null,
    fallbackRole,
    shouldIgnoreCompanyCheckError: (error) =>
      isNotFoundError(error) || isUnauthorizedError(error)
  });
};

const isEmailNotVerifiedError = (error: unknown) => {
  if (!isApiError(error)) return false;
  if (error.status !== 403) return false;
  if (error.code === "EMAIL_NOT_VERIFIED") return true;
  return error.message.toLowerCase().includes("not verified");
};

const toCompanyMemberList = (payload: unknown): BackendCompanyMember[] => {
  if (Array.isArray(payload)) {
    return payload as BackendCompanyMember[];
  }

  if (payload && typeof payload === "object") {
    const candidate = payload as {
      data?: unknown;
      members?: unknown;
      items?: unknown;
    };

    if (Array.isArray(candidate.data)) {
      return candidate.data as BackendCompanyMember[];
    }

    if (Array.isArray(candidate.members)) {
      return candidate.members as BackendCompanyMember[];
    }

    if (Array.isArray(candidate.items)) {
      return candidate.items as BackendCompanyMember[];
    }
  }

  return [];
};

const syncUserCompanyRole = async (baseUser: User | null): Promise<User | null> => {
  const normalizedBaseUser = normalizeStoredUser(baseUser);
  if (!normalizedBaseUser) return null;

  if (AUTH_DISABLED) {
    return normalizedBaseUser;
  }

  const hasAuthToken = Boolean(authTokenStore.getAccessToken());
  if (!hasAuthToken) {
    return normalizedBaseUser;
  }

  const userType = normalizedBaseUser.user_type;
  if (userType && userType !== "b2b" && userType !== "admin") {
    return normalizedBaseUser;
  }

  try {
    const payload = await api.get<unknown>("/company/members");
    const memberList = toCompanyMemberList(payload);
    if (memberList.length === 0) {
      return normalizedBaseUser;
    }

    const matchedMember = memberList.find((member) => {
      const memberUserId =
      typeof member.user_id === "string" ? member.user_id : null;
      const memberId = typeof member.id === "string" ? member.id : null;
      return (
        memberUserId === normalizedBaseUser.id ||
        memberId === normalizedBaseUser.id
      );
    });

    if (!matchedMember) {
      return normalizedBaseUser;
    }

    const membership = normalizeCompanyMembership(
      {
        role: matchedMember.role,
        is_root: matchedMember.is_root,
        isRoot: matchedMember.isRoot,
        company_id: matchedMember.company_id,
        status: matchedMember.status
      },
      getDefaultCompanyRole(normalizedBaseUser.user_type)
    );

    return normalizeStoredUser({
      ...normalizedBaseUser,
      company_id: matchedMember.company_id ?? normalizedBaseUser.company_id ?? null,
      company_role: membership.company_role,
      is_root: membership.is_root
    });
  } catch (error) {
    if (isNotFoundError(error) || isUnauthorizedError(error)) {
      return normalizedBaseUser;
    }

    return normalizedBaseUser;
  }
};

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
