'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, LockKeyhole, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  emptyVnCustomsProfile,
  fetchVnCustomsReconciliation,
  lockVnCustomsEvidence,
  recordVnCustomsEvent,
  saveVnCustomsProfile,
  uploadVnCustomsEvidence,
  type ShipmentExportBundle,
  type VnCustomsEventType,
  type VnCustomsProfile,
  type VnCustomsReconciliation
} from '@/lib/weave-v2/shipmentExportApi';

const eventLabels: Record<VnCustomsEventType, string> = {
  broker_received: 'Broker đã nhận',
  broker_validated: 'Broker đã kiểm tra',
  broker_rejected: 'Broker từ chối/yêu cầu sửa',
  authority_submitted: 'Broker báo đã nộp',
  authority_accepted: 'Cơ quan hải quan chấp nhận',
  authority_rejected: 'Cơ quan hải quan từ chối',
  authority_released: 'Cơ quan hải quan thông quan/giải phóng',
  authority_cancelled: 'Tờ khai bị hủy',
  amendment_requested: 'Yêu cầu khai bổ sung',
  amendment_submitted: 'Broker báo đã nộp bổ sung'
};

const splitReferences = (value: string) => value.split(/[\n,]/)
  .map((entry) => entry.trim()).filter(Boolean).map((reference) => ({ reference }));
const joinReferences = (items: Array<Record<string, unknown>>) => items
  .map((item) => String(item.reference || item.number || '')).filter(Boolean).join(', ');

