'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, LockKeyhole, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  emptyEuImportProfile,
  fetchEuImportReconciliation,
  lockEuImportEvidence,
  recordEuImportEvent,
  saveEuImportLineDetail,
  saveEuImportProfile,
  uploadEuImportEvidence,
  type EuImportEventType,
  type EuImportLineDetail,
  type EuImportParty,
  type EuImportProfile,
  type EuImportReconciliation,
  type ShipmentExportBundle
} from '@/lib/weave-v2/shipmentExportApi';

const eventLabels: Record<EuImportEventType, string> = {
  declarant_received: 'Declarant đã nhận', declarant_validated: 'Declarant đã kiểm tra',
  declarant_rejected: 'Declarant từ chối/yêu cầu sửa', authority_submitted: 'Declarant báo đã nộp',
  authority_accepted: 'Hải quan chấp nhận', authority_rejected: 'Hải quan từ chối',
  authority_released: 'Hải quan giải phóng hàng', authority_cancelled: 'Khai báo bị hủy',
  amendment_requested: 'Yêu cầu sửa đổi', amendment_submitted: 'Đã nộp sửa đổi'
};

const splitRefs = (value: string) => value.split(/[\n,]/).map((item) => item.trim())
  .filter(Boolean).map((reference) => ({ reference }));
const joinRefs = (value: Array<Record<string, unknown>>) => value
  .map((item) => String(item.reference || item.number || '')).filter(Boolean).join(', ');
const splitCodes = (value: string) => value.split(/[\s,]+/).map((item) => item.trim().toUpperCase()).filter(Boolean);
const joinCodes = (value: string[]) => value.join(', ');

const blankLine = (lineId: string): EuImportLineDetail => ({
  exportLineId: lineId, taricCode: '', taricSource: 'EU TARIC', taricVersion: '',
  taricEffectiveDate: null, taricConfirmed: false, supplementaryUnitCode: '',
  additionalCodes: [], nationalAdditionalCodes: [], preferenceCode: '',
  requestedProcedureCode: '', previousProcedureCode: '', metadata: {}
});

