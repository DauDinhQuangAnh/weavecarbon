import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Carbon Operations workspace contract", () => {
  const source = readFileSync(resolve(process.cwd(), "components/dashboard/carbon-operations/CarbonOperationsClient.tsx"), "utf8");
  const activitySource = readFileSync(resolve(process.cwd(), "components/dashboard/carbon-operations/ActivityOperationsPanel.tsx"), "utf8");

  it("shows the versioned capability boundary and canonical facilities", () => {
    expect(source).toContain("truthBoundary");
    expect(source).toContain("platformVersion");
    expect(source).toContain("industrialCoreApi.facilities");
    expect(source).toContain("industrialCoreApi.processes");
    expect(source).toContain("industrialCoreApi.measurementPoints");
    expect(activitySource).toContain("industrialCoreApi.activityLineage");
    expect(activitySource).toContain("industrialCoreApi.createActivity");
    expect(activitySource).toContain("industrialCoreApi.reviewActivity");
  });

  it("aligns mutation controls with company-admin and subscription permissions", () => {
    expect(source).toContain("const canWrite = !demo && isRoot && canMutate");
    expect(source).toContain('t("adminRequired")');
    expect(activitySource).toContain("disabled={!canWrite");
  });

  it("exposes governed dynamic allocation rules and reconciled runs", () => {
    expect(source).toContain("industrialCoreApi.allocationRules");
    expect(source).toContain("industrialCoreApi.createAllocationRule");
    expect(source).toContain("industrialCoreApi.createAllocationRun");
    expect(source).toContain("reconciliationStatus");
    expect(source).toContain("sourceLevel: \"facility\", targetLevel: \"process\"");
    expect(source).toContain("selectControlledEvidence");
  });
});
