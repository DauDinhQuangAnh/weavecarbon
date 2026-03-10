"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode } from
"react";
import { AddressInput } from "@/components/dashboard/assessment/types";

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


  createBatch: (name: string, description?: string) => Batch;
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

export const BatchProvider: React.FC<{children: ReactNode;}> = ({
  children
}) => {
  const [batches, setBatches] = useState<Batch[]>([]);

  const createBatch = useCallback(
    (name: string, description?: string): Batch => {
      const newBatch: Batch = {
        id: `batch-${Date.now()}`,
        name,
        description,
        status: "draft",
        products: [],
        totalProducts: 0,
        totalQuantity: 0,
        totalCO2: 0,
        totalWeight: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setBatches((prev) => [newBatch, ...prev]);
      return newBatch;
    },
    []
  );

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

  return (
    <BatchContext.Provider
      value={{
        batches,
        createBatch,
        updateBatch,
        deleteBatch,
        addProductToBatch,
        removeProductFromBatch,
        publishBatch,
        getBatch,
        getBatchesByStatus,
        getBatchByProduct
      }}>
      
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