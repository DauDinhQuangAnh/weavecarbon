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
      {/* Tier Progress Banner - B2B Executive Format */}
      <Card className="border-border bg-card shadow-xs">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <TierIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Phân hạng tuần hoàn cá nhân
                </p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <h3 className="text-lg font-bold text-foreground">{currentTier.name}</h3>
                  <span className="text-xs font-medium text-primary">
                    ({stats.co2Saved.toLocaleString("vi-VN")} kg CO₂e đã giảm)
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full sm:w-64 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Tiến trình hạng tiếp theo</span>
                <span className="font-semibold text-foreground">{tierProgress}%</span>
              </div>
              <Progress value={tierProgress} className="h-2" />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {nextTier
              ? `Cần tiết giảm thêm ${Math.max(0, Math.ceil(nextTier.min - stats.co2Saved)).toLocaleString("vi-VN")} kg CO₂e để đạt danh hiệu "${nextTier.name}".`
              : "Bạn đã đạt thứ hạng cao nhất trong mạng lưới cá nhân tuần hoàn WeaveCarbon."}
          </p>
        </CardContent>
      </Card>

      {/* 4 Stat Cards - Formatted like B2B Overview KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statItems.map((item) => {
          const Icon = item.icon;

          return (
            <Card
              key={item.key}
              className="border-border bg-card shadow-xs transition-colors hover:border-primary/40"
            >
              <div className="border-b border-border bg-muted/20 px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {item.label}
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <CardContent className="p-4 pt-3">
                <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {typeof item.value === "number" ? item.value.toLocaleString("vi-VN") : item.value}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>Cập nhật theo thời gian thực</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Equivalences - Executive Impact Section */}
      {equivalences.length > 0 ? (
        <Card className="border-border bg-card shadow-xs">
          <div className="border-b border-border bg-muted/20 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quy đổi tác động môi trường thực tế ({stats.co2Saved} kg CO₂e)
            </span>
          </div>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {equivalences.map((eq, index) => {
                const EqIcon = eq.icon;
                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <EqIcon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-bold text-foreground">{eq.value}</p>
                      <p className="text-xs text-muted-foreground truncate">{eq.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
              Số quy đổi mang tính minh hoạ (hệ số TB: ô tô ~0,17 kg CO₂e/km · cây xanh ~21 kg/năm · sạc điện thoại ~8 g).
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );

};

export default B2CStatsGrid;
