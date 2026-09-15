import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("G2-02 data governance workspace contract", () => {
  const source = readFileSync(resolve(process.cwd(), "components/dashboard/data-governance/DataGovernanceClient.tsx"), "utf8");
  it("uses governed APIs for DQL and factor proposals", () => {
    expect(source).toContain("dataGovernanceApi.createDql");
    expect(source).toContain("dataGovernanceApi.createFactorProposal");
    expect(source).toContain("evidenceDocumentIds");
  });
  it("keeps demo mode read-only", () => { expect(source).toContain("if (demo || saving) return"); });
});
