import {
  MATERIAL_CATALOG,
  type CatalogMaterial
} from "@/lib/carbon/materialCatalog";
import type {
  CarbonFactorClass,
  CarbonFactorMetadata,
  CarbonFactorQuality,
  CarbonQualityScores,
  ProductCategory
} from "@/lib/carbon/types";

const GHG_PROTOCOL_PRODUCT_STANDARD_URL =
  "https://ghgprotocol.org/sites/default/files/standards/Product-Life-Cycle-Accounting-Reporting-Standard_041613.pdf";
const DEFRA_2025_FREIGHT_URL =
  "https://assets.publishing.service.gov.uk/media/6846b0870392ed9b784c0187/2025-GHG-CF-methodology-paper.pdf";
const VIETNAM_GRID_2023_URL =
  "https://www.climatechange.vn/climate_news/viet-nams-2023-updated-grid-emission-factor-signifies-lower-electricity-emissions/";
const IEA_2023_ELECTRICITY_URL =
  "https://www.iea.org/data-and-statistics/data-product/emissions-factors-2023";
const IPCC_AR6_URL =
  "https://www.ipcc.ch/report/ar6/wg3/";
const DEFRA_2025_STATIONARY_URL =
  "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025";
const SAC_HIGG_FEM_URL =
  "https://apparelcoalition.org/the-higg-index/";
const TEXTILE_EXCHANGE_2022_URL =
  "https://textileexchange.org/app/uploads/2022/11/Textile-Exchange_Preferred-Fiber-Materials-Market-Report_2022.pdf";

const normalizeToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

type RawCarbonFactorMetadata = Omit<
  CarbonFactorMetadata,
  | "boundaryType"
  | "factorClass"
  | "factorVersionId"
  | "gwpBasis"
  | "qualityScores"
  | "uncertaintyCv"
>;

const GWP_BASIS = "IPCC_AR5_100y";

const QUALITY_SCORES_BY_QUALITY: Record<CarbonFactorQuality, CarbonQualityScores> = {
  primary: {
    technologicalRepresentativeness: 1,
    temporalRepresentativeness: 1,
    geographicalRepresentativeness: 1,
    completeness: 1,
    reliability: 1
  },
  documented_secondary: {
    technologicalRepresentativeness: 2,
    temporalRepresentativeness: 2,
    geographicalRepresentativeness: 2,
    completeness: 2,
    reliability: 2
  },
  internal_proxy: {
    technologicalRepresentativeness: 4,
    temporalRepresentativeness: 3,
    geographicalRepresentativeness: 4,
    completeness: 3,
    reliability: 4
  },
  market_default_or_missing: {
    technologicalRepresentativeness: 5,
    temporalRepresentativeness: 4,
    geographicalRepresentativeness: 5,
    completeness: 5,
    reliability: 5
  }
};

const FACTOR_CLASS_BY_QUALITY: Record<CarbonFactorQuality, CarbonFactorClass> = {
  primary: "measured_primary_activity",
  documented_secondary: "documented_secondary",
  internal_proxy: "internal_proxy",
  market_default_or_missing: "market_default"
};

const UNCERTAINTY_CV_BY_QUALITY: Record<CarbonFactorQuality, number> = {
  primary: 0.1,
  documented_secondary: 0.2,
  internal_proxy: 0.35,
  market_default_or_missing: 0.5
};

const resolveBoundaryType = (
  factor: RawCarbonFactorMetadata
): CarbonFactorMetadata["boundaryType"] => {
  if (factor.id.startsWith("transport-")) return "gate_to_market";
  if (factor.id.startsWith("process-")) return "gate_to_gate";
  return "cradle_to_gate";
};

const enrichFactor = (factor: RawCarbonFactorMetadata): CarbonFactorMetadata => ({
  ...factor,
  boundaryType: resolveBoundaryType(factor),
  factorClass: FACTOR_CLASS_BY_QUALITY[factor.quality],
  factorVersionId: `${factor.id}:v1`,
  gwpBasis: GWP_BASIS,
  qualityScores: QUALITY_SCORES_BY_QUALITY[factor.quality],
  uncertaintyCv: UNCERTAINTY_CV_BY_QUALITY[factor.quality],
  validFrom: factor.year ? `${factor.year}-01-01` : undefined
});

