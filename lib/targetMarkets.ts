export const TARGET_MARKET_OPTIONS = [
  { code: "VN", labelVi: "Việt Nam", labelEn: "Vietnam" },
  { code: "EU", labelVi: "Liên minh Châu Âu", labelEn: "European Union" },
  { code: "US", labelVi: "Hoa Kỳ", labelEn: "United States" },
  { code: "JP", labelVi: "Nhật Bản", labelEn: "Japan" },
  { code: "KR", labelVi: "Hàn Quốc", labelEn: "South Korea" },
  { code: "AU", labelVi: "Úc", labelEn: "Australia" },
  { code: "ASEAN", labelVi: "ASEAN", labelEn: "ASEAN" },
  { code: "TH", labelVi: "Thái Lan", labelEn: "Thailand" },
  { code: "SG", labelVi: "Singapore", labelEn: "Singapore" },
  { code: "MY", labelVi: "Malaysia", labelEn: "Malaysia" },
  { code: "ID", labelVi: "Indonesia", labelEn: "Indonesia" },
  { code: "PH", labelVi: "Philippines", labelEn: "Philippines" },
  { code: "CA", labelVi: "Canada", labelEn: "Canada" },
  { code: "UK", labelVi: "Vương quốc Anh", labelEn: "United Kingdom" },
  { code: "CN", labelVi: "Trung Quốc", labelEn: "China" },
  { code: "IN", labelVi: "Ấn Độ", labelEn: "India" }
] as const;

export type TargetMarketCode = typeof TARGET_MARKET_OPTIONS[number]["code"];

export const DEFAULT_DOMESTIC_MARKET_CODE: TargetMarketCode = "VN";

export const TARGET_MARKET_CODE_SET = new Set<string>(
  TARGET_MARKET_OPTIONS.map((option) => option.code)
);

const EU_COUNTRY_CODES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"
]);

const REGION_TO_MARKET: Record<string, TargetMarketCode> = {
  VN: "VN",
  US: "US",
  JP: "JP",
  KR: "KR",
  AU: "AU",
  TH: "TH",
  SG: "SG",
  MY: "MY",
  ID: "ID",
  PH: "PH",
  CA: "CA",
  GB: "UK",
  UK: "UK",
  CN: "CN",
  IN: "IN"
};

const parseRegionFromLocale = (value: string | null | undefined): string => {
  if (!value) return "";
  const normalized = String(value).trim().replace("_", "-");
  const segments = normalized.split("-");
  const maybeRegion = segments[segments.length - 1]?.toUpperCase() || "";
  return maybeRegion.length === 2 ? maybeRegion : "";
};

export const resolveDomesticMarketCode = (
  appLocale: string,
  browserLocale?: string
): TargetMarketCode => {
  const browserRegion = parseRegionFromLocale(browserLocale);
  if (browserRegion) {
    if (EU_COUNTRY_CODES.has(browserRegion)) return "EU";
    const mappedFromBrowser = REGION_TO_MARKET[browserRegion];
    if (mappedFromBrowser) return mappedFromBrowser;
  }

  const appRegion = parseRegionFromLocale(appLocale);
  if (appRegion) {
    if (EU_COUNTRY_CODES.has(appRegion)) return "EU";
    const mappedFromAppRegion = REGION_TO_MARKET[appRegion];
    if (mappedFromAppRegion) return mappedFromAppRegion;
  }

  if (String(appLocale || "").toLowerCase().startsWith("vi")) return "VN";
  return "US";
};

export const normalizeTargetMarkets = (value: unknown): TargetMarketCode[] => {
  if (!Array.isArray(value)) return [];

  const normalized = value
    .map((entry) => String(entry || "").trim().toUpperCase())
    .filter((entry) => TARGET_MARKET_CODE_SET.has(entry));

  return [...new Set(normalized)] as TargetMarketCode[];
};

export const normalizeDomesticMarketCode = (
  value: unknown,
  fallbackTargetMarkets?: unknown
): TargetMarketCode => {
  const normalizedValue = String(value || "").trim().toUpperCase();
  if (TARGET_MARKET_CODE_SET.has(normalizedValue)) {
    return normalizedValue as TargetMarketCode;
  }

  const fallbackMarkets = normalizeTargetMarkets(fallbackTargetMarkets);
  if (fallbackMarkets.length > 0) {
    return fallbackMarkets[0];
  }

  return DEFAULT_DOMESTIC_MARKET_CODE;
};

export const formatTargetMarketLabel = (code: string, locale: string) => {
  const matched = TARGET_MARKET_OPTIONS.find((option) => option.code === code);
  if (!matched) return code;

  if (locale === "vi") {
    return `${matched.code} - ${matched.labelVi}`;
  }

  return `${matched.code} - ${matched.labelEn}`;
};
