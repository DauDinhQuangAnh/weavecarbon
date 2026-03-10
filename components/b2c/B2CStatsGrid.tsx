"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Award, Shirt, Recycle, TrendingUp } from "lucide-react";
import { UserProfile } from "@/hooks/useUserProfile";
import { useTranslations } from "next-intl";

interface B2CStatsGridProps {
  profile: UserProfile | null;
}

const B2CStatsGrid: React.FC<B2CStatsGridProps> = ({ profile }) => {
  const t = useTranslations("b2c.stats");
  const stats = {
    circularPoints: profile?.circularPoints || 0,
    garmentsDonated: profile?.garmentsDonated || 0,
    co2Saved: profile?.co2Saved || 0,
    treesEquivalent: profile?.treesEquivalent || 0
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
      <Card>
        <CardContent className="p-4 text-center">
          <Award className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
          <p className="text-2xl font-bold">{stats.circularPoints}</p>
          <p className="text-xs text-muted-foreground">{t("circularPoints")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-center">
          <Shirt className="w-6 h-6 mx-auto mb-2 text-primary" />
          <p className="text-2xl font-bold">{stats.garmentsDonated}</p>
          <p className="text-xs text-muted-foreground">{t("donated")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-center">
          <Recycle className="w-6 h-6 mx-auto mb-2 text-green-500" />
          <p className="text-2xl font-bold">{stats.co2Saved} kg</p>
          <p className="text-xs text-muted-foreground">{t("co2Saved")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-center">
          <TrendingUp className="w-6 h-6 mx-auto mb-2 text-accent" />
          <p className="text-2xl font-bold">{stats.treesEquivalent}</p>
          <p className="text-xs text-muted-foreground">{t("treesEquivalent")}</p>
        </CardContent>
      </Card>
    </div>);

};

export default B2CStatsGrid;