const CATALOG_FACTOR_SOURCES: Record<string, { source: string; sourceUrl: string; quality: CarbonFactorQuality; isProxy: boolean }> = {
  "cat-cotton-100":       { source: "MADE-BY Benchmark 2019 + Textile Exchange Fiber Report 2022 — conventional cotton cradle-to-gate", sourceUrl: TEXTILE_EXCHANGE_2022_URL, quality: "documented_secondary", isProxy: false },
  "cat-cotton-organic":   { source: "Textile Exchange Organic Cotton LCA 2022 — organic cotton cradle-to-gate", sourceUrl: TEXTILE_EXCHANGE_2022_URL, quality: "documented_secondary", isProxy: false },
  "cat-cotton-recycled":  { source: "Textile Exchange Recycled Cotton LCA 2022 — mechanically recycled", sourceUrl: TEXTILE_EXCHANGE_2022_URL, quality: "documented_secondary", isProxy: false },
  "cat-polyester-100":    { source: "MADE-BY Benchmark 2019 + Ecoinvent 3.10 — virgin PET fiber cradle-to-gate", sourceUrl: TEXTILE_EXCHANGE_2022_URL, quality: "documented_secondary", isProxy: false },
  "cat-polyester-recycled": { source: "Textile Exchange rPET LCA 2022 — bottle-to-fiber recycled polyester", sourceUrl: TEXTILE_EXCHANGE_2022_URL, quality: "documented_secondary", isProxy: false },
  "cat-wool-100":         { source: "Textile Exchange Fiber Report 2022 + MADE-BY Benchmark — conventional wool, includes enteric fermentation (CH₄). Range 20–36 kgCO₂e/kg.", sourceUrl: TEXTILE_EXCHANGE_2022_URL, quality: "documented_secondary", isProxy: false },
  "cat-wool-merino":      { source: "Textile Exchange Fiber Report 2022 — merino wool NZ/AUS origin, includes enteric fermentation. Range 20–35 kgCO₂e/kg.", sourceUrl: TEXTILE_EXCHANGE_2022_URL, quality: "documented_secondary", isProxy: false },
  "cat-silk-100":         { source: "Wang et al. (2021) LCA of silk production, China origin + Ecoinvent 3.10. Includes mulberry cultivation and reeling. Range 10–70 kgCO₂e/kg.", sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL, quality: "documented_secondary", isProxy: false },
  "cat-linen-100":        { source: "MADE-BY Benchmark 2019 — European linen (flax) cradle-to-gate", sourceUrl: TEXTILE_EXCHANGE_2022_URL, quality: "documented_secondary", isProxy: false },
  "cat-nylon-100":        { source: "MADE-BY Benchmark 2019 — virgin nylon 6 cradle-to-gate", sourceUrl: TEXTILE_EXCHANGE_2022_URL, quality: "documented_secondary", isProxy: false },
  "cat-nylon-recycled":   { source: "Textile Exchange 2022 — recycled nylon (Econyl process)", sourceUrl: TEXTILE_EXCHANGE_2022_URL, quality: "documented_secondary", isProxy: false },
  "cat-bamboo":           { source: "Textile Exchange Fiber Report 2022 — bamboo viscose/lyocell (chemical process); cradle-to-gate", sourceUrl: TEXTILE_EXCHANGE_2022_URL, quality: "documented_secondary", isProxy: false },
  "cat-hemp":             { source: "Textile Exchange 2022 — mechanically processed hemp fiber, cradle-to-gate", sourceUrl: TEXTILE_EXCHANGE_2022_URL, quality: "documented_secondary", isProxy: false },
  "cat-tencel":           { source: "Lenzing AG Environmental Product Declaration (EPD) 2022 — TENCEL™ Lyocell closed-loop", sourceUrl: TEXTILE_EXCHANGE_2022_URL, quality: "documented_secondary", isProxy: false },
  "cat-viscose":          { source: "Ecoinvent 3.10 — viscose (rayon) fiber, generic cradle-to-gate", sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL, quality: "documented_secondary", isProxy: false },
  "cat-acrylic":          { source: "Ecoinvent 3.10 — acrylic fiber cradle-to-gate", sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL, quality: "documented_secondary", isProxy: false },
  "cat-leather-genuine":  { source: "FAO/UNEP 2021 co-product allocation (economic) — bovine leather, tanning included. Range 15–20 kgCO₂e/kg with economic allocation.", sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL, quality: "documented_secondary", isProxy: false },
  "cat-leather-faux":     { source: "Ecoinvent 3.10 — polyurethane coated fabric (PU faux leather)", sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL, quality: "internal_proxy", isProxy: true },
  "cat-down":             { source: "Higg MSI 2023 — down feather (waterfowl), co-product allocation. Range 18–30 kgCO₂e/kg.", sourceUrl: SAC_HIGG_FEM_URL, quality: "documented_secondary", isProxy: false },
  "cat-faux-fur":         { source: "WeaveCarbon proxy — acrylic-based faux fur, aligned with acrylic fiber LCA", sourceUrl: GHG_PROTOCOL_PRODUCT_STANDARD_URL, quality: "internal_proxy", isProxy: true }
};

