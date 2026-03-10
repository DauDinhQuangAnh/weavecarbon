"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle } from
"@/components/ui/card";
import { ArrowRight } from "lucide-react";
import BusinessTypeSelector from "./BusinessTypeSelector";
import TargetMarketSelector from "./TargetMarketSelector";
import PlanInfo from "./PlanInfo";
import { useTranslations } from "next-intl";

interface OnboardingFormProps {
  companyName: string;
  setCompanyName: (name: string) => void;
  businessType: string;
  setBusinessType: (type: string) => void;
  domesticMarket: string;
  setDomesticMarket: React.Dispatch<React.SetStateAction<string>>;
  defaultDomesticMarket: string;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

const OnboardingForm: React.FC<OnboardingFormProps> = ({
  companyName,
  setCompanyName,
  businessType,
  setBusinessType,
  domesticMarket,
  setDomesticMarket,
  defaultDomesticMarket,
  isSubmitting,
  onSubmit
}) => {
  const t = useTranslations("onboarding");

  return (
    <Card className="border-border/50 shadow-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("title")}</CardTitle>
        <CardDescription>
          {t("subtitle")}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          
          <div className="space-y-2">
            <Label htmlFor="company-name">{t("companyName")} *</Label>
            <Input
              id="company-name"
              type="text"
              placeholder={t("companyNamePlaceholder")}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={isSubmitting}
              required />
            
          </div>

          
          <BusinessTypeSelector
            value={businessType}
            onChange={setBusinessType}
            disabled={isSubmitting} />
          

          
          <TargetMarketSelector
            selectedMarket={domesticMarket}
            onSelect={setDomesticMarket}
            defaultDomesticMarket={defaultDomesticMarket}
            disabled={isSubmitting} />
          

          
          <PlanInfo />

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isSubmitting}>
            
            {isSubmitting ? t("creating") : t("continue")}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </form>
      </CardContent>
    </Card>);

};

export default OnboardingForm;
