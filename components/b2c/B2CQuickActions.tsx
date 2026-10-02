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
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* 1. Quyên góp ảnh */}
      <Card
        className="group cursor-pointer border-border bg-card transition-all hover:border-primary/50 hover:shadow-xs"
        onClick={onDonateClick}
      >
        <CardContent className="p-5">
          <div className="mb-3.5 flex items-start justify-between gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ImagePlus className="h-5 w-5" />
            </div>
            <MoveRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
          </div>
          <h3 className="font-semibold text-foreground text-sm">{t("quickActions.photoDonationTitle") || "Quyên góp AI"}</h3>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {t("quickActions.photoDonationDescription") || "Chụp ảnh đồ cũ để nhận diện chất liệu và tích lũy điểm thưởng tức thì."}
          </p>
        </CardContent>
      </Card>

      {/* 2. Đổi mã ưu đãi */}
      <Card
        className="group cursor-pointer border-border bg-card transition-all hover:border-emerald-500/50 hover:shadow-xs"
        onClick={onCouponsClick}
      >
        <CardContent className="p-5">
          <div className="mb-3.5 flex items-start justify-between gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <TicketPercent className="h-5 w-5" />
            </div>
            <MoveRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-emerald-600" />
          </div>
          <h3 className="font-semibold text-foreground text-sm">{t("quickActions.couponsTitle") || "Đổi ưu đãi"}</h3>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {t("quickActions.couponsDescription") || "Sử dụng điểm tích lũy để đổi voucher thương hiệu đối tác bền vững."}
          </p>
        </CardContent>
      </Card>

      {/* 3. Điểm thu gom */}
      <Card
        className="group cursor-pointer border-border bg-card transition-all hover:border-amber-500/50 hover:shadow-xs"
        onClick={onLocationClick}
      >
        <CardContent className="p-5">
          <div className="mb-3.5 flex items-start justify-between gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <MapPin className="h-5 w-5" />
            </div>
            <MoveRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-amber-600" />
          </div>
          <h3 className="font-semibold text-foreground text-sm">{t("quickActions.collectionPointsTitle") || "Điểm thu gom"}</h3>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {t("quickActions.collectionPointsDescription") || "Tìm thùng gom đồ tuần hoàn và đối tác ký gửi gần vị trí của bạn."}
          </p>
        </CardContent>
      </Card>

      {/* 4. Lịch sử giao dịch */}
      <Card
        className="group cursor-pointer border-border bg-card transition-all hover:border-blue-500/50 hover:shadow-xs"
        onClick={onHistoryClick}
      >
        <CardContent className="p-5">
          <div className="mb-3.5 flex items-start justify-between gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <Clock3 className="h-5 w-5" />
            </div>
            <MoveRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-blue-600" />
          </div>
          <h3 className="font-semibold text-foreground text-sm">{t("quickActions.historyTitle") || "Lịch sử tuần hoàn"}</h3>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {t("quickActions.historyDescription") || "Xem lại các đợt quyên góp, dòng điểm thưởng và lượng CO2e đã tiết giảm."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default B2CQuickActions;
