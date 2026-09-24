import { beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({
  fetchWithPolicy: vi.fn()
}));

vi.mock("@/lib/mapbox", () => ({
  hasMapboxPublicToken: () => true,
  buildMapboxDrivingDirectionsUrl: (
    coordinates: Array<[number, number]>,
    options: { radiuses?: Array<number | "unlimited"> }
  ) => `https://directions.test/${JSON.stringify(coordinates)}?r=${options.radiuses?.join(";")}`
}));

vi.mock("@/lib/http/requestPolicy", () => ({
  fetchWithPolicy: transport.fetchWithPolicy
}));

import { fetchRoadRoute } from "./roadRouting";

describe("fetchRoadRoute request budget", () => {
  beforeEach(() => {
    transport.fetchWithPolicy.mockReset();
  });

  it("stops after three route strategies when Mapbox cannot resolve a road", async () => {
    transport.fetchWithPolicy.mockImplementation(async () =>
      new Response(JSON.stringify({ code: "NoRoute", routes: [] }), {
        headers: { "content-type": "application/json" },
        status: 200
      })
    );

    const result = await fetchRoadRoute(
      { lat: 10.771, lng: 106.698 },
      { lat: 10.779, lng: 106.711 },
      { originSource: "warehouse", destinationSource: "hub_port" }
    );

    expect(result.ok).toBe(false);
    expect(result.attemptedRadiuses).toHaveLength(3);
    expect(transport.fetchWithPolicy).toHaveBeenCalledTimes(3);
  });

  it("shares an in-flight route lookup for identical coordinates", async () => {
    transport.fetchWithPolicy.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          code: "Ok",
          routes: [{
            distance: 1200,
            duration: 300,
            geometry: { coordinates: [[106.7, 10.7], [106.71, 10.71]] }
          }],
          waypoints: [
            { location: [106.7, 10.7] },
            { location: [106.71, 10.71] }
          ]
        }),
        { headers: { "content-type": "application/json" }, status: 200 }
      )
    );

    const origin = { lat: 10.7, lng: 106.7 };
    const destination = { lat: 10.71, lng: 106.71 };
    const [first, second] = await Promise.all([
      fetchRoadRoute(origin, destination),
      fetchRoadRoute(origin, destination)
    ]);

    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
    expect(transport.fetchWithPolicy).toHaveBeenCalledTimes(1);
  });
});
