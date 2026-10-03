import {
  type BulkProductRow,
  type ValidationError,
  type ValidationResult
} from "./types";
import { calculateCarbonForProduct } from "./carbonCalculation";
import { fetchComplianceMarkets } from "@/lib/exportComplianceApi";
import {
  filterExportComplianceDocuments,
  filterMaterialCertificationDocuments
} from "@/lib/complianceDocumentGroups";
import {
  MATERIAL_CERTIFICATION_DOCUMENT_CODE_BY_VALUE,
  MATERIAL_CERTIFICATION_LABEL_BY_VALUE,
  normalizeMaterialCertificationValue,
  normalizeMaterialCertificationDocumentCode
} from "@/lib/materialCertificationDefinitions";
import { suggestMaterialCertificationCodes } from "@/lib/materialCertificationSuggestions";

export const DESTINATION_MARKET_BY_EXPORT_COUNTRY: Record<string, string> = {
  eu: "eu",
  us: "usa",
  jp: "japan",
  kr: "korea",
  other: "other"
};

export const DISTANCE_BY_DESTINATION_MARKET: Record<string, number> = {
  vietnam: 500,
  eu: 10000,
  usa: 14000,
  japan: 3500,
  korea: 3200,
  other: 5000
};

export const COUNTRY_BY_DESTINATION_MARKET: Record<string, string> = {
  vietnam: "Vietnam",
  eu: "Germany",
  usa: "United States",
  japan: "Japan",
  korea: "Korea",
  china: "China",
  other: "Other"
};

export const DESTINATION_MARKET_ALIASES: Record<string, string> = {
  vn: "vietnam",
  vietnam: "vietnam",
  domestic: "vietnam",
  us: "usa",
  usa: "usa",
  jp: "japan",
  japan: "japan",
  kr: "korea",
  korea: "korea",
  eu: "eu",
  cn: "china",
  china: "china",
  other: "other"
};

export const DESTINATION_MARKET_TO_COMPLIANCE_CODE: Record<string, string> = {
  vietnam: "VN",
  vn: "VN",
  usa: "US",
  us: "US",
  korea: "KR",
  kr: "KR",
  japan: "JP",
  jp: "JP",
  eu: "EU",
  china: "CN",
  cn: "CN",
  australia: "AU",
  au: "AU",
  asean: "ASEAN",
  th: "TH",
  thailand: "TH",
  sg: "SG",
  singapore: "SG",
  my: "MY",
  malaysia: "MY",
  id: "ID",
  indonesia: "ID",
  ph: "PH",
  philippines: "PH",
  ca: "CA",
  canada: "CA",
  uk: "UK",
  in: "IN",
  india: "IN"
};

export const READY_DOCUMENT_STATUS_SET = new Set(["uploaded", "approved"]);

export const MATERIAL_CERTIFICATION_VALUE_SET = new Set(
  Object.keys(MATERIAL_CERTIFICATION_DOCUMENT_CODE_BY_VALUE)
    .map((value) => normalizeMaterialCertificationValue(value))
    .filter(Boolean)
);

export const normalizeDestinationMarket = (value: string | null | undefined): string => {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return "";
  return DESTINATION_MARKET_ALIASES[normalized] || normalized;
};

export const resolveDestinationMarket = (
  row: BulkProductRow,
  forcedDomesticMarket?: string | null
): string => {
  const forcedMarket = normalizeDestinationMarket(forcedDomesticMarket);
  if (forcedMarket) return forcedMarket;
  if (row.marketType === "domestic") return "vietnam";
  if (!row.exportCountry) return "other";
  return DESTINATION_MARKET_BY_EXPORT_COUNTRY[row.exportCountry] || "other";
};

export const resolveEstimatedDistance = (
  destinationMarket: string,
  transportDistanceKm?: number
): number => {
  if (typeof transportDistanceKm === "number" && Number.isFinite(transportDistanceKm) && transportDistanceKm > 0) {
    return transportDistanceKm;
  }
  return DISTANCE_BY_DESTINATION_MARKET[destinationMarket] || 5000;
};

export const resolveTransportLegMode = (
  mode: BulkProductRow["transportMode"]
): "road" | "sea" | "air" | "rail" | undefined =>
  mode ? (mode === "multimodal" ? "sea" : mode) : undefined;

