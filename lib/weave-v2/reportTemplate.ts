export const WEAVE_V2_TEMPLATE_KEY = "WEAVE_CARBON_TEMPLATE_v2.0";

export const WEAVE_V2_COLORS = {
  primary: "#1B4332",
  secondary: "#2D6A4F",
  success: "#0B8F54",
  teal: "#0F766E",
  red: "#B92D2B",
  redSoft: "#FDE2E2",
  warning: "#FFD166",
  formula: "#F4F6F7",
  input: "#FFFFFF",
  border: "#CFE0D8",
  muted: "#5D7C72"
} as const;

export const REPORT_TABS_V2 = [
  { key: "overview", label: "Tổng quan", sheetName: "Dashboard Tổng Quan" },
  { key: "input", label: "Nhập liệu", sheetName: "Nhập Liệu Sản Phẩm" },
  { key: "iso14067", label: "ISO 14067", sheetName: "ISO 14067" },
  { key: "esgTt01", label: "ESG TT01", sheetName: "ESG TT01" },
  { key: "cbamEu", label: "CBAM EU", sheetName: "CBAM EU" }
] as const;

export const OFFICIAL_CBAM_TABS = [
  "A_INSTDATA",
  "B_EMINST",
  "C_EMISSIONS_ENERGY",
  "D_PROCESSES",
  "E_PURCHPREC",
  "SUMMARY_COMMUNICATION"
] as const;

export const REPORT_SOURCES_V2 = [
  "Higg MSI v3.10",
  "Ecoinvent v3.10",
  "UK DEFRA 2024",
  "Bộ TN&MT VN",
  "ISO 14067:2018",
  "EU Reg 2023/1773 - DG TAXUD CBAM"
];

export const REPORT_CONSTANTS_V2 = {
  cbamPriceEurPerTonne: 85,
  vnGridFactorKgPerKwh: 0.6766,
  ecoinventDefaultCotton: 8.55,
  ecoinventOptimalCotton: 5.9,
  defraTruck40tKgPerTonneKm: 0.0795
};
