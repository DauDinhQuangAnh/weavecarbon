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
  createPcfStudy, fetchPcfCalculationSnapshots, fetchPcfStudies, lockPcfStudyEvidence,
  reviewPcfStudy, uploadPcfStudyEvidence, type PcfCalculationSnapshot, type PcfStudy,
  type PcfStudyInput, type PcfStudyReview
} from '@/lib/weave-v2/shipmentExportApi';

const today = () => new Date().toISOString().slice(0, 10);
const csv = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const emptyInput = (): PcfStudyInput => ({
  studyReference: '', studyDate: today(), calculationSnapshotId: '', productReference: '', productName: '',
  reportingPeriodStart: `${new Date().getUTCFullYear()}-01-01`, reportingPeriodEnd: today(),
  intendedApplication: 'Internal buyer data review', intendedAudience: 'Buyer sustainability team', comparativeAssertion: false,
  functionalUnit: { quantity: 1, unit: 'piece', description: 'One finished product delivered to the destination market' },
  referenceFlow: { amount: 0, unit: 'kg finished product', basis: 'Measured finished-product mass' },
  boundaryType: 'cradle_to_gate_plus_gate_to_market_extension',
  includedStages: ['materials', 'finished_goods_manufacturing', 'packaging', 'logistics_and_storage'],
  processMap: [{ processReference: 'process-1', processName: '', stage: 'materials', included: true, dataSource: '', evidenceDocumentIds: [] }],
  excludedProcesses: [{ processName: 'Use and end-of-life', rationale: 'Outside the declared partial CFP boundary.', estimatedImpactPercent: 0 }],
  cutoff: { massPercent: 1, energyPercent: 1, environmentalSignificanceApplied: false, rationale: '' },
  pcr: { status: 'not_identified', name: '', publisher: '', version: '', validFrom: null, validTo: null, rationale: '' },
  allocation: { required: false, method: '', rationale: 'No multifunctional process modeled.', hierarchyJustification: '', sensitivityPerformed: false, sensitivitySummary: '' },
  recyclingModel: { method: 'cut-off', rationale: 'Recycled-input burdens follow the selected factor dataset; end-of-life is excluded.' },
  dataQualityAssessment: '', dataImprovementPlan: '', uncertaintyAssessment: {
    method: 'rss_fallback', parameter: '', scenario: '', model: '', sensitivityScenarios: []
  }, landUseChangeMethod: 'Not modeled; disclosed separately as unavailable.',
  biogenicCarbonTreatment: 'Reported separately and never netted against fossil GWP.', evidenceDocumentIds: [],
  externalAssuranceRecordId: null, limitations: 'Climate-only partial CFP; use and end-of-life are excluded; not independently verified.', notes: ''
});

