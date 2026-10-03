'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  ClipboardList,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ProductRecord } from '@/lib/productsApi';

interface CompletenessItem {
  field: string;
  label: string;
  status: 'complete' | 'partial' | 'missing';
  note?: string;
  jumpTo?: string;
}

interface Props {
  product: ProductRecord;
}

const STATUS_CONFIG = {
  complete: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-50',
    label: 'Đầy đủ',
  },
  partial: {
    icon: AlertCircle,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    label: 'Một phần',
  },
  missing: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50',
    label: 'Thiếu',
  },
};

function buildCompleteness(product: ProductRecord): CompletenessItem[] {
  return [
    {
      field: 'productName',
      label: 'Tên sản phẩm',
      status: product.productName?.trim() ? 'complete' : 'missing',
      jumpTo: '/products',
    },
    {
      field: 'productCode',
      label: 'Mã SKU',
      status: product.productCode?.trim() ? 'complete' : 'missing',
      jumpTo: '/products',
    },
    {
      field: 'materials',
      label: 'Nguyên liệu',
      status:
        product.materials?.length > 0
          ? product.materials.some((m) => m.source === 'unknown')
            ? 'partial'
            : 'complete'
          : 'missing',
      note: product.materials?.some((m) => m.source === 'unknown')
        ? 'Một số nguyên liệu chưa rõ nguồn gốc'
        : undefined,
      jumpTo: '/assessment',
    },
    {
      field: 'energySources',
      label: 'Nguồn năng lượng',
      status: product.energySources?.length > 0 ? 'complete' : 'missing',
      jumpTo: '/assessment',
    },
    {
      field: 'productionProcesses',
      label: 'Quy trình sản xuất',
      status: product.productionProcesses?.length > 0 ? 'complete' : 'missing',
      jumpTo: '/assessment',
    },
    {
      field: 'manufacturingLocation',
      label: 'Địa điểm sản xuất',
      status: product.manufacturingLocation?.trim() ? 'complete' : 'missing',
      jumpTo: '/assessment',
    },
    {
      field: 'transportLegs',
      label: 'Vận chuyển (Scope 3)',
      status:
        product.transportLegs?.length > 0
          ? product.transportLegs.every((l) => l.co2Kg != null)
            ? 'complete'
            : 'partial'
          : 'missing',
      note:
        product.transportLegs?.length > 0 &&
        product.transportLegs.some((l) => l.co2Kg == null)
          ? 'Một số chặng chưa có CO₂e'
          : undefined,
      jumpTo: '/assessment',
    },
    {
      field: 'carbonResults',
      label: 'Kết quả carbon',
      status:
        product.carbonResults?.perProduct != null ? 'complete' : 'missing',
      note: !product.carbonResults ? 'Chưa chạy tính toán carbon' : undefined,
      jumpTo: '/assessment',
    },
  ];
}

const DataCompletenessCheck: React.FC<Props> = ({ product }) => {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const items = buildCompleteness(product);
  const completeCount = items.filter((i) => i.status === 'complete').length;
  const pct = Math.round((completeCount / items.length) * 100);

  return (
    <Card className="border-dashed border-yellow-300 bg-yellow-50/20 transition-all shadow-xs">
      <CardHeader
        className="cursor-pointer select-none py-3 px-4 transition-colors hover:bg-yellow-50/60"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <ClipboardList className="h-5 w-5 text-yellow-600 shrink-0" />
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-sm font-semibold text-slate-800 sm:text-base">
                Kiểm tra độ đầy đủ dữ liệu
              </CardTitle>
              <Badge
                variant="outline"
                className={`text-[11px] font-medium ${
                  pct === 100
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                {pct === 100 ? 'Đầy đủ 8/8 mục' : `${completeCount}/${items.length} mục đạt`}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-xs font-semibold text-slate-700 sm:text-sm">
              {pct}% hoàn thành
            </span>
            <div
              className="flex h-7 w-7 items-center justify-center rounded-md border border-yellow-200/80 bg-white/80 text-yellow-700 shadow-xs transition-transform duration-200 hover:bg-white"
              title={expanded ? "Thu gọn danh sách" : "Xem chi tiết 8 mục kiểm tra"}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </div>
        </div>
        <Progress value={pct} className="h-1.5 mt-2" />
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-2 pt-1 pb-4 px-4 border-t border-yellow-200/60 animate-in fade-in-50 duration-200">
          {items.map((item) => {
            const cfg = STATUS_CONFIG[item.status];
            const Icon = cfg.icon;
            return (
              <div
                key={item.field}
                className={`flex items-center justify-between rounded-lg p-2.5 md:p-3 ${cfg.bg}`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 shrink-0 md:h-5 md:w-5 ${cfg.color}`} />
                  <div>
                    <span className="text-sm font-medium text-slate-800">{item.label}</span>
                    {item.note && (
                      <p className="text-[11px] text-muted-foreground">{item.note}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-medium ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  {item.status !== 'complete' && item.jumpTo && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(item.jumpTo!);
                      }}
                    >
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Bổ sung
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {pct < 100 && (
            <p className="pt-1 text-center text-[11px] text-muted-foreground">
              Nhấn &quot;Bổ sung&quot; để hoàn thiện dữ liệu cho kết quả carbon chính xác hơn
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default DataCompletenessCheck;
