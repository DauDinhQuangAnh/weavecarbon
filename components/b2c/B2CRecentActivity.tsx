"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Gift, Recycle } from "lucide-react";
import { Activity } from "@/hooks/useRecentActivity";
import { useTranslations } from "next-intl";

interface B2CRecentActivityProps {
  activities: Activity[];
}

const B2CRecentActivity: React.FC<B2CRecentActivityProps> = ({ activities }) => {
  const t = useTranslations("b2c");

  return (
    <Card className="border-border bg-card shadow-xs">
      <div className="border-b border-border bg-muted/20 px-5 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("recentActivity.title") || "Hoạt động gần đây"}
        </h3>
      </div>
      <CardContent className="p-5 space-y-3">
        {activities.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            {t("recentActivity.empty") || "Chưa có hoạt động nào được ghi nhận."}
          </div>
        ) : null}
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-center gap-3.5 rounded-lg border border-border bg-muted/20 p-3.5 transition-colors hover:bg-muted/40"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                activity.type === "donate"
                  ? "bg-primary/10 text-primary"
                  : "bg-emerald-500/10 text-emerald-600"
              }`}
            >
              {activity.type === "donate" ? (
                <Gift className="h-4.5 w-4.5" />
              ) : (
                <Recycle className="h-4.5 w-4.5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{activity.item}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{activity.date}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-amber-300/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-700">
              +{activity.points} {t("pointsAbbrev") || "pts"}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default B2CRecentActivity;
