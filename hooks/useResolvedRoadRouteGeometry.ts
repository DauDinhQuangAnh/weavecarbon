"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchRoadRoute,
  type RoadRouteFailureReason,
  type RoadRoutePointSource,
  type RoadRouteResult,
  type RouteCoordinate,
  type RoutePoint
} from "@/lib/roadRouting";

export type ResolvedRoadRouteStatus = "pending" | "resolved" | "failed";

type NumericMetricRecord = Record<string, number | undefined>;

type CacheEntry<TMetrics extends NumericMetricRecord> = {
  failureReason?: RoadRouteFailureReason;
  geometry?: RouteCoordinate[];
  metrics?: TMetrics;
  routeKey: string;
  status: ResolvedRoadRouteStatus;
};

type RoadRouteCandidate<TItem> = {
  destination: RoutePoint;
  destinationSource?: RoadRoutePointSource;
  existingGeometry: RouteCoordinate[] | null;
  id: string;
  item: TItem;
  origin: RoutePoint;
  originSource?: RoadRoutePointSource;
  routeKey: string;
};

type UseResolvedRoadRouteGeometryOptions<TItem, TMetrics extends NumericMetricRecord> = {
  getDestination: (item: TItem) => RoutePoint;
  getDestinationSource?: (item: TItem) => RoadRoutePointSource | undefined;
  getExistingGeometry?: (item: TItem) => RouteCoordinate[] | null | undefined;
  getId: (item: TItem) => string;
  getOrigin: (item: TItem) => RoutePoint;
  getOriginSource?: (item: TItem) => RoadRoutePointSource | undefined;
  getResolvedMetrics?: (item: TItem, route: RoadRouteResult) => TMetrics;
  isRoadRoute: (item: TItem) => boolean;
};

type UseResolvedRoadRouteGeometryResult<TMetrics extends NumericMetricRecord> = {
  failureById: Record<string, RoadRouteFailureReason>;
  geometryById: Record<string, RouteCoordinate[]>;
  metricsById: Record<string, TMetrics>;
  statusById: Record<string, ResolvedRoadRouteStatus>;
};

const hasValidGeometry = (geometry: RouteCoordinate[] | null | undefined): geometry is RouteCoordinate[] =>
  Array.isArray(geometry) && geometry.length >= 2;

const normalizeCoordinate = (value: number) => value.toFixed(6);

const buildRouteKey = (
  origin: RoutePoint,
  destination: RoutePoint,
  originSource?: RoadRoutePointSource,
  destinationSource?: RoadRoutePointSource
) =>
  [
    normalizeCoordinate(origin.lng),
    normalizeCoordinate(origin.lat),
    normalizeCoordinate(destination.lng),
    normalizeCoordinate(destination.lat),
    originSource || "",
    destinationSource || ""
  ].join(":");

const createEmptyState = <TMetrics extends NumericMetricRecord>(): UseResolvedRoadRouteGeometryResult<TMetrics> => ({
  failureById: {},
  geometryById: {},
  metricsById: {} as Record<string, TMetrics>,
  statusById: {}
});

export const useResolvedRoadRouteGeometry = <
  TItem,
  TMetrics extends NumericMetricRecord = NumericMetricRecord
