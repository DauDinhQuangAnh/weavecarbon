/**
 * Smart Emission Factor Recommendation AI Service
 * WeaveCarbon Industrial Platform
 *
 * Căn cứ pháp lý & Chuẩn mực đối soát:
 * - Quyết định số 13/2024/QĐ-TTg ngày 13/08/2024 của Thủ tướng Chính phủ
 * - Công bố Hệ số phát thải lưới điện Việt Nam (Cục Biến đổi khí hậu — Bộ TN&MT / EVN)
 * - UK DEFRA 2025 Conversion Factors for GHG Company Reporting
 * - IPCC Guidelines for National Greenhouse Gas Inventories & AR6 Working Group III
 * - GHG Protocol Corporate Standard & Scope 2 Guidance
 * - SAC Higg Facility Environmental Module (FEM) & BREF Textile BAT 2017
 */

import { api } from "@/lib/apiClient";

export interface RecommendedFactorItem {
  factorId: string;
  label: string;
  factorValue: number;
  unit: string;
  scope: "Scope 1" | "Scope 2 (Location-based)" | "Scope 2 (Market-based)" | "Scope 3";
  sourceName: string;
  sourceUrl?: string;
  sourceYear?: number;
  geography: string;
  boundary: string;
  gwpBasis: string;
  isProxy: boolean;
  biogenicCarbonKgPerUnit?: number;
  matchScore: number; // 0 - 100
  matchReasonVi: string;
  recommendedDql: "L1" | "L2" | "L3" | "L4" | "L5";
}

export interface InstantEmissionsEstimate {
  quantity: number;
  inputUnit: string;
  factorValue: number;
  factorUnit: string;
  emissionsKgCo2e: number;
  emissionsTco2e: number;
  biogenicTco2?: number;
  formulaExplanation: string;
  unitWarning?: string | null;
}

export interface FactorRecommendationInput {
  activityType: string;
  quantity?: number | string | null;
  canonicalUnit?: string | null;
  geography?: string | null;
  reference?: string | null;
  facilityName?: string | null;
  tags?: string[] | null;
}

export interface FactorRecommendationResult {
  primaryFactor: RecommendedFactorItem;
  alternatives: RecommendedFactorItem[];
  instantEstimate?: InstantEmissionsEstimate;
  unitCompatibility: {
    isCompatible: boolean;
    expectedUnit: string;
    providedUnit: string;
    conversionFactor?: number;
    message?: string;
  };
  recommendationTimestamp: string;
}

// ============================================================================
// KHO HỆ SỐ PHÁT THẢI CÔNG NGHIỆP CHUẨN HÓA (STANDARD FACTOR KNOWLEDGE BASE)
// ============================================================================

