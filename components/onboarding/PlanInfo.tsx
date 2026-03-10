import React from "react";
import { useTranslations } from "next-intl";

const PlanInfo = () => {
  const t = useTranslations("onboarding");

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-foreground">{t("trialPlanCardTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("starterPlanDesc")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("starterPlanBillingNote")}</p>
        </div>
        <span className="text-lg font-bold text-primary">{t("trialPlanPriceLabel")}</span>
      </div>
    </div>
  );
};

export default PlanInfo;
