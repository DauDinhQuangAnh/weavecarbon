'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  ClipboardList,
  ExternalLink,
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
  const items = buildCompleteness(product);
  const completeCount = items.filter((i) => i.status === 'complete').length;
  const pct = Math.round((completeCount / items.length) * 100);

  return (
    <Card className="border-dashed border-yellow-300 bg-yellow-50/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5 text-yellow-600" />
            Kiểm tra độ đầy đủ dữ liệu
          </CardTitle>
          <span className="text-sm font-medium text-muted-foreground">
            {pct}% hoàn thành
          </span>
        </div>
        <Progress value={pct} className="h-1.5 mt-2" />
      </CardHeader>
      <CardContent className="space-y-2">
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
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.note && (
                    <p className="text-[11px] text-muted-foreground">{item.note}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`hidden text-xs md:inline ${cfg.color}`}>
                  {cfg.label}
                </span>
                {item.status !== 'complete' && item.jumpTo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => router.push(item.jumpTo!)}
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
            Nhấn "Bổ sung" để hoàn thiện dữ liệu cho kết quả carbon chính xác hơn
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default DataCompletenessCheck;