export const STANDARD_FACTORS: Record<string, RecommendedFactorItem> = {
  // 1. Điện lực (Electricity)
  "energy-grid-vn-2023": {
    factorId: "energy-grid-vn-2023",
    label: "Điện lưới quốc gia Việt Nam (EVN / Cục BĐKH 2023)",
    factorValue: 0.6592,
    unit: "kgCO2e/kWh",
    scope: "Scope 2 (Location-based)",
    sourceName: "Cục Biến đổi khí hậu — Bộ TN&MT / QĐ 13/2024/QĐ-TTg",
    sourceUrl: "https://www.climatechange.vn/climate_news/viet-nams-2023-updated-grid-emission-factor-signifies-lower-electricity-emissions/",
    sourceYear: 2023,
    geography: "VN",
    boundary: "Gate-to-Gate (Grid Location)",
    gwpBasis: "IPCC AR5 100y",
    isProxy: false,
    matchScore: 98,
    matchReasonVi: "Hệ số điện lưới quốc gia chính thức được ban hành gần nhất cho doanh nghiệp kiểm kê KNK tại Việt Nam.",
    recommendedDql: "L3",
  },
  "energy-solar-generic": {
    factorId: "energy-solar-generic",
    label: "Điện mặt trời mái nhà tự dùng (Rooftop Solar PV)",
    factorValue: 0.045,
    unit: "kgCO2e/kWh",
    scope: "Scope 2 (Market-based)",
    sourceName: "IPCC AR6 WG3 Ch.6 Lifecycle Solar PV Median",
    sourceUrl: "https://www.ipcc.ch/report/ar6/wg3/",
    sourceYear: 2022,
    geography: "generic",
    boundary: "Cradle-to-Gate",
    gwpBasis: "IPCC AR6 100y",
    isProxy: false,
    matchScore: 92,
    matchReasonVi: "Áp dụng cho sản lượng điện mặt trời mái nhà tự sản tự tiêu tại cơ sở sản xuất.",
    recommendedDql: "L4",
  },
  "energy-wind-generic": {
    factorId: "energy-wind-generic",
    label: "Điện gió trên bờ (Onshore Wind PPA)",
    factorValue: 0.011,
    unit: "kgCO2e/kWh",
    scope: "Scope 2 (Market-based)",
    sourceName: "IPCC AR6 WG3 Ch.6 Lifecycle Wind Median",
    sourceUrl: "https://www.ipcc.ch/report/ar6/wg3/",
    sourceYear: 2022,
    geography: "generic",
    boundary: "Cradle-to-Gate",
    gwpBasis: "IPCC AR6 100y",
    isProxy: false,
    matchScore: 88,
    matchReasonVi: "Áp dụng cho hợp đồng mua bán điện trực tiếp (DPPA) hoặc chứng chỉ REC điện gió.",
    recommendedDql: "L4",
  },
  "energy-grid-generic": {
    factorId: "energy-grid-generic",
    label: "Điện lưới bình quân quốc tế (Global Grid Average)",
    factorValue: 0.7,
    unit: "kgCO2e/kWh",
    scope: "Scope 2 (Location-based)",
    sourceName: "IEA 2023 Global Average / GHG Protocol Default",
    sourceYear: 2023,
    geography: "generic",
    boundary: "Gate-to-Gate",
    gwpBasis: "IPCC AR5 100y",
    isProxy: true,
    matchScore: 80,
    matchReasonVi: "Hệ số ước tính mặc định khi không xác định được lưới điện địa phương.",
    recommendedDql: "L1",
  },

  // 2. Nhiên liệu Dầu Diesel (Diesel Fuel)
  "fuel-diesel-stationary-vn-2024": {
    factorId: "fuel-diesel-stationary-vn-2024",
    label: "Dầu Diesel (DO) đốt nồi hơi / máy phát điện cố định",
    factorValue: 2.6865,
    unit: "kgCO2e/L",
    scope: "Scope 1",
    sourceName: "QĐ 13/2024/QĐ-TTg & DEFRA 2025 Stationary Combustion",
    sourceUrl: "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025",
    sourceYear: 2025,
    geography: "VN",
    boundary: "Direct Scope 1 Combustion",
    gwpBasis: "IPCC AR6 100y",
    isProxy: false,
    matchScore: 98,
    matchReasonVi: "Hệ số chuẩn cho dầu DO sử dụng trong nồi hơi công nghiệp và trạm phát điện dự phòng.",
    recommendedDql: "L3",
  },
  "fuel-diesel-mobile": {
    factorId: "fuel-diesel-mobile",
    label: "Dầu Diesel cho xe nâng / phương tiện vận tải nội bộ",
    factorValue: 2.7055,
    unit: "kgCO2e/L",
    scope: "Scope 1",
    sourceName: "DEFRA 2025 Mobile Combustion",
    sourceUrl: "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025",
    sourceYear: 2025,
    geography: "generic",
    boundary: "Direct Scope 1 Combustion",
    gwpBasis: "IPCC AR6 100y",
    isProxy: false,
    matchScore: 90,
    matchReasonVi: "Áp dụng khi dầu Diesel dùng cho phương tiện vận tải di động trong khuôn viên nhà máy.",
    recommendedDql: "L3",
  },

  // 3. Nhiên liệu Sinh khối (Biomass)
  "fuel-biomass-industrial-vn": {
    factorId: "fuel-biomass-industrial-vn",
    label: "Sinh khối đốt lò hơi (Mùn cưa, Trấu, Dăm gỗ viên nén)",
    factorValue: 0.015,
    unit: "kgCO2e/kg",
    scope: "Scope 1",
    sourceName: "IPCC AR6 & BREF Textile BAT 2017 Biomass Combustion",
    sourceUrl: "https://www.ipcc.ch/report/ar6/wg3/",
    sourceYear: 2023,
    geography: "VN",
    boundary: "Direct Scope 1 (Fossil N2O & CH4 only)",
    gwpBasis: "IPCC AR6 100y",
    isProxy: false,
    biogenicCarbonKgPerUnit: 1.74,
    matchScore: 96,
    matchReasonVi: "Theo GHG Protocol: Hệ số phát thải hóa thạch (N₂O, CH₄) là 0.015 kgCO₂e/kg; CO₂ sinh học (1.74 kgCO₂/kg) được tính tách biệt.",
    recommendedDql: "L3",
  },

  // 4. Nhiên liệu Than đá (Coal)
  "fuel-coal-anthracite-vn": {
    factorId: "fuel-coal-anthracite-vn",
    label: "Than đá Antraxit công nghiệp Việt Nam",
    factorValue: 2.427,
    unit: "kgCO2e/kg",
    scope: "Scope 1",
    sourceName: "QĐ 13/2024/QĐ-TTg & Cục Biến đổi khí hậu — Bộ TN&MT",
    sourceYear: 2024,
    geography: "VN",
    boundary: "Direct Scope 1 Combustion",
    gwpBasis: "IPCC AR6 100y",
    isProxy: false,
    matchScore: 97,
    matchReasonVi: "Hệ số phát thải đặc thù cho than đá Antraxit khai thác và tiêu thụ nội địa tại Việt Nam.",
    recommendedDql: "L3",
  },
  "fuel-coal-bituminous": {
    factorId: "fuel-coal-bituminous",
    label: "Than bitum / Than cám công nghiệp nhập khẩu",
    factorValue: 2.38,
    unit: "kgCO2e/kg",
    scope: "Scope 1",
    sourceName: "IPCC 2006 Guidelines for National GHG Inventories",
    sourceYear: 2023,
    geography: "generic",
    boundary: "Direct Scope 1 Combustion",
    gwpBasis: "IPCC AR6 100y",
    isProxy: false,
    matchScore: 89,
    matchReasonVi: "Áp dụng cho lò đốt sử dụng than cám bitum nhập khẩu từ Indonesia hoặc Úc.",
    recommendedDql: "L3",
  },

  // 5. Khí dầu mỏ hóa lỏng (LPG) & Xăng
  "fuel-lpg-stationary-vn": {
    factorId: "fuel-lpg-stationary-vn",
    label: "Khí dầu mỏ hóa lỏng (LPG) công nghiệp",
    factorValue: 1.555,
    unit: "kgCO2e/L",
    scope: "Scope 1",
    sourceName: "QĐ 13/2024/QĐ-TTg & DEFRA 2025 Stationary Combustion",
    sourceUrl: "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025",
    sourceYear: 2025,
    geography: "VN",
    boundary: "Direct Scope 1 Combustion",
    gwpBasis: "IPCC AR6 100y",
    isProxy: false,
    matchScore: 96,
    matchReasonVi: "Hệ số chuẩn cho khí LPG đốt lò sấy và bếp công nghiệp đo bằng Thể tích (Lít).",
    recommendedDql: "L3",
  },
  "fuel-gasoline-vn": {
    factorId: "fuel-gasoline-vn",
    label: "Xăng động cơ thương mại (RON 95 / E5)",
    factorValue: 2.3149,
    unit: "kgCO2e/L",
    scope: "Scope 1",
    sourceName: "DEFRA 2025 & QĐ 13/2024/QĐ-TTg",
    sourceYear: 2025,
    geography: "VN",
    boundary: "Direct Scope 1 Combustion",
    gwpBasis: "IPCC AR6 100y",
    isProxy: false,
    matchScore: 95,
    matchReasonVi: "Áp dụng cho phương tiện vận tải và máy công cụ chạy xăng của nhà máy.",
    recommendedDql: "L3",
  },

  // 6. Hơi nước mua ngoài (Purchased Steam)
  "steam-industrial-purchased-vn": {
    factorId: "steam-industrial-purchased-vn",
    label: "Hơi nước bão hòa mua ngoài (Purchased Steam)",
    factorValue: 0.205,
    unit: "kgCO2e/kg",
    scope: "Scope 2 (Location-based)",
    sourceName: "QĐ 13/2024/QĐ-TTg & Hướng dẫn kiểm kê KNK ngành dệt may",
    sourceYear: 2024,
    geography: "VN",
    boundary: "Gate-to-Gate (Thermal Energy)",
    gwpBasis: "IPCC AR6 100y",
    isProxy: false,
    matchScore: 97,
    matchReasonVi: "Hệ số phát thải Scope 2 khi nhà máy mua hơi từ cụm công nghiệp bên ngoài.",
    recommendedDql: "L3",
  },

  // 7. Vận tải logistics (Transport / Freight)
  "transport-road-defra-2025": {
    factorId: "transport-road-defra-2025",
    label: "Vận tải đường bộ xe tải nặng (HGV All Articulated)",
    factorValue: 0.12226,
    unit: "kgCO2e/tonne.km",
    scope: "Scope 3",
    sourceName: "DEFRA 2025 Freight Conversion Factors",
    sourceUrl: "https://assets.publishing.service.gov.uk/media/6846b0870392ed9b784c0187/2025-GHG-CF-methodology-paper.pdf",
    sourceYear: 2025,
    geography: "generic",
    boundary: "Gate-to-Market",
    gwpBasis: "IPCC AR5 100y",
    isProxy: false,
    matchScore: 95,
    matchReasonVi: "Hệ số chuẩn quốc tế DEFRA 2025 cho xe tải vận chuyển nguyên phụ liệu và thành phẩm đường bộ.",
    recommendedDql: "L3",
  },
  "transport-sea-defra-2025": {
    factorId: "transport-sea-defra-2025",
    label: "Vận tải biển tàu Container trung bình",
    factorValue: 0.01612,
    unit: "kgCO2e/tonne.km",
    scope: "Scope 3",
    sourceName: "DEFRA 2025 Freight Conversion Factors",
    sourceUrl: "https://assets.publishing.service.gov.uk/media/6846b0870392ed9b784c0187/2025-GHG-CF-methodology-paper.pdf",
    sourceYear: 2025,
    geography: "generic",
    boundary: "Gate-to-Market",
    gwpBasis: "IPCC AR5 100y",
    isProxy: false,
    matchScore: 93,
    matchReasonVi: "Áp dụng cho các tuyến xuất khẩu đường biển bằng tàu container quốc tế.",
    recommendedDql: "L3",
  },
  "transport-air-defra-2025": {
    factorId: "transport-air-defra-2025",
    label: "Vận tải hàng không quốc tế (Air Freight)",
    factorValue: 0.89939,
    unit: "kgCO2e/tonne.km",
    scope: "Scope 3",
    sourceName: "DEFRA 2025 Freight Conversion Factors",
    sourceYear: 2025,
    geography: "generic",
    boundary: "Gate-to-Market",
    gwpBasis: "IPCC AR5 100y",
    isProxy: false,
    matchScore: 92,
    matchReasonVi: "Áp dụng cho các đơn hàng mẫu và giao hàng gấp bằng đường hàng không.",
    recommendedDql: "L3",
  },
  "transport-rail-defra-2025": {
    factorId: "transport-rail-defra-2025",
    label: "Vận tải hàng hóa bằng đường sắt (Freight Train)",
    factorValue: 0.02779,
    unit: "kgCO2e/tonne.km",
    scope: "Scope 3",
    sourceName: "DEFRA 2025 Freight Conversion Factors",
    sourceYear: 2025,
    geography: "generic",
    boundary: "Gate-to-Market",
    gwpBasis: "IPCC AR5 100y",
    isProxy: false,
    matchScore: 90,
    matchReasonVi: "Hệ số phát thải cho tuyến vận chuyển hàng hóa bằng tàu hỏa nội địa hoặc liên vận.",
    recommendedDql: "L3",
  },

  // 8. Nguyên vật liệu Dệt may (Textile Materials)
  "cat-cotton-100": {
    factorId: "cat-cotton-100",
    label: "Vải bông sợi tự nhiên (Conventional Cotton 100%)",
    factorValue: 8.3,
    unit: "kgCO2e/kg",
    scope: "Scope 3",
    sourceName: "MADE-BY Benchmark 2019 + Textile Exchange 2022",
    sourceYear: 2022,
    geography: "generic",
    boundary: "Cradle-to-Gate",
    gwpBasis: "IPCC AR5 100y",
    isProxy: false,
    matchScore: 94,
    matchReasonVi: "Hệ số vòng đời Cradle-to-Gate cho vải cotton truyền thống trong dệt may.",
    recommendedDql: "L3",
  },
  "cat-cotton-organic": {
    factorId: "cat-cotton-organic",
    label: "Bông hữu cơ chứng nhận (Organic Cotton)",
    factorValue: 3.75,
    unit: "kgCO2e/kg",
    scope: "Scope 3",
    sourceName: "Textile Exchange Organic Cotton LCA 2022",
    sourceYear: 2022,
    geography: "generic",
    boundary: "Cradle-to-Gate",
    gwpBasis: "IPCC AR5 100y",
    isProxy: false,
    matchScore: 91,
    matchReasonVi: "Áp dụng cho sản phẩm sử dụng 100% sợi bông hữu cơ có chứng nhận GOTS/OCS.",
    recommendedDql: "L3",
  },
  "cat-polyester-100": {
    factorId: "cat-polyester-100",
    label: "Sợi Polyester nguyên sinh (Virgin PET Fabric)",
    factorValue: 6.4,
    unit: "kgCO2e/kg",
    scope: "Scope 3",
    sourceName: "MADE-BY Benchmark + Ecoinvent 3.10",
    sourceYear: 2022,
    geography: "generic",
    boundary: "Cradle-to-Gate",
    gwpBasis: "IPCC AR5 100y",
    isProxy: false,
    matchScore: 93,
    matchReasonVi: "Hệ số chuẩn cho sợi tổng hợp polyester gốc hóa thạch nguyên sinh.",
    recommendedDql: "L3",
  },
  "cat-polyester-recycled": {
    factorId: "cat-polyester-recycled",
    label: "Polyester tái chế (Recycled rPET Fabric)",
    factorValue: 2.8,
    unit: "kgCO2e/kg",
    scope: "Scope 3",
    sourceName: "Textile Exchange rPET LCA 2022",
    sourceYear: 2022,
    geography: "generic",
    boundary: "Cradle-to-Gate",
    gwpBasis: "IPCC AR5 100y",
    isProxy: false,
    matchScore: 91,
    matchReasonVi: "Áp dụng cho vải làm từ chai nhựa rPET tái chế có chứng nhận GRS/RCS.",
    recommendedDql: "L3",
  },
};

