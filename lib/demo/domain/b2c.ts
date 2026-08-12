"use client";

import { DEFAULT_B2C_MATERIAL_REWARDS } from "@/lib/b2cMaterialRewardsDefaults";
import { donationCo2Saved } from "@/lib/b2cCo2";

const B2C_DEMO_USER_ID = "b2c-demo-usr-0001";
const B2C_DEMO_EMAIL = "linh.nguyen@weavecarbon.demo";
const B2C_DEMO_FULL_NAME = "Nguyễn Thị Linh";

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

type DemoDonation = {
  id: string;
  category: string;
  delivery_method: string;
  status: string;
  base_points: number;
  bonus_points: number;
  total_points: number;
  co2_saved: number;
  total_items: number;
  total_weight_kg: number;
  item_description: string | null;
  shipping_tracking_number: string | null;
  confirmation_method: string | null;
  created_at: string;
  confirmed_at: string | null;
  completed_at: string | null;
  collection_point: {
    id: string;
    name: string;
    address: string;
    city: string;
    district?: string | null;
  } | null;
  image_available: boolean;
  source_image: null;
  items: {
    id: string;
    item_name: string;
    item_type: string;
    condition: string;
    material_id: string;
    material_name: string | null;
    material_category: string | null;
    weight_kg: number;
    points_earned: number;
    co2_saved: number;
    created_at: string;
  }[];
};

const DEMO_DONATIONS: DemoDonation[] = [
  {
    id: "don-demo-001",
    category: "charity",
    delivery_method: "drop_off",
    status: "completed",
    base_points: 80,
    bonus_points: 40,
    total_points: 120,
    co2_saved: 2.8,
    total_items: 3,
    total_weight_kg: 2.5,
    item_description: "Áo khoác, quần jeans, áo thun",
    shipping_tracking_number: null,
    confirmation_method: "gps",
    created_at: daysAgo(2),
    confirmed_at: daysAgo(2),
    completed_at: daysAgo(2),
    collection_point: {
      id: "cp-hcm-001",
      name: "Trung tâm Tái chế Xanh Quận 1",
      address: "123 Lê Lợi",
      city: "TP. Hồ Chí Minh",
      district: "Quận 1",
    },
    image_available: false,
    source_image: null,
    items: [
      {
        id: "item-001-a",
        item_name: "Áo khoác mùa đông",
        item_type: "Jacket",
        condition: "good",
        material_id: "10a00000-0000-4000-8000-000000000001",
        material_name: "Cotton 100%",
        material_category: "fabric",
        weight_kg: 1.2,
        points_earned: 38,
        co2_saved: 1.1,
        created_at: daysAgo(2),
      },
      {
        id: "item-001-b",
        item_name: "Quần jeans",
        item_type: "Jeans",
        condition: "good",
        material_id: "10a00000-0000-4000-8000-000000000001",
        material_name: "Cotton 100%",
        material_category: "fabric",
        weight_kg: 0.9,
        points_earned: 29,
        co2_saved: 0.9,
        created_at: daysAgo(2),
      },
      {
        id: "item-001-c",
        item_name: "Áo thun cotton",
        item_type: "T-shirt",
        condition: "fair",
        material_id: "10a00000-0000-4000-8000-000000000001",
        material_name: "Cotton 100%",
        material_category: "fabric",
        weight_kg: 0.4,
        points_earned: 13,
        co2_saved: 0.8,
        created_at: daysAgo(2),
      },
    ],
  },
  {
    id: "don-demo-002",
    category: "recycle",
    delivery_method: "drop_off",
    status: "completed",
    base_points: 85,
    bonus_points: 0,
    total_points: 85,
    co2_saved: 3.1,
    total_items: 5,
    total_weight_kg: 3.8,
    item_description: "Áo thun cotton cũ",
    shipping_tracking_number: null,
    confirmation_method: "gps",
    created_at: daysAgo(7),
    confirmed_at: daysAgo(7),
    completed_at: daysAgo(7),
    collection_point: {
      id: "cp-hcm-002",
      name: "Điểm Thu Gom VRG Bình Thạnh",
      address: "45 Đinh Bộ Lĩnh",
      city: "TP. Hồ Chí Minh",
      district: "Bình Thạnh",
    },
    image_available: false,
    source_image: null,
    items: [
      {
        id: "item-002-a",
        item_name: "Áo thun cotton",
        item_type: "T-shirt",
        condition: "worn",
        material_id: "10a00000-0000-4000-8000-000000000001",
        material_name: "Cotton 100%",
        material_category: "fabric",
        weight_kg: 0.76,
        points_earned: 17,
        co2_saved: 0.62,
        created_at: daysAgo(7),
      },
    ],
  },
  {
    id: "don-demo-003",
    category: "charity",
    delivery_method: "shipping",
    status: "pending",
    base_points: 0,
    bonus_points: 0,
    total_points: 0,
    co2_saved: 0,
    total_items: 8,
    total_weight_kg: 5.2,
    item_description: "Quần áo trẻ em",
    shipping_tracking_number: "VN929384756",
    confirmation_method: null,
    created_at: daysAgo(1),
    confirmed_at: null,
    completed_at: null,
    collection_point: null,
    image_available: false,
    source_image: null,
    items: [],
  },
];

