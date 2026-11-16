import type { IndustrialActivity, IndustrialActivityLineage, IndustrialCapabilityRegistry, IndustrialFacility, IndustrialMeasurementPoint, IndustrialProcess } from "@/lib/industrialCoreApi";
import type { EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";
import type { FactorProposal } from "@/lib/dataGovernanceApi";
import { WORKSPACE_DEMO, type InventoryView } from "./industrialWorkspace";
import { industrialDatasetSnapshot } from "@/lib/industrialPortfolio/snapshot";

// Synthetic fixtures for the new /demo pages only. No database, file or device is represented here.
const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const timestamp = "2026-09-30T00:00:00Z";
// Format examples, not hashes of uploaded documents or verified calculations.
const exampleHash = (character: string) => character.repeat(64);

const SNAPSHOT_FACILITIES: IndustrialFacility[] = industrialDatasetSnapshot.facilities.map((f) => ({
  id: f.id,
  facilityReference: f.id,
  revision: 1,
  name: f.name,
  countryCode: "VN",
  timezone: "Asia/Ho_Chi_Minh",
  lifecycleStatus: "active" as const,
  boundaryNotes: `Ranh giới ngành ${f.industry}: ${f.name} (Phát thải kỳ: ${f.emissions_tco2e} tCO2e)`,
  metadata: { industry: f.industry, completeness: f.completeness, open_gaps: f.open_gaps, emissions_tco2e: f.emissions_tco2e, lat: f.latitude, lng: f.longitude },
  createdAt: timestamp,
}));

const SNAPSHOT_PROCESSES: IndustrialProcess[] = industrialDatasetSnapshot.processes.map((p) => ({
  id: p.id,
  facilityRevisionId: p.facility_id,
  facilityReference: p.facility_id,
  processReference: p.id,
  revision: 1,
  name: `${p.name} (${p.intensity})`,
  processType: p.emissions_tco2e > 2000 ? "thermal_process" : p.emissions_tco2e > 1000 ? "production" : "utilities",
  lifecycleStatus: "active" as const,
  createdAt: timestamp,
}));

const legacyFacilities: IndustrialFacility[] = [
  WORKSPACE_DEMO.facilities[0],
  { ...WORKSPACE_DEMO.facilities[0], id: id(4), facilityReference: "DEMO-STEEL-MELT", name: "Xưởng luyện thép lò điện minh họa", boundaryNotes: "Ranh giới mô phỏng: lò điện hồ quang, lò thùng và xử lý khí thải" },
  { ...WORKSPACE_DEMO.facilities[0], id: id(5), facilityReference: "DEMO-COFFEE", name: "Xưởng sơ chế cà phê minh họa", boundaryNotes: "Ranh giới mô phỏng: sấy, xát vỏ, phân loại và đóng bao" },
];
const facilities: IndustrialFacility[] = [
  ...SNAPSHOT_FACILITIES,
  ...legacyFacilities,
];

const legacyProcesses: IndustrialProcess[] = [
  WORKSPACE_DEMO.processes[0],
  { ...WORKSPACE_DEMO.processes[0], id: id(6), facilityRevisionId: id(4), facilityReference: "DEMO-STEEL-MELT", processReference: "DEMO-EAF-LINE", name: "Luyện thép lò điện minh họa" },
  { ...WORKSPACE_DEMO.processes[0], id: id(7), facilityRevisionId: id(5), facilityReference: "DEMO-COFFEE", processReference: "DEMO-COFFEE-LINE", name: "Sấy và xát cà phê minh họa" },
];
const processes: IndustrialProcess[] = [
  ...SNAPSHOT_PROCESSES,
  ...legacyProcesses,
];
export const DEMO_EVIDENCE: EvidenceDocumentV2[] = [
  { id: id(20), companyId: "demo-only", evidenceType: "electricity_invoice", documentName: "DEMO · Hóa đơn điện tháng 9", fileSizeBytes: 0, checksumSha256: exampleHash("a"), extractedJson: { synthetic: true }, status: "locked", createdAt: timestamp, updatedAt: timestamp },
  { id: id(21), companyId: "demo-only", evidenceType: "fuel_invoice", documentName: "DEMO · Phiếu nhiên liệu chờ review", fileSizeBytes: 0, checksumSha256: exampleHash("b"), extractedJson: { synthetic: true }, status: "uploaded", createdAt: timestamp, updatedAt: timestamp },
  { id: id(22), companyId: "demo-only", evidenceType: "production_log", documentName: "DEMO · Nhật ký sản xuất thiếu checksum", fileSizeBytes: 0, checksumSha256: null, extractedJson: { synthetic: true }, status: "uploaded", createdAt: timestamp, updatedAt: timestamp },
];
export const DEMO_FACTORS: FactorProposal[] = [
  { id: id(30), proposalReference: "DEMO-EF-ELECTRICITY", revision: 1, factorId: "demo-electricity", label: "DEMO · Hệ số điện minh họa", factorValue: 0.5, unit: "kgCO2e/kWh", sourceName: "Giả định demo, không dùng tính toán thực", geography: "VN", governanceStatus: "approved_for_release_candidate", createdAt: timestamp },
  { id: id(31), proposalReference: "DEMO-EF-FUEL", revision: 1, factorId: "demo-fuel", label: "DEMO · Hệ số nhiên liệu chờ rà soát", factorValue: 2.5, unit: "kgCO2e/litre", sourceName: "Giả định demo, không phải hệ số được công bố", geography: "VN", governanceStatus: "needs_information", createdAt: timestamp },
];
export const DEMO_MEASUREMENT_POINTS: IndustrialMeasurementPoint[] = [
  { id: id(40), facilityRevisionId: facilities[0].id, facilityReference: "DEMO-FACTORY", processRevisionId: processes[0].id, measurementPointReference: "DEMO-METER-01", revision: 1, measurementType: "electricity", canonicalUnit: "kWh", sourceType: "weavenode", deviceIdentity: "DEMO-NODE-01", calibrationStatus: "current", calibrationDueOn: "2027-03-01", samplingIntervalSeconds: 900, metadata: { synthetic: true, connected: false }, createdAt: timestamp },
  { id: id(41), facilityRevisionId: id(4), facilityReference: "DEMO-STEEL-MELT", processRevisionId: id(6), measurementPointReference: "DEMO-METER-02", revision: 1, measurementType: "water", canonicalUnit: "m3", sourceType: "meter", deviceIdentity: "DEMO-NODE-02", calibrationStatus: "expired", calibrationDueOn: "2026-08-01", samplingIntervalSeconds: 3600, metadata: { synthetic: true, connected: false }, createdAt: timestamp },
];
const SNAPSHOT_ACTIVITIES: IndustrialActivity[] = industrialDatasetSnapshot.activity.map((a, i) => {
  const matchingProcess = SNAPSHOT_PROCESSES.find((p) => p.facilityRevisionId === a.facility_id);
  const qualityLevel: "L1" | "L2" | "L3" | "L4" = a.quality === 'Primary' ? 'L4' : a.quality === 'Evidence-backed' ? 'L3' : a.quality === 'Self-reported' ? 'L2' : 'L1';
  const actName = a.activity.toLowerCase();
  const activityType = actName.includes('electricity') ? 'electricity' : (actName.includes('diesel') || actName.includes('gas') || actName.includes('coal') || actName.includes('steam')) ? 'fuel' : actName.includes('waste') ? 'waste' : 'material';
  return {
    id: a.id,
    activityReference: a.id,
    facilityRevisionId: a.facility_id || 'FAC-BD',
    facilityReference: a.facility_id || 'FAC-BD',
    processRevisionId: matchingProcess?.id || null,
    measurementPointRevisionId: null,
    activityType,
    periodStart: '2026-08-01T00:00:00Z',
    periodEnd: '2026-08-31T23:59:59Z',
    quantity: a.value,
    canonicalUnit: a.unit,
    sourceKind: a.source.toLowerCase().includes('meter') ? 'meter' : 'invoice',
    dataQualityLevel: qualityLevel,
    sourceSha256: exampleHash(String.fromCharCode(97 + (i % 26))),
    evidenceDocumentIds: a.evidence_count > 0 ? [DEMO_EVIDENCE[i % DEMO_EVIDENCE.length].id] : [],
    createdAt: timestamp,
  };
});

const legacyActivities: IndustrialActivity[] = [
  { ...WORKSPACE_DEMO.activities[0], measurementPointRevisionId: id(40), sourceSha256: exampleHash("c"), evidenceDocumentIds: [id(20)] },
  { ...WORKSPACE_DEMO.activities[0], id: id(8), activityReference: "DEMO-EAF-ELECTRICITY", facilityRevisionId: id(4), facilityReference: "DEMO-STEEL-MELT", processRevisionId: id(6), quantity: 6000, dataQualityLevel: "L3" as const, sourceSha256: exampleHash("d"), evidenceDocumentIds: [id(20)] },
  { ...WORKSPACE_DEMO.activities[0], id: id(9), activityReference: "DEMO-EAF-FUEL", facilityRevisionId: id(4), facilityReference: "DEMO-STEEL-MELT", processRevisionId: id(6), activityType: "fuel", quantity: 800, canonicalUnit: "litre", dataQualityLevel: "L2" as const, sourceSha256: exampleHash("e"), evidenceDocumentIds: [id(21)] },
  { ...WORKSPACE_DEMO.activities[0], id: id(10), activityReference: "DEMO-COFFEE-PRODUCTION", facilityRevisionId: id(5), facilityReference: "DEMO-COFFEE", processRevisionId: id(7), activityType: "production", quantity: 180, canonicalUnit: "tonne", dataQualityLevel: "L1" as const, sourceSha256: exampleHash("f"), evidenceDocumentIds: [id(22)] },
  { ...WORKSPACE_DEMO.activities[0], id: id(11), activityReference: "DEMO-EAF-WATER", facilityRevisionId: id(4), facilityReference: "DEMO-STEEL-MELT", processRevisionId: id(6), measurementPointRevisionId: id(41), activityType: "water", quantity: 240, canonicalUnit: "m3", dataQualityLevel: "L2" as const, sourceSha256: exampleHash("1"), evidenceDocumentIds: [] },
];

export const INDUSTRIAL_DEMO = {
  facilities,
  processes,
  activities: [
    ...SNAPSHOT_ACTIVITIES,
    ...legacyActivities,
  ],
  measurementPoints: DEMO_MEASUREMENT_POINTS,
  evidence: DEMO_EVIDENCE,
};

export function demoActivityLineage(activityId: string): IndustrialActivityLineage | null {
  const activity = INDUSTRIAL_DEMO.activities.find(row => row.id === activityId);
  if (!activity) return null;
  const facility = facilities.find(row => row.id === activity.facilityRevisionId) || facilities[0];
  const process = processes.find(row => row.id === activity.processRevisionId);
  const point = DEMO_MEASUREMENT_POINTS.find(row => row.id === activity.measurementPointRevisionId);
  const evidence = DEMO_EVIDENCE.filter(row => (activity.evidenceDocumentIds || []).includes(row.id)).map(row => ({ id: row.id, name: row.documentName, type: row.evidenceType, status: row.status, checksumSha256: row.checksumSha256 || null }));
  return {
    activity, facility: { id: facility.id, reference: facility.facilityReference, name: facility.name },
    process: process ? { id: process.id, reference: process.processReference, name: process.name } : null,
    measurementPoint: point ? { id: point.id, reference: point.measurementPointReference, type: point.measurementType } : null,
    evidence,
    latestReview: activity.id === id(8) ? { id: id(50), activityId, reviewerId: "demo-reviewer", reviewerName: "Người rà soát minh họa", reviewerRole: "industrial_activity_reviewer", decision: "approved", notes: "Review nội bộ mô phỏng. Không phải thẩm tra độc lập.", sourceSha256: activity.sourceSha256, evidenceSnapshot: evidence, createdAt: timestamp } : activity.id === id(9) ? { id: id(51), activityId, reviewerId: "demo-reviewer", reviewerName: "Người rà soát minh họa", reviewerRole: "industrial_activity_reviewer", decision: "needs_information", notes: "Cần bổ sung và khóa chứng từ nhiên liệu trong tình huống demo.", sourceSha256: activity.sourceSha256, evidenceSnapshot: evidence, createdAt: timestamp } : null,
  };
}

const inventory = (month: "08" | "09", revision: number, multiplier: number): InventoryView => {
  const activitySnapshot = [
    { scope: "scope1", facilityReference: "DEMO-STEEL-MELT", category: "Khí thiên nhiên lò thùng", calculatedCo2eKg: 2000 * multiplier },
    { scope: "scope2", accountingMethod: "location_based", facilityReference: "DEMO-FACTORY", category: "Điện", calculatedCo2eKg: 600 * multiplier },
    { scope: "scope2", accountingMethod: "location_based", facilityReference: "DEMO-STEEL-MELT", category: "Điện", calculatedCo2eKg: 3000 * multiplier },
    { scope: "scope2", accountingMethod: "location_based", facilityReference: "DEMO-COFFEE", category: "Điện", calculatedCo2eKg: 400 * multiplier },
    { scope: "scope3", facilityReference: "DEMO-COFFEE", category: "Vận chuyển đầu vào", calculatedCo2eKg: 500 * multiplier },
  ];
  return { id: id(month === "08" ? 60 : 60 + revision), inventoryReference: `DEMO-GHG-2026-${month}`, revision, reportingPeriodStart: `2026-${month}-01`, reportingPeriodEnd: `2026-${month}-${month === "08" ? "31" : "30"}`, inventoryStatus: "inventory_review_required", activitySnapshot, resultSha256: "demo-result-marker-not-a-verified-hash", result: {
    automatedStatus: "inventory_review_required", missingInputs: [], findings: [{ code: "DEMO_ONLY", severity: "warning", message: "Các số liệu và hệ số là giả định minh họa; chưa có thẩm tra độc lập.", path: null }], sources: [],
    totals: { scope1KgCo2e: 2000 * multiplier, scope2LocationBasedKgCo2e: 4000 * multiplier, scope2MarketBasedKgCo2e: null, scope3KgCo2e: 500 * multiplier, biogenicCo2Kg: 0, removalsCo2Kg: 0, offsetsRetiredKgCo2e: 0, grossScope1AndLocationScope2KgCo2e: 6000 * multiplier },
    activitySourceCount: activitySnapshot.length, evidenceCount: DEMO_EVIDENCE.length, inventoryScopeLabel: "Snapshot giả định · Scope 1, Scope 2 location-based và một phần Scope 3", assuranceStatus: "Chưa xác minh · tình huống demo", disclaimer: "Dữ liệu tổng hợp cho demo, không dùng làm báo cáo doanh nghiệp hoặc hồ sơ pháp lý. Không có chứng chỉ market-based trong tình huống này.", resultSha256: "demo-result-marker-not-a-verified-hash",
  } };
};
export const DEMO_INVENTORIES = [inventory("09", 1, 0.95), inventory("09", 2, 1), inventory("08", 1, 1.1)];

export const DEMO_CAPABILITIES: IndustrialCapabilityRegistry = {
  schemaId: "demo-industrial-capabilities", schemaVersion: "1", platformVersion: "DEMO", coverage: "baseline", updatedOn: "2026-09-30", manifestSha256: "demo-manifest-not-a-verified-hash",
  truthBoundary: "Registry tình huống tổng hợp, không phải đánh giá mức sẵn sàng hoặc tuân thủ của doanh nghiệp thật.",
  layers: [
    { id: "domestic-mrv", label: "MRV trong nước", status: "partial", evidence: ["Hai kỳ kiểm kê giả định"], nextGate: "Bổ sung kế hoạch đo và rà soát hồ sơ mô phỏng" },
    { id: "data-quality", label: "Chất lượng dữ liệu", status: "partial", evidence: ["Hoạt động L1–L3 và một chứng từ thiếu checksum"], nextGate: "Hoàn thiện chứng từ trong tình huống demo" },
    { id: "evidence", label: "Bằng chứng", status: "partial", evidence: ["Ba chứng từ mô phỏng, một chứng từ ở trạng thái khóa"], nextGate: "Rà soát hai chứng từ còn lại" },
    { id: "computation", label: "Tính toán", status: "implemented", evidence: ["Phân bổ phát thải giả định theo nguồn và cơ sở"], nextGate: "Thay hệ số demo bằng nguồn được rà soát trước khi dùng thực tế" },
    { id: "industry-rules", label: "Quy tắc ngành", status: "partial", nextGate: "Rà soát chuyên gia cho tình huống thép và nông sản" },
    { id: "export", label: "Yêu cầu xuất khẩu", status: "planned", nextGate: "Chưa có nghiệm thu hồ sơ hoặc nộp tới cơ quan tiếp nhận" },
  ],
  entities: [{ id: "facility", label: "Cơ sở", status: "implemented" }, { id: "process", label: "Quy trình", status: "implemented" }, { id: "activity", label: "Hoạt động", status: "implemented" }, { id: "target", label: "Yêu cầu đích", status: "planned" }],
};
