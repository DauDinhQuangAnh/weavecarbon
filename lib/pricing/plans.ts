/**
 * Single source of truth for the public price list (pitch deck, approved
 * 2026-11-18). Used by the landing page, /billing and the pricing modal.
 * Keep in sync with BE src/services/subscriptionService/planRules.js:
 *   Starter    -> backend plan id "standard" (VNPAY checkout, 20 SKU)
 *   Pro        -> backend plan id "export"   (sales-assisted)
 *   Enterprise -> request-upgrade / contact sales
 */

export type PricingLanguage = "vi" | "en";

export const SALES_CONTACT = {
  phone: "0828413747",
  phoneDisplay: "0828 413 747",
  email: "teamcet.st@gmail.com"
} as const;

export const salesMailto = (subject: string) =>
  `mailto:${SALES_CONTACT.email}?subject=${encodeURIComponent(subject)}`;

export type PricingPlanKey = "trial" | "starter" | "pro" | "enterprise";

export interface PricingPlan {
  key: PricingPlanKey;
  backendPlanId: "trial" | "standard" | "export" | null;
  name: string;
  priceVnd: number | null;
  skuLimit: number | null;
  audience: Record<PricingLanguage, string>;
  priceLabel: Record<PricingLanguage, string>;
  features: Record<PricingLanguage, string[]>;
}

const formatVnd = (value: number, language: PricingLanguage) =>
  language === "en"
    ? `${value.toLocaleString("en-US")} VND/month`
    : `${value.toLocaleString("vi-VN")} ₫/tháng`;

export const PRICING_PLANS: Record<PricingPlanKey, PricingPlan> = {
  trial: {
    key: "trial",
    backendPlanId: "trial",
    name: "Trial",
    priceVnd: 0,
    skuLimit: null,
    audience: { vi: "Dùng thử khi tạo tài khoản", en: "Starts automatically on sign-up" },
    priceLabel: { vi: "Miễn phí 14 ngày", en: "Free for 14 days" },
    features: {
      vi: ["Tính carbon ước tính (proxy)", "Nhập sản phẩm và dữ liệu hoạt động", "Không xuất báo cáo / hồ sơ xuất khẩu chính thức"],
      en: ["Estimated (proxy) carbon calculation", "Enter products and activity data", "No official report / export dossier output"]
    }
  },
  starter: {
    key: "starter",
    backendPlanId: "standard",
    name: "Starter",
    priceVnd: 6_000_000,
    skuLimit: 20,
    audience: { vi: "1 cơ sở / nhu cầu cơ bản", en: "1 facility / essential needs" },
    priceLabel: { vi: formatVnd(6_000_000, "vi"), en: formatVnd(6_000_000, "en") },
    features: {
      vi: ["Kiểm kê carbon cơ bản", "Dashboard năng lượng & dữ liệu", "Tải lên chứng từ (evidence)", "Báo cáo PDF cơ bản"],
      en: ["Basic carbon inventory", "Energy & data dashboard", "Evidence upload", "Basic PDF report"]
    }
  },
  pro: {
    key: "pro",
    backendPlanId: "export",
    name: "Pro",
    priceVnd: 8_000_000,
    skuLimit: null,
    audience: { vi: "Doanh nghiệp đang mở rộng", en: "Growing businesses" },
    priceLabel: { vi: formatVnd(8_000_000, "vi"), en: formatVnd(8_000_000, "en") },
    features: {
      vi: ["Đa quy trình / đa SKU", "Quy trình carbon sản phẩm", "Liên kết nhà cung ứng (supplier mapping)", "Báo cáo xuất khẩu / buyer", "Lớp rủi ro khí hậu cơ bản"],
      en: ["Multi-process / multi-SKU", "Product carbon workflow", "Supplier mapping", "Export / buyer reporting", "Basic climate risk layer"]
    }
  },
  enterprise: {
    key: "enterprise",
    backendPlanId: null,
    name: "Enterprise",
    priceVnd: null,
    skuLimit: null,
    audience: { vi: "Đa cơ sở / triển khai sâu", en: "Multi-facility / deep deployment" },
    priceLabel: { vi: "Liên hệ", en: "Contact us" },
    features: {
      vi: ["Quản lý đa cơ sở", "Tích hợp API", "Industry Pack", "Audit trail & phân bổ", "Sẵn sàng kết nối WeaveNode", "Hỗ trợ chuyên trách"],
      en: ["Multi-facility management", "API integration", "Industry pack", "Audit trail & allocation", "WeaveNode-ready", "Dedicated support"]
    }
  }
};

export const PRICING_PLAN_ORDER: PricingPlanKey[] = ["trial", "starter", "pro", "enterprise"];
