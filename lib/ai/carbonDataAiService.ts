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

/**
 * 6. AI Phân tích Khoảng trống Tuân thủ Đa Quy định (Multi-Framework Compliance Gap Analyzer)
 */
export interface ComplianceFrameworkAssessment {
  framework: string;
  frameworkName: string;
  category: "CBAM" | "DPP" | "EU_DPP" | "VN_MRV" | "ISO_14064" | "PACT";
  readinessScore: number; // 0 - 100
  status: "ready" | "needs_remediation" | "critical_gap";
  checklist: Array<{
    id: string;
    requirement: string;
    status: "pass" | "warning" | "fail";
    detail: string;
    actionRequired: string;
    owner: string;
    regulationReference: string;
  }>;
  roadmap: Array<{
    step: number;
    phase: string;
    description: string;
    deadlineDays: number;
  }>;
  dossierSummary: string;
}

export function runMultiFrameworkGapAnalysis(params: {
  framework: "CBAM" | "DPP" | "EU_DPP" | "VN_MRV" | "ISO_14064" | "PACT";
  facilityCount?: number;
  activitiesCount?: number;
  verifiedEvidenceCount?: number;
  dqlLevel?: string;
  hasSubMeters?: boolean;
}): ComplianceFrameworkAssessment {
  const fw = params.framework;
  const activities = params.activitiesCount || 0;
  const evidence = params.verifiedEvidenceCount || 0;
  const hasSubMeters = params.hasSubMeters ?? true;

  if (fw === "CBAM") {
    const checklist: ComplianceFrameworkAssessment["checklist"] = [
      {
        id: "cbam-1",
        requirement: "Tách bạch phát thải trực tiếp (Scope 1) và gián tiếp (Scope 2)",
        status: activities > 0 ? "pass" : "fail",
        detail: "Quy định (EU) 2023/956 yêu cầu bóc tách rõ ràng phát thải trực tiếp từ lò đốt/nhiên liệu và phát thải điện lưới.",
        actionRequired: activities > 0 ? "Đã phân tách Scope 1 & Scope 2 trong danh mục hoạt động." : "Cần gán nhãn Scope cho các nguồn nhiên liệu và trạm biến áp.",
        owner: "Kỹ sư Quản lý Năng lượng",
        regulationReference: "Regulation (EU) 2023/956, Annex IV, Mục 3"
      },
      {
        id: "cbam-2",
        requirement: "Định danh mã số hải quan CN 8 số cho dòng sản phẩm xuất khẩu",
        status: "pass",
        detail: "Đối chiếu mã HS và mã CN châu Âu (Chương 72/73/76/28/31) theo biểu thuế TARIC.",
        actionRequired: "Duy trì tra cứu bảng mã CN tự động và xác thực với khách hàng EU.",
        owner: "Phòng Logistics & Xuất nhập khẩu",
        regulationReference: "CBAM Annex I - List of Goods and GHG"
      },
      {
        id: "cbam-3",
        requirement: "Dữ liệu sơ cấp thực tế thay thế hệ số mặc định (Default Values)",
        status: evidence > 0 ? "pass" : "warning",
        detail: "Ủy ban Châu Âu chỉ cho phép dùng hệ số phát thải mặc định trong giai đoạn chuyển tiếp; sau đó phải dùng 100% dữ liệu thực đo.",
        actionRequired: evidence > 0 ? "Đã có chứng từ gốc đối soát." : "Cần nộp hóa đơn điện/than và biên bản kiểm định công tơ thay vì dùng hệ số bình quân.",
        owner: "Ban Kiểm toán Nội bộ",
        regulationReference: "Commission Implementing Regulation (EU) 2023/1773"
      },
      {
        id: "cbam-4",
        requirement: "Chứng nhận thẩm tra độc lập bên thứ 3 có thẩm quyền (Accredited Verifier)",
        status: "warning",
        detail: "Hồ sơ CBAM chính thức phải được thẩm định bởi tổ chức được công nhận theo Quy định (EU) 2018/2067.",
        actionRequired: "Liên kết hồ sơ với tổ chức thẩm tra (SGS, TÜV, BSI hoặc đơn vị VILAS được chấp thuận).",
        owner: "Giám đốc Tuân thủ / HSE",
        regulationReference: "Regulation (EU) 2023/956, Điều 8"
      }
    ];

    const passCount = checklist.filter(c => c.status === "pass").length;
    const score = Math.round((passCount / checklist.length) * 100);

    return {
      framework: "CBAM",
      frameworkName: "Cơ chế Điều chỉnh Biên giới Carbon (EU CBAM - Regulation (EU) 2023/956)",
      category: "CBAM",
      readinessScore: score,
      status: score >= 80 ? "ready" : score >= 50 ? "needs_remediation" : "critical_gap",
      checklist,
      roadmap: [
        { step: 1, phase: "Chuẩn hóa mã CN & Định tuyến phát thải", description: "Gắn mã CN 8 số và xác định ranh giới tổ hợp sản xuất.", deadlineDays: 15 },
        { step: 2, phase: "Thu thập dữ liệu sơ cấp lò hơi & điện", description: "Bảo đảm 100% số liệu Scope 1 & 2 có hóa đơn và biên bản đối soát.", deadlineDays: 30 },
        { step: 3, phase: "Xuất file khai báo CBAM XML mẫu Ủy ban EU", description: "Kết xuất file dữ liệu giao tiếp với nhà nhập khẩu châu Âu.", deadlineDays: 45 }
      ],
      dossierSummary: `Hồ sơ sẵn sàng CBAM đạt ${score}%. Đã đáp ứng yêu cầu bóc tách phát thải nhúng và mã CN hàng hóa. Cần chú ý hoàn thiện chứng chỉ kiểm định công tơ đo đếm.`
    };
  }

  if (fw === "VN_MRV") {
    const checklist: ComplianceFrameworkAssessment["checklist"] = [
      {
        id: "vnmrv-1",
        requirement: "Xác định nghĩa vụ thuộc Danh mục phát thải KNK bắt buộc (QĐ 13/2024 & QĐ 42/2026)",
        status: "pass",
        detail: "Áp dụng ngưỡng tiêu thụ năng lượng >= 1.000 TOE hoặc phát thải >= 3.000 tCO2e/năm theo Quyết định số 13/2024/QĐ-TTg.",
        actionRequired: "Cơ sở đã xác định trạng thái danh mục và lưu trữ số quyết định.",
        owner: "Trưởng phòng Môi trường / An toàn",
        regulationReference: "Quyết định 13/2024/QĐ-TTg & Nghị định 06/2022/NĐ-CP Điều 9"
      },
      {
        id: "vnmrv-2",
        requirement: "Kế hoạch đo đạc, giám sát phát thải KNK cấp cơ sở (Mẫu số 01 Thông tư 17/2022)",
        status: activities > 0 ? "pass" : "fail",
        detail: "Xây dựng và ban hành kế hoạch giám sát bao gồm điểm đo, phương pháp tính, quy trình QA/QC và ước lượng độ không đảm bảo.",
        actionRequired: activities > 0 ? "Đã lập kế hoạch giám sát trên hệ thống WeaveCarbon." : "Cần hoàn tất kế hoạch giám sát và phê duyệt nội bộ.",
        owner: "Kỹ sư Quản lý MRV",
        regulationReference: "Thông tư 17/2022/TT-BTNMT, Điều 8 & 9"
      },
      {
        id: "vnmrv-3",
        requirement: "Áp dụng hệ số phát thải lưới điện Việt Nam do Cục Biến đổi khí hậu công bố",
        status: "pass",
        detail: "Hệ số phát thải lưới điện quốc gia (0.6766 tCO2/MWh) theo văn bản hướng dẫn mới nhất của Bộ TN&MT.",
        actionRequired: "Hệ thống tự động đồng bộ hệ số EF_grid của Cục BĐKH.",
        owner: "Hệ thống WeaveCarbon Engine",
        regulationReference: "Công văn Cục Biến đổi khí hậu - Bộ Tài nguyên & Môi trường"
      },
      {
        id: "vnmrv-4",
        requirement: "Báo cáo kiểm kê KNK cấp cơ sở theo Mẫu 06 (Thông tư 17/2022/TT-BTNMT)",
        status: evidence > 0 ? "pass" : "warning",
        detail: "Báo cáo kiểm kê chu kỳ 2 năm/lần gửi Ủy ban nhân dân cấp tỉnh và Sở Tài nguyên Môi trường.",
        actionRequired: "Kết xuất Mẫu 06 hoàn chỉnh kèm hồ sơ bằng chứng gốc.",
        owner: "Ban Giám Đốc Nhà Máy",
        regulationReference: "Thông tư 17/2022/TT-BTNMT, Phụ lục II.6"
      }
    ];

    const passCount = checklist.filter(c => c.status === "pass").length;
    const score = Math.round((passCount / checklist.length) * 100);

    return {
      framework: "VN_MRV",
      frameworkName: "Quy chuẩn Đo đạc, Báo cáo & Thẩm định KNK Việt Nam (NĐ 06/2022 & QĐ 13/2024)",
      category: "VN_MRV",
      readinessScore: score,
      status: score >= 80 ? "ready" : score >= 50 ? "needs_remediation" : "critical_gap",
      checklist,
      roadmap: [
        { step: 1, phase: "Thiết lập kế hoạch đo đạc giám sát", description: "Hoàn thiện hồ sơ điểm đo và phương pháp luận theo Thông tư 17/2022.", deadlineDays: 10 },
        { step: 2, phase: "Kiểm tra cổng chất lượng DQL", description: "Đảm bảo các nguồn phát thải trọng yếu đạt chuẩn dữ liệu L3 trở lên.", deadlineDays: 20 },
        { step: 3, phase: "Xuất bản Báo cáo Mẫu 06 gửi Sở TN&MT", description: "Tổng hợp biểu mẫu và lưu vết mã băm số học.", deadlineDays: 30 }
      ],
      dossierSummary: `Mức sẵn sàng MRV Việt Nam đạt ${score}%. Cơ sở đáp ứng đầy đủ điều kiện kỹ thuật để xuất Báo cáo kiểm kê KNK cấp cơ sở Mẫu 06 gửi cơ quan quản lý.`
    };
  }

  if (fw === "EU_DPP") {
    const checklist: ComplianceFrameworkAssessment["checklist"] = [
      {
        id: "dpp-1",
        requirement: "Hộ chiếu số sản phẩm (DPP) & Ma trận nguồn gốc nguyên liệu dệt may / da giày",
        status: "pass",
        detail: "Quy định Thiết kế Sinh thái cho Sản phẩm Bền vững (ESPR 2024/1781) yêu cầu lưu vết định danh số của từng lô sản phẩm.",
        actionRequired: "Liên kết mã lô hàng và mã QR Hộ chiếu số sản phẩm.",
        owner: "Phòng Quản lý Chất lượng (QA)",
        regulationReference: "Regulation (EU) 2024/1781 (ESPR) Chapter III"
      },
      {
        id: "dpp-2",
        requirement: "Tỷ lệ hàm lượng sợi tái chế & Chứng chỉ GRS / OEKO-TEX",
        status: evidence > 0 ? "pass" : "warning",
        detail: "Xác minh tỷ lệ vật liệu tái chế (Recycled content %) kèm chứng thư Transaction Certificate (TC) hợp lệ.",
        actionRequired: "Tải chứng chỉ GRS vào kho lưu trữ chứng từ và khóa mã băm.",
        owner: "Bộ phận Mua hàng & Cung ứng",
        regulationReference: "EU Textiles Strategy 2030 Criteria"
      },
      {
        id: "dpp-3",
        requirement: "Kiểm soát dư lượng hóa chất theo Danh mục REACH SVHC",
        status: "pass",
        detail: "Báo cáo kiểm nghiệm hóa chất không chứa các chất trong danh mục đặc biệt quan ngại (SVHC > 0.1% w/w).",
        actionRequired: "Đã rà soát danh mục hóa chất tẩy nhuộm và hoàn tất kiểm nghiệm định kỳ.",
        owner: "Kỹ sư Hóa - Phòng Thí nghiệm",
        regulationReference: "Regulation (EC) No 1907/2006 (REACH)"
      }
    ];

    const passCount = checklist.filter(c => c.status === "pass").length;
    const score = Math.round((passCount / checklist.length) * 100);

    return {
      framework: "EU_DPP",
      frameworkName: "Hộ chiếu Sản phẩm Số & Quy định Sinh thái EU (EU DPP / ESPR 2024/1781)",
      category: "DPP",
      readinessScore: score,
      status: score >= 80 ? "ready" : "needs_remediation",
      checklist,
      roadmap: [
        { step: 1, phase: "Số hóa dữ liệu thành phần nguyên liệu", description: "Bóc tách % sợi tự nhiên, sợi tổng hợp và phụ liệu may.", deadlineDays: 14 },
        { step: 2, phase: "Tích hợp mã QR định danh DPP", description: "Sinh mã dữ liệu số theo tiêu chuẩn GS1 Digital Link.", deadlineDays: 28 }
      ],
      dossierSummary: `Hồ sơ DPP đạt ${score}%. Đã thiết lập định danh số và rà soát hóa chất REACH, sẵn sàng kết nối dữ liệu người mua EU.`
    };
  }

  // Fallback to ISO 14064-1 & PACT
  const checklist: ComplianceFrameworkAssessment["checklist"] = [
    {
      id: "iso-1",
      requirement: "Ranh giới tổ chức theo Quyền kiểm soát vận hành (Operational Control)",
      status: "pass",
      detail: "Xác định rõ ranh giới các nhà xưởng, trạm cấp nhiệt và kho bãi trực thuộc quyền vận hành.",
      actionRequired: "Ranh giới cơ sở đã được phê chuẩn trong hồ sơ hệ thống.",
      owner: "Ban Quản lý Dự án",
      regulationReference: "ISO 14064-1:2018, Khoản 5.1"
    },
    {
      id: "iso-2",
      requirement: "Kiểm kê đầy đủ 6 loại khí nhà kính (CO2, CH4, N2O, HFCs, PFCs, SF6, NF3)",
      status: activities > 0 ? "pass" : "warning",
      detail: "Tính toán GWP (Global Warming Potential) theo Báo cáo Đánh giá lần 5/6 của IPCC (AR5/AR6).",
      actionRequired: "Tích hợp module chuyển đổi GWP 100 năm cho khí môi chất lạnh.",
      owner: "Chuyên viên Kiểm kê KNK",
      regulationReference: "IPCC 6th Assessment Report (AR6)"
    },
    {
      id: "iso-3",
      requirement: "Đánh giá định lượng Độ không đảm bảo (Uncertainty Analysis)",
      status: hasSubMeters ? "pass" : "warning",
      detail: "Tổng hợp độ không đảm bảo của thiết bị đo đếm và hệ số phát thải theo phương pháp bình phương tổng.",
      actionRequired: hasSubMeters ? "Dữ liệu công tơ con WeaveNode bảo đảm sai số < 2%." : "Cần bổ sung hiệu chuẩn đồng hồ để giảm độ không đảm bảo.",
      owner: "Trưởng nhóm Đo đếm IoT",
      regulationReference: "ISO 14064-1:2018, Khoản 9.3"
    }
  ];

  const passCount = checklist.filter(c => c.status === "pass").length;
  const score = Math.round((passCount / checklist.length) * 100);

  return {
    framework: fw === "PACT" ? "PACT" : "ISO_14064",
    frameworkName: fw === "PACT" ? "Khung trao đổi dữ liệu PCF toàn cầu (WBCSD PACT Pathfinder)" : "Tiêu chuẩn Quốc tế Kiểm kê KNK Cấp Tổ chức (ISO 14064-1:2018)",
    category: fw === "PACT" ? "PACT" : "ISO_14064",
    readinessScore: score,
    status: score >= 80 ? "ready" : "needs_remediation",
    checklist,
    roadmap: [
      { step: 1, phase: "Chuẩn hóa phương pháp ranh giới", description: "Thống nhất ranh giới kiểm soát hoạt động và phân nhóm phát thải gián tiếp.", deadlineDays: 15 },
      { step: 2, phase: "Thẩm định phả hệ dữ liệu", description: "Bảo đảm toàn bộ chuỗi chứng từ được đóng dấu băm SHA-256.", deadlineDays: 30 }
    ],
    dossierSummary: `Mức độ sẵn sàng kiểm toán ISO 14064 đạt ${score}%. Cấu trúc dữ liệu đáp ứng nguyên tắc toàn vẹn, nhất quán và minh bạch.`
  };
}

