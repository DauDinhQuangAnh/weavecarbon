"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useDashboardTitle } from "@/contexts/DashboardContext";
import {
  fetchAllLogisticsShipments,
  fetchLogisticsOverview,
  fetchLogisticsShipmentById,
  updateLogisticsShipmentStatus,
  type LogisticsShipmentSummary,
  type LogisticsShipmentDetail,
  type LogisticsOverview,
  type LogisticsTransportMode,
} from "@/lib/logisticsApi";
import { DEFRA_VERSION } from "@/config/penalties";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Ship,
  Plane,
  Truck,
  Train,
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  History,
  Activity,
  X,
  Globe,
  Loader2,
  QrCode,
} from "lucide-react";
import SupplyChainMap, {
  type SupplyChainNode,
  type SupplyChainRoute,
} from "./logistic/SupplyChainMap";
import { getShipmentColor } from "@/lib/shipmentColors";
import MobileDataCard from "@/components/mobile/MobileDataCard";
import ProductQRCode from "./ProductQRCode";

/* ─── DEFRA 2024 factors (kg CO₂e per tonne-km) ──────────────────────── */
const DEFRA_FACTORS: Record<
  string,
  { factor: number; label: string; citation: string }
> = {
  air_freight_short: {
    factor: 1.852,
    label: "Air freight <1500km",
    citation: `DEFRA ${DEFRA_VERSION} · UK Gov GHG Conversion Factors`,
  },
  air_freight_long: {
    factor: 0.602,
    label: "Air freight >1500km",
    citation: `DEFRA ${DEFRA_VERSION} · UK Gov GHG Conversion Factors`,
  },
  sea_container_large: {
    factor: 0.013,
    label: "Sea container >8000km",
    citation: `DEFRA ${DEFRA_VERSION}`,
  },
  sea_container_medium: {
    factor: 0.0159,
    label: "Sea container 2000-8000km",
    citation: `DEFRA ${DEFRA_VERSION}`,
  },
  sea_general_cargo: {
    factor: 0.0239,
    label: "Sea general cargo",
    citation: `DEFRA ${DEFRA_VERSION}`,
  },
  rail_freight: {
    factor: 0.028,
    label: "Rail freight",
    citation: `DEFRA ${DEFRA_VERSION}`,
  },
  van_diesel: {
    factor: 0.3031,
    label: "Van diesel",
    citation: `DEFRA ${DEFRA_VERSION}`,
  },
  truck_15t: {
    factor: 0.1249,
    label: "Truck 15t",
    citation: `DEFRA ${DEFRA_VERSION}`,
  },
  truck_40t_articulated: {
    factor: 0.0799,
    label: "Truck 40t articulated",
    citation: `DEFRA ${DEFRA_VERSION}`,
  },
};

function pickDefraKey(mode: LogisticsTransportMode, distanceKm: number): string {
  switch (mode) {
    case "air":
      return distanceKm < 1500 ? "air_freight_short" : "air_freight_long";
    case "sea":
      if (distanceKm > 8000) return "sea_container_large";
      if (distanceKm > 2000) return "sea_container_medium";
      return "sea_general_cargo";
    case "rail":
      return "rail_freight";
    default:
      if (distanceKm < 50) return "van_diesel";
      if (distanceKm < 300) return "truck_15t";
      return "truck_40t_articulated";
  }
}

