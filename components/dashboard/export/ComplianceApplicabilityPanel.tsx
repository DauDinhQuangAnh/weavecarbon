'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileUp, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  evaluateComplianceApplicability, fetchComplianceApplicabilityEvaluations,
  lockComplianceApplicabilityEvidence, reviewComplianceApplicability,
  uploadComplianceApplicabilityEvidence, type ComplianceApplicabilityEvaluation,
  type ComplianceApplicabilityInput
} from '@/lib/weave-v2/shipmentExportApi';

const today = () => {
  const value = new Date();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
};
const emptyInput = (): ComplianceApplicabilityInput => ({
  assessmentDate: today(), productCategory: '', intendedUse: '', consumerGroup: '', importerRole: '',
  salesChannels: [], consumerProduct: true, placedOnEuMarket: true,
  textileFibrePercent: null, materialFacts: [{
    reference: '', description: '', hsCode: '', originCountry: '', percentageByWeight: null,
    animalOrigin: null, substancesScreened: null
  }], packagingContext: {
    present: null, types: [], materials: [], reusable: null,
    supplierIdentified: null, customerIdentified: null,
    directDistanceSaleToEuEndUser: null, producerRoleAssessed: null
  }, notes: ''
});

const nullableBooleanValue = (value: boolean | null) => value === null ? 'unknown' : value ? 'yes' : 'no';
const nullableBoolean = (value: string) => value === 'unknown' ? null : value === 'yes';
const commaList = (value: string) => value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);

