import type { ReportingIndustry } from './legalMarketRegistry';

export type ReportEntityType = 'industry' | 'facility' | 'product' | 'batch' | 'shipment';
export type ReportPeriodType = 'month' | 'quarter' | 'year';

export const reportMonths2026 = ['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026'] as const;

export const reportQuarterOptions = [
  { key: 'Q1-2026', label: 'Q1 2026', periods: ['Jan 2026', 'Feb 2026', 'Mar 2026'] },
  { key: 'Q2-2026', label: 'Q2 2026', periods: ['Apr 2026', 'May 2026', 'Jun 2026'] },
  { key: 'Q3-2026-YTD', label: 'Q3 2026 (Jul–Aug demo)', periods: ['Jul 2026', 'Aug 2026'] },
] as const;

export const reportYearOptions = [
  { key: '2026-YTD', label: '2026 YTD (Jan–Aug)', periods: [...reportMonths2026] },
] as const;

const productSeries: Record<string, { industry: ReportingIndustry; facilityId: string; unit: string; values: number[] }> = {
  'P-01': { industry: 'Agriculture', facilityId: 'FAC-BD', unit: 't', values: [512, 498, 541, 565, 582, 601, 616, 594] },
  'P-02': { industry: 'Agriculture', facilityId: 'FAC-BD', unit: 't', values: [248, 239, 261, 273, 282, 291, 302, 286] },
  'P-03': { industry: 'Steel', facilityId: 'FAC-HP', unit: 't', values: [2620, 2550, 2710, 2810, 2910, 3010, 3150, 2940] },
  'P-04': { industry: 'Steel', facilityId: 'FAC-HP', unit: 't', values: [1510, 1480, 1560, 1650, 1710, 1760, 1820, 1740] },
  'P-05': { industry: 'Cement', facilityId: 'FAC-NB', unit: 't', values: [4310, 4390, 4620, 4780, 4920, 5010, 4970, 4860] },
  'P-06': { industry: 'Construction Materials', facilityId: 'FAC-DN', unit: 'm²', values: [14200, 15100, 15800, 16600, 17700, 18400, 19100, 18400] },
  'P-07': { industry: 'Aluminium', facilityId: 'FAC-AL', unit: 't', values: [720, 705, 748, 765, 790, 812, 835, 880] },
  'P-08': { industry: 'Chemicals', facilityId: 'FAC-CH', unit: 't', values: [980, 965, 1010, 1040, 1080, 1110, 1170, 1150] },
  'P-09': { industry: 'Mining & Minerals', facilityId: 'FAC-MN', unit: 't', values: [4860, 5010, 5260, 5480, 5710, 5840, 6010, 5900] },
};

export const demoProductPeriodMetrics = Object.entries(productSeries).flatMap(([productId, config]) =>
  reportMonths2026.map((period, index) => ({
    productId,
    industry: config.industry,
    facilityId: config.facilityId,
    period,
    quantity: config.values[index],
    unit: config.unit,
  })),
);

export interface DemoProductionBatch {
  id: string;
  name: string;
  industry: ReportingIndustry;
  facilityId: string;
  productIds: string[];
  period: string;
  productionWindow: string;
  quantity: number;
  unit: string;
  destinationMarket: string;
  shipmentId?: string;
}

