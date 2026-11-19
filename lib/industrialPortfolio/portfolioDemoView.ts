// Bộ dữ liệu mẫu cho /demo — tách riêng để chỉ được tải (import động) khi đang ở chế độ demo.
import { getIndustrialPortfolio } from "./dataset";
import { getIndustrialReporting, pivotIndustryCadence } from "./reporting";
import { averageEvidence, countMarkets, type PortfolioProductRow, type PortfolioSeverity, type PortfolioView } from "./portfolioView";

const DEMO_INDUSTRIES = ["Steel", "Cement", "Aluminium", "Chemicals", "Agriculture", "Construction Materials", "Mining & Minerals"] as const;
const INDUSTRY_VI: Record<string, string> = {
  Steel: "Thép", Cement: "Xi măng", Aluminium: "Nhôm", Chemicals: "Hoá chất", Agriculture: "Nông nghiệp",
  "Construction Materials": "Vật liệu xây dựng", "Mining & Minerals": "Khai khoáng",
};
/** Bộ dữ liệu mẫu cho /demo — giữ nguyên số liệu đang hiển thị. */
export function buildDemoPortfolioView(): PortfolioView {
  const core = getIndustrialPortfolio();
  const reporting = getIndustrialReporting();
  const severity = (impact: string): PortfolioSeverity => (impact === "High" ? "critical" : impact === "Medium" ? "warning" : "info");
  const products: PortfolioProductRow[] = reporting.products.map((p) => ({
    id: p.id, name: p.name, industry: p.industry, productCode: p.productCode, cnCode: p.cnCode,
    marketScope: p.marketScope, intensity: p.intensity, reportTargets: p.reportTargets, evidenceCount: p.evidenceCount,
  }));
  return {
    mode: "demo",
    engineVersion: core.organization.engineVersion,
    facilitiesCount: core.emissionsSummary.facilities,
    period: core.organization.period,
    totalTonnes: core.emissionsSummary.totalTonnes,
    coverage: { value: core.facilities.length, label: "Độ phủ ngành", subtext: "Số ngành được đại diện" },
    ...countMarkets(products),
    avgEvidence: averageEvidence(products),
    reportProfilesCount: reporting.reportProfiles.length,
    cadence: {
      rows: pivotIndustryCadence(reporting.cadence),
      series: DEMO_INDUSTRIES.map((key) => ({ key, label: INDUSTRY_VI[key] ?? key })),
    },
    emissionsMonthly: core.emissionsMonthly,
    emissionsQuarterly: core.emissionsQuarterly,
    emissionsBySource: core.emissionsBySource,
    products,
    evidence: reporting.evidence.map((d) => ({
      id: d.id, fileName: d.fileName, documentType: d.documentType, linkedActivity: d.linkedActivity, evidenceLevel: d.evidenceLevel,
    })),
    hotspots: core.hotspots.map((h: { id?: string; entity: string; type: string; facility: string; tonnes: number; pct: number }) => ({
      id: h.id ?? h.entity, entity: h.entity, type: h.type, facility: h.facility, tonnes: h.tonnes, pct: h.pct,
    })),
    alerts: core.dataGaps.slice(0, 4).map((g: { id: string; impact: string; issue: string; entity: string }) => ({
      id: g.id, severity: severity(g.impact), text: g.issue, entity: g.entity,
    })),
    hasInventory: true,
  };
}
