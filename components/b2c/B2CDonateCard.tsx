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
    <Card className="border-none bg-linear-to-r from-primary/10 to-accent/10">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/80">
            <Gift className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="mb-1 text-lg font-semibold">{t("donate.title")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("donate.description")}
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground">
              <PackageCheck className="h-3.5 w-3.5" />
              {t("donate.photoRequiredNote")}
            </div>
          </div>
          <Button variant="hero" onClick={onStartDonate}>
            {t("donate.startButton")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default B2CDonateCard;
