import { api } from "@/lib/apiClient";

export type IndustryPackId = "steel" | "cement" | "textile_apparel" | "aluminium" | "construction_materials" | "fertiliser_chemicals" | "mining_minerals";
export interface IndustryPackManifest {
  id: IndustryPackId; label: string; version: string; approvalStatus: string; processes: string[]; pilotProcesses: string[];
  requiredCategories: string[]; requiredFields: string[]; requiredContextFields: string[];
  contextFieldDescriptions: Record<string, string>; allocationPolicy: string; validationRules: string[];
  evidenceChecklist: string[]; targetMappings: string[]; disclaimer: string;
}
export interface IndustryPackPilot {
  id: string;
  facilityRevisionId?: string;
  processRevisionId?: string;
  studyReference: string;
  revision: number;
  packId: string;
  packVersion: string;
  packApprovalStatus: string;
  periodStart?: string;
  periodEnd?: string;
  inputSha256?: string;
  resultSha256: string;
  status: string;
  createdAt?: string;
  evidenceSnapshot?: Array<{ id: string; status: string; checksumSha256: string; fileSizeBytes: number; name?: string }>;
  result: {
    totals: { grossKgCo2e: number; grossTco2e: number; intensityKgCo2ePerTonne: number } | null;
    findings: Array<{ code: string; severity?: string; message?: string }>;
    lines?: Array<{ category?: string; sourceReference?: string; activityQuantity?: number; activityUnit?: string; calculatedTco2e?: number; factorLabel?: string; evidenceDocumentIds?: string[] }>;
    disclaimer: string;
  };
}
export const industryPacksApi = {
  manifests: () => api.get<IndustryPackManifest[]>("/industry-packs/manifests"),
  pilots: () => api.get<IndustryPackPilot[]>("/industry-packs/pilots"),
  createPilot: (input: Record<string, unknown>) => api.post<IndustryPackPilot>("/industry-packs/pilots", input)
};
