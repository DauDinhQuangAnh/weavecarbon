"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useDashboardTitle } from "@/contexts/DashboardContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useSubscriptionLock } from "@/hooks/useSubscriptionLock";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle } from
"@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Package,
  Leaf,
  Factory,
  Truck,
  Save } from
"lucide-react";
import StepIndicators from "./StepIndicators";
import StepContent from "./StepContent";
import {
  DESTINATION_MARKETS,
  AddressInput,
  DraftVersion,
  MarketComplianceDocumentSummary,
  PRODUCT_TYPES,
  ProductAssessmentData,
  ProductAssessmentSessionDraft
} from "./steps/types";
import {
  createProduct,
  formatApiErrorMessage,
  fetchProductById,
  isValidProductId,
  updateProduct,
  updateProductStatus } from
"@/lib/productsApi";
import {
  createLogisticsShipment,
  fetchAllLogisticsShipments,
  fetchLogisticsShipmentById,
  type LogisticsShipmentStatus } from
"@/lib/logisticsApi";
import { fetchComplianceMarkets } from "@/lib/exportComplianceApi";
import { api } from "@/lib/apiClient";
import { normalizeDomesticMarketCode } from "@/lib/targetMarkets";
import { useAppRoutes } from "@/lib/demo/routes";
import {
  filterExportComplianceDocuments,
  filterMaterialCertificationDocuments
} from "@/lib/complianceDocumentGroups";
import {
  CERTIFICATION_READY_DOCUMENT_STATUSES,
  CERTIFICATION_DOCUMENT_CODE_BY_VALUE,
  CERTIFICATION_VALUE_BY_DOCUMENT_CODE,
  normalizeCertificationDocumentCode
} from "./certificationDocuments";
import { MATERIAL_CERTIFICATION_LABEL_BY_VALUE } from "@/lib/materialCertificationDefinitions";

const STEP_CONFIG = [
{
  id: 1,
  titleKey: "steps.productInfo",
  icon: Package,
  key: "productInfo"
},
{ id: 2, titleKey: "steps.materials", icon: Leaf, key: "materials" },
{
  id: 3,
  titleKey: "steps.manufacturing",
  icon: Factory,
  key: "manufacturing"
},
{ id: 4, titleKey: "steps.logistics", icon: Truck, key: "logistics" },
{
  id: 5,
  titleKey: "steps.assessment",
  icon: CheckCircle2,
  key: "assessment"
},
{ id: 6, titleKey: "steps.save", icon: Save, key: "save" }];


const emptyAddress = {
  aptSuite: "",
  streetNumber: "",
  street: "",
  ward: "",
  district: "",
  city: "",
  stateRegion: "",
  country: "Vietnam",
  postalCode: ""
};

const PRODUCT_TYPE_VALUES = PRODUCT_TYPES.map((type) => type.value);
const DESTINATION_MARKET_VALUES = DESTINATION_MARKETS.map((market) => market.value);

const normalizeOptionToken = (value: string): string =>
value.
normalize("NFD").
replace(/[\u0300-\u036f]/g, "").
toLowerCase().
replace(/[^a-z0-9]+/g, "");

const resolveNormalizedOptionValue = (
rawValue: string | undefined,
options: readonly string[],
aliases: Record<string, string> = {}
): string => {
  if (!rawValue) return "";

  const trimmedValue = rawValue.trim();
  if (!trimmedValue) return "";

  const normalizedValue = normalizeOptionToken(trimmedValue);
  if (aliases[normalizedValue]) {
    return aliases[normalizedValue];
  }

  const matchedValue = options.find(
    (option) => normalizeOptionToken(option) === normalizedValue
  );

  return matchedValue || trimmedValue;
};

const DESTINATION_MARKET_ALIASES: Record<string, string> = {
  us: "usa",
  unitedstate: "usa",
  unitedstates: "usa",
  america: "usa",
  hoaky: "usa",
  domestic: "vietnam",
  noidia: "vietnam",
  noidiavietnam: "vietnam",
  vietnamdomestic: "vietnam",
  hanquoc: "korea",
  nhatban: "japan",
  chaua: "eu",
  europe: "eu",
  chauau: "eu"
};

const TARGET_MARKET_TO_DESTINATION_MARKET: Record<string, string> = {
  VN: "vietnam",
  US: "usa",
  KR: "korea",
  JP: "japan",
  EU: "eu",
  CN: "china",
  AU: "australia",
  ASEAN: "asean",
  TH: "thailand",
  SG: "singapore",
  MY: "malaysia",
  ID: "indonesia",
  PH: "philippines",
  CA: "canada",
  UK: "uk",
  IN: "india"
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
  india: "IN",
  in: "IN"
};

const normalizeComplianceDocumentKey = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

const resolveComplianceMarketCode = (destinationMarket: string | null | undefined) => {
  const token = normalizeOptionToken(destinationMarket || "");
  return DESTINATION_MARKET_TO_COMPLIANCE_CODE[token] || null;
};

const isReadyComplianceDocumentStatus = (status: unknown) =>
  CERTIFICATION_READY_DOCUMENT_STATUSES.has(String(status || "").trim().toLowerCase());

const isPublishBlockedByMissingDocumentsError = (error: unknown) => {
  const message = formatApiErrorMessage(error, "").toLowerCase();
  return (
    message.includes("required domestic documents") ||
    message.includes("missing required export documents") ||
    message.includes("missing uploaded files for material certifications") ||
    message.includes("cannot publish because")
  );
};

const isCertificationDocumentCode = (documentCode: string | undefined): boolean => {
  const normalizedDocumentCode = normalizeCertificationDocumentCode(documentCode);
  if (!normalizedDocumentCode) return false;
  return Boolean(CERTIFICATION_VALUE_BY_DOCUMENT_CODE[normalizedDocumentCode]);
};

