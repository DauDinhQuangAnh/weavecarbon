import type { FetchRoadRouteOptions } from "@/lib/roadRouting";
import {
  buildIntermodalFallbackRoute,
  resolveIntermodalPlan,
  type SuggestedRoute,
  type SuggestedRouteResolution
} from "./intermodalPlanner";
import { getRouteHubById } from "./routeHubs";
import type { AddressInput, TransportLeg } from "./types";

export interface ExportRouteContext {
  cargoWeightKg?: number;
  destination: AddressInput;
  destinationMarket: string;
  origin: AddressInput;
}

export const buildExportFallbackRoute = (context: ExportRouteContext): SuggestedRoute =>
  buildIntermodalFallbackRoute({
    cargoWeightKg: context.cargoWeightKg,
    destination: context.destination,
    destinationMarket: context.destinationMarket,
    origin: context.origin
  });

export const resolveExportSuggestedRoute = async (
  context: ExportRouteContext,
  options: FetchRoadRouteOptions = {}
): Promise<SuggestedRouteResolution> =>
  resolveIntermodalPlan(
    {
      cargoWeightKg: context.cargoWeightKg,
      destination: context.destination,
      destinationMarket: context.destinationMarket,
      origin: context.origin
    },
    options
  );

export const getRouteHubByNodeRef = (
  nodeRef: TransportLeg["fromNode"] | TransportLeg["toNode"] | undefined
) => {
  if (nodeRef?.type !== "hub" || !nodeRef.hubId) {
    return null;
  }

  return getRouteHubById(nodeRef.hubId);
};
