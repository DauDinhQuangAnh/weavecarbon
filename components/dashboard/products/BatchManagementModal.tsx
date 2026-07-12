import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  Layers,
  Package,
  Plus,
  Search,
  Send,
  Trash2
} from "lucide-react";
import {
  addProductToBatch,
  createProductBatch,
  fetchAllProducts,
  formatApiErrorMessage,
  getProductBatchById,
  isValidBatchId,
  listProductBatches,
  publishProductBatch,
  removeProductBatchItem,
  type ProductBatchDetail,
  type ProductBatchSummary,
  type ProductRecord
} from "@/lib/productsApi";
import { isApiError } from "@/lib/apiClient";interface BatchManagementModalProps {
  open: boolean;
  onClose: () => void;
  initialBatchId?: string;
  onCompleted?: () => void;
  starterDomesticMarket?: string | null;
}

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

const normalizeDestinationMarket = (value: string | null | undefined): string => {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return "";
  return DESTINATION_MARKET_ALIASES[normalized] || normalized;
};

const formatMissingDomesticDocumentsMessage = (error: unknown) => {
  if (!isApiError(error) || error.code !== "MISSING_DOMESTIC_DOCUMENTS") {
    return null;
  }

  const details = error.details as
    | {
        market_code?: string;
        missing_by_product?: Array<{
          product_code?: string;
          product_name?: string;
          missing_documents?: Array<{ document_name?: string }>;
        }>;
      }
    | undefined;

  const missingByProduct = Array.isArray(details?.missing_by_product)
    ? details?.missing_by_product || []
    : [];
  if (missingByProduct.length === 0) {
    return error.message;
  }

  const productSummaries = missingByProduct.slice(0, 2).map((product) => {
    const productLabel = product.product_code || product.product_name || "Product";
    const docs = Array.isArray(product.missing_documents)
      ? product.missing_documents
          .map((item) => item.document_name || "Document")
          .slice(0, 2)
          .join(", ")
      : "Document";
    return `${productLabel}: ${docs}`;
  });

  const marketLabel = details?.market_code ? ` (${details.market_code})` : "";
  return `Thiếu tài liệu nội địa bắt buộc${marketLabel}. ${productSummaries.join(" | ")}`;
};

