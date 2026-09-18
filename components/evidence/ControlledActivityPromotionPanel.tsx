'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/useToast';
import {
  evidenceActivityPromotionApi,
  type ActivityPromotionCandidate,
  type ActivityPromotionSuggestion,
  type CanonicalActivityField,
  type EvidenceExtractionReview,
} from '@/lib/evidenceActivityPromotionApi';
import {
  industrialCoreApi,
  type IndustrialFacility,
  type IndustrialMeasurementPoint,
  type IndustrialProcess,
} from '@/lib/industrialCoreApi';

const TARGETS: Array<{ value: CanonicalActivityField; label: string }> = [
  { value: 'activityReference', label: 'Mã hoạt động' },
  { value: 'activityType', label: 'Loại hoạt động' },
  { value: 'periodStart', label: 'Ngày bắt đầu' },
  { value: 'periodEnd', label: 'Ngày kết thúc' },
  { value: 'quantity', label: 'Số lượng' },
  { value: 'canonicalUnit', label: 'Đơn vị chuẩn' },
  { value: 'unmapped', label: 'Không ánh xạ' },
];
const REQUIRED_OVERRIDES = ['periodStart', 'periodEnd', 'quantity', 'canonicalUnit'] as const;

type MappingDecision = {
  decision: 'accepted' | 'corrected' | 'rejected';
  target: CanonicalActivityField;
  rationale: string;
};

type EvidenceMatchDecision = {
  decision: '' | 'accepted' | 'rejected';
  relationship: 'supports_activity' | 'calibration_record' | 'review_record';
  rationale: string;
};

type ActivityForm = {
  activityReference: string;
  facilityRevisionId: string;
  processRevisionId: string;
  measurementPointRevisionId: string;
  activityType: string;
  periodStart: string;
  periodEnd: string;
  quantity: string;
  canonicalUnit: string;
  sourceKind: 'invoice' | 'meter' | 'plc' | 'sensor' | 'supplier' | 'manual' | 'api';
  dataQualityLevel: 'L1' | 'L2' | 'L3';
};

const emptyActivity: ActivityForm = {
  activityReference: '', facilityRevisionId: '', processRevisionId: '', measurementPointRevisionId: '',
  activityType: '', periodStart: '', periodEnd: '', quantity: '', canonicalUnit: '',
  sourceKind: 'invoice', dataQualityLevel: 'L3',
};

function fieldValue(value: unknown, target: CanonicalActivityField): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : String(value);
  return target === 'periodStart' || target === 'periodEnd' ? text.slice(0, 10) : text;
}

function newestApproved(reviews: EvidenceExtractionReview[]) {
  return reviews.find((review) => review.decision === 'approved_for_mapping') || null;
}

