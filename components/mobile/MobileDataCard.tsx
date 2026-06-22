'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileDataCardProps {
  title: string;
  subtitle?: string;
  status?: {
    label: string;
    className?: string;
  };
  metrics?: Array<{
    label?: string;
    value: string | number;
    unit?: string;
    className?: string;
  }>;
  tags?: string[];
  icon?: React.ReactNode;
  onClick?: () => void;
  actions?: React.ReactNode;
  className?: string;
  showChevron?: boolean;
}

const MobileDataCard: React.FC<MobileDataCardProps> = ({
  title,
  subtitle,
  status,
  metrics,
  tags,
  icon,
  onClick,
  actions,
  className,
  showChevron = true,
}) => {
  return (
    <Card
      className={cn(
        'hover:shadow-md transition-shadow',
        onClick && 'cursor-pointer active:scale-[0.99]',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Row 1: Title + Status */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {icon && (
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm line-clamp-2">{title}</h3>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {status && (
              <Badge className={cn('text-xs whitespace-nowrap', status.className)}>
                {status.label}
              </Badge>
            )}
          </div>
        </div>

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.slice(0, 3).map((tag, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Row 2: Key Metrics */}
        {metrics && metrics.length > 0 && (
          <div className="flex items-center gap-4 flex-wrap">
            {metrics.map((metric, i) => (
              <div key={i} className="flex items-baseline gap-1">
                <span className={cn('font-semibold text-sm', metric.className)}>
                  {metric.value}
                </span>
                {metric.unit && (
                  <span className="text-xs text-muted-foreground">{metric.unit}</span>
                )}
                {metric.label && (
                  <span className="text-xs text-muted-foreground">{metric.label}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Row 3: Actions */}
        {(actions || showChevron) && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <div className="flex items-center gap-2">
              {actions}
            </div>
            {showChevron && onClick && (
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <span className="text-xs text-muted-foreground mr-1">Xem</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MobileDataCard;
