/* eslint-disable @typescript-eslint/no-explicit-any -- ported 1:1 from the Lovable demo data layer (schemaless snapshot rows); typed at the module boundary. */
import type { IndustrialDatasetState } from '../dataset';
import type { IndustrialReportingState, IndustrialProductMarketRow } from '../reporting';
import type { LegalMarketProfile, ReportingIndustry } from '../legalMarketRegistry';
import {
  demoProductionBatches,
  demoShipmentScopes,
  demoProductPeriodMetrics,
  type DemoProductionBatch,
  type DemoShipmentScope,
  type ReportEntityType,
  type ReportPeriodType,
} from '../reportScopeDemo';
import {
  buildMonthlyIndustryReport,
  type GeneratedIndustryReport,
  type ReportCheck,
  type ReportSection,
} from './aiMonthlyReportEngine';

export interface ReportScopeSelection {
  entityType: ReportEntityType;
  entityId?: string;
  periodType: ReportPeriodType;
  periodKey: string;
  periodLabel: string;
  periodLabels: string[];
}

export interface ReportScopeSummary {
  entityType: ReportEntityType;
  entityId: string;
  entityLabel: string;
  periodType: ReportPeriodType;
  periodLabel: string;
  periodLabels: string[];
  facilityIds: string[];
  facilityNames: string[];
  productIds: string[];
  productNames: string[];
  lineage: string[];
  quantity?: number;
  quantityUnit?: string;
  intensity?: string | null;
  productEmissionsTco2e?: number;
  logisticsEmissionsTco2e?: number;
  destinationMarket?: string;
}

export interface GeneratedScopedIndustryReport extends GeneratedIndustryReport {
  scope: ReportScopeSummary;
}

interface BuildScopedReportArgs {
  dataset: IndustrialDatasetState;
  reporting: IndustrialReportingState;
  profile: LegalMarketProfile;
  industry: ReportingIndustry;
  selection: ReportScopeSelection;
  vi: boolean;
  demo?: boolean;
}

const format = (value: number, digits = 1) => value.toLocaleString('en-US', { maximumFractionDigits: digits });
const slug = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 34);

function parseIntensity(value: string | null | undefined) {
  if (!value) return null;
  const match = value.replace(/,/g, '').match(/([0-9.]+)\s*(kg|t)CO2e\s*\/\s*(.+)$/i);
  if (!match) return null;
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) return null;
  return {
    original: value,
    tco2ePerUnit: match[2].toLowerCase() === 'kg' ? numeric / 1000 : numeric,
    denominator: match[3],
  };
}

function getProduct(reporting: IndustrialReportingState, id?: string) {
  return reporting.products.find((product) => product.id === id);
}

function resolveFacility(dataset: IndustrialDatasetState, facilityId?: string, facilityName?: string) {
  return dataset.facilities.find((facility: any) => facility.id === facilityId)
    || dataset.facilities.find((facility: any) => facility.name === facilityName);
}

function getBatch(id?: string): DemoProductionBatch | undefined {
  return demoProductionBatches.find((batch) => batch.id === id);
}

function getShipment(id?: string): DemoShipmentScope | undefined {
  return demoShipmentScopes.find((shipment) => shipment.id === id);
}

function quantityForProduct(productId: string, periods: string[]) {
  const rows = demoProductPeriodMetrics.filter((row) => row.productId === productId && periods.includes(row.period));
  if (!rows.length) return null;
  return {
    quantity: rows.reduce((sum, row) => sum + row.quantity, 0),
    unit: rows[0].unit,
    rows,
  };
}

function productEmission(product: IndustrialProductMarketRow | undefined, quantity?: number) {
  if (!product || quantity == null) return null;
  const parsed = parseIntensity(product.intensity);
  if (!parsed) return null;
  return quantity * parsed.tco2ePerUnit;
}

