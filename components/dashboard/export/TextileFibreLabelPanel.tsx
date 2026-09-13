'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, FileUp, LockKeyhole, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  createTextileFibreLabelSpecification, fetchTextileFibreLabelSpecifications,
  lockTextileFibreLabelEvidence, reviewTextileFibreLabelSpecification,
  uploadTextileFibreLabelEvidence, type TextileFibreLabelInput,
  type TextileFibreLabelReview, type TextileFibreLabelSpecification
} from '@/lib/weave-v2/shipmentExportApi';

const localDate = () => {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};
const csv = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const booleanSelect = (value: boolean, change: (value: boolean) => void) =>
  <Select value={value ? 'yes' : 'no'} onValueChange={(next) => change(next === 'yes')}>
    <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
      <SelectItem value="yes">Đã xác nhận</SelectItem><SelectItem value="no">Chưa xác nhận</SelectItem>
    </SelectContent>
  </Select>;

const emptyInput = (): TextileFibreLabelInput => ({
  specificationReference: '', assessmentDate: localDate(), productReference: '', productCategory: 'shirt',
  specialProductCategory: 'standard', textileFibrePercent: 100, marketCodes: ['DE'],
  components: [{ componentReference: 'shell', componentName: 'Shell', weightPercent: 100,
    mainLining: false, fibres: [{ fibreCode: '5', percentage: 100 }] }],
  animalOriginPresence: 'absent',
  languageLabels: [{ marketCode: 'DE', languageCode: 'de-DE', labelText: '',
    animalOriginStatementIncluded: false, operatorApproved: false }],
  economicOperator: { role: 'importer', name: '', address: '' },
  placement: { method: 'sewn', durable: false, easilyLegible: false, visible: false,
    accessible: false, securelyAttached: false, onlineBeforePurchase: false },
  evidenceDocumentIds: [], notes: ''
});

