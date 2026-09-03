import type { DemoSkuV2 } from "./demoPackV2";
import { computeSkuCarbonV2 } from "./reportBuilder";
import { csvField } from "@/lib/reports/csv";
import type { AuthoritativeCarbonArtifactV2 } from "./productReportAdapter";

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
  carbonAuthority?: AuthoritativeCarbonArtifactV2["carbonAuthority"];
  carbonResults?: AuthoritativeCarbonArtifactV2["carbonResults"];
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

const buildPreviewRows = (sku: DemoSkuV2): AuditPanelRowV2[] => {
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
    source: `DEFRA 2024 - ${leg.defraKey}`,
    kgCo2e: (leg.distanceKm * leg.weightTonnes * leg.defraFactor) / Math.max(1, sku.units),
    isDefault: false
  }));
  return [...materialRows, ...energyRows, ...transportRows].filter((row) => row.kgCo2e > 0);
};

export const buildAuditPackPayloadV2 = (
  sku: DemoSkuV2,
  authoritative: AuthoritativeCarbonArtifactV2 | null = null
): AuditPackPayloadV2 => {
  const previewTotals = computeSkuCarbonV2(sku);
  const perProduct = authoritative?.carbonResults.perProduct;
  const totals = perProduct
    ? {
        ...previewTotals,
        materials: perProduct.materials,
        energy: perProduct.energy,
        transport: perProduct.transport,
        scope1: perProduct.production,
        total: perProduct.total,
        batchTonnes: Number(
          ((authoritative.carbonResults.totalBatch?.total ?? perProduct.total * sku.units) / 1000)
            .toFixed(6)
        )
      }
    : previewTotals;
  const rows: AuditPanelRowV2[] = perProduct
    ? [
        ["Materials", perProduct.materials],
        ["Finished goods manufacturing", perProduct.production],
        ["Energy", perProduct.energy],
        ["Logistics and storage", perProduct.transport],
        ["Packaging", perProduct.packaging || 0]
      ].filter(([, value]) => Number(value) > 0).map(([segment, value]) => ({
        segment: String(segment),
        detail: "Server-authoritative product assessment",
        activity: Number(value),
        factor: 1,
        source: authoritative.carbonAuthority.source,
        kgCo2e: Number(value),
        isDefault: false
      }))
    : buildPreviewRows(sku);

  return {
    sku,
    totals,
    rows,
    evidence: sku.evidence.length > 0 ? sku.evidence : FALLBACK_EVIDENCE,
    methodology: "ISO 14067:2018 - server-authoritative WeaveCarbon calculation",
    carbonAuthority: authoritative?.carbonAuthority,
    carbonResults: authoritative?.carbonResults
  };
};

export const buildAuditPackJsonV2 = (payload: AuditPackPayloadV2) => ({
  sku: payload.sku.sku,
  productName: payload.sku.name,
  locked: true,
  methodology: payload.methodology,
  carbonAuthority: payload.carbonAuthority,
  carbonResults: payload.carbonResults,
  totals: payload.totals,
  rows: payload.rows,
  evidence: payload.evidence
});

export const buildAuditRowsCsvV2 = (payload: AuditPackPayloadV2) => {
  const rows = [
    ["sku", "calculation_id", "calculation_version", "engine_version", "methodology_version", "factor_registry_version", "gwp_basis", "canonical_input_hash", "is_legacy", "segment", "activity_data", "emission_factor", "source", "kg_co2e", "is_default"],
    ...payload.rows.map((row) => [
      payload.sku.sku,
      payload.carbonAuthority?.calculationId || "demo-preview",
      payload.carbonAuthority?.calculationVersion || "",
      payload.carbonAuthority?.engineVersion || "",
      payload.carbonAuthority?.methodologyVersion || "",
      payload.carbonAuthority?.factorRegistryVersion || "",
      payload.carbonAuthority?.gwpBasis || "",
      payload.carbonAuthority?.canonicalInputHash || "",
      payload.carbonAuthority?.legacy ? "TRUE" : "FALSE",
      row.segment,
      row.activity.toFixed(3),
      row.factor.toFixed(4),
      row.source,
      row.kgCo2e.toFixed(3),
      row.isDefault ? "TRUE" : "FALSE"
    ])
  ];
  return rows.map((row) => row.map((cell) => csvField(cell)).join(",")).join("\n");
};