export const getDemoB2CAccount = () => ({
  profile: {
    id: B2C_DEMO_USER_ID,
    user_id: B2C_DEMO_USER_ID,
    full_name: B2C_DEMO_FULL_NAME,
    email: B2C_DEMO_EMAIL,
    company_id: null,
    created_at: daysAgo(60),
  },
  company: null,
  roles: ["b2c"],
  company_membership: null,
});

export const getDemoB2CDashboard = () => ({
  profile: {
    id: B2C_DEMO_USER_ID,
    email: B2C_DEMO_EMAIL,
    full_name: B2C_DEMO_FULL_NAME,
    avatar_url: null,
  },
  rewards_summary: {
    total_points: 1_250,
    total_donations: 15,
    total_items_donated: 38,
    total_weight_kg: 19.5,
    total_co2_saved: 47.3,
    current_level: "Green Member",
    trees_equivalent: 5,
  },
  recent_activity: [
    {
      id: "act-demo-001",
      donation_id: "don-demo-001",
      transaction_type: "points_earned",
      type: "charity",
      title: "Quyên góp áo khoác mùa đông",
      item_label: "Áo khoác + Quần jeans + Áo thun (3 món)",
      item_count: 3,
      points: 120,
      status: "completed",
      created_at: daysAgo(2),
    },
    {
      id: "act-demo-002",
      donation_id: "don-demo-002",
      transaction_type: "points_earned",
      type: "recycle",
      title: "Tái chế vải cotton cũ",
      item_label: "Áo thun cotton (5 món)",
      item_count: 5,
      points: 85,
      status: "completed",
      created_at: daysAgo(7),
    },
    {
      id: "act-demo-003",
      donation_id: "don-demo-003",
      transaction_type: "pending",
      type: "charity",
      title: "Quyên góp quần áo trẻ em",
      item_label: "Quần áo trẻ em (8 món)",
      item_count: 8,
      points: 0,
      status: "pending",
      created_at: daysAgo(1),
    },
  ],
  recent_donations: DEMO_DONATIONS.slice(0, 3),
});

const DEMO_COLLECTION_POINTS = [
  {
    id: "cp-hcm-001",
    name: "Trung tâm Tái chế Xanh Quận 1",
    address: "123 Lê Lợi",
    district: "Quận 1",
    city: "TP. Hồ Chí Minh",
    phone: "028 3822 1234",
    operating_hours: "08:00–18:00 Thứ 2–7",
    latitude: 10.7769,
    longitude: 106.7009,
    accepts_charity: true,
    accepts_recycle: true,
    distance_km: null as number | null,
  },
  {
    id: "cp-hcm-002",
    name: "Điểm Thu Gom VRG Bình Thạnh",
    address: "45 Đinh Bộ Lĩnh",
    district: "Bình Thạnh",
    city: "TP. Hồ Chí Minh",
    phone: "028 3510 8888",
    operating_hours: "07:30–17:30 Thứ 2–6",
    latitude: 10.8143,
    longitude: 106.7144,
    accepts_charity: false,
    accepts_recycle: true,
    distance_km: null as number | null,
  },
  {
    id: "cp-hcm-003",
    name: "Cửa hàng WeaveCarbon Gò Vấp",
    address: "88 Phan Văn Trị",
    district: "Gò Vấp",
    city: "TP. Hồ Chí Minh",
    phone: "028 3895 4321",
    operating_hours: "09:00–19:00 hằng ngày",
    latitude: 10.8380,
    longitude: 106.6900,
    accepts_charity: true,
    accepts_recycle: true,
    distance_km: null as number | null,
  },
  {
    id: "cp-hn-001",
    name: "Trung tâm Circular Hub Hoàn Kiếm",
    address: "22 Hàng Bài",
    district: "Hoàn Kiếm",
    city: "Hà Nội",
    phone: "024 3936 5555",
    operating_hours: "08:00–18:00 Thứ 2–7",
    latitude: 21.0245,
    longitude: 105.8412,
    accepts_charity: true,
    accepts_recycle: true,
    distance_km: null as number | null,
  },
  {
    id: "cp-hn-002",
    name: "Điểm Thu Gom Tây Hồ",
    address: "10 Xuân Diệu",
    district: "Tây Hồ",
    city: "Hà Nội",
    phone: "024 3718 2200",
    operating_hours: "08:30–17:30 Thứ 2–6",
    latitude: 21.0555,
    longitude: 105.8371,
    accepts_charity: true,
    accepts_recycle: false,
    distance_km: null as number | null,
  },
];

