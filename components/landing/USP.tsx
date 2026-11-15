"use client";

import { useLandingLanguage } from "./LandingLanguage";
import {
  ArrowRight,
  Boxes,
  Building2,
  CheckCircle2,
  Database,
  Factory,
  FileCheck2,
  Gauge,
  Layers3,
  Network,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const USP = () => {
  const { language } = useLandingLanguage();

  const copy = language === "en" ? {
    eyebrow: "WHY WEAVECARBON?",
    title: "One carbon data infrastructure across multiple industrial sectors",
    intro: "WeaveCarbon does not build a separate carbon app for every sector. It uses one governed data backbone, then adapts taxonomy, validation, allocation and reporting rules through industry-specific packs.",
    industries: ["Steel", "Cement", "Aluminium", "Fertilisers & chemicals", "Construction materials", "Agriculture & agri-products"],
    flow: [
      [Database, "Operational data", "Meter · invoice · BOM · supplier"],
      [Boxes, "Carbon data core", "Normalize · evidence · calculate"],
      [FileCheck2, "Market outputs", "VN · GHG · ISO · Buyer · EU"],
    ],
    capabilities: [
      { icon: Layers3, eyebrow: "INDUSTRY-ADAPTIVE CORE", title: "One data backbone, multiple Industry Packs", desc: "A shared canonical model covers facility, process, product, supplier and evidence; each industry changes taxonomy, validation, allocation and reporting logic rather than rebuilding the platform.", chips: ["Steel", "Cement", "Aluminium", "Agriculture"] },
      { icon: Building2, eyebrow: "DOMESTIC → EXPORT", title: "Start with domestic needs, reuse data for export", desc: "Electricity, fuel, production, materials and evidence can support Vietnam GHG/MRV first, then be reused for PCF, buyer requests, CBAM or DPP when relevant.", chips: ["Vietnam GHG", "MRV", "PCF", "CBAM"] },
      { icon: Network, eyebrow: "CARBON EVIDENCE GRAPH", title: "Not only a number — the evidence behind the number", desc: "Activity Data → Evidence → Emission Factor → Allocation → Calculation → Review → Version are linked into a reproducible and traceable lineage.", chips: ["Provenance", "Evidence", "Versioning"] },
      { icon: Gauge, eyebrow: "DATA QUALITY", title: "Data does not need to be perfect on day one", desc: "Primary, proxy, self-reported, reconciled and verified states remain visible so teams know exactly what must improve before review or assurance.", chips: ["Primary", "Proxy", "L1–L5"] },
      { icon: FileCheck2, eyebrow: "REPORTING ADAPTERS", title: "One dataset, multiple reporting outputs", desc: "The same governed data can be mapped to Vietnam GHG, GHG Protocol, ISO 14064-1, ISO 14067, Product Carbon, buyer requirements and EU CBAM for in-scope goods.", chips: ["GHG Protocol", "ISO", "Buyer", "EU"] },
      { icon: ShieldCheck, eyebrow: "VERIFICATION READINESS", title: "Prepare for verification without claiming certification", desc: "WeaveCarbon locks calculation snapshots, manages findings and assembles evidence packages so teams can work transparently with independent reviewers and verifiers.", chips: ["Review", "Audit Trail", "Verifier-ready"] },
    ],
    promise: "Domestic first. Export ready.",
    promiseDesc: "Normalize and govern data once, then reuse it for domestic inventory, carbon operations and international market requirements as needed.",
    governed: "ONE GOVERNED DATA LAYER",
  } : {
    eyebrow: "VÌ SAO CHỌN WEAVECARBON?",
    title: "Một hạ tầng dữ liệu carbon cho nhiều ngành công nghiệp",
    intro: "WeaveCarbon không xây một phần mềm carbon riêng cho từng ngành. Nền tảng dùng chung một lõi dữ liệu được quản trị, sau đó điều chỉnh phân loại, quy tắc kiểm tra, phân bổ và quy tắc báo cáo theo từng gói ngành (Industry Pack).",
    industries: ["Thép", "Xi măng", "Nhôm", "Phân bón & hóa chất", "Vật liệu xây dựng", "Nông nghiệp & nông sản"],
    flow: [
      [Database, "Dữ liệu vận hành", "Đồng hồ · hóa đơn · BOM · nhà cung cấp"],
      [Boxes, "Lõi dữ liệu carbon", "Chuẩn hóa · bằng chứng · tính toán"],
      [FileCheck2, "Đầu ra thị trường", "VN · GHG · ISO · Bên mua · EU"],
    ],
    capabilities: [
      { icon: Layers3, eyebrow: "LÕI THÍCH ỨNG THEO NGÀNH", title: "Một hạ tầng dữ liệu, nhiều gói ngành", desc: "Mô hình dữ liệu lõi dùng chung cho cơ sở, quy trình, sản phẩm, nhà cung ứng và bằng chứng; từng ngành chỉ thay đổi phân loại, quy tắc kiểm tra, phân bổ và logic báo cáo thay vì xây lại hệ thống.", chips: ["Thép", "Xi măng", "Nhôm", "Nông nghiệp"] },
      { icon: Building2, eyebrow: "NỘI ĐỊA → XUẤT KHẨU", title: "Bắt đầu từ nhu cầu nội địa, tái sử dụng khi xuất khẩu", desc: "Cùng dữ liệu điện, nhiên liệu, sản lượng, vật liệu và chứng từ có thể phục vụ kiểm kê KNK/MRV Việt Nam trước, sau đó mở rộng sang PCF, yêu cầu bên mua, CBAM hoặc DPP khi phù hợp.", chips: ["Kiểm kê KNK VN", "MRV", "PCF", "CBAM"] },
      { icon: Network, eyebrow: "ĐỒ THỊ BẰNG CHỨNG CARBON", title: "Không chỉ có con số — có cả hồ sơ đứng sau con số", desc: "Dữ liệu hoạt động → Bằng chứng → Hệ số phát thải → Phân bổ → Tính toán → Rà soát → Phiên bản được nối thành một chuỗi nguồn gốc có thể truy xuất và tái lập.", chips: ["Nguồn gốc", "Bằng chứng", "Phiên bản"] },
      { icon: Gauge, eyebrow: "CHẤT LƯỢNG DỮ LIỆU", title: "Không cần dữ liệu hoàn hảo ngay từ đầu", desc: "Trạng thái sơ cấp, ước tính, tự khai báo, đã đối chiếu và đã xác minh được hiển thị rõ để doanh nghiệp biết phần nào cần cải thiện trước khi rà soát hoặc đảm bảo.", chips: ["Sơ cấp", "Ước tính", "L1–L5"] },
      { icon: FileCheck2, eyebrow: "BỘ CHUYỂN ĐỔI BÁO CÁO", title: "Một bộ dữ liệu, nhiều đầu ra báo cáo", desc: "Cùng dữ liệu được ánh xạ sang kiểm kê KNK Việt Nam, GHG Protocol, ISO 14064-1, ISO 14067, carbon sản phẩm, yêu cầu bên mua và EU CBAM cho hàng hóa thuộc phạm vi.", chips: ["GHG Protocol", "ISO", "Bên mua", "EU"] },
      { icon: ShieldCheck, eyebrow: "SẴN SÀNG XÁC MINH", title: "Chuẩn bị dữ liệu vững chắc trước khi xác minh", desc: "WeaveCarbon khóa ảnh chụp kết quả tính toán, quản lý phát hiện và gói bằng chứng để doanh nghiệp làm việc minh bạch với chuyên gia hoặc đơn vị xác minh độc lập.", chips: ["Rà soát", "Nhật ký kiểm toán", "Sẵn sàng xác minh"] },
    ],
    promise: "Vững nội địa. Sẵn sàng xuất khẩu.",
    promiseDesc: "Dữ liệu được chuẩn hóa và quản trị một lần để phục vụ kiểm kê nội địa, vận hành carbon và các yêu cầu thị trường quốc tế khi doanh nghiệp cần.",
    governed: "MỘT LỚP DỮ LIỆU ĐƯỢC QUẢN TRỊ",
  };

  return (
    <section id="why-weavecarbon" className="relative overflow-hidden bg-background py-24 md:py-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-10 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
      </div>

      <div className="container relative mx-auto px-6">
        <div className="mx-auto mb-10 max-w-4xl text-center md:mb-12">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-semibold tracking-wide text-primary"><Sparkles className="h-3.5 w-3.5" />{copy.eyebrow}</span>
          <h2 className="text-3xl font-display font-bold tracking-tight text-foreground md:text-5xl">{copy.title}</h2>
          <p className="mx-auto mt-5 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">{copy.intro}</p>
        </div>

        <div className="mx-auto mb-8 flex max-w-6xl flex-wrap items-center justify-center gap-2.5">
          {copy.industries.map((industry) => <span key={industry} className="group inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/80 px-3.5 py-2 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:text-foreground hover:shadow-md"><Factory className="h-3.5 w-3.5 text-primary transition-transform duration-300 group-hover:scale-110" />{industry}</span>)}
        </div>

        <div className="mx-auto mb-10 max-w-6xl rounded-2xl border border-primary/15 bg-card/70 p-3 shadow-[0_20px_70px_-45px_hsl(var(--primary)/0.45)] backdrop-blur md:p-4">
          <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
            {copy.flow.map(([Icon, title, subtitle], index) => {
              const Comp = Icon as typeof Database;
              return <div key={String(title)} className="contents"><div className="group relative overflow-hidden rounded-xl border border-border bg-background/80 px-4 py-4"><div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-primary/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" /><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Comp className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-foreground">{String(title)}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{String(subtitle)}</p></div></div></div>{index < 2 && <div className="hidden items-center justify-center md:flex"><ArrowRight className="h-4 w-4 text-primary/60" /></div>}</div>;
            })}
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2 xl:grid-cols-3">
          {copy.capabilities.map((item, index) => {
            const Icon = item.icon;
            return <article key={item.title} className="group relative min-h-[250px] overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_22px_65px_-38px_hsl(var(--primary)/0.55)] md:p-6"><div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/0 to-transparent transition-all duration-500 group-hover:via-primary/60" /><div className="relative flex h-full flex-col"><div className="mb-5 flex items-start justify-between gap-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/8 text-primary"><Icon className="h-4.5 w-4.5" /></span><span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground/80">0{index + 1}</span></div><p className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-primary">{item.eyebrow}</p><h3 className="text-base font-semibold leading-snug text-foreground md:text-lg">{item.title}</h3><p className="mt-2.5 text-sm leading-6 text-muted-foreground">{item.desc}</p><div className="mt-auto flex flex-wrap gap-2 pt-5">{item.chips.map((chip) => <span key={chip} className="rounded-md border border-border bg-muted/45 px-2 py-1 text-[10px] font-medium text-muted-foreground">{chip}</span>)}</div></div></article>;
          })}
        </div>

        <div className="mx-auto mt-8 flex max-w-6xl flex-col gap-3 rounded-2xl border border-primary/15 bg-primary/[0.035] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" /><div><p className="text-sm font-semibold text-foreground">{copy.promise}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.promiseDesc}</p></div></div>
          <span className="inline-flex items-center gap-2 self-start rounded-full border border-primary/20 bg-background px-3 py-1.5 text-[11px] font-medium text-primary md:self-auto"><Database className="h-3.5 w-3.5" />{copy.governed}</span>
        </div>
      </div>
    </section>
  );
};

export default USP;
