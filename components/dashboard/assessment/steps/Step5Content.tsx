import React, { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Leaf,
  Factory,
  Zap,
  Truck,
  Package,
  AlertCircle,
  CheckCircle2,
  Info,
  TrendingDown,
  Sparkles
} from "lucide-react";
import {
  ProductAssessmentData,
  CarbonAssessmentResult,
  PRODUCTION_PROCESSES,
  ENERGY_SOURCES,
  TRANSPORT_MODES
} from "./types";
import { getMaterialById, MATERIAL_CATALOG } from "../materialCatalog";

interface Step5CarbonResultProps {
  data: ProductAssessmentData;
  companyDomesticMarket?: string | null;
  onChange: (updates: Partial<ProductAssessmentData>) => void;
}

interface ExtendedMaterialInput {
  id: string;
  materialType: string;
  percentage: number;
  source: "domestic" | "imported" | "unknown";
  certifications: string[];
  catalogMaterialId?: string;
  customName?: string;
  userSource?: "selected_catalog" | "ai_suggested" | "user_other";
  confidenceScore?: number;
}

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

const normalizeMarketToken = (value: string | null | undefined) =>
  (value || "").
    toLowerCase().
    normalize("NFD").
    replace(/[\u0300-\u036f]/g, "").
    replace(/[^a-z0-9]+/g, "");

