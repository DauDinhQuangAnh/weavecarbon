export const MARKET_CODES = [
  "VN",
  "EU",
  "US",
  "JP",
  "KR",
  "AU",
  "ASEAN",
  "TH",
  "SG",
  "MY",
  "ID",
  "PH",
  "CA",
  "UK",
  "CN",
  "IN"
] as const;

export type MarketCode = typeof MARKET_CODES[number];

export type ComplianceStatus = "draft" | "incomplete" | "ready" | "verified";

export type Priority = "mandatory" | "important" | "recommended";

export type DocumentStatus = "missing" | "uploaded" | "approved" | "expired";

export interface MarketRegulation {
  code: string;
  name: string;
  legalReference: string;
  guideUrl: string;
  reportingScope: string;
  reportingFrequency: string;
  enforcementDate: string;
  description: string;
}

export interface ComplianceDocument {
  id: string;
  code?: string;
  name: string;
  type: string;
  required: boolean;
  status: DocumentStatus;
  downloadUrl?: string;
  uploadedBy?: string;
  uploadedDate?: string;
  validFrom?: string;
  validTo?: string;
  linkedProducts?: string[];
}

export interface CarbonDataItem {
  scope: "scope1" | "scope2" | "scope3";
  value: number | null;
  unit: string;
  methodology: string;
  dataSource: string;
  reportingPeriod: string;
  isComplete: boolean;
}

export interface ProductScopeItem {
  productId: string;
  productName: string;
  hsCode: string;
  productionSite: string;
  exportVolume: number;
  unit: string;
}

export interface EmissionFactor {
  name: string;
  source: string;
  version: string;
  appliedDate: string;
}

export interface Recommendation {
  id: string;
  apiIdCandidates?: string[];
  relatedDocumentId?: string;
  type: "document" | "carbon_data" | "verification" | "product_scope";
  missingItem: string;
  regulatoryReason: string;
  businessImpact: string;
  recommendedAction: string[];
  priority: Priority;
  ctaLabel: string;
  ctaAction: string;
  status: "active" | "completed" | "ignored";
}

export interface MarketCompliance {
  market: MarketCode;
  marketName: string;
  regulation: MarketRegulation;
  score: number;
  status: ComplianceStatus;
  lastUpdated: string;
  requiredDocuments: string[];
  requiredDocumentsCount: number;
  requiredDocumentsUploadedCount: number;
  requiredDocumentsMissingCount: number;
  documentsTotalCount: number;
  documentsUploadedCount: number;
  documentsMissingCount: number;
  documents: ComplianceDocument[];
  carbonData: CarbonDataItem[];
  productScope: ProductScopeItem[];
  emissionFactors: EmissionFactor[];
  recommendations: Recommendation[];
  verificationRequired: boolean;
  verifiedBy?: string;
  verificationStatus?: "pending" | "verified" | "rejected";
  approvalNote?: string;
}

export const MARKET_DOCUMENT_REQUIREMENTS: Partial<
  Record<MarketCode, { name: string; required: boolean }[]>
