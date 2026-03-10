"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle } from
"@/components/ui/card";
import { CheckCircle2, Globe2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransportScopeSelectorProps {
  value: "domestic" | "international";
  onChange: (value: "domestic" | "international") => void;
}

const TransportScopeSelector: React.FC<TransportScopeSelectorProps> = ({
  value,
  onChange
}) => {
  const t = useTranslations("transport");
  return (
    <Card className="border border-foreground/10 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle>{t("scopeTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => onChange("domestic")}
            aria-pressed={value === "domestic"}
            className={cn(
              "group relative w-full rounded-xl border px-4 py-4 text-left transition-all",
              "bg-muted/20 hover:bg-muted/40",
              value === "domestic" ?
              "border-primary bg-primary/10 shadow-md" :
              "border-border hover:border-primary/40"
            )}>

            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border",
                    value === "domestic" ?
                    "bg-primary text-primary-foreground border-primary/30" :
                    "bg-background text-muted-foreground border-border"
                  )}>

                  <MapPin className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">
                    {t("scopeDomestic")}
                  </p>
                </div>
              </div>
              {value === "domestic" &&
              <CheckCircle2 className="h-5 w-5 text-primary" />
              }
            </div>
          </button>

          <button
            type="button"
            onClick={() => onChange("international")}
            aria-pressed={value === "international"}
            className={cn(
              "group relative w-full rounded-xl border px-4 py-4 text-left transition-all",
              "bg-muted/20 hover:bg-muted/40",
              value === "international" ?
              "border-primary bg-primary/10 shadow-md" :
              "border-border hover:border-primary/40"
            )}>

            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border",
                    value === "international" ?
                    "bg-primary text-primary-foreground border-primary/30" :
                    "bg-background text-muted-foreground border-border"
                  )}>

                  <Globe2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">
                    {t("scopeInternational")}
                  </p>
                </div>
              </div>
              {value === "international" &&
              <CheckCircle2 className="h-5 w-5 text-primary" />
              }
            </div>
          </button>
        </div>
      </CardContent>
    </Card>);

};

export default TransportScopeSelector;