function resolveScope(
  dataset: IndustrialDatasetState,
  reporting: IndustrialReportingState,
  industry: ReportingIndustry,
  selection: ReportScopeSelection,
): ReportScopeSummary {
  const industryFacilities = dataset.facilities.filter((facility: any) => facility.industry === industry);
  let facilityIds = industryFacilities.map((facility: any) => String(facility.id));
  let productIds = reporting.products.filter((product) => product.industry === industry).map((product) => product.id);
  let entityId: string = industry;
  let entityLabel: string = industry;
  let quantity: number | undefined;
  let quantityUnit: string | undefined;
  let intensity: string | null | undefined;
  let productEmissionsTco2e: number | undefined;
  let logisticsEmissionsTco2e: number | undefined;
  let destinationMarket: string | undefined;
  const lineage: string[] = [];

  if (selection.entityType === 'facility') {
    const facility = resolveFacility(dataset, selection.entityId);
    if (facility) {
      facilityIds = [facility.id];
      productIds = reporting.products.filter((product) => product.facilityName === facility.name).map((product) => product.id);
      entityId = facility.id;
      entityLabel = facility.name;
      lineage.push(`Facility ${facility.id}`);
    }
  }

  if (selection.entityType === 'product') {
    const product = getProduct(reporting, selection.entityId);
    if (product) {
      const facility = resolveFacility(dataset, undefined, product.facilityName);
      facilityIds = facility ? [facility.id] : facilityIds;
      productIds = [product.id];
      entityId = product.id;
      entityLabel = `${product.name}${product.productCode ? ` · ${product.productCode}` : ''}`;
      intensity = product.intensity;
      destinationMarket = product.destinationMarket || undefined;
      const q = quantityForProduct(product.id, selection.periodLabels);
      quantity = q?.quantity;
      quantityUnit = q?.unit;
      const emissions = productEmission(product, quantity);
      productEmissionsTco2e = emissions == null ? undefined : emissions;
      lineage.push(`Product ${product.productCode || product.id}`, facility ? `Facility ${facility.id}` : product.facilityName);
    }
  }

  if (selection.entityType === 'batch') {
    const batch = getBatch(selection.entityId);
    if (batch) {
      const product = getProduct(reporting, batch.productIds[0]);
      facilityIds = [batch.facilityId];
      productIds = [...batch.productIds];
      entityId = batch.id;
      entityLabel = `${batch.name} · ${batch.id}`;
      quantity = batch.quantity;
      quantityUnit = batch.unit;
      intensity = product?.intensity;
      destinationMarket = batch.destinationMarket;
      const emissions = productEmission(product, batch.quantity);
      productEmissionsTco2e = emissions == null ? undefined : emissions;
      lineage.push(`Batch ${batch.id}`, product ? `Product ${product.productCode || product.id}` : '', `Facility ${batch.facilityId}`);
    }
  }

  if (selection.entityType === 'shipment') {
    const shipment = getShipment(selection.entityId);
    if (shipment) {
      const batch = getBatch(shipment.batchId);
      const product = getProduct(reporting, shipment.productIds[0]);
      facilityIds = [shipment.facilityId];
      productIds = [...shipment.productIds];
      entityId = shipment.id;
      entityLabel = `${shipment.name} · ${shipment.id}`;
      quantity = batch?.quantity;
      quantityUnit = batch?.unit;
      intensity = product?.intensity;
      destinationMarket = shipment.destinationMarket;
      const emissions = productEmission(product, batch?.quantity);
      productEmissionsTco2e = emissions == null ? undefined : emissions;
      logisticsEmissionsTco2e = shipment.logisticsEmissionsTco2e;
      lineage.push(`Shipment ${shipment.id}`, `Batch ${shipment.batchId}`, product ? `Product ${product.productCode || product.id}` : '', `Facility ${shipment.facilityId}`);
    }
  }

  const facilities = dataset.facilities.filter((facility: any) => facilityIds.includes(String(facility.id)));
  const products = reporting.products.filter((product) => productIds.includes(product.id));
  if (selection.entityType === 'industry') {
    lineage.push(`Industry Pack ${industry}`, ...facilities.map((facility: any) => `Facility ${facility.id}`));
  }

  return {
    entityType: selection.entityType,
    entityId,
    entityLabel,
    periodType: selection.periodType,
    periodLabel: selection.periodLabel,
    periodLabels: [...selection.periodLabels],
    facilityIds,
    facilityNames: facilities.map((facility: any) => facility.name),
    productIds,
    productNames: products.map((product) => product.name),
    lineage: lineage.filter(Boolean),
    quantity,
    quantityUnit,
    intensity,
    productEmissionsTco2e,
    logisticsEmissionsTco2e,
    destinationMarket,
  };
}

