import { Database, Calculator, ClipboardCheck, History, FileText } from "lucide-react";

const Solution = () => {
  const language = "vi" as "vi" | "en";

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
    subtitle: "WeaveCarbon giữ quy trình rõ ràng: kết nối dữ liệu, chuẩn hóa, liên kết bằng chứng, tính toán theo rule cố định, review phiên bản và tạo đúng đầu ra cho từng bối cảnh báo cáo.",
    modules: [
      {
        icon: Database,
        title: "Kết nối dữ liệu công nghiệp",
        desc: "Tập hợp dữ liệu đồng hồ đo, hóa đơn, ERP, BOM, file nhà cung cấp, nhật ký sản xuất, logistics và activity data từ WeaveNode.",
      },
      {
        icon: Calculator,
        title: "Carbon Engine xác định được cách tính",
        desc: "Tính Scope 1, Scope 2, một phần Scope 3 và phát thải cấp sản phẩm/cơ sở bằng emission factor được quản trị và calculation snapshot bất biến.",
      },
      {
        icon: ClipboardCheck,
        title: "Kiểm soát chất lượng & thiếu hụt dữ liệu",
        desc: "Phân loại dữ liệu primary, proxy, self-reported, reconciled và verified để biết chính xác phần nào còn thiếu trước review hoặc assurance.",
      },
      {
        icon: History,
        title: "Evidence Graph & Audit Trail",
        desc: "Nối Activity Data → Evidence → Emission Factor → Allocation → Calculation → Review → Version thành một lineage có thể truy xuất và tái lập.",
      },
      {
        icon: FileText,
        title: "Báo cáo & adapter theo thị trường",
        desc: "Tái sử dụng cùng dữ liệu cho GHG/MRV Việt Nam, GHG Protocol, ISO 14064-1, ISO 14067, buyer PCF, DPP readiness và EU CBAM khi phù hợp.",
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