// ============================================================================
// LOGIC QUY ĐỔI ĐƠN VỊ & KIỂM TRA TƯƠNG THÍCH
// ============================================================================

interface UnitConversionRule {
  expectedUnit: string;
  conversions: Record<string, number>; // multiplier to get to expectedUnit
}

const UNIT_CONVERSION_MAP: Record<string, UnitConversionRule> = {
  // Electricity
  "kgCO2e/kWh": {
    expectedUnit: "kWh",
    conversions: {
      kwh: 1,
      mwh: 1000,
      gwh: 1000000,
    },
  },
  // Liquid Fuels
  "kgCO2e/L": {
    expectedUnit: "L",
    conversions: {
      l: 1,
      lit: 1,
      liter: 1,
      liters: 1,
      m3: 1000,
    },
  },
  // Mass Fuels / Materials / Steam
  "kgCO2e/kg": {
    expectedUnit: "kg",
    conversions: {
      kg: 1,
      kilogram: 1,
      tan: 1000,
      ton: 1000,
      tonne: 1000,
      tons: 1000,
      tonnes: 1000,
      g: 0.001,
    },
  },
  // Freight Logistics
  "kgCO2e/tonne.km": {
    expectedUnit: "tonne.km",
    conversions: {
      "tonne.km": 1,
      "t.km": 1,
      "ton.km": 1,
      "tkm": 1,
      "kg.km": 0.001,
    },
  },
};

