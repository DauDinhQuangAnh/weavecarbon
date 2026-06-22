'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';

const LEVELS: Record<number, { label: string; tone: string }> = {
  0: { label: 'L0 · Uploaded', tone: 'bg-slate-100 text-slate-700 border-slate-200' },
  1: { label: 'L1 · OCR Parsed', tone: 'bg-slate-100 text-slate-700 border-slate-200' },
  2: { label: 'L2 · Logic Checked', tone: 'bg-sky-100 text-sky-800 border-sky-200' },
  3: { label: 'L3 · Source Matched', tone: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  4: { label: 'L4 · Cross-checked', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  5: { label: 'L5 · 3rd-party Verified', tone: 'bg-emerald-200 text-emerald-900 border-emerald-300' },
};

export const EvidenceLevelBadge: React.FC<{ level: number }> = ({ level }) => {
  const l = LEVELS[level] ?? LEVELS[0];
  return (
    <Badge variant="outline" className={l.tone}>
      {l.label}
    </Badge>
  );
};