export default function ControlledActivityPromotionPanel({
  evidenceId,
  refreshToken = 0,
}: {
  evidenceId: string;
  refreshToken?: number;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState<EvidenceExtractionReview | null>(null);
  const [suggestions, setSuggestions] = useState<ActivityPromotionSuggestion | null>(null);
  const [candidates, setCandidates] = useState<ActivityPromotionCandidate[]>([]);
  const [facilities, setFacilities] = useState<IndustrialFacility[]>([]);
  const [processes, setProcesses] = useState<IndustrialProcess[]>([]);
  const [points, setPoints] = useState<IndustrialMeasurementPoint[]>([]);
  const [decisions, setDecisions] = useState<Record<string, MappingDecision>>({});
  const [activity, setActivity] = useState<ActivityForm>(emptyActivity);
  const [candidateReference, setCandidateReference] = useState('');
  const [notes, setNotes] = useState('Đã kiểm tra mapping ngữ nghĩa và đối chiếu với chứng từ gốc.');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [warningRationales, setWarningRationales] = useState<Record<string, string>>({});
  const [evidenceMatchDecisions, setEvidenceMatchDecisions] = useState<Record<string, EvidenceMatchDecision>>({});
  const [matchEvidenceId, setMatchEvidenceId] = useState('');
  const [matchRelationship, setMatchRelationship] = useState<'supports_activity' | 'calibration_record' | 'review_record'>('supports_activity');
  const [matchRationale, setMatchRationale] = useState('');
  const [attestations, setAttestations] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const initializeSuggestions = useCallback((next: ActivityPromotionSuggestion) => {
    const nextDecisions: Record<string, MappingDecision> = {};
    const suggestedActivity: Partial<ActivityForm> = {};
    for (const field of next.fields) {
      nextDecisions[field.fieldPath] = {
        decision: 'accepted',
        target: field.suggestedCanonicalField,
        rationale: 'Đã đối chiếu nhãn và giá trị với chứng từ nguồn.',
      };
      if (field.suggestedCanonicalField !== 'unmapped') {
        suggestedActivity[field.suggestedCanonicalField] = fieldValue(
          field.confirmedValue,
          field.suggestedCanonicalField
        ) as never;
      }
    }
    setDecisions(nextDecisions);
    setEvidenceMatchDecisions(Object.fromEntries(next.evidenceMatches.slice(1).map((item) => [
      item.evidenceDocumentId,
      {
        decision: '',
        relationship: item.relationship === 'calibration_record' ? 'calibration_record' : 'supports_activity',
        rationale: '',
      } satisfies EvidenceMatchDecision,
    ])));
    setActivity({ ...emptyActivity, ...suggestedActivity });
    setCandidateReference(`AI-${next.extractionReviewId.slice(0, 8)}`);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reviews, candidateRows, facilityRows, processRows, pointRows] = await Promise.all([
        evidenceActivityPromotionApi.reviews(evidenceId),
        evidenceActivityPromotionApi.candidates(evidenceId),
        industrialCoreApi.facilities(),
        industrialCoreApi.processes(),
        industrialCoreApi.measurementPoints(),
      ]);
      const approved = newestApproved(reviews);
      setReview(approved);
      setCandidates(candidateRows);
      setFacilities(facilityRows);
      setProcesses(processRows);
      setPoints(pointRows);
      if (approved) {
        const next = await evidenceActivityPromotionApi.suggestions(evidenceId, approved.id);
        setSuggestions(next);
        initializeSuggestions(next);
      } else {
        setSuggestions(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được luồng kiểm soát AI/OCR.');
    } finally {
      setLoading(false);
    }
  }, [evidenceId, initializeSuggestions]);

  useEffect(() => { void load(); }, [load, refreshToken]);

  const mappedTargets = useMemo(
    () => new Set(Object.values(decisions).filter((item) => item.target !== 'unmapped').map((item) => item.target)),
    [decisions]
  );
  const warningCodes = useMemo(() => {
    if (!suggestions) return [];
    const codes = suggestions.fields
      .filter((field) => decisions[field.fieldPath]?.target !== 'unmapped' && field.confidence < 0.75)
      .map((field) => `LOW_CONFIDENCE_MAPPING:${field.fieldPath}`);
    if (Number(activity.quantity) === 0 && activity.quantity !== '') codes.push('ZERO_QUANTITY');
    return codes;
  }, [activity.quantity, decisions, suggestions]);
  const filteredProcesses = processes.filter((item) => item.facilityRevisionId === activity.facilityRevisionId);
  const filteredPoints = points.filter((item) =>
    item.facilityRevisionId === activity.facilityRevisionId &&
    (!activity.processRevisionId || item.processRevisionId === activity.processRevisionId)
  );
  const evidenceMatchesComplete = suggestions?.evidenceMatches.slice(1).every((item) => {
    const decision = evidenceMatchDecisions[item.evidenceDocumentId];
    return ['accepted', 'rejected'].includes(decision?.decision || '') && decision.rationale.trim().length >= 10;
  }) ?? false;

  const changeDecision = (
    fieldPath: string,
    patch: Partial<MappingDecision>,
    suggestion: ActivityPromotionSuggestion['fields'][number]
  ) => {
    const previous = decisions[fieldPath] || {
      decision: 'accepted' as const,
      target: suggestion.suggestedCanonicalField,
      rationale: '',
    };
    let next = { ...previous, ...patch };
    if (patch.decision === 'accepted') next = { ...next, target: suggestion.suggestedCanonicalField };
    if (patch.decision === 'rejected') next = { ...next, target: 'unmapped' };
    setDecisions({ ...decisions, [fieldPath]: next });
    if (next.target !== 'unmapped') {
      setActivity((form) => ({
        ...form,
        [next.target]: fieldValue(suggestion.confirmedValue, next.target),
      }));
    }
  };

  const createCandidate = async () => {
    if (!review || !suggestions) return;
    setSaving(true);
    try {
      const created = await evidenceActivityPromotionApi.createCandidate(evidenceId, review.id, {
        candidateReference,
        suggestionSha256: suggestions.suggestionSha256,
        notes,
        fieldDecisions: suggestions.fields.map((field) => ({
          fieldPath: field.fieldPath,
          decision: decisions[field.fieldPath]?.decision || 'rejected',
          confirmedCanonicalField: decisions[field.fieldPath]?.target || 'unmapped',
          rationale: decisions[field.fieldPath]?.rationale || '',
        })),
        overrideRationales: overrides,
        anomalyResolutions: warningCodes
          .filter((code) => warningRationales[code]?.trim())
          .map((code) => ({
            code,
            resolution: 'accepted_with_rationale' as const,
            rationale: warningRationales[code].trim(),
          })),
        evidenceMatches: [
          ...suggestions.evidenceMatches.slice(1).flatMap((item) => {
            const decision = evidenceMatchDecisions[item.evidenceDocumentId];
            return decision?.decision ? [{
              evidenceDocumentId: item.evidenceDocumentId,
              relationship: decision.relationship,
              decision: decision.decision,
              rationale: decision.rationale.trim(),
            }] : [];
          }),
          ...(matchEvidenceId.trim() ? [{
              evidenceDocumentId: matchEvidenceId.trim(),
              relationship: matchRelationship,
              decision: 'accepted' as const,
              rationale: matchRationale.trim(),
            }] : []),
        ],
        activityPayload: {
          activityReference: activity.activityReference,
          facilityRevisionId: activity.facilityRevisionId,
          ...(activity.processRevisionId ? { processRevisionId: activity.processRevisionId } : {}),
          ...(activity.measurementPointRevisionId ? { measurementPointRevisionId: activity.measurementPointRevisionId } : {}),
          activityType: activity.activityType,
          periodStart: activity.periodStart,
          periodEnd: activity.periodEnd,
          quantity: Number(activity.quantity),
          canonicalUnit: activity.canonicalUnit,
          sourceKind: activity.sourceKind,
          dataQualityLevel: activity.dataQualityLevel,
        },
      });
      setCandidates((current) => [created, ...current]);
      toast({
        title: created.status === 'ready_for_promotion' ? 'Candidate đã sẵn sàng promote.' : 'Candidate được lưu nhưng đang bị chặn.',
        variant: created.status === 'blocked' ? 'destructive' : undefined,
      });
    } catch (cause) {
      toast({ title: cause instanceof Error ? cause.message : 'Không tạo được candidate.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const promote = async (candidate: ActivityPromotionCandidate) => {
    setSaving(true);
    try {
      await evidenceActivityPromotionApi.promote(evidenceId, candidate.id, attestations[candidate.id] || '');
      toast({ title: 'Đã promote thành dữ liệu hoạt động chính thức với đầy đủ lineage.' });
      await load();
    } catch (cause) {
      toast({ title: cause instanceof Error ? cause.message : 'Không promote được candidate.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 rounded-lg border p-4 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Đang tải kiểm soát promotion…</div>;
  if (error) return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>;
  if (!review || !suggestions) {
    return (
      <Alert className="border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-700" />
        <AlertDescription className="text-xs text-amber-900">
          Phải xác nhận đầy đủ từng trường AI/OCR trước. Kết quả AI chưa phải dữ liệu hoạt động chính thức.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-700" />Promotion có kiểm soát sang Activity</h3>
          <p className="mt-1 text-xs text-muted-foreground">AI chỉ gợi ý mapping; quản trị viên tạo candidate và promote ở hai hành động riêng biệt.</p>
        </div>
        <Badge variant="outline">{suggestions.engine} · {suggestions.engineVersion}</Badge>
      </div>

      <div className="rounded-lg border bg-background p-3 text-xs">
        <p><b>Người duyệt:</b> {review.reviewerName} · {review.reviewerRole}</p>
        <p className="mt-1 break-all text-muted-foreground"><b>Suggestion SHA-256:</b> {suggestions.suggestionSha256}</p>
        <p className="mt-1"><b>Evidence match:</b> nguồn gốc được chấp nhận tự động chỉ cho chứng từ checksum-bound hiện tại.</p>
      </div>

      {suggestions.evidenceMatches.length > 1 && <div className="space-y-3 rounded-lg border bg-background p-3">
        <p className="text-xs font-semibold">Gợi ý chứng từ hỗ trợ — bắt buộc accept/reject từng mục</p>
        {suggestions.evidenceMatches.slice(1).map((item) => {
          const decision = evidenceMatchDecisions[item.evidenceDocumentId];
          return <div key={item.evidenceDocumentId} className="grid gap-2 rounded border p-3 text-xs md:grid-cols-[1.4fr_0.7fr_0.8fr_1.5fr]">
            <div><p className="font-medium">{item.evidence?.documentName || item.evidenceDocumentId}</p><p className="text-muted-foreground">{item.evidence?.evidenceType} · {Math.round(item.confidence * 100)}% · {item.rationale}</p></div>
            <select aria-label="Quyết định evidence match" className="h-9 rounded border bg-background px-2" value={decision?.decision || ''} onChange={(event) => setEvidenceMatchDecisions({ ...evidenceMatchDecisions, [item.evidenceDocumentId]: { ...decision, decision: event.target.value as EvidenceMatchDecision['decision'] } })}><option value="">Chọn quyết định</option><option value="accepted">accept</option><option value="rejected">reject</option></select>
            <select aria-label="Quan hệ evidence match" className="h-9 rounded border bg-background px-2" value={decision?.relationship || 'supports_activity'} onChange={(event) => setEvidenceMatchDecisions({ ...evidenceMatchDecisions, [item.evidenceDocumentId]: { ...decision, relationship: event.target.value as EvidenceMatchDecision['relationship'] } })}><option value="supports_activity">supports activity</option><option value="calibration_record">calibration record</option><option value="review_record">review record</option></select>
            <Input className="h-9 text-xs" placeholder="Lý do quyết định (tối thiểu 10 ký tự)" value={decision?.rationale || ''} onChange={(event) => setEvidenceMatchDecisions({ ...evidenceMatchDecisions, [item.evidenceDocumentId]: { ...decision, rationale: event.target.value } })} />
          </div>;
        })}
        {!evidenceMatchesComplete && <p className="text-xs text-amber-700">Chưa đủ quyết định và giải trình cho tất cả evidence-match suggestions.</p>}
      </div>}

      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full min-w-[860px] text-xs">
          <thead className="bg-slate-50"><tr><th className="p-2 text-left">Trường nguồn</th><th className="p-2 text-left">Giá trị đã duyệt</th><th className="p-2 text-left">Gợi ý</th><th className="p-2 text-left">Quyết định</th><th className="p-2 text-left">Target xác nhận</th><th className="p-2 text-left">Lý do</th></tr></thead>
          <tbody>{suggestions.fields.map((field) => {
            const decision = decisions[field.fieldPath];
            return <tr key={field.fieldPath} className="border-t align-top">
              <td className="p-2 font-medium">{field.fieldPath}</td>
              <td className="max-w-[160px] break-words p-2">{String(field.confirmedValue ?? '—')}</td>
              <td className="p-2"><span className="font-medium">{field.suggestedCanonicalField}</span><br /><span className="text-muted-foreground">{Math.round(field.confidence * 100)}% · {field.rationale}</span></td>
              <td className="p-2"><select className="h-8 rounded border bg-background px-2" value={decision?.decision || 'accepted'} onChange={(event) => changeDecision(field.fieldPath, { decision: event.target.value as MappingDecision['decision'] }, field)}><option value="accepted">accept</option><option value="corrected">correct</option><option value="rejected">reject</option></select></td>
              <td className="p-2"><select disabled={decision?.decision !== 'corrected'} className="h-8 rounded border bg-background px-2 disabled:opacity-60" value={decision?.target || 'unmapped'} onChange={(event) => changeDecision(field.fieldPath, { target: event.target.value as CanonicalActivityField }, field)}>{TARGETS.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}</select></td>
              <td className="p-2"><Input className="h-8 min-w-[190px] text-xs" value={decision?.rationale || ''} onChange={(event) => changeDecision(field.fieldPath, { rationale: event.target.value }, field)} /></td>
            </tr>;
          })}</tbody>
        </table>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Candidate reference"><Input value={candidateReference} onChange={(event) => setCandidateReference(event.target.value)} /></Field>
        <Field label="Cơ sở"><select required className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={activity.facilityRevisionId} onChange={(event) => setActivity({ ...activity, facilityRevisionId: event.target.value, processRevisionId: '', measurementPointRevisionId: '' })}><option value="">Chọn facility revision</option>{facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name} · rev {facility.revision}</option>)}</select></Field>
        <Field label="Quy trình (không bắt buộc)"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={activity.processRevisionId} onChange={(event) => setActivity({ ...activity, processRevisionId: event.target.value, measurementPointRevisionId: '' })}><option value="">Không chọn</option>{filteredProcesses.map((process) => <option key={process.id} value={process.id}>{process.name}</option>)}</select></Field>
        <Field label="Điểm đo (không bắt buộc)"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={activity.measurementPointRevisionId} onChange={(event) => setActivity({ ...activity, measurementPointRevisionId: event.target.value })}><option value="">Không chọn</option>{filteredPoints.map((point) => <option key={point.id} value={point.id}>{point.measurementPointReference}</option>)}</select></Field>
        <Field label="Mã hoạt động"><Input value={activity.activityReference} onChange={(event) => setActivity({ ...activity, activityReference: event.target.value })} /></Field>
        <Field label="Loại hoạt động"><Input value={activity.activityType} onChange={(event) => setActivity({ ...activity, activityType: event.target.value })} /></Field>
        <Field label="Bắt đầu"><Input type="date" value={activity.periodStart} onChange={(event) => setActivity({ ...activity, periodStart: event.target.value })} /></Field>
        <Field label="Kết thúc"><Input type="date" value={activity.periodEnd} onChange={(event) => setActivity({ ...activity, periodEnd: event.target.value })} /></Field>
        <Field label="Số lượng"><Input type="number" min="0" step="any" value={activity.quantity} onChange={(event) => setActivity({ ...activity, quantity: event.target.value })} /></Field>
        <Field label="Đơn vị chuẩn"><Input value={activity.canonicalUnit} onChange={(event) => setActivity({ ...activity, canonicalUnit: event.target.value })} /></Field>
        <Field label="Nguồn"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={activity.sourceKind} onChange={(event) => setActivity({ ...activity, sourceKind: event.target.value as ActivityForm['sourceKind'] })}>{['invoice', 'meter', 'plc', 'sensor', 'supplier', 'manual', 'api'].map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="DQL (OCR chỉ được L1–L3)"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={activity.dataQualityLevel} onChange={(event) => setActivity({ ...activity, dataQualityLevel: event.target.value as ActivityForm['dataQualityLevel'] })}><option>L1</option><option>L2</option><option>L3</option></select></Field>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {REQUIRED_OVERRIDES.filter((target) => !mappedTargets.has(target)).map((target) => <Field key={target} label={`Lý do nhập thủ công ${target}`}><Input placeholder="Tối thiểu 10 ký tự" value={overrides[target] || ''} onChange={(event) => setOverrides({ ...overrides, [target]: event.target.value })} /></Field>)}
      </div>

      {warningCodes.length > 0 && <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-semibold text-amber-900">Cảnh báo phải được giải trình</p>{warningCodes.map((code) => <Field key={code} label={code}><Input placeholder="Giải trình tối thiểu 10 ký tự" value={warningRationales[code] || ''} onChange={(event) => setWarningRationales({ ...warningRationales, [code]: event.target.value })} /></Field>)}</div>}

      <div className="grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-3">
        <Field label="Evidence bổ sung (UUID, tùy chọn)"><Input value={matchEvidenceId} onChange={(event) => setMatchEvidenceId(event.target.value)} /></Field>
        <Field label="Quan hệ"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={matchRelationship} onChange={(event) => setMatchRelationship(event.target.value as typeof matchRelationship)}><option value="supports_activity">supports activity</option><option value="calibration_record">calibration record</option><option value="review_record">review record</option></select></Field>
        <Field label="Lý do evidence match"><Input value={matchRationale} onChange={(event) => setMatchRationale(event.target.value)} /></Field>
      </div>
      <Field label="Ghi chú kiểm duyệt candidate"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
      <Button disabled={saving || !evidenceMatchesComplete} onClick={() => void createCandidate()} className="w-full"><ArrowRight className="mr-2 h-4 w-4" />Tạo candidate bất biến (chưa tạo dữ liệu chính thức)</Button>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Candidate đã lưu</h4>
        {candidates.length === 0 && <p className="text-xs text-muted-foreground">Chưa có candidate.</p>}
        {candidates.map((candidate) => <div key={candidate.id} className="space-y-2 rounded-lg border bg-background p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{candidate.candidateReference} · rev {candidate.revision}</span><div className="flex gap-2"><Badge variant={candidate.status === 'blocked' ? 'destructive' : 'outline'}>{candidate.status}</Badge>{candidate.promoted && <Badge className="bg-emerald-600">promoted</Badge>}</div></div>
          {candidate.blockerCodes.length > 0 && <p className="text-destructive"><b>Blockers:</b> {candidate.blockerCodes.join(' · ')}</p>}
          {candidate.warningCodes.length > 0 && <p className="text-amber-700"><b>Warnings:</b> {candidate.warningCodes.join(' · ')}</p>}
          {candidate.anomalySnapshot.length > 0 && <ul className="space-y-1 text-muted-foreground">{candidate.anomalySnapshot.map((item, index) => <li key={`${item.code}-${index}`}>• {item.code}: {item.description}</li>)}</ul>}
          <p className="break-all text-muted-foreground">Payload SHA-256: {candidate.payloadSha256}</p>
          {candidate.status === 'ready_for_promotion' && !candidate.promoted && <div className="space-y-2 border-t pt-2"><Label>Xác nhận riêng của industrial_activity_promoter (tối thiểu 20 ký tự)</Label><Textarea value={attestations[candidate.id] || ''} onChange={(event) => setAttestations({ ...attestations, [candidate.id]: event.target.value })} /><Button disabled={saving || (attestations[candidate.id] || '').trim().length < 20} onClick={() => void promote(candidate)} className="w-full bg-emerald-700 hover:bg-emerald-800"><CheckCircle2 className="mr-2 h-4 w-4" />Promote thành activity chính thức</Button></div>}
        </div>)}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