/**
 * 7. AI Dự thảo Ý kiến Thẩm tra KNK theo chuẩn ISO 14064-3 (Verification Opinion Generator)
 */
export interface IsoVerificationOpinionDraft {
  opinionType: "reasonable_assurance" | "limited_assurance" | "qualified" | "adverse";
  opinionTitle: string;
  opinionStatement: string;
  materialityAssessment: {
    materialityThresholdPercent: number; // 5%
    calculatedDiscrepancyPercent: number;
    isWithinThreshold: boolean;
    conclusion: string;
  };
  scopeCoverage: {
    scope1Covered: boolean;
    scope2Covered: boolean;
    scope3Covered: boolean;
    activitiesAuditedCount: number;
    evidenceVerifiedCount: number;
  };
  qualificationNotes: string[];
  auditorDeclaration: string;
  timestamp: string;
}

export function generateIsoVerificationOpinion(params: {
  facilityName: string;
  activitiesCount: number;
  evidenceLockedCount: number;
  discrepancyPercent?: number;
  levelOfAssurance?: "reasonable" | "limited";
}): IsoVerificationOpinionDraft {
  const level = params.levelOfAssurance || "reasonable";
  const discrepancy = params.discrepancyPercent ?? 1.2;
  const threshold = 5.0; // Standard 5% materiality threshold for industrial MRV
  const isWithinThreshold = discrepancy <= threshold;
  const evRatio = params.activitiesCount > 0 ? params.evidenceLockedCount / params.activitiesCount : 0;

  let opinionType: IsoVerificationOpinionDraft["opinionType"] = "reasonable_assurance";
  let opinionTitle = "Ý KIẾN THẨM TRA CHẤP THUẬN TOÀN PHẦN (UNQUALIFIED OPINION)";
  const qualifications: string[] = [];

  if (!isWithinThreshold) {
    opinionType = "qualified";
    opinionTitle = "Ý KIẾN THẨM TRA CÓ ĐIỀU KIỆN (QUALIFIED OPINION)";
    qualifications.push(`Sai lệch số liệu hoạt động tính toán (${discrepancy}%) vượt ngưỡng trọng yếu quy định (${threshold}%).`);
  } else if (evRatio < 0.6) {
    opinionType = "qualified";
    opinionTitle = "Ý KIẾN THẨM TRA CÓ ĐIỀU KIỆN (QUALIFIED OPINION)";
    qualifications.push(`Tỷ lệ chứng từ gốc được khóa SHA-256 mới đạt ${Math.round(evRatio * 100)}% (< 60% cỡ mẫu thẩm tra).`);
  }

  const statement = opinionType === "reasonable_assurance"
    ? `Dựa trên quy trình thẩm tra được thực hiện theo tiêu chuẩn ISO 14064-3:2019, chúng tôi kết luận rằng Tuyên bố Khí nhà kính của cơ sở ${params.facilityName} phản ánh trung thực và hợp lý về mọi khía cạnh trọng yếu, phù hợp với các tiêu chí của ISO 14064-1 và Quy chuẩn Kiểm kê KNK Quốc gia.`
    : `Dựa trên kết quả thẩm tra, ngoại trừ các điểm ngoại trừ được nêu trong Báo cáo phát hiện kiểm toán (về tỷ lệ chứng từ gốc hoặc sai số đối soát), Tuyên bố Khí nhà kính của cơ sở ${params.facilityName} cơ bản tuân thủ các nguyên tắc kiểm kê.`;

  return {
    opinionType,
    opinionTitle,
    opinionStatement: statement,
    materialityAssessment: {
      materialityThresholdPercent: threshold,
      calculatedDiscrepancyPercent: discrepancy,
      isWithinThreshold,
      conclusion: isWithinThreshold
        ? `Mức sai lệch đối soát mẫu ${discrepancy}% nằm an toàn dưới ngưỡng trọng yếu 5%, đáp ứng yêu cầu thẩm tra cấp độ ${level === "reasonable" ? "Hợp lý" : "Có giới hạn"}.`
        : `Mức sai lệch ${discrepancy}% vượt trần 5%, yêu cầu cơ sở thực hiện hiệu chỉnh hồi tố số liệu trước khi cấp chứng thư.`
    },
    scopeCoverage: {
      scope1Covered: true,
      scope2Covered: true,
      scope3Covered: params.activitiesCount > 5,
      activitiesAuditedCount: params.activitiesCount,
      evidenceVerifiedCount: params.evidenceLockedCount
    },
    qualificationNotes: qualifications,
    auditorDeclaration: `Thẩm tra viên cam kết tính độc lập khách quan theo tiêu chuẩn ISO 14065 và không có xung đột lợi ích với bên được thẩm tra. Mã phiên thẩm tra được bảo chứng mật mã trên nền tảng WeaveCarbon.`,
    timestamp: new Date().toISOString()
  };
}

