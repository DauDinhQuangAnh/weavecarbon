'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSearch, Save, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  confirmCarrierDocument,
  createCarrierDocumentMetadata,
  deleteCarrierDocumentMetadata,
  fetchCarrierDocumentReconciliation,
  updateCarrierDocumentMetadata,
  uploadCarrierDocument,
  type CarrierDocumentMetadata,
  type CarrierDocumentReconciliation,
  type CarrierDocumentType,
  type CarrierEvidenceDocument,
  type CarrierTransportMode,
  type ShipmentExportBundle
} from '@/lib/weave-v2/shipmentExportApi';

const DOCUMENT_TYPES: Array<{ value: CarrierDocumentType; label: string; mode: CarrierTransportMode }> = [
  { value: 'bill_of_lading', label: 'Ocean Bill of Lading', mode: 'sea' },
  { value: 'fbl', label: 'FIATA Multimodal FBL', mode: 'multimodal' },
  { value: 'air_waybill', label: 'Air Waybill (AWB)', mode: 'air' },
  { value: 'cmr', label: 'CMR đường bộ', mode: 'road' },
  { value: 'cim', label: 'CIM đường sắt', mode: 'rail' }
];

const csv = (values: string[]) => values.join(', ');
const parseCsv = (value: string) => [...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))];
const factor = (pkg: ShipmentExportBundle['packages'][number], field: 'weight' | 'dimension') =>
  (field === 'weight' ? pkg.weightMeasurementBasis : pkg.dimensionMeasurementBasis) === 'group_total' ? 1 : Number(pkg.quantity || 1);

function defaultMetadata(bundle: ShipmentExportBundle, evidence: CarrierEvidenceDocument, type: CarrierDocumentType): CarrierDocumentMetadata {
  const profile = bundle.profile;
  const leaf = bundle.packages.filter((pkg) => pkg.packageType.toLowerCase() !== 'pallet');
  const transportMode = DOCUMENT_TYPES.find((item) => item.value === type)?.mode || 'sea';
  return {
    evidenceDocumentId: evidence.id,
    documentType: type,
    contractLevel: 'direct',
    transportMode,
    documentNumber: profile?.billOfLadingNo || '',
    issuerName: profile?.carrierName || '',
    issuerIdentifier: '', issueDate: null, issuePlace: '', onBoardDate: null,
    shipper: { ...(profile?.exporter || {}) }, consignee: { ...(profile?.consignee || {}) },
    notifyParty: { ...(profile?.notifyParty || {}) },
    vesselName: profile?.vesselName || '', voyageNumber: profile?.voyageNumber || '',
    flightNumber: '', vehicleRegistration: '', trainNumber: '',
    placeOfReceipt: profile?.portOfLoading || '', placeOfLoading: profile?.portOfLoading || '',
    placeOfDischarge: profile?.portOfDischarge || '', placeOfDelivery: profile?.placeOfDelivery || '',
    goodsDescription: bundle.lines.map((line) => line.goodsDescription).filter(Boolean).join('; '),
    packageCount: leaf.reduce((sum, pkg) => sum + Number(pkg.quantity || 0), 0) || null,
    packageType: [...new Set(leaf.map((pkg) => pkg.packageType).filter(Boolean))].join(', '),
    marksAndNumbers: [...new Set(leaf.map((pkg) => pkg.marksAndNumbers).filter(Boolean))].join('; '),
    grossWeightKg: leaf.reduce((sum, pkg) => sum + Number(pkg.grossWeightKg || 0) * factor(pkg, 'weight'), 0) || null,
    measurementCbm: leaf.reduce((sum, pkg) => sum + Number(pkg.lengthCm || 0) * Number(pkg.widthCm || 0)
      * Number(pkg.heightCm || 0) * factor(pkg, 'dimension') / 1_000_000, 0),
    containerNumbers: bundle.containers.map((item) => item.containerNumber),
    sealNumbers: bundle.containers.map((item) => item.sealNumber),
    freightTerms: '', paymentTerms: profile?.paymentTerms || '',
    authenticationMethod: '', authenticationReference: '', authenticityStatus: 'unverified',
    originalStatus: 'unknown', negotiable: null, metadataSource: 'manual', metadata: {}, supersedesId: null
  };
}