const toRadians = (deg: number) => (deg * Math.PI) / 180;

const haversineKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) => {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const getDemoB2CCollectionPoints = (params?: {
  search?: string;
  city?: string;
  category?: "all" | "charity" | "recycle";
  lat?: number;
  lng?: number;
  limit?: number;
}) => {
  let items = DEMO_COLLECTION_POINTS.map((cp) => ({ ...cp }));

  if (params?.search) {
    const q = params.search.toLowerCase();
    items = items.filter(
      (cp) =>
        cp.name.toLowerCase().includes(q) ||
        cp.address.toLowerCase().includes(q) ||
        cp.district.toLowerCase().includes(q) ||
        cp.city.toLowerCase().includes(q)
    );
  }

  if (params?.city) {
    const c = params.city.toLowerCase();
    items = items.filter((cp) => cp.city.toLowerCase().includes(c));
  }

  if (params?.category === "charity") {
    items = items.filter((cp) => cp.accepts_charity);
  } else if (params?.category === "recycle") {
    items = items.filter((cp) => cp.accepts_recycle);
  }

  if (typeof params?.lat === "number" && typeof params?.lng === "number") {
    items = items.map((cp) => ({
      ...cp,
      distance_km:
        typeof cp.latitude === "number" && typeof cp.longitude === "number"
          ? Math.round(haversineKm(params.lat!, params.lng!, cp.latitude, cp.longitude) * 10) / 10
          : null,
    }));
    items.sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999));
  }

  const limit = params?.limit ?? 20;
  return {
    items: items.slice(0, limit),
    current_location:
      typeof params?.lat === "number"
        ? { latitude: params.lat, longitude: params.lng }
        : undefined,
  };
};

export const getDemoB2CMaterialRewards = () => ({
  items: DEFAULT_B2C_MATERIAL_REWARDS.filter((m, i) => i < 12).map((m) => ({
    id: m.id,
    material_name: m.materialNameVi,
    material_category: m.materialCategory,
    points_per_kg: m.pointsPerKg,
    co2_saved_per_kg: m.co2SavedPerKg,
    description: m.descriptionVi,
    is_active: true,
  })),
});

