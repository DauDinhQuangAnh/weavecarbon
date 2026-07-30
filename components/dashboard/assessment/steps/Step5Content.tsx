import React, { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  CheckCircle2,
  Factory,
  Info,
  Leaf,
  Package,
  Sparkles,
  TrendingDown,
  Truck,
  Zap
} from "lucide-react";
import type { ProductAssessmentData, CarbonAssessmentResult } from "./types";
import { buildCarbonEngineInputFromAssessment, calculateAssessmentCarbon } from "@/lib/carbon/adapters";
import { getCarbonFactor } from "@/lib/carbon/factorRegistry";
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

interface MaterialDetailItem {
  id: string;
  factorValue: number;
  label: string;
  amount: number;
  percentage: number;
  userSource?: ExtendedMaterialInput["userSource"];
}

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

const localizeProxyNote = (note: string, t: TranslateFn) => {
  const trimmed = note.trim();
  if (!trimmed) return null;

  if (trimmed === "No valid carbon input was provided.") {
    return t("proxy.noValidInput");
  }

  let match = trimmed.match(
    /^BOM coverage is ([\d.]+)%; results rely on partial material allocation\.$/
  );
  if (match) {
    return t("proxy.bomCoverage", { value: match[1] });
  }

  if (trimmed === "Material inputs are missing; material stage is excluded from the estimate.") {
    return t("proxy.materialMissing");
  }

  match = trimmed.match(/^Material "(.+)" has unknown origin; uncertainty is widened\.$/);
  if (match) {
    return t("proxy.materialUnknownOrigin", { material: match[1] });
  }

  match = trimmed.match(/^Material "(.+)" is mapped to a generic internal proxy factor\.$/);
  if (match) {
    return t("proxy.materialGenericProxy", { material: match[1] });
  }

  match = trimmed.match(/^Accessory "(.+)" has no explicit weight and is excluded from CO2e\.$/);
  if (match) {
    return t("proxy.accessoryExcluded", { accessory: match[1] });
  }

  if (trimmed === "Packaging is excluded because packaging weight/type was not provided.") {
    return t("proxy.packagingExcluded");
  }

  if (/^Manufacturing processes are missing; a generic .+ process proxy was used\.$/.test(trimmed)) {
    return t("proxy.noProcessInfo");
  }

  match = trimmed.match(/^No energy mix was provided; grid electricity was inferred for (.+)\.$/);
  if (match) {
    return t("proxy.noEnergyInfoInferred", { location: match[1] });
  }

  if (trimmed === "No energy mix was provided; a generic grid electricity fallback was used.") {
    return t("proxy.noEnergyInfo");
  }

  match = trimmed.match(
    /^Energy mix coverage is ([\d.]+)%; shares were normalized before calculation\.$/
  );
  if (match) {
    return t("proxy.energyMixNormalized", { value: match[1] });
  }

  if (trimmed === "A transport leg is missing mode/factor and was excluded from the estimate.") {
    return t("proxy.transportLegExcluded");
  }

  match = trimmed.match(/^Transport distance for (.+) used market default ([\d.]+) km\.$/);
  if (match) {
    return t("proxy.transportDistanceDefault", {
      mode: match[1],
      distance: match[2]
    });
  }

  if (trimmed === "Transport is excluded because no transport legs were provided.") {
    return t("proxy.transportExcluded");
  }

  return trimmed;
};