export default function CarrierDocumentPanel({
  shipmentId,
  bundle,
  onChanged
}: {
  shipmentId: string;
  bundle: ShipmentExportBundle;
  onChanged: () => Promise<void>;
}) {
  const [uploadType, setUploadType] = useState<CarrierDocumentType>('bill_of_lading');
  const [file, setFile] = useState<File | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('');
  const [draft, setDraft] = useState<CarrierDocumentMetadata | null>(null);
  const [reconciliation, setReconciliation] = useState<CarrierDocumentReconciliation | null>(null);
  const [confirmationNote, setConfirmationNote] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);

  const selectedEvidence = bundle.carrierDocuments.find((item) => item.id === selectedEvidenceId) || null;
  const activeDocuments = useMemo(() => bundle.carrierDocuments.filter((item) => item.structured?.status === 'confirmed'), [bundle]);
  const immutable = draft?.status !== undefined && draft.status !== 'draft';

  const choose = (evidence: CarrierEvidenceDocument, fallbackType?: CarrierDocumentType) => {
    const type = fallbackType || evidence.structured?.documentType ||
      (DOCUMENT_TYPES.some((item) => item.value === evidence.type) ? evidence.type as CarrierDocumentType : 'bill_of_lading');
    setSelectedEvidenceId(evidence.id);
    setDraft(evidence.structured ? { ...evidence.structured, evidenceDocumentId: evidence.id } : defaultMetadata(bundle, evidence, type));
    setReconciliation(null);
    setConfirmationNote(evidence.structured?.confirmationNote || 'Đã đối chiếu metadata với file carrier nguyên bản và hồ sơ lô hàng.');
    setAcknowledged(false);
  };

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Thao tác chứng từ carrier thất bại.');
    } finally { setBusy(false); }
  };

  const save = async () => {
    if (!draft || !selectedEvidence) return;
    const result = selectedEvidence.structured?.id
      ? await updateCarrierDocumentMetadata(shipmentId, selectedEvidence.structured.id, draft)
      : await createCarrierDocumentMetadata(shipmentId, draft);
    choose(result);
  };

  const check = async () => {
    if (!selectedEvidence?.structured?.id) {
      toast.error('Hãy lưu metadata nháp trước khi đối soát.');
      return;
    }
    setBusy(true);
    try { setReconciliation(await fetchCarrierDocumentReconciliation(shipmentId, selectedEvidence.structured.id)); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Không chạy được đối soát.'); }
    finally { setBusy(false); }
  };

  const update = <K extends keyof CarrierDocumentMetadata>(key: K, value: CarrierDocumentMetadata[K]) =>
    setDraft((current) => current ? { ...current, [key]: value } : current);
  const updateParty = (key: 'shipper' | 'consignee' | 'notifyParty', value: string) =>
    setDraft((current) => current ? { ...current, [key]: { ...current[key], name: value } } : current);

  return <Card>
    <CardHeader><CardTitle className="text-base">4. Chứng từ do hãng vận tải phát hành</CardTitle></CardHeader>
    <CardContent className="space-y-4 text-sm">
      <p className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-900">
        WeaveCarbon chỉ lưu file, xác nhận metadata và đối soát. Hệ thống không phát hành hoặc thay thế B/L, FBL, AWB, CMR hay CIM pháp lý.
      </p>
      <div className="grid gap-2 md:grid-cols-[220px_1fr_auto]">
        <Select value={uploadType} onValueChange={(value) => setUploadType(value as CarrierDocumentType)}>
          <SelectTrigger aria-label="Loại chứng từ carrier"><SelectValue /></SelectTrigger>
          <SelectContent>{DOCUMENT_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="file" accept=".pdf,.xlsx,.docx,.png,.jpg,.jpeg" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        <Button disabled={!file || busy} onClick={() => file && void run(async () => {
          const uploaded = await uploadCarrierDocument(shipmentId, file, uploadType);
          const seed = defaultMetadata(bundle, {
            id: uploaded.id!, type: uploadType, name: file.name, status: 'uploaded',
            structured: null, latestReconciliation: null
          }, uploadType);
          const created = await createCarrierDocumentMetadata(shipmentId, seed);
          choose(created);
          setFile(null);
        }, 'Đã upload file và tạo metadata nháp.')}><Upload className="mr-2 h-4 w-4" />Upload</Button>
      </div>

      <div className="space-y-2">
        {bundle.carrierDocuments.map((evidence) => <button type="button" key={evidence.id}
          onClick={() => choose(evidence)}
          className={`flex w-full items-center justify-between gap-3 rounded border p-3 text-left ${selectedEvidenceId === evidence.id ? 'border-emerald-600 bg-emerald-50' : ''}`}>
          <span><b>{evidence.name}</b><br /><span className="text-xs text-slate-500">SHA-256: {evidence.checksumSha256?.slice(0, 16) || 'chưa có'}…</span></span>
          <span className="flex items-center gap-2">
            <Badge variant="outline">{evidence.structured?.documentType || evidence.type}</Badge>
            <Badge variant={evidence.structured?.status === 'confirmed' ? 'default' : 'outline'}>{evidence.structured?.status || 'metadata_missing'}</Badge>
            {evidence.latestReconciliation?.status === 'passed' && <CheckCircle2 className="h-4 w-4 text-emerald-700" />}
          </span>
        </button>)}
        {!bundle.carrierDocuments.length && <p className="text-red-700">Chưa upload chứng từ carrier cho lô hàng.</p>}
      </div>

      {draft && selectedEvidence && <div className="space-y-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <b>Metadata carrier · {selectedEvidence.name}</b>
          <Badge variant={immutable ? 'default' : 'outline'}>{draft.status || 'draft'}{draft.version ? ` · v${draft.version}` : ''}</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Số chứng từ"><Input disabled={immutable} value={draft.documentNumber} onChange={(e) => update('documentNumber', e.target.value)} /></Field>
          <Field label="Đơn vị phát hành"><Input disabled={immutable} value={draft.issuerName} onChange={(e) => update('issuerName', e.target.value)} /></Field>
          <Field label="Mã carrier/forwarder"><Input disabled={immutable} value={draft.issuerIdentifier} onChange={(e) => update('issuerIdentifier', e.target.value)} /></Field>
          <Field label="Ngày phát hành"><Input disabled={immutable} type="date" value={draft.issueDate || ''} onChange={(e) => update('issueDate', e.target.value || null)} /></Field>
          <Field label="Nơi phát hành"><Input disabled={immutable} value={draft.issuePlace} onChange={(e) => update('issuePlace', e.target.value)} /></Field>
          <Field label="Ngày on-board"><Input disabled={immutable} type="date" value={draft.onBoardDate || ''} onChange={(e) => update('onBoardDate', e.target.value || null)} /></Field>
          <Field label="Loại chứng từ"><Select disabled={immutable} value={draft.documentType} onValueChange={(value) => {
            const item = DOCUMENT_TYPES.find((candidate) => candidate.value === value)!;
            setDraft((current) => current ? { ...current, documentType: item.value, transportMode: item.mode } : current);
          }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DOCUMENT_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Cấp hợp đồng"><Select disabled={immutable} value={draft.contractLevel} onValueChange={(value) => update('contractLevel', value as CarrierDocumentMetadata['contractLevel'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="direct">Direct</SelectItem><SelectItem value="master">Master</SelectItem><SelectItem value="house">House</SelectItem></SelectContent></Select></Field>
          <Field label="Phương thức"><Input disabled value={draft.transportMode} /></Field>
          <Field label="Shipper"><Input disabled={immutable} value={draft.shipper.name || ''} onChange={(e) => updateParty('shipper', e.target.value)} /></Field>
          <Field label="Consignee"><Input disabled={immutable} value={draft.consignee.name || ''} onChange={(e) => updateParty('consignee', e.target.value)} /></Field>
          <Field label="Notify party"><Input disabled={immutable} value={draft.notifyParty.name || ''} onChange={(e) => updateParty('notifyParty', e.target.value)} /></Field>
          <Field label="Tên tàu"><Input disabled={immutable} value={draft.vesselName} onChange={(e) => update('vesselName', e.target.value)} /></Field>
          <Field label="Voyage"><Input disabled={immutable} value={draft.voyageNumber} onChange={(e) => update('voyageNumber', e.target.value)} /></Field>
          <Field label="Flight"><Input disabled={immutable} value={draft.flightNumber} onChange={(e) => update('flightNumber', e.target.value)} /></Field>
          <Field label="Biển số xe"><Input disabled={immutable} value={draft.vehicleRegistration} onChange={(e) => update('vehicleRegistration', e.target.value)} /></Field>
          <Field label="Số tàu/chuyến rail"><Input disabled={immutable} value={draft.trainNumber} onChange={(e) => update('trainNumber', e.target.value)} /></Field>
          <Field label="Place of receipt"><Input disabled={immutable} value={draft.placeOfReceipt} onChange={(e) => update('placeOfReceipt', e.target.value)} /></Field>
          <Field label="Nơi/cảng xếp"><Input disabled={immutable} value={draft.placeOfLoading} onChange={(e) => update('placeOfLoading', e.target.value)} /></Field>
          <Field label="Nơi/cảng dỡ"><Input disabled={immutable} value={draft.placeOfDischarge} onChange={(e) => update('placeOfDischarge', e.target.value)} /></Field>
          <Field label="Nơi giao"><Input disabled={immutable} value={draft.placeOfDelivery} onChange={(e) => update('placeOfDelivery', e.target.value)} /></Field>
          <Field label="Số kiện"><Input disabled={immutable} type="number" value={draft.packageCount ?? ''} onChange={(e) => update('packageCount', e.target.value ? Number(e.target.value) : null)} /></Field>
          <Field label="Loại kiện"><Input disabled={immutable} value={draft.packageType} onChange={(e) => update('packageType', e.target.value)} /></Field>
          <Field label="Gross kg"><Input disabled={immutable} type="number" value={draft.grossWeightKg ?? ''} onChange={(e) => update('grossWeightKg', e.target.value ? Number(e.target.value) : null)} /></Field>
          <Field label="Measurement CBM"><Input disabled={immutable} type="number" step="0.001" value={draft.measurementCbm ?? ''} onChange={(e) => update('measurementCbm', e.target.value ? Number(e.target.value) : null)} /></Field>
          <Field label="Container, cách nhau dấu phẩy"><Input disabled={immutable} value={csv(draft.containerNumbers)} onChange={(e) => update('containerNumbers', parseCsv(e.target.value))} /></Field>
          <Field label="Seal, cách nhau dấu phẩy"><Input disabled={immutable} value={csv(draft.sealNumbers)} onChange={(e) => update('sealNumbers', parseCsv(e.target.value))} /></Field>
          <Field label="Freight"><Select disabled={immutable} value={draft.freightTerms || 'unset'} onValueChange={(value) => update('freightTerms', value === 'unset' ? '' : value as CarrierDocumentMetadata['freightTerms'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unset">Chưa chọn</SelectItem><SelectItem value="prepaid">Prepaid</SelectItem><SelectItem value="collect">Collect</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></Field>
          <Field label="Trạng thái bản"><Select disabled={immutable} value={draft.originalStatus} onValueChange={(value) => update('originalStatus', value as CarrierDocumentMetadata['originalStatus'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['original','copy','electronic','sea_waybill','non_negotiable','unknown'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Authenticity"><Select disabled={immutable} value={draft.authenticityStatus} onValueChange={(value) => update('authenticityStatus', value as CarrierDocumentMetadata['authenticityStatus'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unverified">Chưa xác minh</SelectItem><SelectItem value="operator_confirmed">Operator đã kiểm tra</SelectItem><SelectItem value="issuer_verified">Đã xác minh với issuer</SelectItem><SelectItem value="rejected">Bị từ chối</SelectItem></SelectContent></Select></Field>
          <Field label="Cách xác thực"><Input disabled={immutable} value={draft.authenticationMethod} onChange={(e) => update('authenticationMethod', e.target.value)} /></Field>
          <Field label="Tham chiếu chữ ký/xác thực"><Input disabled={immutable} value={draft.authenticationReference} onChange={(e) => update('authenticationReference', e.target.value)} /></Field>
          <Field label="Thay thế phiên bản"><Select disabled={immutable} value={draft.supersedesId || 'none'} onValueChange={(value) => update('supersedesId', value === 'none' ? null : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Không thay thế</SelectItem>{activeDocuments.map((item) => <SelectItem key={item.structured!.id} value={item.structured!.id!}>{item.structured!.documentNumber} · v{item.structured!.version}</SelectItem>)}</SelectContent></Select></Field>
        </div>
        <Field label="Mô tả hàng"><Textarea disabled={immutable} value={draft.goodsDescription} onChange={(e) => update('goodsDescription', e.target.value)} /></Field>
        <Field label="Marks & numbers"><Textarea disabled={immutable} value={draft.marksAndNumbers} onChange={(e) => update('marksAndNumbers', e.target.value)} /></Field>

        {!immutable && <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void run(save, 'Đã lưu metadata nháp.')}><Save className="mr-2 h-4 w-4" />Lưu nháp</Button>
          <Button variant="outline" disabled={busy || !selectedEvidence.structured?.id} onClick={() => void check()}><FileSearch className="mr-2 h-4 w-4" />Kiểm tra đối soát</Button>
          {selectedEvidence.structured?.id && <Button variant="outline" disabled={busy} onClick={() => void run(async () => {
            await deleteCarrierDocumentMetadata(shipmentId, selectedEvidence.structured!.id!);
            setDraft(null); setSelectedEvidenceId('');
          }, 'Đã xóa metadata nháp; file evidence vẫn được giữ lại.')}><Trash2 className="mr-2 h-4 w-4" />Xóa nháp</Button>}
        </div>}

        {reconciliation && <div className={`rounded border p-3 ${reconciliation.status === 'passed' ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
          <p className="flex items-center gap-2 font-medium">{reconciliation.status === 'passed' ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <AlertTriangle className="h-4 w-4 text-red-700" />}Đối soát: {reconciliation.status}</p>
          {reconciliation.checks.filter((item) => item.status !== 'ready').map((item) => <p key={item.code} className="mt-1 text-xs text-red-800">• {item.code}: {item.message}</p>)}
          <p className="mt-2 text-[11px] text-slate-600">Ruleset {reconciliation.rulesetVersion} · snapshot {reconciliation.sourceSnapshotSha256.slice(0, 16)}…</p>
        </div>}

        {!immutable && selectedEvidence.structured?.id && <div className="space-y-2 rounded border border-blue-200 bg-blue-50 p-3">
          <label className="flex items-start gap-2"><input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} /><span>Tôi xác nhận metadata đã được kiểm tra trực tiếp với file carrier nguyên bản. Đây không phải hành vi phát hành B/L/AWB/CMR/CIM.</span></label>
          <Textarea placeholder="Ghi rõ người/nguồn và cách đối chiếu" value={confirmationNote} onChange={(e) => setConfirmationNote(e.target.value)} />
          <Button disabled={busy || !acknowledged || !confirmationNote.trim()} onClick={() => void run(async () => {
            await confirmCarrierDocument(shipmentId, selectedEvidence.structured!.id!, { metadataConfirmed: true, confirmationNote: confirmationNote.trim() });
          }, 'Đã khóa metadata carrier và lưu kết quả đối soát bất biến.')}><ShieldCheck className="mr-2 h-4 w-4" />Xác nhận & khóa</Button>
        </div>}

        {immutable && <p className="text-xs text-emerald-800">Đã khóa bởi {draft.confirmerName || 'người xác nhận'}; mọi sửa đổi phải upload file mới và liên kết “Thay thế phiên bản”.</p>}
      </div>}
    </CardContent>
  </Card>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}
