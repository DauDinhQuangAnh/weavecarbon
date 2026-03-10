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
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("recentActivity.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.map((activity) =>
        <div
          key={activity.id}
          className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
          
            <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
            activity.type === "donate" ? "bg-primary/10" : "bg-green-100"}`
            }>
            
              {activity.type === "donate" ?
            <Gift className="w-5 h-5 text-primary" /> :

            <Recycle className="w-5 h-5 text-green-600" />
            }
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{activity.item}</p>
              <p className="text-xs text-muted-foreground">{activity.date}</p>
            </div>
            <Badge variant="secondary" className="text-yellow-600">
              +{activity.points} {t("pointsAbbrev")}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>);

};

export default B2CRecentActivity;