const Step5CarbonResult: React.FC<Step5CarbonResultProps> = ({
  data,
  companyDomesticMarket,
  onChange
}) => {
  const t = useTranslations("assessment.step5");
  const locale = "vi";
  const displayLocale = "vi-VN";
  const currentSerialized = useMemo(
    () => JSON.stringify(data.carbonResults ?? null),
    [data.carbonResults]
  );

  const result = useMemo(
    (): CarbonAssessmentResult => calculateAssessmentCarbon(data, companyDomesticMarket),
    [companyDomesticMarket, data]
  );
  const resultSerialized = useMemo(() => JSON.stringify(result), [result]);
  const engineInput = useMemo(
    () => buildCarbonEngineInputFromAssessment(data, companyDomesticMarket),
    [companyDomesticMarket, data]
  );

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
      percentage:
        result.perProduct.total > 0 ?
          (result.perProduct.materials / result.perProduct.total) * 100 :
          0
    },
    {
      label: t("breakdown.production"),
      icon: Factory,
      value: result.perProduct.production,
      total: result.totalBatch.production,
      percentage:
        result.perProduct.total > 0 ?
          (result.perProduct.production / result.perProduct.total) * 100 :
          0
    },
    {
      label: t("breakdown.energy"),
      icon: Zap,
      value: result.perProduct.energy,
      total: result.totalBatch.energy,
      percentage:
        result.perProduct.total > 0 ?
          (result.perProduct.energy / result.perProduct.total) * 100 :
          0
    },
    {
      label: t("breakdown.transport"),
      icon: Truck,
      value: result.perProduct.transport,
      total: result.totalBatch.transport,
      percentage:
        result.perProduct.total > 0 ?
          (result.perProduct.transport / result.perProduct.total) * 100 :
          0
    },
    {
      label: t("breakdown.packaging"),
      icon: Package,
      value: result.perProduct.packaging || 0,
      total: result.totalBatch.packaging || 0,
      percentage:
        result.perProduct.total > 0 ?
          ((result.perProduct.packaging || 0) / result.perProduct.total) * 100 :
          0
    }
  ].filter((item) => item.value > 0 || item.total > 0);

  const materialDetails = useMemo<MaterialDetailItem[]>(() => {
    const totalAccessoryMassKg = engineInput.accessories.reduce((sum, accessory) => {
      const weightKg = typeof accessory.weightKg === "number" && Number.isFinite(accessory.weightKg) ?
        accessory.weightKg :
        0;
      return sum + Math.max(0, weightKg);
    }, 0);
    const materialBaseMassKg = Math.max(engineInput.unitMassKg - totalAccessoryMassKg, 0);

    return data.materials.map((material, index) => {
      const extMaterial = material as ExtendedMaterialInput;
      const engineMaterial = engineInput.materials[index];
      const factor =
        getCarbonFactor(engineMaterial?.factorId ?? engineMaterial?.type) ??
        getCarbonFactor("cat-other-generic");
      const catalogMaterial = extMaterial.catalogMaterialId ?
        getMaterialById(extMaterial.catalogMaterialId) :
        MATERIAL_CATALOG.find((item) => item.id === material.materialType);
      const label =
        extMaterial.customName ||
        (catalogMaterial ?
          locale === "vi" ?
            catalogMaterial.displayNameVi :
            catalogMaterial.displayNameEn :
          undefined) ||
        material.materialType ||
        t("common.material");
      const percentage = Math.max(0, material.percentage || 0);
      const factorValue = factor?.value || 0;
      const amount = materialBaseMassKg * (percentage / 100) * factorValue;

      return {
        id: material.id || `mat-${index}`,
        factorValue,
        label,
        amount,
        percentage,
        userSource: extMaterial.userSource
      };
    });
  }, [data.materials, engineInput.accessories, engineInput.materials, engineInput.unitMassKg, locale, t]);

  const localizedProxyNotes = useMemo(
    () =>
      result.proxyNotes
        .map((note) => localizeProxyNote(note, t))
        .filter((note): note is string => Boolean(note)),
    [result.proxyNotes, t]
  );

  const proxyFactorCount = useMemo(
    () => (result.factorSourceSummary ?? []).filter((factor) => factor.isProxy).length,
    [result.factorSourceSummary]
  );

  const scopeItems = [
    {
      label: t("scope.scope1"),
      description: t("scope.scope1Desc"),
      value: result.scope1,
      className: "bg-blue-500/5 border-blue-500/20",
      labelClassName: "text-blue-600"
    },
    {
      label: t("scope.scope2"),
      description: t("scope.scope2Desc"),
      value: result.scope2,
      className: "bg-green-500/5 border-green-500/20",
      labelClassName: "text-green-600"
    },
    {
      label: t("scope.scope3"),
      description: t("scope.scope3Desc"),
      value: result.scope3,
      className: "bg-purple-500/5 border-purple-500/20",
      labelClassName: "text-purple-600"
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

  const confidenceMetrics = [
    {
      label: t("confidence.axes.completeness"),
      score: result.dataQualityBreakdown?.completeness.score ?? 0,
      maxScore: result.dataQualityBreakdown?.completeness.maxScore ?? 30
    },
    {
      label: t("confidence.axes.specificity"),
      score: result.dataQualityBreakdown?.specificity.score ?? 0,
      maxScore: result.dataQualityBreakdown?.specificity.maxScore ?? 25
    },
    {
      label: t("confidence.axes.geographicRelevance"),
      score: result.dataQualityBreakdown?.geographicRelevance.score ?? 0,
      maxScore: result.dataQualityBreakdown?.geographicRelevance.maxScore ?? 15
    },
    {
      label: t("confidence.axes.transportSpecificity"),
      score: result.dataQualityBreakdown?.transportSpecificity.score ?? 0,
      maxScore: result.dataQualityBreakdown?.transportSpecificity.maxScore ?? 15
    },
    {
      label: t("confidence.axes.proxyShare"),
      score: result.dataQualityBreakdown?.proxyShare.score ?? 0,
      maxScore: result.dataQualityBreakdown?.proxyShare.maxScore ?? 15
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
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
              <span className="ml-2 text-lg font-normal text-muted-foreground">
                {t("units.kgCo2e")}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
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
              <span className="ml-2 text-lg font-normal text-muted-foreground">
                {t("units.kgCo2e")}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
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
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold">
                    {item.value.toFixed(3)} {t("units.kg")}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
              <Progress value={item.percentage} className="h-2" />
              <p className="text-right text-xs text-muted-foreground">
                {t("totalBatchLine", { value: item.total.toFixed(2) })}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {result.biogenicCarbon ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Leaf className="w-5 h-5 text-emerald-600" />
              <CardTitle className="text-lg text-emerald-700">Carbon sinh học (biogenic)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">
              -{result.biogenicCarbon.removedKgCO2e.toFixed(3)}
              <span className="ml-2 text-base font-normal text-muted-foreground">
                {t("units.kgCo2e")}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              CO₂ được lưu trữ trong vật liệu sinh học (gỗ), báo cáo riêng theo GHG Protocol/PAS
              2050 — không cộng gộp vào tổng phát thải ở trên.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Leaf className="w-5 h-5" />
            {t("materialDetailsTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {materialDetails.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border bg-card p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.label}</span>

                      {item.userSource === "selected_catalog" ? (
                        <Badge variant="outline" className="text-xs">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          {t("source.fromCatalog")}
                        </Badge>
                      ) : null}

                      {item.userSource === "ai_suggested" ? (
                        <Badge variant="secondary" className="text-xs">
                          <Sparkles className="mr-1 h-3 w-3" />
                          {t("source.aiSuggested")}
                        </Badge>
                      ) : null}

                      {item.userSource === "user_other" ? (
                        <Badge
                          variant="outline"
                          className="border-yellow-500/30 bg-yellow-500/10 text-xs text-yellow-600"
                        >
                          <AlertCircle className="mr-1 h-3 w-3" />
                          {t("source.proxy")}
                        </Badge>
                      ) : null}
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("materialLine", {
                        percentage: item.percentage,
                        factor: item.factorValue.toFixed(2)
                      })}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-semibold">{item.amount.toFixed(4)}</span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    {t("units.kgCo2e")}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {data.materials.some(
            (material) => (material as ExtendedMaterialInput).userSource === "user_other"
          ) ? (
            <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 text-yellow-600" />
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
            {scopeItems.map((item) => (
              <div
                key={item.label}
                className={`rounded-lg border p-4 text-center ${item.className}`}
              >
                <p className={`mb-1 text-xs font-medium ${item.labelClassName}`}>{item.label}</p>
                <p className="text-lg font-bold">
                  {typeof item.value === "number" ? item.value.toFixed(2) : t("scope.notAvailable")}
                </p>
                <p className="text-xs text-muted-foreground">{t("units.kgCo2e")}</p>
                <p className="mt-2 text-xs text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-lg">{t("confidence.title")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("confidence.scoreLine", { value: result.confidenceScore ?? 0 })}
              </p>
            </div>
            <Badge
              variant="outline"
              className={confidenceBadgeStyle[result.confidenceLevel]}
            >
              {result.confidenceLevel === "high" ? (
                <CheckCircle2 className="mr-1 h-3 w-3" />
              ) : null}
              {result.confidenceLevel === "medium" ? (
                <Info className="mr-1 h-3 w-3" />
              ) : null}
              {result.confidenceLevel === "low" ? (
                <AlertCircle className="mr-1 h-3 w-3" />
              ) : null}
              {confidenceLabel[result.confidenceLevel]}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {confidenceMetrics.map((metric) => {
              const percentage =
                metric.maxScore > 0 ?
                  Math.round((metric.score / metric.maxScore) * 100) :
                  0;

              return (
                <div key={metric.label} className="space-y-2 rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{metric.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {percentage}%
                    </span>
                  </div>
                  <Progress value={percentage} className="h-1.5" />
                </div>
              );
            })}
          </div>

          {localizedProxyNotes.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t("proxy.usedTitle")}</p>
              <ul className="space-y-1 text-sm">
                {localizedProxyNotes.map((note, index) => (
                  <li
                    key={`${note}-${index}`}
                    className="flex items-start gap-2 text-yellow-600"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">{t("proxy.addMoreInfo")}</p>
            </div>
          ) : proxyFactorCount > 0 ? (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
              <div className="flex items-start gap-2 text-yellow-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-sm">
                  {t("proxy.genericUsed", { count: proxyFactorCount })}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm">{t("proxy.fullData")}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Step5CarbonResult;
