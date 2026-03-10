import type { ProductStatus } from "@/types/product";
import { MATERIAL_CERTIFICATION_LABEL_BY_VALUE } from "@/lib/materialCertificationDefinitions";

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "Draft",
  in_review: "In Review",
  published: "Published"
};

export const PRODUCT_STATUS_CONFIG: Record<
  ProductStatus,
  {label: string;className: string;}> =
{
  draft: {
    label: "Draft",
    className: "bg-gray-100 text-gray-700 border-gray-200"
  },
  in_review: {
    label: "In Review",
    className: "bg-blue-100 text-blue-700 border-blue-200"
  },
  published: {
    label: "Published",
    className: "bg-green-100 text-green-700 border-green-200"
  }
};

export const TRANSPORT_MODE_LABELS: Record<string, string> = {
  truck_light: "Xe tải nhẹ",
  truck_heavy: "Xe tải nặng",
  ship: "Tàu biển",
  air: "Máy bay",
  rail: "Đường sắt"
};

export const CATEGORY_LABELS: Record<string, string> = {
  apparel: "Quần áo",
  footwear: "Giày dép",
  accessories: "Phụ kiện",
  textiles: "Vải dệt",
  homegoods: "Đồ gia dụng"
};

export const MATERIAL_LABELS: Record<string, string> = {
  cotton: "Cotton",
  polyester: "Polyester",
  wool: "Wool",
  silk: "Silk",
  linen: "Linen",
  nylon: "Nylon",
  recycled_polyester: "Recycled Polyester",
  organic_cotton: "Organic Cotton",
  bamboo: "Bamboo",
  hemp: "Hemp"
};

export const CERTIFICATION_LABELS: Record<string, string> = {
  ...MATERIAL_CERTIFICATION_LABEL_BY_VALUE
};

export const MARKET_LABELS: Record<string, string> = {
  eu: "Châu Âu (EU)",
  us: "Hoa Kỳ",
  usa: "Hoa Kỳ",
  jp: "Nhật Bản",
  japan: "Nhật Bản",
  kr: "Hàn Quốc",
  korea: "Hàn Quốc",
  cn: "Trung Quốc",
  china: "Trung Quốc",
  domestic: "Nội địa Việt Nam",
  vn: "Nội địa Việt Nam",
  vietnam: "Nội địa Việt Nam",
  other: "Khác"
};