export default function ComplianceApplicabilityPanel({ shipmentId }: { shipmentId: string }) {
  const [input, setInput] = useState<ComplianceApplicabilityInput>(emptyInput);
  const [channels, setChannels] = useState('retail, online');
  const [evaluations, setEvaluations] = useState<ComplianceApplicabilityEvaluation[]>([]);
  const [reviewNotes, setReviewNotes] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState('');
  const latest = evaluations[0] || null;

  const load = useCallback(async () => {
    setEvaluations(await fetchComplianceApplicabilityEvaluations(shipmentId));
  }, [shipmentId]);

  useEffect(() => { void load().catch(() => setEvaluations([])); }, [load]);

  const missingCount = latest?.result.missingInputs.length || 0;
  const sourceById = useMemo(() => new Map(
    (latest?.result.sources || []).map((source) => [source.id, source])
  ), [latest]);
  const material = input.materialFacts[0];
  const updateMaterial = (patch: Partial<ComplianceApplicabilityInput['materialFacts'][number]>) =>
    setInput((current) => ({
      ...current, materialFacts: [{ ...current.materialFacts[0], ...patch }]
    }));

  const run = async (key: string, action: () => Promise<unknown>, message: string) => {
    setBusy(key);
    try { await action(); toast.success(message); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Thao tác R20 thất bại.'); }
    finally { setBusy(''); }
  };

  const evaluate = () => run('evaluate', () => evaluateComplianceApplicability(shipmentId, {
    ...input,
    salesChannels: channels.split(',').map((item) => item.trim()).filter(Boolean)
  }), 'Đã tạo snapshot applicability bất biến để chuyên viên rà soát.');

  const uploadAndLock = () => run('upload', async () => {
    const uploaded = await uploadComplianceApplicabilityEvidence(shipmentId, file!);
    await lockComplianceApplicabilityEvidence(uploaded.id);
    setEvidenceId(uploaded.id);
    setFile(null);
  }, 'Đã tải và khóa bằng chứng review R20.');

  const review = (
    decision: 'confirmed_for_internal_planning' | 'needs_information' | 'rejected'
  ) => run('review', () => reviewComplianceApplicability(shipmentId, latest!.id, {
    reviewerRole: 'compliance_specialist', decision, notes: reviewNotes,
    evidenceDocumentIds: evidenceId ? [evidenceId.trim()] : []
  }), decision === 'confirmed_for_internal_planning'
    ? 'Đã xác nhận cho lập kế hoạch nội bộ; đây không phải kết luận pháp lý.'
    : 'Đã ghi nhận quyết định review R20.');

  return <Card>
    <CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
      <span>9. R20 — Bộ sàng lọc applicability</span>
      <Badge variant="outline">Coverage giới hạn</Badge>
    </CardTitle></CardHeader>
    <CardContent className="space-y-5">
      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertTriangle className="mr-2 inline h-4 w-4" />Kết quả chỉ dùng để định tuyến hồ sơ và chuyên viên.
        Không phải tư vấn pháp lý, giấy phép, chứng nhận hay quyết định của cơ quan nhà nước.
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div><Label>Ngày đánh giá</Label><Input type="date" value={input.assessmentDate} onChange={(event) => setInput((current) => ({ ...current, assessmentDate: event.target.value }))} /></div>
        <div><Label>Nhóm sản phẩm</Label><Input placeholder="apparel / footwear" value={input.productCategory} onChange={(event) => setInput((current) => ({ ...current, productCategory: event.target.value }))} /></div>
        <div><Label>Mục đích sử dụng</Label><Input placeholder="everyday wear" value={input.intendedUse} onChange={(event) => setInput((current) => ({ ...current, intendedUse: event.target.value }))} /></div>
        <div><Label>Nhóm người dùng</Label><Input placeholder="adults / children" value={input.consumerGroup} onChange={(event) => setInput((current) => ({ ...current, consumerGroup: event.target.value }))} /></div>
        <div><Label>Vai trò importer</Label><Input placeholder="EU importer" value={input.importerRole} onChange={(event) => setInput((current) => ({ ...current, importerRole: event.target.value }))} /></div>
        <div><Label>Kênh bán, cách nhau bằng dấu phẩy</Label><Input value={channels} onChange={(event) => setChannels(event.target.value)} /></div>
        <div><Label>% khối lượng sợi dệt</Label><Input type="number" min="0" max="100" value={input.textileFibrePercent ?? ''} onChange={(event) => setInput((current) => ({ ...current, textileFibrePercent: event.target.value === '' ? null : Number(event.target.value) }))} /></div>
        <div><Label>Sản phẩm tiêu dùng</Label><Select value={input.consumerProduct ? 'yes' : 'no'} onValueChange={(value) => setInput((current) => ({ ...current, consumerProduct: value === 'yes' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Có</SelectItem><SelectItem value="no">Không / cần kiểm tra</SelectItem></SelectContent></Select></div>
        <div><Label>Đưa ra thị trường EU</Label><Select value={input.placedOnEuMarket ? 'yes' : 'no'} onValueChange={(value) => setInput((current) => ({ ...current, placedOnEuMarket: value === 'yes' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Có</SelectItem><SelectItem value="no">Không / cần kiểm tra</SelectItem></SelectContent></Select></div>
      </div>
      <div className="space-y-3 rounded border p-3">
        <div>
          <b className="text-sm">Dữ kiện bao bì PPWR</b>
          <p className="text-xs text-slate-600">Dùng để định tuyến phạm vi, truy xuất và review producer/EPR; không xác nhận đăng ký, phí hoặc báo cáo theo quốc gia.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div><Label>Có bao bì</Label><Select value={nullableBooleanValue(input.packagingContext.present)} onValueChange={(value) => setInput((current) => ({ ...current, packagingContext: { ...current.packagingContext, present: nullableBoolean(value) } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Chưa rõ</SelectItem><SelectItem value="yes">Có</SelectItem><SelectItem value="no">Không ghi nhận</SelectItem></SelectContent></Select></div>
          <div><Label>Loại (sales/grouped/transport/ecommerce)</Label><Input placeholder="sales, ecommerce" value={input.packagingContext.types.join(', ')} onChange={(event) => setInput((current) => ({ ...current, packagingContext: { ...current.packagingContext, types: commaList(event.target.value) } }))} /></div>
          <div><Label>Vật liệu bao bì</Label><Input placeholder="paper, plastic" value={input.packagingContext.materials.join(', ')} onChange={(event) => setInput((current) => ({ ...current, packagingContext: { ...current.packagingContext, materials: commaList(event.target.value) } }))} /></div>
          <div><Label>Bao bì tái sử dụng</Label><Select value={nullableBooleanValue(input.packagingContext.reusable)} onValueChange={(value) => setInput((current) => ({ ...current, packagingContext: { ...current.packagingContext, reusable: nullableBoolean(value) } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Chưa rõ</SelectItem><SelectItem value="yes">Có</SelectItem><SelectItem value="no">Không</SelectItem></SelectContent></Select></div>
          <div><Label>Đã định danh nhà cung cấp</Label><Select value={nullableBooleanValue(input.packagingContext.supplierIdentified)} onValueChange={(value) => setInput((current) => ({ ...current, packagingContext: { ...current.packagingContext, supplierIdentified: nullableBoolean(value) } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Chưa rõ</SelectItem><SelectItem value="yes">Có</SelectItem><SelectItem value="no">Chưa</SelectItem></SelectContent></Select></div>
          <div><Label>Đã định danh khách hàng</Label><Select value={nullableBooleanValue(input.packagingContext.customerIdentified)} onValueChange={(value) => setInput((current) => ({ ...current, packagingContext: { ...current.packagingContext, customerIdentified: nullableBoolean(value) } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Chưa rõ</SelectItem><SelectItem value="yes">Có</SelectItem><SelectItem value="no">Chưa</SelectItem></SelectContent></Select></div>
          <div><Label>Bán từ xa trực tiếp tới người dùng EU</Label><Select value={nullableBooleanValue(input.packagingContext.directDistanceSaleToEuEndUser)} onValueChange={(value) => setInput((current) => ({ ...current, packagingContext: { ...current.packagingContext, directDistanceSaleToEuEndUser: nullableBoolean(value) } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Chưa rõ</SelectItem><SelectItem value="yes">Có</SelectItem><SelectItem value="no">Không</SelectItem></SelectContent></Select></div>
          <div><Label>Đã đánh giá vai trò producer</Label><Select value={nullableBooleanValue(input.packagingContext.producerRoleAssessed)} onValueChange={(value) => setInput((current) => ({ ...current, packagingContext: { ...current.packagingContext, producerRoleAssessed: nullableBoolean(value) } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Chưa rõ</SelectItem><SelectItem value="yes">Đã đánh giá</SelectItem><SelectItem value="no">Chưa đánh giá</SelectItem></SelectContent></Select></div>
        </div>
      </div>
      <div className="space-y-2 rounded border p-3">
        <b className="text-sm">Dữ kiện vật liệu bổ sung</b>
        <p className="text-xs text-slate-600">BOM R07 được lấy tự động; hàng này dùng để ghi nhận thành phần cần sàng lọc thêm.</p>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Mã vật liệu" value={material.reference} onChange={(event) => updateMaterial({ reference: event.target.value })} />
          <Input placeholder="Mô tả vật liệu" value={material.description} onChange={(event) => updateMaterial({ description: event.target.value })} />
          <Input placeholder="HS vật liệu" value={material.hsCode} onChange={(event) => updateMaterial({ hsCode: event.target.value })} />
          <Input placeholder="Nước xuất xứ" maxLength={2} value={material.originCountry} onChange={(event) => updateMaterial({ originCountry: event.target.value.toUpperCase() })} />
          <Input type="number" min="0" max="100" placeholder="% khối lượng" value={material.percentageByWeight ?? ''} onChange={(event) => updateMaterial({ percentageByWeight: event.target.value === '' ? null : Number(event.target.value) })} />
          <Select value={material.animalOrigin === null ? 'unknown' : material.animalOrigin ? 'yes' : 'no'} onValueChange={(value) => updateMaterial({ animalOrigin: value === 'unknown' ? null : value === 'yes' })}><SelectTrigger><SelectValue placeholder="Nguồn gốc động vật" /></SelectTrigger><SelectContent><SelectItem value="unknown">Nguồn động vật: chưa rõ</SelectItem><SelectItem value="yes">Có nguồn động vật</SelectItem><SelectItem value="no">Không ghi nhận</SelectItem></SelectContent></Select>
          <Select value={material.substancesScreened === null ? 'unknown' : material.substancesScreened ? 'yes' : 'no'} onValueChange={(value) => updateMaterial({ substancesScreened: value === 'unknown' ? null : value === 'yes' })}><SelectTrigger><SelectValue placeholder="Sàng lọc hóa chất" /></SelectTrigger><SelectContent><SelectItem value="unknown">Hóa chất: chưa rõ</SelectItem><SelectItem value="yes">Đã sàng lọc</SelectItem><SelectItem value="no">Chưa sàng lọc</SelectItem></SelectContent></Select>
        </div>
      </div>
      <Textarea placeholder="Giới hạn, giả định và ghi chú của operator" value={input.notes} onChange={(event) => setInput((current) => ({ ...current, notes: event.target.value }))} />
      <Button disabled={Boolean(busy) || !input.assessmentDate} onClick={() => void evaluate()}><ShieldCheck className="mr-2 h-4 w-4" />Chạy sàng lọc R20</Button>

      {latest && <div className="space-y-3 rounded border p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <b>{latest.status}</b><Badge variant="outline">{latest.rulesetVersion}</Badge>
          <span className="text-xs text-slate-500">{missingCount} dữ kiện còn thiếu · SHA {latest.resultSha256.slice(0, 12)}…</span>
          <Button size="sm" variant="ghost" onClick={() => void load()}><RefreshCw className="h-3 w-3" /></Button>
        </div>
        {(latest.result.datasets || []).map((dataset) => <p key={dataset.id} className="text-xs text-slate-600">
          Dataset: {dataset.id} · {dataset.version} · {dataset.coverageStatus} · SHA {dataset.sha256.slice(0, 12)}…
        </p>)}
        {latest.result.matches.map((match) => {
          const source = match.sourceId ? sourceById.get(match.sourceId) : null;
          return <div key={match.code} className="rounded border p-2">
            <div className="flex flex-wrap gap-2"><b>{match.code}</b><Badge variant="outline">{match.decision}</Badge><span className="text-xs">{match.matchPrecision}</span></div>
            <p className="mt-1 text-xs text-slate-700">{match.reason}</p>
            {match.requiredEvidenceTypes.length > 0 && <p className="mt-1 text-xs">Bằng chứng cần: {match.requiredEvidenceTypes.join(', ')}</p>}
            {source && <a className="mt-1 block text-xs text-blue-700 underline" href={source.url} target="_blank" rel="noreferrer">{source.title} · {source.version}</a>}
          </div>;
        })}

        <div className="space-y-2 rounded border bg-slate-50 p-3">
          <b className="text-sm">Review chuyên viên</b>
          <p className="text-xs text-slate-600">Xác nhận chỉ có nghĩa dùng được cho lập kế hoạch nội bộ và bắt buộc gắn bằng chứng đã khóa.</p>
          <div className="flex flex-wrap gap-2"><Input type="file" className="max-w-md" onChange={(event) => setFile(event.target.files?.[0] || null)} /><Button size="sm" variant="outline" disabled={!file || Boolean(busy)} onClick={() => void uploadAndLock()}><FileUp className="mr-1 h-3 w-3" />Tải và khóa</Button></div>
          <Input placeholder="Evidence UUID đã khóa" value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} />
          <Textarea placeholder="Ghi chú chuyên viên và phiên bản nguồn đã kiểm tra" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!reviewNotes || !evidenceId || Boolean(busy)} onClick={() => void review('confirmed_for_internal_planning')}><LockKeyhole className="mr-1 h-3 w-3" />Xác nhận nội bộ</Button>
            <Button size="sm" variant="outline" disabled={!reviewNotes || Boolean(busy)} onClick={() => void review('needs_information')}>Cần thêm thông tin</Button>
            <Button size="sm" variant="outline" disabled={!reviewNotes || Boolean(busy)} onClick={() => void review('rejected')}>Bác kết quả</Button>
          </div>
          {latest.latestReview && <p className="text-xs">Mới nhất: {latest.latestReview.decision} · {latest.latestReview.reviewerName || 'chuyên viên'} · {new Date(latest.latestReview.createdAt).toLocaleString('vi-VN')}</p>}
        </div>
      </div>}
    </CardContent>
  </Card>;
}