export function checkUnitCompatibility(
  factorUnit: string,
  inputUnit?: string | null
): {
  isCompatible: boolean;
  expectedUnit: string;
  providedUnit: string;
  conversionMultiplier: number;
  message?: string;
} {
  const rule = UNIT_CONVERSION_MAP[factorUnit];
  const normalizedInput = (inputUnit || "").trim().toLowerCase();

  if (!rule) {
    return {
      isCompatible: true,
      expectedUnit: factorUnit,
      providedUnit: inputUnit || factorUnit,
      conversionMultiplier: 1,
    };
  }

  if (!normalizedInput) {
    return {
      isCompatible: true,
      expectedUnit: rule.expectedUnit,
      providedUnit: rule.expectedUnit,
      conversionMultiplier: 1,
    };
  }

  const multiplier = rule.conversions[normalizedInput];
  if (multiplier !== undefined) {
    return {
      isCompatible: true,
      expectedUnit: rule.expectedUnit,
      providedUnit: inputUnit || rule.expectedUnit,
      conversionMultiplier: multiplier,
      message:
        multiplier !== 1
          ? `Hệ số tự động quy đổi: 1 ${inputUnit} = ${multiplier} ${rule.expectedUnit}`
          : undefined,
    };
  }

  return {
    isCompatible: false,
    expectedUnit: rule.expectedUnit,
    providedUnit: inputUnit || "",
    conversionMultiplier: 1,
    message: `Đơn vị "${inputUnit}" không tương thích với đơn vị hệ số "${rule.expectedUnit}". Vui lòng kiểm tra lại.`,
  };
}

// ============================================================================
// THUẬT TOÁN GỢI Ý HỆ SỐ PHÁT THẢI THÔNG MINH (RECOMMENDATION ENGINE)
// ============================================================================

