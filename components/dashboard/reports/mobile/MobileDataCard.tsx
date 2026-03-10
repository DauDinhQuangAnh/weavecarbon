"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileDataCardProps {

  title: string;

  subtitle?: string;

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

  statusBadge?: React.ReactNode;

  meta?: React.ReactNode;

  actionsPlacement?: "header" | "footer";

  className?: string;

  showChevron?: boolean;
}

const MobileDataCard: React.FC<MobileDataCardProps> = ({
  title,
  subtitle,
  metrics,
  tags,
  icon,
  onClick,
  actions,
  statusBadge,
  meta,
  actionsPlacement = "header",
  className,
  showChevron = true
}) => {
  const t = useTranslations("reports");
  const showActionsInHeader = Boolean(
    actions && actionsPlacement === "header" && !(showChevron && onClick)
  );
  const showActionsInFooter = Boolean(actions && !showActionsInHeader);

  return (
    <Card
      className={cn(
        "border border-slate-300/80 bg-white shadow-sm transition-all hover:border-slate-400 hover:shadow-md",
        onClick && "cursor-pointer active:scale-[0.99]",
        className
      )}
      onClick={onClick}>

      <CardContent className="p-3">
        
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            {icon &&
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                {icon}
              </div>
            }
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-1 text-sm font-medium text-slate-900">{title}</h3>
              {subtitle &&
              <p className="truncate text-xs text-slate-600">
                  {subtitle}
                </p>
              }
            </div>
          </div>
          {(statusBadge || showActionsInHeader) &&
          <div className="ml-2 flex shrink-0 items-center gap-2">
              {statusBadge}
              {showActionsInHeader ? actions : null}
            </div>
          }
        </div>

        {meta &&
        <div className="mb-1 text-xs text-slate-600">
            {meta}
          </div>
        }

        
        {tags && tags.length > 0 &&
        <div className="mb-2 flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag, i) =>
          <Badge
            key={i}
            variant="outline"
            className="border-slate-200 bg-white text-xs text-slate-700">

                {tag}
              </Badge>
          )}
            {tags.length > 3 &&
          <Badge
            variant="outline"
            className="border-slate-200 bg-white text-xs text-slate-700">

                +{tags.length - 3}
              </Badge>
          }
          </div>
        }

        
        {metrics && metrics.length > 0 &&
        <div className="flex items-center gap-4 flex-wrap">
            {metrics.map((metric, i) =>
          <div key={i} className="flex items-baseline gap-1">
                <span className={cn("font-semibold text-sm", metric.className)}>
                  {metric.value}
                </span>
                {metric.unit &&
            <span className="text-xs text-slate-600">
                    {metric.unit}
                  </span>
            }
                {metric.label &&
            <span className="text-xs text-slate-600">
                    {metric.label}
                  </span>
            }
              </div>
          )}
          </div>
        }

        
        {((showChevron && onClick) || showActionsInFooter) &&
        <div
          className={cn(
            "mt-2 flex items-center pt-1",
            showChevron && onClick ? "justify-between" : "justify-end"
          )}>
            {showActionsInFooter &&
            <div className="flex items-center gap-1.5">{actions}</div>
            }
            {showChevron && onClick &&
          <Button variant="ghost" size="sm" className="h-7 px-2">
                <span className="mr-1 text-xs text-slate-600">{t("mobileCard.view")}</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
          }
          </div>
        }
      </CardContent>
    </Card>);

};

export default MobileDataCard;
