import { FileSpreadsheet, Network, ShieldAlert, Globe2 } from "lucide-react";

const Problem = () => {
  const language = "vi" as "vi" | "en";

  const copy = language === "en" ? {
    eyebrow: "THE DATA GAP INDUSTRY IS FACING",
    title: "Market requirements are moving faster than enterprise data infrastructure",
    intro: "Industrial companies are not short of compliance checklists. They are short of a reliable data layer that can reuse the same operational evidence across GHG inventories, product carbon, buyer requests and market-specific reporting.",
    items: [
      {
        icon: FileSpreadsheet,
        title: "Carbon data is fragmented",
        desc: "Meters, invoices, ERP exports, BOMs, production logs, supplier files and logistics records live in separate systems and spreadsheets.",
      },
      {
        icon: Network,
        title: "Scope 3 and supplier evidence are hard to connect",
        desc: "Supplier data often arrives late, at different levels of detail, with inconsistent units, boundaries and supporting evidence.",
      },
      {
        icon: ShieldAlert,
        title: "Numbers are difficult to defend",
        desc: "A carbon result without factor snapshots, evidence links, versions and review history is hard to reproduce or prepare for independent verification.",
      },
      {
        icon: Globe2,
        title: "One dataset must serve many markets",
        desc: "Domestic GHG/MRV, GHG Protocol, ISO, buyer PCF, DPP and CBAM each need different outputs, while the underlying activity data should remain governed once.",
      },
    ],
  } : {
    eyebrow: "KHOẢNG TRỐNG DỮ LIỆU CỦA DOANH NGHIỆP CÔNG NGHIỆP",
    title: "Yêu cầu thị trường đang đi nhanh hơn hạ tầng dữ liệu của doanh nghiệp",
    intro: "Doanh nghiệp không thiếu checklist tuân thủ. Điều còn thiếu là một lớp dữ liệu đủ tin cậy để cùng dữ liệu vận hành có thể phục vụ kiểm kê GHG, carbon sản phẩm, yêu cầu buyer và các báo cáo theo từng thị trường.",
    items: [
      {
        icon: FileSpreadsheet,
        title: "Dữ liệu carbon nằm rải rác",
        desc: "Đồng hồ đo, hóa đơn, dữ liệu ERP, BOM, nhật ký sản xuất, file nhà cung cấp và logistics thường nằm ở nhiều hệ thống và bảng tính khác nhau.",
      },
      {
        icon: Network,
        title: "Scope 3 và bằng chứng nhà cung cấp khó kết nối",
        desc: "Dữ liệu từ nhà cung cấp thường đến chậm, khác mức chi tiết, không đồng nhất đơn vị, boundary và chứng từ đi kèm.",
      },
      {
        icon: ShieldAlert,
        title: "Có số nhưng khó chứng minh",
        desc: "Một kết quả carbon thiếu factor snapshot, evidence, version và lịch sử review sẽ khó tái lập và khó chuẩn bị cho xác minh độc lập.",
      },
      {
        icon: Globe2,
        title: "Một bộ dữ liệu phải phục vụ nhiều thị trường",
        desc: "GHG/MRV nội địa, GHG Protocol, ISO, buyer PCF, DPP và CBAM cần đầu ra khác nhau, nhưng dữ liệu hoạt động gốc chỉ nên được quản trị một lần.",
      },
    ],
  };

  return (
    <section id="problem" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center mb-14">
          <span className="inline-block px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold tracking-wide mb-4">
            {copy.eyebrow}
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
            {copy.title}
          </h2>
          <p className="text-muted-foreground leading-7">
            {copy.intro}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {copy.items.map((it) => (
            <div key={it.title} className="interactive-surface glass-panel rounded-2xl border border-white/70 bg-card/70 p-6">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                <it.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold mb-2">{it.title}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Problem;
