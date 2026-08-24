import { DEMO_FACILITY_V2, DEMO_PACK_V2, type DemoSkuV2 } from "./demoPackV2";
import { OFFICIAL_CBAM_TABS, REPORT_SOURCES_V2, WEAVE_V2_COLORS } from "./reportTemplate";

export interface ReportBreakdownRowV2 {
  stage: string;
  activity: string;
  amount: number;
  unit: string;
  source: string;
  kgCo2e: number;
  color: string;
  isDefault?: boolean;
  formula: string;
}

export interface ReportPayloadV2 {
  sku: DemoSkuV2;
  facility: typeof DEMO_FACILITY_V2;
  generatedAt: string;
  totals: {
    pcfKgPerUnit: number;
    optimalKgPerUnit: number;
    cbamRiskEurPerUnit: number;
    batchTonnes: number;
  };
  breakdownRows: ReportBreakdownRowV2[];
  pieData: Array<{ name: string; value: number; color: string }>;
  esgRows: Array<Record<string, string | number>>;
  cbamRows: Array<Record<string, string | number>>;
  officialCbamRows: Record<(typeof OFFICIAL_CBAM_TABS)[number], Array<Record<string, string | number>>>;
  evidence: DemoSkuV2["evidence"];
  sources: string[];
  colors: typeof WEAVE_V2_COLORS;
}

const round = (value: number, digits = 3) => Number(value.toFixed(digits));

export function computeSkuCarbonV2(sku: DemoSkuV2) {
  const materials = sku.materials.reduce((sum, item) => sum + item.kgPerUnit * item.co2ePerKg, 0);
  const energy = sku.energy.reduce((sum, item) => sum + item.kwhPerUnit * item.factor, 0);
  const transportTotalKg = sku.transport.reduce(
    (sum, leg) => sum + leg.distanceKm * leg.weightTonnes * leg.defraFactor,
    0
  );
  const transport = transportTotalKg / Math.max(1, sku.units);
  const scope1 = sku.scope1KgCo2eBatch / Math.max(1, sku.units);
  const total = materials + energy + transport + scope1;
  const gap = sku.materials
    .filter((item) => item.isDefault)
    .reduce((sum, item) => sum + item.kgPerUnit * item.co2ePerKg, 0);

  return {
    materials,
    energy,
    transport,
    scope1,
    gap,
    total,
    optimal: Math.max(total - gap * 0.31, 0),
    batchTonnes: (total * sku.units) / 1000
  };
}