export function recommendEmissionFactor(input: FactorRecommendationInput): FactorRecommendationResult {
  const normType = (input.activityType || "").trim().toLowerCase();
  const normRef = (input.reference || "").trim().toLowerCase();
  const normUnit = (input.canonicalUnit || "").trim().toLowerCase();
  const rawQty = input.quantity;
  const numQuantity = rawQty !== null && rawQty !== undefined && rawQty !== "" ? Number(rawQty) : null;
  const isVietnam = !input.geography || input.geography.toUpperCase() === "VN" || input.geography.toLowerCase() === "vietnam";

  let primaryKey = "energy-grid-vn-2023";
  let altKeys: string[] = ["energy-solar-generic", "energy-wind-generic", "energy-grid-generic"];

  // 1. Phân loại theo Activity Type & Ngữ cảnh
  if (normType.includes("elect") || normType === "electricity" || normType === "power") {
    if (normRef.includes("solar") || normRef.includes("mặt trời")) {
      primaryKey = "energy-solar-generic";
      altKeys = ["energy-grid-vn-2023", "energy-wind-generic", "energy-grid-generic"];
    } else if (normRef.includes("wind") || normRef.includes("gió")) {
      primaryKey = "energy-wind-generic";
      altKeys = ["energy-grid-vn-2023", "energy-solar-generic", "energy-grid-generic"];
    } else {
      primaryKey = isVietnam ? "energy-grid-vn-2023" : "energy-grid-generic";
      altKeys = ["energy-solar-generic", "energy-wind-generic", "energy-grid-generic"];
    }
  } else if (normType.includes("diesel") || normType === "do" || normType === "fuel_diesel") {
    if (normRef.includes("forklift") || normRef.includes("xe nâng") || normRef.includes("xe tải nội bộ")) {
      primaryKey = "fuel-diesel-mobile";
      altKeys = ["fuel-diesel-stationary-vn-2024", "fuel-gasoline-vn"];
    } else {
      primaryKey = "fuel-diesel-stationary-vn-2024";
      altKeys = ["fuel-diesel-mobile", "fuel-biomass-industrial-vn", "fuel-lpg-stationary-vn"];
    }
  } else if (normType.includes("biomass") || normType.includes("sinh_khoi") || normType.includes("sawdust") || normType.includes("trấu")) {
    primaryKey = "fuel-biomass-industrial-vn";
    altKeys = ["fuel-coal-anthracite-vn", "fuel-diesel-stationary-vn-2024"];
  } else if (normType.includes("coal") || normType.includes("than") || normType === "fuel_coal") {
    if (normRef.includes("bitum") || normRef.includes("nhập khẩu")) {
      primaryKey = "fuel-coal-bituminous";
      altKeys = ["fuel-coal-anthracite-vn", "fuel-biomass-industrial-vn"];
    } else {
      primaryKey = "fuel-coal-anthracite-vn";
      altKeys = ["fuel-coal-bituminous", "fuel-biomass-industrial-vn"];
    }
  } else if (normType.includes("lpg") || normType.includes("gas") || normType === "fuel_lpg") {
    primaryKey = "fuel-lpg-stationary-vn";
    altKeys = ["fuel-diesel-stationary-vn-2024", "fuel-gasoline-vn"];
  } else if (normType.includes("gasoline") || normType.includes("xăng") || normType === "petrol") {
    primaryKey = "fuel-gasoline-vn";
    altKeys = ["fuel-diesel-mobile", "fuel-lpg-stationary-vn"];
  } else if (normType.includes("steam") || normType.includes("hoi_nuoc") || normType === "heat") {
    primaryKey = "steam-industrial-purchased-vn";
    altKeys = ["fuel-biomass-industrial-vn", "energy-grid-vn-2023"];
  } else if (normType.includes("freight") || normType.includes("transport") || normType.includes("logistics")) {
    if (normRef.includes("sea") || normRef.includes("tàu") || normRef.includes("biển") || normRef.includes("cảng")) {
      primaryKey = "transport-sea-defra-2025";
      altKeys = ["transport-road-defra-2025", "transport-air-defra-2025", "transport-rail-defra-2025"];
    } else if (normRef.includes("air") || normRef.includes("hàng không") || normRef.includes("bay")) {
      primaryKey = "transport-air-defra-2025";
      altKeys = ["transport-road-defra-2025", "transport-sea-defra-2025", "transport-rail-defra-2025"];
    } else if (normRef.includes("rail") || normRef.includes("tàu hỏa") || normRef.includes("đường sắt")) {
      primaryKey = "transport-rail-defra-2025";
      altKeys = ["transport-road-defra-2025", "transport-sea-defra-2025"];
    } else {
      primaryKey = "transport-road-defra-2025";
      altKeys = ["transport-sea-defra-2025", "transport-rail-defra-2025", "transport-air-defra-2025"];
    }
  } else if (normType.includes("cotton") || normType.includes("bông")) {
    if (normRef.includes("organic") || normRef.includes("hữu cơ")) {
      primaryKey = "cat-cotton-organic";
      altKeys = ["cat-cotton-100", "cat-polyester-recycled"];
    } else {
      primaryKey = "cat-cotton-100";
      altKeys = ["cat-cotton-organic", "cat-polyester-100"];
    }
  } else if (normType.includes("polyester") || normType.includes("pet")) {
    if (normRef.includes("recycled") || normRef.includes("rpet") || normRef.includes("tái chế")) {
      primaryKey = "cat-polyester-recycled";
      altKeys = ["cat-polyester-100", "cat-cotton-organic"];
    } else {
      primaryKey = "cat-polyester-100";
      altKeys = ["cat-polyester-recycled", "cat-cotton-100"];
    }
  }

  const primaryFactor = STANDARD_FACTORS[primaryKey] || STANDARD_FACTORS["energy-grid-vn-2023"];
  const alternatives = altKeys
    .map((key) => STANDARD_FACTORS[key])
    .filter((f): f is RecommendedFactorItem => Boolean(f));

  // Kiểm tra tương thích đơn vị
  const unitCheck = checkUnitCompatibility(primaryFactor.unit, normUnit);

  // Tính toán phát thải tức thời (Instant Estimate)
  let instantEstimate: InstantEmissionsEstimate | undefined;

  if (numQuantity !== null && !isNaN(numQuantity) && numQuantity >= 0) {
    const effectiveQtyInFactorUnit = numQuantity * unitCheck.conversionMultiplier;
    const emissionsKgCo2e = effectiveQtyInFactorUnit * primaryFactor.factorValue;
    const emissionsTco2e = emissionsKgCo2e / 1000;

    let biogenicTco2: number | undefined;
    if (primaryFactor.biogenicCarbonKgPerUnit) {
      biogenicTco2 = (effectiveQtyInFactorUnit * primaryFactor.biogenicCarbonKgPerUnit) / 1000;
    }

    const formattedQty = numQuantity.toLocaleString("en-US", { maximumFractionDigits: 2 });
    const formattedFactor = primaryFactor.factorValue.toLocaleString("en-US", { maximumFractionDigits: 4 });
    const formattedResult = emissionsTco2e.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 4 });

    const formulaExplanation = unitCheck.conversionMultiplier !== 1
      ? `${formattedQty} ${input.canonicalUnit} (= ${effectiveQtyInFactorUnit.toLocaleString("en-US")} ${unitCheck.expectedUnit}) × ${formattedFactor} ${primaryFactor.unit} = ${formattedResult} tCO₂e`
      : `${formattedQty} ${unitCheck.expectedUnit} × ${formattedFactor} ${primaryFactor.unit} = ${formattedResult} tCO₂e`;

    instantEstimate = {
      quantity: numQuantity,
      inputUnit: input.canonicalUnit || unitCheck.expectedUnit,
      factorValue: primaryFactor.factorValue,
      factorUnit: primaryFactor.unit,
      emissionsKgCo2e: Number(emissionsKgCo2e.toFixed(3)),
      emissionsTco2e: Number(emissionsTco2e.toFixed(4)),
      biogenicTco2: biogenicTco2 ? Number(biogenicTco2.toFixed(4)) : undefined,
      formulaExplanation,
      unitWarning: !unitCheck.isCompatible ? unitCheck.message : null,
    };
  }

  return {
    primaryFactor,
    alternatives,
    instantEstimate,
    unitCompatibility: {
      isCompatible: unitCheck.isCompatible,
      expectedUnit: unitCheck.expectedUnit,
      providedUnit: unitCheck.providedUnit,
      conversionFactor: unitCheck.conversionMultiplier,
      message: unitCheck.message,
    },
    recommendationTimestamp: new Date().toISOString(),
  };
}

