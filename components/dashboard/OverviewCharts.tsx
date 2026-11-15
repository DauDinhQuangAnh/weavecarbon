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
  Line,
  LineChart,
  CartesianGrid,
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
import { useTranslations } from "next-intl";

export interface ProductEmissionsPoint {
  name: string;
  sku: string;
  materials: number;
  production: number;
  transport: number;
  packaging: number;
  total: number;
  /** Tổng phát thải lô (kgCO₂e) — có ở dữ liệu demo, dùng để dựng nhịp phát thải theo tháng. */
  batchTotal?: number;
}

export interface EmissionBreakdownPoint {
  name: string;
  value: number;
  color: string;
}

const CATEGORY_COLORS = {
  // Bảng màu đồng bộ Lovable: navy → forest → lime → amber
  materials:  "hsl(96 49% 14%)",
  production: "hsl(150 61% 26%)",
  transport:  "hsl(93 32% 57%)",
  packaging:  "hsl(38 70% 52%)",
} as const;

const MONTHS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"] as const;
const PRODUCT_LINE_COLORS = [
  "hsl(96 49% 14%)",
  "hsl(150 61% 26%)",
  "hsl(93 32% 50%)",
  "hsl(38 70% 52%)",
  "hsl(200 45% 38%)",
  "hsl(18 62% 48%)",
  "hsl(101 12% 56%)",
];

// Hash ổn định để mỗi sản phẩm có nhịp tháng riêng (cùng một kết quả ở mọi lần render).
const stableNoise = (seed: string, index: number) => {
  let h = 2166136261;
  const key = `${seed}:${index}`;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000 - 0.5; // [-0.5, 0.5)
};

/**
 * Nhịp phát thải theo tháng của từng sản phẩm (tCO₂e) — dựng từ tổng phát thải lô của dữ liệu demo,
 * phân bổ theo mùa vụ/vận hành với dao động tháng. Chỉ dùng cho demo, không phải số đo thực.
 */
export function buildMonthlyProductSeries(points: ProductEmissionsPoint[], maxSeries = 6) {
  const withBatch = points.filter((p) => typeof p.batchTotal === "number" && (p.batchTotal ?? 0) > 0);
  if (withBatch.length === 0) return { data: [] as Record<string, number | string>[], series: [] as { key: string; label: string; color: string }[] };
  const sorted = [...withBatch].sort((a, b) => (b.batchTotal ?? 0) - (a.batchTotal ?? 0));
  const top = sorted.slice(0, maxSeries);
  const rest = sorted.slice(maxSeries);
  const series = top.map((p, i) => ({ key: p.sku, label: p.name, color: PRODUCT_LINE_COLORS[i % PRODUCT_LINE_COLORS.length] }));
  if (rest.length) series.push({ key: "__other", label: `Khác (${rest.length} SKU)`, color: PRODUCT_LINE_COLORS[6] });
  const monthly = (p: ProductEmissionsPoint, m: number) => {
    const base = (p.batchTotal ?? 0) / 1000 / MONTHS.length;
    const phase = (stableNoise(p.sku, 99) + 0.5) * Math.PI * 2;
    const seasonal = 0.16 * Math.sin((m / MONTHS.length) * Math.PI * 2 + phase);
    const trend = 0.03 * (m - MONTHS.length / 2) / MONTHS.length;
    const noise = 0.14 * stableNoise(p.sku, m);
    return Math.max(0, base * (1 + seasonal + trend + noise));
  };
  const data = MONTHS.map((label, m) => {
    const row: Record<string, number | string> = { month: `${label}/2026` };
    top.forEach((p) => { row[p.sku] = Number(monthly(p, m).toFixed(1)); });
    if (rest.length) row.__other = Number(rest.reduce((sum, p) => sum + monthly(p, m), 0).toFixed(1));
    return row;
  });
  return { data, series };
}

