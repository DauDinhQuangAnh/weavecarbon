import { api } from "@/lib/apiClient";

export interface IndustryPackManifest { id: "steel" | "cement"; version: string; approvalStatus: string; processes: string[]; pilotProcesses: string[]; requiredCategories: string[]; requiredFields: string[]; evidenceChecklist: string[]; targetMappings: string[]; disclaimer: string; }
export interface IndustryPackPilot { id: string; studyReference: string; revision: number; packId: string; packVersion: string; packApprovalStatus: string; status: string; result: { totals: { grossKgCo2e: number; grossTco2e: number; intensityKgCo2ePerTonne: number } | null; findings: Array<{ code: string }>; disclaimer: string }; resultSha256: string; }
export const industryPacksApi = {
  manifests: () => api.get<IndustryPackManifest[]>("/industry-packs/manifests"),
  pilots: () => api.get<IndustryPackPilot[]>("/industry-packs/pilots"),
  createPilot: (input: Record<string, unknown>) => api.post<IndustryPackPilot>("/industry-packs/pilots", input)
};
