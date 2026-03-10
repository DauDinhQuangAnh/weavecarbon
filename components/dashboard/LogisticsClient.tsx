"use client";

import React, { useEffect } from "react";
import { useTranslations } from "next-intl";
import ShippingOverviewMap from "./logistic/ShippingOverviewMap";
import { useDashboardTitle } from "@/contexts/DashboardContext";

const LogisticsPage: React.FC = () => {
  const t = useTranslations("logistics");
  const { setPageTitle } = useDashboardTitle();

  useEffect(() => {
    setPageTitle(t("title"), t("subtitle"));
  }, [setPageTitle, t]);

  return (
    <div className="space-y-6">
      <ShippingOverviewMap />
    </div>);

};

export default LogisticsPage;