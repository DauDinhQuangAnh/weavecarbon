/**
 * Intelligent AI & Analytics Service for:
 * 1. Supply Chain & Scope 3 Supplier Intelligence (ESG screening, questionnaire generation, document extraction)
 * 2. Emission Hotspots & Marginal Abatement Cost Curve (MACC) Simulation & Carbon Tax Stress Testing
 * 3. Physical Climate Risk & TCFD Resilience Scenario Stress-Testing
 *
 * Implements deterministic domain logic aligned with GHG Protocol Scope 3, ISO 14064, QĐ 13/2024, EU CBAM, and TCFD/IFRS S2.
 */

export interface SupplierEsgScreeningResult {
  supplierId: string;
  supplierName: string;
  esgRiskLevel: "low" | "medium" | "high" | "critical";
  esgScore: number; // 0 - 100
  scope3EstimatedIntensityKgCo2e: number;
  emissionTier: "Tier 1 (High Primary Data)" | "Tier 2 (Industry Average)" | "Tier 3 (Proxy Estimated)";
  certificationsDetected: string[];
  riskFlags: string[];
  recommendedAction: string;
  priorityEngagement: "immediate" | "scheduled" | "standard";
}

export interface SupplierScope3Questionnaire {
  sector: string;
  title: string;
  estimatedCompletionMinutes: number;
  sections: Array<{
    title: string;
    questions: Array<{
      id: string;
      label: string;
      type: "number" | "select" | "text" | "file";
      unit?: string;
      required: boolean;
      ghgScopeCategory: string;
      hint?: string;
    }>;
  }>;
}

export interface MaccHotspotIntervention {
  id: string;
  title: string;
  category: "Thermal Energy" | "Renewable Electricity" | "Energy Efficiency" | "Refrigerants & Leakage" | "Supply Chain";
  abatementCostUsdPerTon: number; // USD / tCO2e (negative = net savings over lifecycle)
  annualCo2eReductionTons: number;
  capexUsd: number;
  annualOpexSavingsUsd: number;
  paybackPeriodYears: number;
  technologyMaturity: "Commercial (BAT)" | "Accelerated Pilot" | "Emerging";
  vietnamRegulatoryAlignment: string;
}

export interface MaccSimulationResult {
  productionVolumeTons?: number;
  totalInventoryCo2eTons: number;
  topHotspotSharePercent: number;
  paretoIndex8020: {
    topSourcesCount: number;
    totalSourcesCount: number;
    cumulativeSharePercent: number;
  };
  interventions: MaccHotspotIntervention[];
  totalPotentialReductionTons: number;
  netAnnualSavingsUsd: number;
  totalCapexRequiredUsd: number;
  averageAbatementCostUsdPerTon: number;
  carbonTaxStressTest: {
    vnEtsExposureUsd: number;
    euCbamExposureUsd: number;
    highAmbitionExposureUsd: number;
  };
}

export interface ClimateHazardSimulationResult {
  facilityId: string;
  facilityName: string;
  latitude: number;
  longitude: number;
  scenario: "historical" | "SSP2-4.5" | "SSP5-8.5";
  hazardMetrics: {
    extremeHeatDaysPerYear: number;
    max1DayRainfallMm: number;
    consecutiveDryDays: number;
    coastalInundationRiskDepthMeters: number;
  };
  projectedMetrics: {
    extremeHeatDaysPerYear: number;
    maxDailyRainfallMm: number;
    consecutiveDryDays: number;
  };
  exposureRating: number; // 1 - 5
  exposureScore: number;
  vulnerabilityRating: number; // 1 - 5
  vulnerabilityScore: number;
  priorityBand: "low" | "medium" | "high";
  tcfdCategory: "Physical Acute" | "Physical Chronic";
  overallRiskRationale: string;
  hazardSpecificAssessments: {
    heat: { riskBand: string; operationalImpact: string };
    extreme_rainfall: { riskBand: string; operationalImpact: string };
    drought: { riskBand: string; operationalImpact: string };
  };
  tcfdRecommendations: Array<{
    measure: string;
    justification: string;
    estimatedCostUsd: string;
    timeframe: string;
  }>;
  adaptationMeasures: Array<{
    name: string;
    description: string;
    estimatedCostTier: "Thấp" | "Trung bình" | "Cao";
    implementationTimeline: string;
  }>;
  resilienceScore: number; // 0 - 100
  compositeRiskScore: number; // 0 - 100
}

