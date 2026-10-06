"use client";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { fetchCorporateGhgInventories } from "@/lib/weave-v2/corporateGhgInventoryApi";
import { latestInventoryRevisions, inventoryHotspots, csvText } from "@/lib/dashboard/industrialWorkspace";
import { useIndustrialWorkspaceQuery } from "@/hooks/useIndustrialWorkspaceQuery";
import { useAppRoutes } from "@/lib/demo/routes";
import { Button } from "@/components/ui/button";
import WorkspaceFrame, { EmptyWorkspace } from "./WorkspaceFrame";

const fmt = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? "Chưa định lượng" : (value / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 3 }) + " tCO₂e";
export default function CarbonInsightsClient({ mode, demo = false }: { mode: "emissions" | "hotspots"; demo?: boolean }) {
  const routes = useAppRoutes();
  const load = useCallback(() => demo ? Promise.resolve([]) : fetchCorporateGhgInventories(), [demo]);
  const query = useIndustrialWorkspaceQuery(load, demo);
  const [selectedId, setSelectedId] = useState("");
  const [groupBy, setGroupBy] = useState<"facility" | "category">("facility");
  const inventories = useMemo(() => latestInventoryRevisions(query.data || []), [query.data]);
  const inventory = inventories.find(row => row.id === selectedId) || inventories[0];
  const hotspots = inventory ? inventoryHotspots(inventory, groupBy) : null;
  const download = () => {
    if (!inventory) return;
    const rows = mode === "hotspots" ? [["Nguồn", "kgCO2e", "Inventory", "Revision", "Kỳ bắt đầu", "Kỳ kết thúc"], ...hotspots!.rows.map(row => [row.label, row.kg, inventory.inventoryReference, inventory.revision, inventory.reportingPeriodStart, inventory.reportingPeriodEnd])]
      : [["Inventory", "Revision", "Scope 1 kgCO2e", "Scope 2 location kgCO2e", "Scope 2 market kgCO2e", "Scope 3 kgCO2e", "Trạng thái", "Result SHA256"], [inventory.inventoryReference, inventory.revision, inventory.result.totals.scope1KgCo2e, inventory.result.totals.scope2LocationBasedKgCo2e, inventory.result.totals.scope2MarketBasedKgCo2e, inventory.result.totals.scope3KgCo2e, inventory.inventoryStatus, inventory.resultSha256]];
    const url = URL.createObjectURL(new Blob([csvText(rows)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${mode}-inventory-${inventory.id.replace(/[^a-zA-Z0-9-]/g, "")}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  return <WorkspaceFrame title={mode === "emissions" ? "Phát thải" : "Điểm nóng phát thải"} description="Phân tích snapshot kiểm kê đã lưu theo kỳ và phiên bản. Mỗi lần xem dùng một inventory; không cộng các kỳ hoặc các bản sửa trùng nhau." demo={demo} loading={query.loading} error={query.error} reload={() => void query.reload()}>
    {!inventory ? <EmptyWorkspace>Chưa có snapshot kiểm kê để phân tích. <Link className="text-primary underline" href={routes.toAppPath("/reports")}>Mở Báo cáo</Link> để chuẩn bị inventory. Dữ liệu hoạt động chưa được tính không được coi là phát thải bằng 0.</EmptyWorkspace> : <>
      <div className="flex flex-wrap items-end justify-between gap-3"><label className="min-w-0 flex-1 text-sm font-medium">Inventory và kỳ báo cáo<select aria-label="Chọn inventory" value={inventory.id} onChange={event => setSelectedId(event.target.value)} className="mt-2 block w-full rounded-lg border border-input bg-background p-3">{inventories.map(row => <option key={row.id} value={row.id}>{row.inventoryReference} · v{row.revision} · {row.reportingPeriodStart} → {row.reportingPeriodEnd}</option>)}</select></label><Button variant="outline" onClick={download}><Download className="mr-2 h-4 w-4" />Xuất CSV</Button></div>
      <p className="text-sm text-muted-foreground">Trạng thái inventory: <strong>{inventory.inventoryStatus}</strong> · {inventory.result.inventoryScopeLabel} · {inventory.result.assuranceStatus}</p>
      {mode === "emissions" ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        ["Scope 1", inventory.result.totals.scope1KgCo2e], ["Scope 2 · location-based", inventory.result.totals.scope2LocationBasedKgCo2e],
        ["Scope 2 · market-based", inventory.result.totals.scope2MarketBasedKgCo2e], ["Scope 3", inventory.result.totals.scope3KgCo2e],
      ].map(([label, value]) => <section key={String(label)} className="rounded-xl border border-border bg-card p-5"><h2 className="text-sm text-muted-foreground">{label}</h2><p className="mt-3 text-xl font-semibold">{fmt(value as number | null)}</p></section>)}</div> : <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Phân bổ nguồn trong snapshot</h2><select aria-label="Nhóm hotspot" value={groupBy} onChange={event => setGroupBy(event.target.value as typeof groupBy)} className="rounded-lg border border-input bg-background p-2 text-sm"><option value="facility">Theo cơ sở</option><option value="category">Theo loại nguồn</option></select></div>
        {!hotspots?.rows.length ? <EmptyWorkspace>Snapshot chưa có source line đủ dữ liệu cho phân tích này.</EmptyWorkspace> : <div className="mt-6 space-y-5">{hotspots.rows.map(row => <div key={row.label}><div className="mb-2 flex justify-between gap-3 text-sm"><span>{row.label}</span><strong>{fmt(row.kg)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${hotspots.totalKg > 0 ? row.kg / hotspots.totalKg * 100 : 0}%` }} /></div></div>)}</div>}
        <p className="mt-5 text-xs leading-5 text-muted-foreground">Dùng Scope 2 location-based, không cộng thêm market-based. {hotspots?.excludedSources || 0} source line ngoài cách hạch toán này hoặc thiếu số định lượng bị loại khỏi biểu đồ.</p>
      </section>}
      <section className="rounded-xl border border-border p-5"><h2 className="font-semibold">Finding và giới hạn</h2><ul className="mt-3 space-y-2 text-sm text-muted-foreground">{inventory.result.findings.map((item, index) => <li key={`${item.code}:${index}`}><span className="font-medium text-foreground">{item.severity} · {item.code}:</span> {item.message}</li>)}</ul><p className="mt-4 text-sm text-muted-foreground">{inventory.result.disclaimer}</p><p className="mt-3 break-all font-mono text-xs text-muted-foreground">Result SHA-256: {inventory.resultSha256}</p></section>
    </>}
  </WorkspaceFrame>;
}
