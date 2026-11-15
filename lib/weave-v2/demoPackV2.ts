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
  name: "Vietnam Industrial Group (Demo) - Phu My",
  address: "KCN Phu My II, TX. Phu My, Ba Ria - Vung Tau, Viet Nam",
  unLocode: "VNPHU",
  naceCode: "24.10",
  customsOffice: "VN CMT",
  verifier: "SGS Vietnam / TUV Rheinland"
};

const EVN_FACTOR = 0.6766;
const DEFRA_TRUCK_40T = 0.0795;
const DEFRA_SEA_CONTAINER = 0.01614;
const DEFRA_SEA_BULK = 0.0035;
const DEFRA_RAIL = 0.028;

// Bộ SKU demo đa ngành (đơn vị = 1 tấn sản phẩm). Số liệu minh hoạ, không phải dữ liệu thật của doanh nghiệp.
export const DEMO_PACK_V2: DemoSkuV2[] = [
  {
    id: "demo-v2-agr-cph",
    sku: "AGR-CPH-2026",
    name: "Cà phê nhân Robusta (đơn vị: tấn)",
    cnCode: "09011100",
    routeCode: "AG-CPH-01",
    units: 300,
    weightKgPerUnit: 1000,
    factory: "Nhà máy chế biến cà phê demo - Buon Ma Thuot",
    factoryAddress: "KCN Hoa Phu, Buon Ma Thuot, Dak Lak, Viet Nam",
    unLocode: "VNBMV",
    materials: [
      { key: "coffee_cherry", name: "Cà phê quả tươi (canh tác)", kgPerUnit: 1000, co2ePerKg: 1.42, source: "Demo agri factor; FAO/IPCC N2O proxy", color: "#7C4A1E" },
      { key: "coffee_fertiliser_gap", name: "Phân bón vườn cây - supply gap", kgPerUnit: 180, co2ePerKg: 1.25, source: "Default factor +10% (chờ dữ liệu nông hộ)", isDefault: true, color: "#EF4444" }
    ],
    energy: [{ source: "Vietnam national grid", kwhPerUnit: 95, factor: EVN_FACTOR, citation: "Bo TN&MT VN 2024" }],
    transport: [
      { mode: "road", route: "Buon Ma Thuot -> Cat Lai port", distanceKm: 350, weightTonnes: 1, defraKey: "freighting_goods_hgv_all_diesel_40t", defraFactor: DEFRA_TRUCK_40T },
      { mode: "sea", route: "Cat Lai -> Hamburg", distanceKm: 18200, weightTonnes: 1, defraKey: "sea_freight_container_ship_average", defraFactor: DEFRA_SEA_CONTAINER }
    ],
    scope1KgCo2eBatch: 9850,
    cbamPenaltyEurPerUnit: 0,
    evidence: [
      { kind: "EVN bill", fileName: "Hoa_don_dien_EVN_T4_2026.pdf", lookupCode: "EVN-DL-009412", sha256: "37c241d7f359e463f9f157b06851b379d0f3b91f4f17cf891b0b2cbb5fbc812d" },
      { kind: "Geolocation (EUDR)", fileName: "EUDR_geolocation_lots_T4.geojson", lookupCode: "EUDR-CPH-0412", sha256: "d1e6eb6f533cc7b119d0b90b9b9f964f319de2cf414f96f2baef31c1df34693b" },
      { kind: "Warehouse receipt", fileName: "Phieu_nhap_kho_ca_phe_qua.pdf", lookupCode: "112455", sha256: "0ec6eb6f4a2b4319f70d81f2c9f978a8ac0898ef96723b5bfe9a5116b0af09f9" }
    ],
    verifier: DEMO_FACILITY_V2.verifier,
    confidence: 0.86
  },
  {
    id: "demo-v2-stl-hrc",
    sku: "STL-HRC-2026",
    name: "Thép cuộn cán nóng HRC (đơn vị: tấn)",
    cnCode: "72083900",
    routeCode: "ST-EAF-01",
    units: 420,
    weightKgPerUnit: 1000,
    factory: "Nhà máy thép demo - Hai Phong",
    factoryAddress: "KCN Dinh Vu, Hai Phong, Viet Nam",
    unLocode: "VNHPH",
    materials: [
      { key: "steel_scrap", name: "Thép phế liệu", hsCode: "7204", kgPerUnit: 780, co2ePerKg: 0.42, source: "worldsteel LCI 2024 proxy", color: "#475569" },
      { key: "iron_ore_pellet", name: "Quặng sắt viên", hsCode: "2601", kgPerUnit: 330, co2ePerKg: 1.98, source: "Ecoinvent v3.10", color: "#B45309" }
    ],
    energy: [{ source: "Vietnam national grid", kwhPerUnit: 530, factor: EVN_FACTOR, citation: "Bo TN&MT VN 2024" }],
    transport: [
      { mode: "road", route: "Dinh Vu plant -> Hai Phong port", distanceKm: 18, weightTonnes: 1, defraKey: "freighting_goods_hgv_all_diesel_40t", defraFactor: DEFRA_TRUCK_40T },
      { mode: "sea", route: "Hai Phong -> Rotterdam (bulk)", distanceKm: 18900, weightTonnes: 1, defraKey: "sea_freight_bulk_carrier_average", defraFactor: DEFRA_SEA_BULK }
    ],
    scope1KgCo2eBatch: 176400,
    cbamPenaltyEurPerUnit: 0,
    evidence: [{ kind: "Meter reconciliation", fileName: "EAF_Electricity_Reconciliation_2026-04.pdf", lookupCode: "EAF-HP-0426", sha256: "1e0e5e92828e038b04d59387a0cc12f0aa1178f5b0f8f3d8f311bdc01a275991" }],
    verifier: DEMO_FACILITY_V2.verifier,
    confidence: 0.9
  },
  {
    id: "demo-v2-alu-ext",
    sku: "ALU-EXT-2026",
    name: "Thanh nhôm định hình 6063 (đơn vị: tấn)",
    cnCode: "76042990",
    routeCode: "AL-EXT-01",
    units: 85,
    weightKgPerUnit: 1000,
    factory: "Nhà máy nhôm demo - Ba Ria",
    factoryAddress: "KCN Phu My I, Ba Ria - Vung Tau, Viet Nam",
    unLocode: "VNVUT",
    materials: [
      { key: "primary_aluminium", name: "Phôi nhôm nguyên sinh", hsCode: "7601", kgPerUnit: 680, co2ePerKg: 9.6, source: "IAI 2024 regional average proxy", color: "#64748B" },
      { key: "recycled_aluminium", name: "Nhôm tái chế", hsCode: "7602", kgPerUnit: 370, co2ePerKg: 0.6, source: "Ecoinvent v3.10", color: "#0EA5E9" }
    ],
    energy: [{ source: "Vietnam national grid", kwhPerUnit: 1210, factor: EVN_FACTOR, citation: "Bo TN&MT VN 2024" }],
    transport: [{ mode: "sea", route: "Cai Mep -> Hamburg", distanceKm: 18100, weightTonnes: 1, defraKey: "sea_freight_container_ship_average", defraFactor: DEFRA_SEA_CONTAINER }],
    scope1KgCo2eBatch: 51000,
    cbamPenaltyEurPerUnit: 0,
    evidence: [{ kind: "Billet supplier declaration", fileName: "Billet_origin_declaration_2026.pdf", lookupCode: "ALU-BIL-26", sha256: "54243d411f2013d2e32ffb84de47ab1a0724b721a7a8a6c146afac38d0f8ef75" }],
    verifier: DEMO_FACILITY_V2.verifier,
    confidence: 0.84
  },
  {
    id: "demo-v2-frt-ure",
    sku: "FRT-URE-2026",
    name: "Phân urê hạt đục (đơn vị: tấn)",
    cnCode: "31021010",
    routeCode: "CH-URE-01",
    units: 600,
    weightKgPerUnit: 1000,
    factory: "Nhà máy đạm demo - Phu My",
    factoryAddress: "KCN Phu My I, Ba Ria - Vung Tau, Viet Nam",
    unLocode: "VNPHU",
    materials: [{ key: "natural_gas_feedstock", name: "Khí tự nhiên (nguyên liệu)", kgPerUnit: 420, co2ePerKg: 2.74, source: "IPCC 2006 Vol.3 ammonia; demo allocation", color: "#16A34A" }],
    energy: [{ source: "Vietnam national grid", kwhPerUnit: 160, factor: EVN_FACTOR, citation: "Bo TN&MT VN 2024" }],
    transport: [{ mode: "sea", route: "Phu My -> Antwerp (bulk)", distanceKm: 17900, weightTonnes: 1, defraKey: "sea_freight_bulk_carrier_average", defraFactor: DEFRA_SEA_BULK }],
    scope1KgCo2eBatch: 432000,
    cbamPenaltyEurPerUnit: 0,
    evidence: [{ kind: "Gas meter reading", fileName: "Gas_meter_Phu_My_T4_2026.xlsx", lookupCode: "GAS-PM-0426", sha256: "a9e8745ce119559c7726f8e9058bb669ed67b11527661cb3c4b68fd6b4ce3ee0" }],
    verifier: DEMO_FACILITY_V2.verifier,
    confidence: 0.82
  },
  {
    id: "demo-v2-cem-pcb",
    sku: "CEM-PCB-2026",
    name: "Xi măng Portland PCB40 (đơn vị: tấn)",
    cnCode: "25232900",
    routeCode: "CM-PCB-01",
    units: 3000,
    weightKgPerUnit: 1000,
    factory: "Nhà máy xi măng demo - Ninh Binh",
    factoryAddress: "KCN Gian Khau, Ninh Binh, Viet Nam",
    unLocode: "VNNBH",
    materials: [{ key: "clinker", name: "Clinker", hsCode: "2523", kgPerUnit: 780, co2ePerKg: 0.12, source: "GCCA GNR 2022 proxy", color: "#A16207" }],
    energy: [{ source: "Vietnam national grid", kwhPerUnit: 98, factor: EVN_FACTOR, citation: "Bo TN&MT VN 2024" }],
    transport: [{ mode: "rail", route: "Ninh Binh -> Ho Chi Minh City rail", distanceKm: 1600, weightTonnes: 1, defraKey: "rail_freight_average", defraFactor: DEFRA_RAIL }],
    scope1KgCo2eBatch: 1290000,
    cbamPenaltyEurPerUnit: 0,
    evidence: [{ kind: "Kiln fuel log", fileName: "Kiln_fuel_log_T4_2026.xlsx", lookupCode: "KILN-NB-0426", sha256: "8275a107902cb6b72f2fb93ecffae9e478029b570b2a86541f0e5777d96af41d" }],
    verifier: DEMO_FACILITY_V2.verifier,
    confidence: 0.83
  }
];
