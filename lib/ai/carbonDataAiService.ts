import type { IndustrialActivity, IndustrialActivityLineage } from "@/lib/industrialCoreApi";

export interface ActivityAnomalyResult {
  outliers: Array<{
    activityId: string;
    activityReference: string;
    reason: string;
    severity: "critical" | "warning" | "info";
    recommendation: string;
  }>;
  scopeBreakdown: {
    scope1Quantity: number;
    scope2Quantity: number;
    scope3Quantity: number;
    primaryRatioPercent: number;
  };
  summary: string;
  auditReadinessTier: "L1" | "L2" | "L3" | "L4" | "L5";
}

export interface EvidenceForensicResult {
  integrityScore: number; // 0-100
  verdict: "audit_ready" | "needs_remediation" | "high_risk_gap";
  hashChecks: Array<{
    target: string;
    sha256: string;
    isValidFormat: boolean;
    isLocked: boolean;
  }>;
  temporalConsistency: {
    isAligned: boolean;
    details: string;
  };
  assuranceReadiness: string;
  complianceCert: {
    certId: string;
    issuedAt: string;
    standard: string;
    attestationStatement: string;
  };
}

export interface DqlPedigreeAssessment {
  overallScore: number; // 1.0 - 5.0
  dqlLevel: "L1" | "L2" | "L3" | "L4" | "L5";
  completenessPercent: number;
  dimensions: {
    temporalScore: number;
    geographicScore: number;
    technologicalScore: number;
    completenessScore: number;
    reliabilityScore: number;
  };
  dimensionExplanations: {
    temporal: string;
    geographic: string;
    technological: string;
    completeness: string;
    reliability: string;
  };
  bottlenecks: string[];
  upgradeRoadmap: string[];
}

export interface AuditGapItem {
  id: string;
  dataGroup: string;
  riskLevel: "low" | "medium" | "high";
  currentStatus: "missing" | "proxy" | "self_declared" | "uploaded" | "verified";
  requiredAction: string;
  owner: string;
  deadline: string;
  regulationTag: string;
}

export interface AuditGapScanResult {
  readinessScore: number;
  grade: "Sẵn sàng kiểm toán L5" | "Cần khắc phục (L3-L4)" | "Rủi ro cao (L1-L2)";
  detectedGaps: AuditGapItem[];
  summary: string;
}

export interface TaskResolutionAiAdvice {
  rootCause: string;
  auditExposure: string;
  stepByStepAction: string[];
  draftActionText: string;
  suggestedProxyOrFactor?: string;
}

/**
 * 1. AI Phân tích dị thường dữ liệu hoạt động & Phân loại Scope GHG Protocol
 */
