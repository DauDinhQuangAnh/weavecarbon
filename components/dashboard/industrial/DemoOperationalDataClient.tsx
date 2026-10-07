"use client";

import { useState } from "react";
import { DEMO_FACTORS, DEMO_INVENTORIES, DEMO_MEASUREMENT_POINTS, INDUSTRIAL_DEMO, demoActivityLineage } from "@/lib/dashboard/industrialDemoData";
import { latestInventoryRevisions } from "@/lib/dashboard/industrialWorkspace";
import WorkspaceFrame from "./WorkspaceFrame";

type Mode = "quality" | "vietnam" | "connected";
const titles: Record<Mode, string> = { quality: "Chất lượng dữ liệu", vietnam: "Carbon Việt Nam", connected: "WeaveNode · dữ liệu kết nối" };
const descriptions: Record<Mode, string> = {
  quality: "Tình huống minh họa mức chất lượng, bằng chứng còn thiếu và hệ số chờ rà soát. DQL không chứng minh thẩm tra độc lập.",
  vietnam: "Tình huống chuẩn bị kiểm kê và kế hoạch đo tại cơ sở. Không có hồ sơ đã nộp hoặc được cơ quan tiếp nhận nghiệm thu.",
  connected: "Mô phỏng điểm đo và bản đọc để giới thiệu luồng dữ liệu. Không có kết nối thiết bị thật hoặc chứng nhận hiệu chuẩn thật.",
};
const format = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 3 });

