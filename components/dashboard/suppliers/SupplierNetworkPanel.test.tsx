import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "components/dashboard/suppliers/SupplierNetworkPanel.tsx"), "utf8");
const apiSource = readFileSync(resolve(process.cwd(), "lib/supplierNetworkApi.ts"), "utf8");
const pageSource = readFileSync(resolve(process.cwd(), "app/(dashboard)/suppliers/page.tsx"), "utf8");

describe("G2-11 supplier network workspace contract", () => {
  it("keeps the decision-support truth boundary visible", () => {
    expect(source).toContain("không phải dự báo rủi ro vật lý");
    expect(source).toContain("mọi kết quả vẫn cần chuyên gia rà soát");
    expect(source).toContain("coverage là phạm vi đã chọn");
  });

  it("exposes the complete governed workflow", () => {
    for (const operation of [
      "createProfile", "createSite", "createRelationship", "createClimateAssessment", "createCarbonSnapshot",
      "createModel", "createCriticalitySnapshot", "createPortfolio"
    ]) expect(source).toContain(`supplierNetworkApi.${operation}`);
    for (const path of [
      "/supplier-network/profiles", "/supplier-network/sites", "/supplier-network/relationships",
      "/supplier-network/climate-assessments", "/supplier-network/carbon-snapshots",
      "/supplier-network/criticality-models", "/supplier-network/criticality-snapshots", "/supplier-network/portfolios"
    ]) expect(apiSource).toContain(path);
  });

  it("preserves dependency facts and blocks demo mutation", () => {
    for (const field of ["spendPercent", "productionDependencyPercent", "singleSource", "dependentSkuCount", "dependentRouteCount"])
      expect(source).toContain(field);
    expect(source).toContain("if (demo || saving) return");
    expect(pageSource).toContain("<SupplierNetworkPanel demo={demo} />");
  });
});