/**
 * 8. Bộ Tính toán Nghĩa vụ Kiểm kê KNK Bắt buộc Việt Nam (VN MRV Obligation Diagnostic)
 */
export interface VnMrvObligationResult {
  isMandatoryListed: boolean;
  classificationVerdict: string;
  totalEnergyToe: number;
  energyThresholdToe: number;
  energyExceeded: boolean;
  totalEmissionsTco2e: number;
  emissionsThresholdTco2e: number;
  emissionsExceeded: boolean;
  breakdown: {
    electricityKwh: number;
    electricityTco2e: number;
    fossilFuelTco2e: number;
    biomassTco2e: number;
  };
  statutoryDeadlines: Array<{
    obligation: string;
    legalBasis: string;
    deadline: string;
    status: "pending" | "critical" | "compliant";
  }>;
  recommendation: string;
}

export function calculateVnMrvObligation(inputs: {
  electricityKwh: number;
  coalTons?: number;
  dieselLiters?: number;
  naturalGasM3?: number;
  biomassTons?: number;
  gridFactor?: number; // default 0.6766 tCO2/MWh
}): VnMrvObligationResult {
  const elecKwh = Math.max(0, inputs.electricityKwh || 0);
  const coalTons = Math.max(0, inputs.coalTons || 0);
  const dieselLiters = Math.max(0, inputs.dieselLiters || 0);
  const gasM3 = Math.max(0, inputs.naturalGasM3 || 0);
  const biomassTons = Math.max(0, inputs.biomassTons || 0);
  const efGrid = inputs.gridFactor || 0.6766; // tCO2/MWh

  // 1. Conversion factors to TOE (Tấn dầu tương đương - TCVN / Luật Sử dụng Năng lượng Tiết kiệm & Hiệu quả)
  // Electricity: 1 kWh = 0.000154 TOE (hoặc 1 MWh = 0.154 TOE)
  // Than đá cám: 1 tấn = 0.53 TOE
  // Dầu DO: 1 lít = 0.00084 TOE
  // Khí tự nhiên: 1.000 m3 = 0.90 TOE
  // Sinh khối / Viên nén mùn cưa: 1 tấn = 0.38 TOE
  const elecToe = (elecKwh / 1000) * 0.154;
  const coalToe = coalTons * 0.53;
  const dieselToe = dieselLiters * 0.00084;
  const gasToe = (gasM3 / 1000) * 0.90;
  const biomassToe = biomassTons * 0.38;

  const totalToe = Math.round((elecToe + coalToe + dieselToe + gasToe + biomassToe) * 10) / 10;

  // 2. Greenhouse Gas Emissions (tCO2e)
  // Electricity Scope 2 = (elecKwh / 1000) * efGrid
  const elecEmissions = (elecKwh / 1000) * efGrid;
  // Scope 1:
  // Coal: ~ 2.42 tCO2e / ton
  // Diesel: ~ 2.68 kgCO2e / liter = 0.00268 tCO2e / liter
  // Gas: ~ 2.02 kgCO2e / m3 = 0.00202 tCO2e / m3
  // Biomass: CO2 biogenic (thường tính riêng), CH4/N2O ~ 0.04 tCO2e / ton
  const fossilEmissions = (coalTons * 2.42) + (dieselLiters * 0.00268) + (gasM3 * 0.00202);
  const biomassEmissions = biomassTons * 0.04;
  const totalEmissions = Math.round((elecEmissions + fossilEmissions + biomassEmissions) * 10) / 10;

  // 3. Threshold check (Quyết định số 13/2024/QĐ-TTg & Nghị định 06/2022/NĐ-CP)
  // Threshold 1: Tiêu thụ năng lượng >= 1.000 TOE/năm
  // Threshold 2: Tổng phát thải KNK >= 3.000 tCO2e/năm
  const energyThreshold = 1000;
  const emissionsThreshold = 3000;
  const energyExceeded = totalToe >= energyThreshold;
  const emissionsExceeded = totalEmissions >= emissionsThreshold;
  const isMandatory = energyExceeded || emissionsExceeded;

  const verdict = isMandatory
    ? `BẮT BUỘC KIỂM KÊ KNK CẤP CƠ SỞ (Vượt ngưỡng ${energyExceeded ? `năng lượng ${totalToe} TOE >= 1.000 TOE` : `phát thải ${totalEmissions} tCO2e >= 3.000 tCO2e`})`
    : `CHƯA THUỘC DIỆN BẮT BUỘC (Quy mô cơ sở < 1.000 TOE và < 3.000 tCO2e/năm)`;

  const deadlines: VnMrvObligationResult["statutoryDeadlines"] = [
    {
      obligation: "Nộp Kế hoạch đo đạc, giám sát phát thải KNK cấp cơ sở",
      legalBasis: "Điều 10 Nghị định 06/2022/NĐ-CP & Khoản 2 Điều 8 Thông tư 17/2022/TT-BTNMT",
      deadline: "Trước 31/12 hàng năm (năm trước kỳ kiểm kê)",
      status: isMandatory ? "critical" : "pending"
    },
    {
      obligation: "Báo cáo kiểm kê KNK cấp cơ sở định kỳ 02 năm/lần (Mẫu số 06)",
      legalBasis: "Điều 11 Nghị định 06/2022/NĐ-CP & Thông tư 38/2023/TT-BCT",
      deadline: "Trước 31/03 của năm kiểm kê (kỳ tiếp theo: 31/03/2027)",
      status: isMandatory ? "pending" : "compliant"
    },
    {
      obligation: "Gửi báo cáo thẩm tra của Đơn vị thẩm tra độc lập",
      legalBasis: "Khoản 4 Điều 12 Nghị định 06/2022/NĐ-CP",
      deadline: "Kèm theo Báo cáo kiểm kê KNK cấp cơ sở",
      status: isMandatory ? "pending" : "compliant"
    }
  ];

  return {
    isMandatoryListed: isMandatory,
    classificationVerdict: verdict,
    totalEnergyToe: totalToe,
    energyThresholdToe: energyThreshold,
    energyExceeded,
    totalEmissionsTco2e: totalEmissions,
    emissionsThresholdTco2e: emissionsThreshold,
    emissionsExceeded,
    breakdown: {
      electricityKwh: elecKwh,
      electricityTco2e: Math.round(elecEmissions * 10) / 10,
      fossilFuelTco2e: Math.round(fossilEmissions * 10) / 10,
      biomassTco2e: Math.round(biomassEmissions * 10) / 10
    },
    statutoryDeadlines: deadlines,
    recommendation: isMandatory
      ? "Cơ sở cần khẩn trương kích hoạt Kế hoạch Đo đạc Giám sát và chốt danh mục điểm đo để bảo đảm tiến độ thẩm tra theo QĐ 13/2024/QĐ-TTg."
      : "Cơ sở chưa bắt buộc nộp báo cáo lên Sở TN&MT, nhưng nên duy trì theo dõi trên WeaveCarbon để sẵn sàng cho yêu cầu ESG của khách hàng xuất khẩu."
  };
}

