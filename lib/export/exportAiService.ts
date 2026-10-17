import { apiRequest } from '@/lib/apiClient';
import type { ExportParty, ShipmentExportProfile } from '@/lib/weave-v2/shipmentExportApi';

export interface ExportAiExtractedData {
  // Commercial & Invoice
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceIssuePlace?: string;
  poContractId?: string;
  currency?: string;
  paymentTerms?: string;
  incotermCode?: string;
  incotermLocation?: string;
  exporterTaxId?: string;

  // Logistics & Transport
  portOfLoading?: string;
  portOfDischarge?: string;
  placeOfDelivery?: string;
  vesselName?: string;
  voyageNumber?: string;
  billOfLadingNo?: string;
  carrierName?: string;
  containerNo?: string;
  sealNo?: string;
  transportMode?: string;

  // Parties
  exporter?: ExportParty;
  importer?: ExportParty;
  consignee?: ExportParty;
  notifyParty?: ExportParty;

  // Customs & Declarations
  customsDeclarationNo?: string;
  importerEori?: string;
  importerVatId?: string;
  freightAmount?: number | null;
  insuranceAmount?: number | null;

  // AI Analysis Metadata
  confidence: number;
  source: string;
  documentTitle: string;
  detectedKind: string;
  summary: string;
}

export interface AnalyzeExportOptions {
  demo?: boolean;
  hintKind?: string;
}

const DEMO_PRESETS: Record<string, ExportAiExtractedData> = {
  invoice: {
    invoiceNumber: 'INV-2026-EU-089',
    invoiceDate: '2026-06-15',
    invoiceIssuePlace: 'Ho Chi Minh City, Vietnam',
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
    containerNo: 'TCLU8294012',
    sealNo: 'ONE-SEAL-9921',
    transportMode: 'sea',
    importerEori: 'NL820491823',
    importerVatId: 'NL820491823B01',
    customsDeclarationNo: '104829384720',
    freightAmount: 2450,
    insuranceAmount: 180,
    exporter: {
      name: 'WeaveCarbon Garment JSC',
      address: 'Lot B2, Tan Binh Industrial Park, Ho Chi Minh City',
      country: 'VN',
      contact: 'export@weavecarbon.vn / +84-28-38123456',
      taxId: '0108927461',
    },
    importer: {
      name: 'Nordic Retail & Fashion B.V.',
      address: 'Keizersgracht 421, 1016 EK Amsterdam',
      country: 'NL',
      contact: 'compliance@nordicfashion.eu / +31-20-7123456',
    },
    confidence: 0.96,
    source: 'gemini-vision-ocr',
    documentTitle: 'Commercial Invoice & Contract Xuất khẩu Dệt may EU',
    detectedKind: 'commercial_invoice',
    summary: 'AI đã trích xuất thành công Commercial Invoice số INV-2026-EU-089 đi Rotterdam với đầy đủ thông số thanh toán, Incoterm và đối tác.',
  },
  bill_of_lading: {
    invoiceNumber: 'INV-2026-EU-089',
    invoiceDate: '2026-06-18',
    invoiceIssuePlace: 'Ho Chi Minh City, Vietnam',
    poContractId: 'PO-EU-2026-009',
    currency: 'USD',
    paymentTerms: 'L/C at sight',
    incotermCode: 'CIF',
    incotermLocation: 'Rotterdam Port',
    exporterTaxId: '0108927461',
    portOfLoading: 'Cat Lai, Vietnam (VNSGN)',
    portOfDischarge: 'Rotterdam, Netherlands (NLRTM)',
    placeOfDelivery: 'Rotterdam Hub',
    vesselName: 'MAERSK MC-KINNEY MOLLER',
    voyageNumber: '2604W',
    billOfLadingNo: 'MSK-VNSGN-2026-88',
    carrierName: 'Maersk Line A/S',
    containerNo: 'MSKU9012384',
    sealNo: 'ML-VN-4482',
    transportMode: 'sea',
    importerEori: 'NL820491823',
    importerVatId: 'NL820491823B01',
    customsDeclarationNo: '104829384720',
    freightAmount: 3100,
    insuranceAmount: 220,
    exporter: {
      name: 'WeaveCarbon Garment JSC',
      address: 'Lot B2, Tan Binh Industrial Park, Ho Chi Minh City',
      country: 'VN',
      contact: 'export@weavecarbon.vn',
    },
    importer: {
      name: 'Nordic Retail & Fashion B.V.',
      address: 'Keizersgracht 421, Amsterdam',
      country: 'NL',
      contact: 'compliance@nordicfashion.eu',
    },
    confidence: 0.94,
    source: 'gemini-vision-ocr',
    documentTitle: 'Vận đơn đường biển Ocean Bill of Lading (B/L)',
    detectedKind: 'transport_bol',
    summary: 'AI đã nhận diện vận đơn đường biển Maersk Line số MSK-VNSGN-2026-88 từ Cát Lái đi Rotterdam, xác nhận mã container và hãng tàu.',
  },
  customs: {
    invoiceNumber: 'INV-2026-VN-CUSTOMS-44',
    invoiceDate: '2026-06-16',
    invoiceIssuePlace: 'Hai Phong, Vietnam',
    poContractId: 'PO-VNACCS-2026',
    currency: 'USD',
    paymentTerms: 'T/T in advance',
    incotermCode: 'FOB',
    incotermLocation: 'Hai Phong Port',
    exporterTaxId: '0108927461',
    portOfLoading: 'Hai Phong Port (VNHPH)',
    portOfDischarge: 'Hamburg Port, Germany (DEHAM)',
    placeOfDelivery: 'Hamburg Logistic Center',
    vesselName: 'HAPAG-LLOYD DRESDEN',
    voyageNumber: '088E',
    billOfLadingNo: 'HPL-HPH-HAM-2026',
    carrierName: 'Hapag-Lloyd AG',
    containerNo: 'HLXU4819203',
    sealNo: 'HL-SEAL-8812',
    transportMode: 'sea',
    importerEori: 'DE892019482',
    importerVatId: 'DE892019482A01',
    customsDeclarationNo: '304928174829',
    freightAmount: 2850,
    insuranceAmount: 195,
    exporter: {
      name: 'WeaveCarbon Garment JSC',
      address: 'Dinh Vu Industrial Zone, Hai Phong',
      country: 'VN',
    },
    importer: {
      name: 'EuroTex Logistics GmbH',
      address: 'Speicherstadt 12, 20457 Hamburg',
      country: 'DE',
    },
    confidence: 0.95,
    source: 'gemini-vision-ocr',
    documentTitle: 'Tờ khai Hải quan Xuất khẩu Điện tử (VNACCS/VCIS)',
    detectedKind: 'customs_declaration',
    summary: 'AI đã đối soát tờ khai hải quan số 304928174829, trích xuất chính xác MST, số tờ khai, mã EORI nhà nhập khẩu và cảng dỡ hàng.',
  },
};

