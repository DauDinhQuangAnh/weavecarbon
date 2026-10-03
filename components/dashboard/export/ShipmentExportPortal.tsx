'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ExternalLink,
  FileCheck2,
  Layers,
  Loader2,
  Package,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from '@e965/xlsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchAllLogisticsShipments, type LogisticsShipmentSummary } from '@/lib/logisticsApi';
import CarrierDocumentPanel from './CarrierDocumentPanel';
import ComplianceApplicabilityPanel from './ComplianceApplicabilityPanel';
import EnvironmentalClaimRegisterPanel from './EnvironmentalClaimRegisterPanel';
import TextileFibreLabelPanel from './TextileFibreLabelPanel';
import GpsrTechnicalFilePanel from './GpsrTechnicalFilePanel';
import ReachSvhcDossierPanel from './ReachSvhcDossierPanel';
import PcfStudyPanel from './PcfStudyPanel';
import EuImportHandoffPanel from './EuImportHandoffPanel';
import Ics2HandoffPanel from './Ics2HandoffPanel';
import OriginHandoffPanel from './OriginHandoffPanel';
import VnCustomsHandoffPanel from './VnCustomsHandoffPanel';
import {
  createShipmentPackage,
  createShipmentContainer,
  downloadReportFile,
  emptyShipmentExportProfile,
  fetchShipmentExportProfile,
  fetchShipmentExportReadiness,
  generateShipmentExportDocument,
  saveShipmentExportProfile,
  syncShipmentExportLines,
  type ExportDocumentType,
  type ExportParty,
  type ExportReadiness,
  type ShipmentExportBundle,
  type ShipmentExportProfile,
  type ShipmentPackage
} from '@/lib/weave-v2/shipmentExportApi';
import { R_ITEMS } from './exportRegulatoryItems';
import { CommercialInvoiceModalContent } from './modals/CommercialInvoiceModalContent';
import { PackingListModalContent } from './modals/PackingListModalContent';

const emptyPackageForm = () => ({
  packageNumber: '', packageType: 'carton', marksAndNumbers: '', quantity: '1',
  netWeightKg: '', grossWeightKg: '', lengthCm: '', widthCm: '', heightCm: '', contentsText: '',
  containerId: '', parentPackageId: '', sequenceNo: '',
  weightMeasurementBasis: 'per_package' as ShipmentPackage['weightMeasurementBasis'],
  dimensionMeasurementBasis: 'per_package' as ShipmentPackage['dimensionMeasurementBasis']
});

const emptyContainerForm = () => ({
  containerNumber: '', sealNumber: '', equipmentType: '40HC', marksAndNumbers: '',
  tareWeightKg: '', maxGrossWeightKg: ''
});

const parsePackageContents = (value: string) => value.split(',').map((entry) => {
  const [lineNumber, quantity] = entry.trim().split(':');
  return { lineNumber: Number(lineNumber), quantity: Number(quantity) };
}).filter((item) => Number.isInteger(item.lineNumber) && item.lineNumber > 0 && item.quantity > 0);

export interface ShipmentExportPortalProps {
  documentManagerSlot?: React.ReactNode;
}

