export interface B2CCollectionPointLocation {
  latitude: number;
  longitude: number;
}

export interface B2CCollectionPoint {
  id: string;
  name: string;
  address: string;
  city: string;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  operating_hours?: string | null;
  accepts_charity?: boolean | null;
  accepts_recycle?: boolean | null;
  distance_km?: number | null;
}

export interface NearbyCollectionPointsPayload {
  current_location?: B2CCollectionPointLocation | null;
  items?: B2CCollectionPoint[];
}

const FALLBACK_COLLECTION_POINTS: B2CCollectionPoint[] = [
  {
    id: "hc-d1-nguyen-hue",
    name: "Nguyen Hue Circular Hub",
    address: "42 Nguyen Hue",
    district: "District 1",
    city: "Ho Chi Minh City",
    latitude: 10.77572,
    longitude: 106.70186,
    phone: "028 3821 1001",
    operating_hours: "08:00 - 20:00",
    accepts_charity: true,
    accepts_recycle: true
  },
  {
    id: "hc-bt-xvnt",
    name: "Binh Thanh Rewear Point",
    address: "561 Xo Viet Nghe Tinh",
    district: "Binh Thanh",
    city: "Ho Chi Minh City",
    latitude: 10.80186,
    longitude: 106.71485,
    phone: "028 3512 8899",
    operating_hours: "09:00 - 19:00",
    accepts_charity: true,
    accepts_recycle: true
  },
  {
    id: "hc-d7-ton-dat-tien",
    name: "District 7 Green Corner",
    address: "107 Ton Dat Tien",
    district: "District 7",
    city: "Ho Chi Minh City",
    latitude: 10.72862,
    longitude: 106.72167,
    phone: "028 5413 2211",
    operating_hours: "09:00 - 21:00",
    accepts_charity: true,
    accepts_recycle: false
  },
  {
    id: "hc-td-vovanngan",
    name: "Thu Duc Recycling Station",
    address: "10 Vo Van Ngan",
    district: "Thu Duc City",
    city: "Ho Chi Minh City",
    latitude: 10.85011,
    longitude: 106.77172,
    phone: "028 3722 6400",
    operating_hours: "08:30 - 18:30",
    accepts_charity: false,
    accepts_recycle: true
  },
  {
    id: "hc-tb-truong-chinh",
    name: "Tan Binh Give-Back Point",
    address: "89 Truong Chinh",
    district: "Tan Binh",
    city: "Ho Chi Minh City",
    latitude: 10.80467,
    longitude: 106.6532,
    phone: "028 3810 5252",
    operating_hours: "08:00 - 18:00",
    accepts_charity: true,
    accepts_recycle: true
  },
  {
    id: "hc-gv-quang-trung",
    name: "Go Vap Renewal Stop",
    address: "12 Quang Trung",
    district: "Go Vap",
    city: "Ho Chi Minh City",
    latitude: 10.83148,
    longitude: 106.66931,
    phone: "028 3894 5577",
    operating_hours: "08:00 - 20:30",
    accepts_charity: false,
    accepts_recycle: true
  }
];

const FALLBACK_MAX_DISTANCE_KM = 25;
const EARTH_RADIUS_KM = 6371;

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistanceKm = (
  origin: B2CCollectionPointLocation,
  destination: B2CCollectionPointLocation
) => {
  const dLat = toRadians(destination.latitude - origin.latitude);
  const dLng = toRadians(destination.longitude - origin.longitude);
  const lat1 = toRadians(origin.latitude);
  const lat2 = toRadians(destination.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) *
      Math.sin(dLng / 2) *
      Math.cos(lat1) *
      Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

export const getFallbackNearbyCollectionPoints = (
  location: B2CCollectionPointLocation,
  limit = 6
): NearbyCollectionPointsPayload => {
  const items = FALLBACK_COLLECTION_POINTS.map((point) => {
    if (typeof point.latitude !== "number" || typeof point.longitude !== "number") {
      return point;
    }

    return {
      ...point,
      distance_km: calculateDistanceKm(location, {
        latitude: point.latitude,
        longitude: point.longitude
      })
    };
  })
    .filter(
      (point) =>
        typeof point.distance_km === "number" &&
        Number.isFinite(point.distance_km) &&
        point.distance_km <= FALLBACK_MAX_DISTANCE_KM
    )
    .sort((left, right) => (left.distance_km || 0) - (right.distance_km || 0))
    .slice(0, limit);

  return {
    current_location: location,
    items
  };
};
