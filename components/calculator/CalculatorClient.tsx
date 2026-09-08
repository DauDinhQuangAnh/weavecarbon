"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Calculator,
  Factory,
  Info,
  Leaf,
  Package,
  Plus,
  Trash2,
  Truck
} from "lucide-react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { MATERIAL_CATALOG } from "@/components/dashboard/assessment/materialCatalog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { getCarbonFactor } from "@/lib/carbon/factorRegistry";
import {
  calculateProxyEmissions,
  getProxyManufacturingFactor,
  getProxyPackagingFactor,
  getProxyTransportFactor,
  materialPercentageTotal,
  materialSharesAreComplete,
  type ProxyEmissionBreakdown,
  type ProxyMaterialShare,
  type ProxyTransportMode
} from "@/lib/carbon/proxyCalculator";

interface MaterialInputRow {
  id: string;
  materialId: string;
  percentage: string;
}
const newMaterialRow = (): MaterialInputRow => ({
  id: crypto.randomUUID(),
  materialId: "",
  percentage: ""
});

const MATERIALS = MATERIAL_CATALOG.filter((material) =>
  material.status === "active"
  && material.materialType === "fabric"
  && (material.productCategory ?? "textile") === "textile"
).sort((a, b) => a.displayNameVi.localeCompare(b.displayNameVi, "vi"));

const TRANSPORT_MODES: Array<{ value: ProxyTransportMode; labelKey: string }> = [
  { value: "road", labelKey: "transportModes.road" },
  { value: "sea", labelKey: "transportModes.sea" },
  { value: "air", labelKey: "transportModes.air" },
  { value: "rail", labelKey: "transportModes.rail" },
  { value: "multimodal", labelKey: "transportModes.multimodal" }
];

const BREAKDOWN_META = [
  { key: "material", icon: Leaf, labelKey: "material" },
  { key: "manufacturing", icon: Factory, labelKey: "manufacturing" },
  { key: "transport", icon: Truck, labelKey: "transport" },
  { key: "packaging", icon: Package, labelKey: "packaging" }
] as const;

const getPercentage = (value: number, total: number) =>
  total > 0 ? (value / total) * 100 : 0;