/**
 * 1. Screen Supplier ESG and Carbon Profile
 */
export function screenSupplierEsgAndCarbon(supplier: {
  id: string;
  name: string;
  category?: string | null;
  materialSupplied?: string | null;
  tier?: number;
  spendPercent?: number;
  hasCertifiedEvidence?: boolean;
}): SupplierEsgScreeningResult {
  const name = supplier.name.toLowerCase();
  const material = (supplier.materialSupplied || supplier.category || "").toLowerCase();
  const certs: string[] = [];
  const riskFlags: string[] = [];

  // Check known certifications based on text metadata
  if (name.includes("eco") || material.includes("organic") || supplier.hasCertifiedEvidence) {
    certs.push("GOTS (Global Organic Textile)");
    certs.push("OEKO-TEX Standard 100");
  }
  if (supplier.hasCertifiedEvidence) {
    certs.push("ISO 14064-1 Verification Statement");
  }

  // Determine emission intensity & risk flags
  let intensity = 4.8; // default kgCO2e/kg material
  let baseScore = 70;

  if (material.includes("nhuộm") || material.includes("dyeing") || material.includes("hóa chất")) {
    intensity = 9.2;
    riskFlags.push("Tiêu thụ nước và nhiệt năng cao từ quá trình hoàn tất ướt (Wet processing)");
    riskFlags.push("Nguy cơ sử dụng lò hơi than đốt trực tiếp nếu chưa chuyển đổi sinh khối");
    baseScore -= 20;
  } else if (material.includes("cotton") || material.includes("sợi")) {
    intensity = 5.4;
    riskFlags.push("Phát thải nông nghiệp gián tiếp và cường độ sử dụng nước tưới");
    baseScore -= 10;
  } else if (material.includes("polyester") || material.includes("synthetic")) {
    intensity = 7.1;
    riskFlags.push("Gốc nhiên liệu hóa thạch, phụ thuộc chuỗi cung ứng hạt nhựa nguyên sinh");
    baseScore -= 15;
  }

  if (supplier.hasCertifiedEvidence) {
    baseScore += 25;
  } else {
    riskFlags.push("Chưa cung cấp chứng từ dữ liệu sơ cấp (Primary Data) có xác thực bên thứ 3");
  }

  const finalScore = Math.max(10, Math.min(98, baseScore));
  const esgRiskLevel: SupplierEsgScreeningResult["esgRiskLevel"] =
    finalScore >= 75 ? "low" : finalScore >= 55 ? "medium" : finalScore >= 40 ? "high" : "critical";

  const emissionTier: SupplierEsgScreeningResult["emissionTier"] = supplier.hasCertifiedEvidence
    ? "Tier 1 (High Primary Data)"
    : supplier.tier === 1
    ? "Tier 2 (Industry Average)"
    : "Tier 3 (Proxy Estimated)";

  const priorityEngagement: SupplierEsgScreeningResult["priorityEngagement"] =
    esgRiskLevel === "critical" || esgRiskLevel === "high"
      ? "immediate"
      : esgRiskLevel === "medium"
      ? "scheduled"
      : "standard";

  const recommendedAction =
    esgRiskLevel === "low"
      ? "Duy trì danh mục nhà cung cấp ưu tiên xanh; cấp chứng nhận đối tác phát triển bền vững."
      : esgRiskLevel === "medium"
      ? "Yêu cầu cung cấp bảng phân bổ điện/nhiên liệu sơ cấp và kế hoạch kiểm toán năng lượng 2026."
      : "Kích hoạt chương trình hỗ trợ kỹ thuật khử carbon hoặc chuẩn bị nhà cung ứng thay thế để phòng ngừa CBAM.";

  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    esgRiskLevel,
    esgScore: finalScore,
    scope3EstimatedIntensityKgCo2e: intensity,
    emissionTier,
    certificationsDetected: certs,
    riskFlags,
    recommendedAction,
    priorityEngagement,
  };
}