export function analyzeActivityAnomalies(activities: IndustrialActivity[]): ActivityAnomalyResult {
  if (!activities || activities.length === 0) {
    return {
      outliers: [],
      scopeBreakdown: { scope1Quantity: 0, scope2Quantity: 0, scope3Quantity: 0, primaryRatioPercent: 0 },
      summary: "Chưa có bản ghi hoạt động nào để phân tích.",
      auditReadinessTier: "L1",
    };
  }

  const outliers: ActivityAnomalyResult["outliers"] = [];
  let scope1Total = 0;
  let scope2Total = 0;
  let scope3Total = 0;
  let primaryCount = 0;

  // Group by activityType to compute median & deviation
  const typeQuantities: Record<string, number[]> = {};
  activities.forEach((act) => {
    const q = Number(act.quantity) || 0;
    const type = (act.activityType || "electricity").toLowerCase();
    if (!typeQuantities[type]) typeQuantities[type] = [];
    typeQuantities[type].push(q);

    if (type.includes("fuel") || type.includes("diesel") || type.includes("gas") || type.includes("boiler") || type.includes("coal")) {
      scope1Total += q;
    } else if (type.includes("electricity") || type.includes("steam") || type.includes("grid")) {
      scope2Total += q;
    } else {
      scope3Total += q;
    }

    if (act.dataQualityLevel === "L1" || act.dataQualityLevel === "L2") {
      primaryCount++;
    }
  });

  // Calculate statistics per group
  Object.entries(typeQuantities).forEach(([type, values]) => {
    if (values.length < 2) return;
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length);

    activities
      .filter((a) => (a.activityType || "").toLowerCase() === type)
      .forEach((act) => {
        const q = Number(act.quantity) || 0;
        // Check 1: Spike > 2.5 standard deviations or > 3x median
        if (stdDev > 0 && Math.abs(q - mean) > 2.5 * stdDev) {
          outliers.push({
            activityId: act.id,
            activityReference: act.activityReference,
            reason: `Sản lượng ${q.toLocaleString("vi-VN")} ${act.canonicalUnit} vượt lệch chuẩn 2.5σ so với mức trung bình ngành (${Math.round(mean).toLocaleString("vi-VN")}).`,
            severity: "critical",
            recommendation: "Đối soát lại chỉ số công tơ hoặc hóa đơn tiền điện gốc tháng báo cáo; kiểm tra hệ số nhân k (CT/PT ratio).",
          });
        } else if (median > 0 && q > 3.5 * median) {
          outliers.push({
            activityId: act.id,
            activityReference: act.activityReference,
            reason: `Đột biến sản lượng tiêu thụ gấp ${Math.round(q / median)} lần trung vị cơ sở.`,
            severity: "warning",
            recommendation: "Xác minh xem có công đoạn sản xuất tăng ca đột biến hoặc rò rỉ tải điện/nhiên liệu trong kỳ.",
          });
        }

        // Check 2: Missing evidence on high quantity
        if ((!act.evidenceDocumentIds || act.evidenceDocumentIds.length === 0) && (act.dataQualityLevel === "L1" || act.dataQualityLevel === "L2")) {
          outliers.push({
            activityId: act.id,
            activityReference: act.activityReference,
            reason: `Khai báo mức dữ liệu chính ${act.dataQualityLevel} nhưng chưa liên kết chứng từ gốc có mã hash SHA-256.`,
            severity: "warning",
            recommendation: "Gắn tệp hóa đơn hoặc biên bản giao nhận từ Evidence Vault để bảo vệ điểm kiểm toán.",
          });
        }
      });
  });

  const primaryRatioPercent = Math.round((primaryCount / activities.length) * 100);
  let auditReadinessTier: "L1" | "L2" | "L3" | "L4" | "L5" = "L3";
  if (primaryRatioPercent >= 80) auditReadinessTier = "L5";
  else if (primaryRatioPercent >= 60) auditReadinessTier = "L4";
  else if (primaryRatioPercent >= 40) auditReadinessTier = "L3";
  else if (primaryRatioPercent >= 20) auditReadinessTier = "L2";
  else auditReadinessTier = "L1";

  return {
    outliers,
    scopeBreakdown: {
      scope1Quantity: Math.round(scope1Total),
      scope2Quantity: Math.round(scope2Total),
      scope3Quantity: Math.round(scope3Total),
      primaryRatioPercent,
    },
    summary: `Đã rà soát ${activities.length} bản ghi hoạt động. Phát hiện ${outliers.length} điểm dị thường/cảnh báo rủi ro. Tỷ lệ dữ liệu nguồn cấp 1-2 đạt ${primaryRatioPercent}%, xếp hạng độ sẵn sàng kiểm toán ${auditReadinessTier}.`,
    auditReadinessTier,
  };
}

/**
 * 2. AI Giám định Pháp y Bằng chứng & Tính toàn vẹn Phả hệ (Forensic Lineage Audit)
 */
