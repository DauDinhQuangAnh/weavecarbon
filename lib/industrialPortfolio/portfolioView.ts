// View-model chung cho mục "Danh mục carbon công nghiệp" ở trang Tổng quan.
// Demo và tài khoản thật dùng cùng một giao diện; chỉ khác nguồn dữ liệu:
// - demo: bộ dữ liệu công nghiệp mẫu (chỉ đọc, có nhãn rõ ràng);
// - tài khoản thật: kiểm kê GHG, cơ sở, dữ liệu hoạt động, bằng chứng và sản phẩm từ API.
// Không trộn dữ liệu mẫu vào số liệu thật.
import type { CorporateGhgInventory } from "@/lib/weave-v2/corporateGhgInventoryApi";
import type { IndustrialActivity, IndustrialFacility } from "@/lib/industrialCoreApi";
import type { EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";
import type { FactorProposal } from "@/lib/dataGovernanceApi";
import type { ProductRecord } from "@/lib/products/types";
import { evaluateCbamApplicability } from "@/lib/cbam/applicability";

export type PortfolioSeverity = "critical" | "warning" | "info";
export interface PortfolioScopePoint { period: string; scope1: number; scope2: number; scope3: number }
export interface PortfolioProductRow {
  id: string; name: string; industry: string; productCode: string | null; cnCode: string | null;
  marketScope: "domestic" | "export" | "dual" | string; intensity: string | null; reportTargets: string[]; evidenceCount: number;
}
export interface PortfolioEvidenceRow { id: string; fileName: string; documentType: string; linkedActivity: string | null; evidenceLevel: string }
export interface PortfolioHotspotRow { id: string; entity: string; type: string; facility: string; tonnes: number; pct: number }
export interface PortfolioAlertRow { id: string; severity: PortfolioSeverity; text: string; entity: string }
export interface PortfolioView {
  mode: "demo" | "real";
  engineVersion: string;
  facilitiesCount: number;
  period: string;
  totalTonnes: number;
  coverage: { value: number; label: string; subtext: string };
  domesticProducts: number;
  exportProducts: number;
  dualProducts: number;
  avgEvidence: number;
  reportProfilesCount: number;
  cadence: { rows: Array<Record<string, string | number>>; series: Array<{ key: string; label: string }> };
  emissionsMonthly: PortfolioScopePoint[];
  emissionsQuarterly: PortfolioScopePoint[];
  emissionsBySource: Array<{ source: string; pct: number }>;
  products: PortfolioProductRow[];
  evidence: PortfolioEvidenceRow[];
  hotspots: PortfolioHotspotRow[];
  alerts: PortfolioAlertRow[];
  hasInventory: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const finite = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) ? n : 0);

export function countMarkets(products: Array<{ marketScope: string }>) {
  return {
    domesticProducts: products.filter((p) => p.marketScope === "domestic").length,
    dualProducts: products.filter((p) => p.marketScope === "dual").length,
    exportProducts: products.filter((p) => p.marketScope === "export").length,
  };
}
export function averageEvidence(products: Array<{ evidenceCount: number }>) {
  return products.length ? Math.round(products.reduce((s, p) => s + p.evidenceCount, 0) / products.length) : 0;
}

export interface RealPortfolioInput {
  inventories: CorporateGhgInventory[];
  facilities: IndustrialFacility[];
  activities: IndustrialActivity[];
  evidence: EvidenceDocumentV2[];
  products: ProductRecord[];
  factors: FactorProposal[];
}

type SnapshotRow = { scope?: unknown; facilityReference?: unknown; category?: unknown; accountingMethod?: unknown; calculatedCo2eKg?: unknown };

/** Các dòng nguồn được cộng vào kiểm kê: Scope 2 chỉ lấy location-based (không cộng hai phương pháp). */
function countableRows(inventory: CorporateGhgInventory) {
  return (inventory.activitySnapshot || []).filter((raw) => {
    const row = raw as SnapshotRow;
    if (!["scope1", "scope2", "scope3"].includes(String(row.scope))) return false;
    if (row.scope === "scope2" && row.accountingMethod !== "location_based") return false;
    const kg = row.calculatedCo2eKg;
    return typeof kg === "number" && Number.isFinite(kg) && kg >= 0;
  }) as Array<SnapshotRow & { calculatedCo2eKg: number }>;
}