function cloneForScope(
  dataset: IndustrialDatasetState,
  reporting: IndustrialReportingState,
  industry: ReportingIndustry,
  scope: ReportScopeSummary,
) {
  const periodSet = new Set(scope.periodLabels);
  const facilitySet = new Set(scope.facilityIds);
  const facilityNameSet = new Set(scope.facilityNames);
  const productSet = new Set(scope.productIds);

  const facilities = dataset.facilities.filter((facility: any) => facilitySet.has(String(facility.id)));
  const activityData = dataset.activityData.filter((row: any) => facilityNameSet.has(String(row.facility)) && periodSet.has(String(row.period)));
  const processes = dataset.processes.filter((row: any) => facilityNameSet.has(String(row.facility)));
  const products = dataset.products.filter((product: any) => productSet.has(String(product.id)) || facilityNameSet.has(String(product.facility)));
  const hotspots = dataset.hotspots.filter((hotspot: any) => facilityNameSet.has(String(hotspot.facility)));
  const cadence = reporting.cadence.filter((row) => row.industry === industry && periodSet.has(row.periodLabel));
  const reportingProducts = reporting.products.filter((product) => productSet.has(product.id));
  const evidence = reporting.evidence.filter((item) => {
    const linked = (item.productId && productSet.has(item.productId)) || (item.facilityId && facilitySet.has(item.facilityId));
    return Boolean(linked && periodSet.has(item.period));
  });

  const scopedDataset: IndustrialDatasetState = {
    ...dataset,
    facilities,
    activityData,
    processes,
    products,
    hotspots,
    emissionsMonthly: dataset.emissionsMonthly.filter((row) => periodSet.has(row.period)),
  };
  const scopedReporting: IndustrialReportingState = {
    ...reporting,
    cadence,
    products: reportingProducts,
    evidence,
  };
  return { scopedDataset, scopedReporting };
}

function industryPeriodEmissions(reporting: IndustrialReportingState, industry: ReportingIndustry, periods: string[]) {
  const set = new Set(periods);
  return reporting.cadence
    .filter((row) => row.industry === industry && set.has(row.periodLabel))
    .reduce((sum, row) => sum + Number(row.emissionsTco2e || 0), 0);
}

function scopeEmission(
  dataset: IndustrialDatasetState,
  reporting: IndustrialReportingState,
  industry: ReportingIndustry,
  scope: ReportScopeSummary,
) {
  if (scope.entityType === 'product' || scope.entityType === 'batch') {
    return scope.productEmissionsTco2e ?? 0;
  }
  if (scope.entityType === 'shipment') {
    return (scope.productEmissionsTco2e ?? 0) + (scope.logisticsEmissionsTco2e ?? 0);
  }
  const total = industryPeriodEmissions(reporting, industry, scope.periodLabels);
  if (scope.entityType !== 'facility' || scope.facilityIds.length !== 1) return total;
  const allIndustryFacilities = dataset.facilities.filter((facility: any) => facility.industry === industry);
  if (allIndustryFacilities.length <= 1) return total;
  const selected = allIndustryFacilities.find((facility: any) => facility.id === scope.facilityIds[0]);
  const denominator = allIndustryFacilities.reduce((sum: number, facility: any) => sum + Number(facility.tonnes || 0), 0);
  return denominator && selected ? total * Number(selected.tonnes || 0) / denominator : total;
}

function periodBreakdown(reporting: IndustrialReportingState, industry: ReportingIndustry, scope: ReportScopeSummary) {
  if (scope.entityType === 'product') {
    const rows = demoProductPeriodMetrics.filter((row) => row.productId === scope.productIds[0] && scope.periodLabels.includes(row.period));
    return rows.map((row) => ({ label: row.period, value: `${format(row.quantity, 0)} ${row.unit}` }));
  }
  return reporting.cadence
    .filter((row) => row.industry === industry && scope.periodLabels.includes(row.periodLabel))
    .map((row) => ({ label: row.periodLabel, value: `${format(row.emissionsTco2e)} tCO₂e` }));
}

function replaceSection(sections: ReportSection[], replacement: ReportSection) {
  const index = sections.findIndex((section) => section.id === replacement.id);
  if (index < 0) return [...sections, replacement];
  return sections.map((section) => section.id === replacement.id ? replacement : section);
}

function entityTypeLabel(type: ReportEntityType, vi: boolean) {
  const labels: Record<ReportEntityType, [string, string]> = {
    industry: ['Toàn ngành / Industry Pack', 'Industry / Industry Pack'],
    facility: ['Cơ sở sản xuất', 'Facility'],
    product: ['Sản phẩm', 'Product'],
    batch: ['Lô sản xuất', 'Production batch'],
    shipment: ['Lô vận chuyển', 'Shipment'],
  };
  return vi ? labels[type][0] : labels[type][1];
}

