'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileUp, Gavel, LockKeyhole, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  createEnvironmentalClaimDossier, fetchEnvironmentalClaimDossiers,
  lockEnvironmentalClaimEvidence, reviewEnvironmentalClaimDossier,
  uploadEnvironmentalClaimEvidence, type EnvironmentalClaimDossier,
  type EnvironmentalClaimInput, type EnvironmentalClaimKind, type EnvironmentalClaimReview
} from '@/lib/weave-v2/shipmentExportApi';

const localDate = () => {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};
const csv = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const emptyInput = (): EnvironmentalClaimInput => ({
  claimReference: '', exactClaimText: '', publicCommunication: true, channel: 'website',
  marketCodes: ['DE'], languageCode: 'de-DE', communicationStart: localDate(), communicationEnd: null,
  subjectType: 'sku', subjectReference: '', scopeStatement: '', claimKind: 'specific_environmental',
  specificationText: '', claimScopeMode: 'specific_aspect', actualCoverage: 'aspect_only',
  recognizedExcellentPerformance: false,
  methodology: { standard: '', version: '', pcr: '', calculationSha256: '', datasetReferences: [], factorReferences: [] },
  comparison: { baseline: '', comparator: '', sameMethodAndScope: false },
  futureCommitment: { implementationPlanUrl: '', milestones: [], independentMonitoring: false },
  labelScheme: { schemeType: 'other', schemeName: '', publicCriteriaUrl: '' },
  limitations: [], exclusions: [], uncertaintyStatement: '', qualifiers: [],
  updateTriggers: [], withdrawalTriggers: [], assuranceReference: '', evidenceDocumentIds: [], notes: ''
});