/** Tổng theo Scope (tấn) của một bản kiểm kê; ưu tiên tổng do engine trả về. */
export function inventoryScopeTonnes(inventory: CorporateGhgInventory) {
  const totals = inventory.result?.totals;
  if (totals) {
    return {
      scope1: finite(totals.scope1KgCo2e) / 1000,
      scope2: finite(totals.scope2LocationBasedKgCo2e) / 1000,
      scope3: finite(totals.scope3KgCo2e) / 1000,
    };
  }
  const sums = { scope1: 0, scope2: 0, scope3: 0 };
  countableRows(inventory).forEach((row) => { sums[row.scope as keyof typeof sums] += row.calculatedCo2eKg / 1000; });
  return sums;
}

/** Giữ revision mới nhất của mỗi bản kiểm kê (bỏ bản đã bị thay thế), sắp theo kỳ tăng dần. */
export function latestInventories(rows: CorporateGhgInventory[]) {
  const latest = new Map<string, CorporateGhgInventory>();
  rows.forEach((row) => {
    if (row.inventoryStatus === "superseded" || row.inventoryStatus === "rejected") return;
    const current = latest.get(row.inventoryReference);
    if (!current || current.revision < row.revision) latest.set(row.inventoryReference, row);
  });
  return [...latest.values()].sort((a, b) => String(a.reportingPeriodEnd).localeCompare(String(b.reportingPeriodEnd)));
}

const monthLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};
const quarterLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
};
const dateLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("vi-VN", { timeZone: "UTC" });
};

function scopeSeries(inventories: CorporateGhgInventory[], label: (iso: string) => string): PortfolioScopePoint[] {
  const map = new Map<string, PortfolioScopePoint>();
  inventories.forEach((inv) => {
    const key = label(inv.reportingPeriodEnd);
    const t = inventoryScopeTonnes(inv);
    const point = map.get(key) ?? { period: key, scope1: 0, scope2: 0, scope3: 0 };
    point.scope1 = round1(point.scope1 + t.scope1);
    point.scope2 = round1(point.scope2 + t.scope2);
    point.scope3 = round1(point.scope3 + t.scope3);
    map.set(key, point);
  });
  return [...map.values()];
}