export const LEGACY_MATERIAL_TO_CATALOG_ID: Record<string, string> = {
  cotton: "cat-cotton-100",
  organic_cotton: "cat-cotton-organic",
  recycled_cotton: "cat-cotton-recycled",
  polyester: "cat-polyester-100",
  recycled_polyester: "cat-polyester-recycled",
  wool: "cat-wool-100",
  silk: "cat-silk-100",
  linen: "cat-linen-100",
  nylon: "cat-nylon-100",
  bamboo: "cat-bamboo",
  hemp: "cat-hemp",
  tencel: "cat-tencel",
  viscose: "cat-viscose",
  blend: "cat-blend-cotton-poly"
};

export const ACCESSORY_TYPE_ALIASES: Record<string, "button" | "zipper" | "thread" | "label" | "elastic" | "lining" | "padding" | "other"> = {
  button: "button",
  nut: "button",
  zipper: "zipper",
  khoakeo: "zipper",
  thread: "thread",
  chimay: "thread",
  label: "label",
  nhanhmac: "label",
  elastic: "elastic",
  thun: "elastic",
  lining: "lining",
  vailot: "lining",
  padding: "padding",
  dem: "padding",
  mut: "padding",
  other: "other",
  khac: "other"
};

export const WASTE_RECOVERY_ALIASES: Record<string, "none" | "partial" | "full" | "circular"> = {
  none: "none",
  no: "none",
  khong: "none",
  norecovery: "none",
  partial: "partial",
  partly: "partial",
  motphan: "partial",
  full: "full",
  complete: "full",
  toanphan: "full",
  circular: "circular",
  circularity: "circular",
  closedloop: "circular",
  tuanhoan: "circular"
};

export const normalizeToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

export const splitCommaValues = (value?: string) =>
  (value || "")
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

export const normalizeDocumentToken = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export interface ComplianceAvailabilitySnapshot {
  loaded: boolean;
  materialReadyDocumentCodes: Set<string>;
  exportReadyDocumentTokensByMarketCode: Map<string, Set<string>>;
  exportMissingRequiredByMarketCode: Map<string, string[]>;
}

export const resolveComplianceMarketCodeForRow = (
  row: BulkProductRow,
  forcedDomesticMarket?: string | null
): string | null => {
  const destinationMarket = resolveDestinationMarket(row, forcedDomesticMarket);
  const marketToken = normalizeDestinationMarket(destinationMarket);
  return DESTINATION_MARKET_TO_COMPLIANCE_CODE[marketToken] || null;
};

export const createEmptyComplianceAvailabilitySnapshot = (
  loaded = false
): ComplianceAvailabilitySnapshot => ({
  loaded,
  materialReadyDocumentCodes: new Set<string>(),
  exportReadyDocumentTokensByMarketCode: new Map<string, Set<string>>(),
  exportMissingRequiredByMarketCode: new Map<string, string[]>()
});

export const loadComplianceAvailability = async (): Promise<ComplianceAvailabilitySnapshot> => {
  try {
    const markets = await fetchComplianceMarkets();
    const snapshot = createEmptyComplianceAvailabilitySnapshot(true);

    for (const [marketCode, market] of Object.entries(markets)) {
      const exportDocuments = filterExportComplianceDocuments(market.documents);
      const materialDocuments = filterMaterialCertificationDocuments(market.documents);

      const readyExportTokens = new Set<string>();
      for (const document of exportDocuments) {
        const status = String(document.status || "").trim().toLowerCase();
        if (!READY_DOCUMENT_STATUS_SET.has(status)) continue;
        readyExportTokens.add(normalizeDocumentToken(document.code));
        readyExportTokens.add(normalizeDocumentToken(document.id));
        readyExportTokens.add(normalizeDocumentToken(document.name));
      }
      snapshot.exportReadyDocumentTokensByMarketCode.set(marketCode, readyExportTokens);
      snapshot.exportMissingRequiredByMarketCode.set(
        marketCode,
        market.requiredDocuments.filter(
          (requiredName) => !readyExportTokens.has(normalizeDocumentToken(requiredName))
        )
      );

      for (const document of materialDocuments) {
        const status = String(document.status || "").trim().toLowerCase();
        if (!READY_DOCUMENT_STATUS_SET.has(status)) continue;
        const normalizedCode = normalizeMaterialCertificationDocumentCode(
          document.code || document.id
        );
        if (normalizedCode) {
          snapshot.materialReadyDocumentCodes.add(normalizedCode);
        }
      }
    }

    return snapshot;
  } catch {
    return createEmptyComplianceAvailabilitySnapshot(false);
  }
};

