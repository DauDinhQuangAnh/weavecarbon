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
    <div className="flex items-center justify-between gap-1 md:gap-2 mb-8 overflow-x-auto pb-2">
      {steps.map((step, index) => {
        const StepIcon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;

        return (
          <div key={step.id} className="flex items-center shrink-0">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors ${
                isCompleted ?
                "bg-primary text-primary-foreground" :
                isActive ?
                "bg-primary/10 text-primary border-2 border-primary" :
                "bg-muted text-muted-foreground"}`
                }>
                
                <StepIcon className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <span
                className={`text-xs mt-1 md:mt-2 whitespace-nowrap text-center ${
                isActive ?
                "text-primary font-medium" :
                "text-muted-foreground"}`
                }>
                
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 &&
            <div
              className={`w-1 md:w-6 lg:w-24 h-0.5 mx-1 md:mx-2 shrink-0 ${
              isCompleted ? "bg-primary" : "bg-muted"}`
              } />

            }
          </div>);

      })}
    </div>);

}