"use client";
import { useCallback, useState, type FormEvent } from "react";
import { industrialCoreApi } from "@/lib/industrialCoreApi";
import { WORKSPACE_DEMO, workspaceCanWrite } from "@/lib/dashboard/industrialWorkspace";
import { useIndustrialWorkspaceQuery } from "@/hooks/useIndustrialWorkspaceQuery";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import WorkspaceFrame, { EmptyWorkspace } from "./WorkspaceFrame";

export default function FacilityProcessClient({ mode, demo = false }: { mode: "facilities" | "processes"; demo?: boolean }) {
  const load = useCallback(async () => demo ? WORKSPACE_DEMO : {
    facilities: await industrialCoreApi.facilities(), processes: mode === "processes" ? await industrialCoreApi.processes() : [], activities: [],
  }, [demo, mode]);
  const query = useIndustrialWorkspaceQuery(load, demo);
  const canWrite = workspaceCanWrite(usePermissions(), demo);
  const [search, setSearch] = useState("");
  const [facility, setFacility] = useState("");
  const [form, setForm] = useState({ reference: "", name: "", timezone: "Asia/Ho_Chi_Minh", boundary: "", processType: "production" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const isFacility = mode === "facilities";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || busy) return;
    setBusy(true); setMessage(null);
    try {
      if (isFacility) {
        // Validate the IANA timezone before submitting a facility boundary.
        new Intl.DateTimeFormat("vi", { timeZone: form.timezone.trim() }).format();
        await industrialCoreApi.createFacility({ facilityReference: form.reference.trim(), name: form.name.trim(), countryCode: "VN", timezone: form.timezone.trim(), lifecycleStatus: "active", boundaryNotes: form.boundary.trim() });
      } else {
        if (!query.data?.facilities.some(row => row.id === facility)) throw new Error("Vui lòng chọn cơ sở đang được hiển thị.");
        await industrialCoreApi.createProcess({ facilityRevisionId: facility, processReference: form.reference.trim(), name: form.name.trim(), processType: form.processType.trim(), lifecycleStatus: "active" });
      }
      setForm({ reference: "", name: "", timezone: "Asia/Ho_Chi_Minh", boundary: "", processType: "production" });
      setMessage({ error: false, text: "Đã lưu revision mới. Các revision trước được giữ nguyên." });
      await query.reload();
    } catch (error) { setMessage({ error: true, text: error instanceof Error ? error.message : "Không lưu được dữ liệu." }); }
    finally { setBusy(false); }
  }
  const rows = (isFacility ? query.data?.facilities : query.data?.processes) || [];
  const visible = rows.filter(row => `${row.name} ${"facilityReference" in row ? row.facilityReference : ""} ${"processReference" in row ? row.processReference : ""}`.toLowerCase().includes(search.toLowerCase()) && (isFacility || !facility || ("facilityRevisionId" in row && row.facilityRevisionId === facility)));
  return <WorkspaceFrame title={isFacility ? "Cơ sở sản xuất" : "Quy trình sản xuất"} description="Quản lý danh tính, ranh giới và revision làm nền cho dữ liệu hoạt động. Tạo cùng mã tham chiếu để lưu một revision mới; dữ liệu lịch sử không bị ghi đè." demo={demo} loading={query.loading} error={query.error} reload={query.reload}>
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="space-y-4">
        <Input aria-label="Tìm cơ sở hoặc quy trình" placeholder="Tìm theo tên hoặc mã…" value={search} onChange={event => setSearch(event.target.value)} />
        {!isFacility && <label className="block text-sm">Lọc cơ sở<select className="mt-2 w-full rounded-md border bg-background p-2" value={facility} onChange={event => setFacility(event.target.value)}><option value="">Tất cả cơ sở / chọn để tạo quy trình</option>{query.data?.facilities.map(row => <option key={row.id} value={row.id}>{row.name} · {row.facilityReference} · r{row.revision}</option>)}</select></label>}
        {!visible.length ? <EmptyWorkspace>Chưa có dữ liệu phù hợp. Quản trị viên có thể tạo bản ghi đầu tiên.</EmptyWorkspace> : visible.map(row => <article key={row.id} className="rounded-xl border border-border bg-card p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">{row.name}</h2><span className="text-xs text-muted-foreground">Revision {row.revision} · {row.lifecycleStatus}</span></div><p className="mt-2 text-sm text-primary">{"processReference" in row ? row.processReference : row.facilityReference}</p>{"timezone" in row ? <><p className="mt-2 text-sm text-muted-foreground">{row.countryCode} · {row.timezone}</p><p className="mt-2 text-sm">{row.boundaryNotes || "Chưa khai báo ranh giới"}</p></> : <p className="mt-2 text-sm text-muted-foreground">{row.processType} · {row.facilityReference || row.facilityRevisionId}</p>}</article>)}
      </section>
      <form onSubmit={submit} className="h-fit space-y-4 rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">Tạo revision {isFacility ? "cơ sở" : "quy trình"}</h2>
        {!canWrite && <p className="text-sm text-muted-foreground">Chỉ quản trị viên của doanh nghiệp có quyền ghi và gói đang hoạt động được tạo revision. Demo chỉ đọc.</p>}
        <fieldset disabled={!canWrite || busy} className="space-y-4">
          <label className="block text-sm">Mã tham chiếu<Input required maxLength={120} className="mt-2" value={form.reference} onChange={event => setForm({ ...form, reference: event.target.value })} /></label>
          <label className="block text-sm">Tên<Input required maxLength={240} className="mt-2" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
          {isFacility ? <><label className="block text-sm">Múi giờ IANA<Input required className="mt-2" value={form.timezone} onChange={event => setForm({ ...form, timezone: event.target.value })} /></label><label className="block text-sm">Ranh giới cơ sở<textarea required maxLength={4000} className="mt-2 min-h-24 w-full rounded-md border bg-background p-2" value={form.boundary} onChange={event => setForm({ ...form, boundary: event.target.value })} /></label></> : <label className="block text-sm">Loại quy trình<Input required maxLength={120} className="mt-2" value={form.processType} onChange={event => setForm({ ...form, processType: event.target.value })} /></label>}
          <Button type="submit" disabled={!isFacility && !facility}>{busy ? "Đang lưu…" : "Lưu revision"}</Button>
        </fieldset>
        {message && <p role={message.error ? "alert" : "status"} className={`text-sm ${message.error ? "text-red-700" : "text-primary"}`}>{message.text}</p>}
      </form>
    </div>
  </WorkspaceFrame>;
}
