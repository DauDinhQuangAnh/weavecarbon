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
    <Card className="border-border bg-card shadow-xs">
      <CardContent className="p-6 sm:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Gift className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold tracking-tight text-foreground">{t("donate.title") || "Quyên góp thời trang tuần hoàn"}</h3>
              <p className="text-sm text-muted-foreground max-w-2xl">
                {t("donate.description") || "Đóng góp quần áo cũ, nhận phân tích AI về chất liệu và tích lũy điểm thưởng xanh để đổi quà."}
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground font-medium">
                  <PackageCheck className="h-3.5 w-3.5 text-primary" />
                  {t("donate.photoRequiredNote") || "Hỗ trợ chụp ảnh trực tiếp và quét mã nhận diện AI"}
                </span>
              </div>
            </div>
          </div>

          <Button
            size="lg"
            onClick={onStartDonate}
            className="shrink-0 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-xs"
          >
            {t("donate.startButton") || "Bắt đầu quyên góp"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default B2CDonateCard;