export const resolveCatalogMaterialId = (materialType: string): string | undefined => {
  const key = materialType.trim().toLowerCase();
  if (!key) return undefined;
  if (key.startsWith("cat-")) return materialType;
  return LEGACY_MATERIAL_TO_CATALOG_ID[key];
};

export const resolveAccessoryType = (nameOrType: string) => {
  const key = normalizeToken(nameOrType);
  if (!key) return "other" as const;
  return ACCESSORY_TYPE_ALIASES[key] || "other";
};

export const parsePositiveNumber = (value: string): number | undefined => {
  const normalized = value.replace(/,/g, ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
};

export const resolveCertificationCode = (value: string): string => {
  return normalizeMaterialCertificationValue(value);
};

export const parseMaterialCertificationInput = (rawCertifications?: string) => {
  const parsed = splitCommaValues(rawCertifications)
    .map((rawValue) => ({
      rawValue,
      normalizedValue: resolveCertificationCode(rawValue)
    }))
    .filter((entry) => entry.normalizedValue.length > 0);

  const knownValues: string[] = [];
  const unknownValues: string[] = [];
  for (const entry of parsed) {
    if (MATERIAL_CERTIFICATION_VALUE_SET.has(entry.normalizedValue)) {
      knownValues.push(entry.normalizedValue);
      continue;
    }
    unknownValues.push(entry.rawValue);
  }

  return {
    knownValues: Array.from(new Set(knownValues)),
    unknownValues: Array.from(new Set(unknownValues))
  };
};

export const buildCertifications = (rawCertifications?: string): string[] => {
  return parseMaterialCertificationInput(rawCertifications).knownValues;
};

export const buildAccessories = (
  rawAccessories?: string,
  rawAccessoryWeights?: string
) => {
  const accessoryNames = splitCommaValues(rawAccessories);
  if (accessoryNames.length === 0) return [];

  const accessoryWeights = splitCommaValues(rawAccessoryWeights).map((weight) =>
    parsePositiveNumber(weight)
  );

  return accessoryNames.map((item, index) => ({
    id: `accessory-${index + 1}`,
    name: item,
    type: resolveAccessoryType(item),
    ...(typeof accessoryWeights[index] === "number" ? { weight: accessoryWeights[index] } : {})
  }));
};

export const buildMaterials = (row: BulkProductRow) => {
  const materialCertifications = buildCertifications(row.certifications);
  const primaryCatalogMaterialId = resolveCatalogMaterialId(row.primaryMaterial);
  const materials = [
    {
      id: "material-1",
      materialType: primaryCatalogMaterialId || row.primaryMaterial,
      ...(primaryCatalogMaterialId ? { catalogMaterialId: primaryCatalogMaterialId } : {}),
      percentage: row.primaryMaterialPercentage,
      source: row.materialSource,
      certifications: materialCertifications
    }
  ];

  if (
    row.secondaryMaterial &&
    typeof row.secondaryMaterialPercentage === "number" &&
    row.secondaryMaterialPercentage > 0
  ) {
    const secondaryCatalogMaterialId = resolveCatalogMaterialId(row.secondaryMaterial);
    materials.push({
      id: "material-2",
      materialType: secondaryCatalogMaterialId || row.secondaryMaterial,
      ...(secondaryCatalogMaterialId ? { catalogMaterialId: secondaryCatalogMaterialId } : {}),
      percentage: row.secondaryMaterialPercentage,
      source: row.materialSource,
      certifications: materialCertifications
    });
  }

  return materials;
};

export const trimImportValue = (value?: string) => (value || "").trim();

export const inferAddressFromText = (fullAddress?: string) => {
  const normalizedAddress = trimImportValue(fullAddress);
  const segments = normalizedAddress
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return {
      street: "",
      city: "",
      stateRegion: "",
      country: ""
    };
  }

  if (segments.length === 1) {
    return {
      street: segments[0],
      city: "",
      stateRegion: "",
      country: ""
    };
  }

  if (segments.length === 2) {
    return {
      street: segments[0],
      city: "",
      stateRegion: "",
      country: segments[1]
    };
  }

  if (segments.length === 3) {
    return {
      street: segments[0],
      city: segments[1],
      stateRegion: "",
      country: segments[2]
    };
  }

  return {
    street: segments.slice(0, -3).join(", "),
    city: segments[segments.length - 3] || "",
    stateRegion: segments[segments.length - 2] || "",
    country: segments[segments.length - 1] || ""
  };
};

