"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Database,
  Factory,
  FileCheck2,
  Globe2,
  Info,
  Upload,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageHeader from "@/components/app/PageHeader";
import SectionCard from "@/components/app/SectionCard";
import StatCard from "@/components/app/StatCard";
import StatusPill from "@/components/app/StatusPill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isDemoPath } from "@/lib/demo/routes";
import { getIndustrialPortfolio } from "@/lib/industrialPortfolio/dataset";
import { getIndustrialReporting, pivotIndustryCadence } from "@/lib/industrialPortfolio/reporting";

const fmt = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
const severityIcon = { critical: AlertOctagon, warning: AlertTriangle, info: Info } as const;
const severityClass = { critical: "text-destructive", warning: "text-warning", info: "text-info" } as const;
const INDUSTRY_SERIES = ["Steel", "Cement", "Aluminium", "Chemicals", "Agriculture", "Construction Materials", "Mining & Minerals"] as const;
const INDUSTRY_VI: Record<string, string> = {
  Steel: "Thép",
  Cement: "Xi măng",
  Aluminium: "Nhôm",
  Chemicals: "Hoá chất",
  Agriculture: "Nông nghiệp",
  "Construction Materials": "Vật liệu xây dựng",
  "Mining & Minerals": "Khai khoáng",
};
const LINE_COLORS = [
  "var(--color-navy)",
  "var(--color-primary)",
  "var(--color-accent)",
  "var(--color-slate-500)",
  "#0f766e",
  "#a16207",
  "#7c3aed",
];
const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  fontSize: 12,
};
const axisTick = { fontSize: 11, fill: "var(--color-muted-foreground)" };

/**
 * Danh mục carbon công nghiệp — đồng bộ từ trang Tổng quan của bản Lovable.
 * Ở chế độ demo hiển thị bộ dữ liệu công nghiệp mẫu (có nhãn rõ ràng);
 * với tài khoản thật chỉ hiển thị lời mời nhập dữ liệu, không trộn dữ liệu mẫu vào số liệu thật.
 */
