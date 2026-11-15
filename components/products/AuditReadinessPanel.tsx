import { ShieldCheck } from "lucide-react";
import { ConfidenceBadge, DataStatusBadge, ModeBadge } from "@/components/products/ModeBadge";
import { deriveAuditReadiness } from "@/lib/products/auditReadiness";
import type { ProductRecord } from "@/lib/products/types";

function Meter({ label, value, tone = "primary" }: { label: string; value: number; tone?: "primary" | "warning" }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-foreground">{value}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${tone === "warning" ? "bg-warning" : "bg-primary"}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

/** Giai đoạn 2/3 (Lovable): Estimate vs Audit-ready cho một sản phẩm. */
export default function AuditReadinessPanel({ product }: { product: ProductRecord }) {
  const r = deriveAuditReadiness(product);
  return (
    <section className="glass-panel rounded-2xl border border-white/70 bg-card/70 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Mức sẵn sàng kiểm toán
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Estimate vs Audit-ready được suy ra từ snapshot tính toán, độ tin cậy, tỷ lệ proxy và phạm vi Scope. Chỉ báo
            nội bộ — không phải kết luận kiểm toán.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ModeBadge mode={r.mode} />
          <DataStatusBadge status={r.dataStatus} />
          <ConfidenceBadge level={r.confidenceLevel} score={r.confidenceScore} />
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Meter label="Audit-ready score" value={r.auditReadyScore} />
        <Meter label="Dữ liệu sơ cấp" value={r.primaryDataPercentage} />
        <Meter label="Dữ liệu proxy" value={r.proxyPercentage} tone="warning" />
      </div>
      {r.mode === "estimate" ? (
        <p className="mt-3 text-xs italic text-muted-foreground">
          Dữ liệu ước tính — chưa audit-ready, không dùng cho hồ sơ buyer hoặc CBAM.
        </p>
      ) : null}
    </section>
  );
}
