'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, LockKeyhole, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  emptyIcs2Profile,
  fetchIcs2Reconciliation,
  lockIcs2Evidence,
  recordIcs2Event,
  saveIcs2Profile,
  uploadIcs2Evidence,
  type Ics2EventType,
  type Ics2HouseConsignment,
  type Ics2Party,
  type Ics2Profile,
  type Ics2Reconciliation,
  type ShipmentExportBundle
} from '@/lib/weave-v2/shipmentExportApi';

const datasetsByMode: Record<Ics2Profile['transportMode'], string[]> = {
  sea: ['F10', 'F11', 'F12', 'F13', 'F14', 'F15', 'F16', 'F45'],
  inland_waterway: ['F10', 'F11', 'F12', 'F13', 'F14', 'F15', 'F16', 'F45'],
  air: ['F20', 'F21', 'F22', 'F23', 'F24', 'F25', 'F26', 'F27', 'F28', 'F29', 'F30', 'F31', 'F32', 'F33', 'F42', 'F43', 'F44'],
  road: ['F34', 'F40', 'F50'],
  rail: ['F41', 'F51']
};

const eventLabels: Record<Ics2EventType, string> = {
  filer_received: 'Filer đã nhận', filer_validated: 'Filer đã kiểm tra', filer_rejected: 'Filer từ chối',
  authority_registered: 'ICS2 đăng ký ENS', authority_rejected: 'ICS2 từ chối', risk_referral: 'Yêu cầu bổ sung/risk referral',
  do_not_load: 'Do not load', assessment_complete: 'Hoàn tất đánh giá', amendment_requested: 'Yêu cầu sửa đổi',
  amendment_registered: 'Đã đăng ký sửa đổi', invalidation_requested: 'Yêu cầu hủy', invalidated: 'Đã hủy'
};

const blankHouse = (index: number, bundle: ShipmentExportBundle): Ics2HouseConsignment => ({
  id: `house-${Date.now()}-${index}`, transportDocumentType: '', transportDocumentNumber: '', ucr: '',
  consignor: { ...bundle.profile?.exporter }, consignee: { ...bundle.profile?.importer },
  buyer: { ...bundle.profile?.importer }, seller: { ...bundle.profile?.exporter },
  destinationCountry: bundle.shipment.destinationCountry, placeOfDelivery: bundle.profile?.placeOfDelivery || '',
  grossMassKg: null, packageCount: null, goodsLineIds: [], additionalSupplyChainActors: [], metadata: {}
});

