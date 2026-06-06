export interface DemoEvidenceV2 {
  kind: string;
  fileName: string;
  lookupCode: string;
  sha256: string;
}

export interface DemoMaterialLineV2 {
  key: string;
  name: string;
  hsCode?: string;
  kgPerUnit: number;
  co2ePerKg: number;
  source: string;
  isDefault?: boolean;
  color: string;
}

export interface DemoEnergyLineV2 {
  source: string;
  kwhPerUnit: number;
  factor: number;
  citation: string;
}

export interface DemoTransportLegV2 {
  mode: "road" | "sea" | "air" | "rail";
  route: string;
  distanceKm: number;
  weightTonnes: number;
  defraKey: string;
  defraFactor: number;
}

export interface DemoSkuV2 {
  id: string;
  sku: string;
  name: string;
  cnCode: string;
  routeCode: string;
  units: number;
  weightKgPerUnit: number;
  factory: string;
  factoryAddress: string;
  unLocode: string;
  materials: DemoMaterialLineV2[];
  energy: DemoEnergyLineV2[];
  transport: DemoTransportLegV2[];
  scope1KgCo2eBatch: number;
  cbamPenaltyEurPerUnit: number;
  evidence: DemoEvidenceV2[];
  verifier: string;
  confidence: number;
}

export const DEMO_FACILITY_V2 = {
  name: "Weave Demo Garment Factory - Ha Noi",
  address: "Khu CN Bac Thang Long, Dong Anh, Ha Noi, Viet Nam",
  unLocode: "VNHAN",
  naceCode: "14.13",
  customsOffice: "VN HAN",
  verifier: "SGS Vietnam / TUV Rheinland"
};

const EVN_FACTOR = 0.6766;
const DEFRA_TRUCK_40T = 0.0795;
const DEFRA_SEA_CONTAINER = 0.01614;
const DEFRA_RAIL = 0.028;
const DEFRA_AIR = 0.602;

