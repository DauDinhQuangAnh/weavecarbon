'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileCheck2, Loader2, PackagePlus, RefreshCw, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchAllLogisticsShipments, type LogisticsShipmentSummary } from '@/lib/logisticsApi';
import {
  createShipmentPackage,
  approveCarrierDocument,
  downloadReportFile,
  emptyShipmentExportProfile,
  fetchShipmentExportProfile,
  fetchShipmentExportReadiness,
  generateShipmentExportDocument,
  issueShipmentExportDocument,
  saveShipmentExportProfile,
  syncShipmentExportLines,
  uploadCarrierDocument,
  updateShipmentExportLine,
  updateShipmentPackage,
  type ExportDocumentType,
  type ExportParty,
  type ExportReadiness,
  type ShipmentExportBundle,
  type ShipmentExportProfile,
  type ShipmentExportLine,
  type ShipmentPackage
} from '@/lib/weave-v2/shipmentExportApi';

const DOCUMENT_LABELS: Record<ExportDocumentType, string> = {
  commercial_invoice: 'Commercial Invoice',
  packing_list: 'Packing List',
  carbon_annex: 'Carbon Annex (không phải B/L)',
  origin_workbook: 'EVFTA Origin Workbook',
  ics2_dataset: 'ICS2 Data Package'
};

const fields: Array<{ key: keyof ShipmentExportProfile; label: string; type?: string; numeric?: boolean }> = [
  { key: 'invoiceNumber', label: 'Số Commercial Invoice' },
  { key: 'invoiceDate', label: 'Ngày invoice', type: 'date' },
  { key: 'invoiceIssuePlace', label: 'Nơi phát hành invoice' },
  { key: 'packingListNumber', label: 'Số Packing List' },
  { key: 'packingListDate', label: 'Ngày Packing List', type: 'date' },
  { key: 'poContractId', label: 'PO / Contract ID' },
  { key: 'currency', label: 'Tiền tệ (ISO 4217)' },
  { key: 'paymentTerms', label: 'Điều khoản thanh toán' },
  { key: 'incotermCode', label: 'Incoterm' },
  { key: 'incotermLocation', label: 'Địa điểm Incoterm' },
  { key: 'exporterTaxId', label: 'Mã số thuế exporter' },
  { key: 'portOfLoading', label: 'Cảng/nơi xếp hàng' },
  { key: 'portOfDischarge', label: 'Cảng/nơi dỡ hàng' },
  { key: 'placeOfDelivery', label: 'Nơi giao hàng' },
  { key: 'vesselName', label: 'Tên tàu/chuyến bay' },
  { key: 'voyageNumber', label: 'Số voyage/chuyến' },
  { key: 'billOfLadingNo', label: 'Số B/L/AWB/CMR do carrier cấp' },
  { key: 'containerNo', label: 'Số container' },
  { key: 'sealNo', label: 'Số seal' },
  { key: 'importerEori', label: 'EORI của importer' },
  { key: 'customsDeclarationNo', label: 'Số tờ khai hải quan (nếu có)' },
  { key: 'freightAmount', label: 'Cước vận chuyển', type: 'number', numeric: true },
  { key: 'insuranceAmount', label: 'Bảo hiểm', type: 'number', numeric: true },
  { key: 'discountAmount', label: 'Chiết khấu', type: 'number', numeric: true },
  { key: 'surchargeAmount', label: 'Phụ phí', type: 'number', numeric: true }
];

const transportModes = [
  { value: 'sea', label: 'Đường biển' },
  { value: 'air', label: 'Đường hàng không' },
  { value: 'road', label: 'Đường bộ' },
  { value: 'rail', label: 'Đường sắt' },
  { value: 'multimodal', label: 'Đa phương thức' }
];

const emptyPackageForm = () => ({
  packageNumber: '', packageType: 'carton', marksAndNumbers: '', quantity: '1',
  netWeightKg: '', grossWeightKg: '', lengthCm: '', widthCm: '', heightCm: '', contentsText: ''
});