export const demoProductionBatches: DemoProductionBatch[] = [
  { id: 'BATCH-ST-HRC-2608-A', name: 'HRC Export Batch 2608-A', industry: 'Steel', facilityId: 'FAC-HP', productIds: ['P-03'], period: 'Aug 2026', productionWindow: '12–16 Aug 2026', quantity: 1200, unit: 't', destinationMarket: 'European Union', shipmentId: 'SHIP-EU-ST-2608' },
  { id: 'BATCH-ST-RB-2608-B', name: 'Rebar Export Batch 2608-B', industry: 'Steel', facilityId: 'FAC-HP', productIds: ['P-04'], period: 'Aug 2026', productionWindow: '19–23 Aug 2026', quantity: 900, unit: 't', destinationMarket: 'European Union', shipmentId: 'SHIP-EU-RB-2608' },
  { id: 'BATCH-CEM-2608-A', name: 'PCB40 Export Batch 2608-A', industry: 'Cement', facilityId: 'FAC-NB', productIds: ['P-05'], period: 'Aug 2026', productionWindow: '08–14 Aug 2026', quantity: 1800, unit: 't', destinationMarket: 'European Union', shipmentId: 'SHIP-EU-CEM-2608' },
  { id: 'BATCH-AL-2608-A', name: 'Extrusion Batch 2608-A', industry: 'Aluminium', facilityId: 'FAC-AL', productIds: ['P-07'], period: 'Aug 2026', productionWindow: '05–11 Aug 2026', quantity: 420, unit: 't', destinationMarket: 'European Union', shipmentId: 'SHIP-EU-AL-2608' },
  { id: 'BATCH-FERT-2608-A', name: 'Fertiliser Export Batch 2608-A', industry: 'Chemicals', facilityId: 'FAC-CH', productIds: ['P-08'], period: 'Aug 2026', productionWindow: '17–22 Aug 2026', quantity: 600, unit: 't', destinationMarket: 'European Union', shipmentId: 'SHIP-EU-FERT-2608' },
  { id: 'BATCH-AGR-2608-A', name: 'Robusta Buyer Batch 2608-A', industry: 'Agriculture', facilityId: 'FAC-BD', productIds: ['P-01'], period: 'Aug 2026', productionWindow: '10–18 Aug 2026', quantity: 120, unit: 't', destinationMarket: 'European Union', shipmentId: 'SHIP-EU-AGR-2608' },
  { id: 'BATCH-STONE-2608-A', name: 'Stone Slab Project Batch 2608-A', industry: 'Construction Materials', facilityId: 'FAC-DN', productIds: ['P-06'], period: 'Aug 2026', productionWindow: '04–15 Aug 2026', quantity: 5000, unit: 'm²', destinationMarket: 'European Union' },
  { id: 'BATCH-MIN-2608-A', name: 'Mineral Aggregate Batch 2608-A', industry: 'Mining & Minerals', facilityId: 'FAC-MN', productIds: ['P-09'], period: 'Aug 2026', productionWindow: '21–26 Aug 2026', quantity: 3000, unit: 't', destinationMarket: 'Vietnam' },
];

export interface DemoShipmentScope {
  id: string;
  name: string;
  industry: ReportingIndustry;
  facilityId: string;
  batchId: string;
  productIds: string[];
  period: string;
  origin: string;
  destination: string;
  destinationMarket: string;
  modes: string[];
  logisticsEmissionsTco2e: number;
}

