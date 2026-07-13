import {
  api,
  authTokenStore,
  ensureAccessToken,
  isApiError,
  isDefinitiveAuthExpiredCode,
  isUnauthorizedApiError,
  readAuthUserSnapshot
} from "@/lib/apiClient";
import { ACCOUNT_ENDPOINT_ENABLED, AUTH_DISABLED } from "@/lib/env";
import {
  resolveAuthenticatedUserType as resolveSharedAuthenticatedUserType,
  type AuthUserType
} from "@/lib/auth/routing";
import { getDefaultCompanyRole, normalizeCompanyMembership, normalizeStoredUser } from "./userBuilders";
import type { AccountPayload, BackendCompanyMember, SignInPayload, User } from "./types";

export const postWithFallback = async <T,>(
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

export const isNotFoundError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("not found") || message.includes("route");
};

export const isUnauthorizedError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("unauthorized") || message.includes("invalid token");
};

export const isConfirmedSessionExpiredError = (error: unknown) =>
  isApiError(error) &&
  error.status === 401 &&
  isDefinitiveAuthExpiredCode(error.code);

export const isNoActiveSessionError = (error: unknown) =>
  isApiError(error) &&
  error.status === 401 &&
  error.code === "NO_ACTIVE_SESSION";

export const isAuthFailureError = (error: unknown) =>
  !isNoActiveSessionError(error) &&
  (
    isConfirmedSessionExpiredError(error) ||
    isUnauthorizedApiError(error) ||
    isUnauthorizedError(error)
  );

export const loadStoredAuthUser = (): User | null => {
  const snapshot = readAuthUserSnapshot();
  if (!snapshot) {
    return null;
  }

  return normalizeStoredUser(snapshot as unknown as User);
};

export const getAccountSafely = async (): Promise<AccountPayload | null> => {
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

export const getSessionSafely = async (): Promise<SignInPayload | null> => {
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

export const resolveAuthenticatedUserType = async (
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

export const isEmailNotVerifiedError = (error: unknown) => {
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

export const syncUserCompanyRole = async (baseUser: User | null): Promise<User | null> => {
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