const normalizePlanId = (plan: string | null | undefined) => {
  const value = (plan || "").trim().toLowerCase();
  if (!value) return "";
  if (value.includes("trial")) return "trial";
  if (value.includes("standard")) return "standard";
  if (value.includes("export")) return "export";
  return value;
};

const getExpectedCountryForTrialMarket = (market: string | null | undefined): string => {
  switch (String(market || "").trim().toLowerCase()) {
    case "usa":
      return "United States";
    case "korea":
      return "South Korea";
    case "japan":
      return "Japan";
    case "eu":
      return "Germany";
    case "china":
      return "China";
    case "vietnam":
    default:
      return "Vietnam";
  }
};

const normalizeCountryToken = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const isAddressOutsideTrialDomestic = (
  country: string | null | undefined,
  starterDomesticMarket: string | null | undefined
) => {
  const normalizedCountry = normalizeCountryToken(country);
  if (!normalizedCountry) return false;

  const expectedCountry = getExpectedCountryForTrialMarket(starterDomesticMarket);
  return normalizedCountry !== normalizeCountryToken(expectedCountry);
};

const resolveStarterDomesticMarket = (domesticMarket: unknown, targetMarkets: unknown): string => {
  const marketCode = normalizeDomesticMarketCode(domesticMarket, targetMarkets);
  return TARGET_MARKET_TO_DESTINATION_MARKET[marketCode] || "vietnam";
};

const DEFAULT_TRANSPORT_FACTOR_BY_MODE: Record<
  "road" | "sea" | "air" | "rail",
  number
> = {
  road: 0.12226,
  sea: 0.01612,
  air: 0.89939,
  rail: 0.02779
};

const normalizeLookupValue = (value: string | null | undefined) =>
  (value || "").trim().toLowerCase();

const buildAddressLabel = (
  address: AddressInput,
  unknownLocationLabel = ""
): string => {
  const parts = [
    address.streetNumber,
    address.street,
    address.ward,
    address.district,
    address.city,
    address.stateRegion,
    address.country
  ]
    .map((part) => (part || "").trim())
    .filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : unknownLocationLabel;
};

