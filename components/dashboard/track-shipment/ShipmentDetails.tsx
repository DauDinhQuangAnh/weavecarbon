"use client";

import React, { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
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
  Package,
  Calendar,
  Clock,
  Anchor,
  Ship,
  Plane,
  Truck,
  CheckCircle2,
  XCircle } from
"lucide-react";
import type { TrackShipment } from "./types";
import TransportMap from "@/components/ui/TransportMap";
import { useAppRoutes } from "@/lib/demo/routes";
import { updateLogisticsShipmentStatus } from "@/lib/logisticsApi";
import { isApiError } from "@/lib/apiClient";
import { toast } from "sonner";

interface ShipmentDetailsProps {
  shipment: TrackShipment | null;
  onRefresh?: () => void;
}

const STATUS_PALETTE = {
  in_transit: {
    badge: "border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50",
    header: "bg-sky-50/50 border-sky-100",
    location: "bg-sky-50/50 border-sky-200",
    locationDot: "bg-sky-500",
    locationText: "text-sky-700"
  },
  delivered: {
    badge: "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
    header: "bg-emerald-50/50 border-emerald-100",
    location: "bg-emerald-50/50 border-emerald-200",
    locationDot: "bg-emerald-500",
    locationText: "text-emerald-700"
  },
  pending: {
    badge: "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50",
    header: "bg-amber-50/50 border-amber-100",
    location: "bg-amber-50/50 border-amber-200",
    locationDot: "bg-amber-500",
    locationText: "text-amber-700"
  },
  cancelled: {
    badge: "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50",
    header: "bg-rose-50/50 border-rose-100",
    location: "bg-rose-50/50 border-rose-200",
    locationDot: "bg-rose-500",
    locationText: "text-rose-700"
  },
  unknown: {
    badge: "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50",
    header: "bg-slate-50/50 border-slate-100",
    location: "bg-slate-50/50 border-slate-200",
    locationDot: "bg-slate-500",
    locationText: "text-slate-700"
  }
} as const;

