'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, FileUp, LockKeyhole, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  createReachSvhcDossier, fetchReachObligationEvents, fetchReachSvhcDossiers, lockReachEvidence,
  recordReachObligationEvent, reviewReachSvhcDossier, uploadReachEvidence,
  type ReachObligationEvent, type ReachSvhcDossier, type ReachSvhcDossierInput, type ReachSvhcReview
} from '@/lib/weave-v2/shipmentExportApi';

const localDate = () => new Date().toISOString().slice(0, 10);
const csv = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const emptyInput = (): ReachSvhcDossierInput => ({
  dossierReference: '', assessmentDate: localDate(), productReference: '', productName: '', articleCategory: 'consumer clothing',
  consumerArticle: true, placedOnEuMarket: true, marketCodes: ['DE'], euActorRole: 'importer', articleLevelAssessmentConfirmed: false,
  candidateListSnapshotDate: '2026-02-04', candidateListEntryCount: 253, reachConsolidatedDate: '2026-06-22',
  components: [{ componentReference: 'component-1', componentName: '', articleReference: '', homogeneousMaterialReference: '',
    materialName: '', materialLocation: '', substances: [{ substanceName: '', casNumber: '', ecNumber: '', echaId: '',
      candidateListStatus: 'unknown', candidateInclusionDate: null, concentrationPercentWw: 0, annualTonnage: null,
      location: '', evidenceBasis: 'laboratory_test', detectionLimit: null, detectionLimitUnit: 'mg_kg',
      safeUseInstructions: [{ marketCode: 'DE', languageCode: 'de-DE', text: '', operatorApproved: false }],
      article7Exemption: 'none', article7ExemptionRationale: '', evidenceDocumentIds: [],
      restrictionAssessments: [{ entryNumber: '72', scopeDecision: 'unknown', scopeRationale: '', legalLimit: null,
        limitUnit: 'mg_kg_material', measuredValue: null, prohibitedWhen: 'at_or_above_limit', testMethod: '', exemptionClaimed: false,
        exemptionRationale: '', evidenceDocumentIds: [] }] }] }], supplierDeclarationEvidenceIds: [], notes: ''
});

