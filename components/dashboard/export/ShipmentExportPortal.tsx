'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
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
  SlidersHorizontal,
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

const formatPackageContents = (contents: unknown[]) => contents.map((item) => {
  const value = item as { lineNumber?: number; quantity?: number };
  return value.lineNumber && value.quantity ? `${value.lineNumber}:${value.quantity}` : '';
}).filter(Boolean).join(',');

const packageCbm = (pkg: Pick<ShipmentPackage, 'quantity' | 'lengthCm' | 'widthCm' | 'heightCm' | 'dimensionMeasurementBasis'>) =>
  (pkg.dimensionMeasurementBasis === 'group_total' ? 1 : Number(pkg.quantity || 0))
  * Number(pkg.lengthCm || 0) * Number(pkg.widthCm || 0) * Number(pkg.heightCm || 0) / 1_000_000;

interface DossierMeta {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  badgeTone: string;
  description: string;
  icon: React.ElementType;
}

const DOSSIER_LIST: DossierMeta[] = [
  {
    id: 'reach',
    title: 'Hồ sơ REACH SVHC (Chất cấm EU)',
    subtitle: 'EU REACH Regulation (EC 1907/2006)',
    tag: 'REACH · Bắt buộc EU',
    badgeTone: 'bg-red-50 text-red-700 border-red-200',
    description: 'Sàng lọc và quản lý nồng độ chất nguy hại rất đáng quan ngại (SVHC > 0.1% w/w) cho dệt may & da giày xuất khẩu EU.',
    icon: FlaskConical
  },
  {
    id: 'gpsr',
    title: 'Hồ sơ Kỹ thuật GPSR',
    subtitle: 'EU General Product Safety (EU 2023/988)',
    tag: 'GPSR · EU 2024',
    badgeTone: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Hồ sơ kỹ thuật an toàn sản phẩm chung, truy vết nguồn gốc, cảnh báo rủi ro và người đại diện EU (Responsible Person).',
    icon: ShieldCheck
  },
  {
    id: 'pcf',
    title: 'Nghiên cứu PCF & LCA Carbon',
    subtitle: 'Product Carbon Footprint (ISO 14067)',
    tag: 'ISO 14067 · PCF',
    badgeTone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Báo cáo tính toán dấu chân carbon sản phẩm theo phân đoạn từ cái nôi đến cổng (Cradle-to-Gate) phục vụ kiểm toán.',
    icon: Leaf
  },
  {
    id: 'textile_label',
    title: 'Ghi nhãn Xơ sợi Dệt may',
    subtitle: 'EU Textile Regulation 1007/2011',
    tag: 'Ghi nhãn dệt may',
    badgeTone: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Bảng đối soát tỷ lệ phần trăm xơ sợi, nguồn gốc tái chế và nhãn chăm sóc đa ngôn ngữ theo quy định EU/US.',
    icon: Tag
  },
  {
    id: 'environmental_claim',
    title: 'Đăng ký Công bố Môi trường',
    subtitle: 'ISO 14021 & Green Claims',
    tag: 'Green Claims',
    badgeTone: 'bg-teal-50 text-teal-700 border-teal-200',
    description: 'Đăng ký và xác minh tính pháp lý của các công bố bền vững (Recycled, Eco-friendly, Carbon Neutral) chống Greenwashing.',
    icon: CheckCircle2
  },
  {
    id: 'vn_customs',
    title: 'Bàn giao Hải quan Việt Nam',
    subtitle: 'Vietnam Customs Broker Handoff',
    tag: 'Hải quan VN (VNACCS)',
    badgeTone: 'bg-slate-100 text-slate-800 border-slate-200',
    description: 'Bộ dữ liệu chuẩn hóa phục vụ đại lý khai báo tờ khai xuất khẩu thông quan tại chi cục hải quan cửa khẩu.',
    icon: FileText
  },
  {
    id: 'eu_import',
    title: 'Bàn giao Nhập khẩu EU (EUCDM)',
    subtitle: 'EU Customs Data Model Handoff',
    tag: 'EU Import Declarant',
    badgeTone: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    description: 'Gói dữ liệu điện tử bàn giao cho đơn vị thông quan nhập khẩu tại cảng đến theo mô hình dữ liệu EUCDM.',
    icon: Globe
  },
  {
    id: 'ics2',
    title: 'Dữ liệu An ninh Vận tải ICS2/ENS',
    subtitle: 'EU Import Control System 2',
    tag: 'ICS2 · Hãng tàu/Carrier',
    badgeTone: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Dữ liệu an ninh khai trước (Entry Summary Declaration - ENS) bắt buộc chuyển giao cho hãng vận tải / hãng tàu trước khi bốc hàng.',
    icon: Box
  },
  {
    id: 'origin',
    title: 'Hồ sơ Hỗ trợ Xuất xứ EVFTA',
    subtitle: 'Rules of Origin (RVC / CTC)',
    tag: 'Quy tắc xuất xứ',
    badgeTone: 'bg-orange-50 text-orange-700 border-orange-200',
    description: 'Bảng tính giá trị gia tăng nội khối RVC và chuyển đổi mã số hàng hóa CTC phục vụ xin C/O form EUR.1.',
    icon: Compass
  },
  {
    id: 'compliance_applicability',
    title: 'Mức độ Áp dụng Quy định',
    subtitle: 'Multi-regulation screening',
    tag: 'Sàng lọc quy định',
    badgeTone: 'bg-sky-50 text-sky-700 border-sky-200',
    description: 'Ma trận đối soát tự động các quy chuẩn bắt buộc và khuyến nghị theo danh mục thị trường xuất khẩu mục tiêu.',
    icon: Layers
  },
  {
    id: 'carrier_documents',
    title: 'Chứng từ Vận tải & Hãng tàu',
    subtitle: 'Carrier B/L, Booking & VGM documents',
    tag: 'Chứng từ vận tải',
    badgeTone: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    description: 'Lưu trữ và đối chiếu số vận đơn chính thức, phiếu cân VGM, booking confirmation do carrier phát hành.',
    icon: Ship
  }
];

