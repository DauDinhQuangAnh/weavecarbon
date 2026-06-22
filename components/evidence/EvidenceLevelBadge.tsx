'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const LEVELS: Record<number, { label: string; meaning: string; tone: string }> = {
  0: {
    label: 'L0 · Uploaded only',
    meaning: 'File đã tải lên, chưa xử lý.',
    tone: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  1: {
    label: 'L1 · OCR Parsed',
    meaning: 'AI/OCR đã trích xuất các trường cơ bản.',
    tone: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  2: {
    label: 'L2 · Format & Logic Checked',
    meaning: 'Đủ trường bắt buộc và kiểm tra logic nội bộ đạt yêu cầu.',
    tone: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  3: {
    label: 'L3 · Source Matched',
    meaning:
      'Đã đối chiếu với XML, mã tra cứu, chữ ký số, cổng phát hành hoặc xác nhận nhà cung cấp.',
    tone: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  4: {
    label: 'L4 · Cross-checked with Operations',
    meaning:
      'Chứng từ nhất quán với cơ sở, kỳ sản xuất, sản lượng, lô hoặc hồ sơ logistics.',
    tone: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  5: {
    label: 'L5 · Third-party Verified',
    meaning: 'Chứng từ và tính toán đã được kiểm toán/độc lập xác minh.',
    tone: 'bg-emerald-200 text-emerald-900 border-emerald-300',
  },
};

export const EvidenceLevelBadge: React.FC<{ level: number }> = ({ level }) => {
  const l = LEVELS[level] ?? LEVELS[0];
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={l.tone}>
            {l.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{l.meaning}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