export default function ReachSvhcDossierPanel({ shipmentId }: { shipmentId: string }) {
  const [input, setInput] = useState<ReachSvhcDossierInput>(emptyInput);
  const [markets, setMarkets] = useState('DE');
  const [dossiers, setDossiers] = useState<ReachSvhcDossier[]>([]);
  const [events, setEvents] = useState<ReachObligationEvent[]>([]);
  const [upload, setUpload] = useState<File | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [event, setEvent] = useState({ eventType: 'consumer_request_received' as ReachObligationEvent['eventType'],
    eventReference: '', occurredAt: new Date().toISOString().slice(0, 16), summary: '', externalReference: '', evidenceDocumentId: '' });
  const [busy, setBusy] = useState('');
  const latest = dossiers[0] || null;
  const component = input.components[0]; const substance = component.substances[0]; const restriction = substance.restrictionAssessments[0];

  const load = useCallback(async () => {
    const [nextDossiers, nextEvents] = await Promise.all([fetchReachSvhcDossiers(shipmentId), fetchReachObligationEvents(shipmentId)]);
    setDossiers(nextDossiers); setEvents(nextEvents);
  }, [shipmentId]);
  useEffect(() => { void load().catch(() => { setDossiers([]); setEvents([]); }); }, [load]);
  const run = async (key: string, action: () => Promise<unknown>, message: string) => {
    setBusy(key); try { await action(); toast.success(message); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Thao tác R11 thất bại.'); } finally { setBusy(''); }
  };
  const patchComponent = (patch: Partial<ReachSvhcDossierInput['components'][number]>) =>
    setInput((current) => ({ ...current, components: [{ ...current.components[0], ...patch }] }));
  const patchSubstance = (patch: Partial<typeof substance>) =>
    patchComponent({ substances: [{ ...input.components[0].substances[0], ...patch }] });
  const patchRestriction = (patch: Partial<typeof restriction>) =>
    patchSubstance({ restrictionAssessments: [{ ...substance.restrictionAssessments[0], ...patch }] });
  const patchSafeUse = (patch: Partial<typeof substance.safeUseInstructions[number]>) =>
    patchSubstance({ safeUseInstructions: [{ ...substance.safeUseInstructions[0], ...patch }] });
  const uploadAndLock = () => run('upload', async () => {
    const result = await uploadReachEvidence(shipmentId, upload!); await lockReachEvidence(result.id);
    setInput((current) => {
      const c = current.components[0]; const s = c.substances[0]; const r = s.restrictionAssessments[0];
      return { ...current, supplierDeclarationEvidenceIds: [...new Set([...current.supplierDeclarationEvidenceIds, result.id])],
        components: [{ ...c, substances: [{ ...s, evidenceDocumentIds: [...new Set([...s.evidenceDocumentIds, result.id])],
          restrictionAssessments: [{ ...r, evidenceDocumentIds: [...new Set([...r.evidenceDocumentIds, result.id])] }] }] }] };
    }); setUpload(null);
  }, 'Đã tải và khóa bằng chứng hóa chất.');
  const create = () => run('create', () => createReachSvhcDossier(shipmentId,
    { ...input, marketCodes: csv(markets).map((item) => item.toUpperCase()) }), 'Đã tạo revision REACH/SVHC bất biến.');
  const review = (decision: ReachSvhcReview['decision']) => run('review', () => reviewReachSvhcDossier(shipmentId, latest!.id,
    { reviewerRole: 'chemical_compliance_reviewer', decision, notes: reviewNotes }),
  decision === 'approved_for_internal_release' ? 'Đã duyệt phát hành nội bộ.' : 'Đã ghi quyết định chemical review.');
  const recordEvent = () => run('event', () => recordReachObligationEvent(shipmentId, latest!.id, {
    ...event, occurredAt: new Date(event.occurredAt).toISOString(), externalReference: event.externalReference || undefined,
    evidenceDocumentId: event.evidenceDocumentId || undefined, consumerPersonalDataIncluded: false
  }), 'Đã ghi obligation event bất biến.');

  return <Card><CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
    <span>13. R11 — REACH/SVHC article dossier</span><Badge variant="outline">REACH 22/06/2026 · Candidate List 253 entries</Badge>
  </CardTitle></CardHeader><CardContent className="space-y-5">
    <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mr-2 inline h-4 w-4" />
      Đây là hồ sơ kiểm soát nội bộ giới hạn, không phải “REACH certificate”, ECHA/SCIP notification hay xác nhận pháp lý.
      Ngưỡng SVHC được đánh giá ở từng article/component; Annex XVII phải theo đúng entry, đơn vị, vật liệu đồng nhất và ngoại lệ.</div>
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <div><Label>Mã dossier</Label><Input value={input.dossierReference} onChange={(e) => setInput((v) => ({ ...v, dossierReference: e.target.value }))} /></div>
      <div><Label>Ngày đánh giá</Label><Input type="date" value={input.assessmentDate} onChange={(e) => setInput((v) => ({ ...v, assessmentDate: e.target.value }))} /></div>
      <div><Label>Product/SKU</Label><Input value={input.productReference} onChange={(e) => setInput((v) => ({ ...v, productReference: e.target.value }))} /></div>
      <div><Label>Tên sản phẩm</Label><Input value={input.productName} onChange={(e) => setInput((v) => ({ ...v, productName: e.target.value }))} /></div>
      <div><Label>EU actor role</Label><Input value={input.euActorRole} onChange={(e) => setInput((v) => ({ ...v, euActorRole: e.target.value }))} /></div>
      <div><Label>Thị trường EU</Label><Input value={markets} onChange={(e) => setMarkets(e.target.value)} /></div>
      <div><Label>Article-level assessment</Label><Select value={input.articleLevelAssessmentConfirmed ? 'yes' : 'no'} onValueChange={(value) => setInput((v) => ({ ...v, articleLevelAssessmentConfirmed: value === 'yes' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Đã xác nhận</SelectItem><SelectItem value="no">Chưa xác nhận</SelectItem></SelectContent></Select></div>
    </div>
    <div className="space-y-3 rounded border p-3"><b className="text-sm">Article/component và homogeneous material</b><div className="grid gap-2 md:grid-cols-3">
      <Input placeholder="Component reference" value={component.componentReference} onChange={(e) => patchComponent({ componentReference: e.target.value })} />
      <Input placeholder="Component name" value={component.componentName} onChange={(e) => patchComponent({ componentName: e.target.value })} />
      <Input placeholder="Article reference" value={component.articleReference} onChange={(e) => patchComponent({ articleReference: e.target.value })} />
      <Input placeholder="Homogeneous material reference" value={component.homogeneousMaterialReference} onChange={(e) => patchComponent({ homogeneousMaterialReference: e.target.value })} />
      <Input placeholder="Material name" value={component.materialName} onChange={(e) => patchComponent({ materialName: e.target.value })} />
      <Input placeholder="Material location" value={component.materialLocation} onChange={(e) => patchComponent({ materialLocation: e.target.value })} />
    </div></div>
    <div className="space-y-3 rounded border p-3"><b className="text-sm">Substance · Candidate List · Article 7/33</b><div className="grid gap-2 md:grid-cols-4">
      <Input placeholder="Substance name" value={substance.substanceName} onChange={(e) => patchSubstance({ substanceName: e.target.value })} />
      <Input placeholder="CAS number" value={substance.casNumber} onChange={(e) => patchSubstance({ casNumber: e.target.value })} />
      <Select value={substance.candidateListStatus} onValueChange={(value: typeof substance.candidateListStatus) => patchSubstance({ candidateListStatus: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['included', 'not_included', 'unknown'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
      <Input type="number" step="0.001" min="0" max="100" placeholder="Concentration % w/w" value={substance.concentrationPercentWw} onChange={(e) => patchSubstance({ concentrationPercentWw: Number(e.target.value) })} />
      <Input type="number" step="0.001" min="0" placeholder="Annual tonnes" value={substance.annualTonnage ?? ''} onChange={(e) => patchSubstance({ annualTonnage: e.target.value === '' ? null : Number(e.target.value) })} />
      <Input placeholder="Substance location" value={substance.location} onChange={(e) => patchSubstance({ location: e.target.value })} />
      <Input type="number" min="0" placeholder="Detection limit" value={substance.detectionLimit ?? ''} onChange={(e) => patchSubstance({ detectionLimit: e.target.value === '' ? null : Number(e.target.value) })} />
      <Input placeholder="Detection limit unit" value={substance.detectionLimitUnit} onChange={(e) => patchSubstance({ detectionLimitUnit: e.target.value })} />
    </div><div className="grid gap-2 md:grid-cols-3"><Input value={substance.safeUseInstructions[0].languageCode} onChange={(e) => patchSafeUse({ languageCode: e.target.value })} /><Textarea className="md:col-span-2" placeholder="Article 33 safe-use information" value={substance.safeUseInstructions[0].text} onChange={(e) => patchSafeUse({ text: e.target.value })} /></div>
      <Select value={substance.safeUseInstructions[0].operatorApproved ? 'yes' : 'no'} onValueChange={(value) => patchSafeUse({ operatorApproved: value === 'yes' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Safe-use text đã được operator duyệt</SelectItem><SelectItem value="no">Chưa duyệt</SelectItem></SelectContent></Select>
    </div>
    <div className="space-y-3 rounded border p-3"><b className="text-sm">Annex XVII restriction assessment</b><div className="grid gap-2 md:grid-cols-4">
      <Input placeholder="Entry number" value={restriction.entryNumber} onChange={(e) => patchRestriction({ entryNumber: e.target.value })} />
      <Select value={restriction.scopeDecision} onValueChange={(value: typeof restriction.scopeDecision) => patchRestriction({ scopeDecision: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['applies', 'not_applies', 'unknown'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
      <Input type="number" min="0" placeholder="Legal limit" value={restriction.legalLimit ?? ''} onChange={(e) => patchRestriction({ legalLimit: e.target.value === '' ? null : Number(e.target.value) })} />
      <Input type="number" min="0" placeholder="Measured value" value={restriction.measuredValue ?? ''} onChange={(e) => patchRestriction({ measuredValue: e.target.value === '' ? null : Number(e.target.value) })} />
    </div><Select value={restriction.prohibitedWhen} onValueChange={(value: typeof restriction.prohibitedWhen) => patchRestriction({ prohibitedWhen: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="at_or_above_limit">Prohibited at or above limit</SelectItem><SelectItem value="above_limit">Prohibited above limit</SelectItem></SelectContent></Select><Textarea placeholder="Scope rationale / exemption boundary" value={restriction.scopeRationale} onChange={(e) => patchRestriction({ scopeRationale: e.target.value })} /><Input placeholder="Test method" value={restriction.testMethod} onChange={(e) => patchRestriction({ testMethod: e.target.value })} /></div>
    <div className="space-y-2 rounded border p-3"><b className="text-sm">Supplier declaration · SDS · laboratory evidence</b><div className="flex flex-wrap gap-2"><Input type="file" className="max-w-md" onChange={(e) => setUpload(e.target.files?.[0] || null)} /><Button size="sm" variant="outline" disabled={!upload || Boolean(busy)} onClick={() => void uploadAndLock()}><FileUp className="mr-1 h-3 w-3" />Tải và khóa</Button></div><Input placeholder="Evidence UUIDs" value={input.supplierDeclarationEvidenceIds.join(', ')} onChange={(e) => setInput((v) => ({ ...v, supplierDeclarationEvidenceIds: csv(e.target.value) }))} /><Button disabled={!input.dossierReference || Boolean(busy)} onClick={() => void create()}><LockKeyhole className="mr-2 h-4 w-4" />Tạo REACH revision</Button></div>
    {latest && <div className="space-y-3 rounded border p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><b>{latest.dossierReference} · rev {latest.revision}</b><Badge>{latest.releaseStatus}</Badge><Badge variant="outline">{latest.automatedStatus}</Badge><span className="text-xs text-slate-500">SHA {latest.resultSha256.slice(0, 12)}…</span><Button size="sm" variant="ghost" onClick={() => void load()}><RefreshCw className="h-3 w-3" /></Button></div>
      {latest.result.obligations.map((item, index) => <p key={`${item.code}-${index}`} className="rounded bg-amber-50 p-2"><b>{item.code}</b> · {item.substanceName} · {item.componentReference}</p>)}
      {latest.result.findings.map((item) => <p key={`${item.code}:${item.path}`} className="rounded border p-2"><b>{item.code}</b> · {item.message}</p>)}
      <a className="text-xs text-blue-700 underline" href={latest.result.sources[1]?.url} target="_blank" rel="noreferrer">Candidate List ECHA · {latest.rulesetVersion}</a>
      <div className="space-y-2 rounded bg-slate-50 p-3"><b>Chemical review append-only</b><Textarea placeholder="Căn cứ và giới hạn quyết định" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} /><div className="flex gap-2"><Button size="sm" disabled={!reviewNotes || latest.automatedStatus !== 'ready_for_chemical_review' || Boolean(busy)} onClick={() => void review('approved_for_internal_release')}>Duyệt phát hành nội bộ</Button><Button size="sm" variant="outline" disabled={!reviewNotes || Boolean(busy)} onClick={() => void review('needs_information')}>Cần thông tin</Button><Button size="sm" variant="outline" disabled={!reviewNotes || Boolean(busy)} onClick={() => void review('rejected')}>Bác</Button></div></div>
      <div className="space-y-2 rounded border p-3"><b>Article 33 / consumer 45-day / Article 7 / SCIP event ledger — không chứa dữ liệu cá nhân</b><div className="grid gap-2 md:grid-cols-3"><Select value={event.eventType} onValueChange={(value: ReachObligationEvent['eventType']) => setEvent((v) => ({ ...v, eventType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['supply_chain_communication', 'consumer_request_received', 'consumer_response_sent', 'article7_notification', 'scip_notification', 'authority_request', 'authority_response', 'corrective_action'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select><Input placeholder="Event reference" value={event.eventReference} onChange={(e) => setEvent((v) => ({ ...v, eventReference: e.target.value }))} /><Input type="datetime-local" value={event.occurredAt} onChange={(e) => setEvent((v) => ({ ...v, occurredAt: e.target.value }))} /><Input placeholder="External reference" value={event.externalReference} onChange={(e) => setEvent((v) => ({ ...v, externalReference: e.target.value }))} /><Input placeholder="Locked proof UUID" value={event.evidenceDocumentId} onChange={(e) => setEvent((v) => ({ ...v, evidenceDocumentId: e.target.value }))} /></div><Textarea placeholder="Tóm tắt không chứa dữ liệu cá nhân" value={event.summary} onChange={(e) => setEvent((v) => ({ ...v, summary: e.target.value }))} /><Button size="sm" disabled={!event.eventReference || !event.summary || Boolean(busy)} onClick={() => void recordEvent()}>Ghi obligation event</Button>{events.slice(0, 5).map((item) => <p key={item.id} className="text-xs"><b>{item.eventReference}</b> · {item.eventType}{item.responseDueAt ? ` · hạn ${item.responseDueAt.slice(0, 10)}` : ''}{item.responseOverdue ? ' · QUÁ HẠN' : ''}</p>)}</div>
    </div>}
  </CardContent></Card>;
}