export default function ShipmentExportPortal() {
  const [shipments, setShipments] = useState<LogisticsShipmentSummary[]>([]);
  const [shipmentId, setShipmentId] = useState('');
  const [bundle, setBundle] = useState<ShipmentExportBundle | null>(null);
  const [profile, setProfile] = useState<ShipmentExportProfile>(emptyShipmentExportProfile());
  const [readiness, setReadiness] = useState<ExportReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // Modals state for streamlined UX
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isContainersModalOpen, setIsContainersModalOpen] = useState(false);
  const [activeDossier, setActiveDossier] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [lineEdits, setLineEdits] = useState<Record<string, Partial<ShipmentExportLine>>>({});
  const [containerEdits, setContainerEdits] = useState<Record<string, Partial<ShipmentContainer>>>({});
  const [packageEdits, setPackageEdits] = useState<Record<string, Partial<ShipmentPackage>>>({});
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

  // 1-Click Demo Preset for fast onboarding / test
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
      discountAmount: 0,
      surchargeAmount: 120,
      customsValueAmount: 38500,
      customsValueBasis: 'FOB value + standard insurance adjustment',
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
      },
      consignee: {
        name: 'Nordic Logistics Center',
        address: 'Maasvlakte 2, Haven 9800, Rotterdam',
        country: 'NL',
        contact: 'receiving@nordiclogistics.nl'
      },
      notifyParty: {
        name: 'Same as Consignee',
        address: 'Maasvlakte 2, Haven 9800, Rotterdam',
        country: 'NL',
        contact: 'notify@nordiclogistics.nl'
      }
    }));
    setIsImportModalOpen(false);
    toast.success('Đã nạp bộ dữ liệu mẫu xuất khẩu Châu Âu thành công!');
  };

  // Download Sample Excel Template
  const handleDownloadTemplate = (format: 'xlsx' | 'csv' = 'xlsx') => {
    const templateData = [
      {
        'Số Commercial Invoice': 'INV-2026-EU-089',
        'Ngày invoice': '2026-06-15',
        'Nơi phát hành': 'Hanoi, Vietnam',
        'Số Packing List': 'PKL-2026-EU-089',
        'Ngày Packing List': '2026-06-15',
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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ThongSoXuatKhau');

    if (format === 'csv') {
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'mau_thong_so_xuat_khau.csv';
      link.click();
    } else {
      XLSX.writeFile(workbook, 'mau_thong_so_xuat_khau.xlsx');
    }
    toast.success(`Đã tải file mẫu ${format.toUpperCase()}`);
  };

  // Import from Excel or CSV
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

      if (!rows.length) {
        throw new Error('File dữ liệu trống.');
      }

      const row = rows[0];
      const getString = (keys: string[]) => {
        for (const k of keys) {
          const val = row[k];
          if (val !== undefined && val !== null && String(val).trim()) {
            return String(val).trim();
          }
        }
        return '';
      };

      const getNum = (keys: string[]) => {
        for (const k of keys) {
          const val = row[k];
          if (val !== undefined && val !== null && !isNaN(Number(val))) {
            return Number(val);
          }
        }
        return null;
      };

      setProfile((prev) => ({
        ...prev,
        invoiceNumber: getString(['Số Commercial Invoice', 'invoiceNumber', 'invoice_number', 'so_invoice']) || prev.invoiceNumber,
        invoiceDate: getString(['Ngày invoice', 'invoiceDate', 'invoice_date', 'ngay_invoice']) || prev.invoiceDate,
        invoiceIssuePlace: getString(['Nơi phát hành', 'invoiceIssuePlace', 'noi_phat_hanh']) || prev.invoiceIssuePlace,
        packingListNumber: getString(['Số Packing List', 'packingListNumber', 'packing_list_number', 'so_packing_list']) || prev.packingListNumber,
        packingListDate: getString(['Ngày Packing List', 'packingListDate', 'ngay_packing_list']) || prev.packingListDate,
        poContractId: getString(['PO / Contract ID', 'poContractId', 'po', 'contract_id']) || prev.poContractId,
        currency: getString(['Tiền tệ', 'currency', 'tien_te']) || prev.currency,
        paymentTerms: getString(['Điều khoản thanh toán', 'paymentTerms', 'dieu_khoan_thanh_toan']) || prev.paymentTerms,
        incotermCode: getString(['Incoterm', 'incotermCode', 'incoterm']) || prev.incotermCode,
        incotermLocation: getString(['Địa điểm Incoterm', 'incotermLocation', 'dia_diem_incoterm']) || prev.incotermLocation,
        exporterTaxId: getString(['MST Exporter', 'exporterTaxId', 'ma_so_thue_exporter']) || prev.exporterTaxId,
        portOfLoading: getString(['Cảng xếp hàng', 'portOfLoading', 'cang_xep_hang']) || prev.portOfLoading,
        portOfDischarge: getString(['Cảng dỡ hàng', 'portOfDischarge', 'cang_do_hang']) || prev.portOfDischarge,
        placeOfDelivery: getString(['Nơi giao hàng', 'placeOfDelivery', 'noi_giao_hang']) || prev.placeOfDelivery,
        vesselName: getString(['Tên tàu', 'vesselName', 'ten_tau']) || prev.vesselName,
        voyageNumber: getString(['Số voyage', 'voyageNumber', 'so_voyage']) || prev.voyageNumber,
        billOfLadingNo: getString(['Số B/L', 'billOfLadingNo', 'so_bl', 'bl_no']) || prev.billOfLadingNo,
        carrierName: getString(['Hãng vận tải', 'carrierName', 'hang_van_tai']) || prev.carrierName,
        importerEori: getString(['EORI Importer', 'importerEori', 'eori']) || prev.importerEori,
        customsDeclarationNo: getString(['Số tờ khai hải quan', 'customsDeclarationNo', 'to_khai_hai_quan']) || prev.customsDeclarationNo,
        freightAmount: getNum(['Cước vận chuyển', 'freightAmount', 'cuoc_van_chuyen']) ?? prev.freightAmount,
        insuranceAmount: getNum(['Bảo hiểm', 'insuranceAmount', 'bao_hiem']) ?? prev.insuranceAmount,
        exporter: {
          ...prev.exporter,
          name: getString(['Tên Exporter', 'exporterName', 'exporter_name']) || prev.exporter.name,
          address: getString(['Địa chỉ Exporter', 'exporterAddress']) || prev.exporter.address,
        },
        importer: {
          ...prev.importer,
          name: getString(['Tên Importer', 'importerName', 'importer_name']) || prev.importer.name,
          address: getString(['Địa chỉ Importer', 'importerAddress']) || prev.importer.address,
        }
      }));

      setIsImportModalOpen(false);
      toast.success('Đã nạp thành công thông số lô hàng từ file!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi đọc file Excel/CSV.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const selectedDossierMeta = useMemo(() => {
    return DOSSIER_LIST.find((item) => item.id === activeDossier) || null;
  }, [activeDossier]);

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
    <div className="space-y-6">
      {/* Thông báo banner chuẩn hóa */}
      <Card className="border-emerald-200/80 bg-gradient-to-r from-emerald-50/70 via-teal-50/30 to-white shadow-xs">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-800 text-white shadow-xs">
              <Ship className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                Trung tâm Điều hành Xuất khẩu Xanh (Green Export Gateway)
              </p>
              <p className="text-xs text-slate-600">
                Chuẩn hóa bộ chứng từ thương mại & kỹ thuật: CBAM, EU ESPR, REACH SVHC, GPSR, B/L Carbon Annex.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-emerald-300 bg-white text-emerald-800 font-semibold text-xs py-1 px-2.5">
            ISO 14067 · GLEC v3.0
          </Badge>
        </CardContent>
      </Card>

      {/* SECTION 1: Chọn lô hàng & Tiến độ */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-800" />
              1. Lô hàng Xuất khẩu mục tiêu
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void reload()}
                disabled={!shipmentId || Boolean(busy)}
                className="text-xs h-8"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Làm mới
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-[1fr_auto]">
            <Select value={shipmentId} onValueChange={setShipmentId}>
              <SelectTrigger className="h-10 text-sm font-medium">
                <SelectValue placeholder="Chọn lô hàng xuất khẩu..." />
              </SelectTrigger>
              <SelectContent>
                {shipments.map((shipment) => (
                  <SelectItem key={shipment.id} value={shipment.id}>
                    📦 {shipment.referenceNumber || shipment.id} · {shipment.origin.country} ➔ {shipment.destination.country} ({shipment.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {readiness && (
              <div className="flex items-center gap-3 rounded-lg border bg-slate-50 px-3.5 py-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Mức hoàn thiện hồ sơ:</span>
                    <span className="text-sm font-bold text-emerald-800">{readiness.documentCompleteness}%</span>
                  </div>
                  <Progress value={readiness.documentCompleteness} className="h-1.5 w-32" />
                </div>
                <Badge variant={readiness.status === 'ready_to_issue' ? 'default' : 'outline'} className="text-xs capitalize">
                  {readiness.status}
                </Badge>
              </div>
            )}
          </div>

          {shipments.length === 0 && (
            <p className="text-sm text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
              Chưa có lô hàng nào. Hãy tạo shipment trong mục Logistics trước để tiến hành xuất khẩu.
            </p>
          )}
        </CardContent>
      </Card>

      {shipmentId && bundle && (
        <>
          {/* SECTION 2: Tóm tắt Hồ sơ Thương mại & Thanh công cụ Import / Chỉnh sửa */}
          <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/80 border-b pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-emerald-800" />
                    2. Hồ sơ Thương mại & Vận tải (Commercial & Logistics)
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Đồng bộ số Invoice, Packing List, hợp đồng PO, vận đơn B/L và thông tin hải quan.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs h-8 gap-1.5 shadow-xs"
                    onClick={() => setIsImportModalOpen(true)}
                  >
                    <Upload className="h-3.5 w-3.5 text-emerald-200" />
                    Import từ File (Excel / CSV)
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 gap-1.5"
                    onClick={() => setIsEditModalOpen(true)}
                  >
                    <Pencil className="h-3.5 w-3.5 text-slate-600" />
                    Chỉnh sửa chi tiết
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                    disabled={Boolean(busy)}
                    onClick={() => void run('save', () => saveShipmentExportProfile(shipmentId, profile), 'Đã lưu hồ sơ lô hàng.')}
                  >
                    <Save className="h-3.5 w-3.5" />
                    Lưu hồ sơ
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5">
              {/* Grid tóm tắt các thông số cốt lõi */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 space-y-1">
                  <span className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider block">Commercial Invoice</span>
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {profile.invoiceNumber || <span className="text-slate-400 font-normal italic">Chưa nhập</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    Ngày: {profile.invoiceDate || '—'} · {profile.currency || 'USD'}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 space-y-1">
                  <span className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider block">Hợp đồng PO & Packing List</span>
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {profile.poContractId || <span className="text-slate-400 font-normal italic">Chưa có PO</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    P/L: {profile.packingListNumber || 'Chưa lập'}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 space-y-1">
                  <span className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider block">Vận đơn & Hãng tàu</span>
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {profile.billOfLadingNo || <span className="text-slate-400 font-normal italic">Chưa có B/L</span>}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {profile.carrierName || 'Carrier'} · Tàu {profile.vesselName || '—'}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 space-y-1">
                  <span className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider block">Tuyến đường & Incoterm</span>
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {profile.incotermCode || 'FOB'} · {profile.portOfLoading || 'Cảng đi'} ➔ {profile.portOfDischarge || 'Cảng đến'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    Tờ khai: {profile.customsDeclarationNo || 'Chưa khai báo'}
                  </p>
                </div>
              </div>

              {/* Tóm tắt bên mua / bên bán */}
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-900">Bên xuất khẩu:</span>
                  <span>{profile.exporter.name || 'WeaveCarbon Garment JSC'} ({profile.exporter.country || 'VN'})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-900">Bên nhập khẩu:</span>
                  <span>{profile.importer.name || 'Buyer Partner'} ({profile.importer.country || 'EU'})</span>
                  {profile.importerEori && (
                    <Badge variant="outline" className="text-[10px] ml-1 bg-white">
                      EORI: {profile.importerEori}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 3: Tóm tắt Container & Kiện hàng */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Box className="h-5 w-5 text-emerald-800" />
                    3. Đóng gói, Container & Dòng hàng (Carton & Pallet)
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cấu trúc phân bổ kiện theo pallet, container và snapshot danh mục SKU mã HS/CN.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs h-8 gap-1.5 border-slate-300"
                    onClick={() => setIsContainersModalOpen(true)}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-slate-600" />
                    Quản lý chi tiết Container & Kiện hàng (Pop-up)
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-slate-50/50 p-3.5 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                    <Ship className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Số Container</span>
                    <span className="text-base font-bold text-slate-900">
                      {(bundle.containers || []).length} Container
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border bg-slate-50/50 p-3.5 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-800">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Số Kiện / Pallet</span>
                    <span className="text-base font-bold text-slate-900">
                      {bundle.packages.length} Kiện hàng
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border bg-slate-50/50 p-3.5 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-800">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Dòng hàng Snapshot</span>
                    <span className="text-base font-bold text-slate-900">
                      {bundle.lines.length} Dòng SKU
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 4: HUB QUY ĐỊNH & HỒ SƠ KỸ THUẬT (REACH SVHC, GPSR, PCF...) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-800" />
                  4. Hồ sơ Tuân thủ & Bàn giao Kỹ thuật (Compliance Dossiers Hub)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Chọn bất kỳ quy định nào bên dưới để mở cửa sổ Pop-up thực hiện kiểm tra, tải chứng từ và khóa kiểm toán.
                </p>
              </div>
              <Badge variant="outline" className="text-xs text-slate-600 bg-white">
                11 Nhóm Hồ sơ Chuẩn Quốc tế
              </Badge>
            </div>

            {/* Grid 11 Thẻ Quy định */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DOSSIER_LIST.map((dossier) => {
                const Icon = dossier.icon;
                return (
                  <Card
                    key={dossier.id}
                    className="group relative cursor-pointer border border-slate-200 bg-white shadow-xs transition-all hover:border-emerald-400 hover:shadow-md hover:bg-emerald-50/10 rounded-xl"
                    onClick={() => setActiveDossier(dossier.id)}
                  >
                    <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 group-hover:bg-emerald-800 group-hover:text-white transition-colors">
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <Badge variant="outline" className={`text-[10px] ${dossier.badgeTone}`}>
                            {dossier.tag}
                          </Badge>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 mt-2.5 group-hover:text-emerald-800 transition-colors">
                          {dossier.title}
                        </h4>
                        <p className="text-[11px] font-medium text-slate-500">
                          {dossier.subtitle}
                        </p>
                        <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                          {dossier.description}
                        </p>
                      </div>

                      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-emerald-800 font-semibold">
                        <span>Mở thực hiện hồ sơ</span>
                        <ChevronRight className="h-3.5 w-3.5 transform group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* SECTION 5: MỨC HOÀN THIỆN TÀI LIỆU & PHÁT HÀNH (ISSUE / REVIEW) */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileCheck2 className="h-5 w-5 text-emerald-800" />
                  5. Bàn giao & Phát hành Bộ Chứng từ Xuất khẩu (Document Issue & Review)
                </CardTitle>
                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 text-xs">
                  CBAM: {readiness?.cbam.status || 'Đang rà soát'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Tạo bản review đối soát, ghi nhận phê duyệt nghiệp vụ và phát hành phiên bản bất biến gắn mã băm SHA-256.
              </p>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {readiness?.documents.map((doc) => {
                  const existing = latestDocuments.get(doc.type);
                  const ready = doc.status === 'ready';
                  const supportsPdf = ['commercial_invoice', 'packing_list'].includes(doc.type);
                  const supportsHandoffFormats = ['ics2_dataset', 'vn_customs_handoff', 'eu_import_handoff', 'origin_workbook'].includes(doc.type);
                  const selectedFormat = documentFormats[doc.type]
                    || (supportsHandoffFormats ? 'json' : 'xlsx');

                  return (
                    <div key={doc.type} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <b className="text-sm font-semibold text-slate-900">{DOCUMENT_LABELS[doc.type]}</b>
                          {ready ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                          )}
                        </div>
                        <Badge variant={ready ? 'default' : 'outline'} className="text-[10px]">
                          {doc.status}
                        </Badge>
                        {!ready && doc.messages.slice(0, 2).map((message) => (
                          <p key={message} className="text-xs text-red-700">• {message}</p>
                        ))}

                        {supportsPdf && (
                          <Select
                            value={selectedFormat}
                            onValueChange={(value) => setDocumentFormats((current) => ({ ...current, [doc.type]: value as ExportOutputFormat }))}
                          >
                            <SelectTrigger className="h-8 text-xs bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pdf">PDF / Bản in ký số</SelectItem>
                              <SelectItem value="xlsx">XLSX / Bảng tính</SelectItem>
                            </SelectContent>
                          </Select>
                        )}

                        {supportsHandoffFormats && (
                          <Select
                            value={selectedFormat}
                            onValueChange={(value) => setDocumentFormats((current) => ({ ...current, [doc.type]: value as ExportOutputFormat }))}
                          >
                            <SelectTrigger className="h-8 text-xs bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="json">JSON / Cấu trúc điện tử</SelectItem>
                              <SelectItem value="xlsx">XLSX / Bảng tính</SelectItem>
                            </SelectContent>
                          </Select>
                        )}

                        {existing?.reportStatus === 'completed' && existing.requiredReviewerRole && existing.status === 'ready' && (
                          <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-2 text-xs">
                            <p className="text-[11px] text-slate-600">
                              <b>Duyệt:</b> {REVIEW_ROLE_LABELS[existing.requiredReviewerRole]}
                            </p>
                            <Input
                              placeholder="Ghi chú đối chiếu..."
                              className="h-7 text-xs"
                              value={reviewNotes[existing.id] || ''}
                              onChange={(event) => setReviewNotes((current) => ({ ...current, [existing.id]: event.target.value }))}
                            />
                            <div className="flex gap-1.5 pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] px-2"
                                disabled={Boolean(busy)}
                                onClick={() => void run(`review-${existing.id}`, () => reviewShipmentExportDocument(shipmentId, existing.id, { reviewerRole: existing.requiredReviewerRole!, decision: 'approved', notes: reviewNotes[existing.id] }), 'Đã duyệt.')}
                              >
                                Duyệt
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] px-2 text-amber-700"
                                disabled={Boolean(busy)}
                                onClick={() => void run(`review-${existing.id}`, () => reviewShipmentExportDocument(shipmentId, existing.id, { reviewerRole: existing.requiredReviewerRole!, decision: 'changes_requested', notes: reviewNotes[existing.id] }), 'Đã yêu cầu sửa.')}
                              >
                                Yêu cầu sửa
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          disabled={!ready || Boolean(busy)}
                          className="h-8 text-xs flex-1 bg-emerald-800 hover:bg-emerald-900"
                          onClick={() => void run(`generate-${doc.type}`, () => generateShipmentExportDocument(shipmentId, doc.type, selectedFormat), `Đã đưa bản ${selectedFormat.toUpperCase()} vào hàng đợi tạo file.`)}
                        >
                          Tạo bản review
                        </Button>
                        {existing?.reportStatus === 'completed' && existing.reportId && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs bg-white"
                            onClick={() => void downloadReportFile(existing.reportId, existing.filename || `${doc.type}.${existing.outputFormat || 'xlsx'}`)}
                          >
                            <Download className="mr-1 h-3 w-3" />
                            Tải
                          </Button>
                        )}
                        {existing?.reportStatus === 'completed' && existing.status === 'ready' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                            disabled={!existing.readyToIssue || Boolean(busy)}
                            onClick={() => void run(`issue-${existing.id}`, () => issueShipmentExportDocument(shipmentId, existing.id), doc.type === 'origin_workbook' ? 'Đã khóa bản bàn giao nội bộ.' : 'Đã phát hành.')}
                          >
                            <FileCheck2 className="mr-1 h-3 w-3" />
                            Phát hành
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* DIALOG 1: IMPORT THÔNG SỐ XUẤT KHẨU TỪ FILE (EXCEL / CSV) */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileSpreadsheet className="h-5 w-5 text-emerald-800" />
              Import Thông số Lô hàng & Xuất khẩu
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Nhập tự động 27 thông số thương mại, hải quan, vận đơn và thông tin các bên từ file Excel/CSV thay vì gõ tay từng trường.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tùy chọn 1: Nạp dữ liệu mẫu nhanh 1-Click */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 flex items-center justify-between gap-3">
              <div>
                <b className="text-sm text-emerald-950 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-700" />
                  Nạp nhanh bộ dữ liệu mẫu xuất khẩu EU
                </b>
                <p className="text-xs text-emerald-800/80 mt-0.5">
                  Tự động điền đầy đủ Invoice, B/L ONE APUS, PO, Container 40HC, EORI & đối tác mẫu.
                </p>
              </div>
              <Button
                size="sm"
                className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs shrink-0"
                onClick={handleFillDemoPreset}
              >
                Nạp 1-Click
              </Button>
            </div>

            {/* Tùy chọn 2: Tải file mẫu */}
            <div className="rounded-xl border border-slate-200 p-3.5 space-y-2">
              <span className="text-xs font-semibold text-slate-700 block">Tải file mẫu chuẩn hóa:</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1.5 bg-white"
                  onClick={() => handleDownloadTemplate('xlsx')}
                >
                  <Download className="h-3.5 w-3.5" />
                  Tải Mẫu Excel (.xlsx)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1.5 bg-white"
                  onClick={() => handleDownloadTemplate('csv')}
                >
                  <Download className="h-3.5 w-3.5" />
                  Tải Mẫu CSV
                </Button>
              </div>
            </div>

            {/* Tùy chọn 3: Upload file của người dùng */}
            <div className="rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-emerald-500 transition-colors bg-slate-50/50">
              <FileUp className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="text-sm font-medium text-slate-700">Chọn hoặc kéo thả file Excel / CSV vào đây</p>
              <p className="text-xs text-slate-500 mt-1">Hỗ trợ các định dạng .xlsx, .xls, .csv</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                size="sm"
                variant="outline"
                className="mt-3 text-xs bg-white border-slate-300"
                onClick={() => fileInputRef.current?.click()}
              >
                Chọn File Từ Máy
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setIsImportModalOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: CHỈNH SỬA THỦ CÔNG CHI TIẾT (ORGANIZED IN TABS) */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Pencil className="h-5 w-5 text-emerald-800" />
              Chỉnh sửa Thông số Thương mại & Logistics
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Điều chỉnh các thông số phục vụ phát hành Commercial Invoice, Packing List và khai báo hải quan.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2">
            <Tabs defaultValue="invoice" className="w-full">
              <TabsList className="grid grid-cols-4 w-full mb-4 bg-slate-100">
                <TabsTrigger value="invoice" className="text-xs">1. Hóa đơn & PO</TabsTrigger>
                <TabsTrigger value="logistics" className="text-xs">2. Vận tải & Hãng tàu</TabsTrigger>
                <TabsTrigger value="customs" className="text-xs">3. Hải quan & Phí</TabsTrigger>
                <TabsTrigger value="parties" className="text-xs">4. Các bên (Parties)</TabsTrigger>
              </TabsList>

              {/* TAB 1: HÓA ĐƠN & PO */}
              <TabsContent value="invoice" className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Số Commercial Invoice</Label>
                    <Input value={profile.invoiceNumber || ''} onChange={(e) => update('invoiceNumber', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ngày invoice</Label>
                    <Input type="date" value={profile.invoiceDate || ''} onChange={(e) => update('invoiceDate', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nơi phát hành invoice</Label>
                    <Input value={profile.invoiceIssuePlace || ''} onChange={(e) => update('invoiceIssuePlace', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">PO / Contract ID</Label>
                    <Input value={profile.poContractId || ''} onChange={(e) => update('poContractId', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Số Packing List</Label>
                    <Input value={profile.packingListNumber || ''} onChange={(e) => update('packingListNumber', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ngày Packing List</Label>
                    <Input type="date" value={profile.packingListDate || ''} onChange={(e) => update('packingListDate', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tiền tệ (ISO 4217)</Label>
                    <Input value={profile.currency || 'USD'} onChange={(e) => update('currency', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Điều khoản thanh toán</Label>
                    <Input value={profile.paymentTerms || ''} onChange={(e) => update('paymentTerms', e.target.value)} />
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: VẬN TẢI & HÃNG TÀU */}
              <TabsContent value="logistics" className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Phương thức vận tải</Label>
                    <Select value={profile.transportMode} onValueChange={(value) => update('transportMode', value)}>
                      <SelectTrigger><SelectValue placeholder="Chọn phương thức" /></SelectTrigger>
                      <SelectContent>
                        {transportModes.map((mode) => <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Số B/L/AWB/CMR</Label>
                    <Input value={profile.billOfLadingNo || ''} onChange={(e) => update('billOfLadingNo', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hãng vận tải / Carrier</Label>
                    <Input value={profile.carrierName || ''} onChange={(e) => update('carrierName', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tên tàu / Chuyến bay</Label>
                    <Input value={profile.vesselName || ''} onChange={(e) => update('vesselName', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Số voyage / Chuyến</Label>
                    <Input value={profile.voyageNumber || ''} onChange={(e) => update('voyageNumber', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Incoterm</Label>
                    <Input value={profile.incotermCode || 'FOB'} onChange={(e) => update('incotermCode', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cảng/nơi xếp hàng</Label>
                    <Input value={profile.portOfLoading || ''} onChange={(e) => update('portOfLoading', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cảng/nơi dỡ hàng</Label>
                    <Input value={profile.portOfDischarge || ''} onChange={(e) => update('portOfDischarge', e.target.value)} />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs">Nơi giao hàng (Place of Delivery)</Label>
                    <Input value={profile.placeOfDelivery || ''} onChange={(e) => update('placeOfDelivery', e.target.value)} />
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: HẢI QUAN & PHÍ */}
              <TabsContent value="customs" className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Số tờ khai hải quan</Label>
                    <Input value={profile.customsDeclarationNo || ''} onChange={(e) => update('customsDeclarationNo', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Mã số thuế exporter</Label>
                    <Input value={profile.exporterTaxId || ''} onChange={(e) => update('exporterTaxId', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">EORI của importer</Label>
                    <Input value={profile.importerEori || ''} onChange={(e) => update('importerEori', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">VAT ID của importer</Label>
                    <Input value={profile.importerVatId || ''} onChange={(e) => update('importerVatId', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cước vận chuyển</Label>
                    <Input type="number" value={profile.freightAmount ?? ''} onChange={(e) => update('freightAmount', e.target.value === '' ? null : Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Bảo hiểm</Label>
                    <Input type="number" value={profile.insuranceAmount ?? ''} onChange={(e) => update('insuranceAmount', e.target.value === '' ? null : Number(e.target.value))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Yêu cầu ưu đãi xuất xứ EVFTA</Label>
                    <Select value={profile.preferentialOriginClaim ? 'yes' : 'no'} onValueChange={(value) => update('preferentialOriginClaim', value === 'yes')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">Không</SelectItem>
                        <SelectItem value="yes">Có — cần chứng từ xuất xứ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Customs value để đối soát</Label>
                    <Input type="number" value={profile.customsValueAmount ?? ''} onChange={(e) => update('customsValueAmount', e.target.value === '' ? null : Number(e.target.value))} />
                  </div>
                </div>
              </TabsContent>

              {/* TAB 4: CÁC BÊN LIÊN QUAN */}
              <TabsContent value="parties" className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {(['exporter', 'importer', 'consignee', 'notifyParty'] as const).map((party) => (
                    <div key={party} className="space-y-2 rounded-xl border p-3 bg-slate-50/50">
                      <b className="text-xs uppercase font-bold text-slate-800">{party}</b>
                      <Input placeholder="Tên pháp lý" className="h-8 text-xs" value={profile[party].name || ''} onChange={(event) => updateParty(party, 'name', event.target.value)} />
                      <Input placeholder="Địa chỉ đầy đủ" className="h-8 text-xs" value={profile[party].address || ''} onChange={(event) => updateParty(party, 'address', event.target.value)} />
                      <Input placeholder="Quốc gia (ISO 2 ký tự)" className="h-8 text-xs" maxLength={2} value={profile[party].country || ''} onChange={(event) => updateParty(party, 'country', event.target.value.toUpperCase())} />
                      <Input placeholder="Email / Điện thoại liên hệ" className="h-8 text-xs" value={profile[party].contact || ''} onChange={(event) => updateParty(party, 'contact', event.target.value)} />
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
              Hủy
            </Button>
            <Button
              size="sm"
              className="bg-emerald-800 hover:bg-emerald-900 text-white"
              disabled={Boolean(busy)}
              onClick={() => {
                void run('save', () => saveShipmentExportProfile(shipmentId, profile), 'Đã lưu hồ sơ lô hàng.');
                setIsEditModalOpen(false);
              }}
            >
              Lưu & Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: QUẢN LÝ CONTAINER, PALLET & DÒNG HÀNG POP-UP */}
      <Dialog open={isContainersModalOpen} onOpenChange={setIsContainersModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Box className="h-5 w-5 text-emerald-800" />
              Quản lý Container, Pallet, Carton và Dòng hàng
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Mỗi carton phải thuộc một pallet; mỗi pallet phải thuộc một container/load unit trong cùng lô hàng.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-3 space-y-4">
            {/* Cấu trúc Container */}
            <div className="rounded-xl border p-4 bg-slate-50/50 space-y-3">
              <b className="text-sm text-slate-900">Thêm mới Container</b>
              <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
                <Input placeholder="Số container" value={newContainer.containerNumber} onChange={(e) => setNewContainer((c) => ({ ...c, containerNumber: e.target.value }))} />
                <Input placeholder="Số seal" value={newContainer.sealNumber} onChange={(e) => setNewContainer((c) => ({ ...c, sealNumber: e.target.value }))} />
                <Input placeholder="Loại (vd 40HC)" value={newContainer.equipmentType} onChange={(e) => setNewContainer((c) => ({ ...c, equipmentType: e.target.value }))} />
                <Input placeholder="Marks & numbers" value={newContainer.marksAndNumbers} onChange={(e) => setNewContainer((c) => ({ ...c, marksAndNumbers: e.target.value }))} />
                <Input type="number" placeholder="Tare kg" value={newContainer.tareWeightKg} onChange={(e) => setNewContainer((c) => ({ ...c, tareWeightKg: e.target.value }))} />
                <Button size="sm" variant="outline" className="bg-white border-emerald-300 text-emerald-800" onClick={() => void run('container', async () => {
                  await createShipmentContainer(shipmentId, {
                    containerNumber: newContainer.containerNumber, sealNumber: newContainer.sealNumber,
                    equipmentType: newContainer.equipmentType, marksAndNumbers: newContainer.marksAndNumbers,
                    tareWeightKg: newContainer.tareWeightKg === '' ? null : Number(newContainer.tareWeightKg),
                    maxGrossWeightKg: newContainer.maxGrossWeightKg === '' ? null : Number(newContainer.maxGrossWeightKg)
                  });
                  setNewContainer(emptyContainerForm());
                }, 'Đã thêm container.')} disabled={!newContainer.containerNumber || !newContainer.sealNumber || !newContainer.equipmentType || Boolean(busy)}>
                  <PackagePlus className="mr-1 h-3.5 w-3.5" /> Thêm
                </Button>
              </div>

              {/* Danh sách Container hiện có */}
              <div className="space-y-2 pt-2">
                {(bundle?.containers || []).map((container) => {
                  const edit = containerEdits[container.id] || {};
                  return (
                    <div key={container.id} className="grid gap-2 rounded-lg border bg-white p-2.5 md:grid-cols-4 items-center">
                      <Input aria-label="Số container" className="h-8 text-xs font-mono font-medium" value={String(edit.containerNumber ?? container.containerNumber)} onChange={(e) => setContainerEdits((c) => ({ ...c, [container.id]: { ...c[container.id], containerNumber: e.target.value } }))} />
                      <Input aria-label="Số seal" className="h-8 text-xs font-mono" value={String(edit.sealNumber ?? container.sealNumber)} onChange={(e) => setContainerEdits((c) => ({ ...c, [container.id]: { ...c[container.id], sealNumber: e.target.value } }))} />
                      <Input aria-label="Loại thiết bị" className="h-8 text-xs" value={String(edit.equipmentType ?? container.equipmentType)} onChange={(e) => setContainerEdits((c) => ({ ...c, [container.id]: { ...c[container.id], equipmentType: e.target.value } }))} />
                      <Button size="sm" variant="outline" className="h-8 text-xs bg-slate-50" disabled={!containerEdits[container.id] || Boolean(busy)} onClick={() => void run(`container-${container.id}`, () => updateShipmentContainer(shipmentId, container.id, containerEdits[container.id]), `Đã cập nhật ${container.containerNumber}.`)}>
                        Lưu container
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dòng hàng snapshot */}
            <div className="rounded-xl border p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <b className="text-sm text-slate-900">{bundle?.lines.length || 0} dòng hàng đã snapshot</b>
                <Button size="sm" variant="outline" className="bg-white text-xs h-8" onClick={() => void run('sync', () => syncShipmentExportLines(shipmentId), 'Đã đồng bộ dòng hàng từ shipment.')} disabled={Boolean(busy)}>
                  Đồng bộ lại từ Shipment
                </Button>
              </div>

              <div className="max-h-64 space-y-2 overflow-auto rounded-lg border bg-white p-2">
                {(bundle?.lines || []).map((line) => {
                  const edit = lineEdits[line.id] || {};
                  const value = <K extends keyof ShipmentExportLine>(key: K) => edit[key] ?? line[key];
                  return (
                    <div key={line.id} className="grid gap-2 rounded border p-2 md:grid-cols-4 text-xs">
                      <Input disabled value={line.sku} className="h-7 text-xs font-mono font-bold" />
                      <Input placeholder="Mô tả hàng hóa" className="h-7 text-xs" value={String(value('goodsDescription') ?? '')} onChange={(e) => setLineEdits((c) => ({ ...c, [line.id]: { ...c[line.id], goodsDescription: e.target.value } }))} />
                      <Input placeholder="HS/CN" className="h-7 text-xs font-mono" value={String(value('hsCode') ?? '')} onChange={(e) => setLineEdits((c) => ({ ...c, [line.id]: { ...c[line.id], hsCode: e.target.value, hsCodeConfirmed: false } }))} />
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!lineEdits[line.id] || Boolean(busy)} onClick={() => void run(`line-${line.id}`, () => updateShipmentExportLine(shipmentId, line.id, lineEdits[line.id]), `Đã cập nhật ${line.sku}.`)}>
                        Lưu dòng
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Thêm kiện hàng */}
            <div className="rounded-xl border p-4 bg-slate-50/50 space-y-3">
              <b className="text-sm text-slate-900">Thêm kiện / Pallet mới</b>
              <div className="grid gap-2 md:grid-cols-4">
                <Input placeholder="Mã kiện" className="h-8 text-xs" value={newPackage.packageNumber} onChange={(e) => setNewPackage((c) => ({ ...c, packageNumber: e.target.value }))} />
                <Select value={newPackage.packageType} onValueChange={(val) => setNewPackage((c) => ({ ...c, packageType: val, parentPackageId: val === 'pallet' ? '' : c.parentPackageId }))}>
                  <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pallet">Pallet</SelectItem>
                    <SelectItem value="carton">Carton</SelectItem>
                    <SelectItem value="crate">Crate</SelectItem>
                    <SelectItem value="bag">Bag</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={newPackage.containerId} onValueChange={(val) => setNewPackage((c) => ({ ...c, containerId: val, parentPackageId: '' }))}>
                  <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="Chọn container" /></SelectTrigger>
                  <SelectContent>
                    {(bundle?.containers || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.containerNumber} / {c.sealNumber}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="h-8 text-xs bg-white border-emerald-300 text-emerald-800" onClick={() => void run('package', async () => {
                  await createShipmentPackage(shipmentId, {
                    packageNumber: newPackage.packageNumber, packageType: newPackage.packageType,
                    marksAndNumbers: newPackage.marksAndNumbers, quantity: Number(newPackage.quantity),
                    netWeightKg: Number(newPackage.netWeightKg), grossWeightKg: Number(newPackage.grossWeightKg),
                    lengthCm: Number(newPackage.lengthCm), widthCm: Number(newPackage.widthCm), heightCm: Number(newPackage.heightCm),
                    contents: newPackage.packageType === 'pallet' ? [] : parsePackageContents(newPackage.contentsText),
                    containerId: newPackage.containerId, parentPackageId: newPackage.parentPackageId || null,
                    sequenceNo: newPackage.sequenceNo === '' ? null : Number(newPackage.sequenceNo),
                    weightMeasurementBasis: newPackage.weightMeasurementBasis,
                    dimensionMeasurementBasis: newPackage.dimensionMeasurementBasis
                  });
                  setNewPackage(emptyPackageForm());
                }, 'Đã thêm kiện hàng.')} disabled={!newPackage.packageNumber || !newPackage.containerId || Boolean(busy)}>
                  <PackagePlus className="mr-1 h-3.5 w-3.5" /> Thêm kiện
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button size="sm" onClick={() => setIsContainersModalOpen(false)}>
              Hoàn tất & Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: CỬA SỔ POP-UP THỰC HIỆN HỒ SƠ QUY ĐỊNH (REACH SVHC, GPSR, PCF...) */}
      <Dialog open={Boolean(activeDossier)} onOpenChange={(open) => !open && setActiveDossier(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="flex items-center gap-2 text-lg">
                {selectedDossierMeta?.icon && (
                  <selectedDossierMeta.icon className="h-5 w-5 text-emerald-800" />
                )}
                <span>{selectedDossierMeta?.title}</span>
                <Badge variant="outline" className={`ml-2 text-xs ${selectedDossierMeta?.badgeTone}`}>
                  {selectedDossierMeta?.tag}
                </Badge>
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-600 mt-1">
              {selectedDossierMeta?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-3">
            {activeDossier === 'reach' && (
              <ReachSvhcDossierPanel shipmentId={shipmentId} />
            )}
            {activeDossier === 'gpsr' && (
              <GpsrTechnicalFilePanel shipmentId={shipmentId} />
            )}
            {activeDossier === 'pcf' && (
              <PcfStudyPanel shipmentId={shipmentId} />
            )}
            {activeDossier === 'textile_label' && (
              <TextileFibreLabelPanel shipmentId={shipmentId} />
            )}
            {activeDossier === 'environmental_claim' && (
              <EnvironmentalClaimRegisterPanel shipmentId={shipmentId} />
            )}
            {activeDossier === 'vn_customs' && bundle && (
              <VnCustomsHandoffPanel
                key={`${shipmentId}:${bundle.vnCustomsProfile?.updatedAt || 'new'}:${bundle.vnCustomsEvents.length}:${bundle.vnCustomsEvidence.length}`}
                shipmentId={shipmentId}
                bundle={bundle}
                onChanged={reload}
              />
            )}
            {activeDossier === 'eu_import' && bundle && (
              <EuImportHandoffPanel
                key={`${shipmentId}:${bundle.euImportProfile?.updatedAt || 'new'}:${bundle.euImportLineDetails.length}:${bundle.euImportEvents.length}:${bundle.euImportEvidence.length}`}
                shipmentId={shipmentId}
                bundle={bundle}
                onChanged={reload}
              />
            )}
            {activeDossier === 'ics2' && bundle && (
              <Ics2HandoffPanel
                key={`${shipmentId}:${bundle.ics2Profile?.updatedAt || 'new'}:${bundle.ics2Events.length}:${bundle.ics2Evidence.length}`}
                shipmentId={shipmentId}
                bundle={bundle}
                onChanged={reload}
              />
            )}
            {activeDossier === 'origin' && bundle && (
              <OriginHandoffPanel
                key={`${shipmentId}:${bundle.originProfile?.updatedAt || 'new'}:${bundle.carrierDocuments.filter((item) => item.type === 'origin_support').length}`}
                shipmentId={shipmentId}
                bundle={bundle}
                onChanged={reload}
              />
            )}
            {activeDossier === 'compliance_applicability' && (
              <ComplianceApplicabilityPanel shipmentId={shipmentId} />
            )}
            {activeDossier === 'carrier_documents' && bundle && (
              <CarrierDocumentPanel shipmentId={shipmentId} bundle={bundle} onChanged={reload} />
            )}
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button size="sm" variant="outline" onClick={() => setActiveDossier(null)}>
              Đóng hồ sơ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
