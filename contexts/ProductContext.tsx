"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  ReactNode } from
"react";

import { useAuth } from "@/contexts/AuthContext";
import { fetchAllProducts, type ProductRecord } from "@/lib/productsApi";
import type { ProductStatus } from "@/types/product";
import {
  CLIENT_CACHE_POLICIES,
  buildClientCacheKey,
  readSessionCache,
  writeSessionCache
} from "@/lib/clientCache";

export interface DashboardProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  co2: number;
  status: ProductStatus;
  materials: string[];
  weight: number;
  unit: string;
  createdAt: string;
  scope: "scope1" | "scope1_2" | "scope1_2_3";
  confidenceScore: number;
  breakdown: {
    materials: number;
    production: number;
    transport: number;
    packaging: number;
  };
}

interface CarbonBreakdown {
  materials: number;
  manufacturing: number;
  transport: number;
  packaging: number;
  total: number;
}

export interface PendingProductData {
  productName: string;
  productCode: string;
  category: string;
  description: string;
  weight: string;
  unit: string;
  primaryMaterial: string;
  materialPercentage: string;
  secondaryMaterial: string;
  secondaryPercentage: string;
  recycledContent: string;
  certifications: string[];
  manufacturingLocation: string;
  energySource: string;
  processType: string;
  wasteRecovery: string;
  originCountry: string;
  destinationMarket: string;
  transportMode: string;
  packagingType: string;
  packagingWeight: string;
}

interface ProductContextType {
  products: DashboardProduct[];
  status: "idle" | "hydrating" | "ready" | "error";
  lastHydratedAt: string | null;
  refresh: () => Promise<void>;
  updateProduct: (id: string, updates: Partial<DashboardProduct>) => void;
  getProduct: (id: string) => DashboardProduct | undefined;
  getProductsByStatus: (status: ProductStatus | "all") => DashboardProduct[];
  getProductsByCategory: (category: string | "all") => DashboardProduct[];
  lastCreatedProduct: DashboardProduct | null;
  setLastCreatedProduct: (product: DashboardProduct | null) => void;
  pendingProductData: PendingProductData | null;
  setPendingProductData: (data: PendingProductData | null) => void;
  clearPendingProduct: () => void;
  registerConsumer: () => () => void;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

const mapProductRecordToDashboardProduct = (product: ProductRecord): DashboardProduct => ({
  id: product.id,
  name: product.productName || product.productCode || "Untitled product",
  sku: product.productCode || product.id,
  category: product.productType || "other",
  co2: product.carbonResults?.perProduct?.total || product.carbonResults?.totalBatch?.total || 0,
  status: product.status as ProductStatus,
  materials: (product.materials || []).map((material) => material.materialType).filter(Boolean),
  weight: product.weightPerUnit || 0,
  unit: "g",
  createdAt: product.createdAt,
  scope: "scope1_2_3",
  confidenceScore: product.carbonResults?.confidenceScore || 0,
  breakdown: {
    materials: product.carbonResults?.perProduct?.materials || 0,
    production: product.carbonResults?.perProduct?.production || 0,
    transport: product.carbonResults?.perProduct?.transport || 0,
    packaging: product.carbonResults?.perProduct?.packaging || 0,
  },
});

export const ProductProvider: React.FC<{children: ReactNode;}> = ({
  children
}) => {
  const { authStatus, isDemoSession, user } = useAuth();
  const userId = user?.id || null;
  const companyId = user?.company_id || null;
  const [products, setProducts] = useState<DashboardProduct[]>([]);
  const [status, setStatus] = useState<"idle" | "hydrating" | "ready" | "error">("idle");
  const [lastHydratedAt, setLastHydratedAt] = useState<string | null>(null);
  const [lastCreatedProduct, setLastCreatedProduct] =
  useState<DashboardProduct | null>(null);
  const [pendingProductData, setPendingProductData] =
  useState<PendingProductData | null>(null);

  const clearPendingProduct = useCallback(() => {
    setPendingProductData(null);
  }, []);

  // Lazy hydration: only fetch the full product catalog once a component actually
  // consumes it via useProducts(). Pages that never read products (Products list —
  // which fetches its own filtered/paginated data — plus settings, billing,
  // logistics, etc.) no longer trigger a redundant catalog-wide fetch.
  const consumerCountRef = useRef(0);
  const [hasConsumers, setHasConsumers] = useState(false);

  const registerConsumer = useCallback(() => {
    consumerCountRef.current += 1;
    if (consumerCountRef.current === 1) {
      setHasConsumers(true);
    }
    return () => {
      consumerCountRef.current -= 1;
      if (consumerCountRef.current === 0) {
        setHasConsumers(false);
      }
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!userId || (!companyId && !isDemoSession)) {
      setProducts([]);
      setStatus(authStatus === "authenticated" ? "ready" : "idle");
      return;
    }

    const cachePolicy = CLIENT_CACHE_POLICIES.productCatalog;
    const snapshotKey = buildClientCacheKey(cachePolicy, { userId, companyId });
    const staleProducts = readSessionCache<DashboardProduct[]>(snapshotKey, cachePolicy) || [];
    if (staleProducts.length > 0) {
      setProducts(staleProducts);
    }

    setStatus("hydrating");
    try {
      const records = await fetchAllProducts({
        sort_by: "updated_at",
        sort_order: "desc",
        // ProductContext only reads core catalog + carbon totals, so request the
        // lighter summary payload (no per-product logistics / latest-shipment join).
        view: "summary"
      });
      const nextProducts = records.map(mapProductRecordToDashboardProduct);
      setProducts(nextProducts);
      writeSessionCache(snapshotKey, cachePolicy, nextProducts);
      setLastHydratedAt(new Date().toISOString());
      setStatus("ready");
    } catch {
      setStatus(staleProducts.length > 0 ? "ready" : "error");
    }
  }, [authStatus, companyId, isDemoSession, userId]);

  useEffect(() => {
    if (!hasConsumers) {
      return;
    }

    if (authStatus === "checking" || authStatus === "recovering") {
      setStatus("hydrating");
      return;
    }

    if (authStatus !== "authenticated") {
      setProducts([]);
      setStatus("idle");
      return;
    }

    void refresh();
  }, [authStatus, refresh, hasConsumers]);

  const updateProduct = useCallback(
    (id: string, updates: Partial<DashboardProduct>) => {
      setProducts((prev) =>
      prev.map((p) => p.id === id ? { ...p, ...updates } : p)
      );
    },
    []
  );

  const getProduct = useCallback(
    (id: string) => {
      return products.find((p) => p.id === id);
    },
    [products]
  );

  const getProductsByStatus = useCallback(
    (status: ProductStatus | "all") => {
      if (status === "all") return products;
      return products.filter((p) => p.status === status);
    },
    [products]
  );

  const getProductsByCategory = useCallback(
    (category: string | "all") => {
      if (category === "all") return products;
      return products.filter((p) => p.category === category);
    },
    [products]
  );

  const contextValue = useMemo(() => ({
    products,
    status,
    lastHydratedAt,
    refresh,
    updateProduct,
    getProduct,
    getProductsByStatus,
    getProductsByCategory,
    lastCreatedProduct,
    setLastCreatedProduct,
    pendingProductData,
    setPendingProductData,
    clearPendingProduct,
    registerConsumer
  }), [
    products,
    status,
    lastHydratedAt,
    refresh,
    updateProduct,
    getProduct,
    getProductsByStatus,
    getProductsByCategory,
    lastCreatedProduct,
    setLastCreatedProduct,
    pendingProductData,
    setPendingProductData,
    clearPendingProduct,
    registerConsumer
  ]);

  return (
    <ProductContext.Provider value={contextValue}>
      {children}
    </ProductContext.Provider>);

};

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error("useProducts must be used within a ProductProvider");
  }
  // Registering here is what triggers the provider's lazy hydration, so the
  // catalog is only fetched on pages that actually read it.
  const { registerConsumer } = context;
  useEffect(() => registerConsumer(), [registerConsumer]);
  return context;
};


