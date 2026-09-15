import { api } from "@/lib/apiClient";

export interface DqlAssessment {
  id: string; subjectType: string; subjectReference: string; methodologyVersion: string;
  overallScore: number; dataQualityLevel: string; completenessPercent: number; rationale: string; createdAt: string;
}
export interface FactorProposal {
  id: string; proposalReference: string; revision: number; factorId: string; label: string;
  factorValue: number; unit: string; sourceName: string; geography: string; governanceStatus: string; createdAt: string;
}
export const dataGovernanceApi = {
  dql: () => api.get<DqlAssessment[]>("/data-governance/dql-assessments"),
  createDql: (input: Record<string, unknown>) => api.post<DqlAssessment>("/data-governance/dql-assessments", input),
  factorProposals: () => api.get<FactorProposal[]>("/data-governance/factor-proposals"),
  createFactorProposal: (input: Record<string, unknown>) => api.post<FactorProposal>("/data-governance/factor-proposals", input)
};
