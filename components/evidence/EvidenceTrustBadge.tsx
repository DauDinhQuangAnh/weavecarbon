'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export const trustLabel = (s: number) =>
  s <= 30
    ? 'Không đủ tin cậy'
    : s <= 60
      ? 'Cần kiểm tra'
      : s <= 80
        ? 'Có thể dùng cho Estimate/Pre-audit'
        : 'Có thể dùng làm dữ liệu sơ cấp nội bộ';

export const trustTone = (s: number) =>
  s <= 30
    ? 'bg-rose-100 text-rose-800 border-rose-200'
    : s <= 60
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : s <= 80
        ? 'bg-sky-100 text-sky-800 border-sky-200'
        : 'bg-emerald-100 text-emerald-800 border-emerald-200';

export const EvidenceTrustBadge: React.FC<{ score: number }> = ({ score }) => (
  <TooltipProvider delayDuration={150}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`font-mono ${trustTone(score)}`}>
          {score}/100 · {trustLabel(score)}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        Điểm tin cậy chứng từ phản ánh mức độ đầy đủ, nhất quán và khả năng đối
        chiếu nguồn của tài liệu. Đây không phải kết luận pháp lý về tính hợp lệ
        của hóa đơn.
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
