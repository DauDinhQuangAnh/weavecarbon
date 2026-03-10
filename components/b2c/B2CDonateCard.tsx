"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift } from "lucide-react";
import { useTranslations } from "next-intl";

interface B2CDonateCardProps {
  onStartDonate: () => void;
}

const B2CDonateCard: React.FC<B2CDonateCardProps> = ({ onStartDonate }) => {
  const t = useTranslations("b2c");

  return (
    <Card className="bg-linear-to-r from-primary/10 to-accent/10 border-none">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/80 flex items-center justify-center">
            <Gift className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">{t("donate.title")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("donate.description")}
            </p>
          </div>
          <Button variant="hero" onClick={onStartDonate}>
            {t("donate.startButton")}
          </Button>
        </div>
      </CardContent>
    </Card>);

};

export default B2CDonateCard;