export const buildAddressFromImport = (
  {
    fullAddress,
    city,
    stateRegion,
    country
  }: {
    fullAddress?: string;
    city?: string;
    stateRegion?: string;
    country?: string;
  },
  fallbackCountry = ""
) => {
  const normalizedAddress = trimImportValue(fullAddress);
  const normalizedCity = trimImportValue(city);
  const normalizedStateRegion = trimImportValue(stateRegion);
  const normalizedCountry = trimImportValue(country);
  const inferredAddress = inferAddressFromText(normalizedAddress);
  const hasAnyAddressValue = Boolean(
    normalizedAddress ||
    normalizedCity ||
    normalizedStateRegion ||
    normalizedCountry
  );

  return {
    streetNumber: "",
    street: inferredAddress.street || normalizedAddress,
    ward: "",
    district: "",
    city: normalizedCity || inferredAddress.city,
    stateRegion: normalizedStateRegion || inferredAddress.stateRegion,
    country:
      normalizedCountry ||
      inferredAddress.country ||
      (hasAnyAddressValue ? fallbackCountry : ""),
    postalCode: ""
  };
};

export const hasAddressData = (
  address: {
    street?: string;
    city?: string;
    stateRegion?: string;
    country?: string;
  }
) =>
  [address.street, address.city, address.stateRegion, address.country]
    .some((value) => trimImportValue(value).length > 0);

export const normalizeWasteRecovery = (value?: string): string | undefined => {
  const raw = (value || "").trim();
  if (!raw) return undefined;

  const compactToken = normalizeToken(raw);
  const mapped = WASTE_RECOVERY_ALIASES[compactToken];
  if (mapped) return mapped;

  const percentMatch = raw.match(/-?\d+(?:[.,]\d+)?/);
  if (!percentMatch) return raw;
  const parsed = Number(percentMatch[0].replace(",", "."));
  if (!Number.isFinite(parsed)) return raw;
  if (parsed <= 0) return "none";
  if (parsed >= 80) return "full";
  return "partial";
};

export const buildCarbonResults = (row: BulkProductRow) => {
  const computed = calculateCarbonForProduct(row);
  const safeQuantity = Number.isFinite(row.quantity) && row.quantity > 0 ? row.quantity : 1;
  const confidenceLevel = row.confidenceLevel || computed.confidenceLevel;

  const perProduct = {
    materials: computed.materialsCO2,
    production: computed.manufacturingCO2,
    energy: computed.energyCO2,
    transport: computed.transportCO2,
    packaging: computed.packagingCO2,
    total: computed.totalCO2
  };

  return {
    perProduct,
    totalBatch: {
      materials: perProduct.materials * safeQuantity,
      production: perProduct.production * safeQuantity,
      energy: perProduct.energy * safeQuantity,
      transport: perProduct.transport * safeQuantity,
      packaging: perProduct.packaging * safeQuantity,
      total: perProduct.total * safeQuantity
    },
    confidenceLevel,
    confidenceScore: computed.confidenceScore,
    proxyUsed: computed.proxyUsed,
    proxyNotes: computed.proxyNotes,
    scope1: computed.scope1,
    scope2: computed.scope2,
    scope3: computed.scope3,
    co2eRange: computed.co2eRange,
    methodologyVersion: computed.methodologyVersion,
    assumptionsUsed: computed.assumptionsUsed,
    factorSourceSummary: computed.factorSourceSummary,
    dataQualityBreakdown: computed.dataQualityBreakdown
  };
};

