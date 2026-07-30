import { Lock, Download, FileText, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { CredibilityResult } from '@/lib/credibilityEngine';
import { shortHash } from '@/lib/documentHash';

export interface EvidenceFile {
  filename: string;
  lookupCode: string;
  sha256: string;
  url?: string;
}

interface Props {
  skuCode: string;
  result: CredibilityResult;
  evidence: EvidenceFile[];
  onDownloadAuditPack?: () => void;
  onDownloadTT01?: () => void;
  onDownloadCbam?: () => void;
}

/**
 * Audit Compliance Panel — locked SKU, AD × EF table with provenance,
 * and download buttons SGS/TÜV expect.
 */
export function CompliancePanel({
  skuCode,
  result,
  evidence,
  onDownloadAuditPack,
  onDownloadTT01,
  onDownloadCbam,
}: Props) {
  return (
    <Card className="border-2 border-foreground/10 bg-card font-mono text-sm">
      {/* Header */}
      <div className="border-b border-dashed border-foreground/20 bg-muted/40 px-4 py-3">
        <div className="text-center text-xs font-bold tracking-widest text-muted-foreground">
          WEAVE CARBON CORE ENGINE — AUDIT COMPLIANCE PANEL
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-sm font-mono">SKU: {skuCode}</Badge>
            <Badge className="rounded-sm bg-emerald-600 font-mono hover:bg-emerald-600">
              <Lock className="mr-1 h-3 w-3" /> ĐÃ KHÓA SỬA ĐỔI (SHA-256)
            </Badge>
          </div>
          {result.hasRedFlag ? (
            <Badge variant="destructive" className="rounded-sm font-mono">
              <AlertTriangle className="mr-1 h-3 w-3" /> +{Math.round(((result.totalKgCo2e / Math.max(result.bestCaseKgCo2e, 1)) - 1) * 100)}% PROXY (EU 2023/1773)
            </Badge>
          ) : (
            <Badge className="rounded-sm bg-emerald-700 font-mono hover:bg-emerald-700">
              <ShieldCheck className="mr-1 h-3 w-3" /> AUDIT-READY
            </Badge>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Phân đoạn</th>
              <th className="px-3 py-2 text-right">Sản lượng (AD)</th>
              <th className="px-3 py-2 text-right">Hệ số (EF)</th>
              <th className="px-3 py-2">Nguồn gốc EF</th>
              <th className="px-3 py-2 text-right">kg CO₂e</th>
            </tr>
          </thead>
          <tbody>
            {result.lines.map((l, i) => (
              <tr
                key={i}
                className={`border-t border-foreground/5 ${l.factor.isDefault ? 'bg-destructive/5' : ''}`}
              >
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2">
                  <span className="capitalize">{l.category}</span>
                  {l.factor.isDefault && (
                    <Badge variant="destructive" className="ml-2 rounded-sm px-1 py-0 text-[10px]">
                      DEFAULT
                    </Badge>
                  )}
                  <div className="text-[10px] text-muted-foreground">{l.label}</div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{l.activity.toFixed(3)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.factor.factor.toFixed(4)}</td>
                <td className="px-3 py-2 text-[11px] text-muted-foreground">{l.factor.citation}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{l.kgCo2e.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground/20 bg-muted/40">
              <td colSpan={5} className="px-3 py-2 font-bold">
                TỔNG DẤU CHÂN CARBON SẢN PHẨM (ISO 14067)
              </td>
              <td className="px-3 py-2 text-right text-base font-bold tabular-nums">
                {result.totalKgCo2e.toFixed(3)} <span className="text-xs font-normal">kg CO₂e/chiếc</span>
              </td>
            </tr>
            {result.hasRedFlag && (
              <tr className="bg-destructive/10">
                <td colSpan={5} className="px-3 py-2 text-destructive">
                  Mô phỏng rủi ro kiểu CBAM (pre-audit, giả định 85 €/tCO₂e × dư phát thải {result.excessTonsCo2e.toFixed(4)} t — không phải khoản phí CBAM thực tế)
                </td>
                <td className="px-3 py-2 text-right font-bold text-destructive tabular-nums">
                  € {result.cbamPenaltyEur.toFixed(2)}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {/* Evidence + downloads */}
      <div className="space-y-3 border-t border-dashed border-foreground/20 p-4">
        <div className="text-xs font-bold tracking-wide text-muted-foreground">
          &gt;&gt;&gt; HỒ SƠ CHỨNG TỪ GỐC (TẢI VỀ CHO KIỂM TOÁN VIÊN SGS / TÜV RHEINLAND) &lt;&lt;&lt;
        </div>
        <ul className="space-y-1 text-xs">
          {evidence.map((e, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded border border-foreground/10 px-2 py-1">
              <span className="flex items-center gap-2 truncate">
                <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{e.filename}</span>
                <Badge variant="outline" className="rounded-sm px-1 py-0 text-[10px]">
                  Mã tra cứu: {e.lookupCode}
                </Badge>
              </span>
              <span className="text-[10px] text-muted-foreground">SHA-256 {shortHash(e.sha256)}</span>
            </li>
          ))}
          {evidence.length === 0 && (
            <li className="text-muted-foreground">— Chưa có chứng từ được khóa —</li>
          )}
        </ul>
        <div className="flex flex-wrap gap-2 pt-2">
          {onDownloadAuditPack && (
            <Button size="sm" variant="default" onClick={onDownloadAuditPack}>
              <Download className="mr-1 h-3 w-3" /> Audit Pack (JSON)
            </Button>
          )}
          {onDownloadTT01 && (
            <Button size="sm" variant="outline" onClick={onDownloadTT01}>
              <Download className="mr-1 h-3 w-3" /> Mẫu 01 — TT 01/2022
            </Button>
          )}
          {onDownloadCbam && (
            <Button size="sm" variant="outline" onClick={onDownloadCbam}>
              <Download className="mr-1 h-3 w-3" /> CBAM-style template (DG TAXUD, pre-audit)
            </Button>
          )}
        </div>
        <div className="pt-2 text-[10px] text-muted-foreground">
          {result.methodology}
        </div>
      </div>
    </Card>
  );
}
