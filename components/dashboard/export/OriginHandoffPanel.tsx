'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, FileUp, LockKeyhole, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  emptyOriginProfile, fetchOriginReconciliation, lockOriginEvidence, saveOriginProfile,
  uploadOriginEvidence, type OriginLineAssessment, type OriginMaterial, type OriginProfile,
  type OriginReconciliation, type OriginRuleCode, type ShipmentExportBundle
} from '@/lib/weave-v2/shipmentExportApi';

const ruleForHs = (hs: string): OriginRuleCode => {
  const code = hs.replace(/\D/g, '');
  if (code.startsWith('61')) return 'CH61_CUT_SEWN_KNITTING_AND_MAKING_UP';
  if (code.startsWith('62')) return ['6202', '6204', '6206', '6209', '6210', '6211', '6213', '6214', '6216', '6217']
    .some((prefix) => code.startsWith(prefix)) ? 'SPECIALIST_RULE_REVIEW' : 'CH62_GENERAL_WEAVING_AND_MAKING_UP';
  if (code.startsWith('64')) return 'CH64_GENERAL_EXCLUDES_6406_UPPER_ASSEMBLY';
  return 'SPECIALIST_RULE_REVIEW';
};

const blankMaterial = (): OriginMaterial => ({
  id: `material-${Date.now()}`, reference: '', description: '', hsCode: '', supplierName: '',
  originCountry: '', originStatus: 'unknown', cumulationBasis: 'none', value: null,
  weightKg: null, evidenceDocumentId: '', isUpperAssemblyAffixedToSole: null, notes: ''
});

const blankAssessment = (line: ShipmentExportBundle['lines'][number]): OriginLineAssessment => ({
  exportLineId: line.id, ruleCode: ruleForHs(line.hsCode), ruleSourcePage: '', specialistRuleText: '',
  productionProcesses: [], exWorksPrice: null, nonOriginatingMaterialValue: null,
  materials: [blankMaterial()], notes: ''
});