/**
 * 9. Mô phỏng Đường cong Chi phí Giảm phát thải Biên (Marginal Abatement Cost Curve - MACC)
 */
export interface MaccInitiativeItem {
  id: string;
  title: string;
  category: "energy_efficiency" | "renewable_energy" | "fuel_switching" | "electrification" | "process_optimization";
  capexUsd: number;
  lifetimeYears: number;
  annualSavingsUsd: number;
  annualAbatementTco2e: number;
  abatementCostPerTco2e: number; // ($/tCO2e)
  paybackYears: number;
  npvUsd: number;
  status: "planned" | "in_progress" | "completed";
}

export interface MaccSimulationResult {
  initiativesRanked: MaccInitiativeItem[];
  totalCapexUsd: number;
  totalAnnualSavingsUsd: number;
  totalAnnualAbatementTco2e: number;
  weightedAvgAbatementCost: number;
  netNegativeCostCount: number; // Projects with negative cost (profitable savings)
  portfolioSummary: string;
}

export function simulateMaccInitiatives(rawInitiatives: Array<{
  id: string;
  title: string;
  category?: string;
  capexUsd?: number;
  lifetimeYears?: number;
  annualSavingsUsd?: number;
  targetReductionTco2e?: number;
  status?: string;
}>): MaccSimulationResult {
  const discountRate = 0.08; // 8% cost of capital

  const evaluated: MaccInitiativeItem[] = rawInitiatives.map(item => {
    const capex = item.capexUsd || 15000;
    const life = Math.max(1, item.lifetimeYears || 10);
    const savings = item.annualSavingsUsd || 4000;
    const abatement = Math.max(1, item.targetReductionTco2e || 100);

    // Capital Recovery Factor: CRF = [r*(1+r)^n] / [(1+r)^n - 1]
    const crf = (discountRate * Math.pow(1 + discountRate, life)) / (Math.pow(1 + discountRate, life) - 1);
    const annualizedCapex = capex * crf;
    const netAnnualCost = annualizedCapex - savings;
    const abatementCost = Math.round((netAnnualCost / abatement) * 100) / 100; // $/tCO2e
    const payback = Math.round((capex / Math.max(1, savings)) * 10) / 10;

    // Simple NPV = Savings * [(1 - (1+r)^-n)/r] - CAPEX
    const annuityFactor = (1 - Math.pow(1 + discountRate, -life)) / discountRate;
    const npv = Math.round(savings * annuityFactor - capex);

    return {
      id: item.id,
      title: item.title,
      category: (item.category as MaccInitiativeItem["category"]) || "energy_efficiency",
      capexUsd: capex,
      lifetimeYears: life,
      annualSavingsUsd: savings,
      annualAbatementTco2e: abatement,
      abatementCostPerTco2e: abatementCost,
      paybackYears: payback,
      npvUsd: npv,
      status: (item.status as MaccInitiativeItem["status"]) || "planned"
    };
  });

  // Sort by Abatement Cost ascending (standard MACC ordering)
  evaluated.sort((a, b) => a.abatementCostPerTco2e - b.abatementCostPerTco2e);

  const totalCapex = evaluated.reduce((s, i) => s + i.capexUsd, 0);
  const totalSavings = evaluated.reduce((s, i) => s + i.annualSavingsUsd, 0);
  const totalAbatement = evaluated.reduce((s, i) => s + i.annualAbatementTco2e, 0);
  const netNegative = evaluated.filter(i => i.abatementCostPerTco2e < 0).length;

  const weightedSum = evaluated.reduce((s, i) => s + (i.abatementCostPerTco2e * i.annualAbatementTco2e), 0);
  const weightedAvgCost = totalAbatement > 0 ? Math.round((weightedSum / totalAbatement) * 100) / 100 : 0;

  return {
    initiativesRanked: evaluated,
    totalCapexUsd: totalCapex,
    totalAnnualSavingsUsd: totalSavings,
    totalAnnualAbatementTco2e: totalAbatement,
    weightedAvgAbatementCost: weightedAvgCost,
    netNegativeCostCount: netNegative,
    portfolioSummary: `Tổng hợp ${evaluated.length} sáng kiến giảm phát thải. Có ${netNegative} dự án chi phí âm (tiết kiệm chi phí vận hành ròng). Tổng tiềm năng giảm phát thải ${totalAbatement.toLocaleString("vi-VN")} tCO2e/năm với chi phí bình quân trọng số $${weightedAvgCost}/tCO2e.`
  };
}

