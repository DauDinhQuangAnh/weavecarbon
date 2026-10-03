'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  Compass,
  Download,
  ExternalLink,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FileUp,
  FlaskConical,
  Globe,
  Layers,
  Leaf,
  Loader2,
  Package,
  PackagePlus,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  Ship,
  Sparkles,
  Tag,
  Upload,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from '@e965/xlsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  issueShipmentExportDocument,
  reviewShipmentExportDocument,
  saveShipmentExportProfile,
  syncShipmentExportLines,
  updateShipmentExportLine,
  updateShipmentPackage,
  updateShipmentContainer,
  type ExportDocumentType,
  type ExportOutputFormat,
  type ExportParty,
  type ExportReadiness,
  type ShipmentExportBundle,
  type ShipmentExportProfile,
  type ShipmentExportLine,
  type ShipmentContainer,
  type ShipmentPackage
} from '@/lib/weave-v2/shipmentExportApi';

const DOCUMENT_LABELS: Record<ExportDocumentType, string> = {
  commercial_invoice: 'Commercial Invoice',
  packing_list: 'Packing List',
  carbon_annex: 'Carbon Annex (không phải B/L)',
  origin_workbook: 'EVFTA Origin Support Handoff (không phải EUR.1)',
  ics2_dataset: 'ICS2/ENS Filer Handoff',
  vn_customs_handoff: 'Vietnam Customs Broker Handoff',
  eu_import_handoff: 'EU Import Declarant Handoff (EUCDM)'
};

const REVIEW_ROLE_LABELS = {
  export_operator: 'nhân viên xuất nhập khẩu',
  warehouse_reviewer: 'nhân viên kho',
  customs_declaration_reviewer: 'chuyên viên khai báo hải quan Việt Nam',
  eu_import_declaration_reviewer: 'chuyên viên khai báo nhập khẩu EU',
  ics2_filing_reviewer: 'chuyên viên filing ICS2 của carrier/ITSP',
  origin_specialist_reviewer: 'chuyên viên xuất xứ EVFTA'
} as const;

const transportModes = [
  { value: 'sea', label: 'Đường biển' },
  { value: 'air', label: 'Đường hàng không' },
  { value: 'road', label: 'Đường bộ' },
  { value: 'rail', label: 'Đường sắt' },
  { value: 'multimodal', label: 'Đa phương thức' }
];

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

interface RItemDef {
  code: string;
  title: string;
  subtitle: string;
  tag: string;
  badgeTone: string;
  icon: React.ElementType;
}