export const demoShipmentScopes: DemoShipmentScope[] = [
  { id: 'SHIP-EU-ST-2608', name: 'HRC Hải Phòng → Rotterdam', industry: 'Steel', facilityId: 'FAC-HP', batchId: 'BATCH-ST-HRC-2608-A', productIds: ['P-03'], period: 'Aug 2026', origin: 'Hải Phòng, Vietnam', destination: 'Rotterdam, Netherlands', destinationMarket: 'European Union', modes: ['road', 'sea'], logisticsEmissionsTco2e: 94.6 },
  { id: 'SHIP-EU-RB-2608', name: 'Rebar Hải Phòng → Antwerp', industry: 'Steel', facilityId: 'FAC-HP', batchId: 'BATCH-ST-RB-2608-B', productIds: ['P-04'], period: 'Aug 2026', origin: 'Hải Phòng, Vietnam', destination: 'Antwerp, Belgium', destinationMarket: 'European Union', modes: ['road', 'sea'], logisticsEmissionsTco2e: 73.8 },
  { id: 'SHIP-EU-CEM-2608', name: 'PCB40 Ninh Bình → Hamburg', industry: 'Cement', facilityId: 'FAC-NB', batchId: 'BATCH-CEM-2608-A', productIds: ['P-05'], period: 'Aug 2026', origin: 'Ninh Bình, Vietnam', destination: 'Hamburg, Germany', destinationMarket: 'European Union', modes: ['road', 'sea'], logisticsEmissionsTco2e: 118.4 },
  { id: 'SHIP-EU-AL-2608', name: 'Aluminium Bà Rịa → Rotterdam', industry: 'Aluminium', facilityId: 'FAC-AL', batchId: 'BATCH-AL-2608-A', productIds: ['P-07'], period: 'Aug 2026', origin: 'Bà Rịa, Vietnam', destination: 'Rotterdam, Netherlands', destinationMarket: 'European Union', modes: ['road', 'sea'], logisticsEmissionsTco2e: 38.2 },
  { id: 'SHIP-EU-FERT-2608', name: 'Fertiliser Phú Mỹ → Valencia', industry: 'Chemicals', facilityId: 'FAC-CH', batchId: 'BATCH-FERT-2608-A', productIds: ['P-08'], period: 'Aug 2026', origin: 'Phú Mỹ, Vietnam', destination: 'Valencia, Spain', destinationMarket: 'European Union', modes: ['road', 'sea'], logisticsEmissionsTco2e: 49.5 },
  { id: 'SHIP-EU-AGR-2608', name: 'Robusta Đắk Lắk → Rotterdam', industry: 'Agriculture', facilityId: 'FAC-BD', batchId: 'BATCH-AGR-2608-A', productIds: ['P-01'], period: 'Aug 2026', origin: 'Đắk Lắk, Vietnam', destination: 'Rotterdam, Netherlands', destinationMarket: 'European Union', modes: ['road', 'sea'], logisticsEmissionsTco2e: 6.8 },
];

export const reportDemoScenarios = [
  { id: 'demo-steel-q3', industry: 'Steel' as ReportingIndustry, entityType: 'industry' as ReportEntityType, periodType: 'quarter' as ReportPeriodType, periodKey: 'Q3-2026-YTD', labelVi: 'Thép · Q3 2026 · CBAM', labelEn: 'Steel · Q3 2026 · CBAM' },
  { id: 'demo-hrc-product', industry: 'Steel' as ReportingIndustry, entityType: 'product' as ReportEntityType, entityId: 'P-03', periodType: 'month' as ReportPeriodType, periodKey: 'Aug 2026', labelVi: 'HRC · Aug 2026 · Product/CBAM', labelEn: 'HRC · Aug 2026 · Product/CBAM' },
  { id: 'demo-cement-batch', industry: 'Cement' as ReportingIndustry, entityType: 'batch' as ReportEntityType, entityId: 'BATCH-CEM-2608-A', periodType: 'month' as ReportPeriodType, periodKey: 'Aug 2026', labelVi: 'Xi măng · Lô xuất EU', labelEn: 'Cement · EU export batch' },
  { id: 'demo-al-shipment', industry: 'Aluminium' as ReportingIndustry, entityType: 'shipment' as ReportEntityType, entityId: 'SHIP-EU-AL-2608', periodType: 'month' as ReportPeriodType, periodKey: 'Aug 2026', labelVi: 'Nhôm · Shipment EU', labelEn: 'Aluminium · EU shipment' },
  { id: 'demo-agriculture-product', industry: 'Agriculture' as ReportingIndustry, entityType: 'product' as ReportEntityType, entityId: 'P-01', periodType: 'quarter' as ReportPeriodType, periodKey: 'Q3-2026-YTD', labelVi: 'Cà phê Robusta · Q3 · ISO 14067/EUDR', labelEn: 'Cà phê Robusta · Q3 · ISO 14067/EUDR' },
  { id: 'demo-fert-batch', industry: 'Chemicals' as ReportingIndustry, entityType: 'batch' as ReportEntityType, entityId: 'BATCH-FERT-2608-A', periodType: 'month' as ReportPeriodType, periodKey: 'Aug 2026', labelVi: 'Phân bón · Lô EU · CBAM', labelEn: 'Fertiliser · EU batch · CBAM' },
];
