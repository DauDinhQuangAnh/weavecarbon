"use client";

import { useLandingLanguage } from "./LandingLanguage";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import Link from "next/link";
import { PRICING_PLANS, PRICING_PLAN_ORDER, salesMailto } from "@/lib/pricing/plans";

const Pricing = () => {
  const { language } = useLandingLanguage();

  const lang = language === "en" ? "en" : "vi";
  const header = lang === "en" ? {
    eyebrow: "PLANS",
    title: "Start with the data foundation, expand as reporting needs grow",
    subtitle: "Plans scale from demo exploration to multi-facility industrial deployment. Technical standards such as CBAM, GHG Protocol and ISO remain part of the reporting context rather than being translated or renamed.",
    popular: "Most popular",
    tryCta: "Try B2B",
    contactCta: "Contact sales",
  } : {
    eyebrow: "GÓI DỊCH VỤ",
    title: "Bắt đầu từ nền tảng dữ liệu, mở rộng theo nhu cầu báo cáo",
    subtitle: "Các gói mở rộng từ trải nghiệm demo đến triển khai đa cơ sở công nghiệp. Các thuật ngữ kỹ thuật như CBAM, GHG Protocol và ISO được giữ nguyên theo đúng ngữ cảnh chuyên ngành.",
    popular: "Phổ biến nhất",
    tryCta: "Dùng thử B2B",
    contactCta: "Liên hệ tư vấn",
  };

  // Prices and features come from the single price list in lib/pricing/plans.ts.
  const copy = {
    ...header,
    tiers: PRICING_PLAN_ORDER.map((key) => {
      const plan = PRICING_PLANS[key];
      const isEnterprise = key === "enterprise";
      return {
        name: plan.name,
        price: `${plan.priceLabel[lang]} · ${plan.audience[lang]}`,
        features: plan.features[lang],
        cta: isEnterprise ? header.contactCta : header.tryCta,
        href: isEnterprise ? salesMailto("WeaveCarbon Enterprise") : "/auth",
        highlight: key === "pro",
      };
    }),
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
