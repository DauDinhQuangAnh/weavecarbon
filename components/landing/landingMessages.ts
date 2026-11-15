// Bilingual landing copy. Content follows the WeaveCarbon Lovable reference;
// presentation (sections, motion, layout) follows the weavecarbon1 landing.
export type LandingLanguage = "vi" | "en";

const vi = {
  navigation: {
    problem: "Vấn đề",
    solution: "Giải pháp",
    howItWorks: "Cách hoạt động",
    reports: "Báo cáo mẫu",
    pricing: "Gói dịch vụ",
    login: "Đăng nhập",
    signup: "Đăng ký doanh nghiệp",
    trial: "Dùng thử B2B",
    starting: "Đang mở demo...",
    menu: "Mở/đóng menu",
    language: "Chọn ngôn ngữ",
  },
  hero: {
    badge: "Hạ tầng dữ liệu carbon cho doanh nghiệp sản xuất",
    titleLead: "Hạ tầng dữ liệu ",
    titleHighlight: "carbon và rủi ro khí hậu",
    titleTail: " cho chuỗi cung ứng công nghiệp",
    subtitle:
      "Biến dữ liệu vận hành, nhà cung ứng và IoT phân mảnh thành hồ sơ carbon có thể truy xuất, thông tin rủi ro khí hậu và đầu ra sẵn sàng cho review, xác minh trên toàn chuỗi cung ứng công nghiệp.",
    cta: { start: "Đăng nhập", calculate: "Tính toán ngay" },
    trust: "Dành cho doanh nghiệp sản xuất và chuỗi cung ứng xuất khẩu",
  },
  features: {
    badge: "Tính năng",
    title: "Từ chứng từ rời rạc đến dữ liệu có truy vết",
    subtitle:
      "Thu thập, chuẩn hóa, tính toán và quản trị bằng chứng carbon trên một lớp dữ liệu chung cho nhà máy, sản phẩm và nhà cung ứng.",
    docAI: {
      title: "AI hỗ trợ đọc chứng từ",
      desc: "Tải hóa đơn điện, nhiên liệu, phiếu cân, BOM hay file Excel để AI đề xuất dữ liệu trích xuất; người phụ trách rà soát trước khi đưa vào tính toán.",
    },
    carbonProxy: {
      title: "Carbon Engine có phiên bản",
      desc: "Tính Scope 1, 2, 3 và phát thải quá trình theo registry hệ số có phiên bản; phần dữ liệu thiếu được đánh dấu proxy để tiếp tục bổ sung.",
    },
    auditTrail: {
      title: "Đồ thị bằng chứng & nhật ký kiểm toán",
      desc: "Mỗi chứng từ có trạng thái kiểm soát, mã băm SHA-256 và nhật ký thay đổi, liên kết Hoạt động → Bằng chứng → Hệ số → Tính toán → Báo cáo.",
    },
    cbamDpp: {
      title: "Hồ sơ CBAM & hộ chiếu sản phẩm",
      desc: "Chuẩn bị dữ liệu phát thải nhúng theo CN code cho thép, xi măng, nhôm, phân bón và dữ liệu sẵn sàng cho hộ chiếu sản phẩm số (DPP).",
    },
    dataGap: {
      title: "Kiểm tra khoảng trống dữ liệu",
      desc: "Đánh giá độ đầy đủ dữ liệu theo cơ sở, quy trình và sản phẩm, chỉ ra chứng từ còn thiếu và mức chất lượng dữ liệu L1–L5.",
    },
    transportCalc: {
      title: "Logistics & bản đồ tuyến",
      desc: "Tính phát thải vận chuyển theo từng chặng đường bộ, biển, sắt, hàng không và hiển thị lô hàng trên bản đồ tuyến.",
    },
    exportReady: {
      title: "Ma trận pháp lý & thị trường",
      desc: "Ánh xạ sản phẩm sang yêu cầu nội địa (NĐ 06/2022, MRV) và thị trường xuất khẩu (EU CBAM, EUDR, PCF theo bên mua) cùng danh sách dữ liệu cần bổ sung.",
    },
    recommendations: {
      title: "Kịch bản giảm phát thải",
      desc: "Mô phỏng thay đổi nhiên liệu, điện tái tạo, tỷ lệ phế liệu hay clinker để ước tính mức giảm và ưu tiên hành động.",
    },
    circularHub: {
      title: "Nhà cung ứng & rủi ro khí hậu",
      desc: "Gửi yêu cầu dữ liệu Scope 3 tới nhà cung ứng, chấm điểm ESG và đánh giá rủi ro khí hậu vật lý cho nhà máy, vùng nguyên liệu.",
    },
  },
  howItWorks: {
    badge: "Cách hoạt động",
    title: "Cách hoạt động",
    subtitle: "Bốn bước từ chứng từ vận hành đến hồ sơ carbon có thể truy xuất",
    step1: {
      title: "Kết nối dữ liệu",
      desc: "Tải chứng từ, nhập Excel/ERP hoặc kết nối IoT — AI đọc và bóc tách số liệu hoạt động",
      item1: "Ảnh, PDF, Excel, ERP",
      item2: "AI bóc tách số liệu",
      item3: "Đồng hồ IoT & WeaveNode",
    },
    step2: {
      title: "Tính toán phát thải",
      desc: "Carbon Engine tính CO₂e theo cơ sở, quy trình và sản phẩm với registry hệ số có phiên bản",
      item1: "Registry hệ số có phiên bản",
      item2: "Scope 1-2-3 & phát thải quá trình",
      item3: "Kiểm tra khoảng trống",
    },
    step3: {
      title: "Kiểm soát & truy vết",
      desc: "Khóa chứng từ, gắn mức bằng chứng và lưu lịch sử thay đổi cho từng con số",
      item1: "Mức bằng chứng L0–L5",
      item2: "Mã băm SHA-256",
      item3: "Nhật ký thay đổi",
    },
    step4: {
      title: "Xuất báo cáo",
      desc: "Một bộ dữ liệu, nhiều đầu ra: kiểm kê KNK Việt Nam, EU CBAM, ISO 14064/14067 và hồ sơ cho bên mua",
      item1: "Hồ sơ EU CBAM",
      item2: "Kiểm kê KNK & MRV Việt Nam",
      item3: "PCF cho bên mua & sẵn sàng DPP",
    },
  },
  stats: {
    badge: "Năng lực nền tảng",
    title: "Tính có phiên bản, truy ngược được nguồn dữ liệu",
    subtitle:
      "Registry hệ số, phương pháp có phiên bản và mã băm chứng từ giúp tái hiện mọi con số từ đầu vào đến báo cáo.",
    docTypes: { title: "Loại chứng từ", description: "Hóa đơn điện, nhiên liệu, phiếu cân, BOM, vận đơn, tờ khai NCC…" },
    verification: { title: "Mức kiểm soát bằng chứng", description: "Từ chứng từ mới tải đến bằng chứng bên thứ ba được ghi nhận" },
    markets: { title: "Bối cảnh thị trường", description: "Việt Nam, EU, Mỹ, Nhật Bản và các yêu cầu của bên mua" },
    stages: { title: "Giai đoạn phát thải", description: "Nguyên liệu, sản xuất, năng lượng, vận chuyển" },
  },
  cta: {
    badge: "Bắt đầu ngay",
    title: "Bắt đầu xây dựng hạ tầng dữ liệu carbon",
    subtitle: "Từ chứng từ hiện có, xây dựng bộ dữ liệu carbon có nguồn gốc rõ ràng cho nhà máy, sản phẩm và chuỗi cung ứng",
    email: "Email công việc",
    button: "Đăng ký tư vấn",
    submitting: "Đang gửi...",
    success: "Chúng tôi đã nhận được thông tin liên hệ. Vui lòng kiểm tra email của bạn.",
    error: "Hiện chưa thể gửi yêu cầu liên hệ. Vui lòng thử lại.",
    invalidEmail: "Vui lòng nhập địa chỉ email hợp lệ.",
    terms: "Bằng việc đăng ký, bạn đồng ý với Điều khoản và Chính sách Bảo mật của chúng tôi",
  },
  footer: {
    desc: "WeaveCarbon xây dựng hạ tầng dữ liệu carbon và rủi ro khí hậu cho doanh nghiệp sản xuất và chuỗi cung ứng xuất khẩu, giúp quản trị dữ liệu hoạt động, bằng chứng, tính toán và đầu ra báo cáo cho nhiều yêu cầu khác nhau.",
    platform: "Nền tảng",
    company: "Công ty",
    resources: "Tài nguyên",
    contact: "Liên hệ",
    representative: "Người đại diện dự án",
    rights: "Bảo lưu mọi quyền.",
    disclaimer:
      "WeaveCarbon chuẩn bị dữ liệu và hồ sơ báo cáo có bằng chứng. Nền tảng không thay thế đơn vị xác minh độc lập và không phát hành chứng nhận, hạn ngạch hay tín chỉ carbon.",
    links: {
      ingestion: "Kết nối dữ liệu công nghiệp",
      engine: "Carbon Engine",
      evidence: "Đồ thị bằng chứng",
      adapters: "Bộ chuyển đổi báo cáo",
      problem: "Vấn đề",
      solution: "Giải pháp",
      why: "Vì sao WeaveCarbon",
      pricing: "Gói dịch vụ",
      samples: "Đầu ra mẫu",
      demo: "Không gian demo",
      advisory: "Liên hệ tư vấn",
    },
    privacy: "Bảo mật",
    terms: "Điều khoản",
    cookies: "Cookie",
  },
  userType: {
    title: "Bạn là ai?",
    b2b: "Doanh nghiệp B2B",
    b2bDesc: "Nhà máy sản xuất, doanh nghiệp xuất khẩu và chuỗi cung ứng công nghiệp",
    b2c: "Cá nhân B2C",
    b2cDesc: "Người dùng cá nhân tham gia chương trình tuần hoàn",
    orTry: "hoặc dùng thử",
    demoB2B: "Demo B2B",
    demoB2C: "Demo B2C",
    demoComingSoon: "Mở demo B2C.",
  },
  auth: {
    error: "Lỗi",
    loading: "Đang xử lý...",
  },
};

