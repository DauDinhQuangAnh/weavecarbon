"use client";

import { FormEvent, useMemo, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, Loader2, Search, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/useToast";
import { isApiError } from "@/lib/apiClient";
import {
  industrialCoreApi,
  type IndustrialActivity,
  type IndustrialActivityLineage,
  type IndustrialFacility,
  type IndustrialMeasurementPoint,
  type IndustrialProcess,
} from "@/lib/industrialCoreApi";
import { isControlledEvidence, sha256CanonicalJson, zonedLocalDateTimeToIso } from "@/lib/industrialOperations";
import type { EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";

const PAGE_SIZE = 10;

const emptyActivity = {
  activityReference: "",
  facilityRevisionId: "",
  processRevisionId: "",
  measurementPointRevisionId: "",
  activityType: "electricity",
  periodStart: "",
  periodEnd: "",
  quantity: "",
  canonicalUnit: "kWh",
  sourceKind: "manual" as "invoice" | "meter" | "plc" | "sensor" | "supplier" | "manual" | "api",
  dataQualityLevel: "L3" as "L1" | "L2" | "L3" | "L4" | "L5",
  evidenceDocumentIds: [] as string[],
};

type Props = {
  activities: IndustrialActivity[];
  facilities: IndustrialFacility[];
  processes: IndustrialProcess[];
  measurementPoints: IndustrialMeasurementPoint[];
  evidence: EvidenceDocumentV2[];
  canWrite: boolean;
  readOnlyMessage: string;
  onCreated: (activity: IndustrialActivity) => void;
};

export default function ActivityOperationsPanel({
  activities, facilities, processes, measurementPoints, evidence, canWrite, readOnlyMessage, onCreated,
}: Props) {
  const t = useTranslations("carbonOperations");
  const [form, setForm] = useState(emptyActivity);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lineage, setLineage] = useState<IndustrialActivityLineage | null>(null);
  const [review, setReview] = useState({ decision: "needs_information" as "approved" | "needs_information" | "rejected", notes: "" });
  const [busy, setBusy] = useState<"create" | "lineage" | "review" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const facilityProcesses = processes.filter((item) => item.facilityRevisionId === form.facilityRevisionId);
  const selectedFacility = facilities.find((item) => item.id === form.facilityRevisionId);
  const facilityPoints = measurementPoints.filter((item) =>
    item.facilityRevisionId === form.facilityRevisionId &&
    (form.processRevisionId
      ? item.processRevisionId === form.processRevisionId
      : !item.processRevisionId)
  );
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = useMemo(() => activities.filter((item) => !normalizedSearch || [
    item.activityReference, item.activityType, item.facilityName, item.facilityReference, item.canonicalUnit,
  ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch))), [activities, normalizedSearch]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((Math.min(page, pageCount) - 1) * PAGE_SIZE, Math.min(page, pageCount) * PAGE_SIZE);
  const canApprove = Boolean(lineage?.evidence.length) && lineage!.evidence.every((item) =>
    ["locked", "third_party_verified"].includes(item.status) && /^[a-f0-9]{64}$/i.test(item.checksumSha256 || "")
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canWrite || busy === "create") return;
    setBusy("create");
    setError(null);
    try {
      const quantity = Number(form.quantity);
      const facilityTimezone = selectedFacility?.timezone || "UTC";
      const provenance = {
        activityReference: form.activityReference.trim(), facilityRevisionId: form.facilityRevisionId,
        processRevisionId: form.processRevisionId || null, measurementPointRevisionId: form.measurementPointRevisionId || null,
        activityType: form.activityType.trim(),
        periodStart: zonedLocalDateTimeToIso(form.periodStart, facilityTimezone),
        periodEnd: zonedLocalDateTimeToIso(form.periodEnd, facilityTimezone),
        quantity, canonicalUnit: form.canonicalUnit.trim(), sourceKind: form.sourceKind,
        dataQualityLevel: form.dataQualityLevel, facilityTimezone,
        evidenceDocumentIds: [...form.evidenceDocumentIds].sort(),
      };
      const created = await industrialCoreApi.createActivity({
        ...provenance,
        processRevisionId: form.processRevisionId || undefined,
        measurementPointRevisionId: form.measurementPointRevisionId || undefined,
        rawPayload: { entryMode: "carbon_operations_manual", provenance },
        sourceSha256: await sha256CanonicalJson(provenance),
      });
      onCreated(created);
      setForm(emptyActivity);
      toast({ title: t("activityCreated") });
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("activitySaveError"));
    } finally {
      setBusy(null);
    }
  };

  const inspect = async (activityId: string) => {
    setBusy("lineage");
    setError(null);
    try {
      const result = await industrialCoreApi.activityLineage(activityId);
      setLineage(result);
      setReview({ decision: result.latestReview?.decision || "needs_information", notes: "" });
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("lineageLoadError"));
    } finally {
      setBusy(null);
    }
  };

  const submitReview = async (event: FormEvent) => {
    event.preventDefault();
    if (!canWrite || !lineage || busy === "review") return;
    setBusy("review");
    setError(null);
    try {
      await industrialCoreApi.reviewActivity(lineage.activity.id, {
        reviewerRole: "industrial_activity_reviewer", decision: review.decision, notes: review.notes.trim(),
      });
      const refreshed = await industrialCoreApi.activityLineage(lineage.activity.id);
      setLineage(refreshed);
      setReview((current) => ({ ...current, notes: "" }));
      toast({ title: t("activityReviewed") });
    } catch (cause) {
      setError(isApiError(cause) ? cause.message : t("activityReviewError"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="rounded-xl border border-slate-200/90 bg-white shadow-xs">
      <CardHeader className="border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-600" /><CardTitle className="text-base font-bold text-slate-900">{t("activityLedgerTitle")}</CardTitle></div>
        <CardDescription className="text-xs text-slate-500">{t("activityLedgerDescription", { count: activities.length })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        {!canWrite && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{readOnlyMessage}</p>}
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}

        <form className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4" onSubmit={submit}>
          <div><p className="text-sm font-semibold text-slate-900">{t("activityFormTitle")}</p><p className="text-xs text-slate-500">{t("activityFormDescription")}</p></div>
          <div className="grid gap-3 md:grid-cols-3">
            <select aria-label={t("fields.facility")} required disabled={!canWrite || busy === "create"} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs" value={form.facilityRevisionId} onChange={(event) => setForm({ ...form, facilityRevisionId: event.target.value, processRevisionId: "", measurementPointRevisionId: "" })}>
              <option value="">{t("selectFacility")}</option>{facilities.map((item) => <option key={item.id} value={item.id}>{item.name} · rev {item.revision}</option>)}
            </select>
            <select aria-label={t("optionalProcess")} disabled={!canWrite || busy === "create" || !form.facilityRevisionId} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs" value={form.processRevisionId} onChange={(event) => setForm({ ...form, processRevisionId: event.target.value, measurementPointRevisionId: "" })}>
              <option value="">{t("optionalProcess")}</option>{facilityProcesses.map((item) => <option key={item.id} value={item.id}>{item.name} · rev {item.revision}</option>)}
            </select>
            <select aria-label={t("optionalMeasurementPoint")} disabled={!canWrite || busy === "create" || !form.facilityRevisionId} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs" value={form.measurementPointRevisionId} onChange={(event) => setForm({ ...form, measurementPointRevisionId: event.target.value })}>
              <option value="">{t("optionalMeasurementPoint")}</option>{facilityPoints.map((item) => <option key={item.id} value={item.id}>{item.measurementPointReference} · rev {item.revision}</option>)}
            </select>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input required maxLength={120} disabled={!canWrite || busy === "create"} placeholder={t("activityReference")} value={form.activityReference} onChange={(event) => setForm({ ...form, activityReference: event.target.value })} />
            <Input required disabled={!canWrite || busy === "create"} placeholder={t("activityType")} value={form.activityType} onChange={(event) => setForm({ ...form, activityType: event.target.value })} />
            <div className="grid grid-cols-2 gap-2"><Input required type="number" min="0" step="any" disabled={!canWrite || busy === "create"} placeholder={t("quantity")} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /><Input required disabled={!canWrite || busy === "create"} placeholder={t("fields.unit")} value={form.canonicalUnit} onChange={(event) => setForm({ ...form, canonicalUnit: event.target.value })} /></div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div><Label className="text-xs">{t("periodStart")}</Label><Input required type="datetime-local" disabled={!canWrite || busy === "create"} value={form.periodStart} onChange={(event) => setForm({ ...form, periodStart: event.target.value })} /></div>
            <div><Label className="text-xs">{t("periodEnd")}</Label><Input required type="datetime-local" disabled={!canWrite || busy === "create"} value={form.periodEnd} onChange={(event) => setForm({ ...form, periodEnd: event.target.value })} /></div>
            <select aria-label={t("sourceKind")} disabled={!canWrite || busy === "create"} className="mt-auto h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs" value={form.sourceKind} onChange={(event) => setForm({ ...form, sourceKind: event.target.value as typeof form.sourceKind })}>{["invoice", "meter", "plc", "sensor", "supplier", "manual", "api"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <select aria-label={t("dataQualityLevel")} disabled={!canWrite || busy === "create"} className="mt-auto h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs" value={form.dataQualityLevel} onChange={(event) => setForm({ ...form, dataQualityLevel: event.target.value as typeof form.dataQualityLevel })}>{["L1", "L2", "L3", "L4", "L5"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
          </div>
          {selectedFacility && <p className="text-xs text-slate-500">{t("activityPeriodTimezone", { timezone: selectedFacility.timezone })}</p>}
          <fieldset disabled={!canWrite || busy === "create"} className="rounded-lg border border-slate-200 bg-white p-3"><legend className="px-1 text-xs font-semibold text-slate-700">{t("activityEvidence")}</legend><div className="grid max-h-32 gap-2 overflow-y-auto sm:grid-cols-2">{evidence.length ? evidence.map((item) => <label key={item.id} className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" className="mt-0.5" checked={form.evidenceDocumentIds.includes(item.id)} onChange={(event) => setForm({ ...form, evidenceDocumentIds: event.target.checked ? [...form.evidenceDocumentIds, item.id] : form.evidenceDocumentIds.filter((id) => id !== item.id) })} /><span>{item.documentName} <Badge variant="outline" className={isControlledEvidence(item) ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}>{item.status}</Badge></span></label>) : <span className="text-xs text-slate-500">{t("noEvidence")}</span>}</div></fieldset>
          <Button disabled={!canWrite || busy === "create"} className="w-full bg-emerald-600 hover:bg-emerald-700">{busy === "create" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("createActivity")}</Button>
        </form>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input aria-label={t("searchActivities")} className="pl-9" placeholder={t("searchActivities")} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
          <span className="text-xs text-slate-500">{t("activityResultCount", { count: filtered.length })}</span>
        </div>
        <div className="space-y-2">
          {!visible.length ? <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">{t("emptyActivities")}</p> : visible.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3"><div><p className="font-mono text-sm font-semibold text-slate-900">{item.activityReference}</p><p className="mt-0.5 text-xs text-slate-500">{item.quantity} {item.canonicalUnit} · {item.activityType} · <span className="font-medium text-emerald-700">{item.dataQualityLevel}</span></p></div><Button type="button" variant="outline" size="sm" disabled={busy === "lineage"} onClick={() => void inspect(item.id)}>{busy === "lineage" ? <Loader2 className="h-4 w-4 animate-spin" /> : t("viewLineage")}</Button></div>)}
        </div>
        {pageCount > 1 && <div className="flex items-center justify-end gap-2"><Button type="button" size="sm" variant="outline" aria-label={t("previousPage")} disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /></Button><span className="text-xs text-slate-500">{page}/{pageCount}</span><Button type="button" size="sm" variant="outline" aria-label={t("nextPage")} disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}><ChevronRight className="h-4 w-4" /></Button></div>}
      </CardContent>

      <Dialog open={Boolean(lineage)} onOpenChange={(open) => { if (!open) setLineage(null); }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{t("lineageTitle")}</DialogTitle><DialogDescription>{t("lineageDescription")}</DialogDescription></DialogHeader>
          {lineage && <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2"><div><span className="text-xs text-slate-500">{t("activityReference")}</span><p className="font-mono font-semibold">{lineage.activity.activityReference}</p></div><div><span className="text-xs text-slate-500">{t("fields.facility")}</span><p>{lineage.facility.name} · {lineage.facility.reference}</p></div><div><span className="text-xs text-slate-500">{t("optionalProcess")}</span><p>{lineage.process ? `${lineage.process.name} · ${lineage.process.reference}` : "—"}</p></div><div><span className="text-xs text-slate-500">SHA-256</span><p className="break-all font-mono text-xs">{lineage.activity.sourceSha256}</p></div></div>
            <div><h3 className="mb-2 text-sm font-semibold">{t("activityEvidence")}</h3><div className="space-y-2">{lineage.evidence.length ? lineage.evidence.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{item.name}</span><Badge variant="outline">{item.status}</Badge></div><p className="mt-1 break-all font-mono text-slate-500">{item.checksumSha256 || t("missingChecksum")}</p></div>) : <p className="text-xs text-amber-700">{t("noEvidence")}</p>}</div></div>
            <div className="rounded-xl border border-slate-200 p-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-600" />{t("latestReview")}</h3>{lineage.latestReview ? <div className="mt-2 text-xs text-slate-600"><p><Badge variant="outline">{lineage.latestReview.decision}</Badge> · {lineage.latestReview.reviewerName}</p><p className="mt-1">{lineage.latestReview.notes}</p><p className="mt-1 text-slate-400">{new Date(lineage.latestReview.createdAt).toLocaleString("vi-VN")}</p></div> : <p className="mt-2 text-xs text-slate-500">{t("noReview")}</p>}</div>
            <form className="space-y-3 rounded-xl border border-slate-200 p-4" onSubmit={submitReview}><h3 className="text-sm font-semibold">{t("reviewActivity")}</h3>{!canWrite && <p className="text-xs text-amber-700">{readOnlyMessage}</p>}<select aria-label={t("reviewDecision")} disabled={!canWrite || busy === "review"} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs" value={review.decision} onChange={(event) => setReview({ ...review, decision: event.target.value as typeof review.decision })}><option value="needs_information">needs_information</option><option value="approved" disabled={!canApprove}>approved</option><option value="rejected">rejected</option></select>{!canApprove && <p className="text-xs text-amber-700">{t("approvalRequiresControlledEvidence")}</p>}<Textarea required minLength={3} maxLength={5000} disabled={!canWrite || busy === "review"} placeholder={t("reviewNotes")} value={review.notes} onChange={(event) => setReview({ ...review, notes: event.target.value })} /><Button disabled={!canWrite || busy === "review" || (review.decision === "approved" && !canApprove)} className="w-full bg-emerald-600 hover:bg-emerald-700">{busy === "review" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("saveReview")}</Button></form>
          </div>}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
