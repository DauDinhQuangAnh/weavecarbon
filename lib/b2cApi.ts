import {
  api,
  apiRequest,
  ensureAccessToken,
  resolveApiUrl
} from "@/lib/apiClient";
import type {
  B2CCollectionPoint,
  B2CCollectionPointLocation,
  NearbyCollectionPointsPayload
} from "@/lib/b2cCollectionPoints";

export interface DonationDraftImage {
  file: File;
  previewUrl: string;
  source: "upload" | "capture";
}

export interface B2CRewardsSummary {
  total_points: number;
  total_donations: number;
  total_items_donated: number;
  total_weight_kg: number;
  total_co2_saved: number;
  current_level: string;
  trees_equivalent: number;
}

export interface B2CDashboardProfile {
  id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

export interface B2CRecentActivityItem {
  id: string;
  donation_id?: string | null;
  transaction_type: string;
  type: "charity" | "recycle" | string;
  title: string;
  item_label: string;
  item_count: number;
  points: number;
  status?: string | null;
  created_at: string;
}

export interface B2CCollectionPointListPayload {
  items: B2CCollectionPoint[];
}

export interface MaterialReward {
  id: string;
  material_name: string;
  material_category: string;
  points_per_kg: number;
  co2_saved_per_kg: number;
  description?: string | null;
  is_active: boolean;
}

export interface MaterialRewardListPayload {
  items: MaterialReward[];
}

export interface B2CCoupon {
  id: string;
  title: string;
  merchant_name: string;
  category: string;
  description?: string | null;
  points_cost: number;
  discount_type: string;
  discount_value?: number | null;
  currency?: string | null;
  code?: string | null;
  image_url?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  stock_total?: number | null;
  stock_remaining?: number | null;
  redemption_limit_per_user?: number | null;
  redemption_method?: string | null;
  terms?: string | null;
  tags?: string[] | null;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface B2CCouponListPayload {
  items: B2CCoupon[];
  total_count?: number;
}

export interface DonationCollectionPointSummary {
  id: string;
  name: string;
  address: string;
  city: string;
  district?: string | null;
}

export interface DonationImageMeta {
  original_name: string;
  mime_type: string;
  size_bytes: number;
}

export interface DonationSummary {
  id: string;
  category: "charity" | "recycle";
  delivery_method: "drop_off" | "shipping";
  status: string;
  disposition?: "reuse" | "recycle" | "waste" | null;
  disposition_note?: string | null;
  disposition_at?: string | null;
  base_points: number;
  bonus_points: number;
  total_points: number;
  co2_saved: number;
  total_items: number;
  total_weight_kg: number;
  item_description?: string | null;
  shipping_tracking_number?: string | null;
  confirmation_method?: string | null;
  created_at: string;
  confirmed_at?: string | null;
  completed_at?: string | null;
  collection_point?: DonationCollectionPointSummary | null;
  image_available: boolean;
  source_image?: DonationImageMeta | null;
}

export interface DonationItemInput {
  item_name: string;
  item_type?: string;
  condition?: string;
  material_id: string;
  weight_kg: number;
}

export interface CreateB2CDonationPayload {
  category: "charity" | "recycle";
  delivery_method: "drop_off" | "shipping";
  items: DonationItemInput[];
  collection_point_id?: string;
  shipping_tracking_number?: string;
  gps_checkin?: {
    latitude: number;
    longitude: number;
    checked_at?: string;
  };
}

export interface DonationDetailItem extends DonationItemInput {
  id: string;
  material_name?: string | null;
  material_category?: string | null;
  points_earned: number;
  co2_saved: number;
  created_at: string;
}

export interface DonationDetail extends DonationSummary {
  items: DonationDetailItem[];
}

export interface DonationListPayload {
  items: DonationSummary[];
}

export interface RewardTransaction {
  id: string;
  donation_id?: string | null;
  transaction_type: string;
  points: number;
  description?: string | null;
  created_at: string;
}

export interface RewardTransactionListPayload {
  items: RewardTransaction[];
}

export interface B2CDashboardResponse {
  profile: B2CDashboardProfile;
  rewards_summary: B2CRewardsSummary;
  recent_activity: B2CRecentActivityItem[];
  recent_donations: DonationSummary[];
}

export interface PublicPassportPayload {
  product: unknown;
  shipment: unknown;
}

const toQueryString = (params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const normalized = String(value).trim();
    if (!normalized) return;
    query.set(key, normalized);
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
};

// Uses the shared apiClient GET cache/inflight-dedup (no disableResponseCache):
// the dashboard is read by both useUserProfile and useRecentActivity, so on a B2C
// page that mounts both hooks the two concurrent GETs collapse into one request.
// Mutations (donations etc.) go through api.post, which invalidates this cache, so
// the 3s TTL never serves stale data after a user action.
export const fetchB2CDashboard = () =>
  api.get<B2CDashboardResponse>("/b2c/dashboard");

export const fetchB2CCollectionPoints = (params?: {
  search?: string;
  city?: string;
  category?: "all" | "charity" | "recycle";
  limit?: number;
}) =>
  api.get<B2CCollectionPointListPayload>(
    `/b2c/collection-points${toQueryString({
      search: params?.search,
      city: params?.city,
      category: params?.category,
      limit: params?.limit
    })}`
  );

export const fetchB2CNearbyCollectionPoints = (params: {
  latitude: number;
  longitude: number;
  search?: string;
  city?: string;
  category?: "all" | "charity" | "recycle";
  limit?: number;
}) =>
  api.get<NearbyCollectionPointsPayload>(
    `/b2c/collection-points/nearby${toQueryString({
      lat: params.latitude,
      lng: params.longitude,
      search: params.search,
      city: params.city,
      category: params.category,
      limit: params.limit
    })}`
  );

export const fetchB2CMaterialRewards = () =>
  api.get<MaterialRewardListPayload>("/b2c/material-rewards", {
    disableResponseCache: true
  });

export const fetchB2CCoupons = (params?: {
  search?: string;
  category?: string;
  status?: "active" | "all";
  limit?: number;
}) =>
  api.get<B2CCouponListPayload>(
    `/b2c/coupons${toQueryString({
      search: params?.search,
      category: params?.category,
      status: params?.status,
      limit: params?.limit
    })}`,
    {
      disableResponseCache: true
    }
  );

export const createB2CDonation = (
  payload: CreateB2CDonationPayload,
  sourceImage: File
) => {
  const body = new FormData();
  body.append("source_image", sourceImage);
  body.append("payload", JSON.stringify(payload));

  return apiRequest<DonationDetail>("/b2c/donations", {
    method: "POST",
    body
  });
};

export const fetchB2CDonations = (limit = 20) =>
  api.get<DonationListPayload>(`/b2c/donations${toQueryString({ limit })}`, {
    disableResponseCache: true
  });

export const fetchB2CDonationById = (donationId: string) =>
  api.get<DonationDetail>(`/b2c/donations/${encodeURIComponent(donationId)}`, {
    disableResponseCache: true
  });

// Sorting-centre action (operator/admin, or the demo simulation): record the
// actual disposition and receive the recomputed donation detail.
export const recordB2CDonationDisposition = (
  donationId: string,
  disposition: "reuse" | "recycle" | "waste",
  note?: string | null
) =>
  api.post<DonationDetail & { co2_delta?: number }>(
    `/b2c-admin/donations/${encodeURIComponent(donationId)}/disposition`,
    { disposition, note: note ?? null }
  );

export const fetchB2CRewardTransactions = (limit = 30) =>
  api.get<RewardTransactionListPayload>(
    `/b2c/reward-transactions${toQueryString({ limit })}`,
    {
      disableResponseCache: true
    }
  );

export const fetchB2CDonationImageObjectUrl = async (donationId: string) => {
  const token = await ensureAccessToken();
  const response = await fetch(
    resolveApiUrl(`/b2c/donations/${encodeURIComponent(donationId)}/image`),
    {
      method: "GET",
      credentials: "include",
      headers: token
        ? {
            Authorization: `Bearer ${token}`
          }
        : undefined,
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("Unable to load donation image.");
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

export const fetchPublicPassportPayload = (productId: string) =>
  api.get<PublicPassportPayload>(`/passport/${encodeURIComponent(productId)}`, {
    disableResponseCache: true
  });

export type {
  B2CCollectionPoint,
  B2CCollectionPointLocation,
  NearbyCollectionPointsPayload
};
