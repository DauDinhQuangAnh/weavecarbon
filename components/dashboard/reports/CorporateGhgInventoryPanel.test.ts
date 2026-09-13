import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const panelPath = path.resolve(
  process.cwd(),
  "components/dashboard/reports/CorporateGhgInventoryPanel.tsx"
);
const reportClientPath = path.resolve(
  process.cwd(),
  "components/dashboard/reports/ReportClient.tsx"
);

describe("R13 corporate GHG inventory UI contract", () => {
  it("mounts the controlled inventory workflow only on the GHG tab", () => {
    const source = fs.readFileSync(reportClientPath, "utf8");

    expect(source).toContain('import("./CorporateGhgInventoryPanel")');
    expect(source).toContain(
      'activeCategory === "ghg" && <CorporateGhgInventoryPanel />'
    );
  });

  it("keeps assurance and offset claims explicit", () => {
    const source = fs.readFileSync(panelPath, "utf8");

    expect(source).toContain("Không phải ISO 14064 certification hay assurance");
    expect(source).toContain("offsets không được trừ khỏi gross inventory");
    expect(source).toContain("Named inventory review (append-only)");
    expect(source).toContain("Create immutable inventory revision");
  });
});
