import React, { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Factory, Zap, AlertTriangle, Info } from "lucide-react";
import {
  ProductAssessmentData,
  EnergySourceInput,
  PRODUCTION_PROCESSES,
  ENERGY_SOURCES
} from "./types";
import { getMaterialById, MATERIAL_CATALOG } from "../materialCatalog";
import { useAuth } from "@/contexts/AuthContext";
import EvidenceUploader from "@/components/evidence/EvidenceUploader";

interface Step3ProductionEnergyProps {
  data: ProductAssessmentData;
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

const Step3ProductionEnergy: React.FC<Step3ProductionEnergyProps> = ({
  data,
  onChange
}) => {
  const t = useTranslations("assessment.step3");
  const { user } = useAuth();
  const companyId = user?.company_id ?? null;

  const materialWarnings = useMemo(() => {
    const warnings: { type: "info" | "warning"; message: string }[] = [];

    data.materials.forEach((material) => {
      const extMaterial = material as ExtendedMaterialInput;
      const catalogMaterial = extMaterial.catalogMaterialId
        ? getMaterialById(extMaterial.catalogMaterialId)
        : MATERIAL_CATALOG.find((item) => item.id === material.materialType);

      if (catalogMaterial) {
        if (["leather", "down", "fur"].includes(catalogMaterial.materialFamily)) {
          warnings.push({
            type: "info",
            message: t("warnings.animalWelfare", {
              material: catalogMaterial.displayNameVi
            })
          });
        }

        if (catalogMaterial.materialFamily === "metal" && material.percentage > 5) {
          warnings.push({
            type: "warning",
            message: t("warnings.metalHighImpact", {
              percentage: material.percentage
            })
          });
        }
      }

      if (extMaterial.userSource === "user_other") {
        warnings.push({
          type: "warning",
          message: t("warnings.customProxy", {
            material: extMaterial.customName || t("common.other")
          })
        });
      }

      if (material.source === "unknown") {
        warnings.push({
          type: "info",
          message: t("warnings.unknownOrigin")
        });
      }
    });

    const accessoriesWithoutWeight = data.accessories.filter(
      (accessory) => accessory.type && !accessory.weight
    );

    if (accessoriesWithoutWeight.length > 0) {
      warnings.push({
        type: "info",
        message: t("warnings.accessoryNoWeight", {
          count: accessoriesWithoutWeight.length
        })
      });
    }

    return warnings;
  }, [data.accessories, data.materials, t]);

  const availableProcesses = useMemo(
    () => PRODUCTION_PROCESSES.filter((process) => process.categories.includes(data.productCategory)),
    [data.productCategory]
  );

  const toggleProcess = (processValue: string) => {
    const current = data.productionProcesses || [];
    const updated = current.includes(processValue)
      ? current.filter((process) => process !== processValue)
      : [...current, processValue];

    onChange({ productionProcesses: updated });
  };

  const toggleEnergySource = (sourceValue: string) => {
    const current = data.energySources || [];
    const exists = current.find((energy) => energy.source === sourceValue);

    if (exists) {
      const updated = current.filter((energy) => energy.source !== sourceValue);

      if (updated.length > 0) {
        const perSource = Math.floor(100 / updated.length);
        const remainder = 100 - perSource * updated.length;

        updated.forEach((energy, index) => {
          energy.percentage = perSource + (index === 0 ? remainder : 0);
        });
      }

      onChange({ energySources: updated });
      return;
    }

    const newSource: EnergySourceInput = {
      id: `energy-${Date.now()}`,
      source: sourceValue,
      percentage: 0
    };

    const updated = [...current, newSource];
    const perSource = Math.floor(100 / updated.length);
    const remainder = 100 - perSource * updated.length;

    updated.forEach((energy, index) => {
      energy.percentage = perSource + (index === 0 ? remainder : 0);
    });

    onChange({ energySources: updated });
  };

  const updateEnergyPercentage = (sourceValue: string, percentage: number) => {
    const updated = data.energySources.map((energy) =>
      energy.source === sourceValue ? { ...energy, percentage } : energy
    );
    onChange({ energySources: updated });
  };

  const totalEnergyPercentage = data.energySources.reduce(
    (sum, energy) => sum + (energy.percentage || 0),
    0
  );
  const isValidEnergyTotal = totalEnergyPercentage === 100;

  const isSourceSelected = (sourceValue: string) =>
    data.energySources.some((energy) => energy.source === sourceValue);

  return (
    <div className="space-y-6">
      {materialWarnings.length > 0 ? (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <CardTitle className="text-base text-yellow-700">
                {t("warnings.title")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {materialWarnings.map((warning, index) => (
              <div
                key={`${warning.type}-${index}`}
                className={`flex items-start gap-2 text-sm ${
                  warning.type === "warning" ? "text-yellow-700" : "text-muted-foreground"
                }`}
              >
                {warning.type === "warning" ? (
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-yellow-600" />
                ) : (
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                )}
                <span>{warning.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="px-3 pb-3 pt-3 md:px-6 md:pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Factory className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{t("process.title")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("process.subtitle")}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {availableProcesses.map((process) => (
              <label
                key={process.value}
                className={`
                  flex items-center gap-3 rounded-lg border px-3 py-3 cursor-pointer transition-colors md:p-4
                  ${
                    data.productionProcesses?.includes(process.value)
                      ? "bg-primary/5 border-primary/30"
                      : "bg-card hover:bg-muted/50"
                  }
                `}
              >
                <Checkbox
                  checked={data.productionProcesses?.includes(process.value)}
                  onCheckedChange={() => toggleProcess(process.value)}
                />

                <div>
                  <p className="font-medium">
                    {t.has(`processes.${process.value}`)
                      ? t(`processes.${process.value}`)
                      : process.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("process.factor", { value: process.co2Factor })}
                  </p>
                </div>
              </label>
            ))}
          </div>

          {!data.productionProcesses || data.productionProcesses.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-4">{t("process.required")}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-3 pb-3 pt-3 md:px-6 md:pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Zap className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <CardTitle className="text-lg">{t("energy.title")}</CardTitle>
                <p className="text-sm text-muted-foreground">{t("energy.subtitle")}</p>
              </div>
            </div>

            <div
              className={`min-w-[5.25rem] text-right text-sm font-medium transition-colors ${
                data.energySources.length === 0
                  ? "text-transparent"
                  : isValidEnergyTotal
                    ? "text-green-600"
                    : "text-yellow-600"
              }`}
            >
              {t("energy.total", {
                value: data.energySources.length === 0 ? 0 : totalEnergyPercentage
              })}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 px-3 pb-3 md:px-6 md:pb-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {ENERGY_SOURCES.map((source) => (
              <label
                key={source.value}
                className={`
                  flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors md:p-3
                  ${
                    isSourceSelected(source.value)
                      ? "bg-yellow-500/5 border-yellow-500/30"
                      : "bg-card hover:bg-muted/50"
                  }
                `}
              >
                <Checkbox
                  checked={isSourceSelected(source.value)}
                  onCheckedChange={() => toggleEnergySource(source.value)}
                />

                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {t.has(`energySources.${source.value}`)
                      ? t(`energySources.${source.value}`)
                      : source.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("energy.factor", { value: source.co2Factor })}
                  </p>
                </div>
              </label>
            ))}
          </div>

          {data.energySources.length > 1 ? (
            <div className="mt-6 rounded-lg border bg-muted/30 px-3 py-3 md:p-4">
              <p className="text-sm font-medium mb-4">{t("energy.distributionTitle")}</p>
              <div className="space-y-4">
                {data.energySources.map((energy) => {
                  const sourceInfo = ENERGY_SOURCES.find(
                    (source) => source.value === energy.source
                  );

                  return (
                    <div key={energy.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">
                          {sourceInfo && t.has(`energySources.${sourceInfo.value}`)
                            ? t(`energySources.${sourceInfo.value}`)
                            : sourceInfo?.label || energy.source}
                        </span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={energy.percentage}
                            onChange={(event) =>
                              updateEnergyPercentage(
                                energy.source,
                                Number(event.target.value)
                              )
                            }
                            className="w-20 h-8 text-sm"
                          />

                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                      <Progress value={energy.percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>

              {!isValidEnergyTotal ? (
                <div className="mt-4 flex items-center gap-2 text-yellow-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{t("energy.invalidTotal")}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <EvidenceUploader
        companyId={companyId}
        productId={(data as { productId?: string }).productId}
        defaultKind="electricity_bill"
      />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{t("additionalInfo.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("additionalInfo.manufacturingLocation")}</Label>
              <Input
                value={data.manufacturingLocation}
                onChange={(event) =>
                  onChange({ manufacturingLocation: event.target.value })
                }
                placeholder={t("additionalInfo.manufacturingLocationPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("additionalInfo.wasteRecovery")}</Label>
              <Select
                value={data.wasteRecovery}
                onValueChange={(value) => onChange({ wasteRecovery: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("additionalInfo.wasteRecoveryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("wasteRecovery.none")}</SelectItem>
                  <SelectItem value="partial">{t("wasteRecovery.partial")}</SelectItem>
                  <SelectItem value="full">{t("wasteRecovery.full")}</SelectItem>
                  <SelectItem value="circular">{t("wasteRecovery.circular")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Step3ProductionEnergy;
