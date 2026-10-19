/**
 * Data Quality Ladder Engine
 * Implements Section 13 & 1.2 of WEAVECARBON PRODUCT PARITY & MIGRATION SPECIFICATION:
 * - 6-tier quality ladder: L0 Missing -> L1 Proxy -> L2 Self-reported -> L3 Evidence-backed -> L4 Reconciled -> L5 Independently verified
 * - Next action recommendations to elevate data quality
 * - Weighted Data Quality Index (DQI) calculation
 */

export type DataQualityTier = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";

export interface DataQualityDefinition {
  tier: DataQualityTier;
  code: string;
  labelVi: string;
  labelEn: string;
  descriptionVi: string;
  trustScore: number; // 0 - 100
  badgeClass: string;
  requiresEvidence: boolean;
  isAudited: boolean;
  nextActionVi: string;
  nextActionEn: string;
}

export const DATA_QUALITY_LADDER: Record<DataQualityTier, DataQualityDefinition> = {
  L0: {
    tier: "L0",
    code: "L0_MISSING",
    labelVi: "L0 Thiếu dữ liệu",
    labelEn: "L0 Missing Data",
    descriptionVi: "Chưa có bản ghi hoạt động hoặc dữ liệu bị gián đoạn/thiếu hụt.",
    trustScore: 0,
    badgeClass: "bg-neutral-100 text-neutral-600 border-neutral-300",
    requiresEvidence: true,
    isAudited: false,
    nextActionVi: "Thu thập bản ghi hoạt động và nguồn đo đạc",
    nextActionEn: "Collect activity record and measurement source",
  },
  L1: {
    tier: "L1",
    code: "L1_PROXY",
    labelVi: "L1 Dữ liệu ước lượng / Proxy",
    labelEn: "L1 Proxy / Estimated",
    descriptionVi: "Ước tính theo định mức trung bình ngành hoặc chi tiêu tài chính (Spend-based).",
    trustScore: 35,
    badgeClass: "bg-amber-50 text-amber-800 border-amber-300",
    requiresEvidence: false,
    isAudited: false,
    nextActionVi: "Thay thế bằng số đo sản lượng hoặc hóa đơn thực tế",
    nextActionEn: "Replace with physical output or utility invoice",
  },
  L2: {
    tier: "L2",
    code: "L2_SELF_REPORTED",
    labelVi: "L2 Tự khai báo",
    labelEn: "L2 Self-Reported",
    descriptionVi: "Dữ liệu do cơ sở tự nhập tay, chưa gắn kèm chứng từ kiểm chứng.",
    trustScore: 55,
    badgeClass: "bg-blue-50 text-blue-800 border-blue-300",
    requiresEvidence: true,
    isAudited: false,
    nextActionVi: "Tải lên hóa đơn hoặc chụp chứng từ xác nhận nguồn",
    nextActionEn: "Upload invoice or scan source document",
  },
  L3: {
    tier: "L3",
    code: "L3_EVIDENCE_BACKED",
    labelVi: "L3 Có chứng từ bảo chứng",
    labelEn: "L3 Evidence-Backed",
    descriptionVi: "Đã liên kết hóa đơn EVN, phiếu xuất kho, phiếu cân hoặc chứng từ gốc có mã băm SHA-256.",
    trustScore: 78,
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300",
    requiresEvidence: true,
    isAudited: false,
    nextActionVi: "Đối soát chéo công tơ con với công tơ tổng (Sub-meter Reconciliation)",
    nextActionEn: "Reconcile sub-meter against main utility meter",
  },
  L4: {
    tier: "L4",
    code: "L4_RECONCILED",
    labelVi: "L4 Đã đối soát chéo",
    labelEn: "L4 Reconciled",
    descriptionVi: "Dữ liệu đồng hồ/cảm biến IoT đã đối soát chớp khớp với hóa đơn tài chính (sai số < 2%).",
    trustScore: 90,
    badgeClass: "bg-teal-50 text-teal-900 border-teal-300 font-semibold",
    requiresEvidence: true,
    isAudited: false,
    nextActionVi: "Gửi thẩm tra độc lập bên thứ ba (ISO 14064-3 Third-party Verification)",
    nextActionEn: "Submit for independent 3rd-party audit",
  },
  L5: {
    tier: "L5",
    code: "L5_INDEPENDENTLY_VERIFIED",
    labelVi: "L5 Thẩm tra độc lập",
    labelEn: "L5 Independently Verified",
    descriptionVi: "Đơn vị thẩm định độc lập được công nhận đã ban hành Ý kiến thẩm tra chính thức.",
    trustScore: 100,
    badgeClass: "bg-[#145233] text-[#F6F8F2] border-[#145233] font-semibold shadow-xs",
    requiresEvidence: true,
    isAudited: true,
    nextActionVi: "Đạt chuẩn cao nhất — Sẵn sàng công bố và nộp báo cáo quốc tế",
    nextActionEn: "Highest tier — Ready for regulatory submission",
  },
};

/**
 * Normalize any legacy string tier into valid DataQualityTier
 */
export function normalizeDataQualityTier(val?: string | null): DataQualityTier {
  if (!val) return "L2";
  const upper = val.toUpperCase().trim();
  if (upper in DATA_QUALITY_LADDER) return upper as DataQualityTier;
  if (upper.includes("5") || upper.includes("VERIFIED")) return "L5";
  if (upper.includes("4") || upper.includes("RECONCILE")) return "L4";
  if (upper.includes("3") || upper.includes("EVIDENCE")) return "L3";
  if (upper.includes("2") || upper.includes("SELF")) return "L2";
  if (upper.includes("1") || upper.includes("PROXY")) return "L1";
  if (upper.includes("0") || upper.includes("MISSING")) return "L0";
  return "L2";
}

/**
 * Calculate Data Quality Index (DQI) across activity dataset
 */
export function calculateDatasetDqi(
  activities: Array<{ dataQualityLevel?: string | null; quantity?: number | string | null }>
): {
  overallDqi: number; // 0 - 100
  tierDistribution: Record<DataQualityTier, number>;
  verifiedCount: number;
  totalCount: number;
} {
  const distribution: Record<DataQualityTier, number> = {
    L0: 0,
    L1: 0,
    L2: 0,
    L3: 0,
    L4: 0,
    L5: 0,
  };

  let totalWeight = 0;
  let weightedScoreSum = 0;

  for (const act of activities) {
    const tier = normalizeDataQualityTier(act.dataQualityLevel);
    distribution[tier] += 1;

    const qty = Math.abs(Number(act.quantity) || 1);
    const def = DATA_QUALITY_LADDER[tier];

    weightedScoreSum += def.trustScore * qty;
    totalWeight += qty;
  }

  const overallDqi = totalWeight > 0 ? Math.round(weightedScoreSum / totalWeight) : 0;

  return {
    overallDqi,
    tierDistribution: distribution,
    verifiedCount: distribution.L5,
    totalCount: activities.length,
  };
}