export default function IndustrialPortfolioSection() {
  const pathname = usePathname();
  const demo = isDemoPath(pathname);
  const base = demo ? "/demo" : "";
  const [granularity, setGranularity] = useState<"monthly" | "quarterly">("monthly");
  const core = getIndustrialPortfolio();
  const reporting = getIndustrialReporting();
  const cadence = useMemo(() => pivotIndustryCadence(reporting.cadence), [reporting.cadence]);

  if (!demo) {
    return (
      <SectionCard
        className="mt-6"
        title="Danh mục carbon công nghiệp"
        description="Gom cơ sở, quy trình, dữ liệu hoạt động và yêu cầu báo cáo theo ngành vào một bộ dữ liệu được quản trị."
      >
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Nhập dữ liệu hoạt động (điện, nhiên liệu, nguyên liệu, sản lượng) để mở khoá nhịp phát thải theo ngành, kiểm
            kê theo Scope, điểm nóng và ma trận báo cáo cho thị trường nội địa lẫn xuất khẩu.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/activity-data" prefetch={false}>
                <Upload className="h-4 w-4" />
                Nhập dữ liệu hoạt động
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/compliance" prefetch={false}>
                Ma trận báo cáo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </SectionCard>
    );
  }

  const { organization, emissionsSummary, emissionsMonthly, emissionsQuarterly, emissionsBySource, hotspots, facilities, dataGaps } = core;
  const series = granularity === "monthly" ? emissionsMonthly : emissionsQuarterly;
  const note = "Bộ dữ liệu công nghiệp mẫu · doanh nghiệp demo tổng hợp";
  const alerts = dataGaps.slice(0, 4).map((g: { id: string; impact: string; issue: string; entity: string }) => ({
    id: g.id,
    severity: (g.impact === "High" ? "critical" : g.impact === "Medium" ? "warning" : "info") as keyof typeof severityIcon,
    text: g.issue,
    entity: g.entity,
  }));
  const domesticProducts = reporting.products.filter((p) => p.marketScope === "domestic").length;
  const dualProducts = reporting.products.filter((p) => p.marketScope === "dual").length;
  const exportProducts = reporting.products.filter((p) => p.marketScope === "export").length;
  const avgEvidence = reporting.products.length
    ? Math.round(reporting.products.reduce((s, p) => s + p.evidenceCount, 0) / reporting.products.length)
    : 0;

  return (
    <section data-motion-reveal>
      <PageHeader
        title="Danh mục carbon công nghiệp"
        description="Một bộ dữ liệu công nghiệp được quản trị thống nhất, tổ chức theo ngành, hoạt động nội địa và yêu cầu sản phẩm hướng xuất khẩu."
        meta={
          <>
            <StatusPill label={`Engine v${organization.engineVersion}`} tone="neutral" />
            <StatusPill label={`${emissionsSummary.facilities} cơ sở`} tone="neutral" />
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Database className="h-3.5 w-3.5" />
              {note}
            </span>
          </>
        }
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href={`${base}/activity-data`} prefetch={false}>
                <Upload className="h-4 w-4" />
                Nhập dữ liệu hoạt động
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`${base}/compliance`} prefetch={false}>
                Ma trận báo cáo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Phát thải toàn danh mục" value={fmt(emissionsSummary.totalTonnes)} unit="tCO₂e" subtext={`Danh mục demo ${organization.period}`} />
        <StatCard label="Độ phủ ngành" value={String(facilities.length)} subtext="Số ngành được đại diện" />
        <StatCard
          label="Sản phẩm xuất khẩu / song dụng"
          value={String(exportProducts + dualProducts)}
          subtext={`${dualProducts} song dụng · ${exportProducts} ưu tiên xuất khẩu`}
        />
        <StatCard label="Bằng chứng trên mỗi sản phẩm" value={String(avgEvidence)} subtext="Số chứng từ demo liên kết trung bình" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Nhịp phát thải theo ngành"
          description="Nhịp vận hành theo tháng của từng ngành — Jan đến Aug 2026"
          footer="Chuỗi demo tổng hợp. Mỗi ngành có nhịp vận hành riêng; tổng các giá trị khớp với tổng theo cơ sở đã seed."
        >
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cadence} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="period" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {INDUSTRY_SERIES.map((industry, index) => (
                  <Line
                    key={industry}
                    type="monotone"
                    dataKey={industry}
                    name={INDUSTRY_VI[industry] ?? industry}
                    stroke={LINE_COLORS[index]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    animationDuration={900}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Cấu trúc thị trường" description="Tách mục đích pháp lý/báo cáo khỏi lớp dữ liệu vật lý.">
          <div className="space-y-4">
            {[
              { icon: Factory, label: "Nội địa Việt Nam", value: domesticProducts + dualProducts, text: "Sản phẩm/cơ sở duy trì kiểm kê, MRV và bằng chứng cấp tổ chức." },
              { icon: Globe2, label: "Hướng xuất khẩu", value: exportProducts + dualProducts, text: "Sản phẩm được ánh xạ sang buyer, PCF, CBAM hoặc DPP khi phù hợp." },
              { icon: FileCheck2, label: "Cấu hình báo cáo", value: reporting.reportProfiles.length, text: "Định nghĩa đầu ra cho quy định, GHG Protocol, ISO và yêu cầu buyer." },
            ].map(({ icon: Icon, label, value, text }) => (
              <div key={label} className="interactive-surface rounded-xl border border-border bg-background/40 p-4">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">{label}</p>
                </div>
                <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Phát thải doanh nghiệp theo thời gian"
          description="Góc nhìn kiểm kê xếp chồng theo Scope"
          footer={note}
          actions={
            <div className="flex rounded-lg border border-border p-0.5">
              {(["monthly", "quarterly"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGranularity(g)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    granularity === g ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {g === "monthly" ? "Theo tháng" : "Theo quý"}
                </button>
              ))}
            </div>
          }
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="period" tick={{ ...axisTick, fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ ...axisTick, fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="scope1" name="Scope 1" stackId="1" stroke="var(--color-navy)" fill="var(--color-navy)" fillOpacity={0.7} />
                <Area type="monotone" dataKey="scope2" name="Scope 2" stackId="1" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.55} />
                <Area type="monotone" dataKey="scope3" name="Scope 3" stackId="1" stroke="var(--color-accent)" fill="var(--color-accent)" fillOpacity={0.45} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard
          title="Phát thải theo nguồn"
          description="Tỷ trọng trong tổng kiểm kê"
          footer={note}
          actions={
            <Link href={`${base}/emissions`} prefetch={false} className="text-xs font-medium text-primary hover:underline">
              Xem chi tiết
            </Link>
          }
        >
          <ul className="space-y-4">
            {emissionsBySource.map((s) => (
              <li key={s.source}>
                <div className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span>{s.source}</span>
                  <span className="tabular-nums text-muted-foreground">{s.pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${s.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Sản phẩm → thị trường → báo cáo"
          description="Tách rõ sản phẩm, thị trường đích và khung báo cáo."
          footer="Danh mục sản phẩm demo; khả năng áp dụng quy định được kiểm soát theo thị trường đích và phạm vi sản phẩm."
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Sản phẩm</th>
                  <th className="px-5 py-3">Ngành</th>
                  <th className="px-5 py-3">Thị trường</th>
                  <th className="px-5 py-3">Cường độ</th>
                  <th className="px-5 py-3">Báo cáo</th>
                  <th className="px-5 py-3 text-right">Bằng chứng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reporting.products.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-5 py-4">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.productCode}
                        {p.cnCode ? ` · CN ${p.cnCode}` : ""}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{INDUSTRY_VI[p.industry] ?? p.industry}</td>
                    <td className="px-5 py-4">
                      <StatusPill
                        label={p.marketScope === "dual" ? "Nội địa + Xuất khẩu" : p.marketScope === "export" ? "Xuất khẩu" : "Nội địa"}
                        tone={p.marketScope === "domestic" ? "neutral" : "positive"}
                      />
                    </td>
                    <td className="px-5 py-4 tabular-nums text-muted-foreground">{p.intensity}</td>
                    <td className="px-5 py-4">
                      <div className="flex max-w-[360px] flex-wrap gap-1">
                        {p.reportTargets.slice(0, 4).map((r) => (
                          <span key={r} className="rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">{p.evidenceCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
        <SectionCard
          title="Mẫu bằng chứng"
          description="Chứng từ giúp chuỗi hoạt động → tính toán → báo cáo có thể truy xuất."
          bodyClassName="p-0"
          footer="Tên file và metadata là dữ liệu demo; không tài liệu nào được trình bày như chứng từ thật của bên thứ ba."
        >
          <ul className="divide-y divide-border">
            {reporting.evidence.slice(0, 6).map((d) => (
              <li key={d.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.fileName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {d.documentType} · {d.linkedActivity}
                    </p>
                  </div>
                  <StatusPill label={d.evidenceLevel} />
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Điểm nóng lớn nhất"
          description="Các nguồn đóng góp lớn nhất trong kỳ"
          footer={note}
          bodyClassName="p-0"
          actions={
            <Link href={`${base}/hotspots`} prefetch={false} className="text-xs font-medium text-primary hover:underline">
              Xem tất cả
            </Link>
          }
        >
          <ul className="divide-y divide-border">
            {hotspots.map((h: { id?: string; entity: string; type: string; facility: string; tonnes: number; pct: number }) => (
              <li key={h.id ?? h.entity} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{h.entity}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {h.type} · {h.facility}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(h.pct * 3.5, 100)}%` }} />
                  </span>
                  <span className="w-24 text-right text-sm tabular-nums">{fmt(h.tonnes)} t</span>
                  <span className="w-12 text-right text-sm tabular-nums text-muted-foreground">{h.pct}%</span>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Cảnh báo" description="Cần xử lý" bodyClassName="p-0" footer={note}>
          <ul className="divide-y divide-border">
            {alerts.map((a) => {
              const Icon = severityIcon[a.severity] ?? Info;
              return (
                <li key={a.id} className="flex gap-3 px-5 py-3.5">
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", severityClass[a.severity])} />
                  <div>
                    <p className="text-sm">{a.text}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{a.entity}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>
    </section>
  );
}