export default function PcfStudyPanel({ shipmentId }: { shipmentId: string }) {
  const [input, setInput] = useState<PcfStudyInput>(emptyInput);
  const [snapshots, setSnapshots] = useState<PcfCalculationSnapshot[]>([]);
  const [studies, setStudies] = useState<PcfStudy[]>([]);
  const [upload, setUpload] = useState<File | null>(null);
  const [sensitivity, setSensitivity] = useState('Replace proxy factors, vary transport distance');
  const [reviewNotes, setReviewNotes] = useState('');
  const [busy, setBusy] = useState('');
  const latest = studies[0] || null; const process = input.processMap[0]; const excluded = input.excludedProcesses[0];

  const load = useCallback(async () => {
    const [nextSnapshots, nextStudies] = await Promise.all([
      fetchPcfCalculationSnapshots(shipmentId), fetchPcfStudies(shipmentId)
    ]);
    setSnapshots(nextSnapshots); setStudies(nextStudies);
  }, [shipmentId]);
  useEffect(() => { void load().catch(() => { setSnapshots([]); setStudies([]); }); }, [load]);
  const run = async (key: string, action: () => Promise<unknown>, message: string) => {
    setBusy(key); try { await action(); toast.success(message); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Thao tác R12 thất bại.'); } finally { setBusy(''); }
  };
  const selectSnapshot = (id: string) => {
    const selected = snapshots.find((item) => item.id === id);
    setInput((value) => ({ ...value, calculationSnapshotId: id,
      productReference: selected?.productReference || value.productReference,
      productName: selected?.productName || value.productName,
      includedStages: selected?.boundary?.includedStages || value.includedStages }));
  };
  const patchProcess = (patch: Partial<typeof process>) => setInput((value) => ({ ...value,
    processMap: [{ ...value.processMap[0], ...patch }] }));
  const patchExcluded = (patch: Partial<typeof excluded>) => setInput((value) => ({ ...value,
    excludedProcesses: [{ ...value.excludedProcesses[0], ...patch }] }));
  const uploadAndLock = () => run('upload', async () => {
    const saved = await uploadPcfStudyEvidence(shipmentId, upload!); await lockPcfStudyEvidence(saved.id);
    setInput((value) => ({ ...value, evidenceDocumentIds: [...new Set([...value.evidenceDocumentIds, saved.id])],
      processMap: [{ ...value.processMap[0], evidenceDocumentIds: [...new Set([...value.processMap[0].evidenceDocumentIds, saved.id])] }] }));
    setUpload(null);
  }, 'Đã tải và khóa bằng chứng PCF.');
  const create = () => run('create', () => createPcfStudy(shipmentId, { ...input,
    uncertaintyAssessment: { ...input.uncertaintyAssessment, sensitivityScenarios: csv(sensitivity) } }),
  'Đã tạo PCF study revision bất biến.');
  const review = (decision: PcfStudyReview['decision']) => run('review', () => reviewPcfStudy(shipmentId, latest!.id,
    { reviewerRole: 'pcf_practitioner_reviewer', decision, notes: reviewNotes }),
  decision === 'approved_for_internal_report' ? 'Đã duyệt báo cáo nội bộ.' : 'Đã ghi practitioner review.');

  return <Card><CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
    <span>14. R12 — Product Carbon Footprint study</span><Badge variant="outline">ISO 14067:2018 · confirmed 2024</Badge>
  </CardTitle></CardHeader><CardContent className="space-y-5">
    <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mr-2 inline h-4 w-4" />
      Hồ sơ này hỗ trợ partial CFP nội bộ. Đây không phải ISO certification, EPD, PEF, comparative claim hay assurance độc lập.
      ISO 14067 đang được sửa đổi; mọi công bố bên ngoài phải đi qua R18 và assurance record thật.</div>
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <div><Label>Calculation snapshot bất biến</Label><Select value={input.calculationSnapshotId} onValueChange={selectSnapshot}><SelectTrigger><SelectValue placeholder="Chọn snapshot của shipment" /></SelectTrigger><SelectContent>{snapshots.map((item) => <SelectItem key={item.id} value={item.id}>{item.productReference} · v{item.version} · {item.reportedTotalKgCO2e ?? 'n/a'} kg CO₂e</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Mã study</Label><Input value={input.studyReference} onChange={(e) => setInput((v) => ({ ...v, studyReference: e.target.value }))} /></div>
      <div><Label>Ngày study</Label><Input type="date" value={input.studyDate} onChange={(e) => setInput((v) => ({ ...v, studyDate: e.target.value }))} /></div>
      <div><Label>Product/SKU</Label><Input value={input.productReference} onChange={(e) => setInput((v) => ({ ...v, productReference: e.target.value }))} /></div>
      <div><Label>Từ ngày</Label><Input type="date" value={input.reportingPeriodStart} onChange={(e) => setInput((v) => ({ ...v, reportingPeriodStart: e.target.value }))} /></div>
      <div><Label>Đến ngày</Label><Input type="date" value={input.reportingPeriodEnd} onChange={(e) => setInput((v) => ({ ...v, reportingPeriodEnd: e.target.value }))} /></div>
      <div><Label>Functional unit quantity</Label><Input type="number" min="0" step="0.001" value={input.functionalUnit.quantity} onChange={(e) => setInput((v) => ({ ...v, functionalUnit: { ...v.functionalUnit, quantity: Number(e.target.value) } }))} /></div>
      <div><Label>Functional unit</Label><Input value={input.functionalUnit.unit} onChange={(e) => setInput((v) => ({ ...v, functionalUnit: { ...v.functionalUnit, unit: e.target.value } }))} /></div>
      <div><Label>Reference flow amount</Label><Input type="number" min="0" step="0.001" value={input.referenceFlow.amount} onChange={(e) => setInput((v) => ({ ...v, referenceFlow: { ...v.referenceFlow, amount: Number(e.target.value) } }))} /></div>
      <div><Label>Reference flow unit</Label><Input value={input.referenceFlow.unit} onChange={(e) => setInput((v) => ({ ...v, referenceFlow: { ...v.referenceFlow, unit: e.target.value } }))} /></div>
      <div><Label>Public comparison?</Label><Select value={input.comparativeAssertion ? 'yes' : 'no'} onValueChange={(value) => setInput((v) => ({ ...v, comparativeAssertion: value === 'yes' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="no">Không</SelectItem><SelectItem value="yes">Có — cần critical review</SelectItem></SelectContent></Select></div>
    </div>
    <div className="grid gap-3 md:grid-cols-3"><div><Label>Mô tả functional unit</Label><Textarea value={input.functionalUnit.description} onChange={(e) => setInput((v) => ({ ...v, functionalUnit: { ...v.functionalUnit, description: e.target.value } }))} /></div><div><Label>Cơ sở reference flow</Label><Textarea value={input.referenceFlow.basis} onChange={(e) => setInput((v) => ({ ...v, referenceFlow: { ...v.referenceFlow, basis: e.target.value } }))} /></div><div><Label>Giới hạn công bố</Label><Textarea value={input.limitations} onChange={(e) => setInput((v) => ({ ...v, limitations: e.target.value }))} /></div></div>
    <div className="grid gap-3 md:grid-cols-2"><div><Label>Mục đích sử dụng</Label><Textarea value={input.intendedApplication} onChange={(e) => setInput((v) => ({ ...v, intendedApplication: e.target.value }))} /></div><div><Label>Đối tượng sử dụng</Label><Textarea value={input.intendedAudience} onChange={(e) => setInput((v) => ({ ...v, intendedAudience: e.target.value }))} /></div></div>
    <div className="space-y-3 rounded border p-3"><b className="text-sm">Boundary, process map và cutoff</b><div className="grid gap-2 md:grid-cols-3">
      <Input placeholder="Process reference" value={process.processReference} onChange={(e) => patchProcess({ processReference: e.target.value })} />
      <Input placeholder="Process name" value={process.processName} onChange={(e) => patchProcess({ processName: e.target.value })} />
      <Input placeholder="Stage" value={process.stage} onChange={(e) => patchProcess({ stage: e.target.value })} />
      <Input className="md:col-span-2" placeholder="Data source" value={process.dataSource} onChange={(e) => patchProcess({ dataSource: e.target.value })} />
      <Input placeholder="Included stages (comma)" value={input.includedStages.join(', ')} onChange={(e) => setInput((v) => ({ ...v, includedStages: csv(e.target.value) }))} />
      <Input placeholder="Excluded process" value={excluded.processName} onChange={(e) => patchExcluded({ processName: e.target.value })} />
      <Input placeholder="Estimated impact %" type="number" min="0" max="100" value={excluded.estimatedImpactPercent} onChange={(e) => patchExcluded({ estimatedImpactPercent: Number(e.target.value) })} />
      <Textarea placeholder="Exclusion rationale" value={excluded.rationale} onChange={(e) => patchExcluded({ rationale: e.target.value })} />
    </div><Textarea placeholder="Cutoff rationale" value={input.cutoff.rationale} onChange={(e) => setInput((v) => ({ ...v, cutoff: { ...v.cutoff, rationale: e.target.value } }))} />
      <Select value={input.cutoff.environmentalSignificanceApplied ? 'yes' : 'no'} onValueChange={(value) => setInput((v) => ({ ...v, cutoff: { ...v.cutoff, environmentalSignificanceApplied: value === 'yes' } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Đã sàng lọc environmental significance</SelectItem><SelectItem value="no">Chưa sàng lọc</SelectItem></SelectContent></Select></div>
    <div className="space-y-3 rounded border p-3"><b className="text-sm">PCR, allocation và recycling</b><div className="grid gap-2 md:grid-cols-3"><Select value={input.pcr.status} onValueChange={(status: PcfStudyInput['pcr']['status']) => setInput((v) => ({ ...v, pcr: { ...v.pcr, status } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="applicable">Applicable PCR</SelectItem><SelectItem value="not_identified">No PCR identified</SelectItem><SelectItem value="not_applicable">PCR not applicable</SelectItem></SelectContent></Select><Input placeholder="PCR name" value={input.pcr.name} onChange={(e) => setInput((v) => ({ ...v, pcr: { ...v.pcr, name: e.target.value } }))} /><Input placeholder="PCR publisher" value={input.pcr.publisher} onChange={(e) => setInput((v) => ({ ...v, pcr: { ...v.pcr, publisher: e.target.value } }))} /><Input placeholder="PCR version" value={input.pcr.version} onChange={(e) => setInput((v) => ({ ...v, pcr: { ...v.pcr, version: e.target.value } }))} /><Input aria-label="PCR valid from" type="date" value={input.pcr.validFrom || ''} onChange={(e) => setInput((v) => ({ ...v, pcr: { ...v.pcr, validFrom: e.target.value || null } }))} /><Input aria-label="PCR valid to" type="date" value={input.pcr.validTo || ''} onChange={(e) => setInput((v) => ({ ...v, pcr: { ...v.pcr, validTo: e.target.value || null } }))} /></div><Textarea placeholder="PCR decision rationale" value={input.pcr.rationale} onChange={(e) => setInput((v) => ({ ...v, pcr: { ...v.pcr, rationale: e.target.value } }))} /><div className="grid gap-2 md:grid-cols-3"><Select value={input.allocation.required ? 'yes' : 'no'} onValueChange={(value) => setInput((v) => ({ ...v, allocation: { ...v.allocation, required: value === 'yes' } }))}><SelectTrigger aria-label="Allocation required"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="no">Allocation not required</SelectItem><SelectItem value="yes">Allocation required</SelectItem></SelectContent></Select><Select value={input.allocation.method || 'none'} onValueChange={(value) => setInput((v) => ({ ...v, allocation: { ...v.allocation, method: value === 'none' ? '' : value as PcfStudyInput['allocation']['method'] } }))}><SelectTrigger aria-label="Allocation method"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No allocation method</SelectItem><SelectItem value="physical">Physical</SelectItem><SelectItem value="economic">Economic</SelectItem><SelectItem value="mass">Mass</SelectItem><SelectItem value="energy">Energy</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select><Select value={input.allocation.sensitivityPerformed ? 'yes' : 'no'} onValueChange={(value) => setInput((v) => ({ ...v, allocation: { ...v.allocation, sensitivityPerformed: value === 'yes' } }))}><SelectTrigger aria-label="Allocation sensitivity"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="no">Allocation sensitivity not performed</SelectItem><SelectItem value="yes">Allocation sensitivity performed</SelectItem></SelectContent></Select></div><div className="grid gap-2 md:grid-cols-2"><Textarea placeholder="Allocation rationale" value={input.allocation.rationale} onChange={(e) => setInput((v) => ({ ...v, allocation: { ...v.allocation, rationale: e.target.value } }))} /><Textarea placeholder="Allocation hierarchy justification" value={input.allocation.hierarchyJustification} onChange={(e) => setInput((v) => ({ ...v, allocation: { ...v.allocation, hierarchyJustification: e.target.value } }))} /></div><Textarea placeholder="Allocation sensitivity summary" value={input.allocation.sensitivitySummary} onChange={(e) => setInput((v) => ({ ...v, allocation: { ...v.allocation, sensitivitySummary: e.target.value } }))} /><Textarea placeholder="Recycling model rationale" value={input.recyclingModel.rationale} onChange={(e) => setInput((v) => ({ ...v, recyclingModel: { ...v.recyclingModel, rationale: e.target.value } }))} /></div>
    <div className="space-y-3 rounded border p-3"><b className="text-sm">Data quality, uncertainty và sensitivity</b><Textarea placeholder="Đánh giá technological/geographical/temporal/completeness/reliability" value={input.dataQualityAssessment} onChange={(e) => setInput((v) => ({ ...v, dataQualityAssessment: e.target.value }))} /><Textarea placeholder="Kế hoạch thay thế proxy và cải thiện dữ liệu" value={input.dataImprovementPlan} onChange={(e) => setInput((v) => ({ ...v, dataImprovementPlan: e.target.value }))} /><div className="grid gap-2 md:grid-cols-3"><Input placeholder="Parameter uncertainty" value={input.uncertaintyAssessment.parameter} onChange={(e) => setInput((v) => ({ ...v, uncertaintyAssessment: { ...v.uncertaintyAssessment, parameter: e.target.value } }))} /><Input placeholder="Scenario uncertainty" value={input.uncertaintyAssessment.scenario} onChange={(e) => setInput((v) => ({ ...v, uncertaintyAssessment: { ...v.uncertaintyAssessment, scenario: e.target.value } }))} /><Input placeholder="Model uncertainty" value={input.uncertaintyAssessment.model} onChange={(e) => setInput((v) => ({ ...v, uncertaintyAssessment: { ...v.uncertaintyAssessment, model: e.target.value } }))} /></div><Input placeholder="Sensitivity scenarios (comma)" value={sensitivity} onChange={(e) => setSensitivity(e.target.value)} /></div>
    <div className="space-y-2 rounded border p-3"><b className="text-sm">Nguồn dữ liệu và evidence</b><div className="flex flex-wrap gap-2"><Input type="file" className="max-w-md" onChange={(e) => setUpload(e.target.files?.[0] || null)} /><Button size="sm" variant="outline" disabled={!upload || Boolean(busy)} onClick={() => void uploadAndLock()}><FileUp className="mr-1 h-3 w-3" />Tải và khóa</Button></div><Input placeholder="Evidence UUIDs" value={input.evidenceDocumentIds.join(', ')} onChange={(e) => setInput((v) => ({ ...v, evidenceDocumentIds: csv(e.target.value) }))} /><Input placeholder="External assurance record UUID (chỉ khi có thật)" value={input.externalAssuranceRecordId || ''} onChange={(e) => setInput((v) => ({ ...v, externalAssuranceRecordId: e.target.value || null }))} /><Button disabled={!input.studyReference || !input.calculationSnapshotId || Boolean(busy)} onClick={() => void create()}><LockKeyhole className="mr-2 h-4 w-4" />Tạo PCF study revision</Button></div>
    {latest && <div className="space-y-3 rounded border p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><b>{latest.studyReference} · rev {latest.revision}</b><Badge>{latest.studyStatus}</Badge><Badge variant="outline">{latest.automatedStatus}</Badge><span className="text-xs text-slate-500">{latest.result.calculation.reportedTotalKgCO2e} kg CO₂e · SHA {latest.resultSha256.slice(0, 12)}…</span><Button size="sm" variant="ghost" onClick={() => void load()}><RefreshCw className="h-3 w-3" /></Button></div>
      <p className="rounded bg-slate-50 p-2">AD × EF terms: {latest.result.calculation.contributionTermCount} · factors: {latest.result.calculation.factorCount} · reproduced: {latest.result.calculation.reproducedTotalKgCO2e} kg CO₂e · {latest.result.claimStatus}</p>
      {latest.result.findings.map((item) => <p key={`${item.code}:${item.path}`} className="rounded border p-2"><b>{item.code}</b> · {item.message}</p>)}
      <a className="text-xs text-blue-700 underline" href={latest.result.sources[0]?.url} target="_blank" rel="noreferrer">ISO 14067 status · {latest.rulesetVersion}</a>
      <div className="space-y-2 rounded bg-slate-50 p-3"><b>PCF practitioner review append-only</b><Textarea placeholder="Căn cứ, giới hạn, DQ, uncertainty và kết luận nội bộ" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} /><div className="flex gap-2"><Button size="sm" disabled={!reviewNotes || latest.automatedStatus !== 'practitioner_review_required' || Boolean(busy)} onClick={() => void review('approved_for_internal_report')}>Duyệt báo cáo nội bộ</Button><Button size="sm" variant="outline" disabled={!reviewNotes || Boolean(busy)} onClick={() => void review('needs_information')}>Cần thông tin</Button><Button size="sm" variant="outline" disabled={!reviewNotes || Boolean(busy)} onClick={() => void review('rejected')}>Bác</Button></div></div>
    </div>}
  </CardContent></Card>;
}
