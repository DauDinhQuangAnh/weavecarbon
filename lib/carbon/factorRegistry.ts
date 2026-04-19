import {
  MATERIAL_CATALOG,
  type CatalogMaterial
} from "@/components/dashboard/assessment/materialCatalog";
import type { CarbonFactorMetadata } from "@/lib/carbon/types";

const GHG_PROTOCOL_PRODUCT_STANDARD_URL =
  "https://ghgprotocol.org/sites/default/files/standards/Product-Life-Cycle-Accounting-Reporting-Standard_041613.pdf";
const DEFRA_2025_FREIGHT_URL =
  "https://assets.publishing.service.gov.uk/media/6846b0870392ed9b784c0187/2025-GHG-CF-methodology-paper.pdf";
const VIETNAM_GRID_2023_URL =
  "https://www.climatechange.vn/climate_news/viet-nams-2023-updated-grid-emission-factor-signifies-lower-electricity-emissions/";

const normalizeToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

const buildCatalogFactor = (material: CatalogMaterial): CarbonFactorMetadata => ({
  id: material.id,
  label: material.displayNameEn,
  unit: "kgCO2e/kg",
  value: material.co2Factor,
  source: "WeaveCarbon internal proxy catalog",
  sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
  geography: "generic",
  quality: "internal_proxy",
  isProxy: true
});

const CATALOG_FACTORS = MATERIAL_CATALOG.reduce<Record<string, CarbonFactorMetadata>>(
  (accumulator, material) => {
    accumulator[material.id] = buildCatalogFactor(material);
    return accumulator;
  },
  {}
);

