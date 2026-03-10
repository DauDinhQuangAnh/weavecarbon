import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  HelpCircle
} from "lucide-react";
import {
  ProductAssessmentData,
  MaterialInput,
  CERTIFICATIONS,
  ACCESSORY_TYPES,
  AccessoryInput
} from "./types";
import MaterialCombobox from "../MaterialCombobox";
import OtherMaterialModal from "../OtherMaterialModal";
import { CatalogMaterial, MaterialType } from "../materialCatalog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  CERTIFICATION_DOCUMENT_CODE_BY_VALUE,
  normalizeCertificationDocumentCode
} from "../certificationDocuments";
import { suggestMaterialCertificationCodes } from "@/lib/materialCertificationSuggestions";

interface Step2MaterialsProps {
  data: ProductAssessmentData;
  onChange: (updates: Partial<ProductAssessmentData>) => void;
  starterPlanOnlyDomestic?: boolean;
  availableCertificationDocumentCodes?: string[];
  isCertificationAvailabilityLoading?: boolean;
}

interface ExtendedMaterialInput extends MaterialInput {
  catalogMaterialId?: string;
  customName?: string;
  userSource?: "selected_catalog" | "ai_suggested" | "user_other";
  confidenceScore?: number;
}

const MATERIAL_SOURCE_VALUES: Array<"domestic" | "imported" | "unknown"> = [
  "domestic",
  "imported",
  "unknown"
];

