import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Carbon Operations workspace contract", () => {
  const source = readFileSync(resolve(process.cwd(), "components/dashboard/carbon-operations/CarbonOperationsClient.tsx"), "utf8");

  it("shows the versioned capability boundary and canonical facilities", () => {
    expect(source).toContain("truthBoundary");
    expect(source).toContain("platformVersion");
    expect(source).toContain("industrialCoreApi.facilities");
  });

  it("keeps demo mode read-only", () => {
    expect(source).toContain("if (demo || saving) return");
    expect(source).toContain("disabled={demo || saving}");
  });
});
