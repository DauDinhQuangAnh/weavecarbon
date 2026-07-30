"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from
"@/components/ui/alert-dialog";
import {
  Package,
  PlusCircle,
  Search,
  FileText,
  TrendingUp,
  Pencil,
  Upload,
  Layers,
  Loader2,
  Trash2,
  X } from
"lucide-react";
import { useRouter } from "next/navigation";
import { useAppRoutes } from "@/lib/demo/routes";
import { useDashboardTitle } from "@/contexts/DashboardContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useSubscriptionLock } from "@/hooks/useSubscriptionLock";
import { showNoPermissionToast } from "@/lib/noPermissionToast";
import type {
  ProductAssessmentData,
  ProductAssessmentSessionDraft
} from "@/components/dashboard/assessment/steps/types";
import {
  deleteProduct,
  fetchProductById,
  fetchProducts,
  isPublishedProductStatus,
  isValidProductId,
  type ProductRecord,
  type ProductStatus } from
"@/lib/productsApi";
import { normalizeDomesticMarketCode } from "@/lib/targetMarkets";
import {
  fetchLogisticsShipmentById,
  toTransportLegs,
  type LogisticsShipmentStatus } from
"@/lib/logisticsApi";
import { api } from "@/lib/apiClient";
import { dispatchProductUsageUpdatedEvent } from "@/lib/productUsageEvents";

// Dynamic imports — these components are only needed when user opens a modal
const BulkUploadModal = dynamic(
  () => import("@/components/dashboard/products/BulkUploadModal"),
  { ssr: false }
);
const BatchManagementModal = dynamic(
  () => import("@/components/dashboard/products/BatchManagementModal"),
  { ssr: false }
);
const AssessmentClient = dynamic(
  () => import("@/components/dashboard/assessment/AssessmentClient"),
  { ssr: false }
);

const ITEMS_PER_PAGE = 18;
const TRIAL_SKU_LIMIT = 5;
const SUMMARY_PREFETCH_PRODUCT_KEY = "weavecarbon_summary_prefetch_product";

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

const normalizePlanId = (plan: string | null | undefined) => {
  const value = (plan || "").trim().toLowerCase();
  if (!value) return "";
  if (value.includes("trial")) return "trial";
  if (value.includes("standard")) return "standard";
  if (value.includes("export")) return "export";
  return value;
};

const resolveStarterDomesticMarket = (domesticMarket: unknown, targetMarkets: unknown): string => {
  const marketCode = normalizeDomesticMarketCode(domesticMarket, targetMarkets);
  return TARGET_MARKET_TO_DESTINATION_MARKET[marketCode] || "vietnam";
};

const TOTAL_ASSESSMENT_STEPS = 6;

const normalizeAssessmentDraftStep = (step: number | null | undefined) => {
  const safeStep = Math.trunc(step || 1);
  return Math.min(TOTAL_ASSESSMENT_STEPS, Math.max(1, safeStep));
};

const hasAddressDraftValue = (
  address: ProductAssessmentData["originAddress"] | ProductAssessmentData["destinationAddress"]
) =>
  Boolean(
    address.aptSuite ||
    address.streetNumber ||
    address.street ||
    address.ward ||
    address.district ||
    address.city ||
    address.stateRegion ||
    address.country ||
    address.postalCode ||
    typeof address.lat === "number" ||
    typeof address.lng === "number"
  );

const hasAssessmentDraftContent = (draft: ProductAssessmentSessionDraft | null) => {
  if (!draft) return false;

  const { data, currentStep } = draft;
  if (normalizeAssessmentDraftStep(currentStep) > 1) {
    return true;
  }

  return Boolean(
    data.productCode.trim() ||
    data.productName.trim() ||
    data.productType.trim() ||
    data.weightPerUnit > 0 ||
    data.quantity > 0 ||
    data.materials.length > 0 ||
    data.accessories.length > 0 ||
    data.productionProcesses.length > 0 ||
    data.energySources.length > 0 ||
    data.manufacturingLocation.trim() ||
    data.wasteRecovery.trim() ||
    data.destinationMarket.trim() ||
    data.transportLegs.length > 0 ||
    data.estimatedTotalDistance > 0 ||
    hasAddressDraftValue(data.originAddress) ||
    hasAddressDraftValue(data.destinationAddress)
  );
};

type AssessmentModalMode = "create" | "edit" | null;

