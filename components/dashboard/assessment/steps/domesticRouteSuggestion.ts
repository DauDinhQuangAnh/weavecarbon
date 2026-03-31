import type { FetchRoadRouteOptions } from "@/lib/roadRouting";
import type { AddressInput } from "./types";
import {
  buildIntermodalFallbackRoute,
  resolveIntermodalPlan,
  type SuggestedRoadLegFailure,
  type SuggestedRoute,
  type SuggestedRouteResolution
} from "./intermodalPlanner";

export type {
  SuggestedRoadLegFailure,
  SuggestedRoute,
  SuggestedRouteResolution
};

export interface DomesticRouteContext {
  destination: AddressInput;
  origin: AddressInput;
}

export const buildDomesticFallbackRoute = (context: DomesticRouteContext): SuggestedRoute =>
  buildIntermodalFallbackRoute({
    destination: context.destination,
    destinationMarket: "vietnam",
    origin: context.origin
  });

export const resolveDomesticSuggestedRoute = async (
  context: DomesticRouteContext,
  options: FetchRoadRouteOptions = {}
): Promise<SuggestedRouteResolution> =>
  resolveIntermodalPlan(
    {
      destination: context.destination,
      destinationMarket: "vietnam",
      origin: context.origin
    },
    options
  );
