export interface TransportLocation {
  name: string;
  lat: number;
  lng: number;
  type: "address" | "port" | "airport" | "warehouse";
}

export interface TransportLeg {
  id: string;
  legNumber: number;
  type: "domestic" | "international";
  mode: "truck_light" | "truck_heavy" | "ship" | "air" | "rail";
  origin: TransportLocation;
  destination: TransportLocation;
  distanceKm: number;
  emissionFactor: number;
  co2Kg: number;
  routeType: "road" | "sea" | "air";
}