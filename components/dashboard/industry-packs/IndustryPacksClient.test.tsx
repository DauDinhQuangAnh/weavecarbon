import { readFileSync } from "node:fs"; import { resolve } from "node:path"; import { describe, expect, it } from "vitest";
describe("G2-05 Industry Packs workspace", () => { const source = readFileSync(resolve(process.cwd(), "components/dashboard/industry-packs/IndustryPacksClient.tsx"), "utf8");
  it("uses facility, process and governed factor data for pilots", () => { expect(source).toContain("industrialCoreApi.processes"); expect(source).toContain("dataGovernanceApi.factorProposals"); expect(source).toContain("industryPacksApi.createPilot"); });
  it("discloses expert approval and target scope boundaries", () => { expect(source).toContain("approvalStatus"); expect(source).toContain("targetCaution"); expect(source).toContain("legalNotice"); });
  it("renders pack-defined activity categories and sector context instead of hard-coding steel and cement", () => {
    expect(source).toContain("requiredCategories");
    expect(source).toContain("requiredContextFields");
    expect(source).toContain("contextFieldDescriptions");
    expect(source).toContain("sectorContext");
    expect(source).toContain("manifests.map");
  });
  it("only offers controlled evidence and reviewed factors", () => {
    expect(source).toContain("listEvidenceV2");
    expect(source).toContain("evidenceReady");
    expect(source).toContain('governanceStatus === "approved_for_release_candidate"');
  });
});