export default function OriginHandoffPanel({ shipmentId, bundle, onChanged }: {
  shipmentId: string; bundle: ShipmentExportBundle; onChanged: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<OriginProfile>(() => {
    const base = bundle.originProfile || emptyOriginProfile();
    return {
      ...base,
      lineAssessments: bundle.lines.map((line) => base.lineAssessments.find(
        (item) => item.exportLineId === line.id
      ) || blankAssessment(line))
    };
  });
  const [reconciliation, setReconciliation] = useState<OriginReconciliation | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState('');
  const evidence = useMemo(() => bundle.carrierDocuments.filter(
    (item) => item.type === 'origin_support'
  ), [bundle.carrierDocuments]);
  const applicable = bundle.profile?.preferentialOriginClaim === true;

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try { await action(); toast.success(success); await onChanged(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Thao tác R07 thất bại.'); }
    finally { setBusy(''); }
  };
  const updateAssessment = (index: number, patch: Partial<OriginLineAssessment>) => setProfile((current) => ({
    ...current, lineAssessments: current.lineAssessments.map((item, i) => i === index ? { ...item, ...patch } : item)
  }));
  const updateMaterial = (lineIndex: number, materialIndex: number, patch: Partial<OriginMaterial>) => {
    const assessment = profile.lineAssessments[lineIndex];
    updateAssessment(lineIndex, {
      materials: assessment.materials.map((item, i) => i === materialIndex ? { ...item, ...patch } : item)
    });
  };

  const reconcile = async () => {
    setBusy('reconcile');
    try { setReconciliation(await fetchOriginReconciliation(shipmentId)); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Không đối soát được R07.'); }
    finally { setBusy(''); }
  };

  return <Card>
    <CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
      <span>8. R07 — Hồ sơ hỗ trợ xuất xứ EVFTA</span>
      <Badge variant="outline">{applicable ? 'Có yêu cầu ưu đãi' : 'Không áp dụng'}</Badge>
    </CardTitle></CardHeader>
    <CardContent className="space-y-5">
      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertTriangle className="mr-2 inline h-4 w-4" />Đây là BOM và dữ liệu tính toán để bàn giao cho chuyên viên xuất xứ.
        Không phải EUR.1, không phải tuyên bố xuất xứ và không xác nhận được hưởng thuế ưu đãi.
      </div>
      {!applicable && <p className="text-sm text-slate-600">Chỉ bật R07 sau khi trường “Yêu cầu ưu đãi xuất xứ EVFTA” trong hồ sơ chung được xác nhận.</p>}
      {applicable && <>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div><Label>Luồng chứng từ dự kiến</Label><Select value={profile.claimType} onValueChange={(value: OriginProfile['claimType']) => setProfile((current) => ({ ...current, claimType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="certificate_application">Hồ sơ xin chứng nhận</SelectItem><SelectItem value="origin_declaration_draft">Bản nháp tuyên bố xuất xứ</SelectItem></SelectContent></Select></div>
          <div><Label>Tổng invoice (EUR)</Label><Input type="number" min="0" value={profile.invoiceTotalEur ?? ''} onChange={(event) => setProfile((current) => ({ ...current, invoiceTotalEur: event.target.value === '' ? null : Number(event.target.value) }))} /></div>
          <div><Label>Tư cách exporter</Label><Select value={profile.exporterAuthorizationType} onValueChange={(value: OriginProfile['exporterAuthorizationType']) => setProfile((current) => ({ ...current, exporterAuthorizationType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Chưa có</SelectItem><SelectItem value="approved">Approved exporter</SelectItem><SelectItem value="registered">Registered exporter</SelectItem></SelectContent></Select></div>
          <div><Label>Mã chấp thuận/đăng ký</Label><Input value={profile.exporterAuthorizationReference} onChange={(event) => setProfile((current) => ({ ...current, exporterAuthorizationReference: event.target.value }))} /></div>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {([
            ['territorialityConfirmed', 'Đã kiểm tra nguyên tắc lãnh thổ'],
            ['nonAlterationConfirmed', 'Đã kiểm tra không thay đổi khi vận chuyển'],
            ['insufficientProcessingExcluded', 'Đã loại trừ công đoạn gia công không đầy đủ']
          ] as const).map(([key, label]) => <label key={key} className="flex items-start gap-2 rounded border p-3 text-sm"><input type="checkbox" checked={profile[key]} onChange={(event) => setProfile((current) => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}
        </div>

        <div className="space-y-4">
          {profile.lineAssessments.map((assessment, lineIndex) => {
            const line = bundle.lines.find((item) => item.id === assessment.exportLineId);
            return <div key={assessment.exportLineId} className="space-y-3 rounded-lg border p-3">
              <b className="text-sm">Dòng {line?.lineNumber}: {line?.sku} · HS {line?.hsCode}</b>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                <Select value={assessment.ruleCode} onValueChange={(value: OriginRuleCode) => updateAssessment(lineIndex, { ruleCode: value })}><SelectTrigger aria-label="Quy tắc xuất xứ"><SelectValue /></SelectTrigger><SelectContent>{[
                  'CH61_CUT_SEWN_KNITTING_AND_MAKING_UP', 'CH61_KNITTED_TO_SHAPE_SPINNING_OR_EXTRUSION_AND_KNITTING',
                  'CH62_GENERAL_WEAVING_AND_MAKING_UP', 'CH64_GENERAL_EXCLUDES_6406_UPPER_ASSEMBLY', 'SPECIALIST_RULE_REVIEW'
                ].map((rule) => <SelectItem key={rule} value={rule}>{rule}</SelectItem>)}</SelectContent></Select>
                <Input placeholder="Trang/dòng Annex II" value={assessment.ruleSourcePage} onChange={(event) => updateAssessment(lineIndex, { ruleSourcePage: event.target.value })} />
                <Input placeholder="Công đoạn, cách nhau bằng dấu phẩy" value={assessment.productionProcesses.join(', ')} onChange={(event) => updateAssessment(lineIndex, { productionProcesses: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} />
                <Input type="number" placeholder="Giá xuất xưởng EUR" value={assessment.exWorksPrice ?? ''} onChange={(event) => updateAssessment(lineIndex, { exWorksPrice: event.target.value === '' ? null : Number(event.target.value) })} />
                <Input type="number" placeholder="Giá trị NVL không có xuất xứ EUR" value={assessment.nonOriginatingMaterialValue ?? ''} onChange={(event) => updateAssessment(lineIndex, { nonOriginatingMaterialValue: event.target.value === '' ? null : Number(event.target.value) })} />
                {assessment.ruleCode === 'SPECIALIST_RULE_REVIEW' && <Input className="lg:col-span-3" placeholder="Nguyên văn quy tắc do chuyên viên xác định" value={assessment.specialistRuleText} onChange={(event) => updateAssessment(lineIndex, { specialistRuleText: event.target.value })} />}
              </div>
              <p className="text-xs text-slate-600">Mã công đoạn được kiểm soát: knitting, weaving, spinning, extrusion, natural_yarn_dyeing, making_up_including_cutting.</p>
              {assessment.materials.map((material, materialIndex) => <div key={material.id || materialIndex} className="grid gap-2 rounded border bg-slate-50 p-2 md:grid-cols-2 lg:grid-cols-4">
                <Input placeholder="Mã NVL" value={material.reference} onChange={(event) => updateMaterial(lineIndex, materialIndex, { reference: event.target.value })} />
                <Input placeholder="Mô tả NVL" value={material.description} onChange={(event) => updateMaterial(lineIndex, materialIndex, { description: event.target.value })} />
                <Input placeholder="HS NVL (ít nhất 4 số)" value={material.hsCode} onChange={(event) => updateMaterial(lineIndex, materialIndex, { hsCode: event.target.value })} />
                <Input placeholder="Nhà cung cấp" value={material.supplierName} onChange={(event) => updateMaterial(lineIndex, materialIndex, { supplierName: event.target.value })} />
                <Input placeholder="Nước xuất xứ (2 ký tự)" value={material.originCountry} onChange={(event) => updateMaterial(lineIndex, materialIndex, { originCountry: event.target.value.toUpperCase() })} />
                <Select value={material.originStatus} onValueChange={(value: OriginMaterial['originStatus']) => updateMaterial(lineIndex, materialIndex, { originStatus: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Chưa xác định</SelectItem><SelectItem value="originating">Có xuất xứ</SelectItem><SelectItem value="non_originating">Không có xuất xứ</SelectItem><SelectItem value="cumulated">Cộng gộp</SelectItem></SelectContent></Select>
                <Input type="number" placeholder="Giá trị EUR" value={material.value ?? ''} onChange={(event) => updateMaterial(lineIndex, materialIndex, { value: event.target.value === '' ? null : Number(event.target.value) })} />
                <Select value={material.evidenceDocumentId || undefined} onValueChange={(value) => updateMaterial(lineIndex, materialIndex, { evidenceDocumentId: value })}><SelectTrigger><SelectValue placeholder="Bằng chứng đã khóa" /></SelectTrigger><SelectContent>{evidence.filter((item) => ['locked', 'third_party_verified'].includes(item.status)).map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.status}</SelectItem>)}</SelectContent></Select>
                {material.originStatus === 'cumulated' && <Select value={material.cumulationBasis} onValueChange={(value: OriginMaterial['cumulationBasis']) => updateMaterial(lineIndex, materialIndex, { cumulationBasis: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Chưa xác định</SelectItem><SelectItem value="eu_bilateral">EU bilateral</SelectItem><SelectItem value="asean_article_3_2">ASEAN — Điều 3(2)</SelectItem><SelectItem value="korea_fabric_article_3_7">Vải Hàn Quốc — Điều 3(7)</SelectItem></SelectContent></Select>}
                <Button size="sm" variant="ghost" onClick={() => updateAssessment(lineIndex, { materials: assessment.materials.filter((_, i) => i !== materialIndex) })}><Trash2 className="mr-1 h-3 w-3" />Xóa NVL</Button>
              </div>)}
              <Button size="sm" variant="outline" onClick={() => updateAssessment(lineIndex, { materials: [...assessment.materials, blankMaterial()] })}><Plus className="mr-1 h-3 w-3" />Thêm NVL</Button>
            </div>;
          })}
        </div>

        <div className="space-y-2 rounded border p-3">
          <Label>Bằng chứng nhà cung cấp / chứng từ xuất xứ</Label>
          <div className="flex flex-wrap gap-2"><Input type="file" className="max-w-md" onChange={(event) => setFile(event.target.files?.[0] || null)} /><Button size="sm" variant="outline" disabled={!file || Boolean(busy)} onClick={() => void run('upload', () => uploadOriginEvidence(shipmentId, file!), 'Đã tải bằng chứng; cần khóa trước khi tham chiếu.')}><FileUp className="mr-1 h-3 w-3" />Tải lên</Button></div>
          {evidence.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{item.name} · {item.status} · {item.checksumSha256?.slice(0, 12) || 'chưa có SHA'}…</span>{item.status === 'uploaded' && <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void run(`lock-${item.id}`, () => lockOriginEvidence(item.id), 'Đã khóa bằng chứng xuất xứ.')}><LockKeyhole className="mr-1 h-3 w-3" />Khóa</Button>}</div>)}
        </div>
        <div className="flex flex-wrap gap-2"><Button disabled={Boolean(busy)} onClick={() => void run('save', () => saveOriginProfile(shipmentId, profile), 'Đã lưu hồ sơ R07.')}><Save className="mr-2 h-4 w-4" />Lưu R07</Button><Button variant="outline" disabled={Boolean(busy)} onClick={() => void reconcile()}><ShieldCheck className="mr-2 h-4 w-4" />Đối soát</Button></div>
        {reconciliation && <div className="rounded border p-3 text-sm"><b>{reconciliation.status}</b> · {reconciliation.blockingCodes.length} lỗi chặn{reconciliation.checks.filter((item) => item.status !== 'ready').slice(0, 8).map((item) => <p key={item.code} className="mt-1 text-xs text-red-700">• {item.message}</p>)}</div>}
      </>}
    </CardContent>
  </Card>;
}
