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
import { cacheSummaryProduct } from "@/lib/summaryProductCache";

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
      badgeClassName: "border border-amber-200 bg-amber-50 text-amber-800",
      cardClassName: "",
      dotClassName: "bg-amber-500"
    },
    published: {
      label: t("statusLabel.published"),
      badgeClassName: "border border-emerald-200 bg-emerald-50 text-emerald-800",
      cardClassName: "",
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
    cacheSummaryProduct(product);
  }, []);

  const notifyNoPermission = useCallback(() => {
    showNoPermissionToast();
  }, []);

  const mapProductToAssessmentData = useCallback(
    (product: ProductRecord): ProductAssessmentData => ({
      productCode: product.productCode,
      productName: product.productName,
      productType: product.productType,
      productCategory: product.productCategory || "textile",
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
    const base = "cursor-pointer rounded-xl border transition-all duration-200 hover:shadow-md";
    const isActive = statusFilter === target;
    if (isActive) {
      if (target === "published") return `${base} border-emerald-500 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-500/20`;
      if (target === "draft") return `${base} border-amber-500 bg-amber-50/50 shadow-xs ring-2 ring-amber-500/20`;
      return `${base} border-slate-700 bg-slate-50/80 shadow-xs ring-2 ring-slate-400/20`;
    }
    return `${base} border-slate-200/90 bg-white hover:border-slate-300 shadow-xs`;
  };

  const filterChipClass = (target: "all" | "draft" | "published") => {
    const base = "h-8 px-3 rounded-lg text-xs font-medium transition-all sm:h-9 sm:px-3.5 sm:text-sm";
    if (statusFilter !== target) {
      return `${base} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900`;
    }
    if (target === "draft") {
      return `${base} border border-amber-300 bg-amber-50 text-amber-900 shadow-xs font-semibold ring-1 ring-amber-400/30`;
    }
    if (target === "published") {
      return `${base} border border-emerald-300 bg-emerald-50 text-emerald-900 shadow-xs font-semibold ring-1 ring-emerald-400/30`;
    }
    return `${base} border border-slate-700 bg-slate-900 text-white shadow-xs font-semibold`;
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
      <div className="space-y-3 md:space-y-6">
        <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
          <Card
            className={statCardClass("all")}
            onClick={() => setStatusFilter("all")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setStatusFilter("all")}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 shrink-0">
                  <Package className="h-4 w-4 sm:h-5 sm:w-5 text-slate-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-tight text-slate-900 sm:text-2xl">{stats.total}</p>
                  <p className="text-xs text-slate-500 font-medium truncate">{t("stats.all")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={statCardClass("draft")}
            onClick={() => setStatusFilter("draft")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setStatusFilter("draft")}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 shrink-0">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-amber-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-tight text-slate-900 sm:text-2xl">{stats.draft}</p>
                  <p className="text-xs text-slate-500 font-medium truncate">{t("stats.draft")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={statCardClass("published")}
            onClick={() => setStatusFilter("published")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setStatusFilter("published")}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 shrink-0">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-tight text-slate-900 sm:text-2xl">{stats.published}</p>
                  <p className="text-xs text-slate-500 font-medium truncate">{t("stats.published")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs md:p-3.5">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9.5 rounded-lg border-slate-200 bg-slate-50/60 pl-9.5 pr-9.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-none transition-colors hover:bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 md:h-10 md:pl-10 md:pr-10"
            />
            {searchQuery.trim().length > 0 && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setSearchQuery("")}
                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label={t("clearSearchAria")}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="mt-2.5 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
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
                className="h-8.5 gap-1.5 rounded-lg border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 sm:h-9 sm:gap-2 sm:px-3 sm:text-sm">
                <Layers className="w-4 h-4 text-slate-500" /> {t("manageBatches")}
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
                className="h-8.5 gap-1.5 rounded-lg border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 sm:h-9 sm:gap-2 sm:px-3 sm:text-sm">
                <Upload className="w-4 h-4 text-slate-500" /> {t("uploadFile")}
              </Button>
              <Button
                onClick={openCreateAssessment}
                className="h-8.5 gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 sm:h-9 sm:gap-2 sm:px-3.5 sm:text-sm">
                <PlusCircle className="w-4 h-4" /> {t("addProduct")}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-4 w-20 rounded bg-slate-100 animate-pulse" />
                  <div className="h-5 w-16 rounded-full bg-slate-100 animate-pulse" />
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-slate-100 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-slate-100 animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-slate-100 animate-pulse" />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <div className="space-y-1">
                    <div className="h-4 w-14 rounded bg-slate-100 animate-pulse" />
                    <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
                  </div>
                  <div className="flex gap-1">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 animate-pulse" />
                    <div className="h-8 w-8 rounded-lg bg-slate-100 animate-pulse" />
                  </div>
                </div>
              </Card>
            ))
          ) : products.length === 0 ? (
            <Card className="sm:col-span-2 xl:col-span-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 shadow-none">
              <CardContent className="flex flex-col items-center justify-center p-8 sm:p-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mb-3">
                  <Package className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-slate-800">{t("notFound")}</h3>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  {error || t("tryChangeFilter")}
                </p>
                <Button
                  onClick={openCreateAssessment}
                  className="mt-4 gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 sm:text-sm">
                  <PlusCircle className="w-4 h-4" /> {t("createNew")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            products.map((product) => {
              const editBlockedByCancelledShipment = isShipmentCancelled(
                product.shipmentId
              );
              const editButtonLabel =
                editBlockedByCancelledShipment
                  ? t("actions.editProductDisabledCancelledShipment")
                  : t("actions.editProduct");
              const isEditButtonDisabled =
                editBlockedByCancelledShipment ||
                editingProductId === product.id ||
                deletingProductId === product.id;

              return (
                <Card
                  key={product.id}
                  className="group relative flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-0 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md cursor-pointer overflow-hidden"
                  onClick={(event) => {
                    if (
                      event.target instanceof HTMLElement &&
                      event.target.closest("[data-product-card-actions='true']")
                    ) {
                      return;
                    }
                    void handleViewProductSafe(product);
                  }}>
                  <CardContent className="flex flex-1 flex-col p-4">
                    {/* Top Bar: SKU code + Status badge */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600 break-all">
                        {product.productCode}
                      </span>
                      <Badge className={`gap-1 text-[11px] font-medium shadow-none ${STATUS_CONFIG[product.status].badgeClassName}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[product.status].dotClassName}`} />
                        {STATUS_CONFIG[product.status].label}
                      </Badge>
                    </div>

                    {/* Main Info: Icon + Name + Materials */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-600 transition-colors group-hover:border-emerald-100 group-hover:bg-emerald-50/60 group-hover:text-emerald-700">
                        <Package className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {product.productName}
                        </h3>
                        {product.materials.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {product.materials.slice(0, 2).map((material) => (
                              <Badge
                                key={material.id}
                                variant="outline"
                                className="border-slate-200 bg-slate-50/70 text-[11px] font-normal text-slate-600">
                                {material.materialType} {material.percentage}%
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Divider: Carbon footprint & Actions */}
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <div>
                        <p className="text-base font-bold leading-none text-emerald-700">
                          {typeof product.carbonResults?.perProduct.total === "number"
                            ? `${product.carbonResults.perProduct.total.toFixed(2)} kg`
                            : "-"}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500 font-medium">{t("co2PerUnit")}</p>
                      </div>

                      <div
                        data-product-card-actions="true"
                        className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 rounded-lg ${
                            editBlockedByCancelledShipment
                              ? "cursor-not-allowed text-slate-300 opacity-50 hover:bg-transparent"
                              : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          }`}
                          disabled={isEditButtonDisabled}
                          onClick={(e) => {
                            e.stopPropagation();
                            void openEditAssessment(product);
                          }}
                          title={editButtonLabel}
                          aria-label={editButtonLabel}>
                          {editingProductId === product.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Pencil className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                          disabled={deletingProductId === product.id || editingProductId === product.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteProduct(product);
                          }}
                          title={t("actions.deleteProduct")}
                          aria-label={t("actions.deleteProduct")}>
                          {deletingProductId === product.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {products.length > 0 && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>
              {rangeStart}-{rangeEnd} / {pagination.total}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}>
                  {t("pagination.prev")}
                </Button>
                <span className="text-xs text-slate-600 font-medium">
                  {t("pagination.page", {
                    current: currentPage,
                    total: totalPages
                  })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}>
                  {t("pagination.next")}
                </Button>
              </div>
            )}
          </div>
        )}
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
