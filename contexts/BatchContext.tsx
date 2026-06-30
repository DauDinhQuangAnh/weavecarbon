"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode } from
"react";
import { AddressInput } from "@/components/dashboard/assessment/types";
import { useAuth } from "@/contexts/AuthContext";
import { listProductBatches, type ProductBatchSummary } from "@/lib/productsApi";

export type BatchStatus = "draft" | "published";

export interface BatchProduct {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  co2PerUnit: number;
  weight: number;
}

export interface Batch {
  id: string;
  name: string;
  description?: string;
  status: BatchStatus;
  products: BatchProduct[];


  totalProducts: number;
  totalQuantity: number;
  totalCO2: number;
  totalWeight: number;


  originAddress?: AddressInput;
  destinationAddress?: AddressInput;
  destinationMarket?: string;
  transportModes?: string[];


  createdAt: string;
  updatedAt: string;
  publishedAt?: string;


  shipmentId?: string;
}

interface BatchContextType {
  batches: Batch[];
  status: "idle" | "hydrating" | "ready" | "error";
  lastHydratedAt: string | null;
  refresh: () => Promise<void>;


  updateBatch: (id: string, updates: Partial<Batch>) => void;
  deleteBatch: (id: string) => void;


  addProductToBatch: (batchId: string, product: BatchProduct) => void;
  removeProductFromBatch: (batchId: string, productId: string) => void;


  publishBatch: (id: string) => Batch;


  getBatch: (id: string) => Batch | undefined;
  getBatchesByStatus: (status: BatchStatus | "all") => Batch[];
  getBatchByProduct: (productId: string) => Batch | undefined;
}

const BatchContext = createContext<BatchContextType | undefined>(undefined);
const BATCH_SNAPSHOT_KEY_PREFIX = "weavecarbon_batches_snapshot_v1";

const buildSnapshotKey = (userId?: string | null, companyId?: string | null) =>
  `${BATCH_SNAPSHOT_KEY_PREFIX}:${userId || "anonymous"}:${companyId || "no-company"}`;

const mapBatchSummary = (batch: ProductBatchSummary): Batch => ({
  id: batch.id,
  name: batch.name,
  description: batch.description,
  status: batch.status === "published" ? "published" : "draft",
  products: [],
  totalProducts: batch.totalProducts,
  totalQuantity: batch.totalQuantity,
  totalCO2: batch.totalCO2,
  totalWeight: batch.totalWeight,
  originAddress: batch.originAddress,
  destinationAddress: batch.destinationAddress,
  destinationMarket: batch.destinationMarket,
  transportModes: batch.transportModes,
  createdAt: batch.createdAt,
  updatedAt: batch.updatedAt,
  publishedAt: batch.publishedAt,
  shipmentId: batch.shipmentId || undefined
});

const readSnapshot = (key: string): Batch[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(key) || "null") as {
      batches?: Batch[];
    } | null;
    return Array.isArray(parsed?.batches) ? parsed.batches : [];
  } catch {
    return [];
  }
};

const writeSnapshot = (key: string, batches: Batch[]) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      key,
      JSON.stringify({
        batches,
        cachedAt: Date.now()
      })
    );
  } catch {

  }
};

