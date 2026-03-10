"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle } from
"@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calculator,
  CheckCircle2,
  Loader2,
  Plane,
  Ship,
  Truck } from
"lucide-react";
import { LegInput } from "./TransportClient";

interface TransportResultsSidebarProps {
  legs: LegInput[];
  totalDistance: number;
  totalCO2: number;
  hasLocationPermission: boolean;
  calculateLegCO2: (leg: LegInput) => number;
  onSubmit: () => void;
  isLoading?: boolean;
}

const TransportResultsSidebar: React.FC<TransportResultsSidebarProps> = ({
  legs,
  totalDistance,
  totalCO2,
  hasLocationPermission,
  calculateLegCO2,
  onSubmit,
  isLoading = false
}) => {
  const t = useTranslations("transport");
  const locale = useLocale();
  const displayLocale = locale === "vi" ? "vi-VN" : "en-US";
  const getModeIcon = (mode: string) => {
    switch (mode) {
      case "ship":
        return <Ship className="w-4 h-4" />;
      case "air":
        return <Plane className="w-4 h-4" />;
      default:
        return <Truck className="w-4 h-4" />;
    }
  };

  return (
    <Card className="sticky top-6 border border-foreground/10 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/20">
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          {t("resultsTitle")}
        </CardTitle>
        <CardDescription>{t("resultsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("totalDistance")}</span>
            <span className="font-bold">
              {isLoading ?
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t("status.loadingShort")}
                </span> :

              `${totalDistance.toLocaleString(displayLocale)} km`
              }
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("totalLegs")}</span>
            <span className="font-medium">{isLoading ? "-" : legs.length}</span>
          </div>
        </div>

        <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">{t("estimatedCO2")}</span>
            <Badge variant="secondary">
              {hasLocationPermission ? t("highConfidence") : t("estimate")}
            </Badge>
          </div>
          <p className="text-3xl font-bold text-primary">
            {isLoading ? "..." : totalCO2.toFixed(2)}
            <span className="text-lg font-normal ml-1">{t("units.kgCO2e")}</span>
          </p>
        </div>

        {!isLoading && legs.length > 0 &&
        <div className="space-y-2">
            <p className="text-sm font-medium">{t("breakdown")}</p>
            {legs.map((leg, index) =>
          <div
            key={leg.id}
            className="flex items-center justify-between text-sm">

                <span className="flex items-center gap-2">
                  {getModeIcon(leg.mode)}
                  {t("legLabel")} {index + 1}
                </span>
                <span>{calculateLegCO2(leg).toFixed(2)} {t("units.kg")}</span>
              </div>
          )}
          </div>
        }

        <div className="pt-4 border-t">
          <Button
            className="w-full !bg-emerald-600 !text-white hover:!bg-emerald-700"
            size="lg"
            onClick={onSubmit}
            disabled={isLoading || totalDistance === 0}>

            <CheckCircle2 className="w-4 h-4 mr-2" />
            {t("saveAndView")}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {t("carbonNote")}
        </p>
      </CardContent>
    </Card>);

};

export default TransportResultsSidebar;
