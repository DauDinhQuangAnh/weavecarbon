import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocale, useTranslations } from "next-intl";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clock,
} from "lucide-react";
import { CarbonBreakdownItem } from "@/lib/carbonDetailData";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface CarbonBreakdownChartProps {
  breakdown: CarbonBreakdownItem[];
  quantity?: number;
}

interface CarbonTooltipPayload {
  payload: {
    name: string;
    value: number;
    co2e: number;
  };
}

interface CarbonTooltipProps {
  active?: boolean;
  payload?: CarbonTooltipPayload[];
}

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#64748b"];

const CarbonBreakdownChart: React.FC<CarbonBreakdownChartProps> = ({
  breakdown,
  quantity = 1,
}) => {
  const t = useTranslations("productDetail.carbonBreakdown");
  const locale = useLocale();
  const displayLocale = locale === "vi" ? "vi-VN" : "en-US";
  const quantityForBatch = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const batchUnitLabel = t("batchUnit");

  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const kgFormatter = new Intl.NumberFormat(displayLocale, {
    maximumFractionDigits: 3,
  });

  const formatKgValue = (value: number | null | undefined) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      return kgFormatter.format(0);
    }
    return kgFormatter.format(value);
  };

  const chartData = breakdown
    .filter((item) => item.hasData && item.percentage !== null)
    .map((item, index) => ({
      name: item.label,
      value: item.percentage || 0,
      co2e: (item.co2e || 0) * quantityForBatch,
      fill: COLORS[index % COLORS.length],
    }));

  const hasAwaitingData = breakdown.some((item) => !item.hasData);

  const CustomTooltip = ({ active, payload }: CarbonTooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="font-medium text-slate-800">{data.name}</p>
          <p className="text-sm text-slate-600">
            {data.value}% ({formatKgValue(data.co2e)} {batchUnitLabel} CO2e)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-primary" />
            {t("title")}
          </CardTitle>
          {hasAwaitingData && (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
              <Clock className="mr-1 h-3 w-3" />
              {t("awaitingData")}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-70">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => <span className="text-sm">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Clock className="mx-auto mb-2 h-12 w-12 opacity-50" />
                  <p>{t("waitingForData")}</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 lg:pt-3">
            {breakdown.map((item, index) => (
              <Collapsible
                key={item.stage}
                open={expandedStage === item.stage}
                onOpenChange={() => setExpandedStage(expandedStage === item.stage ? null : item.stage)}
              >
                <CollapsibleTrigger asChild>
                  <div
                    className={`flex cursor-pointer items-center justify-between rounded-lg p-3 transition-colors ${
                      item.hasData
                        ? "border border-slate-200 bg-slate-50/60 hover:bg-slate-50"
                        : "border border-dashed border-amber-200 bg-amber-50/60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-3 w-3 rounded-full ${!item.hasData ? "bg-gray-300" : ""}`}
                        style={{
                          backgroundColor: item.hasData ? COLORS[index % COLORS.length] : undefined,
                        }}
                      />

                      <span className={`font-medium ${!item.hasData ? "text-muted-foreground" : ""}`}>
                        {item.label}
                      </span>

                      {!item.hasData && (
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-xs text-amber-700"
                        >
                          <Clock className="mr-1 h-3 w-3" />
                          {t("awaitingDataBadge")}
                        </Badge>
                      )}

                      {item.hasData && item.isProxy && (
                        <Badge
                          variant="outline"
                          className="border-slate-200 bg-white text-xs text-slate-700"
                        >
                          <AlertCircle className="mr-1 h-3 w-3" />
                          {t("proxyBadge")}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {item.hasData ? (
                        <div className="text-right">
                          <span className="font-bold">{item.percentage}%</span>
                          <span className="ml-2 text-sm text-slate-600">
                            ({formatKgValue((item.co2e || 0) * quantityForBatch)} {batchUnitLabel})
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-amber-700">-</span>
                      )}

                      {expandedStage === item.stage ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div
                    className={`-mt-1 rounded-b-lg px-3 py-2 text-sm ${
                      item.hasData ? "bg-slate-50 text-slate-600" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    <p className="flex items-center gap-2">
                      <span className="font-medium">{t("note")}</span>
                      {item.note}
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CarbonBreakdownChart;

