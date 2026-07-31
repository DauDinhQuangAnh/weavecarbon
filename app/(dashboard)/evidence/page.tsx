'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  BrainCircuit,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Loader2,
  Trash2,
  Upload,
  Download,
} from 'lucide-react';
import { api } from '@/lib/apiClient';
import { toast } from '@/hooks/useToast';
import { EvidenceLevelBadge } from '@/components/evidence/EvidenceLevelBadge';
import { EvidenceTrustBadge } from '@/components/evidence/EvidenceTrustBadge';

const DOC_TYPES: { value: string; label: string }[] = [
  { value: 'electricity_bill', label: 'Hóa đơn điện' },
  { value: 'fuel_receipt', label: 'Hóa đơn nhiên liệu' },
  { value: 'bom', label: 'BOM' },
  { value: 'material_invoice', label: 'Hóa đơn nguyên liệu' },
  { value: 'warehouse_receipt', label: 'Phiếu kho' },
  { value: 'supplier_certificate', label: 'Chứng chỉ nhà cung ứng' },
  { value: 'supplier_declaration', label: 'Tờ khai nhà cung ứng' },
  { value: 'logistics_invoice', label: 'Hóa đơn vận chuyển' },
  { value: 'bill_of_lading', label: 'Bill of Lading' },
  { value: 'air_waybill', label: 'Air Waybill' },
  { value: 'export_invoice', label: 'Hóa đơn xuất khẩu' },
  { value: 'packing_list', label: 'Packing list' },
  { value: 'other', label: 'Khác' },
];

