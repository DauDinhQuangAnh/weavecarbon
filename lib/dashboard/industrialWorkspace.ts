import type { CorporateGhgInventory } from "@/lib/weave-v2/corporateGhgInventoryApi";
import type { IndustrialActivity, IndustrialFacility, IndustrialProcess } from "@/lib/industrialCoreApi";
import type { EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";
import type { FactorProposal } from "@/lib/dataGovernanceApi";

export type InventoryView = Pick<CorporateGhgInventory, "id" | "inventoryReference" | "revision" | "reportingPeriodStart" | "reportingPeriodEnd" | "activitySnapshot" | "result" | "inventoryStatus" | "resultSha256">;
export function latestInventoryRevisions(rows: InventoryView[]) {
  const latest = new Map<string, InventoryView>();
  rows.forEach(row => { if (!latest.has(row.inventoryReference) || latest.get(row.inventoryReference)!.revision < row.revision) latest.set(row.inventoryReference, row); });
  return [...latest.values()].sort((a, b) => b.reportingPeriodEnd.localeCompare(a.reportingPeriodEnd));
}
export function inventoryHotspots(inventory: InventoryView, by: "facility" | "category") {
  const result = new Map<string, number>();
  let excludedSources = 0;
  inventory.activitySnapshot.forEach(source => {
    if (!["scope1", "scope2", "scope3"].includes(String(source.scope))) { excludedSources++; return; }
    // Location-based and market-based Scope 2 are alternative views, never additive.
    if (source.scope === "scope2" && source.accountingMethod !== "location_based") { excludedSources++; return; }
    const kg = source.calculatedCo2eKg;
    if (typeof kg !== "number" || !Number.isFinite(kg) || kg < 0) { excludedSources++; return; }
    const key = String(source[by === "facility" ? "facilityReference" : "category"] || "Chưa ánh xạ");
    result.set(key, (result.get(key) || 0) + kg);
  });
  const rows = [...result].map(([label, kg]) => ({ label, kg })).sort((a, b) => b.kg - a.kg);
  const totalKg = rows.reduce((total, row) => total + row.kg, 0);
  return { rows, totalKg, excludedSources };
}
export function workspaceCanWrite(access: { isRoot: boolean; canMutate: boolean }, demo: boolean) {
  return !demo && access.isRoot && access.canMutate;
}
export function workspaceTasks(activities: IndustrialActivity[], evidence: EvidenceDocumentV2[], factors: FactorProposal[]) {
  return [
    ...activities.filter(row => ["L1", "L2"].includes(row.dataQualityLevel)).map(row => ({ id: `activity:${row.id}`, title: row.activityReference, reason: `Nguồn ${row.dataQualityLevel} cần bổ sung bằng chứng`, path: "/activity-data" })),
    ...evidence.filter(row => !["locked", "third_party_verified"].includes(row.status) || !/^[a-f0-9]{64}$/i.test(row.checksumSha256 || "")).map(row => ({ id: `evidence:${row.id}`, title: row.documentName, reason: /^[a-f0-9]{64}$/i.test(row.checksumSha256 || "") ? "Chứng từ chưa khóa" : "Chứng từ thiếu checksum hợp lệ", path: "/evidence" })),
    ...factors.filter(row => row.governanceStatus !== "approved_for_release_candidate").map(row => ({ id: `factor:${row.id}`, title: row.label, reason: `Factor: ${row.governanceStatus}`, path: "/data-quality" })),
  ];
}
export function csvText(rows: (string | number | null)[][]) {
  return '\uFEFF' + rows.map(row => row.map(cell => {
    if (typeof cell === "number") return Number.isFinite(cell) ? String(cell) : "";
    const text = String(cell ?? "");
    const safe = /^[\s]*[=+@-]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
}

// Clearly synthetic, read-only records for the new demo views; never sent to the BE.
const facilityId = "30000000-0000-4000-8000-000000000001";
const processId = "30000000-0000-4000-8000-000000000002";
export const WORKSPACE_DEMO: { facilities: IndustrialFacility[]; processes: IndustrialProcess[]; activities: IndustrialActivity[] } = {
  facilities: [{ id: facilityId, facilityReference: "DEMO-FACTORY", revision: 1, name: "Cơ sở minh họa", countryCode: "VN", timezone: "Asia/Ho_Chi_Minh", lifecycleStatus: "active", boundaryNotes: "Dữ liệu tổng hợp, không phải số đo tại hiện trường", metadata: {}, createdAt: "2026-09-01T00:00:00Z" }],
  processes: [{ id: processId, facilityRevisionId: facilityId, facilityReference: "DEMO-FACTORY", processReference: "DEMO-LINE", revision: 1, name: "Dây chuyền minh họa", processType: "production", lifecycleStatus: "active", createdAt: "2026-09-01T00:00:00Z" }],
  activities: [{ id: "30000000-0000-4000-8000-000000000003", activityReference: "DEMO-ELECTRICITY", facilityRevisionId: facilityId, processRevisionId: processId, facilityReference: "DEMO-FACTORY", activityType: "electricity", periodStart: "2026-09-01T00:00:00Z", periodEnd: "2026-09-30T23:59:59Z", quantity: 1200, canonicalUnit: "kWh", sourceKind: "manual", dataQualityLevel: "L2", sourceSha256: "demo-only-not-a-source-checksum", evidenceDocumentIds: [] }],
};
