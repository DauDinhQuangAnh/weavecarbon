import type { DemoSkuV2 } from "./demoPackV2";
import { computeSkuCarbonV2 } from "./reportBuilder";
import { csvField } from "@/lib/reports/csv";
import type { AuthoritativeCarbonArtifactV2 } from "./productReportAdapter";

export interface AuditPanelRowV2 {
  segment: string;
  detail: string;
  activity: number;
  activityUnit: string;
  factor: number;
  factorUnit: string;
  factorId?: string;
  factorVersionId?: string;
  source: string;
  sourceUrl?: string;
  sourceYear?: number | null;
  geography?: string;
  allocation?: Record<string, unknown> | null;
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
  status: "blocked" | "internal_review" | "demo_preview";
  blockers: string[];
  immutable: false;
  assuranceStatus: "not_verified";
  carbonAuthority?: AuthoritativeCarbonArtifactV2["carbonAuthority"];
  carbonResults?: AuthoritativeCarbonArtifactV2["carbonResults"];
}

export interface BuildAuditPackOptionsV2 {
  allowDemoPreview?: boolean;
}

const buildPreviewRows = (sku: DemoSkuV2): AuditPanelRowV2[] => {
  const materialRows = sku.materials.map((material) => ({
    segment: "Material",
    detail: material.name,
    activity: material.kgPerUnit,
    activityUnit: "kg",
    factor: material.co2ePerKg,
    factorUnit: "kgCO2e/kg",
    source: material.source,
    kgCo2e: material.kgPerUnit * material.co2ePerKg,
    isDefault: material.isDefault
  }));
  const energyRows = sku.energy.map((energy) => ({
    segment: "Energy",
    detail: energy.source,
    activity: energy.kwhPerUnit,
    activityUnit: "kWh",
    factor: energy.factor,
    factorUnit: "kgCO2e/kWh",
    source: energy.citation,
    kgCo2e: energy.kwhPerUnit * energy.factor,
    isDefault: false
  }));
  const transportRows = sku.transport.map((leg) => ({
    segment: "Transport",
    detail: leg.route || leg.mode,
    activity: leg.distanceKm * leg.weightTonnes,
    activityUnit: "tonne.km",
    factor: leg.defraFactor,
    factorUnit: "kgCO2e/tonne.km",
    source: `DEFRA 2024 - ${leg.defraKey}`,
    kgCo2e: (leg.distanceKm * leg.weightTonnes * leg.defraFactor) / Math.max(1, sku.units),
    isDefault: false
  }));
  return [...materialRows, ...energyRows, ...transportRows].filter((row) => row.kgCo2e > 0);
};

export const buildAuditPackPayloadV2 = (
  sku: DemoSkuV2,
  authoritative: AuthoritativeCarbonArtifactV2 | null = null,
  options: BuildAuditPackOptionsV2 = {}
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
  const evidence = sku.evidence.filter((item) => /^[a-f0-9]{64}$/i.test(item.sha256));
  const authoritativeRows = (authoritative?.carbonResults.calculationTerms || []).map((term) => ({
    segment: term.stage,
    detail: term.detail,
    activity: term.activity,
    activityUnit: term.activityUnit,
    factor: term.factorValue,
    factorUnit: term.factorUnit,
    factorId: term.factorId,
    factorVersionId: term.factorVersionId,
    source: term.source,
    sourceUrl: term.sourceUrl,
    sourceYear: term.sourceYear,
    geography: term.geography,
    allocation: term.allocation,
    kgCo2e: term.kgCo2e,
    isDefault: term.isProxy
  }));
  const rows = options.allowDemoPreview ? buildPreviewRows(sku) : authoritativeRows;
  const blockers: string[] = [];
  if (!options.allowDemoPreview && !authoritative) {
    blockers.push("Thiếu phép tính carbon có định danh máy chủ.");
  }
  if (!options.allowDemoPreview && authoritativeRows.length === 0) {
    blockers.push("Chưa có dữ liệu hoạt động × hệ số phát thải gốc; không được thay bằng tổng phát thải × 1.");
  }
  if (!options.allowDemoPreview && evidence.length === 0) {
    blockers.push("Chưa có bằng chứng đã duyệt kèm SHA-256 thực.");
  }

  return {
    sku,
    totals,
    rows,
    evidence,
    methodology: options.allowDemoPreview
      ? "DEMO PREVIEW — dữ liệu minh họa, không dùng đối ngoại"
      : "WeaveCarbon climate-only partial CFP — tham chiếu ISO 14067, chưa được đảm bảo độc lập",
    status: options.allowDemoPreview ? "demo_preview" : (blockers.length ? "blocked" : "internal_review"),
    blockers,
    immutable: false,
    assuranceStatus: "not_verified",
    carbonAuthority: authoritative?.carbonAuthority,
    carbonResults: authoritative?.carbonResults
  };
};

export const buildAuditPackJsonV2 = (payload: AuditPackPayloadV2) => ({
  sku: payload.sku.sku,
  productName: payload.sku.name,
  status: payload.status,
  blockers: payload.blockers,
  locked: false,
  immutable: payload.immutable,
  assuranceStatus: payload.assuranceStatus,
  methodology: payload.methodology,
  carbonAuthority: payload.carbonAuthority,
  carbonResults: payload.carbonResults,
  totals: payload.totals,
  rows: payload.rows,
  evidence: payload.evidence
});

export const buildAuditRowsCsvV2 = (payload: AuditPackPayloadV2) => {
  const rows = [
    ["sku", "calculation_id", "calculation_version", "engine_version", "methodology_version", "factor_registry_version", "gwp_basis", "canonical_input_hash", "is_legacy", "segment", "detail", "activity_data", "activity_unit", "factor_id", "factor_version_id", "emission_factor", "factor_unit", "source", "source_url", "source_year", "geography", "allocation", "kg_co2e", "is_proxy"],
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
      row.detail,
      row.activity.toFixed(3),
      row.activityUnit,
      row.factorId || "",
      row.factorVersionId || "",
      row.factor.toFixed(4),
      row.factorUnit,
      row.source,
      row.sourceUrl || "",
      row.sourceYear || "",
      row.geography || "",
      row.allocation ? JSON.stringify(row.allocation) : "",
      row.kgCo2e.toFixed(3),
      row.isDefault ? "TRUE" : "FALSE"
    ])
  ];
  return rows.map((row) => row.map((cell) => csvField(cell)).join(",")).join("\n");
};
