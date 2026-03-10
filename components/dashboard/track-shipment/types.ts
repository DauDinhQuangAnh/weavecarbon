import type { TransportLeg } from "@/types/transport";

export interface TrackShipment {
  id: string;
  shipmentId?: string | null;
  productId: string | null;
  productName: string;
  sku: string;
  status: "in_transit" | "delivered" | "pending" | "cancelled";
  progress: number;
  origin: string;
  destination: string;
  estimatedArrival: string;
  departureDate: string;
  currentLocation: string;
  legs: TransportLeg[];
  totalCO2: number;
  carrier: string;
  containerNo: string;
}