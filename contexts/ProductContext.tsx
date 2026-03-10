"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode } from
"react";

import type { ProductStatus } from "@/types/product";

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
  addProduct: (
  product: Omit<DashboardProduct, "id" | "createdAt">)
  => DashboardProduct;
  updateProduct: (id: string, updates: Partial<DashboardProduct>) => void;
  getProduct: (id: string) => DashboardProduct | undefined;
  getProductsByStatus: (status: ProductStatus | "all") => DashboardProduct[];
  getProductsByCategory: (category: string | "all") => DashboardProduct[];
  lastCreatedProduct: DashboardProduct | null;
  setLastCreatedProduct: (product: DashboardProduct | null) => void;
  pendingProductData: PendingProductData | null;
  setPendingProductData: (data: PendingProductData | null) => void;
  clearPendingProduct: () => void;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export const ProductProvider: React.FC<{children: ReactNode;}> = ({
  children
}) => {
  const [products, setProducts] = useState<DashboardProduct[]>([]);
  const [lastCreatedProduct, setLastCreatedProduct] =
  useState<DashboardProduct | null>(null);
  const [pendingProductData, setPendingProductData] =
  useState<PendingProductData | null>(null);

  const clearPendingProduct = useCallback(() => {
    setPendingProductData(null);
  }, []);

  const addProduct = useCallback(
    (
    productData: Omit<DashboardProduct, "id" | "createdAt">)
    : DashboardProduct => {
      const newProduct: DashboardProduct = {
        ...productData,
        id: `product-${Date.now()}`,
        createdAt: new Date().toISOString()
      };

      setProducts((prev) => [newProduct, ...prev]);
      setLastCreatedProduct(newProduct);

      return newProduct;
    },
    []
  );

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

  return (
    <ProductContext.Provider
      value={{
        products,
        addProduct,
        updateProduct,
        getProduct,
        getProductsByStatus,
        getProductsByCategory,
        lastCreatedProduct,
        setLastCreatedProduct,
        pendingProductData,
        setPendingProductData,
        clearPendingProduct
      }}>
      
      {children}
    </ProductContext.Provider>);

};

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error("useProducts must be used within a ProductProvider");
  }
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