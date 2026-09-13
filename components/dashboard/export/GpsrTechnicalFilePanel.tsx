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
  createGpsrTechnicalFile, fetchGpsrPostMarketEvents, fetchGpsrTechnicalFiles,
  lockGpsrEvidence, recordGpsrPostMarketEvent, reviewGpsrTechnicalFile, uploadGpsrEvidence,
  type GpsrEconomicOperator, type GpsrPostMarketEvent, type GpsrTechnicalFile,
  type GpsrTechnicalFileInput, type GpsrTechnicalFileReview
} from '@/lib/weave-v2/shipmentExportApi';

const localDate = () => {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};
const addYears = (date: string, years: number) => {
  const value = new Date(`${date}T00:00:00Z`); value.setUTCFullYear(value.getUTCFullYear() + years);
  return value.toISOString().slice(0, 10);
};
const csv = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const blankOperator = (euEstablished: boolean): GpsrEconomicOperator => ({
  name: '', tradeName: '', postalAddress: '', electronicAddress: '', contactPoint: '', euEstablished
});
const emptyInput = (): GpsrTechnicalFileInput => {
  const date = localDate();
  return {
    fileReference: '', assessmentDate: date, firstPlacedOnMarketDate: date, consumerProduct: true,
    placedOnEuMarket: true, marketCodes: ['DE'], harmonisationCoverage: 'none', applicableSectorRules: [],
    product: { brand: '', name: '', model: '', type: 'shirt', batchNumber: '', serialNumber: '', otherIdentifier: '',
      description: '', essentialCharacteristics: '', composition: '', packagingDescription: '',
      productImageEvidenceId: '', packagingImageEvidenceId: '' },
    intendedUse: '', foreseeableMisuse: '', vulnerableGroups: ['children'],
    operators: { manufacturer: blankOperator(false), importer: blankOperator(true), responsiblePerson: blankOperator(true) },
    risks: [{ hazardId: 'H-1', hazardCategory: '', hazardDescription: '', affectedGroups: ['children'],
      foreseeableScenario: '', likelihood: 2, severity: 3, mitigation: '', residualLikelihood: 1,
      residualSeverity: 3, verificationEvidenceIds: [] }],
    standards: [{ reference: '', title: '', version: '', applicationExtent: 'full', appliedParts: '' }],
    warnings: [{ marketCode: 'DE', languageCode: 'de-DE', text: '', location: 'packaging', operatorApproved: false }],
    onlineOffer: { enabled: true, manufacturerDisplayed: false, responsiblePersonDisplayed: false,
      productImageDisplayed: false, identifiersDisplayed: false, warningsDisplayed: false, offerUrl: '' },
    seriesProductionProcedure: '', complaintChannel: '', postMarketPlan: '', retentionUntil: addYears(date, 10),
    evidenceDocumentIds: [], notes: ''
  };
};

