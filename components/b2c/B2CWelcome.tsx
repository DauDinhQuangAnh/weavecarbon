"use client";

import React from "react";
import { UserProfile } from "@/hooks/useUserProfile";
import { useTranslations } from "next-intl";

interface B2CWelcomeProps {
  profile: UserProfile | null;
}

const B2CWelcome: React.FC<B2CWelcomeProps> = ({ profile }) => {
  const t = useTranslations("b2c.welcome");

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-xs sm:p-7">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Cá nhân tuần hoàn
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              WeaveCarbon Circular Network
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("greeting", { name: profile?.fullName || t("fallbackUser") })}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("subtitle") || "Theo dõi hành trình giảm phát thải, tích lũy điểm thưởng và quyên góp thời trang tuần hoàn."}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 min-w-[120px]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cấp độ
            </p>
            <p className="text-base font-bold text-foreground mt-0.5">
              {profile?.currentLevel || "Mầm xanh"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 min-w-[120px]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Đã quyên góp
            </p>
            <p className="text-base font-bold text-primary mt-0.5">
              {(profile?.totalItemsDonated || 0).toLocaleString("vi-VN")} món
            </p>
          </div>
        </div>
      </div>
    </section>
  );

};

export default B2CWelcome;