export function getExportAiSamplePresets(): { id: string; label: string; desc: string; data: ExportAiExtractedData }[] {
  return [
    {
      id: 'invoice',
      label: '📄 Commercial Invoice Dệt may EU',
      desc: 'Hóa đơn thương mại chuẩn EU kèm hợp đồng PO & Incoterm FOB',
      data: DEMO_PRESETS.invoice,
    },
    {
      id: 'bill_of_lading',
      label: '🚢 Vận đơn đường biển Ocean B/L',
      desc: 'Bill of Lading hãng tàu Maersk / Tuyến Cát Lái - Rotterdam',
      data: DEMO_PRESETS.bill_of_lading,
    },
    {
      id: 'customs',
      label: '📋 Tờ khai hải quan VNACCS',
      desc: 'Tờ khai xuất khẩu điện tử VNACCS thông quan luồng xanh',
      data: DEMO_PRESETS.customs,
    },
  ];
}

/**
 * Trích xuất dữ liệu chứng từ xuất khẩu bằng AI (Gemini Vision OCR hoặc Fallback).
 */
export async function analyzeExportDocument(
  file: File,
  options?: AnalyzeExportOptions
): Promise<ExportAiExtractedData> {
  const isDemo = options?.demo ?? (typeof window !== 'undefined' && window.location.pathname.startsWith('/demo'));

  if (isDemo) {
    // Demo mode: Return matching simulated AI result based on filename
    const name = file.name.toLowerCase();
    if (name.includes('bol') || name.includes('bill') || name.includes('van_don') || name.includes('sea')) {
      return DEMO_PRESETS.bill_of_lading;
    }
    if (name.includes('to_khai') || name.includes('custom') || name.includes('hai_quan')) {
      return DEMO_PRESETS.customs;
    }
    return DEMO_PRESETS.invoice;
  }

  // Production API: Call /evidence/analyze-file endpoint
  const formData = new FormData();
  formData.append('file', file);
  formData.append('hintKind', options?.hintKind || 'commercial_invoice');

  const res = await apiRequest<{ data?: Record<string, unknown> } | Record<string, unknown>>(
    '/evidence/analyze-file',
    {
      method: 'POST',
      body: formData as unknown as BodyInit,
    }
  );

  const raw = ((res as { data?: Record<string, unknown> })?.data || res) as Record<string, unknown>;

  // Map backend extraction fields to ExportAiExtractedData
  return {
    invoiceNumber: typeof raw.invoice_number === 'string' && raw.invoice_number ? raw.invoice_number : undefined,
    invoiceDate: typeof raw.period_start === 'string' && raw.period_start ? raw.period_start : undefined,
    invoiceIssuePlace: typeof raw.facility_name === 'string' && raw.facility_name ? raw.facility_name : undefined,
    currency: typeof raw.currency === 'string' && raw.currency ? raw.currency : 'USD',
    carrierName: typeof raw.carrier_name === 'string' && raw.carrier_name ? raw.carrier_name : undefined,
    billOfLadingNo: typeof raw.bl_number === 'string' && raw.bl_number ? raw.bl_number : undefined,
    portOfLoading: typeof raw.port_of_loading === 'string' && raw.port_of_loading ? raw.port_of_loading : undefined,
    portOfDischarge: typeof raw.port_of_discharge === 'string' && raw.port_of_discharge ? raw.port_of_discharge : undefined,
    freightAmount: typeof raw.total_amount === 'number' ? raw.total_amount : null,
    exporter: raw.supplier_name
      ? {
          name: String(raw.supplier_name),
          country: 'VN',
        }
      : undefined,
    importer: raw.customer_name
      ? {
          name: String(raw.customer_name),
        }
      : undefined,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.9,
    source: typeof raw.source === 'string' ? raw.source : 'gemini-vision',
    documentTitle: typeof raw.document_title === 'string' ? raw.document_title : 'Chứng từ xuất khẩu',
    detectedKind: typeof raw.detected_kind === 'string' ? raw.detected_kind : 'commercial_invoice',
    summary:
      typeof raw.summary === 'string' && raw.summary
        ? raw.summary
        : 'AI đã trích xuất thành công các trường dữ liệu xuất khẩu từ chứng từ.',
  };
}

