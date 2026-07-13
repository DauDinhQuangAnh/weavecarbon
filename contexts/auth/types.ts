import type { AuthTokens } from "@/lib/apiClient";
import type { CompanyRole } from "@/lib/permissions";

export interface User {
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

export type GoogleAuthIntent = "signin" | "signup";

export interface SignInOptions {
  rememberMe?: boolean;
}

export type AuthSessionStatus =
  | "checking"
  | "authenticated"
  | "recovering"
  | "anonymous"
  | "expired";

export interface RefreshUserOptions {
  preserveUserOnFailure?: boolean;
}

export interface AuthContextType {
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

export interface BackendUser {
  id: string;
  analytics_user_key?: string | null;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

export interface BackendProfile {
  id?: string;
  user_id?: string;
  full_name?: string | null;
  email?: string;
  company_id?: string | null;
}

export interface BackendCompany {
  analytics_company_key?: string | null;
  business_type?: "shop_online" | "brand" | "factory" | null;
  current_plan?: string | null;
  domestic_market?: string | null;
  id: string;
  target_markets?: string[] | null;
}

export interface BackendCompanyMembership {
  company_id?: string | null;
  role?: string | null;
  status?: string | null;
  is_root?: boolean | null;
  isRoot?: boolean | null;
}

export interface BackendCompanyMember {
  id?: string;
  user_id?: string;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  company_id?: string | null;
  is_root?: boolean | null;
  isRoot?: boolean | null;
}

export interface SignUpOptions {
  companyName?: string;
  businessType?: "shop_online" | "brand" | "factory";
  targetMarkets?: string[];
  phone?: string;
}

export interface SignUpPayload {
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

export interface SignInPayload {
  analytics_user_key?: string | null;
  user: BackendUser;
  profile?: BackendProfile | null;
  roles?: Array<"b2b" | "b2c" | "admin">;
  company?: BackendCompany | null;
  company_membership?: BackendCompanyMembership | null;
  tokens?: AuthTokens;
}

export interface DemoPayload {
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

export interface AccountPayload {
  analytics_user_key?: string | null;
  profile?: BackendProfile | null;
  company?: BackendCompany | null;
  roles?: Array<"b2b" | "b2c" | "admin">;
  company_membership?: BackendCompanyMembership | null;
}
