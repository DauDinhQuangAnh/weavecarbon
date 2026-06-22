'use client';

import React from 'react';
import { BulkProductRow } from './types';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertCircle, CheckCircle2, Leaf, ShieldAlert } from 'lucide-react';

function getDataQuality(row: BulkProductRow): {
  level: 'audit_ready' | 'partial' | 'cbam_risk';
  label: string;
  reason: string;
} {
  const hasPrimarySource =
    row.materialSource && row.materialSource !== 'unknown';
  const hasFullScope3 = row.scope === 'scope1_2_3' && hasPrimarySource;
  if (hasFullScope3) {
    return {
      level: 'audit_ready',
      label: 'Audit-Ready',
      reason:
        'Đầy đủ Scope 1-2-3 với nguồn vật liệu xác thực (Ecoinvent v3.10).',
    };
  }
  if (!hasPrimarySource) {
    return {
      level: 'cbam_risk',
      label: 'Default +45% · CBAM risk',
      reason:
        'Thiếu nguồn vật liệu Scope 3 → áp dụng proxy worst-case +45% + phạt CBAM (85 EUR/tCO₂e).',
    };
  }
  return {
    level: 'partial',
    label: 'Một phần',
    reason:
      'Còn thiếu chứng từ Scope 3 — bổ sung hóa đơn/CO để đạt Audit-Ready.',
  };
}

const QUALITY_STYLE: Record<string, string> = {
  audit_ready:
    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  partial:
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-500/30',
  cbam_risk: 'bg-destructive/10 text-destructive border-destructive/30',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-red-100 text-red-700',
};

const SCOPE_LABELS: Record<string, string> = {
  scope1: 'Scope 1',
  scope1_2: 'Scope 1-2',
  scope1_2_3: 'Scope 1-2-3',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
};

interface PreviewTableProps {
  rows: BulkProductRow[];
  showCarbonData?: boolean;
}

const PreviewTable: React.FC<PreviewTableProps> = ({
  rows,
  showCarbonData = false,
}) => (
  <div className="border rounded-lg">
    <ScrollArea className="h-[400px]">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead className="w-[50px]">#</TableHead>
            <TableHead className="min-w-[100px]">SKU</TableHead>
            <TableHead className="min-w-[200px]">Tên sản phẩm</TableHead>
            <TableHead className="w-[80px]">SL</TableHead>
            <TableHead className="min-w-[100px]">Vải chính</TableHead>
            <TableHead className="w-[100px]">Thị trường</TableHead>
            {showCarbonData && (
              <>
                <TableHead className="w-[100px] text-right">CO₂e (kg)</TableHead>
                <TableHead className="w-[100px]">Scope</TableHead>
                <TableHead className="w-[100px]">Độ tin cậy</TableHead>
                <TableHead className="w-[160px]">Data Quality</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              <TableCell className="text-muted-foreground text-sm">
                {index + 1}
              </TableCell>
              <TableCell className="font-mono text-sm">{row.sku}</TableCell>
              <TableCell
                className="max-w-[200px] truncate"
                title={row.productName}
              >
                {row.productName}
              </TableCell>
              <TableCell className="text-right">
                {row.quantity.toLocaleString()}
              </TableCell>
              <TableCell>
                <span className="capitalize">
                  {row.primaryMaterial.replace('_', ' ')}
                </span>
                {row.primaryMaterialPercentage < 100 && (
                  <span className="text-muted-foreground text-xs ml-1">
                    ({row.primaryMaterialPercentage}%)
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {row.marketType === 'export'
                    ? row.exportCountry?.toUpperCase() || 'Xuất khẩu'
                    : 'Nội địa'}
                </Badge>
              </TableCell>
              {showCarbonData && (
                <>
                  <TableCell className="text-right font-medium">
                    <div className="flex items-center justify-end gap-1">
                      <Leaf className="w-3 h-3 text-primary" />
                      <span>{row.calculatedCO2?.toFixed(3)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {row.scope ? SCOPE_LABELS[row.scope] : '-'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.confidenceLevel && (
                      <Badge
                        className={`text-xs ${CONFIDENCE_COLORS[row.confidenceLevel]}`}
                      >
                        {CONFIDENCE_LABELS[row.confidenceLevel]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const q = getDataQuality(row);
                      const Icon =
                        q.level === 'audit_ready'
                          ? CheckCircle2
                          : q.level === 'cbam_risk'
                            ? ShieldAlert
                            : AlertCircle;
                      return (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className={`text-xs gap-1 cursor-help ${QUALITY_STYLE[q.level]}`}
                              >
                                <Icon className="w-3 h-3" />
                                {q.label}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-xs">
                              {q.reason}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })()}
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>

    <div className="border-t bg-muted/50 px-4 py-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Tổng cộng: <strong>{rows.length}</strong> sản phẩm
        </span>
        {showCarbonData && (
          <div className="flex items-center gap-4 flex-wrap">
            {(() => {
              const cbamRisk = rows.filter(
                (r) => getDataQuality(r).level === 'cbam_risk'
              ).length;
              return cbamRisk > 0 ? (
                <span className="text-destructive font-medium flex items-center gap-1">
                  <ShieldAlert className="w-4 h-4" />
                  {cbamRisk} SP thiếu Scope 3 · CBAM risk
                </span>
              ) : null;
            })()}
            <span className="text-muted-foreground">
              Tổng SL:{' '}
              <strong>
                {rows.reduce((sum, r) => sum + r.quantity, 0).toLocaleString()}
              </strong>
            </span>
            <span className="text-primary font-medium flex items-center gap-1">
              <Leaf className="w-4 h-4" />
              Tổng CO₂e:{' '}
              {rows
                .reduce(
                  (sum, r) => sum + (r.calculatedCO2 || 0) * r.quantity,
                  0
                )
                .toFixed(2)}{' '}
              kg
            </span>
          </div>
        )}
      </div>
    </div>
  </div>
);

export default PreviewTable;
