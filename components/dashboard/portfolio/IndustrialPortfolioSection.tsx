"use client";

import { useCallback, useState } from "react";
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
  RefreshCw,
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
import { useIndustrialWorkspaceQuery } from "@/hooks/useIndustrialWorkspaceQuery";
import { fetchCorporateGhgInventories } from "@/lib/weave-v2/corporateGhgInventoryApi";
import { industrialCoreApi } from "@/lib/industrialCoreApi";
import { listEvidenceV2 } from "@/lib/weave-v2/evidenceV2Api";
import { dataGovernanceApi } from "@/lib/dataGovernanceApi";
import { fetchAllProducts } from "@/lib/products/productsQueries";
import { buildRealPortfolioView, type PortfolioView } from "@/lib/industrialPortfolio/portfolioView";

const fmt = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
const severityIcon = { critical: AlertOctagon, warning: AlertTriangle, info: Info } as const;
const severityClass = { critical: "text-destructive", warning: "text-warning", info: "text-info" } as const;
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

/** Lấy toàn bộ dữ liệu thật; một nguồn lỗi không làm hỏng các khối còn lại. */
async function loadRealPortfolio(): Promise<PortfolioView> {
  const [inventories, facilities, activities, evidence, products, factors] = await Promise.allSettled([
    fetchCorporateGhgInventories(),
    industrialCoreApi.facilities(),
    industrialCoreApi.activities(500),
    listEvidenceV2(),
    fetchAllProducts({ sort_by: "updated_at", sort_order: "desc", view: "summary" }),
    dataGovernanceApi.factorProposals(),
  ]);
  const results = [inventories, facilities, activities, evidence, products, factors];
  if (results.every((r) => r.status === "rejected")) {
    const first = inventories as PromiseRejectedResult;
    throw first.reason instanceof Error ? first.reason : new Error("Không tải được dữ liệu danh mục công nghiệp.");
  }
  const value = <T,>(r: PromiseSettledResult<T>, fallback: T): T => (r.status === "fulfilled" && r.value ? r.value : fallback);
  return buildRealPortfolioView({
    inventories: value(inventories, []),
    facilities: value(facilities, []),
    activities: value(activities, []),
    evidence: value(evidence, { items: [], total: 0 }).items || [],
    products: value(products, []),
    factors: value(factors, []),
  });
}

