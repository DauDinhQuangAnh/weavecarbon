import { api } from "@/lib/apiClient";

export interface MfaStatus {
  status: "not_enrolled" | "pending" | "enabled" | "disabled";
  enabled: boolean;
  revision: number;
  activeRevision?: number | null;
  recoveryCodesRemaining?: number;
  createdAt?: string;
}

export interface MfaEnrollment {
  id: string;
  revision: number;
  status: "pending";
  secret: string;
  otpauthUri: string;
  created_at?: string;
}

export interface MfaConfirmation {
  id: string;
  revision: number;
  status: "enabled";
  recoveryCodes: string[];
  reauthenticationRequired: boolean;
}

export interface EnterpriseSecurityPolicy {
  id: string;
  policyReference: string;
  revision: number;
  requireMfaForAdmins: boolean;
  ssoMode: "disabled" | "optional" | "required";
  sessionIdleMinutes: number;
  dataRetentionDays: number;
  approvalStatus: "draft" | "approved";
  rationale: string;
  evidenceDocumentId: string;
  evidenceSnapshot: Record<string, unknown>;
  payloadSha256: string;
  createdAt: string;
}

export interface EnterpriseSsoConnection {
  id: string;
  connectionReference: string;
  revision: number;
  protocol: "oidc";
  issuerUrl: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  clientId: string;
  clientSecretReference: string;
  allowedEmailDomains: string[];
  scopes: string[];
  requiredAcr?: string | null;
  validationChecks: Record<string, boolean>;
  status: "draft" | "active" | "disabled";
  evidenceDocumentId: string;
  createdAt: string;
}

export interface EnterpriseKeyEvent {
  id: string;
  keyReference: string;
  revision: number;
  purpose: string;
  provider: string;
  externalSecretReference: string;
  keyVersion: string;
  lifecycleStatus: "active" | "rotated" | "revoked";
  effectiveAt: string;
  rotationDueAt?: string | null;
  reason: string;
  evidenceDocumentId: string;
  createdAt: string;
}

export interface EnterpriseIncidentEvent {
  id: string;
  incidentReference: string;
  revision: number;
  eventType: "detected" | "triaged" | "contained" | "eradicated" | "recovered" | "closed" | "reopened";
  severity: "low" | "medium" | "high" | "critical";
  occurredAt: string;
  owner: string;
  summary: string;
  personalDataInvolved: boolean;
  regulatoryNotificationRequired: boolean;
  evidenceDocumentId: string;
  createdAt: string;
}

export interface ProductionAcceptanceRun {
  id: string;
  releaseReference: string;
  backendCommitSha: string;
  frontendCommitSha: string;
  backendImageDigest: string;
  frontendImageDigest: string;
  highestMigration: string;
  ciRunUrl: string;
  rollbackImageDigest: string;
  backupRestoreReportSha256: string;
  smokeResults: Record<string, boolean>;
  securityScanSummary: { unresolvedCritical?: number; unresolvedHigh?: number; [key: string]: unknown };
  decision: "blocked" | "accepted";
  decisionRationale: string;
  evidenceDocumentId: string;
  createdAt: string;
}

export interface EnterpriseSecurityPosture {
  policy: EnterpriseSecurityPolicy | null;
  adminMfa: { total: number; enabled: number; missing: Array<{ userId: string; email: string }> };
  activeSsoConnections: number;
  overdueKeys: number;
  openIncidents: number;
  latestProductionAcceptance: ProductionAcceptanceRun | null;
  productionReady: boolean;
}

export const enterpriseSecurityApi = {
  mfaStatus: () => api.get<MfaStatus>("/auth/mfa/status", { disableResponseCache: true }),
  beginMfaEnrollment: (payload: { password: string; current_code?: string }) =>
    api.post<MfaEnrollment>("/auth/mfa/enroll", payload),
  confirmMfaEnrollment: (totpCode: string) =>
    api.post<MfaConfirmation>("/auth/mfa/confirm", { totp_code: totpCode }),
  disableMfa: (payload: { password: string; mfa_code: string; reason: string }) =>
    api.post<{ status: "disabled"; reauthenticationRequired: boolean }>("/auth/mfa/disable", payload),
  posture: () => api.get<EnterpriseSecurityPosture>("/enterprise-security/posture", { disableResponseCache: true }),
  policies: () => api.get<EnterpriseSecurityPolicy[]>("/enterprise-security/policies", { disableResponseCache: true }),
  createPolicy: (payload: Omit<EnterpriseSecurityPolicy, "id" | "revision" | "evidenceSnapshot" | "payloadSha256" | "createdAt">) =>
    api.post<EnterpriseSecurityPolicy>("/enterprise-security/policies", payload),
  ssoConnections: () => api.get<EnterpriseSsoConnection[]>("/enterprise-security/sso-connections", { disableResponseCache: true }),
  createSsoConnection: (payload: Record<string, unknown>) =>
    api.post<EnterpriseSsoConnection>("/enterprise-security/sso-connections", payload),
  keyEvents: () => api.get<EnterpriseKeyEvent[]>("/enterprise-security/key-events", { disableResponseCache: true }),
  createKeyEvent: (payload: Record<string, unknown>) =>
    api.post<EnterpriseKeyEvent>("/enterprise-security/key-events", payload),
  incidents: () => api.get<EnterpriseIncidentEvent[]>("/enterprise-security/incidents", { disableResponseCache: true }),
  createIncidentEvent: (payload: Record<string, unknown>) =>
    api.post<EnterpriseIncidentEvent>("/enterprise-security/incidents", payload),
  acceptanceRuns: () => api.get<ProductionAcceptanceRun[]>("/enterprise-security/acceptance-runs", { disableResponseCache: true }),
  createAcceptanceRun: (payload: Record<string, unknown>) =>
    api.post<ProductionAcceptanceRun>("/enterprise-security/acceptance-runs", payload)
};