export default function EnvironmentalClaimRegisterPanel({ shipmentId }: { shipmentId: string }) {
  const [input, setInput] = useState<EnvironmentalClaimInput>(emptyInput);
  const [markets, setMarkets] = useState('DE');
  const [datasets, setDatasets] = useState('');
  const [factors, setFactors] = useState('');
  const [limitations, setLimitations] = useState('');
  const [exclusions, setExclusions] = useState('');
  const [qualifiers, setQualifiers] = useState('');
  const [updateTriggers, setUpdateTriggers] = useState('method, dataset or factor changes');
  const [withdrawalTriggers, setWithdrawalTriggers] = useState('evidence expires or is revoked');
  const [milestones, setMilestones] = useState('');
  const [dossiers, setDossiers] = useState<EnvironmentalClaimDossier[]>([]);
  const [reviewNotes, setReviewNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState('');
  const latest = dossiers[0] || null;

  const load = useCallback(async () => {
    setDossiers(await fetchEnvironmentalClaimDossiers(shipmentId));
  }, [shipmentId]);
  useEffect(() => { void load().catch(() => setDossiers([])); }, [load]);

  const sourceById = useMemo(() => new Map(
    (latest?.result.sources || []).map((source) => [source.id, source])
  ), [latest]);
  const setMethod = (patch: Partial<EnvironmentalClaimInput['methodology']>) =>
    setInput((current) => ({ ...current, methodology: { ...current.methodology, ...patch } }));

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try { await action(); toast.success(success); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Thao tác R18 thất bại.'); }
    finally { setBusy(''); }
  };

  const uploadAndLock = () => run('upload', async () => {
    const uploaded = await uploadEnvironmentalClaimEvidence(shipmentId, file!);
    await lockEnvironmentalClaimEvidence(uploaded.id);
    setInput((current) => ({ ...current, evidenceDocumentIds: [...new Set([...current.evidenceDocumentIds, uploaded.id])] }));
    setFile(null);
  }, 'Đã tải và khóa bằng chứng substantiation.');

  const create = () => run('create', () => createEnvironmentalClaimDossier(shipmentId, {
    ...input, marketCodes: csv(markets).map((item) => item.toUpperCase()),
    methodology: { ...input.methodology, datasetReferences: csv(datasets), factorReferences: csv(factors) },
    futureCommitment: { ...input.futureCommitment, milestones: csv(milestones) },
    limitations: csv(limitations), exclusions: csv(exclusions), qualifiers: csv(qualifiers),
    updateTriggers: csv(updateTriggers), withdrawalTriggers: csv(withdrawalTriggers)
  }), 'Đã tạo revision R18 bất biến.');

  const review = (decision: EnvironmentalClaimReview['decision']) => run('review', () =>
    reviewEnvironmentalClaimDossier(shipmentId, latest!.id, {
      reviewerRole: 'legal_claim_reviewer', decision, notes: reviewNotes
    }), decision === 'approved_for_publication'
    ? 'Đã phê duyệt nội bộ cho đúng nội dung/kênh/thời hạn đã khóa.' : 'Đã ghi nhận quyết định pháp lý R18.');

  return <Card>
    <CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
      <span>10. R18 — Sổ đăng ký environmental claim</span><Badge variant="outline">EU coverage giới hạn</Badge>
    </CardTitle></CardHeader>
    <CardContent className="space-y-5">
      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertTriangle className="mr-2 inline h-4 w-4" />Không được xuất bản chỉ vì dossier hiện “ready”.
        Cần phê duyệt pháp lý có tên, bằng chứng còn hiệu lực và đúng nguyên văn claim/kênh/thị trường/thời hạn.
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div><Label>Mã claim ổn định</Label><Input value={input.claimReference} onChange={(e) => setInput((v) => ({ ...v, claimReference: e.target.value }))} /></div>
        <div><Label>Public communication</Label><Select value={input.publicCommunication ? 'yes' : 'no'} onValueChange={(v) => setInput((c) => ({ ...c, publicCommunication: v === 'yes' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Có — cần legal approval</SelectItem><SelectItem value="no">Internal draft</SelectItem></SelectContent></Select></div>
        <div><Label>Kênh</Label><Select value={input.channel} onValueChange={(v: EnvironmentalClaimInput['channel']) => setInput((c) => ({ ...c, channel: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['website', 'product_label', 'marketplace', 'advertising', 'sales_material', 'report', 'other'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Loại claim</Label><Select value={input.claimKind} onValueChange={(v: EnvironmentalClaimKind) => setInput((c) => ({ ...c, claimKind: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['generic_environmental', 'specific_environmental', 'comparative', 'future_performance', 'sustainability_label', 'offset_based_product_climate', 'legal_requirement_feature', 'other'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Thị trường EU, cách nhau dấu phẩy</Label><Input value={markets} onChange={(e) => setMarkets(e.target.value)} /></div>
        <div><Label>Ngôn ngữ</Label><Input placeholder="de-DE" value={input.languageCode} onChange={(e) => setInput((v) => ({ ...v, languageCode: e.target.value }))} /></div>
        <div><Label>Bắt đầu truyền thông</Label><Input type="date" value={input.communicationStart} onChange={(e) => setInput((v) => ({ ...v, communicationStart: e.target.value }))} /></div>
        <div><Label>Kết thúc</Label><Input type="date" value={input.communicationEnd || ''} onChange={(e) => setInput((v) => ({ ...v, communicationEnd: e.target.value || null }))} /></div>
        <div><Label>Đối tượng</Label><Select value={input.subjectType} onValueChange={(v: EnvironmentalClaimInput['subjectType']) => setInput((c) => ({ ...c, subjectType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['product', 'sku', 'batch', 'shipment', 'brand', 'company'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Mã đối tượng</Label><Input value={input.subjectReference} onChange={(e) => setInput((v) => ({ ...v, subjectReference: e.target.value }))} /></div>
        <div><Label>Phạm vi câu chữ</Label><Select value={input.claimScopeMode} onValueChange={(v: EnvironmentalClaimInput['claimScopeMode']) => setInput((c) => ({ ...c, claimScopeMode: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="specific_aspect">Một khía cạnh</SelectItem><SelectItem value="entire_subject">Toàn bộ đối tượng</SelectItem></SelectContent></Select></div>
        <div><Label>Dữ liệu thực tế bao phủ</Label><Select value={input.actualCoverage} onValueChange={(v: EnvironmentalClaimInput['actualCoverage']) => setInput((c) => ({ ...c, actualCoverage: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="aspect_only">Một khía cạnh</SelectItem><SelectItem value="entire_subject">Toàn bộ đối tượng</SelectItem></SelectContent></Select></div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div><Label>Nguyên văn claim</Label><Textarea value={input.exactClaimText} onChange={(e) => setInput((v) => ({ ...v, exactClaimText: e.target.value }))} /></div>
        <div><Label>Thông tin làm rõ hiển thị cùng claim</Label><Textarea value={input.specificationText} onChange={(e) => setInput((v) => ({ ...v, specificationText: e.target.value }))} /></div>
        <div><Label>Mô tả phạm vi</Label><Textarea value={input.scopeStatement} onChange={(e) => setInput((v) => ({ ...v, scopeStatement: e.target.value }))} /></div>
        <div><Label>Bất định</Label><Textarea value={input.uncertaintyStatement} onChange={(e) => setInput((v) => ({ ...v, uncertaintyStatement: e.target.value }))} /></div>
      </div>

      <div className="space-y-3 rounded border p-3">
        <b className="text-sm">Phương pháp, dữ liệu và giới hạn</b>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Method/standard" value={input.methodology.standard} onChange={(e) => setMethod({ standard: e.target.value })} />
          <Input placeholder="Version" value={input.methodology.version} onChange={(e) => setMethod({ version: e.target.value })} />
          <Input placeholder="PCR nếu có" value={input.methodology.pcr} onChange={(e) => setMethod({ pcr: e.target.value })} />
          <Input placeholder="Calculation SHA-256" value={input.methodology.calculationSha256} onChange={(e) => setMethod({ calculationSha256: e.target.value.toLowerCase() })} />
          <Input placeholder="Dataset refs, dấu phẩy" value={datasets} onChange={(e) => setDatasets(e.target.value)} />
          <Input placeholder="Factor refs, dấu phẩy" value={factors} onChange={(e) => setFactors(e.target.value)} />
          <Input placeholder="Giới hạn, dấu phẩy" value={limitations} onChange={(e) => setLimitations(e.target.value)} />
          <Input placeholder="Loại trừ, dấu phẩy" value={exclusions} onChange={(e) => setExclusions(e.target.value)} />
          <Input placeholder="Qualifiers, dấu phẩy" value={qualifiers} onChange={(e) => setQualifiers(e.target.value)} />
          <Input placeholder="Update triggers" value={updateTriggers} onChange={(e) => setUpdateTriggers(e.target.value)} />
          <Input placeholder="Withdrawal triggers" value={withdrawalTriggers} onChange={(e) => setWithdrawalTriggers(e.target.value)} />
          <Input placeholder="Assurance reference" value={input.assuranceReference} onChange={(e) => setInput((v) => ({ ...v, assuranceReference: e.target.value }))} />
        </div>
      </div>

      {(input.claimKind === 'comparative' || input.claimKind === 'future_performance' || input.claimKind === 'sustainability_label') && <div className="grid gap-3 rounded border p-3 md:grid-cols-3">
        {input.claimKind === 'comparative' && <><Input placeholder="Baseline" value={input.comparison.baseline} onChange={(e) => setInput((v) => ({ ...v, comparison: { ...v.comparison, baseline: e.target.value } }))} /><Input placeholder="Comparator" value={input.comparison.comparator} onChange={(e) => setInput((v) => ({ ...v, comparison: { ...v.comparison, comparator: e.target.value } }))} /><Select value={input.comparison.sameMethodAndScope ? 'yes' : 'no'} onValueChange={(x) => setInput((v) => ({ ...v, comparison: { ...v.comparison, sameMethodAndScope: x === 'yes' } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Cùng method/scope</SelectItem><SelectItem value="no">Chưa xác nhận</SelectItem></SelectContent></Select></>}
        {input.claimKind === 'future_performance' && <><Input placeholder="Public implementation plan HTTPS URL" value={input.futureCommitment.implementationPlanUrl} onChange={(e) => setInput((v) => ({ ...v, futureCommitment: { ...v.futureCommitment, implementationPlanUrl: e.target.value } }))} /><Input placeholder="Milestones, dấu phẩy" value={milestones} onChange={(e) => setMilestones(e.target.value)} /><Select value={input.futureCommitment.independentMonitoring ? 'yes' : 'no'} onValueChange={(x) => setInput((v) => ({ ...v, futureCommitment: { ...v.futureCommitment, independentMonitoring: x === 'yes' } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Có giám sát độc lập</SelectItem><SelectItem value="no">Chưa có</SelectItem></SelectContent></Select></>}
        {input.claimKind === 'sustainability_label' && <><Select value={input.labelScheme.schemeType} onValueChange={(x: EnvironmentalClaimInput['labelScheme']['schemeType']) => setInput((v) => ({ ...v, labelScheme: { ...v.labelScheme, schemeType: x } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['certification_scheme', 'public_authority', 'self_declared', 'other'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select><Input placeholder="Scheme name" value={input.labelScheme.schemeName} onChange={(e) => setInput((v) => ({ ...v, labelScheme: { ...v.labelScheme, schemeName: e.target.value } }))} /><Input placeholder="Public criteria URL" value={input.labelScheme.publicCriteriaUrl} onChange={(e) => setInput((v) => ({ ...v, labelScheme: { ...v.labelScheme, publicCriteriaUrl: e.target.value } }))} /></>}
      </div>}

      <div className="space-y-2 rounded border p-3">
        <b className="text-sm">Bằng chứng claim</b>
        <div className="flex flex-wrap gap-2"><Input type="file" className="max-w-md" onChange={(e) => setFile(e.target.files?.[0] || null)} /><Button size="sm" variant="outline" disabled={!file || Boolean(busy)} onClick={() => void uploadAndLock()}><FileUp className="mr-1 h-3 w-3" />Tải và khóa</Button></div>
        <Input placeholder="Evidence UUIDs, cách nhau dấu phẩy" value={input.evidenceDocumentIds.join(', ')} onChange={(e) => setInput((v) => ({ ...v, evidenceDocumentIds: csv(e.target.value) }))} />
        <Textarea placeholder="Ghi chú dossier" value={input.notes} onChange={(e) => setInput((v) => ({ ...v, notes: e.target.value }))} />
        <Button disabled={Boolean(busy) || !input.claimReference || !input.communicationStart} onClick={() => void create()}><Gavel className="mr-2 h-4 w-4" />Tạo revision claim</Button>
      </div>

      {latest && <div className="space-y-3 rounded border p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2"><b>{latest.claimReference} · rev {latest.revision}</b><Badge>{latest.publicationStatus}</Badge><Badge variant="outline">{latest.automatedStatus}</Badge><span className="text-xs text-slate-500">SHA {latest.resultSha256.slice(0, 12)}…</span><Button size="sm" variant="ghost" onClick={() => void load()}><RefreshCw className="h-3 w-3" /></Button></div>
        <p className="rounded bg-slate-50 p-2">“{latest.input.exactClaimText}”</p>
        {latest.result.findings.map((finding) => { const source = finding.sourceId ? sourceById.get(finding.sourceId) : null; return <div key={finding.code} className="rounded border p-2"><div className="flex gap-2"><b>{finding.code}</b><Badge variant="outline">{finding.severity}</Badge></div><p className="text-xs">{finding.message}</p>{source && <a className="text-xs text-blue-700 underline" href={source.url} target="_blank" rel="noreferrer">{source.title} · {source.version}</a>}</div>; })}
        {latest.staleEvidenceIds.length > 0 && <p className="text-xs text-red-700">Evidence cần review lại: {latest.staleEvidenceIds.join(', ')}</p>}
        <div className="space-y-2 rounded border bg-slate-50 p-3"><b>Legal review append-only</b><Textarea placeholder="Căn cứ và giới hạn quyết định" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} /><div className="flex flex-wrap gap-2"><Button size="sm" disabled={!reviewNotes || latest.automatedStatus !== 'ready_for_legal_review' || Boolean(busy)} onClick={() => void review('approved_for_publication')}><LockKeyhole className="mr-1 h-3 w-3" />Phê duyệt đúng phạm vi</Button><Button size="sm" variant="outline" disabled={!reviewNotes || Boolean(busy)} onClick={() => void review('needs_information')}>Cần thông tin</Button><Button size="sm" variant="outline" disabled={!reviewNotes || Boolean(busy)} onClick={() => void review('rejected')}>Bác claim</Button><Button size="sm" variant="destructive" disabled={!reviewNotes || latest.publicationStatus !== 'approved_current' || Boolean(busy)} onClick={() => void review('withdrawn')}>Thu hồi</Button></div>{latest.latestReview && <p className="text-xs">Mới nhất: {latest.latestReview.decision} · {latest.latestReview.reviewerName}</p>}</div>
      </div>}
    </CardContent>
  </Card>;
}