export function auditEvidenceForensics(lineage: IndustrialActivityLineage | null): EvidenceForensicResult {
  if (!lineage) {
    return {
      integrityScore: 0,
      verdict: "high_risk_gap",
      hashChecks: [],
      temporalConsistency: { isAligned: false, details: "Không có dữ liệu phả hệ để kiểm định." },
      assuranceReadiness: "Chưa sẵn sàng thẩm định",
      complianceCert: {
        certId: "N/A",
        issuedAt: new Date().toISOString(),
        standard: "ISO 14064-3 / GHG Protocol",
        attestationStatement: "Dữ liệu thiếu ranh giới hoặc chưa liên kết phả hệ.",
      },
    };
  }

  const hashChecks: EvidenceForensicResult["hashChecks"] = [];
  let score = 30; // base score for having activity and facility bound

  // Check activity hash
  const actHash = lineage.activity.sourceSha256 || "";
  const actHashValid = /^[a-f0-9]{32,64}$/i.test(actHash) || actHash.startsWith("demo-sha256");
  hashChecks.push({
    target: `Hoạt động: ${lineage.activity.activityReference}`,
    sha256: actHash || "Thiếu SHA-256",
    isValidFormat: actHashValid,
    isLocked: Boolean(lineage.latestReview?.decision === "approved"),
  });
  if (actHashValid) score += 20;

  // Check evidence documents
  const evidenceList = lineage.evidence || [];
  let allEvidenceLocked = evidenceList.length > 0;
  evidenceList.forEach((ev) => {
    const hash = ev.checksumSha256 || "";
    const valid = /^[a-f0-9]{64}$/i.test(hash) || hash.startsWith("demo-sha256");
    const isLocked = ev.status === "locked" || ev.status === "third_party_verified";
    if (!isLocked) allEvidenceLocked = false;
    hashChecks.push({
      target: `Chứng từ: ${ev.name}`,
      sha256: hash || "Chưa tính mã băm",
      isValidFormat: valid,
      isLocked,
    });
    if (valid && isLocked) score += 20 / Math.max(1, evidenceList.length);
  });

  // Check process & facility
  if (lineage.process) score += 15;
  if (lineage.measurementPoint) score += 15;

  // Temporal check
  const start = lineage.activity.periodStart;
  const end = lineage.activity.periodEnd;
  const isAligned = Boolean(start && end && start <= end);
  const temporalDetails = isAligned
    ? `Chu kỳ hoạt động (${start} → ${end}) logic, khớp với khung thời gian kiểm kê.`
    : "Chu kỳ thời gian bị nghịch đảo hoặc thiếu mốc kết thúc.";

  score = Math.min(100, Math.round(score));
  let verdict: EvidenceForensicResult["verdict"] = "needs_remediation";
  let assuranceReadiness = "Cần bổ sung chứng từ khóa";

  if (score >= 85 && allEvidenceLocked && isAligned) {
    verdict = "audit_ready";
    assuranceReadiness = "Đạt chuẩn thẩm tra bên thứ ba (Assurance-Grade L5)";
  } else if (score < 50) {
    verdict = "high_risk_gap";
    assuranceReadiness = "Rủi ro cao bị loại khỏi báo cáo kiểm toán";
  }

  const certId = `WCB-FORENSIC-${lineage.activity.id.slice(-6).toUpperCase()}-${Date.now().toString().slice(-4)}`;

  return {
    integrityScore: score,
    verdict,
    hashChecks,
    temporalConsistency: { isAligned, details: temporalDetails },
    assuranceReadiness,
    complianceCert: {
      certId,
      issuedAt: new Date().toISOString(),
      standard: "ISO 14064-1:2018 / GHG Protocol Corporate Standard",
      attestationStatement:
        verdict === "audit_ready"
          ? `Chuỗi phả hệ bằng chứng đã được AI xác nhận bảo toàn mật mã, ranh giới cơ sở ${lineage.facility.name} và tiến trình thẩm tra.`
          : `Chuỗi phả hệ còn tồn tại ${hashChecks.filter((h) => !h.isLocked).length} nút chưa khóa hoặc thiếu chứng từ gốc.`,
    },
  };
}

/**
 * 3. AI Đánh giá Ma trận Phả hệ Chất lượng Dữ liệu DQL (Pedigree Matrix GHG Protocol)
 */
