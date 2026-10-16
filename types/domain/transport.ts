/**
 * Domain types for Logistics & Transport
 * Pure domain interfaces decoupled from UI components.
 */

export interface TransportLegNodeRef {
  type: "origin_address" | "destination_address" | "hub";
  hubId?: string;
}

export interface TransportLeg {
  id: string;
  mode: "road" | "sea" | "air" | "rail";
  estimatedDistance?: number;
  emissionFactor?: number;
  co2Kg?: number;
  co2PerTonKg?: number;
  allocatedCo2Kg?: number;
  routeResolved?: boolean;
  fromNode?: TransportLegNodeRef;
  toNode?: TransportLegNodeRef;
  autoSuggested?: boolean;
  geometry?: Array<[number, number]>;
  distanceSource?: "road_route" | "air_gc" | "sea_graph" | "rail_graph" | "manual";
  distanceStatus?: "resolved" | "pending" | "estimated" | "manual";
  segmentKind?: "feeder" | "line_haul" | "transfer";
}

export type { RouteHub, ExportCorridor, RouteHubKind, RouteMarketScope, ExportLineHaulMode } from "@/lib/geo/routeHubs";
