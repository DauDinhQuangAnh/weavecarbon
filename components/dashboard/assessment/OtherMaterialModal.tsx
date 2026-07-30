import React, { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  CatalogMaterial,
  MaterialType,
  MATERIAL_TYPE_LABELS,
  filterCatalogMaterials
} from "./materialCatalog";
import type { ProductCategory } from "@/lib/carbon/types";

interface AICandidate {
  material: CatalogMaterial;
  score: number;
  rationale?: string;
}

interface OtherMaterialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productCategory?: ProductCategory;
  onSelectMaterial: (
    material: CatalogMaterial | null,
    customData?: {
      name: string;
      description: string;
      materialType: MaterialType;
      confidenceScore: number;
      isProxy: boolean;
    }
  ) => void;
}

const APPLICATION_VALUES = [
  "body_fabric",
  "lining",
  "zipper",
  "button",
  "thread",
  "label",
  "elastic",
  "padding",
  "trim",
  "pallet_body"
] as const;

const OtherMaterialModal: React.FC<OtherMaterialModalProps> = ({
  open,
  onOpenChange,
  productCategory,
  onSelectMaterial
}) => {
  const t = useTranslations("assessment.otherMaterialModal");
  const defaultMaterialType: MaterialType = productCategory === "wood_pallet" ? "component" : "fabric";
  const defaultApplication: (typeof APPLICATION_VALUES)[number] =
    productCategory === "wood_pallet" ? "pallet_body" : "body_fabric";

  const [step, setStep] = useState<"input" | "results">("input");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [materialName, setMaterialName] = useState("");
  const [materialDescription, setMaterialDescription] = useState("");
  const [materialType, setMaterialType] = useState<MaterialType>(defaultMaterialType);
  const [application, setApplication] = useState<(typeof APPLICATION_VALUES)[number]>(
    defaultApplication
  );

  const [candidates, setCandidates] = useState<AICandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null
  );
  const [useProxy, setUseProxy] = useState(false);

  const resetForm = () => {
    setStep("input");
    setMaterialName("");
    setMaterialDescription("");
    setMaterialType(defaultMaterialType);
    setApplication(defaultApplication);
    setCandidates([]);
    setSelectedCandidateId(null);
    setUseProxy(false);
    setIsAnalyzing(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const rankedCandidates = useMemo(() => {
    const query = materialName.trim().toLowerCase();
    const description = materialDescription.trim().toLowerCase();

    return filterCatalogMaterials(productCategory, materialType)
      .map((material) => {
        const viName = material.displayNameVi.toLowerCase();
        const enName = material.displayNameEn.toLowerCase();
        const family = material.materialFamily.toLowerCase();

        let score = 0.2;
        if (query && (viName.includes(query) || enName.includes(query))) score += 0.5;
        if (description && (viName.includes(description) || enName.includes(description))) {
          score += 0.2;
        }
        if (query && family.includes(query)) score += 0.1;

        return {
          material,
          score: Math.min(0.98, Number(score.toFixed(2))),
          rationale: t("candidate.reason", {
            family: t.has(`materialFamilies.${material.materialFamily}`)
              ? t(`materialFamilies.${material.materialFamily}`)
              : material.materialFamily
          })
        } satisfies AICandidate;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [materialDescription, materialName, materialType, productCategory, t]);

  const runAnalyze = async () => {
    if (!materialName.trim()) return;

    setIsAnalyzing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 350));
      setCandidates(rankedCandidates.filter((candidate) => candidate.score >= 0.35));
      setSelectedCandidateId(null);
      setUseProxy(false);
      setStep("results");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmSelection = () => {
    if (selectedCandidateId) {
      const selected = candidates.find((candidate) => candidate.material.id === selectedCandidateId);
      if (selected) {
        onSelectMaterial(selected.material);
        handleClose();
        return;
      }
    }

    if (useProxy || candidates.length === 0) {
      onSelectMaterial(null, {
        name: materialName,
        description: materialDescription,
        materialType,
        confidenceScore: 0.35,
        isProxy: true
      });
    }

    handleClose();
  };

  const getScoreBadgeVariant = (
    score: number
  ): "default" | "secondary" | "destructive" | "outline" => {
    if (score >= 0.75) return "default";
    if (score >= 0.45) return "secondary";
    return "outline";
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 0.75) return t("score.high");
    if (score >= 0.45) return t("score.medium");
    return t("score.low");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {step === "input" ? t("subtitle.input") : t("subtitle.results")}
          </DialogDescription>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="material-name">{t("fields.name")}</Label>
              <Input
                id="material-name"
                placeholder={t("fields.namePlaceholder")}
                value={materialName}
                onChange={(event) => setMaterialName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="material-description">{t("fields.description")}</Label>
              <Textarea
                id="material-description"
                placeholder={t("fields.descriptionPlaceholder")}
                value={materialDescription}
                onChange={(event) => setMaterialDescription(event.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("fields.materialType")}</Label>
                <Select value={materialType} onValueChange={(value) => setMaterialType(value as MaterialType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MATERIAL_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {t.has(`materialTypes.${value}`) ? t(`materialTypes.${value}`) : label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("fields.application")}</Label>
                <Select
                  value={application}
                  onValueChange={(value) => setApplication(value as (typeof APPLICATION_VALUES)[number])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPLICATION_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`applications.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {candidates.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {t("results.found", { count: candidates.length })}
                </p>

                <RadioGroup value={selectedCandidateId || ""} onValueChange={setSelectedCandidateId}>
                  {candidates.map((candidate) => (
                    <Card
                      key={candidate.material.id}
                      className={`cursor-pointer transition-colors ${
                        selectedCandidateId === candidate.material.id
                          ? "ring-2 ring-primary"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        setSelectedCandidateId(candidate.material.id);
                        setUseProxy(false);
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <RadioGroupItem
                            value={candidate.material.id}
                            id={candidate.material.id}
                            className="mt-1"
                          />

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Label
                                htmlFor={candidate.material.id}
                                className="font-medium cursor-pointer"
                              >
                                {candidate.material.displayNameVi}
                              </Label>
                              <Badge variant={getScoreBadgeVariant(candidate.score)}>
                                {Math.round(candidate.score * 100)}% - {getScoreLabel(candidate.score)}
                              </Badge>
                            </div>

                            <p className="text-sm text-muted-foreground">
                              {t("candidate.co2Line", {
                                name: candidate.material.displayNameVi,
                                factor: candidate.material.co2Factor
                              })}
                            </p>
                            {candidate.rationale ? (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                {candidate.rationale}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </RadioGroup>

                <div className="border-t pt-4">
                  <Card
                    className={`cursor-pointer transition-colors ${
                      useProxy ? "ring-2 ring-primary" : "hover:bg-muted/50"
                    }`}
                    onClick={() => {
                      setSelectedCandidateId(null);
                      setUseProxy(true);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <RadioGroupItem
                          value="proxy"
                          checked={useProxy && !selectedCandidateId}
                          className="mt-1"
                        />

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Label className="font-medium cursor-pointer">
                              {t("results.proxy.title")}
                            </Label>
                            <Badge variant="outline">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {t("results.proxy.badge")}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {t("results.proxy.description")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                <h4 className="font-medium mb-2">{t("results.empty.title")}</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("results.empty.description", { name: materialName })}
                </p>
                <Card className="text-left">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">{t("results.empty.proxyTitle")}</p>
                        <p className="text-sm text-muted-foreground">
                          {t("results.empty.proxyDescription")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "input" ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                {t("buttons.cancel")}
              </Button>
              <Button onClick={runAnalyze} disabled={isAnalyzing || !materialName.trim()}>
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("buttons.analyzing")}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {t("buttons.analyze")}
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("input")}>
                {t("buttons.back")}
              </Button>
              <Button
                onClick={handleConfirmSelection}
                disabled={!selectedCandidateId && !useProxy && candidates.length > 0}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {t("buttons.confirm")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OtherMaterialModal;