export default function GpsrTechnicalFilePanel({ shipmentId }: { shipmentId: string }) {
  const [input, setInput] = useState<GpsrTechnicalFileInput>(emptyInput);
  const [markets, setMarkets] = useState('DE');
  const [files, setFiles] = useState<GpsrTechnicalFile[]>([]);
  const [events, setEvents] = useState<GpsrPostMarketEvent[]>([]);
  const [upload, setUpload] = useState<File | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [event, setEvent] = useState({ eventType: 'safety_incident' as GpsrPostMarketEvent['eventType'],
    eventReference: '', occurredAt: new Date().toISOString().slice(0, 16), summary: '', severity: 'unknown' as GpsrPostMarketEvent['severity'],
    externalReference: '', evidenceDocumentId: '' });
  const [busy, setBusy] = useState('');
  const latest = files[0] || null;

  const load = useCallback(async () => {
    const [nextFiles, nextEvents] = await Promise.all([
      fetchGpsrTechnicalFiles(shipmentId), fetchGpsrPostMarketEvents(shipmentId)
    ]);
    setFiles(nextFiles); setEvents(nextEvents);
  }, [shipmentId]);
  useEffect(() => { void load().catch(() => { setFiles([]); setEvents([]); }); }, [load]);
  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try { await action(); toast.success(success); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Thao tác R10 thất bại.'); }
    finally { setBusy(''); }
  };
  const patchOperator = (role: keyof GpsrTechnicalFileInput['operators'], patch: Partial<GpsrEconomicOperator>) =>
    setInput((current) => ({ ...current, operators: { ...current.operators, [role]: { ...current.operators[role], ...patch } } }));
  const patchRisk = (patch: Partial<GpsrTechnicalFileInput['risks'][number]>) =>
    setInput((current) => ({ ...current, risks: [{ ...current.risks[0], ...patch }] }));
  const patchWarning = (patch: Partial<GpsrTechnicalFileInput['warnings'][number]>) =>
    setInput((current) => ({ ...current, warnings: [{ ...current.warnings[0], ...patch }] }));

  const uploadAndLock = () => run('upload', async () => {
    const result = await uploadGpsrEvidence(shipmentId, upload!); await lockGpsrEvidence(result.id);
    setInput((current) => ({ ...current,
      product: { ...current.product, productImageEvidenceId: current.product.productImageEvidenceId || result.id,
        packagingImageEvidenceId: current.product.packagingImageEvidenceId || result.id },
      risks: current.risks.map((risk) => ({ ...risk, verificationEvidenceIds: [...new Set([...risk.verificationEvidenceIds, result.id])] })),
      evidenceDocumentIds: [...new Set([...current.evidenceDocumentIds, result.id])]
    }));
    setUpload(null);
  }, 'Đã tải và khóa bằng chứng GPSR.');
  const create = () => run('create', () => createGpsrTechnicalFile(shipmentId, {
    ...input, marketCodes: csv(markets).map((item) => item.toUpperCase())
  }), 'Đã tạo revision hồ sơ GPSR bất biến.');
  const review = (decision: GpsrTechnicalFileReview['decision']) => run('review', () =>
    reviewGpsrTechnicalFile(shipmentId, latest!.id, { reviewerRole: 'product_safety_reviewer', decision, notes: reviewNotes }),
  decision === 'approved_for_internal_release' ? 'Đã duyệt phát hành nội bộ.' : 'Đã ghi nhận quyết định GPSR.');
  const recordEvent = () => run('event', () => recordGpsrPostMarketEvent(shipmentId, latest!.id, {
    ...event, occurredAt: new Date(event.occurredAt).toISOString(),
    externalReference: event.externalReference || undefined, evidenceDocumentId: event.evidenceDocumentId || undefined,
    consumerPersonalDataIncluded: false
  }), 'Đã ghi sự kiện post-market bất biến.');

  return <Card>
    <CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
      <span>12. R10 — Hồ sơ kỹ thuật & an toàn sản phẩm GPSR</span><Badge variant="outline">Regulation (EU) 2023/988 · giới hạn</Badge>
    </CardTitle></CardHeader>
    <CardContent className="space-y-5">
      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertTriangle className="mr-2 inline h-4 w-4" />Trạng thái tự động chỉ là kiểm soát nội bộ, không chứng nhận sản phẩm an toàn.
        Sự cố nghiêm trọng/tử vong phải được người có trách nhiệm đánh giá và báo Safety Business Gateway khi luật yêu cầu; hệ thống chỉ ghi “đã báo” khi có reference và bằng chứng ngoài hệ thống.
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div><Label>Mã hồ sơ ổn định</Label><Input value={input.fileReference} onChange={(e) => setInput((v) => ({ ...v, fileReference: e.target.value }))} /></div>
        <div><Label>Ngày đánh giá</Label><Input type="date" value={input.assessmentDate} onChange={(e) => setInput((v) => ({ ...v, assessmentDate: e.target.value }))} /></div>
        <div><Label>Ngày đưa ra thị trường EU lần đầu</Label><Input type="date" value={input.firstPlacedOnMarketDate} onChange={(e) => setInput((v) => ({ ...v, firstPlacedOnMarketDate: e.target.value, retentionUntil: addYears(e.target.value, 10) }))} /></div>
        <div><Label>Lưu hồ sơ đến</Label><Input type="date" value={input.retentionUntil} onChange={(e) => setInput((v) => ({ ...v, retentionUntil: e.target.value }))} /></div>
        <div><Label>Thị trường EU</Label><Input value={markets} onChange={(e) => setMarkets(e.target.value)} /></div>
        <div><Label>Phạm vi luật hài hòa</Label><Select value={input.harmonisationCoverage} onValueChange={(value: GpsrTechnicalFileInput['harmonisationCoverage']) => setInput((v) => ({ ...v, harmonisationCoverage: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['none', 'partial', 'full', 'unknown'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
        {(['brand', 'name', 'model', 'type', 'batchNumber'] as const).map((key) => <div key={key}><Label>{key}</Label><Input value={input.product[key]} onChange={(e) => setInput((v) => ({ ...v, product: { ...v.product, [key]: e.target.value } }))} /></div>)}
      </div>
      <div className="grid gap-3 md:grid-cols-2"><Textarea placeholder="Mô tả sản phẩm" value={input.product.description} onChange={(e) => setInput((v) => ({ ...v, product: { ...v.product, description: e.target.value } }))} /><Textarea placeholder="Đặc tính thiết yếu và cấu tạo" value={input.product.essentialCharacteristics} onChange={(e) => setInput((v) => ({ ...v, product: { ...v.product, essentialCharacteristics: e.target.value } }))} /><Textarea placeholder="Mục đích sử dụng" value={input.intendedUse} onChange={(e) => setInput((v) => ({ ...v, intendedUse: e.target.value }))} /><Textarea placeholder="Sử dụng sai có thể dự đoán" value={input.foreseeableMisuse} onChange={(e) => setInput((v) => ({ ...v, foreseeableMisuse: e.target.value }))} /></div>

      <div className="space-y-3 rounded border p-3"><b className="text-sm">Manufacturer · Importer · EU responsible person</b>
        {(['manufacturer', 'importer', 'responsiblePerson'] as const).map((role) => <div key={role} className="grid gap-2 md:grid-cols-4"><Input placeholder={`${role} name`} value={input.operators[role].name} onChange={(e) => patchOperator(role, { name: e.target.value })} /><Input placeholder="Postal address" value={input.operators[role].postalAddress} onChange={(e) => patchOperator(role, { postalAddress: e.target.value })} /><Input placeholder="Electronic address" value={input.operators[role].electronicAddress} onChange={(e) => patchOperator(role, { electronicAddress: e.target.value })} /><Select value={input.operators[role].euEstablished ? 'yes' : 'no'} onValueChange={(value) => patchOperator(role, { euEstablished: value === 'yes' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Established in EU</SelectItem><SelectItem value="no">Outside EU</SelectItem></SelectContent></Select></div>)}
      </div>

      <div className="space-y-3 rounded border p-3"><b className="text-sm">Risk analysis và verification</b>
        <div className="grid gap-2 md:grid-cols-3"><Input placeholder="Hazard ID" value={input.risks[0].hazardId} onChange={(e) => patchRisk({ hazardId: e.target.value })} /><Input placeholder="Hazard category" value={input.risks[0].hazardCategory} onChange={(e) => patchRisk({ hazardCategory: e.target.value })} /><Input placeholder="Affected groups" value={input.risks[0].affectedGroups.join(', ')} onChange={(e) => patchRisk({ affectedGroups: csv(e.target.value) })} /></div>
        <Textarea placeholder="Hazard description" value={input.risks[0].hazardDescription} onChange={(e) => patchRisk({ hazardDescription: e.target.value })} /><Textarea placeholder="Foreseeable scenario" value={input.risks[0].foreseeableScenario} onChange={(e) => patchRisk({ foreseeableScenario: e.target.value })} /><Textarea placeholder="Mitigation và tiêu chí kiểm chứng" value={input.risks[0].mitigation} onChange={(e) => patchRisk({ mitigation: e.target.value })} />
        <div className="grid gap-2 md:grid-cols-4">{(['likelihood', 'severity', 'residualLikelihood', 'residualSeverity'] as const).map((key) => <div key={key}><Label>{key} (1–5)</Label><Input type="number" min="1" max="5" value={input.risks[0][key]} onChange={(e) => patchRisk({ [key]: Number(e.target.value) })} /></div>)}</div>
      </div>

      <div className="grid gap-3 rounded border p-3 md:grid-cols-2">
        <Input placeholder="Standard/reference" value={input.standards[0].reference} onChange={(e) => setInput((v) => ({ ...v, standards: [{ ...v.standards[0], reference: e.target.value }] }))} /><Input placeholder="Standard version" value={input.standards[0].version} onChange={(e) => setInput((v) => ({ ...v, standards: [{ ...v.standards[0], version: e.target.value }] }))} />
        <Input placeholder="Warning language, ví dụ de-DE" value={input.warnings[0].languageCode} onChange={(e) => patchWarning({ languageCode: e.target.value })} /><Select value={input.warnings[0].operatorApproved ? 'yes' : 'no'} onValueChange={(value) => patchWarning({ operatorApproved: value === 'yes' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Bản dịch đã duyệt</SelectItem><SelectItem value="no">Chưa duyệt</SelectItem></SelectContent></Select>
        <Textarea className="md:col-span-2" placeholder="Nguyên văn warning/instruction theo thị trường" value={input.warnings[0].text} onChange={(e) => patchWarning({ text: e.target.value })} />
      </div>

      <div className="grid gap-3 rounded border p-3 md:grid-cols-2"><b className="md:col-span-2 text-sm">Thông tin bắt buộc khi bán online — Article 19</b>
        <Input className="md:col-span-2" placeholder="HTTPS offer URL" value={input.onlineOffer.offerUrl} onChange={(e) => setInput((v) => ({ ...v, onlineOffer: { ...v.onlineOffer, offerUrl: e.target.value } }))} />
        {(['manufacturerDisplayed', 'responsiblePersonDisplayed', 'productImageDisplayed', 'identifiersDisplayed', 'warningsDisplayed'] as const).map((key) => <Select key={key} value={input.onlineOffer[key] ? 'yes' : 'no'} onValueChange={(value) => setInput((v) => ({ ...v, onlineOffer: { ...v.onlineOffer, [key]: value === 'yes' } }))}><SelectTrigger aria-label={key}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">{key}: shown</SelectItem><SelectItem value="no">{key}: missing</SelectItem></SelectContent></Select>)}
      </div>

      <div className="space-y-2 rounded border p-3"><b className="text-sm">Lifecycle và bằng chứng</b><Textarea placeholder="Kiểm soát series production" value={input.seriesProductionProcedure} onChange={(e) => setInput((v) => ({ ...v, seriesProductionProcedure: e.target.value }))} /><Input placeholder="Kênh complaint" value={input.complaintChannel} onChange={(e) => setInput((v) => ({ ...v, complaintChannel: e.target.value }))} /><Textarea placeholder="Post-market monitoring, corrective action và recall plan" value={input.postMarketPlan} onChange={(e) => setInput((v) => ({ ...v, postMarketPlan: e.target.value }))} />
        <div className="flex flex-wrap gap-2"><Input type="file" className="max-w-md" onChange={(e) => setUpload(e.target.files?.[0] || null)} /><Button size="sm" variant="outline" disabled={!upload || Boolean(busy)} onClick={() => void uploadAndLock()}><FileUp className="mr-1 h-3 w-3" />Tải và khóa</Button></div>
        <Input placeholder="Evidence UUIDs" value={input.evidenceDocumentIds.join(', ')} onChange={(e) => setInput((v) => ({ ...v, evidenceDocumentIds: csv(e.target.value) }))} />
        <Button disabled={Boolean(busy) || !input.fileReference} onClick={() => void create()}><LockKeyhole className="mr-2 h-4 w-4" />Tạo GPSR revision</Button>
      </div>

      {latest && <div className="space-y-3 rounded border p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><b>{latest.fileReference} · rev {latest.revision}</b><Badge>{latest.safetyFileStatus}</Badge><Badge variant="outline">{latest.automatedStatus}</Badge><span className="text-xs text-slate-500">SHA {latest.resultSha256.slice(0, 12)}…</span><Button size="sm" variant="ghost" onClick={() => void load()}><RefreshCw className="h-3 w-3" /></Button></div>
        {latest.result.findings.map((finding) => <div key={`${finding.code}:${finding.path || ''}`} className="rounded border p-2"><b>{finding.code}</b> <Badge variant="outline">{finding.severity}</Badge><p className="text-xs">{finding.message}</p></div>)}
        <a className="text-xs text-blue-700 underline" href={latest.result.sources[0]?.url} target="_blank" rel="noreferrer">Nguồn EUR-Lex · {latest.rulesetVersion}</a>
        <div className="space-y-2 rounded bg-slate-50 p-3"><b>Product safety review append-only</b><Textarea placeholder="Căn cứ và giới hạn quyết định" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} /><div className="flex flex-wrap gap-2"><Button size="sm" disabled={!reviewNotes || latest.automatedStatus !== 'ready_for_safety_review' || Boolean(busy)} onClick={() => void review('approved_for_internal_release')}>Duyệt phát hành nội bộ</Button><Button size="sm" variant="outline" disabled={!reviewNotes || Boolean(busy)} onClick={() => void review('needs_information')}>Cần thông tin</Button><Button size="sm" variant="outline" disabled={!reviewNotes || Boolean(busy)} onClick={() => void review('rejected')}>Bác</Button></div></div>
        <div className="space-y-2 rounded border p-3"><b>Post-market event ledger — không chứa dữ liệu cá nhân người tiêu dùng</b><div className="grid gap-2 md:grid-cols-3"><Select value={event.eventType} onValueChange={(value: GpsrPostMarketEvent['eventType']) => setEvent((v) => ({ ...v, eventType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['complaint', 'safety_incident', 'corrective_action', 'recall', 'safety_business_gateway_notification', 'authority_request', 'consumer_notice'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Input placeholder="Event reference" value={event.eventReference} onChange={(e) => setEvent((v) => ({ ...v, eventReference: e.target.value }))} /><Input type="datetime-local" value={event.occurredAt} onChange={(e) => setEvent((v) => ({ ...v, occurredAt: e.target.value }))} /><Select value={event.severity} onValueChange={(value: GpsrPostMarketEvent['severity']) => setEvent((v) => ({ ...v, severity: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['information', 'minor', 'serious', 'death', 'unknown'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Input placeholder="External/Gateway reference" value={event.externalReference} onChange={(e) => setEvent((v) => ({ ...v, externalReference: e.target.value }))} /><Input placeholder="Locked filing evidence UUID" value={event.evidenceDocumentId} onChange={(e) => setEvent((v) => ({ ...v, evidenceDocumentId: e.target.value }))} /></div><Textarea placeholder="Tóm tắt không chứa dữ liệu cá nhân" value={event.summary} onChange={(e) => setEvent((v) => ({ ...v, summary: e.target.value }))} /><Button size="sm" disabled={!event.eventReference || !event.summary || Boolean(busy)} onClick={() => void recordEvent()}>Ghi sự kiện</Button>
          {events.slice(0, 5).map((item) => <p key={item.id} className="text-xs"><b>{item.eventReference}</b> · {item.eventType} · {item.severity}{item.safetyBusinessGatewayNotificationRequired ? ' · CẦN ĐÁNH GIÁ BÁO GATEWAY' : ''}</p>)}
        </div>
      </div>}
    </CardContent>
  </Card>;
}