export default function Ics2HandoffPanel({
  shipmentId, bundle, onChanged
}: {
  shipmentId: string;
  bundle: ShipmentExportBundle;
  onChanged: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<Ics2Profile>(() => bundle.ics2Profile || emptyIcs2Profile());
  const [reconciliation, setReconciliation] = useState<Ics2Reconciliation | null>(null);
  const [busy, setBusy] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceKind, setEvidenceKind] = useState<'ics2_filer_response' | 'ics2_customs_response' | 'ics2_ens_declaration'>('ics2_filer_response');
  const [event, setEvent] = useState({
    eventType: 'filer_received' as Ics2EventType, exportDocumentId: '', evidenceDocumentId: '',
    externalReference: '', actorName: '', actorIdentifier: '', messageCode: '', messageText: '', occurredAt: ''
  });

  const issuedHandoffs = useMemo(() => bundle.documents.filter(
    (item) => item.type === 'ics2_dataset' && item.status === 'issued'
  ), [bundle.documents]);
  const eligibleEvidence = useMemo(() => bundle.ics2Evidence.filter(
    (item) => ['locked', 'third_party_verified'].includes(item.status)
  ), [bundle.ics2Evidence]);

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await action();
      toast.success(success);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Thao tác R06 thất bại.');
    } finally { setBusy(''); }
  };

  const setParty = (key: 'sender' | 'declarant' | 'representative', field: keyof Ics2Party, value: string) =>
    setProfile((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
  const updateHouse = (index: number, patch: Partial<Ics2HouseConsignment>) => setProfile((current) => ({
    ...current,
    houseConsignments: current.houseConsignments.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)
  }));
  const setHouseParty = (index: number, key: 'consignor' | 'consignee', field: keyof Ics2Party, value: string) => {
    const house = profile.houseConsignments[index];
    updateHouse(index, { [key]: { ...house[key], [field]: value } });
  };
  const toggleLine = (index: number, lineId: string) => {
    const current = profile.houseConsignments[index].goodsLineIds;
    updateHouse(index, { goodsLineIds: current.includes(lineId) ? current.filter((id) => id !== lineId) : [...current, lineId] });
  };

  const save = () => run('save', () => saveIcs2Profile(shipmentId, {
    ...profile,
    firstEntryCountry: profile.firstEntryCountry || bundle.shipment.destinationCountry,
    masterTransportDocument: {
      ...profile.masterTransportDocument,
      number: profile.masterTransportDocument.number || bundle.profile?.billOfLadingNo || ''
    },
    seals: profile.seals.length ? profile.seals : bundle.containers.map((item) => item.sealNumber).filter(Boolean)
  }), 'Đã lưu hồ sơ bàn giao ICS2 R06.');

  const reconcile = async () => {
    setBusy('reconcile');
    try { setReconciliation(await fetchIcs2Reconciliation(shipmentId)); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Không đối soát được R06.'); }
    finally { setBusy(''); }
  };

  return <Card>
    <CardHeader>
      <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
        <span>7. R06 — ICS2/ENS filing handoff</span>
        <Badge variant="outline">{profile.ics2Release} · {profile.messageDatasetCode || 'chưa chọn dataset'}</Badge>
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertTriangle className="mr-2 inline h-4 w-4" />Đây là dữ liệu bàn giao cho carrier/filer/ITSP, không phải ENS XML,
        không gửi vào ICS2 và không tạo MRN. Schema đích và technical package phải do filer xác nhận.
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div><Label>Phương thức vào EU</Label><Select value={profile.transportMode} onValueChange={(transportMode: Ics2Profile['transportMode']) => setProfile((p) => ({ ...p, transportMode, messageDatasetCode: datasetsByMode[transportMode][0] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sea">Đường biển</SelectItem><SelectItem value="inland_waterway">Đường thủy nội địa</SelectItem><SelectItem value="air">Hàng không</SelectItem><SelectItem value="road">Đường bộ</SelectItem><SelectItem value="rail">Đường sắt</SelectItem></SelectContent></Select></div>
        <div><Label>Annex B dataset</Label><Select value={profile.messageDatasetCode} onValueChange={(messageDatasetCode) => setProfile((p) => ({ ...p, messageDatasetCode }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{datasetsByMode[profile.transportMode].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Vai trò filing</Label><Select value={profile.filingRole} onValueChange={(filingRole: Ics2Profile['filingRole']) => setProfile((p) => ({ ...p, filingRole }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="carrier">Carrier</SelectItem><SelectItem value="house_level_filer">House-level filer</SelectItem><SelectItem value="express_carrier">Express carrier</SelectItem><SelectItem value="postal_operator">Postal operator</SelectItem><SelectItem value="representative">Đại diện</SelectItem></SelectContent></Select></div>
        <div><Label>Cách filing</Label><Select value={profile.filingArrangement} onValueChange={(filingArrangement: Ics2Profile['filingArrangement']) => setProfile((p) => ({ ...p, filingArrangement }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="single">Single filing</SelectItem><SelectItem value="multiple">Multiple filing</SelectItem></SelectContent></Select></div>
        <div><Label>LRN duy nhất</Label><Input value={profile.localReferenceNumber} onChange={(e) => setProfile((p) => ({ ...p, localReferenceNumber: e.target.value }))} /></div>
        <div><Label>Customs office first entry</Label><Input value={profile.customsOfficeFirstEntry} onChange={(e) => setProfile((p) => ({ ...p, customsOfficeFirstEntry: e.target.value }))} /></div>
        <div><Label>Nước vào EU đầu tiên</Label><Input value={profile.firstEntryCountry} onChange={(e) => setProfile((p) => ({ ...p, firstEntryCountry: e.target.value.toUpperCase() }))} /></div>
        <div><Label>ETA có timezone</Label><Input type="datetime-local" value={profile.estimatedArrivalAt.replace(/Z$/, '')} onChange={(e) => setProfile((p) => ({ ...p, estimatedArrivalAt: e.target.value ? new Date(e.target.value).toISOString() : '' }))} /></div>
        <div><Label>Itinerary ISO2, cách nhau dấu phẩy</Label><Input value={profile.itineraryCountries.join(', ')} onChange={(e) => setProfile((p) => ({ ...p, itineraryCountries: e.target.value.split(',').map((v) => v.trim().toUpperCase()).filter(Boolean) }))} /></div>
        <div><Label>Conveyance reference</Label><Input value={profile.conveyanceReference} onChange={(e) => setProfile((p) => ({ ...p, conveyanceReference: e.target.value }))} /></div>
        <div><Label>Master document type</Label><Input value={profile.masterTransportDocument.type} onChange={(e) => setProfile((p) => ({ ...p, masterTransportDocument: { ...p.masterTransportDocument, type: e.target.value.toUpperCase() } }))} /></div>
        <div><Label>Master document number</Label><Input value={profile.masterTransportDocument.number} onChange={(e) => setProfile((p) => ({ ...p, masterTransportDocument: { ...p.masterTransportDocument, number: e.target.value } }))} /></div>
        <div><Label>Loại nhận diện phương tiện</Label><Input value={profile.activeBorderTransportMeans.identificationType} onChange={(e) => setProfile((p) => ({ ...p, activeBorderTransportMeans: { ...p.activeBorderTransportMeans, identificationType: e.target.value.toUpperCase() } }))} /></div>
        <div><Label>Số nhận diện phương tiện</Label><Input value={profile.activeBorderTransportMeans.identificationNumber} onChange={(e) => setProfile((p) => ({ ...p, activeBorderTransportMeans: { ...p.activeBorderTransportMeans, identificationNumber: e.target.value } }))} /></div>
        <div><Label>Quốc tịch phương tiện</Label><Input value={profile.activeBorderTransportMeans.nationality} onChange={(e) => setProfile((p) => ({ ...p, activeBorderTransportMeans: { ...p.activeBorderTransportMeans, nationality: e.target.value.toUpperCase() } }))} /></div>
        <div><Label>Seals, cách nhau dấu phẩy</Label><Input value={profile.seals.join(', ')} onChange={(e) => setProfile((p) => ({ ...p, seals: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) }))} /></div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {(['sender', 'declarant', 'representative'] as const).map((key) => <div key={key} className="space-y-2 rounded border p-3"><b className="text-sm capitalize">{key}</b>{(['name', 'address', 'eori', 'email', 'phone'] as const).map((field) => <Input key={field} placeholder={field} value={String(profile[key][field] || '')} onChange={(e) => setParty(key, field, e.target.value)} />)}</div>)}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div><Label>Schema đích của filer/ITSP</Label><Input value={profile.targetSystemSchemaId} onChange={(e) => setProfile((p) => ({ ...p, targetSystemSchemaId: e.target.value }))} /></div>
        <div><Label>Phiên bản schema đích</Label><Input value={profile.targetSystemSchemaVersion} onChange={(e) => setProfile((p) => ({ ...p, targetSystemSchemaVersion: e.target.value }))} /></div>
        <div><Label>ICS2 technical package ID</Label><Input value={profile.technicalPackageId} onChange={(e) => setProfile((p) => ({ ...p, technicalPackageId: e.target.value }))} /></div>
        <div><Label>Technical package version</Label><Input value={profile.technicalPackageVersion} onChange={(e) => setProfile((p) => ({ ...p, technicalPackageVersion: e.target.value }))} /></div>
      </div>

      <div className="space-y-3 rounded border p-3">
        <div className="flex items-center justify-between"><b className="text-sm">Lowest-level house consignments</b><Button size="sm" variant="outline" onClick={() => setProfile((p) => ({ ...p, houseConsignments: [...p.houseConsignments, blankHouse(p.houseConsignments.length, bundle)] }))}><Plus className="mr-1 h-3 w-3" />Thêm house</Button></div>
        {profile.houseConsignments.map((house, index) => <div key={house.id} className="space-y-3 rounded border p-3">
          <div className="flex justify-between"><b>House {index + 1}</b><Button size="sm" variant="ghost" onClick={() => setProfile((p) => ({ ...p, houseConsignments: p.houseConsignments.filter((_, i) => i !== index) }))}><Trash2 className="h-4 w-4" /></Button></div>
          <div className="grid gap-2 md:grid-cols-3"><Input placeholder="House document type" value={house.transportDocumentType} onChange={(e) => updateHouse(index, { transportDocumentType: e.target.value.toUpperCase() })} /><Input placeholder="House document number" value={house.transportDocumentNumber} onChange={(e) => updateHouse(index, { transportDocumentNumber: e.target.value })} /><Input placeholder="UCR" value={house.ucr} onChange={(e) => updateHouse(index, { ucr: e.target.value })} /><Input placeholder="Destination ISO2" value={house.destinationCountry} onChange={(e) => updateHouse(index, { destinationCountry: e.target.value.toUpperCase() })} /><Input placeholder="Place of delivery" value={house.placeOfDelivery} onChange={(e) => updateHouse(index, { placeOfDelivery: e.target.value })} /><Input type="number" placeholder="Gross kg" value={house.grossMassKg ?? ''} onChange={(e) => updateHouse(index, { grossMassKg: e.target.value === '' ? null : Number(e.target.value) })} /><Input type="number" placeholder="Package count" value={house.packageCount ?? ''} onChange={(e) => updateHouse(index, { packageCount: e.target.value === '' ? null : Number(e.target.value) })} /></div>
          <div className="grid gap-2 md:grid-cols-2"><div className="space-y-2"><b className="text-xs">Consignor</b>{(['name', 'address', 'country'] as const).map((field) => <Input key={field} placeholder={field} value={String(house.consignor[field] || '')} onChange={(e) => setHouseParty(index, 'consignor', field, e.target.value)} />)}</div><div className="space-y-2"><b className="text-xs">Consignee</b>{(['name', 'address', 'country'] as const).map((field) => <Input key={field} placeholder={field} value={String(house.consignee[field] || '')} onChange={(e) => setHouseParty(index, 'consignee', field, e.target.value)} />)}</div></div>
          <div className="flex flex-wrap gap-2">{bundle.lines.map((line) => <Button key={line.id} size="sm" variant={house.goodsLineIds.includes(line.id) ? 'default' : 'outline'} onClick={() => toggleLine(index, line.id)}>#{line.lineNumber} {line.sku}</Button>)}</div>
        </div>)}
      </div>

      <div className="flex flex-wrap gap-2"><Button disabled={Boolean(busy)} onClick={() => void save()}><Save className="mr-2 h-4 w-4" />Lưu R06</Button><Button variant="outline" disabled={Boolean(busy)} onClick={() => void reconcile()}><ShieldCheck className="mr-2 h-4 w-4" />Đối soát</Button></div>
      {reconciliation && <div className="rounded border p-3 text-sm"><div className="flex items-center gap-2">{reconciliation.status === 'ready' ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}<b>{reconciliation.status}</b><span>{reconciliation.sourceSnapshotSha256.slice(0, 16)}…</span></div>{reconciliation.checks.filter((item) => item.status !== 'ready').slice(0, 12).map((item) => <p key={item.code} className="text-xs text-red-700">• {item.message}</p>)}</div>}

      <div className="space-y-3 rounded border p-3"><b className="text-sm">Bằng chứng filer/ICS2</b><div className="grid gap-2 md:grid-cols-[240px_1fr_auto]"><Select value={evidenceKind} onValueChange={(value: typeof evidenceKind) => setEvidenceKind(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ics2_filer_response">Phản hồi filer/ITSP</SelectItem><SelectItem value="ics2_customs_response">Phản hồi ICS2</SelectItem><SelectItem value="ics2_ens_declaration">ENS/MRN bên ngoài</SelectItem></SelectContent></Select><Input type="file" accept=".pdf,.json,.xml,.csv,.xlsx,.xls,.png,.jpg,.jpeg" onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)} /><Button variant="outline" disabled={!evidenceFile || Boolean(busy)} onClick={() => void run('upload', () => uploadIcs2Evidence(shipmentId, evidenceFile!, evidenceKind), 'Đã tải bằng chứng; cần khóa trước khi ghi sự kiện.')}><FileUp className="mr-2 h-4 w-4" />Tải lên</Button></div>{bundle.ics2Evidence.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded border p-2 text-xs"><span>{item.name} · {item.status} · {item.checksumSha256?.slice(0, 12) || 'chưa có hash'}…</span>{!['locked', 'third_party_verified'].includes(item.status) && <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void run(`lock-${item.id}`, () => lockIcs2Evidence(item.id), 'Đã khóa bằng chứng đúng checksum.')}><LockKeyhole className="mr-1 h-3 w-3" />Khóa</Button>}</div>)}</div>

      <div className="space-y-3 rounded border p-3"><b className="text-sm">Sự kiện ngoài hệ thống, append-only</b><div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4"><Select value={event.eventType} onValueChange={(eventType: Ics2EventType) => setEvent((p) => ({ ...p, eventType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(eventLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Select value={event.exportDocumentId} onValueChange={(exportDocumentId) => setEvent((p) => ({ ...p, exportDocumentId }))}><SelectTrigger><SelectValue placeholder="Chọn R06 đã phát hành" /></SelectTrigger><SelectContent>{issuedHandoffs.map((item) => <SelectItem key={item.id} value={item.id}>v{item.version} · {item.fileSha256?.slice(0, 10)}…</SelectItem>)}</SelectContent></Select><Select value={event.evidenceDocumentId} onValueChange={(evidenceDocumentId) => setEvent((p) => ({ ...p, evidenceDocumentId }))}><SelectTrigger><SelectValue placeholder="Bằng chứng đã khóa" /></SelectTrigger><SelectContent>{eligibleEvidence.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Input type="datetime-local" value={event.occurredAt} onChange={(e) => setEvent((p) => ({ ...p, occurredAt: e.target.value }))} /><Input placeholder="MRN/tham chiếu ngoài hệ thống" value={event.externalReference} onChange={(e) => setEvent((p) => ({ ...p, externalReference: e.target.value }))} /><Input placeholder="Filer/cơ quan phát thông báo" value={event.actorName} onChange={(e) => setEvent((p) => ({ ...p, actorName: e.target.value }))} /><Input placeholder="Mã thông điệp" value={event.messageCode} onChange={(e) => setEvent((p) => ({ ...p, messageCode: e.target.value }))} /><Button disabled={Boolean(busy) || !event.exportDocumentId || !event.evidenceDocumentId || !event.externalReference || !event.actorName || !event.occurredAt} onClick={() => void run('event', () => recordIcs2Event(shipmentId, { ...event, occurredAt: new Date(event.occurredAt).toISOString() }), 'Đã ghi sự kiện ICS2 ngoài hệ thống theo checksum.')}>Ghi sự kiện</Button></div>{bundle.ics2Events.map((item) => <div key={item.id} className="rounded border p-2 text-xs"><b>{eventLabels[item.eventType]}</b> · {item.externalReference} · {item.actorName} · {new Date(item.occurredAt).toLocaleString('vi-VN')}<p className="text-slate-500">Evidence SHA-256: {item.evidenceSha256}</p></div>)}</div>
    </CardContent>
  </Card>;
}
