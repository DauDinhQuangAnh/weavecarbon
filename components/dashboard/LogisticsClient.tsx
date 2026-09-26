"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
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
import { fetchProductById, type ProductRecord } from "@/lib/productsApi";
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
  ArrowRight,
} from "lucide-react";
import SupplyChainMap, {
  type SupplyChainNode,
  type SupplyChainRoute,
} from "./logistic/SupplyChainMap";
import { getShipmentColor } from "@/lib/shipmentColors";
import { useResolvedRoadRouteGeometry } from "@/hooks/useResolvedRoadRouteGeometry";

const ProductQRCode = dynamic(() => import("./ProductQRCode"), { ssr: false });

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
        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium text-xs shadow-none">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Đã giao
        </Badge>
      );
    case "in_transit":
      return (
        <Badge className="bg-sky-50 text-sky-700 border border-sky-200 font-medium text-xs shadow-none">
          <Ship className="mr-1 h-3 w-3" />
          Đang vận chuyển
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-amber-50 text-amber-700 border border-amber-200 font-medium text-xs shadow-none">
          <Clock className="mr-1 h-3 w-3" />
          Chờ xử lý
        </Badge>
      );
    case "cancelled":
      return (
        <Badge className="bg-rose-50 text-rose-700 border border-rose-200 font-medium text-xs shadow-none">
          <AlertTriangle className="mr-1 h-3 w-3" />
          Đã hủy
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getTransportBadge(mode: LogisticsTransportMode) {
  const icon = getTransportIcon(mode);
  const label = getModeLabel(mode);
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
      {icon}
      {label}
    </span>
  );
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
  // A shipment QR must resolve to a real product passport, not the shipment id
  // (the passport/summary pages look products up by id). We resolve a representative
  // product of the shipment and hand its full record to ProductQRCode so the link
  // works in the real app AND embeds a demo snapshot for cross-device demo scans.
  const [qrData, setQrData] = useState<{
    shipment: LogisticsShipmentSummary;
    product: ProductRecord;
    productId: string;
  } | null>(null);
  const [qrLoadingId, setQrLoadingId] = useState<string | null>(null);

  const handleOpenShipmentQr = useCallback(
    async (shipment: LogisticsShipmentSummary) => {
      setQrLoadingId(shipment.id);
      try {
        const detail = await fetchLogisticsShipmentById(shipment.id);
        const representative = detail.products?.find((item) => item.productId);
        if (!representative?.productId) {
          toast.error("Lô hàng chưa có sản phẩm nên chưa tạo được mã QR.");
          return;
        }
        const product = await fetchProductById(representative.productId);
        setQrData({ shipment, product, productId: representative.productId });
      } catch {
        toast.error("Không tạo được mã QR cho lô hàng này.");
      } finally {
        setQrLoadingId(null);
      }
    },
    []
  );

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
        // Shipment summaries don't carry per-leg transport mode. Same-country
        // legs are drawn as road (and resolved to a real driving route
        // below); cross-border legs fall back to the sea pathfinding graph,
        // which itself falls back to a straight line when no path resolves.
        mode:
          s.origin.country && s.origin.country === s.destination.country
            ? ("truck" as const)
            : ("ship" as const),
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

  const { geometryById: resolvedRoadGeometryById } = useResolvedRoadRouteGeometry(
    mapRoutes,
    {
      getDestination: (route) => ({ lat: route.to.lat, lng: route.to.lng }),
      getId: (route) => route.id,
      getOrigin: (route) => ({ lat: route.from.lat, lng: route.from.lng }),
      isRoadRoute: (route) => route.mode === "truck",
      maxRoutesToResolve: 8
    }
  );

  const renderableMapRoutes = useMemo<SupplyChainRoute[]>(
    () =>
      mapRoutes.map((route) => ({
        ...route,
        geometry: resolvedRoadGeometryById[route.id] || route.geometry
      })),
    [mapRoutes, resolvedRoadGeometryById]
  );

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-slate-600 font-medium">
            {overview
              ? `${overview.totalShipments} lô hàng · ${overview.inTransit} đang vận chuyển · ${overview.delivered} đã giao`
              : "Đang tải dữ liệu logistics…"}
          </p>
          {overview && (
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
              CO₂e Scope 3: {overview.totalCo2e.toFixed(0)} kg
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadData(true)}
          disabled={refreshing}
          className="h-8.5 gap-1.5 rounded-lg border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 shrink-0 self-start sm:self-auto"
        > 
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
          ) : (
            <RefreshCw className="h-4 w-4 text-slate-500" />
          )}
          <span>{refreshing ? "Đang đồng bộ…" : "Cập nhật"}</span>
        </Button>
      </div>

      {/* ── Stats Cards ── */}
      {overview && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 sm:gap-3">
          {[
            {
              label: "Tổng lô",
              value: overview.totalShipments,
              icon: <Package className="h-4 w-4 text-slate-700" />,
              iconBg: "bg-slate-100",
              onClick: () => {},
            },
            {
              label: "Chờ xử lý",
              value: overview.pending,
              icon: <Clock className="h-4 w-4 text-amber-600" />,
              iconBg: "bg-amber-50",
              onClick: () => setActiveTab("active"),
            },
            {
              label: "Đang giao",
              value: overview.inTransit,
              icon: <Ship className="h-4 w-4 text-sky-600" />,
              iconBg: "bg-sky-50",
              onClick: () => setActiveTab("active"),
            },
            {
              label: "Đã giao",
              value: overview.delivered,
              icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
              iconBg: "bg-emerald-50",
              onClick: () => setActiveTab("history"),
            },
            {
              label: "Đã hủy",
              value: overview.cancelled,
              icon: <AlertTriangle className="h-4 w-4 text-rose-500" />,
              iconBg: "bg-rose-50",
              onClick: () => setActiveTab("history"),
            },
            {
              label: "kg CO₂e Scope 3",
              value: overview.totalCo2e.toFixed(0),
              icon: <Activity className="h-4 w-4 text-emerald-700" />,
              iconBg: "bg-emerald-100/70",
              valueColor: "text-emerald-700",
              onClick: () => {},
            },
          ].map((stat) => (
            <Card
              key={stat.label}
              onClick={stat.onClick}
              className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.iconBg} shrink-0`}>
                  {stat.icon}
                </div>
                <div className="min-w-0">
                  <p className={`text-lg font-bold leading-tight ${stat.valueColor || "text-slate-900"}`}>
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    {stat.label}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Search + Filters Bar ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs sm:p-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Tìm theo mã lô / thành phố / quốc gia…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9.5 rounded-lg border-slate-200 bg-slate-50/60 pl-9.5 pr-9 text-sm text-slate-900 placeholder:text-slate-400 shadow-none transition-colors hover:bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select value={marketFilter} onValueChange={setMarketFilter}>
              <SelectTrigger className="h-9.5 rounded-lg border-slate-200 bg-white text-xs font-medium text-slate-700 w-full sm:w-[140px]">
                <SelectValue placeholder="Thị trường" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả thị trường</SelectItem>
                <SelectItem value="us">Hoa Kỳ (US)</SelectItem>
                <SelectItem value="eu">Châu Âu (EU)</SelectItem>
                <SelectItem value="jp">Nhật Bản (JP)</SelectItem>
                <SelectItem value="kr">Hàn Quốc (KR)</SelectItem>
                <SelectItem value="viet">Việt Nam (VN)</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={modeFilter}
              onValueChange={(v) =>
                setModeFilter(v as "all" | LogisticsTransportMode)
              }
            >
              <SelectTrigger className="h-9.5 rounded-lg border-slate-200 bg-white text-xs font-medium text-slate-700 w-full sm:w-[140px]">
                <SelectValue placeholder="Vận chuyển" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả phương thức</SelectItem>
                <SelectItem value="sea">Đường biển</SelectItem>
                <SelectItem value="air">Hàng không</SelectItem>
                <SelectItem value="road">Đường bộ</SelectItem>
                <SelectItem value="rail">Đường sắt</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "active" | "history")}
      >
        <div className="flex items-center justify-between gap-3">
          <TabsList className="h-10 rounded-xl bg-slate-100 p-1 border border-slate-200/80">
            <TabsTrigger
              value="history"
              className="gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:font-semibold data-[state=active]:shadow-xs sm:text-sm"
            >
              <History className="h-4 w-4" />
              Lịch sử
              <span className="rounded-full bg-slate-200/70 px-1.5 py-0.2 text-[10px] font-normal text-slate-700">
                {historyCount}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="active"
              className="gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:font-semibold data-[state=active]:shadow-xs sm:text-sm"
            >
              <Activity className="h-4 w-4" />
              Đang hoạt động
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-800">
                {activeCount}
              </span>
            </TabsTrigger>
          </TabsList>

          <span className="text-xs text-slate-500 hidden sm:inline font-medium">
            Hiển thị {filteredShipments.length} lô hàng
          </span>
        </div>

        <TabsContent value={activeTab} className="mt-4 space-y-4">
          {/* Shipment List */}
          {filteredShipments.length === 0 ? (
            <Card className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 shadow-none">
              <CardContent className="flex flex-col items-center justify-center p-8 sm:p-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mb-3">
                  <Package className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-slate-800">Không có lô hàng nào</h3>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  {searchQuery
                    ? "Không tìm thấy lô hàng phù hợp với điều kiện tìm kiếm hiện tại."
                    : "Chưa có lô hàng trong danh mục này."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredShipments.map((s) => {
                const isSelected = selectedShipment?.id === s.id;
                const primaryMode: LogisticsTransportMode =
                  s.origin.country && s.origin.country === s.destination.country
                    ? "road"
                    : "sea";

                return (
                  <Card
                    key={s.id}
                    className={`group relative flex flex-col justify-between rounded-xl border p-0 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer overflow-hidden ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/20 shadow-sm"
                        : "border-slate-200/90 bg-white hover:border-slate-300"
                    }`}
                    onClick={() =>
                      setSelectedShipment(
                        selectedShipment?.id === s.id ? null : s
                      )
                    }
                  >
                    <CardContent className="flex flex-1 flex-col p-4">
                      {/* Top Bar: Reference + Status */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-700 truncate max-w-[180px]">
                          {s.referenceNumber || s.id.slice(0, 12)}
                        </span>
                        {getStatusBadge(s.status)}
                      </div>

                      {/* Route Info: Origin -> Destination */}
                      <div className="flex items-start gap-3 flex-1 min-w-0 mb-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-600 transition-colors group-hover:border-emerald-100 group-hover:bg-emerald-50/60 group-hover:text-emerald-700">
                          {getTransportIcon(primaryMode)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                            <span className="truncate">{s.origin.city || s.origin.country}</span>
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="truncate">{s.destination.city || s.destination.country}</span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            {getTransportBadge(primaryMode)}
                            {s.totalDistanceKm > 0 && (
                              <span className="text-[11px] text-slate-500 font-medium">
                                · {s.totalDistanceKm.toLocaleString()} km
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Footer: CO2e Scope 3 + ETA & Actions */}
                      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
                        <div>
                          <p className="text-base font-bold leading-none text-emerald-700">
                            {s.totalCo2e.toFixed(1)} kg CO₂e
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500 font-medium">
                            {s.estimatedArrival
                              ? `ETA: ${new Date(s.estimatedArrival).toLocaleDateString("vi-VN")}`
                              : "CO₂e Scope 3"}
                          </p>
                        </div>

                        <div
                          className="flex shrink-0 items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                            disabled={qrLoadingId === s.id}
                            onClick={() => void handleOpenShipmentQr(s)}
                            title="Tạo mã QR tra cứu"
                            aria-label="Tạo mã QR tra cứu"
                          >
                            {qrLoadingId === s.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
                            ) : (
                              <QrCode className="h-4 w-4" />
                            )}
                          </Button>

                          {s.status !== "delivered" && s.status !== "cancelled" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 rounded-lg border-emerald-200 bg-emerald-50/60 px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900"
                              onClick={() => void handleConfirmDelivered(s.id)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="hidden sm:inline">Xác nhận</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Map */}
          {mapNodes.length > 0 && (
            <Card className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <CardHeader className="pb-2 bg-slate-50/50 border-b border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-sm md:text-base font-semibold text-slate-800">
                    <Globe className="h-4 w-4 text-emerald-600" />
                    Bản đồ vận chuyển
                  </CardTitle>
                  {filteredShipments.length > 1 && (
                    <Select
                      value={mapFocusId ?? "all"}
                      onValueChange={(value) =>
                        setMapFocusId(value === "all" ? null : value)
                      }
                    >
                      <SelectTrigger className="h-8 w-[220px] rounded-lg border-slate-200 bg-white text-xs">
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
                <div className="relative isolate w-full max-w-full overflow-hidden rounded-lg">
                  <SupplyChainMap
                    nodes={mapNodes}
                    routes={renderableMapRoutes}
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
        <DialogContent className="flex max-h-[90vh] min-h-[75vh] max-w-3xl flex-col overflow-y-auto rounded-2xl p-6">
          {selectedShipment && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-slate-900">
                      {selectedShipment.referenceNumber || selectedShipment.id}
                    </DialogTitle>
                    <p className="text-xs text-slate-500">
                      {selectedShipment.origin.city || selectedShipment.origin.country} → {selectedShipment.destination.city || selectedShipment.destination.country}
                    </p>
                  </div>
                </div>
                {getStatusBadge(selectedShipment.status)}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-2.5 text-sm sm:grid-cols-4 my-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-[11px] font-medium text-slate-500">Mã lô</p>
                  <p className="mt-1 font-mono text-xs font-semibold text-slate-800 truncate">
                    {selectedShipment.referenceNumber || "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-[11px] font-medium text-slate-500">Xuất xứ</p>
                  <p className="mt-1 text-xs font-semibold text-slate-800 truncate">
                    {selectedShipment.origin.city}, {selectedShipment.origin.country}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-[11px] font-medium text-slate-500">Đích đến</p>
                  <p className="mt-1 text-xs font-semibold text-slate-800 truncate">
                    {selectedShipment.destination.city}, {selectedShipment.destination.country}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-[11px] font-medium text-slate-500">Dự kiến đến (ETA)</p>
                  <p className="mt-1 text-xs font-semibold text-slate-800">
                    {selectedShipment.estimatedArrival
                      ? new Date(selectedShipment.estimatedArrival).toLocaleDateString("vi-VN")
                      : "—"}
                  </p>
                </div>
              </div>

              {detailLoading && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                  Đang tải chi tiết hành trình…
                </div>
              )}

              {selectedDetail && (
                <>
                  {/* Legs breakdown */}
                  {selectedDetail.legs.length > 0 && (
                    <div className="space-y-2.5">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Các chặng vận chuyển</p>
                      <div className="space-y-2">
                        {selectedDetail.legs.map((leg, idx) => {
                          const defra = getDefraFactor(leg.transportMode, leg.distanceKm);
                          return (
                            <div
                              key={leg.id}
                              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 transition-colors hover:bg-slate-50"
                            >
                              <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs font-semibold shrink-0 bg-white border-slate-200">
                                {idx + 1}
                              </Badge>
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200/80 text-slate-700 shrink-0">
                                {getTransportIcon(leg.transportMode)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-1 text-xs font-semibold text-slate-800 sm:text-sm">
                                  {leg.originLocation} → {leg.destinationLocation}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {leg.distanceKm.toLocaleString()} km · <span className="font-semibold text-emerald-700">{leg.co2e.toFixed(2)} kg CO₂e</span>
                                </p>
                              </div>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="shrink-0 cursor-help bg-emerald-50 text-[10px] text-emerald-700 border-emerald-200">
                                      DEFRA {DEFRA_VERSION}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-xs">
                                    <div className="space-y-1 text-xs">
                                      <p className="font-semibold text-slate-900">{defra.label}</p>
                                      <p className="font-mono text-emerald-700">{defra.factor} kg CO₂e / tonne-km</p>
                                      <p className="text-slate-500 text-[11px]">{defra.citation}</p>
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
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
                        <div>
                          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                            Bảng tính chi tiết DEFRA theo chặng
                            <Badge variant="outline" className="bg-emerald-50 text-[10px] text-emerald-700 border-emerald-200">
                              DEFRA {DEFRA_VERSION}
                            </Badge>
                          </p>
                          <p className="text-[11px] text-slate-500">Phân bổ tonne-km · minh bạch nguồn hệ số và công thức tính</p>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-100">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold">Chặng</th>
                              <th className="px-3 py-2 text-left font-semibold">Tuyến</th>
                              <th className="hidden px-3 py-2 text-left font-semibold md:table-cell">Phương thức</th>
                              <th className="px-3 py-2 text-left font-semibold">Hệ số</th>
                              <th className="px-3 py-2 text-right font-semibold">Cự ly (km)</th>
                              <th className="hidden px-3 py-2 text-right font-semibold md:table-cell">Tonne-KM</th>
                              <th className="hidden px-3 py-2 text-right font-semibold lg:table-cell">Hệ số (kg/t-km)</th>
                              <th className="px-3 py-2 text-right font-semibold">CO₂e (kg)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedDetail.legs.map((leg, idx) => {
                              const factorKey = pickDefraKey(leg.transportMode, leg.distanceKm);
                              const defra = getDefraFactor(leg.transportMode, leg.distanceKm);
                              const weightKg = selectedShipment.totalWeightKg || 500;
                              const tonneKm = (weightKg / 1000) * leg.distanceKm;
                              return (
                                <tr key={leg.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-3 py-2.5 font-mono text-slate-500">{idx + 1}</td>
                                  <td className="px-3 py-2.5 font-medium text-slate-800">
                                    <span className="line-clamp-1">
                                      {leg.originLocation} → {leg.destinationLocation}
                                    </span>
                                  </td>
                                  <td className="hidden px-3 py-2.5 md:table-cell text-slate-600">{getModeLabel(leg.transportMode)}</td>
                                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">{factorKey}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{leg.distanceKm.toLocaleString()}</td>
                                  <td className="hidden px-3 py-2.5 text-right tabular-nums text-slate-600 md:table-cell">{tonneKm.toFixed(2)}</td>
                                  <td className="hidden px-3 py-2.5 text-right tabular-nums text-slate-600 lg:table-cell">{defra.factor}</td>
                                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-emerald-700">{leg.co2e.toFixed(2)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-slate-200 bg-emerald-50/40">
                              <td colSpan={4} className="px-3 py-2.5 font-bold text-slate-800">Tổng cộng</td>
                              <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-800">
                                {selectedShipment.totalDistanceKm.toLocaleString()}
                              </td>
                              <td className="hidden px-3 py-2.5 md:table-cell" />
                              <td className="hidden px-3 py-2.5 lg:table-cell" />
                              <td className="px-3 py-2.5 text-right font-bold tabular-nums text-emerald-700 text-sm">
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
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Sản phẩm trong lô</p>
                      <div className="space-y-1.5">
                        {selectedDetail.products.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2 text-xs"
                          >
                            <span className="font-semibold text-slate-800">{p.productName || p.sku}</span>
                            <div className="flex items-center gap-3 text-slate-500">
                              <span>{p.quantity} sản phẩm</span>
                              <span className="font-semibold text-emerald-700">{p.allocatedCo2e.toFixed(2)} kg CO₂e</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </> 
              )}

              {/* Carbon Summary */}
              <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-emerald-50/40 to-teal-50/30 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-slate-700">Tổng CO₂e Scope 3 vận chuyển</p>
                      <Badge variant="outline" className="bg-emerald-100 text-[10px] text-emerald-800 border-emerald-200 font-semibold">
                        DEFRA {DEFRA_VERSION}
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold text-emerald-700 mt-1">
                      {selectedShipment.totalCo2e.toFixed(2)} kg CO₂e
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-500">Tổng cự ly hành trình</p>
                    <p className="text-xl font-bold text-slate-900 mt-1">
                      {selectedShipment.totalDistanceKm.toLocaleString()} km
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-500 border-t border-emerald-200/60 pt-2">
                  Hệ số phát thải theo hướng dẫn DEFRA {DEFRA_VERSION} · UK Government GHG Conversion Factors for Company Reporting
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* QR Modal */}
      {qrData && (
        <ProductQRCode
          productId={qrData.productId}
          product={qrData.product}
          productName={
            qrData.product.productName ||
            `Lô ${qrData.shipment.referenceNumber || qrData.shipment.id}`
          }
          productCode={
            qrData.product.productCode ||
            qrData.shipment.referenceNumber ||
            qrData.shipment.id
          }
          shipmentId={qrData.shipment.id}
          open={true}
          onClose={() => setQrData(null)}
        />
      )}
    </div>
  );
};

export default LogisticsClient;
