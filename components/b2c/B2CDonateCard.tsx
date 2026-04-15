"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, PackageCheck } from "lucide-react";
import { useTranslations } from "next-intl";

interface B2CDonateCardProps {
  onStartDonate: () => void;
}

const B2CDonateCard: React.FC<B2CDonateCardProps> = ({ onStartDonate }) => {
  const t = useTranslations("b2c");

  return (
    <Card className="overflow-hidden border-primary/15 bg-linear-to-r from-primary/12 via-card to-accent/12 shadow-sm">
      <CardContent className="relative p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 right-20 h-28 w-28 rounded-full bg-accent/20 blur-2xl" />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card/90 ring-1 ring-border/70">
            <Gift className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="mb-1 text-xl font-semibold tracking-tight">{t("donate.title")}</h3>
            <p className="text-sm text-muted-foreground md:max-w-2xl">
              {t("donate.description")}
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-1 text-xs text-muted-foreground">
              <PackageCheck className="h-3.5 w-3.5" />
              {t("donate.photoRequiredNote")}
            </div>
          </div>
          <Button variant="hero" size="lg" onClick={onStartDonate}>
            {t("donate.startButton")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default B2CDonateCard;
