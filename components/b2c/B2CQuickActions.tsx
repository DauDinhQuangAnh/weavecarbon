"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock3, ImagePlus, MapPin, MoveRight, TicketPercent } from "lucide-react";
import { useTranslations } from "next-intl";

interface B2CQuickActionsProps {
  onDonateClick: () => void;
  onLocationClick: () => void;
  onHistoryClick: () => void;
  onCouponsClick: () => void;
}

const B2CQuickActions: React.FC<B2CQuickActionsProps> = ({
  onDonateClick,
  onLocationClick,
  onHistoryClick,
  onCouponsClick
}) => {
  const t = useTranslations("b2c");

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card
        className="group cursor-pointer border-primary/20 bg-linear-to-br from-card to-primary/5 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
        onClick={onDonateClick}
      >
        <CardContent className="p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 ring-1 ring-primary/20">
              <ImagePlus className="h-7 w-7 text-primary" />
            </div>
            <MoveRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
          <h3 className="mb-1 font-semibold text-foreground">{t("quickActions.photoDonationTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("quickActions.photoDonationDescription")}
          </p>
        </CardContent>
      </Card>

      <Card
        className="group cursor-pointer border-emerald-200/70 bg-linear-to-br from-card via-card to-emerald-50/70 transition-all hover:-translate-y-0.5 hover:border-emerald-400/70 hover:shadow-md"
        onClick={onCouponsClick}
      >
        <CardContent className="p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/12 ring-1 ring-emerald-500/20">
              <TicketPercent className="h-7 w-7 text-emerald-600" />
            </div>
            <MoveRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
          <h3 className="mb-1 font-semibold text-foreground">{t("quickActions.couponsTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("quickActions.couponsDescription")}
          </p>
        </CardContent>
      </Card>

      <Card
        className="group cursor-pointer border-accent/25 bg-linear-to-br from-card to-accent/8 transition-all hover:-translate-y-0.5 hover:border-accent/55 hover:shadow-md"
        onClick={onLocationClick}
      >
        <CardContent className="p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 ring-1 ring-accent/25">
              <MapPin className="h-7 w-7 text-accent" />
            </div>
            <MoveRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
          <h3 className="mb-1 font-semibold text-foreground">{t("quickActions.collectionPointsTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("quickActions.collectionPointsDescription")}
          </p>
        </CardContent>
      </Card>

      <Card
        className="group cursor-pointer border-foreground/15 bg-linear-to-br from-card to-muted/35 transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-md"
        onClick={onHistoryClick}
      >
        <CardContent className="p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground/6 ring-1 ring-foreground/10">
              <Clock3 className="h-7 w-7 text-foreground" />
            </div>
            <MoveRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
          <h3 className="mb-1 font-semibold text-foreground">{t("quickActions.historyTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("quickActions.historyDescription")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default B2CQuickActions;
