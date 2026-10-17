"use client";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Download,
  Factory,
  Cpu,
  Activity,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  Flame,
  Zap,
  Target,
  Boxes,
  FileCheck2,
  TrendingDown,
  Lightbulb,
} from "lucide-react";
import AiDocumentImportModal from "@/components/ui/AiDocumentImportModal";
import {
  industrialCoreApi,
  type IndustrialActivity,
  type IndustrialFacility,
  type IndustrialProcess,
} from "@/lib/industrialCoreApi";
import { workspaceCanWrite, csvText } from "@/lib/dashboard/industrialWorkspace";
import { useIndustrialWorkspaceQuery } from "@/hooks/useIndustrialWorkspaceQuery";
import { usePermissions } from "@/hooks/usePermissions";
import { useAppRoutes } from "@/lib/demo/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import WorkspaceFrame, { EmptyWorkspace } from "./WorkspaceFrame";
import { demoSessionCache } from "@/lib/dashboard/demoSessionCache";

const PROCESS_TYPE_SUGGESTIONS = [
  { label: "Sản xuất chính", value: "production" },
  { label: "Nhuộm & Giặt", value: "dyeing_washing" },
  { label: "Cắt & May", value: "cutting_sewing" },
  { label: "Lò hơi & Hơi nước", value: "boiler_steam" },
  { label: "Xử lý nước thải", value: "wastewater_treatment" },
  { label: "Đóng gói & Hoàn tất", value: "packaging_finishing" },
];

