import { resolveCompanyRole, type CompanyRole } from "@/lib/permissions";
import { writeSubscriptionLockState } from "@/lib/subscriptionLockState";
import { readDemoSession } from "@/lib/demo/session";
import { B2C_DEMO_SESSION_KEY } from "@/lib/demo/constants";
import { normalizeAuthUserType } from "@/lib/auth/routing";
import type {
  AccountPayload,
  BackendCompanyMembership,
  DemoPayload,
  SignInPayload,
  SignUpPayload,
  User
} from "./types";

export const getCurrentFrontendOrigin = () =>
  typeof window !== "undefined" ? window.location.origin : undefined;

export const getDefaultCompanyRole = (
userType?: User["user_type"])
: CompanyRole =>
userType === "admin" ? "root" : "member";

export const normalizeCompanyMembership = (
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

export const normalizeStoredUser = (user: User | null): User | null => {
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

export const loadDemoUser = (): User | null => {
  const session = readDemoSession();
  if (!session) return null;
  return normalizeStoredUser(session.user as User);
};

export const loadB2CDemoUser = (): User | null => {
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

export const writeDemoLockState = () => {
  writeSubscriptionLockState({
    current_plan: "standard",
    trial_ends_at: null,
    trial_expired: false,
    features_locked: false
  });
};

export const buildUserFromSignIn = (payload: SignInPayload): User => {
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

export const buildUserFromDemo = (
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

export const buildUserFromSignUp = (
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

export const buildUserFromAccount = (
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