export default function ShipmentExportPortal({ documentManagerSlot }: ShipmentExportPortalProps) {
  const [shipments, setShipments] = useState<LogisticsShipmentSummary[]>([]);
  const [shipmentId, setShipmentId] = useState('');
  const [bundle, setBundle] = useState<ShipmentExportBundle | null>(null);
  const [profile, setProfile] = useState<ShipmentExportProfile>(emptyShipmentExportProfile());
  const [readiness, setReadiness] = useState<ExportReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // Active R popup modal state
  const [activeR, setActiveR] = useState<string | null>(null);

  // R01 & R02 sub-modals or helpers
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [newContainer, setNewContainer] = useState(emptyContainerForm);
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

  // 1-Click Demo Preset for R01
  const handleFillDemoPreset = () => {
    setProfile((prev) => ({
      ...prev,
      invoiceNumber: 'INV-2026-EU-089',
      invoiceDate: '2026-06-15',
      invoiceIssuePlace: 'Hanoi, Vietnam',
      packingListNumber: 'PKL-2026-EU-089',
      packingListDate: '2026-06-15',
      poContractId: 'PO-EU-2026-009',
      currency: 'USD',
      paymentTerms: 'T/T 60 days after B/L date',
      incotermCode: 'FOB',
      incotermLocation: 'Cat Lai Port, Ho Chi Minh City',
      exporterTaxId: '0108927461',
      portOfLoading: 'Cat Lai, Vietnam (VNSGN)',
      portOfDischarge: 'Rotterdam, Netherlands (NLRTM)',
      placeOfDelivery: 'Rotterdam Distribution Center',
      vesselName: 'ONE APUS',
      voyageNumber: '012E',
      billOfLadingNo: 'ONE-SGN-RTM-2026-04',
      carrierName: 'Ocean Network Express (ONE)',
      importerEori: 'NL820491823',
      importerVatId: 'NL820491823B01',
      customsDeclarationNo: '104829384720',
      freightAmount: 2450,
      insuranceAmount: 180,
      transportMode: 'sea',
      preferentialOriginClaim: true,
      exporter: {
        name: 'WeaveCarbon Garment JSC',
        address: 'Lot B2, Tan Binh Industrial Park, Ho Chi Minh City',
        country: 'VN',
        contact: 'export@weavecarbon.vn / +84-28-38123456'
      },
      importer: {
        name: 'Nordic Retail & Fashion B.V.',
        address: 'Keizersgracht 421, 1016 EK Amsterdam',
        country: 'NL',
        contact: 'compliance@nordicfashion.eu / +31-20-7123456'
      }
    }));
    toast.success('Đã nạp bộ dữ liệu mẫu xuất khẩu Châu Âu thành công!');
  };

  // Download Sample Template for R01
  const handleDownloadTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
    const templateData = [
      {
        'Số Commercial Invoice': 'INV-2026-EU-089',
        'Ngày invoice': '2026-06-15',
        'Nơi phát hành': 'Hanoi, Vietnam',
        'PO / Contract ID': 'PO-EU-2026-009',
        'Tiền tệ': 'USD',
        'Điều khoản thanh toán': 'T/T 60 days',
        'Incoterm': 'FOB',
        'Địa điểm Incoterm': 'Cat Lai Port',
        'MST Exporter': '0108927461',
        'Cảng xếp hàng': 'Cat Lai, Vietnam (VNSGN)',
        'Cảng dỡ hàng': 'Rotterdam, Netherlands (NLRTM)',
        'Nơi giao hàng': 'Rotterdam Hub',
        'Tên tàu': 'ONE APUS',
        'Số voyage': '012E',
        'Số B/L': 'ONE-SGN-RTM-2026-04',
        'Hãng vận tải': 'ONE Line',
        'EORI Importer': 'NL820491823',
        'Số tờ khai hải quan': '104829384720',
        'Cước vận chuyển': 2450,
        'Bảo hiểm': 180,
        'Tên Exporter': 'WeaveCarbon Garment JSC',
        'Địa chỉ Exporter': 'Tan Binh IP, HCMC',
        'Tên Importer': 'Nordic Retail B.V.',
        'Địa chỉ Importer': 'Amsterdam, NL'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'CommercialInvoice');

    if (format === 'csv') {
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'mau_commercial_invoice.csv';
      link.click();
    } else {
      XLSX.writeFile(workbook, 'mau_commercial_invoice.xlsx');
    }
    toast.success(`Đã tải file mẫu ${format.toUpperCase()}`);
  };

  // Import file for R01
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error('File không chứa sheet dữ liệu nào.');

      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

      if (!rows.length) throw new Error('File dữ liệu trống.');
      const row = rows[0];

      const getStr = (keys: string[]) => {
        for (const k of keys) {
          const val = row[k];
          if (val !== undefined && val !== null && String(val).trim()) return String(val).trim();
        }
        return '';
      };

      const getNum = (keys: string[]) => {
        for (const k of keys) {
          const val = row[k];
          if (val !== undefined && val !== null && !isNaN(Number(val))) return Number(val);
        }
        return null;
      };

      setProfile((prev) => ({
        ...prev,
        invoiceNumber: getStr(['Số Commercial Invoice', 'invoiceNumber', 'invoice_number']) || prev.invoiceNumber,
        invoiceDate: getStr(['Ngày invoice', 'invoiceDate', 'invoice_date']) || prev.invoiceDate,
        invoiceIssuePlace: getStr(['Nơi phát hành', 'invoiceIssuePlace']) || prev.invoiceIssuePlace,
        poContractId: getStr(['PO / Contract ID', 'poContractId', 'po']) || prev.poContractId,
        currency: getStr(['Tiền tệ', 'currency']) || prev.currency,
        paymentTerms: getStr(['Điều khoản thanh toán', 'paymentTerms']) || prev.paymentTerms,
        incotermCode: getStr(['Incoterm', 'incotermCode']) || prev.incotermCode,
        incotermLocation: getStr(['Địa điểm Incoterm', 'incotermLocation']) || prev.incotermLocation,
        exporterTaxId: getStr(['MST Exporter', 'exporterTaxId']) || prev.exporterTaxId,
        portOfLoading: getStr(['Cảng xếp hàng', 'portOfLoading']) || prev.portOfLoading,
        portOfDischarge: getStr(['Cảng dỡ hàng', 'portOfDischarge']) || prev.portOfDischarge,
        placeOfDelivery: getStr(['Nơi giao hàng', 'placeOfDelivery']) || prev.placeOfDelivery,
        vesselName: getStr(['Tên tàu', 'vesselName']) || prev.vesselName,
        voyageNumber: getStr(['Số voyage', 'voyageNumber']) || prev.voyageNumber,
        billOfLadingNo: getStr(['Số B/L', 'billOfLadingNo']) || prev.billOfLadingNo,
        carrierName: getStr(['Hãng vận tải', 'carrierName']) || prev.carrierName,
        importerEori: getStr(['EORI Importer', 'importerEori']) || prev.importerEori,
        customsDeclarationNo: getStr(['Số tờ khai hải quan', 'customsDeclarationNo']) || prev.customsDeclarationNo,
        freightAmount: getNum(['Cước vận chuyển', 'freightAmount']) ?? prev.freightAmount,
        insuranceAmount: getNum(['Bảo hiểm', 'insuranceAmount']) ?? prev.insuranceAmount,
        exporter: {
          ...prev.exporter,
          name: getStr(['Tên Exporter', 'exporterName']) || prev.exporter.name,
          address: getStr(['Địa chỉ Exporter', 'exporterAddress']) || prev.exporter.address,
        },
        importer: {
          ...prev.importer,
          name: getStr(['Tên Importer', 'importerName']) || prev.importer.name,
          address: getStr(['Địa chỉ Importer', 'importerAddress']) || prev.importer.address,
        }
      }));

      toast.success('Đã nạp thành công thông số Commercial Invoice từ file!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi đọc file Excel/CSV.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const selectedRMeta = useMemo(() => {
    return R_ITEMS.find((item) => item.code === activeR) || null;
  }, [activeR]);

  if (loading && !bundle) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-800" />
          Đang tải hồ sơ xuất khẩu…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* HEADER: Chọn shipment & Tiến độ tinh gọn */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardContent className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-[280px] space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-emerald-800" />
              Lô hàng Xuất khẩu mục tiêu
            </span>
            <Select value={shipmentId} onValueChange={setShipmentId}>
              <SelectTrigger className="h-10 text-sm font-semibold">
                <SelectValue placeholder="Chọn shipment..." />
              </SelectTrigger>
              <SelectContent>
                {shipments.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    📦 {s.referenceNumber || s.id} · {s.origin.country} ➔ {s.destination.country} ({s.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {readiness && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-medium">Hoàn thiện hồ sơ:</span>
                  <span className="text-sm font-bold text-emerald-800">{readiness.documentCompleteness}%</span>
                </div>
                <Progress value={readiness.documentCompleteness} className="h-1.5 w-36 mt-1" />
              </div>
              <Badge variant={readiness.status === 'ready_to_issue' ? 'default' : 'outline'} className="text-xs capitalize ml-2">
                {readiness.status}
              </Badge>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void reload()}
              disabled={!shipmentId || Boolean(busy)}
              className="text-xs h-9 bg-white"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Làm mới
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* DANH SÁCH CÁC R THU GỌN — CHỈ HIỂN THỊ TIÊU ĐỀ (TITLE ONLY) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-800" />
            Danh mục Hồ sơ Quy chuẩn Xuất khẩu (R01 — R13)
          </h2>
          <span className="text-xs text-slate-500">
            Bấm vào từng mục R để mở Popup nhập tay hoặc Import file
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {R_ITEMS.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.code}
                onClick={() => setActiveR(r.code)}
                className="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-emerald-500 hover:shadow-md hover:bg-emerald-50/15 cursor-pointer transition-all duration-200"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-800 text-white font-mono font-bold text-xs shadow-xs">
                        {r.code}
                      </span>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-emerald-100 group-hover:text-emerald-800 transition-colors">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] py-0.5 px-2 font-medium truncate max-w-[140px] ${r.badgeTone}`}>
                      {r.tag}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-800 transition-colors line-clamp-2 leading-snug">
                      {r.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1 min-h-[32px] leading-relaxed">
                      {r.subtitle}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 group-hover:text-emerald-800 transition-colors">
                  <span className="font-medium text-[11px]">Nhập tay hoặc Import</span>
                  <span className="flex items-center gap-1 font-semibold text-emerald-800 text-xs group-hover:translate-x-0.5 transition-transform">
                    <span>Mở popup</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            );
          })}

          {/* R14: DOCUMENT MANAGER SLOT (NẾU CÓ) */}
          {documentManagerSlot && (
            <div
              onClick={() => setActiveR('R14')}
              className="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-emerald-500 hover:shadow-md hover:bg-emerald-50/15 cursor-pointer transition-all duration-200"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-800 text-white font-mono font-bold text-xs shadow-xs">
                      R14
                    </span>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-emerald-100 group-hover:text-emerald-800 transition-colors">
                      <FileCheck2 className="h-4 w-4" />
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] py-0.5 px-2 font-medium border-emerald-300 bg-emerald-50 text-emerald-800">
                    Chứng chỉ & Chứng nhận
                  </Badge>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-800 transition-colors line-clamp-2 leading-snug">
                    Quản lý Chứng nhận & Hồ sơ Tuân thủ Thị trường
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1 min-h-[32px] leading-relaxed">
                    Hồ sơ tuân thủ xuất khẩu và tài liệu chứng nhận vật liệu mở khóa theo thị trường.
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 group-hover:text-emerald-800 transition-colors">
                <span className="font-medium text-[11px]">Chứng nhận thị trường</span>
                <span className="flex items-center gap-1 font-semibold text-emerald-800 text-xs group-hover:translate-x-0.5 transition-transform">
                  <span>Mở popup</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* POPUP MODALS CHO TỪNG R CỤ THỂ                                           */}
      {/* ========================================================================= */}
      <Dialog open={Boolean(activeR)} onOpenChange={(open) => !open && setActiveR(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-6 w-9 shrink-0 items-center justify-center rounded bg-emerald-800 text-white font-mono font-bold text-xs">
                  {activeR}
                </span>
                <span>{selectedRMeta?.title || (activeR === 'R14' ? 'Quản lý Chứng nhận & Hồ sơ Tuân thủ' : '')}</span>
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-600 mt-1">
              {selectedRMeta?.subtitle || ''}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-3 space-y-4">
            {/* -------------------- POPUP R01: COMMERCIAL INVOICE -------------------- */}
            {/* -------------------- POPUP R01: COMMERCIAL INVOICE -------------------- */}
            {activeR === 'R01' && (
              <CommercialInvoiceModalContent
                profile={profile}
                update={update}
                updateParty={updateParty}
                handleDownloadTemplate={handleDownloadTemplate}
                handleFileUpload={handleFileUpload}
                handleFillDemoPreset={handleFillDemoPreset}
                fileInputRef={fileInputRef}
                busy={busy}
                onSave={() => void run('save', () => saveShipmentExportProfile(shipmentId, profile), 'Đã lưu Commercial Invoice R01.')}
                onGeneratePdf={() => void run('generate-commercial_invoice', () => generateShipmentExportDocument(shipmentId, 'commercial_invoice', 'pdf'), 'Đã đưa bản PDF Invoice vào hàng đợi tạo file.')}
                onDownloadReport={(reportId) => void downloadReportFile(reportId, 'commercial_invoice.pdf')}
                invoiceReportId={latestDocuments.get('commercial_invoice')?.reportId}
              />
            )}

            {/* -------------------- POPUP R02: PACKING LIST -------------------- */}
            {activeR === 'R02' && (
              <PackingListModalContent
                profile={profile}
                update={update}
                newContainer={newContainer}
                setNewContainer={setNewContainer}
                newPackage={newPackage}
                setNewPackage={setNewPackage}
                bundle={bundle}
                busy={busy}
                onSave={() => void run('save', () => saveShipmentExportProfile(shipmentId, profile), 'Đã lưu Packing List R02.')}
                onAddContainer={() => void run('container', async () => {
                  await createShipmentContainer(shipmentId, {
                    containerNumber: newContainer.containerNumber,
                    sealNumber: newContainer.sealNumber,
                    equipmentType: newContainer.equipmentType,
                    marksAndNumbers: newContainer.marksAndNumbers,
                    tareWeightKg: newContainer.tareWeightKg === '' ? null : Number(newContainer.tareWeightKg),
                    maxGrossWeightKg: newContainer.maxGrossWeightKg === '' ? null : Number(newContainer.maxGrossWeightKg)
                  });
                  setNewContainer(emptyContainerForm());
                }, 'Đã thêm container.')}
                onSyncLines={() => void run('sync', () => syncShipmentExportLines(shipmentId), 'Đã đồng bộ dòng hàng.')}
                onAddPackage={() => void run('package', async () => {
                  await createShipmentPackage(shipmentId, {
                    packageNumber: newPackage.packageNumber,
                    packageType: newPackage.packageType,
                    marksAndNumbers: newPackage.marksAndNumbers,
                    quantity: Number(newPackage.quantity || 1),
                    netWeightKg: Number(newPackage.netWeightKg || 10),
                    grossWeightKg: Number(newPackage.grossWeightKg || 12),
                    lengthCm: Number(newPackage.lengthCm || 60),
                    widthCm: Number(newPackage.widthCm || 40),
                    heightCm: Number(newPackage.heightCm || 40),
                    contents: newPackage.packageType === 'pallet' ? [] : parsePackageContents(newPackage.contentsText),
                    containerId: newPackage.containerId,
                    parentPackageId: newPackage.parentPackageId || null,
                    sequenceNo: null,
                    weightMeasurementBasis: newPackage.weightMeasurementBasis,
                    dimensionMeasurementBasis: newPackage.dimensionMeasurementBasis
                  });
                  setNewPackage(emptyPackageForm());
                }, 'Đã thêm kiện hàng.')}
                onGeneratePdf={() => void run('generate-packing_list', () => generateShipmentExportDocument(shipmentId, 'packing_list', 'pdf'), 'Đã đưa bản PDF Packing List vào hàng đợi tạo file.')}
                onDownloadReport={(reportId) => void downloadReportFile(reportId, 'packing_list.pdf')}
                packingListReportId={latestDocuments.get('packing_list')?.reportId}
              />
            )}

            {/* -------------------- POPUP R03: CARRIER DOCUMENTS -------------------- */}
            {activeR === 'R03' && bundle && (
              <CarrierDocumentPanel shipmentId={shipmentId} bundle={bundle} onChanged={reload} />
            )}

            {/* -------------------- POPUP R04: VN CUSTOMS -------------------- */}
            {activeR === 'R04' && bundle && (
              <VnCustomsHandoffPanel
                key={`${shipmentId}:${bundle.vnCustomsProfile?.updatedAt || 'new'}:${bundle.vnCustomsEvents.length}:${bundle.vnCustomsEvidence.length}`}
                shipmentId={shipmentId}
                bundle={bundle}
                onChanged={reload}
              />
            )}

            {/* -------------------- POPUP R05: EU IMPORT (EUCDM) -------------------- */}
            {activeR === 'R05' && bundle && (
              <EuImportHandoffPanel
                key={`${shipmentId}:${bundle.euImportProfile?.updatedAt || 'new'}:${bundle.euImportLineDetails.length}:${bundle.euImportEvents.length}:${bundle.euImportEvidence.length}`}
                shipmentId={shipmentId}
                bundle={bundle}
                onChanged={reload}
              />
            )}

            {/* -------------------- POPUP R06: ICS2 FILING -------------------- */}
            {activeR === 'R06' && bundle && (
              <Ics2HandoffPanel
                key={`${shipmentId}:${bundle.ics2Profile?.updatedAt || 'new'}:${bundle.ics2Events.length}:${bundle.ics2Evidence.length}`}
                shipmentId={shipmentId}
                bundle={bundle}
                onChanged={reload}
              />
            )}

            {/* -------------------- POPUP R07: EVFTA ORIGIN -------------------- */}
            {activeR === 'R07' && bundle && (
              <OriginHandoffPanel
                key={`${shipmentId}:${bundle.originProfile?.updatedAt || 'new'}:${bundle.carrierDocuments.filter((item) => item.type === 'origin_support').length}`}
                shipmentId={shipmentId}
                bundle={bundle}
                onChanged={reload}
              />
            )}

            {/* -------------------- POPUP R08: TEXTILE FIBRE LABEL -------------------- */}
            {activeR === 'R08' && (
              <TextileFibreLabelPanel shipmentId={shipmentId} />
            )}

            {/* -------------------- POPUP R09: ENVIRONMENTAL CLAIMS -------------------- */}
            {activeR === 'R09' && (
              <EnvironmentalClaimRegisterPanel shipmentId={shipmentId} />
            )}

            {/* -------------------- POPUP R10: GPSR TECHNICAL FILE -------------------- */}
            {activeR === 'R10' && (
              <GpsrTechnicalFilePanel shipmentId={shipmentId} />
            )}

            {/* -------------------- POPUP R11: REACH SVHC ARTICLE DOSSIER -------------------- */}
            {activeR === 'R11' && (
              <ReachSvhcDossierPanel shipmentId={shipmentId} />
            )}

            {/* -------------------- POPUP R12: PRODUCT CARBON FOOTPRINT (PCF) -------------------- */}
            {activeR === 'R12' && (
              <PcfStudyPanel shipmentId={shipmentId} />
            )}

            {/* -------------------- POPUP R13: COMPLIANCE APPLICABILITY -------------------- */}
            {activeR === 'R13' && (
              <ComplianceApplicabilityPanel shipmentId={shipmentId} />
            )}

            {/* -------------------- POPUP R14: DOCUMENT MANAGER SLOT -------------------- */}
            {activeR === 'R14' && documentManagerSlot && (
              <div className="space-y-4">
                {documentManagerSlot}
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button size="sm" variant="outline" onClick={() => setActiveR(null)}>
              Đóng cửa sổ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