const ISO_DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const parseShipmentDate = (value: string | null | undefined) => {
  if (!value) return null;
  if (ISO_DATE_ONLY_REGEX.test(value)) {
    const [year, month, day] = value.split("-").map((part) => Number(part));
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatShipmentDate = (value: string | null | undefined, locale: string) => {
  const parsed = parseShipmentDate(value);
  if (!parsed) return "--";
  return parsed.toLocaleDateString(locale);
};

const formatShipmentDateTime = (value: string | null | undefined, locale: string) => {
  const parsed = parseShipmentDate(value);
  if (!parsed) return "--";

  const options =
  ISO_DATE_ONLY_REGEX.test(value || "") ?
  { year: "numeric", month: "short", day: "2-digit" } as const :
  {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  } as const;

  return parsed.toLocaleString(locale, options);
};

const ShipmentDetails: React.FC<ShipmentDetailsProps> = ({
  shipment,
  onRefresh
}) => {
  const t = useTranslations("trackShipment");
  const locale = useLocale();
  const displayLocale = locale === "vi" ? "vi-VN" : "en-US";
  const router = useRouter();
  const appRoutes = useAppRoutes();
  const [isCancelling, setIsCancelling] = useState(false);
  const formatDistanceKm = (value: number) =>
  value.toLocaleString(displayLocale, { maximumFractionDigits: 3 });
  const formatExactValue = (value: number) =>
  value.toLocaleString(displayLocale, { maximumFractionDigits: 3 });
  const mapSubject = shipment?.id || shipment?.productName || "";
  const mapSubjectMeta = shipment ?
  [
  shipment.productName && shipment.productName !== shipment.id ? shipment.productName : null,
  shipment.sku ? `${t("skuLabel")}: ${shipment.sku}` : null].
  filter((value): value is string => Boolean(value)).
  join(" | ") :
  undefined;
  const statusPalette =
  shipment && shipment.status in STATUS_PALETTE ?
  STATUS_PALETTE[shipment.status as keyof typeof STATUS_PALETTE] :
  STATUS_PALETTE.unknown;
  const canCancel =
  Boolean(
    shipment &&
    shipment.shipmentId &&
    shipment.simulationEnabled &&
    shipment.status === "pending" &&
    !appRoutes.isDemo
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return (
          <Badge className={STATUS_PALETTE.delivered.badge}>
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {t("statuses.delivered")}
          </Badge>);

      case "in_transit":
        return (
          <Badge className={STATUS_PALETTE.in_transit.badge}>
            <Truck className="w-3 h-3 mr-1" />
            {t("statuses.inTransit")}
          </Badge>);

      case "pending":
        return (
          <Badge className={STATUS_PALETTE.pending.badge}>
            <Clock className="w-3 h-3 mr-1" />
            {t("statuses.pending")}
          </Badge>);

      case "cancelled":
        return (
          <Badge className={STATUS_PALETTE.cancelled.badge}>
            <XCircle className="w-3 h-3 mr-1" />
            {t("statuses.cancelled")}
          </Badge>);

      default:
        return <Badge className={STATUS_PALETTE.unknown.badge}>{t("statuses.unknown")}</Badge>;
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case "ship":
        return Ship;
      case "air":
        return Plane;
      default:
        return Truck;
    }
  };

  const getModeLabel = (mode: string) =>
  t.has(`transportModes.${mode}`) ?
  t(`transportModes.${mode}`) :
  mode;

  const handleCancelShipment = async () => {
    if (!shipment?.shipmentId || !canCancel || isCancelling) return;

    const confirmed = window.confirm(t("confirmCancel"));
    if (!confirmed) return;

    try {
      setIsCancelling(true);
      await updateLogisticsShipmentStatus(shipment.shipmentId, "cancelled");
      toast.success(t("cancelSuccess"));
      onRefresh?.();
    } catch (error) {
      if (isApiError(error) && error.message) {
        toast.error(error.message);
      } else {
        toast.error(t("cancelFailed"));
      }
    } finally {
      setIsCancelling(false);
    }
  };

  if (!shipment) {
    return (
      <div className="xl:col-span-2">
        <Card className="h-96 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4" />
            <p>{t("selectShipment")}</p>
          </div>
        </Card>
      </div>);

  }

  return (
    <div className="space-y-6 xl:col-span-2">
      
      <TransportMap
        legs={shipment.legs}
        onRefresh={onRefresh}
        mapSubject={mapSubject}
        mapSubjectMeta={mapSubjectMeta} />


      
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className={`border-b ${statusPalette.header}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 shrink-0" />
                <span className="truncate">{shipment.productName}</span>
              </CardTitle>
              <CardDescription className="break-words text-slate-600">
                {shipment.id} | {t("containerLabel")}: {shipment.containerNo}
              </CardDescription>
            </div>
            <div className="self-start sm:self-auto">
              {getStatusBadge(shipment.status)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          
          <div className={`rounded-lg border p-4 ${statusPalette.location}`}>
            <div className="mb-2 flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full animate-pulse ${statusPalette.locationDot}`} />
              <span className="font-medium">{t("currentLocation")}</span>
            </div>
            <p className={`break-words text-lg font-semibold ${statusPalette.locationText}`}>
              {shipment.currentLocation}
            </p>
          </div>

          
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-left md:text-center">
              <div className="flex items-start gap-3 md:flex-col md:items-center md:gap-1">
                <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{t("departureDate")}</p>
                  <p className="font-medium text-slate-800">
                    {formatShipmentDate(shipment.departureDate, displayLocale)}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-left md:text-center">
              <div className="flex items-start gap-3 md:flex-col md:items-center md:gap-1">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{t("estimatedArrival")}</p>
                  <p className="font-medium text-slate-800">
                    {formatShipmentDateTime(shipment.estimatedArrival, displayLocale)}
                  </p>
                </div>
              </div>
            </div>
            <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-left md:col-span-1 md:text-center">
              <div className="flex items-start gap-3 md:flex-col md:items-center md:gap-1">
                <Anchor className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{t("carrier")}</p>
                  <p className="break-words text-sm font-medium text-slate-800 md:truncate">
                    {shipment.carrier}
                  </p>
                </div>
              </div>
            </div>
            <div className="col-span-2 rounded-lg border border-orange-200 bg-orange-50/70 p-3 text-left md:col-span-1 md:text-center">
              <div className="flex items-start gap-3 md:flex-col md:items-center md:gap-1">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center text-xs font-bold text-orange-500">
                  CO2
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{t("emissions")}</p>
                  <p className="font-medium text-orange-600">
                    {formatExactValue(shipment.totalCO2)} {t("units.kg")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          
          <div>
            <h4 className="font-medium mb-4">{t("timeline")}</h4>
            <div className="space-y-4">
              {shipment.legs.map((leg, index) => {
                const Icon = getModeIcon(leg.mode);
                const isComplete =
                shipment.progress >=
                (index + 1) / shipment.legs.length * 100;
                const isActive =
                shipment.progress > index / shipment.legs.length * 100 &&
                shipment.progress <
                (index + 1) / shipment.legs.length * 100;

                return (
                  <div
                    key={leg.id}
                    className="flex gap-4 rounded-lg border border-slate-200 bg-slate-50/40 p-3">

                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isComplete ?
                        "bg-emerald-100 text-emerald-600" :
                        isActive ?
                        "bg-sky-500 text-white animate-pulse" :
                        "bg-slate-100 text-slate-500"}`
                        }>

                        <Icon className="w-5 h-5" />
                      </div>
                      {index < shipment.legs.length - 1 &&
                      <div
                        className={`w-0.5 flex-1 my-2 ${
                        isComplete ? "bg-emerald-300" : "bg-slate-200"}`
                        } />

                      }
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium text-slate-800">
                          {t("legNumber")} {leg.legNumber}:{" "}
                          {getModeLabel(leg.mode)}
                        </h5>
                        <Badge
                          className={
                          leg.type === "international" ?
                          "border border-sky-200 bg-sky-50 text-sky-700 text-xs" :
                          "border border-slate-200 bg-slate-50 text-slate-700 text-xs"
                          }>

                          {t("legNumber")} {leg.legNumber ?? index + 1}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {leg.origin.name} {"->"} {leg.destination.name}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                        <span>{formatDistanceKm(leg.distanceKm)} {t("units.km")}</span>
                        <span className="text-orange-600">
                          {formatExactValue(leg.co2Kg)} {t("units.kgCo2")}
                        </span>
                      </div>
                    </div>
                  </div>);

              })}
            </div>
          </div>

          
          <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:gap-3">
            {canCancel &&
            <Button
              variant="destructive"
              className="w-full sm:flex-1"
              onClick={() => {
                void handleCancelShipment();
              }}
              disabled={isCancelling}>
                {isCancelling ? t("cancelling") : t("cancelShipment")}
              </Button>
            }
            <Button
              variant="outline"
              className="w-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50 sm:flex-1"
              onClick={() => {
                if (appRoutes.isDemo) {
                  if (shipment.productId) {
                    router.push(appRoutes.toSummaryPath(shipment.productId));
                    return;
                  }
                  router.push(appRoutes.toAppPath("/logistics"));
                  return;
                }

                const params = new URLSearchParams();

                if (shipment.shipmentId) {
                  params.set("shipmentId", shipment.shipmentId);
                }
                if (shipment.productId) {
                  params.set("productId", shipment.productId);
                }
                if (shipment.productName) {
                  params.set("productName", shipment.productName);
                }
                if (shipment.sku) {
                  params.set("productCode", shipment.sku);
                }

                router.push(
                  params.toString().length > 0 ? `/transport?${params.toString()}` : "/transport"
                );
              }}>

              {t("viewLogistics")}
            </Button>
            <Button
              className="w-full !bg-emerald-600 !text-white hover:!bg-emerald-700 sm:flex-1"
              onClick={() => {
                if (appRoutes.isDemo) {
                  if (shipment.productId) {
                    router.push(appRoutes.toSummaryPath(shipment.productId));
                    return;
                  }
                  router.push(appRoutes.toAppPath("/products"));
                  return;
                }

                if (shipment.productId) {
                  router.push(
                    `/calculation-history?productId=${encodeURIComponent(shipment.productId)}`
                  );
                  return;
                }
                router.push("/calculation-history");
              }}>
              
              {t("viewCarbonHistory")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>);

};

export default ShipmentDetails;
