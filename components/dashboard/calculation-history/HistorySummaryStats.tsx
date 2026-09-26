"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Leaf, Factory, Truck } from "lucide-react";

interface HistorySummaryStatsProps {
  history: Array<{
    materialsCO2: number;
    manufacturingCO2: number;
    transportCO2: number;
  }>;
}

const HistorySummaryStats: React.FC<HistorySummaryStatsProps> = ({
  history
}) => {
  const t = useTranslations("calculationHistory");
  const totalMaterials = history.reduce((sum, h) => sum + h.materialsCO2, 0);
  const totalManufacturing = history.reduce(
    (sum, h) => sum + h.manufacturingCO2,
    0
  );
  const totalTransport = history.reduce((sum, h) => sum + h.transportCO2, 0);
  const formatSummaryValue = (value: number) => {
    if (value > 0 && value < 0.1) {
      return value.toFixed(2);
    }
    return value.toFixed(1);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card className="border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow-md hover:border-slate-300">
        <CardContent className="p-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-slate-700" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold tracking-tight text-slate-900">{history.length}</p>
              <p className="text-xs font-medium text-slate-600 truncate">{t("totalRecords")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 to-emerald-50/20 shadow-sm transition-all hover:shadow-md hover:border-emerald-300">
        <CardContent className="p-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 border border-emerald-200 bg-emerald-100/70 rounded-xl flex items-center justify-center shrink-0">
              <Leaf className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold tracking-tight text-emerald-700">{formatSummaryValue(totalMaterials)}</p>
              <p className="text-xs font-medium text-slate-600 truncate">
                {t("materialsLabel")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-sky-200/80 bg-gradient-to-br from-sky-50/70 to-sky-50/20 shadow-sm transition-all hover:shadow-md hover:border-sky-300">
        <CardContent className="p-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 border border-sky-200 bg-sky-100/70 rounded-xl flex items-center justify-center shrink-0">
              <Factory className="w-5 h-5 text-sky-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold tracking-tight text-sky-700">{formatSummaryValue(totalManufacturing)}</p>
              <p className="text-xs font-medium text-slate-600 truncate">
                {t("manufacturingLabel")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-amber-200/80 bg-gradient-to-br from-amber-50/70 to-amber-50/20 shadow-sm transition-all hover:shadow-md hover:border-amber-300">
        <CardContent className="p-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 border border-amber-200 bg-amber-100/70 rounded-xl flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold tracking-tight text-amber-700">{formatSummaryValue(totalTransport)}</p>
              <p className="text-xs font-medium text-slate-600 truncate">
                {t("transportLabel")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>);

};

export default HistorySummaryStats;