// Template data: [headers[], ...sampleRows[], ...instructionRows[]]
const DOC_TEMPLATES: Record<string, { sheet: string; rows: (string | number)[][] }> = {
  electricity_bill: {
    sheet: 'Hoa_don_dien',
    rows: [
      ['Kỳ thanh toán', 'Cơ sở / Nhà máy', 'Lượng điện (kWh)', 'Hệ số phát thải (kg CO₂e/kWh)', 'Nguồn hệ số phát thải', 'CO₂e (kg) = kWh × EF'],
      ['2024-Q2', 'Nhà máy Bình Dương', 12500, 0.4290, 'VN Ministry of Natural Resources 2024', 5362.5],
      ['2024-Q3', 'Nhà máy Bình Dương', 11800, 0.4290, 'VN Ministry of Natural Resources 2024', 5062.2],
      ['* Ghi chú: Kỳ có thể là 2024-Q1, 2024-01, hoặc tháng cụ thể. CO₂e được tính tự động bởi hệ thống.', '', '', '', '', ''],
    ],
  },
  fuel_receipt: {
    sheet: 'Hoa_don_nhien_lieu',
    rows: [
      ['Kỳ thanh toán', 'Loại nhiên liệu', 'Lượng (lít)', 'Hệ số phát thải (kg CO₂e/lít)', 'CO₂e (kg) = lít × EF', 'Ghi chú'],
      ['2024-Q2', 'diesel', 500, 2.688, 1344, 'Máy phát điện dự phòng'],
      ['2024-Q2', 'lpg', 200, 1.629, 325.8, 'Lò hơi'],
      ['* Loại NL hợp lệ: diesel | petrol | lpg | cng | coal | biomass | other', '', '', '', '', ''],
      ['* EF mặc định: diesel=2.688, petrol=2.352, lpg=1.629, cng=2.740, coal=2.420, biomass=0', '', '', '', '', ''],
    ],
  },
  bom: {
    sheet: 'BOM',
    rows: [
      ['SKU sản phẩm', 'Tên nguyên liệu', 'Thành phần / Mô tả', 'Tỷ lệ (%)', 'Khối lượng (kg/sản phẩm)', 'Nhà cung ứng', 'Xuất xứ', 'Chứng chỉ (nếu có)'],
      ['SKU-SHIRT-001', 'Cotton 100%', 'Vải cotton chải kỹ', 60, 0.18, 'Công ty Bông Việt', 'VN', 'GOTS'],
      ['SKU-SHIRT-001', 'Polyester tái chế', 'Sợi tái chế GRS', 30, 0.09, 'Toray VN', 'JP', 'GRS'],
      ['SKU-SHIRT-001', 'Chỉ may + Phụ liệu', 'Nút, nhãn, bao bì', 10, 0.03, 'Nhiều NCC', 'VN', ''],
    ],
  },
  material_invoice: {
    sheet: 'Hoa_don_nguyen_lieu',
    rows: [
      ['Số hóa đơn', 'Ngày', 'Nhà cung ứng', 'Mã hàng', 'Tên nguyên liệu', 'Số lượng', 'Đơn vị', 'Đơn giá (VNĐ)', 'Thành tiền (VNĐ)', 'Ghi chú'],
      ['HD-2024-001', '2024-04-15', 'Bông Việt JSC', 'BV-COT-001', 'Vải cotton 32/1 OE', 500, 'kg', 85000, 42500000, ''],
      ['HD-2024-002', '2024-04-20', 'Toray VN', 'TR-PET-002', 'Sợi Polyester DTY 150D', 300, 'kg', 62000, 18600000, 'GRS certified'],
    ],
  },
  warehouse_receipt: {
    sheet: 'Phieu_kho',
    rows: [
      ['Số phiếu', 'Ngày', 'Loại (Nhập/Xuất)', 'Mã hàng', 'Tên hàng', 'Số lượng', 'Đơn vị', 'Kho', 'Lô/Batch', 'Ghi chú'],
      ['PNK-2024-001', '2024-04-15', 'Nhập', 'BV-COT-001', 'Vải cotton', 500, 'kg', 'Kho A - Nguyên liệu', 'LOT-240415', ''],
      ['PXK-2024-010', '2024-04-25', 'Xuất', 'SKU-SHIRT-001', 'Áo thun SKU-SHIRT-001', 1000, 'cái', 'Kho B - Thành phẩm', 'LOT-240425', 'Xuất cho đơn ORD-001'],
    ],
  },
  supplier_certificate: {
    sheet: 'Chung_chi_NCC',
    rows: [
      ['Tên nhà cung ứng', 'Loại chứng chỉ', 'Số chứng chỉ', 'Ngày cấp', 'Ngày hết hạn', 'Phạm vi / Sản phẩm', 'Cơ quan cấp', 'Link xác minh'],
      ['Bông Việt JSC', 'GOTS', 'GOTS-VN-2024-1234', '2024-01-15', '2025-01-14', 'Cotton yarn & fabric', 'Control Union', 'https://global-standard.org/...'],
      ['Toray VN', 'GRS', 'GRS-VN-2024-5678', '2024-03-01', '2025-02-28', 'Recycled polyester fiber', 'Bureau Veritas', 'https://textileexchange.org/...'],
    ],
  },
  supplier_declaration: {
    sheet: 'To_khai_NCC',
    rows: [
      ['Tên nhà cung ứng', 'Nguyên liệu / Sản phẩm', 'CO₂e (kg/đơn vị)', 'Đơn vị', 'Phương pháp tính', 'Kỳ tính', 'Người khai', 'Ngày khai', 'Ghi chú'],
      ['Bông Việt JSC', 'Cotton yarn 32/1', 3.2, 'kg CO₂e/kg', 'Cradle-to-gate (LCA)', '2023', 'Nguyễn Văn A - GĐ KT', '2024-03-15', 'ISO 14067:2018'],
      ['Toray VN', 'Recycled polyester DTY 150D', 1.8, 'kg CO₂e/kg', 'Mass balance, GRS', '2023', 'Tran Thi B - Env Manager', '2024-03-20', 'GRS certified'],
    ],
  },
  logistics_invoice: {
    sheet: 'Hoa_don_van_chuyen',
    rows: [
      ['Số hóa đơn', 'Ngày', 'Đơn vị vận chuyển', 'Loại vận tải', 'Điểm đi', 'Điểm đến', 'Trọng lượng (kg)', 'Khoảng cách (km)', 'CO₂e (kg)', 'Ghi chú'],
      ['VC-2024-001', '2024-05-10', 'Gemadept Logistics', 'Đường bộ', 'Bình Dương', 'Cảng Cát Lái', 5000, 45, 18.5, ''],
      ['VC-2024-002', '2024-05-12', 'Maersk VN', 'Đường biển', 'Cảng Cát Lái', 'Hamburg DE', 8000, 10800, 1080, 'FCL 40HC'],
      ['* EF tham khảo: Xe tải 0.09–0.15 kg/tấn.km | Đường biển 0.012 kg/tấn.km | Hàng không 0.602 kg/tấn.km', '', '', '', '', '', '', '', '', ''],
    ],
  },
  bill_of_lading: {
    sheet: 'Bill_of_Lading',
    rows: [
      ['Số B/L', 'Ngày phát hành', 'Hãng tàu', 'Tàu / Chuyến', 'Cảng xếp hàng', 'Cảng dỡ hàng', 'Hàng hóa (mô tả)', 'Số container', 'Loại cont', 'Trọng lượng (kg)', 'Số kiện'],
      ['MAEU2024123456', '2024-05-15', 'Maersk', 'MSC MAYA / V.024W', 'Cat Lai, HCMC, VN', 'Hamburg, DE', 'Woven garments - 100% Cotton', 'MSKU1234567', '40HC', 18500, 850],
      ['COSCO20240789', '2024-05-20', 'COSCO', 'COSCO GLORY / E.018', 'Hai Phong, VN', 'Rotterdam, NL', 'Knitted apparel - Mixed fabric', 'CSNU9876543', '20GP', 12000, 600],
    ],
  },
  air_waybill: {
    sheet: 'Air_Waybill',
    rows: [
      ['Số AWB', 'Ngày', 'Hãng bay', 'Sân bay xuất (IATA)', 'Sân bay đến (IATA)', 'Mô tả hàng hóa', 'Trọng lượng (kg)', 'Số kiện', 'Ghi chú'],
      ['125-12345678', '2024-05-18', 'Vietnam Airlines', 'SGN', 'FRA', 'Garment samples - urgency', 250, 10, 'DDP Incoterms'],
      ['618-98765432', '2024-05-22', 'Singapore Airlines Cargo', 'SGN', 'CDG', 'Fashion accessories - NVD', 180, 8, 'CIP Incoterms'],
      ['* EF hàng không ≈ 0.602 kg CO₂e / tấn.km (ICAO 2023). Cần tránh tối đa vận chuyển hàng không.', '', '', '', '', '', '', '', ''],
    ],
  },
  export_invoice: {
    sheet: 'Hoa_don_xuat_khau',
    rows: [
      ['Số hóa đơn', 'Ngày', 'Người bán', 'Người mua', 'Nước nhập khẩu', 'Điều kiện TM (Incoterms)', 'Mã HS', 'Mô tả hàng', 'Số lượng', 'Đơn vị', 'Đơn giá (USD)', 'Tổng (USD)', 'Trọng lượng (kg)'],
      ['EXP-2024-001', '2024-05-20', 'WeaveCarbon Co., Ltd', 'Fashion GmbH', 'DE', 'FOB HCMC', '6109.10.90', "Men's T-shirt 100% Cotton", 5000, 'pcs', 4.5, 22500, 1250],
      ['EXP-2024-002', '2024-05-22', 'WeaveCarbon Co., Ltd', 'Moda SRL', 'IT', 'CIF Genova', '6104.43.00', "Women's knitted dress Polyester", 2000, 'pcs', 12.8, 25600, 1400],
    ],
  },
  packing_list: {
    sheet: 'Packing_List',
    rows: [
      ['Số kiện', 'Loại kiện', 'Mã hàng (SKU)', 'Mô tả hàng', 'Số lượng/kiện', 'Đơn vị', 'Trọng lượng cả bì (kg)', 'Trọng lượng tịnh (kg)', 'Kích thước D×R×C (cm)', 'Ghi chú'],
      [1, 'Carton', 'SKU-SHIRT-001', "Men's T-shirt S/M/L - Cotton", 120, 'pcs', 8.5, 7.8, '60×40×50', 'PO#2024-EU-001'],
      [2, 'Carton', 'SKU-SHIRT-001', "Men's T-shirt S/M/L - Cotton", 120, 'pcs', 8.5, 7.8, '60×40×50', 'PO#2024-EU-001'],
      ['...', '', '', '', '', '', '', '', '', ''],
      ['Tổng cộng', '', '', '', 10000, 'pcs', 710, 650, '', '850 cartons'],
    ],
  },
  other: {
    sheet: 'Chung_tu_khac',
    rows: [
      ['Tên tài liệu', 'Ngày', 'Người phát hành', 'Mô tả nội dung', 'Số tham chiếu', 'Ghi chú'],
      ['Biên bản kiểm định lò hơi', '2024-03-10', 'Trung tâm Đo lường Chất lượng', 'Kiểm định an toàn lò hơi 2 tấn/h', 'KD-2024-BD-0021', 'Hiệu lực 12 tháng'],
      ['Báo cáo LCA nội bộ', '2024-04-01', 'WeaveCarbon R&D', 'LCA tóm tắt SKU-SHIRT-001 theo ISO 14067', 'LCA-2024-001', 'Draft, chưa kiểm toán'],
    ],
  },
};