interface OverviewChartsProps {
  productEmissions?: ProductEmissionsPoint[];
  emissionBreakdown?: EmissionBreakdownPoint[];
  isLoading?: boolean;
  /** Ẩn biểu đồ tròn "Nguồn phát thải" khi trang đã có khối "Phát thải theo nguồn" (tránh trùng). */
  hideBreakdown?: boolean;
}

export default function OverviewCharts({
  productEmissions = [],
  emissionBreakdown = [],
  isLoading = false,
  hideBreakdown = false,
}: OverviewChartsProps) {
  const t = useTranslations("overview");
  const locale = "vi";

  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const hasProductData = productEmissions.length > 0;
  const monthly = React.useMemo(() => buildMonthlyProductSeries(productEmissions), [productEmissions]);
  const hasMonthly = monthly.data.length > 0;
  const [view, setView] = React.useState<"monthly" | "stage">("monthly");
  const showMonthly = hasMonthly && view === "monthly";
  const hasBreakdownData = emissionBreakdown.length > 0;

  const categoryLabels = {
    materials:  locale === "vi" ? "Vật liệu"   : "Materials",
    production: locale === "vi" ? "Sản xuất"   : "Production",
    transport:  "Vận chuyển",
    packaging:  locale === "vi" ? "Đóng gói"   : "Packaging",
  };

  const getLabel = (label: string) => {
    if (!label.includes(".")) return label;
    try { return t(label); } catch { return label; }
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:gap-6 lg:grid-cols-3">
      {/* ── Stacked bar: emissions per product ─────────────────── */}
      <Card className={`${hideBreakdown ? "lg:col-span-3" : "lg:col-span-2"} overflow-hidden border`}>
        <CardHeader className="rounded-t-[inherit] border-b p-3 md:p-6">
          <CardTitle className="flex items-center gap-2 text-sm leading-5 md:text-base">
            <BarChart2 className="w-4 h-4 md:w-5 md:h-5" />
            <span>
              {"Phát thải CO₂e theo sản phẩm"}
            </span>
          </CardTitle>
          <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {showMonthly
                ? "Nhịp phát thải theo tháng của từng sản phẩm (tCO₂e) · dữ liệu demo T1–T8/2026"
                : locale === "vi"
                  ? "Phân theo giai đoạn: vật liệu, sản xuất, vận chuyển, đóng gói (kgCO₂e / đơn vị)"
                  : "Broken down by stage: materials, production, transport, packaging"}
            </p>
            {hasMonthly ? (
              <div className="flex rounded-lg border border-border p-0.5">
                {(["monthly", "stage"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setView(key)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${view === key ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {key === "monthly" ? "Theo tháng" : "Theo giai đoạn"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-3 pt-4 md:px-6 md:pt-5">
          <div className={showMonthly ? "h-72 md:h-80" : "h-56 md:h-64"}>
            {isLoading ? (
              <div className="h-full w-full rounded-md border border-slate-300 bg-slate-200/70 animate-pulse" />
            ) : showMonthly ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly.data} margin={{ top: 8, right: isMobile ? 8 : 16, left: isMobile ? -16 : 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)" }} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)" }}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)} />
                  <Tooltip
                    contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 12 }}
                    formatter={(value, name) => [`${Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tCO₂e`, name]}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  {monthly.series.map((item) => (
                    <Line key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={item.color}
                      strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} animationDuration={900} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
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
                      `${Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} kg`,
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
                {"Chưa có sản phẩm nào"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Pie: aggregate emission sources ────────────────────── */}
      {hideBreakdown ? null : (
      <Card className="overflow-hidden border">
        <CardHeader className="rounded-t-[inherit] border-b px-3 py-2.5 md:p-6">
          <CardTitle className="flex items-center gap-2 text-lg md:text-base">
            <BarChart2 className="w-4 h-4 md:w-5 md:h-5" />
            <span className="truncate">{t("chart.pie.title")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
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
                {"Chưa có dữ liệu phát thải"}
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
      )}
    </div>
  );
}