function EmptyNote({ children, href, action }: { children: React.ReactNode; href?: string; action?: string }) {
  return (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 px-5 py-6 text-center text-sm text-muted-foreground">
      <p className="max-w-sm">{children}</p>
      {href && action ? (
        <Link href={href} prefetch={false} className="text-xs font-medium text-primary hover:underline">
          {action}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Danh mục carbon công nghiệp — đồng bộ từ trang Tổng quan của bản Lovable.
 * Demo và tài khoản thật dùng cùng một giao diện: demo hiển thị bộ dữ liệu công nghiệp mẫu
 * (có nhãn rõ ràng), tài khoản thật tính từ dữ liệu của doanh nghiệp qua API.
 */
export default function IndustrialPortfolioSection() {
  const pathname = usePathname();
  const demo = isDemoPath(pathname);
  const base = demo ? "/demo" : "";
  const [granularity, setGranularity] = useState<"monthly" | "quarterly">("monthly");
  // Demo: bộ dữ liệu mẫu chỉ được tải khi đang ở /demo. Tài khoản thật: tính từ API.
  const loadView = useCallback(
    async (): Promise<PortfolioView> =>
      demo
        ? (await import("@/lib/industrialPortfolio/portfolioDemoView")).buildDemoPortfolioView()
        : loadRealPortfolio(),
    [demo]
  );
  const real = useIndustrialWorkspaceQuery(loadView, demo);
  const view = real.data;

  if (!view) {
    return (
      <SectionCard className="mt-6" title="Danh mục carbon công nghiệp" description="Đang tổng hợp dữ liệu…">
        {real.error ? (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-destructive">{real.error}</p>
            <Button size="sm" variant="outline" onClick={() => void real.reload()}>
              <RefreshCw className="h-4 w-4" />
              Thử lại
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        )}
      </SectionCard>
    );
  }

  const isDemo = view.mode === "demo";
  const series = granularity === "monthly" ? view.emissionsMonthly : view.emissionsQuarterly;
  const note = isDemo
    ? `Danh mục công nghiệp · kỳ ${view.period}`
    : view.hasInventory
      ? `Dữ liệu của doanh nghiệp · kỳ kiểm kê ${view.period}`
      : "Dữ liệu của doanh nghiệp · chưa có bản kiểm kê GHG";
  const noInventoryText = "Chưa có bản kiểm kê GHG. Lập kiểm kê từ dữ liệu hoạt động để xem số liệu này.";

  return (
    <section data-motion-reveal>
      <PageHeader
        title="Danh mục carbon công nghiệp"
        description="Một bộ dữ liệu công nghiệp được quản trị thống nhất, tổ chức theo ngành, hoạt động nội địa và yêu cầu sản phẩm hướng xuất khẩu."
        meta={
          <>
            <StatusPill label={`Engine v${view.engineVersion}`} tone="neutral" />
            <StatusPill label={`${view.facilitiesCount} cơ sở`} tone="neutral" />
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
        <StatCard
          label="Phát thải kiểm kê các cơ sở"
          value={fmt(view.totalTonnes)}
          unit="tCO₂e"
          subtext={isDemo || view.hasInventory ? `Kỳ ${view.period}` : "Chưa có kỳ kiểm kê"}
        />
        <StatCard label={view.coverage.label} value={String(view.coverage.value)} subtext={view.coverage.subtext} />
        <StatCard
          label="Sản phẩm xuất khẩu / song dụng"
          value={String(view.exportProducts + view.dualProducts)}
          subtext={`${view.dualProducts} song dụng · ${view.exportProducts} ưu tiên xuất khẩu`}
        />
        <StatCard
          label="Bằng chứng trên mỗi sản phẩm"
          value={String(view.avgEvidence)}
          subtext="Số chứng từ liên kết trung bình"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title={isDemo ? "Nhịp phát thải theo ngành" : "Nhịp phát thải theo cơ sở"}
          description={isDemo ? "Nhịp vận hành theo tháng của từng ngành — Jan đến Aug 2026" : "Phát thải (tCO₂e) của từng cơ sở qua các kỳ kiểm kê"}
          footer={
            isDemo
              ? "Mỗi ngành có nhịp vận hành riêng; tổng các giá trị khớp với tổng theo cơ sở."
              : "Tính từ các bản kiểm kê GHG đã lập; Scope 2 theo phương pháp location-based."
          }
        >
          <div className="h-[340px]">
            {view.cadence.rows.length && view.cadence.series.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 320, height: 200 }}>
                <LineChart data={view.cadence.rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="period" tick={axisTick} tickLine={false} axisLine={false} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {view.cadence.series.map((line, index) => (
                    <Line
                      key={line.key}
                      type="monotone"
                      dataKey={line.key}
                      name={line.label}
                      stroke={LINE_COLORS[index % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={view.cadence.rows.length < 3}
                      connectNulls
                      animationDuration={900}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyNote href={`${base}/activity-data`} action="Nhập dữ liệu hoạt động">{noInventoryText}</EmptyNote>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Cấu trúc thị trường" description="Tách mục đích pháp lý/báo cáo khỏi lớp dữ liệu vật lý.">
          <div className="space-y-4">
            {[
              { icon: Factory, label: "Nội địa Việt Nam", value: view.domesticProducts + view.dualProducts, text: "Sản phẩm/cơ sở duy trì kiểm kê, MRV và bằng chứng cấp tổ chức." },
              { icon: Globe2, label: "Hướng xuất khẩu", value: view.exportProducts + view.dualProducts, text: "Sản phẩm được ánh xạ sang buyer, PCF, CBAM hoặc DPP khi phù hợp." },
              {
                icon: FileCheck2,
                label: "Cấu hình báo cáo",
                value: view.reportProfilesCount,
                text: isDemo
                  ? "Định nghĩa đầu ra cho quy định, GHG Protocol, ISO và yêu cầu buyer."
                  : "Số khung báo cáo áp dụng cho sản phẩm của doanh nghiệp (gợi ý theo thị trường đích).",
              },
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

      <div className="mt-6 grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
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
            {series.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 320, height: 200 }}>
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
            ) : (
              <EmptyNote href={`${base}/activity-data`} action="Nhập dữ liệu hoạt động">{noInventoryText}</EmptyNote>
            )}
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
          {view.emissionsBySource.length ? (
            <ul className="space-y-4">
              {view.emissionsBySource.map((s) => (
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
          ) : (
            <EmptyNote>{noInventoryText}</EmptyNote>
          )}
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
        <SectionCard
          className="xl:col-span-2"
          title="Sản phẩm → thị trường → báo cáo"
          description="Tách rõ sản phẩm, thị trường đích và khung báo cáo."
          footer={
            isDemo
              ? "Khả năng áp dụng quy định được kiểm soát theo thị trường đích và phạm vi sản phẩm."
              : "Sản phẩm của doanh nghiệp; khung báo cáo là gợi ý theo thị trường đích và mã HS/CN, cần chuyên viên xác nhận."
          }
          bodyClassName="p-0"
        >
          {view.products.length ? (
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
                  {view.products.map((p) => (
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
                      <td className="px-5 py-4 tabular-nums text-muted-foreground">{p.intensity ?? "—"}</td>
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
          ) : (
            <EmptyNote href={`${base}/products`} action="Thêm sản phẩm">Chưa có sản phẩm nào trong danh mục.</EmptyNote>
          )}
        </SectionCard>
        <SectionCard
          title="Bằng chứng gần đây"
          description="Chứng từ giúp chuỗi hoạt động → tính toán → báo cáo có thể truy xuất."
          bodyClassName="p-0"
          footer={
            isDemo
              ? "Chứng từ liên kết với hoạt động, sản phẩm và khung báo cáo."
              : "Chứng từ doanh nghiệp đã tải lên; trạng thái khoá theo checksum SHA-256."
          }
        >
          {view.evidence.length ? (
            <ul className="divide-y divide-border">
              {view.evidence.slice(0, 6).map((d) => (
                <li key={d.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.fileName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {d.documentType}
                        {d.linkedActivity ? ` · ${d.linkedActivity}` : ""}
                      </p>
                    </div>
                    <StatusPill label={d.evidenceLevel} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote href={`${base}/evidence`} action="Tải chứng từ">Chưa có chứng từ nào.</EmptyNote>
          )}
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
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
          {view.hotspots.length ? (
            <ul className="divide-y divide-border">
              {view.hotspots.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
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
          ) : (
            <EmptyNote>{noInventoryText}</EmptyNote>
          )}
        </SectionCard>
        <SectionCard title="Cảnh báo" description="Cần xử lý" bodyClassName="p-0" footer={note}>
          {view.alerts.length ? (
            <ul className="divide-y divide-border">
              {view.alerts.map((a) => {
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
          ) : (
            <EmptyNote>Không có việc cần xử lý.</EmptyNote>
          )}
        </SectionCard>
      </div>
    </section>
  );
}
