import type { DemoSkuV2 } from "./demoPackV2";
import { computeSkuCarbonV2 } from "./reportBuilder";

export interface AuditPanelRowV2 {
  segment: string;
  detail: string;
  activity: number;
  factor: number;
  source: string;
  kgCo2e: number;
  isDefault?: boolean;
}

export interface AuditEvidenceV2 {
  kind: string;
  fileName: string;
  lookupCode: string;
  sha256: string;
}

export interface AuditPackPayloadV2 {
  sku: DemoSkuV2;
  totals: ReturnType<typeof computeSkuCarbonV2>;
  rows: AuditPanelRowV2[];
  evidence: AuditEvidenceV2[];
  methodology: string;
}

const FALLBACK_EVIDENCE: AuditEvidenceV2[] = [
  {
    kind: "EVN bill",
    fileName: "Hoa_don_dien_EVN_Thang4.pdf",
    lookupCode: "EVN-HN-009412",
    sha256: "19f3c68fabf151b798d6c3b9c58a7836b14e5ab01d6d8b19b7f4c44d2b34afb1"
  },
  {
    kind: "Material origin",
    fileName: "Phieu_nhap_kho_va_chung_nhan_nguon_goc_soi.pdf",
    lookupCode: "112455",
    sha256: "0ce6eb6f09f99a18405a98df89fbe847dcc8f33a28f6f0ae1d11e2f16ff209f9"
  }
];

export const buildAuditPackPayloadV2 = (sku: DemoSkuV2): AuditPackPayloadV2 => {
  const totals = computeSkuCarbonV2(sku);
  const materialRows = sku.materials.map((material) => ({
    segment: "Material",
    detail: material.name,
    activity: material.kgPerUnit,
    factor: material.co2ePerKg,
    source: material.source,
    kgCo2e: material.kgPerUnit * material.co2ePerKg,
    isDefault: material.isDefault
  }));
  const energyRows = sku.energy.map((energy) => ({
    segment: "Energy",
    detail: energy.source,
    activity: energy.kwhPerUnit,
    factor: energy.factor,
    source: energy.citation,
    kgCo2e: energy.kwhPerUnit * energy.factor,
    isDefault: false
  }));
  const transportRows = sku.transport.map((leg) => ({
    segment: "Transport",
    detail: leg.route || leg.mode,
    activity: leg.distanceKm * leg.weightTonnes,
    factor: leg.defraFactor,
    source: `DEFRA 2024 · ${leg.defraKey}`,
    kgCo2e: (leg.distanceKm * leg.weightTonnes * leg.defraFactor) / Math.max(1, sku.units),
    isDefault: false
  }));

  return {
    sku,
    totals,
    rows: [...materialRows, ...energyRows, ...transportRows].filter((row) => row.kgCo2e > 0),
    evidence: sku.evidence.length > 0 ? sku.evidence : FALLBACK_EVIDENCE,
    methodology: "ISO 14067:2018 · Ecoinvent v3.10 · DEFRA 2024 · Bộ TN&MT VN"
  };
};

export const buildAuditPackJsonV2 = (payload: AuditPackPayloadV2) => ({
  sku: payload.sku.sku,
  productName: payload.sku.name,
  locked: true,
  methodology: payload.methodology,
  totals: payload.totals,
  rows: payload.rows,
  evidence: payload.evidence
});

export const buildAuditRowsCsvV2 = (payload: AuditPackPayloadV2) => {
  const rows = [
    ["sku", "segment", "activity_data", "emission_factor", "source", "kg_co2e", "is_default"],
    ...payload.rows.map((row) => [
      payload.sku.sku,
      row.segment,
      row.activity.toFixed(3),
      row.factor.toFixed(4),
      row.source,
      row.kgCo2e.toFixed(3),
      row.isDefault ? "TRUE" : "FALSE"
    ])
  ];
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
};
