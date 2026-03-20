import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Leaf, Info, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { ProductCarbonDetail, CONFIDENCE_CONFIG } from "@/lib/carbonDetailData";

interface CarbonFootprintCardProps {
  carbonDetail: ProductCarbonDetail;
}

const CarbonFootprintCard: React.FC<CarbonFootprintCardProps> = ({
  carbonDetail,
}) => {
  const t = useTranslations("productDetail.carbonFootprint");
  const confidenceConfig = CONFIDENCE_CONFIG[carbonDetail.confidenceLevel];
  const confidenceLevelLabel =
    carbonDetail.confidenceLevel === "high"
      ? t("confidenceLevel.high")
      : carbonDetail.confidenceLevel === "medium"
        ? t("confidenceLevel.medium")
        : t("confidenceLevel.low");
  const hasRange = carbonDetail.co2eRange !== undefined;
  const isPreliminary = carbonDetail.isPreliminary;

  return (
    <Card
      className={`border shadow-sm ${
        isPreliminary
          ? "border-amber-200 bg-amber-50/20"
          : "border-slate-200 bg-white"
      }`}
    >
      <CardHeader className="border-b border-slate-200 bg-slate-50/70 px-4 pt-3 pb-2 sm:px-6 sm:pt-6 sm:pb-2">
        <CardTitle className="flex flex-col gap-2 text-lg sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-primary" />
            {t("title")}
          </div>
          {isPreliminary && (
            <Badge
              variant="outline"
              className="w-fit border-amber-200 bg-amber-50 text-amber-700"
            >
              <Clock className="mr-1 h-3 w-3" />
              {t("preliminary")}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="py-4 text-center">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-600">
            {isPreliminary ? t("preliminaryEstimate") : t("totalEmissions")}
          </div>
          <div
            className={`mb-1 text-4xl font-bold sm:text-5xl ${
              isPreliminary ? "text-amber-600" : "text-emerald-700"
            }`}
          >
            {carbonDetail.totalCo2e.toFixed(2)}
          </div>
          <div className="text-lg text-slate-600">{t("perProduct")}</div>

          {hasRange && carbonDetail.co2eRange && (
            <div className="mt-2 text-sm text-slate-600">
              <span className="font-medium">{t("estimatedRange")}</span>
              {carbonDetail.co2eRange.min.toFixed(1)} - {carbonDetail.co2eRange.max.toFixed(1)} {t("unitKgCo2e")}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium">{t("confidenceLabel")}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="flex max-w-full flex-wrap items-center gap-2 text-left sm:justify-end"
                  >
                    <Badge className={`${confidenceConfig.bg} ${confidenceConfig.color} max-w-full whitespace-normal text-left leading-relaxed`}>
                      {carbonDetail.confidenceLevel === "high" && (
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                      )}
                      {carbonDetail.confidenceLevel === "medium" && (
                        <Info className="mr-1 h-3 w-3" />
                      )}
                      {carbonDetail.confidenceLevel === "low" && (
                        <AlertTriangle className="mr-1 h-3 w-3" />
                      )}
                      {confidenceLevelLabel} ({carbonDetail.confidenceScore}%)
                    </Badge>
                    <Info className="h-4 w-4 cursor-help text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-sm">{carbonDetail.calculationNote}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <Progress value={carbonDetail.confidenceScore} className="h-2" />

          <p className="text-xs text-slate-600">
            {carbonDetail.confidenceLevel === "high" && t("highConfidence")}
            {carbonDetail.confidenceLevel === "medium" && t("mediumConfidence")}
            {carbonDetail.confidenceLevel === "low" && t("lowConfidence")}
          </p>
        </div>

        <div className="flex items-start gap-2 pt-2 text-xs text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("methodologyNote")}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default CarbonFootprintCard;