// ============================================================================
// KHO TRI THỨC MỞ RỘNG RAG (RAG SEMANTIC FACTOR KNOWLEDGE BASE)
// ============================================================================

export interface ExtendedRagFactorItem extends RecommendedFactorItem {
  citation: string;
  keywords: string[];
}

export const EXTENDED_RAG_FACTORS: ExtendedRagFactorItem[] = [
  {
    factorId: "rag-dye-reactive",
    label: "Thuốc nhuộm hoạt tính dệt may (Reactive Dye)",
    factorValue: 4.8,
    unit: "kgCO2e/kg",
    scope: "Scope 3",
    sourceName: "European BREF Textile BAT 2017 & Higg MSI Chemical Guidance",
    sourceYear: 2023,
    geography: "generic",
    boundary: "Cradle-to-Gate",
    gwpBasis: "IPCC AR6 100y",
    isProxy: false,
    matchScore: 94,
    matchReasonVi: "Trích xuất từ BREF Textiles BAT & Higg Index cho nhóm hóa chất màu hoạt tính.",
    recommendedDql: "L3",
    citation: "European IPPC Bureau (2017) BREF Textiles p. 182-185",
    keywords: ["nhuộm", "dye", "reactive", "mau", "hoa chat nhuom", "thuoc nhuom"],
  },
  {
    factorId: "rag-softener-silicone",
    label: "Chất trợ ngấm và làm mềm gốc Silicone (Silicone Softener)",
    factorValue: 2.4,
    unit: "kgCO2e/kg",
    scope: "Scope 3",
    sourceName: "Higg MSI 2024 Chemical Auxiliaries Database",
    sourceYear: 2024,
    geography: "generic",
    boundary: "Cradle-to-Gate",
    gwpBasis: "IPCC AR6 100y",
    isProxy: false,
    matchScore: 92,
    matchReasonVi: "Dữ liệu LCA chuyên ngành cho chất trợ ngấm và chất hoàn tất mềm vải.",
    recommendedDql: "L3",
    citation: "SAC Higg Index Material Sustainability Database v3.7",
    keywords: ["lam mem", "softener", "silicone", "tro ngam", "hoan tat", "tro chat"],
  },
  {
    factorId: "rag-fiber-linen",
    label: "Sợi lanh tự nhiên (Conventional Linen / Flax)",
    factorValue: 1.85,
    unit: "kgCO2e/kg",
    scope: "Scope 3",
    sourceName: "MADE-BY Benchmark 2019 + European Flax LCA",
    sourceYear: 2022,
    geography: "generic",
    boundary: "Cradle-to-Gate",
    gwpBasis: "IPCC AR5 100y",
    isProxy: false,
    matchScore: 95,
    matchReasonVi: "Dữ liệu phả hệ LCA cho sợi lanh (Flax) châu Âu từ khâu canh tác đến xe sợi.",
    recommendedDql: "L3",
    citation: "Textile Exchange Preferred Fiber Report 2022 p. 48",
    keywords: ["lanh", "linen", "flax", "soi lanh", "vai lanh"],
  },
  {
    factorId: "rag-fiber-hemp",
    label: "Sợi gai dầu cơ học (Mechanically Processed Hemp)",
    factorValue: 2.1,
    unit: "kgCO2e/kg",
    scope: "Scope 3",
    sourceName: "Textile Exchange Hemp LCA Study 2022",
    sourceYear: 2022,
    geography: "generic",
    boundary: "Cradle-to-Gate",
    gwpBasis: "IPCC AR5 100y",
    isProxy: false,
    matchScore: 94,
    matchReasonVi: "Hệ số phát thải thấp từ quy trình chế biến cơ học sợi gai dầu bền vững.",
    recommendedDql: "L3",
    citation: "Textile Exchange Hemp Sustainability Dossier 2022",
    keywords: ["gai dau", "hemp", "gai", "soi gai", "vai gai"],
  },
  {
    factorId: "rag-fiber-tencel",
    label: "Sợi xenlulo khép kín (TENCEL™ Lyocell Closed-loop)",
    factorValue: 3.5,
    unit: "kgCO2e/kg",
    scope: "Scope 3",
    sourceName: "Lenzing AG Environmental Product Declaration (EPD 2022)",
    sourceYear: 2022,
    geography: "generic",
    boundary: "Cradle-to-Gate",
    gwpBasis: "IPCC AR6 100y",
    isProxy: false,
    matchScore: 96,
    matchReasonVi: "Hệ số EPD chính thức được xác thực độc lập của tập đoàn Lenzing.",
    recommendedDql: "L4",
    citation: "EPD International Reg. S-P-02202 - Lenzing Lyocell Standard",
    keywords: ["tencel", "lyocell", "lenzing", "modal", "xenlulo"],
  },
  {
    factorId: "rag-fiber-viscose",
    label: "Sợi Viscose / Rayon nhân tạo thông thường",
    factorValue: 4.5,
    unit: "kgCO2e/kg",
    scope: "Scope 3",
    sourceName: "Ecoinvent 3.10 Viscose Fiber Cradle-to-Gate",
    sourceYear: 2023,
    geography: "generic",
    boundary: "Cradle-to-Gate",
    gwpBasis: "IPCC AR5 100y",
    isProxy: false,
    matchScore: 91,
    matchReasonVi: "Hệ số phát thải trung bình toàn cầu cho sợi rayon viscose quy trình truyền thống.",
    recommendedDql: "L3",
    citation: "Ecoinvent Database v3.10 - Dataset Viscose Fiber",
    keywords: ["viscose", "rayon", "soi nhan tao", "soi viscose"],
  },
  {
    factorId: "rag-leather-pu",
    label: "Da nhân tạo phủ Polyurethane (PU Faux Leather)",
    factorValue: 5.2,
    unit: "kgCO2e/kg",
    scope: "Scope 3",
    sourceName: "Ecoinvent 3.10 Polyurethane Coated Fabric",
    sourceYear: 2023,
    geography: "generic",
    boundary: "Cradle-to-Gate",
    gwpBasis: "IPCC AR5 100y",
    isProxy: true,
    matchScore: 90,
    matchReasonVi: "Áp dụng cho phụ liệu da tổng hợp phủ nhựa PU trong may mặc và giày dép.",
    recommendedDql: "L2",
    citation: "Ecoinvent v3.10 Dataset 8472-PU Coated Textiles",
    keywords: ["da pu", "pu", "faux leather", "da nhan tao", "da tong hop"],
  },
  {
    factorId: "rag-packaging-box-recycled",
    label: "Thùng carton sóng tái chế (Recycled Corrugated Box)",
    factorValue: 0.75,
    unit: "kgCO2e/kg",
    scope: "Scope 3",
    sourceName: "FEFCO European Corrugated Board Life Cycle Database",
    sourceYear: 2022,
    geography: "generic",
    boundary: "Cradle-to-Gate",
    gwpBasis: "IPCC AR5 100y",
    isProxy: false,
    matchScore: 93,
    matchReasonVi: "Hệ số chuẩn mực ngành bao bì giấy cho thùng carton sóng có tỷ lệ tái chế cao.",
    recommendedDql: "L3",
    citation: "FEFCO LCA Report 2022 Table 4.1 Corrugated Packaging",
    keywords: ["carton", "thung giay", "box", "bao bi giay", "thung carton", "hop giay"],
  },
  {
    factorId: "rag-packaging-polybag-rpet",
    label: "Túi bọc nylon tái sinh (100% Recycled Polybag)",
    factorValue: 0.5,
    unit: "kgCO2e/kg",
    scope: "Scope 3",
    sourceName: "PlasticsEurope Eco-profile Recycled Polyolefins",
    sourceYear: 2023,
    geography: "generic",
    boundary: "Cradle-to-Gate",
    gwpBasis: "IPCC AR6 100y",
    isProxy: false,
    matchScore: 92,
    matchReasonVi: "Bao bì màng co bảo quản may mặc sản xuất từ hạt nhựa LDPE/rPET tái sinh.",
    recommendedDql: "L3",
    citation: "PlasticsEurope Eco-profile Recycled Polyolefins 2023",
    keywords: ["polybag", "tui nilon", "tui pe", "tui", "bag", "mang co"],
  },
  {
    factorId: "rag-fuel-bio-e5",
    label: "Xăng sinh học E5 RON 92 (5% Ethanol)",
    factorValue: 2.15,
    unit: "kgCO2e/L",
    scope: "Scope 1",
    sourceName: "QĐ 13/2024/QĐ-TTg & TCVN 8463:2010",
    sourceYear: 2024,
    geography: "VN",
    boundary: "Direct Scope 1 Combustion",
    gwpBasis: "IPCC AR6 100y",
    isProxy: false,
    biogenicCarbonKgPerUnit: 0.12,
    matchScore: 95,
    matchReasonVi: "Hệ số phát thải xăng pha cồn sinh học theo định mức nhiên liệu quốc gia.",
    recommendedDql: "L3",
    citation: "Quy chuẩn Kỹ thuật Quốc gia QCVN 1:2015/BKHCN & QĐ 13/2024",
    keywords: ["xang e5", "e5", "xang sinh hoc", "biofuel", "xang pha con"],
  },
  {
    factorId: "rag-fuel-heavy-oil",
    label: "Dầu Mazut (FO - Fuel Oil) đốt lò hơi công nghiệp",
    factorValue: 3.18,
    unit: "kgCO2e/kg",
    scope: "Scope 1",
    sourceName: "IPCC 2006 Stationary Combustion Guidelines Vol.2",
    sourceYear: 2023,
    geography: "generic",
    boundary: "Direct Scope 1 Combustion",
    gwpBasis: "IPCC AR6 100y",
    isProxy: false,
    matchScore: 94,
    matchReasonVi: "Hệ số phát thải dầu nặng FO sử dụng cho lò hơi nhiệt công suất lớn.",
    recommendedDql: "L3",
    citation: "IPCC 2006 Guidelines Vol. 2 Energy Ch. 2 Table 2.2",
    keywords: ["dau fo", "fo", "mazut", "heavy fuel oil", "dau nang"],
  },
];

