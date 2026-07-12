import React, { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAppRoutes } from "@/lib/demo/routes";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileCheck,
  FileSpreadsheet,
  Leaf,
  Loader2,
  Package,
  Upload
} from "lucide-react";
import {
  BULK_UPLOAD_STEPS,
  type BulkUploadStep,
  type BulkProductRow,
  type ValidationError,
  type ValidationResult
} from "./types";
import { generateTemplate } from "./template";
import { parseFile, validateAndTransformData } from "./validation";
import { calculateBulkCarbon, calculateCarbonForProduct } from "./carbonCalculation";
import ValidationResults from "./ValidationResults";
import PreviewTable from "./PreviewTable";
import {
  fetchAllProducts,
  formatApiErrorMessage,
  importProductsBulkRows,
  validateProductsBulkImport,
  type BulkImportResult
} from "@/lib/productsApi";import { fetchComplianceMarkets } from "@/lib/exportComplianceApi";
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

interface BulkUploadModalProps {
  open: boolean;
  onClose: () => void;
  onCompleted?: () => void;
  starterDomesticMarket?: string | null;
}

const STEP_LABEL_KEYS: Record<BulkUploadStep["id"], string> = {
  upload: "steps.upload.label",
  validate: "steps.validate.label",
  preview: "steps.preview.label",
  processing: "steps.processing.label",
  complete: "steps.complete.label"
};

const DESTINATION_MARKET_BY_EXPORT_COUNTRY: Record<string, string> = {
  eu: "eu",
  us: "usa",
  jp: "japan",
  kr: "korea",
  other: "other"
};

const DISTANCE_BY_DESTINATION_MARKET: Record<string, number> = {
  vietnam: 500,
  eu: 10000,
  usa: 14000,
  japan: 3500,
  korea: 3200,
  other: 5000
};

const COUNTRY_BY_DESTINATION_MARKET: Record<string, string> = {
  vietnam: "Vietnam",
  eu: "Germany",
  usa: "United States",
  japan: "Japan",
  korea: "Korea",
  china: "China",
  other: "Other"
};