export function buildReportPayloadV2(
  sku: DemoSkuV2 = DEMO_PACK_V2[0],
  facility: typeof DEMO_FACILITY_V2 = DEMO_FACILITY_V2
): ReportPayloadV2 {
  const computed = computeSkuCarbonV2(sku);
  const materialRows: ReportBreakdownRowV2[] = sku.materials.map((material) => ({
    stage: material.isDefault ? "4. Khuyết dữ liệu" : "1. Nguyên liệu",
    activity: material.name,
    amount: material.kgPerUnit,
    unit: "kg",
    source: material.source,
    kgCo2e: material.kgPerUnit * material.co2ePerKg,
    color: material.color,
    isDefault: material.isDefault,
    formula: `${material.kgPerUnit} kg × ${material.co2ePerKg} kg CO2e/kg`
  }));
  const energyRows = sku.energy.map((energy) => ({
    stage: "2. Năng lượng",
    activity: energy.source,
    amount: energy.kwhPerUnit,
    unit: "kWh",
    source: energy.citation,
    kgCo2e: energy.kwhPerUnit * energy.factor,
    color: WEAVE_V2_COLORS.success,
    formula: `${energy.kwhPerUnit} kWh × ${energy.factor} kg CO2e/kWh`
  }));
  const transportKg = computed.transport;
  const transportRows: ReportBreakdownRowV2[] = [
    {
      stage: "3. Vận chuyển",
      activity: sku.transport.map((leg) => leg.mode === "sea" ? "Sea freight" : leg.mode).join(" + "),
      amount: round(sku.transport.reduce((sum, leg) => sum + leg.distanceKm * leg.weightTonnes, 0), 3),
      unit: "tấn-km",
      source: "UK DEFRA 2024",
      kgCo2e: transportKg,
      color: "#219E9A",
      formula: "Σ(distance_km × weight_tonnes × DEFRA factor) / units"
    }
  ];

  // Scope 1 (facility direct emissions) is part of the PCF total, so it must appear
  // as a line item — otherwise the breakdown rows don't sum to totals.pcfKgPerUnit.
  const scope1Rows: ReportBreakdownRowV2[] =
    computed.scope1 > 0
      ? [
          {
            stage: "5. Phát thải cơ sở (Scope 1)",
            activity: "Nhiên liệu & quy trình tại cơ sở",
            amount: round(computed.scope1, 3),
            unit: "kg CO2e",
            source: "Facility fuel/process estimate",
            kgCo2e: computed.scope1,
            color: WEAVE_V2_COLORS.formula,
            formula: "scope1_kg_co2e_batch / units"
          }
        ]
      : [];

  const breakdownRows = [...materialRows, ...energyRows, ...transportRows, ...scope1Rows];
  const totalPositive = Math.max(computed.total, 0.0001);
  const pieData = [
    { name: "Nguyên liệu", value: round((computed.materials / totalPositive) * 100, 1), color: "#06C167" },
    { name: "Năng lượng", value: round((computed.energy / totalPositive) * 100, 1), color: WEAVE_V2_COLORS.success },
    { name: "Vận chuyển", value: round((computed.transport / totalPositive) * 100, 1), color: "#219E9A" },
    { name: "Khuyết dữ liệu", value: round((computed.gap / totalPositive) * 100, 1), color: "#EF4444" }
  ];

  return {
    sku,
    facility,
    generatedAt: new Date().toISOString(),
    totals: {
      pcfKgPerUnit: round(computed.total, 3),
      optimalKgPerUnit: round(computed.optimal, 3),
      cbamRiskEurPerUnit: sku.cbamPenaltyEurPerUnit,
      batchTonnes: round(computed.batchTonnes, 4)
    },
    breakdownRows,
    pieData,
    esgRows: [
      { scope: "Scope 1", tCO2e: round(sku.scope1KgCo2eBatch / 1000, 4), source: "Facility fuel/process estimate" },
      { scope: "Scope 2", tCO2e: round((computed.energy * sku.units) / 1000, 4), source: "EVN grid bill allocation" },
      { scope: "Scope 3", tCO2e: round(((computed.materials + computed.transport) * sku.units) / 1000, 4), source: "Materials + DEFRA transport" }
    ],
    cbamRows: [
      { field: "CN code", value: sku.cnCode },
      { field: "Route", value: sku.routeCode },
      { field: "Direct embedded emissions", value: round((computed.scope1 * sku.units) / 1000, 4), unit: "tCO2e" },
      { field: "Indirect embedded emissions", value: round((computed.energy * sku.units) / 1000, 4), unit: "tCO2e" },
      { field: "Total embedded emissions", value: round(computed.batchTonnes, 4), unit: "tCO2e" },
      { field: "CBAM risk simulation", value: sku.cbamPenaltyEurPerUnit, unit: "EUR/product" }
    ],
    officialCbamRows: {
      A_INSTDATA: [
        { field: "Installation name", value: DEMO_FACILITY_V2.name },
        { field: "Address", value: DEMO_FACILITY_V2.address },
        { field: "NACE", value: DEMO_FACILITY_V2.naceCode },
        { field: "UN/LOCODE", value: DEMO_FACILITY_V2.unLocode },
        { field: "Verifier", value: DEMO_FACILITY_V2.verifier }
      ],
      B_EMINST: [
        { field: "Scope 1 emissions", value: round(sku.scope1KgCo2eBatch / 1000, 4), unit: "tCO2e" },
        { field: "Scope 2 emissions", value: round((computed.energy * sku.units) / 1000, 4), unit: "tCO2e" }
      ],
      C_EMISSIONS_ENERGY: sku.energy.map((item) => ({
        energy_source: item.source,
        activity_kwh_per_unit: item.kwhPerUnit,
        factor: item.factor,
        source: item.citation
      })),
      D_PROCESSES: breakdownRows.map((row) => ({
        process: row.stage,
        activity: row.activity,
        amount: row.amount,
        unit: row.unit,
        kg_co2e: round(row.kgCo2e, 4),
        formula: row.formula
      })),
      E_PURCHPREC: [
        { precursor_hs: "5208", supplier_country: "CN", direct_tco2e_per_tonne: 1.12, indirect_tco2e_per_tonne: 0.1772, carbon_price_paid: "45 CNY/tCO2" }
      ],
      SUMMARY_COMMUNICATION: [
        { cn_code: sku.cnCode, sku: sku.sku, route: sku.routeCode, embedded_tco2e: round(computed.batchTonnes, 4), determination: "(D)" }
      ]
    },
    evidence: sku.evidence,
    sources: REPORT_SOURCES_V2,
    colors: WEAVE_V2_COLORS
  };
}
