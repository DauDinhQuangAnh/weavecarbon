"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Package,
  Leaf,
  Scale,
  MapPin,
  Truck,
  Recycle,
  TrendingDown,
  CheckCircle2
} from "lucide-react";
import { useProducts, DashboardProduct } from "@/contexts/ProductContext";
import { useAppRoutes } from "@/lib/demo/routes";

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

const REGION_FACTORS: Record<string, number> = {
  Vietnam: 1.0,
  China: 1.2,
  India: 1.1,
  Bangladesh: 1.05,
  EU: 0.75,
  US: 0.85
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

const PACKAGING_FACTORS: Record<string, number> = {
  plastic: 3.0,
  paper: 1.5,
  biodegradable: 0.8,
  recycled: 0.5,
  minimal: 0.3
};

interface ProductData {
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

interface CarbonBreakdown {
  materials: number;
  manufacturing: number;
  transport: number;
  packaging: number;
  total: number;
}

interface ProductOverviewModalProps {
  open: boolean;
  onClose: () => void;
  productData: ProductData;
}

const MATERIAL_LABELS: Record<string, string> = {
  cotton: "Cotton",
  polyester: "Polyester",
  wool: "Wool",
  silk: "Silk",
  linen: "Linen",
  nylon: "Nylon",
  recycled_polyester: "Recycled Polyester",
  organic_cotton: "Organic Cotton",
  bamboo: "Bamboo",
  hemp: "Hemp"
};

const MARKET_DISTANCES: Record<string, number> = {
  eu: 10000,
  us: 14000,
  jp: 3500,
  kr: 3200,
  domestic: 500
};

const calculateCarbonFootprint = (data: ProductData): CarbonBreakdown => {
  let weightKg = parseFloat(data.weight) || 0;
  if (data.unit === "g") weightKg /= 1000;
  if (data.unit === "lb") weightKg *= 0.453592;

  const packagingWeightKg = parseFloat(data.packagingWeight) || 0;
  const primaryPercentage = (parseFloat(data.materialPercentage) || 100) / 100;
  const secondaryPercentage = (parseFloat(data.secondaryPercentage) || 0) / 100;
  const recycledPercentage = (parseFloat(data.recycledContent) || 0) / 100;

  const primaryFactor = MATERIAL_FACTORS[data.primaryMaterial] || 5.0;
  const secondaryFactor = MATERIAL_FACTORS[data.secondaryMaterial] || 0;
  const recycledDiscount = recycledPercentage * 0.5;

  const materialsCO2 =
    weightKg * (primaryFactor * primaryPercentage + secondaryFactor * secondaryPercentage) *
    (1 - recycledDiscount);

  const energyFactor = ENERGY_FACTORS[data.energySource] || 1.0;
  const regionFactor = REGION_FACTORS[data.originCountry] || REGION_FACTORS.Vietnam;
  const baseManufacturing = 2.5;
  const manufacturingCO2 = weightKg * baseManufacturing * energyFactor * regionFactor;

  const distance = MARKET_DISTANCES[data.destinationMarket] || 5000;
  const transportFactor = TRANSPORT_FACTORS[data.transportMode] || 0.05;
  const transportCO2 = weightKg * (distance / 1000) * transportFactor;

  const packagingFactor = PACKAGING_FACTORS[data.packagingType] || 1.5;
  const packagingCO2 = packagingWeightKg * packagingFactor;

  const total = materialsCO2 + manufacturingCO2 + transportCO2 + packagingCO2;

  return {
    materials: Math.round(materialsCO2 * 100) / 100,
    manufacturing: Math.round(manufacturingCO2 * 100) / 100,
    transport: Math.round(transportCO2 * 100) / 100,
    packaging: Math.round(packagingCO2 * 100) / 100,
    total: Math.round(total * 100) / 100
  };
};

const ProductOverviewModal: React.FC<ProductOverviewModalProps> = ({
  open,
  onClose,
  productData
}) => {
  const t = useTranslations("assessment.productOverview");
  const router = useRouter();
  const appRoutes = useAppRoutes();
  const { addProduct } = useProducts();

  const carbonBreakdown = calculateCarbonFootprint(productData);
  const hasAddedOnOpenRef = useRef(false);

  const {
    productName,
    productCode,
    category,
    weight,
    unit,
    primaryMaterial,
    materialPercentage,
    secondaryMaterial,
    secondaryPercentage
  } = productData;

  const getMaterialLabel = useCallback(
    (value: string) =>
      t.has(`materials.${value}`) ? t(`materials.${value}`) : MATERIAL_LABELS[value] || value,
    [t]
  );
  const getMarketLabel = (value: string) =>
    t.has(`markets.${value}`) ? t(`markets.${value}`) : value;
  const getTransportLabel = (value: string) =>
    t.has(`transportModes.${value}`) ? t(`transportModes.${value}`) : value;
  const getCategoryLabel = (value: string) =>
    t.has(`categories.${value}`) ? t(`categories.${value}`) : value;

  useEffect(() => {
    if (!open) {
      hasAddedOnOpenRef.current = false;
      return;
    }

    if (!productName || hasAddedOnOpenRef.current) return;

    let weightKg = parseFloat(weight) || 0;
    if (unit === "g") weightKg /= 1000;
    if (unit === "lb") weightKg *= 0.453592;

    const newProduct: Omit<DashboardProduct, "id" | "createdAt"> = {
      name: productName,
      sku: productCode || `SKU-${Date.now().toString().slice(-6)}`,
      category,
      co2: carbonBreakdown.total,
      status: "draft",
      materials: [
        `${getMaterialLabel(primaryMaterial)} ${materialPercentage}%`,
        ...(secondaryMaterial
          ? [`${getMaterialLabel(secondaryMaterial)} ${secondaryPercentage}%`]
          : [])
      ],
      weight: weightKg,
      unit: "kg",
      scope: "scope1",
      confidenceScore: 45
    };

    addProduct(newProduct);
    hasAddedOnOpenRef.current = true;
  }, [
    addProduct,
    carbonBreakdown.total,
    category,
    materialPercentage,
    open,
    primaryMaterial,
    productCode,
    productName,
    secondaryMaterial,
    secondaryPercentage,
    unit,
    weight,
    getMaterialLabel
  ]);

  const getPercentage = (value: number) => {
    if (carbonBreakdown.total === 0) return 0;
    return Math.round((value / carbonBreakdown.total) * 100);
  };

  const handleGoToDashboard = () => {
    onClose();
    router.push(appRoutes.toAppPath("/products"));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">{t("successTitle")}</DialogTitle>
              <DialogDescription>{t("successDescription")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-semibold">{productData.productName || t("newProduct")}</h3>
                  {productData.productCode ? (
                    <p className="text-sm text-muted-foreground">{t("skuLabel")}: {productData.productCode}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-gray-100 text-gray-700">
                  {t("draftBadge")}
                </Badge>
                <Badge variant="secondary">{getCategoryLabel(productData.category)}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-muted-foreground" />
                <span>
                  {t("weight", { value: productData.weight, unit: productData.unit })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Leaf className="w-4 h-4 text-muted-foreground" />
                <span>
                  {getMaterialLabel(productData.primaryMaterial)} ({productData.materialPercentage}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>{productData.manufacturingLocation || productData.originCountry}</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <span>
                  {getTransportLabel(productData.transportMode)} → {getMarketLabel(productData.destinationMarket)}
                </span>
              </div>
            </div>

            {productData.certifications.length > 0 ? (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <Recycle className="w-4 h-4 text-green-600" />
                <div className="flex gap-1">
                  {productData.certifications.map((cert) => (
                    <Badge
                      key={cert}
                      variant="outline"
                      className="text-xs bg-green-50 text-green-700 border-green-200"
                    >
                      {cert.toUpperCase()}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-primary" />
                {t("carbonEstimateTitle")}
              </h4>
              <Badge
                variant="outline"
                className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200"
              >
                {t("preliminary")}
              </Badge>
            </div>

            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 mb-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{carbonBreakdown.total}</p>
                <p className="text-sm text-muted-foreground">{t("co2PerUnit")}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span>{t("breakdown.materials")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {carbonBreakdown.materials} {t("unitKg")}
                  </span>
                  <span className="text-muted-foreground">({getPercentage(carbonBreakdown.materials)}%)</span>
                </div>
              </div>
              <Progress value={getPercentage(carbonBreakdown.materials)} className="h-2" />

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>{t("breakdown.manufacturing")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {carbonBreakdown.manufacturing} {t("unitKg")}
                  </span>
                  <span className="text-muted-foreground">({getPercentage(carbonBreakdown.manufacturing)}%)</span>
                </div>
              </div>
              <Progress value={getPercentage(carbonBreakdown.manufacturing)} className="h-2" />

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span>{t("breakdown.transport")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {carbonBreakdown.transport} {t("unitKg")}
                  </span>
                  <span className="text-muted-foreground">({getPercentage(carbonBreakdown.transport)}%)</span>
                </div>
              </div>
              <Progress value={getPercentage(carbonBreakdown.transport)} className="h-2" />

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span>{t("breakdown.packaging")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {carbonBreakdown.packaging} {t("unitKg")}
                  </span>
                  <span className="text-muted-foreground">({getPercentage(carbonBreakdown.packaging)}%)</span>
                </div>
              </div>
              <Progress value={getPercentage(carbonBreakdown.packaging)} className="h-2" />
            </div>

            <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <p className="font-medium mb-1">{t("formula.title")}</p>
              <p>{t("formula.equation")}</p>
              <p className="mt-2 text-yellow-600">{t("formula.note")}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleGoToDashboard}>
            {t("buttons.viewProducts")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProductOverviewModal;
