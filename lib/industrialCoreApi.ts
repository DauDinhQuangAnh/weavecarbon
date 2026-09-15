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

export const INDUSTRIAL_CORE_DEMO_REGISTRY: IndustrialCapabilityRegistry = {
  schemaId: "weavecarbon.industrial-core-capabilities",
  schemaVersion: "1.0.0",
  platformVersion: "G2-INDUSTRIAL-CORE-2026.09.15.1",
  coverage: "baseline",
  updatedOn: "2026-09-15",
  truthBoundary: "Chỉ năng lực được đánh dấu implemented mới đang vận hành. Năng lực partial và planned không được trình bày như đã hoàn thiện cho môi trường production.",
  manifestSha256: "demo-read-only-manifest",
  layers: [
    { id: "ingestion", label: "Data ingestion", status: "partial", nextGate: "WeaveNode and governed connector contracts" },
    { id: "semantic", label: "Semantic harmonization", status: "partial", nextGate: "unit and taxonomy registry" },
    { id: "evidence", label: "Evidence and provenance", status: "implemented", nextGate: "activity-level review workflow" },
    { id: "computation", label: "Carbon computation", status: "implemented", nextGate: "process allocation engine" },
    { id: "domestic-mrv", label: "Domestic GHG and MRV operations", status: "partial", nextGate: "measurement plan and review lifecycle" },
    { id: "export", label: "Export and traceability adapters", status: "implemented", nextGate: "canonical-record adapter mapping" },
    { id: "data-quality", label: "Data quality and factor governance", status: "partial", nextGate: "system-wide DQL scoring and approval" },
    { id: "industry-rules", label: "Industry packs", status: "planned", nextGate: "steel and cement rule packs" },
    { id: "decision-intelligence", label: "Climate risk and decision intelligence", status: "planned", nextGate: "physical risk data and scenario model" }
  ],
  entities: ["organization", "facility", "supplier", "material", "product", "batch-lot", "process", "activity", "emission-source", "resource-energy", "transport", "evidence", "meter-device", "emission-factor", "methodology", "calculation-line", "allowance-credit-reference", "mitigation-initiative", "review-verification", "target-requirement"].map((id) => ({
    id,
    status: (["organization", "supplier", "material", "product", "batch-lot", "transport", "evidence", "emission-factor", "calculation-line"].includes(id)
      ? "implemented" : ["allowance-credit-reference", "mitigation-initiative", "target-requirement"].includes(id) ? "planned" : "partial") as CapabilityStatus
  }))
};

export const industrialCoreApi = {
  capabilities: () => api.get<IndustrialCapabilityRegistry>("/industrial-core/capabilities"),
  facilities: () => api.get<IndustrialFacility[]>("/industrial-core/facilities"),
  createFacility: (input: CreateIndustrialFacilityInput) =>
    api.post<IndustrialFacility>("/industrial-core/facilities", input)
};