export const calculateCarbonFromProduct = (data: {
  weight: number;
  primaryMaterial: string;
  energySource?: string;
  transportMode?: string;
  destinationMarket?: string;
  packagingWeight?: number;
  packagingType?: string;
  recycledContent?: number;
}): CarbonBreakdown => {
  const MATERIAL_FACTORS: Record<string, number> = {
    cotton: 8.0,
    polyester: 5.5,
    wool: 10.1,
    silk: 7.5,
    linen: 5.2,
    nylon: 6.8,
    recycled_polyester: 2.5,
    organic_cotton: 4.5,
    bamboo: 3.8,
    hemp: 2.9
  };

  const ENERGY_FACTORS: Record<string, number> = {
    grid: 1.0,
    solar: 0.4,
    wind: 0.35,
    mixed: 0.7,
    coal: 1.5
  };

  const TRANSPORT_FACTORS: Record<string, number> = {
    sea: 0.016,
    air: 0.602,
    road: 0.089,
    rail: 0.028,
    multimodal: 0.05
  };

  const MARKET_DISTANCES: Record<string, number> = {
    eu: 10000,
    us: 14000,
    jp: 3500,
    kr: 3200,
    domestic: 500
  };

  const PACKAGING_FACTORS: Record<string, number> = {
    plastic: 3.0,
    paper: 1.5,
    biodegradable: 0.8,
    recycled: 0.5,
    minimal: 0.3
  };

  const weightKg = data.weight;
  const recycledDiscount = (data.recycledContent || 0) / 100 * 0.5;

  const materialFactor = MATERIAL_FACTORS[data.primaryMaterial] || 5.0;
  const materialsCO2 = weightKg * materialFactor * (1 - recycledDiscount);

  const energyFactor = ENERGY_FACTORS[data.energySource || "grid"] || 1.0;
  const manufacturingCO2 = weightKg * 2.5 * energyFactor;

  const distance =
  MARKET_DISTANCES[data.destinationMarket || "domestic"] || 5000;
  const transportFactor =
  TRANSPORT_FACTORS[data.transportMode || "sea"] || 0.05;
  const transportCO2 = weightKg * (distance / 1000) * transportFactor;

  const packagingFactor =
  PACKAGING_FACTORS[data.packagingType || "paper"] || 1.5;
  const packagingCO2 = (data.packagingWeight || 0) * packagingFactor;

  const total = materialsCO2 + manufacturingCO2 + transportCO2 + packagingCO2;

  return {
    materials: Math.round(materialsCO2 * 100) / 100,
    manufacturing: Math.round(manufacturingCO2 * 100) / 100,
    transport: Math.round(transportCO2 * 100) / 100,
    packaging: Math.round(packagingCO2 * 100) / 100,
    total: Math.round(total * 100) / 100
  };
};