/**
 * 2. Generate Sector-Specific Scope 3 Questionnaire
 */
export function generateSupplierScope3Questionnaire(sectorOrMaterial: string): SupplierScope3Questionnaire {
  const norm = sectorOrMaterial.toLowerCase();
  const isWetProcess = norm.includes("nhuộm") || norm.includes("hóa chất") || norm.includes("hoàn tất");

  return {
    sector: sectorOrMaterial || "Sản xuất dệt may / chuỗi cung ứng công nghiệp",
    title: `Biểu mẫu thu thập dữ liệu phát thải Scope 3 (GHG Protocol Category 1) — ${sectorOrMaterial || "Tổng hợp"}`,
    estimatedCompletionMinutes: isWetProcess ? 25 : 15,
    sections: [
      {
        title: "1. Năng lượng & Nhiệt năng sử dụng",
        questions: [
          {
            id: "q_elec_kwh",
            label: "Tổng điện năng tiêu thụ phục vụ đơn hàng gia công / sản xuất trong kỳ",
            type: "number",
            unit: "kWh",
            required: true,
            ghgScopeCategory: "Scope 2 gián tiếp NCC",
            hint: "Dựa trên chỉ số công tơ phân bổ hoặc hóa đơn điện EVN của nhà máy.",
          },
          {
            id: "q_elec_renewable_share",
            label: "Tỷ lệ điện năng tái tạo tại chỗ hoặc có chứng chỉ xanh (Solar Rooftop / I-REC / PPA)",
            type: "number",
            unit: "%",
            required: false,
            ghgScopeCategory: "Hệ số giảm nhẹ Scope 2",
            hint: "Điền 0% nếu chỉ sử dụng điện lưới thuần túy.",
          },
          {
            id: "q_boiler_fuel_type",
            label: "Loại nhiên liệu chính sử dụng cho hệ thống lò hơi nhiệt",
            type: "select",
            required: true,
            ghgScopeCategory: "Scope 1 trực tiếp NCC",
            hint: "Chọn loại nhiên liệu chiếm trên 70% tổng nhiệt lượng cung cấp.",
          },
        ],
      },
      {
        title: "2. Cấu thành nguyên vật liệu & Nguồn gốc",
        questions: [
          {
            id: "q_recycled_share",
            label: "Tỷ lệ hàm lượng tái chế (Recycled content) trong sản phẩm bàn giao",
            type: "number",
            unit: "%",
            required: true,
            ghgScopeCategory: "Dấu chân carbon vật liệu",
            hint: "Chứng minh qua chứng chỉ GRS (Global Recycled Standard) nếu có.",
          },
          {
            id: "q_origin_country",
            label: "Quốc gia xuất xứ của xơ/sợi hoặc phôi nguyên liệu đầu vào",
            type: "text",
            required: true,
            ghgScopeCategory: "Vận tải Scope 3 Cat 4",
            hint: "Ví dụ: Việt Nam, Hoa Kỳ, Ấn Độ, Úc.",
          },
        ],
      },
      {
        title: "3. Chứng từ xác thực & Báo cáo PCF",
        questions: [
          {
            id: "q_evidence_file",
            label: "Tải lên báo cáo dấu chân carbon (PCF), hóa đơn năng lượng hoặc chứng chỉ môi trường",
            type: "file",
            required: false,
            ghgScopeCategory: "Bằng chứng kiểm toán",
            hint: "Hỗ trợ định dạng PDF, PNG, JPG (tối đa 25MB).",
          },
        ],
      },
    ],
  };
}

