import type { components, operations } from "./generated/backend";
import { openApiClient } from "./openapiClient";

type CompanyMemberTransport = components["schemas"]["CompanyMember"];
type CompanyMemberQuery = operations["getCompanyMembers"]["parameters"]["query"];

export interface CompanyMember {
  id: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  role: CompanyMemberTransport["role"];
  status: CompanyMemberTransport["status"];
  lastLogin: string | null;
  createdAt: string | null;
}

export function toCompanyMember(member: CompanyMemberTransport): CompanyMember {
  return {
    id: member.id,
    userId: member.user_id,
    fullName: member.full_name ?? null,
    email: member.email ?? null,
    role: member.role,
    status: member.status,
    lastLogin: member.last_login ?? null,
    createdAt: member.created_at ?? null
  };
}

export async function listCompanyMembers(
  query: CompanyMemberQuery = {}
): Promise<CompanyMember[]> {
  const members = await openApiClient.get("/company/members", { query });
  return members.map(toCompanyMember);
}