type Messages = typeof vi;

const en: Messages = {
  navigation: {
    problem: "Problem",
    solution: "Solution",
    howItWorks: "How it works",
    reports: "Sample reports",
    pricing: "Pricing",
    login: "Log in",
    signup: "Business sign-up",
    trial: "Try B2B",
    starting: "Starting demo...",
    menu: "Toggle menu",
    language: "Choose language",
  },
  hero: {
    badge: "Industrial carbon data infrastructure for manufacturers",
    titleLead: "Industrial ",
    titleHighlight: "carbon & climate risk",
    titleTail: " data infrastructure",
    subtitle:
      "Turn fragmented operational, supplier and IoT data into traceable carbon evidence, climate-risk intelligence and verification-ready outputs across industrial supply chains.",
    cta: { start: "Log in", calculate: "Calculate now" },
    trust: "Built for industrial manufacturers and export supply chains",
  },
  features: {
    badge: "Capabilities",
    title: "From scattered documents to traceable carbon data",
    subtitle:
      "Collect, normalise, calculate and govern carbon evidence on one shared data layer for facilities, products and suppliers.",
    docAI: {
      title: "AI-assisted document capture",
      desc: "Upload electricity and fuel invoices, weighbridge tickets, BOMs or spreadsheets; AI proposes extracted activity data for review before it enters any calculation.",
    },
    carbonProxy: {
      title: "Versioned Carbon Engine",
      desc: "Calculate Scope 1, 2, 3 and process emissions against a versioned emission-factor registry; data gaps are flagged as proxies until primary data is supplied.",
    },
    auditTrail: {
      title: "Evidence Graph & Audit Trail",
      desc: "Every document carries a control status, SHA-256 hash and change log, linking Activity → Evidence → Factor → Calculation → Report.",
    },
    cbamDpp: {
      title: "CBAM & product passport data",
      desc: "Prepare CN-code-level embedded emissions for steel, cement, aluminium and fertilisers, plus product data ready for Digital Product Passport requirements.",
    },
    dataGap: {
      title: "Data gap analysis",
      desc: "Assess data completeness by facility, process and product, surface missing evidence and grade data quality from L1 to L5.",
    },
    transportCalc: {
      title: "Logistics & route mapping",
      desc: "Calculate transport emissions leg by leg across road, sea, rail and air, and visualise every shipment on an interactive route map.",
    },
    exportReady: {
      title: "Regulatory & market matrix",
      desc: "Map each product to domestic requirements (Decree 06/2022, MRV) and export markets (EU CBAM, EUDR, buyer PCF), with a clear list of data still required.",
    },
    recommendations: {
      title: "Decarbonisation scenarios",
      desc: "Model fuel switching, renewable electricity, scrap ratio or clinker substitution to estimate abatement and prioritise action.",
    },
    circularHub: {
      title: "Supplier & climate risk",
      desc: "Issue Scope 3 data requests to suppliers, score ESG performance and assess physical climate risk for plants and sourcing regions.",
    },
  },
  howItWorks: {
    badge: "How it works",
    title: "How it works",
    subtitle: "Four steps from operational records to traceable carbon evidence",
    step1: {
      title: "Connect data",
      desc: "Upload documents, import Excel/ERP or connect IoT meters — AI reads and extracts activity data",
      item1: "Images, PDF, Excel, ERP",
      item2: "AI data extraction",
      item3: "IoT meters & WeaveNode",
    },
    step2: {
      title: "Calculate emissions",
      desc: "The Carbon Engine computes CO₂e by facility, process and product against a versioned factor registry",
      item1: "Versioned factor registry",
      item2: "Scope 1-2-3 & process emissions",
      item3: "Data gap checks",
    },
    step3: {
      title: "Control & trace",
      desc: "Lock evidence, assign evidence levels and keep a full change history behind every figure",
      item1: "Evidence levels L0–L5",
      item2: "SHA-256 hashing",
      item3: "Change log",
    },
    step4: {
      title: "Report",
      desc: "One dataset, many outputs: Vietnam GHG inventory, EU CBAM, ISO 14064/14067 and buyer packages",
      item1: "EU CBAM package",
      item2: "Vietnam GHG inventory & MRV",
      item3: "Buyer PCF & DPP readiness",
    },
  },
  stats: {
    badge: "Platform capability",
    title: "Versioned calculations, fully traceable to source",
    subtitle:
      "A factor registry, versioned methodologies and document hashing let every figure be reproduced from input to report.",
    docTypes: { title: "Document types", description: "Electricity and fuel invoices, weighbridge tickets, BOMs, bills of lading, supplier declarations…" },
    verification: { title: "Evidence control levels", description: "From newly uploaded documents to recorded third-party evidence" },
    markets: { title: "Market contexts", description: "Vietnam, EU, US, Japan and buyer-specific requirements" },
    stages: { title: "Emission stages", description: "Materials, production, energy, transport" },
  },
  cta: {
    badge: "Get started",
    title: "Start building your carbon data infrastructure",
    subtitle: "Turn the records you already have into a provenance-backed carbon dataset for facilities, products and supply chains",
    email: "Work email",
    button: "Request a consultation",
    submitting: "Sending...",
    success: "Thank you — we have received your details. Please check your inbox.",
    error: "We could not send your request right now. Please try again.",
    invalidEmail: "Please enter a valid email address.",
    terms: "By subscribing, you agree to our Terms of Service and Privacy Policy",
  },
  footer: {
    desc: "WeaveCarbon provides industrial carbon and climate data infrastructure for manufacturers and export supply chains, helping teams govern activity data, evidence, calculations and reporting outputs across multiple requirements.",
    platform: "Platform",
    company: "Company",
    resources: "Resources",
    contact: "Contact",
    representative: "Project representative",
    rights: "All rights reserved.",
    disclaimer:
      "WeaveCarbon prepares evidence-backed data and reporting packages. It does not replace an independent verifier or issue regulatory certificates, allowances or carbon credits.",
    links: {
      ingestion: "Industrial data ingestion",
      engine: "Carbon Engine",
      evidence: "Evidence Graph",
      adapters: "Reporting adapters",
      problem: "Problem",
      solution: "Solution",
      why: "Why WeaveCarbon",
      pricing: "Plans",
      samples: "Sample outputs",
      demo: "Demo Workspace",
      advisory: "Contact advisory",
    },
    privacy: "Privacy",
    terms: "Terms",
    cookies: "Cookies",
  },
  userType: {
    title: "Who are you?",
    b2b: "Business (B2B)",
    b2bDesc: "Manufacturers, exporters and industrial supply chains",
    b2c: "Individual (B2C)",
    b2cDesc: "Individuals taking part in circular programmes",
    orTry: "or try a demo",
    demoB2B: "B2B demo",
    demoB2C: "B2C demo",
    demoComingSoon: "Open the B2C demo.",
  },
  auth: {
    error: "Error",
    loading: "Processing...",
  },
};

export const landingMessages: Record<LandingLanguage, Messages> = { vi, en };