export const DEMO_PACK_V2: DemoSkuV2[] = [
  {
    id: "demo-v2-pl-cot",
    sku: "PL-COT-2026",
    name: "Men's Cotton Shirt (woven)",
    cnCode: "62052000",
    routeCode: "TX-COT-01",
    units: 1200,
    weightKgPerUnit: 0.22,
    factory: DEMO_FACILITY_V2.name,
    factoryAddress: DEMO_FACILITY_V2.address,
    unLocode: DEMO_FACILITY_V2.unLocode,
    materials: [
      { key: "cotton_conventional", name: "Cotton (conventional)", kgPerUnit: 0.132, co2ePerKg: 5.9, source: "Higg MSI; Ecoinvent v3.10", color: "#06C167" },
      { key: "woven_cotton_gap", name: "Woven cotton (HS 5208) - supply gap", hsCode: "5208", kgPerUnit: 0.22, co2ePerKg: 8.55, source: "Ecoinvent v3.10 Default +10%", isDefault: true, color: "#EF4444" }
    ],
    energy: [{ source: "Vietnam national grid", kwhPerUnit: 0.973, factor: EVN_FACTOR, citation: "Bo TN&MT VN 2024" }],
    transport: [
      { mode: "road", route: "Hanoi factory -> Hai Phong port", distanceKm: 120, weightTonnes: 0.264, defraKey: "freighting_goods_hgv_all_diesel_40t", defraFactor: DEFRA_TRUCK_40T },
      { mode: "sea", route: "Hai Phong -> Rotterdam", distanceKm: 14720, weightTonnes: 0.264, defraKey: "sea_freight_container_ship_average", defraFactor: DEFRA_SEA_CONTAINER }
    ],
    scope1KgCo2eBatch: 12450.5,
    cbamPenaltyEurPerUnit: 0.05,
    evidence: [
      { kind: "EVN bill", fileName: "Hoa_don_dien_EVN_T4_2026.pdf", lookupCode: "EVN-HN-009412", sha256: "37c241d7f359e463f9f157b06851b379d0f3b91f4f17cf891b0b2cbb5fbc812d" },
      { kind: "Water bill", fileName: "Hoa_don_nuoc_HAWACOM_T4.pdf", lookupCode: "HAW-2026-0009", sha256: "d1e6eb6f533cc7b119d0b90b9b9f964f319de2cf414f96f2baef31c1df34693b" },
      { kind: "Warehouse receipt", fileName: "Phieu_nhap_kho_soi_cotton.pdf", lookupCode: "112455", sha256: "0ec6eb6f4a2b4319f70d81f2c9f978a8ac0898ef96723b5bfe9a5116b0af09f9" }
    ],
    verifier: DEMO_FACILITY_V2.verifier,
    confidence: 0.94
  },
  {
    id: "demo-v2-pl-pol",
    sku: "PL-POL-2026",
    name: "Recycled Polyester Polo",
    cnCode: "61091000",
    routeCode: "TX-POL-01",
    units: 2400,
    weightKgPerUnit: 0.18,
    factory: DEMO_FACILITY_V2.name,
    factoryAddress: DEMO_FACILITY_V2.address,
    unLocode: DEMO_FACILITY_V2.unLocode,
    materials: [{ key: "recycled_polyester", name: "Recycled polyester", kgPerUnit: 0.17, co2ePerKg: 2.5, source: "Higg MSI; Ecoinvent v3.10", color: "#0EA5E9" }],
    energy: [{ source: "Vietnam national grid", kwhPerUnit: 0.8, factor: EVN_FACTOR, citation: "Bo TN&MT VN 2024" }],
    transport: [{ mode: "sea", route: "Hai Phong -> Hamburg", distanceKm: 14300, weightTonnes: 0.432, defraKey: "sea_freight_container_ship_average", defraFactor: DEFRA_SEA_CONTAINER }],
    scope1KgCo2eBatch: 8200,
    cbamPenaltyEurPerUnit: 0.03,
    evidence: [{ kind: "GRS certificate", fileName: "GRS_certificate_PL_POL.pdf", lookupCode: "GRS-2026-POL", sha256: "1e0e5e92828e038b04d59387a0cc12f0aa1178f5b0f8f3d8f311bdc01a275991" }],
    verifier: DEMO_FACILITY_V2.verifier,
    confidence: 0.9
  },
  {
    id: "demo-v2-pl-den",
    sku: "PL-DEN-2026",
    name: "Denim Work Jacket",
    cnCode: "62034231",
    routeCode: "TX-DEN-01",
    units: 800,
    weightKgPerUnit: 0.62,
    factory: DEMO_FACILITY_V2.name,
    factoryAddress: DEMO_FACILITY_V2.address,
    unLocode: DEMO_FACILITY_V2.unLocode,
    materials: [{ key: "denim_cotton", name: "Cotton denim", kgPerUnit: 0.52, co2ePerKg: 8.1, source: "Ecoinvent v3.10 textile proxy", color: "#1F4E79" }],
    energy: [{ source: "Vietnam national grid", kwhPerUnit: 2.1, factor: EVN_FACTOR, citation: "Bo TN&MT VN 2024" }],
    transport: [{ mode: "sea", route: "Hai Phong -> Rotterdam", distanceKm: 14720, weightTonnes: 0.496, defraKey: "sea_freight_container_ship_average", defraFactor: DEFRA_SEA_CONTAINER }],
    scope1KgCo2eBatch: 3800,
    cbamPenaltyEurPerUnit: 0.08,
    evidence: [{ kind: "OEKO-TEX certificate", fileName: "OEKO_TEX_DEN_2026.pdf", lookupCode: "OEK-DEN-2026", sha256: "54243d411f2013d2e32ffb84de47ab1a0724b721a7a8a6c146afac38d0f8ef75" }],
    verifier: DEMO_FACILITY_V2.verifier,
    confidence: 0.87
  },
  {
    id: "demo-v2-pl-lin",
    sku: "PL-LIN-2026",
    name: "Linen Resort Shirt",
    cnCode: "62044300",
    routeCode: "TX-LIN-01",
    units: 600,
    weightKgPerUnit: 0.24,
    factory: DEMO_FACILITY_V2.name,
    factoryAddress: DEMO_FACILITY_V2.address,
    unLocode: DEMO_FACILITY_V2.unLocode,
    materials: [{ key: "linen", name: "Linen flax", kgPerUnit: 0.22, co2ePerKg: 5.2, source: "Higg MSI; Ecoinvent v3.10", color: "#B08968" }],
    energy: [{ source: "Vietnam national grid", kwhPerUnit: 1.05, factor: EVN_FACTOR, citation: "Bo TN&MT VN 2024" }],
    transport: [{ mode: "rail", route: "Hanoi -> Shenzhen rail feeder", distanceKm: 980, weightTonnes: 0.144, defraKey: "rail_freight_average", defraFactor: DEFRA_RAIL }],
    scope1KgCo2eBatch: 1300,
    cbamPenaltyEurPerUnit: 0.04,
    evidence: [{ kind: "FSC/linen origin", fileName: "Linen_origin_declaration.pdf", lookupCode: "LIN-ORIGIN-26", sha256: "a9e8745ce119559c7726f8e9058bb669ed67b11527661cb3c4b68fd6b4ce3ee0" }],
    verifier: DEMO_FACILITY_V2.verifier,
    confidence: 0.88
  },
  {
    id: "demo-v2-pl-air",
    sku: "PL-KID-2026",
    name: "Kids Printed Tee",
    cnCode: "61099020",
    routeCode: "TX-KID-01",
    units: 1500,
    weightKgPerUnit: 0.11,
    factory: DEMO_FACILITY_V2.name,
    factoryAddress: DEMO_FACILITY_V2.address,
    unLocode: DEMO_FACILITY_V2.unLocode,
    materials: [{ key: "cotton_blend", name: "Cotton blend", kgPerUnit: 0.105, co2ePerKg: 4.6, source: "Ecoinvent v3.10 blend proxy", color: "#10B981" }],
    energy: [{ source: "Vietnam national grid", kwhPerUnit: 0.45, factor: EVN_FACTOR, citation: "Bo TN&MT VN 2024" }],
    transport: [{ mode: "air", route: "Noi Bai -> Frankfurt", distanceKm: 8940, weightTonnes: 0.165, defraKey: "air_freight_long_haul", defraFactor: DEFRA_AIR }],
    scope1KgCo2eBatch: 600,
    cbamPenaltyEurPerUnit: 0.02,
    evidence: [{ kind: "Care label approval", fileName: "Care_label_PL_KID.pdf", lookupCode: "CARE-KID-26", sha256: "8275a107902cb6b72f2fb93ecffae9e478029b570b2a86541f0e5777d96af41d" }],
    verifier: DEMO_FACILITY_V2.verifier,
    confidence: 0.82
  }
];