> = {
  VN: [
    { name: "Domestic goods labeling (Vietnamese)", required: true },
    { name: "Basic import dossier (declaration, invoice, packing list, transport docs)", required: true },
    { name: "Certificate of Origin / FTA document", required: false },
    { name: "RSL/MRSL + chemical tests (azo/formaldehyde)", required: false },
    { name: "Buyer certifications (OEKO-TEX/GRS)", required: false }
  ],
  EU: [
    { name: "Textile fibre composition labeling", required: true },
    { name: "Country-of-origin marking (market/buyer specific)", required: true },
    { name: "REACH market-access compliance declaration", required: true },
    { name: "Certificate of Origin / Origin declaration (EVFTA, etc.)", required: false },
    { name: "Chemical test report (AZO, formaldehyde, nickel for trims)", required: false },
    { name: "Buyer certifications (OEKO-TEX/GRS)", required: false },
    { name: "EPD/PCF dossier (buyer-required)", required: false }
  ],
  US: [
    { name: "FTC textile labeling package (fiber, RN/ID, care)", required: true },
    { name: "Country-of-origin marking", required: true },
    { name: "CPSIA test package for children's apparel (lead/phthalates)", required: false },
    { name: "Flammability test report (16 CFR 1610, where applicable)", required: false },
    { name: "Retailer-specific test reports", required: false },
    { name: "ESG/social audit package", required: false }
  ],
  JP: [
    { name: "Japan textile labeling package (fiber/care/market labels)", required: true },
    { name: "Formaldehyde test report", required: false },
    { name: "Certificate of Origin / FTA document", required: false },
    { name: "RSL/MRSL dossier", required: false },
    { name: "Buyer certifications (OEKO-TEX)", required: false }
  ],
  KR: [
    { name: "Korea textile labeling package (fiber/care labels)", required: true },
    { name: "Buyer-required chemical safety test report", required: false },
    { name: "Certificate of Origin / FTA document", required: false },
    { name: "ESG/social audit package", required: false }
  ],
  AU: [
    { name: "Country-of-origin representation/labeling", required: true },
    { name: "Fiber composition and care labeling (market-required)", required: true },
    { name: "Basic import dossier", required: true },
    { name: "Certificate of Origin / FTA document", required: false },
    { name: "Buyer-required chemical tests (azo/formaldehyde)", required: false },
    { name: "Buyer certifications (OEKO-TEX/GRS)", required: false }
  ],
  ASEAN: [
    { name: "Certificate of Origin Form D (ATIGA claim)", required: true },
    { name: "BOM and Rules of Origin records", required: false },
    { name: "Supplier declaration package", required: false },
    { name: "Buyer-required test and ESG/audit documents", required: false }
  ],
  TH: [
    { name: "Thailand domestic textile labeling package", required: true },
    { name: "Basic import dossier", required: true },
    { name: "Certificate of Origin / FTA document", required: false },
    { name: "Buyer-required test reports", required: false },
    { name: "RSL/MRSL dossier", required: false }
  ],
  SG: [
    { name: "Import permit (TradeNet)", required: true },
    { name: "Basic import dossier", required: true },
    { name: "Retail labeling compliance package (where applicable)", required: true },
    { name: "Certificate of Origin / FTA document", required: false },
    { name: "Buyer certifications", required: false },
    { name: "Digitized document retention package", required: false }
  ],
  MY: [
    { name: "Basic import dossier", required: true },
    { name: "Malaysia domestic labeling package", required: true },
    { name: "Proof of origin package (CO/DOO/e-Form D)", required: false },
    { name: "Buyer-required test reports", required: false },
    { name: "ESG/social audit package", required: false }
  ],
  ID: [
    { name: "Bahasa Indonesia labeling package", required: true },
    { name: "Basic import dossier", required: true },
    { name: "SNI compliance dossier (if applicable)", required: false },
    { name: "Halal supporting dossier (special products)", required: false },
    { name: "Certificate of Origin / FTA document", required: false },
    { name: "Buyer-required test reports", required: false }
  ],
  PH: [
    { name: "Philippines domestic labeling package", required: true },
    { name: "Basic import dossier", required: true },
    { name: "Certificate of Origin / FTA document", required: false },
    { name: "Buyer-required test reports", required: false },
    { name: "ESG/social audit package", required: false }
  ],
  CA: [
    { name: "Bilingual labeling package (English/French)", required: true },
    { name: "Basic import dossier", required: true },
    { name: "Proof of origin package (CPTPP, etc.)", required: false },
    { name: "Buyer-required test reports", required: false },
    { name: "ESG/social audit package", required: false }
  ],
  UK: [
    { name: "UK textile labeling package", required: true },
    { name: "UK import dossier (EORI GB + import declaration)", required: true },
    { name: "Origin declaration for preferential claim", required: false },
    { name: "UK REACH compliance dossier", required: false },
    { name: "Buyer-required test reports", required: false },
    { name: "ESG/social audit package", required: false }
  ],
  CN: [
    { name: "Chinese labeling package", required: true },
    { name: "Market-access chemical compliance dossier", required: true },
    { name: "GB/industry standard test reports", required: false },
    { name: "Certificate of Origin / FTA document", required: false },
    { name: "Buyer traceability package", required: false }
  ],
  IN: [
    { name: "India domestic labeling package", required: true },
    { name: "Basic import dossier", required: true },
    { name: "BIS/QCO dossier (if mandatory list applies)", required: false },
    { name: "Buyer-required test reports", required: false },
    { name: "Certificate of Origin / FTA document", required: false }
  ]
};