export default function VnCustomsHandoffPanel({
  shipmentId,
  bundle,
  onChanged
}: {
  shipmentId: string;
  bundle: ShipmentExportBundle;
  onChanged: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<VnCustomsProfile>(() => bundle.vnCustomsProfile || emptyVnCustomsProfile());
  const [permitRefs, setPermitRefs] = useState(() => joinReferences(profile.permitReferences));
  const [inspectionRefs, setInspectionRefs] = useState(() => joinReferences(profile.inspectionReferences));
  const [reconciliation, setReconciliation] = useState<VnCustomsReconciliation | null>(null);
  const [busy, setBusy] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceKind, setEvidenceKind] = useState<'customs_broker_response' | 'customs_authority_response' | 'customs_declaration'>('customs_broker_response');
  const [event, setEvent] = useState({
    eventType: 'broker_received' as VnCustomsEventType,
    exportDocumentId: '', evidenceDocumentId: '', externalReference: '', actorName: '',
    actorIdentifier: '', messageCode: '', messageText: '', occurredAt: ''
  });

  const issuedHandoffs = useMemo(
    () => bundle.documents.filter((item) => item.type === 'vn_customs_handoff' && item.status === 'issued'),
    [bundle.documents]
  );
  const eligibleEvidence = useMemo(
    () => bundle.vnCustomsEvidence.filter((item) => ['locked', 'third_party_verified'].includes(item.status)),
    [bundle.vnCustomsEvidence]
  );
  const currentExternalState = bundle.vnCustomsEvents[0]?.eventType || 'Chưa có phản hồi bên ngoài';

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await action();
      toast.success(success);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Thao tác R04 thất bại.');
    } finally { setBusy(''); }
  };

  const save = () => run('save', () => saveVnCustomsProfile(shipmentId, {
    ...profile,
    destinationCountryCode: profile.destinationCountryCode || bundle.shipment.destinationCountry,
    declarant: {
      ...profile.declarant,
      name: profile.declarant.name || bundle.profile?.exporter.name,
      taxId: profile.declarant.taxId || bundle.profile?.exporterTaxId,
      address: profile.declarant.address || bundle.profile?.exporter.address
    },
    permitReferences: splitReferences(permitRefs),
    inspectionReferences: splitReferences(inspectionRefs),
    supportingDocuments: [
      { type: 'commercial_invoice', reference: bundle.profile?.invoiceNumber || '' },
      { type: 'packing_list', reference: bundle.profile?.packingListNumber || '' },
      ...(bundle.profile?.preferentialOriginClaim
        ? [{ type: 'origin_support', reference: bundle.profile.customsDeclarationNo || 'linked_in_dossier' }]
        : [])
    ]
  }), 'Đã lưu cấu hình handoff hải quan Việt Nam.');

  const reconcile = async () => {
    setBusy('reconcile');
    try { setReconciliation(await fetchVnCustomsReconciliation(shipmentId)); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Không đối soát được R04.'); }
    finally { setBusy(''); }
  };

  return (
    <Card className="border-sky-200">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span>5. R04 — Dữ liệu bàn giao broker/VNACCS</span>
          <Badge variant="outline">{currentExternalState}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p><b>Không phải tờ khai hoặc thông điệp VNACCS.</b> File chỉ là bộ dữ liệu có kiểm soát để broker ánh xạ vào schema đã thống nhất. Trạng thái hải quan chỉ được ghi từ phản hồi ngoài hệ thống có file bằng chứng đã khóa.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1"><Label>Tên người khai</Label><Input value={profile.declarant.name || ''} onChange={(e) => setProfile((p) => ({ ...p, declarant: { ...p.declarant, name: e.target.value } }))} /></div>
          <div className="space-y-1"><Label>MST người khai</Label><Input value={profile.declarant.taxId || ''} onChange={(e) => setProfile((p) => ({ ...p, declarant: { ...p.declarant, taxId: e.target.value } }))} /></div>
          <div className="space-y-1"><Label>Địa chỉ người khai</Label><Input value={profile.declarant.address || ''} onChange={(e) => setProfile((p) => ({ ...p, declarant: { ...p.declarant, address: e.target.value } }))} /></div>
          <div className="space-y-1"><Label>Vai trò người khai</Label><Select value={profile.declarant.role || 'exporter'} onValueChange={(role: 'exporter' | 'customs_broker') => setProfile((p) => ({ ...p, declarant: { ...p.declarant, role } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="exporter">Doanh nghiệp xuất khẩu</SelectItem><SelectItem value="customs_broker">Đại lý hải quan</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label>Tên broker/đại lý</Label><Input value={profile.customsBroker.name || ''} onChange={(e) => setProfile((p) => ({ ...p, customsBroker: { ...p.customsBroker, name: e.target.value } }))} /></div>
          <div className="space-y-1"><Label>MST/mã broker</Label><Input value={profile.customsBroker.taxId || profile.customsBroker.code || ''} onChange={(e) => setProfile((p) => ({ ...p, customsBroker: { ...p.customsBroker, taxId: e.target.value } }))} /></div>
          <div className="space-y-1"><Label>Schema đích broker</Label><Input placeholder="Ví dụ mã schema do broker cung cấp" value={profile.brokerTargetSchemaId} onChange={(e) => setProfile((p) => ({ ...p, brokerTargetSchemaId: e.target.value }))} /></div>
          <div className="space-y-1"><Label>Phiên bản schema broker</Label><Input value={profile.brokerTargetSchemaVersion} onChange={(e) => setProfile((p) => ({ ...p, brokerTargetSchemaVersion: e.target.value }))} /></div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {([
            ['customsOfficeCode', 'Mã cơ quan hải quan'], ['declarationTypeCode', 'Mã loại hình'],
            ['cargoClassificationCode', 'Mã phân loại hàng hóa'], ['transportMethodCode', 'Mã phương thức vận chuyển'],
            ['exitCustomsOfficeCode', 'Mã HQ cửa khẩu xuất'], ['loadingLocationCode', 'Mã địa điểm xếp hàng'],
            ['destinationCountryCode', 'Nước đến (ISO 2)'], ['invoiceClassificationCode', 'Mã phân loại hóa đơn'],
            ['invoicePaymentMethodCode', 'Mã phương thức thanh toán']
          ] as Array<[keyof VnCustomsProfile, string]>).map(([key, label]) => <div key={key} className="space-y-1"><Label>{label}</Label><Input value={String(profile[key] ?? '')} onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value.toUpperCase() }))} /></div>)}
          <div className="space-y-1"><Label>Tỷ giá khai báo</Label><Input type="number" min="0" value={profile.exchangeRate ?? ''} onChange={(e) => setProfile((p) => ({ ...p, exchangeRate: e.target.value === '' ? null : Number(e.target.value) }))} /></div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2 rounded border p-3"><Label>Giấy phép</Label><Select value={profile.permitRequirementStatus} onValueChange={(value: VnCustomsProfile['permitRequirementStatus']) => setProfile((p) => ({ ...p, permitRequirementStatus: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Chưa xác định</SelectItem><SelectItem value="not_required">Không yêu cầu</SelectItem><SelectItem value="required">Có yêu cầu</SelectItem></SelectContent></Select><Input placeholder="Số giấy phép, cách nhau bằng dấu phẩy" value={permitRefs} onChange={(e) => setPermitRefs(e.target.value)} /></div>
          <div className="space-y-2 rounded border p-3"><Label>Kiểm tra chuyên ngành</Label><Select value={profile.inspectionRequirementStatus} onValueChange={(value: VnCustomsProfile['inspectionRequirementStatus']) => setProfile((p) => ({ ...p, inspectionRequirementStatus: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Chưa xác định</SelectItem><SelectItem value="not_required">Không yêu cầu</SelectItem><SelectItem value="required">Có yêu cầu</SelectItem></SelectContent></Select><Input placeholder="Số chứng từ kiểm tra" value={inspectionRefs} onChange={(e) => setInspectionRefs(e.target.value)} /></div>
          <div className="space-y-2 rounded border p-3"><Label>Xử lý thuế xuất khẩu</Label><Select value={profile.taxTreatment} onValueChange={(value: VnCustomsProfile['taxTreatment']) => setProfile((p) => ({ ...p, taxTreatment: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Chưa xác định</SelectItem><SelectItem value="not_subject">Không thuộc đối tượng</SelectItem><SelectItem value="exempt">Miễn thuế</SelectItem><SelectItem value="taxable">Chịu thuế</SelectItem></SelectContent></Select><Input placeholder="Cơ sở xác định thuế" value={profile.taxBasis} onChange={(e) => setProfile((p) => ({ ...p, taxBasis: e.target.value }))} />{profile.taxTreatment === 'taxable' && <div className="grid grid-cols-2 gap-2"><Input type="number" placeholder="Thuế suất %" value={profile.exportDutyRate ?? ''} onChange={(e) => setProfile((p) => ({ ...p, exportDutyRate: e.target.value === '' ? null : Number(e.target.value) }))} /><Input type="number" placeholder="Tiền thuế" value={profile.exportDutyAmount ?? ''} onChange={(e) => setProfile((p) => ({ ...p, exportDutyAmount: e.target.value === '' ? null : Number(e.target.value) }))} /></div>}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void save()} disabled={Boolean(busy)}><Save className="mr-2 h-4 w-4" />Lưu R04</Button>
          <Button variant="outline" onClick={() => void reconcile()} disabled={Boolean(busy)}>Đối soát R01/R02/R03</Button>
        </div>
        {reconciliation && <div className={`rounded border p-3 text-xs ${reconciliation.status === 'passed' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
          <p className="flex items-center gap-2 font-medium">{reconciliation.status === 'passed' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{reconciliation.status} · {reconciliation.rulesetVersion}</p>
          {reconciliation.checks.filter((item) => item.status !== 'ready').slice(0, 8).map((item) => <p key={item.code}>• {item.message}</p>)}
        </div>}

        <div className="space-y-3 rounded border p-3">
          <b className="text-sm">Bằng chứng phản hồi broker/hải quan</b>
          <div className="grid gap-2 md:grid-cols-[220px_1fr_auto]">
            <Select value={evidenceKind} onValueChange={(value: typeof evidenceKind) => setEvidenceKind(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="customs_broker_response">Phản hồi broker</SelectItem><SelectItem value="customs_authority_response">Phản hồi hải quan</SelectItem><SelectItem value="customs_declaration">Tờ khai/chứng từ ngoài hệ thống</SelectItem></SelectContent></Select>
            <Input type="file" accept=".pdf,.json,.csv,.xlsx,.xls,.png,.jpg,.jpeg" onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)} />
            <Button variant="outline" disabled={!evidenceFile || Boolean(busy)} onClick={() => void run('upload', async () => { await uploadVnCustomsEvidence(shipmentId, evidenceFile!, evidenceKind); setEvidenceFile(null); }, 'Đã tải bằng chứng; cần khóa trước khi ghi sự kiện.')}><FileUp className="mr-2 h-4 w-4" />Tải lên</Button>
          </div>
          {bundle.vnCustomsEvidence.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-xs"><span>{item.name} · {item.status} · {item.checksumSha256?.slice(0, 12) || 'chưa có hash'}…</span>{!['locked', 'third_party_verified'].includes(item.status) && <Button size="sm" variant="outline" onClick={() => void run(`lock-${item.id}`, () => lockVnCustomsEvidence(item.id), 'Đã khóa bằng chứng đúng checksum.')} disabled={Boolean(busy)}><LockKeyhole className="mr-1 h-3 w-3" />Khóa bằng chứng</Button>}</div>)}
        </div>

        <div className="space-y-3 rounded border p-3">
          <b className="text-sm">Ghi phản hồi bên ngoài vào lịch sử bất biến</b>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            <Select value={event.eventType} onValueChange={(eventType: VnCustomsEventType) => setEvent((p) => ({ ...p, eventType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(eventLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
            <Select value={event.exportDocumentId} onValueChange={(exportDocumentId) => setEvent((p) => ({ ...p, exportDocumentId }))}><SelectTrigger><SelectValue placeholder="Chọn handoff đã phát hành" /></SelectTrigger><SelectContent>{issuedHandoffs.map((item) => <SelectItem key={item.id} value={item.id}>v{item.version} · {item.fileSha256?.slice(0, 10)}…</SelectItem>)}</SelectContent></Select>
            <Select value={event.evidenceDocumentId} onValueChange={(evidenceDocumentId) => setEvent((p) => ({ ...p, evidenceDocumentId }))}><SelectTrigger><SelectValue placeholder="Chọn bằng chứng đã khóa" /></SelectTrigger><SelectContent>{eligibleEvidence.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
            <Input type="datetime-local" value={event.occurredAt} onChange={(e) => setEvent((p) => ({ ...p, occurredAt: e.target.value }))} />
            <Input placeholder="Số tham chiếu ngoài hệ thống" value={event.externalReference} onChange={(e) => setEvent((p) => ({ ...p, externalReference: e.target.value }))} />
            <Input placeholder="Tên broker/cán bộ/cơ quan phát thông báo" value={event.actorName} onChange={(e) => setEvent((p) => ({ ...p, actorName: e.target.value }))} />
            <Input placeholder="Mã actor/cơ quan (nếu có)" value={event.actorIdentifier} onChange={(e) => setEvent((p) => ({ ...p, actorIdentifier: e.target.value }))} />
            <Input placeholder="Mã thông điệp" value={event.messageCode} onChange={(e) => setEvent((p) => ({ ...p, messageCode: e.target.value }))} />
            <Input className="lg:col-span-3" placeholder="Nội dung phản hồi" value={event.messageText} onChange={(e) => setEvent((p) => ({ ...p, messageText: e.target.value }))} />
            <Button disabled={Boolean(busy) || !event.exportDocumentId || !event.evidenceDocumentId || !event.externalReference || !event.actorName || !event.occurredAt} onClick={() => void run('event', () => recordVnCustomsEvent(shipmentId, { ...event, occurredAt: new Date(event.occurredAt).toISOString() }), 'Đã ghi sự kiện ngoài hệ thống kèm bằng chứng bất biến.')}>Ghi sự kiện</Button>
          </div>
          {bundle.vnCustomsEvents.map((item) => <div key={item.id} className="rounded border p-2 text-xs"><b>{eventLabels[item.eventType]}</b> · {item.externalReference} · {item.actorName} · {new Date(item.occurredAt).toLocaleString('vi-VN')}<p className="text-slate-500">Evidence SHA-256: {item.evidenceSha256}</p></div>)}
        </div>
      </CardContent>
    </Card>
  );
}
