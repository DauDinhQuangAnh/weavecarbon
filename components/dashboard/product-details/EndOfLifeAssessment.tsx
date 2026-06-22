'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Recycle,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
  Clock,
  AlertCircle,
} from 'lucide-react';
import type { ProductRecord } from '@/lib/productsApi';

interface Props {
  product: ProductRecord;
}

type EolStrategy = 'no_takeback' | 'selective' | 'data_based' | 'not_set';

interface EolData {
  strategy: EolStrategy;
  strategyLabel: string;
  breakdown: { reuse: number; recycle: number; disposal: number };
  avoidedEmissions: number;
  netImpact: number;
  hasData: boolean;
}

const STRATEGY_CONFIG: Record<
  EolStrategy,
  { color: string; icon: React.ElementType }
> = {
  no_takeback: { color: 'bg-red-100 text-red-700', icon: Trash2 },
  selective: { color: 'bg-yellow-100 text-yellow-700', icon: RefreshCw },
  data_based: { color: 'bg-green-100 text-green-700', icon: Recycle },
  not_set: { color: 'bg-gray-100 text-gray-600', icon: Clock },
};

function deriveEol(product: ProductRecord): EolData {
  const totalCO2 = product.carbonResults?.perProduct?.total ?? 0;
  const wr = product.wasteRecovery;

  const configs: Record<
    string,
    {
      strategy: EolStrategy;
      label: string;
      breakdown: { reuse: number; recycle: number; disposal: number };
      avoidedRate: number;
    }
  > = {
    none: {
      strategy: 'no_takeback',
      label: 'Không thu hồi',
      breakdown: { reuse: 0, recycle: 0, disposal: 100 },
      avoidedRate: 0,
    },
    partial: {
      strategy: 'selective',
      label: 'Thu hồi có chọn lọc',
      breakdown: { reuse: 10, recycle: 30, disposal: 60 },
      avoidedRate: 0.05,
    },
    full: {
      strategy: 'data_based',
      label: 'Thu hồi đầy đủ',
      breakdown: { reuse: 20, recycle: 70, disposal: 10 },
      avoidedRate: 0.15,
    },
    circular: {
      strategy: 'data_based',
      label: 'Kinh tế tuần hoàn',
      breakdown: { reuse: 40, recycle: 50, disposal: 10 },
      avoidedRate: 0.3,
    },
  };

  const cfg = wr && wr !== '' ? configs[wr] : undefined;

  if (!cfg) {
    return {
      strategy: 'not_set',
      strategyLabel: 'Chưa thiết lập',
      breakdown: { reuse: 0, recycle: 0, disposal: 100 },
      avoidedEmissions: 0,
      netImpact: 0,
      hasData: false,
    };
  }

  const avoidedEmissions = totalCO2 * cfg.avoidedRate;
  return {
    strategy: cfg.strategy,
    strategyLabel: cfg.label,
    breakdown: cfg.breakdown,
    avoidedEmissions,
    netImpact: totalCO2 - avoidedEmissions,
    hasData: true,
  };
}

const EndOfLifeAssessment: React.FC<Props> = ({ product }) => {
  const eol = deriveEol(product);
  const stratCfg = STRATEGY_CONFIG[eol.strategy];
  const StratIcon = stratCfg.icon;

  const breakdownItems = [
    { label: 'Tái sử dụng (Reuse)', value: eol.breakdown.reuse, bar: 'bg-green-500' },
    { label: 'Tái chế (Recycle)', value: eol.breakdown.recycle, bar: 'bg-blue-500' },
    { label: 'Thải bỏ (Disposal)', value: eol.breakdown.disposal, bar: 'bg-gray-400' },
  ];

  return (
    <Card className={!eol.hasData ? 'border-dashed border-yellow-300' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Recycle className="h-5 w-5 text-primary" />
            Đánh giá cuối vòng đời
          </CardTitle>
          {!eol.hasData && (
            <Badge variant="outline" className="border-yellow-400 text-yellow-600">
              <AlertCircle className="mr-1 h-3 w-3" />
              Cần bổ sung
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!eol.hasData && (
          <div className="flex items-start gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Chưa thiết lập chiến lược cuối vòng đời</p>
              <p className="mt-0.5 text-xs">
                Chọn chiến lược thu hồi trong Step 3 để hoàn thiện đánh giá carbon footprint.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Chiến lược End-of-life:</span>
          <Badge className={stratCfg.color}>
            <StratIcon className="mr-1 h-3 w-3" />
            {eol.strategyLabel}
          </Badge>
        </div>

        {eol.hasData && (
          <>
            <div className="space-y-3">
              <p className="text-sm font-medium">Phân bổ dự kiến:</p>
              {breakdownItems.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium">{item.value}%</span>
                  </div>
                  <Progress value={item.value} className="h-1.5" />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 border-t pt-4">
              <div className="rounded-lg bg-green-50 p-3 text-center">
                <div className="mb-1 flex items-center justify-center gap-1 text-green-700">
                  <TrendingDown className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Avoided</span>
                </div>
                <p className="text-base font-bold text-green-700 md:text-lg">
                  {eol.avoidedEmissions.toFixed(2)}
                  <span className="ml-0.5 text-[10px] font-normal">kg CO₂e</span>
                </p>
              </div>
              <div
                className={`rounded-lg p-3 text-center ${
                  eol.netImpact >= (product.carbonResults?.perProduct?.total ?? 0)
                    ? 'bg-red-50'
                    : 'bg-green-50'
                }`}
              >
                <div
                  className={`mb-1 flex items-center justify-center gap-1 ${
                    eol.netImpact >= (product.carbonResults?.perProduct?.total ?? 0)
                      ? 'text-red-700'
                      : 'text-green-700'
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Net impact</span>
                </div>
                <p
                  className={`text-base font-bold md:text-lg ${
                    eol.netImpact >= (product.carbonResults?.perProduct?.total ?? 0)
                      ? 'text-red-700'
                      : 'text-green-700'
                  }`}
                >
                  {eol.netImpact.toFixed(2)}
                  <span className="ml-0.5 text-[10px] font-normal">kg CO₂e</span>
                </p>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground">
              Ước tính dựa trên chiến lược thu hồi. Tỷ lệ thực tế phụ thuộc vào cơ sở hạ tầng địa
              phương và hành vi người dùng.
            </p>
          </>
        )}

        {!eol.hasData && (
          <div className="py-4 text-center text-muted-foreground">
            <Clock className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">Đang chờ chiến lược End-of-life…</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EndOfLifeAssessment;
