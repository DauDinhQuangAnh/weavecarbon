"use client";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Download,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  TrendingDown,
  TrendingUp,
  Copy,
  Check,
  Search,
  Layers,
  ArrowRight,
  Flame,
  Zap,
  Truck,
  Leaf,
  Scale,
  FileCheck2,
} from "lucide-react";
import { fetchCorporateGhgInventories } from "@/lib/weave-v2/corporateGhgInventoryApi";
import {
  latestInventoryRevisions,
  inventoryHotspots,
  csvText,
  type InventoryView,
} from "@/lib/dashboard/industrialWorkspace";
import { useIndustrialWorkspaceQuery } from "@/hooks/useIndustrialWorkspaceQuery";
import { useAppRoutes } from "@/lib/demo/routes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import WorkspaceFrame, { EmptyWorkspace } from "./WorkspaceFrame";

const fmt = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "Chưa định lượng"
    : (value / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 3 }) + " tCO₂e";

const fmtKg = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " kgCO₂e";

interface ActivitySnapshotRow {
  scope?: string;
  facilityReference?: string;
  category?: string;
  accountingMethod?: string;
  calculatedCo2eKg?: number;
  [key: string]: unknown;
}

export default function CarbonInsightsClient({
  mode,
  demo = false,
}: {
  mode: "emissions" | "hotspots";
  demo?: boolean;
}) {
  const routes = useAppRoutes();
  const load = useCallback(
    async (): Promise<InventoryView[]> =>
      demo
        ? (await import("@/lib/dashboard/industrialDemoData")).DEMO_INVENTORIES
        : fetchCorporateGhgInventories(),
    [demo]
  );
  const query = useIndustrialWorkspaceQuery(load, demo);
  const [selectedId, setSelectedId] = useState("");
  const [groupBy, setGroupBy] = useState<"facility" | "category">("facility");

  // Emissions ledger states
  const [ledgerScope, setLedgerScope] = useState<"all" | "scope1" | "scope2" | "scope3">("all");
  const [ledgerQuery, setLedgerQuery] = useState("");
  const [copiedHash, setCopiedHash] = useState(false);

  const inventories = useMemo(() => latestInventoryRevisions(query.data || []), [query.data]);
  const inventory = inventories.find((row) => row.id === selectedId) || inventories[0];
  const hotspots = inventory ? inventoryHotspots(inventory, groupBy) : null;

  // Find previous inventory revision or period for trend comparison
  const previousInventory = useMemo(() => {
    if (!inventory) return null;
    const currentIdx = inventories.findIndex((row) => row.id === inventory.id);
    return currentIdx >= 0 && currentIdx + 1 < inventories.length ? inventories[currentIdx + 1] : null;
  }, [inventories, inventory]);

  const calcDelta = useCallback((curr: number | null | undefined, prev: number | null | undefined) => {
    if (curr == null || prev == null || prev === 0 || !Number.isFinite(curr) || !Number.isFinite(prev)) return null;
    return ((curr - prev) / prev) * 100;
  }, []);

  // Total Location-based emissions for proportional share
  const totalQuantifiedKg = useMemo(() => {
    if (!inventory) return 0;
    const s1 = inventory.result.totals.scope1KgCo2e || 0;
    const s2 = inventory.result.totals.scope2LocationBasedKgCo2e || 0;
    const s3 = inventory.result.totals.scope3KgCo2e || 0;
    return s1 + s2 + s3;
  }, [inventory]);

  const s1Share = totalQuantifiedKg > 0 ? ((inventory?.result.totals.scope1KgCo2e || 0) / totalQuantifiedKg) * 100 : 0;
  const s2LocShare = totalQuantifiedKg > 0 ? ((inventory?.result.totals.scope2LocationBasedKgCo2e || 0) / totalQuantifiedKg) * 100 : 0;
  const s3Share = totalQuantifiedKg > 0 ? ((inventory?.result.totals.scope3KgCo2e || 0) / totalQuantifiedKg) * 100 : 0;

  // Filtered Activity Snapshot rows
  const activityRows = useMemo(() => {
    if (!inventory?.activitySnapshot) return [];
    return (inventory.activitySnapshot as ActivitySnapshotRow[]).filter((row) => {
      if (ledgerScope !== "all" && row.scope !== ledgerScope) return false;
      if (ledgerQuery.trim()) {
        const q = ledgerQuery.toLowerCase();
        const facility = String(row.facilityReference || "").toLowerCase();
        const category = String(row.category || "").toLowerCase();
        const method = String(row.accountingMethod || "").toLowerCase();
        if (!facility.includes(q) && !category.includes(q) && !method.includes(q)) return false;
      }
      return true;
    });
  }, [inventory?.activitySnapshot, ledgerScope, ledgerQuery]);

  const copyHash = () => {
    if (!inventory?.resultSha256) return;
    void navigator.clipboard.writeText(inventory.resultSha256);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2200);
  };

  const download = () => {
    if (!inventory) return;
    if (mode === "hotspots") {
      const rows = [
        ["Nguồn", "kgCO2e", "Inventory", "Revision", "Kỳ bắt đầu", "Kỳ kết thúc"],
        ...hotspots!.rows.map((row) => [
          row.label,
          row.kg,
          inventory.inventoryReference,
          inventory.revision,
          inventory.reportingPeriodStart,
          inventory.reportingPeriodEnd,
        ]),
      ];
      const url = URL.createObjectURL(new Blob([csvText(rows)], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${mode}-inventory-${inventory.id.replace(/[^a-zA-Z0-9-]/g, "")}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      return;
    }

    // Comprehensive audit-ready CSV for emissions mode
    const summaryRows = [
      ["BÁO CÁO PHÁT THẢI DOANH NGHIỆP - INVENTORY VÀ NGUỒN HOẠT ĐỘNG"],
      ["Inventory Reference", inventory.inventoryReference],
      ["Revision", inventory.revision],
      ["Kỳ báo cáo", `${inventory.reportingPeriodStart} đến ${inventory.reportingPeriodEnd}`],
      ["Trạng thái kiểm kê", inventory.inventoryStatus],
      ["Mức bảo chứng (Assurance)", inventory.result.assuranceStatus],
      ["Phạm vi kiểm kê", inventory.result.inventoryScopeLabel],
      ["Mã băm toàn vẹn (Result SHA-256)", inventory.resultSha256],
      [],
      ["TỔNG HỢP PHÁT THẢI THEO PHẠM VI", "kgCO2e", "tCO2e"],
      ["Scope 1 · Phát thải trực tiếp", inventory.result.totals.scope1KgCo2e, inventory.result.totals.scope1KgCo2e / 1000],
      ["Scope 2 · Location-based", inventory.result.totals.scope2LocationBasedKgCo2e, inventory.result.totals.scope2LocationBasedKgCo2e / 1000],
      ["Scope 2 · Market-based", inventory.result.totals.scope2MarketBasedKgCo2e ?? "Chưa áp dụng", inventory.result.totals.scope2MarketBasedKgCo2e != null ? inventory.result.totals.scope2MarketBasedKgCo2e / 1000 : "N/A"],
      ["Scope 3 · Chuỗi giá trị", inventory.result.totals.scope3KgCo2e ?? 0, (inventory.result.totals.scope3KgCo2e ?? 0) / 1000],
      ["Tổng phát thải gộp (Scope 1 + Scope 2 Location)", inventory.result.totals.grossScope1AndLocationScope2KgCo2e, inventory.result.totals.grossScope1AndLocationScope2KgCo2e / 1000],
      ["Phát thải sinh học (Biogenic CO2)", inventory.result.totals.biogenicCo2Kg ?? 0, (inventory.result.totals.biogenicCo2Kg ?? 0) / 1000],
      ["Hấp thụ / Bù trừ đã nghỉ hưu", inventory.result.totals.offsetsRetiredKgCo2e ?? 0, (inventory.result.totals.offsetsRetiredKgCo2e ?? 0) / 1000],
      [],
      ["SỔ KÊ NGUỒN PHÁT THẢI CHI TIẾT (ACTIVITY EMISSION LEDGER)"],
      ["Phạm vi (Scope)", "Cơ sở (Facility)", "Hạng mục (Category)", "Phương pháp (Method)", "Phát thải (kgCO2e)", "Phát thải (tCO2e)"],
      ...(inventory.activitySnapshot as ActivitySnapshotRow[]).map((source) => [
        source.scope || "",
        source.facilityReference || "",
        source.category || "",
        source.accountingMethod || "tiêu chuẩn",
        source.calculatedCo2eKg ?? 0,
        typeof source.calculatedCo2eKg === "number" ? source.calculatedCo2eKg / 1000 : 0,
      ]),
    ];
    const url = URL.createObjectURL(new Blob([csvText(summaryRows)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `emissions-ledger-${inventory.inventoryReference}-v${inventory.revision}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved_for_internal_report":
        return <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Đã duyệt nội bộ</Badge>;
      case "inventory_review_required":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300/50 gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Chờ rà soát</Badge>;
      case "evidence_review_required":
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300 border border-orange-300/50 gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Rà soát chứng từ</Badge>;
      case "needs_information":
        return <Badge variant="destructive" className="gap-1"><AlertOctagon className="h-3.5 w-3.5" /> Thiếu dữ liệu</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <WorkspaceFrame
      title={mode === "emissions" ? "Phát thải" : "Điểm nóng phát thải"}
      description="Phân tích snapshot kiểm kê đã lưu theo kỳ và phiên bản. Mỗi lần xem dùng một inventory; không cộng các kỳ hoặc các bản sửa trùng nhau."
      demo={demo}
      loading={query.loading}
      error={query.error}
      reload={() => void query.reload()}
    >
      {!inventory ? (
        <EmptyWorkspace>
          Chưa có snapshot kiểm kê để phân tích.{" "}
          <Link className="text-primary underline" href={routes.toAppPath("/reports")}>
            Mở Báo cáo
          </Link>{" "}
          để chuẩn bị inventory. Dữ liệu hoạt động chưa được tính không được coi là phát thải bằng 0.
        </EmptyWorkspace>
      ) : (
        <>
          {/* Controls Bar */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="min-w-0 flex-1 text-sm font-medium">
              Inventory và kỳ báo cáo
              <select
                aria-label="Chọn inventory"
                value={inventory.id}
                onChange={(event) => setSelectedId(event.target.value)}
                className="mt-2 block w-full rounded-lg border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {inventories.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.inventoryReference} · v{row.revision} · {row.reportingPeriodStart} → {row.reportingPeriodEnd}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={download}>
                <Download className="mr-2 h-4 w-4" />
                Xuất CSV
              </Button>
              {mode === "emissions" && (
                <Button variant="secondary" asChild>
                  <Link href={routes.toAppPath("/reports")}>
                    <FileCheck2 className="mr-2 h-4 w-4" />
                    Quản lý báo cáo
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Audit & Integrity Header Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-card/60 p-3.5 text-xs text-muted-foreground shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">Trạng thái inventory:</span>
              <strong>{inventory.inventoryStatus}</strong>
              <div className="hidden sm:inline-block h-3 w-px bg-border mx-1" />
              {getStatusBadge(inventory.inventoryStatus)}
              <Badge variant="outline" className="gap-1 border-border/80">
                <ShieldCheck className="h-3 w-3 text-primary" />
                {inventory.result.assuranceStatus}
              </Badge>
              <Badge variant="outline" className="gap-1 border-border/80">
                <Layers className="h-3 w-3 text-muted-foreground" />
                {inventory.result.inventoryScopeLabel}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">
                SHA-256: {inventory.resultSha256.slice(0, 12)}…
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={copyHash}
                title="Sao chép toàn bộ mã băm Result SHA-256"
              >
                {copiedHash ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-500 font-medium">Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Sao chép</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {mode === "emissions" ? (
            <div className="space-y-6">
              {/* Gross Emissions & Key Metrics Overview */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Scope 1 */}
                {(() => {
                  const s1Val = inventory.result.totals.scope1KgCo2e;
                  const prevS1 = previousInventory?.result.totals.scope1KgCo2e;
                  const delta = calcDelta(s1Val, prevS1);
                  const sourcesCount = (inventory.activitySnapshot as ActivitySnapshotRow[]).filter((r) => r.scope === "scope1").length;
                  return (
                    <section className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-xs transition-shadow hover:shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Flame className="h-4 w-4 text-amber-500" />
                          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Scope 1 · Phát thải trực tiếp
                          </h2>
                        </div>
                        {delta !== null ? (
                          <span
                            className={`inline-flex items-center text-[11px] font-medium ${
                              delta <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {delta <= 0 ? <TrendingDown className="mr-0.5 h-3 w-3" /> : <TrendingUp className="mr-0.5 h-3 w-3" />}
                            {delta > 0 ? "+" : ""}
                            {delta.toFixed(1)}%
                          </span>
                        ) : previousInventory ? (
                          <span className="text-[11px] text-muted-foreground">Kỳ gốc</span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-2xl font-bold text-foreground">{fmt(s1Val)}</p>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{fmtKg(s1Val)}</p>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Tỷ trọng: <strong>{s1Share.toFixed(1)}%</strong></span>
                        <span>{sourcesCount} nguồn hoạt động</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-amber-500" style={{ width: `${s1Share}%` }} />
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                        Đốt nhiên liệu tại chỗ, rò rỉ môi chất lạnh, quá trình sản xuất.
                      </p>
                    </section>
                  );
                })()}

                {/* Scope 2 Location-based */}
                {(() => {
                  const s2Val = inventory.result.totals.scope2LocationBasedKgCo2e;
                  const prevS2 = previousInventory?.result.totals.scope2LocationBasedKgCo2e;
                  const delta = calcDelta(s2Val, prevS2);
                  const sourcesCount = (inventory.activitySnapshot as ActivitySnapshotRow[]).filter((r) => r.scope === "scope2").length;
                  return (
                    <section className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-xs transition-shadow hover:shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Zap className="h-4 w-4 text-sky-500" />
                          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Scope 2 · Location-based
                          </h2>
                        </div>
                        {delta !== null ? (
                          <span
                            className={`inline-flex items-center text-[11px] font-medium ${
                              delta <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {delta <= 0 ? <TrendingDown className="mr-0.5 h-3 w-3" /> : <TrendingUp className="mr-0.5 h-3 w-3" />}
                            {delta > 0 ? "+" : ""}
                            {delta.toFixed(1)}%
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-2xl font-bold text-foreground">{fmt(s2Val)}</p>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{fmtKg(s2Val)}</p>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Tỷ trọng: <strong>{s2LocShare.toFixed(1)}%</strong></span>
                        <span>{sourcesCount} nguồn điện lưới</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: `${s2LocShare}%` }} />
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                        Điện lưới tính theo hệ số lưới điện quốc gia (EVN / MoNRE).
                      </p>
                    </section>
                  );
                })()}

                {/* Scope 2 Market-based */}
                {(() => {
                  const s2mVal = inventory.result.totals.scope2MarketBasedKgCo2e;
                  const s2locVal = inventory.result.totals.scope2LocationBasedKgCo2e;
                  const hasMarket = s2mVal != null && Number.isFinite(s2mVal);
                  const diff = hasMarket ? s2mVal - s2locVal : null;
                  return (
                    <section className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-xs transition-shadow hover:shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Leaf className="h-4 w-4 text-emerald-500" />
                          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Scope 2 · Market-based
                          </h2>
                        </div>
                        {hasMarket ? (
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            {diff !== null && diff < 0 ? `Giảm ${(-diff / 1000).toFixed(2)} tCO₂e` : "Đã hạch toán"}
                          </span>
                        ) : (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            Chưa có I-REC/PPA
                          </span>
                        )}
                      </div>
                      <p className="mt-3 text-2xl font-bold text-foreground">
                        {hasMarket ? fmt(s2mVal) : "Chưa áp dụng"}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        {hasMarket ? fmtKg(s2mVal) : "Không có hợp đồng năng lượng sạch"}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Phương pháp: <strong>Hợp đồng thị trường</strong></span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: hasMarket ? `${Math.min(100, (s2mVal / (s2locVal || 1)) * 100)}%` : "0%" }}
                        />
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                        Hợp đồng mua bán điện DPPA hoặc chứng chỉ I-REC có kiểm toán.
                      </p>
                    </section>
                  );
                })()}

                {/* Scope 3 */}
                {(() => {
                  const s3Val = inventory.result.totals.scope3KgCo2e;
                  const prevS3 = previousInventory?.result.totals.scope3KgCo2e;
                  const delta = calcDelta(s3Val, prevS3);
                  const sourcesCount = (inventory.activitySnapshot as ActivitySnapshotRow[]).filter((r) => r.scope === "scope3").length;
                  return (
                    <section className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-xs transition-shadow hover:shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-4 w-4 text-purple-500" />
                          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Scope 3 · Chuỗi giá trị
                          </h2>
                        </div>
                        {delta !== null ? (
                          <span
                            className={`inline-flex items-center text-[11px] font-medium ${
                              delta <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {delta <= 0 ? <TrendingDown className="mr-0.5 h-3 w-3" /> : <TrendingUp className="mr-0.5 h-3 w-3" />}
                            {delta > 0 ? "+" : ""}
                            {delta.toFixed(1)}%
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-2xl font-bold text-foreground">{fmt(s3Val)}</p>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{fmtKg(s3Val)}</p>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Tỷ trọng: <strong>{s3Share.toFixed(1)}%</strong></span>
                        <span>{sourcesCount} nguồn chuỗi giá trị</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-purple-500" style={{ width: `${s3Share}%` }} />
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                        Nguyên vật liệu, vận chuyển thượng/hạ nguồn, xử lý chất thải.
                      </p>
                    </section>
                  );
                })()}
              </div>

              {/* Emissions Composition Bar & Dual Scope 2 Comparison */}
              <div className="grid gap-4 lg:grid-cols-3">
                {/* Stacked Composition Bar */}
                <section className="rounded-xl border border-border bg-card p-5 lg:col-span-2 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-foreground">Cơ cấu phát thải tổng hợp</h3>
                      <p className="text-xs text-muted-foreground">
                        Phân bổ tỷ trọng theo Scope 1, Scope 2 (Location-based) và Scope 3
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground">Tổng định lượng:</span>
                      <p className="text-base font-bold text-foreground">{fmt(totalQuantifiedKg)}</p>
                    </div>
                  </div>

                  {/* Multi-segment stacked bar */}
                  <div className="mt-4">
                    <div className="h-4 w-full overflow-hidden rounded-full bg-muted flex p-0.5 gap-1">
                      {s1Share > 0 && (
                        <div
                          className="h-full rounded-l-full bg-amber-500 transition-all duration-300"
                          style={{ width: `${s1Share}%` }}
                          title={`Scope 1: ${s1Share.toFixed(1)}%`}
                        />
                      )}
                      {s2LocShare > 0 && (
                        <div
                          className="h-full bg-sky-500 transition-all duration-300"
                          style={{ width: `${s2LocShare}%` }}
                          title={`Scope 2 Location: ${s2LocShare.toFixed(1)}%`}
                        />
                      )}
                      {s3Share > 0 && (
                        <div
                          className="h-full rounded-r-full bg-purple-500 transition-all duration-300"
                          style={{ width: `${s3Share}%` }}
                          title={`Scope 3: ${s3Share.toFixed(1)}%`}
                        />
                      )}
                    </div>

                    {/* Legend */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/60">
                      <div className="flex items-start gap-2">
                        <span className="mt-1 h-3 w-3 rounded-full bg-amber-500 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-foreground">Scope 1 (Trực tiếp)</p>
                          <p className="text-sm font-semibold">{s1Share.toFixed(1)}%</p>
                          <p className="text-[11px] text-muted-foreground">{fmt(inventory.result.totals.scope1KgCo2e)}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="mt-1 h-3 w-3 rounded-full bg-sky-500 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-foreground">Scope 2 (Location-based)</p>
                          <p className="text-sm font-semibold">{s2LocShare.toFixed(1)}%</p>
                          <p className="text-[11px] text-muted-foreground">{fmt(inventory.result.totals.scope2LocationBasedKgCo2e)}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="mt-1 h-3 w-3 rounded-full bg-purple-500 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-foreground">Scope 3 (Chuỗi giá trị)</p>
                          <p className="text-sm font-semibold">{s3Share.toFixed(1)}%</p>
                          <p className="text-[11px] text-muted-foreground">{fmt(inventory.result.totals.scope3KgCo2e)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Dual-Reporting Scope 2 Assessment */}
                <section className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-primary">
                      <Scale className="h-4 w-4" />
                      <h3 className="font-semibold text-foreground">Đánh giá Hạch toán kép Scope 2</h3>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Chuẩn mực GHG Protocol yêu cầu trình bày cả 2 phương pháp song song.
                    </p>
                    <div className="mt-4 space-y-2.5 rounded-lg border border-border/70 bg-muted/20 p-3 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Hệ số lưới (Location-based):</span>
                        <strong className="text-foreground">{fmt(inventory.result.totals.scope2LocationBasedKgCo2e)}</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Hợp đồng sạch (Market-based):</span>
                        <strong className="text-foreground">
                          {inventory.result.totals.scope2MarketBasedKgCo2e != null
                            ? fmt(inventory.result.totals.scope2MarketBasedKgCo2e)
                            : "Chưa kích hoạt"}
                        </strong>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg bg-primary/5 p-3 text-[11px] leading-relaxed text-muted-foreground border border-primary/10">
                    💡 <strong>Khuyến nghị:</strong> Áp dụng chứng chỉ I-REC hoặc Hợp đồng mua bán điện trực tiếp (DPPA) để giảm lượng phát thải Scope 2 công bố trên báo cáo ESG / CBAM quốc tế.
                  </div>
                </section>
              </div>

              {/* Detailed Activity Emission Ledger Table */}
              <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-foreground">Sổ kê nguồn phát thải hoạt động (Activity Ledger)</h3>
                    <p className="text-xs text-muted-foreground">
                      Chi tiết từng dòng dữ liệu hoạt động cấu thành snapshot kiểm kê kỳ này ({activityRows.length} nguồn)
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Scope Filter Tabs */}
                    <div className="flex items-center rounded-lg border border-input bg-muted/30 p-1 text-xs">
                      {(
                        [
                          ["all", "Tất cả"],
                          ["scope1", "Scope 1"],
                          ["scope2", "Scope 2"],
                          ["scope3", "Scope 3"],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setLedgerScope(key)}
                          className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                            ledgerScope === key
                              ? "bg-background text-foreground shadow-xs font-semibold"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Search Input */}
                    <div className="relative min-w-[200px]">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Tìm cơ sở, hạng mục..."
                        value={ledgerQuery}
                        onChange={(e) => setLedgerQuery(e.target.value)}
                        className="h-8 pl-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="px-3.5 py-2.5 font-semibold">Phạm vi (Scope)</th>
                        <th className="px-3.5 py-2.5 font-semibold">Cơ sở (Facility)</th>
                        <th className="px-3.5 py-2.5 font-semibold">Hạng mục (Category)</th>
                        <th className="px-3.5 py-2.5 font-semibold">Phương pháp</th>
                        <th className="px-3.5 py-2.5 font-semibold text-right">Phát thải (tCO₂e)</th>
                        <th className="px-3.5 py-2.5 font-semibold text-right">Khối lượng (kgCO₂e)</th>
                        <th className="px-3.5 py-2.5 font-semibold text-right">Tỷ trọng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {activityRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                            Không tìm thấy nguồn phát thải nào khớp với bộ lọc hiện tại.
                          </td>
                        </tr>
                      ) : (
                        activityRows.map((row, idx) => {
                          const kg = typeof row.calculatedCo2eKg === "number" ? row.calculatedCo2eKg : 0;
                          const share = totalQuantifiedKg > 0 ? (kg / totalQuantifiedKg) * 100 : 0;
                          const scope = String(row.scope || "");
                          return (
                            <tr key={`${row.facilityReference}:${row.category}:${idx}`} className="hover:bg-muted/30">
                              <td className="px-3.5 py-2.5">
                                <span
                                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${
                                    scope === "scope1"
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                                      : scope === "scope2"
                                      ? "bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300"
                                      : "bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300"
                                  }`}
                                >
                                  {scope === "scope1" ? "Scope 1" : scope === "scope2" ? "Scope 2" : "Scope 3"}
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 font-medium text-foreground">
                                {String(row.facilityReference || "—")}
                              </td>
                              <td className="px-3.5 py-2.5 text-foreground">
                                {String(row.category || "Chưa phân loại")}
                              </td>
                              <td className="px-3.5 py-2.5 text-muted-foreground">
                                {String(row.accountingMethod || "tiêu chuẩn")}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-semibold text-foreground">
                                {(kg / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 3 })}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono text-muted-foreground">
                                {kg.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-medium">
                                <div className="flex items-center justify-end gap-1.5">
                                  <span>{share.toFixed(1)}%</span>
                                  <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className={`h-full rounded-full ${
                                        scope === "scope1"
                                          ? "bg-amber-500"
                                          : scope === "scope2"
                                          ? "bg-sky-500"
                                          : "bg-purple-500"
                                      }`}
                                      style={{ width: `${Math.min(100, share)}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {activityRows.length > 0 && (
                      <tfoot className="border-t border-border bg-muted/20 font-semibold text-foreground">
                        <tr>
                          <td colSpan={4} className="px-3.5 py-2.5">
                            Tổng các nguồn lọc được ({activityRows.length} nguồn)
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            {(
                              activityRows.reduce((acc, r) => acc + (typeof r.calculatedCo2eKg === "number" ? r.calculatedCo2eKg : 0), 0) / 1000
                            ).toLocaleString("vi-VN", { maximumFractionDigits: 3 })}{" "}
                            tCO₂e
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-xs">
                            {activityRows
                              .reduce((acc, r) => acc + (typeof r.calculatedCo2eKg === "number" ? r.calculatedCo2eKg : 0), 0)
                              .toLocaleString("vi-VN", { maximumFractionDigits: 1 })}{" "}
                            kg
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            {(
                              (activityRows.reduce((acc, r) => acc + (typeof r.calculatedCo2eKg === "number" ? r.calculatedCo2eKg : 0), 0) /
                                (totalQuantifiedKg || 1)) *
                              100
                            ).toFixed(1)}
                            %
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    Hiển thị <strong>{activityRows.length}</strong> /{" "}
                    {(inventory.activitySnapshot as ActivitySnapshotRow[]).length} nguồn phát sinh
                  </span>
                  <Link
                    href={routes.toAppPath("/activity-data")}
                    className="inline-flex items-center text-primary hover:underline font-medium"
                  >
                    Xem chi tiết dữ liệu hoạt động gốc <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </div>
              </section>

              {/* Dual Scope 2 Note */}
              <div className="rounded-xl border border-border/80 bg-muted/20 p-4 text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Ghi chú hạch toán kép (Dual Scope 2 Reporting):</span> Hệ số Location-based phản ánh cường độ lưới điện Việt Nam (MoNRE / EVN). Hệ số Market-based chỉ áp dụng khi doanh nghiệp có hợp đồng PPA hoặc chứng chỉ năng lượng tái tạo (I-REC) có kiểm toán.
              </div>
            </div>
          ) : (
            /* Hotspots Mode */
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <section className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Điểm nóng phát thải lớn nhất</h3>
                  <p className="mt-2 text-xl font-bold text-primary truncate">{hotspots?.rows[0]?.label || "Chưa xác định"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {hotspots?.rows[0] && hotspots.totalKg > 0
                      ? `${((hotspots.rows[0].kg / hotspots.totalKg) * 100).toFixed(1)}% tổng phát thải`
                      : "Cần thêm dữ liệu"}
                  </p>
                </section>
                <section className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Độ bao phủ Top 5 Hotspots</h3>
                  <p className="mt-2 text-xl font-bold text-foreground">
                    {hotspots?.rows?.length && hotspots.totalKg > 0
                      ? `${Math.min(
                          100,
                          hotspots.rows.slice(0, 5).reduce((acc, r) => acc + (r.kg / hotspots.totalKg) * 100, 0)
                        ).toFixed(1)}%`
                      : "0%"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Tập trung nguồn lực giảm thiểu ưu tiên</p>
                </section>
                <section className="rounded-xl border border-border bg-card p-4">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">Tổng phát thải phân tích</h3>
                  <p className="mt-2 text-xl font-bold text-foreground">{fmt(hotspots?.totalKg || 0)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {demo ? "Theo kỳ kiểm kê giả định · chưa duyệt" : "Theo kỳ báo cáo đã chốt"}
                  </p>
                </section>
              </div>

              <section className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-semibold">Phân bổ nguồn trong snapshot</h2>
                  <select
                    aria-label="Nhóm hotspot"
                    value={groupBy}
                    onChange={(event) => setGroupBy(event.target.value as typeof groupBy)}
                    className="rounded-lg border border-input bg-background p-2 text-sm"
                  >
                    <option value="facility">Theo cơ sở</option>
                    <option value="category">Theo loại nguồn</option>
                  </select>
                </div>
                {!hotspots?.rows.length ? (
                  <EmptyWorkspace>Snapshot chưa có source line đủ dữ liệu cho phân tích này.</EmptyWorkspace>
                ) : (
                  <div className="mt-6 space-y-5">
                    {hotspots.rows.map((row) => (
                      <div key={row.label}>
                        <div className="mb-2 flex justify-between gap-3 text-sm">
                          <span className="font-medium">{row.label}</span>
                          <strong>{fmt(row.kg)}</strong>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${hotspots.totalKg > 0 ? (row.kg / hotspots.totalKg) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-5 text-xs leading-5 text-muted-foreground">
                  Dùng Scope 2 location-based, không cộng thêm market-based. {hotspots?.excludedSources || 0} source line ngoài cách hạch toán này hoặc thiếu số định lượng bị loại khỏi biểu đồ.
                </p>
              </section>
            </div>
          )}

          {/* Audit Findings, Limitations and Tamper-Proof Cryptographic Hash */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Finding và giới hạn kiểm toán</h2>
              <span className="text-xs text-muted-foreground">
                {inventory.result.findings.length} ghi nhận rà soát
              </span>
            </div>
            <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              {inventory.result.findings.map((item, index) => (
                <li
                  key={`${item.code}:${index}`}
                  className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs"
                >
                  <span className="shrink-0 mt-0.5">
                    {item.severity === "blocker" ? (
                      <AlertOctagon className="h-4 w-4 text-destructive" />
                    ) : item.severity === "warning" ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Info className="h-4 w-4 text-sky-500" />
                    )}
                  </span>
                  <div className="flex-1">
                    <span className="font-medium text-foreground">
                      {item.severity} · {item.code}:
                    </span>{" "}
                    <span>{item.message}</span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground leading-relaxed border-t border-border/60 pt-3">
              {inventory.result.disclaimer}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-2.5 font-mono text-xs text-muted-foreground">
              <span className="break-all">Result SHA-256: {inventory.resultSha256}</span>
              <button
                type="button"
                onClick={copyHash}
                className="inline-flex items-center gap-1 text-[11px] font-sans font-medium text-primary hover:underline"
              >
                {copiedHash ? "Đã sao chép" : "Sao chép mã"}
              </button>
            </div>
          </section>
        </>
      )}
    </WorkspaceFrame>
  );
}