const BatchManagementModal: React.FC<BatchManagementModalProps> = ({
  open,
  onClose,
  initialBatchId,
  onCompleted,
  starterDomesticMarket
}) => {
  const t = useTranslations("products.batchManagement");
  const locale = "vi";
  const displayLocale = "vi-VN";
  const trialDomesticOnlyBatchWarning: string =
    locale === "vi"
      ? "Gói Trial chỉ cho phép lô hàng nội địa. Lô hiện tại có sản phẩm ngoài nội địa nên không thể xuất bản."
      : "Trial plan supports domestic batches only. This batch contains non-domestic products and cannot be published.";
  const normalizedStarterDomesticMarket =
  normalizeDestinationMarket(starterDomesticMarket);
  const starterDomesticOnly = normalizedStarterDomesticMarket.length > 0;
  const [batches, setBatches] = useState<ProductBatchSummary[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"list" | "create" | "detail">(
    initialBatchId ? "detail" : "list"
  );
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(
    initialBatchId || null
  );
  const [selectedBatchDetail, setSelectedBatchDetail] =
  useState<ProductBatchDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailLoadError, setDetailLoadError] = useState<string | null>(null);

  const [newBatchName, setNewBatchName] = useState("");
  const [newBatchDescription, setNewBatchDescription] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const addProductSearchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedBatch = useMemo(() => {
    if (selectedBatchDetail && selectedBatchDetail.id === selectedBatchId) {
      return selectedBatchDetail;
    }

    const summary = batches.find((b) => b.id === selectedBatchId);
    return summary ?
    { ...summary, items: [] } as ProductBatchDetail :
    null;
  }, [batches, selectedBatchId, selectedBatchDetail]);
  const hasSelectedBatchId = Boolean(selectedBatchId);
  const selectedBatchHasValidId = Boolean(selectedBatch && isValidBatchId(selectedBatch.id));
  const resolvedItemCount = selectedBatchDetail ?
  selectedBatchDetail.items.length :
  selectedBatch?.totalProducts ?? 0;

  const getStatusBadgeClass = (status: ProductBatchSummary["status"]) => {
    if (status === "published") {
      return "bg-green-100 text-green-700";
    }
    if (status === "archived") {
      return "bg-yellow-100 text-yellow-700";
    }
    return "bg-gray-100 text-gray-700";
  };

  const getStatusLabel = (status: ProductBatchSummary["status"]) => {
    if (status === "published") return t("status.published");
    if (status === "archived") return t("status.archived");
    return t("status.draft");
  };

  const isStarterDomesticProduct = useCallback(
    (product: ProductRecord) => {
      if (!starterDomesticOnly) return true;
      return (
        normalizeDestinationMarket(product.destinationMarket) ===
        normalizedStarterDomesticMarket
      );
    },
    [normalizedStarterDomesticMarket, starterDomesticOnly]
  );

  const loadBatches = useCallback(async () => {
    const result = await listProductBatches({
      page: 1,
      page_size: 100
    });
    setBatches(result.items);
  }, []);

  const loadProducts = useCallback(async () => {
    const data = await fetchAllProducts();
    setProducts(
      starterDomesticOnly ? data.filter(isStarterDomesticProduct) : data
    );
  }, [isStarterDomesticProduct, starterDomesticOnly]);

  const loadBatchDetail = useCallback(async (batchId: string) => {
    const normalizedBatchId = batchId.trim();
    if (!normalizedBatchId) {
      setSelectedBatchDetail(null);
      setDetailLoadError(t("errors.missingBatchId"));
      return;
    }
    if (!isValidBatchId(normalizedBatchId)) {
      setSelectedBatchDetail(null);
      setDetailLoadError(t("errors.invalidBatchId"));
      return;
    }

    setDetailLoadError(null);
    setIsDetailLoading(true);
    try {
      const detail = await getProductBatchById(normalizedBatchId);
      setSelectedBatchDetail(detail);
      setDetailLoadError(null);
    } catch (error) {
      setSelectedBatchDetail(null);
      const message = formatApiErrorMessage(error, t("errors.loadBatchDetailFailed"));
      setDetailLoadError(message);
      toast.error(message);
    } finally {
      setIsDetailLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const init = async () => {
      setIsLoading(true);
      try {
        const [batchResult, productResult] = await Promise.all([
        listProductBatches({ page: 1, page_size: 100 }),
        fetchAllProducts()]
        );

        if (cancelled) return;

        setBatches(batchResult.items);
        setProducts(
          starterDomesticOnly ?
          productResult.filter(isStarterDomesticProduct) :
          productResult
        );

        const targetBatchId = initialBatchId?.trim();
        if (targetBatchId) {
          setSelectedBatchId(targetBatchId);
          setActiveTab("detail");
          if (!cancelled) {
            if (isValidBatchId(targetBatchId)) {
              await loadBatchDetail(targetBatchId);
            } else {
              setSelectedBatchDetail(null);
              setDetailLoadError(t("errors.invalidBatchId"));
            }
          }
        } else if (!cancelled) {
          setSelectedBatchId(null);
          setSelectedBatchDetail(null);
          setDetailLoadError(null);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(formatApiErrorMessage(error, t("errors.loadBatchDataFailed")));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [
    initialBatchId,
    isStarterDomesticProduct,
    loadBatchDetail,
    open,
    starterDomesticOnly,
    t
  ]);

  const searchedProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
      product.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.productCode.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [products, searchQuery]);
  const availableProducts = searchedProducts;
  const addableProducts = useMemo(() => {
    if (!selectedBatch) return [];
    return availableProducts.filter(
      (product) => !selectedBatch.items.some((item) => item.productId === product.id)
    );
  }, [availableProducts, selectedBatch]);
  const selectedBatchHasNonDomesticProduct = useMemo(() => {
    if (!starterDomesticOnly || !selectedBatchDetail) return false;

    return selectedBatchDetail.items.some((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      if (!product) return true;
      return !isStarterDomesticProduct(product);
    });
  }, [isStarterDomesticProduct, products, selectedBatchDetail, starterDomesticOnly]);

  const handleCreateBatch = async () => {
    if (!newBatchName.trim()) {
      toast.error(t("errors.enterBatchName"));
      return;
    }

    try {
      setIsLoading(true);
      const batch = await createProductBatch({
        name: newBatchName.trim(),
        description: newBatchDescription.trim() || undefined
      });

      if (selectedProductIds.length > 0) {
        const selectedProducts = selectedProductIds.
        map((productId) => products.find((item) => item.id === productId)).
        filter(
          (product): product is ProductRecord => {
            if (!product) return false;
            return isStarterDomesticProduct(product);
          }
        );
        const skippedByStarter =
        selectedProductIds.length - selectedProducts.length;
        if (starterDomesticOnly && skippedByStarter > 0) {
          toast.warning(
            `Gói Trial: bỏ qua ${skippedByStarter} sản phẩm không thuộc thị trường nội địa.`
          );
        }
        let addedCount = 0;
        let failedCount = 0;

        for (const product of selectedProducts) {
          try {
            await addProductToBatch(batch.id, {
              product_id: product.id,
              quantity: product.quantity > 0 ? product.quantity : 1,
              weight_kg:
              product.weightPerUnit > 0 ?
              Number((product.weightPerUnit / 1000).toFixed(4)) :
              undefined,
              co2_per_unit:
              product.carbonResults?.perProduct.total !== undefined ?
              Number(product.carbonResults.perProduct.total.toFixed(4)) :
              undefined
            });
            addedCount += 1;
          } catch {
            failedCount += 1;
          }
        }

        if (failedCount > 0) {
          toast.warning(
            t("toasts.createdBatchButSomeFailed", {
              failed: failedCount,
              total: selectedProducts.length
            })
          );
        } else if (addedCount > 0) {
          toast.success(t("toasts.addedProductsCount", { count: addedCount }));
        }
      }

      await Promise.all([loadBatches(), loadProducts()]);
      await loadBatchDetail(batch.id);

      setNewBatchName("");
      setNewBatchDescription("");
      setSelectedProductIds([]);
      setSelectedBatchId(batch.id);
      setActiveTab("detail");

      onCompleted?.();
      toast.success(t("toasts.createdBatch", { name: batch.name }));
    } catch (error) {
      toast.error(formatApiErrorMessage(error, t("errors.createBatchFailed")));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProductToBatch = async (product: ProductRecord) => {
    if (!selectedBatchId) return;
    if (!isValidBatchId(selectedBatchId)) {
      toast.error(t("errors.invalidBatchIdForUpdate"));
      return;
    }
    if (!isStarterDomesticProduct(product)) {
      toast.error("Gói Trial chỉ cho phép sản phẩm nội địa.");
      return;
    }

    try {
      await addProductToBatch(selectedBatchId, {
        product_id: product.id,
        quantity: product.quantity > 0 ? product.quantity : 1,
        weight_kg:
        product.weightPerUnit > 0 ?
        Number((product.weightPerUnit / 1000).toFixed(4)) :
        undefined,
        co2_per_unit:
        product.carbonResults?.perProduct.total !== undefined ?
        Number(product.carbonResults.perProduct.total.toFixed(4)) :
        undefined
      });

      await Promise.all([loadBatchDetail(selectedBatchId), loadBatches()]);
      onCompleted?.();
      toast.success(t("toasts.addedProductToBatch", { name: product.productName }));
    } catch (error) {
      toast.error(formatApiErrorMessage(error, t("errors.addProductFailed")));
    }
  };

  const handleRemoveProductFromBatch = async (productId: string) => {
    if (!selectedBatchId) return;
    if (!isValidBatchId(selectedBatchId)) {
      toast.error(t("errors.invalidBatchIdForUpdate"));
      return;
    }

    try {
      await removeProductBatchItem(selectedBatchId, productId);
      await Promise.all([loadBatchDetail(selectedBatchId), loadBatches()]);
      onCompleted?.();
      toast.success(t("toasts.removedProduct"));
    } catch (error) {
      toast.error(formatApiErrorMessage(error, t("errors.removeProductFailed")));
    }
  };

  const handlePublishBatch = async () => {
    if (!selectedBatch || resolvedItemCount === 0) {
      toast.error(t("errors.atLeastOneProduct"));
      return;
    }
    if (selectedBatchHasNonDomesticProduct) {
      toast.error("Gói Trial chỉ cho phép lô hàng gồm sản phẩm nội địa.");
      return;
    }

    if (!selectedBatchId) return;
    if (!isValidBatchId(selectedBatchId)) {
      toast.error(t("errors.invalidBatchIdForPublish"));
      return;
    }

    setIsPublishing(true);

    try {
      const publishResult = await publishProductBatch(selectedBatchId);
      await Promise.all([loadBatchDetail(selectedBatchId), loadBatches()]);
      onCompleted?.();

      if (publishResult.message) {
        toast.success(publishResult.message);
      } else if (publishResult.shipmentId) {
        toast.success(t("toasts.publishedSuccessWithShipment", { shipmentId: publishResult.shipmentId }));
      } else {
        toast.success(t("toasts.publishedSuccess"));
      }
    } catch (error) {
      const missingDocumentsMessage = formatMissingDomesticDocumentsMessage(error);
      if (missingDocumentsMessage) {
        toast.error(missingDocumentsMessage);
        return;
      }
      toast.error(formatApiErrorMessage(error, t("errors.publishBatchFailed")));
    } finally {
      setIsPublishing(false);
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((prev) =>
    prev.includes(productId) ?
    prev.filter((id) => id !== productId) :
    [...prev, productId]
    );
  };

  const setProductSelection = (productId: string, checked: boolean) => {
    setSelectedProductIds((prev) => {
      if (checked) {
        return prev.includes(productId) ? prev : [...prev, productId];
      }
      return prev.filter((id) => id !== productId);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex h-dvh w-screen max-w-[100vw] flex-col overflow-hidden rounded-none p-3 sm:p-4 md:max-h-[92vh] md:w-[96vw] md:max-w-4xl md:rounded-lg md:p-6">
        <DialogHeader className="space-y-1 pb-1">
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            {t("modal.title")}
          </DialogTitle>
          <DialogDescription>
            {t("modal.description")}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "list" | "create" | "detail")}
          className="flex flex-1 flex-col overflow-hidden">

          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            <TabsTrigger value="list">{t("tabs.list", { count: batches.length })}</TabsTrigger>
            <TabsTrigger value="create">{t("tabs.create")}</TabsTrigger>
            <TabsTrigger
              value="detail"
              disabled={!hasSelectedBatchId}>

              {t("tabs.detail", { count: selectedBatch ? resolvedItemCount : 0 })}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="flex-1 overflow-auto space-y-3">
            {isLoading ?
            <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) =>
              <Card key={index}>
                    <CardContent className="p-4">
                      <div className="h-5 w-1/3 bg-muted rounded animate-pulse mb-2" />
                      <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                    </CardContent>
                  </Card>
              )}
              </div> :
            batches.length === 0 ?
            <div className="text-center py-8">
                <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">{t("list.noBatches")}</p>
                <Button onClick={() => setActiveTab("create")} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" /> {t("list.createBatch")}
                </Button>
              </div> :

            batches.map((batch) =>
            <Card
              key={batch.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                setSelectedBatchId(batch.id);
                setDetailLoadError(null);
                setActiveTab("detail");
                if (isValidBatchId(batch.id)) {
                  void loadBatchDetail(batch.id);
                } else {
                  setSelectedBatchDetail(null);
                }
              }}>

                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Layers className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="truncate font-medium">{batch.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {t("list.productsAndUnits", {
                              products: batch.totalProducts,
                              units: batch.totalQuantity.toLocaleString(displayLocale)
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <div className="text-left sm:text-right">
                          <p className="font-bold text-primary">{batch.totalCO2.toFixed(1)} kg</p>
                          <p className="text-xs text-muted-foreground">{t("list.totalCo2")}</p>
                        </div>
                        <Badge className={getStatusBadgeClass(batch.status)}>
                          {getStatusLabel(batch.status)}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
            )
            }
          </TabsContent>

          <TabsContent value="create" className="flex-1 overflow-auto space-y-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t("form.batchName")}</label>
                <Input
                  placeholder={t("form.batchNamePlaceholder")}
                  value={newBatchName}
                  onChange={(event) => setNewBatchName(event.target.value)}
                  className="mt-1" />

              </div>
              <div>
                <label className="text-sm font-medium">{t("form.description")}</label>
                <Textarea
                  placeholder={t("form.descriptionPlaceholder")}
                  value={newBatchDescription}
                  onChange={(event) => setNewBatchDescription(event.target.value)}
                  className="mt-1"
                  rows={2} />

              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                {t("form.selectProducts", { count: selectedProductIds.length })}
              </label>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t("form.searchProducts")}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="pl-10" />

              </div>

              <div className="max-h-50 overflow-auto space-y-2 border rounded-lg p-2">
                {availableProducts.map((product) =>
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                  onClick={() => toggleProductSelection(product.id)}>

                    <Checkbox
                    checked={selectedProductIds.includes(product.id)}
                    onClick={(event) => event.stopPropagation()}
                    onCheckedChange={(checked) =>
                    setProductSelection(product.id, checked === true)
                    } />

                    <Package className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.productName}</p>
                      <p className="text-xs text-muted-foreground">{product.productCode}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {(product.carbonResults?.perProduct.total ?? 0).toFixed(2)} kg CO2e
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            <Button onClick={() => void handleCreateBatch()} className="w-full" disabled={isLoading}>
              <Plus className="w-4 h-4 mr-2" /> {t("form.createButton")}
            </Button>
          </TabsContent>

          <TabsContent value="detail" className="flex-1 overflow-auto space-y-4">
            {selectedBatch &&
            <>
                {!selectedBatchHasValidId &&
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    {t("errors.invalidBatchIdOverview")}
                  </div>
              }
                {selectedBatchHasNonDomesticProduct && trialDomesticOnlyBatchWarning === "__legacy__" &&
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    Gói Trial chỉ cho phép lô hàng nội địa. Lô hiện tại có sản phẩm ngoài nội địa nên không thể xuất bản.
                  </div>
              }
                {selectedBatchHasNonDomesticProduct &&
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    {trialDomesticOnlyBatchWarning}
                  </div>
              }
                <Card>
                  <CardContent className="p-4">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="font-bold text-lg">{selectedBatch.name}</h3>
                        {selectedBatch.description &&
                      <p className="text-sm text-muted-foreground">{selectedBatch.description}</p>
                      }
                      </div>
                      <Badge className={getStatusBadgeClass(selectedBatch.status)}>
                        {getStatusLabel(selectedBatch.status)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-2 lg:grid-cols-4">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{selectedBatch.totalProducts}</p>
                        <p className="text-xs text-muted-foreground">{t("summary.products")}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">
                          {selectedBatch.totalQuantity.toLocaleString(displayLocale)}
                        </p>
                        <p className="text-xs text-muted-foreground">{t("summary.quantity")}</p>
                      </div>
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <p className="text-2xl font-bold text-primary">{selectedBatch.totalCO2.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">{t("summary.totalCo2")}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{selectedBatch.totalWeight.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">{t("summary.totalWeight")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div>
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h4 className="font-medium">{t("detail.itemsTitle", { count: resolvedItemCount })}</h4>
                    {selectedBatch.status === "draft" && selectedBatchHasValidId &&
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      requestAnimationFrame(() => {
                        addProductSearchInputRef.current?.focus();
                        addProductSearchInputRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "center"
                        });
                      });
                    }}>

                        <Plus className="w-4 h-4 mr-1" /> {t("detail.add")}
                      </Button>
                  }
                  </div>

                  {isDetailLoading ?
                <div className="p-6 text-center text-sm text-muted-foreground">{t("detail.loading")}</div> :
                selectedBatchDetail ?
                <div className="space-y-2 max-h-50 overflow-auto">
                      {selectedBatch.items.map((item) =>
                  <div
                    key={item.productId}
                    className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">

                          <Package className="w-5 h-5 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.productName}</p>
                            <p className="text-sm text-muted-foreground">{item.productCode}</p>
                          </div>
                          <div className="sm:text-right">
                            <p className="font-medium">{item.quantity} {t("detail.unit")}</p>
                            <p className="text-xs text-muted-foreground">
                              {(item.quantity * item.co2PerUnit).toFixed(1)} kg CO2e
                            </p>
                          </div>
                          {selectedBatch.status === "draft" && selectedBatchHasValidId &&
                    <Button
                      variant="ghost"
                      size="icon"
                      className="self-start sm:self-auto"
                      onClick={() => void handleRemoveProductFromBatch(item.productId)}>

                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                    }
                        </div>
                  )}
                    </div> :
                detailLoadError ?
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      {t("errors.failedLoadDetailList")}
                      <div className="mt-1 text-xs text-amber-700">{detailLoadError}</div>
                    </div> :

                <div className="space-y-2 max-h-50 overflow-auto">
                      <div className="p-3 text-sm text-muted-foreground">
                        {t("errors.noDetailData")}
                      </div>
                    </div>
                }

                  {selectedBatch.status === "draft" && selectedBatchHasValidId &&
                <div className="mt-4">
                      <p className="text-sm font-medium mb-2">{t("detail.addProductsTitle")}</p>
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                      ref={addProductSearchInputRef}
                      placeholder={t("detail.searchProducts")}
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="pl-10" />

                      </div>
                      <div className="max-h-37.5 overflow-auto space-y-1">
                        {addableProducts.length === 0 &&
                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                            {t("detail.noAddableProducts")}
                          </div>
                    }
                        {addableProducts.slice(0, 5).map((product) =>
                    <div
                      key={product.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                      onClick={() => void handleAddProductToBatch(product)}>

                            <Plus className="w-4 h-4 text-primary" />
                            <span className="text-sm truncate">{product.productName}</span>
                            <Badge variant="outline" className="text-xs ml-auto">
                              {(product.carbonResults?.perProduct.total ?? 0).toFixed(2)} kg
                            </Badge>
                          </div>
                    )}
                      </div>
                    </div>
                }
                </div>

                {selectedBatch.status === "draft" && selectedBatchHasValidId &&
              <div className="pt-4 border-t">
                    <Button
                  onClick={() => void handlePublishBatch()}
                  className="w-full"
                  disabled={
                    isPublishing ||
                    resolvedItemCount === 0 ||
                    selectedBatchHasNonDomesticProduct
                  }>

                      {isPublishing ?
                  <>{t("detail.publishInProgress")}</> :

                  <>
                          <Send className="w-4 h-4 mr-2" />
                          {t("detail.publishButton")}
                        </>
                  }
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      {t("detail.publishHint")}
                    </p>
                  </div>
              }

                {selectedBatch.status === "published" && selectedBatch.shipmentId &&
              <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-700">{t("detail.published")}</p>
                        <p className="text-xs text-green-600">{t("detail.shipment", { shipmentId: selectedBatch.shipmentId })}</p>
                      </div>
                    </div>
                  </div>
              }
              </>
            }
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>);

};

export default BatchManagementModal;
