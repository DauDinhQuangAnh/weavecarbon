import React, { lazy, Suspense } from "react";
import { useTranslations } from "next-intl";

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
  mode: "ship" | "air" | "rail" | "truck";
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
    </div>
  );
};

const LazyMapContent = lazy(() => import("./SupplyChainMapContent"));

const SupplyChainMap: React.FC<SupplyChainMapProps> = (props) => {
  const { height = "500px", ...mapProps } = props;

  return (
    <Suspense fallback={<LoadingPlaceholder height={height} />}>
      <LazyMapContent {...mapProps} height={height} />
    </Suspense>
  );
};

export default SupplyChainMap;
