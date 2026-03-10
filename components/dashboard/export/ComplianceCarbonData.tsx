"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Leaf,
  CheckCircle2,
  AlertCircle,
  Edit,
  Plus,
  Factory,
  Zap,
  Truck
} from "lucide-react";
import { CarbonDataItem, EmissionFactor } from "./types";

interface ComplianceCarbonDataProps {
  carbonData: CarbonDataItem[];
  emissionFactors: EmissionFactor[];
  onEditData: (scope: string) => void;
  onAddData: () => void;
}

const SCOPE_VISUAL_CONFIG: Record<
  CarbonDataItem["scope"],
  {
    icon: typeof Factory;
    color: string;
    bgColor: string;
  }
> = {
  scope1: {
    icon: Factory,
    color: "text-blue-600",
    bgColor: "bg-blue-100"
  },
  scope2: {
    icon: Zap,
    color: "text-purple-600",
    bgColor: "bg-purple-100"
  },
  scope3: {
    icon: Truck,
    color: "text-green-600",
    bgColor: "bg-green-100"
  }
};

const ComplianceCarbonData: React.FC<ComplianceCarbonDataProps> = ({
  carbonData,
  emissionFactors,
  onEditData
}) => {
  const t = useTranslations("export.carbonData");
  const completedScopes = carbonData.filter((d) => d.isComplete).length;
  const totalScopes = carbonData.length;
  const completionPercentage = (completedScopes / totalScopes) * 100;

  const totalEmission = carbonData
    .filter((d) => d.value !== null)
    .reduce((sum, d) => sum + (d.value || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Leaf className="w-5 h-5 text-primary" />
            {t("title")}
          </CardTitle>
          <Badge variant={completionPercentage === 100 ? "default" : "secondary"}>
            {t("complete", { completed: completedScopes, total: totalScopes })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{t("totalEmissions")}</span>
            <span className="text-2xl font-bold text-primary">
              {totalEmission.toFixed(1)}{" "}
              <span className="text-sm font-normal">{t("unitLabel", { unit: "kgCO2e" })}</span>
            </span>
          </div>
          <Progress value={completionPercentage} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {t("progress", { percent: completionPercentage.toFixed(0) })}
          </p>
        </div>

        <div className="space-y-3">
          {carbonData.map((data) => {
            const config = SCOPE_VISUAL_CONFIG[data.scope];
            const Icon = config.icon;

            return (
              <div
                key={data.scope}
                className={`p-4 rounded-lg border ${
                  data.isComplete ? "border-green-200 bg-green-50/50" : "border-yellow-200 bg-yellow-50/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${config.bgColor} shrink-0`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{t(data.scope)}</h4>
                      {data.isComplete ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{t(`${data.scope}Desc`)}</p>

                    {data.isComplete && data.value !== null ? (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">{t("value")} </span>
                          <span className="font-medium">
                            {data.value} {data.unit}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("methodology")} </span>
                          <span className="font-medium">{data.methodology}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("source")} </span>
                          <span className="font-medium">{data.dataSource}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t("period")} </span>
                          <span className="font-medium">{data.reportingPeriod}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-yellow-700">{t("noData")}</p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant={data.isComplete ? "outline" : "default"}
                    onClick={() => onEditData(data.scope)}
                  >
                    {data.isComplete ? (
                      <>
                        <Edit className="w-3 h-3 mr-1" />
                        {t("edit")}
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3 mr-1" />
                        {t("declare")}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t">
          <h4 className="text-sm font-semibold mb-3">{t("factorsInUse")}</h4>
          <div className="space-y-2">
            {emissionFactors.map((factor, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs p-2 rounded bg-muted/50"
              >
                <span className="font-medium">{factor.name}</span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{factor.source}</span>
                  <Badge variant="outline" className="text-xs">
                    {factor.version}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ComplianceCarbonData;
