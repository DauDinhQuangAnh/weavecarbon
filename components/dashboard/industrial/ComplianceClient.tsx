"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { industrialCoreApi, INDUSTRIAL_CORE_DEMO_REGISTRY } from "@/lib/industrialCoreApi";
import { useIndustrialWorkspaceQuery } from "@/hooks/useIndustrialWorkspaceQuery";
import { useAppRoutes } from "@/lib/demo/routes";
import WorkspaceFrame from "./WorkspaceFrame";

const TARGETS = [
  { id: "mrv", label: "Kiểm kê & MRV trong nước", path: "/vietnam-carbon", layers: ["domestic-mrv", "data-quality", "evidence"] },
  { id: "pcf", label: "Carbon sản phẩm & yêu cầu người mua", path: "/carbon-operations", layers: ["computation", "industry-rules", "evidence"] },
  { id: "export", label: "Xuất khẩu & truy xuất", path: "/export", layers: ["export", "computation", "evidence"] },
] as const;
const statusLabels = { implemented: "Có chức năng", partial: "Một phần", planned: "Chưa triển khai" };
export default function ComplianceClient({ demo = false }: { demo?: boolean }) {
  const routes = useAppRoutes();
  const [targetId, setTargetId] = useState("mrv");
  const load = useCallback(() => demo ? Promise.resolve(INDUSTRIAL_CORE_DEMO_REGISTRY) : industrialCoreApi.capabilities(), [demo]);
  const query = useIndustrialWorkspaceQuery(load, demo);
  const target = TARGETS.find(item => item.id === targetId)!;
  return <WorkspaceFrame title="Tuân thủ & mức sẵn sàng" description="Đối chiếu nhu cầu sử dụng với registry năng lực hiện có. Trạng thái triển khai phần mềm không phải xác nhận hồ sơ đủ điều kiện nộp, chứng nhận hoặc kết luận pháp lý." demo={demo} loading={query.loading} error={query.error} reload={query.reload}>
    {query.data && <>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">{query.data.truthBoundary}<p className="mt-2">Target requirement registry có version và rà soát chuyên gia vẫn cần hoàn thiện. Các nhóm bên dưới là điều hướng chức năng để chuẩn bị hồ sơ.</p></div>
      <label className="block text-sm">Mục tiêu chuẩn bị<select className="mt-2 w-full rounded-md border bg-background p-3" value={targetId} onChange={event => setTargetId(event.target.value)}>{TARGETS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <div className="grid gap-4 md:grid-cols-3">{target.layers.map(id => {
        const item = query.data!.layers.find(layer => layer.id === id);
        return <article key={id} className="rounded-xl border bg-card p-5"><p className="text-xs font-semibold text-primary">{item ? statusLabels[item.status] : "Chưa có trong registry"}</p><h2 className="mt-3 font-semibold">{item?.label || id}</h2><p className="mt-3 text-sm text-muted-foreground">{item?.nextGate || "Cần xem bằng chứng triển khai và rà soát hồ sơ thực tế."}</p>{item?.evidence?.length ? <ul className="mt-3 list-inside list-disc text-xs text-muted-foreground">{item.evidence.map(text => <li key={text}>{text}</li>)}</ul> : null}</article>;
      })}</div>
      <Link prefetch={false} className="inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" href={routes.toAppPath(target.path)}>Mở {target.label} →</Link>
      <section className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Độ phủ mô hình dữ liệu</h2><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{query.data.entities.map(item => <p key={item.id} className="text-sm"><span className="font-medium">{item.label || item.id}</span> · {statusLabels[item.status]}</p>)}</div></section>
      <p className="break-all text-xs text-muted-foreground">Registry: {query.data.platformVersion} · {query.data.updatedOn} · SHA-256: {query.data.manifestSha256}</p>
    </>}
  </WorkspaceFrame>;
}
