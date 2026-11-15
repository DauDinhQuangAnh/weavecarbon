import React from 'react';
import { cn } from '@/lib/utils';

export type PillTone = 'neutral' | 'positive' | 'warning' | 'critical' | 'info';

const toneClass: Record<PillTone, string> = {
  neutral: 'bg-muted text-muted-foreground border-border',
  positive: 'bg-secondary text-primary border-primary/20',
  warning: 'bg-warning/10 text-warning border-warning/25',
  critical: 'bg-destructive/10 text-destructive border-destructive/25',
  info: 'bg-info/10 text-info border-info/25',
};

/** Maps common domain vocabulary to a restrained tone palette. */
export const toneFor = (value: string): PillTone => {
  const v = value.toLowerCase();
  if (['validated', 'ready', 'verified', 'complete', 'connected', 'primary', 'available', 'low'].some((k) => v.includes(k))) return 'positive';
  if (['review', 'medium', 'in validation', 'self-reported', 'draft', 'pending'].some((k) => v.includes(k))) return 'warning';
  if (['missing', 'high', 'offline', 'critical', 'overdue', 'failed', 'proxy'].some((k) => v.includes(k))) return 'critical';
  if (['evidence-backed', 'planned', 'info'].some((k) => v.includes(k))) return 'info';
  return 'neutral';
};

interface StatusPillProps {
  label: string;
  tone?: PillTone;
  className?: string;
}

const StatusPill: React.FC<StatusPillProps> = ({ label, tone, className }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
      toneClass[tone ?? toneFor(label)],
      className,
    )}
  >
    {label}
  </span>
);

export default StatusPill;
