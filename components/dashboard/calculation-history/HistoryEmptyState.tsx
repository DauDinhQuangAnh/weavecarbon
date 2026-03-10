"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History, Package } from "lucide-react";

interface HistoryEmptyStateProps {
  onNavigateAssessment: () => void;
}

const HistoryEmptyState: React.FC<HistoryEmptyStateProps> = ({
  onNavigateAssessment
}) => {
  const t = useTranslations("calculationHistory");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("emptyStateTitle")}</CardTitle>
        <CardDescription>{t("emptyStateSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12">
          <History className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">{t("noHistoryMessage")}</h3>
          <p className="text-muted-foreground mb-4">
            {t("noHistoryDescription")}
          </p>
          <Button onClick={onNavigateAssessment}>
            <Package className="w-4 h-4 mr-2" />
            {t("noHistoryButton")}
          </Button>
        </div>
      </CardContent>
    </Card>);

};

export default HistoryEmptyState;