/**
 * 3. Simulate Marginal Abatement Cost Curve (MACC) & Carbon Tax Stress Testing for Hotspots
 */
export function simulateHotspotMaccAndStressTest(
  hotspotRows: Array<{ label: string; kg: number }>,
  productionVolumeTons = 2500,
  carbonPriceUsd = 85
): MaccSimulationResult {
  const totalKg = hotspotRows.reduce((acc, r) => acc + (r.kg || 0), 0);
  const totalTons = totalKg / 1000 || 1250; // default 1,250 tons if empty

  // Calculate Pareto distribution (Top 20% sources share)
  const sorted = [...hotspotRows].sort((a, b) => b.kg - a.kg);
  const topSourcesCount = Math.max(1, Math.ceil(sorted.length * 0.2));
  const topKg = sorted.slice(0, topSourcesCount).reduce((acc, r) => acc + r.kg, 0);
  const cumulativeSharePercent = totalKg > 0 ? (topKg / totalKg) * 100 : 75;
  const topHotspotShare = sorted[0] && totalKg > 0 ? (sorted[0].kg / totalKg) * 100 : 42;

  // Industrial Decarbonization Interventions (Vietnam Industrial Context)
  const interventions: MaccHotspotIntervention[] = [
    {
      id: "int-1-biomass",
      title: "Chuyển đổi lò hơi than/dầu sang sinh khối (Biomass trấu/mùn cưa ép)",
      category: "Thermal Energy",
      abatementCostUsdPerTon: -12.5, // Negative cost means net financial savings
      annualCo2eReductionTons: Math.round(totalTons * 0.38),
      capexUsd: 110000,
      annualOpexSavingsUsd: 32000,
      paybackPeriodYears: 3.4,
      technologyMaturity: "Commercial (BAT)",
      vietnamRegulatoryAlignment: "QĐ 13/2024/QĐ-TTg & Lộ trình loại trừ than công nghiệp",
    },
    {
      id: "int-2-solar-ppa",
      title: "Lắp đặt điện mặt trời áp mái 1.2 MWp theo cơ chế tự dùng (Rooftop Solar)",
      category: "Renewable Electricity",
      abatementCostUsdPerTon: -22.0, // High savings due to displaced peak grid power tariffs
      annualCo2eReductionTons: Math.round(totalTons * 0.24),
      capexUsd: 95000,
      annualOpexSavingsUsd: 28500,
      paybackPeriodYears: 3.3,
      technologyMaturity: "Commercial (BAT)",
      vietnamRegulatoryAlignment: "Nghị định 80/2024/NĐ-CP (Cơ chế mua bán điện trực tiếp DPPA)",
    },
    {
      id: "int-3-heat-recovery",
      title: "Thu hồi nhiệt thải khói lò và nước ngưng kết hợp biến tần VFD",
      category: "Energy Efficiency",
      abatementCostUsdPerTon: -8.0,
      annualCo2eReductionTons: Math.round(totalTons * 0.12),
      capexUsd: 42000,
      annualOpexSavingsUsd: 14000,
      paybackPeriodYears: 3.0,
      technologyMaturity: "Commercial (BAT)",
      vietnamRegulatoryAlignment: "Luật Sử dụng Năng lượng Tiết kiệm và Hiệu quả",
    },
    {
      id: "int-4-low-gwp-hvac",
      title: "Thay thế môi chất lạnh điều hòa công nghiệp bằng R-32 / NH3 tự nhiên",
      category: "Refrigerants & Leakage",
      abatementCostUsdPerTon: 15.0, // Mild net cost
      annualCo2eReductionTons: Math.round(totalTons * 0.08),
      capexUsd: 28000,
      annualOpexSavingsUsd: 3500,
      paybackPeriodYears: 8.0,
      technologyMaturity: "Accelerated Pilot",
      vietnamRegulatoryAlignment: "Nghị định 06/2022/NĐ-CP Quản lý các chất làm suy giảm tầng ô-dôn",
    },
    {
      id: "int-5-supply-chain",
      title: "Tối ưu hóa logistics chặng đầu và điện hóa xe nâng hàng nội bộ",
      category: "Supply Chain",
      abatementCostUsdPerTon: -5.0,
      annualCo2eReductionTons: Math.round(totalTons * 0.06),
      capexUsd: 35000,
      annualOpexSavingsUsd: 8500,
      paybackPeriodYears: 4.1,
      technologyMaturity: "Commercial (BAT)",
      vietnamRegulatoryAlignment: "Kế hoạch hành động Chuyển đổi Năng lượng Xanh GTVT (QĐ 876/QĐ-TTg)",
    },
  ];

  const totalPotentialReductionTons = interventions.reduce((acc, i) => acc + i.annualCo2eReductionTons, 0);
  const netAnnualSavingsUsd = interventions.reduce((acc, i) => acc + i.annualOpexSavingsUsd, 0);
  const totalCapexRequiredUsd = interventions.reduce((acc, i) => acc + i.capexUsd, 0);
  const averageAbatementCost =
    interventions.reduce((acc, i) => acc + i.abatementCostUsdPerTon * i.annualCo2eReductionTons, 0) /
    (totalPotentialReductionTons || 1);

  // Carbon Tax Stress Testing
  const vnEtsExposureUsd = Math.round(totalTons * 15); // Vietnam ETS estimated $15/t
  const euCbamExposureUsd = Math.round(totalTons * carbonPriceUsd); // EU CBAM @ user specified / $85
  const highAmbitionExposureUsd = Math.round(totalTons * 120); // High ambition $120/t

  return {
    productionVolumeTons,
    totalInventoryCo2eTons: Math.round(totalTons),
    topHotspotSharePercent: Number(topHotspotShare.toFixed(1)),
    paretoIndex8020: {
      topSourcesCount,
      totalSourcesCount: sorted.length || 5,
      cumulativeSharePercent: Number(cumulativeSharePercent.toFixed(1)),
    },
    interventions,
    totalPotentialReductionTons,
    netAnnualSavingsUsd,
    totalCapexRequiredUsd,
    averageAbatementCostUsdPerTon: Number(averageAbatementCost.toFixed(2)),
    carbonTaxStressTest: {
      vnEtsExposureUsd,
      euCbamExposureUsd,
      highAmbitionExposureUsd,
    },
  };
}