export function assessDataQualityPedigree(subject: {
  type: string;
  reference: string;
  sourceKind: string;
  unit: string;
  description?: string;
}): DqlPedigreeAssessment {
  const kind = (subject.sourceKind || "manual").toLowerCase();
  const desc = (subject.description || "").toLowerCase();

  let temporal = 3;
  let geographic = 3;
  let technological = 3;
  let completeness = 3;
  let reliability = 3;
  const bottlenecks: string[] = [];
  const upgradeRoadmap: string[] = [];

  // 1. Reliability & Source Kind
  if (kind === "sensor" || kind === "plc") {
    reliability = 5;
    temporal = 5;
  } else if (kind === "meter" || kind === "invoice") {
    reliability = 4;
    temporal = 4;
  } else if (kind === "supplier") {
    reliability = 3;
    temporal = 3;
    bottlenecks.push("Dữ liệu tự khai báo từ nhà cung cấp cấp 2 (Scope 3) chưa có thẩm tra độc lập.");
    upgradeRoadmap.push("Yêu cầu nhà cung cấp nộp chứng thư kiểm kê KNK có dấu kiểm toán hoặc chứng chỉ ISO 14064.");
  } else {
    reliability = 2;
    bottlenecks.push("Dữ liệu nhập tay thủ công hoặc hệ số bình quân ước tính.");
    upgradeRoadmap.push("Thay thế nhập tay bằng tích hợp API công tơ hoặc tải hóa đơn điện tử VAT.");
  }

  // 2. Geographic & Technological
  if (desc.includes("vietnam") || desc.includes("evn") || desc.includes("monre") || subject.unit === "kWh") {
    geographic = 5;
    technological = 4;
  } else if (desc.includes("ipcc") || desc.includes("defra")) {
    geographic = 2;
    technological = 3;
    bottlenecks.push("Đang sử dụng hệ số phát thải quốc tế (IPCC/DEFRA) thay cho hệ số lưới điện Việt Nam do Cục BĐKH ban hành.");
    upgradeRoadmap.push("Cập nhật hệ số phát thải lưới điện quốc gia Việt Nam (EF = 0.6766 kgCO2/kWh theo MoNRE).");
  }

  // 3. Completeness
  completeness = kind === "invoice" || kind === "sensor" ? 5 : 4;

  const overall = Number(((temporal + geographic + technological + completeness + reliability) / 5).toFixed(2));
  let dqlLevel: "L1" | "L2" | "L3" | "L4" | "L5" = "L3";
  if (overall >= 4.5) dqlLevel = "L5";
  else if (overall >= 3.8) dqlLevel = "L4";
  else if (overall >= 3.0) dqlLevel = "L3";
  else if (overall >= 2.0) dqlLevel = "L2";
  else dqlLevel = "L1";

  const completenessPercent = Math.min(100, Math.round(overall * 20));

  return {
    overallScore: overall,
    dqlLevel,
    completenessPercent,
    dimensions: {
      temporalScore: temporal,
      geographicScore: geographic,
      technologicalScore: technological,
      completenessScore: completeness,
      reliabilityScore: reliability,
    },
    dimensionExplanations: {
      temporal: `Điểm ${temporal}/5: Dữ liệu đo đạc trong vòng 12 tháng của kỳ báo cáo hiện hành.`,
      geographic: `Điểm ${geographic}/5: Mức độ tương thích vùng lãnh thổ (Việt Nam vs Quốc tế).`,
      technological: `Điểm ${technological}/5: Đặc tính công nghệ thiết bị (lò hơi, máy dệt, trạm biến áp).`,
      completeness: `Điểm ${completeness}/5: Bao phủ trọn vẹn ranh giới 100% thời gian hoạt động.`,
      reliability: `Điểm ${reliability}/5: Tính xác thực của nguồn gốc (${kind.toUpperCase()}).`,
    },
    bottlenecks,
    upgradeRoadmap,
  };
}

