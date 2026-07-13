import { resolveCompanyRole } from "@/lib/permissions";
import { readFromStorage, writeToStorage } from "./storageUtils";

const USER_STORAGE_KEY = "weavecarbon_user";

let authUserSnapshot: Record<string, unknown> | null = null;

export const resolveCompanyRoleFromSnapshot = (snapshot: Record<string, unknown> | null) => {
  if (!snapshot) return null;

  const userTypeRaw = snapshot.user_type ?? snapshot.userType;
  const fallbackRole =
  userTypeRaw === "admin" ? "root" : "member";
  const membership =
  typeof snapshot.company_membership === "object" &&
  snapshot.company_membership !== null ?
  snapshot.company_membership as Record<string, unknown> :
  null;

  return resolveCompanyRole(
    {
      role:
      snapshot.company_role ??
      snapshot.companyRole ??
      snapshot.role ??
      membership?.role,
      isRoot:
      snapshot.is_root ??
      snapshot.isRoot ??
      membership?.is_root ??
      membership?.isRoot
    },
    fallbackRole
  );
};

export const getStoredCompanyRole = () => {
  const runtimeRole = resolveCompanyRoleFromSnapshot(authUserSnapshot);
  if (runtimeRole) {
    return runtimeRole;
  }

  if (typeof window === "undefined") return null;
  const snapshot = readAuthUserSnapshot();
  if (!snapshot) return null;

  try {
    return resolveCompanyRoleFromSnapshot(snapshot);
  } catch {
    return null;
  }
};

export const clearAuthUserSnapshotState = () => {
  authUserSnapshot = null;
};

export const clearPersistedAuthUserSnapshot = () => {
  writeToStorage(localStorage, USER_STORAGE_KEY, null);
  writeToStorage(sessionStorage, USER_STORAGE_KEY, null);
};

export const readAuthUserSnapshot = (): Record<string, unknown> | null => {
  if (authUserSnapshot) {
    return { ...authUserSnapshot };
  }

  if (typeof window === "undefined") {
    return null;
  }

  const rawUser = readFromStorage(sessionStorage, USER_STORAGE_KEY);
  if (!rawUser) {
    writeToStorage(localStorage, USER_STORAGE_KEY, null);
    return null;
  }

  try {
    const parsedUser = JSON.parse(rawUser);
    if (parsedUser && typeof parsedUser === "object" && !Array.isArray(parsedUser)) {
      return parsedUser as Record<string, unknown>;
    }
  } catch {
    writeToStorage(sessionStorage, USER_STORAGE_KEY, null);
    writeToStorage(localStorage, USER_STORAGE_KEY, null);
  }

  return null;
};

export const setAuthUserSnapshot = (snapshot: object | null) => {
  authUserSnapshot =
    snapshot && typeof snapshot === "object" ?
      { ...(snapshot as Record<string, unknown>) } :
      null;

  if (typeof window === "undefined") {
    return;
  }

  const isDemoSnapshot = Boolean(authUserSnapshot?.is_demo);
  if (authUserSnapshot && !isDemoSnapshot) {
    try {
      sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUserSnapshot));
    } catch {
      // ignore storage write failures (e.g. private browsing quota)
    }
    writeToStorage(localStorage, USER_STORAGE_KEY, null);
    return;
  }

  writeToStorage(sessionStorage, USER_STORAGE_KEY, null);
  writeToStorage(localStorage, USER_STORAGE_KEY, null);
};

export const buildAuthSnapshotEpoch = (snapshot: Record<string, unknown> | null) => {
  if (!snapshot) return "anonymous:no-company";
  const userId = typeof snapshot.id === "string" && snapshot.id.trim() ? snapshot.id.trim() : "anonymous";
  const companyId =
    typeof snapshot.company_id === "string" && snapshot.company_id.trim() ?
      snapshot.company_id.trim() :
      "no-company";
  return `${userId}:${companyId}`;
};

const pickString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
};

const pickBoolean = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }
  }

  return false;
};

const pickObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ?
    value as Record<string, unknown> :
    null;

const pickStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

const normalizeSnapshotUserType = (value: unknown) =>
  value === "b2b" || value === "b2c" || value === "admin" ? value : null;

export const syncAuthUserSnapshotFromPayload = (payload: unknown) => {
  const source = pickObject(payload);
  if (!source) return null;

  const user = pickObject(source.user);
  const profile = pickObject(source.profile);
  const company = pickObject(source.company);
  const membership = pickObject(source.company_membership);
  if (!user && !profile && !company && !membership) return null;

  const previous = readAuthUserSnapshot();
  const resolvedCompanyId = pickString(
    company?.id,
    profile?.company_id,
    membership?.company_id
  );
  const roles = pickStringArray(source.roles);
  const userType =
    normalizeSnapshotUserType(roles[0]) ||
    normalizeSnapshotUserType(previous?.user_type) ||
    normalizeSnapshotUserType(previous?.userType);
  const isRoot = pickBoolean(
    membership?.is_root,
    membership?.isRoot,
    previous?.is_root,
    previous?.isRoot
  );
  const companyRole = resolveCompanyRole(
    {
      role:
        membership?.role ??
        previous?.company_role ??
        previous?.companyRole ??
        previous?.role,
      isRoot
    },
    userType === "admin" ? "root" : "member"
  );
  const nextSnapshot = {
    ...(previous || {}),
    id: pickString(user?.id, profile?.user_id, previous?.id),
    analytics_company_key: resolvedCompanyId ?
      pickString(company?.analytics_company_key, source.analytics_company_key) :
      null,
    analytics_user_key: pickString(
      user?.analytics_user_key,
      source.analytics_user_key,
      previous?.analytics_user_key
    ),
    business_type: resolvedCompanyId ? pickString(company?.business_type) : null,
    current_plan: resolvedCompanyId ? pickString(company?.current_plan) : null,
    domestic_market: resolvedCompanyId ? pickString(company?.domestic_market) : null,
    email: pickString(user?.email, profile?.email, previous?.email),
    full_name: pickString(user?.full_name, profile?.full_name, previous?.full_name),
    company_id: resolvedCompanyId,
    user_type: userType || previous?.user_type || previous?.userType,
    company_role: companyRole,
    is_root: isRoot || companyRole === "root",
    avatar_url: pickString(user?.avatar_url, previous?.avatar_url)
  };

  if (!nextSnapshot.id || !nextSnapshot.email) {
    return null;
  }

  setAuthUserSnapshot(nextSnapshot);
  return nextSnapshot;
};
