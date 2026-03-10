"use client";

import React from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface B2CImagePreviewProps {
  imageData: string;
  onRetake: () => void;
  onContinue: () => void;
}

const B2CImagePreview: React.FC<B2CImagePreviewProps> = ({
  imageData,
  onRetake,
  onContinue
}) => {
  const t = useTranslations("b2c.imagePreview");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Image
          src={imageData}
          alt={t("alt")}
          width={640}
          height={640}
          unoptimized
          priority
          sizes="(max-width: 768px) 100vw, 640px"
          className="w-full max-w-md mx-auto rounded-lg" />
        
        <div className="flex gap-2 mt-4 justify-center">
          <Button variant="outline" onClick={onRetake}>
            {t("retake")}
          </Button>
          <Button variant="hero" onClick={onContinue}>
            {t("continue")}
          </Button>
        </div>
      </CardContent>
    </Card>);

};

export default B2CImagePreview;
