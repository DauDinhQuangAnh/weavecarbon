import { describe, expect, it } from "vitest";
import { csvText, inventoryHotspots, latestInventoryRevisions, workspaceCanWrite, workspaceTasks, WORKSPACE_DEMO, type InventoryView } from "./industrialWorkspace";
import type { EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";
import type { FactorProposal } from "@/lib/dataGovernanceApi";
const inventory = (id: string, reference: string, revision: number, sources: Record<string, unknown>[] = []): InventoryView => ({ id, inventoryReference: reference, revision, reportingPeriodStart: "2026-01-01", reportingPeriodEnd: "2026-12-31", activitySnapshot: sources, inventoryStatus: "needs_information", resultSha256: "hash", result: {} as InventoryView["result"] });
describe("industrial workspace source boundaries", () => {
  it("selects latest revisions per reference without combining overlapping inventories", () => {
    const a = inventory("a", "same", 1), b = inventory("b", "same", 2), c = inventory("c", "different", 1);
    expect(latestInventoryRevisions([a, c, b])).toEqual([b, c]);
    expect(latestInventoryRevisions([b, a])).toEqual([b]);
  });
  it("aggregates persisted CO2e only, excluding alternative Scope 2 and malformed lines", () => {
    const data = inventory("a", "test", 1, [
      { scope: "scope1", facilityReference: "A", category: "fuel", calculatedCo2eKg: 100 },
      { scope: "scope2", accountingMethod: "location_based", facilityReference: "A", category: "power", calculatedCo2eKg: 200 },
      { scope: "scope2", accountingMethod: "market_based", facilityReference: "A", calculatedCo2eKg: 50 },
      { scope: "scope3", category: "transport", calculatedCo2eKg: 10 },
      { scope: "scope1", quantity: 100000, canonicalUnit: "kWh" },
      { scope: "scope1", calculatedCo2eKg: -10 }, { scope: "scope1", calculatedCo2eKg: Infinity },
      { scope: "scope1", calculatedCo2eKg: "100" }, { calculatedCo2eKg: 100 },
    ]);
    expect(inventoryHotspots(data, "facility")).toEqual({ rows: [{ label: "A", kg: 300 }, { label: "Chưa ánh xạ", kg: 10 }], totalKg: 310, excludedSources: 6 });
    expect(inventoryHotspots(data, "category").rows.map(row => row.label)).toEqual(["power", "fuel", "transport"]);
  });
  it("never grants mutation to demo, viewers, members or locked plans", () => {
    expect(workspaceCanWrite({ isRoot: true, canMutate: true }, false)).toBe(true);
    expect(workspaceCanWrite({ isRoot: true, canMutate: true }, true)).toBe(false);
    expect(workspaceCanWrite({ isRoot: false, canMutate: true }, false)).toBe(false);
    expect(workspaceCanWrite({ isRoot: true, canMutate: false }, false)).toBe(false);
  });
  it("does not queue controlled verified evidence or approved factors", () => {
    const evidence = [{ id: "ok", documentName: "OK", status: "third_party_verified", checksumSha256: "a".repeat(64) }, { id: "bad", documentName: "Bad", status: "locked", checksumSha256: "invalid" }] as EvidenceDocumentV2[];
    const factors = [{ id: "approved", label: "OK", governanceStatus: "approved_for_release_candidate" }, { id: "pending", label: "Pending", governanceStatus: "submitted_for_review" }] as FactorProposal[];
    expect(workspaceTasks(WORKSPACE_DEMO.activities, evidence, factors).map(row => row.id)).toEqual([`activity:${WORKSPACE_DEMO.activities[0].id}`, "evidence:bad", "factor:pending"]);
  });
  it("exports quoted UTF-8 CSV and neutralizes spreadsheet formulas", () => {
    expect(csvText([["=HYPERLINK(1)", "  @x", 'text,"quoted"', -2, null]])).toBe('\uFEFF"\'=HYPERLINK(1)","\'  @x","text,""quoted""",-2,""');
  });
});