const hasPositiveDistance = (value: number | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const hasResolvedRoadDistance = (leg: ProductAssessmentData["transportLegs"][number]) =>
  leg.mode !== "road" || (leg.routeResolved === true && hasPositiveDistance(leg.estimatedDistance));

const toShipmentLocationInput = (
  address: AddressInput,
  fallbackCountry = "Vietnam",
  unknownLocationLabel = ""
) => {
  const country = (address.country || fallbackCountry || "Vietnam").trim() || "Vietnam";
  const city =
    (address.city || "").trim() ||
    (address.stateRegion || "").trim() ||
    (address.district || "").trim() ||
    country;
  const fullAddress = buildAddressLabel(address, unknownLocationLabel);

  return {
    country,
    city,
    address: fullAddress,
    lat:
      typeof address.lat === "number" && Number.isFinite(address.lat) ?
        address.lat :
        undefined,
    lng:
      typeof address.lng === "number" && Number.isFinite(address.lng) ?
        address.lng :
        undefined
  };
};

const buildShipmentLegsFromProduct = (
  payload: ProductAssessmentData,
  unknownLocationLabel = ""
) => {
  const explicitLegs = (payload.transportLegs || []).filter((leg) => Boolean(leg.mode));

  if (explicitLegs.length === 0) {
    return [];
  }

  const fallbackDistancePerLeg =
    typeof payload.estimatedTotalDistance === "number" &&
    Number.isFinite(payload.estimatedTotalDistance) &&
    payload.estimatedTotalDistance > 0 ?
      payload.estimatedTotalDistance / explicitLegs.length :
      0;

  return explicitLegs.map((leg, index) => {
    const distanceKm =
      hasPositiveDistance(leg.estimatedDistance) &&
      hasResolvedRoadDistance(leg) ?
        leg.estimatedDistance :
      leg.mode !== "road" && fallbackDistancePerLeg > 0 ?
        fallbackDistancePerLeg :
        0;

    const emissionFactor =
      typeof leg.emissionFactor === "number" &&
      Number.isFinite(leg.emissionFactor) &&
      leg.emissionFactor > 0 ?
        leg.emissionFactor :
        DEFAULT_TRANSPORT_FACTOR_BY_MODE[leg.mode] ||
        DEFAULT_TRANSPORT_FACTOR_BY_MODE.road;

    const co2Kg =
      typeof leg.co2Kg === "number" && Number.isFinite(leg.co2Kg) && leg.co2Kg > 0 ?
        leg.co2Kg :
        Math.max(0, distanceKm * emissionFactor);

    return {
      leg_order: index + 1,
      transport_mode: leg.mode,
      origin_location:
        index === 0 ?
          buildAddressLabel(payload.originAddress, unknownLocationLabel) :
          `Transit ${index}`,
      destination_location:
        index === explicitLegs.length - 1 ?
          buildAddressLabel(payload.destinationAddress, unknownLocationLabel) :
          `Transit ${index + 1}`,
      distance_km: Math.max(0, distanceKm),
      co2e: co2Kg,
      emission_factor_used: emissionFactor,
      carrier_name: "",
      vehicle_type: ""
    };
  });
};

const shipmentContainsProduct = (
shipment: {
  products: Array<{product_id: string;sku: string;product_name: string;}>;
},
productId: string,
productCode: string,
productName: string)
: boolean => {
  const productIdLookup = normalizeLookupValue(productId);
  const codeLookup = normalizeLookupValue(productCode);
  const nameLookup = normalizeLookupValue(productName);

  return shipment.products.some((shipmentProduct) => {
    const shipmentProductId = normalizeLookupValue(shipmentProduct.product_id);
    const shipmentSku = normalizeLookupValue(shipmentProduct.sku);
    const shipmentName = normalizeLookupValue(shipmentProduct.product_name);

    if (shipmentProductId && productIdLookup && shipmentProductId === productIdLookup) {
      return true;
    }
    if (shipmentSku && codeLookup && (shipmentSku === codeLookup || shipmentSku.includes(codeLookup))) {
      return true;
    }
    if (shipmentName && nameLookup && shipmentName === nameLookup) {
      return true;
    }
    return false;
  });
};

const initialProductData: ProductAssessmentData = {
  productCode: "",
  productName: "",
  productType: "",
  hsCode: "",
  cnCode: "",
  facility: "",
  evidenceLookupCode: "",
  supplierCountry: "",
  supplyGap: false,
  customsDeclarationNo: "",
  poContractId: "",
  billOfLadingNo: "",
  containerNo: "",
  weightPerUnit: 0,
  quantity: 0,
  materials: [],
  accessories: [],
  productionProcesses: [],
  energySources: [],
  manufacturingLocation: "",
  wasteRecovery: "",
  destinationMarket: "",
  originAddress: { ...emptyAddress },
  destinationAddress: { ...emptyAddress },
  transportLegs: [],
  estimatedTotalDistance: 0,
  status: "draft",
  version: 1
};

type AssessmentMode = "page" | "modal";
const MODAL_CREATE_DRAFT_STORAGE_KEY = "assessment_modal_create_draft_v1";

interface AssessmentClientProps {
  mode?: AssessmentMode;
  initialData?: ProductAssessmentData | null;
  initialStep?: number;
  productId?: string | null;
  disableModalDraftRestore?: boolean;
  onSessionDraftChange?: (draft: ProductAssessmentSessionDraft | null) => void;
  onClose?: () => void;
  onCompleted?: (result: {
    id: string;
    status: "draft" | "published";
    isUpdate: boolean;
  }) => void;
}

const cloneInitialData = (
initialData?: ProductAssessmentData | null)
: ProductAssessmentData => {
  if (!initialData) {
    return {
      ...initialProductData,
      originAddress: { ...emptyAddress },
      destinationAddress: { ...emptyAddress },
      materials: [],
      accessories: [],
      productionProcesses: [],
      energySources: [],
      transportLegs: []
    };
  }

  return {
    ...initialProductData,
    ...initialData,
    productType: resolveNormalizedOptionValue(
      initialData.productType,
      PRODUCT_TYPE_VALUES
    ),
    destinationMarket: resolveNormalizedOptionValue(
      initialData.destinationMarket,
      DESTINATION_MARKET_VALUES,
      DESTINATION_MARKET_ALIASES
    ),
    originAddress: { ...emptyAddress, ...(initialData.originAddress ?? {}) },
    destinationAddress: {
      ...emptyAddress,
      ...(initialData.destinationAddress ?? {})
    },
    materials: (initialData.materials ?? []).map((item) => ({
      ...item,
      certifications: [...(item.certifications ?? [])]
    })),
    accessories: (initialData.accessories ?? []).map((item) => ({ ...item })),
    productionProcesses: [...(initialData.productionProcesses ?? [])],
    energySources: (initialData.energySources ?? []).map((item) => ({
      ...item
    })),
    transportLegs: (initialData.transportLegs ?? []).map((item) => ({
      ...item,
      autoSuggested: item.autoSuggested === true,
      fromNode: item.fromNode ? { ...item.fromNode } : undefined,
      toNode: item.toNode ? { ...item.toNode } : undefined
    })),
    carbonResults: initialData.carbonResults ?
    {
      ...initialData.carbonResults,
      perProduct: { ...initialData.carbonResults.perProduct },
      totalBatch: { ...initialData.carbonResults.totalBatch },
      proxyNotes: [...(initialData.carbonResults.proxyNotes ?? [])]
    } :
    undefined,
    status: initialData.status === "published" ? "published" : "draft",
    version: Math.max(1, initialData.version || 1)
  };
};

const readModalCreateDraft = (): ProductAssessmentData | null => {
  if (typeof window === "undefined") return null;

  try {
    const rawDraft = window.sessionStorage.getItem(
      MODAL_CREATE_DRAFT_STORAGE_KEY
    );
    if (!rawDraft) return null;

    const parsed = JSON.parse(rawDraft) as ProductAssessmentData;
    if (!parsed || typeof parsed !== "object") return null;

    return cloneInitialData(parsed);
  } catch {
    return null;
  }
};

const saveModalCreateDraft = (data: ProductAssessmentData) => {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      MODAL_CREATE_DRAFT_STORAGE_KEY,
      JSON.stringify(data)
    );
  } catch {

  }
};

const clearModalCreateDraft = () => {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(MODAL_CREATE_DRAFT_STORAGE_KEY);
  } catch {

  }
};

const resolveInitialProductData = ({
  mode,
  isEditing,
  initialData,
  disableModalDraftRestore




}: {mode: AssessmentMode;isEditing: boolean;initialData?: ProductAssessmentData | null;disableModalDraftRestore?: boolean;}): ProductAssessmentData => {
  if (mode === "modal" && !disableModalDraftRestore && !isEditing && !initialData) {
    const storedDraft = readModalCreateDraft();
    if (storedDraft) {
      return storedDraft;
    }
  }

  return cloneInitialData(initialData);
};