const Step2Materials: React.FC<Step2MaterialsProps> = ({
  data,
  onChange,
  starterPlanOnlyDomestic = false,
  availableCertificationDocumentCodes = [],
  isCertificationAvailabilityLoading = false
}) => {
  const t = useTranslations("assessment.step2");
  const [otherModalOpen, setOtherModalOpen] = useState(false);
  const [editingMaterialIndex, setEditingMaterialIndex] = useState<number | null>(
    null
  );
  const sourceOptions = starterPlanOnlyDomestic ?
    MATERIAL_SOURCE_VALUES.filter((value) => value !== "imported") :
    MATERIAL_SOURCE_VALUES;
  const availableCertificationSet = new Set(
    availableCertificationDocumentCodes.map((value) =>
      normalizeCertificationDocumentCode(value)
    )
  );

  const totalPercentage = data.materials.reduce(
    (sum, material) => sum + (material.percentage || 0),
    0
  );
  const isValidTotal = totalPercentage === 100;
  const hasProxySource = data.materials.some(
    (material) =>
      material.source === "unknown" ||
      (material as ExtendedMaterialInput).userSource === "user_other"
  );
  const certificationLabelByValue = CERTIFICATIONS.reduce<Record<string, string>>(
    (acc, certification) => {
      acc[certification.value] = certification.label;
      return acc;
    },
    {}
  );

  const isCertificationAvailable = (certValue: string) => {
    const mappedDocumentCode = CERTIFICATION_DOCUMENT_CODE_BY_VALUE[certValue];
    if (!mappedDocumentCode) return true;
    return availableCertificationSet.has(
      normalizeCertificationDocumentCode(mappedDocumentCode)
    );
  };

  const resolveAutoSelectedCertifications = (
    currentCertifications: string[],
    suggestionTokens: Array<string | null | undefined>
  ) => {
    const suggestedCertifications = suggestMaterialCertificationCodes(suggestionTokens);
    const availableSuggestedCertifications = suggestedCertifications.filter((certValue) =>
      isCertificationAvailable(certValue)
    );

    return {
      nextCertifications: Array.from(
        new Set([...currentCertifications, ...availableSuggestedCertifications])
      ),
      unavailableSuggestedCertifications: suggestedCertifications.filter(
        (certValue) => !availableSuggestedCertifications.includes(certValue)
      )
    };
  };

  const addMaterial = () => {
    const newMaterial: ExtendedMaterialInput = {
      id: `mat-${Date.now()}`,
      materialType: "",
      percentage: 0,
      source: "domestic",
      certifications: [],
      userSource: "selected_catalog",
      confidenceScore: 1.0
    };

    onChange({ materials: [...data.materials, newMaterial] });
  };

  const removeMaterial = (id: string) => {
    onChange({ materials: data.materials.filter((material) => material.id !== id) });
  };

  const updateMaterial = (id: string, updates: Partial<ExtendedMaterialInput>) => {
    onChange({
      materials: data.materials.map((material) =>
        material.id === id ? { ...material, ...updates } : material
      )
    });
  };

  const handleCatalogSelect = (
    materialId: string,
    catalogMaterial: CatalogMaterial | null
  ) => {
    if (!catalogMaterial) return;

    const currentMaterial = data.materials.find((item) => item.id === materialId);
    const currentCertifications = currentMaterial?.certifications || [];
    const autoSelection = resolveAutoSelectedCertifications(currentCertifications, [
      catalogMaterial.id,
      catalogMaterial.displayNameEn,
      catalogMaterial.displayNameVi,
      catalogMaterial.materialFamily
    ]);

    updateMaterial(materialId, {
      materialType: catalogMaterial.id,
      catalogMaterialId: catalogMaterial.id,
      customName: undefined,
      userSource: "selected_catalog",
      confidenceScore: 1.0,
      certifications: autoSelection.nextCertifications
    });

    if (autoSelection.unavailableSuggestedCertifications.length > 0) {
      const unavailableLabels = autoSelection.unavailableSuggestedCertifications
        .map((certValue) => certificationLabelByValue[certValue] || certValue)
        .slice(0, 3);
      toast.warning(
        t("certificationUploadRequiredToast", {
          certification: unavailableLabels.join(", ")
        })
      );
    }
  };

  const handleOtherClick = (index: number) => {
    setEditingMaterialIndex(index);
    setOtherModalOpen(true);
  };

  const handleOtherMaterialSelect = (
    catalogMaterial: CatalogMaterial | null,
    customData?: {
      name: string;
      description: string;
      materialType: MaterialType;
      confidenceScore: number;
      isProxy: boolean;
    }
  ) => {
    if (editingMaterialIndex === null) return;

    const materialId = data.materials[editingMaterialIndex]?.id;
    if (!materialId) return;

    if (catalogMaterial) {
      const currentMaterial = data.materials.find((item) => item.id === materialId);
      const currentCertifications = currentMaterial?.certifications || [];
      const autoSelection = resolveAutoSelectedCertifications(currentCertifications, [
        catalogMaterial.id,
        catalogMaterial.displayNameEn,
        catalogMaterial.displayNameVi,
        catalogMaterial.materialFamily
      ]);

      updateMaterial(materialId, {
        materialType: catalogMaterial.id,
        catalogMaterialId: catalogMaterial.id,
        customName: undefined,
        userSource: "ai_suggested",
        confidenceScore: 0.75,
        certifications: autoSelection.nextCertifications
      });
    } else if (customData) {
      const currentMaterial = data.materials.find((item) => item.id === materialId);
      const currentCertifications = currentMaterial?.certifications || [];
      const autoSelection = resolveAutoSelectedCertifications(currentCertifications, [
        customData.name,
        customData.description,
        customData.materialType
      ]);

      updateMaterial(materialId, {
        materialType: "cat-other-generic",
        catalogMaterialId: "cat-other-generic",
        customName: customData.name,
        userSource: "user_other",
        confidenceScore: customData.confidenceScore,
        certifications: autoSelection.nextCertifications
      });
    }

    setEditingMaterialIndex(null);
  };

  const toggleCertification = (materialId: string, certValue: string) => {
    const material = data.materials.find((item) => item.id === materialId);
    if (!material) return;

    const currentCerts = material.certifications || [];
    const updated = currentCerts.includes(certValue)
      ? currentCerts.filter((cert) => cert !== certValue)
      : [...currentCerts, certValue];

    updateMaterial(materialId, { certifications: updated });
  };

  const handleCertificationClick = (
    material: MaterialInput,
    certValue: string,
    certLabel: string
  ) => {
    const isSelected = (material.certifications || []).includes(certValue);
    const isAvailable = isCertificationAvailable(certValue);

    if (isCertificationAvailabilityLoading) {
      toast.info(t("certificationAvailabilityLoading"));
      return;
    }

    if (!isSelected && !isAvailable) {
      toast.warning(
        t("certificationUploadRequiredToast", {
          certification: certLabel
        })
      );
      return;
    }

    toggleCertification(material.id, certValue);
  };

  const getSourceBadge = (material: ExtendedMaterialInput) => {
    switch (material.userSource) {
      case "ai_suggested":
        return (
          <Badge variant="secondary" className="text-xs">
            <Sparkles className="w-3 h-3 mr-1" />
            {t("sourceBadges.aiSuggested")}
          </Badge>
        );

      case "user_other":
        return (
          <Badge
            variant="outline"
            className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30"
          >
            <AlertCircle className="w-3 h-3 mr-1" />
            {t("sourceBadges.proxy")}
          </Badge>
        );

      default:
        return null;
    }
  };

  const addAccessory = () => {
    const newAccessory: AccessoryInput = {
      id: `acc-${Date.now()}`,
      name: "",
      type: "",
      weight: undefined
    };

    onChange({ accessories: [...data.accessories, newAccessory] });
  };

  const removeAccessory = (id: string) => {
    onChange({ accessories: data.accessories.filter((accessory) => accessory.id !== id) });
  };

  const updateAccessory = (id: string, updates: Partial<AccessoryInput>) => {
    onChange({
      accessories: data.accessories.map((accessory) =>
        accessory.id === id ? { ...accessory, ...updates } : accessory
      )
    });
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{t("mainMaterialsTitle")}</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>{t("mainMaterialsTooltip")}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                {isValidTotal ? (
                  <Badge
                    variant="outline"
                    className="bg-green-500/10 text-green-600 border-green-500/30"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {t("totalValid", { value: totalPercentage })}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30"
                  >
                    <AlertCircle className="w-3 h-3 mr-1" />
                    {t("totalInvalid", { value: totalPercentage })}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {data.materials.map((material, index) => {
              const extMaterial = material as ExtendedMaterialInput;
              return (
                <div key={material.id} className="p-4 rounded-lg border bg-card space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        {t("materialItem", { index: index + 1 })}
                      </span>
                      {getSourceBadge(extMaterial)}
                    </div>

                    {data.materials.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMaterial(material.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label>{t("materialSearchLabel")}</Label>
                      <MaterialCombobox
                        value={extMaterial.catalogMaterialId || extMaterial.materialType}
                        onSelect={(catalogMaterial) =>
                          handleCatalogSelect(material.id, catalogMaterial)
                        }
                        onOtherClick={() => handleOtherClick(index)}
                        placeholder={
                          extMaterial.customName || t("materialSearchPlaceholder")
                        }
                      />

                      {extMaterial.customName && (
                        <p className="text-xs text-muted-foreground">
                          {t("customMaterial", { name: extMaterial.customName })}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>{t("percentageLabel")}</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={material.percentage || ""}
                        onChange={(event) =>
                          updateMaterial(material.id, {
                            percentage: Number(event.target.value)
                          })
                        }
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("sourceLabel")}</Label>
                      <Select
                        value={
                          starterPlanOnlyDomestic && material.source === "imported" ?
                            "domestic" :
                            material.source
                        }
                        onValueChange={(value: "domestic" | "imported" | "unknown") =>
                          updateMaterial(material.id, {
                            source:
                              starterPlanOnlyDomestic && value === "imported" ?
                                "domestic" :
                                value
                          })
                        }>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceOptions.map((sourceValue) => (
                            <SelectItem key={sourceValue} value={sourceValue}>
                              {t(`materialSources.${sourceValue}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {extMaterial.confidenceScore !== undefined &&
                    extMaterial.confidenceScore < 1.0 ? (
                      <div className="space-y-2">
                        <Label>{t("confidenceLabel")}</Label>
                        <div className="flex items-center gap-2 h-10">
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                extMaterial.confidenceScore >= 0.7
                                  ? "bg-green-500"
                                  : extMaterial.confidenceScore >= 0.4
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                              }`}
                              style={{
                                width: `${extMaterial.confidenceScore * 100}%`
                              }}
                            />
                          </div>

                          <span className="text-sm text-muted-foreground">
                            {Math.round((extMaterial.confidenceScore || 0) * 100)}%
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">{t("certificationsLabel")}</Label>
                    <p className="text-xs text-muted-foreground">
                      {isCertificationAvailabilityLoading ?
                        t("certificationAvailabilityLoading") :
                        t("certificationsLockedHint")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {CERTIFICATIONS.map((certification) => {
                        const isSelected = (material.certifications || []).includes(
                          certification.value
                        );
                        const isAvailable = isCertificationAvailable(
                          certification.value
                        );
                        const isLocked =
                          !isSelected &&
                          !isAvailable &&
                          !isCertificationAvailabilityLoading;

                        return (
                          <Badge
                            key={certification.value}
                            variant={isSelected ? "default" : "outline"}
                            className={cn(
                              "transition-colors",
                              isLocked ?
                                "cursor-not-allowed border-dashed text-muted-foreground hover:bg-transparent" :
                                "cursor-pointer"
                            )}
                            onClick={() =>
                              handleCertificationClick(
                                material,
                                certification.value,
                                certification.label
                              )
                            }
                          >
                            {certification.label}
                            {isLocked ? (
                              <span className="ml-1 text-[10px]">
                                {t("certificationUnavailable")}
                              </span>
                            ) : null}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            <Button variant="outline" onClick={addMaterial} className="w-full border-dashed">
              <Plus className="w-4 h-4 mr-2" />
              {t("addMaterial")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{t("accessoriesTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.accessories.map((accessory, index) => (
              <div key={accessory.id} className="p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-muted-foreground">
                    {t("accessoryItem", { index: index + 1 })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAccessory(accessory.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{t("accessoryTypeLabel")}</Label>
                    <Select
                      value={accessory.type}
                      onValueChange={(value) =>
                        updateAccessory(accessory.id, { type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("accessoryTypePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCESSORY_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {t.has(`accessoryTypes.${type.value}`)
                              ? t(`accessoryTypes.${type.value}`)
                              : type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("accessoryNameLabel")}</Label>
                    <Input
                      value={accessory.name}
                      onChange={(event) =>
                        updateAccessory(accessory.id, { name: event.target.value })
                      }
                      placeholder={t("accessoryNamePlaceholder")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("accessoryWeightLabel")}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={accessory.weight || ""}
                      onChange={(event) =>
                        updateAccessory(accessory.id, {
                          weight: Number(event.target.value)
                        })
                      }
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addAccessory} className="w-full border-dashed">
              <Plus className="w-4 h-4 mr-2" />
              {t("addAccessory")}
            </Button>
          </CardContent>
        </Card>

        {hasProxySource ? (
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-700">{t("proxy.title")}</p>
                <p className="text-yellow-600 mt-1">{t("proxy.description")}</p>
              </div>
            </div>
          </div>
        ) : null}

        <OtherMaterialModal
          open={otherModalOpen}
          onOpenChange={setOtherModalOpen}
          onSelectMaterial={handleOtherMaterialSelect}
        />
      </div>
    </TooltipProvider>
  );
};

export default Step2Materials;