const calculateCarbonAssessment = (
  data: ProductAssessmentData,
  t: TranslateFn,
  locale: string,
  companyDomesticMarket?: string | null
): CarbonAssessmentResult => {
  const proxyNotes: string[] = [];
  let confidenceScore = 100;
  const applyPenalty = (amount: number) => {
    confidenceScore = Math.max(5, confidenceScore - amount);
  };

  const weightKg = (data.weightPerUnit || 0) / 1000;
  const quantity = data.quantity || 1;

  let materialsCO2 = 0;
  data.materials.forEach((material) => {
    const extMaterial = material as ExtendedMaterialInput;

    let co2Factor = 6.0;
    const catalogMaterial = extMaterial.catalogMaterialId
      ? getMaterialById(extMaterial.catalogMaterialId)
      : MATERIAL_CATALOG.find((item) => item.id === material.materialType);

    if (catalogMaterial) {
      co2Factor = catalogMaterial.co2Factor;
      const materialDisplayName =
        locale === "vi" ? catalogMaterial.displayNameVi : catalogMaterial.displayNameEn;

      if (catalogMaterial.dataQualityDefault === "proxy") {
        proxyNotes.push(
          t("proxy.materialUsesProxy", {
            material: materialDisplayName
          })
        );
        applyPenalty(8);
      }
    } else {
      proxyNotes.push(
        t("proxy.materialNotFound", {
          material: extMaterial.customName || material.materialType
        })
      );
      applyPenalty(12);
    }

    if (extMaterial.userSource === "user_other") {
      proxyNotes.push(
        t("proxy.customMaterialLowConfidence", {
          material: extMaterial.customName || t("common.other")
        })
      );
      applyPenalty(25);
    } else if (extMaterial.userSource === "ai_suggested") {
      applyPenalty(8);
    }

    const contribution = weightKg * (material.percentage / 100) * co2Factor;
    materialsCO2 += contribution;

    if (material.source === "unknown") {
      proxyNotes.push(t("proxy.unknownOrigin"));
      applyPenalty(8);
    }
  });

  let productionCO2 = 0;
  if (data.productionProcesses && data.productionProcesses.length > 0) {
    data.productionProcesses.forEach((process) => {
      const processInfo = PRODUCTION_PROCESSES.find((item) => item.value === process);
      if (processInfo) {
        productionCO2 += weightKg * processInfo.co2Factor;
      }
    });
  } else {
    productionCO2 = weightKg * 1.5;
    proxyNotes.push(t("proxy.noProcessInfo"));
    applyPenalty(20);
  }

  let energyCO2 = 0;
  if (data.energySources && data.energySources.length > 0) {
    data.energySources.forEach((energy) => {
      const energyInfo = ENERGY_SOURCES.find((item) => item.value === energy.source);
      if (energyInfo) {
        const kwhPerUnit = weightKg * 2;
        energyCO2 += kwhPerUnit * energyInfo.co2Factor * (energy.percentage / 100);
      }
    });
  } else {
    energyCO2 = weightKg * 2;
    proxyNotes.push(t("proxy.noEnergyInfo"));
    applyPenalty(15);
  }

  let transportCO2 = 0;
  let transportBatchCO2 = 0;
  if (data.transportLegs && data.transportLegs.length > 0) {
    data.transportLegs.forEach((leg) => {
      const modeInfo = TRANSPORT_MODES.find((item) => item.value === leg.mode);
      if (modeInfo && leg.estimatedDistance) {
        transportBatchCO2 += leg.estimatedDistance * modeInfo.co2Factor;
      }
    });
  } else if (data.estimatedTotalDistance) {
    const destinationMarketToken = normalizeMarketToken(data.destinationMarket);
    const configuredDomesticMarketToken = normalizeMarketToken(companyDomesticMarket);
    const isDomesticRoute =
      destinationMarketToken === "vietnam" ||
      destinationMarketToken === "domestic" ||
      destinationMarketToken === "vn" ||
      (Boolean(configuredDomesticMarketToken) &&
        destinationMarketToken === configuredDomesticMarketToken);
    const fallbackTransportFactor = isDomesticRoute ? 0.105 : 0.016;
    transportBatchCO2 = data.estimatedTotalDistance * fallbackTransportFactor;
    applyPenalty(isDomesticRoute ? 4 : 6);
    if (!isDomesticRoute) {
      proxyNotes.push(t("proxy.transportEstimatedBySea"));
    }
  } else {
    applyPenalty(10);
  }
  transportCO2 = quantity > 0 ? transportBatchCO2 / quantity : transportBatchCO2;

  const totalPerProduct = materialsCO2 + productionCO2 + energyCO2 + transportCO2;

  const scope1 = productionCO2 * 0.3;
  const scope2 = energyCO2;
  const scope3 = materialsCO2 + transportCO2 + productionCO2 * 0.7;

  const materials = Array.isArray(data.materials) ? data.materials : [];
  const energySources = Array.isArray(data.energySources) ? data.energySources : [];

  const materialPercentageTotal = materials.reduce(
    (sum, material) => sum + Math.max(0, material.percentage || 0),
    0
  );
  if (materialPercentageTotal < 95 || materialPercentageTotal > 105) {
    applyPenalty(8);
  }

  const energyPercentageTotal = energySources.reduce(
    (sum, source) => sum + Math.max(0, source.percentage || 0),
    0
  );
  if (energySources.length > 0 && (energyPercentageTotal < 95 || energyPercentageTotal > 105)) {
    applyPenalty(6);
  }

  confidenceScore = Math.max(5, Math.min(100, Math.round(confidenceScore)));
  const confidenceLevel: "high" | "medium" | "low" =
    confidenceScore >= 85 ? "high" : confidenceScore >= 65 ? "medium" : "low";
  const uniqueProxyNotes = [...new Set(proxyNotes)];

  return {
    perProduct: {
      materials: Math.round(materialsCO2 * 1000) / 1000,
      production: Math.round(productionCO2 * 1000) / 1000,
      energy: Math.round(energyCO2 * 1000) / 1000,
      transport: Math.round(transportCO2 * 1000) / 1000,
      total: Math.round(totalPerProduct * 1000) / 1000
    },
    totalBatch: {
      materials: Math.round(materialsCO2 * quantity * 100) / 100,
      production: Math.round(productionCO2 * quantity * 100) / 100,
      energy: Math.round(energyCO2 * quantity * 100) / 100,
      transport: Math.round(transportBatchCO2 * 100) / 100,
      total: Math.round(totalPerProduct * quantity * 100) / 100
    },
    confidenceLevel,
    confidenceScore,
    proxyUsed: uniqueProxyNotes.length > 0,
    proxyNotes: uniqueProxyNotes,
    scope1: Math.round(scope1 * quantity * 100) / 100,
    scope2: Math.round(scope2 * quantity * 100) / 100,
    scope3: Math.round(scope3 * quantity * 100) / 100
  };
};