const parsePackageContents = (value: string) => value.split(',').map((entry) => {
  const [lineNumber, quantity] = entry.trim().split(':');
  return { lineNumber: Number(lineNumber), quantity: Number(quantity) };
}).filter((item) => Number.isInteger(item.lineNumber) && item.lineNumber > 0 && item.quantity > 0);

const formatPackageContents = (contents: unknown[]) => contents.map((item) => {
  const value = item as { lineNumber?: number; quantity?: number };
  return value.lineNumber && value.quantity ? `${value.lineNumber}:${value.quantity}` : '';
}).filter(Boolean).join(',');

const packageCbm = (pkg: Pick<ShipmentPackage, 'quantity' | 'lengthCm' | 'widthCm' | 'heightCm'>) =>
  Number(pkg.quantity || 0) * Number(pkg.lengthCm || 0) * Number(pkg.widthCm || 0) * Number(pkg.heightCm || 0) / 1_000_000;

export default function ShipmentExportPortal() {
  const [shipments, setShipments] = useState<LogisticsShipmentSummary[]>([]);
  const [shipmentId, setShipmentId] = useState('');
  const [bundle, setBundle] = useState<ShipmentExportBundle | null>(null);
  const [profile, setProfile] = useState<ShipmentExportProfile>(emptyShipmentExportProfile());
  const [readiness, setReadiness] = useState<ExportReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [carrierFile, setCarrierFile] = useState<File | null>(null);
  const [lineEdits, setLineEdits] = useState<Record<string, Partial<ShipmentExportLine>>>({});
  const [packageEdits, setPackageEdits] = useState<Record<string, Partial<ShipmentPackage>>>({});
  const [newPackage, setNewPackage] = useState(emptyPackageForm);

  useEffect(() => {
    void (async () => {
      try {
        const items = await fetchAllLogisticsShipments({ sort_by: 'updated_at', sort_order: 'desc' });
        setShipments(items);
        setShipmentId((current) => current || items[0]?.id || '');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không tải được danh sách lô hàng.');
      } finally { setLoading(false); }
    })();
  }, []);

  const reload = useCallback(async () => {
    if (!shipmentId) { setBundle(null); setReadiness(null); return; }
    setLoading(true);
    try {
      const [nextBundle, nextReadiness] = await Promise.all([
        fetchShipmentExportProfile(shipmentId), fetchShipmentExportReadiness(shipmentId)
      ]);
      setBundle(nextBundle);
      setProfile(nextBundle.profile || emptyShipmentExportProfile());
      setReadiness(nextReadiness);
      setLineEdits({});
      setPackageEdits({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tải được hồ sơ xuất khẩu.');
    } finally { setLoading(false); }
  }, [shipmentId]);

  useEffect(() => { void reload(); }, [reload]);

  const latestDocuments = useMemo(() => {
    const map = new Map<ExportDocumentType, ShipmentExportBundle['documents'][number]>();
    bundle?.documents.forEach((doc) => { if (!map.has(doc.type)) map.set(doc.type, doc); });
    return map;
  }, [bundle]);

  const update = <K extends keyof ShipmentExportProfile>(key: K, value: ShipmentExportProfile[K]) =>
    setProfile((current) => ({ ...current, [key]: value }));

  const updateParty = (
    key: 'exporter' | 'importer' | 'consignee' | 'notifyParty',
    field: keyof ExportParty,
    value: string
  ) =>
    setProfile((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try { await action(); toast.success(success); await reload(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Thao tác thất bại.'); }
    finally { setBusy(null); }
  };

  if (loading && !bundle) {
    return <Card><CardContent className="flex items-center gap-2 p-6"><Loader2 className="h-4 w-4 animate-spin" />Đang tải hồ sơ xuất khẩu…</CardContent></Card>;
  }

  return (
    <div className="space-y-5">
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="flex gap-3 p-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div><b>Cổng hồ sơ xuất khẩu theo lô hàng.</b> Chỉ tài liệu có trạng thái “Đã phát hành” mới dùng đối ngoại. Carbon Annex không thay thế B/L/AWB/CMR của hãng vận tải.</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">1. Chọn lô hàng</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Select value={shipmentId} onValueChange={setShipmentId}>
            <SelectTrigger className="min-w-[320px]"><SelectValue placeholder="Chọn shipment" /></SelectTrigger>
            <SelectContent>{shipments.map((shipment) => <SelectItem key={shipment.id} value={shipment.id}>{shipment.referenceNumber || shipment.id} · {shipment.origin.country} → {shipment.destination.country}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void reload()} disabled={!shipmentId || Boolean(busy)}><RefreshCw className="mr-2 h-4 w-4" />Làm mới</Button>
          {shipments.length === 0 && <p className="text-sm text-red-700">Chưa có lô hàng. Hãy tạo shipment trong mục Logistics trước.</p>}
        </CardContent>
      </Card>

      {shipmentId && bundle && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">2. Thông tin thương mại và các bên</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {fields.map((field) => <div key={field.key} className="space-y-1"><Label>{field.label}</Label><Input type={field.type || 'text'} value={String(profile[field.key] ?? '')} onChange={(event) => update(field.key, (field.numeric ? (event.target.value === '' ? null : Number(event.target.value)) : event.target.value) as never)} /></div>)}
                <div className="space-y-1"><Label>Phương thức vận tải</Label><Select value={profile.transportMode} onValueChange={(value) => update('transportMode', value)}><SelectTrigger><SelectValue placeholder="Chọn phương thức" /></SelectTrigger><SelectContent>{transportModes.map((mode) => <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Yêu cầu ưu đãi xuất xứ EVFTA</Label><Select value={profile.preferentialOriginClaim ? 'yes' : 'no'} onValueChange={(value) => update('preferentialOriginClaim', value === 'yes')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="no">Không</SelectItem><SelectItem value="yes">Có — cần bằng chứng xuất xứ đã duyệt</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {(['exporter', 'importer', 'consignee', 'notifyParty'] as const).map((party) => <div key={party} className="space-y-2 rounded-lg border p-3"><b className="text-sm uppercase">{party}</b><Input placeholder="Tên pháp lý" value={profile[party].name || ''} onChange={(event) => updateParty(party, 'name', event.target.value)} /><Input placeholder="Địa chỉ đầy đủ" value={profile[party].address || ''} onChange={(event) => updateParty(party, 'address', event.target.value)} /><Input placeholder="Quốc gia (ISO 2 ký tự)" maxLength={2} value={profile[party].country || ''} onChange={(event) => updateParty(party, 'country', event.target.value.toUpperCase())} /><Input placeholder="Email / điện thoại liên hệ" value={profile[party].contact || ''} onChange={(event) => updateParty(party, 'contact', event.target.value)} /></div>)}
              </div>
              <Button disabled={Boolean(busy)} onClick={() => void run('save', () => saveShipmentExportProfile(shipmentId, profile), 'Đã lưu hồ sơ lô hàng.')}><Save className="mr-2 h-4 w-4" />Lưu hồ sơ</Button>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">3. Dòng hàng và kiện hàng</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span>{bundle.lines.length} dòng hàng đã snapshot</span><Button size="sm" variant="outline" onClick={() => void run('sync', () => syncShipmentExportLines(shipmentId), 'Đã đồng bộ dòng hàng từ shipment.')} disabled={Boolean(busy)}>Đồng bộ dòng hàng</Button></div>
                <div className="max-h-72 space-y-2 overflow-auto rounded border p-2">
                  {bundle.lines.map((line) => {
                    const edit = lineEdits[line.id] || {};
                    const value = <K extends keyof ShipmentExportLine>(key: K) => edit[key] ?? line[key];
                    return <div key={line.id} className="grid gap-2 rounded border p-2 md:grid-cols-2 lg:grid-cols-4">
                      <Input disabled value={line.sku} aria-label="SKU" />
                      <Input placeholder="Mô tả hàng hóa" value={String(value('goodsDescription') ?? '')} onChange={(event) => setLineEdits((current) => ({ ...current, [line.id]: { ...current[line.id], goodsDescription: event.target.value } }))} />
                      <Input placeholder="HS/CN" value={String(value('hsCode') ?? '')} onChange={(event) => setLineEdits((current) => ({ ...current, [line.id]: { ...current[line.id], hsCode: event.target.value, hsCodeConfirmed: false } }))} />
                      <Input placeholder="Xuất xứ" value={String(value('originCountry') ?? '')} onChange={(event) => setLineEdits((current) => ({ ...current, [line.id]: { ...current[line.id], originCountry: event.target.value } }))} />
                      <Input placeholder="Style" value={String(value('styleCode') ?? '')} onChange={(event) => setLineEdits((current) => ({ ...current, [line.id]: { ...current[line.id], styleCode: event.target.value } }))} />
                      <Input placeholder="Size" value={String(value('sizeLabel') ?? '')} onChange={(event) => setLineEdits((current) => ({ ...current, [line.id]: { ...current[line.id], sizeLabel: event.target.value } }))} />
                      <Input placeholder="Màu" value={String(value('colorLabel') ?? '')} onChange={(event) => setLineEdits((current) => ({ ...current, [line.id]: { ...current[line.id], colorLabel: event.target.value } }))} />
                      <Input placeholder="Lot / batch" value={String(value('lotNumber') ?? '')} onChange={(event) => setLineEdits((current) => ({ ...current, [line.id]: { ...current[line.id], lotNumber: event.target.value } }))} />
                      <Input type="number" placeholder="Đơn giá" value={String(value('unitPrice') ?? '')} onChange={(event) => setLineEdits((current) => ({ ...current, [line.id]: { ...current[line.id], unitPrice: event.target.value === '' ? null : Number(event.target.value) } }))} />
                      <Input type="number" placeholder="Net kg" value={String(value('netWeightKg') ?? '')} onChange={(event) => setLineEdits((current) => ({ ...current, [line.id]: { ...current[line.id], netWeightKg: event.target.value === '' ? null : Number(event.target.value) } }))} />
                      <Input type="number" placeholder="Gross kg" value={String(value('grossWeightKg') ?? '')} onChange={(event) => setLineEdits((current) => ({ ...current, [line.id]: { ...current[line.id], grossWeightKg: event.target.value === '' ? null : Number(event.target.value) } }))} />
                      <Select value={value('hsCodeConfirmed') ? 'yes' : 'no'} onValueChange={(next) => setLineEdits((current) => ({ ...current, [line.id]: { ...current[line.id], hsCodeConfirmed: next === 'yes' } }))}><SelectTrigger aria-label="Xác nhận mã HS/CN"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="no">HS chưa xác nhận</SelectItem><SelectItem value="yes">Tôi xác nhận mã HS/CN</SelectItem></SelectContent></Select>
                      <Button size="sm" variant="outline" disabled={!lineEdits[line.id] || Boolean(busy)} onClick={() => void run(`line-${line.id}`, () => updateShipmentExportLine(shipmentId, line.id, lineEdits[line.id]), `Đã cập nhật ${line.sku}.`)}>Lưu dòng</Button>
                    </div>;
                  })}
                </div>
                <div className="grid gap-2 rounded border p-2 md:grid-cols-2 lg:grid-cols-5">
                  <Input placeholder="Mã kiện" value={newPackage.packageNumber} onChange={(event) => setNewPackage((current) => ({ ...current, packageNumber: event.target.value }))} />
                  <Input placeholder="Loại kiện" value={newPackage.packageType} onChange={(event) => setNewPackage((current) => ({ ...current, packageType: event.target.value }))} />
                  <Input placeholder="Marks & numbers" value={newPackage.marksAndNumbers} onChange={(event) => setNewPackage((current) => ({ ...current, marksAndNumbers: event.target.value }))} />
                  <Input type="number" placeholder="Số kiện" value={newPackage.quantity} onChange={(event) => setNewPackage((current) => ({ ...current, quantity: event.target.value }))} />
                  <Input type="number" placeholder="Net kg" value={newPackage.netWeightKg} onChange={(event) => setNewPackage((current) => ({ ...current, netWeightKg: event.target.value }))} />
                  <Input type="number" placeholder="Gross kg" value={newPackage.grossWeightKg} onChange={(event) => setNewPackage((current) => ({ ...current, grossWeightKg: event.target.value }))} />
                  <Input type="number" placeholder="Dài cm" value={newPackage.lengthCm} onChange={(event) => setNewPackage((current) => ({ ...current, lengthCm: event.target.value }))} />
                  <Input type="number" placeholder="Rộng cm" value={newPackage.widthCm} onChange={(event) => setNewPackage((current) => ({ ...current, widthCm: event.target.value }))} />
                  <Input type="number" placeholder="Cao cm" value={newPackage.heightCm} onChange={(event) => setNewPackage((current) => ({ ...current, heightCm: event.target.value }))} />
                  <Input placeholder="Phân bổ dòng, vd 1:100,2:50" value={newPackage.contentsText} onChange={(event) => setNewPackage((current) => ({ ...current, contentsText: event.target.value }))} />
                  <Button size="sm" variant="outline" onClick={() => void run('package', async () => {
                    await createShipmentPackage(shipmentId, {
                      packageNumber: newPackage.packageNumber, packageType: newPackage.packageType,
                      marksAndNumbers: newPackage.marksAndNumbers, quantity: Number(newPackage.quantity),
                      netWeightKg: Number(newPackage.netWeightKg), grossWeightKg: Number(newPackage.grossWeightKg),
                      lengthCm: Number(newPackage.lengthCm), widthCm: Number(newPackage.widthCm), heightCm: Number(newPackage.heightCm),
                      contents: parsePackageContents(newPackage.contentsText)
                    });
                    setNewPackage(emptyPackageForm());
                  }, 'Đã thêm kiện hàng.')} disabled={!newPackage.packageNumber || !newPackage.marksAndNumbers || !newPackage.quantity || !newPackage.netWeightKg || !newPackage.grossWeightKg || !newPackage.lengthCm || !newPackage.widthCm || !newPackage.heightCm || parsePackageContents(newPackage.contentsText).length === 0 || Boolean(busy)}><PackagePlus className="mr-2 h-4 w-4" />Thêm kiện</Button>
                </div>
                {bundle.packages.map((pkg) => {
                  const edit = packageEdits[pkg.id] || {};
                  return <div key={pkg.id} className="grid gap-2 rounded border p-2 md:grid-cols-2 lg:grid-cols-4">
                    <span className="self-center font-medium">{pkg.packageNumber} · {pkg.packageType} · {packageCbm({ ...pkg, ...edit }).toFixed(3)} CBM</span>
                    <Input placeholder="Marks & numbers" value={String(edit.marksAndNumbers ?? pkg.marksAndNumbers ?? '')} onChange={(event) => setPackageEdits((current) => ({ ...current, [pkg.id]: { ...current[pkg.id], marksAndNumbers: event.target.value } }))} />
                    <Input type="number" placeholder="Net kg" value={String(edit.netWeightKg ?? pkg.netWeightKg ?? '')} onChange={(event) => setPackageEdits((current) => ({ ...current, [pkg.id]: { ...current[pkg.id], netWeightKg: Number(event.target.value) } }))} />
                    <Input type="number" placeholder="Gross kg" value={String(edit.grossWeightKg ?? pkg.grossWeightKg ?? '')} onChange={(event) => setPackageEdits((current) => ({ ...current, [pkg.id]: { ...current[pkg.id], grossWeightKg: Number(event.target.value) } }))} />
                    {(['lengthCm', 'widthCm', 'heightCm'] as const).map((key) => <Input key={key} type="number" placeholder={key === 'lengthCm' ? 'Dài cm' : key === 'widthCm' ? 'Rộng cm' : 'Cao cm'} value={String(edit[key] ?? pkg[key] ?? '')} onChange={(event) => setPackageEdits((current) => ({ ...current, [pkg.id]: { ...current[pkg.id], [key]: event.target.value === '' ? null : Number(event.target.value) } }))} />)}
                    <Input placeholder="Phân bổ dòng, vd 1:100" defaultValue={formatPackageContents(pkg.contents)} onChange={(event) => setPackageEdits((current) => ({ ...current, [pkg.id]: { ...current[pkg.id], contents: parsePackageContents(event.target.value) } }))} />
                    <Button size="sm" variant="outline" disabled={!packageEdits[pkg.id] || Boolean(busy)} onClick={() => void run(`pkg-${pkg.id}`, () => updateShipmentPackage(shipmentId, pkg.id, packageEdits[pkg.id]), `Đã cập nhật ${pkg.packageNumber}.`)}>Lưu kiện</Button>
                  </div>;
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">4. Chứng từ hãng vận tải</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Input type="file" accept=".pdf,.xlsx,.docx,.png,.jpg,.jpeg" onChange={(event) => setCarrierFile(event.target.files?.[0] || null)} />
                <Button size="sm" disabled={!carrierFile || Boolean(busy)} onClick={() => carrierFile && void run('carrier', () => uploadCarrierDocument(shipmentId, carrierFile), 'Đã upload chứng từ carrier; cần duyệt trước khi sử dụng.')}><Upload className="mr-2 h-4 w-4" />Upload B/L/AWB/CMR</Button>
                {bundle.carrierDocuments.map((doc) => <div key={doc.id} className="flex items-center justify-between gap-2 rounded border p-2"><span>{doc.name}</span><div className="flex items-center gap-2"><Badge variant={doc.status === 'locked' ? 'default' : 'outline'}>{doc.status}</Badge>{doc.status !== 'locked' && <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void run(`approve-${doc.id}`, () => approveCarrierDocument(doc.id), 'Đã duyệt chứng từ carrier.')}>Duyệt</Button>}</div></div>)}
                {!bundle.carrierDocuments.length && <p className="text-red-700">Chưa có chứng từ carrier được duyệt.</p>}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">5. Mức hoàn thiện tài liệu</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3"><Progress value={readiness?.documentCompleteness || 0} className="h-2 flex-1" /><b>{readiness?.documentCompleteness || 0}%</b><Badge>{readiness?.status || 'blocked'}</Badge></div>
              <p className="text-xs text-slate-600">Đây là mức hoàn thiện dữ liệu, không phải xác nhận của hải quan hoặc cơ quan có thẩm quyền.</p>
              <div className="rounded border p-3 text-sm"><b>CBAM:</b> {readiness?.cbam.status}. {readiness?.cbam.applicable ? `Cần chuyên viên kiểm tra mã ${readiness.cbam.matchedHsCodes.join(', ')}.` : 'Các mã hàng hiện tại không kích hoạt form CBAM.'}</div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {readiness?.documents.map((doc) => {
                  const existing = latestDocuments.get(doc.type);
                  const ready = doc.status === 'ready';
                  return <div key={doc.type} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2"><b className="text-sm">{DOCUMENT_LABELS[doc.type]}</b>{ready ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}</div>
                    <Badge variant={ready ? 'default' : 'outline'}>{doc.status}</Badge>
                    {!ready && doc.messages.slice(0, 3).map((message) => <p key={message} className="text-xs text-red-700">• {message}</p>)}
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={!ready || Boolean(busy)} onClick={() => void run(`generate-${doc.type}`, () => generateShipmentExportDocument(shipmentId, doc.type), 'Đã đưa bản review vào hàng đợi tạo file.')}>Tạo bản review</Button>
                      {existing?.reportStatus === 'completed' && existing.reportId && <Button size="sm" variant="outline" onClick={() => void downloadReportFile(existing.reportId, existing.filename || `${doc.type}.xlsx`)}><Download className="mr-1 h-3 w-3" />Tải</Button>}
                      {existing?.reportStatus === 'completed' && existing.status === 'ready' && <Button size="sm" variant="outline" onClick={() => void run(`issue-${existing.id}`, () => issueShipmentExportDocument(shipmentId, existing.id), 'Đã phát hành phiên bản bất biến.')}><FileCheck2 className="mr-1 h-3 w-3" />Phát hành</Button>}
                    </div>
                    {existing && <p className="text-[11px] text-slate-500">v{existing.version} · file {existing.reportStatus || 'processing'} · {existing.status}</p>}
                  </div>;
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