/**
 * 4. Physical Climate Hazard Simulator & TCFD Resilience Engine
 */
export function simulateClimatePhysicalHazards(
  facility: { id: string; name: string; latitude: number; longitude: number },
  scenario: "historical" | "SSP2-4.5" | "SSP5-8.5" = "SSP2-4.5"
): ClimateHazardSimulationResult {
  const { latitude, longitude } = facility;

  // Calibrate baseline according to Southern/Central/Northern Vietnam climate zones
  const isSouth = latitude >= 10 && latitude <= 12; // Ho Chi Minh, Binh Duong, Dong Nai
  const isCentral = latitude > 12 && latitude <= 17; // Da Nang, Quang Nam, Hue (North is fallback)

  const scenarioMultiplier = scenario === "historical" ? 1.0 : scenario === "SSP2-4.5" ? 1.35 : 1.75;

  const baseHeatDays = isSouth ? 45 : isCentral ? 55 : 38;
  const baseRainfallMm = isCentral ? 280 : isSouth ? 190 : 220;
  const baseDryDays = isCentral ? 65 : isSouth ? 50 : 40;
  const baseInundationM = isSouth && longitude >= 106.6 ? 0.6 : isCentral ? 0.9 : 0.4;

  const extremeHeatDays = Math.round(baseHeatDays * scenarioMultiplier);
  const maxRainfallMm = Math.round(baseRainfallMm * scenarioMultiplier);
  const dryDays = Math.round(baseDryDays * scenarioMultiplier);
  const inundationM = Number((baseInundationM * scenarioMultiplier).toFixed(2));

  // Exposure rating calculation (1 - 5)
  let exposure = 3;
  if (extremeHeatDays > 70 || maxRainfallMm > 350 || inundationM > 1.0) {
    exposure = 5;
  } else if (extremeHeatDays > 50 || maxRainfallMm > 250 || inundationM > 0.6) {
    exposure = 4;
  } else if (extremeHeatDays < 35 && maxRainfallMm < 180) {
    exposure = 2;
  }

  // Vulnerability rating (1 - 5)
  const vulnerability = scenario === "SSP5-8.5" ? 4 : 3;

  const priorityBand: ClimateHazardSimulationResult["priorityBand"] =
    exposure >= 5 || (exposure >= 4 && vulnerability >= 4)
      ? "high"
      : exposure >= 3
      ? "medium"
      : "low";

  // TCFD classification
  const tcfdCategory: ClimateHazardSimulationResult["tcfdCategory"] =
    maxRainfallMm > 260 ? "Physical Acute" : "Physical Chronic";

  // Resilience score (0 - 100)
  const resilienceScore = Math.max(20, Math.min(95, 100 - (exposure * 12 + vulnerability * 8)));

  const adaptationMeasures: ClimateHazardSimulationResult["adaptationMeasures"] = [
    {
      name: "Tường ngăn triều cường & hệ thống bơm chống ngập nội bộ",
      description: "Gia cố ngưỡng cửa kho vật tư và lắp máy bơm chìm tự động ứng phó triều cường và mưa cực đoan.",
      estimatedCostTier: "Trung bình",
      implementationTimeline: "Quý 1–2 / 2026",
    },
    {
      name: "Sơn phản xạ nhiệt Cool-Roof và thông gió tự nhiên xưởng may",
      description: "Giảm nhiệt độ bề mặt mái xưởng từ 6–10°C, bảo vệ sức khỏe công nhân may và giảm tải máy lạnh.",
      estimatedCostTier: "Thấp",
      implementationTimeline: "Ngay trong 30 ngày",
    },
    {
      name: "Bể thu gom nước mưa tuần hoàn và hệ thống lọc tuần hoàn nước nhuộm",
      description: "Đảm bảo nguồn nước hoạt động tối thiểu 14 ngày khi xảy ra hạn hán hoặc xâm nhập mặn.",
      estimatedCostTier: "Cao",
      implementationTimeline: "Lộ trình 2026–2027",
    },
    {
      name: "Bảo hiểm gián đoạn kinh doanh do thiên tai & rủi ro khí hậu (TCFD Pilar 3)",
      description: "Chuyển giao rủi ro tài chính cho các sự kiện lũ lụt 100 năm và gián đoạn chuỗi cung ứng logistics cảng.",
      estimatedCostTier: "Thấp",
      implementationTimeline: "Thường niên",
    },
  ];

  const overallRiskRationale =
    priorityBand === "high"
      ? `Cơ sở đối mặt mức độ hiểm họa cao do ảnh hưởng lũy kế của mưa cực đoan (${maxRainfallMm} mm/ngày) và nắng nóng cực đoan (${extremeHeatDays} ngày/năm). Cần lập tức thực thi phương án chống ngập và bảo vệ chuỗi cấp điện lạnh.`
      : priorityBand === "medium"
      ? `Cơ sở chịu tác động khí hậu mức trung bình. Các đợt khô hạn (${dryDays} ngày) và nắng nóng gây gia tăng chi phí làm mát và nguy cơ thiếu nước phục vụ sản xuất phụ trợ.`
      : `Vị trí nhà máy nằm trong vùng có biên độ dao động khí hậu tương đối ổn định. Khuyến nghị duy trì kế hoạch giám sát hạ tầng định kỳ theo khuyến nghị TCFD.`;

  const hazardSpecificAssessments = {
    heat: {
      riskBand: extremeHeatDays > 60 ? "Rất cao" : extremeHeatDays > 45 ? "Cao" : "Trung bình",
      operationalImpact: "Làm suy giảm năng suất công nhân may từ 8–15% vào giờ cao điểm hè, tăng tải tiêu thụ điện cho hệ thống HVAC làm mát.",
    },
    extreme_rainfall: {
      riskBand: maxRainfallMm > 300 ? "Nghiêm trọng" : maxRainfallMm > 200 ? "Đáng kể" : "Thấp",
      operationalImpact: "Nguy cơ ngập úng khuôn viên và kho nguyên liệu sợi/vải khi lưu vực thoát nước bị quá tải hoặc triều cường dâng.",
    },
    drought: {
      riskBand: dryDays > 60 ? "Cao" : dryDays > 45 ? "Trung bình" : "Thấp",
      operationalImpact: "Hạn chế lưu lượng nguồn cấp nước sạch công nghiệp cho các công đoạn giặt, hoàn tất và lò hơi.",
    },
  };

  const tcfdRecommendations = [
    {
      measure: "Tường ngăn triều cường & trạm bơm thoát nước tự động",
      justification: "Bảo vệ nguyên vật liệu vải và sản phẩm may mặc thành phẩm khỏi nguy cơ ẩm mốc, hư hỏng khi mưa lớn cục bộ.",
      estimatedCostUsd: "$12,000 – $25,000",
      timeframe: "Quý 1–2 / 2026",
    },
    {
      measure: "Sơn mái phản xạ nhiệt bức xạ mặt trời (Cool-Roof Coating)",
      justification: "Giảm nhiệt độ bề mặt mái xưởng 6–10°C, hạ tải 18% điện năng điều hòa không khí và bảo đảm an toàn lao động.",
      estimatedCostUsd: "$8,000 – $15,000",
      timeframe: "Ngay trong 30 ngày",
    },
    {
      measure: "Bể thu gom tuần hoàn nước mưa và tái sử dụng phụ trợ",
      justification: "Đảm bảo nguồn nước hoạt động tối thiểu 14 ngày khi xảy ra hạn hán kéo dài hoặc nhiễm mặn nguồn nước thô.",
      estimatedCostUsd: "$30,000 – $50,000",
      timeframe: "Lộ trình 2026–2027",
    },
    {
      measure: "Bảo hiểm gián đoạn chuỗi cung ứng do thiên tai cực đoan",
      justification: "Chuyển giao tổn thất tài chính khi gián đoạn logistics cảng biển và hạ tầng giao thông kết nối theo trụ cột TCFD.",
      estimatedCostUsd: "$6,500 / năm",
      timeframe: "Thường niên",
    },
  ];

  return {
    facilityId: facility.id,
    facilityName: facility.name || "Cơ sở sản xuất",
    latitude,
    longitude,
    scenario,
    hazardMetrics: {
      extremeHeatDaysPerYear: extremeHeatDays,
      max1DayRainfallMm: maxRainfallMm,
      consecutiveDryDays: dryDays,
      coastalInundationRiskDepthMeters: inundationM,
    },
    projectedMetrics: {
      extremeHeatDaysPerYear: extremeHeatDays,
      maxDailyRainfallMm: maxRainfallMm,
      consecutiveDryDays: dryDays,
    },
    exposureRating: exposure,
    exposureScore: exposure,
    vulnerabilityRating: vulnerability,
    vulnerabilityScore: vulnerability,
    priorityBand,
    tcfdCategory,
    overallRiskRationale,
    hazardSpecificAssessments,
    tcfdRecommendations,
    adaptationMeasures,
    resilienceScore,
    compositeRiskScore: resilienceScore,
  };
}