const Step5CarbonResult: React.FC<Step5CarbonResultProps> = ({
  data,
  companyDomesticMarket,
  onChange
}) => {
  const t = useTranslations("assessment.step5");
  const locale = useLocale();
  const displayLocale = locale === "vi" ? "vi-VN" : "en-US";
  const currentSerialized = useMemo(
    () => JSON.stringify(data.carbonResults ?? null),
    [data.carbonResults]
  );

  const result = useMemo(
    () =>
      calculateCarbonAssessment(
        data,
        (key, values) => t(key, values),
        locale,
        companyDomesticMarket
      ),
    [companyDomesticMarket, data, locale, t]
  );
  const resultSerialized = useMemo(() => JSON.stringify(result), [result]);

  React.useEffect(() => {
    if (currentSerialized === resultSerialized) {
      return;
    }

    onChange({ carbonResults: result });
  }, [currentSerialized, onChange, result, resultSerialized]);

  const breakdownItems = [
    {
      label: t("breakdown.materials"),
      icon: Leaf,
      value: result.perProduct.materials,
      total: result.totalBatch.materials,
      color: "bg-green-500",
      percentage:
        result.perProduct.total > 0
          ? (result.perProduct.materials / result.perProduct.total) * 100
          : 0
    },
    {
      label: t("breakdown.production"),
      icon: Factory,
      value: result.perProduct.production,
      total: result.totalBatch.production,
      color: "bg-blue-500",
      percentage:
        result.perProduct.total > 0
          ? (result.perProduct.production / result.perProduct.total) * 100
          : 0
    },
    {
      label: t("breakdown.energy"),
      icon: Zap,
      value: result.perProduct.energy,
      total: result.totalBatch.energy,
      color: "bg-yellow-500",
      percentage:
        result.perProduct.total > 0
          ? (result.perProduct.energy / result.perProduct.total) * 100
          : 0
    },
    {
      label: t("breakdown.transport"),
      icon: Truck,
      value: result.perProduct.transport,
      total: result.totalBatch.transport,
      color: "bg-purple-500",
      percentage:
        result.perProduct.total > 0
          ? (result.perProduct.transport / result.perProduct.total) * 100
          : 0
    }
  ];

  const confidenceBadgeStyle = {
    high: "bg-green-500/10 text-green-600 border-green-500/30",
    medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
    low: "bg-red-500/10 text-red-600 border-red-500/30"
  };

  const confidenceLabel = {
    high: t("confidence.high"),
    medium: t("confidence.medium"),
    low: t("confidence.low")
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">{t("cards.perProductTitle")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">
              {result.perProduct.total.toFixed(3)}
              <span className="text-lg font-normal text-muted-foreground ml-2">
                {t("units.kgCo2e")}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {t("cards.perProductSubtitle", { value: data.weightPerUnit || 0 })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-primary">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">{t("cards.totalBatchTitle")}</CardTitle>
              </div>
              <Badge variant="outline">
                {t("cards.totalBatchProducts", {
                  value: data.quantity?.toLocaleString(displayLocale) || "0"
                })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">
              {result.totalBatch.total.toFixed(2)}
              <span className="text-lg font-normal text-muted-foreground ml-2">
                {t("units.kgCo2e")}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {t("cards.totalBatchTon", {
                value: (result.totalBatch.total / 1000).toFixed(3)
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{t("detailedAnalysisTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {breakdownItems.map((item, index) => (
            <div key={`${item.label}-${index}`} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold">{item.value.toFixed(3)} {t("units.kg")}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
              <Progress value={item.percentage} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">
                {t("totalBatchLine", { value: item.total.toFixed(2) })}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Leaf className="w-5 h-5" />
            {t("materialDetailsTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.materials.map((material, index) => {
              const extMaterial = material as ExtendedMaterialInput;
              const catalogMaterial = extMaterial.catalogMaterialId
                ? getMaterialById(extMaterial.catalogMaterialId)
                : MATERIAL_CATALOG.find((item) => item.id === material.materialType);

              const materialName =
                extMaterial.customName ||
                (catalogMaterial ?
                  locale === "vi" ?
                  catalogMaterial.displayNameVi :
                  catalogMaterial.displayNameEn :
                  undefined) ||
                material.materialType ||
                t("common.material");
              const co2Factor = catalogMaterial?.co2Factor || 6.0;
              const weightKg = (data.weightPerUnit || 0) / 1000;
              const materialCO2 = weightKg * (material.percentage / 100) * co2Factor;

              return (
                <div
                  key={material.id || `mat-${index}`}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{materialName}</span>

                        {extMaterial.userSource === "selected_catalog" ? (
                          <Badge variant="outline" className="text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {t("source.fromCatalog")}
                          </Badge>
                        ) : null}

                        {extMaterial.userSource === "ai_suggested" ? (
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="w-3 h-3 mr-1" />
                            {t("source.aiSuggested")}
                          </Badge>
                        ) : null}

                        {extMaterial.userSource === "user_other" ? (
                          <Badge
                            variant="outline"
                            className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30"
                          >
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {t("source.proxy")}
                          </Badge>
                        ) : null}
                      </div>

                      <p className="text-xs text-muted-foreground mt-1">
                        {t("materialLine", {
                          percentage: material.percentage,
                          factor: co2Factor
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-semibold text-sm">{materialCO2.toFixed(4)}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      {t("units.kgCo2e")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {data.materials.some(
            (material) => (material as ExtendedMaterialInput).userSource === "user_other"
          ) ? (
            <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                <p className="text-xs text-yellow-700">{t("proxy.warning")}</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{t("scope.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 text-center">
              <p className="text-xs font-medium text-blue-600 mb-1">{t("scope.scope1")}</p>
              <p className="text-lg font-bold">{result.scope1.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{t("units.kgCo2e")}</p>
            </div>
            <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20 text-center">
              <p className="text-xs font-medium text-green-600 mb-1">{t("scope.scope2")}</p>
              <p className="text-lg font-bold">{result.scope2.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{t("units.kgCo2e")}</p>
            </div>
            <div className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/20 text-center">
              <p className="text-xs font-medium text-purple-600 mb-1">{t("scope.scope3")}</p>
              <p className="text-lg font-bold">{result.scope3.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{t("units.kgCo2e")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t("confidence.title")}</CardTitle>
            <Badge
              variant="outline"
              className={confidenceBadgeStyle[result.confidenceLevel]}
            >
              {result.confidenceLevel === "high" ? (
                <CheckCircle2 className="w-3 h-3 mr-1" />
              ) : null}
              {result.confidenceLevel === "medium" ? (
                <Info className="w-3 h-3 mr-1" />
              ) : null}
              {result.confidenceLevel === "low" ? (
                <AlertCircle className="w-3 h-3 mr-1" />
              ) : null}
              {confidenceLabel[result.confidenceLevel]}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          {result.proxyUsed ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t("proxy.usedTitle")}</p>
              <ul className="text-sm space-y-1">
                {result.proxyNotes.map((note, index) => (
                  <li
                    key={`${note}-${index}`}
                    className="flex items-start gap-2 text-yellow-600"
                  >
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-4">{t("proxy.addMoreInfo")}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm">{t("proxy.fullData")}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Step5CarbonResult;