/**
 * Trộn dữ liệu AI trích xuất vào ShipmentExportProfile mà không làm mất các trường sẵn có.
 */
export function applyAiDataToProfile(
  aiData: ExportAiExtractedData,
  current: ShipmentExportProfile
): ShipmentExportProfile {
  return {
    ...current,
    invoiceNumber: aiData.invoiceNumber || current.invoiceNumber,
    invoiceDate: aiData.invoiceDate || current.invoiceDate,
    invoiceIssuePlace: aiData.invoiceIssuePlace || current.invoiceIssuePlace,
    poContractId: aiData.poContractId || current.poContractId,
    currency: aiData.currency || current.currency,
    paymentTerms: aiData.paymentTerms || current.paymentTerms,
    incotermCode: aiData.incotermCode || current.incotermCode,
    incotermLocation: aiData.incotermLocation || current.incotermLocation,
    exporterTaxId: aiData.exporterTaxId || current.exporterTaxId,
    portOfLoading: aiData.portOfLoading || current.portOfLoading,
    portOfDischarge: aiData.portOfDischarge || current.portOfDischarge,
    placeOfDelivery: aiData.placeOfDelivery || current.placeOfDelivery,
    vesselName: aiData.vesselName || current.vesselName,
    voyageNumber: aiData.voyageNumber || current.voyageNumber,
    billOfLadingNo: aiData.billOfLadingNo || current.billOfLadingNo,
    carrierName: aiData.carrierName || current.carrierName,
    containerNo: aiData.containerNo || current.containerNo,
    sealNo: aiData.sealNo || current.sealNo,
    importerEori: aiData.importerEori || current.importerEori,
    importerVatId: aiData.importerVatId || current.importerVatId,
    customsDeclarationNo: aiData.customsDeclarationNo || current.customsDeclarationNo,
    freightAmount: aiData.freightAmount ?? current.freightAmount,
    insuranceAmount: aiData.insuranceAmount ?? current.insuranceAmount,
    transportMode: aiData.transportMode || current.transportMode,
    exporter: {
      ...current.exporter,
      ...(aiData.exporter?.name ? { name: aiData.exporter.name } : {}),
      ...(aiData.exporter?.address ? { address: aiData.exporter.address } : {}),
      ...(aiData.exporter?.country ? { country: aiData.exporter.country } : {}),
      ...(aiData.exporter?.contact ? { contact: aiData.exporter.contact } : {}),
      ...(aiData.exporter?.taxId ? { taxId: aiData.exporter.taxId } : {}),
    },
    importer: {
      ...current.importer,
      ...(aiData.importer?.name ? { name: aiData.importer.name } : {}),
      ...(aiData.importer?.address ? { address: aiData.importer.address } : {}),
      ...(aiData.importer?.country ? { country: aiData.importer.country } : {}),
      ...(aiData.importer?.contact ? { contact: aiData.importer.contact } : {}),
    },
  };
}
