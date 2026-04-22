"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Recycle } from "lucide-react";
import { Activity } from "@/hooks/useRecentActivity";
import { useTranslations } from "next-intl";

interface B2CRecentActivityProps {
  activities: Activity[];
}

const B2CRecentActivity: React.FC<B2CRecentActivityProps> = ({ activities }) => {
  const t = useTranslations("b2c");

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg tracking-tight">{t("recentActivity.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.length === 0 &&
          <div className="rounded-xl border border-dashed border-border bg-muted/35 p-5 text-sm text-muted-foreground">
            {t("recentActivity.empty")}
          </div>
        }
        {activities.map((activity) =>
        <div
          key={activity.id}
          className="group flex items-center gap-4 rounded-xl border border-transparent bg-muted/35 p-3 transition-all hover:border-border/80 hover:bg-card">
          
            <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ring-1 ${
            activity.type === "donate" ? "bg-primary/10 ring-primary/20" : "bg-green-100 ring-green-200"}`
            }>
            
              {activity.type === "donate" ?
            <Gift className="h-5 w-5 text-primary" /> :

            <Recycle className="h-5 w-5 text-green-600" />
            }
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{activity.item}</p>
              <p className="text-xs text-muted-foreground">{activity.date}</p>
            </div>
            <Badge variant="secondary" className="border border-amber-200 bg-amber-50 text-amber-700">
              +{activity.points} {t("pointsAbbrev")}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>);

};

export default B2CRecentActivity;
