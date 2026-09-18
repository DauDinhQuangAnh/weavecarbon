import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "components/dashboard/settings/EnterpriseSecuritySettings.tsx"), "utf8");
const apiSource = readFileSync(resolve(process.cwd(), "lib/enterpriseSecurityApi.ts"), "utf8");
const authSource = readFileSync(resolve(process.cwd(), "components/ui/AuthForm.tsx"), "utf8");
const sessionSource = readFileSync(resolve(process.cwd(), "contexts/AuthContext.tsx"), "utf8");

describe("G2-13 enterprise security workspace contract", () => {
  it("implements the MFA challenge, enrollment, recovery and reauthentication flow", () => {
    expect(authSource).toContain("mfaRequired");
    expect(sessionSource).toContain("totp_code");
    for (const operation of ["mfaStatus", "beginMfaEnrollment", "confirmMfaEnrollment", "disableMfa"])
      expect(source).toContain(`enterpriseSecurityApi.${operation}`);
    expect(source).toContain("QRCodeSVG");
    expect(source).toContain("Chỉ hiển thị một lần");
  });

  it("exposes every governed enterprise ledger", () => {
    for (const operation of ["createPolicy", "createSsoConnection", "createKeyEvent", "createIncidentEvent", "createAcceptanceRun"])
      expect(source).toContain(`enterpriseSecurityApi.${operation}`);
    for (const path of ["/enterprise-security/posture", "/enterprise-security/policies", "/enterprise-security/sso-connections", "/enterprise-security/key-events", "/enterprise-security/incidents", "/enterprise-security/acceptance-runs"])
      expect(apiSource).toContain(path);
  });

  it("keeps SSO and production acceptance truth boundaries visible", () => {
    expect(source).toContain("Đây là sổ cấu hình");
    expect(source).toContain("round-trip với IdP thật");
    expect(source).toContain("Quyết định “accepted” bị backend từ chối");
    expect(source).toContain("Demo chỉ đọc");
  });
});