const STATIC_FACTORS: Record<string, CarbonFactorMetadata> = {
  "energy-grid-vn-2023": {
    id: "energy-grid-vn-2023",
    label: "Vietnam grid electricity 2023",
    unit: "kgCO2e/kWh",
    value: 0.6592,
    source: "Vietnam DCC 2023 grid emission factor",
    sourceUrl: VIETNAM_GRID_2023_URL,
    year: 2023,
    geography: "Vietnam",
    quality: "documented_secondary",
    isProxy: false
  },
  "energy-grid-generic": {
    id: "energy-grid-generic",
    label: "Generic grid electricity",
    unit: "kgCO2e/kWh",
    value: 0.7,
    source: "WeaveCarbon generic electricity fallback",
    sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: "market_default_or_missing",
    isProxy: true
  },
  "energy-solar-generic": {
    id: "energy-solar-generic",
    label: "Generic solar electricity",
    unit: "kgCO2e/kWh",
    value: 0.05,
    source: "WeaveCarbon solar proxy",
    sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "energy-wind-generic": {
    id: "energy-wind-generic",
    label: "Generic wind electricity",
    unit: "kgCO2e/kWh",
    value: 0.03,
    source: "WeaveCarbon wind proxy",
    sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "energy-coal-generic": {
    id: "energy-coal-generic",
    label: "Generic coal energy",
    unit: "kgCO2e/kWh",
    value: 2.2,
    source: "WeaveCarbon coal proxy",
    sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "energy-gas-generic": {
    id: "energy-gas-generic",
    label: "Generic gas energy",
    unit: "kgCO2e/kWh",
    value: 0.5,
    source: "WeaveCarbon gas proxy",
    sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "energy-mixed-generic": {
    id: "energy-mixed-generic",
    label: "Generic mixed energy",
    unit: "kgCO2e/kWh",
    value: 0.7,
    source: "WeaveCarbon mixed energy proxy",
    sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "process-knitting": {
    id: "process-knitting",
    label: "Knitting process intensity",
    unit: "kWh/kg",
    value: 1.2,
    source: "WeaveCarbon process intensity proxy",
    sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "process-weaving": {
    id: "process-weaving",
    label: "Weaving process intensity",
    unit: "kWh/kg",
    value: 1.5,
    source: "WeaveCarbon process intensity proxy",
    sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "process-cutting": {
    id: "process-cutting",
    label: "Cutting process intensity",
    unit: "kWh/kg",
    value: 0.3,
    source: "WeaveCarbon process intensity proxy",
    sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "process-cutting-sewing": {
    id: "process-cutting-sewing",
    label: "Cutting and sewing process intensity",
    unit: "kWh/kg",
    value: 0.8,
    source: "WeaveCarbon process intensity proxy",
    sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "process-generic-garment": {
    id: "process-generic-garment",
    label: "Generic garment process intensity",
    unit: "kWh/kg",
    value: 1.2,
    source: "WeaveCarbon process intensity proxy",
    sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: "market_default_or_missing",
    isProxy: true
  },
  "process-dyeing": {
    id: "process-dyeing",
    label: "Dyeing process intensity",
    unit: "kWh/kg",
    value: 2.5,
    source: "WeaveCarbon process intensity proxy",
    sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "process-printing": {
    id: "process-printing",
    label: "Printing process intensity",
    unit: "kWh/kg",
    value: 1.8,
    source: "WeaveCarbon process intensity proxy",
    sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "process-finishing": {
    id: "process-finishing",
    label: "Finishing process intensity",
    unit: "kWh/kg",
    value: 0.5,
    source: "WeaveCarbon process intensity proxy",
    sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "transport-road-defra-2025": {
    id: "transport-road-defra-2025",
    label: "Road freight (all HGVs)",
    unit: "kgCO2e/tonne.km",
    value: 0.12226,
    source: "DEFRA 2025 freight emission factor",
    sourceUrl: DEFRA_2025_FREIGHT_URL,
    year: 2025,
    geography: "UK methodology / generic freight",
    quality: "documented_secondary",
    isProxy: false
  },
  "transport-sea-defra-2025": {
    id: "transport-sea-defra-2025",
    label: "Container ship average",
    unit: "kgCO2e/tonne.km",
    value: 0.01612,
    source: "DEFRA 2025 freight emission factor",
    sourceUrl: DEFRA_2025_FREIGHT_URL,
    year: 2025,
    geography: "UK methodology / generic freight",
    quality: "documented_secondary",
    isProxy: false
  },
  "transport-air-defra-2025": {
    id: "transport-air-defra-2025",
    label: "International air freight",
    unit: "kgCO2e/tonne.km",
    value: 0.89939,
    source: "DEFRA 2025 freight emission factor",
    sourceUrl: DEFRA_2025_FREIGHT_URL,
    year: 2025,
    geography: "UK methodology / generic freight",
    quality: "documented_secondary",
    isProxy: false
  },
  "transport-rail-defra-2025": {
    id: "transport-rail-defra-2025",
    label: "Freight train",
    unit: "kgCO2e/tonne.km",
    value: 0.02779,
    source: "DEFRA 2025 freight emission factor",
    sourceUrl: DEFRA_2025_FREIGHT_URL,
    year: 2025,
    geography: "UK methodology / generic freight",
    quality: "documented_secondary",
    isProxy: false
  },
  "transport-multimodal-proxy": {
    id: "transport-multimodal-proxy",
    label: "Multimodal freight proxy",
    unit: "kgCO2e/tonne.km",
    value: 0.08,
    source: "WeaveCarbon multimodal proxy",
    sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "packaging-biodegradable-proxy": {
    id: "packaging-biodegradable-proxy",
    label: "Biodegradable packaging",
    unit: "kgCO2e/kg",
    value: 0.8,
    source: "WeaveCarbon packaging proxy",
    sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "packaging-recycled-proxy": {
    id: "packaging-recycled-proxy",
    label: "Recycled packaging",
    unit: "kgCO2e/kg",
    value: 0.5,
    source: "WeaveCarbon packaging proxy",
    sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "packaging-minimal-proxy": {
    id: "packaging-minimal-proxy",
    label: "Minimal packaging",
    unit: "kgCO2e/kg",
    value: 0.3,
    source: "WeaveCarbon packaging proxy",
    sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "accessory-other-proxy": {
    id: "accessory-other-proxy",
    label: "Other accessory proxy",
    unit: "kgCO2e/kg",
    value: 6,
    source: "WeaveCarbon accessory proxy",
    sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  }
};

const FACTOR_ID_ALIASES: Record<string, string> = {
  cotton: "cat-cotton-100",
  organiccotton: "cat-cotton-organic",
  recycledcotton: "cat-cotton-recycled",
  polyester: "cat-polyester-100",
  recycledpolyester: "cat-polyester-recycled",
  wool: "cat-wool-100",
  silk: "cat-silk-100",
  linen: "cat-linen-100",
  nylon: "cat-nylon-100",
  bamboo: "cat-bamboo",
  hemp: "cat-hemp",
  tencel: "cat-tencel",
  viscose: "cat-viscose",
  acrylic: "cat-acrylic",
  leather: "cat-leather-genuine",
  fauxleather: "cat-leather-faux",
  blend: "cat-blend-cotton-poly",
  mixed: "cat-blend-cotton-poly",
  zipper: "cat-zipper-plastic",
  button: "cat-button-plastic",
  thread: "cat-thread-polyester",
  label: "cat-label-woven",
  elastic: "cat-elastic-band",
  lining: "cat-lining-polyester",
  padding: "cat-padding-polyester",
  packagingplastic: "cat-packaging-plastic-bag",
  packagingpaper: "cat-packaging-paper-box",
  plastic: "cat-packaging-plastic-bag",
  paper: "cat-packaging-paper-box",
  biodegradable: "packaging-biodegradable-proxy",
  recycled: "packaging-recycled-proxy",
  minimal: "packaging-minimal-proxy",
  other: "cat-other-generic",
  accessoryother: "accessory-other-proxy",
  grid: "energy-grid-generic",
  solar: "energy-solar-generic",
  wind: "energy-wind-generic",
  coal: "energy-coal-generic",
  gas: "energy-gas-generic",
  mixedenergy: "energy-mixed-generic",
  road: "transport-road-defra-2025",
  sea: "transport-sea-defra-2025",
  air: "transport-air-defra-2025",
  rail: "transport-rail-defra-2025",
  multimodal: "transport-multimodal-proxy",
  knitting: "process-knitting",
  weaving: "process-weaving",
  cutting: "process-cutting",
  cuttingsewing: "process-cutting-sewing",
  genericgarment: "process-generic-garment",
  dyeing: "process-dyeing",
  printing: "process-printing",
  finishing: "process-finishing"
};

export const MARKET_DISTANCE_DEFAULTS: Record<string, number> = {
  vietnam: 500,
  domestic: 500,
  vn: 500,
  eu: 10000,
  usa: 14000,
  us: 14000,
  japan: 3500,
  jp: 3500,
  korea: 3200,
  kr: 3200,
  china: 2500,
  cn: 2500,
  other: 5000
};

const CARBON_FACTORS: Record<string, CarbonFactorMetadata> = {
  ...CATALOG_FACTORS,
  ...STATIC_FACTORS
};

export const resolveCarbonFactorId = (value: string | null | undefined) => {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  if (CARBON_FACTORS[raw]) return raw;
  return FACTOR_ID_ALIASES[normalizeToken(raw)];
};

export const getCarbonFactor = (idOrAlias: string | null | undefined) => {
  const resolvedId = resolveCarbonFactorId(idOrAlias);
  return resolvedId ? CARBON_FACTORS[resolvedId] : undefined;
};

export const listCarbonFactors = () => Object.values(CARBON_FACTORS);

export const resolveMarketDistanceDefault = (value: string | null | undefined) => {
  const key = normalizeToken(String(value || ""));
  return MARKET_DISTANCE_DEFAULTS[key] || MARKET_DISTANCE_DEFAULTS.other;
};

export const resolveAccessoryFactorIdByKeyword = (value: string | null | undefined) => {
  const key = normalizeToken(String(value || ""));
  if (!key) return "accessory-other-proxy";

  if (key.includes("button") || key.includes("nut")) return "cat-button-plastic";
  if (key.includes("zipper") || key.includes("khoakeo")) return "cat-zipper-plastic";
  if (key.includes("thread") || key.includes("chimay")) return "cat-thread-polyester";
  if (key.includes("label") || key.includes("nhan")) return "cat-label-woven";
  if (key.includes("elastic") || key.includes("thun")) return "cat-elastic-band";
  if (key.includes("lining") || key.includes("lot")) return "cat-lining-polyester";
  if (key.includes("padding") || key.includes("dem") || key.includes("mut")) {
    return "cat-padding-polyester";
  }

  return "accessory-other-proxy";
};
