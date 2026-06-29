"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { configureMapboxRuntime, hasMapboxPublicToken } from "@/lib/mapbox";
interface ShipmentMiniMapProps {
  currentLocation: {lat: number;lng: number;name: string;};
  height?: string;
  status?: "in_transit" | "delivered" | "pending" | "cancelled";
}

const ShipmentMiniMap: React.FC<ShipmentMiniMapProps> = ({
  currentLocation,
  height = "150px",
  status = "in_transit"
}) => {
  const t = useTranslations("logistics.shipmentMiniMap");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getMarkerColor = () => {
      switch (status) {
        case "delivered":
          return "#22c55e";
        case "pending":
          return "#eab308";
        case "cancelled":
          return "#ef4444";
        default:
          return "#3b82f6";
      }
    };

    const getStatusEmoji = () => {
      switch (status) {
        case "delivered":
          return "D";
        case "pending":
          return "P";
        default:
          return "T";
      }
    };

    let isMounted = true;
    let mapLoaded = false;

    const loadTimeout = setTimeout(() => {
      if (isMounted && !mapLoaded) {
        setError(t("errors.mapFailed"));
        setIsLoading(false);
      }
    }, 10000);

    const initMap = async () => {
      if (!mapContainerRef.current) return;

      try {
        if (!hasMapboxPublicToken()) {
          clearTimeout(loadTimeout);
          setError(t("errors.invalidToken"));
          setIsLoading(false);
          return;
        }

        const mapboxModule = await import("mapbox-gl");
        if (!isMounted) return;

        const mapboxRuntime = mapboxModule.default;
        configureMapboxRuntime(mapboxRuntime);

        const map = new mapboxRuntime.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox/satellite-streets-v12",
          center: [currentLocation.lng, currentLocation.lat],
          zoom: 5,
          pitch: 45,
          interactive: false,
          attributionControl: false
        });

        mapRef.current = map;

        map.on("load", () => {
          clearTimeout(loadTimeout);
          mapLoaded = true;
          if (!isMounted) return;

          const markerEl = document.createElement("div");
          markerEl.innerHTML = `
            <div style="
              position: relative;
              width: 40px;
              height: 40px;
            ">
              <div style="
                position: absolute;
                width: 40px;
                height: 40px;
                background: ${getMarkerColor()};
                border-radius: 50%;
                animation: pulse 2s infinite;
                opacity: 0.4;
              "></div>
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: ${getMarkerColor()};
                border: 3px solid white;
                border-radius: 50%;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
              ">
                ${getStatusEmoji()}
              </div>
            </div>
          `;

          const style = document.createElement("style");
          style.textContent = `
            @keyframes pulse {
              0% { transform: scale(1); opacity: 0.4; }
              50% { transform: scale(1.5); opacity: 0.1; }
              100% { transform: scale(1); opacity: 0.4; }
            }
          `;
          document.head.appendChild(style);

          const marker = new mapboxRuntime.Marker({ element: markerEl }).
          setLngLat([currentLocation.lng, currentLocation.lat]).
          addTo(map);

          markerRef.current = marker;
          setIsLoading(false);
        });

        map.on("error", () => {
          clearTimeout(loadTimeout);
          if (isMounted) {
            setError(t("errors.mapFailed"));
            setIsLoading(false);
          }
        });
      } catch {
        clearTimeout(loadTimeout);
        if (isMounted) {
          setError(t("errors.loadFailed"));
          setIsLoading(false);
        }
      }
    };

    initMap();

    return () => {
      clearTimeout(loadTimeout);
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [currentLocation.lat, currentLocation.lng, status, t]);

  if (error) {
    return (
      <div
        className="rounded-lg bg-muted flex items-center justify-center"
        style={{ height }}>

        <p className="text-xs text-muted-foreground">{error}</p>
      </div>);

  }

  return (
    <div className="relative rounded-lg overflow-hidden" style={{ height }}>
      {isLoading &&
      <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
        </div>
      }
      <div ref={mapContainerRef} className="w-full h-full" />

      <div className="absolute left-2 right-2 top-2 bg-background/85 backdrop-blur rounded px-2 py-1 shadow-sm">
        <p className="text-xs text-center truncate font-medium">
          {currentLocation.name}
        </p>
      </div>
    </div>);

};

export default ShipmentMiniMap;