export const MARKET_REGULATIONS: Record<MarketCode, MarketRegulation> = {
  VN: {
    code: "VN GHG",
    name: "Vietnam GHG Inventory",
    legalReference: "Decree 06/2022/ND-CP",
    guideUrl: "https://www.monre.gov.vn/",
    reportingScope: "Company and facility level",
    reportingFrequency: "Annual",
    enforcementDate: "2026-01-01",
    description: "Vietnam domestic GHG reporting and MRV requirements."
  },
  EU: {
    code: "EU CBAM",
    name: "Carbon Border Adjustment Mechanism",
    legalReference: "Regulation (EU) 2023/956",
    guideUrl: "https://eur-lex.europa.eu/",
    reportingScope: "Product level",
    reportingFrequency: "Quarterly",
    enforcementDate: "2026-01-01",
    description: "EU carbon border mechanism and product compliance requirements."
  },
  US: {
    code: "US Climate Act",
    name: "California Climate Corporate Data Accountability Act",
    legalReference: "SB 253 and SB 261",
    guideUrl: "https://ww2.arb.ca.gov/",
    reportingScope: "Company and product level",
    reportingFrequency: "Annual",
    enforcementDate: "2026-01-01",
    description: "Mandatory GHG disclosure requirements for US markets."
  },
  JP: {
    code: "JIS Standards",
    name: "Japanese Industrial Standards",
    legalReference: "JIS Q 14067",
    guideUrl: "https://www.jisc.go.jp/",
    reportingScope: "Product level",
    reportingFrequency: "Annual",
    enforcementDate: "2025-04-01",
    description: "Japan standards for product carbon footprint declarations."
  },
  KR: {
    code: "K-ETS",
    name: "Korea Emissions Trading Scheme",
    legalReference: "Act on Allocation and Trading of GHG Emission Permits",
    guideUrl: "https://www.gir.go.kr/",
    reportingScope: "Facility and product level",
    reportingFrequency: "Annual",
    enforcementDate: "2025-01-01",
    description: "Korea ETS and carbon disclosure requirements."
  },
  AU: {
    code: "AU NGER",
    name: "Australia Climate Reporting",
    legalReference: "NGER Act and related guidance",
    guideUrl: "https://www.dcceew.gov.au/",
    reportingScope: "Company and product level",
    reportingFrequency: "Annual",
    enforcementDate: "2026-01-01",
    description: "Australia product and corporate carbon disclosure baseline."
  },
  ASEAN: {
    code: "ASEAN Baseline",
    name: "ASEAN Sustainability Baseline",
    legalReference: "ASEAN sustainability and trade framework",
    guideUrl: "https://asean.org/",
    reportingScope: "Product level",
    reportingFrequency: "Annual",
    enforcementDate: "2026-01-01",
    description: "ASEAN regional baseline for sustainable export documentation."
  },
  TH: {
    code: "TH Import",
    name: "Thailand Import Compliance",
    legalReference: "Thailand labeling and import guidance",
    guideUrl: "https://www.customs.go.th/",
    reportingScope: "Product level",
    reportingFrequency: "Annual",
    enforcementDate: "2026-01-01",
    description: "Thailand import registration and labeling compliance."
  },
  SG: {
    code: "SG CPSR",
    name: "Singapore Product Safety",
    legalReference: "CPSR and product safety requirements",
    guideUrl: "https://www.enterprisesg.gov.sg/",
    reportingScope: "Product level",
    reportingFrequency: "Annual",
    enforcementDate: "2026-01-01",
    description: "Singapore product safety and sustainability documentation."
  },
  MY: {
    code: "MY Import",
    name: "Malaysia Import Compliance",
    legalReference: "Malaysia customs and labeling requirements",
    guideUrl: "https://www.customs.gov.my/",
    reportingScope: "Product level",
    reportingFrequency: "Annual",
    enforcementDate: "2026-01-01",
    description: "Malaysia import documentation and carbon disclosure baseline."
  },
  ID: {
    code: "ID SNI",
    name: "Indonesia Product Compliance",
    legalReference: "SNI and Indonesia import requirements",
    guideUrl: "https://www.bsni.go.id/",
    reportingScope: "Product level",
    reportingFrequency: "Annual",
    enforcementDate: "2026-01-01",
    description: "Indonesia product standard and sustainability compliance."
  },
  PH: {
    code: "PH Import",
    name: "Philippines Import Compliance",
    legalReference: "Philippines import and labeling guidance",
    guideUrl: "https://customs.gov.ph/",
    reportingScope: "Product level",
    reportingFrequency: "Annual",
    enforcementDate: "2026-01-01",
    description: "Philippines import and sustainability documentation baseline."
  },
  CA: {
    code: "CA Climate",
    name: "Canada Climate Disclosure",
    legalReference: "Canada sustainability and climate disclosure guidance",
    guideUrl: "https://www.canada.ca/",
    reportingScope: "Company and product level",
    reportingFrequency: "Annual",
    enforcementDate: "2026-01-01",
    description: "Canada climate and sustainable export requirements."
  },
  UK: {
    code: "UK Carbon",
    name: "United Kingdom Carbon Compliance",
    legalReference: "UK ETS and environmental reporting guidance",
    guideUrl: "https://www.gov.uk/",
    reportingScope: "Company and product level",
    reportingFrequency: "Annual",
    enforcementDate: "2026-01-01",
    description: "UK market carbon and product compliance baseline."
  },
  CN: {
    code: "CN Carbon",
    name: "China Carbon Compliance",
    legalReference: "China emissions and product regulation guidance",
    guideUrl: "https://english.mee.gov.cn/",
    reportingScope: "Company and product level",
    reportingFrequency: "Annual",
    enforcementDate: "2026-01-01",
    description: "China market carbon data and import compliance baseline."
  },
  IN: {
    code: "IN ESG",
    name: "India Sustainability Compliance",
    legalReference: "India ESG and product compliance guidance",
    guideUrl: "https://www.india.gov.in/",
    reportingScope: "Company and product level",
    reportingFrequency: "Annual",
    enforcementDate: "2026-01-01",
    description: "India export sustainability and carbon disclosure baseline."
  }
};

