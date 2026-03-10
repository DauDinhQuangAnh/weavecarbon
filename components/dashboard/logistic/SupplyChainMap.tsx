import React, { lazy, Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { Globe, Map } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
        <LazyMap3D {...mapProps} height={height} /> :

        <LazyMapContent {...mapProps} height={height} />
        }
      </Suspense>
    </div>);

};

export default SupplyChainMap;

