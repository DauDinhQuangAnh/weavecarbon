"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle } from
"@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  LabelList,
  XAxis,
  YAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip } from
"recharts";
import { useLocale, useTranslations } from "next-intl";

export interface TrendDataPoint {
  month: string;
  emissions: number;
  target: number;
}

export interface EmissionBreakdownPoint {
  name: string;
  value: number;
  color: string;
}

interface OverviewChartsProps {
  carbonTrendData?: TrendDataPoint[];
  emissionBreakdown?: EmissionBreakdownPoint[];
  isLoading?: boolean;
  onOpenTargetSetup?: () => void;
  canConfigureTarget?: boolean;
}

export default function OverviewCharts({
  carbonTrendData = [],
  emissionBreakdown = [],
  isLoading = false,
  onOpenTargetSetup,
  canConfigureTarget = false
}: OverviewChartsProps) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => {
      mediaQuery.removeEventListener("change", sync);
    };
  }, []);

  const hasTrendData = carbonTrendData.length > 0;
  const hasBreakdownData = emissionBreakdown.length > 0;

  const formatDeltaKg = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return "0";
    if (value < 0.01) return "<0.01";
    if (value < 1) return value.toFixed(2);
    if (value < 10) return value.toFixed(1);
    return value.toFixed(0);
  };

  const getLabel = (label: string) => {
    if (!label.includes(".")) return label;
    try {
      return t(label);
    } catch {
      return label;
    }
  };

  const lastPointIndex = carbonTrendData.length - 1;

  const latestTrendPoint =
  hasTrendData ? carbonTrendData[carbonTrendData.length - 1] : null;
  const latestDelta =
  latestTrendPoint ? latestTrendPoint.emissions - latestTrendPoint.target : 0;
  const latestDeltaAbs = Math.abs(latestDelta);
  const hasLatestDelta = latestDeltaAbs > 0;
  const latestDeltaPct =
  latestTrendPoint && latestTrendPoint.target > 0 ?
  latestDeltaAbs / latestTrendPoint.target * 100 :
  0;
  const isAboveTarget = latestDelta > 0;
  const latestInsightText =
  locale === "vi" ?
  isAboveTarget ?
  `Kỳ gần nhất cao hơn mục tiêu ${formatDeltaKg(latestDeltaAbs)} kg CO2e (${latestDeltaPct.toFixed(1)}%).` :
  `Kỳ gần nhất thấp hơn mục tiêu ${formatDeltaKg(latestDeltaAbs)} kg CO2e (${latestDeltaPct.toFixed(1)}%).` :
  isAboveTarget ?
  `Latest period is ${formatDeltaKg(latestDeltaAbs)} kg CO2e (${latestDeltaPct.toFixed(1)}%) above target.` :
  `Latest period is ${formatDeltaKg(latestDeltaAbs)} kg CO2e (${latestDeltaPct.toFixed(1)}%) below target.`;
  const lastLabelOffset = isMobile ? -10 : 8;
  const lastLabelAnchor = isMobile ? "end" : "start";

  return (
    <div className="grid grid-cols-1 gap-3 md:gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2 overflow-hidden border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
        <CardHeader className="rounded-t-[inherit] border-b border-slate-300 bg-slate-100 p-3 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="flex items-start gap-2 text-sm leading-5 md:items-center md:text-base">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
              <span className="whitespace-normal break-words">{t("chart.carbon.description")}</span>
            </CardTitle>
            {canConfigureTarget && onOpenTargetSetup ?
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
              onClick={onOpenTargetSetup}>
                {locale === "vi" ? "Đặt mục tiêu" : "Set target"}
              </Button> :
            null}
          </div>
          {latestTrendPoint && hasLatestDelta &&
          <p
            className={`text-xs ${
            isAboveTarget ? "text-amber-700" : "text-emerald-700"}`
            }>
              {latestInsightText}
            </p>
          }
        </CardHeader>
        <CardContent className="bg-white px-2 pb-3 pt-4 md:px-6 md:pt-5">
          <div className="h-48 md:h-64">
            {isLoading ?
            <div className="h-full w-full rounded-md border border-slate-300 bg-slate-200/70 animate-pulse" /> :
            hasTrendData ?
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={carbonTrendData}
                  margin={{
                    top: 8,
                    right: isMobile ? 36 : 72,
                    left: isMobile ? -8 : 0,
                    bottom: 0
                  }}>
                  <defs>
                    <linearGradient
                    id="colorEmissions"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1">

                      <stop
                      offset="5%"
                      stopColor="hsl(150 60% 20%)"
                      stopOpacity={0.3} />

                      <stop
                      offset="95%"
                      stopColor="hsl(150 60% 20%)"
                      stopOpacity={0} />

                    </linearGradient>
                  </defs>
                  <XAxis
                  dataKey="month"
                  stroke="hsl(150 12% 35%)"
                  fontSize={12} />

                  <YAxis stroke="hsl(150 12% 35%)" fontSize={12} />
                  <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(0 0% 100%)",
                    border: "1px solid hsl(215 16% 78%)",
                    borderRadius: "8px",
                    fontSize: "12px"
                  }} />

                  <Area
                  type="monotone"
                  dataKey="emissions"
                  stroke="hsl(150 60% 20%)"
                  strokeWidth={2}
                  fill="url(#colorEmissions)"
                  name={t("chart.carbon.outcome")}>
                    <LabelList
                    dataKey="emissions"
                    position="right"
                    offset={8}
                    content={(props: {
                      index?: number;
                      x?: string | number;
                      y?: string | number;
                    }) => {
                      if (props.index !== lastPointIndex) return null;
                      if (typeof props.x !== "number" || typeof props.y !== "number") {
                        return null;
                      }
                      return (
                        <text
                          x={props.x + lastLabelOffset}
                          y={props.y + 14}
                          textAnchor={lastLabelAnchor}
                          fontSize={isMobile ? 11 : 12}
                          fontWeight={600}
                          fill="hsl(150 70% 22%)"
                          stroke="hsl(0 0% 100%)"
                          strokeWidth={2}
                          paintOrder="stroke">
                          {t("chart.carbon.outcome")}
                        </text>);
                    }} />
                  </Area>

                  <Area
                  type="monotone"
                  dataKey="target"
                  stroke="hsl(150 60% 20%)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill="transparent"
                  name={t("chart.carbon.expect")}>
                    <LabelList
                    dataKey="target"
                    position="right"
                    offset={8}
                    content={(props: {
                      index?: number;
                      x?: string | number;
                      y?: string | number;
                    }) => {
                      if (props.index !== lastPointIndex) return null;
                      if (typeof props.x !== "number" || typeof props.y !== "number") {
                        return null;
                      }
                      return (
                        <text
                          x={props.x + lastLabelOffset}
                          y={props.y - 10}
                          textAnchor={lastLabelAnchor}
                          fontSize={isMobile ? 11 : 12}
                          fontWeight={600}
                          fill="hsl(150 35% 30%)"
                          stroke="hsl(0 0% 100%)"
                          strokeWidth={2}
                          paintOrder="stroke">
                          {t("chart.carbon.expect")}
                        </text>);
                    }} />
                  </Area>

                </AreaChart>
              </ResponsiveContainer> :

            <div className="flex h-full items-center justify-center rounded-md border border-slate-300 bg-slate-100 text-sm text-slate-700">
                No chart data yet
              </div>
            }
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
        <CardHeader className="rounded-t-[inherit] border-b border-slate-300 bg-slate-100 px-3 py-2.5 md:p-6">
          <CardTitle className="flex items-center gap-2 text-lg md:text-base">
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
            <span className="truncate">{t("chart.pie.title")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-white pt-5">
          <div className="h-48 md:h-48 flex items-center justify-center">
            {isLoading ?
            <div className="h-full w-full rounded-md border border-slate-300 bg-slate-200/70 animate-pulse" /> :
            hasBreakdownData ?
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                  data={emissionBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={84}
                  paddingAngle={2}
                  dataKey="value">

                    {emissionBreakdown.map((entry, index) =>
                  <Cell key={`cell-${index}`} fill={entry.color} />
                  )}
                  </Pie>
                </PieChart>
              </ResponsiveContainer> :

            <div className="flex h-full w-full items-center justify-center rounded-md border border-slate-300 bg-slate-100 text-sm text-slate-700">
                No breakdown data yet
              </div>
            }
          </div>

          {hasBreakdownData &&
          <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-2 sm:gap-x-3">
              {emissionBreakdown.map((item) =>
            <div
              key={item.name}
              className="flex min-w-0 items-center gap-2 text-xs md:text-sm">

                  <div className="flex min-w-0 items-center gap-2">
                    <div
                  className="h-2 w-2 shrink-0 rounded-full md:h-3 md:w-3"
                  style={{ backgroundColor: item.color }} />
                    <span className="truncate text-slate-700">
                      {getLabel(item.name)}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-slate-900 md:text-sm">
                    {item.value}%
                  </span>
                </div>
            )}
            </div>
          }
        </CardContent>
      </Card>
    </div>);

}
