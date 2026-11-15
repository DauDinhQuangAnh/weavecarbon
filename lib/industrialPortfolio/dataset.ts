/* eslint-disable @typescript-eslint/no-explicit-any */
// Bộ dữ liệu danh mục carbon công nghiệp (đồng bộ từ bản Lovable).
// Đây là dữ liệu mẫu demo, chỉ đọc — không phải dữ liệu nộp chính thức.
import { industrialDatasetSnapshot } from "./snapshot";

export interface IndustrialDatasetState {
  loading: boolean;
  error: string | null;
  organization: { name: string; period: string; engineVersion: string };
  emissionsSummary: {
    totalTonnes: number;
    trendPct: number;
    scope1: number;
    scope2: number;
    scope3: number;
    dataQualityPct: number;
    readinessPct: number;
    openGaps: number;
    facilities: number;
    trackedProducts: number;
  };
  emissionsMonthly: Array<{ period: string; scope1: number; scope2: number; scope3: number }>;
  emissionsQuarterly: Array<{ period: string; scope1: number; scope2: number; scope3: number }>;
  emissionsBySource: Array<{ source: string; pct: number }>;
  facilities: any[];
  activityData: any[];
  processes: any[];
  products: any[];
  dataGaps: any[];
  hotspots: any[];
  dataSource?: 'snapshot';
}

export const EMPTY_INDUSTRIAL_PORTFOLIO: IndustrialDatasetState = {
  loading: true,
  error: null,
  organization: { name: 'Industrial dataset', period: '—', engineVersion: '2.2' },
  emissionsSummary: { totalTonnes: 0, trendPct: 0, scope1: 0, scope2: 0, scope3: 0, dataQualityPct: 0, readinessPct: 0, openGaps: 0, facilities: 0, trackedProducts: 0 },
  emissionsMonthly: [], emissionsQuarterly: [], emissionsBySource: [], facilities: [], activityData: [], processes: [], products: [], dataGaps: [], hotspots: [],
};