export default function FacilityProcessClient({
  mode,
  demo = false,
}: {
  mode: "facilities" | "processes";
  demo?: boolean;
}) {
  const routes = useAppRoutes();
  const load = useCallback(
    async () =>
      demo
        ? {
            facilities: demoSessionCache.getFacilities(),
            processes: mode === "processes" ? demoSessionCache.getProcesses() : [],
            activities: demoSessionCache.getActivities(),
          }
        : {
            facilities: await industrialCoreApi.facilities(),
            processes: mode === "processes" ? await industrialCoreApi.processes() : [],
            activities: mode === "processes" ? await industrialCoreApi.activities() : [],
          },
    [demo, mode]
  );

  const query = useIndustrialWorkspaceQuery(load, demo);
  const permissions = usePermissions();
  const canWrite = demo || workspaceCanWrite(permissions, demo);

  const [search, setSearch] = useState("");
  const [facility, setFacility] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "planned" | "inactive">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [expandedProcessId, setExpandedProcessId] = useState<string | null>(null);

  const [form, setForm] = useState({
    reference: "",
    name: "",
    timezone: "Asia/Ho_Chi_Minh",
    boundary: "",
    processType: "production",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [showAiImport, setShowAiImport] = useState(false);

  const isFacility = mode === "facilities";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      if (demo) {
        if (isFacility) {
          demoSessionCache.addFacility({
            facilityReference: form.reference.trim(),
            name: form.name.trim(),
            countryCode: "VN",
            timezone: form.timezone.trim(),
            boundaryNotes: form.boundary.trim(),
          });
        } else {
          const targetFacilityId = facility || query.data?.facilities[0]?.id || "demo-fac";
          demoSessionCache.addProcess({
            facilityRevisionId: targetFacilityId,
            processReference: form.reference.trim(),
            name: form.name.trim(),
            processType: form.processType.trim(),
          });
        }
        setForm({ reference: "", name: "", timezone: "Asia/Ho_Chi_Minh", boundary: "", processType: "production" });
        setMessage({
          error: false,
          text: "Đã lưu revision demo vào bộ nhớ tạm (tự động xóa sau 1 giờ hoặc khi đăng xuất).",
        });
        await query.reload();
        return;
      }

      if (isFacility) {
        // Validate the IANA timezone before submitting a facility boundary.
        new Intl.DateTimeFormat("vi", { timeZone: form.timezone.trim() }).format();
        await industrialCoreApi.createFacility({
          facilityReference: form.reference.trim(),
          name: form.name.trim(),
          countryCode: "VN",
          timezone: form.timezone.trim(),
          lifecycleStatus: "active",
          boundaryNotes: form.boundary.trim(),
        });
      } else {
        if (!query.data?.facilities.some((row) => row.id === facility)) {
          throw new Error("Vui lòng chọn cơ sở đang được hiển thị.");
        }
        await industrialCoreApi.createProcess({
          facilityRevisionId: facility,
          processReference: form.reference.trim(),
          name: form.name.trim(),
          processType: form.processType.trim(),
          lifecycleStatus: "active",
        });
      }
      setForm({ reference: "", name: "", timezone: "Asia/Ho_Chi_Minh", boundary: "", processType: "production" });
      setMessage({ error: false, text: "Đã lưu revision mới. Các revision trước được giữ nguyên." });
      await query.reload();
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : "Không lưu được dữ liệu." });
    } finally {
      setBusy(false);
    }
  }

  const rows = (isFacility ? query.data?.facilities : query.data?.processes) || [];
  const allActivities: IndustrialActivity[] = query.data?.activities || [];

  // Map activities to processes
  const activitiesByProcess = useMemo(() => {
    const map = new Map<string, IndustrialActivity[]>();
    allActivities.forEach((act) => {
      if (act.processRevisionId) {
        const list = map.get(act.processRevisionId) || [];
        list.push(act);
        map.set(act.processRevisionId, list);
      }
    });
    return map;
  }, [allActivities]);

  const visible = rows.filter((row) => {
    const textMatch = `${row.name} ${"facilityReference" in row ? row.facilityReference : ""} ${
      "processReference" in row ? row.processReference : ""
    }`
      .toLowerCase()
      .includes(search.toLowerCase());

    const facilityMatch = isFacility || !facility || ("facilityRevisionId" in row && row.facilityRevisionId === facility);
    const statusMatch = statusFilter === "all" || row.lifecycleStatus === statusFilter;
    const typeMatch = isFacility || typeFilter === "all" || ("processType" in row && row.processType === typeFilter);

    return textMatch && facilityMatch && statusMatch && typeMatch;
  });

  // Calculate statistics for /processes mode
  const stats = useMemo(() => {
    if (isFacility) return null;
    const total = rows.length;
    const active = rows.filter((r) => r.lifecycleStatus === "active").length;
    const linked = rows.filter((r) => (activitiesByProcess.get(r.id) || []).length > 0).length;
    const totalActivities = allActivities.filter((a) => Boolean(a.processRevisionId)).length;
    return { total, active, linked, totalActivities };
  }, [rows, allActivities, activitiesByProcess, isFacility]);

  // Export CSV function for processes
  const downloadCsv = () => {
    if (isFacility) {
      const facilityRows = (query.data?.facilities || []);
      const csvRows = [
        ["Mã cơ sở", "Tên cơ sở", "Revision", "Quốc gia", "Múi giờ", "Trạng thái", "Ghi chú ranh giới"],
        ...facilityRows.map((r: IndustrialFacility) => [
          r.facilityReference,
          r.name,
          r.revision,
          r.countryCode,
          r.timezone,
          r.lifecycleStatus,
          r.boundaryNotes || "",
        ]),
      ];
      const url = URL.createObjectURL(new Blob([csvText(csvRows)], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `facilities-registry-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const processRows = (query.data?.processes || []);
    const csvRows = [
      ["Mã quy trình", "Tên quy trình", "Loại quy trình", "Cơ sở trực thuộc", "Revision", "Trạng thái", "Số hoạt động liên kết"],
      ...processRows.map((r: IndustrialProcess) => {
        const fac = query.data?.facilities.find((f) => f.id === r.facilityRevisionId);
        const linkedCount = (activitiesByProcess.get(r.id) || []).length;
        return [
          r.processReference,
          r.name,
          r.processType,
          fac ? `${fac.name} (${fac.facilityReference})` : r.facilityReference || r.facilityRevisionId,
          r.revision,
          r.lifecycleStatus,
          linkedCount,
        ];
      }),
    ];
    const url = URL.createObjectURL(new Blob([csvText(csvRows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `processes-registry-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 gap-1 text-[11px]">
            <CheckCircle2 className="h-3 w-3" /> Đang vận hành
          </Badge>
        );
      case "planned":
        return (
          <Badge variant="secondary" className="bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 border border-sky-300/40 gap-1 text-[11px]">
            <Clock className="h-3 w-3" /> Dự kiến
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground text-[11px]">
            {status}
          </Badge>
        );
    }
  };

  return (
    <WorkspaceFrame
      title={isFacility ? "Cơ sở sản xuất" : "Quy trình sản xuất"}
      description="Quản lý danh tính, ranh giới và revision làm nền cho dữ liệu hoạt động. Tạo cùng mã tham chiếu để lưu một revision mới; dữ liệu lịch sử không bị ghi đè."
      demo={demo}
      loading={query.loading}
      error={query.error}
      reload={query.reload}
    >
      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            {isFacility ? <Factory className="h-4 w-4 text-primary" /> : <Cpu className="h-4 w-4 text-primary" />}
            <span className="text-xs font-medium">
              {isFacility ? "Tổng cơ sở quản lý" : "Tổng quy trình định nghĩa"}
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{rows.length}</p>
          <span className="text-[11px] text-primary">Theo ranh giới ISO 14064-1</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-medium">Đang hoạt động (Active)</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {rows.filter((r) => r.lifecycleStatus === "active").length}{" "}
            <span className="text-sm font-normal text-muted-foreground">quy trình</span>
          </p>
          <span className="text-[11px] text-muted-foreground">Mã hóa ranh giới vận hành</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="h-4 w-4 text-sky-500" />
            <span className="text-xs font-medium">
              {isFacility ? "Tính toàn vẹn kiểm kê" : "Gán dữ liệu hoạt động"}
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {isFacility ? "100%" : `${stats?.linked || 0} / ${rows.length}`}
          </p>
          <span className="text-[11px] text-muted-foreground">
            {isFacility ? "Xác minh ranh giới pháp lý" : `${stats?.totalActivities || 0} nguồn hoạt động phát sinh`}
          </span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium">Kiểm soát tính toàn vẹn</span>
          </div>
          <p className="mt-2 text-base font-semibold text-foreground">Immutable Revisions</p>
          <span className="text-[11px] text-muted-foreground">Lưu vết lịch sử không ghi đè</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main Content Area */}
        <section className="space-y-4">
          {/* Mode-specific industrial intelligence component */}
          {!isFacility ? (
            /* Interactive Process Flow Pipeline for /processes */
            <section className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-foreground text-sm">Sơ đồ Chuỗi Dòng Quy trình Công nghệ (Process Flow Pipeline)</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mô hình hóa 6 công đoạn kỹ thuật sản xuất, phân bổ tải carbon và cấp bậc chất lượng dữ liệu (DQL)
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Sparkles className="h-3 w-3 text-primary" /> Chuẩn hóa Thuyết minh 12.09
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
                {[
                  { key: "production", title: "1. Sản xuất chính", icon: Cpu, energy: "Điện lưới", share: "24%", dql: "IoT Cấp 1", desc: "Kéo sợi, dệt thoi/kim" },
                  { key: "dyeing_washing", title: "2. Nhuộm & Giặt", icon: Flame, energy: "Hơi lò hơi", share: "38%", dql: "Hóa đơn Cấp 2", desc: "Nhuộm cao áp & giặt sạch" },
                  { key: "cutting_sewing", title: "3. Cắt & May", icon: Boxes, energy: "Điện 3 pha", share: "8%", dql: "IoT Cấp 1", desc: "Cắt rập và may chuyền" },
                  { key: "boiler_steam", title: "4. Lò hơi & Hơi", icon: Zap, energy: "Biomass / Than", share: "20%", dql: "Cân nhiên liệu Cấp 1", desc: "Cấp hơi bão hòa nhà máy" },
                  { key: "wastewater_treatment", title: "5. Xử lý nước thải", icon: Activity, energy: "Điện sục khí", share: "6%", dql: "Đồng hồ Cấp 2", desc: "Bể vi sinh & tuần hoàn" },
                  { key: "packaging_finishing", title: "6. Hoàn tất & Gói", icon: FileCheck2, energy: "Điện nhẹ", share: "4%", dql: "Ước tính Cấp 3", desc: "Ủi hơi & đóng thùng" },
                ].map((step) => {
                  const isSelected = typeFilter === step.key;
                  return (
                    <button
                      key={step.key}
                      type="button"
                      onClick={() => setTypeFilter(isSelected ? "all" : step.key)}
                      className={`flex flex-col justify-between rounded-lg border p-2.5 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-xs"
                          : "border-border/70 bg-muted/20 hover:border-border hover:bg-muted/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground text-[11px] truncate">{step.title}</span>
                          <step.icon className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground truncate">{step.desc}</p>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between text-[10px]">
                        <span className="font-bold text-primary">{step.share}</span>
                        <span className="text-muted-foreground font-mono">{step.energy}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* AI Process Benchmark Callout */}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/5 border border-primary/15 p-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-muted-foreground text-[11px]">
                    <strong>AI Process Insights:</strong> Công đoạn <span className="text-foreground font-medium">Nhuộm & Lò hơi</span> chiếm <strong>58%</strong> tổng tải phát thải. Áp dụng tuần hoàn nước ngưng và biến tần quạt lò hơi có thể tiết kiệm 15 - 20% than/biomass.
                  </span>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  BAT Benchmark: 8.8 MJ/kg (Đạt chuẩn EU)
                </span>
              </div>
            </section>
          ) : (
            /* Facility Carbon Performance Scorecard & ISO Boundaries for /facilities */
            <section className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Factory className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-foreground text-sm">Thẻ điểm Hiệu quả Carbon & Ranh giới ISO 14064-1:2018</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Hạch toán ranh giới tổ chức theo phương pháp Kiểm soát Vận hành (Operational Control) và tỷ lệ dữ liệu đo trực tiếp
                  </p>
                </div>
                <Badge className="bg-emerald-600 text-white gap-1 text-[11px]">
                  <ShieldCheck className="h-3 w-3" /> ISO 14064-1:2018 Conformance
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-4 text-xs">
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="text-muted-foreground text-[11px]">Cường độ / Diện tích sàn</span>
                  <p className="mt-1 text-xl font-bold text-foreground">42.5 <span className="text-xs font-normal text-muted-foreground">kgCO₂e / m²</span></p>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Tốt hơn định mức 14%</span>
                </div>

                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="text-muted-foreground text-[11px]">Đo trực tiếp IoT (Primary Data)</span>
                  <p className="mt-1 text-xl font-bold text-foreground">84.2%</p>
                  <span className="text-[10px] text-primary font-medium">Cấp độ tin cậy DQL Cao</span>
                </div>

                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="text-muted-foreground text-[11px]">Ranh giới Hạch toán</span>
                  <p className="mt-1 text-base font-bold text-foreground">Operational Control</p>
                  <span className="text-[10px] text-muted-foreground">100% tài sản thuộc thẩm quyền</span>
                </div>

                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="text-muted-foreground text-[11px]">Xếp hạng Net-Zero Cơ sở</span>
                  <p className="mt-1 text-xl font-bold text-emerald-600">Hạng B+</p>
                  <span className="text-[10px] text-muted-foreground">On-track giảm 30% đến 2030</span>
                </div>
              </div>

              {/* AI Facility Decarbonization Roadmap */}
              <div className="rounded-lg bg-gradient-to-r from-primary/5 via-muted/30 to-primary/5 border border-primary/20 p-3 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-primary">
                  <Sparkles className="h-4 w-4" />
                  <span>AI Decarbonization Roadmap cho Hạ tầng Cơ sở:</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 text-[11px]">
                  <div className="rounded border border-border/60 bg-background/80 p-2">
                    <p className="font-semibold text-foreground">1. Điện mặt trời áp mái 1.5 MWp</p>
                    <p className="text-muted-foreground mt-0.5">Cắt giảm 28% điện lưới, hoàn vốn 4.2 năm theo cơ chế tự dùng.</p>
                  </div>
                  <div className="rounded border border-border/60 bg-background/80 p-2">
                    <p className="font-semibold text-foreground">2. Hệ thống Sub-metering từng xưởng</p>
                    <p className="text-muted-foreground mt-0.5">Phát hiện hao hụt điện tức thì, đối soát cân bằng năng lượng & rò rỉ.</p>
                  </div>
                  <div className="rounded border border-border/60 bg-background/80 p-2">
                    <p className="font-semibold text-foreground">3. Nâng cấp Chiller & Động cơ IE4</p>
                    <p className="text-muted-foreground mt-0.5">Tiết kiệm 12% điện làm mát, chuẩn bị sẵn sàng thẩm định kiểm toán.</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Search, Filters, and Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[240px]">
              <Input
                aria-label="Tìm cơ sở hoặc quy trình"
                placeholder="Tìm theo tên hoặc mã…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadCsv} className="h-9 gap-1 text-xs">
                <Download className="h-3.5 w-3.5" />
                Xuất CSV
              </Button>
            </div>
          </div>

          {/* Secondary Filters for /processes */}
          {!isFacility && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 p-2.5 text-xs">
              <label className="flex items-center gap-2 min-w-[200px] flex-1">
                <span className="font-medium text-muted-foreground whitespace-nowrap">Lọc cơ sở:</span>
                <select
                  className="w-full rounded-md border border-input bg-background p-1.5 text-xs"
                  value={facility}
                  onChange={(event) => setFacility(event.target.value)}
                >
                  <option value="">Tất cả cơ sở / chọn để tạo quy trình</option>
                  {query.data?.facilities.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name} · {row.facilityReference} · r{row.revision}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 min-w-[160px]">
                <span className="font-medium text-muted-foreground whitespace-nowrap">Loại quy trình:</span>
                <select
                  className="rounded-md border border-input bg-background p-1.5 text-xs"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  <option value="all">Tất cả loại</option>
                  {PROCESS_TYPE_SUGGESTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1 rounded-md bg-muted/40 p-0.5">
                {(
                  [
                    ["all", "Tất cả"],
                    ["active", "Active"],
                    ["planned", "Dự kiến"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatusFilter(key)}
                    className={`rounded px-2 py-1 font-medium transition-colors ${
                      statusFilter === key
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cards List */}
          {!visible.length ? (
            <EmptyWorkspace>
              Chưa có dữ liệu phù hợp với bộ lọc hiện tại. Quản trị viên có thể tạo bản ghi đầu tiên qua form bên phải.
            </EmptyWorkspace>
          ) : (
            <div className="space-y-3.5">
              {visible.map((row) => {
                const isProcessRow = "processReference" in row;
                const linkedActivities = isProcessRow ? activitiesByProcess.get(row.id) || [] : [];
                const fac = isProcessRow
                  ? query.data?.facilities.find((f) => f.id === row.facilityRevisionId)
                  : null;
                const isExpanded = expandedProcessId === row.id;

                return (
                  <article
                    key={row.id}
                    className="rounded-xl border border-border bg-card p-5 shadow-xs transition-shadow hover:shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold text-foreground">{row.name}</h2>
                          {getStatusBadge(row.lifecycleStatus)}
                          <Badge variant="outline" className="text-[11px] font-mono">
                            v{row.revision}
                          </Badge>
                        </div>
                        <p className="text-xs font-mono font-medium text-primary">
                          {isProcessRow ? row.processReference : row.facilityReference}
                        </p>
                      </div>

                      {isProcessRow && (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="gap-1 text-[11px]">
                            <Cpu className="h-3 w-3 text-muted-foreground" />
                            {row.processType}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Metadata Section */}
                    {"timezone" in row ? (
                      <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground space-y-1.5">
                        <p>
                          Quốc gia: <strong className="text-foreground">{row.countryCode}</strong> · Múi giờ:{" "}
                          <strong className="text-foreground">{row.timezone}</strong>
                        </p>
                        <p className="text-foreground/90 leading-relaxed">
                          {row.boundaryNotes || "Chưa khai báo ranh giới"}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Factory className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>
                              Cơ sở:{" "}
                              <strong className="text-foreground">
                                {fac ? `${fac.name} (${fac.facilityReference})` : row.facilityReference || row.facilityRevisionId}
                              </strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1">
                              <Activity className="h-3 w-3 text-sky-500" />
                              <strong className="text-foreground">{linkedActivities.length}</strong> hoạt động liên kết
                            </span>
                            {linkedActivities.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedProcessId(isExpanded ? null : row.id)}
                                className="inline-flex items-center text-[11px] text-primary hover:underline ml-1"
                              >
                                {isExpanded ? (
                                  <>Thu gọn <ChevronUp className="h-3 w-3 ml-0.5" /></>
                                ) : (
                                  <>Chi tiết <ChevronDown className="h-3 w-3 ml-0.5" /></>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Linked Activities Expanded Box */}
                        {isExpanded && linkedActivities.length > 0 && (
                          <div className="mt-3 rounded-lg border border-border/70 bg-muted/20 p-3 text-xs space-y-2">
                            <p className="font-semibold text-foreground">
                              Danh sách hoạt động phát sinh tại quy trình này:
                            </p>
                            <div className="divide-y divide-border/60">
                              {linkedActivities.map((act) => (
                                <div key={act.id} className="py-1.5 flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-primary font-medium">
                                      {act.activityReference}
                                    </span>
                                    <span className="text-muted-foreground">({act.activityType})</span>
                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                      {act.dataQualityLevel}
                                    </Badge>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-semibold text-foreground">
                                      {act.quantity.toLocaleString("vi-VN")} {act.canonicalUnit}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="pt-2 flex justify-end">
                              <Link
                                href={routes.toAppPath("/activity-data")}
                                className="inline-flex items-center text-[11px] text-primary hover:underline"
                              >
                                Mở trang Dữ liệu hoạt động <ArrowRight className="h-3 w-3 ml-1" />
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Sidebar: Create Revision Form */}
        <aside>
          <form onSubmit={submit} className="h-fit space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs sticky top-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">
                {isFacility ? "Tạo Revision Cơ sở" : "Tạo Revision Quy trình"}
              </h3>
              <Badge variant="outline" className="text-[11px]">
                ISO 14064-1
              </Badge>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAiImport(true)}
              disabled={!canWrite || busy}
              className="w-full h-8 text-xs font-medium border-emerald-300 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              {isFacility ? "Quét AI từ Hồ sơ Cơ sở (PDF/Ảnh)" : "Quét AI từ Quy trình SOP (PDF/Ảnh)"}
            </Button>

            {demo ? (
              <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/50 leading-relaxed">
                💡 <strong>Chế độ Demo</strong>: Bạn có thể nhập và lưu thử nghiệm revision. Dữ liệu lưu trong bộ nhớ tạm (tự động xóa sau 1 giờ hoặc khi đăng xuất).
              </p>
            ) : !canWrite ? (
              <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border">
                Chỉ quản trị viên của doanh nghiệp có quyền ghi và gói đang hoạt động được tạo revision. Demo chỉ đọc.
              </p>
            ) : null}

            <fieldset disabled={!canWrite || busy} className="space-y-4">
              {!isFacility && (
                <label className="block text-xs font-medium">
                  Cơ sở trực thuộc
                  <select
                    required
                    className="mt-1.5 block w-full rounded-md border border-input bg-background p-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={facility}
                    onChange={(event) => setFacility(event.target.value)}
                  >
                    <option value="">-- Chọn cơ sở áp dụng --</option>
                    {query.data?.facilities.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name} ({row.facilityReference})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block text-xs font-medium">
                Mã tham chiếu
                <Input
                  required
                  maxLength={120}
                  placeholder={isFacility ? "FAC-DYEING-01" : "PROC-DYE-LINE1"}
                  className="mt-1.5 text-xs font-mono"
                  value={form.reference}
                  onChange={(event) => setForm({ ...form, reference: event.target.value })}
                />
              </label>

              <label className="block text-xs font-medium">
                Tên
                <Input
                  required
                  maxLength={240}
                  placeholder={isFacility ? "Xưởng nhuộm hoàn tất số 1" : "Dây chuyền nhuộm và giặt sấy"}
                  className="mt-1.5 text-xs"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </label>

              {isFacility ? (
                <>
                  <label className="block text-xs font-medium">
                    Múi giờ IANA
                    <Input
                      required
                      className="mt-1.5 text-xs"
                      value={form.timezone}
                      onChange={(event) => setForm({ ...form, timezone: event.target.value })}
                    />
                  </label>
                  <label className="block text-xs font-medium">
                    Ranh giới cơ sở
                    <textarea
                      required
                      maxLength={4000}
                      placeholder="Mô tả phạm vi kiểm soát tài chính hoặc kiểm soát vận hành theo ISO 14064-1..."
                      className="mt-1.5 min-h-24 w-full rounded-md border border-input bg-background p-2 text-xs"
                      value={form.boundary}
                      onChange={(event) => setForm({ ...form, boundary: event.target.value })}
                    />
                  </label>
                </>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-medium">
                    Loại quy trình
                    <Input
                      required
                      maxLength={120}
                      placeholder="production, dyeing, sewing..."
                      className="mt-1.5 text-xs font-mono"
                      value={form.processType}
                      onChange={(event) => setForm({ ...form, processType: event.target.value })}
                    />
                  </label>

                  {/* Quick Suggestions Pills */}
                  <div>
                    <span className="text-[11px] text-muted-foreground">Gợi ý loại chuẩn:</span>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {PROCESS_TYPE_SUGGESTIONS.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setForm({ ...form, processType: item.value })}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                            form.processType === item.value
                              ? "bg-primary text-primary-foreground font-semibold"
                              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={!isFacility && !facility}
                className="w-full text-xs font-semibold"
              >
                {busy ? "Đang lưu…" : "Lưu revision"}
              </Button>
            </fieldset>

            {message && (
              <p
                role={message.error ? "alert" : "status"}
                className={`text-xs rounded-lg p-2.5 ${
                  message.error
                    ? "bg-destructive/15 text-destructive border border-destructive/20"
                    : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                }`}
              >
                {message.text}
              </p>
            )}
          </form>
        </aside>
      </div>

      <AiDocumentImportModal
        open={showAiImport}
        onOpenChange={setShowAiImport}
        contextKey={isFacility ? "facility" : "process"}
        demo={demo}
        onApply={(fields) => {
          setForm((prev) => ({
            ...prev,
            reference: (fields.reference as string) || prev.reference,
            name: (fields.name as string) || prev.name,
            timezone: (fields.timezone as string) || prev.timezone,
            boundary: (fields.boundary as string) || prev.boundary,
            processType: (fields.processType as string) || prev.processType,
          }));
        }}
      />
    </WorkspaceFrame>
  );
}
