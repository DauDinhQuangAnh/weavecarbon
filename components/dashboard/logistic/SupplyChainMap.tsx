import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Globe, Map } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fetchRoadRoute } from "@/lib/roadRouting";

export interface SupplyChainNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: "factory" | "warehouse" | "port" | "airport" | "destination";
  country: string;
  co2?: number;
  esg?: string;
  status?: "active" | "completed" | "pending";
}

export interface SupplyChainRoute {
  id: string;
  from: {lat: number;lng: number;name: string;};
  to: {lat: number;lng: number;name: string;};
  mode: "ship" | "air" | "truck";
  status: "completed" | "in_transit" | "pending";
  co2Kg?: number;
  distanceKm?: number;
  geometry?: Array<[number, number]>;
}

interface SupplyChainMapProps {
  nodes: SupplyChainNode[];
  routes: SupplyChainRoute[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  onNodeClick?: (node: SupplyChainNode) => void;
  onRouteClick?: (route: SupplyChainRoute) => void;
  defaultMapMode?: "2d" | "3d";
  showModeToggle?: boolean;
}

const LoadingPlaceholder: React.FC<{height: string;}> = ({ height }) => {
  const t = useTranslations("logistics.supplyChainMap");

  return (
    <div
      className="relative rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center"
      style={{ height }}>

      <div className="text-center text-muted-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
        <p className="text-sm">{t("loading")}</p>
      </div>
    </div>);

};

const LazyMapContent = lazy(() => import("./SupplyChainMapContent"));
const LazyMap3D = lazy(() => import("./SupplyChainMap3D"));

const SupplyChainMap: React.FC<SupplyChainMapProps> = (props) => {
  const t = useTranslations("logistics.supplyChainMap");
  const {
    height = "500px",
    defaultMapMode = "3d",
    showModeToggle = true,
    ...mapProps
  } = props;

  const [mapMode, setMapMode] = useState<"2d" | "3d">(defaultMapMode);
  const [resolvedRouteGeometry, setResolvedRouteGeometry] = useState<
    Record<string, Array<[number, number]>>
  >({});

  useEffect(() => {
    let isCancelled = false;

    const roadRoutes = mapProps.routes.filter((route) => route.mode === "truck");
    if (roadRoutes.length === 0) {
      setResolvedRouteGeometry({});
      return;
    }

    const resolveRoadRouteGeometry = async () => {
      const resolvedEntries = await Promise.all(
        roadRoutes.map(async (route) => {
          const resolvedRoute = await fetchRoadRoute(route.from, route.to);
          return [route.id, resolvedRoute?.geometry || null] as const;
        })
      );

      if (isCancelled) return;

      setResolvedRouteGeometry(
        resolvedEntries.reduce<Record<string, Array<[number, number]>>>(
          (accumulator, [routeId, geometry]) => {
            if (!geometry || geometry.length < 2) {
              return accumulator;
            }
            accumulator[routeId] = geometry;
            return accumulator;
          },
          {}
        )
      );
    };

    void resolveRoadRouteGeometry();

    return () => {
      isCancelled = true;
    };
  }, [mapProps.routes]);

  const resolvedRoutes = useMemo(
    () =>
      mapProps.routes.map((route) => ({
        ...route,
        geometry: resolvedRouteGeometry[route.id] || route.geometry
      })),
    [mapProps.routes, resolvedRouteGeometry]
  );

  return (
    <div className="space-y-3">
      {showModeToggle &&
      <div className="flex justify-end">
          <ToggleGroup
          type="single"
          value={mapMode}
          onValueChange={(value) => value && setMapMode(value as "2d" | "3d")}
          className="bg-muted p-1 rounded-lg">

            <ToggleGroupItem
            value="2d"
            aria-label={t("modes.twoDAria")}
            className="data-[state=on]:bg-background data-[state=on]:shadow-sm px-3">

              <Map className="w-4 h-4 mr-2" />
              {t("modes.twoD")}
            </ToggleGroupItem>
            <ToggleGroupItem
            value="3d"
            aria-label={t("modes.threeDAria")}
            className="data-[state=on]:bg-background data-[state=on]:shadow-sm px-3">

              <Globe className="w-4 h-4 mr-2" />
              {t("modes.threeD")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      }

      <Suspense fallback={<LoadingPlaceholder height={height} />}>
        {mapMode === "3d" ?
        <LazyMap3D {...mapProps} routes={resolvedRoutes} height={height} /> :

        <LazyMapContent {...mapProps} routes={resolvedRoutes} height={height} />
        }
      </Suspense>
    </div>);

};

export default SupplyChainMap;