export default function CalculatorClient() {
  const t = useTranslations("calculator");
  const [weight, setWeight] = useState("");
  const [materials, setMaterials] = useState<MaterialInputRow[]>([
    { id: "initial-material", materialId: "", percentage: "" }
  ]);
  const [transportMode, setTransportMode] = useState<ProxyTransportMode | "">("");
  const [transportDistance, setTransportDistance] = useState("");
  const [emissions, setEmissions] = useState<ProxyEmissionBreakdown | null>(null);
  const [calculationError, setCalculationError] = useState<string | null>(null);

  const parsedMaterialShares = useMemo<ProxyMaterialShare[]>(() =>
    materials.map((row) => ({
      materialId: row.materialId,
      percentage: Number.parseFloat(row.percentage)
    })), [materials]);
  const materialTotal = materialPercentageTotal(parsedMaterialShares);
  const materialMixValid = materialSharesAreComplete(parsedMaterialShares);
  const selectedMaterialIds = new Set(materials.map((row) => row.materialId).filter(Boolean));
  const weightValue = Number.parseFloat(weight);
  const distanceValue = Number.parseFloat(transportDistance);
  const canCalculate = Number.isFinite(weightValue)
    && weightValue > 0
    && materialMixValid
    && Boolean(transportMode)
    && Number.isFinite(distanceValue)
    && distanceValue > 0;

  const resetDerivedState = () => {
    setEmissions(null);
    setCalculationError(null);
  };

  const updateMaterial = (id: string, patch: Partial<MaterialInputRow>) => {
    setMaterials((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
    resetDerivedState();
  };

  const removeMaterial = (id: string) => {
    setMaterials((current) => current.length === 1 ? current : current.filter((row) => row.id !== id));
    resetDerivedState();
  };

  const addMaterial = () => {
    setMaterials((current) => [...current, newMaterialRow()]);
    resetDerivedState();
  };

  const reset = () => {
    setWeight("");
    setMaterials([newMaterialRow()]);
    setTransportMode("");
    setTransportDistance("");
    setEmissions(null);
    setCalculationError(null);
  };

  const calculateEmissions = () => {
    if (!canCalculate || !transportMode) return;
    try {
      setEmissions(calculateProxyEmissions({
        category: "textile",
        weightKg: weightValue,
        materials: parsedMaterialShares,
        transportMode,
        transportDistanceKm: distanceValue
      }));
      setCalculationError(null);
    } catch {
      setEmissions(null);
      setCalculationError(t("invalidInputs"));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16 pb-16 md:pt-20">
        <div className="container mx-auto px-4 md:px-6">
          <Link
            href="/"
            className="mb-5 inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground md:mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">{t("backToHome")}</span>
          </Link>

          <div className={`mx-auto grid gap-5 ${emissions ? "max-w-5xl lg:grid-cols-2 lg:gap-8" : "max-w-2xl"}`}>
            <Card className="border-border/50 shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Calculator className="h-5 w-5 text-primary" />
                  </div>
                  {t("title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="weight">{t("productWeight")}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="weight"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder={t("weightPlaceholder")}
                      value={weight}
                      onChange={(event) => {
                        setWeight(event.target.value);
                        resetDerivedState();
                      }}
                      className="bg-background"
                    />
                    <span className="shrink-0 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm font-medium text-muted-foreground">
                      {t("weightUnit")}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label>{t("materialComposition")}</Label>
                    <span className={`text-sm font-semibold ${materialMixValid ? "text-emerald-700" : "text-amber-700"}`}>
                      {t("materialTotal", { percentage: materialTotal.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) })}
                    </span>
                  </div>

                  {materials.map((row, index) => (
                    <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_92px_40px] gap-2">
                      <Select
                        value={row.materialId}
                        onValueChange={(value) => updateMaterial(row.id, { materialId: value })}
                      >
                        <SelectTrigger className="bg-background" aria-label={t("materialRow", { number: index + 1 })}>
                          <SelectValue placeholder={t("selectMaterial")} />
                        </SelectTrigger>
                        <SelectContent>
                          {MATERIALS.map((material) => (
                            <SelectItem
                              key={material.id}
                              value={material.id}
                              disabled={selectedMaterialIds.has(material.id) && row.materialId !== material.id}
                            >
                              {material.displayNameVi} ({getCarbonFactor(material.id)?.value ?? material.co2Factor} kg CO₂e/kg)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0.01"
                          max="100"
                          step="0.01"
                          value={row.percentage}
                          onChange={(event) => updateMaterial(row.id, { percentage: event.target.value })}
                          placeholder="0"
                          aria-label={t("materialPercentage", { number: index + 1 })}
                          className="bg-background pr-7"
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={materials.length === 1}
                        onClick={() => removeMaterial(row.id)}
                        aria-label={t("removeMaterial", { number: index + 1 })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <div className="space-y-2">
                    <Progress value={Math.min(100, materialTotal)} className="h-2" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className={`text-xs ${materialMixValid ? "text-emerald-700" : "text-muted-foreground"}`}>
                        {materialMixValid ? t("materialComplete") : t("materialIncomplete")}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addMaterial}
                        disabled={materials.length >= MATERIALS.length}
                      >
                        <Plus className="mr-1.5 h-4 w-4" />
                        {t("addMaterial")}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("transportMode")}</Label>
                    <Select
                      value={transportMode}
                      onValueChange={(value) => {
                        setTransportMode(value as ProxyTransportMode);
                        resetDerivedState();
                      }}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder={t("selectTransportMode")} />
                      </SelectTrigger>
                      <SelectContent>
                        {TRANSPORT_MODES.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>
                            {t(mode.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transport-distance">{t("transportDistance")}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="transport-distance"
                        type="number"
                        min="1"
                        step="1"
                        value={transportDistance}
                        onChange={(event) => {
                          setTransportDistance(event.target.value);
                          resetDerivedState();
                        }}
                        placeholder={t("distancePlaceholder")}
                        className="bg-background"
                      />
                      <span className="shrink-0 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm font-medium text-muted-foreground">km</span>
                    </div>
                  </div>
                </div>

                {transportMode && (
                  <p className="text-xs text-muted-foreground">
                    {t("transportFactor", {
                      factor: getProxyTransportFactor(transportMode)?.value.toLocaleString("vi-VN", { maximumFractionDigits: 5 }) ?? "—"
                    })}
                  </p>
                )}

                {calculationError && <p className="text-sm text-destructive">{calculationError}</p>}

                <Button
                  variant="hero"
                  className="w-full"
                  onClick={calculateEmissions}
                  disabled={!canCalculate}
                >
                  {t("calculate")}
                </Button>

                <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{t("improvedDescription")}</span>
                </div>
              </CardContent>
            </Card>

            {emissions && (
              <Card className="border-border/50 shadow-soft transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                      <Leaf className="h-5 w-5 text-primary" />
                    </div>
                    {t("result")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="rounded-2xl bg-gradient-forest p-6 text-center text-primary-foreground">
                      <p className="mb-2 text-sm font-medium opacity-80">{t("result")}</p>
                      <p className="mb-1 text-5xl font-display font-bold">{emissions.total.toFixed(2)}</p>
                      <p className="text-sm opacity-80">{t("kgCO2e")}</p>
                      <p className="mt-2 text-xs opacity-70">
                        {t("carEquivalent", { km: Math.round(emissions.total / 0.21).toLocaleString("vi-VN") })}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold text-foreground">{t("breakdown")}</h4>
                      {BREAKDOWN_META.map(({ key, icon: Icon, labelKey }) => (
                        <div key={key} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <Icon className="h-4 w-4" />
                              {t(labelKey)}
                            </span>
                            <span className="font-medium text-foreground">
                              {emissions[key].toFixed(2)} {t("kgCO2e")}
                            </span>
                          </div>
                          <Progress value={getPercentage(emissions[key], emissions.total)} className="h-2" />
                        </div>
                      ))}
                    </div>

                    <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                      {t("calculationSummary", {
                        materialFactor: (emissions.material / weightValue).toLocaleString("vi-VN", { maximumFractionDigits: 4 }),
                        manufacturingFactor: getProxyManufacturingFactor("textile").toLocaleString("vi-VN", { maximumFractionDigits: 4 }),
                        packagingFactor: getProxyPackagingFactor().toLocaleString("vi-VN", { maximumFractionDigits: 4 })
                      })}
                    </div>

                    <Button variant="outline" className="w-full" onClick={reset}>
                      {t("recalculate")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