export const mapBulkRowToApiPayload = (
  row: BulkProductRow,
  forcedDomesticMarket?: string | null
): Record<string, unknown> => {
  const destinationMarket = resolveDestinationMarket(row, forcedDomesticMarket);
  const transportMode = resolveTransportLegMode(row.transportMode);
  const estimatedTotalDistance =
    transportMode ?
      resolveEstimatedDistance(destinationMarket, row.transportDistanceKm) :
      0;
  const isForcedDomestic = Boolean(normalizeDestinationMarket(forcedDomesticMarket));
  const normalizedMarketType = isForcedDomestic ? "domestic" : row.marketType;
  const normalizedExportCountry = isForcedDomestic ? undefined : row.exportCountry;
  const exportComplianceDocuments =
    normalizedMarketType === "export" ? splitCommaValues(row.exportComplianceDocuments) : [];
  const normalizedWasteRecovery = normalizeWasteRecovery(row.wasteRecovery);
  const defaultDestinationCountry =
    COUNTRY_BY_DESTINATION_MARKET[destinationMarket] || "Other";
  const originAddress = buildAddressFromImport(
    {
      fullAddress: row.transportOrigin,
      city: row.transportOriginCity,
      stateRegion: row.transportOriginStateRegion,
      country: row.transportOriginCountry
    },
    "Vietnam"
  );
  const destinationAddress = buildAddressFromImport(
    {
      fullAddress: row.transportDestination,
      city: row.transportDestinationCity,
      stateRegion: row.transportDestinationStateRegion,
      country: row.transportDestinationCountry
    },
    defaultDestinationCountry
  );
  const hasOriginAddressValue = hasAddressData(originAddress);
  const hasDestinationAddressValue = hasAddressData(destinationAddress);
  const materials = buildMaterials(row);
  const accessories = buildAccessories(row.accessories, row.accessoriesWeightGram);
  const certifications = buildCertifications(row.certifications);
  const productionProcesses = row.processes || [];
  const carbonResults = buildCarbonResults(row);
  const energySources = [
    {
      id: "energy-1",
      source: row.energySource,
      percentage: 100
    }
  ];
  const transportLegs = transportMode ?
    [
      {
        id: "leg-1",
        mode: transportMode,
        estimatedDistance: estimatedTotalDistance,
        originLocation: row.transportOrigin,
        destinationLocation: row.transportDestination
      }
    ] :
    [];

  const payload: Record<string, unknown> = {
    sku: row.sku,
    productCode: row.sku,
    product_code: row.sku,
    productName: row.productName,
    product_name: row.productName,
    productType: row.productType,
    product_type: row.productType,
    hsCode: row.hsCode || row.cnCode,
    hs_code: row.hsCode || row.cnCode,
    cnCode: row.cnCode || row.hsCode,
    cn_code: row.cnCode || row.hsCode,
    facility: row.facility,
    evidenceLookupCode: row.evidenceLookupCode,
    evidence_lookup_code: row.evidenceLookupCode,
    supplierCountry: row.supplierCountry,
    supplier_country: row.supplierCountry,
    supplyGap: row.supplyGap,
    supply_gap: row.supplyGap,
    customsDeclarationNo: row.customsDeclarationNo,
    customs_declaration_no: row.customsDeclarationNo,
    poContractId: row.poContractId,
    po_contract_id: row.poContractId,
    billOfLadingNo: row.billOfLadingNo,
    bill_of_lading_no: row.billOfLadingNo,
    containerNo: row.containerNo,
    container_no: row.containerNo,
    quantity: row.quantity,
    weightPerUnit: row.weightPerUnit,
    weight_per_unit: row.weightPerUnit,
    primaryMaterial: row.primaryMaterial,
    primaryMaterialPercentage: row.primaryMaterialPercentage,
    secondaryMaterial: row.secondaryMaterial,
    secondaryMaterialPercentage: row.secondaryMaterialPercentage,
    accessories,
    accessoriesText: row.accessories,
    accessoriesWeightGram: row.accessoriesWeightGram,
    accessories_weight_gram: row.accessoriesWeightGram,
    materialSource: row.materialSource,
    certifications,
    certificationCodes: certifications,
    certification_codes: certifications,
    materials,
    processes: productionProcesses,
    productionProcesses,
    production_processes: productionProcesses,
    energySource: row.energySource,
    energySources,
    energy_sources: energySources,
    manufacturingLocation: row.manufacturingLocation,
    manufacturing_location: row.manufacturingLocation,
    wasteRecovery: normalizedWasteRecovery,
    waste_recovery: normalizedWasteRecovery,
    marketType: normalizedMarketType,
    market_type: normalizedMarketType,
    destinationMarket,
    destination_market: destinationMarket,
    exportCountry: normalizedExportCountry,
    export_country: normalizedExportCountry,
    carbonResults,
    carbon_results: carbonResults,
    materialsCO2e: carbonResults.perProduct.materials,
    materials_co2e: carbonResults.perProduct.materials,
    productionCO2e: carbonResults.perProduct.production,
    production_co2e: carbonResults.perProduct.production,
    transportCO2e: carbonResults.perProduct.transport,
    transport_co2e: carbonResults.perProduct.transport,
    packagingCO2e: carbonResults.perProduct.packaging,
    packaging_co2e: carbonResults.perProduct.packaging,
    totalCO2e: carbonResults.perProduct.total,
    total_co2e: carbonResults.perProduct.total,
    co2PerUnit: carbonResults.perProduct.total,
    co2_per_unit: carbonResults.perProduct.total,
    unit_co2e: carbonResults.perProduct.total,
    confidenceLevel: carbonResults.confidenceLevel,
    confidence_level: carbonResults.confidenceLevel,
    confidenceScore: carbonResults.confidenceScore,
    confidence_score: carbonResults.confidenceScore,
    proxyUsed: carbonResults.proxyUsed,
    proxy_used: carbonResults.proxyUsed,
    proxyNotes: carbonResults.proxyNotes,
    proxy_notes: carbonResults.proxyNotes,
    co2eRange: carbonResults.co2eRange,
    co2e_range: carbonResults.co2eRange,
    methodologyVersion: carbonResults.methodologyVersion,
    methodology_version: carbonResults.methodologyVersion,
    assumptionsUsed: carbonResults.assumptionsUsed,
    assumptions_used: carbonResults.assumptionsUsed,
    factorSourceSummary: carbonResults.factorSourceSummary,
    factor_source_summary: carbonResults.factorSourceSummary,
    dataQualityBreakdown: carbonResults.dataQualityBreakdown,
    data_quality_breakdown: carbonResults.dataQualityBreakdown,
    scope1: carbonResults.scope1,
    scope2: carbonResults.scope2,
    scope3: carbonResults.scope3
  };

  if (hasOriginAddressValue) {
    payload.originAddress = originAddress;
    payload.origin_address = originAddress;
  }

  if (hasDestinationAddressValue) {
    payload.destinationAddress = destinationAddress;
    payload.destination_address = destinationAddress;
  }

  if (row.transportOrigin) {
    payload.transportOrigin = row.transportOrigin;
    payload.transport_origin = row.transportOrigin;
  }

  if (row.transportDestination) {
    payload.transportDestination = row.transportDestination;
    payload.transport_destination = row.transportDestination;
  }

  if (row.transportMode) {
    payload.transportMode = row.transportMode;
    payload.transport_mode = row.transportMode;
  }

  if (transportLegs.length > 0) {
    payload.transportLegs = transportLegs;
    payload.transport_legs = transportLegs;
    payload.estimatedTotalDistance = estimatedTotalDistance;
    payload.estimated_total_distance = estimatedTotalDistance;
  }

  if (exportComplianceDocuments.length > 0) {
    payload.exportComplianceDocuments = exportComplianceDocuments;
    payload.export_compliance_documents = exportComplianceDocuments;
    payload.exportComplianceDocumentCodes = exportComplianceDocuments;
    payload.export_compliance_document_codes = exportComplianceDocuments;
  }

  if (typeof row.calculatedCO2 === "number") {
    payload.calculatedCO2 = row.calculatedCO2;
    payload.calculated_co2 = row.calculatedCO2;
  }
  if (row.scope) {
    payload.scope = row.scope;
    payload.scope_level = row.scope;
  }

  return payload;
};