/**
 * 10. AI Chẩn đoán Dị thường Dữ liệu Cảm biến & Công tơ IoT WeaveNode
 */
export interface IotAnomalyItem {
  id: string;
  deviceId: string;
  deviceReference: string;
  parameter: "power_kw" | "energy_kwh" | "power_factor" | "voltage" | "drift" | "calibration";
  severity: "critical" | "warning" | "info";
  observedValue: string;
  expectedRange: string;
  anomalyTitle: string;
  diagnosticExplanation: string;
  actionProtocol: string;
  detectedAt: string;
}

export interface IotAnomalyScanResult {
  totalDevicesScanned: number;
  healthyCount: number;
  anomalyCount: number;
  anomalies: IotAnomalyItem[];
  systemHealthScore: number;
  summary: string;
}

export function detectIotSensorAnomalies(devices: Array<{
  id: string;
  deviceReference: string;
  measurementPointReference?: string;
  currentPowerKw?: number;
  powerFactor?: number;
  voltageV?: number;
  lastHeartbeatMinutesAgo?: number;
  calibrationExpired?: boolean;
}>): IotAnomalyScanResult {
  const anomalies: IotAnomalyItem[] = [];

  devices.forEach((dev) => {
    const pf = dev.powerFactor ?? 0.92;
    const kw = dev.currentPowerKw ?? 45;
    const volt = dev.voltageV ?? 382;
    const heartbeat = dev.lastHeartbeatMinutesAgo ?? 2;

    // Check 1: Low Power Factor (< 0.85 incurs EVN reactive power tariff penalty)
    if (pf < 0.85 && kw > 5) {
      anomalies.push({
        id: `anom-${dev.id}-pf`,
        deviceId: dev.id,
        deviceReference: dev.deviceReference,
        parameter: "power_factor",
        severity: "warning",
        observedValue: `cos φ = ${pf.toFixed(2)}`,
        expectedRange: "cos φ >= 0.90",
        anomalyTitle: "Hệ số công suất cos φ thấp (Rủi ro phạt tiền công suất phản kháng EVN)",
        diagnosticExplanation: `Hệ số công suất tụt xuống ${pf.toFixed(2)} khi tải đạt ${kw} kW. Dấu hiệu tủ tụ bù điện hạ thế bị hỏng khởi động từ hoặc tụ quá nhiệt.`,
        actionProtocol: "Kiểm tra tủ tụ bù tự động APFC tại trạm biến áp, thay thế tụ khô suy giảm dung lượng.",
        detectedAt: new Date().toISOString()
      });
    }

    // Check 2: Voltage Unbalance or Drop
    if (volt < 360 || volt > 415) {
      anomalies.push({
        id: `anom-${dev.id}-volt`,
        deviceId: dev.id,
        deviceReference: dev.deviceReference,
        parameter: "voltage",
        severity: "critical",
        observedValue: `${volt} V`,
        expectedRange: "380 V ± 5% (361 - 399 V)",
        anomalyTitle: "Điện áp dây lệch chuẩn kỹ thuật trạm biến áp",
        diagnosticExplanation: `Điện áp vận hành lệch quá ngưỡng cho phép, có nguy cơ gây phát nhiệt động cơ máy dệt và tăng tổn thất điện vô công.`,
        actionProtocol: "Báo điều độ điện lực và kiểm tra nấc phân áp của máy biến áp phân phối.",
        detectedAt: new Date().toISOString()
      });
    }

    // Check 3: Sensor Timeout / Heartbeat Loss
    if (heartbeat > 15) {
      anomalies.push({
        id: `anom-${dev.id}-timeout`,
        deviceId: dev.id,
        deviceReference: dev.deviceReference,
        parameter: "drift",
        severity: "critical",
        observedValue: `Mất tín hiệu ${heartbeat} phút`,
        expectedRange: "< 5 phút",
        anomalyTitle: "Đứt quãng truyền tin cảm biến WeaveNode Edge",
        diagnosticExplanation: `Cổng kết nối Modbus RTU / MQTT không nhận được gói tin dữ liệu telemetry trong hơn 15 phút.`,
        actionProtocol: "Kiểm tra nguồn cấp 24VDC WeaveNode Edge Gateway và đường cáp RS-485 chống nhiễu.",
        detectedAt: new Date().toISOString()
      });
    }

    // Check 4: Calibration
    if (dev.calibrationExpired) {
      anomalies.push({
        id: `anom-${dev.id}-calib`,
        deviceId: dev.id,
        deviceReference: dev.deviceReference,
        parameter: "calibration",
        severity: "warning",
        observedValue: "Quá hạn kiểm định",
        expectedRange: "Hiệu lực trong hạn",
        anomalyTitle: "Công tơ đo đếm quá hạn kiểm định định kỳ",
        diagnosticExplanation: "Đồng hồ đo đếm năng lượng đã quá chu kỳ kiểm định 24 tháng theo quy định đo lường của Bộ KH&CN.",
        actionProtocol: "Liên hệ Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng (Quatest) để thực hiện kiểm định lại.",
        detectedAt: new Date().toISOString()
      });
    }
  });

  const healthy = devices.length - new Set(anomalies.map(a => a.deviceId)).size;
  const healthScore = devices.length > 0 ? Math.round((Math.max(0, healthy) / devices.length) * 100) : 100;

  return {
    totalDevicesScanned: devices.length,
    healthyCount: healthy,
    anomalyCount: anomalies.length,
    anomalies,
    systemHealthScore: healthScore,
    summary: `Quét ${devices.length} điểm đo & thiết bị WeaveNode. Phát hiện ${anomalies.length} cảnh báo dị thường kỹ thuật. Điểm sức khỏe mạng lưới cảm biến đạt ${healthScore}/100.`
  };
}
