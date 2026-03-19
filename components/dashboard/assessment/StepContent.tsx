"use client";

import React from "react";
import Step1Content from "./steps/Step1Content";
import Step2Content from "./steps/Step2Content";
import Step3Content from "./steps/Step3Content";
import Step4Content from "./steps/Step4Content";
import Step5Content from "./steps/Step5Content";
import Step6Content from "./steps/Step6Content";
import {
  DraftVersion,
  MarketComplianceDocumentSummary,
  ProductAssessmentData
} from "./steps/types";

interface StepContentProps {
  currentStep: number;
  data: ProductAssessmentData;
  onChange: (updates: Partial<ProductAssessmentData>) => void;
  isEditing?: boolean;
  isStarterPlan?: boolean;
  isTrialPlan?: boolean;
  companyDomesticMarket?: string | null;
  starterDomesticMarket?: string | null;
  availableCertificationDocumentCodes?: string[];
  isCertificationAvailabilityLoading?: boolean;
  complianceDocumentsByMarketCode?: Record<string, MarketComplianceDocumentSummary>;
  draftHistory: DraftVersion[];
  onSaveDraft: () => void;
  onPublish: () => void;
  isSubmitting?: boolean;
  submissionMode?: "draft" | "publish" | null;
}

export default function StepContent({
  currentStep,
  data,
  onChange,
  isEditing,
  isStarterPlan,
  isTrialPlan,
  companyDomesticMarket,
  starterDomesticMarket,
  availableCertificationDocumentCodes = [],
  isCertificationAvailabilityLoading = false,
  complianceDocumentsByMarketCode = {},
  draftHistory,
  onSaveDraft,
  onPublish,
  isSubmitting,
  submissionMode
}: StepContentProps) {
  switch (currentStep) {
    case 1:
      return (
        <Step1Content
          data={data}
          onChange={onChange} />);


    case 2:
      return (
        <Step2Content
          data={data}
          starterPlanOnlyDomestic={Boolean(isStarterPlan)}
          availableCertificationDocumentCodes={
            availableCertificationDocumentCodes
          }
          isCertificationAvailabilityLoading={isCertificationAvailabilityLoading}
          onChange={onChange} />);


    case 3:
      return (
        <Step3Content
          data={data}
          onChange={onChange} />);


    case 4:
      return (
        <Step4Content
          data={data}
          companyDomesticMarket={companyDomesticMarket}
          starterDomesticMarket={starterDomesticMarket}
          isTrialPlan={isTrialPlan}
          isComplianceDocumentsLoading={isCertificationAvailabilityLoading}
          complianceDocumentsByMarketCode={complianceDocumentsByMarketCode}
          onChange={onChange} />);


    case 5:
      return (
        <Step5Content
          data={data}
          companyDomesticMarket={companyDomesticMarket}
          onChange={onChange} />);


    case 6:
      return (
        <Step6Content
          data={data}
          isEditing={isEditing}
          draftHistory={draftHistory}
          onSaveDraft={onSaveDraft}
          onPublish={onPublish}
          isSubmitting={isSubmitting}
          submissionMode={submissionMode} />);


    default:
      return null;
  }
}
