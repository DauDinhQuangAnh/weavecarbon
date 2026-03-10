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
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{history.length}</p>
              <p className="text-sm text-slate-600">{t("totalRecords")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-emerald-200 bg-emerald-50/60 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border border-emerald-200 bg-emerald-100/70 rounded-lg flex items-center justify-center">
              <Leaf className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">{formatSummaryValue(totalMaterials)}</p>
              <p className="text-sm text-slate-600">
                {t("materialsLabel")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-sky-200 bg-sky-50/60 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border border-sky-200 bg-sky-100/70 rounded-lg flex items-center justify-center">
              <Factory className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-sky-700">{formatSummaryValue(totalManufacturing)}</p>
              <p className="text-sm text-slate-600">
                {t("manufacturingLabel")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-orange-200 bg-orange-50/60 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border border-orange-200 bg-orange-100/70 rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-700">{formatSummaryValue(totalTransport)}</p>
              <p className="text-sm text-slate-600">
                {t("transportLabel")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>);

};

export default HistorySummaryStats;