async function downloadTemplate(kind: string, label: string) {
  const tpl = DOC_TEMPLATES[kind] ?? DOC_TEMPLATES['other'];
  const headers = (tpl.rows[0] ?? []).map((h) => String(h));
  const dataRows = tpl.rows.slice(1);
  const isNote = (r: (string | number)[]) => String(r[0] ?? '').trim().startsWith('*');
  const notes = dataRows.filter(isNote).map((r) => String(r[0]));
  const sampleRows = dataRows.filter((r) => !isNote(r));
  const columns = headers.map((h) => ({ header: h, width: Math.max(h.length + 4, 16) }));

  const { downloadFormTemplate } = await import('@/lib/reports/formTemplate');
  await downloadFormTemplate(
    {
      sheets: [
        {
          name: tpl.sheet,
          title: `Mẫu chứng từ — ${label}`,
          subtitle: 'Điền dữ liệu thực vào các dòng bên dưới',
          columns,
          sampleRows,
          notes,
        },
      ],
      info: [
        {
          name: 'Huong_dan',
          title: 'Hướng dẫn sử dụng file mẫu',
          rows: [
            ['Loại chứng từ', label],
            ['Mục đích', 'Cung cấp dữ liệu có cấu trúc để hệ thống AI đọc và tính carbon chính xác hơn.'],
            ['Định dạng tải lên', 'PDF, XML, JPG, PNG, XLSX, CSV (tối đa 20 MB)'],
            'Dòng đầu tiên trong sheet dữ liệu là tiêu đề cột — không đổi thứ tự.',
            'Xoá các dòng mẫu (nền nhạt) và điền dữ liệu thật.',
            'Xoá các dòng ghi chú (bắt đầu bằng *) trước khi tải lên.',
            'Tải file này lên cùng chứng từ gốc (PDF/XML) để tăng độ chính xác.',
            ['Hỗ trợ', 'support@weavecarbon.com'],
          ],
        },
      ],
    },
    `WeaveCarbon_Mau_${kind}_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

const ACCEPT =
  '.pdf,.xml,.jpg,.jpeg,.png,.xlsx,.csv,application/pdf,application/xml,image/*';
const MAX_SIZE = 20 * 1024 * 1024;

const STATUS_LABEL: Record<string, string> = {
  pending: 'Đã tải',
  processing: 'Đang xử lý',
  uploaded: 'Đã tải',
  ocr_parsed: 'AI đã đọc',
  needs_review: 'Cần xem lại',
  logic_checked: 'Đã kiểm tra logic',
  source_matched: 'Đã đối chiếu nguồn',
  cross_checked: 'Đã đối chiếu vận hành',
  extracted: 'AI đã đọc',
  verified: 'Đã xác nhận',
  rejected: 'Từ chối',
  ready_for_calculation: 'Sẵn sàng tính',
  third_party_verified: 'Đã xác minh độc lập',
  extract_failed: 'AI đọc lỗi',
};

// Statuses that mean AI extraction finished successfully.
const EXTRACTION_OK_STATUSES = new Set([
  'ocr_parsed', 'extracted', 'logic_checked', 'source_matched',
  'cross_checked', 'verified', 'locked',
]);

interface EvDoc {
  id: string;
  documentName: string;
  fileName: string;
  kind: string;
  status: string;
  trustScore: number | null;
  verificationLevel: number;
  createdAt: string;
  checksumSha256: string | null;
  warnings: string[] | null;
  extractionError?: string | null;
}

interface ExtractedField {
  id: string;
  label: string;
  ai_value: string | null;
  confirmed_value: string | null;
  confidence: number | null;
}


const PAGE_SIZE = 50;

export default function EvidencePage() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');

  const [rows, setRows] = useState<EvDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewDoc, setReviewDoc] = useState<EvDoc | null>(null);
  const [reviewFields, setReviewFields] = useState<ExtractedField[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('electricity_bill');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  // Electricity bill structured fields → synced to electricity_invoices (CBAM Scope 2)
  const [elecFacilityName, setElecFacilityName] = useState('Main Facility');
  const [elecBillingPeriod, setElecBillingPeriod] = useState('');
  const [elecKwh, setElecKwh] = useState('');
  const [elecEF, setElecEF] = useState('0.4290');
  const [elecEFSource, setElecEFSource] = useState('VN Ministry of Natural Resources 2024');

  // Fuel receipt structured fields → synced to fuel_invoices (CBAM Scope 1)
  const [fuelBillingPeriod, setFuelBillingPeriod] = useState('');
  const [fuelType, setFuelType] = useState('diesel');
  const [fuelQtyLiters, setFuelQtyLiters] = useState('');
  const [fuelEF, setFuelEF] = useState('');

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const result = await api.get<{ items?: EvDoc[]; total?: number } | EvDoc[]>(
        `/evidence?page=${p}&page_size=${PAGE_SIZE}`
      );
      if (Array.isArray(result)) {
        setRows(result);
        setTotal(result.length < PAGE_SIZE ? (p - 1) * PAGE_SIZE + result.length : 0);
      } else {
        setRows((result as { items?: EvDoc[] }).items ?? []);
        setTotal((result as { total?: number }).total ?? 0);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  // After upload, poll the background AI extraction and surface the outcome as a toast
  // (success with field count, or the failure reason) instead of leaving the user guessing.
  const pollExtraction = useCallback(async (evidenceId: string) => {
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((r) => setTimeout(r, 2500));
      try {
        const s = await api.get<{
          status: string;
          fieldCount: number;
          extractionError: string | null;
        }>(`/evidence/${evidenceId}/status`);

        if (s.status === 'extract_failed') {
          toast({
            title: 'AI không đọc được chứng từ',
            description: s.extractionError || 'Vui lòng thử lại hoặc tải file rõ ràng hơn.',
            variant: 'destructive',
          });
          await load(1);
          return;
        }
        if (EXTRACTION_OK_STATUSES.has(s.status) && s.fieldCount > 0) {
          toast({
            title: `AI đã đọc xong — ${s.fieldCount} trường`,
            description: 'Bấm "Xem" ở dòng chứng từ để kiểm tra & xác nhận.',
          });
          await load(1);
          return;
        }
      } catch {
        // transient error while polling — keep trying
      }
    }
    // Still not done after ~25s: refresh anyway and let the user know.
    await load(1);
    toast({
      title: 'AI vẫn đang xử lý chứng từ',
      description: 'Kết quả sẽ cập nhật sau ít phút. Bạn có thể tải lại trang để xem.',
    });
  }, [load]);

  useEffect(() => {
    if (highlightId && rows.length > 0) {
      document.getElementById(`ev-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, rows]);

  const resetUploadForm = () => {
    setFile(null);
    setSupplier('');
    setNotes('');
    setPeriodStart('');
    setPeriodEnd('');
    setElecFacilityName('Main Facility');
    setElecBillingPeriod('');
    setElecKwh('');
    setElecEF('0.4290');
    setElecEFSource('VN Ministry of Natural Resources 2024');
    setFuelBillingPeriod('');
    setFuelType('diesel');
    setFuelQtyLiters('');
    setFuelEF('');
  };

  const handleUpload = async () => {
    if (!file)
      return toast({ title: 'Vui lòng chọn file', variant: 'destructive' });
    if (file.size > MAX_SIZE)
      return toast({ title: 'File vượt quá 20MB', variant: 'destructive' });
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('kind', docType);
      if (periodStart) formData.append('reportingPeriodStart', periodStart);
      if (periodEnd) formData.append('reportingPeriodEnd', periodEnd);
      if (supplier) formData.append('supplierName', supplier);
      if (notes) formData.append('notes', notes);

      const uploadResult = await api.post<EvDoc>('/evidence/upload', formData);
      const evidenceId = uploadResult?.id;

      // Sync structured data to CBAM invoice tables
      if (evidenceId && docType === 'electricity_bill' && elecBillingPeriod && elecKwh) {
        try {
          await api.post('/electricity-invoices', {
            facility_name: elecFacilityName || 'Main Facility',
            billing_period: elecBillingPeriod,
            kwh: parseFloat(elecKwh),
            emission_factor_kg_per_kwh: parseFloat(elecEF) || 0.4290,
            emission_factor_source: elecEFSource || 'VN Ministry of Natural Resources 2024',
            evidence_document_id: evidenceId,
          });
        } catch { /* non-fatal */ }
      } else if (evidenceId && docType === 'fuel_receipt' && fuelBillingPeriod && fuelQtyLiters) {
        try {
          const fuelPayload: Record<string, unknown> = {
            billing_period: fuelBillingPeriod,
            fuel_type: fuelType,
            quantity_liters: parseFloat(fuelQtyLiters),
            evidence_document_id: evidenceId,
          };
          if (fuelEF) fuelPayload.emission_factor_kg_per_liter = parseFloat(fuelEF);
          await api.post('/fuel-invoices', fuelPayload);
        } catch { /* non-fatal */ }
      }

      toast({ title: 'Đã tải lên. AI đang đọc chứng từ…' });
      setUploadOpen(false);
      resetUploadForm();
      setPage(1);
      await load(1);
      // Poll the background extraction and toast the real outcome (success or reason).
      if (evidenceId) {
        void pollExtraction(evidenceId);
      }
    } catch (e) {
      toast({ title: (e as Error).message || 'Lỗi tải lên', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const openReview = async (doc: EvDoc) => {
    setReviewDoc(doc);
    try {
      const fields = await api.get<ExtractedField[]>(`/evidence/${doc.id}/fields`);
      setReviewFields(fields);
    } catch {
      setReviewFields([]);
    }
    setReviewOpen(true);
  };

  const handleDeleteDoc = async (doc: EvDoc) => {
    const label = DOC_TYPES.find((d) => d.value === doc.kind)?.label ?? doc.kind;
    if (!window.confirm(`Xoá "${doc.fileName || doc.documentName}" (${label})?\nHóa đơn liên kết (điện/nhiên liệu) cũng sẽ bị xoá.`)) return;
    try {
      await api.delete(`/evidence/${doc.id}`);
      toast({ title: 'Đã xoá chứng từ.' });
      await load(page);
    } catch (e) {
      toast({ title: (e as Error).message || 'Lỗi xoá', variant: 'destructive' });
    }
  };

  const confirmReview = async () => {
    if (!reviewDoc) return;
    try {
      await api.post(`/evidence/${reviewDoc.id}/confirm`, {
        fields: reviewFields.map((f) => ({
          id: f.id,
          confirmed_value: f.confirmed_value ?? f.ai_value,
        })),
      });
      toast({ title: 'Chứng từ đã được xác nhận.' });
      setReviewOpen(false);
      await load(page);
    } catch (e) {
      toast({ title: (e as Error).message || 'Lỗi xác nhận', variant: 'destructive' });
    }
  };


  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-emerald-600" /> Tải chứng từ
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Tải hóa đơn, BOM, vận đơn hoặc chứng từ nhà cung ứng để hệ thống
            đọc dữ liệu, kiểm tra tính nhất quán và lưu vào Audit Trail.
          </p>
        </div>
        <Button
          onClick={() => setUploadOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Upload className="h-4 w-4 mr-2" /> Tải chứng từ mới
        </Button>
      </div>

      <Alert className="border-sky-200 bg-sky-50">
        <AlertDescription className="text-xs text-sky-900">
          AI hỗ trợ đọc, kiểm tra tính nhất quán và đánh giá mức độ tin cậy
          của chứng từ. Chứng từ chỉ được xem là{' '}
          <strong>đã đối chiếu nguồn</strong> khi có file XML, mã tra cứu, chữ
          ký số, dữ liệu từ cổng phát hành hoặc xác nhận từ bên cung cấp. Chỉ{' '}
          <strong>Level 5</strong> mới được xem là third-party verified.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Audit Trail · Chứng từ
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có chứng từ nào.
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="text-left p-3">File</th>
                    <th className="text-left p-3">Loại</th>
                    <th className="text-left p-3">Level</th>
                    <th className="text-left p-3">Trust Score</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Hash</th>
                    <th className="text-left p-3">Tải lên</th>
                    <th className="text-left p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      id={`ev-${r.id}`}
                      className={`border-t hover:bg-slate-50 ${r.id === highlightId ? 'bg-sky-50 ring-1 ring-sky-300' : ''}`}
                    >
                      <td className="p-3 font-medium">{r.fileName || r.documentName}</td>
                      <td className="p-3">
                        {DOC_TYPES.find((d) => d.value === r.kind)?.label ??
                          r.kind}
                      </td>
                      <td className="p-3">
                        <EvidenceLevelBadge level={r.verificationLevel} />
                      </td>
                      <td className="p-3">
                        <EvidenceTrustBadge score={r.trustScore} />
                      </td>
                      <td className="p-3 text-xs">
                        {STATUS_LABEL[r.status] ?? r.status}
                      </td>
                      <td className="p-3 font-mono text-xs text-slate-500">
                        {r.checksumSha256
                          ? r.checksumSha256.slice(0, 10) + '…'
                          : '—'}
                      </td>
                      <td className="p-3 text-xs text-slate-500">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openReview(r)}
                          >
                            Xem
                          </Button>
                          {r.status === 'ocr_parsed' || r.status === 'logic_checked' || r.status === 'source_matched' || r.status === 'cross_checked' || r.status === 'verified' || r.status === 'locked' ? (
                            <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200 gap-1">
                              <BrainCircuit className="h-3 w-3" /> RAG
                            </Badge>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteDoc(r)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {(total > PAGE_SIZE || page > 1) && (
              <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-slate-600">
                <span>
                  Trang {page}{total > 0 ? ` · ${total} chứng từ` : ''}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    ← Trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={rows.length < PAGE_SIZE}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Tiếp →
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="space-y-2">
            <DialogTitle>Tải chứng từ mới</DialogTitle>
            <DialogDescription className="text-xs">
              Ưu tiên tải file XML hoặc PDF gốc từ hệ thống phát hành hóa đơn.
              Ảnh chụp hoặc scan có thể đọc được nhưng confidence level sẽ thấp
              hơn.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Loại chứng từ</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-sky-600 hover:text-sky-700"
                  onClick={() => {
                    const label = DOC_TYPES.find((d) => d.value === docType)?.label ?? docType;
                    void downloadTemplate(docType, label);
                  }}
                >
                  <Download className="h-3 w-3 mr-1" /> Tải file mẫu
                </Button>
              </div>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kỳ bắt đầu</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kỳ kết thúc</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nhà cung cấp / Bên phát hành</Label>
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="EVN HCMC, Petrolimex…"
              />
            </div>

            {/* Electricity bill → electricity_invoices (CBAM Scope 2) */}
            {docType === 'electricity_bill' && (
              <div className="space-y-3 rounded-md border border-sky-200 bg-sky-50 p-3">
                <p className="text-xs font-medium text-sky-800">
                  Dữ liệu hóa đơn điện — tự động đồng bộ vào Báo cáo CBAM (Scope 2)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cơ sở / Nhà máy</Label>
                    <Input
                      value={elecFacilityName}
                      onChange={(e) => setElecFacilityName(e.target.value)}
                      placeholder="Main Facility"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Kỳ thanh toán</Label>
                    <Input
                      value={elecBillingPeriod}
                      onChange={(e) => setElecBillingPeriod(e.target.value)}
                      placeholder="2024-Q2 hoặc 2024-05"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Lượng điện (kWh) *</Label>
                    <Input
                      type="number"
                      value={elecKwh}
                      onChange={(e) => setElecKwh(e.target.value)}
                      placeholder="12500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Hệ số phát thải (kg CO₂e/kWh)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={elecEF}
                      onChange={(e) => setElecEF(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nguồn hệ số phát thải</Label>
                  <Input
                    value={elecEFSource}
                    onChange={(e) => setElecEFSource(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Fuel receipt → fuel_invoices (CBAM Scope 1) */}
            {docType === 'fuel_receipt' && (
              <div className="space-y-3 rounded-md border border-orange-200 bg-orange-50 p-3">
                <p className="text-xs font-medium text-orange-800">
                  Dữ liệu hóa đơn nhiên liệu — tự động đồng bộ vào Báo cáo CBAM (Scope 1)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Kỳ thanh toán</Label>
                    <Input
                      value={fuelBillingPeriod}
                      onChange={(e) => setFuelBillingPeriod(e.target.value)}
                      placeholder="2024-Q2 hoặc 2024-05"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Loại nhiên liệu</Label>
                    <Select value={fuelType} onValueChange={setFuelType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diesel">Diesel</SelectItem>
                        <SelectItem value="petrol">Xăng (Petrol)</SelectItem>
                        <SelectItem value="lpg">LPG</SelectItem>
                        <SelectItem value="cng">CNG</SelectItem>
                        <SelectItem value="coal">Than đá (Coal)</SelectItem>
                        <SelectItem value="biomass">Sinh khối (Biomass)</SelectItem>
                        <SelectItem value="other">Khác</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Lượng nhiên liệu (lít) *</Label>
                    <Input
                      type="number"
                      value={fuelQtyLiters}
                      onChange={(e) => setFuelQtyLiters(e.target.value)}
                      placeholder="500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Hệ số phát thải (kg CO₂e/lít){' '}
                      <span className="font-normal text-slate-400">(tự tính từ loại NL)</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={fuelEF}
                      onChange={(e) => setFuelEF(e.target.value)}
                      placeholder="Để trống = tự động"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>
                File (PDF, XML, JPG, PNG, XLSX, CSV — tối đa 20MB)
              </Label>
              <Input
                type="file"
                accept={ACCEPT}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ghi chú</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => { setUploadOpen(false); resetUploadForm(); }}>
              Huỷ
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Tải lên &amp; cho AI đọc
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Modal */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Xem &amp; xác nhận dữ liệu AI đã đọc
            </DialogTitle>
            <DialogDescription className="text-xs">
              AI hỗ trợ đọc và đánh giá mức độ tin cậy — vui lòng kiểm tra
              trước khi dùng cho tính carbon.
            </DialogDescription>
          </DialogHeader>
          {reviewDoc && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <EvidenceLevelBadge level={reviewDoc.verificationLevel} />
                <EvidenceTrustBadge score={reviewDoc.trustScore} />
                <Badge variant="outline">
                  {STATUS_LABEL[reviewDoc.status] ?? reviewDoc.status}
                </Badge>
              </div>
              {Array.isArray(reviewDoc.warnings) &&
                reviewDoc.warnings.length > 0 && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-700" />
                    <AlertDescription className="text-xs text-amber-900 space-y-1">
                      {reviewDoc.warnings.map((w, i) => (
                        <div key={i}>• {w}</div>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-2">Field</th>
                      <th className="text-left p-2">AI đọc được</th>
                      <th className="text-left p-2">Bạn xác nhận</th>
                      <th className="text-left p-2">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewFields.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-3 text-center text-slate-500"
                        >
                          {reviewDoc.status === 'extract_failed' && reviewDoc.extractionError
                            ? reviewDoc.extractionError
                            : 'AI chưa trích xuất được trường nào.'}
                        </td>
                      </tr>
                    ) : (
                      reviewFields.map((f, i) => (
                        <tr key={f.id} className="border-t">
                          <td className="p-2 font-medium">{f.label || f.id}</td>
                          <td className="p-2 text-slate-600 max-w-[180px] truncate">
                            {f.ai_value ?? '—'}
                          </td>
                          <td className="p-2">
                            <Input
                              className="h-7 text-xs"
                              defaultValue={
                                f.confirmed_value ?? f.ai_value ?? ''
                              }
                              onChange={(e) => {
                                const v = e.target.value;
                                setReviewFields((arr) =>
                                  arr.map((x, j) =>
                                    j === i
                                      ? { ...x, confirmed_value: v }
                                      : x
                                  )
                                );
                              }}
                            />
                          </td>
                          <td className="p-2 font-mono">
                            {f.confidence != null
                              ? `${Math.round(Number(f.confidence) * 100)}%`
                              : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setReviewOpen(false)}>
              Huỷ
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setReviewOpen(false);
                setUploadOpen(true);
              }}
            >
              Tải lại chứng từ
            </Button>
            <Button
              onClick={confirmReview}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Xác nhận dữ liệu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