const INDUSTRY_KEYS = ["industry", "industryCode", "industry_code", "sector", "industryPack", "industry_pack"];
function facilityIndustry(facility: IndustrialFacility): string | null {
  const meta = facility.metadata || {};
  for (const key of INDUSTRY_KEYS) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function isDomesticMarket(value: string) {
  return !value || /^(vn|vnm|viet ?nam|việt ?nam|domestic|nội ?địa|noi ?dia)$/i.test(value.trim());
}

function productTargets(product: ProductRecord, exportBound: boolean) {
  const targets: string[] = [];
  const market = (product.destinationMarket || "").trim().toUpperCase();
  if (product.carbonResults?.perProduct || product.carbonAuthority) targets.push("PCF · ISO 14067");
  if (!exportBound) targets.push("Kiểm kê KNK Việt Nam");
  if (/^(EU|EUR|DE|FR|IT|NL|ES|PL|BE|SE|DK|FI|AT|IE|PT|CZ|SK|HU|RO|BG|HR|SI|GR|LT|LV|EE|LU|MT|CY)/.test(market)) {
    targets.push("EU ESPR · DPP");
    if (evaluateCbamApplicability(product.cnCode || product.hsCode) === "REVIEW_ANNEX_I_MATCH") targets.push("EU CBAM (sàng lọc)");
  } else if (exportBound && market) {
    targets.push(`Yêu cầu buyer · ${market}`);
  }
  return targets;
}

const EVIDENCE_LEVEL: Record<string, string> = {
  locked: "Đã khoá", third_party_verified: "Bên thứ ba xác minh", uploaded: "Đã tải lên",
};

/** Danh mục công nghiệp tính từ dữ liệu thật của doanh nghiệp. */
export function buildRealPortfolioView(input: RealPortfolioInput): PortfolioView {
  const inventories = latestInventories(input.inventories || []);
  const latest = inventories[inventories.length - 1] ?? null;
  const facilities = input.facilities || [];
  const facilityName = new Map(facilities.map((f) => [f.facilityReference, f.name]));
  const nameOf = (ref: unknown) => {
    const key = String(ref || "");
    return facilityName.get(key) || key || "Chưa ánh xạ cơ sở";
  };

  // Tổng kiểm kê kỳ gần nhất
  const latestTonnes = latest ? inventoryScopeTonnes(latest) : { scope1: 0, scope2: 0, scope3: 0 };
  const totalTonnes = round1(latestTonnes.scope1 + latestTonnes.scope2 + latestTonnes.scope3);

  // Độ phủ ngành (nếu cơ sở có khai báo ngành) hoặc số cơ sở
  const industries = new Set(facilities.map(facilityIndustry).filter((v): v is string => Boolean(v)));
  const coverage = industries.size
    ? { value: industries.size, label: "Độ phủ ngành", subtext: "Số ngành được đại diện" }
    : { value: facilities.filter((f) => f.lifecycleStatus !== "inactive").length, label: "Cơ sở đang theo dõi", subtext: "Cơ sở trong danh mục công nghiệp" };

  // Nhịp phát thải theo cơ sở qua các kỳ kiểm kê
  const facilityTotals = new Map<string, number>();
  const cadenceMap = new Map<string, Record<string, string | number>>();
  inventories.forEach((inv) => {
    const period = monthLabel(inv.reportingPeriodEnd);
    const row = cadenceMap.get(period) ?? { periodDate: inv.reportingPeriodEnd, period };
    countableRows(inv).forEach((src) => {
      const key = String(src.facilityReference || "unmapped");
      const tonnes = src.calculatedCo2eKg / 1000;
      row[key] = round1(Number(row[key] || 0) + tonnes);
      facilityTotals.set(key, (facilityTotals.get(key) || 0) + tonnes);
    });
    cadenceMap.set(period, row);
  });
  const cadenceSeries = [...facilityTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([key]) => ({ key, label: key === "unmapped" ? "Chưa ánh xạ cơ sở" : nameOf(key) }));

  // Cơ cấu nguồn và điểm nóng của kỳ gần nhất
  const latestRows = latest ? countableRows(latest) : [];
  const latestKg = latestRows.reduce((s, r) => s + r.calculatedCo2eKg, 0);
  const byCategory = new Map<string, number>();
  const byHotspot = new Map<string, { entity: string; type: string; facility: string; kg: number }>();
  latestRows.forEach((r) => {
    const category = String(r.category || "Chưa phân loại");
    byCategory.set(category, (byCategory.get(category) || 0) + r.calculatedCo2eKg);
    const key = `${String(r.facilityReference || "")}|${category}|${String(r.scope)}`;
    const current = byHotspot.get(key) ?? {
      entity: category,
      type: String(r.scope).replace("scope", "Scope "),
      facility: nameOf(r.facilityReference),
      kg: 0,
    };
    current.kg += r.calculatedCo2eKg;
    byHotspot.set(key, current);
  });
  const share = (kg: number) => (latestKg > 0 ? round1((kg / latestKg) * 100) : 0);
  const emissionsBySource = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([source, kg]) => ({ source, pct: share(kg) }));
  const hotspots = [...byHotspot.entries()]
    .sort((a, b) => b[1].kg - a[1].kg)
    .slice(0, 5)
    .map(([id, h]) => ({ id, entity: h.entity, type: h.type, facility: h.facility, tonnes: round1(h.kg / 1000), pct: share(h.kg) }));

  // Sản phẩm → thị trường → báo cáo
  const evidence = input.evidence || [];
  const evidenceByProduct = new Map<string, number>();
  evidence.forEach((doc) => { if (doc.productId) evidenceByProduct.set(doc.productId, (evidenceByProduct.get(doc.productId) || 0) + 1); });
  const allProducts = (input.products || []).map((p) => {
    const exportBound = !isDomesticMarket(p.destinationMarket || "");
    const perUnit = p.carbonResults?.perProduct?.total;
    return {
      id: p.id,
      name: p.productName || p.productCode || p.id,
      industry: String(p.productCategory || p.productType || "—"),
      productCode: p.productCode || null,
      cnCode: p.cnCode || p.hsCode || null,
      marketScope: exportBound ? "export" : "domestic",
      intensity: typeof perUnit === "number" && Number.isFinite(perUnit)
        ? `${perUnit.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} kgCO₂e/sp`
        : null,
      reportTargets: productTargets(p, exportBound),
      evidenceCount: evidenceByProduct.get(p.id) || 0,
      updatedAt: p.updatedAt || p.createdAt || "",
    };
  });
  const products: PortfolioProductRow[] = [...allProducts]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 8)
    .map((row) => ({
      id: row.id, name: row.name, industry: row.industry, productCode: row.productCode, cnCode: row.cnCode,
      marketScope: row.marketScope, intensity: row.intensity, reportTargets: row.reportTargets, evidenceCount: row.evidenceCount,
    }));
  const productName = new Map(allProducts.map((p) => [p.id, p.name]));
  const reportTargets = new Set(allProducts.flatMap((p) => p.reportTargets));

  // Bằng chứng gần nhất
  const evidenceRows: PortfolioEvidenceRow[] = [...evidence]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 6)
    .map((doc) => ({
      id: doc.id,
      fileName: doc.documentName || doc.originalFilename || doc.id,
      documentType: doc.evidenceType || "Chứng từ",
      linkedActivity: (doc.productId && productName.get(doc.productId)) ||
        (doc.reportingPeriodStart ? `${dateLabel(doc.reportingPeriodStart)} – ${dateLabel(doc.reportingPeriodEnd || doc.reportingPeriodStart)}` : null),
      evidenceLevel: EVIDENCE_LEVEL[doc.status] ?? doc.status,
    }));

  // Cảnh báo: phát hiện của engine kiểm kê + việc cần xử lý trong workspace
  const alerts: PortfolioAlertRow[] = [];
  (latest?.result?.findings || []).forEach((f, index) => {
    alerts.push({
      id: `finding:${f.code}:${index}`,
      severity: f.severity === "blocker" ? "critical" : f.severity === "specialist" ? "warning" : "info",
      text: f.message,
      entity: latest?.inventoryReference || "Kiểm kê",
    });
  });
  evidence
    .filter((doc) => !/^[a-f0-9]{64}$/i.test(doc.checksumSha256 || ""))
    .forEach((doc) => alerts.push({ id: `evidence:${doc.id}`, severity: "critical", text: "Chứng từ thiếu checksum SHA-256 hợp lệ", entity: doc.documentName }));
  (input.activities || [])
    .filter((a) => a.dataQualityLevel === "L1" || a.dataQualityLevel === "L2")
    .forEach((a) => alerts.push({ id: `activity:${a.id}`, severity: "warning", text: `Nguồn dữ liệu ${a.dataQualityLevel} cần bổ sung bằng chứng`, entity: a.activityReference }));
  evidence
    .filter((doc) => /^[a-f0-9]{64}$/i.test(doc.checksumSha256 || "") && !["locked", "third_party_verified"].includes(doc.status))
    .forEach((doc) => alerts.push({ id: `evidence-lock:${doc.id}`, severity: "info", text: "Chứng từ chưa khoá", entity: doc.documentName }));
  (input.factors || [])
    .filter((f) => f.governanceStatus !== "approved_for_release_candidate")
    .forEach((f) => alerts.push({ id: `factor:${f.id}`, severity: "info", text: `Hệ số chờ duyệt: ${f.governanceStatus}`, entity: f.label }));
  const rank: Record<PortfolioSeverity, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return {
    mode: "real",
    engineVersion: latest?.rulesetVersion || "—",
    facilitiesCount: facilities.length,
    period: latest ? `${dateLabel(latest.reportingPeriodStart)} – ${dateLabel(latest.reportingPeriodEnd)}` : "chưa có kỳ kiểm kê",
    totalTonnes,
    coverage,
    ...countMarkets(allProducts),
    avgEvidence: averageEvidence(allProducts),
    reportProfilesCount: reportTargets.size,
    cadence: { rows: [...cadenceMap.values()], series: cadenceSeries },
    emissionsMonthly: scopeSeries(inventories, monthLabel),
    emissionsQuarterly: scopeSeries(inventories, quarterLabel),
    emissionsBySource,
    products,
    evidence: evidenceRows,
    hotspots,
    alerts: alerts.slice(0, 4),
    hasInventory: Boolean(latest),
  };
}
