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
      <div className="flex w-full items-center md:hidden">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <React.Fragment key={step.id}>
              <div
                className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center transition-colors ${
                isCompleted ?
                "bg-primary text-primary-foreground" :
                isActive ?
                "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background" :
                "bg-muted text-muted-foreground"}`
                }>
                <StepIcon className="w-4 h-4" />
              </div>
              {index < steps.length - 1 &&
              <div
                className={`mx-1 h-0.5 min-w-0 flex-1 ${
                isCompleted ? "bg-primary" : "bg-muted"}`
                } />

              }
            </React.Fragment>);
        })}
      </div>

      <div className="hidden w-full items-start md:flex">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          const showConnector = index < steps.length - 1;

          return (
            <React.Fragment key={step.id}>
              <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                  isCompleted ?
                  "bg-primary text-primary-foreground" :
                  isActive ?
                  "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background" :
                  "bg-muted text-muted-foreground"}`
                  }>
                  <StepIcon className="w-5 h-5" />
                </div>
                <span
                  className={`mt-2 max-w-24 text-sm leading-snug ${
                  isActive ?
                  "text-primary font-medium" :
                  "text-muted-foreground"}`
                  }>
                  {step.title}
                </span>
              </div>
              {showConnector &&
              <div
                aria-hidden="true"
                className="flex flex-1 items-start px-3 pt-5">
                <div
                  className={`h-0.5 w-full ${
                isCompleted ? "bg-primary" : "bg-muted"}`
                  } />
              </div>

              }
            </React.Fragment>);
        })}
      </div>
    </div>);

}
