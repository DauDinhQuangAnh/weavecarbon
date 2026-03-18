"use client";

import React from "react";

interface StepIndicatorsProps {
  currentStep: number;
  steps: Array<{
    id: number;
    title: string;
    icon: React.ComponentType<{className?: string;}>;
    key: string;
  }>;
}

export default function StepIndicators({
  currentStep,
  steps
}: StepIndicatorsProps) {
  return (
    <div className="mb-6 w-full">
      <div className="flex w-full items-center">
      {steps.map((step, index) => {
        const StepIcon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;

        return (
          <div key={step.id} className="flex min-w-0 flex-1 items-center">
            <div className="flex min-w-0 flex-1 flex-col items-center">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors md:h-10 md:w-10 ${
                isCompleted ?
                "bg-primary text-primary-foreground" :
                isActive ?
                "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background" :
                "bg-muted text-muted-foreground"}`
                }>
                
                <StepIcon className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <span
                className={`mt-2 hidden text-xs text-center md:block ${
                isActive ?
                "text-primary font-medium" :
                "text-muted-foreground"}`
                }>
                
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 &&
            <div
              className={`mx-1 h-0.5 flex-1 md:mx-2 ${
              isCompleted ? "bg-primary" : "bg-muted"}`
              } />

            }
          </div>);

      })}
      </div>
    </div>);

}