const ProductsClient: React.FC = () => {
  const router = useRouter();
  const appRoutes = useAppRoutes();
  const t = useTranslations("products");
  const { setPageTitle } = useDashboardTitle();
  const { canMutate } = usePermissions();
  const { currentPlan } = useSubscriptionLock();
  const normalizedCurrentPlan = normalizePlanId(currentPlan);
  const isStarterPlan = normalizedCurrentPlan === "trial";

  const STATUS_CONFIG: Record<
    ProductStatus,
    {
      label: string;
      badgeClassName: string;
      cardClassName: string;
      dotClassName: string;
    }> =
  {
    draft: {
      label: t("statusLabel.draft"),
      badgeClassName: "border border-amber-300 bg-amber-100 text-amber-900",
      cardClassName: "border-l-4 border-l-amber-400 bg-amber-50/40",
      dotClassName: "bg-amber-500"
    },
    published: {
      label: t("statusLabel.published"),
      badgeClassName: "border border-emerald-300 bg-emerald-100 text-emerald-900",
      cardClassName: "border-l-4 border-l-emerald-500 bg-emerald-50/40",
      dotClassName: "bg-emerald-500"
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "draft" | "published" | "all">(
    "all");
  const [currentPage, setCurrentPage] = useState(1);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: ITEMS_PER_PAGE,
    total: 0,
    total_pages: 0
  });
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    published: 0
  });
  const [batchCount, setBatchCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const loadRequestSeqRef = useRef(0);
  const [shipmentStatusById, setShipmentStatusById] = useState<
    Record<string, LogisticsShipmentStatus>
  >({});

  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [assessmentModalMode, setAssessmentModalMode] =
    useState<AssessmentModalMode>(null);
  const [assessmentModalInstanceKey, setAssessmentModalInstanceKey] = useState(0);
  const [assessmentProductId, setAssessmentProductId] = useState<string | null>(
    null
  );
  const [assessmentInitialStep, setAssessmentInitialStep] = useState(1);
  const [assessmentInitialData, setAssessmentInitialData] =
  useState<ProductAssessmentData | null>(null);
  const [assessmentSessionDraft, setAssessmentSessionDraft] =
  useState<ProductAssessmentSessionDraft | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [pendingDeleteProduct, setPendingDeleteProduct] = useState<ProductRecord | null>(null);
  const [starterDomesticMarket, setStarterDomesticMarket] = useState<string>("vietnam");
  const trialSkuLimitReached = isStarterPlan && stats.total >= TRIAL_SKU_LIMIT;

  const notifyTrialSkuLimitReached = useCallback(() => {
    toast.error(`Gói Trial chỉ cho phép tối đa ${TRIAL_SKU_LIMIT} SKU. Vui lòng nâng cấp để thêm sản phẩm mới.`);
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const mergeShipmentStatuses = useCallback(
    (
      entries: Array<{
        shipmentId: string;
        status: LogisticsShipmentStatus;
      }>
    ) => {
      if (entries.length === 0) {
        return;
      }

      setShipmentStatusById((current) => {
        let hasChanges = false;
        const next = { ...current };

        entries.forEach(({ shipmentId, status }) => {
          if (next[shipmentId] !== status) {
            next[shipmentId] = status;
            hasChanges = true;
          }
        });

        return hasChanges ? next : current;
      });
    },
    []
  );

  const fetchShipmentStatuses = useCallback(async (shipmentIds: string[]) => {
    const uniqueShipmentIds = Array.from(
      new Set(
        shipmentIds
          .map((shipmentId) => shipmentId.trim())
          .filter((shipmentId) => shipmentId.length > 0)
      )
    );

    if (uniqueShipmentIds.length === 0) {
      return [];
    }

    const results = await Promise.allSettled(
      uniqueShipmentIds.map(async (shipmentId) => {
        const shipment = await fetchLogisticsShipmentById(shipmentId);
        return {
          shipmentId,
          status: shipment.status
        };
      })
    );

    return results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : []
    );
  }, []);

  const resolveShipmentStatus = useCallback(
    async (shipmentId: string | null | undefined) => {
      const normalizedShipmentId =
        typeof shipmentId === "string" ? shipmentId.trim() : "";
      if (!normalizedShipmentId) {
        return null;
      }

      const cachedStatus = shipmentStatusById[normalizedShipmentId];
      if (cachedStatus) {
        return cachedStatus;
      }

      const fetchedEntries = await fetchShipmentStatuses([normalizedShipmentId]);
      if (fetchedEntries.length === 0) {
        return null;
      }

      mergeShipmentStatuses(fetchedEntries);
      return fetchedEntries[0]?.status || null;
    },
    [fetchShipmentStatuses, mergeShipmentStatuses, shipmentStatusById]
  );

  const isShipmentCancelled = useCallback(
    (shipmentId: string | null | undefined) => {
      const normalizedShipmentId =
        typeof shipmentId === "string" ? shipmentId.trim() : "";
      return (
        normalizedShipmentId.length > 0 &&
        shipmentStatusById[normalizedShipmentId] === "cancelled"
      );
    },
    [shipmentStatusById]
  );

  const cacheSummaryPrefetch = useCallback((product: ProductRecord) => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        SUMMARY_PREFETCH_PRODUCT_KEY,
        JSON.stringify({
          id: product.id,
          product,
          cached_at: Date.now()
        })
      );
    } catch {

    }
  }, []);

  const notifyNoPermission = useCallback(() => {
    showNoPermissionToast();
  }, []);

  const mapProductToAssessmentData = useCallback(
    (product: ProductRecord): ProductAssessmentData => ({
      productCode: product.productCode,
      productName: product.productName,
      productType: product.productType,
      weightPerUnit: product.weightPerUnit,
      quantity: product.quantity,
      materials: product.materials,
      accessories: product.accessories,
      productionProcesses: product.productionProcesses,
      energySources: product.energySources,
      manufacturingLocation: product.manufacturingLocation,
      wasteRecovery: product.wasteRecovery,
      destinationMarket: product.destinationMarket,
      originAddress: product.originAddress,
      destinationAddress: product.destinationAddress,
      transportLegs: product.transportLegs,
      estimatedTotalDistance: product.estimatedTotalDistance,
      carbonResults: product.carbonResults,
      status: isPublishedProductStatus(product.status) ? "published" : "draft",
      version: product.version,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    }),
    []
  );

  const persistAssessmentSessionDraft = useCallback(
    (draft: ProductAssessmentSessionDraft | null) => {
      if (!draft || !hasAssessmentDraftContent(draft)) {
        setAssessmentSessionDraft(null);
        return;
      }

      setAssessmentSessionDraft({
        ...draft,
        currentStep: normalizeAssessmentDraftStep(draft.currentStep),
        updatedAt: draft.updatedAt || new Date().toISOString()
      });
    },
    []
  );

  const closeAssessmentModal = useCallback(() => {
    setShowAssessmentModal(false);
    setAssessmentModalMode(null);
    setAssessmentProductId(null);
    setAssessmentInitialStep(1);
    setAssessmentInitialData(null);
  }, []);

  const openCreateAssessment = useCallback(() => {
    if (!canMutate) {
      notifyNoPermission();
      return;
    }
    if (trialSkuLimitReached) {
      notifyTrialSkuLimitReached();
      return;
    }
    setAssessmentModalMode("create");
    setAssessmentModalInstanceKey((current) => current + 1);
    setAssessmentProductId(null);
    setAssessmentInitialStep(
      assessmentSessionDraft ?
      normalizeAssessmentDraftStep(assessmentSessionDraft.currentStep) :
      1
    );
    setAssessmentInitialData(assessmentSessionDraft?.data || null);
    setShowAssessmentModal(true);
  }, [
    assessmentSessionDraft,
    canMutate,
    notifyNoPermission,
    notifyTrialSkuLimitReached,
    trialSkuLimitReached
  ]);

  const openEditAssessment = useCallback(
    async (product: ProductRecord) => {
      if (!canMutate) {
        notifyNoPermission();
        return;
      }
      if (!isValidProductId(product.id)) {
        toast.error(t("errors.invalidProductId"));
        return;
      }

      setEditingProductId(product.id);
      setAssessmentInitialStep(1);
      try {
        const productShipmentStatus = await resolveShipmentStatus(product.shipmentId);
        if (productShipmentStatus === "cancelled") {
          toast.error(t("errors.editBlockedByCancelledShipment"));
          return;
        }

        const fullProduct = await fetchProductById(product.id);
        const fullProductShipmentStatus = await resolveShipmentStatus(
          fullProduct.shipmentId
        );
        if (fullProductShipmentStatus === "cancelled") {
          toast.error(t("errors.editBlockedByCancelledShipment"));
          return;
        }

        let editableProduct = fullProduct;
        const shouldHydrateTransportFromShipment =
        editableProduct.shipmentId &&
        (
        editableProduct.transportLegs.length === 0 ||
        editableProduct.estimatedTotalDistance <= 0 ||
        !editableProduct.destinationMarket
        );

        if (shouldHydrateTransportFromShipment) {
          try {
            const shipment = await fetchLogisticsShipmentById(
              editableProduct.shipmentId as string
            );
            const shipmentLegs = toTransportLegs(shipment);
            const mappedLegs = shipmentLegs.map((leg, index) => {
              const normalizedMode: "road" | "sea" | "air" | "rail" =
              leg.mode === "ship" ? "sea" :
              leg.mode === "air" ? "air" :
              leg.mode === "rail" ? "rail" :
              "road";

              return {
              id: leg.id || `leg-${index + 1}`,
              mode: normalizedMode,
              estimatedDistance: leg.distanceKm > 0 ? leg.distanceKm : undefined
              };
            });
            const inferredDistance =
            shipment.totalDistanceKm > 0 ?
            shipment.totalDistanceKm :
            mappedLegs.reduce(
              (sum, leg) => sum + (typeof leg.estimatedDistance === "number" ? leg.estimatedDistance : 0),
              0
            );
            const hasAddressValue = (
            address: ProductRecord["originAddress"] | ProductRecord["destinationAddress"]) =>
            Boolean(
              address.aptSuite ||
              address.streetNumber ||
              address.street ||
              address.ward ||
              address.district ||
              address.city ||
              address.stateRegion ||
              address.country ||
              address.postalCode
            );
            const inferredDestinationMarket = (() => {
              const normalizedCountry = shipment.destination.country.trim().toLowerCase();
              if (!normalizedCountry) return editableProduct.destinationMarket;
              if (normalizedCountry.includes("viet")) return "vietnam";
              if (
              normalizedCountry.includes("us") ||
              normalizedCountry.includes("america") ||
              normalizedCountry.includes("hoa ky"))
              {
                return "usa";
              }
              if (normalizedCountry.includes("korea") || normalizedCountry.includes("han quoc")) {
                return "korea";
              }
              if (normalizedCountry.includes("japan") || normalizedCountry.includes("nhat")) {
                return "japan";
              }
              if (normalizedCountry.includes("china") || normalizedCountry.includes("trung quoc")) {
                return "china";
              }
              if (
              normalizedCountry.includes("eu") ||
              normalizedCountry.includes("europe") ||
              normalizedCountry.includes("germany") ||
              normalizedCountry.includes("netherlands"))
              {
                return "eu";
              }
              return editableProduct.destinationMarket;
            })();

            editableProduct = {
              ...editableProduct,
              destinationMarket: editableProduct.destinationMarket || inferredDestinationMarket,
              originAddress:
              hasAddressValue(editableProduct.originAddress) ?
              editableProduct.originAddress :
              {
                ...editableProduct.originAddress,
                street: shipment.origin.address || editableProduct.originAddress.street,
                city: shipment.origin.city || editableProduct.originAddress.city,
                country: shipment.origin.country || editableProduct.originAddress.country,
                lat: shipment.origin.lat ?? editableProduct.originAddress.lat,
                lng: shipment.origin.lng ?? editableProduct.originAddress.lng
              },
              destinationAddress:
              hasAddressValue(editableProduct.destinationAddress) ?
              editableProduct.destinationAddress :
              {
                ...editableProduct.destinationAddress,
                street: shipment.destination.address || editableProduct.destinationAddress.street,
                city: shipment.destination.city || editableProduct.destinationAddress.city,
                country: shipment.destination.country || editableProduct.destinationAddress.country,
                lat: shipment.destination.lat ?? editableProduct.destinationAddress.lat,
                lng: shipment.destination.lng ?? editableProduct.destinationAddress.lng
              },
              transportLegs:
              editableProduct.transportLegs.length > 0 ?
              editableProduct.transportLegs :
              mappedLegs,
              estimatedTotalDistance:
              editableProduct.estimatedTotalDistance > 0 ?
              editableProduct.estimatedTotalDistance :
              inferredDistance
            };
          } catch {

          }
        }

        setAssessmentProductId(editableProduct.id);
        setAssessmentInitialData(mapProductToAssessmentData(editableProduct));
        setAssessmentModalMode("edit");
        setAssessmentModalInstanceKey((current) => current + 1);
        setShowAssessmentModal(true);
      } catch {
        toast.error(t("errors.failedOpenProductDetail"));
      } finally {
        setEditingProductId((current) => current === product.id ? null : current);
      }
    },
    [
      canMutate,
      mapProductToAssessmentData,
      notifyNoPermission,
      resolveShipmentStatus,
      t
    ]
  );

  const handleAssessmentSessionDraftChange = useCallback(
    (draft: ProductAssessmentSessionDraft | null) => {
      if (!showAssessmentModal || assessmentModalMode !== "create") {
        return;
      }

      persistAssessmentSessionDraft(draft);
    },
    [assessmentModalMode, persistAssessmentSessionDraft, showAssessmentModal]
  );

  const handleDeleteProduct = useCallback(
    (product: ProductRecord) => {
      if (!canMutate) {
        notifyNoPermission();
        return;
      }
      if (!isValidProductId(product.id)) {
        toast.error(t("errors.invalidProductId"));
        return;
      }
      if (deletingProductId === product.id) {
        return;
      }

      setPendingDeleteProduct(product);
    },
    [canMutate, deletingProductId, notifyNoPermission, t]
  );

  const handleConfirmDeleteProduct = useCallback(
    async (product: ProductRecord) => {
      const fallbackProductName = product.productCode || t("deleteConfirmFallbackName");

      setDeletingProductId(product.id);
      try {
        await deleteProduct(product.id);

        setProducts((current) => current.filter((item) => item.id !== product.id));
        setPagination((current) => {
          const nextTotal = Math.max(0, current.total - 1);
          return {
            ...current,
            total: nextTotal,
            total_pages: Math.max(1, Math.ceil(nextTotal / Math.max(1, current.page_size)))
          };
        });
        setStats((current) => ({
          total: Math.max(0, current.total - 1),
          draft: product.status === "draft" ? Math.max(0, current.draft - 1) : current.draft,
          published:
          product.status === "published" ? Math.max(0, current.published - 1) : current.published
        }));

        if (products.length === 1 && currentPage > 1) {
          setCurrentPage((page) => Math.max(1, page - 1));
        } else {
          triggerRefresh();
        }

        if (assessmentProductId === product.id) {
          closeAssessmentModal();
        }

        setPendingDeleteProduct(null);
        dispatchProductUsageUpdatedEvent();
        toast.success(
          t("toasts.deleteSuccess", {
            name: product.productName || fallbackProductName
          })
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("errors.deleteProductFailed"));
      } finally {
        setDeletingProductId((current) => current === product.id ? null : current);
      }
    },
    [
      assessmentProductId,
      closeAssessmentModal,
      currentPage,
      products.length,
      t,
      triggerRefresh
    ]
  );

  // Only fetch /account for starter-plan users who need domestic market data.
  // Non-starter plans pass null for starterDomesticMarket, so no fetch needed.
  useEffect(() => {
    if (!isStarterPlan) return;

    let cancelled = false;
    const fetchDomesticMarket = async () => {
      try {
        const account = await api.get<{
          company?: {
            domestic_market?: string | null;
            target_markets?: string[] | null;
          } | null;
        }>("/account");

        if (cancelled) return;
        setStarterDomesticMarket(
          resolveStarterDomesticMarket(
            account?.company?.domestic_market || null,
            account?.company?.target_markets || null
          )
        );
      } catch {
        // keep default "vietnam"
      }
    };

    void fetchDomesticMarket();
    return () => { cancelled = true; };
  }, [isStarterPlan]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  const loadProducts = useCallback(async () => {
    const requestSeq = loadRequestSeqRef.current + 1;
    loadRequestSeqRef.current = requestSeq;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchProducts({
        search: debouncedSearchQuery.trim() || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        page: currentPage,
        page_size: ITEMS_PER_PAGE
      });
      if (requestSeq !== loadRequestSeqRef.current) {
        return;
      }

      const serverLikelyIgnoredStatusFilter =
      statusFilter !== "all" &&
      result.items.some((item) => item.status !== statusFilter);
      const effectiveItems =
      serverLikelyIgnoredStatusFilter ?
      result.items.filter((item) => item.status === statusFilter) :
      result.items;

      setProducts(effectiveItems);
      setPagination(
        serverLikelyIgnoredStatusFilter ?
        {
          page: 1,
          page_size: ITEMS_PER_PAGE,
          total: effectiveItems.length,
          total_pages: 1
        } :
        result.pagination
      );
      setBatchCount(0);

      const draftCount = result.items.filter((item) => item.status === "draft").length;
      const publishedCount = result.items.filter(
        (item) => item.status === "published"
      ).length;
      const isGlobalQuery =
      debouncedSearchQuery.trim().length === 0 && statusFilter === "all";

      setStats((previous) => {
        if (isGlobalQuery) {
          return {
            total: result.pagination.total,
            draft:
            result.pagination.total <= result.items.length ?
            draftCount :
            Math.max(previous.draft, draftCount),
            published:
            result.pagination.total <= result.items.length ?
            publishedCount :
            Math.max(previous.published, publishedCount)
          };
        }

        if (previous.total === 0 && result.pagination.total > 0) {
          return {
            total: result.pagination.total,
            draft: draftCount,
            published: publishedCount
          };
        }

        return previous;
      });

      const totalPages = Math.max(1, result.pagination.total_pages || 1);
      if (currentPage > totalPages) {
        setCurrentPage(totalPages);
      }
    } catch {
      if (requestSeq !== loadRequestSeqRef.current) {
        return;
      }
      setProducts([]);
      setPagination({
        page: 1,
        page_size: ITEMS_PER_PAGE,
        total: 0,
        total_pages: 0
      });
      setError(t("errors.failedLoadProducts"));
    } finally {
      if (requestSeq === loadRequestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [debouncedSearchQuery, statusFilter, currentPage, t]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts, refreshKey]);

  useEffect(() => {
    const shipmentIds = Array.from(
      new Set(
        products
          .map((product) =>
            typeof product.shipmentId === "string" ? product.shipmentId.trim() : ""
          )
          .filter((shipmentId) => shipmentId.length > 0)
      )
    );

    if (shipmentIds.length === 0) {
      return;
    }

    let cancelled = false;

    const hydrateShipmentStatuses = async () => {
      const entries = await fetchShipmentStatuses(shipmentIds);
      if (cancelled || entries.length === 0) {
        return;
      }

      mergeShipmentStatuses(entries);
    };

    void hydrateShipmentStatuses();

    return () => {
      cancelled = true;
    };
  }, [fetchShipmentStatuses, mergeShipmentStatuses, products]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, pagination.total_pages || 1);
  const statCardClass = (target: "all" | "draft" | "published") => {
    const base = "border bg-white shadow";
    if (target === "draft") return `${base} border-slate-300 bg-slate-50`;
    if (target === "published") return `${base} border-emerald-400 bg-emerald-100/75`;
    return `${base} border-slate-300`;
  };

  const filterChipClass = (target: "all" | "draft" | "published") => {
    const base = "h-8 px-2.5 border text-xs font-medium transition-colors sm:h-9 sm:px-3 sm:text-sm";
    if (statusFilter !== target) {
      return `${base} border-slate-300 bg-white text-slate-800 hover:bg-slate-100`;
    }
    if (target === "draft") {
      return `${base} border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200`;
    }
    if (target === "published") {
      return `${base} border-emerald-400 bg-emerald-100 text-emerald-900 hover:bg-emerald-200`;
    }
    return `${base} border-slate-500 bg-slate-200 text-slate-900 hover:bg-slate-300`;
  };

  const rangeStart =
  products.length === 0 ? 0 : (pagination.page - 1) * pagination.page_size + 1;
  const rangeEnd =
  products.length === 0 ? 0 : rangeStart + products.length - 1;
  const summaryText = useMemo(
    () =>
    t("summary", {
      total: stats.total,
      draft: stats.draft,
      published: stats.published,
      batches: batchCount
    }),
    [t, stats.total, stats.draft, stats.published, batchCount]
  );

  useEffect(() => {
    setPageTitle(t("title"), summaryText);
  }, [setPageTitle, t, summaryText]);

  const handleViewProduct = (productId: string) => {
    router.push(appRoutes.toSummaryPath(productId));
  };

  const handleViewProductSafe = async (product: ProductRecord) => {
    if (isValidProductId(product.id)) {
      cacheSummaryPrefetch(product);
      handleViewProduct(product.id);
      return;
    }

    const searchTerm = product.productCode || product.productName || undefined;
    if (!searchTerm) {
      toast.error(t("errors.invalidProductId"));
      return;
    }

    try {
      const refreshed = await fetchProducts({
        search: searchTerm,
        page: 1,
        page_size: 20
      });

      const exactByCode = refreshed.items.find(
        (item) =>
        item.productCode === product.productCode && isValidProductId(item.id)
      );
      const exactByName = refreshed.items.find(
        (item) =>
        item.productName === product.productName && isValidProductId(item.id)
      );
      const fallback = refreshed.items.find((item) => isValidProductId(item.id));
      const resolvedId = exactByCode?.id || exactByName?.id || fallback?.id;
      const resolvedProduct = exactByCode || exactByName || fallback || null;

      if (!resolvedId) {
        const fallbackSlug = (product.productCode || product.productName || "").trim();
        if (fallbackSlug.length > 0) {
          cacheSummaryPrefetch(product);
          router.push(appRoutes.toSummaryPath(fallbackSlug));
          return;
        }
        toast.error(t("errors.invalidProductId"));
        return;
      }

      if (resolvedProduct) {
        cacheSummaryPrefetch(resolvedProduct);
      } else {
        cacheSummaryPrefetch(product);
      }
      handleViewProduct(resolvedId);
    } catch {
      const fallbackSlug = (product.productCode || product.productName || "").trim();
      if (fallbackSlug.length > 0) {
        cacheSummaryPrefetch(product);
        router.push(appRoutes.toSummaryPath(fallbackSlug));
        return;
      }
      toast.error(t("errors.failedOpenProductDetail"));
    }
  };

  return (
    <>
      <div className="space-y-2 md:space-y-6">
        <div className="grid grid-cols-3 gap-1.5 md:gap-4">
          <Card className={statCardClass("all")}>

            <CardContent className="p-2 md:p-4">
              <div className="flex items-center gap-1.5 md:gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 bg-slate-100 md:h-10 md:w-10 md:rounded-lg">
                  <Package className="h-3 w-3 text-primary md:h-5 md:w-5" />
                </div>
                <div>
                  <p className="text-base font-bold leading-none text-slate-900 md:text-2xl">{stats.total}</p>
                  <p className="text-[10px] text-slate-600 md:text-xs">{t("stats.all")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={statCardClass("draft")}>

            <CardContent className="p-2 md:p-4">
              <div className="flex items-center gap-1.5 md:gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 bg-slate-200/80 md:h-10 md:w-10 md:rounded-lg">
                  <FileText className="h-3 w-3 text-slate-700 md:h-5 md:w-5" />
                </div>
                <div>
                  <p className="text-base font-bold leading-none text-slate-900 md:text-2xl">{stats.draft}</p>
                  <p className="text-[10px] text-slate-600 md:text-xs">{t("stats.draft")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={statCardClass("published")}>

            <CardContent className="p-2 md:p-4">
              <div className="flex items-center gap-1.5 md:gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-emerald-300 bg-emerald-100/90 md:h-10 md:w-10 md:rounded-lg">
                  <TrendingUp className="h-3 w-3 text-emerald-700 md:h-5 md:w-5" />
                </div>
                <div>
                  <p className="text-base font-bold leading-none text-slate-900 md:text-2xl">{stats.published}</p>
                  <p className="text-[10px] text-slate-600 md:text-xs">{t("stats.published")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-lg border border-slate-300 bg-slate-50 p-1.5 shadow md:p-3">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-500 shadow-sm md:h-10 md:pl-10 md:pr-10" />

            {searchQuery.trim().length > 0 &&
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setSearchQuery("")}
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label={t("clearSearchAria")}>

                <X className="h-4 w-4" />
              </Button>
            }
          </div>
          <div className="mt-1.5 flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                className={filterChipClass("all")}
                onClick={() => setStatusFilter("all")}>

                {t("allStatusFilter")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className={filterChipClass("draft")}
                onClick={() => setStatusFilter("draft")}>

                {t("draftStatus")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className={filterChipClass("published")}
                onClick={() => setStatusFilter("published")}>

                {t("publishedStatus")}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 lg:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  if (!canMutate) {
                    notifyNoPermission();
                    return;
                  }
                  setShowBatchModal(true);
                }}
                className="h-8 gap-1.5 border-slate-300 bg-white px-2.5 text-xs text-slate-800 hover:bg-slate-100 sm:h-9 sm:gap-2 sm:px-3 sm:text-sm">

                <Layers className="w-4 h-4" /> {t("manageBatches")}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!canMutate) {
                    notifyNoPermission();
                    return;
                  }
                  if (trialSkuLimitReached) {
                    notifyTrialSkuLimitReached();
                    return;
                  }
                  setShowBulkUpload(true);
                }}
                className="h-8 gap-1.5 border-slate-300 bg-white px-2.5 text-xs text-slate-800 hover:bg-slate-100 sm:h-9 sm:gap-2 sm:px-3 sm:text-sm">

                <Upload className="w-4 h-4" /> {t("uploadFile")}
              </Button>
              <Button
                onClick={openCreateAssessment}
                className="h-8 gap-1.5 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700 sm:h-9 sm:gap-2 sm:px-3 sm:text-sm">

                <PlusCircle className="w-4 h-4" /> {t("addProduct")}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {loading ?
          Array.from({ length: 6 }).map((_, index) =>
          <Card key={index} className="sm:col-span-1 border border-slate-300 bg-white shadow">
                <CardContent className="p-4">
                  <div className="mb-2 h-6 w-1/2 rounded bg-slate-200 animate-pulse" />
                  <div className="mb-3 h-4 w-1/3 rounded bg-slate-200 animate-pulse" />
                  <div className="h-5 w-full rounded bg-slate-200 animate-pulse" />
                </CardContent>
              </Card>
          ) :
          products.length === 0 ?
          <Card className="sm:col-span-2 lg:col-span-3 border border-slate-300 bg-slate-50/60 shadow">
              <CardContent className="p-8 text-center">
                <Package className="mx-auto mb-4 h-12 w-12 text-slate-600" />
                <h3 className="mb-2 font-medium text-slate-900">{t("notFound")}</h3>
                <p className="mb-4 text-sm text-slate-600">
                  {error || t("tryChangeFilter")}
                </p>
                <Button
                  onClick={openCreateAssessment}
                  variant="outline"
                  className="border-slate-300 bg-white text-slate-800 hover:bg-slate-100">

                  <PlusCircle className="w-4 h-4 mr-2" /> {t("createNew")}
                </Button>
              </CardContent>
            </Card> :

          products.map((product) => {
            const editBlockedByCancelledShipment = isShipmentCancelled(
              product.shipmentId
            );
            const editButtonLabel =
            editBlockedByCancelledShipment ?
            t("actions.editProductDisabledCancelledShipment") :
            t("actions.editProduct");
            const isEditButtonDisabled =
            editBlockedByCancelledShipment ||
            editingProductId === product.id ||
            deletingProductId === product.id;

            return <Card
              key={product.id}
              className={`relative h-full min-h-[140px] cursor-pointer border border-slate-300 shadow transition-all hover:border-slate-400 hover:shadow-lg ${STATUS_CONFIG[product.status].cardClassName}`}
              onClick={(event) => {
                if (
                  (event.target instanceof HTMLElement) &&
                  event.target.closest("[data-product-card-actions='true']")
                ) {
                  return;
                }
                void handleViewProductSafe(product);
              }}>

                <CardContent className="h-full p-4">
                  <div className="absolute right-3 top-3">
                    <Badge className={`gap-1 text-[11px] font-semibold ${STATUS_CONFIG[product.status].badgeClassName}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[product.status].dotClassName}`} />
                      {STATUS_CONFIG[product.status].label}
                    </Badge>
                  </div>
                  <div className="flex h-full flex-col gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="h-12 w-12 rounded-lg border border-slate-300 bg-slate-100 flex items-center justify-center shrink-0">
                        <Package className="w-6 h-6 text-slate-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="max-h-10 overflow-hidden font-medium leading-5 text-slate-900 break-words">
                          {product.productName}
                        </h3>
                        <p className="text-sm text-slate-600 break-all">{product.productCode}</p>
                        <div className="mt-1 hidden flex-wrap gap-1 sm:flex">
                          {product.materials.slice(0, 2).map((material) =>
                      <Badge
                        key={material.id}
                        variant="outline"
                        className="text-xs border-slate-300 bg-slate-100 text-slate-700">

                              {material.materialType} {material.percentage}%
                            </Badge>
                      )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
                      <div className="min-w-0 flex items-center gap-2 sm:gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-bold leading-5 text-emerald-700 sm:text-lg">
                            {typeof product.carbonResults?.perProduct.total === "number" ?
                        `${product.carbonResults.perProduct.total.toFixed(2)} kg` :
                        "-"}
                          </p>
                          <p className="text-xs text-slate-600">{t("co2PerUnit")}</p>
                        </div>
                      </div>

                      <div
                        data-product-card-actions="true"
                        className="flex shrink-0 items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="icon"
                          className={`h-8 w-8 bg-white ${editBlockedByCancelledShipment ? "cursor-not-allowed border-slate-200 text-slate-300 opacity-50 hover:bg-white" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
                          disabled={isEditButtonDisabled}
                          onClick={(e) => {
                            e.stopPropagation();
                            void openEditAssessment(product);
                          }}
                          title={editButtonLabel}
                          aria-label={editButtonLabel}>
                          {editingProductId === product.id ?
                          <Loader2 className="h-4 w-4 animate-spin" /> :
                          <Pencil className="h-4 w-4" />
                          }
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 border-red-300 bg-white text-red-700 hover:bg-red-50"
                          disabled={deletingProductId === product.id || editingProductId === product.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteProduct(product);
                          }}
                          title={t("actions.deleteProduct")}
                          aria-label={t("actions.deleteProduct")}>
                          {deletingProductId === product.id ?
                          <Loader2 className="h-4 w-4 animate-spin" /> :
                          <Trash2 className="h-4 w-4" />
                          }
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>;
          })
          }
        </div>

        
        {products.length > 0 &&
        <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              {rangeStart}-{rangeEnd} / {pagination.total}
            </span>
            {totalPages > 1 &&
          <div className="flex items-center justify-center gap-2">
                <Button
              variant="outline"
              size="sm"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}>

                  {t("pagination.prev")}
                </Button>
                <span className="text-xs text-slate-600">
                  {t("pagination.page", {
                current: currentPage,
                total: totalPages
              })}
                </span>
                <Button
              variant="outline"
              size="sm"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}>

                  {t("pagination.next")}
                </Button>
              </div>
          }
          </div>
        }
      </div>

      {canMutate &&
      <BulkUploadModal
        open={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        starterDomesticMarket={isStarterPlan ? starterDomesticMarket : null}
        onCompleted={() => {
          triggerRefresh();
          dispatchProductUsageUpdatedEvent();
        }} />
      }


      
      {canMutate &&
      <BatchManagementModal
        open={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        starterDomesticMarket={isStarterPlan ? starterDomesticMarket : null}
        onCompleted={triggerRefresh} />
      }


      
      <Dialog open={canMutate && showAssessmentModal} onOpenChange={(open) => !open && closeAssessmentModal()}>
        <DialogContent className="h-dvh w-screen max-w-[100vw] overflow-y-auto rounded-none p-4 md:h-[95vh] md:w-[95vw] md:max-w-6xl md:rounded-lg md:p-6">
          <DialogHeader>
            <DialogTitle>
              {assessmentModalMode === "edit" ?
                t("assessmentDialog.editTitle") :
                t("assessmentDialog.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {assessmentModalMode === "edit" ?
                t("assessmentDialog.editDescription") :
                t("assessmentDialog.createDescription")}
            </DialogDescription>
          </DialogHeader>
          <AssessmentClient
            key={`${assessmentModalMode || "idle"}-${assessmentProductId || "new"}-${assessmentModalInstanceKey}`}
            mode="modal"
            productId={assessmentProductId}
            initialData={assessmentInitialData}
            initialStep={assessmentInitialStep}
            disableModalDraftRestore
            onSessionDraftChange={
              assessmentModalMode === "create" ?
                handleAssessmentSessionDraftChange :
                undefined
            }
            onClose={closeAssessmentModal}
            onCompleted={(result) => {
              if (!result.isUpdate) {
                setAssessmentSessionDraft(null);
              }
              void loadProducts();
              dispatchProductUsageUpdatedEvent();
              closeAssessmentModal();
            }} />

        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingDeleteProduct)}
        onOpenChange={(open) => {
          if (!open && !deletingProductId) {
            setPendingDeleteProduct(null);
          }
        }}>

        <AlertDialogContent className="w-[92vw] max-w-md border-slate-200 bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("actions.deleteProduct")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("actions.deleteConfirm", {
                name:
                  pendingDeleteProduct?.productName ||
                  pendingDeleteProduct?.productCode ||
                  t("deleteConfirmFallbackName")
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingProductId)}>
              {"Hủy"}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!pendingDeleteProduct || Boolean(deletingProductId)}
              onClick={async (event) => {
                event.preventDefault();
                if (!pendingDeleteProduct) {
                  return;
                }
                await handleConfirmDeleteProduct(pendingDeleteProduct);
              }}>

              {deletingProductId === pendingDeleteProduct?.id &&
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              }
              {t("actions.deleteProduct")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>);

};

export default ProductsClient;
