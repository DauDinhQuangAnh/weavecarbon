import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  subtext?: string;
  trendPct?: number;
  /** Lower value is better (e.g. emissions) — inverts trend colouring. */
  invertTrend?: boolean;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit,
  subtext,
  trendPct,
  invertTrend = true,
  className,
}) => {
  const up = (trendPct ?? 0) >= 0;
  const good = invertTrend ? !up : up;

  return (
    <div className={cn('interactive-surface glass-panel rounded-2xl border border-white/70 bg-card/70 p-5 shadow-sm', className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-2xl font-semibold tabular-nums text-foreground">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {typeof trendPct === 'number' && (
        <div className={cn('mt-2 flex items-center gap-1 text-xs font-medium', good ? 'text-primary' : 'text-destructive')}>
          {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {up ? '+' : ''}{trendPct}% so với kỳ trước
        </div>
      )}
      {subtext && <p className="mt-2 text-xs text-muted-foreground">{subtext}</p>}
    </div>
  );
};

export default StatCard;