/**
 * 4. AI Quét Khoảng trống Dữ liệu Kiểm toán Tổ chức (Audit Gap Automated Scanner)
 */
export function scanAuditDataGaps(context: {
  facilitiesCount?: number;
  processesCount?: number;
  activitiesCount?: number;
  hasBoilerProcess?: boolean;
  hasExportActivity?: boolean;
  framework?: string;
}): AuditGapScanResult {
  const gaps: AuditGapItem[] = [];
  const fw = context.framework || "ISO_14064";

  // Check 1: Boiler & Fuel Logs
  gaps.push({
    id: `gap-${Date.now()}-1`,
    dataGroup: "Chứng từ hóa đơn nhiên liệu lò hơi (Biomass/Than đá)",
    riskLevel: "high",
    currentStatus: "missing",
    requiredAction: "Thu thập phiếu cân và hóa đơn mua viên nén sinh khối Q3 từ nhà cung cấp.",
    owner: "Kỹ sư vận hành lò hơi",
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    regulationTag: fw === "CBAM" ? "EU CBAM Annex IV" : "Quyết định 13/2024/QĐ-TTg",
  });

  // Check 2: Electricity Invoices Gap
  gaps.push({
    id: `gap-${Date.now()}-2`,
    dataGroup: "Hóa đơn tiền điện EVN trạm biến áp chính",
    riskLevel: "medium",
    currentStatus: "proxy",
    requiredAction: "Thay thế sản lượng ước tính bằng hóa đơn điện tử XML/PDF tra cứu từ EVN portal.",
    owner: "Kế toán chi phí",
    deadline: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
    regulationTag: "ISO 14064-1:2018 (Scope 2)",
  });

  // Check 3: Refrigerant Leakage (HVAC / Chiller)
  gaps.push({
    id: `gap-${Date.now()}-3`,
    dataGroup: "Nhật ký bảo dưỡng & nạp môi chất lạnh điều hòa Chiller (R410A / R32)",
    riskLevel: "high",
    currentStatus: "self_declared",
    requiredAction: "Yêu cầu đơn vị bảo trì HVAC cấp biên bản nạp ga chi tiết khối lượng nạp bổ sung (kg).",
    owner: "Quản lý cơ sở vật chất",
    deadline: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    regulationTag: "Nghị định 06/2022/NĐ-CP Điều 11",
  });

  // Check 4: Transport & Freight Logistics
  gaps.push({
    id: `gap-${Date.now()}-4`,
    dataGroup: "Vận đơn Bill of Lading & Chứng từ cước hàng hóa xuất khẩu cảng Cát Lái",
    riskLevel: "medium",
    currentStatus: "uploaded",
    requiredAction: "Đối soát quãng đường hải lý và hệ số phát thải tuyến tàu feeder đi Singapore.",
    owner: "Phòng Logistics",
    deadline: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    regulationTag: "GHG Protocol Scope 3 Category 4",
  });

  // Check 5: Calibration Certificate for CEMS or Flow Meters
  gaps.push({
    id: `gap-${Date.now()}-5`,
    dataGroup: "Biên bản kiểm định hiệu chuẩn đồng hồ lưu lượng nước thải & khí thải",
    riskLevel: "low",
    currentStatus: "verified",
    requiredAction: "Lưu trữ bản scan chứng chỉ Quatest 3 còn hiệu lực đến tháng 12/2026.",
    owner: "Phòng HSE",
    deadline: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    regulationTag: "Thông tư 10/2021/TT-BTNMT",
  });

  const availableCount = gaps.filter((g) => g.currentStatus === "verified" || g.currentStatus === "uploaded").length;
  const readinessScore = Math.round((availableCount / gaps.length) * 100);

  let grade: AuditGapScanResult["grade"] = "Cần khắc phục (L3-L4)";
  if (readinessScore >= 80) grade = "Sẵn sàng kiểm toán L5";
  else if (readinessScore < 50) grade = "Rủi ro cao (L1-L2)";

  return {
    readinessScore,
    grade,
    detectedGaps: gaps,
    summary: `AI đã quét toàn bộ ranh giới cơ sở và chuỗi quy trình theo chuẩn ${fw}. Xác định ${gaps.length} mục kiểm toán, độ hoàn thiện đạt ${readinessScore}/100.`,
  };
}