export default function TextileFibreLabelPanel({ shipmentId }: { shipmentId: string }) {
  const [input, setInput] = useState<TextileFibreLabelInput>(emptyInput);
  const [markets, setMarkets] = useState('DE');
  const [specifications, setSpecifications] = useState<TextileFibreLabelSpecification[]>([]);
  const [reviewNotes, setReviewNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState('');
  const latest = specifications[0] || null;

  const load = useCallback(async () => {
    setSpecifications(await fetchTextileFibreLabelSpecifications(shipmentId));
  }, [shipmentId]);
  useEffect(() => { void load().catch(() => setSpecifications([])); }, [load]);

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try { await action(); toast.success(success); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Thao tác R08 thất bại.'); }
    finally { setBusy(''); }
  };
  const patchComponent = (index: number, patch: Partial<TextileFibreLabelInput['components'][number]>) =>
    setInput((current) => ({ ...current, components: current.components.map((item, i) => i === index ? { ...item, ...patch } : item) }));
  const patchFibre = (componentIndex: number, fibreIndex: number, patch: Partial<{ fibreCode: string; percentage: number }>) => {
    const component = input.components[componentIndex];
    patchComponent(componentIndex, { fibres: component.fibres.map((item, i) => i === fibreIndex ? { ...item, ...patch } : item) });
  };
  const patchPlacement = (patch: Partial<TextileFibreLabelInput['placement']>) =>
    setInput((current) => ({ ...current, placement: { ...current.placement, ...patch } }));
  const patchLanguage = (patch: Partial<TextileFibreLabelInput['languageLabels'][number]>) =>
    setInput((current) => ({ ...current, languageLabels: [{ ...current.languageLabels[0], ...patch }] }));

  const uploadAndLock = () => run('upload', async () => {
    const uploaded = await uploadTextileFibreLabelEvidence(shipmentId, file!);
    await lockTextileFibreLabelEvidence(uploaded.id);
    setInput((current) => ({ ...current, evidenceDocumentIds: [...new Set([...current.evidenceDocumentIds, uploaded.id])] }));
    setFile(null);
  }, 'Đã tải và khóa bằng chứng thành phần xơ sợi.');
  const create = () => run('create', () => createTextileFibreLabelSpecification(shipmentId, {
    ...input, marketCodes: csv(markets).map((item) => item.toUpperCase())
  }), 'Đã tạo revision nhãn R08 bất biến.');
  const review = (decision: TextileFibreLabelReview['decision']) => run('review', () =>
    reviewTextileFibreLabelSpecification(shipmentId, latest!.id, {
      reviewerRole: 'textile_label_reviewer', decision, notes: reviewNotes
    }), decision === 'approved_for_internal_artwork'
    ? 'Đã duyệt nội bộ để chuyển sang thiết kế artwork.' : 'Đã ghi nhận quyết định R08.');

  return <Card>
    <CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
      <span>11. R08 — Nhãn thành phần xơ sợi EU</span><Badge variant="outline">Regulation 1007/2011 · giới hạn</Badge>
    </CardTitle></CardHeader>
    <CardContent className="space-y-5">
      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertTriangle className="mr-2 inline h-4 w-4" />Preview tiếng Anh chỉ hỗ trợ kiểm soát nội bộ.
        Nhãn từng thị trường phải do operator xác nhận ngôn ngữ và reviewer phê duyệt trước khi làm artwork.
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div><Label>Mã specification ổn định</Label><Input value={input.specificationReference} onChange={(e) => setInput((v) => ({ ...v, specificationReference: e.target.value }))} /></div>
        <div><Label>Ngày đánh giá</Label><Input type="date" value={input.assessmentDate} onChange={(e) => setInput((v) => ({ ...v, assessmentDate: e.target.value }))} /></div>
        <div><Label>Mã sản phẩm/SKU</Label><Input value={input.productReference} onChange={(e) => setInput((v) => ({ ...v, productReference: e.target.value }))} /></div>
        <div><Label>Loại sản phẩm</Label><Input value={input.productCategory} onChange={(e) => setInput((v) => ({ ...v, productCategory: e.target.value }))} /></div>
        <div><Label>Tỷ lệ xơ sợi toàn sản phẩm (%)</Label><Input type="number" min="0" max="100" value={input.textileFibrePercent} onChange={(e) => setInput((v) => ({ ...v, textileFibrePercent: Number(e.target.value) }))} /></div>
        <div><Label>Phân loại ngoại lệ</Label><Select value={input.specialProductCategory} onValueChange={(value: TextileFibreLabelInput['specialProductCategory']) => setInput((v) => ({ ...v, specialProductCategory: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['standard', 'annex_iv', 'annex_v', 'annex_vi', 'unknown'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Thị trường EU, cách nhau dấu phẩy</Label><Input value={markets} onChange={(e) => setMarkets(e.target.value)} /></div>
        <div><Label>Phần không dệt nguồn gốc động vật</Label><Select value={input.animalOriginPresence} onValueChange={(value: TextileFibreLabelInput['animalOriginPresence']) => setInput((v) => ({ ...v, animalOriginPresence: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="absent">Không có</SelectItem><SelectItem value="present">Có</SelectItem><SelectItem value="unknown">Chưa rõ</SelectItem></SelectContent></Select></div>
      </div>

      <div className="space-y-3 rounded border p-3">
        <div className="flex items-center justify-between"><b className="text-sm">Thành phần và xơ sợi Annex I</b><Button size="sm" variant="outline" onClick={() => setInput((v) => ({ ...v, components: [...v.components, { componentReference: '', componentName: '', weightPercent: 0, mainLining: false, fibres: [{ fibreCode: '5', percentage: 100 }] }] }))}><Plus className="mr-1 h-3 w-3" />Thành phần</Button></div>
        {input.components.map((component, componentIndex) => <div key={`${componentIndex}-${component.componentReference}`} className="space-y-2 rounded bg-slate-50 p-3">
          <div className="grid gap-2 md:grid-cols-5">
            <Input placeholder="Reference" value={component.componentReference} onChange={(e) => patchComponent(componentIndex, { componentReference: e.target.value })} />
            <Input placeholder="Tên trên nhãn" value={component.componentName} onChange={(e) => patchComponent(componentIndex, { componentName: e.target.value })} />
            <Input type="number" min="0" max="100" placeholder="% khối lượng" value={component.weightPercent} onChange={(e) => patchComponent(componentIndex, { weightPercent: Number(e.target.value) })} />
            <Select value={component.mainLining ? 'yes' : 'no'} onValueChange={(value) => patchComponent(componentIndex, { mainLining: value === 'yes' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="no">Không phải main lining</SelectItem><SelectItem value="yes">Main lining</SelectItem></SelectContent></Select>
            <Button variant="ghost" disabled={input.components.length === 1} onClick={() => setInput((v) => ({ ...v, components: v.components.filter((_, i) => i !== componentIndex) }))}><Trash2 className="h-4 w-4" /></Button>
          </div>
          {component.fibres.map((fibre, fibreIndex) => <div key={fibreIndex} className="flex gap-2">
            <Input aria-label="Annex I fibre code" placeholder="Mã Annex I, ví dụ 5=cotton, 35=polyester" value={fibre.fibreCode} onChange={(e) => patchFibre(componentIndex, fibreIndex, { fibreCode: e.target.value })} />
            <Input aria-label="Fibre percentage" type="number" min="0" max="100" value={fibre.percentage} onChange={(e) => patchFibre(componentIndex, fibreIndex, { percentage: Number(e.target.value) })} />
            <Button variant="ghost" disabled={component.fibres.length === 1} onClick={() => patchComponent(componentIndex, { fibres: component.fibres.filter((_, i) => i !== fibreIndex) })}><Trash2 className="h-4 w-4" /></Button>
          </div>)}
          <Button size="sm" variant="outline" onClick={() => patchComponent(componentIndex, { fibres: [...component.fibres, { fibreCode: '35', percentage: 0 }] })}><Plus className="mr-1 h-3 w-3" />Xơ sợi</Button>
        </div>)}
      </div>

      <div className="grid gap-3 rounded border p-3 md:grid-cols-2 lg:grid-cols-4">
        <div><Label>Market cho bản dịch</Label><Input value={input.languageLabels[0].marketCode} onChange={(e) => patchLanguage({ marketCode: e.target.value.toUpperCase() })} /></div>
        <div><Label>Mã ngôn ngữ</Label><Input value={input.languageLabels[0].languageCode} onChange={(e) => patchLanguage({ languageCode: e.target.value })} /></div>
        <div><Label>Operator đã duyệt bản dịch</Label>{booleanSelect(input.languageLabels[0].operatorApproved, (operatorApproved) => patchLanguage({ operatorApproved }))}</div>
        <div><Label>Đã có câu animal-origin đúng ngôn ngữ</Label>{booleanSelect(input.languageLabels[0].animalOriginStatementIncluded, (animalOriginStatementIncluded) => patchLanguage({ animalOriginStatementIncluded }))}</div>
        <div className="md:col-span-2 lg:col-span-4"><Label>Nguyên văn nhãn ngôn ngữ thị trường</Label><Textarea value={input.languageLabels[0].labelText} onChange={(e) => patchLanguage({ labelText: e.target.value })} /></div>
      </div>

      <div className="space-y-3 rounded border p-3">
        <b className="text-sm">Economic operator và placement</b>
        <div className="grid gap-3 md:grid-cols-3"><Input placeholder="Vai trò: importer/manufacturer" value={input.economicOperator.role} onChange={(e) => setInput((v) => ({ ...v, economicOperator: { ...v.economicOperator, role: e.target.value } }))} /><Input placeholder="Tên operator" value={input.economicOperator.name} onChange={(e) => setInput((v) => ({ ...v, economicOperator: { ...v.economicOperator, name: e.target.value } }))} /><Input placeholder="Địa chỉ" value={input.economicOperator.address} onChange={(e) => setInput((v) => ({ ...v, economicOperator: { ...v.economicOperator, address: e.target.value } }))} /></div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div><Label>Phương pháp gắn</Label><Input value={input.placement.method} onChange={(e) => patchPlacement({ method: e.target.value })} /></div>
          {([['durable', 'Bền'], ['easilyLegible', 'Dễ đọc'], ['visible', 'Nhìn thấy'], ['accessible', 'Truy cập được'], ['securelyAttached', 'Gắn chắc'], ['onlineBeforePurchase', 'Online trước mua']] as const).map(([key, label]) => <div key={key}><Label>{label}</Label>{booleanSelect(input.placement[key], (value) => patchPlacement({ [key]: value }))}</div>)}
        </div>
      </div>

      <div className="space-y-2 rounded border p-3">
        <b className="text-sm">Bằng chứng composition/lab test</b>
        <div className="flex flex-wrap gap-2"><Input type="file" className="max-w-md" onChange={(e) => setFile(e.target.files?.[0] || null)} /><Button size="sm" variant="outline" disabled={!file || Boolean(busy)} onClick={() => void uploadAndLock()}><FileUp className="mr-1 h-3 w-3" />Tải và khóa</Button></div>
        <Input placeholder="Evidence UUIDs" value={input.evidenceDocumentIds.join(', ')} onChange={(e) => setInput((v) => ({ ...v, evidenceDocumentIds: csv(e.target.value) }))} />
        <Textarea placeholder="Ghi chú specification" value={input.notes} onChange={(e) => setInput((v) => ({ ...v, notes: e.target.value }))} />
        <Button disabled={Boolean(busy) || !input.specificationReference || !input.assessmentDate} onClick={() => void create()}><LockKeyhole className="mr-2 h-4 w-4" />Tạo revision nhãn</Button>
      </div>

      {latest && <div className="space-y-3 rounded border p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2"><b>{latest.specificationReference} · rev {latest.revision}</b><Badge>{latest.artworkStatus}</Badge><Badge variant="outline">{latest.automatedStatus}</Badge><span className="text-xs text-slate-500">SHA {latest.resultSha256.slice(0, 12)}…</span><Button size="sm" variant="ghost" onClick={() => void load()}><RefreshCw className="h-3 w-3" /></Button></div>
        <pre className="whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs">{latest.result.englishPreview}</pre>
        {latest.result.findings.map((finding) => <div key={`${finding.code}:${finding.path || ''}`} className="rounded border p-2"><div className="flex gap-2"><b>{finding.code}</b><Badge variant="outline">{finding.severity}</Badge></div><p className="text-xs">{finding.message}</p>{finding.sourceArticle && <span className="text-xs text-slate-500">{finding.sourceArticle}</span>}</div>)}
        <a className="text-xs text-blue-700 underline" href={latest.result.sources[0]?.url} target="_blank" rel="noreferrer">Nguồn EUR-Lex · {latest.rulesetVersion}</a>
        <div className="space-y-2 rounded border bg-slate-50 p-3"><b>Textile review append-only</b><Textarea placeholder="Căn cứ và giới hạn quyết định" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} /><div className="flex flex-wrap gap-2"><Button size="sm" disabled={!reviewNotes || latest.automatedStatus !== 'ready_for_label_review' || Boolean(busy)} onClick={() => void review('approved_for_internal_artwork')}>Duyệt cho artwork nội bộ</Button><Button size="sm" variant="outline" disabled={!reviewNotes || Boolean(busy)} onClick={() => void review('needs_information')}>Cần thông tin</Button><Button size="sm" variant="outline" disabled={!reviewNotes || Boolean(busy)} onClick={() => void review('rejected')}>Bác</Button></div>{latest.latestReview && <p className="text-xs">Mới nhất: {latest.latestReview.decision} · {latest.latestReview.reviewerName}</p>}</div>
      </div>}
    </CardContent>
  </Card>;
}
