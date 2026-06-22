'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';

export const trustLabel = (s: number) =>
  s <= 30 ? 'Không đủ tin cậy'
  : s <= 60 ? 'Cần kiểm tra'
  : s <= 80 ? 'Dùng cho Estimate'
  : 'Dữ liệu sơ cấp';

export const trustTone = (s: number) =>
  s <= 30 ? 'bg-rose-100 text-rose-800 border-rose-200'
  : s <= 60 ? 'bg-amber-100 text-amber-800 border-amber-200'
  : s <= 80 ? 'bg-sky-100 text-sky-800 border-sky-200'
  : 'bg-emerald-100 text-emerald-800 border-emerald-200';

export const EvidenceTrustBadge: React.FC<{ score: number }> = ({ score }) => (
  <Badge variant="outline" className={`font-mono ${trustTone(score)}`}>
    {score}/100 · {trustLabel(score)}
  </Badge>
);