export const BatchProvider: React.FC<{children: ReactNode;}> = ({
  children
}) => {
  const { authStatus, isDemoSession, user } = useAuth();
  const userId = user?.id || null;
  const companyId = user?.company_id || null;
  const [batches, setBatches] = useState<Batch[]>([]);
  const [status, setStatus] = useState<"idle" | "hydrating" | "ready" | "error">("idle");
  const [lastHydratedAt, setLastHydratedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId || (!companyId && !isDemoSession)) {
      setBatches([]);
      setStatus(authStatus === "authenticated" ? "ready" : "idle");
      return;
    }

    const snapshotKey = buildSnapshotKey(userId, companyId);
    const staleBatches = readSnapshot(snapshotKey);
    if (staleBatches.length > 0) {
      setBatches(staleBatches);
    }

    setStatus("hydrating");
    try {
      const result = await listProductBatches();
      const nextBatches = result.items.map(mapBatchSummary);
      setBatches(nextBatches);
      writeSnapshot(snapshotKey, nextBatches);
      setLastHydratedAt(new Date().toISOString());
      setStatus("ready");
    } catch {
      setStatus(staleBatches.length > 0 ? "ready" : "error");
    }
  }, [authStatus, companyId, isDemoSession, userId]);

  useEffect(() => {
    if (authStatus === "checking" || authStatus === "recovering") {
      setStatus("hydrating");
      return;
    }

    if (authStatus !== "authenticated") {
      setBatches([]);
      setStatus("idle");
      return;
    }

    void refresh();
  }, [authStatus, refresh]);

  const updateBatch = useCallback((id: string, updates: Partial<Batch>) => {
    setBatches((prev) =>
    prev.map((b) =>
    b.id === id ?
    { ...b, ...updates, updatedAt: new Date().toISOString() } :
    b
    )
    );
  }, []);

  const deleteBatch = useCallback((id: string) => {
    setBatches((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const recalculateTotals = (products: BatchProduct[]) => ({
    totalProducts: products.length,
    totalQuantity: products.reduce((sum, p) => sum + p.quantity, 0),
    totalCO2: products.reduce((sum, p) => sum + p.quantity * p.co2PerUnit, 0),
    totalWeight: products.reduce((sum, p) => sum + p.quantity * p.weight, 0)
  });

  const addProductToBatch = useCallback(
    (batchId: string, product: BatchProduct) => {
      setBatches((prev) =>
      prev.map((b) => {
        if (b.id !== batchId) return b;


        if (b.products.some((p) => p.productId === product.productId)) {
          return b;
        }

        const newProducts = [...b.products, product];
        const totals = recalculateTotals(newProducts);

        return {
          ...b,
          products: newProducts,
          ...totals,
          updatedAt: new Date().toISOString()
        };
      })
      );
    },
    []
  );

  const removeProductFromBatch = useCallback(
    (batchId: string, productId: string) => {
      setBatches((prev) =>
      prev.map((b) => {
        if (b.id !== batchId) return b;

        const newProducts = b.products.filter(
          (p) => p.productId !== productId
        );
        const totals = recalculateTotals(newProducts);

        return {
          ...b,
          products: newProducts,
          ...totals,
          updatedAt: new Date().toISOString()
        };
      })
      );
    },
    []
  );

  const publishBatch = useCallback(
    (id: string): Batch => {
      let publishedBatch: Batch | null = null;

      setBatches((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;

        publishedBatch = {
          ...b,
          status: "published",
          publishedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        return publishedBatch;
      })
      );

      return publishedBatch || batches.find((b) => b.id === id)!;
    },
    [batches]
  );

  const getBatch = useCallback(
    (id: string) => {
      return batches.find((b) => b.id === id);
    },
    [batches]
  );

  const getBatchesByStatus = useCallback(
    (status: BatchStatus | "all") => {
      if (status === "all") return batches;
      return batches.filter((b) => b.status === status);
    },
    [batches]
  );

  const getBatchByProduct = useCallback(
    (productId: string) => {
      return batches.find((b) =>
      b.products.some((p) => p.productId === productId)
      );
    },
    [batches]
  );

  const contextValue = useMemo(() => ({
    batches,
    status,
    lastHydratedAt,
    refresh,
    updateBatch,
    deleteBatch,
    addProductToBatch,
    removeProductFromBatch,
    publishBatch,
    getBatch,
    getBatchesByStatus,
    getBatchByProduct
  }), [
    batches,
    status,
    lastHydratedAt,
    refresh,
    updateBatch,
    deleteBatch,
    addProductToBatch,
    removeProductFromBatch,
    publishBatch,
    getBatch,
    getBatchesByStatus,
    getBatchByProduct
  ]);

  return (
    <BatchContext.Provider value={contextValue}>
      {children}
    </BatchContext.Provider>);

};

export const useBatches = () => {
  const context = useContext(BatchContext);
  if (!context) {
    throw new Error("useBatches must be used within a BatchProvider");
  }
  return context;
};