const DEMO_COUPONS = [
  {
    id: "cpn-demo-001",
    title: "Giảm 15% tại UNIQLO",
    merchant_name: "UNIQLO Việt Nam",
    category: "shopping",
    description: "Áp dụng cho đơn hàng từ 500.000 đ trở lên tại cửa hàng UNIQLO toàn quốc.",
    points_cost: 200,
    discount_type: "percentage",
    discount_value: 15,
    currency: "VND",
    code: null,
    image_url: null,
    valid_from: daysAgo(30),
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    stock_total: 500,
    stock_remaining: 342,
    redemption_limit_per_user: 1,
    redemption_method: "in_store",
    terms: "Không áp dụng đồng thời với các chương trình khuyến mãi khác.",
    tags: ["fashion", "discount"],
    is_featured: true,
    is_active: true,
    created_at: daysAgo(30),
    updated_at: daysAgo(5),
  },
  {
    id: "cpn-demo-002",
    title: "Ly cà phê miễn phí tại The Coffee House",
    merchant_name: "The Coffee House",
    category: "coffee",
    description: "Đổi điểm lấy 1 ly cà phê size M bất kỳ.",
    points_cost: 100,
    discount_type: "free_item",
    discount_value: null,
    currency: "VND",
    code: null,
    image_url: null,
    valid_from: daysAgo(14),
    valid_until: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    stock_total: 1000,
    stock_remaining: 688,
    redemption_limit_per_user: 2,
    redemption_method: "in_store",
    terms: "Áp dụng cho tất cả chi nhánh The Coffee House trên toàn quốc.",
    tags: ["coffee", "free"],
    is_featured: true,
    is_active: true,
    created_at: daysAgo(14),
    updated_at: daysAgo(2),
  },
  {
    id: "cpn-demo-003",
    title: "Giảm 50.000 đ Grab Food",
    merchant_name: "GrabFood",
    category: "food",
    description: "Mã giảm giá 50.000 đ cho đơn hàng GrabFood từ 150.000 đ.",
    points_cost: 150,
    discount_type: "fixed",
    discount_value: 50000,
    currency: "VND",
    code: null,
    image_url: null,
    valid_from: daysAgo(7),
    valid_until: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    stock_total: 300,
    stock_remaining: 89,
    redemption_limit_per_user: 1,
    redemption_method: "app_code",
    terms: "Mỗi tài khoản chỉ được dùng 1 lần. Không áp dụng cho Grab Mart.",
    tags: ["food", "delivery"],
    is_featured: false,
    is_active: true,
    created_at: daysAgo(7),
    updated_at: daysAgo(1),
  },
  {
    id: "cpn-demo-004",
    title: "Tặng túi tote tái chế WeaveCarbon",
    merchant_name: "WeaveCarbon",
    category: "other",
    description: "Đổi điểm lấy 1 túi tote làm từ vải tái chế. Giao hàng tận nơi.",
    points_cost: 500,
    discount_type: "free_item",
    discount_value: null,
    currency: null,
    code: null,
    image_url: null,
    valid_from: daysAgo(60),
    valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    stock_total: 200,
    stock_remaining: 143,
    redemption_limit_per_user: 1,
    redemption_method: "delivery",
    terms: "Chỉ áp dụng cho địa chỉ trong lãnh thổ Việt Nam.",
    tags: ["eco", "gift"],
    is_featured: true,
    is_active: true,
    created_at: daysAgo(60),
    updated_at: daysAgo(10),
  },
  {
    id: "cpn-demo-005",
    title: "Giảm 20% tại Hasaki Beauty",
    merchant_name: "Hasaki Beauty",
    category: "beauty",
    description: "Áp dụng cho mọi sản phẩm chăm sóc da tại Hasaki (online & offline).",
    points_cost: 300,
    discount_type: "percentage",
    discount_value: 20,
    currency: "VND",
    code: null,
    image_url: null,
    valid_from: daysAgo(21),
    valid_until: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    stock_total: 400,
    stock_remaining: 211,
    redemption_limit_per_user: 1,
    redemption_method: "in_store",
    terms: "Không áp dụng cho hàng sale, hàng nhập khẩu.",
    tags: ["beauty", "discount"],
    is_featured: false,
    is_active: true,
    created_at: daysAgo(21),
    updated_at: daysAgo(3),
  },
];

export const getDemoB2CCoupons = (params?: {
  search?: string;
  category?: string;
  status?: "active" | "all";
  limit?: number;
}) => {
  let items = DEMO_COUPONS.filter((c) => c.is_active);

  if (params?.search) {
    const q = params.search.toLowerCase();
    items = items.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.merchant_name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  }

  if (params?.category && params.category !== "all") {
    items = items.filter((c) => c.category === params.category);
  }

  return { items: items.slice(0, params?.limit ?? 48), total_count: items.length };
};

let demoDonations = [...DEMO_DONATIONS];

export const getDemoB2CDonations = (limit = 20) => ({
  items: demoDonations.slice(0, limit),
});

export const getDemoB2CDonationById = (id: string) =>
  demoDonations.find((d) => d.id === id) ?? null;