export const normalizeSku = (value: string) => value.trim().toUpperCase();

export const dedupeWarnings = (warnings: ValidationError[]): ValidationError[] => {
  const unique = new Map<string, ValidationError>();

  warnings.forEach((warning) => {
    const key = `${warning.row}|${warning.field}|${warning.message}`;
    if (!unique.has(key)) {
      unique.set(key, warning);
    }
  });

  return Array.from(unique.values()).sort((a, b) => a.row - b.row);
};

export const mergeValidationWarnings = (
  base: ValidationResult,
  extraWarnings: ValidationError[]
): ValidationResult => {
  const mergedWarnings = dedupeWarnings([...base.warnings, ...extraWarnings]);
  return {
    ...base,
    warnings: mergedWarnings,
    warningCount: mergedWarnings.length
  };
};

export const buildExistingSkuWarnings = (
  rows: BulkProductRow[],
  existingSkus: Set<string>,
  duplicateMessage: (sku: string) => string
): ValidationError[] =>
  rows
    .filter((row) => row.sku && existingSkus.has(normalizeSku(row.sku)))
    .map((row) => ({
      row: row.sourceRow || 1,
      field: "sku",
      message: duplicateMessage(row.sku),
      severity: "warning" as const
    }));

export const formatMaterialCertificationLabels = (values: string[]) =>
  values.map((value) => MATERIAL_CERTIFICATION_LABEL_BY_VALUE[value] || value);

