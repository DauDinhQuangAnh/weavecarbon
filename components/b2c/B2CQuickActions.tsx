"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";

interface B2CQuickActionsProps {
  onCameraClick: () => void;
  onLocationClick: () => void;
}

const B2CQuickActions: React.FC<B2CQuickActionsProps> = ({
  onCameraClick,
  onLocationClick
}) => {
  const t = useTranslations("b2c");

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card
        className="cursor-pointer hover:border-primary/50 transition-colors"
        onClick={onCameraClick}>
        
        <CardContent className="p-6 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
            <Camera className="w-7 h-7 text-primary" />
          </div>
          <h3 className="font-semibold mb-1">{t("quickActions.scanQrTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("quickActions.scanQrDescription")}</p>
        </CardContent>
      </Card>

      <Card
        className="cursor-pointer hover:border-accent/50 transition-colors"
        onClick={onLocationClick}>
        
        <CardContent className="p-6 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-accent/10 flex items-center justify-center">
            <MapPin className="w-7 h-7 text-accent" />
          </div>
          <h3 className="font-semibold mb-1">{t("quickActions.collectionPointsTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("quickActions.collectionPointsDescription")}</p>
        </CardContent>
      </Card>
    </div>);

};

export default B2CQuickActions;