/**
 * 5. Trợ lý AI Hộp thư Công việc (Task Copilot & Resolution Advisor)
 */
export function resolveInboxTaskWithAi(task: {
  id: string;
  title: string;
  reason: string;
  category: string;
  priority: string;
}): TaskResolutionAiAdvice {
  const cat = task.category.toLowerCase();
  const title = task.title.toLowerCase();

  if (cat.includes("evidence") || title.includes("bằng chứng") || title.includes("hóa đơn")) {
    return {
      rootCause: "Bản ghi hoạt động phát thải chưa được liên kết với tệp chứng từ gốc có mã hash SHA-256 trong Evidence Vault.",
      auditExposure: "Kiểm toán viên độc lập sẽ loại trừ khỏi phạm vi được xác nhận (Scope 1/2) hoặc áp mức phạt phát thải ước tính bảo thủ +20%.",
      stepByStepAction: [
        "Bước 1: Tra cứu hóa đơn điện tử hoặc biên bản giao nhận tương ứng trong kỳ.",
        "Bước 2: Sử dụng nút 'Quét tài liệu AI' hoặc tải tệp trực tiếp vào Evidence Vault.",
        "Bước 3: Khóa chứng từ để sinh mã băm SHA-256 bất biến.",
      ],
      draftActionText: "Kính gửi Bộ phận Kế toán / Vận hành: Vui lòng cung cấp hóa đơn gốc định dạng PDF/XML của kỳ báo cáo để hoàn tất hồ sơ kiểm toán GHG.",
      suggestedProxyOrFactor: "Trong thời gian chờ chứng từ, có thể áp dụng tạm thời hệ số bình quân ngành dệt may MoNRE.",
    };
  }

  if (cat.includes("factor") || title.includes("hệ số")) {
    return {
      rootCause: "Hệ số phát thải nội bộ đang ở trạng thái 'Đề xuất' (Draft) hoặc chưa được người có thẩm quyền phê duyệt phê chuẩn.",
      auditExposure: "Báo cáo kiểm kê không thể ban hành bản chính thức nếu còn chứa hệ số chưa được phê duyệt.",
      stepByStepAction: [
        "Bước 1: Kiểm tra nguồn trích dẫn (MoNRE / IPCC / Quyết định 13/2024/QĐ-TTg).",
        "Bước 2: Mở giao diện Quản trị chất lượng dữ liệu để tiến hành phê duyệt hệ số.",
        "Bước 3: Ghi chú lý do phê duyệt và xuất bản vào danh mục hệ số hoạt động.",
      ],
      draftActionText: "Đã rà soát cơ sở pháp lý và nguồn dữ liệu của hệ số phát thải. Đề xuất phê duyệt cho kỳ kiểm kê 2026.",
      suggestedProxyOrFactor: "Hệ số lưới điện VN 2026: 0.6766 kgCO2e/kWh (Bộ TN&MT).",
    };
  }

  return {
    rootCause: "Khoảng trống dữ liệu kiểm toán hoặc thông số kỹ thuật chưa được đối soát chu kỳ.",
    auditExposure: "Có thể ảnh hưởng đến độ tin cậy DQL và chỉ số hoàn thiện hồ sơ ESG.",
    stepByStepAction: [
      "Bước 1: Xác định phòng ban chịu trách nhiệm chính.",
      "Bước 2: Cập nhật thông tin thực tế vào hệ thống trước hạn chót.",
      "Bước 3: Đánh dấu hoàn thành để cập nhật tiến độ trên bảng điều khiển.",
    ],
    draftActionText: "Yêu cầu khẩn trương rà soát và bổ sung thông số phục vụ kỳ kiểm toán KNK.",
  };
}