function buildState(raw: any, dataSource: 'snapshot'): IndustrialDatasetState {
  const facilityRowsRaw = raw.facilities ?? [];
  const facilityName = new Map(facilityRowsRaw.map((r: any) => [r.id, r.name]));

  const facilityRows = facilityRowsRaw.map((r: any) => ({
    id: r.id, name: r.name, industry: r.industry, completeness: Number(r.completeness), openGaps: Number(r.open_gaps ?? 0),
    tonnes: Number(r.emissions_tco2e), lat: r.latitude == null ? null : Number(r.latitude), lng: r.longitude == null ? null : Number(r.longitude),
  }));

  const activityRows = (raw.activity ?? []).map((r: any) => ({
    id: r.id, activity: r.activity,
    facility: r.industrial_facilities?.name ?? facilityName.get(r.facility_id) ?? 'Group-wide',
    process: r.process_name ?? '—', source: r.source, value: Number(r.value), unit: r.unit, period: r.period,
    quality: r.quality, evidence: Number(r.evidence_count ?? 0), status: r.status,
    factorKey: r.factor_key, biogenicFraction: Number(r.biogenic_fraction ?? 0), biogenicEvidenceStatus: r.biogenic_evidence_status,
  }));

  const processRows = (raw.processes ?? []).map((r: any) => ({
    id: r.id, name: r.name, facility: r.industrial_facilities?.name ?? facilityName.get(r.facility_id) ?? '—',
    tonnes: Number(r.emissions_tco2e), impact: r.impact, input: r.input_summary, energy: r.energy_summary,
    output: r.output_summary, intensity: r.intensity,
  }));

  const productRows = (raw.products ?? []).map((r: any) => ({
    id: r.id, name: r.name, industry: r.industry, facility: r.industrial_facilities?.name ?? facilityName.get(r.facility_id) ?? '—',
    intensity: r.intensity, quality: Number(r.quality), readiness: r.readiness,
  }));

  const gapRows = (raw.gaps ?? []).map((r: any) => ({
    id: r.id, issue: r.issue, entity: r.entity, impact: r.impact, action: r.recommended_action, owner: r.owner, due: r.due_label,
  }));

  const hotspotRows = (raw.hotspots ?? []).map((r: any) => ({
    id: r.id, entity: r.entity, type: r.entity_type, facility: r.facility, tonnes: Number(r.emissions_tco2e), pct: Number(r.share_pct),
  }));

  const monthly = (raw.series ?? []).filter((r: any) => r.granularity === 'monthly').map((r: any) => ({
    period: r.period, scope1: Number(r.scope1_tco2e), scope2: Number(r.scope2_tco2e), scope3: Number(r.scope3_tco2e),
  }));

  const quarterly = (raw.series ?? []).filter((r: any) => r.granularity === 'quarterly').map((r: any) => ({
    period: r.period, scope1: Number(r.scope1_tco2e), scope2: Number(r.scope2_tco2e), scope3: Number(r.scope3_tco2e),
  }));

  const bySource = (raw.sources ?? []).map((r: any) => ({ source: r.source, pct: Number(r.share_pct) }));

  const totalTonnes = facilityRows.reduce((s: number, f: any) => s + f.tonnes, 0);
  const openGaps = facilityRows.reduce((s: number, f: any) => s + f.openGaps, 0);
  const avgCompleteness = facilityRows.length ? Math.round(facilityRows.reduce((s: number, f: any) => s + f.completeness, 0) / facilityRows.length) : 0;
  const scope1 = monthly.reduce((s: number, r: any) => s + r.scope1, 0);
  const scope2 = monthly.reduce((s: number, r: any) => s + r.scope2, 0);
  const scope3 = monthly.reduce((s: number, r: any) => s + r.scope3, 0);
  const last = monthly.at(-1);
  const previous = monthly.at(-2);
  const lastTotal = last ? last.scope1 + last.scope2 + last.scope3 : 0;
  const previousTotal = previous ? previous.scope1 + previous.scope2 + previous.scope3 : 0;
  const trendPct = previousTotal ? Number((((lastTotal - previousTotal) / previousTotal) * 100).toFixed(1)) : 0;
  const qualityWeighted = activityRows.length
    ? Math.round(activityRows.reduce((sum: number, row: any) => sum + (row.quality === 'Primary' ? 100 : row.quality === 'Evidence-backed' ? 85 : row.quality === 'Self-reported' ? 60 : 35), 0) / activityRows.length)
    : avgCompleteness;
  const readinessPct = Math.max(0, Math.min(100, Math.round(avgCompleteness * 0.6 + qualityWeighted * 0.4 - openGaps * 0.5)));

  return {
    loading: false,
    error: null,
    dataSource,
    organization: {
      name: raw.dataset?.name ?? 'Vietnam Industrial Group',
      period: raw.dataset?.reporting_period ?? 'Jan-Aug 2026',
      engineVersion: raw.dataset?.engine_version ?? '2.2',
    },
    emissionsSummary: {
      totalTonnes, trendPct, scope1, scope2, scope3,
      dataQualityPct: qualityWeighted, readinessPct, openGaps,
      facilities: facilityRows.length, trackedProducts: productRows.length,
    },
    emissionsMonthly: monthly,
    emissionsQuarterly: quarterly,
    emissionsBySource: bySource,
    facilities: facilityRows,
    activityData: activityRows,
    processes: processRows,
    products: productRows,
    dataGaps: gapRows,
    hotspots: hotspotRows,
  };
}


let cached: IndustrialDatasetState | null = null;

/** Trả về bộ dữ liệu công nghiệp mẫu đã chuẩn hoá (đồng bộ, không gọi mạng). */
export function getIndustrialPortfolio(): IndustrialDatasetState {
  if (!cached) cached = buildState(industrialDatasetSnapshot, "snapshot");
  return cached;
}
