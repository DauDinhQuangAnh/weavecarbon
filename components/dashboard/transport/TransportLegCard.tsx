"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle } from
"@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import { Ship, Plane, Truck, Trash2, MapPin, Info } from "lucide-react";
import AddressSelection from "@/components/ui/AddressSelection";
import { LegInput, AddressData } from "./TransportClient";

const EMISSION_FACTORS: Record<string, number> = {
  truck_light: 0.089,
  truck_heavy: 0.105,
  ship: 0.016,
  air: 0.602,
  rail: 0.028
};

interface TransportLegCardProps {
  leg: LegInput;
  index: number;
  canRemove: boolean;
  hasLocationPermission: boolean;
  onUpdate: (id: string, field: keyof LegInput, value: string | AddressData) => void;
  onRemove: (id: string) => void;
  roadRouteIssue?: string | null;
  calculateCO2: (leg: LegInput) => number;
  emissionUnitLabel: string;
  emissionFactorUnitLabel: string;
}

const TransportLegCard: React.FC<TransportLegCardProps> = ({
  leg,
  index,
  canRemove,
  hasLocationPermission,
  onUpdate,
  onRemove,
  roadRouteIssue,
  calculateCO2,
  emissionUnitLabel,
  emissionFactorUnitLabel
}) => {
  const t = useTranslations("transport");
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
    <Card className="border border-foreground/10 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/20">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {getModeIcon(leg.mode)}
            {t("legCardTitle")} {index + 1}
          </CardTitle>
          {canRemove &&
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(leg.id)}
            className="text-destructive">
            
              <Trash2 className="w-4 h-4" />
            </Button>
          }
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        
        <div>
          <Label>{t("transportMode")}</Label>
          <Select
            value={leg.mode}
            onValueChange={(v) => onUpdate(leg.id, "mode", v)}>

            <SelectTrigger className="mt-1 bg-background border border-foreground/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="truck_light">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  {t("truckLight")}
                </div>
              </SelectItem>
              <SelectItem value="truck_heavy">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  {t("truckHeavy")}
                </div>
              </SelectItem>
              <SelectItem value="ship">
                <div className="flex items-center gap-2">
                  <Ship className="w-4 h-4" />
                  {t("ship")}
                </div>
              </SelectItem>
              <SelectItem value="air">
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4" />
                  {t("air")}
                </div>
              </SelectItem>
              <SelectItem value="rail">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  {t("rail")}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        
        <div className="p-4 bg-muted/30 border border-border/60 rounded-lg space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <MapPin className="w-4 h-4 text-emerald-600" />
            {t("originLabel")}
          </div>
          <AddressSelection
            value={leg.origin}
            onChange={(address) => onUpdate(leg.id, "origin", address)}
            showCoordinates={true} />
          
        </div>

        
        <div className="p-4 bg-muted/30 border border-border/60 rounded-lg space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium mb-3">
            <MapPin className="w-4 h-4 text-destructive" />
            {t("destinationLabel")}
          </div>
          <AddressSelection
            value={leg.destination}
            onChange={(address) => onUpdate(leg.id, "destination", address)}
            showCoordinates={true} />
          
        </div>

        
        <div>
          <Label>{t("distance")}</Label>
          <Input
            type="number"
            placeholder={t("distancePlaceholder")}
            value={leg.distanceKm}
            onChange={(e) => onUpdate(leg.id, "distanceKm", e.target.value)}
            className="mt-1 bg-background border border-foreground/10" />

          {!hasLocationPermission &&
          <p className="text-xs text-muted-foreground mt-1">
              <Info className="w-3 h-3 inline mr-1" />
              {t("locationPermissionHint")}
            </p>
          }
          {roadRouteIssue ?
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Info className="mr-1 inline h-3 w-3" />
              {roadRouteIssue}
            </div> :
          null}
        </div>

        
        {parseFloat(leg.distanceKm) > 0 &&
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("legCO2")}</span>
              <span className="font-medium text-primary">
                {calculateCO2(leg).toFixed(2)} {emissionUnitLabel}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("emissionFactor")}: {EMISSION_FACTORS[leg.mode]} {emissionFactorUnitLabel}
            </p>
          </div>
        }
      </CardContent>
    </Card>);

};

export default TransportLegCard;
