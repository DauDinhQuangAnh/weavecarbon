import { api } from "@/lib/apiClient";

export interface MitigationInitiative { id:string;facilityRevisionId:string;facilityName?:string;initiativeReference:string;revision:number;title:string;lifecycleStatus:string;ownerName:string;baselineYear:number;targetReductionTco2e:number;initiativeSha256:string; }
export interface MitigationScenario { id:string;initiativeId:string;initiativeReference?:string;scenarioReference:string;revision:number;scenarioType:string;baselineEmissionsTco2e:number;projectedEmissionsTco2e:number;expectedReductionTco2e:number;scenarioSha256:string; }
export interface AllowanceAllocation { id:string;facilityRevisionId:string;facilityName?:string;allocationReference:string;revision:number;reportingYear:number;instrumentType:string;recordStatus:string;quantityTco2e:number;allocationSha256:string; }
export interface AllowancePosition { id:string;facilityRevisionId:string;corporateInventoryId:string;reportingYear:number;grossEmissionsTco2e:number;authorityQuotaTco2e:number;internalBudgetTco2e:number;creditReferenceTco2e:number;plannedReductionTco2e:number;projectedPositionTco2e:number;readinessStatus:string;blockers:string[];payloadSha256:string;disclaimer:string; }

export const mitigationOperationsApi={
  initiatives:()=>api.get<MitigationInitiative[]>("/mitigation-operations/initiatives"),
  createInitiative:(value:Record<string,unknown>)=>api.post<MitigationInitiative>("/mitigation-operations/initiatives",value),
  scenarios:()=>api.get<MitigationScenario[]>("/mitigation-operations/scenarios"),
  createScenario:(value:Record<string,unknown>)=>api.post<MitigationScenario>("/mitigation-operations/scenarios",value),
  allocations:()=>api.get<AllowanceAllocation[]>("/mitigation-operations/allocations"),
  createAllocation:(value:Record<string,unknown>)=>api.post<AllowanceAllocation>("/mitigation-operations/allocations",value),
  positions:()=>api.get<AllowancePosition[]>("/mitigation-operations/positions"),
  createPosition:(value:Record<string,unknown>)=>api.post<AllowancePosition>("/mitigation-operations/positions",value)
};