export default function EuImportHandoffPanel({
  shipmentId, bundle, onChanged
}: {
  shipmentId: string;
  bundle: ShipmentExportBundle;
  onChanged: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<EuImportProfile>(() => bundle.euImportProfile || emptyEuImportProfile());
  const [lineDetails, setLineDetails] = useState<Record<string, EuImportLineDetail>>(() => Object.fromEntries(
    bundle.lines.map((line) => [line.id, bundle.euImportLineDetails.find((item) => item.exportLineId === line.id) || blankLine(line.id)])
  ));
  const [restrictionRefs, setRestrictionRefs] = useState(() => joinRefs(profile.restrictionReferences));
  const [preferenceRefs, setPreferenceRefs] = useState(() => joinRefs(profile.preferenceReferences));
  const [guaranteeRefs, setGuaranteeRefs] = useState(() => joinRefs(profile.guaranteeReferences));
  const [reconciliation, setReconciliation] = useState<EuImportReconciliation | null>(null);
  const [busy, setBusy] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceKind, setEvidenceKind] = useState<'eu_declarant_response' | 'eu_customs_authority_response' | 'eu_import_declaration'>('eu_declarant_response');
  const [event, setEvent] = useState({
    eventType: 'declarant_received' as EuImportEventType, exportDocumentId: '', evidenceDocumentId: '',
    externalReference: '', actorName: '', actorIdentifier: '', messageCode: '', messageText: '', occurredAt: ''
  });

  const issuedHandoffs = useMemo(() => bundle.documents.filter(
    (item) => item.type === 'eu_import_handoff' && item.status === 'issued'
  ), [bundle.documents]);
  const eligibleEvidence = useMemo(() => bundle.euImportEvidence.filter(
    (item) => ['locked', 'third_party_verified'].includes(item.status)
  ), [bundle.euImportEvidence]);
  const currentExternalState = bundle.euImportEvents[0]?.eventType || 'Chưa có phản hồi bên ngoài';

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await action();
      toast.success(success);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Thao tác R05 thất bại.');
    } finally { setBusy(''); }
  };

  const setParty = (key: 'importer' | 'declarant' | 'representative', field: keyof EuImportParty, value: string) =>
    setProfile((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));

  const saveProfile = () => run('profile', () => saveEuImportProfile(shipmentId, {
    ...profile,
    memberStateCode: profile.memberStateCode || bundle.shipment.destinationCountry,
    importer: {
      ...profile.importer, name: profile.importer.name || bundle.profile?.importer.name,
      address: profile.importer.address || bundle.profile?.importer.address,
      eori: profile.importer.eori || bundle.profile?.importerEori
    },
    deliveryTermsLocation: profile.deliveryTermsLocation || bundle.profile?.incotermLocation || '',
    customsValueCurrency: profile.customsValueCurrency || bundle.profile?.currency || '',
    customsValueAmount: profile.customsValueAmount ?? bundle.profile?.customsValueAmount ?? null,
    restrictionReferences: splitRefs(restrictionRefs), preferenceReferences: splitRefs(preferenceRefs),
    guaranteeReferences: splitRefs(guaranteeRefs),
    supportingDocuments: [
      { type: 'commercial_invoice', reference: bundle.profile?.invoiceNumber || '' },
      { type: 'packing_list', reference: bundle.profile?.packingListNumber || '' },
      { type: 'carrier_document', reference: bundle.profile?.billOfLadingNo || '' }
    ]
  }), 'Đã lưu hồ sơ bàn giao nhập khẩu EU.');

  const saveLine = (lineId: string, confirm: boolean) => {
    const detail = lineDetails[lineId];
    return run(`${confirm ? 'confirm' : 'line'}-${lineId}`, () => saveEuImportLineDetail(shipmentId, lineId, {
      ...detail, taricConfirmed: confirm
    }), confirm ? 'Đã xác nhận riêng quyết định phân loại TARIC.' : 'Đã lưu phân loại; cần bước xác nhận riêng.');
  };

  const reconcile = async () => {
    setBusy('reconcile');
    try { setReconciliation(await fetchEuImportReconciliation(shipmentId)); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Không đối soát được R05.'); }
    finally { setBusy(''); }
  };

  const codeFields: Array<[keyof EuImportProfile, string]> = [
    ['customsOfficeCode', 'Mã cơ quan hải quan'], ['declarationDatasetCode', 'EUCDM dataset (ví dụ H1)'],
    ['additionalDeclarationType', 'Loại khai bổ sung'], ['requestedProcedureCode', 'Mã thủ tục yêu cầu'],
    ['previousProcedureCode', 'Mã thủ tục trước'], ['modeOfTransportAtBorder', 'PTVT tại biên giới'],
    ['inlandModeOfTransport', 'PTVT nội địa'], ['placeOfGoodsCode', 'Mã địa điểm hàng'],
    ['valuationMethodCode', 'Mã phương pháp trị giá']
  ];

  return <Card className="border-indigo-200">
    <CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
      <span>6. R05 — EU Import Declarant Handoff (EUCDM)</span><Badge variant="outline">{currentExternalState}</Badge>
    </CardTitle></CardHeader>
    <CardContent className="space-y-5">
      <div className="flex gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <p><b>Không phải SAD, thông điệp quốc gia, tờ khai, MRN hay xác nhận của hải quan.</b> R05 chỉ tạo dữ liệu có kiểm soát để declarant ánh xạ vào đúng schema quốc gia đã thỏa thuận. Mọi trạng thái bên ngoài phải có file bằng chứng đã khóa checksum.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1"><Label>Nước thành viên nhập khẩu</Label><Input maxLength={2} value={profile.memberStateCode} onChange={(e) => setProfile((p) => ({ ...p, memberStateCode: e.target.value.toUpperCase() }))} /></div>
        <div className="space-y-1"><Label>Schema đích declarant/quốc gia</Label><Input placeholder="ID do declarant cung cấp" value={profile.targetSystemSchemaId} onChange={(e) => setProfile((p) => ({ ...p, targetSystemSchemaId: e.target.value }))} /></div>
        <div className="space-y-1"><Label>Phiên bản schema đích</Label><Input value={profile.targetSystemSchemaVersion} onChange={(e) => setProfile((p) => ({ ...p, targetSystemSchemaVersion: e.target.value }))} /></div>
        <div className="space-y-1"><Label>Kiểu đại diện</Label><Select value={profile.representationType} onValueChange={(value: EuImportProfile['representationType']) => setProfile((p) => ({ ...p, representationType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Không đại diện</SelectItem><SelectItem value="direct">Đại diện trực tiếp</SelectItem><SelectItem value="indirect">Đại diện gián tiếp</SelectItem></SelectContent></Select></div>
      </div>

      {(['importer', 'declarant', ...(profile.representationType === 'none' ? [] : ['representative'])] as Array<'importer' | 'declarant' | 'representative'>).map((party) => <div key={party} className="grid gap-2 rounded border p-3 md:grid-cols-3">
        <b className="md:col-span-3 text-sm">{party === 'importer' ? 'Importer' : party === 'declarant' ? 'Declarant' : 'Representative'}</b>
        <Input placeholder="Tên pháp lý" value={profile[party].name || ''} onChange={(e) => setParty(party, 'name', e.target.value)} />
        <Input placeholder="Địa chỉ" value={profile[party].address || ''} onChange={(e) => setParty(party, 'address', e.target.value)} />
        <Input placeholder="EORI" value={profile[party].eori || ''} onChange={(e) => setParty(party, 'eori', e.target.value.toUpperCase())} />
      </div>)}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {codeFields.map(([key, label]) => <div key={key} className="space-y-1"><Label>{label}</Label><Input value={String(profile[key] ?? '')} onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value.toUpperCase() }))} /></div>)}
        <div className="space-y-1"><Label>Nhận diện PTVT biên giới</Label><Input value={profile.borderTransportIdentity} onChange={(e) => setProfile((p) => ({ ...p, borderTransportIdentity: e.target.value }))} /></div>
        <div className="space-y-1"><Label>Địa điểm điều kiện giao hàng</Label><Input value={profile.deliveryTermsLocation} onChange={(e) => setProfile((p) => ({ ...p, deliveryTermsLocation: e.target.value }))} /></div>
        <div className="space-y-1"><Label>Tỷ giá hải quan</Label><Input type="number" min="0" value={profile.exchangeRate ?? ''} onChange={(e) => setProfile((p) => ({ ...p, exchangeRate: e.target.value === '' ? null : Number(e.target.value) }))} /></div>
        <div className="space-y-1"><Label>Tiền tệ trị giá hải quan</Label><Input maxLength={3} value={profile.customsValueCurrency} onChange={(e) => setProfile((p) => ({ ...p, customsValueCurrency: e.target.value.toUpperCase() }))} /></div>
        <div className="space-y-1"><Label>Trị giá hải quan nhập khẩu</Label><Input type="number" min="0" value={profile.customsValueAmount ?? ''} onChange={(e) => setProfile((p) => ({ ...p, customsValueAmount: e.target.value === '' ? null : Number(e.target.value) }))} /></div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {([
          ['dutyTreatment', 'Thuế nhập khẩu', 'dutyRate', 'dutyAmount'],
          ['vatTreatment', 'VAT nhập khẩu', 'vatRate', 'vatAmount']
        ] as const).map(([treatment, label, rate, amount]) => <div key={treatment} className="space-y-2 rounded border p-3"><Label>{label}</Label><Select value={profile[treatment]} onValueChange={(value: EuImportProfile[typeof treatment]) => setProfile((p) => ({ ...p, [treatment]: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Chưa xác định</SelectItem><SelectItem value="not_subject">Không thuộc đối tượng</SelectItem><SelectItem value="exempt">Miễn</SelectItem><SelectItem value="payable">Phải nộp</SelectItem></SelectContent></Select>{profile[treatment] === 'payable' && <div className="grid grid-cols-2 gap-2"><Input type="number" placeholder="Thuế suất %" value={profile[rate] ?? ''} onChange={(e) => setProfile((p) => ({ ...p, [rate]: e.target.value === '' ? null : Number(e.target.value) }))} /><Input type="number" placeholder="Số tiền" value={profile[amount] ?? ''} onChange={(e) => setProfile((p) => ({ ...p, [amount]: e.target.value === '' ? null : Number(e.target.value) }))} /></div>}</div>)}
        <div className="space-y-2 rounded border p-3"><Label>Cơ sở tính thuế</Label><Input value={profile.taxBasis} onChange={(e) => setProfile((p) => ({ ...p, taxBasis: e.target.value }))} /></div>
        {([
          ['restrictionStatus', 'Hạn chế/kiểm soát nhập khẩu', restrictionRefs, setRestrictionRefs],
          ['guaranteeRequirementStatus', 'Bảo lãnh', guaranteeRefs, setGuaranteeRefs]
        ] as const).map(([key, label, value, setter]) => <div key={key} className="space-y-2 rounded border p-3"><Label>{label}</Label><Select value={profile[key]} onValueChange={(status: 'unknown' | 'not_required' | 'required') => setProfile((p) => ({ ...p, [key]: status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Chưa xác định</SelectItem><SelectItem value="not_required">Không yêu cầu</SelectItem><SelectItem value="required">Có yêu cầu</SelectItem></SelectContent></Select><Input placeholder="Tham chiếu, cách nhau bằng dấu phẩy" value={value} onChange={(e) => setter(e.target.value)} /></div>)}
        <div className="space-y-2 rounded border p-3"><Label>Ưu đãi xuất xứ</Label><Select value={profile.preferenceClaimStatus} onValueChange={(status: EuImportProfile['preferenceClaimStatus']) => setProfile((p) => ({ ...p, preferenceClaimStatus: status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="no_claim">Không yêu cầu ưu đãi</SelectItem><SelectItem value="claimed">Yêu cầu ưu đãi</SelectItem></SelectContent></Select><Input placeholder="EUR.1/origin declaration" value={preferenceRefs} onChange={(e) => setPreferenceRefs(e.target.value)} /></div>
      </div>

      <div className="space-y-3 rounded border p-3">
        <div><b className="text-sm">Phân loại TARIC theo từng dòng</b><p className="text-xs text-slate-600">Lưu phân loại trước, sau đó dùng nút xác nhận riêng. Nếu sửa mã/nguồn/phiên bản/ngày hiệu lực, xác nhận cũ tự mất hiệu lực.</p></div>
        {bundle.lines.map((line) => {
          const detail = lineDetails[line.id] || blankLine(line.id);
          const update = (patch: Partial<EuImportLineDetail>) => setLineDetails((current) => ({ ...current, [line.id]: { ...detail, ...patch } }));
          return <div key={line.id} className="grid gap-2 rounded border p-2 md:grid-cols-2 lg:grid-cols-6">
            <span className="self-center text-xs"><b>#{line.lineNumber} {line.sku}</b><br />HS/CN gốc: {line.hsCode}</span>
            <Input aria-label={`TARIC dòng ${line.lineNumber}`} placeholder="TARIC 10 số" maxLength={14} value={detail.taricCode} onChange={(e) => update({ taricCode: e.target.value.replace(/\D/g, ''), taricConfirmed: false })} />
            <Input placeholder="Nguồn TARIC" value={detail.taricSource} onChange={(e) => update({ taricSource: e.target.value, taricConfirmed: false })} />
            <Input placeholder="Phiên bản TARIC" value={detail.taricVersion} onChange={(e) => update({ taricVersion: e.target.value, taricConfirmed: false })} />
            <Input type="date" value={detail.taricEffectiveDate || ''} onChange={(e) => update({ taricEffectiveDate: e.target.value || null, taricConfirmed: false })} />
            <Input placeholder="Mã bổ sung EU" value={joinCodes(detail.additionalCodes)} onChange={(e) => update({ additionalCodes: splitCodes(e.target.value) })} />
            <Input placeholder="Mã bổ sung quốc gia" value={joinCodes(detail.nationalAdditionalCodes)} onChange={(e) => update({ nationalAdditionalCodes: splitCodes(e.target.value) })} />
            <Input placeholder="Đơn vị bổ sung" value={detail.supplementaryUnitCode} onChange={(e) => update({ supplementaryUnitCode: e.target.value.toUpperCase() })} />
            <Input placeholder="Mã ưu đãi" value={detail.preferenceCode} onChange={(e) => update({ preferenceCode: e.target.value.toUpperCase() })} />
            <div className="flex gap-2 lg:col-span-2"><Button size="sm" variant="outline" disabled={Boolean(busy) || !detail.taricCode || !detail.taricSource || !detail.taricVersion || !detail.taricEffectiveDate} onClick={() => void saveLine(line.id, false)}><Save className="mr-1 h-3 w-3" />Lưu</Button><Button size="sm" disabled={Boolean(busy) || !detail.taricCode || !detail.taricSource || !detail.taricVersion || !detail.taricEffectiveDate} onClick={() => void saveLine(line.id, true)}><ShieldCheck className="mr-1 h-3 w-3" />Xác nhận TARIC</Button>{detail.taricConfirmed && <Badge className="self-center">Đã xác nhận</Badge>}</div>
          </div>;
        })}
      </div>

      <div className="flex flex-wrap gap-2"><Button onClick={() => void saveProfile()} disabled={Boolean(busy)}><Save className="mr-2 h-4 w-4" />Lưu R05</Button><Button variant="outline" onClick={() => void reconcile()} disabled={Boolean(busy)}>Đối soát R01–R03 và R05</Button></div>
      {reconciliation && <div className={`rounded border p-3 text-xs ${reconciliation.status === 'passed' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}><p className="flex items-center gap-2 font-medium">{reconciliation.status === 'passed' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{reconciliation.status} · {reconciliation.rulesetVersion}</p>{reconciliation.checks.filter((item) => item.status !== 'ready').slice(0, 12).map((item) => <p key={item.code}>• {item.message}</p>)}</div>}

      <div className="space-y-3 rounded border p-3"><b className="text-sm">Bằng chứng declarant/hải quan EU</b><div className="grid gap-2 md:grid-cols-[240px_1fr_auto]"><Select value={evidenceKind} onValueChange={(value: typeof evidenceKind) => setEvidenceKind(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="eu_declarant_response">Phản hồi declarant</SelectItem><SelectItem value="eu_customs_authority_response">Phản hồi hải quan EU</SelectItem><SelectItem value="eu_import_declaration">Tờ khai/SAD/MRN bên ngoài</SelectItem></SelectContent></Select><Input type="file" accept=".pdf,.json,.xml,.csv,.xlsx,.xls,.png,.jpg,.jpeg" onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)} /><Button variant="outline" disabled={!evidenceFile || Boolean(busy)} onClick={() => void run('upload', async () => { await uploadEuImportEvidence(shipmentId, evidenceFile!, evidenceKind); setEvidenceFile(null); }, 'Đã tải bằng chứng; cần khóa trước khi ghi sự kiện.')}><FileUp className="mr-2 h-4 w-4" />Tải lên</Button></div>{bundle.euImportEvidence.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-xs"><span>{item.name} · {item.status} · {item.checksumSha256?.slice(0, 12) || 'chưa có hash'}…</span>{!['locked', 'third_party_verified'].includes(item.status) && <Button size="sm" variant="outline" onClick={() => void run(`lock-${item.id}`, () => lockEuImportEvidence(item.id), 'Đã khóa bằng chứng đúng checksum.')} disabled={Boolean(busy)}><LockKeyhole className="mr-1 h-3 w-3" />Khóa</Button>}</div>)}</div>

      <div className="space-y-3 rounded border p-3"><b className="text-sm">Lịch sử phản hồi bên ngoài bất biến</b><div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4"><Select value={event.eventType} onValueChange={(eventType: EuImportEventType) => setEvent((p) => ({ ...p, eventType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(eventLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Select value={event.exportDocumentId} onValueChange={(exportDocumentId) => setEvent((p) => ({ ...p, exportDocumentId }))}><SelectTrigger><SelectValue placeholder="Chọn R05 đã phát hành" /></SelectTrigger><SelectContent>{issuedHandoffs.map((item) => <SelectItem key={item.id} value={item.id}>v{item.version} · {item.fileSha256?.slice(0, 10)}…</SelectItem>)}</SelectContent></Select><Select value={event.evidenceDocumentId} onValueChange={(evidenceDocumentId) => setEvent((p) => ({ ...p, evidenceDocumentId }))}><SelectTrigger><SelectValue placeholder="Bằng chứng đã khóa" /></SelectTrigger><SelectContent>{eligibleEvidence.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Input type="datetime-local" value={event.occurredAt} onChange={(e) => setEvent((p) => ({ ...p, occurredAt: e.target.value }))} /><Input placeholder="Số tham chiếu/MRN ngoài hệ thống" value={event.externalReference} onChange={(e) => setEvent((p) => ({ ...p, externalReference: e.target.value }))} /><Input placeholder="Declarant/cơ quan phát thông báo" value={event.actorName} onChange={(e) => setEvent((p) => ({ ...p, actorName: e.target.value }))} /><Input placeholder="Mã actor/cơ quan" value={event.actorIdentifier} onChange={(e) => setEvent((p) => ({ ...p, actorIdentifier: e.target.value }))} /><Input placeholder="Mã thông điệp" value={event.messageCode} onChange={(e) => setEvent((p) => ({ ...p, messageCode: e.target.value }))} /><Input className="lg:col-span-3" placeholder="Nội dung phản hồi" value={event.messageText} onChange={(e) => setEvent((p) => ({ ...p, messageText: e.target.value }))} /><Button disabled={Boolean(busy) || !event.exportDocumentId || !event.evidenceDocumentId || !event.externalReference || !event.actorName || !event.occurredAt} onClick={() => void run('event', () => recordEuImportEvent(shipmentId, { ...event, occurredAt: new Date(event.occurredAt).toISOString() }), 'Đã ghi phản hồi ngoài hệ thống và khóa theo checksum.')}>Ghi sự kiện</Button></div>{bundle.euImportEvents.map((item) => <div key={item.id} className="rounded border p-2 text-xs"><b>{eventLabels[item.eventType]}</b> · {item.externalReference} · {item.actorName} · {new Date(item.occurredAt).toLocaleString('vi-VN')}<p className="text-slate-500">Evidence SHA-256: {item.evidenceSha256}</p></div>)}</div>
    </CardContent>
  </Card>;
}