export const applyComplianceAvailabilityToRows = (
  rows: BulkProductRow[],
  snapshot: ComplianceAvailabilitySnapshot,
  forcedDomesticMarket?: string | null
): { rows: BulkProductRow[]; warnings: ValidationError[]; } => {
  if (!snapshot.loaded) {
    return {
      rows,
      warnings: [
        {
          row: 1,
          field: "complianceDocuments",
          message:
            "Cannot verify uploaded compliance documents right now. Values from file are kept unchanged.",
          severity: "warning"
        }
      ]
    };
  }

  const warnings: ValidationError[] = [];
  const requiredMarketWarnings = new Set<string>();

  const normalizedRows = rows.map((row) => {
    const rowNumber = row.sourceRow || 1;
    const parsedMaterialCertifications = parseMaterialCertificationInput(row.certifications);
    const suggestedMaterialCertifications = suggestMaterialCertificationCodes([
      row.primaryMaterial,
      row.secondaryMaterial,
      row.productName
    ]);
    const candidateMaterialCertifications = Array.from(
      new Set([
        ...parsedMaterialCertifications.knownValues,
        ...suggestedMaterialCertifications
      ])
    );

    const readyMaterialCertifications: string[] = [];
    const missingMaterialCertifications: string[] = [];
    for (const certificationValue of candidateMaterialCertifications) {
      const mappedDocumentCode =
        MATERIAL_CERTIFICATION_DOCUMENT_CODE_BY_VALUE[certificationValue];
      const normalizedDocumentCode = normalizeMaterialCertificationDocumentCode(
        mappedDocumentCode
      );
      if (
        normalizedDocumentCode &&
        snapshot.materialReadyDocumentCodes.has(normalizedDocumentCode)
      ) {
        readyMaterialCertifications.push(certificationValue);
      } else {
        missingMaterialCertifications.push(certificationValue);
      }
    }

    if (missingMaterialCertifications.length > 0) {
      warnings.push({
        row: rowNumber,
        field: "certifications",
        message: `Skipped material certifications not uploaded in system: ${formatMaterialCertificationLabels(missingMaterialCertifications).join(", ")}.`,
        severity: "warning"
      });
    }

    const marketCode = resolveComplianceMarketCodeForRow(row, forcedDomesticMarket);
    if (!marketCode) {
      return {
        ...row,
        certifications:
          readyMaterialCertifications.length > 0 ?
            readyMaterialCertifications.join(",") :
            undefined
      };
    }

    const rawExportDocuments = splitCommaValues(row.exportComplianceDocuments);
    const readyTokens =
      snapshot.exportReadyDocumentTokensByMarketCode.get(marketCode) || new Set<string>();
    const readyExportDocuments: string[] = [];
    const missingExportDocuments: string[] = [];

    for (const documentValue of rawExportDocuments) {
      const token = normalizeDocumentToken(documentValue);
      if (readyTokens.has(token)) {
        readyExportDocuments.push(documentValue);
      } else {
        missingExportDocuments.push(documentValue);
      }
    }

    if (missingExportDocuments.length > 0) {
      warnings.push({
        row: rowNumber,
        field: "exportComplianceDocuments",
        message: `Skipped export documents not uploaded in market ${marketCode}: ${missingExportDocuments.join(", ")}.`,
        severity: "warning"
      });
    }

    const marketMissingRequired =
      snapshot.exportMissingRequiredByMarketCode.get(marketCode) || [];
    if (marketMissingRequired.length > 0 && !requiredMarketWarnings.has(marketCode)) {
      requiredMarketWarnings.add(marketCode);
      warnings.push({
        row: rowNumber,
        field: "exportComplianceDocuments",
        message: `Market ${marketCode} still misses required export documents: ${marketMissingRequired.slice(0, 5).join(", ")}.`,
        severity: "warning"
      });
    }

    return {
      ...row,
      certifications:
        readyMaterialCertifications.length > 0 ?
          readyMaterialCertifications.join(",") :
          undefined,
      exportComplianceDocuments:
        readyExportDocuments.length > 0 ? Array.from(new Set(readyExportDocuments)).join(",") : undefined
    };
  });

  return {
    rows: normalizedRows,
    warnings
  };
};
