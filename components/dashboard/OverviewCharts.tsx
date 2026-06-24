"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle } from
"@/components/ui/card";
import { BarChart2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend } from
"recharts";
import { useLocale, useTranslations } from "next-intl";

export interface ProductEmissionsPoint {
  name: string;
  sku: string;
  materials: number;
  production: number;
  transport: number;
  packaging: number;
  total: number;
}

export interface EmissionBreakdownPoint {
  name: string;
  value: number;
  color: string;
}

const CATEGORY_COLORS = {
  materials:  "hsl(171 78% 33%)",
  production: "hsl(220 85% 54%)",
  transport:  "hsl(8 82% 56%)",
  packaging:  "hsl(281 78% 56%)",
} as const;

interface OverviewChartsProps {
  productEmissions?: ProductEmissionsPoint[];
  emissionBreakdown?: EmissionBreakdownPoint[];
  isLoading?: boolean;
}

export default function OverviewCharts({
  productEmissions = [],
  emissionBreakdown = [],
  isLoading = false,
}: OverviewChartsProps) {
  const t = useTranslations("overview");
  const locale = useLocale();

  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const hasProductData = productEmissions.length > 0;
  const hasBreakdownData = emissionBreakdown.length > 0;

  const categoryLabels = {
    materials:  locale === "vi" ? "Vật liệu"   : "Materials",
    production: locale === "vi" ? "Sản xuất"   : "Production",
    transport:  locale === "vi" ? "Vận chuyển" : "Transport",
    packaging:  locale === "vi" ? "Đóng gói"   : "Packaging",
  };

  const getLabel = (label: string) => {
    if (!label.includes(".")) return label;
    try { return t(label); } catch { return label; }
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:gap-6 lg:grid-cols-3">
      {/* ── Stacked bar: emissions per product ─────────────────── */}
      <Card className="lg:col-span-2 overflow-hidden border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
        <CardHeader className="rounded-t-[inherit] border-b border-slate-300 bg-slate-100 p-3 md:p-6">
          <CardTitle className="flex items-center gap-2 text-sm leading-5 md:text-base">
            <BarChart2 className="w-4 h-4 md:w-5 md:h-5" />
            <span>
              {locale === "vi" ? "Phát thải CO₂e theo sản phẩm" : "CO₂e Emissions by Product"}
            </span>
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            {locale === "vi"
              ? "Phân theo giai đoạn: vật liệu, sản xuất, vận chuyển, đóng gói"
              : "Broken down by stage: materials, production, transport, packaging"}
          </p>
        </CardHeader>
        <CardContent className="bg-white px-2 pb-3 pt-4 md:px-6 md:pt-5">
          <div className="h-56 md:h-64">
            {isLoading ? (
              <div className="h-full w-full rounded-md border border-slate-300 bg-slate-200/70 animate-pulse" />
            ) : hasProductData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={productEmissions}
                  margin={{ top: 4, right: isMobile ? 8 : 16, left: isMobile ? -16 : 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="sku"
                    stroke="hsl(150 12% 35%)"
                    fontSize={11}
                    tick={{ fill: "hsl(215 16% 40%)" }}
                    tickFormatter={(v: string) => v.length > 10 ? `${v.slice(0, 10)}…` : v}
                  />
                  <YAxis
                    stroke="hsl(150 12% 35%)"
                    fontSize={11}
                    tick={{ fill: "hsl(215 16% 40%)" }}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(0 0% 100%)",
                      border: "1px solid hsl(215 16% 78%)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value, name) => [
                      `${Number(value).toLocaleString(locale === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 2 })} kg`,
                      name,
                    ]}
                  />
                  <Legend
                    iconType="square"
                    iconSize={10}
                    wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                  />
                  <Bar dataKey="materials"  stackId="s" fill={CATEGORY_COLORS.materials}  name={categoryLabels.materials}  radius={[0, 0, 0, 0]} />
                  <Bar dataKey="production" stackId="s" fill={CATEGORY_COLORS.production} name={categoryLabels.production} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="transport"  stackId="s" fill={CATEGORY_COLORS.transport}  name={categoryLabels.transport}  radius={[0, 0, 0, 0]} />
                  <Bar dataKey="packaging"  stackId="s" fill={CATEGORY_COLORS.packaging}  name={categoryLabels.packaging}  radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-md border border-slate-300 bg-slate-100 text-sm text-slate-700">
                {locale === "vi" ? "Chưa có sản phẩm nào" : "No products yet"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Pie: aggregate emission sources ────────────────────── */}
      <Card className="overflow-hidden border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
        <CardHeader className="rounded-t-[inherit] border-b border-slate-300 bg-slate-100 px-3 py-2.5 md:p-6">
          <CardTitle className="flex items-center gap-2 text-lg md:text-base">
            <BarChart2 className="w-4 h-4 md:w-5 md:h-5" />
            <span className="truncate">{t("chart.pie.title")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-white pt-5">
          <div className="h-48 md:h-48 flex items-center justify-center">
            {isLoading ? (
              <div className="h-full w-full rounded-md border border-slate-300 bg-slate-200/70 animate-pulse" />
            ) : hasBreakdownData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={emissionBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={84}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {emissionBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-md border border-slate-300 bg-slate-100 text-sm text-slate-700">
                {locale === "vi" ? "Chưa có dữ liệu phát thải" : "No breakdown data yet"}
              </div>
            )}
          </div>

          {hasBreakdownData && (
            <div className="mt-4 grid grid-cols-2 gap-x-2 gap-y-2 sm:gap-x-3">
              {emissionBreakdown.map((item) => (
                <div
                  key={item.name}
                  className="flex min-w-0 items-center gap-2 text-xs md:text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className="h-2 w-2 shrink-0 rounded-full md:h-3 md:w-3"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate text-slate-700">
                      {getLabel(item.name)}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-slate-900 md:text-sm">
                    {item.value}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
