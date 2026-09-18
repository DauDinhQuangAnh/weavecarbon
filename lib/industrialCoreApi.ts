import { api } from "@/lib/apiClient";

export type CapabilityStatus = "implemented" | "partial" | "planned";

export interface IndustrialCapabilityItem {
  id: string;
  label?: string;
  status: CapabilityStatus;
  evidence?: string[];
  nextGate?: string;
}

export interface IndustrialCapabilityRegistry {
  schemaId: string;
  schemaVersion: string;
  platformVersion: string;
  coverage: "baseline";
  updatedOn: string;
  truthBoundary: string;
  manifestSha256: string;
  layers: IndustrialCapabilityItem[];
  entities: IndustrialCapabilityItem[];
}

export interface IndustrialFacility {
  id: string;
  facilityReference: string;
  revision: number;
  name: string;
  countryCode: string;
  timezone: string;
  lifecycleStatus: "planned" | "active" | "inactive";
  boundaryNotes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateIndustrialFacilityInput {
  facilityReference: string;
  name: string;
  countryCode: string;
  timezone: string;
  lifecycleStatus: "planned" | "active" | "inactive";
  boundaryNotes?: string;
}

export interface IndustrialProcess {
  id: string; facilityRevisionId: string; facilityReference?: string; processReference: string;
  revision: number; name: string; processType: string; lifecycleStatus: "planned" | "active" | "inactive"; createdAt: string;
}

export interface IndustrialMeasurementPoint {
  id: string; facilityRevisionId: string; facilityReference?: string; processRevisionId: string | null;
  measurementPointReference: string; revision: number; measurementType: string; canonicalUnit: string;
  sourceType: "meter" | "plc" | "sensor" | "weavenode" | "manual" | "api";
  calibrationStatus: "unknown" | "current" | "expired" | "not_applicable"; createdAt: string;
}

export interface IndustrialActivity {
  id: string; activityReference: string; facilityRevisionId: string; facilityReference?: string; facilityName?: string;
  processRevisionId?: string | null;
  activityType: string; periodStart: string; periodEnd: string; quantity: number; canonicalUnit: string;
  sourceKind: string; dataQualityLevel: "L1" | "L2" | "L3" | "L4" | "L5"; sourceSha256: string;
}

export type AllocationLevel = "facility" | "process" | "batch" | "product";
export type AllocationMethod = "mass" | "energy" | "output" | "machine_hour" | "economic" | "custom_driver";

export interface DynamicAllocationRule {
  id: string; facilityRevisionId: string; facilityReference?: string; facilityName?: string;
  allocationReference: string; revision: number; sourceLevel: Exclude<AllocationLevel, "product">;
  targetLevel: Exclude<AllocationLevel, "facility">; allocationMethod: AllocationMethod; driverUnit: string;
  methodologyReference: string; methodologyVersion: string; rationale: string;
  approvalStatus: "draft" | "approved"; evidenceDocumentId: string | null; ruleSha256: string; createdAt: string;
}

export interface DynamicAllocationLine {
  id: string; lineNumber: number; targetLevel: Exclude<AllocationLevel, "facility">; targetEntityId: string;
  targetReference: string; driverValue: number; driverUnit: string; allocationShare: number;
  allocatedQuantity: number; canonicalUnit: string; lineSha256: string;
}

export interface DynamicAllocationRun {
  id: string; facilityRevisionId: string; ruleRevisionId: string; allocationReference: string; ruleRevision: number;
  sourceLevel: Exclude<AllocationLevel, "product">; targetLevel: Exclude<AllocationLevel, "facility">;
  allocationMethod: AllocationMethod; sourceKind: "activity" | "allocation_line";
  sourceActivityId: string | null; sourceAllocationLineId: string | null; sourceQuantity: number; sourceUnit: string;
  driverTotal: number; allocatedQuantity: number; reconciliationDifference: number;
  reconciliationStatus: "reconciled"; payloadSha256: string; lines: DynamicAllocationLine[]; createdAt: string; disclaimer: string;
}

export const INDUSTRIAL_CORE_DEMO_REGISTRY: IndustrialCapabilityRegistry = {
  schemaId: "weavecarbon.industrial-core-capabilities",
  schemaVersion: "1.0.0",
  platformVersion: "G2-INDUSTRIAL-CORE-2026.09.18.9",
  coverage: "baseline",
  updatedOn: "2026-09-18",
  truthBoundary: "Chỉ năng lực được đánh dấu implemented mới đang vận hành. Năng lực partial và planned không được trình bày như đã hoàn thiện cho môi trường production.",
  manifestSha256: "demo-read-only-manifest",
  layers: [
    { id: "ingestion", label: "Data ingestion", status: "partial", nextGate: "Real gateway/network soak, mTLS/key custody, signed OTA rollback and site calibration acceptance" },
    { id: "ai-assisted-ingestion", label: "AI and OCR human-in-the-loop", status: "implemented", evidence: ["OCR field suggestions", "checksum-bound named human review", "deterministic semantic mapping", "anomaly/evidence-match decisions", "separate named activity promotion", "factor/calculation-field exclusion"], nextGate: "Representative-document accuracy evaluation, model/version acceptance and real-facility human workflow pilot" },
    { id: "semantic", label: "Semantic harmonization", status: "implemented", nextGate: "extend taxonomy through industry packs" },
    { id: "evidence", label: "Evidence and provenance", status: "implemented", nextGate: "activity-level review workflow" },
    { id: "computation", label: "Carbon computation and allocation", status: "implemented", nextGate: "real-facility allocation reproducibility pilot and domestic-to-export adapter binding" },
    { id: "domestic-mrv", label: "Domestic GHG and MRV operations", status: "implemented", nextGate: "specialist pilots and authority-channel integration" },
    { id: "export", label: "Export and traceability adapters", status: "implemented", nextGate: "canonical-record adapter mapping" },
    { id: "data-quality", label: "Data quality and factor governance", status: "implemented", nextGate: "apply DQL gates to domestic MRV filing packs" },
    { id: "mitigation-allowance", label: "Mitigation and allowance operations", status: "implemented", nextGate: "specialist pilot and registry reconciliation connector" },
    { id: "industry-rules", label: "Industry packs", status: "partial", nextGate: "independent sector-expert approval and real-facility pilots for every pack" },
    { id: "decision-intelligence", label: "Climate risk and decision intelligence", status: "partial", nextGate: "Licensed dataset ingestion, calibrated hazard metrics, climate-specialist validation and real facility/supplier acceptance pilots" },
    { id: "enterprise-security", label: "Enterprise security and production acceptance", status: "partial", nextGate: "External IdP interoperability acceptance, live production release evidence, penetration test and incident exercise" }
  ],
  entities: ["organization", "facility", "supplier", "material", "product", "batch-lot", "process", "activity", "emission-source", "resource-energy", "transport", "evidence", "meter-device", "emission-factor", "methodology", "calculation-line", "allowance-credit-reference", "mitigation-initiative", "review-verification", "target-requirement"].map((id) => ({
    id,
    status: (["organization", "facility", "supplier", "material", "product", "batch-lot", "process", "activity", "transport", "evidence", "meter-device", "emission-factor", "calculation-line", "review-verification"].includes(id)
      ? "implemented" : ["allowance-credit-reference", "mitigation-initiative"].includes(id) ? "implemented" : ["target-requirement"].includes(id) ? "planned" : "partial") as CapabilityStatus
  }))
};

export const industrialCoreApi = {
  capabilities: () => api.get<IndustrialCapabilityRegistry>("/industrial-core/capabilities"),
  facilities: () => api.get<IndustrialFacility[]>("/industrial-core/facilities"),
  createFacility: (input: CreateIndustrialFacilityInput) =>
    api.post<IndustrialFacility>("/industrial-core/facilities", input),
  processes: () => api.get<IndustrialProcess[]>("/industrial-core/processes"),
  createProcess: (input: { facilityRevisionId: string; processReference: string; name: string; processType: string; lifecycleStatus: "active" }) =>
    api.post<IndustrialProcess>("/industrial-core/processes", input),
  measurementPoints: () => api.get<IndustrialMeasurementPoint[]>("/industrial-core/measurement-points"),
  createMeasurementPoint: (input: { facilityRevisionId: string; processRevisionId?: string; measurementPointReference: string; measurementType: string; canonicalUnit: string; sourceType: "meter" | "plc" | "sensor" | "weavenode" | "manual" | "api" }) =>
    api.post<IndustrialMeasurementPoint>("/industrial-core/measurement-points", input),
  activities: () => api.get<IndustrialActivity[]>("/industrial-core/activities?limit=100"),
  activityLineage: (activityId: string) => api.get<unknown>(`/industrial-core/activities/${encodeURIComponent(activityId)}/lineage`),
  allocationRules: () => api.get<DynamicAllocationRule[]>("/dynamic-allocation/rules"),
  createAllocationRule: (input: {
    allocationReference: string; facilityRevisionId: string; sourceLevel: Exclude<AllocationLevel, "product">;
    targetLevel: Exclude<AllocationLevel, "facility">; allocationMethod: AllocationMethod; driverUnit: string;
    methodologyReference: string; methodologyVersion: string; rationale: string;
    approvalStatus: "draft" | "approved"; evidenceDocumentId?: string;
  }) => api.post<DynamicAllocationRule>("/dynamic-allocation/rules", input),
  allocationRuns: () => api.get<DynamicAllocationRun[]>("/dynamic-allocation/runs?limit=100"),
  createAllocationRun: (input: {
    ruleRevisionId: string; sourceActivityId?: string; sourceAllocationLineId?: string;
    targets: Array<{ targetEntityId: string; driverValue: number }>;
  }) => api.post<DynamicAllocationRun>("/dynamic-allocation/runs", input)
};
