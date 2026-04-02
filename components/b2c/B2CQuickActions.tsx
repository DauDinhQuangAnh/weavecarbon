"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock3, ImagePlus, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";

interface B2CQuickActionsProps {
  onDonateClick: () => void;
  onLocationClick: () => void;
  onHistoryClick: () => void;
}

const B2CQuickActions: React.FC<B2CQuickActionsProps> = ({
  onDonateClick,
  onLocationClick,
  onHistoryClick
}) => {
  const t = useTranslations("b2c");

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card
        className="cursor-pointer transition-colors hover:border-primary/50"
        onClick={onDonateClick}
      >
        <CardContent className="p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <ImagePlus className="h-7 w-7 text-primary" />
          </div>
          <h3 className="mb-1 font-semibold">{t("quickActions.photoDonationTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("quickActions.photoDonationDescription")}
          </p>
        </CardContent>
      </Card>

      <Card
        className="cursor-pointer transition-colors hover:border-accent/50"
        onClick={onLocationClick}
      >
        <CardContent className="p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
            <MapPin className="h-7 w-7 text-accent" />
          </div>
          <h3 className="mb-1 font-semibold">{t("quickActions.collectionPointsTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("quickActions.collectionPointsDescription")}
          </p>
        </CardContent>
      </Card>

      <Card
        className="cursor-pointer transition-colors hover:border-foreground/20"
        onClick={onHistoryClick}
      >
        <CardContent className="p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-foreground/5">
            <Clock3 className="h-7 w-7 text-foreground" />
          </div>
          <h3 className="mb-1 font-semibold">{t("quickActions.historyTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("quickActions.historyDescription")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default B2CQuickActions;