const DESTINATION_MARKET_ALIASES: Record<string, string> = {
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

const DESTINATION_MARKET_TO_COMPLIANCE_CODE: Record<string, string> = {
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

const READY_DOCUMENT_STATUS_SET = new Set(["uploaded", "approved"]);
const MATERIAL_CERTIFICATION_VALUE_SET = new Set(
  Object.keys(MATERIAL_CERTIFICATION_DOCUMENT_CODE_BY_VALUE)
    .map((value) => normalizeMaterialCertificationValue(value))
    .filter(Boolean)
);

const normalizeDestinationMarket = (value: string | null | undefined): string => {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return "";
  return DESTINATION_MARKET_ALIASES[normalized] || normalized;
};

const resolveDestinationMarket = (
row: BulkProductRow,
forcedDomesticMarket?: string | null)
: string => {
  const forcedMarket = normalizeDestinationMarket(forcedDomesticMarket);
  if (forcedMarket) return forcedMarket;
  if (row.marketType === "domestic") return "vietnam";
  if (!row.exportCountry) return "other";
  return DESTINATION_MARKET_BY_EXPORT_COUNTRY[row.exportCountry] || "other";
};

const resolveEstimatedDistance = (
destinationMarket: string,
transportDistanceKm?: number)
: number => {
  if (typeof transportDistanceKm === "number" && Number.isFinite(transportDistanceKm) && transportDistanceKm > 0) {
    return transportDistanceKm;
  }
  return DISTANCE_BY_DESTINATION_MARKET[destinationMarket] || 5000;
};

const resolveTransportLegMode = (
mode: BulkProductRow["transportMode"])
: "road" | "sea" | "air" | "rail" | undefined =>
mode ? (mode === "multimodal" ? "sea" : mode) : undefined;

const LEGACY_MATERIAL_TO_CATALOG_ID: Record<string, string> = {
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

const ACCESSORY_TYPE_ALIASES: Record<string, "button" | "zipper" | "thread" | "label" | "elastic" | "lining" | "padding" | "other"> = {
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

const WASTE_RECOVERY_ALIASES: Record<string, "none" | "partial" | "full" | "circular"> = {
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

const normalizeToken = (value: string) =>
value.
trim().
toLowerCase().
normalize("NFD").
replace(/[\u0300-\u036f]/g, "").
replace(/[^a-z0-9]+/g, "");

const splitCommaValues = (value?: string) =>
(value || "").
split(/[,;|]/).
map((item) => item.trim()).
filter((item) => item.length > 0);

const normalizeDocumentToken = (value: string | null | undefined) =>
String(value || "").
trim().
toLowerCase().
normalize("NFD").
replace(/[\u0300-\u036f]/g, "").
replace(/[^a-z0-9]+/g, "_").
replace(/^_+|_+$/g, "");

interface ComplianceAvailabilitySnapshot {
  loaded: boolean;
  materialReadyDocumentCodes: Set<string>;
  exportReadyDocumentTokensByMarketCode: Map<string, Set<string>>;
  exportMissingRequiredByMarketCode: Map<string, string[]>;
}

const resolveComplianceMarketCodeForRow = (
row: BulkProductRow,
forcedDomesticMarket?: string | null)
: string | null => {
  const destinationMarket = resolveDestinationMarket(row, forcedDomesticMarket);
  const marketToken = normalizeDestinationMarket(destinationMarket);
  return DESTINATION_MARKET_TO_COMPLIANCE_CODE[marketToken] || null;
};

const createEmptyComplianceAvailabilitySnapshot = (
loaded = false)
: ComplianceAvailabilitySnapshot => ({
  loaded,
  materialReadyDocumentCodes: new Set<string>(),
  exportReadyDocumentTokensByMarketCode: new Map<string, Set<string>>(),
  exportMissingRequiredByMarketCode: new Map<string, string[]>()
});

const loadComplianceAvailability = async (): Promise<ComplianceAvailabilitySnapshot> => {
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

const resolveCatalogMaterialId = (materialType: string): string | undefined => {
  const key = materialType.trim().toLowerCase();
  if (!key) return undefined;
  if (key.startsWith("cat-")) return materialType;
  return LEGACY_MATERIAL_TO_CATALOG_ID[key];
};

const resolveAccessoryType = (nameOrType: string) => {
  const key = normalizeToken(nameOrType);
  if (!key) return "other" as const;
  return ACCESSORY_TYPE_ALIASES[key] || "other";
};

const parsePositiveNumber = (value: string): number | undefined => {
  const normalized = value.replace(/,/g, ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
};

const resolveCertificationCode = (value: string): string => {
  return normalizeMaterialCertificationValue(value);
};

const parseMaterialCertificationInput = (rawCertifications?: string) => {
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

const buildCertifications = (rawCertifications?: string): string[] => {
  return parseMaterialCertificationInput(rawCertifications).knownValues;
};

const buildAccessories = (
rawAccessories?: string,
rawAccessoryWeights?: string) => {
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

const buildMaterials = (row: BulkProductRow) => {
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
  }];

  if (
  row.secondaryMaterial &&
  typeof row.secondaryMaterialPercentage === "number" &&
  row.secondaryMaterialPercentage > 0)
  {
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

const trimImportValue = (value?: string) => (value || "").trim();

const inferAddressFromText = (fullAddress?: string) => {
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

const buildAddressFromImport = (
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

const hasAddressData = (
  address: {
    street?: string;
    city?: string;
    stateRegion?: string;
    country?: string;
  }
) =>
  [address.street, address.city, address.stateRegion, address.country]
    .some((value) => trimImportValue(value).length > 0);

const normalizeWasteRecovery = (value?: string): string | undefined => {
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

const buildCarbonResults = (row: BulkProductRow) => {
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

const mapBulkRowToApiPayload = (
row: BulkProductRow,
forcedDomesticMarket?: string | null)
: Record<string, unknown> => {
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
  }];
  const transportLegs = transportMode ?
  [
  {
    id: "leg-1",
    mode: transportMode,
    estimatedDistance: estimatedTotalDistance,
    originLocation: row.transportOrigin,
    destinationLocation: row.transportDestination
  }] :
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

const normalizeSku = (value: string) => value.trim().toUpperCase();

const dedupeWarnings = (warnings: ValidationError[]): ValidationError[] => {
  const unique = new Map<string, ValidationError>();

  warnings.forEach((warning) => {
    const key = `${warning.row}|${warning.field}|${warning.message}`;
    if (!unique.has(key)) {
      unique.set(key, warning);
    }
  });

  return Array.from(unique.values()).sort((a, b) => a.row - b.row);
};

const mergeValidationWarnings = (
base: ValidationResult,
extraWarnings: ValidationError[])
: ValidationResult => {
  const mergedWarnings = dedupeWarnings([...base.warnings, ...extraWarnings]);
  return {
    ...base,
    warnings: mergedWarnings,
    warningCount: mergedWarnings.length
  };
};

const buildExistingSkuWarnings = (
rows: BulkProductRow[],
existingSkus: Set<string>,
duplicateMessage: (sku: string) => string)
: ValidationError[] =>
rows.
filter((row) => row.sku && existingSkus.has(normalizeSku(row.sku))).
map((row) => ({
  row: row.sourceRow || 1,
  field: "sku",
  message: duplicateMessage(row.sku),
  severity: "warning" as const
}));

const formatMaterialCertificationLabels = (values: string[]) =>
values.map((value) => MATERIAL_CERTIFICATION_LABEL_BY_VALUE[value] || value);

const applyComplianceAvailabilityToRows = (
rows: BulkProductRow[],
snapshot: ComplianceAvailabilitySnapshot,
forcedDomesticMarket?: string | null)
: {rows: BulkProductRow[];warnings: ValidationError[];} => {
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
      }]

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
      snapshot.materialReadyDocumentCodes.has(normalizedDocumentCode))
      {
        readyMaterialCertifications.push(certificationValue);
      } else {
        missingMaterialCertifications.push(certificationValue);
      }
    }

    if (parsedMaterialCertifications.unknownValues.length > 0) {
      warnings.push({
        row: rowNumber,
        field: "certifications",
        message: `Unknown material certifications were ignored: ${parsedMaterialCertifications.unknownValues.join(", ")}.`,
        severity: "warning"
      });
    }

    if (missingMaterialCertifications.length > 0) {
      warnings.push({
        row: rowNumber,
        field: "certifications",
        message: `Skipped material certifications without uploaded documents: ${formatMaterialCertificationLabels(missingMaterialCertifications).join(", ")}.`,
        severity: "warning"
      });
    }

    const normalizedCertifications = Array.from(new Set(readyMaterialCertifications));
    const marketCode = resolveComplianceMarketCodeForRow(row, forcedDomesticMarket);
    const exportDocumentValues = splitCommaValues(row.exportComplianceDocuments);

    if (row.marketType !== "export") {
      return {
        ...row,
        certifications:
        normalizedCertifications.length > 0 ?
        normalizedCertifications.join(",") :
        undefined,
        exportComplianceDocuments: undefined
      };
    }

    if (!marketCode) {
      return {
        ...row,
        certifications:
        normalizedCertifications.length > 0 ?
        normalizedCertifications.join(",") :
        undefined,
        exportComplianceDocuments:
        exportDocumentValues.length > 0 ? exportDocumentValues.join(",") : undefined
      };
    }

    const readyExportTokens =
    snapshot.exportReadyDocumentTokensByMarketCode.get(marketCode) || new Set<string>();
    const readyExportDocuments: string[] = [];
    const missingExportDocuments: string[] = [];
    for (const documentValue of exportDocumentValues) {
      const normalizedDocument = normalizeDocumentToken(documentValue);
      if (normalizedDocument && readyExportTokens.has(normalizedDocument)) {
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
      normalizedCertifications.length > 0 ?
      normalizedCertifications.join(",") :
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

const BulkUploadModal: React.FC<BulkUploadModalProps> = ({
  open,
  onClose,
  onCompleted,
  starterDomesticMarket
}) => {
  const t = useTranslations("products.bulkUpload");
  const displayLocale = "vi-VN";
  const navigate = useRouter();
  const appRoutes = useAppRoutes();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [file, setFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] =
  useState<ValidationResult | null>(null);
  const [processedRows, setProcessedRows] = useState<BulkProductRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const normalizedStarterDomesticMarket =
  normalizeDestinationMarket(starterDomesticMarket);
  const starterDomesticOnly = normalizedStarterDomesticMarket.length > 0;

  const resetState = useCallback(() => {
    setCurrentStep(0);
    setFile(null);
    setValidationResult(null);
    setProcessedRows([]);
    setIsProcessing(false);
    setImportProgress(0);
    setImportedCount(0);
    setImportResult(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv"];


      if (
      !validTypes.includes(selectedFile.type) &&
      !selectedFile.name.match(/\.(xlsx|xls|csv)$/i))
      {
        setError(t("errors.invalidFileType"));
        return;
      }

      setFile(selectedFile);
      setError(null);
      setIsProcessing(true);

      try {
        const rawData = await parseFile(selectedFile);

        if (rawData.length === 0) {
          setError(t("errors.emptyFile"));
          setIsProcessing(false);
          return;
        }

        let result = validateAndTransformData(rawData);

        if (starterDomesticOnly && result.validRows.length > 0) {
          const overriddenRows = result.validRows.filter(
            (row) => row.marketType !== "domestic" || Boolean(row.exportCountry)
          ).length;

          if (overriddenRows > 0) {
            toast.warning(
              `Gói Trial: đã chuyển ${overriddenRows} dòng xuất khẩu sang nội địa.`
            );
          }

          result = {
            ...result,
            validRows: result.validRows.map((row) => ({
              ...row,
              marketType: "domestic",
              exportCountry: undefined,
              exportComplianceDocuments: undefined
            }))
          };
        }

        if (result.validRows.length > 0) {
          const complianceAvailability = await loadComplianceAvailability();
          const normalizedByCompliance = applyComplianceAvailabilityToRows(
            result.validRows,
            complianceAvailability,
            starterDomesticOnly ? normalizedStarterDomesticMarket : null
          );
          result = {
            ...result,
            validRows: normalizedByCompliance.rows
          };
          if (normalizedByCompliance.warnings.length > 0) {
            result = mergeValidationWarnings(result, normalizedByCompliance.warnings);
          }

          try {
            const existingProducts = await fetchAllProducts();
            const existingSkus = new Set(
              existingProducts.
              map((product) => normalizeSku(product.productCode || "")).
              filter((sku) => sku.length > 0)
            );

            const duplicateSkuWarnings = buildExistingSkuWarnings(
              result.validRows,
              existingSkus,
              (sku) => t("warnings.skuExists", { sku })
            );
            if (duplicateSkuWarnings.length > 0) {
              result = mergeValidationWarnings(result, duplicateSkuWarnings);
              toast.warning(
                t("warnings.duplicateSkuDetected", { count: duplicateSkuWarnings.length })
              );
            }
          } catch {

          }

          try {
            const backendValidation = await validateProductsBulkImport(
              result.validRows.map((row) =>
                mapBulkRowToApiPayload(
                  row,
                  starterDomesticOnly ? normalizedStarterDomesticMarket : null
                )
              )
            );

            if (backendValidation.warnings.length > 0) {
              const backendWarnings: ValidationError[] =
              backendValidation.warnings.map((warning) => ({
                row: warning.row || 1,
                field: warning.field || "general",
                message: warning.message,
                severity: "warning"
              }));
              result = mergeValidationWarnings(result, backendWarnings);
            }

            if (
            backendValidation.errorCount > 0 ||
            backendValidation.warningCount > 0)
            {
              toast.warning(
                t("warnings.backendValidationSummary", {
                  errors: backendValidation.errorCount,
                  warnings: backendValidation.warningCount
                })
              );
            }
          } catch (validationError) {
            const message = formatApiErrorMessage(
              validationError,
              t("errors.validateApiFallback")
            );
            toast.warning(message);
          }
        }

        setValidationResult(result);
        setCurrentStep(1);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errors.readFile"));
      } finally {
        setIsProcessing(false);
      }
    },
    [normalizedStarterDomesticMarket, starterDomesticOnly, t]
  );

  const handleDownloadTemplate = useCallback((format: "xlsx" | "csv") => {
    generateTemplate(format);
  }, []);

  const handleProceedToPreview = useCallback(() => {
    if (!validationResult) return;

    setIsProcessing(true);
    const calculatedRows = calculateBulkCarbon(validationResult.validRows);
    setProcessedRows(calculatedRows);
    setCurrentStep(2);
    setIsProcessing(false);
  }, [validationResult]);

  const handleImportProducts = useCallback(async () => {
    if (processedRows.length === 0) return;

    setCurrentStep(3);
    setIsProcessing(true);
    setImportProgress(20);
    setError(null);

    try {
      const payloadRows = processedRows.map((row) =>
        mapBulkRowToApiPayload(
          row,
          starterDomesticOnly ? normalizedStarterDomesticMarket : null
        )
      );
      setImportProgress(60);
      const result = await importProductsBulkRows(payloadRows, "draft");

      setImportProgress(100);
      setImportedCount(result.imported);
      setImportResult(result);
      setCurrentStep(4);

      if (result.failed > 0) {
        toast.warning(t("warnings.partialImport", { imported: result.imported, failed: result.failed }));
      } else {
        toast.success(t("success.importSuccess", { imported: result.imported }));
      }

      onCompleted?.();
    } catch (importError) {
      setCurrentStep(2);
      setError(formatApiErrorMessage(importError, t("errors.importFailed")));
      toast.error(formatApiErrorMessage(importError, t("errors.importFailed")));
      } finally {
      setIsProcessing(false);
    }
  }, [
    normalizedStarterDomesticMarket,
    onCompleted,
    processedRows,
    starterDomesticOnly,
    t
  ]);

  const handleViewProducts = useCallback(() => {
    handleClose();
    navigate.push(appRoutes.toAppPath("/products"));
  }, [appRoutes, handleClose, navigate]);

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            {starterDomesticOnly &&
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                Gói Trial chỉ hỗ trợ dữ liệu nội địa. Nếu file có dòng xuất khẩu, hệ thống sẽ chuyển về nội địa.
              </div>
            }
            <div className="bg-muted/50 rounded-lg p-4 border border-dashed">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="w-8 h-8 text-primary shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium mb-1">{t("template.title")}</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t("template.description")}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void handleDownloadTemplate("xlsx");
                      }}>

                      <Download className="w-4 h-4 mr-1" /> {t("template.downloadExcel")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void handleDownloadTemplate("csv");
                      }}>

                      <Download className="w-4 h-4 mr-1" /> {t("template.downloadCsv")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                ${file ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"}`}
              onClick={() => fileInputRef.current?.click()}>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileSelect} />


              {isProcessing ?
              <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-muted-foreground">{t("upload.processingFile")}</p>
                </div> :
              file ?
              <div className="flex flex-col items-center gap-3">
                  <FileCheck className="w-10 h-10 text-primary" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setError(null);
                  }}>

                    {t("upload.selectAnotherFile")}
                  </Button>
                </div> :

              <div className="flex flex-col items-center gap-3">
                  <Upload className="w-10 h-10 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{t("upload.dropzoneTitle")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("upload.dropzoneDescription")}
                    </p>
                  </div>
                </div>
              }
            </div>

            {error &&
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            }
          </div>);


      case 1:
        return (
          <div className="space-y-4">
            {validationResult &&
            <>
                <ValidationResults result={validationResult} />

                {validationResult.validCount > 0 &&
              <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => setCurrentStep(0)}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> {t("actions.uploadAnother")}
                    </Button>
                    <Button
                  onClick={handleProceedToPreview}
                  disabled={isProcessing}>

                      {isProcessing ?
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" /> :

                  <ArrowRight className="w-4 h-4 mr-1" />
                  }
                      {t("actions.continueWithCount", { count: validationResult.validCount })}
                    </Button>
                  </div>
              }

                {validationResult.validCount === 0 &&
              <div className="flex justify-center pt-4 border-t">
                    <Button variant="outline" onClick={() => setCurrentStep(0)}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> {t("actions.uploadAnother")}
                    </Button>
                  </div>
              }
              </>
            }
          </div>);


      case 2:
        return (
          <div className="space-y-4">
            {processedRows.length > 0 &&
            <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <Package className="w-6 h-6 text-primary mx-auto mb-1" />
                    <p className="text-xl font-bold">{processedRows.length}</p>
                    <p className="text-xs text-muted-foreground">{t("stats.products")}</p>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold">
                      {processedRows.
                    reduce((sum, r) => sum + r.quantity, 0).
                    toLocaleString(displayLocale)}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("stats.totalQuantity")}</p>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <Leaf className="w-6 h-6 text-primary mx-auto mb-1" />
                    <p className="text-xl font-bold">
                      {processedRows.
                    reduce((sum, r) => sum + (r.calculatedCO2 || 0), 0).
                    toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">{t("stats.co2ePerUnit")}</p>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold">
                      {
                    processedRows.filter(
                      (r) => r.confidenceLevel === "high"
                    ).length
                    }
                    </p>
                    <p className="text-xs text-muted-foreground">{t("stats.highConfidence")}</p>
                  </div>
                </div>

                <PreviewTable rows={processedRows} showCarbonData />

                {error &&
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
              }

                <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => setCurrentStep(1)}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> {t("actions.back")}
                  </Button>
                  <Button className="w-full sm:w-auto" onClick={() => void handleImportProducts()}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> {t("actions.importCount", { count: processedRows.length })}
                  </Button>
                </div>
              </>
            }
          </div>);


      case 3:
        return (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <div className="text-center">
                <h3 className="font-medium text-lg">{t("processing.title")}</h3>
                <p className="text-muted-foreground">{t("processing.description")}</p>
              </div>
            </div>
            <Progress value={importProgress} className="h-2" />
          </div>);


      case 4:
        return (
          <div className="py-8 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <div className="text-center">
                <h3 className="font-medium text-lg">{t("completed.title")}</h3>
                <p className="text-muted-foreground">
                  {t("completed.description", { count: importedCount })}
                </p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("completed.importedProducts")}</span>
                <Badge variant="default" className="bg-green-600">
                  {importResult?.imported ?? importedCount}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("completed.failedRows")}</span>
                <Badge variant="secondary">{importResult?.failed ?? 0}</Badge>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={handleClose}>
                {t("actions.close")}
              </Button>
              <Button onClick={handleViewProducts}>
                <Package className="w-4 h-4 mr-1" /> {t("actions.viewProducts")}
              </Button>
            </div>
          </div>);


      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="h-dvh w-screen max-w-[100vw] overflow-y-auto rounded-none p-3 md:max-h-[92vh] md:w-[96vw] md:max-w-[1400px] md:rounded-lg md:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            {t("modal.title")}
          </DialogTitle>
          <DialogDescription>
            {t("modal.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-6 overflow-x-auto">
          <div className="flex min-w-[560px] items-center justify-between">
            {BULK_UPLOAD_STEPS.map((step, index) =>
            <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${
                index < currentStep ?
                "bg-primary text-primary-foreground" :
                index === currentStep ?
                "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2" :
                "bg-muted text-muted-foreground"}`
                }>

                  {index < currentStep ?
                <CheckCircle2 className="w-4 h-4" /> :

                index + 1
                }
                </div>
                <span
                className={`text-xs mt-1 ${index <= currentStep ? "text-foreground" : "text-muted-foreground"}`}>

                  {t(STEP_LABEL_KEYS[step.id])}
                </span>
                </div>
                {index < BULK_UPLOAD_STEPS.length - 1 &&
              <div
                className={`mx-2 h-0.5 flex-1 ${index < currentStep ? "bg-primary" : "bg-muted"}`} />

              }
              </React.Fragment>
            )}
          </div>
        </div>

        {renderStep()}
      </DialogContent>
    </Dialog>);

};

export default BulkUploadModal;
