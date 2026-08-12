"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Award,
  Shirt,
  Recycle,
  TrendingUp,
  Car,
  Trees,
  Smartphone,
  Sprout,
  Leaf
} from "lucide-react";
import { UserProfile } from "@/hooks/useUserProfile";
import { useTranslations } from "next-intl";

interface B2CStatsGridProps {
  profile: UserProfile | null;
}

// Circularity tiers, driven by lifetime CO₂ saved (kg). Encourages repeat donations.
const CIRCULARITY_TIERS = [
  { key: "seed", name: "Hạt giống", min: 0, icon: Sprout },
  { key: "sprout", name: "Mầm xanh", min: 10, icon: Leaf },
  { key: "tree", name: "Cây trưởng thành", min: 50, icon: Trees },
  { key: "ambassador", name: "Đại sứ Tuần hoàn", min: 150, icon: Award }
];

const B2CStatsGrid: React.FC<B2CStatsGridProps> = ({ profile }) => {
  const t = useTranslations("b2c.stats");
  const stats = {
    circularPoints: profile?.circularPoints || 0,
    garmentsDonated: profile?.garmentsDonated || 0,
    co2Saved: profile?.co2Saved || 0,
    treesEquivalent: profile?.treesEquivalent || 0
  };

  const tierIndex = CIRCULARITY_TIERS.reduce(
    (acc, tier, index) => (stats.co2Saved >= tier.min ? index : acc),
    0
  );
  const currentTier = CIRCULARITY_TIERS[tierIndex];
  const nextTier = CIRCULARITY_TIERS[tierIndex + 1];
  const TierIcon = currentTier.icon;
  const tierProgress = nextTier
    ? Math.min(
        100,
        Math.round(((stats.co2Saved - currentTier.min) / (nextTier.min - currentTier.min)) * 100)
      )
    : 100;

  const statItems = [
    {
      key: "points",
      label: t("circularPoints"),
      value: stats.circularPoints,
      icon: Award,
      tone: "text-amber-600",
      ring: "ring-amber-200",
      bg: "bg-amber-50"
    },
    {
      key: "donated",
      label: t("donated"),
      value: stats.garmentsDonated,
      icon: Shirt,
      tone: "text-primary",
      ring: "ring-primary/25",
      bg: "bg-primary/8"
    },
    {
      key: "co2",
      label: t("co2Saved"),
      value: `${stats.co2Saved} kg`,
      icon: Recycle,
      tone: "text-emerald-600",
      ring: "ring-emerald-200",
      bg: "bg-emerald-50"
    },
    {
      key: "trees",
      label: t("treesEquivalent"),
      value: stats.treesEquivalent,
      icon: TrendingUp,
      tone: "text-accent",
      ring: "ring-accent/25",
      bg: "bg-accent/10"
    }
  ];

  // Real-world equivalences make the abstract kg CO₂e relatable (illustrative,
  // average factors): car ~0.17 kg CO₂e/km, tree ~21 kg/yr, phone charge ~8 g.
  const co2 = stats.co2Saved;
  const equivalences =
    co2 > 0
      ? [
          { icon: Car, value: Math.round(co2 / 0.17).toLocaleString("vi-VN"), label: "km không lái ô tô" },
          { icon: Trees, value: Math.round(co2 / (21 / 365)).toLocaleString("vi-VN"), label: "ngày một cây xanh hấp thụ" },
          { icon: Smartphone, value: Math.round(co2 / 0.008).toLocaleString("vi-VN"), label: "lần sạc điện thoại" }
        ]
      : [];

  return (
    <div className="space-y-4">
      <Card className="border-emerald-200 bg-emerald-50/60 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-100 p-2.5 ring-1 ring-emerald-200">
              <TierIcon className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Cấp độ tuần hoàn
              </p>
              <p className="text-lg font-bold text-foreground">{currentTier.name}</p>
            </div>
          </div>
          <Progress value={tierProgress} className="mt-3 h-2" />
          <p className="mt-2 text-xs text-muted-foreground">
            {nextTier
              ? `Còn ${Math.max(0, Math.ceil(nextTier.min - stats.co2Saved)).toLocaleString("vi-VN")} kg CO₂ để lên "${nextTier.name}".`
              : "Bạn đã đạt cấp cao nhất — Đại sứ Tuần hoàn."}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {statItems.map((item) => {
        const Icon = item.icon;

        return (
          <Card
            key={item.key}
            className="overflow-hidden border-border/80 bg-card/90 shadow-sm transition-shadow hover:shadow-md"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                    {item.value}
                  </p>
                </div>
                <div className={`rounded-2xl p-2.5 ring-1 ${item.bg} ${item.ring}`}>
                  <Icon className={`h-5 w-5 ${item.tone}`} />
                </div>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted/60">
                <div className="h-full rounded-full bg-linear-to-r from-primary to-accent" />
              </div>
            </CardContent>
          </Card>
        );
      })}
      </div>

      {equivalences.length > 0 ? (
        <Card className="border-border/80 bg-card/90 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {stats.co2Saved} kg CO₂ bạn tiết kiệm · tương đương
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {equivalences.map((eq, index) => {
                const EqIcon = eq.icon;
                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100"
                  >
                    <EqIcon className="h-5 w-5 shrink-0 text-emerald-600" />
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-foreground">{eq.value}</p>
                      <p className="text-xs text-muted-foreground">{eq.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Số quy đổi mang tính minh hoạ (hệ số TB: ô tô ~0,17 kg CO₂e/km · cây xanh ~21 kg/năm · sạc điện thoại ~8 g).
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );

};

export default B2CStatsGrid;
