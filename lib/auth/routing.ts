import { api } from "@/lib/apiClient";

export type AuthUserType = "b2b" | "b2c" | "admin";

export interface CompanyCheckPayload {
  is_b2b?: boolean;
  has_company?: boolean;
  user_type?: AuthUserType;
  data?: {
    is_b2b?: boolean;
    has_company?: boolean;
    user_type?: AuthUserType;
  };
}

export interface AccountRolePayload {
  roles?: AuthUserType[];
}

export const normalizeAuthUserType = (
  value?: string | null
): AuthUserType | undefined => {
  if (value === "b2b" || value === "b2c" || value === "admin") {
    return value;
  }

  return undefined;
};

export const normalizeAuthUserTypeOrNull = (
  value?: string | null
): AuthUserType | null => normalizeAuthUserType(value) || null;

export const normalizeCompanyCheck = (
  payload: CompanyCheckPayload | null | undefined
) => {
  const nested = payload?.data;
  const source = nested || payload || {};
  const userType = normalizeAuthUserType(source.user_type);
  const isB2b =
    typeof source.is_b2b === "boolean" ? source.is_b2b : userType === "b2b";
  const hasCompany =
    typeof source.has_company === "boolean" ? source.has_company : false;

  return {
    hasCompany,
    isB2b,
    userType
  };
};

export const getDashboardPath = (type?: AuthUserType) =>
  type === "b2c" ? "/b2c" : "/overview";

export const buildCheckEmailUrl = (params: {
  email?: string | null;
  source?: "google" | "email";
  intent?: "signin" | "signup";
  type?: AuthUserType | null;
}) => {
  const query = new URLSearchParams();
  if (params.type) {
    query.set("type", params.type);
  }
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

export const buildAuthErrorUrl = (params: {
  type?: AuthUserType | null;
  error: string;
  errorDescription?: string | null;
}) => {
  const query = new URLSearchParams();
  if (params.type) {
    query.set("type", params.type);
  }
  query.set("error", params.error);
  if (params.errorDescription?.trim()) {
    query.set("error_description", params.errorDescription.trim());
  }

  return `/auth?${query.toString()}`;
};

interface ResolveAuthenticatedUserTypeOptions {
  fallbackRole?: AuthUserType;
  accountPayload?: AccountRolePayload | null;
  getAccountPayload?: () => Promise<AccountRolePayload | null>;
  companyCheckPayload?: CompanyCheckPayload | null;
  getCompanyCheckPayload?: () => Promise<CompanyCheckPayload | null>;
  shouldIgnoreAccountError?: (error: unknown) => boolean;
  shouldIgnoreCompanyCheckError?: (error: unknown) => boolean;
}

export const resolveAuthenticatedUserType = async ({
  fallbackRole,
  accountPayload,
  getAccountPayload = () => api.get<AccountRolePayload>("/account"),
  companyCheckPayload,
  getCompanyCheckPayload = () => api.get<CompanyCheckPayload>("/auth/check-company"),
  shouldIgnoreAccountError,
  shouldIgnoreCompanyCheckError
}: ResolveAuthenticatedUserTypeOptions = {}): Promise<AuthUserType | undefined> => {
  let resolvedAccountPayload = accountPayload;
  if (typeof resolvedAccountPayload === "undefined") {
    try {
      resolvedAccountPayload = await getAccountPayload();
    } catch (error) {
      if (!shouldIgnoreAccountError?.(error)) {
        throw error;
      }
      resolvedAccountPayload = null;
    }
  }

  const accountRole = normalizeAuthUserType(resolvedAccountPayload?.roles?.[0]);
  if (accountRole) {
    return accountRole;
  }

  let resolvedCompanyCheckPayload = companyCheckPayload;
  if (typeof resolvedCompanyCheckPayload === "undefined") {
    try {
      resolvedCompanyCheckPayload = await getCompanyCheckPayload();
    } catch (error) {
      if (shouldIgnoreCompanyCheckError?.(error)) {
        return fallbackRole;
      }
      throw error;
    }
  }

  const { isB2b, userType } = normalizeCompanyCheck(resolvedCompanyCheckPayload);
  return userType || (isB2b ? "b2b" : "b2c");
};

interface ResolvePostLoginPathOptions {
  accountType?: AuthUserType | null;
  requestedType?: AuthUserType | null;
  onboardingPath?: string;
  overviewPath?: string;
  b2cPath?: string;
  companyCheckPayload?: CompanyCheckPayload | null;
  getCompanyCheckPayload?: () => Promise<CompanyCheckPayload | null>;
  onCompanyCheckError?: (
    error: unknown,
    context: { requestedType?: AuthUserType | null }
  ) => Promise<string | null | undefined> | string | null | undefined;
}

export const resolvePostLoginPath = async ({
  accountType,
  requestedType,
  onboardingPath = "/onboarding",
  overviewPath = "/overview",
  b2cPath = "/b2c",
  companyCheckPayload,
  getCompanyCheckPayload = () => api.get<CompanyCheckPayload>("/auth/check-company"),
  onCompanyCheckError
}: ResolvePostLoginPathOptions = {}) => {
  if (accountType === "b2c") {
    return b2cPath;
  }

  if (accountType === "admin") {
    return overviewPath;
  }

  try {
    const payload =
      typeof companyCheckPayload === "undefined" ?
        await getCompanyCheckPayload() :
        companyCheckPayload;
    const { isB2b, hasCompany } = normalizeCompanyCheck(payload);

    if (isB2b && !hasCompany) {
      return onboardingPath;
    }

    if (!isB2b) {
      return b2cPath;
    }

    return overviewPath;
  } catch (error) {
    const fallbackPath = await onCompanyCheckError?.(error, { requestedType });
    return fallbackPath || overviewPath;
  }
};
