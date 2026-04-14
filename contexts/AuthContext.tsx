"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback } from
"react";
import { usePathname } from "next/navigation";
import {
  api,
  API_BASE_URL,
  authTokenStore,
  AuthTokens,
  ensureAccessToken,
  isApiError } from
"@/lib/apiClient";
import { resolveCompanyRole, type CompanyRole } from "@/lib/permissions";
import {
  clearSubscriptionLockStateCache,
  writeSubscriptionLockState } from
"@/lib/subscriptionLockState";
import { isDemoPath } from "@/lib/demo/routes";
import { ensureDemoDataset } from "@/lib/demo/storage";
import {
  clearDemoSession,
  ensureDemoSession,
  readDemoSession } from
"@/lib/demo/session";
import { DEMO_SESSION_STORAGE_KEY } from "@/lib/demo/constants";
import {
  clearGoogleOAuthInflightState,
  hasActiveGoogleOAuthInflight,
  markGoogleOAuthInflight
} from "@/lib/auth/googleOAuth";

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
  userType?: "b2b")
  => Promise<{error: Error | null;}>;
  startLocalDemo: (
  scenario?: "b2b_standard_20")
  => Promise<{error: Error | null;}>;
  exitDemoSession: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
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

interface CompanyCheckPayload {
  is_b2b?: boolean;
  user_type?: "b2b" | "b2c" | "admin";
  data?: {
    is_b2b?: boolean;
    user_type?: "b2b" | "b2c" | "admin";
  };
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

const STORAGE_KEY = "weavecarbon_user";
const PRICING_PROMPT_ON_LOGIN_KEY = "weavecarbon_show_pricing_on_login";
const TOKEN_STORAGE_KEYS = [
"weavecarbon_access_token",
"weavecarbon_refresh_token",
"token",
"access_token",
"refresh_token"];

const AUTH_DISABLED = process.env.NEXT_PUBLIC_AUTH_DISABLED === "1";
const ACCOUNT_ENDPOINT_ENABLED =
process.env.NEXT_PUBLIC_ACCOUNT_ENDPOINT !== "0";

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

const loadStoredUser = (): User | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeStoredUser(JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
};

const persistUser = (user: User | null) => {
  if (typeof window === "undefined") return;

  if (!user) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeStoredUser(user)));
};

const loadDemoUser = (): User | null => {
  const session = readDemoSession();
  if (!session) return null;
  return normalizeStoredUser(session.user as User);
};

const writeDemoLockState = () => {
  writeSubscriptionLockState({
    current_plan: "standard",
    trial_ends_at: null,
    trial_expired: false,
    features_locked: false
  });
};

const normalizeRole = (
role?: string | null)
: User["user_type"] | undefined => {
  if (role === "b2b" || role === "b2c" || role === "admin") {
    return role;
  }
  return undefined;
};

const normalizeCompanyCheck = (payload: CompanyCheckPayload | null) => {
  const nested = payload?.data;
  const source = nested || payload || {};
  const userType = normalizeRole(source.user_type);
  const isB2b =
    typeof source.is_b2b === "boolean" ? source.is_b2b : userType === "b2b";

  return { isB2b, userType };
};