>(
  items: TItem[],
  options: UseResolvedRoadRouteGeometryOptions<TItem, TMetrics>
): UseResolvedRoadRouteGeometryResult<TMetrics> => {
  const {
    getDestination,
    getDestinationSource,
    getExistingGeometry,
    getId,
    getOrigin,
    getOriginSource,
    getResolvedMetrics,
    isRoadRoute
  } = options;
  const [state, setState] = useState<UseResolvedRoadRouteGeometryResult<TMetrics>>(
    createEmptyState
  );
  const cacheRef = useRef<Record<string, CacheEntry<TMetrics>>>({});
  const latestRouteKeysRef = useRef<Record<string, string>>({});
  const optionsRef = useRef({
    getDestination,
    getDestinationSource,
    getExistingGeometry,
    getId,
    getOrigin,
    getOriginSource,
    getResolvedMetrics,
    isRoadRoute
  });
  optionsRef.current = {
    getDestination,
    getDestinationSource,
    getExistingGeometry,
    getId,
    getOrigin,
    getOriginSource,
    getResolvedMetrics,
    isRoadRoute
  };

  const candidates = useMemo(
    () => {
      const currentOptions = optionsRef.current;

      return items
        .filter((item) => currentOptions.isRoadRoute(item))
        .map((item) => {
          const origin = currentOptions.getOrigin(item);
          const destination = currentOptions.getDestination(item);
          const originSource = currentOptions.getOriginSource?.(item);
          const destinationSource = currentOptions.getDestinationSource?.(item);

          return {
            destination,
            destinationSource,
            existingGeometry:
              currentOptions.getExistingGeometry?.(item)?.filter((coordinate) =>
                Array.isArray(coordinate) && coordinate.length === 2
              ) ||
              null,
            id: currentOptions.getId(item),
            item,
            origin,
            originSource,
            routeKey: buildRouteKey(origin, destination, originSource, destinationSource)
          } satisfies RoadRouteCandidate<TItem>;
        });
    },
    [items]
  );

  useEffect(() => {
    if (candidates.length === 0) {
      latestRouteKeysRef.current = {};
      setState(createEmptyState());
      return;
    }

    let isCancelled = false;
    const nextGeometryById: Record<string, RouteCoordinate[]> = {};
    const nextFailureById: Record<string, RoadRouteFailureReason> = {};
    const nextMetricsById = {} as Record<string, TMetrics>;
    const nextStatusById: Record<string, ResolvedRoadRouteStatus> = {};
    const pendingCandidates: RoadRouteCandidate<TItem>[] = [];
    const nextRouteKeys: Record<string, string> = {};

    for (const candidate of candidates) {
      nextRouteKeys[candidate.id] = candidate.routeKey;

      if (hasValidGeometry(candidate.existingGeometry)) {
        nextGeometryById[candidate.id] = candidate.existingGeometry;
        nextStatusById[candidate.id] = "resolved";
        cacheRef.current[candidate.id] = {
          routeKey: candidate.routeKey,
          status: "resolved",
          geometry: candidate.existingGeometry
        };
        continue;
      }

      const cached = cacheRef.current[candidate.id];
      if (cached && cached.routeKey === candidate.routeKey) {
        nextStatusById[candidate.id] = cached.status;

        if (cached.status === "resolved" && hasValidGeometry(cached.geometry)) {
          nextGeometryById[candidate.id] = cached.geometry;
        }
        if (cached.failureReason) {
          nextFailureById[candidate.id] = cached.failureReason;
        }
        if (cached.metrics) {
          nextMetricsById[candidate.id] = cached.metrics;
        }
        continue;
      }

      nextStatusById[candidate.id] = "pending";
      pendingCandidates.push(candidate);
    }

    latestRouteKeysRef.current = nextRouteKeys;
    setState({
      failureById: nextFailureById,
      geometryById: nextGeometryById,
      metricsById: nextMetricsById,
      statusById: nextStatusById
    });

    if (pendingCandidates.length === 0) {
      return;
    }

    const resolvePendingRoutes = async () => {
      const resolvedEntries = await Promise.all(
        pendingCandidates.map(async (candidate) => {
          const resolution = await fetchRoadRoute(candidate.origin, candidate.destination, {
            destinationSource: candidate.destinationSource,
            originSource: candidate.originSource
          });
          if (!resolution.ok || !hasValidGeometry(resolution.route.geometry)) {
            return {
              failureReason: resolution.ok ? "invalid_geometry" : resolution.failureReason,
              id: candidate.id,
              routeKey: candidate.routeKey,
              status: "failed" as const
            };
          }

          return {
            id: candidate.id,
            routeKey: candidate.routeKey,
            status: "resolved" as const,
            geometry: resolution.route.geometry,
            metrics: optionsRef.current.getResolvedMetrics?.(candidate.item, resolution.route)
          };
        })
      );

      if (isCancelled) return;

      resolvedEntries.forEach((entry) => {
        if (latestRouteKeysRef.current[entry.id] !== entry.routeKey) {
          return;
        }

        cacheRef.current[entry.id] = {
          routeKey: entry.routeKey,
          status: entry.status,
          failureReason: entry.status === "failed" ? entry.failureReason : undefined,
          geometry: entry.status === "resolved" ? entry.geometry : undefined,
          metrics: entry.status === "resolved" ? entry.metrics : undefined
        };
      });

      setState((current) => {
        const failureById = { ...current.failureById };
        const geometryById = { ...current.geometryById };
        const metricsById = { ...current.metricsById };
        const statusById = { ...current.statusById };

        resolvedEntries.forEach((entry) => {
          if (latestRouteKeysRef.current[entry.id] !== entry.routeKey) {
            return;
          }

          statusById[entry.id] = entry.status;

          if (entry.status === "resolved") {
            delete failureById[entry.id];
            geometryById[entry.id] = entry.geometry;
            if (entry.metrics) {
              metricsById[entry.id] = entry.metrics;
            }
            return;
          }

          failureById[entry.id] = entry.failureReason;
          delete geometryById[entry.id];
          delete metricsById[entry.id];
        });

        return {
          failureById,
          geometryById,
          metricsById,
          statusById
        };
      });
    };

    void resolvePendingRoutes();

    return () => {
      isCancelled = true;
    };
  }, [candidates]);

  return state;
};
