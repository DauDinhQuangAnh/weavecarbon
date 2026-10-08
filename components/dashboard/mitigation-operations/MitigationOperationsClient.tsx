"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, FileLock2, Leaf, Loader2, Scale, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EvidenceSelector } from "@/components/evidence/EvidenceSelector";
import { isApiError } from "@/lib/apiClient";
import { industrialCoreApi, type IndustrialFacility } from "@/lib/industrialCoreApi";
import { fetchCorporateGhgInventories, type CorporateGhgInventory } from "@/lib/weave-v2/corporateGhgInventoryApi";
import { mitigationOperationsApi, type AllowanceAllocation, type AllowancePosition, type MitigationInitiative, type MitigationScenario, type InitiativeLifecycleStatus } from "@/lib/mitigationOperationsApi";
import { demoSessionCache } from "@/lib/dashboard/demoSessionCache";
import { DEMO_INVENTORIES } from "@/lib/dashboard/industrialDemoData";
const ids = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
const select = "h-10 w-full rounded-md border bg-background px-3 text-sm";

export default function MitigationOperationsClient({ demo = false }: { demo?: boolean }) {
  const t = useTranslations("mitigationOperations");
  const { user } = useAuth();
  const isCompanyAdmin = user?.company_role === "root" || user?.is_root === true;

  const [facilities, setFacilities] = useState<IndustrialFacility[]>([]);
  const [inventories, setInventories] = useState<CorporateGhgInventory[]>([]);
  const [initiatives, setInitiatives] = useState<MitigationInitiative[]>([]);
  const [scenarios, setScenarios] = useState<MitigationScenario[]>([]);
  const [allocations, setAllocations] = useState<AllowanceAllocation[]>([]);
  const [positions, setPositions] = useState<AllowancePosition[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [transitioningInitiative, setTransitioningInitiative] = useState<MitigationInitiative | null>(null);
  const [targetStatus, setTargetStatus] = useState<"proposed" | "approved_internal" | "in_progress" | "completed" | "cancelled">("in_progress");
  const [transitionReason, setTransitionReason] = useState("");
  const [transitionNotes, setTransitionNotes] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const [initiative, setInitiative] = useState({ initiativeReference: "", facilityRevisionId: "", title: "", lifecycleStatus: "proposed", ownerName: "", baselineYear: 2025, targetReductionTco2e: 0, plannedStart: "2026-01-01", plannedEnd: "2027-12-31", methodology: "", assumptions: "", evidenceDocumentIds: "" });
  const [scenario, setScenario] = useState({ initiativeId: "", scenarioReference: "", scenarioType: "planned", periodStart: "2026-01-01", periodEnd: "2026-12-31", baselineEmissionsTco2e: 0, projectedEmissionsTco2e: 0, assumptions: "", sensitivity: "", evidenceDocumentIds: "" });
  const [allocation, setAllocation] = useState({ allocationReference: "", facilityRevisionId: "", reportingYear: 2026, instrumentType: "authority_quota", recordStatus: "draft_reference", quantityTco2e: 0, vintageYear: 2026, externalReference: "", evidenceDocumentId: "", notes: "" });
  const [position, setPosition] = useState({ facilityRevisionId: "", corporateInventoryId: "", reportingYear: 2026, allocationIds: "", scenarioIds: "" });

  const load = useCallback(async () => {
    if (demo) {
      const demoFacs = demoSessionCache.getFacilities();
      setFacilities(demoFacs);
      setInventories((DEMO_INVENTORIES as unknown) as CorporateGhgInventory[]);
      setInitiatives([
        {
          id: "demo-init-1",
          initiativeReference: "INIT-EE-2026-01",
          facilityRevisionId: demoFacs[0]?.id || "demo-fac-1",
          facilityName: demoFacs[0]?.name || "Cơ sở demo",
          revision: 1,
          title: "Thay thế biến tần và tối ưu hóa hệ thống sấy",
          lifecycleStatus: "in_progress",
          ownerName: "Kỹ sư trưởng Nguyễn Văn B",
          baselineYear: 2025,
          targetReductionTco2e: 450,
          initiativeSha256: "demo-sha256",
        },
      ]);
      setScenarios([
        {
          id: "demo-scen-1",
          initiativeId: "demo-init-1",
          initiativeReference: "INIT-EE-2026-01",
          scenarioReference: "SCEN-OPT-2026",
          revision: 1,
          scenarioType: "planned",
          baselineEmissionsTco2e: 2050,
          projectedEmissionsTco2e: 1600,
          expectedReductionTco2e: 450,
          scenarioSha256: "demo-sha256",
        },
      ]);
      setAllocations([
        {
          id: "demo-alloc-1",
          allocationReference: "ALLOC-VN-2026-01",
          facilityRevisionId: demoFacs[0]?.id || "demo-fac-1",
          facilityName: demoFacs[0]?.name || "Cơ sở demo",
          revision: 1,
          reportingYear: 2026,
          instrumentType: "authority_quota",
          recordStatus: "draft_reference",
          quantityTco2e: 1800,
          allocationSha256: "demo-sha256",
        },
      ]);
      setPositions([
        {
          id: "demo-pos-1",
          facilityRevisionId: demoFacs[0]?.id || "demo-fac-1",
          corporateInventoryId: "demo-inv-1",
          reportingYear: 2026,
          grossEmissionsTco2e: 1600,
          authorityQuotaTco2e: 1800,
          internalBudgetTco2e: 0,
          creditReferenceTco2e: 0,
          plannedReductionTco2e: 450,
          projectedPositionTco2e: 200,
          readinessStatus: "surplus_projected",
          blockers: [],
          payloadSha256: "demo-sha256",
          disclaimer: "Dữ liệu vị thế mang tính minh họa.",
        },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [f, i, m, s, a, p] = await Promise.all([
        industrialCoreApi.facilities(),
        fetchCorporateGhgInventories(),
        mitigationOperationsApi.initiatives(),
        mitigationOperationsApi.scenarios(),
        mitigationOperationsApi.allocations(),
        mitigationOperationsApi.positions()
      ]);
      setFacilities(f); setInventories(i); setInitiatives(m); setScenarios(s); setAllocations(a); setPositions(p);
    } catch (e) {
      setError(isApiError(e) ? e.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [demo, t]);

  useEffect(() => { void load(); }, [load]);

  const runAction = async (action: () => Promise<unknown>) => {
    if (demo || saving) return;
    setSaving(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (x) {
      setError(isApiError(x) ? x.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const save = (e: FormEvent, action: () => Promise<unknown>, demoHandler?: () => void) => {
    e.preventDefault();
    if (demo) {
      demoHandler?.();
      return;
    }
    void runAction(action);
  };

  const saveInitiative = (e: FormEvent) =>
    save(
      e,
      () =>
        mitigationOperationsApi.createInitiative({
          ...initiative,
          methodology: { description: initiative.methodology },
          assumptions: { description: initiative.assumptions },
          evidenceDocumentIds: ids(initiative.evidenceDocumentIds),
        }),
      () => {
        const newInit: MitigationInitiative = {
          id: `demo-init-${Date.now()}`,
          initiativeReference: initiative.initiativeReference,
          facilityRevisionId: initiative.facilityRevisionId,
          revision: 1,
          title: initiative.title,
          lifecycleStatus: initiative.lifecycleStatus,
          ownerName: initiative.ownerName,
          baselineYear: initiative.baselineYear,
          targetReductionTco2e: initiative.targetReductionTco2e,
          initiativeSha256: "demo-sha256",
        };
        setInitiatives((prev) => [newInit, ...prev]);
        setInitiative({
          initiativeReference: "",
          facilityRevisionId: "",
          title: "",
          lifecycleStatus: "proposed",
          ownerName: "",
          baselineYear: 2025,
          targetReductionTco2e: 0,
          plannedStart: "2026-01-01",
          plannedEnd: "2027-12-31",
          methodology: "",
          assumptions: "",
          evidenceDocumentIds: "",
        });
      }
    );

  const saveScenario = (e: FormEvent) =>
    save(
      e,
      () =>
        mitigationOperationsApi.createScenario({
          ...scenario,
          annualProjection: [{ year: Number(scenario.periodEnd.slice(0, 4)), projectedTco2e: Number(scenario.projectedEmissionsTco2e) }],
          assumptions: { description: scenario.assumptions },
          sensitivity: { description: scenario.sensitivity },
          evidenceDocumentIds: ids(scenario.evidenceDocumentIds),
        }),
      () => {
        const expected = Math.max(0, scenario.baselineEmissionsTco2e - scenario.projectedEmissionsTco2e);
        const newScen: MitigationScenario = {
          id: `demo-scen-${Date.now()}`,
          initiativeId: scenario.initiativeId,
          scenarioReference: scenario.scenarioReference,
          revision: 1,
          scenarioType: scenario.scenarioType,
          baselineEmissionsTco2e: scenario.baselineEmissionsTco2e,
          projectedEmissionsTco2e: scenario.projectedEmissionsTco2e,
          expectedReductionTco2e: expected,
          scenarioSha256: "demo-sha256",
        };
        setScenarios((prev) => [newScen, ...prev]);
        setScenario({
          initiativeId: "",
          scenarioReference: "",
          scenarioType: "planned",
          periodStart: "2026-01-01",
          periodEnd: "2026-12-31",
          baselineEmissionsTco2e: 0,
          projectedEmissionsTco2e: 0,
          assumptions: "",
          sensitivity: "",
          evidenceDocumentIds: "",
        });
      }
    );

  const saveAllocation = (e: FormEvent) =>
    save(
      e,
      () =>
        mitigationOperationsApi.createAllocation({
          ...allocation,
          externalReference: allocation.externalReference || null,
          evidenceDocumentId: allocation.evidenceDocumentId || null,
        }),
      () => {
        const newAlloc: AllowanceAllocation = {
          id: `demo-alloc-${Date.now()}`,
          allocationReference: allocation.allocationReference,
          facilityRevisionId: allocation.facilityRevisionId,
          revision: 1,
          reportingYear: allocation.reportingYear,
          instrumentType: allocation.instrumentType,
          recordStatus: allocation.recordStatus,
          quantityTco2e: allocation.quantityTco2e,
          allocationSha256: "demo-sha256",
        };
        setAllocations((prev) => [newAlloc, ...prev]);
        setAllocation({
          allocationReference: "",
          facilityRevisionId: "",
          reportingYear: 2026,
          instrumentType: "authority_quota",
          recordStatus: "draft_reference",
          quantityTco2e: 0,
          vintageYear: 2026,
          externalReference: "",
          evidenceDocumentId: "",
          notes: "",
        });
      }
    );

  const savePosition = (e: FormEvent) =>
    save(
      e,
      () =>
        mitigationOperationsApi.createPosition({
          ...position,
          allocationIds: ids(position.allocationIds),
          scenarioIds: ids(position.scenarioIds),
        }),
      () => {
        const selectedAllocIds = ids(position.allocationIds);
        const selectedScenIds = ids(position.scenarioIds);
        const totalQuota = allocations
          .filter((a) => selectedAllocIds.includes(a.id) || selectedAllocIds.includes(a.allocationReference))
          .reduce((acc, a) => acc + a.quantityTco2e, 0) || 1800;
        const totalReduction = scenarios
          .filter((s) => selectedScenIds.includes(s.id) || selectedScenIds.includes(s.scenarioReference))
          .reduce((acc, s) => acc + s.expectedReductionTco2e, 0) || 450;
        const gross = 2050;
        const projected = totalQuota - (gross - totalReduction);
        const newPos: AllowancePosition = {
          id: `demo-pos-${Date.now()}`,
          facilityRevisionId: position.facilityRevisionId,
          corporateInventoryId: position.corporateInventoryId,
          reportingYear: position.reportingYear,
          grossEmissionsTco2e: gross,
          authorityQuotaTco2e: totalQuota,
          internalBudgetTco2e: 0,
          creditReferenceTco2e: 0,
          plannedReductionTco2e: totalReduction,
          projectedPositionTco2e: projected,
          readinessStatus: projected >= 0 ? "surplus_projected" : "deficit_warning",
          blockers: [],
          payloadSha256: "demo-sha256",
          disclaimer: "Vị thế demo",
        };
        setPositions((prev) => [newPos, ...prev]);
        setPosition({
          facilityRevisionId: "",
          corporateInventoryId: "",
          reportingYear: 2026,
          allocationIds: "",
          scenarioIds: "",
        });
      }
    );

  const handleOpenTransition = (item: MitigationInitiative) => {
    setTransitioningInitiative(item);
    setTargetStatus(
      item.lifecycleStatus === "proposed"
        ? "approved_internal"
        : item.lifecycleStatus === "approved_internal"
        ? "in_progress"
        : item.lifecycleStatus === "in_progress"
        ? "completed"
        : "in_progress"
    );
    setTransitionReason("");
    setTransitionNotes("");
    setTransitionError(null);
  };

  const handleConfirmTransition = async (e: FormEvent) => {
    e.preventDefault();
    if (!transitioningInitiative || transitioning) return;
    if (demo) {
      setInitiatives((prev) =>
        prev.map((item) =>
          item.id === transitioningInitiative.id
            ? { ...item, lifecycleStatus: targetStatus }
            : item
        )
      );
      setTransitioningInitiative(null);
      return;
    }
    setTransitioning(true);
    setTransitionError(null);
    try {
      await mitigationOperationsApi.transitionInitiativeLifecycle(transitioningInitiative.id, {
        lifecycleStatus: targetStatus,
        reason: transitionReason,
        notes: transitionNotes,
      });
      setTransitioningInitiative(null);
      await load();
    } catch (cause) {
      setTransitionError(isApiError(cause) ? cause.message : "Không thể cập nhật trạng thái vòng đời.");
    } finally {
      setTransitioning(false);
    }
  };

  const getLifecycleBadge = (status: string) => {
    switch (status) {
      case "completed":
        return "border-emerald-300 bg-emerald-50 text-emerald-800";
      case "in_progress":
        return "border-sky-300 bg-sky-50 text-sky-800";
      case "approved_internal":
        return "border-indigo-300 bg-indigo-50 text-indigo-800";
      case "cancelled":
        return "border-rose-300 bg-rose-50 text-rose-800";
      default:
        return "border-slate-300 bg-slate-50 text-slate-700";
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <section className="rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-950 to-cyan-950 p-7 text-white shadow-md">
        <p className="text-sm font-semibold uppercase tracking-[.15em] text-emerald-200">
          G2-04 · Giảm thiểu & Quản lý Hạn ngạch
        </p>
        <h1 className="mt-3 text-3xl font-bold">{t("title")}</h1>
        <p className="mt-3 max-w-3xl text-slate-200 text-sm leading-relaxed">{t("description")}</p>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
          {error}
        </div>
      )}

      {demo && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          💡 <strong>Chế độ Demo tương tác</strong>: Bạn có thể tạo sáng kiến giảm thiểu, xây dựng kịch bản dự phóng, phân bổ hạn ngạch và tính vị thế phát thải. Dữ liệu lưu trong bộ nhớ tạm (tự động xóa sau 1 giờ hoặc khi đăng xuất).
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-2">
        {/* Initiative Card */}
        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">{t("initiativeTitle")}</CardTitle>
            <CardDescription className="text-xs text-slate-600">{t("initiativeDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <form className="grid gap-3 md:grid-cols-2" onSubmit={saveInitiative}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mã sáng kiến</label>
                <Input required disabled={saving} placeholder={t("initiativeReference")} value={initiative.initiativeReference} onChange={e => setInitiative({ ...initiative, initiativeReference: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectFacility")}</label>
                <select required disabled={saving} className={select} value={initiative.facilityRevisionId} onChange={e => setInitiative({ ...initiative, facilityRevisionId: e.target.value })}>
                  <option value="">{t("selectFacility")}</option>
                  {facilities.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Tên sáng kiến</label>
                <Input required disabled={saving} placeholder={t("initiativeName")} value={initiative.title} onChange={e => setInitiative({ ...initiative, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Người phụ trách</label>
                <Input required disabled={saving} placeholder={t("owner")} value={initiative.ownerName} onChange={e => setInitiative({ ...initiative, ownerName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mục tiêu giảm (tCO₂e)</label>
                <Input required disabled={saving} type="number" min="0.000001" step="any" placeholder={t("targetReduction")} value={initiative.targetReductionTco2e || ""} onChange={e => setInitiative({ ...initiative, targetReductionTco2e: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 block">Tài liệu bằng chứng (Evidence Vault)</label>
                  <span className="text-[11px] text-slate-500">ISO 14064 Bắt buộc</span>
                </div>
                <EvidenceSelector
                  value={initiative.evidenceDocumentIds.split(",")[0]?.trim() || null}
                  onChange={(evidenceId) => {
                    setInitiative((prev) => ({
                      ...prev,
                      evidenceDocumentIds: evidenceId || "",
                    }));
                  }}
                  placeholder="Chọn chứng từ đã xác minh từ Evidence Vault..."
                  disabled={saving || (!demo && !isCompanyAdmin)}
                  required
                />
                <Input
                  required
                  disabled={saving || (!demo && !isCompanyAdmin)}
                  placeholder={t("evidenceIds")}
                  value={initiative.evidenceDocumentIds}
                  onChange={e => setInitiative({ ...initiative, evidenceDocumentIds: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700 block">Phương pháp tính</label>
                <Textarea required disabled={saving || (!demo && !isCompanyAdmin)} placeholder={t("methodology")} value={initiative.methodology} onChange={e => setInitiative({ ...initiative, methodology: e.target.value })} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700 block">Giả định tính toán</label>
                <Textarea required disabled={saving || (!demo && !isCompanyAdmin)} placeholder={t("assumptions")} value={initiative.assumptions} onChange={e => setInitiative({ ...initiative, assumptions: e.target.value })} />
              </div>

              {!isCompanyAdmin && !demo && (
                <div className="md:col-span-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Chỉ Quản trị viên (Company Admin) mới có quyền tạo sáng kiến và thay đổi vòng đời.</span>
                </div>
              )}
              <Button className="md:col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium" disabled={saving || (!demo && !isCompanyAdmin)}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("createInitiative")}
              </Button>
            </form>
            <div className="pt-2 space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sáng kiến hiện có</h4>
              {initiatives.length === 0 ? (
                <p className="text-xs text-slate-400 py-2 text-center">Chưa có sáng kiến nào</p>
              ) : (
                initiatives.slice(0, 6).map(x => (
                  <div key={x.id} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 hover:bg-slate-50 transition-colors space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-semibold text-slate-900">{x.initiativeReference}</span>
                        <span className="text-xs text-slate-500 ml-1.5">(rev {x.revision}) · {x.title}</span>
                      </div>
                      <Badge variant="outline" className={`font-mono text-xs ${getLifecycleBadge(x.lifecycleStatus)}`}>
                        {x.lifecycleStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50">
                      <span className="font-mono text-emerald-800 font-semibold">{x.targetReductionTco2e} tCO₂e</span>
                      {(isCompanyAdmin || demo) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-emerald-600/30 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => handleOpenTransition(x)}
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                          Chuyển trạng thái
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Scenario Card */}
        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">{t("scenarioTitle")}</CardTitle>
            <CardDescription className="text-xs text-slate-600">{t("scenarioDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <form className="grid gap-3 md:grid-cols-2" onSubmit={saveScenario}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectInitiative")}</label>
                <select required disabled={saving} className={select} value={scenario.initiativeId} onChange={e => setScenario({ ...scenario, initiativeId: e.target.value })}>
                  <option value="">{t("selectInitiative")}</option>
                  {initiatives.map(x => <option key={x.id} value={x.id}>{x.initiativeReference}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mã kịch bản</label>
                <Input required disabled={saving} placeholder={t("scenarioReference")} value={scenario.scenarioReference} onChange={e => setScenario({ ...scenario, scenarioReference: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Phát thải cơ sở (tCO₂e)</label>
                <Input required disabled={saving} type="number" min="0" step="any" placeholder={t("baselineEmissions")} value={scenario.baselineEmissionsTco2e || ""} onChange={e => setScenario({ ...scenario, baselineEmissionsTco2e: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Phát thải dự phóng (tCO₂e)</label>
                <Input required disabled={saving} type="number" min="0" step="any" placeholder={t("projectedEmissions")} value={scenario.projectedEmissionsTco2e || ""} onChange={e => setScenario({ ...scenario, projectedEmissionsTco2e: Number(e.target.value) })} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700 block">Giả định kịch bản</label>
                <Textarea required disabled={saving} placeholder={t("assumptions")} value={scenario.assumptions} onChange={e => setScenario({ ...scenario, assumptions: e.target.value })} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700 block">Phân tích độ nhạy</label>
                <Textarea required disabled={saving} placeholder={t("sensitivity")} value={scenario.sensitivity} onChange={e => setScenario({ ...scenario, sensitivity: e.target.value })} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700 block">Bằng chứng liên kết</label>
                <Input required disabled={saving} placeholder={t("evidenceIds")} value={scenario.evidenceDocumentIds} onChange={e => setScenario({ ...scenario, evidenceDocumentIds: e.target.value })} />
              </div>
              <Button className="md:col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("createScenario")}
              </Button>
            </form>
            <div className="pt-2 space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kịch bản dự phóng</h4>
              {scenarios.slice(0, 4).map(x => (
                <div key={x.id} className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 hover:bg-slate-50 transition-colors">
                  <span className="text-sm"><b>{x.scenarioReference}</b> · {x.scenarioType}</span>
                  <Badge variant="outline" className="font-mono text-cyan-800 border-cyan-200 bg-cyan-50">−{x.expectedReductionTco2e} tCO₂e</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Allocation Card */}
        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">{t("allocationTitle")}</CardTitle>
            <CardDescription className="text-xs text-slate-600">{t("allocationDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <form className="grid gap-3 md:grid-cols-2" onSubmit={saveAllocation}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mã phân bổ</label>
                <Input required disabled={saving} placeholder={t("allocationReference")} value={allocation.allocationReference} onChange={e => setAllocation({ ...allocation, allocationReference: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectFacility")}</label>
                <select required disabled={saving} className={select} value={allocation.facilityRevisionId} onChange={e => setAllocation({ ...allocation, facilityRevisionId: e.target.value })}>
                  <option value="">{t("selectFacility")}</option>
                  {facilities.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Loại công cụ</label>
                <select disabled={saving} className={select} value={allocation.instrumentType} onChange={e => setAllocation({ ...allocation, instrumentType: e.target.value })}>
                  <option value="authority_quota">authority quota</option>
                  <option value="internal_budget">internal budget</option>
                  <option value="transfer_reference">transfer reference</option>
                  <option value="credit_reference">credit reference</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Trạng thái hồ sơ</label>
                <select disabled={saving} className={select} value={allocation.recordStatus} onChange={e => setAllocation({ ...allocation, recordStatus: e.target.value })}>
                  <option value="draft_reference">draft reference</option>
                  <option value="evidence_confirmed">evidence confirmed</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Khối lượng (tCO₂e)</label>
                <Input required disabled={saving} type="number" min="0.000001" step="any" placeholder={t("quantity")} value={allocation.quantityTco2e || ""} onChange={e => setAllocation({ ...allocation, quantityTco2e: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Mã tham chiếu bên ngoài</label>
                <Input disabled={saving} placeholder={t("externalReference")} value={allocation.externalReference} onChange={e => setAllocation({ ...allocation, externalReference: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">ID bằng chứng</label>
                <Input disabled={saving} placeholder={t("evidenceId")} value={allocation.evidenceDocumentId} onChange={e => setAllocation({ ...allocation, evidenceDocumentId: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">Ghi chú</label>
                <Input required disabled={saving} placeholder={t("notes")} value={allocation.notes} onChange={e => setAllocation({ ...allocation, notes: e.target.value })} />
              </div>
              <Button className="md:col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("createAllocation")}
              </Button>
            </form>
            <div className="pt-2 space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hạn ngạch đã cấp</h4>
              {allocations.slice(0, 4).map(x => (
                <div key={x.id} className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 hover:bg-slate-50 transition-colors">
                  <span className="text-sm"><b>{x.allocationReference}</b> · {x.instrumentType}</span>
                  <Badge variant="outline" className="font-mono text-slate-800">{x.quantityTco2e} tCO₂e</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Position Card */}
        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">{t("positionTitle")}</CardTitle>
            <CardDescription className="text-xs text-slate-600">{t("positionDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <form className="space-y-3" onSubmit={savePosition}>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectFacility")}</label>
                <select required disabled={saving} className={select} value={position.facilityRevisionId} onChange={e => setPosition({ ...position, facilityRevisionId: e.target.value })}>
                  <option value="">{t("selectFacility")}</option>
                  {facilities.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">{t("selectInventory")}</label>
                <select required disabled={saving} className={select} value={position.corporateInventoryId} onChange={e => setPosition({ ...position, corporateInventoryId: e.target.value })}>
                  <option value="">{t("selectInventory")}</option>
                  {inventories.map(x => <option key={x.id} value={x.id}>{x.inventoryReference} · rev {x.revision}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">ID hạn ngạch liên kết</label>
                <Input required disabled={saving} placeholder={t("allocationIds")} value={position.allocationIds} onChange={e => setPosition({ ...position, allocationIds: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">ID kịch bản giảm phát thải</label>
                <Input disabled={saving} placeholder={t("scenarioIds")} value={position.scenarioIds} onChange={e => setPosition({ ...position, scenarioIds: e.target.value })} />
              </div>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t("createPosition")}
              </Button>
            </form>
            <div className="pt-2 space-y-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vị thế carbon cơ sở</h4>
              {positions.slice(0, 4).map(x => (
                <div key={x.id} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-2 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <Scale className="h-4 w-4 text-emerald-600" />
                    <Badge variant="outline" className="font-semibold">{x.readinessStatus}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>Tổng phát thải: <b className="font-mono text-slate-900">{x.grossEmissionsTco2e} t</b></span>
                    <span>Hạn ngạch: <b className="font-mono text-slate-900">{x.authorityQuotaTco2e} t</b></span>
                    <span>Kế hoạch giảm: <b className="font-mono text-emerald-700">{x.plannedReductionTco2e} t</b></span>
                    <span>Vị thế ròng: <b className="font-mono text-cyan-800">{x.projectedPositionTco2e} t</b></span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1 border-t border-slate-200/60">
                    {x.blockers.length ? x.blockers.join(" · ") : t("noBlockers")}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border border-slate-200/80 bg-slate-50/50">
        <CardContent className="flex gap-3 p-5">
          <FileLock2 className="h-5 w-5 shrink-0 text-emerald-700 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-900">{t("boundaryTitle")}</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t("legalNotice")}</p>
          </div>
          <Leaf className="ml-auto hidden h-5 w-5 text-emerald-700 md:block" />
        </CardContent>
      </Card>

      {/* Initiative Lifecycle Transition Modal */}
      <Dialog open={Boolean(transitioningInitiative)} onOpenChange={(open) => { if (!open) setTransitioningInitiative(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <SlidersHorizontal className="h-5 w-5 text-emerald-600" />
              Chuyển trạng thái Vòng đời Sáng kiến
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {transitioningInitiative?.initiativeReference} · {transitioningInitiative?.title} (Hiện tại: <span className="font-semibold">{transitioningInitiative?.lifecycleStatus}</span>)
            </DialogDescription>
          </DialogHeader>

          {transitionError && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{transitionError}</span>
            </div>
          )}

          <form onSubmit={handleConfirmTransition} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">Trạng thái mới</label>
              <select
                className={select}
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as InitiativeLifecycleStatus)}
                disabled={transitioning}
              >
                <option value="proposed">Đề xuất (proposed)</option>
                <option value="approved_internal">Duyệt nội bộ (approved_internal)</option>
                <option value="in_progress">Đang thực hiện (in_progress)</option>
                <option value="completed">Đã hoàn thành (completed)</option>
                <option value="cancelled">Hủy bỏ (cancelled)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">Lý do chuyển trạng thái</label>
              <Input
                required
                placeholder="VD: Dự án đã nghiệm thu vận hành thử nghiệm..."
                value={transitionReason}
                onChange={(e) => setTransitionReason(e.target.value)}
                disabled={transitioning}
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">Ghi chú kiểm toán (Audit Trail)</label>
              <Textarea
                rows={3}
                placeholder="Nhập ghi chú chi tiết về tiến độ, bằng chứng hoàn thành hoặc lý do hủy..."
                value={transitionNotes}
                onChange={(e) => setTransitionNotes(e.target.value)}
                disabled={transitioning}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTransitioningInitiative(null)}
                disabled={transitioning}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={transitioning}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {transitioning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Xác nhận Chuyển trạng thái
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