export const createDemoB2CDonation = (payload: Record<string, unknown>) => {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const materialRewards = getDemoB2CMaterialRewards().items;
  const materialMap = new Map(materialRewards.map((m) => [m.id, m]));
  const category = String(payload.category || "charity");

  let basePoints = 0;
  let co2Saved = 0;
  let totalWeightKg = 0;
  const resolvedItems = items.map((item: Record<string, unknown>, idx: number) => {
    const weightKg = Number(item.weight_kg) || 0;
    const reward = materialMap.get(String(item.material_id || ""));
    const pointsEarned = reward ? Math.round(reward.points_per_kg * weightKg) : 0;
    const itemCo2 = reward ? donationCo2Saved(category, reward.co2_saved_per_kg, weightKg) : 0;
    basePoints += pointsEarned;
    co2Saved += itemCo2;
    totalWeightKg += weightKg;
    return {
      id: `item-new-${Date.now()}-${idx}`,
      item_name: String(item.item_name || ""),
      item_type: String(item.item_type || ""),
      condition: String(item.condition || "good"),
      material_id: String(item.material_id || ""),
      material_name: reward?.material_name ?? null,
      material_category: reward?.material_category ?? null,
      weight_kg: weightKg,
      points_earned: pointsEarned,
      co2_saved: Number(itemCo2.toFixed(4)),
      created_at: new Date().toISOString(),
    };
  });

  const bonusPoints = category === "charity" ? Math.round(basePoints * 0.5) : 0;

  const donation = {
    id: `don-demo-${Date.now()}`,
    category,
    delivery_method: String(payload.delivery_method || "drop_off"),
    status: "pending" as const,
    base_points: basePoints,
    bonus_points: bonusPoints,
    total_points: basePoints + bonusPoints,
    co2_saved: Number(co2Saved.toFixed(4)),
    total_items: resolvedItems.length,
    total_weight_kg: Number(totalWeightKg.toFixed(3)),
    item_description: resolvedItems.map((i) => i.item_name).join(", "),
    shipping_tracking_number: String(payload.shipping_tracking_number || "") || null,
    confirmation_method: null as string | null,
    created_at: new Date().toISOString(),
    confirmed_at: null as string | null,
    completed_at: null as string | null,
    collection_point: null as null | {
      id: string;
      name: string;
      address: string;
      city: string;
      district?: string | null;
    },
    image_available: false,
    source_image: null,
    items: resolvedItems,
  };

  if (payload.collection_point_id) {
    const cp = DEMO_COLLECTION_POINTS.find((c) => c.id === payload.collection_point_id);
    if (cp) {
      donation.collection_point = {
        id: cp.id,
        name: cp.name,
        address: cp.address,
        city: cp.city,
        district: cp.district,
      };
    }
  }

  demoDonations = [donation, ...demoDonations];
  return donation;
};

export const getDemoB2CRewardTransactions = (limit = 30) => ({
  items: [
    {
      id: "txn-demo-001",
      donation_id: "don-demo-001",
      transaction_type: "points_earned",
      points: 120,
      description: "Quyên góp 3 món — Áo khoác, quần jeans, áo thun",
      created_at: daysAgo(2),
    },
    {
      id: "txn-demo-002",
      donation_id: "don-demo-002",
      transaction_type: "points_earned",
      points: 85,
      description: "Tái chế 5 áo thun cotton",
      created_at: daysAgo(7),
    },
    {
      id: "txn-demo-003",
      donation_id: null,
      transaction_type: "coupon_redeemed",
      points: -200,
      description: "Đổi coupon: Giảm 15% tại UNIQLO",
      created_at: daysAgo(10),
    },
    {
      id: "txn-demo-004",
      donation_id: "don-old-001",
      transaction_type: "points_earned",
      points: 95,
      description: "Tái chế vải len cũ (4 món)",
      created_at: daysAgo(20),
    },
    {
      id: "txn-demo-005",
      donation_id: null,
      transaction_type: "bonus",
      points: 50,
      description: "Thưởng hoàn thành huy hiệu Eco Starter",
      created_at: daysAgo(25),
    },
  ].slice(0, limit),
});

export const getDemoB2CImageAnalysis = () => ({
  detected_items: [
    {
      material_id: "10a00000-0000-4000-8000-000000000001",
      material_name: "Cotton 100%",
      item_name: "Áo thun",
      item_type: "T-shirt",
      confidence: 0.87,
      estimated_weight_kg: 0.4,
      condition: "good",
    },
  ],
  total_detected: 1,
  analysis_confidence: 0.87,
  notes: "Demo — phân tích AI mô phỏng. Tải ảnh thật để có kết quả chính xác hơn.",
});
