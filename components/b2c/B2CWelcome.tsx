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
    <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-linear-to-br from-primary/10 via-card to-accent/5 p-6 shadow-sm sm:p-8">
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-accent/15 blur-2xl" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            Circular Member
          </p>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">
            {t("greeting", { name: profile?.fullName || t("fallbackUser") })} 👋
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/70 bg-card/85 p-3 shadow-sm backdrop-blur-sm sm:min-w-65">
          <div className="rounded-xl bg-muted/40 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Level
            </p>
            <p className="text-sm font-semibold text-foreground">
              {profile?.currentLevel || "Starter"}
            </p>
          </div>
          <div className="rounded-xl bg-muted/40 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Total Items
            </p>
            <p className="text-sm font-semibold text-foreground">
              {profile?.totalItemsDonated || 0}
            </p>
          </div>
        </div>
      </div>
    </section>
  );

};

export default B2CWelcome;