const isSameValue = (a: unknown, b: unknown) => {
  if (Object.is(a, b)) return true;

  const isObjectA = typeof a === "object" && a !== null;
  const isObjectB = typeof b === "object" && b !== null;
  if (!isObjectA || !isObjectB) return false;

  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

const normalizeInitialStep = (step: number | null | undefined) => {
  const safeStep = Math.trunc(step || 1);
  return Math.min(STEP_CONFIG.length, Math.max(1, safeStep));
};

export default function AssessmentClient({
  mode = "page",
  initialData = null,
  initialStep = 1,
  productId = null,
  disableModalDraftRestore = false,
  onSessionDraftChange,
  onClose,
  onCompleted
}: AssessmentClientProps) {
  const t = useTranslations("assessment.client");
  const unknownLocationLabel = t("unknownLocation");
  const router = useRouter();
  const appRoutes = useAppRoutes();
  const { canMutate } = usePermissions();
  const { currentPlan } = useSubscriptionLock();
  const [accountPlan, setAccountPlan] = useState<string | null>(null);
  const activePlan = accountPlan || currentPlan;
  const normalizedCurrentPlan = normalizePlanId(activePlan);
  const isStarterPlan = normalizedCurrentPlan === "trial";
  const isTrialPlan = (() => {
    const normalizedPlan = String(activePlan || "").trim().toLowerCase();
    return normalizedPlan.includes("trial");
  })();
  const { setPageTitle } = useDashboardTitle();
  const isModalMode = mode === "modal";
  const isEditing = Boolean(productId);
  const skipCreateDraftPersistenceRef = useRef(false);
  const steps = STEP_CONFIG.map((step) => ({
    ...step,
    title: t(step.titleKey)
  }));

  const [currentStep, setCurrentStep] = useState(() =>
    normalizeInitialStep(initialStep)
  );
  const [productData, setProductData] = useState<ProductAssessmentData>(() =>
  resolveInitialProductData({ mode, isEditing, initialData, disableModalDraftRestore })
  );
  const [draftHistory, setDraftHistory] = useState<DraftVersion[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionMode, setSubmissionMode] = useState<"draft" | "publish" | null>(null);
  const [starterDomesticMarket, setStarterDomesticMarket] = useState<string>("vietnam");
  const [availableCertificationDocumentCodes, setAvailableCertificationDocumentCodes] =
    useState<string[]>([]);
  const [complianceDocumentsByMarketCode, setComplianceDocumentsByMarketCode] =
    useState<Record<string, MarketComplianceDocumentSummary>>({});
  const [isCertificationAvailabilityLoading, setIsCertificationAvailabilityLoading] =
    useState(true);
  const [editingShipmentStatus, setEditingShipmentStatus] =
    useState<LogisticsShipmentStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchAccountContext = async () => {
      try {
        const account = await api.get<{
          company?: {
            current_plan?: string | null;
            domestic_market?: string | null;
            target_markets?: string[] | null;
          } | null;
        }>("/account");

        if (cancelled) return;
        setAccountPlan(account?.company?.current_plan || null);

        setStarterDomesticMarket(
          resolveStarterDomesticMarket(
            account?.company?.domestic_market || null,
            account?.company?.target_markets || null
          )
        );
      } catch {
        if (!cancelled) {
          setAccountPlan(null);
          setStarterDomesticMarket("vietnam");
        }
      }
    };

    void fetchAccountContext();

    return () => {
      cancelled = true;
    };
  }, [currentPlan]);

  useEffect(() => {
    if (isTrialPlan) {
      setAvailableCertificationDocumentCodes([]);
      setComplianceDocumentsByMarketCode({});
      setIsCertificationAvailabilityLoading(false);
      return;
    }

    if (currentStep !== 2 && currentStep !== 4) {
      return;
    }

    let cancelled = false;

    const fetchCertificationAvailability = async () => {
      setIsCertificationAvailabilityLoading(true);
      try {
        const markets = await fetchComplianceMarkets();
        if (cancelled) return;

        const availableDocumentCodes = new Set<string>();
        const marketSummaries: Record<string, MarketComplianceDocumentSummary> = {};
        for (const [marketCode, market] of Object.entries(markets)) {
          const exportDocuments = filterExportComplianceDocuments(market.documents);
          const materialCertificationDocuments = filterMaterialCertificationDocuments(market.documents);
          const requiredDocumentsFromApi = exportDocuments.filter((document) => document.required);
          const requiredDocumentNames = Array.from(
            new Set(
              (
                requiredDocumentsFromApi.length > 0 ?
                  requiredDocumentsFromApi.map((document) => document.name) :
                  market.requiredDocuments
              )
                .map((name) => String(name || "").trim())
                .filter(Boolean)
            )
          );
          const addedDocuments = exportDocuments.filter((document) =>
            isReadyComplianceDocumentStatus(document.status)
          );
          const addedDocumentNames = Array.from(
            new Set(
              addedDocuments
                .map((document) => String(document.name || "").trim())
                .filter(Boolean)
            )
          );
          const addedDocumentKeySet = new Set(
            addedDocuments
              .flatMap((document) => [document.id, document.code, document.name, document.type])
              .map((value) => normalizeComplianceDocumentKey(String(value || "")))
              .filter(Boolean)
          );
          const missingRequiredDocumentNames = Array.from(
            new Set(
              (
                requiredDocumentsFromApi.length > 0 ?
                  requiredDocumentsFromApi
                    .filter((document) => !isReadyComplianceDocumentStatus(document.status))
                    .map((document) => document.name) :
                  requiredDocumentNames.filter((name) => {
                    const key = normalizeComplianceDocumentKey(name);
                    return !key || !addedDocumentKeySet.has(key);
                  })
              )
                .map((name) => String(name || "").trim())
                .filter(Boolean)
            )
          );

          marketSummaries[marketCode] = {
            marketCode,
            marketName: market.marketName || marketCode,
            addedDocumentNames,
            requiredDocumentNames,
            missingRequiredDocumentNames
          };

          for (const document of materialCertificationDocuments) {
            if (!isReadyComplianceDocumentStatus(document.status)) {
              continue;
            }

            const normalizedDocumentCode = normalizeCertificationDocumentCode(
              document.code
            );
            if (!normalizedDocumentCode) {
              continue;
            }

            if (isCertificationDocumentCode(normalizedDocumentCode)) {
              availableDocumentCodes.add(normalizedDocumentCode);
            }
          }
        }

        setAvailableCertificationDocumentCodes(Array.from(availableDocumentCodes));
        setComplianceDocumentsByMarketCode(marketSummaries);
      } catch {
        if (!cancelled) {
          setAvailableCertificationDocumentCodes([]);
          setComplianceDocumentsByMarketCode({});
        }
      } finally {
        if (!cancelled) {
          setIsCertificationAvailabilityLoading(false);
        }
      }
    };

    void fetchCertificationAvailability();

    return () => {
      cancelled = true;
    };
  }, [currentStep, isTrialPlan]);

  useEffect(() => {
    if (isModalMode) return;
    setPageTitle(t("pageTitle"), t("pageSubtitle"));
  }, [isModalMode, setPageTitle, t]);

  useEffect(() => {
    if (canMutate) return;

    if (isModalMode) {
      onClose?.();
      return;
    }

    router.replace(appRoutes.toAppPath("/products"));
  }, [appRoutes, canMutate, isModalMode, onClose, router]);

  useEffect(() => {
    skipCreateDraftPersistenceRef.current = false;
    setCurrentStep(normalizeInitialStep(initialStep));
    setDraftHistory([]);
    setIsSubmitting(false);
    setSubmissionMode(null);
    setProductData(resolveInitialProductData({ mode, isEditing, initialData, disableModalDraftRestore }));
  }, [disableModalDraftRestore, initialData, initialStep, isEditing, mode, productId]);

  useEffect(() => {
    if (!isStarterPlan) return;

    const requiredMarket = starterDomesticMarket || "vietnam";
    setProductData((prev) => {
      if (prev.destinationMarket === requiredMarket) {
        return prev;
      }

      return {
        ...prev,
        destinationMarket: requiredMarket,
        updatedAt: new Date().toISOString()
      };
    });
  }, [isStarterPlan, starterDomesticMarket]);

  useEffect(() => {
    if (!isStarterPlan) return;

    setProductData((prev) => {
      let changed = false;
      const normalizedMaterials = prev.materials.map((material) => {
        if (material.source === "imported") {
          changed = true;
          return {
            ...material,
            source: "domestic" as const
          };
        }
        return material;
      });

      if (!changed) {
        return prev;
      }

      return {
        ...prev,
        materials: normalizedMaterials,
        updatedAt: new Date().toISOString()
      };
    });
  }, [isStarterPlan]);

  useEffect(() => {
    let cancelled = false;

    const loadEditingShipmentStatus = async () => {
      if (!isEditing || !productId) {
        if (!cancelled) {
          setEditingShipmentStatus(null);
        }
        return;
      }

      try {
        const product = await fetchProductById(productId);
        if (cancelled) return;

        const shipmentId = String(product.shipmentId || "").trim();
        if (!shipmentId) {
          setEditingShipmentStatus(null);
          return;
        }

        const shipment = await fetchLogisticsShipmentById(shipmentId);
        if (cancelled) return;
        setEditingShipmentStatus(shipment.status || null);
      } catch {
        if (!cancelled) {
          setEditingShipmentStatus(null);
        }
      }
    };

    void loadEditingShipmentStatus();

    return () => {
      cancelled = true;
    };
  }, [isEditing, productId]);

  useEffect(() => {
    if (
    !isModalMode ||
    disableModalDraftRestore ||
    isEditing ||
    skipCreateDraftPersistenceRef.current)
    {
      return;
    }

    saveModalCreateDraft(productData);
  }, [disableModalDraftRestore, isModalMode, isEditing, productData]);

  useEffect(() => {
    if (!isModalMode || isEditing || skipCreateDraftPersistenceRef.current) {
      return;
    }

    onSessionDraftChange?.({
      currentStep: normalizeInitialStep(currentStep),
      data: productData,
      updatedAt: productData.updatedAt || new Date().toISOString()
    });
  }, [
    currentStep,
    isEditing,
    isModalMode,
    onSessionDraftChange,
    productData
  ]);

  const availableMaterialCertificationDocumentSet = React.useMemo(
    () =>
      new Set(
        availableCertificationDocumentCodes.map((value) =>
          normalizeCertificationDocumentCode(value)
        )
      ),
    [availableCertificationDocumentCodes]
  );

  const collectUnavailableMaterialCertificationLabels = React.useCallback(
    (payload: ProductAssessmentData) => {
      const unavailable = new Set<string>();

      for (const material of payload.materials || []) {
        for (const certValue of material.certifications || []) {
          const normalizedCertificationValue = String(certValue || "").trim();
          if (!normalizedCertificationValue) continue;

          const mappedDocumentCode =
            CERTIFICATION_DOCUMENT_CODE_BY_VALUE[normalizedCertificationValue];
          if (!mappedDocumentCode) continue;

          const normalizedDocumentCode = normalizeCertificationDocumentCode(
            mappedDocumentCode
          );
          if (
            normalizedDocumentCode &&
            !availableMaterialCertificationDocumentSet.has(normalizedDocumentCode)
          ) {
            unavailable.add(
              MATERIAL_CERTIFICATION_LABEL_BY_VALUE[normalizedCertificationValue] ||
                normalizedCertificationValue
            );
          }
        }
      }

      return Array.from(unavailable);
    },
    [availableMaterialCertificationDocumentSet]
  );

  const resolveMissingRequiredExportDocuments = React.useCallback(
    (payload: ProductAssessmentData) => {
      const marketCode = resolveComplianceMarketCode(payload.destinationMarket);
      if (!marketCode) return [];

      const summary = complianceDocumentsByMarketCode[marketCode];
      if (!summary) return [];

      return summary.missingRequiredDocumentNames || [];
    },
    [complianceDocumentsByMarketCode]
  );

  const updateData = useCallback((updates: Partial<ProductAssessmentData>) => {
    setProductData((prev) => {
      const hasChanges = Object.entries(updates).some(([key, value]) => {
        const currentValue = prev[key as keyof ProductAssessmentData];
        return !isSameValue(currentValue, value);
      });

      if (!hasChanges) {
        return prev;
      }

      return {
        ...prev,
        ...updates,
        updatedAt: new Date().toISOString()
      };
    });
  }, []);

  const progress = (currentStep - 1) / (steps.length - 1) * 100;
  const hasTrialDomesticAddressMismatch =
    isTrialPlan &&
    (isAddressOutsideTrialDomestic(productData.originAddress.country, starterDomesticMarket) ||
      isAddressOutsideTrialDomestic(productData.destinationAddress.country, starterDomesticMarket));
  const hasUnresolvedRoadTransportLegs = productData.transportLegs.some(
    (leg) => !hasResolvedRoadDistance(leg)
  );

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return (
          !!productData.productCode &&
          !!productData.productName &&
          !!productData.productType &&
          productData.weightPerUnit > 0 &&
          productData.quantity > 0);

      case 2:{
          const total = productData.materials.reduce(
            (sum, material) => sum + (material.percentage || 0),
            0
          );
          return productData.materials.length > 0 && total === 100;
        }
      case 3:{
          const total = productData.energySources.reduce(
            (sum, energy) => sum + (energy.percentage || 0),
            0
          );
          return productData.productionProcesses.length > 0 && total === 100;
        }
      case 4:
        return (
          !!productData.destinationMarket &&
          productData.transportLegs.length > 0 &&
          !hasTrialDomesticAddressMismatch &&
          !hasUnresolvedRoadTransportLegs
        );
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      return;
    }

    if (isModalMode) {
      onClose?.();
    }
  };

  const findExistingShipmentForProduct = useCallback(
    async (product: {
      id: string;
      productCode: string;
      productName: string;
    }): Promise<string | null> => {
      const candidateIds = new Set<string>();
      const searchTerms = [product.id, product.productCode, product.productName]
        .map((term) => term.trim())
        .filter((term) => term.length > 0);

      for (const term of searchTerms) {
        try {
          const summaries = await fetchAllLogisticsShipments({
            search: term,
            page_size: 20
          });
          for (const summary of summaries) {
            candidateIds.add(summary.id);
          }
        } catch {

        }
      }

      for (const shipmentId of Array.from(candidateIds).slice(0, 25)) {
        try {
          const detail = await fetchLogisticsShipmentById(shipmentId);
          if (
            shipmentContainsProduct(
              detail,
              product.id,
              product.productCode,
              product.productName
            )
          ) {
            return detail.id;
          }
        } catch {

        }
      }

      return null;
    },
    []
  );

  const ensureShipmentForPublishedProduct = useCallback(
    async (
      product: {
        id: string;
        productCode: string;
        productName: string;
      },
      payload: ProductAssessmentData
    ): Promise<string | null> => {
      const hasLogisticsInput =
        payload.transportLegs.length > 0 ||
        (typeof payload.estimatedTotalDistance === "number" &&
          Number.isFinite(payload.estimatedTotalDistance) &&
          payload.estimatedTotalDistance > 0);
      if (!hasLogisticsInput) return null;
      if (payload.transportLegs.some((leg) => !hasResolvedRoadDistance(leg))) {
        return null;
      }

      const existingShipmentId = await findExistingShipmentForProduct(product);
      if (existingShipmentId) {
        return existingShipmentId;
      }

      const shipmentLegs = buildShipmentLegsFromProduct(payload, unknownLocationLabel);
      if (shipmentLegs.length === 0) {
        return null;
      }

      const safeQuantity =
        typeof payload.quantity === "number" &&
        Number.isFinite(payload.quantity) &&
        payload.quantity > 0 ?
          Math.trunc(payload.quantity) :
          1;
      const perUnitWeightKg =
        typeof payload.weightPerUnit === "number" &&
        Number.isFinite(payload.weightPerUnit) &&
        payload.weightPerUnit > 0 ?
          payload.weightPerUnit / 1000 :
          0;
      const productWeightKg = Number((perUnitWeightKg * safeQuantity).toFixed(4));
      const transportPerProductCo2 =
        typeof payload.carbonResults?.perProduct.transport === "number" &&
        Number.isFinite(payload.carbonResults.perProduct.transport) &&
        payload.carbonResults.perProduct.transport > 0 ?
          payload.carbonResults.perProduct.transport :
          0;
      const totalTransportCo2 =
        typeof payload.carbonResults?.totalBatch.transport === "number" &&
        Number.isFinite(payload.carbonResults.totalBatch.transport) &&
        payload.carbonResults.totalBatch.transport > 0 ?
          payload.carbonResults.totalBatch.transport :
          Number((transportPerProductCo2 * safeQuantity).toFixed(4));

      const created = await createLogisticsShipment({
        reference_number: `PRD-${(payload.productCode || product.id).slice(0, 18)}-${Date.now().toString().slice(-6)}`,
        origin: toShipmentLocationInput(
          payload.originAddress,
          "Vietnam",
          unknownLocationLabel
        ),
        destination: toShipmentLocationInput(
          payload.destinationAddress,
          "Vietnam",
          unknownLocationLabel
        ),
        legs: shipmentLegs,
        products: [
          {
            product_id: product.id,
            quantity: safeQuantity,
            weight_kg: Math.max(0, productWeightKg),
            allocated_co2e: Math.max(0, totalTransportCo2)
          }
        ]
      });

      return created.id || null;
    },
    [findExistingShipmentForProduct, unknownLocationLabel]
  );

  const persistProduct = async (nextStatus: "draft" | "published") => {
    const timestamp = new Date().toISOString();
    const nextVersion = Math.max(1, (productData.version || 0) + 1);
    const payload: ProductAssessmentData = {
      ...productData,
      materials:
      isStarterPlan ?
      productData.materials.map((material) => ({
        ...material,
        source: material.source === "imported" ? "domestic" : material.source
      })) :
      productData.materials,
      destinationMarket:
      isStarterPlan ?
      starterDomesticMarket || "vietnam" :
      productData.destinationMarket,
      status: nextStatus,
      version: nextVersion,
      createdAt: productData.createdAt || timestamp,
      updatedAt: timestamp
    };

    if (isEditing && productId) {
      const canUpdatePublishedWithoutStatusTransition =
        nextStatus === "published" &&
        productData.status === "published" &&
        editingShipmentStatus === "pending";

      const updatePayload =
        nextStatus === "published" && !canUpdatePublishedWithoutStatusTransition ?
          { ...payload, status: "draft" as const } :
          payload;

      const updateResult = await updateProduct(productId, updatePayload);
      if (nextStatus === "published") {
        if (canUpdatePublishedWithoutStatusTransition) {
          return {
            result: {
              ...updateResult,
              status: "published"
            },
            timestamp,
            nextVersion,
            payload
          };
        }

        if (updateResult.status === "published") {
          return {
            result: {
              ...updateResult,
              status: "published"
            },
            timestamp,
            nextVersion,
            payload
          };
        }

        let statusResult;
        try {
          statusResult = await updateProductStatus(productId, "published");
        } catch (error) {
          if (isPublishBlockedByMissingDocumentsError(error)) {
            return {
              result: {
                ...updateResult,
                status: "draft"
              },
              timestamp,
              nextVersion,
              payload
            };
          }
          throw error;
        }

        return {
          result: {
            ...updateResult,
            ...statusResult,
            status: "published",
            version: Math.max(updateResult.version, statusResult.version),
            shipmentId: statusResult.shipmentId ?? updateResult.shipmentId,
            updatedAt: statusResult.updatedAt ?? updateResult.updatedAt
          },
          timestamp,
          nextVersion,
          payload
        };
      }
      return { result: updateResult, timestamp, nextVersion, payload };
    }

    if (nextStatus === "published") {
      const createPayload: ProductAssessmentData = {
        ...payload,
        status: "draft"
      };
      const createResult = await createProduct(createPayload, "draft");

      if (createResult.status === "published") {
        return { result: createResult, timestamp, nextVersion, payload };
      }

      if (!isValidProductId(createResult.id)) {
        throw new Error("Invalid product ID format.");
      }

      let statusResult;
      try {
        statusResult = await updateProductStatus(createResult.id, "published");
      } catch (error) {
        if (isPublishBlockedByMissingDocumentsError(error)) {
          return {
            result: {
              ...createResult,
              status: "draft"
            },
            timestamp,
            nextVersion,
            payload
          };
        }
        throw error;
      }

      return {
        result: {
          ...createResult,
          ...statusResult,
          status: "published",
          version: Math.max(createResult.version, statusResult.version),
          shipmentId: statusResult.shipmentId ?? createResult.shipmentId,
          updatedAt: statusResult.updatedAt ?? createResult.updatedAt
        },
        timestamp,
        nextVersion,
        payload
      };
    }

    const result = await createProduct(payload, "draft");
    return { result, timestamp, nextVersion, payload };
  };

  const handleSaveDraft = async () => {
    if (!canMutate) return;
    if (isEditing || productData.status === "published") return;
    if (isSubmitting) return;
    setSubmissionMode("draft");
    setIsSubmitting(true);

    try {
      const { result, timestamp, nextVersion } = await persistProduct("draft");
      const draft: DraftVersion = {
        id: `draft-${Date.now()}`,
        version: nextVersion,
        data: {
          ...productData,
          status: "draft",
          version: result.version,
          updatedAt: timestamp
        },
        timestamp
      };

      setDraftHistory((prev) => [draft, ...prev]);
      setProductData((prev) => ({
        ...prev,
        status: "draft",
        version: result.version,
        createdAt: prev.createdAt || timestamp,
        updatedAt: timestamp
      }));

      toast.success(
        isEditing ?
        t("toast.draftUpdated") :
        t("toast.draftSaved")
      );

      if (isModalMode) {
        if (!isEditing) {
          skipCreateDraftPersistenceRef.current = true;
          clearModalCreateDraft();
        }
        onCompleted?.({
          id: result.id,
          status: "draft",
          isUpdate: isEditing
        });
        onClose?.();
      }
    } catch (error) {
      toast.error(formatApiErrorMessage(error, t("toast.draftSaveFailed")));
    } finally {
      setIsSubmitting(false);
      setSubmissionMode(null);
    }
  };

  const handlePublish = async () => {
    if (!canMutate) return;
    if (isSubmitting) return;
    if (hasTrialDomesticAddressMismatch) {
      const expectedCountry = getExpectedCountryForTrialMarket(starterDomesticMarket);
      toast.error(
        t("toast.trialDomesticOnly", {
          country: expectedCountry
        })
      );
      setCurrentStep(4);
      return;
    }
    if (hasUnresolvedRoadTransportLegs) {
      toast.warning(t("toast.roadRouteRequired"));
      setCurrentStep(4);
      return;
    }
    if (!isTrialPlan && !appRoutes.isDemo && isCertificationAvailabilityLoading) {
      toast.warning(t("toast.certificationDocumentsChecking"));
    }

    if (!isTrialPlan && !appRoutes.isDemo) {
      const unavailableMaterialCertifications =
        collectUnavailableMaterialCertificationLabels(productData);
      if (unavailableMaterialCertifications.length > 0) {
        toast.warning(
          t("toast.missingMaterialCertificationDocuments", {
            certifications: unavailableMaterialCertifications.join(", ")
          })
        );
      }

      const missingRequiredExportDocuments =
        resolveMissingRequiredExportDocuments(productData);
      if (missingRequiredExportDocuments.length > 0) {
        const documentPreview = `${missingRequiredExportDocuments
          .slice(0, 3)
          .join(", ")}${missingRequiredExportDocuments.length > 3 ? "..." : ""}`;
        toast.warning(
          t("toast.missingExportDocuments", {
            documents: documentPreview
          })
        );
      }
    }

    setSubmissionMode("publish");
    setIsSubmitting(true);
    const publishToastId = toast.loading(t("toast.publishLoading"));

    try {
      const { result, timestamp, payload } = await persistProduct("published");
      const publishedSuccessfully = result.status === "published";
      let ensuredShipmentId: string | null = result.shipmentId || null;

      if (publishedSuccessfully && !ensuredShipmentId && isValidProductId(result.id)) {
        try {
          ensuredShipmentId = await ensureShipmentForPublishedProduct(
            {
              id: result.id,
              productCode: payload.productCode,
              productName: payload.productName
            },
            payload
          );
        } catch (shipmentError) {
          const shipmentErrorMessage = formatApiErrorMessage(
            shipmentError,
            t("toast.logisticsCreateFailed")
          );
          toast.warning(shipmentErrorMessage);
        }
      }

      setProductData((prev) => ({
        ...prev,
        status: publishedSuccessfully ? "published" : "draft",
        version: result.version,
        createdAt: prev.createdAt || timestamp,
        updatedAt: timestamp
      }));

      if (publishedSuccessfully) {
        toast.success(
          isEditing ?
          t("toast.publishUpdated") :
          t("toast.publishSuccess"),
          {
            id: publishToastId
          }
        );
      } else {
        toast.warning(t("toast.publishDraftFallback"), {
          id: publishToastId
        });
      }

      if (publishedSuccessfully && ensuredShipmentId && !isEditing) {
        toast.success(
          t("toast.logisticsCreated", {
            shipmentId: ensuredShipmentId
          })
        );
      }

      if (isModalMode) {
        if (!isEditing) {
          skipCreateDraftPersistenceRef.current = true;
          clearModalCreateDraft();
        }
        onCompleted?.({
          id: result.id,
          status: publishedSuccessfully ? "published" : "draft",
          isUpdate: isEditing
        });
        onClose?.();
        return;
      }

      if (isValidProductId(result.id)) {
        router.push(appRoutes.toSummaryPath(result.id));
      } else {
        toast.error(t("toast.invalidProductId"));
        router.push(appRoutes.toAppPath("/products"));
      }
    } catch (error) {
      if (isPublishBlockedByMissingDocumentsError(error)) {
        toast.warning(t("toast.publishDraftFallback"), {
          id: publishToastId
        });
      } else {
        toast.error(formatApiErrorMessage(error, t("toast.publishFailed")), {
          id: publishToastId
        });
      }
    } finally {
      setIsSubmitting(false);
      setSubmissionMode(null);
    }
  };

  if (!canMutate) {
    return null;
  }

  const containerClassName = isModalMode ? "space-y-4 md:space-y-6" : "space-y-4 md:space-y-6 max-w-5xl mx-auto";

  return (
    <div className={containerClassName}>
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs md:text-sm text-muted-foreground">
            {t("stepCounter", { current: currentStep, total: steps.length })}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <StepIndicators currentStep={currentStep} steps={steps} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            {React.createElement(steps[currentStep - 1].icon, {
              className: "w-4 h-4 md:w-5 md:h-5"
            })}
            <span className="truncate">{steps[currentStep - 1].title}</span>
          </CardTitle>
          {currentStep < steps.length &&
          <CardDescription className="text-xs md:text-sm">
              {t("fillInfoToContinue")}
            </CardDescription>
          }
        </CardHeader>
        <CardContent className="px-3 pb-4 pt-3 md:p-6">
          <StepContent
            currentStep={currentStep}
            data={productData}
            onChange={updateData}
            isEditing={isEditing}
            isStarterPlan={isStarterPlan}
            isTrialPlan={isTrialPlan}
            companyDomesticMarket={starterDomesticMarket}
            starterDomesticMarket={isStarterPlan ? starterDomesticMarket : null}
            availableCertificationDocumentCodes={
              availableCertificationDocumentCodes
            }
            isCertificationAvailabilityLoading={isCertificationAvailabilityLoading}
            complianceDocumentsByMarketCode={complianceDocumentsByMarketCode}
            draftHistory={draftHistory}
            onSaveDraft={handleSaveDraft}
            onPublish={handlePublish}
            isSubmitting={isSubmitting}
            submissionMode={submissionMode} />

        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:items-center sm:justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1 && !isModalMode}
          className="w-full gap-2 whitespace-nowrap sm:w-auto">

          <ArrowLeft className="w-4 h-4" />
          {isModalMode && currentStep === 1 ? t("buttons.close") : t("buttons.back")}
        </Button>

        {currentStep < steps.length ?
        <Button
          onClick={handleNext}
          disabled={!canProceed()}
          className="w-full gap-2 whitespace-nowrap sm:w-auto">

            {t("buttons.next")}
            <ArrowRight className="w-4 h-4" />
          </Button> :
        isModalMode ?
        <Button
          variant="outline"
          onClick={onClose}
          className="w-full gap-2 whitespace-nowrap sm:w-auto">

            {t("buttons.close")}
            <CheckCircle2 className="w-4 h-4" />
          </Button> :

        <Button
          variant="outline"
          onClick={() => router.push(appRoutes.toAppPath("/products"))}
          className="w-full gap-2 whitespace-nowrap sm:w-auto">

            {t("buttons.backToProducts")}
            <CheckCircle2 className="w-4 h-4" />
          </Button>
        }
      </div>
    </div>);

}
