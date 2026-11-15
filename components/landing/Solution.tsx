"use client";

import { useLandingLanguage } from "./LandingLanguage";
import { Database, Calculator, ClipboardCheck, History, FileText } from "lucide-react";

const Solution = () => {
  const { language } = useLandingLanguage();

  const copy = language === "en" ? {
    eyebrow: "SOLUTION",
    title: "One governed carbon data backbone across industrial workflows",
    subtitle: "WeaveCarbon keeps the workflow simple: connect data, normalize it, link evidence, calculate deterministically, review versions and generate the right output for each reporting context.",
    modules: [
      {
        icon: Database,
        title: "Industrial Data Ingestion",
        desc: "Bring together meter data, invoices, ERP exports, BOMs, supplier files, production logs, logistics data and WeaveNode activity streams.",
      },
      {
        icon: Calculator,
        title: "Deterministic Carbon Engine",
        desc: "Calculate Scope 1, Scope 2, selected Scope 3 and product/facility emissions using governed emission factors and immutable calculation snapshots.",
      },
      {
        icon: ClipboardCheck,
        title: "Data Quality & Gap Control",
        desc: "Classify primary, proxy, self-reported, reconciled and verified data so teams know what still needs evidence before review or assurance.",
      },
      {
        icon: History,
        title: "Evidence Graph & Audit Trail",
        desc: "Connect Activity Data → Evidence → Emission Factor → Allocation → Calculation → Review → Version into a reproducible lineage.",
      },
      {
        icon: FileText,
        title: "Reporting & Market Adapters",
        desc: "Reuse the same governed data for Vietnam GHG/MRV, GHG Protocol, ISO 14064-1, ISO 14067, buyer PCF, DPP readiness and EU CBAM where applicable.",
      },
    ],
  } : {
    eyebrow: "GIẢI PHÁP",
    title: "Một hạ tầng dữ liệu carbon được quản trị xuyên suốt quy trình công nghiệp",
    subtitle: "WeaveCarbon giữ quy trình rõ ràng: kết nối dữ liệu, chuẩn hóa, liên kết bằng chứng, tính toán theo quy tắc cố định, rà soát theo phiên bản và tạo đúng đầu ra cho từng bối cảnh báo cáo.",
    modules: [
      {
        icon: Database,
        title: "Kết nối dữ liệu công nghiệp",
        desc: "Tập hợp dữ liệu đồng hồ đo, hóa đơn, ERP, định mức nguyên vật liệu, tệp nhà cung cấp, nhật ký sản xuất, logistics và dữ liệu hoạt động từ WeaveNode.",
      },
      {
        icon: Calculator,
        title: "Carbon Engine minh bạch cách tính",
        desc: "Tính Scope 1, Scope 2, một phần Scope 3 và phát thải cấp sản phẩm/cơ sở bằng hệ số phát thải được quản trị và ảnh chụp kết quả tính toán bất biến.",
      },
      {
        icon: ClipboardCheck,
        title: "Kiểm soát chất lượng & thiếu hụt dữ liệu",
        desc: "Phân loại dữ liệu sơ cấp, ước tính (proxy), tự khai báo, đã đối chiếu và đã xác minh để biết chính xác phần nào còn thiếu trước khi rà soát hoặc đảm bảo (assurance).",
      },
      {
        icon: History,
        title: "Đồ thị bằng chứng & nhật ký kiểm toán",
        desc: "Nối Dữ liệu hoạt động → Bằng chứng → Hệ số phát thải → Phân bổ → Tính toán → Rà soát → Phiên bản thành một chuỗi nguồn gốc có thể truy xuất và tái lập.",
      },
      {
        icon: FileText,
        title: "Báo cáo & bộ chuyển đổi theo thị trường",
        desc: "Tái sử dụng cùng dữ liệu cho kiểm kê KNK/MRV Việt Nam, GHG Protocol, ISO 14064-1, ISO 14067, PCF theo yêu cầu bên mua, mức sẵn sàng DPP và EU CBAM khi phù hợp.",
      },
    ],
  };

  return (
    <section id="solution" className="py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center mb-14">
          <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide mb-4">
            {copy.eyebrow}
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
            {copy.title}
          </h2>
          <p className="text-muted-foreground leading-7">
            {copy.subtitle}
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {copy.modules.map((m) => (
            <div key={m.title} className="rounded-2xl border border-border bg-card p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-gradient-forest flex items-center justify-center mb-4 text-primary-foreground">
                <m.icon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{m.title}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Solution;
