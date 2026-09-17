import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("G2-10 WeaveNode operations workspace", () => {
  const source = readFileSync(resolve(process.cwd(), "components/dashboard/weavenode/WeavenodeClient.tsx"), "utf8");
  it("exposes health, hierarchy reconciliation and signed update workflows", () => {
    expect(source).toContain("weavenodeApi.health");
    expect(source).toContain("weavenodeApi.createHierarchy");
    expect(source).toContain("weavenodeApi.reconcile");
    expect(source).toContain("weavenodeApi.createReleaseKey");
    expect(source).toContain("weavenodeApi.createUpdate");
  });
});
