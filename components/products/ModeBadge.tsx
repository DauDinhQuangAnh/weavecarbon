/**
 * Giai đoạn 3 (đồng bộ Lovable) — chip chế độ tính & trạng thái dữ liệu.
 */
import React from "react";
import { Eye, FileEdit, FlaskConical, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CalculationMode, ConfidenceLevel, ProductDataStatus } from "@/lib/products/auditReadiness";

type IconType = React.ComponentType<{ className?: string }>;

const MODE: Record<CalculationMode, { label: string; cls: string; Icon: IconType }> = {
  estimate: { label: "Estimate", cls: "border-warning/40 bg-warning/10 text-foreground", Icon: FlaskConical },
  audit_ready: { label: "Audit-ready", cls: "border-primary/30 bg-primary/10 text-primary", Icon: ShieldCheck },
};

export const DATA_STATUS_META: Record<ProductDataStatus, { label: string; cls: string; Icon: IconType }> = {
  draft: { label: "Nháp dữ liệu", cls: "border-border bg-muted text-muted-foreground", Icon: FileEdit },
  estimate: { label: "Estimate", cls: "border-warning/40 bg-warning/10 text-foreground", Icon: FlaskConical },
  pre_audit: { label: "Pre-audit", cls: "border-info/30 bg-info/10 text-info", Icon: Eye },
  audit_ready: { label: "Audit-ready", cls: "border-primary/30 bg-primary/10 text-primary", Icon: ShieldCheck },
};

const CONF: Record<ConfidenceLevel, { label: string; cls: string }> = {
  low: { label: "Tin cậy thấp", cls: "border-destructive/30 bg-destructive/10 text-destructive" },
  medium: { label: "Tin cậy TB", cls: "border-warning/40 bg-warning/10 text-foreground" },
  high: { label: "Tin cậy cao", cls: "border-primary/30 bg-primary/10 text-primary" },
};

export function ModeBadge({ mode, showWarning = false }: { mode: CalculationMode; showWarning?: boolean }) {
  const { label, cls, Icon } = MODE[mode];
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant="outline" className={`gap-1 text-[10px] font-medium ${cls}`}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
      {showWarning && mode === "estimate" ? (
        <span className="text-[10px] italic text-muted-foreground">
          Dữ liệu ước tính — chưa audit-ready, không dùng cho buyer/CBAM.
        </span>
      ) : null}
    </span>
  );
}

export function DataStatusBadge({ status }: { status: ProductDataStatus }) {
  const { label, cls, Icon } = DATA_STATUS_META[status];
  return (
    <Badge variant="outline" className={`gap-1 text-[10px] font-medium ${cls}`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

export function ConfidenceBadge({ level, score }: { level: ConfidenceLevel; score?: number }) {
  const { label, cls } = CONF[level];
  return (
    <Badge variant="outline" className={`text-[10px] font-medium ${cls}`}>
      {label}
      {typeof score === "number" ? ` · ${score}%` : ""}
    </Badge>
  );
}
