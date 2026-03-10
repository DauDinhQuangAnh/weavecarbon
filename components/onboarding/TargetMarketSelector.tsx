"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";
import { TARGET_MARKET_OPTIONS } from "@/lib/targetMarkets";

interface TargetMarketSelectorProps {
  selectedMarket: string;
  onSelect: (market: string) => void;
  defaultDomesticMarket: string;
  disabled?: boolean;
}

const TargetMarketSelector: React.FC<TargetMarketSelectorProps> = ({
  selectedMarket,
  onSelect,
  defaultDomesticMarket,
  disabled
}) => {
  const t = useTranslations("onboarding");
  const effectiveMarket = selectedMarket || defaultDomesticMarket;

  return (
    <div className="space-y-2">
      <Label>{t("domesticMarket")} ({t("domesticDefault")})</Label>
      <div className="flex flex-wrap gap-2">
        {TARGET_MARKET_OPTIONS.map((market) =>
        <button
          key={market.code}
          type="button"
          onClick={() => onSelect(market.code)}
          disabled={disabled}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
          effectiveMarket === market.code ?
          "bg-primary text-white" :
          "bg-muted text-muted-foreground hover:bg-muted/80"} ${
          disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
            {market.code}
          </button>
        )}
      </div>
    </div>);

};

export default TargetMarketSelector;
