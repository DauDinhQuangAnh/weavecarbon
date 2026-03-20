"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Search, MapPin, CheckCircle2, Truck, Clock, XCircle } from "lucide-react";
import type { TrackShipment } from "./types";

interface ShipmentListProps {
  shipments: TrackShipment[];
  selectedShipment: TrackShipment | null;
  onSelectShipment: (shipment: TrackShipment) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (filter: string) => void;
}

const ShipmentList: React.FC<ShipmentListProps> = ({
  shipments,
  selectedShipment,
  onSelectShipment,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange
}) => {
  const t = useTranslations("trackShipment");
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {t("statuses.delivered")}
          </Badge>);

      case "in_transit":
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            <Truck className="w-3 h-3 mr-1" />
            {t("statuses.inTransit")}
          </Badge>);

      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
            <Clock className="w-3 h-3 mr-1" />
            {t("statuses.pending")}
          </Badge>);

      case "cancelled":
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
            <XCircle className="w-3 h-3 mr-1" />
            {t("statuses.cancelled")}
          </Badge>);

      default:
        return <Badge variant="secondary">{t("statuses.unknown")}</Badge>;
    }
  };

  return (
    <div className="space-y-4 xl:col-span-1">
      
      <Card>
        <CardContent className="space-y-3 p-3.5 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10" />
            
          </div>
          <div className="mobile-scroll-row flex gap-2 whitespace-nowrap pb-1">
            {[
            { value: "all", label: t("filterAll") },
            { value: "in_transit", label: t("filterInTransit") },
            { value: "pending", label: t("filterPending") },
            { value: "delivered", label: t("filterDelivered") },
            { value: "cancelled", label: t("filterCancelled") }].
            map((filter) =>
            <Button
              key={filter.value}
              variant={statusFilter === filter.value ? "default" : "outline"}
              size="sm"
              className="h-9"
              onClick={() => onStatusFilterChange(filter.value)}>
              
                {filter.label}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      
      <div className="space-y-3 xl:max-h-150 xl:overflow-y-auto xl:pr-2">
        {shipments.map((shipment) =>
        <Card
          key={shipment.id}
          className={`cursor-pointer transition-all hover:shadow-md ${
          selectedShipment?.id === shipment.id ?
          "ring-2 ring-primary border-primary" :
          ""}`
          }
          onClick={() => onSelectShipment(shipment)}>
          
            <CardContent className="p-3.5 sm:p-4">
              <div className="mb-2.5 flex items-start justify-between gap-2 sm:mb-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-muted-foreground sm:text-sm">
                    {shipment.id}
                  </p>
                  <h3 className="truncate text-sm font-medium sm:text-base">{shipment.productName}</h3>
                </div>
                <div className="shrink-0">{getStatusBadge(shipment.status)}</div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground sm:gap-2">
                  <MapPin className="w-3 h-3 text-green-600" />
                  <span className="truncate">{shipment.origin}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground sm:gap-2">
                  <MapPin className="w-3 h-3 text-red-600" />
                  <span className="truncate">{shipment.destination}</span>
                </div>
              </div>

              {shipment.status !== "pending" &&
            <div className="mt-2.5 sm:mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">
                      {t("progress")}
                    </span>
                    <span className="font-medium">{shipment.progress}%</span>
                  </div>
                  <Progress value={shipment.progress} className="h-2" />
                </div>
            }

            </CardContent>
          </Card>
        )}
      </div>
    </div>);

};

export default ShipmentList;
