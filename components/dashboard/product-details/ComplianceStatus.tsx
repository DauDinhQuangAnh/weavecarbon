
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger } from
"@/components/ui/tooltip";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileDown,
  QrCode,
  ShieldCheck,
  Info } from
"lucide-react";
import { ComplianceItem } from "@/lib/carbonDetailData";

interface ComplianceStatusProps {
  compliance: ComplianceItem[];
  exportReady: boolean;
  onDownloadReport?: () => void;
  onGenerateQR?: () => void;
  downloadButtonLabel?: string;
  locked?: boolean;
  lockedTitle?: string;
  lockedDescription?: string;
}

const STATUS_ICON = {
  passed: CheckCircle2,
  partial: AlertCircle,
  failed: XCircle
};

const STATUS_COLOR = {
  passed: "text-green-600",
  partial: "text-yellow-600",
  failed: "text-red-600"
};

const ComplianceStatus: React.FC<ComplianceStatusProps> = ({
  compliance,
  exportReady,
  onDownloadReport,
  onGenerateQR,
  downloadButtonLabel,
  locked = false,
  lockedTitle,
  lockedDescription
}) => {
  const t = useTranslations("productDetail.compliance");
  const passedCount = compliance.filter((c) => c.status === "passed").length;
  const totalCount = compliance.length;
  const readinessPercent = totalCount > 0 ? Math.round(passedCount / totalCount * 100) : 0;
  const exportBadgeClass = exportReady ?
  "border border-emerald-200 bg-emerald-50 text-emerald-700" :
  "border border-amber-200 bg-amber-50 text-amber-700";

  if (locked) {
    return (
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-slate-50/70 px-4 py-3 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="w-5 h-5 text-primary" />
              {t("title")}
            </CardTitle>
            <Badge className="w-fit border border-amber-200 bg-amber-50 text-amber-700">
              <AlertCircle className="w-3 h-3 mr-1" />
              {t("needMoreData")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
            <p className="text-sm font-semibold text-amber-800">
              {lockedTitle || t("needMoreData")}
            </p>
            {lockedDescription && (
              <p className="mt-1 text-xs text-amber-700">{lockedDescription}</p>
            )}
          </div>
          <Button
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={onDownloadReport}>
            <FileDown className="w-4 h-4 mr-2" />
            {downloadButtonLabel || t("downloadReport")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-200 bg-slate-50/70 px-4 py-3 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {t("title")}
          </CardTitle>
          <Badge className={`${exportBadgeClass} w-fit`}>
            {exportReady ?
            <>
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {t("exportReady")}
              </> :

            <>
                <AlertCircle className="w-3 h-3 mr-1" />
                {t("needMoreData")}
              </>
            }
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        
        <div className="space-y-2">
          {compliance.map((item, index) => {
            const Icon = STATUS_ICON[item.status];
            const colorClass = STATUS_COLOR[item.status];

            return (
              <div
                key={index}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">

                <div className="flex min-w-0 items-start gap-3">
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${colorClass}`} />
                  <span className="min-w-0 text-sm font-medium leading-relaxed">{item.criterion}</span>
                </div>
                {item.note &&
                <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="self-end text-muted-foreground transition-colors hover:text-slate-700 sm:self-auto"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-sm">{item.note}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                }
              </div>);

          })}
        </div>

        
        <div className="py-2 text-center text-sm text-slate-600">
          {t("criteriaCount", { passed: passedCount, total: totalCount })}
          <p className="mt-1 text-xs text-slate-500">
            {t("completionRate", { percent: readinessPercent })}
          </p>
        </div>

        
        <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
          <Button
            variant="outline"
            className="w-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={onDownloadReport}>

            <FileDown className="w-4 h-4 mr-2" />
            {downloadButtonLabel || t("downloadReport")}
          </Button>
          <Button
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={onGenerateQR}>

            <QrCode className="w-4 h-4 mr-2" />
            {t("generateQR")}
          </Button>
        </div>

        {!exportReady &&
        <p className="text-xs text-center text-amber-700">
            {t("qrComplianceWarning")}
          </p>
        }
      </CardContent>
    </Card>);

};

export default ComplianceStatus;