const buildCatalogFactor = (material: CatalogMaterial): RawCarbonFactorMetadata => {
  const override = CATALOG_FACTOR_SOURCES[material.id];
  return {
    id: material.id,
    label: material.displayNameEn,
    unit: "kgCO2e/kg",
    value: material.co2Factor,
    source: override?.source ?? "WeaveCarbon internal proxy catalog — literature-aligned estimate",
    sourceUrl: override?.sourceUrl ?? GHG_PROTOCOL_PRODUCT_STANDARD_URL,
    geography: "generic",
    quality: override?.quality ?? "internal_proxy",
    isProxy: override?.isProxy ?? true,
    biogenicCarbonKgPerKg: material.biogenicCarbonKgPerKg
  };
};

const CATALOG_FACTORS = MATERIAL_CATALOG.reduce<Record<string, RawCarbonFactorMetadata>>(
  (accumulator, material) => {
    accumulator[material.id] = buildCatalogFactor(material);
    return accumulator;
  },
  {}
);

const STATIC_FACTORS: Record<string, RawCarbonFactorMetadata> = {
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
    value: 0.045,
    source: "IPCC AR6 WG3 Ch.6 lifecycle GHG — utility-scale solar PV median",
    sourceUrl: IPCC_AR6_URL,
    geography: "generic",
    quality: "documented_secondary",
    isProxy: false
  },
  "energy-wind-generic": {
    id: "energy-wind-generic",
    label: "Generic onshore wind electricity",
    unit: "kgCO2e/kWh",
    value: 0.011,
    source: "IPCC AR6 WG3 Ch.6 lifecycle GHG — onshore wind median",
    sourceUrl: IPCC_AR6_URL,
    geography: "generic",
    quality: "documented_secondary",
    isProxy: false
  },
  "energy-coal-generic": {
    id: "energy-coal-generic",
    label: "Coal-fired electricity generation",
    unit: "kgCO2e/kWh",
    value: 0.82,
    source: "IEA Emissions Factors 2023 — subcritical coal power average",
    sourceUrl: IEA_2023_ELECTRICITY_URL,
    geography: "generic",
    quality: "documented_secondary",
    isProxy: false
  },
  "energy-gas-generic": {
    id: "energy-gas-generic",
    label: "Natural gas electricity (CCGT)",
    unit: "kgCO2e/kWh",
    value: 0.40,
    source: "DEFRA 2025 stationary combustion — natural gas CCGT generation",
    sourceUrl: DEFRA_2025_STATIONARY_URL,
    geography: "generic",
    quality: "documented_secondary",
    isProxy: false
  },
  "energy-mixed-generic": {
    id: "energy-mixed-generic",
    label: "Generic mixed energy (global average)",
    unit: "kgCO2e/kWh",
    value: 0.55,
    source: "IEA 2023 world average grid emission intensity",
    sourceUrl: IEA_2023_ELECTRICITY_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "process-knitting": {
    id: "process-knitting",
    label: "Knitting process — electrical intensity",
    unit: "kWh/kg",
    value: 1.8,
    source: "SAC Higg FEM benchmarks + European BREF Textile BAT 2017 — knitting stage",
    sourceUrl: SAC_HIGG_FEM_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "process-weaving": {
    id: "process-weaving",
    label: "Weaving process — electrical intensity",
    unit: "kWh/kg",
    value: 2.2,
    source: "SAC Higg FEM benchmarks + European BREF Textile BAT 2017 — weaving stage",
    sourceUrl: SAC_HIGG_FEM_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "process-cutting": {
    id: "process-cutting",
    label: "Cutting process — electrical intensity",
    unit: "kWh/kg",
    value: 0.5,
    source: "SAC Higg FEM benchmarks — cutting stage",
    sourceUrl: SAC_HIGG_FEM_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "process-cutting-sewing": {
    id: "process-cutting-sewing",
    label: "Cutting and sewing — electrical intensity",
    unit: "kWh/kg",
    value: 1.2,
    source: "SAC Higg FEM benchmarks — CMT stage (cut, make, trim)",
    sourceUrl: SAC_HIGG_FEM_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "process-generic-garment": {
    id: "process-generic-garment",
    label: "Generic garment — total process intensity",
    unit: "kWh/kg",
    value: 1.5,
    source: "SAC Higg FEM global average garment manufacturing intensity",
    sourceUrl: SAC_HIGG_FEM_URL,
    geography: "generic",
    quality: "market_default_or_missing",
    isProxy: true
  },
  "process-dyeing": {
    id: "process-dyeing",
    label: "Wet dyeing — total energy intensity (electrical equiv.)",
    unit: "kWh/kg",
    value: 5.5,
    source: "European BREF Textile BAT 2017 + SAC Higg FEM — wet processing (dyeing). Includes thermal energy equivalent. Range 4–10 kWh/kg.",
    sourceUrl: SAC_HIGG_FEM_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "process-printing": {
    id: "process-printing",
    label: "Printing process — total energy intensity",
    unit: "kWh/kg",
    value: 2.5,
    source: "SAC Higg FEM benchmarks — digital & screen printing",
    sourceUrl: SAC_HIGG_FEM_URL,
    geography: "generic",
    quality: "internal_proxy",
    isProxy: true
  },
  "process-finishing": {
    id: "process-finishing",
    label: "Finishing process — total energy intensity",
    unit: "kWh/kg",
    value: 1.5,
    source: "European BREF Textile BAT 2017 — mechanical and chemical finishing",
    sourceUrl: SAC_HIGG_FEM_URL,
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
  },
  "process-clinker-kiln": {
    id: "process-clinker-kiln",
    label: "Kiln clinker calcination & firing",
    unit: "kWh/kg",
    value: 0.95,
    source: "WeaveCarbon cement kiln benchmark",
    sourceUrl: IPCC_AR6_URL,
    geography: "generic",
    quality: "documented_secondary",
    isProxy: false
  },
  "process-cement-grinding": {
    id: "process-cement-grinding",
    label: "Cement finish grinding",
    unit: "kWh/kg",
    value: 0.07,
    source: "WeaveCarbon cement benchmark",
    sourceUrl: IPCC_AR6_URL,
    geography: "generic",
    quality: "documented_secondary",
    isProxy: false
  },
  "process-eaf-melting": {
    id: "process-eaf-melting",
    label: "Electric arc furnace steel melting",
    unit: "kWh/kg",
    value: 0.45,
    source: "WeaveCarbon steel EAF benchmark",
    sourceUrl: IPCC_AR6_URL,
    geography: "generic",
    quality: "documented_secondary",
    isProxy: false
  },
  "process-hot-rolling": {
    id: "process-hot-rolling",
    label: "Steel hot rolling",
    unit: "kWh/kg",
    value: 0.12,
    source: "WeaveCarbon steel rolling benchmark",
    sourceUrl: IPCC_AR6_URL,
    geography: "generic",
    quality: "documented_secondary",
    isProxy: false
  },
  "process-extrusion": {
    id: "process-extrusion",
    label: "Aluminium extrusion",
    unit: "kWh/kg",
    value: 0.55,
    source: "WeaveCarbon aluminium benchmark",
    sourceUrl: IPCC_AR6_URL,
    geography: "generic",
    quality: "documented_secondary",
    isProxy: false
  },
  "process-ammonia-synthesis": {
    id: "process-ammonia-synthesis",
    label: "Ammonia & fertiliser chemical synthesis",
    unit: "kWh/kg",
    value: 0.85,
    source: "WeaveCarbon chemical synthesis benchmark",
    sourceUrl: IPCC_AR6_URL,
    geography: "generic",
    quality: "documented_secondary",
    isProxy: false
  },
  "process-urea-granulation": {
    id: "process-urea-granulation",
    label: "Urea granulation & finishing",
    unit: "kWh/kg",
    value: 0.15,
    source: "WeaveCarbon fertiliser benchmark",
    sourceUrl: IPCC_AR6_URL,
    geography: "generic",
    quality: "documented_secondary",
    isProxy: false
  },
  "process-drying": {
    id: "process-drying",
    label: "Agricultural thermal drying",
    unit: "kWh/kg",
    value: 0.25,
    source: "WeaveCarbon agricultural processing benchmark",
    sourceUrl: IPCC_AR6_URL,
    geography: "generic",
    quality: "documented_secondary",
    isProxy: false
  },
  "process-milling": {
    id: "process-milling",
    label: "Grain milling and hulling",
    unit: "kWh/kg",
    value: 0.08,
    source: "WeaveCarbon agri milling benchmark",
    sourceUrl: IPCC_AR6_URL,
    geography: "generic",
    quality: "documented_secondary",
    isProxy: false
  },
  "process-kiln-firing": {
    id: "process-kiln-firing",
    label: "Ceramic / tile kiln firing",
    unit: "kWh/kg",
    value: 0.35,
    source: "WeaveCarbon building materials benchmark",
    sourceUrl: IPCC_AR6_URL,
    geography: "generic",
    quality: "documented_secondary",
    isProxy: false
  },
  "process-mining": {
    id: "process-mining",
    label: "Mining extraction and beneficiation",
    unit: "kWh/kg",
    value: 0.18,
    source: "WeaveCarbon mining benchmark",
    sourceUrl: IPCC_AR6_URL,
    geography: "generic",
    quality: "documented_secondary",
    isProxy: false
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
  finishing: "process-finishing",
  clinker: "cat-clinker",
  gypsumadditives: "cat-gypsum-additives",
  steelscrap: "cat-steel-scrap",
  ironorepellet: "cat-iron-ore-pellet",
  primaryaluminium: "cat-aluminium-primary",
  recycledaluminium: "cat-aluminium-recycled",
  naturalgasfeedstock: "cat-natural-gas-feedstock",
  coffeecherry: "cat-coffee-cherry",
  paddyrice: "cat-paddy-rice",
  fieldlatex: "cat-field-latex",
  clayfeldspar: "cat-clay-feldspar",
  glazefrit: "cat-glaze-frit",
  heavymineralsand: "cat-heavy-mineral-sand",
  blackpepper: "cat-black-pepper",
  clinkerkiln: "process-clinker-kiln",
  cementgrinding: "process-cement-grinding",
  eafmelting: "process-eaf-melting",
  hotrolling: "process-hot-rolling",
  extrusion: "process-extrusion",
  ammoniasynthesis: "process-ammonia-synthesis",
  ureagranulation: "process-urea-granulation",
  drying: "process-drying",
  milling: "process-milling",
  kilnfiring: "process-kiln-firing",
  mining: "process-mining"
};

export interface CategoryMethodologyConfig {
  methodologyName: string;
  methodologyVersion: string;
  calculationGraphVersion: string;
  defaultProcessFactorId: string;
  defaultMaterialFactorId: string;
  processFallbackWarningLabel: string;
}

// textile keeps the exact strings the engine already produced before productCategory existed,
// so existing textile products/tests see byte-identical output.
export const CATEGORY_METHODOLOGY: Record<ProductCategory, CategoryMethodologyConfig> = {
  textile: {
    methodologyName: "WeaveCarbon Attributional Textile PCF",
    methodologyVersion: "WeaveCarbon Attributional Textile PCF v2.1 - climate-only partial CFP",
    calculationGraphVersion: "textile-pcf-2.1.0",
    defaultProcessFactorId: "process-generic-garment",
    defaultMaterialFactorId: "cat-other-generic",
    processFallbackWarningLabel: "garment"
  },
  steel: {
    methodologyName: "WeaveCarbon Industrial Steel PCF",
    methodologyVersion: "WeaveCarbon Industrial Steel PCF v1.0 - EAF/BOF boundary",
    calculationGraphVersion: "steel-pcf-1.0.0",
    defaultProcessFactorId: "process-eaf-melting",
    defaultMaterialFactorId: "cat-steel-scrap",
    processFallbackWarningLabel: "steel"
  },
  cement: {
    methodologyName: "WeaveCarbon Industrial Cement PCF",
    methodologyVersion: "WeaveCarbon Industrial Cement PCF v1.0 - calcination & kiln boundary",
    calculationGraphVersion: "cement-pcf-1.0.0",
    defaultProcessFactorId: "process-clinker-kiln",
    defaultMaterialFactorId: "cat-clinker",
    processFallbackWarningLabel: "cement"
  },
  aluminium: {
    methodologyName: "WeaveCarbon Industrial Aluminium PCF",
    methodologyVersion: "WeaveCarbon Industrial Aluminium PCF v1.0 - smelting & extrusion boundary",
    calculationGraphVersion: "aluminium-pcf-1.0.0",
    defaultProcessFactorId: "process-extrusion",
    defaultMaterialFactorId: "cat-aluminium-primary",
    processFallbackWarningLabel: "aluminium"
  },
  fertiliser: {
    methodologyName: "WeaveCarbon Industrial Fertiliser PCF",
    methodologyVersion: "WeaveCarbon Industrial Fertiliser PCF v1.0 - chemical synthesis boundary",
    calculationGraphVersion: "fertiliser-pcf-1.0.0",
    defaultProcessFactorId: "process-ammonia-synthesis",
    defaultMaterialFactorId: "cat-natural-gas-feedstock",
    processFallbackWarningLabel: "fertiliser"
  },
  mining: {
    methodologyName: "WeaveCarbon Mining & Minerals PCF",
    methodologyVersion: "WeaveCarbon Mining & Minerals PCF v1.0 - extraction & beneficiation",
    calculationGraphVersion: "mining-pcf-1.0.0",
    defaultProcessFactorId: "process-mining",
    defaultMaterialFactorId: "cat-heavy-mineral-sand",
    processFallbackWarningLabel: "mining"
  },
  construction_materials: {
    methodologyName: "WeaveCarbon Construction Materials PCF",
    methodologyVersion: "WeaveCarbon Construction Materials PCF v1.0 - firing & autoclave boundary",
    calculationGraphVersion: "construction-materials-pcf-1.0.0",
    defaultProcessFactorId: "process-kiln-firing",
    defaultMaterialFactorId: "cat-clay-feldspar",
    processFallbackWarningLabel: "construction materials"
  },
  agriculture: {
    methodologyName: "WeaveCarbon Agriculture & Food PCF",
    methodologyVersion: "WeaveCarbon Agriculture & Food PCF v1.0 - farming, drying & milling boundary",
    calculationGraphVersion: "agriculture-pcf-1.0.0",
    defaultProcessFactorId: "process-drying",
    defaultMaterialFactorId: "cat-paddy-rice",
    processFallbackWarningLabel: "agriculture"
  },
  other: {
    methodologyName: "WeaveCarbon Generic Industrial PCF",
    methodologyVersion: "WeaveCarbon Generic Industrial PCF v1.0",
    calculationGraphVersion: "generic-pcf-1.0.0",
    defaultProcessFactorId: "process-generic-garment",
    defaultMaterialFactorId: "cat-other-generic",
    processFallbackWarningLabel: "generic"
  }
};

export const resolveCategoryMethodology = (
  category: ProductCategory | string | null | undefined
): CategoryMethodologyConfig => {
  const key = (category || "textile") as ProductCategory;
  return CATEGORY_METHODOLOGY[key] || CATEGORY_METHODOLOGY.textile;
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

const RAW_CARBON_FACTORS: Record<string, RawCarbonFactorMetadata> = {
  ...CATALOG_FACTORS,
  ...STATIC_FACTORS
};

const CARBON_FACTORS: Record<string, CarbonFactorMetadata> = Object.fromEntries(
  Object.entries(RAW_CARBON_FACTORS).map(([id, factor]) => [id, enrichFactor(factor)])
);

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
