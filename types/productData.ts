import type { ProductStatus } from "@/types/product";
import type { TransportLeg } from "@/types/transport";

export interface ProductData {
  id: string;
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
  sourceType: "documented" | "proxy";
  confidenceLevel: number;
  createdAt: string;
  createdBy: string;
  status: ProductStatus;
  updatedAt: string;
}

export interface TransportData {
  id: string;
  productId: string;
  legs: TransportLeg[];
  totalDistanceKm: number;
  totalCO2Kg: number;
  confidenceLevel: number;
  createdAt: string;
  createdBy: string;
}

export interface CalculationHistory {
  id: string;
  productId: string;
  productName: string;
  transportId: string;
  materialsCO2: number;
  manufacturingCO2: number;
  transportCO2: number;
  packagingCO2: number;
  totalCO2: number;
  carbonVersion: string;
  createdAt: string;
  createdBy: string;
}