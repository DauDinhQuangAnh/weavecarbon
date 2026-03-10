export type CompanyRole = "root" | "member" | "viewer";
export const NO_PERMISSION_MESSAGE = "Bạn không có quyền thực hiện thao tác này.";

const ROLE_ALIAS_MAP: Record<string, CompanyRole> = {
  root: "root",
  admin: "root",
  owner: "root",
  member: "member",
  editor: "member",
  viewer: "viewer",
  readonly: "viewer",
  "read-only": "viewer",
  read_only: "viewer"
};

const normalizeRoleToken = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const toCompanyRole = (value: unknown): CompanyRole | null => {
  const normalized = normalizeRoleToken(value);
  if (!normalized) return null;
  return ROLE_ALIAS_MAP[normalized] || null;
};

export const resolveCompanyRole = (
  input: {
    role?: unknown;
    isRoot?: unknown;
  },
  fallback: CompanyRole = "root"
): CompanyRole => {
  if (input.isRoot === true) return "root";
  return toCompanyRole(input.role) || fallback;
};

export const canAccessSettings = (role: CompanyRole) => {
  void role;
  return true;
};
export const canAccessSystemSettings = (role: CompanyRole) => role === "root";
export const canAccessUsersSettings = (role: CompanyRole) => role === "root";
export const canMutateData = (role: CompanyRole) => role !== "viewer";
