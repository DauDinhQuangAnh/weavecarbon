export const SHIPMENT_COLORS = [
  "#3b82f6",
  "#f97316",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#ec4899",
  "#f59e0b",
  "#14b8a6",
  "#6366f1",
  "#a855f7",
];

// Stable per-shipment color: hashing the id (rather than a list index) keeps
// a shipment's route the same color across tab switches, filtering, and pagination.
export const getShipmentColor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return SHIPMENT_COLORS[Math.abs(hash) % SHIPMENT_COLORS.length];
};