function getDefraFactor(mode: LogisticsTransportMode, distanceKm: number) {
  const key = pickDefraKey(mode, distanceKm);
  return {
    key,
    ...(DEFRA_FACTORS[key] ?? {
      factor: 0.05,
      label: `${mode} (fallback)`,
      citation: `DEFRA ${DEFRA_VERSION}`,
    }),
  };
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function getStatusBadge(status: LogisticsShipmentSummary["status"]) {
  switch (status) {
    case "delivered":
      return (
        <Badge className="bg-green-100 text-green-700 border-0">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Đã giao
        </Badge>
      );
    case "in_transit":
      return (
        <Badge className="bg-blue-100 text-blue-700 border-0">
          <Ship className="mr-1 h-3 w-3" />
          Đang vận chuyển
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-yellow-100 text-yellow-700 border-0">
          <Clock className="mr-1 h-3 w-3" />
          Chờ xử lý
        </Badge>
      );
    case "cancelled":
      return (
        <Badge className="bg-red-100 text-red-700 border-0">
          <AlertTriangle className="mr-1 h-3 w-3" />
          Đã hủy
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getTransportIcon(mode: LogisticsTransportMode) {
  switch (mode) {
    case "sea":
      return <Ship className="h-4 w-4" />;
    case "air":
      return <Plane className="h-4 w-4" />;
    case "rail":
      return <Train className="h-4 w-4" />;
    default:
      return <Truck className="h-4 w-4" />;
  }
}

function getModeLabel(mode: LogisticsTransportMode): string {
  const map: Record<LogisticsTransportMode, string> = {
    sea: "Đường biển",
    air: "Hàng không",
    road: "Đường bộ",
    rail: "Đường sắt",
  };
  return map[mode] ?? mode;
}

/* ─── Component ────────────────────────────────────────────────────────── */
// Hoisted so the map receives a stable reference; an inline array literal
// would change identity on every render.
const MAP_CENTER: [number, number] = [20, 100];

const LogisticsClient: React.FC = () => {
  const t = useTranslations("logistics");
  const { setPageTitle } = useDashboardTitle();

  const [overview, setOverview] = useState<LogisticsOverview | null>(null);
  const [shipments, setShipments] = useState<LogisticsShipmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [marketFilter, setMarketFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState<"all" | LogisticsTransportMode>(
    "all"
  );
  const [activeTab, setActiveTab] = useState<"active" | "history">("history");

  const [selectedShipment, setSelectedShipment] =
    useState<LogisticsShipmentSummary | null>(null);
  const [selectedDetail, setSelectedDetail] =
    useState<LogisticsShipmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [qrShipment, setQrShipment] =
    useState<LogisticsShipmentSummary | null>(null);

  useEffect(() => {
    setPageTitle(t("title"), t("subtitle"));
  }, [setPageTitle, t]);

  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    try {
      const [ov, list] = await Promise.all([
        fetchLogisticsOverview(),
        fetchAllLogisticsShipments(),
      ]);
      setOverview(ov);
      setShipments(list);
    } catch {
      toast.error("Không thể tải dữ liệu logistics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /* Load detail when shipment selected */
  useEffect(() => {
    if (!selectedShipment) {
      setSelectedDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    fetchLogisticsShipmentById(selectedShipment.id)
      .then((d) => {
        if (!cancelled) setSelectedDetail(d);
      })
      .catch(() => {
        if (!cancelled) toast.error("Không tải được chi tiết lô hàng.");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedShipment]);

  /* Filtered list */
  const filteredShipments = useMemo(() => {
    const activeStatuses: LogisticsShipmentSummary["status"][] = [
      "pending",
      "in_transit",
    ];
    const historyStatuses: LogisticsShipmentSummary["status"][] = [
      "delivered",
      "cancelled",
    ];

    return shipments.filter((s) => {
      if (activeTab === "active" && !activeStatuses.includes(s.status))
        return false;
      if (activeTab === "history" && !historyStatuses.includes(s.status))
        return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          s.referenceNumber.toLowerCase().includes(q) ||
          s.origin.city?.toLowerCase().includes(q) ||
          s.destination.city?.toLowerCase().includes(q) ||
          s.origin.country?.toLowerCase().includes(q) ||
          s.destination.country?.toLowerCase().includes(q);
        if (!match) return false;
      }

      if (
        marketFilter !== "all" &&
        !s.destination.country?.toLowerCase().includes(marketFilter)
      )
        return false;

      return true;
    });
  }, [shipments, activeTab, searchQuery, marketFilter]);

  /* Map data */
  // Lets the user narrow the map to a single shipment's route instead of
  // always rendering every filtered shipment's route at once.
  const [mapFocusId, setMapFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (mapFocusId && !filteredShipments.some((s) => s.id === mapFocusId)) {
      setMapFocusId(null);
    }
  }, [mapFocusId, filteredShipments]);

  const mapSourceShipments = useMemo(
    () =>
      mapFocusId
        ? filteredShipments.filter((s) => s.id === mapFocusId)
        : filteredShipments,
    [mapFocusId, filteredShipments]
  );

  const mapNodes = useMemo<SupplyChainNode[]>(() => {
    const seen = new Set<string>();
    return mapSourceShipments.flatMap((s) => {
      const nodes: SupplyChainNode[] = [];
      if (s.origin.lat && s.origin.lng) {
        const key = `${s.origin.lat?.toFixed(1)},${s.origin.lng?.toFixed(1)}`;
        if (!seen.has(key)) {
          seen.add(key);
          nodes.push({
            id: `${s.id}-origin`,
            name: s.origin.city || s.origin.country,
            lat: s.origin.lat,
            lng: s.origin.lng,
            type: "factory",
            country: s.origin.country,
            status: "active",
          });
        }
      }
      if (s.destination.lat && s.destination.lng) {
        const key = `${s.destination.lat?.toFixed(1)},${s.destination.lng?.toFixed(1)}`;
        if (!seen.has(key)) {
          seen.add(key);
          nodes.push({
            id: `${s.id}-dest`,
            name: s.destination.city || s.destination.country,
            lat: s.destination.lat,
            lng: s.destination.lng,
            type: "destination",
            country: s.destination.country,
            status:
              s.status === "delivered"
                ? "completed"
                : s.status === "pending"
                ? "pending"
                : "active",
          });
        }
      }
      return nodes;
    });
  }, [mapSourceShipments]);

  const mapRoutes = useMemo<SupplyChainRoute[]>(() => {
    return mapSourceShipments
      .filter(
        (s) =>
          s.origin.lat && s.origin.lng && s.destination.lat && s.destination.lng
      )
      .map((s) => ({
        id: s.id,
        from: {
          lat: s.origin.lat!,
          lng: s.origin.lng!,
          name: s.origin.city || s.origin.country,
        },
        to: {
          lat: s.destination.lat!,
          lng: s.destination.lng!,
          name: s.destination.city || s.destination.country,
        },
        // Shipment summaries don't carry per-leg transport mode, so this
        // overview map always draws a direct line rather than guessing a
        // mode and routing it through the sea/rail pathfinding graphs.
        mode: "truck" as const,
        status:
          s.status === "delivered"
            ? ("completed" as const)
            : s.status === "in_transit"
            ? ("in_transit" as const)
            : ("pending" as const),
        co2Kg: s.totalCo2e,
        distanceKm: s.totalDistanceKm,
        color: getShipmentColor(s.id),
      }));
  }, [mapSourceShipments]);

  const handleMapNodeClick = useCallback(
    (node: SupplyChainNode) => {
      const hit = filteredShipments.find(
        (s) => s.origin.city === node.name || s.destination.city === node.name
      );
      if (hit) {
        setSelectedShipment((current) => (current?.id === hit.id ? null : hit));
      }
    },
    [filteredShipments]
  );

  const activeCount = shipments.filter(
    (s) => s.status === "pending" || s.status === "in_transit"
  ).length;
  const historyCount = shipments.filter(
    (s) => s.status === "delivered" || s.status === "cancelled"
  ).length;

  const handleConfirmDelivered = async (id: string) => {
    try {
      await updateLogisticsShipmentStatus(id, "delivered");
      toast.success("Đã xác nhận giao hàng.");
      void loadData(true);
    } catch {
      toast.error("Không thể cập nhật trạng thái.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            {overview
              ? `${overview.totalShipments} lô hàng · ${overview.inTransit} đang vận chuyển · ${overview.delivered} đã giao · CO₂e Scope 3: ${overview.totalCo2e.toFixed(0)} kg`
              : "Đang tải…"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadData(true)}
          disabled={refreshing}
          className="shrink-0"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 md:mr-2" />
          )}
          <span className="hidden md:inline">Cập nhật</span>
        </Button>
      </div>

      {/* ── Stats Cards ── */}
      {overview && (
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6 md:gap-4">
          {[
            {
              label: "Tổng lô",
              value: overview.totalShipments,
              color: "text-slate-900",
            },
            {
              label: "Chờ xử lý",
              value: overview.pending,
              color: "text-yellow-600",
            },
            {
              label: "Đang giao",
              value: overview.inTransit,
              color: "text-blue-600",
            },
            {
              label: "Đã giao",
              value: overview.delivered,
              color: "text-green-600",
            },
            {
              label: "Đã hủy",
              value: overview.cancelled,
              color: "text-red-500",
            },
            {
              label: "kg CO₂e S3",
              value: overview.totalCo2e.toFixed(0),
              color: "text-orange-600",
            },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-2 text-center md:pt-4">
                <p className={`text-lg font-bold md:text-2xl ${stat.color}`}>
                  {stat.value}
                </p>
                <p className="text-[10px] text-muted-foreground md:text-xs">
                  {stat.label}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Search + Filters ── */}
      <div className="flex gap-2 md:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Mã lô / thành phố / quốc gia…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Select
          value={marketFilter}
          onValueChange={setMarketFilter}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Thị trường" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="us">Hoa Kỳ</SelectItem>
            <SelectItem value="eu">Châu Âu</SelectItem>
            <SelectItem value="jp">Nhật Bản</SelectItem>
            <SelectItem value="kr">Hàn Quốc</SelectItem>
            <SelectItem value="viet">Việt Nam</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={modeFilter}
          onValueChange={(v) =>
            setModeFilter(v as "all" | LogisticsTransportMode)
          }
        >
          <SelectTrigger className="w-[130px] hidden md:flex">
            <SelectValue placeholder="Vận chuyển" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="sea">Đường biển</SelectItem>
            <SelectItem value="air">Hàng không</SelectItem>
            <SelectItem value="road">Đường bộ</SelectItem>
            <SelectItem value="rail">Đường sắt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Tabs ── */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "active" | "history")}
      >
        <TabsList className="grid w-full max-w-[320px] grid-cols-2">
          <TabsTrigger value="history" className="gap-1.5 text-xs md:text-sm">
            <History className="h-4 w-4" />
            Lịch sử ({historyCount})
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-1.5 text-xs md:text-sm">
            <Activity className="h-4 w-4" />
            Đang hoạt động ({activeCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-4">
          {/* Shipment List */}
          {filteredShipments.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Package className="mx-auto mb-4 h-12 w-12 opacity-40" />
                <p>Không có lô hàng nào</p>
                {searchQuery && (
                  <p className="text-sm">Thử tìm kiếm khác</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredShipments.map((s) => (
                <MobileDataCard
                  key={s.id}
                  title={s.referenceNumber || s.id.slice(0, 12)}
                  subtitle={`${s.origin.city || s.origin.country} → ${s.destination.city || s.destination.country}`}
                  icon={<Package className="h-5 w-5 text-primary" />}
                  status={{
                    label:
                      s.status === "delivered"
                        ? "Đã giao"
                        : s.status === "in_transit"
                        ? "Đang giao"
                        : s.status === "cancelled"
                        ? "Đã hủy"
                        : "Chờ xử lý",
                    className:
                      s.status === "delivered"
                        ? "bg-green-100 text-green-700"
                        : s.status === "in_transit"
                        ? "bg-blue-100 text-blue-700"
                        : s.status === "cancelled"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700",
                  }}
                  metrics={[
                    {
                      value: s.totalCo2e.toFixed(1),
                      unit: "kg CO₂e",
                      className: "text-primary",
                    },
                    {
                      label: "ETA",
                      value: s.estimatedArrival
                        ? new Date(s.estimatedArrival).toLocaleDateString(
                            "vi-VN"
                          )
                        : "—",
                    },
                  ]}
                  onClick={() =>
                    setSelectedShipment(
                      selectedShipment?.id === s.id ? null : s
                    )
                  }
                  className={
                    selectedShipment?.id === s.id
                      ? "ring-2 ring-primary"
                      : undefined
                  }
                  actions={
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQrShipment(s);
                        }}
                      >
                        <QrCode className="h-4 w-4 text-green-600" />
                      </Button>
                      {s.status !== "delivered" && s.status !== "cancelled" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleConfirmDelivered(s.id);
                          }}
                        >
                          <CheckCircle2 className="mr-1 h-4 w-4" />
                          Xác nhận
                        </Button>
                      )}
                    </div>
                  }
                />
              ))}
            </div>
          )}

          {/* Map */}
          {mapNodes.length > 0 && (
            <Card className="relative z-0 overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                    <Globe className="h-4 w-4 text-primary" />
                    Bản đồ vận chuyển
                  </CardTitle>
                  {filteredShipments.length > 1 && (
                    <Select
                      value={mapFocusId ?? "all"}
                      onValueChange={(value) =>
                        setMapFocusId(value === "all" ? null : value)
                      }
                    >
                      <SelectTrigger className="h-8 w-[220px] text-xs">
                        <SelectValue placeholder="Tất cả lô hàng" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          Tất cả lô hàng ({filteredShipments.length})
                        </SelectItem>
                        {filteredShipments.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.referenceNumber || s.id}: {s.origin.city} →{" "}
                            {s.destination.city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardHeader>
              <CardContent className="relative overflow-hidden p-2 md:p-4">
                <div className="relative isolate w-full max-w-full overflow-hidden">
                  <SupplyChainMap
                    nodes={mapNodes}
                    routes={mapRoutes}
                    center={MAP_CENTER}
                    zoom={2}
                    height="360px"
                    onNodeClick={handleMapNodeClick}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Shipment Detail Modal ── */}
      <Dialog open={!!selectedShipment} onOpenChange={(open) => { if (!open) setSelectedShipment(null); }}>
        <DialogContent className="flex max-h-[90vh] min-h-[80vh] max-w-3xl flex-col overflow-y-auto">
          {selectedShipment && (
            <>
              {/* Header */}
              <DialogTitle className="flex items-center gap-2 pb-2">
                <Package className="h-5 w-5 text-primary" />
                <span className="truncate font-semibold text-base">
                  {selectedShipment.referenceNumber || selectedShipment.id}
                </span>
                {getStatusBadge(selectedShipment.status)}
              </DialogTitle>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Mã lô</p>
                  <p className="font-mono text-xs font-medium md:text-sm">
                    {selectedShipment.referenceNumber || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Xuất xứ</p>
                  <p className="text-xs font-medium md:text-sm">
                    {selectedShipment.origin.city},{" "}
                    {selectedShipment.origin.country}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Đích đến</p>
                  <p className="text-xs font-medium md:text-sm">
                    {selectedShipment.destination.city},{" "}
                    {selectedShipment.destination.country}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ETA</p>
                  <p className="text-xs font-medium md:text-sm">
                    {selectedShipment.estimatedArrival
                      ? new Date(selectedShipment.estimatedArrival).toLocaleDateString("vi-VN")
                      : "—"}
                  </p>
                </div>
              </div>

              {detailLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang tải chi tiết…
                </div>
              )}

              {selectedDetail && (
                <>
                  {/* Legs breakdown */}
                  {selectedDetail.legs.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Các chặng vận chuyển</p>
                      <div className="space-y-2">
                        {selectedDetail.legs.map((leg, idx) => {
                          const defra = getDefraFactor(leg.transportMode, leg.distanceKm);
                          return (
                            <div
                              key={leg.id}
                              className="flex items-center gap-2 rounded-lg bg-muted/50 p-2 md:p-3"
                            >
                              <Badge variant="outline" className="shrink-0">{idx + 1}</Badge>
                              {getTransportIcon(leg.transportMode)}
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-1 text-xs font-medium md:text-sm">
                                  {leg.originLocation} → {leg.destinationLocation}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {leg.distanceKm.toLocaleString()} km · {leg.co2e.toFixed(2)} kg CO₂e
                                </p>
                              </div>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="shrink-0 cursor-help bg-emerald-50 text-[10px] text-emerald-700">
                                      DEFRA {DEFRA_VERSION}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-xs">
                                    <div className="space-y-1 text-xs">
                                      <p className="font-semibold">{defra.label}</p>
                                      <p className="font-mono">{defra.factor} kg CO₂e / tonne-km</p>
                                      <p className="text-muted-foreground">{defra.citation}</p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* DEFRA Breakdown Table */}
                  {selectedDetail.legs.length > 0 && (
                    <div className="rounded-lg border bg-card">
                      <div className="flex items-center justify-between border-b px-3 py-2 md:px-4 md:py-3">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-semibold">
                            Bảng DEFRA per-leg
                            <Badge variant="outline" className="bg-emerald-50 text-[10px] text-emerald-700">
                              DEFRA {DEFRA_VERSION}
                            </Badge>
                          </p>
                          <p className="text-[11px] text-muted-foreground">Phân bổ tonne-km · audit-ready</p>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40 text-muted-foreground">
                            <tr>
                              <th className="px-2 py-2 text-left font-medium">Chặng</th>
                              <th className="px-2 py-2 text-left font-medium">Tuyến</th>
                              <th className="hidden px-2 py-2 text-left font-medium md:table-cell">Mode</th>
                              <th className="px-2 py-2 text-left font-medium">Factor key</th>
                              <th className="px-2 py-2 text-right font-medium">Cự ly (km)</th>
                              <th className="hidden px-2 py-2 text-right font-medium md:table-cell">Tonne-KM</th>
                              <th className="hidden px-2 py-2 text-right font-medium lg:table-cell">Factor</th>
                              <th className="px-2 py-2 text-right font-medium">CO₂e (kg)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedDetail.legs.map((leg, idx) => {
                              const factorKey = pickDefraKey(leg.transportMode, leg.distanceKm);
                              const defra = getDefraFactor(leg.transportMode, leg.distanceKm);
                              const weightKg = selectedShipment.totalWeightKg || 500;
                              const tonneKm = (weightKg / 1000) * leg.distanceKm;
                              return (
                                <tr key={leg.id} className="border-t">
                                  <td className="px-2 py-2 font-mono">{idx + 1}</td>
                                  <td className="px-2 py-2">
                                    <span className="line-clamp-1">
                                      {leg.originLocation} → {leg.destinationLocation}
                                    </span>
                                  </td>
                                  <td className="hidden px-2 py-2 md:table-cell">{getModeLabel(leg.transportMode)}</td>
                                  <td className="px-2 py-2 font-mono text-[11px]">{factorKey}</td>
                                  <td className="px-2 py-2 text-right tabular-nums">{leg.distanceKm.toLocaleString()}</td>
                                  <td className="hidden px-2 py-2 text-right tabular-nums md:table-cell">{tonneKm.toFixed(2)}</td>
                                  <td className="hidden px-2 py-2 text-right tabular-nums lg:table-cell">{defra.factor}</td>
                                  <td className="px-2 py-2 text-right font-semibold tabular-nums text-primary">{leg.co2e.toFixed(2)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t bg-primary/5">
                              <td colSpan={4} className="px-2 py-2 font-semibold">Tổng cộng</td>
                              <td className="px-2 py-2 text-right font-semibold tabular-nums">
                                {selectedShipment.totalDistanceKm.toLocaleString()}
                              </td>
                              <td className="hidden px-2 py-2 md:table-cell" />
                              <td className="hidden px-2 py-2 lg:table-cell" />
                              <td className="px-2 py-2 text-right font-bold tabular-nums text-primary">
                                {selectedShipment.totalCo2e.toFixed(2)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Products in shipment */}
                  {selectedDetail.products.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Sản phẩm trong lô</p>
                      <div className="space-y-1">
                        {selectedDetail.products.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between rounded bg-muted/30 px-3 py-2 text-xs"
                          >
                            <span className="font-medium">{p.productName || p.sku}</span>
                            <div className="flex items-center gap-3 text-muted-foreground">
                              <span>{p.quantity} sp</span>
                              <span>{p.allocatedCo2e.toFixed(2)} kg CO₂e</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Carbon Summary */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 md:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground md:text-sm">Tổng CO₂e Scope 3 vận chuyển</p>
                      <Badge variant="outline" className="bg-emerald-50 text-[10px] text-emerald-700">
                        DEFRA {DEFRA_VERSION}
                      </Badge>
                    </div>
                    <p className="text-xl font-bold text-primary md:text-2xl">
                      {selectedShipment.totalCo2e.toFixed(2)} kg CO₂e
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground md:text-sm">Tổng cự ly</p>
                    <p className="text-lg font-semibold md:text-xl">
                      {selectedShipment.totalDistanceKm.toLocaleString()} km
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Hệ số phát thải DEFRA {DEFRA_VERSION} · UK Government GHG Conversion Factors for Company Reporting
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* QR Modal */}
      {qrShipment && (
        <ProductQRCode
          productId={qrShipment.id}
          productName={`Lô ${qrShipment.referenceNumber || qrShipment.id}`}
          productCode={qrShipment.referenceNumber || qrShipment.id}
          open={true}
          onClose={() => setQrShipment(null)}
        />
      )}
    </div>
  );
};

export default LogisticsClient;
