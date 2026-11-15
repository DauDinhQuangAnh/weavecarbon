/**
 * Giai đoạn 2/3 (đồng bộ Lovable) — mô hình Estimate vs Audit-ready cho sản phẩm.
 * Các chỉ số được suy ra từ dữ liệu sản phẩm hiện có (snapshot tính toán, độ tin cậy,
 * proxy, phạm vi Scope). Đây là chỉ báo nội bộ, không phải kết luận kiểm toán.
 */
import type { ProductRecord } from "./types";

export type CalculationMode = "estimate" | "audit_ready";
export type ProductDataStatus = "draft" | "estimate" | "pre_audit" | "audit_ready";
export type ConfidenceLevel = "low" | "medium" | "high";

export interface AuditReadiness {
  mode: CalculationMode;
  dataStatus: ProductDataStatus;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  proxyPercentage: number;
  primaryDataPercentage: number;
  auditReadyScore: number;
}

export const confidenceFromScore = (score: number): ConfidenceLevel =>
  score >= 80 ? "high" : score >= 50 ? "medium" : "low";

const LEVEL_SCORE: Record<ConfidenceLevel, number> = { high: 85, medium: 60, low: 35 };

type AuditInput = Pick<ProductRecord, "status" | "carbonResults" | "carbonAuthority">;

export function deriveAuditReadiness(product: AuditInput): AuditReadiness {
  const results = product.carbonResults;
  if (!results) {
    return { mode: "estimate", dataStatus: "draft", confidenceScore: 0, confidenceLevel: "low", proxyPercentage: 100, primaryDataPercentage: 0, auditReadyScore: 0 };
  }
  const confidenceScore = Math.round(
    typeof results.confidenceScore === "number" && Number.isFinite(results.confidenceScore)
      ? Math.max(0, Math.min(100, results.confidenceScore))
      : LEVEL_SCORE[results.confidenceLevel] ?? 35
  );
  const authoritative = Boolean(product.carbonAuthority?.authoritative);
  const scopes = [results.scope1, results.scope2, results.scope3].filter((v) => typeof v === "number").length;
  const scopeCoverage = scopes >= 3 ? 100 : scopes === 2 ? 66 : scopes === 1 ? 33 : 0;
  const proxyPercentage = Math.round(results.proxyUsed ? Math.max(20, 100 - confidenceScore) : Math.max(0, 100 - confidenceScore));
  const auditReadyScore = Math.round(
    Math.min(100, 0.5 * confidenceScore + 0.2 * scopeCoverage + (authoritative ? 30 : 0))
  );
  const isAuditReady = authoritative && !results.proxyUsed && confidenceScore >= 75 && product.status === "published";
  const dataStatus: ProductDataStatus = isAuditReady
    ? "audit_ready"
    : authoritative
      ? "pre_audit"
      : confidenceScore >= 50
        ? "estimate"
        : "draft";
  return {
    mode: isAuditReady ? "audit_ready" : "estimate",
    dataStatus,
    confidenceScore,
    confidenceLevel: confidenceFromScore(confidenceScore),
    proxyPercentage,
    primaryDataPercentage: 100 - proxyPercentage,
    auditReadyScore,
  };
}