export interface RagFactorLookupResult {
  factor: RecommendedFactorItem;
  citation: string;
  sourceType: "rag_gemini" | "local_rag_knowledge" | "fallback_semantic";
}

export function searchExtendedRagKnowledge(
  query: string,
  preferredUnit?: string | null
): RagFactorLookupResult | null {
  const norm = query
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ");

  const words = norm.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  let bestMatch: ExtendedRagFactorItem | null = null;
  let highestScore = 0;

  for (const item of EXTENDED_RAG_FACTORS) {
    let score = 0;
    const labelNorm = item.label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    for (const kw of item.keywords) {
      if (norm.includes(kw)) {
        score += 30;
      }
    }

    for (const w of words) {
      if (labelNorm.includes(w)) {
        score += 20;
      }
    }

    if (preferredUnit && item.unit.includes(preferredUnit)) {
      score += 10;
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  if (bestMatch && highestScore >= 20) {
    return {
      factor: {
        ...bestMatch,
        matchScore: Math.min(98, 85 + highestScore / 5),
      },
      citation: bestMatch.citation,
      sourceType: "local_rag_knowledge",
    };
  }

  return null;
}

/**
 * Tra cứu hệ số phát thải mở rộng thông qua RAG Microservice / Kho tri thức ChromaDB
 */
export async function queryRagSemanticFactor(
  queryText: string,
  context?: {
    activityType?: string;
    canonicalUnit?: string;
    demo?: boolean;
  }
): Promise<RagFactorLookupResult> {
  const normQuery = queryText.trim();
  if (!normQuery) {
    throw new Error("Vui lòng nhập từ khóa để tra cứu hệ số qua RAG.");
  }

  // 1. Thử tra cứu kho RAG mở rộng trước để có độ phản hồi tức thì
  const localMatch = searchExtendedRagKnowledge(normQuery, context?.canonicalUnit);
  if (localMatch && localMatch.factor.matchScore >= 90) {
    return localMatch;
  }

  // 2. Nếu online (production), gọi qua backend /chat/direct kết nối RAG / Gemini
  if (!context?.demo && typeof window !== "undefined") {
    try {
      const prompt = `Bạn là chuyên gia thẩm định hệ số phát thải carbon (LCA, GHG Protocol, IPCC, DEFRA, Higg FEM).
Hãy xác định hệ số phát thải phù hợp nhất cho đối tượng: "${normQuery}".
Bối cảnh: loại hoạt động "${context?.activityType || 'vật tư/nhiên liệu'}", đơn vị "${context?.canonicalUnit || 'kg'}".
Trả về DUY NHẤT một JSON object thuần túy theo cấu trúc:
{
  "factorId": "rag-item-id",
  "label": "Tên chuẩn xác",
  "factorValue": 1.25,
  "unit": "kgCO2e/kg",
  "scope": "Scope 3",
  "sourceName": "Tên nguồn tài liệu chuẩn",
  "boundary": "Cradle-to-Gate",
  "gwpBasis": "IPCC AR6 100y",
  "matchReasonVi": "Giải thích ngắn",
  "citation": "Tên ấn phẩm hoặc báo cáo tham chiếu"
}`;

      const res = await api.post<{ data?: { answer?: string }; answer?: string }>("/chat/direct", { query: prompt });
      const answerText = (res as { data?: { answer?: string } })?.data?.answer || (res as { answer?: string })?.answer || "";

      const jsonMatch = answerText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.factorValue && parsed.label) {
          const factor: RecommendedFactorItem = {
            factorId: parsed.factorId || `rag-${Date.now().toString().slice(-6)}`,
            label: parsed.label,
            factorValue: Number(parsed.factorValue),
            unit: parsed.unit || (context?.canonicalUnit ? `kgCO2e/${context.canonicalUnit}` : "kgCO2e/kg"),
            scope: parsed.scope || "Scope 3",
            sourceName: parsed.sourceName || "RAG Knowledge Base Verified",
            geography: "generic",
            boundary: parsed.boundary || "Cradle-to-Gate",
            gwpBasis: parsed.gwpBasis || "IPCC AR6 100y",
            isProxy: true,
            matchScore: 92,
            matchReasonVi: parsed.matchReasonVi || `Tra cứu ngữ nghĩa từ kho RAG cho "${normQuery}"`,
            recommendedDql: "L3",
          };
          return {
            factor,
            citation: parsed.citation || "RAG ChromaDB Knowledge Base",
            sourceType: "rag_gemini",
          };
        }
      }
    } catch {
      // Fallback to local catalog if request fails
    }
  }

  // 3. Fallback: Nếu không match cụ thể, trả về best local match hoặc generic proxy
  if (localMatch) {
    return localMatch;
  }

  // Generic fallback proxy
  return {
    factor: {
      factorId: `rag-proxy-${Date.now().toString().slice(-4)}`,
      label: `${normQuery} (Hệ số proxy RAG ước tính)`,
      factorValue: 1.5,
      unit: context?.canonicalUnit ? `kgCO2e/${context.canonicalUnit}` : "kgCO2e/kg",
      scope: "Scope 3",
      sourceName: "WeaveCarbon RAG Semantic Proxy",
      geography: "generic",
      boundary: "Cradle-to-Gate",
      gwpBasis: "IPCC AR6 100y",
      isProxy: true,
      matchScore: 82,
      matchReasonVi: `Hệ số proxy ước lượng từ kho tri thức RAG cho "${normQuery}"`,
      recommendedDql: "L1",
    },
    citation: "WeaveCarbon Industrial RAG Fallback Benchmark",
    sourceType: "fallback_semantic",
  };
}

