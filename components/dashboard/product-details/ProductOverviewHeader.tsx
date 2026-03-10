import React from "react";
import { Badge } from "@/components/ui/badge";
import { Package, Globe, Scale } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ProductData } from "@/types/productData";
import type { ProductStatus } from "@/types/product";

interface ProductOverviewHeaderProps {
  product: ProductData;
  carbonStatus: "carbon_ready" | "data_partial" | "missing_critical";
}

const CARBON_STATUS_CLASS: Record<
  ProductOverviewHeaderProps["carbonStatus"],
  string
> = {
  carbon_ready: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  data_partial: "border border-amber-200 bg-amber-50 text-amber-700",
  missing_critical: "border border-rose-200 bg-rose-50 text-rose-700",
};

const PRODUCT_STATUS_CLASS: Record<ProductStatus, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  in_review: "bg-blue-100 text-blue-700 border-blue-200",
  published: "bg-green-100 text-green-700 border-green-200",
};

const normalizeProductStatus = (value: unknown): ProductStatus => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "published" || normalized === "active" || normalized === "publish") {
    return "published";
  }
  if (normalized === "in_review") {
    return "in_review";
  }
  return "draft";
};

const ProductOverviewHeader: React.FC<ProductOverviewHeaderProps> = ({
  product,
  carbonStatus,
}) => {
  const tProductDetail = useTranslations("productDetail");
  const tSummary = useTranslations("summary");

  const carbonStatusLabel =
    carbonStatus === "carbon_ready"
      ? tProductDetail("header.carbonStatus.carbon_ready")
      : carbonStatus === "data_partial"
        ? tProductDetail("header.carbonStatus.data_partial")
        : tProductDetail("header.carbonStatus.missing_critical");

  const productStatus: ProductStatus = normalizeProductStatus(product.status);
  const productStatusLabelMap: Record<ProductStatus, string> = {
    draft: tSummary("statusLabel.draft"),
    in_review: tProductDetail("header.productStatus.in_review"),
    published: tSummary("statusLabel.published"),
  };

  const productTypeLabels: Record<string, string> = {
    tshirt: tProductDetail("header.productType.tshirt"),
    polo: tProductDetail("header.productType.polo"),
    shirt: tProductDetail("header.productType.shirt"),
    pants: tProductDetail("header.productType.pants"),
    shorts: tProductDetail("header.productType.shorts"),
    dress: tProductDetail("header.productType.dress"),
    jacket: tProductDetail("header.productType.jacket"),
    sweater: tProductDetail("header.productType.sweater"),
    shoes: tProductDetail("header.productType.shoes"),
    sandals: tProductDetail("header.productType.sandals"),
    bag: tProductDetail("header.productType.bag"),
    accessories: tProductDetail("header.productType.accessories"),
    other: tProductDetail("header.productType.other"),
  };

  const marketLabels: Record<string, string> = {
    eu: tProductDetail("header.market.eu"),
    us: tProductDetail("header.market.us"),
    usa: tProductDetail("header.market.usa"),
    jp: tProductDetail("header.market.jp"),
    japan: tProductDetail("header.market.japan"),
    kr: tProductDetail("header.market.kr"),
    korea: tProductDetail("header.market.korea"),
    cn: tProductDetail("header.market.cn"),
    china: tProductDetail("header.market.china"),
    domestic: tProductDetail("header.market.domestic"),
    vn: tProductDetail("header.market.vn"),
    vietnam: tProductDetail("header.market.vietnam"),
    other: tProductDetail("header.market.other"),
  };

  const toDisplayText = (
    value: string | undefined,
    labels?: Record<string, string>
  ) => {
    const normalized = (value ?? "").trim();
    if (!normalized) {
      return tSummary("na");
    }

    const lowerCaseKey = normalized.toLowerCase();
    return labels?.[normalized] || labels?.[lowerCaseKey] || normalized;
  };

  return (
    <div className="mb-6 space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
              <Package className="h-7 w-7 text-slate-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{product.productName}</h1>
              <p className="text-sm text-slate-600">
                {tProductDetail("header.skuLabel")}: {product.productCode}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
            <div className="flex flex-wrap items-center gap-3 md:justify-end">
              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <Package className="h-4 w-4" />
                <span>{toDisplayText(product.category, productTypeLabels)}</span>
              </div>

              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <Globe className="h-4 w-4" />
                <span>{toDisplayText(product.destinationMarket, marketLabels)}</span>
              </div>

              <div className="flex items-center gap-1.5 text-sm text-slate-600">
                <Scale className="h-4 w-4" />
                <span>
                  {`${(product.weight || "").trim()} ${(product.unit || "").trim()}`.trim() ||
                    tSummary("na")}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <Badge className={`${PRODUCT_STATUS_CLASS[productStatus]} whitespace-nowrap font-medium`}>
                {productStatusLabelMap[productStatus]}
              </Badge>

              <Badge className={`${CARBON_STATUS_CLASS[carbonStatus]} whitespace-nowrap font-medium`}>
                {carbonStatusLabel}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductOverviewHeader;