const buildUserFromSignIn = (payload: SignInPayload): User => {
  const role = normalizeRole(payload.roles?.[0]);
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
fallbackRole: "b2b")
: User => {
  const normalizedUserType = normalizeRole(payload.roles?.[0]) || fallbackRole;
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

const buildUserFromSignUp = (
payload: SignUpPayload,
fallbackRole: "b2b" | "b2c")
: User | null => {
  if (!payload.user) return null;
  const normalizedUserType = normalizeRole(payload.role) || fallbackRole;
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
  normalizeRole(payload.roles?.[0]) || normalizedFallback?.user_type;
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

const resolveAuthenticatedUserType = async (
fallbackRole?: User["user_type"])
: Promise<User["user_type"] | undefined> => {
  const account = await getAccountSafely();
  const accountRole = normalizeRole(account?.roles?.[0]);
  if (accountRole) {
    return accountRole;
  }

  try {
    const payload = await api.get<CompanyCheckPayload>("/auth/check-company");
    const { isB2b, userType } = normalizeCompanyCheck(payload);
    if (userType) {
      return userType;
    }
    if (typeof isB2b === "boolean") {
      return isB2b ? "b2b" : "b2c";
    }
    return fallbackRole;
  } catch (error) {
    if (isNotFoundError(error) || isUnauthorizedError(error)) {
      return fallbackRole;
    }
    throw error;
  }
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

  const hasAuthToken = Boolean(
    authTokenStore.getAccessToken() || authTokenStore.getRefreshToken()
  );
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
  const hasRealSession = Boolean(
    user?.id || authTokenStore.getAccessToken() || authTokenStore.getRefreshToken()
  );
  const effectiveUser = isDemoRuntime ? demoUser || user : user;

  useEffect(() => {
    let cancelled = false;

    const bootstrapSession = async () => {
      const stored = loadStoredUser();

      if (isDemoRuntime) {
        try {
          ensureDemoDataset();
          ensureDemoSession();
          writeDemoLockState();
          if (!cancelled) {
            setUser(stored);
            setDemoUser(loadDemoUser());
            setLoading(false);
          }
        } catch {
          if (!cancelled) {
            setUser(stored);
            setDemoUser(null);
            setLoading(false);
          }
        }
        return;
      }

      if (!cancelled) {
        setDemoUser(null);
      }

      if (AUTH_DISABLED) {
        if (!cancelled) {
          setUser(stored);
          setLoading(false);
        }
        return;
      }

      const hasAuthToken = Boolean(
        authTokenStore.getAccessToken() || authTokenStore.getRefreshToken()
      );

      if (!hasAuthToken && stored) {
        persistUser(null);
      }
      if (!hasAuthToken) {
        clearSubscriptionLockStateCache();
      }

      if (!cancelled) {
        setUser(hasAuthToken ? stored : null);
      }

      try {
        const account = await getAccountSafely();
        if (account) {
          const nextUser = await syncUserCompanyRole(
            buildUserFromAccount(account, stored)
          );
          persistUser(nextUser);
          if (!cancelled) {
            setUser(nextUser);
          }
        } else if (hasAuthToken && stored) {
          const nextUser = await syncUserCompanyRole(stored);
          persistUser(nextUser);
          if (!cancelled) {
            setUser(nextUser);
          }
        }
      } catch {

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
  }, [isDemoRuntime]);

  useEffect(() => {
    if (typeof window === "undefined" || AUTH_DISABLED) {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      const watchedKeyChanged =
      event.key === null ||
      event.key === STORAGE_KEY ||
      event.key === DEMO_SESSION_STORAGE_KEY ||
      TOKEN_STORAGE_KEYS.includes(event.key);
      if (!watchedKeyChanged) {
        return;
      }

      if (isDemoRuntime) {
        setDemoUser(loadDemoUser());
      }

      const hasAuthToken = Boolean(
        authTokenStore.getAccessToken() || authTokenStore.getRefreshToken()
      );
      if (!hasAuthToken) {
        persistUser(null);
        setUser(null);
        return;
      }

      setUser(loadStoredUser());
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [isDemoRuntime]);

  const updateUser = useCallback((updates: Partial<User>) => {
    if (isDemoRuntime) {
      setDemoUser((prev) => (prev ? { ...prev, ...updates } : prev));
      return;
    }

    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      persistUser(next);
      return next;
    });
  }, [isDemoRuntime]);

  const refreshUser = useCallback(async () => {
    if (isDemoRuntime) {
      ensureDemoDataset();
      ensureDemoSession();
      writeDemoLockState();
      setDemoUser(loadDemoUser());
      setLoading(false);
      return;
    }

    if (AUTH_DISABLED) {
      const stored = loadStoredUser();
      setUser(stored);
      setLoading(false);
      return;
    }

    try {
      const account = await getAccountSafely();
      if (account) {
        const nextUser = await syncUserCompanyRole(
          buildUserFromAccount(account, user)
        );
        persistUser(nextUser);
        setUser(nextUser);
      } else {
        const hasAuthToken = Boolean(
          authTokenStore.getAccessToken() || authTokenStore.getRefreshToken()
        );
        if (!hasAuthToken) {
          persistUser(null);
        }
        const stored = hasAuthToken ? loadStoredUser() : null;
        const nextUser = await syncUserCompanyRole(stored);
        persistUser(nextUser);
        setUser(nextUser);
      }
    } catch {
      const hasAuthToken = Boolean(
        authTokenStore.getAccessToken() || authTokenStore.getRefreshToken()
      );
      if (!hasAuthToken) {
        persistUser(null);
      }
      const stored = hasAuthToken ? loadStoredUser() : null;
      const nextUser = await syncUserCompanyRole(stored);
      persistUser(nextUser);
      setUser(nextUser);
    } finally {
      setLoading(false);
    }
  }, [isDemoRuntime, user]);

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
        authTokenStore.setTokens(payload.tokens);
        clearSubscriptionLockStateCache();
      }

      const nextUser = buildUserFromSignUp(payload, role);
      if (nextUser && hasAccessToken && !needsConfirmation) {
        const syncedUser = await syncUserCompanyRole(nextUser);
        persistUser(syncedUser);
        setUser(syncedUser);
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

    const rememberMe = options?.rememberMe ?? true;

    try {
      const payload = await postWithFallback<SignInPayload>(
        ["/auth/signin", "/auth/sign-in", "/auth/login"],
        {
          email,
          password,
          remember_me: rememberMe
        }
      );

      authTokenStore.setTokens(payload.tokens, { persist: rememberMe });
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
        persistUser(null);
        setUser(null);
        return {
          error: new Error(`ACCOUNT_TYPE_MISMATCH:${resolvedUserType}:${userType}`)
        };
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem(PRICING_PROMPT_ON_LOGIN_KEY, "1");
      }
      const syncedUser = await syncUserCompanyRole(nextUser);
      persistUser(syncedUser);
      setUser(syncedUser);
      return { error: null };
    } catch (error) {
      if (isEmailNotVerifiedError(error)) {
        authTokenStore.clear();
        clearSubscriptionLockStateCache();
        persistUser(null);
        setUser(null);
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
      markGoogleOAuthInflight(
        options?.rememberMe !== false,
        role
      );
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
  userType: "b2b" = "b2b")
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

      authTokenStore.setTokens(payload.tokens, { persist: true });
      clearSubscriptionLockStateCache();
      const nextUser = buildUserFromDemo(payload, userType);
      const syncedUser = await syncUserCompanyRole(nextUser);
      persistUser(syncedUser);
      setUser(syncedUser);

      return { error: null };
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error("Demo sign-in failed.")
      };
    }
  };

  const startLocalDemo = async (
  scenario: "b2b_standard_20" = "b2b_standard_20")
  : Promise<{error: Error | null;}> => {
    try {
      void scenario;
      ensureDemoDataset();
      ensureDemoSession();
      writeDemoLockState();
      setDemoUser(loadDemoUser());
      setLoading(false);
      return { error: null };
    } catch (error) {
      return {
        error:
        error instanceof Error ? error : new Error("Demo session could not be started.")
      };
    }
  };

  const exitDemoSession = async () => {
    clearDemoSession();
    clearSubscriptionLockStateCache();
    setDemoUser(null);
    setLoading(false);
  };

  const signOut = async () => {
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
    authTokenStore.clear();
    clearSubscriptionLockStateCache();
    persistUser(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        loading,
        isDemoSession: isDemoRuntime,
        hasRealSession,
        signUp,
        signIn,
        signInWithGoogle,
        signInDemo,
        startLocalDemo,
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
