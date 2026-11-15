import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import Link from "next/link";

const Pricing = () => {
  const language = "vi" as "vi" | "en";

  const copy = language === "en" ? {
    eyebrow: "PLANS",
    title: "Start with the data foundation, expand as reporting needs grow",
    subtitle: "Plans scale from demo exploration to multi-facility industrial deployment. Technical standards such as CBAM, GHG Protocol and ISO remain part of the reporting context rather than being translated or renamed.",
    popular: "Most popular",
    tiers: [
      { name: "Trial", price: "Free for 14 days", features: ["5 SKUs", "1 demo shipment", "Estimated carbon assessment", "No official report export"], cta: "Try B2B", href: "/auth", highlight: false },
      { name: "Standard", price: "899,000 – 1,490,000 VND/month", features: ["Product/SKU management", "Bulk upload", "Basic Scope 1-2-3", "Data Gap Checker", "Dashboard", "Draft reports"], cta: "Try B2B", href: "/auth", highlight: false },
      { name: "Export", price: "3,000,000 – 6,000,000 VND/month", features: ["Product Carbon Footprint package", "Export/market reporting adapters", "Facility GHG report", "Advanced Audit Trail", "Multi-user management", "Onboarding support"], cta: "Try B2B", href: "/auth", highlight: true },
      { name: "Enterprise", price: "Contact us", features: ["API / ERP", "Multi-facility", "Custom workflow", "SLA", "Dedicated deployment support"], cta: "Contact sales", href: "mailto:mytrinhh.bb@gmail.com", highlight: false },
    ],
  } : {
    eyebrow: "GÓI DỊCH VỤ",
    title: "Bắt đầu từ nền tảng dữ liệu, mở rộng theo nhu cầu báo cáo",
    subtitle: "Các gói mở rộng từ trải nghiệm demo đến triển khai đa cơ sở công nghiệp. Các thuật ngữ kỹ thuật như CBAM, GHG Protocol và ISO được giữ nguyên theo đúng ngữ cảnh chuyên ngành.",
    popular: "Phổ biến nhất",
    tiers: [
      { name: "Trial", price: "Miễn phí 14 ngày", features: ["5 SKU", "1 lô hàng demo", "Đánh giá carbon dạng Estimate", "Không xuất báo cáo chính thức"], cta: "Dùng thử B2B", href: "/auth", highlight: false },
      { name: "Standard", price: "899.000 – 1.490.000 ₫/tháng", features: ["Quản lý Product/SKU", "Bulk upload", "Scope 1-2-3 cơ bản", "Data Gap Checker", "Dashboard", "Draft report"], cta: "Dùng thử B2B", href: "/auth", highlight: false },
      { name: "Export", price: "3.000.000 – 6.000.000 ₫/tháng", features: ["Hồ sơ Product Carbon Footprint", "Adapter báo cáo xuất khẩu/thị trường", "Báo cáo GHG cấp cơ sở", "Audit Trail nâng cao", "Quản lý nhiều người dùng", "Hỗ trợ onboarding"], cta: "Dùng thử B2B", href: "/auth", highlight: true },
      { name: "Enterprise", price: "Liên hệ", features: ["API / ERP", "Đa cơ sở", "Custom workflow", "SLA", "Hỗ trợ triển khai riêng"], cta: "Liên hệ tư vấn", href: "mailto:mytrinhh.bb@gmail.com", highlight: false },
    ],
  };

  return (
    <section id="pricing" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center mb-14">
          <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide mb-4">{copy.eyebrow}</span>
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">{copy.title}</h2>
          <p className="text-muted-foreground leading-7">{copy.subtitle}</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-7xl mx-auto">
          {copy.tiers.map((t) => (
            <div key={t.name} className={`rounded-2xl border p-6 flex flex-col transition-all duration-300 hover:-translate-y-1 ${t.highlight ? "border-primary bg-primary/5 shadow-lg" : "glass-panel border-white/70 bg-card/70 hover:shadow-md"}`}>
              {t.highlight && <span className="self-start mb-3 px-2 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">{copy.popular}</span>}
              <h3 className="text-xl font-bold mb-1">{t.name}</h3>
              <p className="text-sm text-muted-foreground mb-5">{t.price}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {t.features.map((f) => <li key={f} className="flex gap-2 text-sm"><Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" /><span>{f}</span></li>)}
              </ul>
              {t.href.startsWith("/") ? <Link prefetch={false} href={t.href}><Button variant={t.highlight ? "hero" : "outline"} className="w-full">{t.cta}</Button></Link> : <a href={t.href}><Button variant={t.highlight ? "hero" : "outline"} className="w-full">{t.cta}</Button></a>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