export const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; color: string; bgColor: string }
> = {
  mandatory: {
    label: "Bắt buộc",
    color: "text-red-700",
    bgColor: "bg-red-100"
  },
  important: {
    label: "Quan trọng",
    color: "text-orange-700",
    bgColor: "bg-orange-100"
  },
  recommended: {
    label: "Nên có",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100"
  }
};

export const STATUS_CONFIG: Record<
  ComplianceStatus,
  { label: string; color: string; bgColor: string }
> = {
  draft: { label: "Nháp", color: "text-gray-700", bgColor: "bg-gray-100" },
  incomplete: {
    label: "Chưa hoàn thiện",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100"
  },
  ready: {
    label: "Sẵn sàng xuất khẩu",
    color: "text-green-700",
    bgColor: "bg-green-100"
  },
  verified: {
    label: "Đã xác minh",
    color: "text-blue-700",
    bgColor: "bg-blue-100"
  }
};

export const DOCUMENT_STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; color: string; bgColor: string }
> = {
  missing: { label: "Chưa có", color: "text-red-700", bgColor: "bg-red-100" },
  uploaded: {
    label: "Đã tải lên",
    color: "text-blue-700",
    bgColor: "bg-blue-100"
  },
  approved: {
    label: "Đã duyệt",
    color: "text-green-700",
    bgColor: "bg-green-100"
  },
  expired: {
    label: "Hết hạn",
    color: "text-orange-700",
    bgColor: "bg-orange-100"
  }
};
