/* eslint-disable @typescript-eslint/no-explicit-any */
// Dữ liệu báo cáo theo ngành/thị trường cho danh mục công nghiệp mẫu (bản offline của Lovable).
import { industrialDatasetSnapshot } from "./snapshot";
import { demoReportingEvidence, demoReportingProducts, demoReportProfiles } from "./reportingDemo";


export interface IndustryCadenceRow {
  periodDate: string;
  periodLabel: string;
  industry: string;
  emissionsTco2e: number;
  productionIndex: number;
  evidenceCoveragePct: number;
  primaryDataPct: number;
}

export interface IndustrialEvidenceRow {
  id: string;
  facilityId: string | null;
  productId: string | null;
  documentType: string;
  fileName: string;
  period: string;
  issuer: string | null;
  status: string;
  evidenceLevel: string;
  linkedActivity: string | null;
  linkedReportTargets: string[];
  integrityHash: string | null;
  notes: string | null;
}

export interface IndustrialProductMarketRow {
  id: string;
  name: string;
  industry: string;
  productCode: string | null;
  marketScope: string;
  destinationMarket: string | null;
  cnCode: string | null;
  reportTargets: string[];
  evidenceCount: number;
  readiness: string;
  quality: number;
  intensity: string | null;
  facilityName: string;
}

export interface ReportProfileRow {
  profileCode: string;
  profileName: string;
  marketGroup: string;
  frameworkFamily: string;
  scopeLevel: string;
  applicableIndustries: string[];
  requiredDataGroups: string[];
  outputName: string;
  status: string;
  reference: string | null;
  notes: string | null;
}

export interface IndustrialReportingState {
  loading: boolean;
  error: string | null;
  cadence: IndustryCadenceRow[];
  evidence: IndustrialEvidenceRow[];
  products: IndustrialProductMarketRow[];
  reportProfiles: ReportProfileRow[];
}


const months = [
  ['2026-01-01','Jan 2026'],['2026-02-01','Feb 2026'],['2026-03-01','Mar 2026'],['2026-04-01','Apr 2026'],
  ['2026-05-01','May 2026'],['2026-06-01','Jun 2026'],['2026-07-01','Jul 2026'],['2026-08-01','Aug 2026'],
] as const;
const cadenceValues: Record<string, number[]> = {
  Agriculture:[457.7,437.8,487.6,502.5,517.5,527.4,537.4,512.5],
  Steel:[762.4,746.3,786.5,802.5,826.6,834.6,842.6,818.6],
  Cement:[395.0,403.7,430.1,447.6,460.8,465.2,456.4,452.0],
  'Construction Materials':[143.8,150.5,158.9,167.3,180.6,184.0,187.3,179.0],
  Aluminium:[334.9,327.8,349.1,356.2,363.4,370.5,377.6,370.5],
  Chemicals:[283.0,280.1,288.8,291.6,294.5,288.8,291.6,291.6],
  'Mining & Minerals':[182.7,189.0,201.4,209.7,222.2,226.4,228.4,220.2],
};

const fallbackCadence: IndustryCadenceRow[] = Object.entries(cadenceValues).flatMap(([industry, values]) =>
  values.map((emissionsTco2e, index) => ({
    periodDate: months[index][0], periodLabel: months[index][1], industry, emissionsTco2e,
    productionIndex: 100, evidenceCoveragePct: 80, primaryDataPct: 70,
  }))
);

const facilityName = new Map(industrialDatasetSnapshot.facilities.map((f) => [f.id, f.name]));

const fallbackProducts: IndustrialProductMarketRow[] = demoReportingProducts.map((p) => ({
  id:p.id,
  name:p.name,
  industry:p.industry,
  productCode:p.productCode,
  marketScope:p.marketScope,
  destinationMarket:p.destinationMarket,
  cnCode:p.cnCode,
  reportTargets:[...p.reportTargets],
  evidenceCount:p.evidenceCount,
  readiness:p.readiness,
  quality:Number(p.quality ?? 0),
  intensity:p.intensity,
  facilityName:facilityName.get(p.facilityId as any) ?? '—',
}));

const fallbackEvidence: IndustrialEvidenceRow[] = demoReportingEvidence.map((e) => ({ ...e, linkedReportTargets:[...e.linkedReportTargets] }));
const fallbackProfiles: ReportProfileRow[] = demoReportProfiles.map((p) => ({ ...p, applicableIndustries:[...p.applicableIndustries], requiredDataGroups:[...p.requiredDataGroups] }));


/** Dữ liệu báo cáo mẫu (offline) cho danh mục công nghiệp. */
export function getIndustrialReporting(): IndustrialReportingState {
  return { loading: false, error: null, cadence: fallbackCadence, evidence: fallbackEvidence, products: fallbackProducts, reportProfiles: fallbackProfiles };
}

export function pivotIndustryCadence(rows: IndustryCadenceRow[]) {
  const map = new Map<string, Record<string, string | number>>();
  for (const row of rows) {
    const current = map.get(row.periodDate) ?? { periodDate: row.periodDate, period: row.periodLabel };
    current[row.industry] = row.emissionsTco2e;
    map.set(row.periodDate, current);
  }
  return Array.from(map.values()).sort((a, b) => String(a.periodDate).localeCompare(String(b.periodDate)));
}