export default function DemoOperationalDataClient({ mode }: { mode: Mode }) {
  const [selected, setSelected] = useState("");
  const inventories = latestInventoryRevisions(DEMO_INVENTORIES);
  const activity = INDUSTRIAL_DEMO.activities.find(row => row.id === selected) || INDUSTRIAL_DEMO.activities[0];
  const lineage = demoActivityLineage(activity.id)!;
  const inventory = inventories.find(row => row.id === selected) || inventories[0];
  const point = DEMO_MEASUREMENT_POINTS.find(row => row.id === selected) || DEMO_MEASUREMENT_POINTS[0];
  const pointActivity = INDUSTRIAL_DEMO.activities.find(row => row.measurementPointRevisionId === point.id)!;
  return <WorkspaceFrame title={titles[mode]} description={descriptions[mode]} demo loading={false} error={null} reload={() => setSelected("")}>
    {mode === "quality" && <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Hoạt động minh họa" value={String(INDUSTRIAL_DEMO.activities.length)} />
        <Metric label="Cần bổ sung nguồn L1/L2" value={String(INDUSTRIAL_DEMO.activities.filter(row => ["L1", "L2"].includes(row.dataQualityLevel)).length)} />
        <Metric label="Hệ số chờ rà soát" value={String(DEMO_FACTORS.filter(row => row.governanceStatus !== "approved_for_release_candidate").length)} />
      </div>
      <label className="block text-sm font-medium">Chọn hoạt động đánh giá<select aria-label="Chọn hoạt động đánh giá" className="mt-2 w-full rounded-lg border bg-background p-3" value={activity.id} onChange={event => setSelected(event.target.value)}>{INDUSTRIAL_DEMO.activities.map(row => <option key={row.id} value={row.id}>{row.activityReference} · {row.dataQualityLevel}</option>)}</select></label>
      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Đánh giá nguồn minh họa · {activity.activityReference}</h2>
        <p className="text-sm">Cấp nguồn: {activity.dataQualityLevel} · {format(activity.quantity)} {activity.canonicalUnit}</p>
        <p className="text-sm">Chứng từ liên kết: {lineage.evidence.length} · {lineage.evidence.filter(row => row.status === "locked" && row.checksumSha256).length} chứng từ có trạng thái khóa giả định.</p>
        <p className="text-sm text-muted-foreground">{lineage.evidence.some(row => !row.checksumSha256) ? "Cần bổ sung checksum và kiểm soát chứng từ." : !lineage.evidence.length ? "Cần gắn chứng từ cho hoạt động này." : lineage.evidence.some(row => row.status !== "locked") ? "Chứng từ đang chờ rà soát và khóa." : "Ví dụ đã gắn chứng từ có trạng thái khóa. Vẫn chưa có thẩm tra độc lập."}</p>
        <p className="text-xs text-muted-foreground">Các checksum và trạng thái là ví dụ tổng hợp, không được tạo từ file tải lên.</p>
      </section>
      <section className="space-y-3"><h2 className="font-semibold">Danh mục hệ số minh họa</h2>{DEMO_FACTORS.map(row => <article key={row.id} className="rounded-xl border bg-card p-4"><h3 className="font-medium">{row.label}</h3><p className="mt-2 text-sm">{format(row.factorValue)} {row.unit} · {row.governanceStatus === "approved_for_release_candidate" ? "Đã review nội bộ trong tình huống demo" : "Yêu cầu bổ sung nguồn"}</p><p className="mt-1 text-xs text-muted-foreground">{row.sourceName}</p></article>)}</section>
    </>}
    {mode === "vietnam" && <>
      <label className="block text-sm font-medium">Kỳ kiểm kê minh họa<select aria-label="Kỳ kiểm kê minh họa" className="mt-2 w-full rounded-lg border bg-background p-3" value={inventory.id} onChange={event => setSelected(event.target.value)}>{inventories.map(row => <option key={row.id} value={row.id}>{row.inventoryReference} · v{row.revision}</option>)}</select></label>
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Cơ sở trong tình huống" value={String(INDUSTRIAL_DEMO.facilities.length)} />
        <Metric label="Scope 1 giả định" value={`${format(inventory.result.totals.scope1KgCo2e / 1000)} tCO₂e`} />
        <Metric label="Scope 2 location-based giả định" value={`${format(inventory.result.totals.scope2LocationBasedKgCo2e / 1000)} tCO₂e`} />
      </div>
      <section className="space-y-3 rounded-xl border bg-card p-5"><h2 className="font-semibold">Kế hoạch đo minh họa</h2>{DEMO_MEASUREMENT_POINTS.map(row => <p key={row.id} className="text-sm">{row.measurementPointReference} · {row.facilityReference} · {row.canonicalUnit} · chu kỳ {row.samplingIntervalSeconds} giây</p>)}</section>
      <section className="space-y-3 rounded-xl border bg-card p-5"><h2 className="font-semibold">Việc cần hoàn thiện trong tình huống</h2><ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground"><li>Bổ sung chứng từ nhiên liệu và nhật ký sản xuất.</li><li>Rà soát điểm đo có trạng thái hiệu chuẩn giả định hết hạn.</li><li>Review ranh giới, hệ số và kiểm kê trước khi lập hồ sơ.</li></ul><p className="text-sm">Trạng thái: chờ review nội bộ · chưa nộp hồ sơ.</p></section>
    </>}
    {mode === "connected" && <>
      <div className="grid gap-4 sm:grid-cols-3"><Metric label="Điểm đo mô phỏng" value={String(DEMO_MEASUREMENT_POINTS.length)} /><Metric label="Thiết bị thật kết nối" value="Không có" /><Metric label="Tình huống cần hiệu chuẩn" value={String(DEMO_MEASUREMENT_POINTS.filter(row => row.calibrationStatus === "expired").length)} /></div>
      <label className="block text-sm font-medium">Chọn điểm đo mô phỏng<select aria-label="Chọn điểm đo mô phỏng" className="mt-2 w-full rounded-lg border bg-background p-3" value={point.id} onChange={event => setSelected(event.target.value)}>{DEMO_MEASUREMENT_POINTS.map(row => <option key={row.id} value={row.id}>{row.measurementPointReference} · {row.facilityReference}</option>)}</select></label>
      <section className="space-y-3 rounded-xl border bg-card p-5"><h2 className="font-semibold">{point.measurementPointReference}</h2><p className="text-sm">Mã thiết bị mô phỏng: {point.deviceIdentity}</p><p className="text-sm">Lượng hoạt động giả định trong kỳ: {format(pointActivity.quantity)} {point.canonicalUnit}</p><p className="text-sm">Hiệu chuẩn trong tình huống: {point.calibrationStatus === "expired" ? "Hết hạn · cần rà soát" : "Còn hạn giả định"} · mốc {point.calibrationDueOn}</p><p className="text-sm text-muted-foreground">Nguồn dữ liệu tổng hợp; không phải telemetry trực tiếp. Không gửi lệnh hoặc dữ liệu tới thiết bị.</p></section>
      <section className="overflow-x-auto rounded-xl border bg-card p-5"><h2 className="mb-3 font-semibold">Bản đọc mô phỏng · mẫu hiển thị độc lập</h2><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Thời gian giả định</th><th className="p-2">Lượng tăng trong khoảng</th><th className="p-2">Trạng thái</th></tr></thead><tbody>{[12, 15, 14].map((value, index) => <tr key={index} className="border-t"><td className="p-2 whitespace-nowrap">2026-09-30 · 0{8 + index}:00</td><td className="p-2">{value} {point.canonicalUnit}</td><td className="p-2">Mô phỏng · {point.calibrationStatus === "expired" ? "chờ rà soát" : "chưa nghiệm thu"}</td></tr>)}</tbody></table><p className="mt-3 text-xs text-muted-foreground">Ba bản đọc dùng để minh họa bảng, không dùng cộng vào lượng hoạt động theo tháng.</p></section>
    </>}
  </WorkspaceFrame>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <section className="rounded-xl border bg-card p-5"><h2 className="text-sm text-muted-foreground">{label}</h2><p className="mt-2 text-2xl font-semibold">{value}</p></section>;
}
