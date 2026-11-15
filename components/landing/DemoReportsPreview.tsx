"use client";

import { useLandingLanguage } from "./LandingLanguage";
import { Package, Truck, Factory, ClipboardCheck, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const DemoReportsPreview = () => {
  const { language } = useLandingLanguage();

  const copy = language === "en" ? {
    eyebrow: "SAMPLE OUTPUTS",
    title: "Reporting outputs built from the same governed data layer",
    intro: "Outputs are adapted to the accounting or market context instead of forcing one report format onto every industry. WeaveCarbon prepares evidence-backed, pre-verification packages; it does not replace an independent verifier.",
    cta: "Open the full Demo Workspace",
    preAudit: "Pre-verification",
    reports: [
      {
        icon: Package,
        name: "Product Carbon Footprint Package",
        desc: "Product/SKU output with BOM, allocation basis, Scope context, emission-factor snapshot, data quality and evidence links.",
        sample: { id: "WC-PCF-001", title: "Industrial product carbon profile", meta: "ISO 14067 · GHG Product · buyer-ready fields" },
      },
      {
        icon: Truck,
        name: "Export & Market Readiness Package",
        desc: "Market-specific output for buyer requests, DPP readiness or EU CBAM when the product and CN code are in scope.",
        sample: { id: "WC-MKT-2026-001", title: "Export market evidence package", meta: "Buyer PCF · DPP readiness · CBAM when applicable" },
      },
      {
        icon: Factory,
        name: "Facility GHG / MRV Package",
        desc: "Facility-level Scope 1 and Scope 2 inventory with source mapping, production context, evidence completeness and review status.",
        sample: { id: "WC-FAC-VN-001", title: "Vietnam industrial facility", meta: "Vietnam GHG/MRV · GHG Protocol · ISO 14064-1" },
      },
      {
        icon: ClipboardCheck,
        name: "Data Quality & Verification Readiness",
        desc: "Highlights missing evidence, proxy use, unresolved findings and the upgrade path before review or independent assurance.",
        sample: { id: "WC-DQ-001", title: "Evidence and data-quality register", meta: "L1–L5 · gaps · review status · version history" },
      },
    ],
  } : {
    eyebrow: "ĐẦU RA MẪU",
    title: "Nhiều đầu ra báo cáo từ cùng một lớp dữ liệu được quản trị",
    intro: "Đầu ra được điều chỉnh theo bối cảnh kiểm kê hoặc thị trường thay vì ép mọi ngành vào một mẫu báo cáo duy nhất. WeaveCarbon chuẩn bị hồ sơ có bằng chứng trước xác minh; không thay thế đơn vị xác minh độc lập.",
    cta: "Mở không gian làm việc demo",
    preAudit: "Trước xác minh",
    reports: [
      {
        icon: Package,
        name: "Hồ sơ Product Carbon Footprint",
        desc: "Đầu ra theo sản phẩm/SKU gồm định mức nguyên vật liệu, cơ sở phân bổ, phạm vi Scope, ảnh chụp hệ số phát thải, chất lượng dữ liệu và bằng chứng liên kết.",
        sample: { id: "WC-PCF-001", title: "Hồ sơ carbon sản phẩm công nghiệp", meta: "ISO 14067 · GHG Product Standard · trường dữ liệu theo bên mua" },
      },
      {
        icon: Truck,
        name: "Hồ sơ sẵn sàng xuất khẩu & thị trường",
        desc: "Đầu ra theo yêu cầu bên mua, mức sẵn sàng DPP hoặc EU CBAM khi sản phẩm và mã CN thuộc phạm vi áp dụng.",
        sample: { id: "WC-MKT-2026-001", title: "Hồ sơ bằng chứng cho thị trường xuất khẩu", meta: "PCF cho bên mua · sẵn sàng DPP · CBAM khi phù hợp" },
      },
      {
        icon: Factory,
        name: "Hồ sơ GHG / MRV cấp cơ sở",
        desc: "Kiểm kê Scope 1 và Scope 2 cấp cơ sở với ánh xạ nguồn phát thải, bối cảnh sản xuất, độ đầy đủ bằng chứng và trạng thái rà soát.",
        sample: { id: "WC-FAC-VN-001", title: "Cơ sở công nghiệp tại Việt Nam", meta: "Kiểm kê KNK/MRV Việt Nam · GHG Protocol · ISO 14064-1" },
      },
      {
        icon: ClipboardCheck,
        name: "Chất lượng dữ liệu & sẵn sàng xác minh",
        desc: "Nêu rõ bằng chứng còn thiếu, mức dùng số liệu ước tính, phát hiện chưa xử lý và lộ trình nâng cấp trước khi rà soát hoặc đảm bảo độc lập.",
        sample: { id: "WC-DQ-001", title: "Danh mục bằng chứng và chất lượng dữ liệu", meta: "L1–L5 · khoảng trống · trạng thái rà soát · lịch sử phiên bản" },
      },
    ],
  };

  return (
    <section id="reports-sample" className="py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center mb-14">
          <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide mb-4">
            {copy.eyebrow}
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">{copy.title}</h2>
          <p className="text-muted-foreground leading-7">{copy.intro}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 max-w-6xl mx-auto">
          {copy.reports.map((r) => (
            <div key={r.name} className="rounded-2xl border border-border bg-card p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  <r.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{r.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-6">{r.desc}</p>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="font-mono text-muted-foreground">{r.sample.id}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{copy.preAudit}</span>
                </div>
                <p className="font-medium text-foreground">{r.sample.title}</p>
                <p className="text-muted-foreground mt-1">{r.sample.meta}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link prefetch={false} href="/auth">
            <Button variant="hero" size="lg">
              {copy.cta}<ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default DemoReportsPreview;