const R_ITEMS: RItemDef[] = [
  {
    code: 'R01',
    title: 'Commercial Invoice & Hợp đồng (Hóa đơn thương mại)',
    subtitle: 'Hóa đơn xuất khẩu, số PO, đơn giá, cước phí, bảo hiểm & thông tin đối tác',
    tag: 'Thương mại & CBAM',
    badgeTone: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    icon: FileSpreadsheet
  },
  {
    code: 'R02',
    title: 'Packing List & Danh mục Đóng gói (Phiếu đóng gói)',
    subtitle: 'Container, seal, dãy carton/pallet, trọng lượng Net/Gross, thể tích CBM',
    tag: 'Kho vận & Đóng gói',
    badgeTone: 'border-teal-300 bg-teal-50 text-teal-800',
    icon: Package
  },
  {
    code: 'R03',
    title: 'Carrier Documents & Vận đơn Hãng tàu (B/L / AWB)',
    subtitle: 'Vận đơn đường biển/hàng không, booking confirmation, số container & seal do carrier cấp',
    tag: 'Hãng tàu & Vận tải',
    badgeTone: 'border-blue-300 bg-blue-50 text-blue-800',
    icon: Ship
  },
  {
    code: 'R04',
    title: 'Dữ liệu Bàn giao Broker / VNACCS (Hải quan Việt Nam)',
    subtitle: 'Tờ khai hải quan xuất khẩu, giấy phép xuất khẩu, kiểm tra chuyên ngành & đối soát R01/R02/R03',
    tag: 'Hải quan VN (VNACCS)',
    badgeTone: 'border-slate-300 bg-slate-50 text-slate-800',
    icon: FileText
  },
  {
    code: 'R05',
    title: 'Bàn giao Khai báo Nhập khẩu EU (EUCDM Handoff)',
    subtitle: 'Gói dữ liệu điện tử bàn giao cho đơn vị thông quan tại cảng đến theo chuẩn EU Customs Data Model',
    tag: 'EU Import Declarant',
    badgeTone: 'border-indigo-300 bg-indigo-50 text-indigo-800',
    icon: Globe
  },
  {
    code: 'R06',
    title: 'Dữ liệu An ninh Vận tải ICS2 / ENS Filer Handoff',
    subtitle: 'Dữ liệu an ninh khai trước (Entry Summary Declaration - ENS) chuyển giao cho hãng vận tải',
    tag: 'ICS2 · An ninh EU',
    badgeTone: 'border-purple-300 bg-purple-50 text-purple-800',
    icon: Box
  },
  {
    code: 'R07',
    title: 'Hồ sơ Hỗ trợ Quy tắc Xuất xứ EVFTA (Rules of Origin)',
    subtitle: 'Bảng tính giá trị gia tăng nội khối RVC, chuyển đổi mã số hàng hóa CTC phục vụ cấp C/O EUR.1',
    tag: 'Quy tắc xuất xứ',
    badgeTone: 'border-orange-300 bg-orange-50 text-orange-800',
    icon: Compass
  },
  {
    code: 'R08',
    title: 'Ghi nhãn Thành phần Xơ sợi Dệt may (Textile Fibre Label)',
    subtitle: 'Đối soát tỷ lệ xơ sợi, nguồn gốc tái chế và nhãn chăm sóc đa ngôn ngữ theo Quy định EU 1007/2011',
    tag: 'Ghi nhãn dệt may',
    badgeTone: 'border-sky-300 bg-sky-50 text-sky-800',
    icon: Tag
  },
  {
    code: 'R09',
    title: 'Đăng ký Công bố Môi trường (Environmental Claims)',
    subtitle: 'Đăng ký và xác minh tính pháp lý của công bố bền vững (Recycled, Eco-friendly) theo ISO 14021',
    tag: 'Green Claims',
    badgeTone: 'border-teal-300 bg-teal-50 text-teal-800',
    icon: CheckCircle2
  },
  {
    code: 'R10',
    title: 'Hồ sơ Kỹ thuật An toàn Sản phẩm EU (GPSR Technical File)',
    subtitle: 'Hồ sơ kỹ thuật an toàn sản phẩm chung EU 2023/988, người đại diện EU (Responsible Person)',
    tag: 'GPSR · EU 2024',
    badgeTone: 'border-amber-300 bg-amber-50 text-amber-800',
    icon: ShieldCheck
  },
  {
    code: 'R11',
    title: 'Hồ sơ Chất cấm & Nguy hại REACH / SVHC (REACH Article Dossier)',
    subtitle: 'Sàng lọc nồng độ chất nguy hại SVHC > 0.1% w/w theo danh mục 253 chất của ECHA Candidate List',
    tag: 'REACH · Bắt buộc EU',
    badgeTone: 'border-red-300 bg-red-50 text-red-800',
    icon: FlaskConical
  },
  {
    code: 'R12',
    title: 'Nghiên cứu Dấu chân Carbon Sản phẩm (Product Carbon Footprint - PCF)',
    subtitle: 'Báo cáo tính toán dấu chân carbon sản phẩm theo chuẩn ISO 14067:2018 phục vụ kiểm toán',
    tag: 'ISO 14067 · PCF',
    badgeTone: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    icon: Leaf
  },
  {
    code: 'R13',
    title: 'Sàng lọc Mức độ Áp dụng Quy chuẩn (Compliance Applicability)',
    subtitle: 'Ma trận đối soát tự động các quy chuẩn bắt buộc theo danh mục thị trường xuất khẩu mục tiêu',
    tag: 'Sàng lọc quy định',
    badgeTone: 'border-cyan-300 bg-cyan-50 text-cyan-800',
    icon: Layers
  }
];

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
  const [containerEdits, setContainerEdits] = useState<Record<string, Partial<ShipmentContainer>>>({});
  const [packageEdits, setPackageEdits] = useState<Record<string, Partial<ShipmentPackage>>>({});
  const [lineEdits, setLineEdits] = useState<Record<string, Partial<ShipmentExportLine>>>({});
  const [newContainer, setNewContainer] = useState(emptyContainerForm);
  const [newPackage, setNewPackage] = useState(emptyPackageForm);
  const [documentFormats, setDocumentFormats] = useState<Partial<Record<ExportDocumentType, ExportOutputFormat>>>({
    commercial_invoice: 'pdf', packing_list: 'pdf', ics2_dataset: 'json',
    vn_customs_handoff: 'json', eu_import_handoff: 'json'
  });
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

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
      setContainerEdits({});
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

        <div className="grid gap-2">
          {R_ITEMS.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.code}
                onClick={() => setActiveR(r.code)}
                className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs hover:border-emerald-400 hover:shadow-sm hover:bg-emerald-50/20 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="flex h-8 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-800 text-white font-mono font-bold text-xs shadow-xs">
                    {r.code}
                  </span>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-emerald-100 group-hover:text-emerald-800 transition-colors">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 group-hover:text-emerald-800 transition-colors truncate">
                        {r.title}
                      </span>
                      <Badge variant="outline" className={`text-[10px] py-0 px-2 font-medium ${r.badgeTone}`}>
                        {r.tag}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {r.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 text-xs text-emerald-800 group-hover:bg-emerald-100 font-semibold"
                  >
                    <span>Mở thực hiện</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}

          {/* R14: DOCUMENT MANAGER SLOT (NẾU CÓ) */}
          {documentManagerSlot && (
            <div
              onClick={() => setActiveR('R14')}
              className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs hover:border-emerald-400 hover:shadow-sm hover:bg-emerald-50/20 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="flex h-8 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-800 text-white font-mono font-bold text-xs shadow-xs">
                  R14
                </span>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-emerald-100 group-hover:text-emerald-800 transition-colors">
                  <FileCheck2 className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                      Quản lý Chứng nhận & Hồ sơ Tuân thủ Thị trường
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 px-2 font-medium border-emerald-300 bg-emerald-50 text-emerald-800">
                      Chứng chỉ & Chứng nhận
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    Hồ sơ tuân thủ xuất khẩu và tài liệu chứng nhận vật liệu mở khóa theo thị trường.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1 text-xs text-emerald-800 group-hover:bg-emerald-100 font-semibold"
              >
                <span>Mở thực hiện</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
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
            {activeR === 'R01' && (
              <div className="space-y-4">
                {/* Thanh công cụ Import / Nạp mẫu R01 */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <b className="text-sm text-emerald-950 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-emerald-700" />
                      Công cụ nạp tự động thông số Hóa đơn & Hợp đồng
                    </b>
                    <p className="text-xs text-emerald-800/80 mt-0.5">
                      Bạn có thể nạp mẫu 1-click hoặc tải file Excel/CSV từ ERP/kế toán để điền tự động.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" className="text-xs bg-white h-8" onClick={() => handleDownloadTemplate('xlsx')}>
                      <Download className="mr-1 h-3.5 w-3.5" /> Mẫu Excel
                    </Button>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                    <Button size="sm" variant="outline" className="text-xs bg-white h-8" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="mr-1 h-3.5 w-3.5" /> Upload File
                    </Button>
                    <Button size="sm" className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs h-8" onClick={handleFillDemoPreset}>
                      Nạp mẫu 1-Click
                    </Button>
                  </div>
                </div>

                {/* Form nhập tay chi tiết */}
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1"><Label className="text-xs font-semibold">Số Commercial Invoice</Label><Input className="h-8 text-xs font-mono font-bold" value={profile.invoiceNumber || ''} onChange={(e) => update('invoiceNumber', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs font-semibold">Ngày Invoice</Label><Input type="date" className="h-8 text-xs" value={profile.invoiceDate || ''} onChange={(e) => update('invoiceDate', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs font-semibold">Nơi phát hành</Label><Input className="h-8 text-xs" value={profile.invoiceIssuePlace || ''} onChange={(e) => update('invoiceIssuePlace', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs font-semibold">PO / Contract ID</Label><Input className="h-8 text-xs font-mono" value={profile.poContractId || ''} onChange={(e) => update('poContractId', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs font-semibold">Tiền tệ (ISO 4217)</Label><Input className="h-8 text-xs font-mono" value={profile.currency || 'USD'} onChange={(e) => update('currency', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs font-semibold">Điều khoản thanh toán</Label><Input className="h-8 text-xs" value={profile.paymentTerms || ''} onChange={(e) => update('paymentTerms', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs font-semibold">Incoterm</Label><Input className="h-8 text-xs" value={profile.incotermCode || 'FOB'} onChange={(e) => update('incotermCode', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs font-semibold">Địa điểm Incoterm</Label><Input className="h-8 text-xs" value={profile.incotermLocation || ''} onChange={(e) => update('incotermLocation', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs font-semibold">Số tờ khai hải quan</Label><Input className="h-8 text-xs font-mono" value={profile.customsDeclarationNo || ''} onChange={(e) => update('customsDeclarationNo', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs font-semibold">Cước vận chuyển (USD)</Label><Input type="number" className="h-8 text-xs" value={profile.freightAmount ?? ''} onChange={(e) => update('freightAmount', e.target.value === '' ? null : Number(e.target.value))} /></div>
                  <div className="space-y-1"><Label className="text-xs font-semibold">Bảo hiểm (USD)</Label><Input type="number" className="h-8 text-xs" value={profile.insuranceAmount ?? ''} onChange={(e) => update('insuranceAmount', e.target.value === '' ? null : Number(e.target.value))} /></div>
                  <div className="space-y-1"><Label className="text-xs font-semibold">Customs value đối soát</Label><Input type="number" className="h-8 text-xs" value={profile.customsValueAmount ?? ''} onChange={(e) => update('customsValueAmount', e.target.value === '' ? null : Number(e.target.value))} /></div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 pt-2 border-t">
                  <div className="rounded-lg border p-3 bg-slate-50/50 space-y-2">
                    <b className="text-xs font-bold uppercase text-slate-800">Đơn vị Xuất khẩu (Exporter)</b>
                    <Input placeholder="Tên công ty" className="h-8 text-xs" value={profile.exporter.name || ''} onChange={(e) => updateParty('exporter', 'name', e.target.value)} />
                    <Input placeholder="Địa chỉ" className="h-8 text-xs" value={profile.exporter.address || ''} onChange={(e) => updateParty('exporter', 'address', e.target.value)} />
                    <Input placeholder="Quốc gia (VN)" className="h-8 text-xs" maxLength={2} value={profile.exporter.country || 'VN'} onChange={(e) => updateParty('exporter', 'country', e.target.value.toUpperCase())} />
                  </div>
                  <div className="rounded-lg border p-3 bg-slate-50/50 space-y-2">
                    <b className="text-xs font-bold uppercase text-slate-800">Đơn vị Nhập khẩu (Importer)</b>
                    <Input placeholder="Tên công ty buyer" className="h-8 text-xs" value={profile.importer.name || ''} onChange={(e) => updateParty('importer', 'name', e.target.value)} />
                    <Input placeholder="Địa chỉ" className="h-8 text-xs" value={profile.importer.address || ''} onChange={(e) => updateParty('importer', 'address', e.target.value)} />
                    <Input placeholder="EORI của importer" className="h-8 text-xs font-mono" value={profile.importerEori || ''} onChange={(e) => update('importerEori', e.target.value)} />
                  </div>
                </div>

                {/* Phát hành R01 */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
                  <Button
                    size="sm"
                    className="bg-emerald-800 hover:bg-emerald-900 text-white"
                    disabled={Boolean(busy)}
                    onClick={() => void run('save', () => saveShipmentExportProfile(shipmentId, profile), 'Đã lưu Commercial Invoice R01.')}
                  >
                    <Save className="mr-1.5 h-4 w-4" /> Lưu thông số R01
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(busy)}
                      onClick={() => void run('generate-commercial_invoice', () => generateShipmentExportDocument(shipmentId, 'commercial_invoice', 'pdf'), 'Đã đưa bản PDF Invoice vào hàng đợi tạo file.')}
                    >
                      Tạo bản review PDF
                    </Button>
                    {latestDocuments.get('commercial_invoice')?.reportId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void downloadReportFile(latestDocuments.get('commercial_invoice')!.reportId!, 'commercial_invoice.pdf')}
                      >
                        <Download className="mr-1 h-3.5 w-3.5" /> Tải file
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* -------------------- POPUP R02: PACKING LIST -------------------- */}
            {activeR === 'R02' && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1"><Label className="text-xs font-semibold">Số Packing List</Label><Input className="h-8 text-xs font-mono font-bold" value={profile.packingListNumber || ''} onChange={(e) => update('packingListNumber', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs font-semibold">Ngày Packing List</Label><Input type="date" className="h-8 text-xs" value={profile.packingListDate || ''} onChange={(e) => update('packingListDate', e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs font-semibold">PO tham chiếu</Label><Input className="h-8 text-xs font-mono" value={profile.poContractId || ''} onChange={(e) => update('poContractId', e.target.value)} /></div>
                </div>

                {/* Quản lý Container */}
                <div className="rounded-xl border p-3.5 bg-slate-50/50 space-y-3">
                  <b className="text-xs font-bold uppercase text-slate-800">1. Container & Khóa Seal</b>
                  <div className="grid gap-2 md:grid-cols-5">
                    <Input placeholder="Số container" className="h-8 text-xs font-mono" value={newContainer.containerNumber} onChange={(e) => setNewContainer((c) => ({ ...c, containerNumber: e.target.value }))} />
                    <Input placeholder="Số seal" className="h-8 text-xs font-mono" value={newContainer.sealNumber} onChange={(e) => setNewContainer((c) => ({ ...c, sealNumber: e.target.value }))} />
                    <Input placeholder="Loại (40HC)" className="h-8 text-xs" value={newContainer.equipmentType} onChange={(e) => setNewContainer((c) => ({ ...c, equipmentType: e.target.value }))} />
                    <Input placeholder="Marks & numbers" className="h-8 text-xs" value={newContainer.marksAndNumbers} onChange={(e) => setNewContainer((c) => ({ ...c, marksAndNumbers: e.target.value }))} />
                    <Button size="sm" variant="outline" className="h-8 text-xs bg-white" onClick={() => void run('container', async () => {
                      await createShipmentContainer(shipmentId, {
                        containerNumber: newContainer.containerNumber, sealNumber: newContainer.sealNumber,
                        equipmentType: newContainer.equipmentType, marksAndNumbers: newContainer.marksAndNumbers,
                        tareWeightKg: newContainer.tareWeightKg === '' ? null : Number(newContainer.tareWeightKg),
                        maxGrossWeightKg: newContainer.maxGrossWeightKg === '' ? null : Number(newContainer.maxGrossWeightKg)
                      });
                      setNewContainer(emptyContainerForm());
                    }, 'Đã thêm container.')} disabled={!newContainer.containerNumber || !newContainer.sealNumber || Boolean(busy)}>
                      <PackagePlus className="mr-1 h-3.5 w-3.5" /> Thêm Container
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    {(bundle?.containers || []).map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 p-2 rounded bg-white border text-xs">
                        <span className="font-mono font-semibold">{c.containerNumber} / Seal: {c.sealNumber} ({c.equipmentType})</span>
                        <Badge variant="outline" className="text-[10px]">Đã gán</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quản lý Kiện hàng & Pallet */}
                <div className="rounded-xl border p-3.5 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <b className="text-xs font-bold uppercase text-slate-800">2. Kiện hàng ({bundle?.packages.length || 0} kiện)</b>
                    <Button size="sm" variant="outline" className="h-7 text-xs bg-white" onClick={() => void run('sync', () => syncShipmentExportLines(shipmentId), 'Đã đồng bộ dòng hàng.')} disabled={Boolean(busy)}>
                      Đồng bộ Dòng hàng SKU
                    </Button>
                  </div>

                  <div className="grid gap-2 md:grid-cols-4">
                    <Input placeholder="Mã kiện" className="h-8 text-xs" value={newPackage.packageNumber} onChange={(e) => setNewPackage((c) => ({ ...c, packageNumber: e.target.value }))} />
                    <Select value={newPackage.packageType} onValueChange={(val) => setNewPackage((c) => ({ ...c, packageType: val }))}>
                      <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="carton">Carton</SelectItem><SelectItem value="pallet">Pallet</SelectItem><SelectItem value="crate">Crate</SelectItem></SelectContent>
                    </Select>
                    <Select value={newPackage.containerId} onValueChange={(val) => setNewPackage((c) => ({ ...c, containerId: val }))}>
                      <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="Chọn container" /></SelectTrigger>
                      <SelectContent>{(bundle?.containers || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.containerNumber}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" className="h-8 text-xs bg-white" onClick={() => void run('package', async () => {
                      await createShipmentPackage(shipmentId, {
                        packageNumber: newPackage.packageNumber, packageType: newPackage.packageType,
                        marksAndNumbers: newPackage.marksAndNumbers, quantity: Number(newPackage.quantity || 1),
                        netWeightKg: Number(newPackage.netWeightKg || 10), grossWeightKg: Number(newPackage.grossWeightKg || 12),
                        lengthCm: Number(newPackage.lengthCm || 60), widthCm: Number(newPackage.widthCm || 40), heightCm: Number(newPackage.heightCm || 40),
                        contents: newPackage.packageType === 'pallet' ? [] : parsePackageContents(newPackage.contentsText),
                        containerId: newPackage.containerId, parentPackageId: newPackage.parentPackageId || null,
                        sequenceNo: null, weightMeasurementBasis: newPackage.weightMeasurementBasis, dimensionMeasurementBasis: newPackage.dimensionMeasurementBasis
                      });
                      setNewPackage(emptyPackageForm());
                    }, 'Đã thêm kiện hàng.')} disabled={!newPackage.packageNumber || !newPackage.containerId || Boolean(busy)}>
                      <PackagePlus className="mr-1 h-3.5 w-3.5" /> Thêm kiện
                    </Button>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                    {(bundle?.packages || []).map((pkg) => (
                      <div key={pkg.id} className="flex items-center justify-between p-2 rounded bg-white border text-xs">
                        <span>{pkg.packageNumber} ({pkg.packageType}) · {pkg.quantity} chiếc · Net: {pkg.netWeightKg}kg / Gross: {pkg.grossWeightKg}kg</span>
                        <Badge variant="outline" className="text-[10px]">Đầy đủ</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Phát hành R02 */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
                  <Button
                    size="sm"
                    className="bg-emerald-800 hover:bg-emerald-900 text-white"
                    disabled={Boolean(busy)}
                    onClick={() => void run('save', () => saveShipmentExportProfile(shipmentId, profile), 'Đã lưu Packing List R02.')}
                  >
                    <Save className="mr-1.5 h-4 w-4" /> Lưu thông số R02
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(busy)}
                      onClick={() => void run('generate-packing_list', () => generateShipmentExportDocument(shipmentId, 'packing_list', 'pdf'), 'Đã đưa bản PDF Packing List vào hàng đợi tạo file.')}
                    >
                      Tạo bản review PDF
                    </Button>
                    {latestDocuments.get('packing_list')?.reportId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void downloadReportFile(latestDocuments.get('packing_list')!.reportId!, 'packing_list.pdf')}
                      >
                        <Download className="mr-1 h-3.5 w-3.5" /> Tải file
                      </Button>
                    )}
                  </div>
                </div>
              </div>
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
