'use client';

import React from 'react';
import { AlertTriangle, ShieldCheck, FileWarning } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CBAM_PRICE_PER_TON, DEFAULT_VALUE_MULTIPLIER } from '@/config/penalties';
import type { CredibilityResult } from '@/lib/credibilityEngine';

interface Props {
  result: Pick<CredibilityResult, 'hasRedFlag' | 'excessTonsCo2e' | 'cbamPenaltyEur' | 'methodology'>;
  className?: string;
}

/**
 * Red-Flag mechanism UI.
 * When the calculation falls back to Ecoinvent worst-case (no supplier evidence),
 * surfaces the CBAM-equivalent financial risk so the buyer pushes the supplier
 * to upload real invoices/ERP exports.
 */
const RedFlagBanner: React.FC<Props> = ({ result, className }) => {
  if (!result.hasRedFlag) {
    return (
      <Card className={`p-4 border-emerald-500/30 bg-emerald-500/5 ${className ?? ''}`}>
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-emerald-700">
                Dữ liệu sơ cấp đầy đủ — Sẵn sàng kiểm toán
              </p>
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700">
                AUDIT-READY
              </Badge>
            </div>
            <p className="text-xs text-emerald-700/80">{result.methodology}</p>
          </div>
        </div>
      </Card>
    );
  }

  const upliftPct = Math.round((DEFAULT_VALUE_MULTIPLIER - 1) * 100);

  return (
    <Card className={`p-4 border-destructive/40 bg-destructive/5 ${className ?? ''}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-destructive">
              Cảnh báo Red-Flag: Thiếu chứng từ Scope 3
            </p>
            <Badge variant="destructive" className="text-[10px]">
              +{upliftPct}% PROXY
            </Badge>
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed">
            Không có hóa đơn / ERP của nhà cung cấp. Hệ thống đã áp <strong>hệ số worst-case Ecoinvent</strong> theo
            ISO 14067 — đồng nghĩa số liệu carbon của bạn có thể bị đội <strong>+{upliftPct}%</strong> khi cơ quan
            kiểm toán EU (SGS/Bureau Veritas) thẩm định.
          </p>

          <div className="grid sm:grid-cols-2 gap-2 pt-1">
            <div className="rounded-md border border-destructive/30 bg-background/60 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Phát thải dư (gap)
              </p>
              <p className="text-base font-bold text-destructive">
                +{result.excessTonsCo2e.toFixed(3)} tCO₂e
              </p>
            </div>
            <div className="rounded-md border border-destructive/30 bg-background/60 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Thuế CBAM ước tính ({CBAM_PRICE_PER_TON} €/tấn)
              </p>
              <p className="text-base font-bold text-destructive">
                ≈ {result.cbamPenaltyEur.toLocaleString('vi-VN')} EUR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
            <FileWarning className="w-3 h-3" />
            <span>
              Tải lên hóa đơn EVN, hợp đồng nguyên liệu hoặc xuất ERP để chuyển sang dữ liệu sơ cấp và xoá cảnh báo này.
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default RedFlagBanner;