export function buildScopedIndustryReport({ dataset, reporting, profile, industry, selection, vi, demo = true }: BuildScopedReportArgs): GeneratedScopedIndustryReport {
  const scope = resolveScope(dataset, reporting, industry, selection);
  const { scopedDataset, scopedReporting } = cloneForScope(dataset, reporting, industry, scope);
  const base = buildMonthlyIndustryReport({
    dataset: scopedDataset,
    reporting: scopedReporting,
    profile,
    industry,
    period: 'All',
    vi,
    demo,
  });

  const emissionsTco2e = scopeEmission(dataset, reporting, industry, scope);
  const detailedMonths = new Set(scopedDataset.activityData.map((row: any) => String(row.period)));
  const coverageMonths = scope.periodLabels.filter((period) => detailedMonths.has(period)).length;
  const scopeCheck: ReportCheck = {
    id: 'scope-resolution',
    level: scope.entityType === 'industry' || scope.entityId ? 'pass' : 'blocker',
    label: vi ? 'Đối tượng báo cáo đã khóa' : 'Reporting object locked',
    detail: vi
      ? `${entityTypeLabel(scope.entityType, vi)}: ${scope.entityLabel}. Lineage: ${scope.lineage.join(' → ') || '—'}.`
      : `${entityTypeLabel(scope.entityType, vi)}: ${scope.entityLabel}. Lineage: ${scope.lineage.join(' → ') || '—'}.`,
  };
  const periodCheck: ReportCheck = {
    id: 'period-resolution',
    level: coverageMonths >= scope.periodLabels.length ? 'pass' : coverageMonths > 0 ? 'warning' : 'blocker',
    label: vi ? 'Độ phủ dữ liệu chi tiết theo kỳ' : 'Detailed period-data coverage',
    detail: vi
      ? `${coverageMonths}/${scope.periodLabels.length} tháng trong phạm vi có activity data chi tiết. Cadence tổng hợp không thay thế evidence/activity data chi tiết.`
      : `${coverageMonths}/${scope.periodLabels.length} months in scope have detailed activity data. Aggregate cadence never substitutes detailed evidence/activity data.`,
  };
  const quantityCheck: ReportCheck | null = ['product', 'batch', 'shipment'].includes(scope.entityType) ? {
    id: 'quantity-resolution',
    level: scope.quantity != null && scope.intensity ? 'pass' : 'warning',
    label: vi ? 'Sản lượng / allocation basis' : 'Quantity / allocation basis',
    detail: scope.quantity != null
      ? `${format(scope.quantity, 0)} ${scope.quantityUnit || ''} · ${scope.intensity || (vi ? 'chưa có intensity' : 'intensity unavailable')}`
      : (vi ? 'Chưa có sản lượng đủ để tính product/batch footprint độc lập.' : 'Insufficient quantity data for an independent product/batch footprint.'),
  } : null;
  const checks = [scopeCheck, periodCheck, ...(quantityCheck ? [quantityCheck] : []), ...base.checks.filter((check) => check.id !== 'data')];
  const blockers = checks.filter((check) => check.level === 'blocker').length;
  const warnings = checks.filter((check) => check.level === 'warning').length;
  const status: GeneratedIndustryReport['status'] = blockers ? 'draft' : warnings ? 'needs-review' : 'verification-ready';

  const profileTitle = vi ? profile.titleVi : profile.titleEn;
  const executive: ReportSection = {
    id: 'executive',
    title: vi ? '1. Tóm tắt điều hành' : '1. Executive summary',
    body: [
      vi
        ? `Báo cáo ${profileTitle} được dựng cho ${entityTypeLabel(scope.entityType, vi).toLowerCase()} “${scope.entityLabel}”, phạm vi thời gian ${scope.periodLabel}. Hệ thống khóa đúng facility/product/batch/shipment lineage trước khi tổng hợp, vì vậy việc đổi report profile không làm thay đổi dữ liệu nguồn.`
        : `This ${profileTitle} report is assembled for ${entityTypeLabel(scope.entityType, vi).toLowerCase()} “${scope.entityLabel}” over ${scope.periodLabel}. WeaveCarbon locks facility/product/batch/shipment lineage before aggregation, so changing the report profile never mutates source data.`,
      vi
        ? `Phát thải trong phạm vi report là ${format(emissionsTco2e)} tCO₂e. Report sử dụng ${scopedDataset.activityData.length} activity records, ${scopedReporting.evidence.length} evidence records và ${scopedReporting.products.length} sản phẩm được ánh xạ trong scope.`
        : `Emissions represented by this scope are ${format(emissionsTco2e)} tCO₂e. The report uses ${scopedDataset.activityData.length} activity records, ${scopedReporting.evidence.length} evidence records and ${scopedReporting.products.length} mapped products.`,
    ],
    facts: [
      { label: vi ? 'Đối tượng' : 'Reporting object', value: scope.entityLabel },
      { label: vi ? 'Loại phạm vi' : 'Scope type', value: entityTypeLabel(scope.entityType, vi) },
      { label: vi ? 'Kỳ' : 'Period', value: scope.periodLabel },
      { label: vi ? 'Lineage' : 'Lineage', value: scope.lineage.join(' → ') || '—' },
    ],
  };

  const scopeSection: ReportSection = {
    id: 'scope',
    title: vi ? '2. Đối tượng, mục tiêu và phạm vi báo cáo' : '2. Reporting object, objective and scope',
    body: [
      vi
        ? `Scope được resolve từ Carbon Evidence Graph theo thứ tự ${scope.lineage.join(' → ') || scope.entityLabel}. Chỉ dữ liệu thuộc ${scope.periodLabels.join(', ')} được đưa vào aggregation của kỳ này.`
        : `The scope is resolved from the Carbon Evidence Graph as ${scope.lineage.join(' → ') || scope.entityLabel}. Only data belonging to ${scope.periodLabels.join(', ')} are included in this aggregation.`,
      vi
        ? 'Thời gian và đối tượng là hai chiều độc lập: cùng một sản phẩm có thể tạo report tháng/quý/năm; một batch hoặc shipment giữ kỳ gắn với chính đối tượng đó để tránh trộn dữ liệu.'
        : 'Time and reporting object are independent dimensions: the same product can be reported monthly/quarterly/year-to-date, while a batch or shipment retains its linked period to prevent data mixing.',
    ],
    facts: [
      { label: vi ? 'Cơ sở trong scope' : 'Facilities in scope', value: scope.facilityNames.join(', ') || '—' },
      { label: vi ? 'Sản phẩm trong scope' : 'Products in scope', value: scope.productNames.join(', ') || '—' },
      { label: vi ? 'Tháng thành phần' : 'Component months', value: scope.periodLabels.join(' · ') },
      ...(scope.destinationMarket ? [{ label: vi ? 'Thị trường đích' : 'Destination market', value: scope.destinationMarket }] : []),
    ],
  };

  const inventory: ReportSection = {
    id: 'inventory',
    title: vi ? '4. Kiểm kê dữ liệu đầu vào trong phạm vi' : '4. In-scope input inventory',
    body: [
      vi
        ? `WeaveCarbon thu thập ${scopedDataset.activityData.length} activity records và ${scopedReporting.evidence.length} evidence records sau khi áp dụng cả bộ lọc đối tượng lẫn thời gian. Dữ liệu ngoài scope không bị xoá; chúng chỉ không được đưa vào snapshot của report này.`
        : `WeaveCarbon collected ${scopedDataset.activityData.length} activity records and ${scopedReporting.evidence.length} evidence records after applying both entity and time filters. Out-of-scope data are never deleted; they are simply excluded from this report snapshot.`,
    ],
    facts: [
      { label: 'Activity records', value: String(scopedDataset.activityData.length) },
      { label: vi ? 'Evidence records' : 'Evidence records', value: String(scopedReporting.evidence.length) },
      { label: vi ? 'Processes' : 'Processes', value: String(scopedDataset.processes.length) },
      { label: vi ? 'Sản phẩm' : 'Products', value: String(scopedReporting.products.length) },
    ],
  };

  const breakdown = periodBreakdown(reporting, industry, scope);
  const resultFacts: Array<{ label: string; value: string }> = [
    { label: vi ? 'Phát thải trong scope' : 'In-scope emissions', value: `${format(emissionsTco2e)} tCO₂e` },
  ];
  if (scope.quantity != null) resultFacts.push({ label: vi ? 'Sản lượng / số lượng' : 'Quantity', value: `${format(scope.quantity, 0)} ${scope.quantityUnit || ''}` });
  if (scope.intensity) resultFacts.push({ label: vi ? 'Cường độ carbon' : 'Carbon intensity', value: scope.intensity });
  if (scope.productEmissionsTco2e != null) resultFacts.push({ label: vi ? 'Carbon sản phẩm / batch' : 'Product / batch carbon', value: `${format(scope.productEmissionsTco2e)} tCO₂e` });
  if (scope.logisticsEmissionsTco2e != null) resultFacts.push({ label: vi ? 'Carbon logistics' : 'Logistics carbon', value: `${format(scope.logisticsEmissionsTco2e)} tCO₂e` });
  breakdown.forEach((item) => resultFacts.push(item));

  const results: ReportSection = {
    id: 'results',
    title: vi ? '6. Kết quả carbon trong phạm vi đã chọn' : '6. Carbon results for the selected scope',
    body: [
      scope.entityType === 'shipment'
        ? (vi
          ? 'Shipment report tách product embodied carbon và transport carbon trước khi cộng thành tổng phạm vi shipment, tránh double-counting giữa product footprint và logistics.'
          : 'The shipment report keeps product embodied carbon and transport carbon separate before combining them into the shipment scope, preventing double counting between product footprint and logistics.')
        : scope.entityType === 'product' || scope.entityType === 'batch'
          ? (vi
            ? 'Kết quả product/batch được suy ra từ số lượng trong scope và carbon intensity đã được quản trị. Allocation basis và intensity phải được khóa trong calculation snapshot trước khi phát hành thật.'
            : 'Product/batch results are derived from in-scope quantity and governed carbon intensity. Allocation basis and intensity must be frozen in the calculation snapshot before production issue.')
          : (vi
            ? 'Kết quả kỳ được cộng từ cadence theo tháng trong phạm vi. Carbon intensity không được lấy trung bình đơn giản giữa các tháng; khi có production denominator, engine phải tính lại từ tổng phát thải / tổng sản lượng.'
            : 'Period results are summed from monthly cadence within scope. Carbon intensity must never be a simple average of monthly intensities; when a production denominator exists, the engine recalculates total emissions / total production.'),
    ],
    facts: resultFacts,
  };

  const industrySection: ReportSection = {
    id: 'industry',
    title: vi ? '8. Ánh xạ ngành, thị trường và report contract' : '8. Industry, market and report-contract mapping',
    body: [
      vi
        ? `${profileTitle} được áp dụng sau khi scope đã khóa. Report profile chỉ thay cấu trúc đầu ra và các trường bắt buộc; không chạy lại hoặc sửa activity data nguồn.`
        : `${profileTitle} is applied only after the scope is locked. The report profile changes output structure and required fields, not the underlying activity data.`,
      vi
        ? `Đối tượng ${scope.entityLabel}${scope.destinationMarket ? ` hướng tới ${scope.destinationMarket}` : ''}. Các thuật ngữ CBAM, GHG Protocol, ISO, PCF, DPP, MRV được giữ theo đúng context của profile.`
        : `The reporting object is ${scope.entityLabel}${scope.destinationMarket ? ` for ${scope.destinationMarket}` : ''}. Terms such as CBAM, GHG Protocol, ISO, PCF, DPP and MRV retain their profile-specific meaning.`,
    ],
    facts: [
      { label: vi ? 'Report profile' : 'Report profile', value: profileTitle },
      { label: vi ? 'Market' : 'Market', value: profile.market },
      { label: vi ? 'Scope object' : 'Scope object', value: entityTypeLabel(scope.entityType, vi) },
      { label: vi ? 'Scope ID' : 'Scope ID', value: scope.entityId },
    ],
  };

  let sections = [...base.sections];
  sections = replaceSection(sections, executive);
  sections = replaceSection(sections, scopeSection);
  sections = replaceSection(sections, inventory);
  sections = replaceSection(sections, results);
  sections = replaceSection(sections, industrySection);

  const id = `WC-${slug(industry)}-${slug(profile.reportProfileCode)}-${slug(scope.entityType)}-${slug(scope.entityId)}-${slug(selection.periodKey)}`;
  return {
    ...base,
    id,
    title: `${profileTitle} — ${scope.entityLabel}`,
    subtitle: `${scope.periodLabel} · ${scope.destinationMarket || profile.market} · ${demo ? 'DEMO DATA' : 'GOVERNED DATA'}`,
    period: scope.periodLabel,
    status,
    metrics: {
      ...base.metrics,
      facilities: scope.facilityIds.length,
      products: scope.productIds.length,
      activities: scopedDataset.activityData.length,
      evidence: scopedReporting.evidence.length,
      emissionsTco2e,
      openFindings: scopedDataset.dataGaps.length,
    },
    checks,
    sections,
    scope,
  };
}
