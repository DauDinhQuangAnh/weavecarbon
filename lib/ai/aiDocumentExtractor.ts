import { apiRequest } from '@/lib/apiClient';
import type { DocumentContextConfig } from './documentContext';

export interface AiDocumentExtractionResult {
  success: boolean;
  confidence: number;
  source: string;
  documentTitle: string;
  summary: string;
  fields: Record<string, unknown>;
}

export interface ExtractOptions {
  demo?: boolean;
}

/**
 * Trích xuất dữ liệu từ hình ảnh hoặc tài liệu PDF với NGỮ CẢNH (Context-Aware AI Document Extraction).
 * Truyền đầy đủ context nghiệp vụ, danh sách trường mong đợi và gợi ý sang backend.
 */
export async function extractDocumentWithContext(
  file: File,
  config: DocumentContextConfig,
  options?: ExtractOptions
): Promise<AiDocumentExtractionResult> {
  const isDemo = options?.demo ?? (typeof window !== 'undefined' && window.location.pathname.startsWith('/demo'));

  if (isDemo) {
    // Demo mode: Return matching simulated extraction from context presets
    const firstPreset = config.samplePresets[0];
    const defaultData = firstPreset ? firstPreset.data : {};

    return {
      success: true,
      confidence: 0.95,
      source: 'gemini-vision-context-ocr',
      documentTitle: config.title.replace('Quét ', ''),
      summary: `AI đã nhận diện thành công tài liệu theo ngữ cảnh "${config.badgeLabel}", trích xuất chính xác ${Object.keys(defaultData).length} trường thông số.`,
      fields: { ...defaultData },
    };
  }

  // Production: Send multipart form data with domain context
  const formData = new FormData();
  formData.append('file', file);
  formData.append('hintKind', config.hintKind);
  formData.append(
    'context',
    JSON.stringify({
      domainKey: config.key,
      hintKind: config.hintKind,
      expectedFields: config.expectedFields.map((f) => f.key),
      systemInstruction: config.systemInstruction,
    })
  );

  const res = await apiRequest<{ data?: Record<string, unknown> } | Record<string, unknown>>(
    '/evidence/analyze-file',
    {
      method: 'POST',
      body: formData as unknown as BodyInit,
    }
  );

  const raw = ((res as { data?: Record<string, unknown> })?.data || res) as Record<string, unknown>;

  // Build mapped fields matching the expected field schema
  const mappedFields: Record<string, unknown> = {};
  for (const field of config.expectedFields) {
    if (raw[field.key] !== undefined && raw[field.key] !== null) {
      mappedFields[field.key] = raw[field.key];
    } else {
      // Common field alias mappings
      if (field.key === 'quantity' && raw.kwh_total != null) mappedFields.quantity = raw.kwh_total;
      if (field.key === 'quantity' && raw.fuel_liters != null) mappedFields.quantity = raw.fuel_liters;
      if (field.key === 'canonicalUnit' && raw.detected_kind === 'electricity_bill') mappedFields.canonicalUnit = 'kWh';
      if (field.key === 'canonicalUnit' && raw.detected_kind === 'fuel_receipt') mappedFields.canonicalUnit = 'L';
      if (field.key === 'periodStart' && raw.period_start) mappedFields.periodStart = raw.period_start;
      if (field.key === 'periodEnd' && raw.period_end) mappedFields.periodEnd = raw.period_end;
      if (field.key === 'invoiceNumber' && raw.invoice_number) mappedFields.invoiceNumber = raw.invoice_number;
      if (field.key === 'billOfLadingNo' && raw.bl_number) mappedFields.billOfLadingNo = raw.bl_number;
      if (field.key === 'carrierName' && raw.carrier_name) mappedFields.carrierName = raw.carrier_name;
      if (field.key === 'portOfLoading' && raw.port_of_loading) mappedFields.portOfLoading = raw.port_of_loading;
      if (field.key === 'portOfDischarge' && raw.port_of_discharge) mappedFields.portOfDischarge = raw.port_of_discharge;
      if (field.key === 'legalName' && raw.supplier_name) mappedFields.legalName = raw.supplier_name;
      if (field.key === 'name' && (raw.facility_name || raw.ten_co_so || raw.name)) mappedFields.name = raw.facility_name || raw.ten_co_so || raw.name;
      if (field.key === 'factorValue' && raw.emission_factor != null) mappedFields.factorValue = raw.emission_factor;
      if (field.key === 'unit' && raw.factor_unit) mappedFields.unit = raw.factor_unit;
      if (field.key === 'intensityKgCo2e' && raw.carbon_intensity != null) mappedFields.intensityKgCo2e = raw.carbon_intensity;
      if (field.key === 'grossKgCo2e' && raw.total_emissions_kg != null) mappedFields.grossKgCo2e = raw.total_emissions_kg;
      if (field.key === 'batchSize' && raw.batch_quantity != null) mappedFields.batchSize = raw.batch_quantity;
      if (field.key === 'allocatedQuota' && raw.allocated_quota_tco2e != null) mappedFields.allocatedQuota = raw.allocated_quota_tco2e;
      if (field.key === 'latitude' && (raw.lat != null || raw.vi_do != null || raw.coord_lat != null)) mappedFields.latitude = raw.lat ?? raw.vi_do ?? raw.coord_lat;
      if (field.key === 'longitude' && (raw.lng != null || raw.lon != null || raw.kinh_do != null || raw.coord_lng != null)) mappedFields.longitude = raw.lng ?? raw.lon ?? raw.kinh_do ?? raw.coord_lng;
      if (field.key === 'locationBasis' && (raw.location_name || raw.dia_chi || raw.address || raw.land_title_no)) mappedFields.locationBasis = raw.location_name || raw.dia_chi || raw.address || raw.land_title_no;
      if (field.key === 'hierarchyReference' && (raw.hierarchy_ref || raw.serial_number || raw.meter_serial)) mappedFields.hierarchyReference = raw.hierarchy_ref || raw.serial_number || raw.meter_serial;
      if (field.key === 'tolerancePercent' && (raw.tolerance != null || raw.accuracy_class != null)) mappedFields.tolerancePercent = raw.tolerance ?? raw.accuracy_class;
      if (field.key === 'effectiveFrom' && (raw.effective_date || raw.commissioning_date || raw.date)) mappedFields.effectiveFrom = raw.effective_date || raw.commissioning_date || raw.date;
      if (field.key === 'caseReference' && (raw.case_id || raw.decision_number || raw.so_quyet_dinh || raw.so_van_ban)) mappedFields.caseReference = raw.case_id || raw.decision_number || raw.so_quyet_dinh || raw.so_van_ban;
      if (field.key === 'sector' && (raw.sector_code || raw.nganh_nghe)) mappedFields.sector = raw.sector_code || raw.nganh_nghe;
      if (field.key === 'outputTonnes' && (raw.output_tonnes != null || raw.san_luong_tan != null || raw.tonnes != null)) mappedFields.outputTonnes = raw.output_tonnes ?? raw.san_luong_tan ?? raw.tonnes;
      if (field.key === 'productReference' && (raw.product_code || raw.ma_san_pham || raw.sku)) mappedFields.productReference = raw.product_code || raw.ma_san_pham || raw.sku;
      if (field.key === 'studyReference' && (raw.study_code || raw.ma_de_tai || raw.ma_nghien_cuu)) mappedFields.studyReference = raw.study_code || raw.ma_de_tai || raw.ma_nghien_cuu;
      if (field.key === 'activityReference' && (raw.activity_ref || raw.receipt_number || raw.bill_code)) mappedFields.activityReference = raw.activity_ref || raw.receipt_number || raw.bill_code;
    }
  }

  return {
    success: true,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.92,
    source: typeof raw.source === 'string' ? raw.source : 'gemini-vision',
    documentTitle: typeof raw.document_title === 'string' ? raw.document_title : config.title,
    summary:
      typeof raw.summary === 'string' && raw.summary
        ? raw.summary
        : `AI đã trích xuất thành công các trường dữ liệu theo ngữ cảnh "${config.badgeLabel}".`,
    fields: mappedFields,
  };
}

/**
 * Convert base64 data URL (e.g. from CameraScanner) to browser File object for AI extraction
 */
export function base64DataUrlToFile(dataUrl: string, filename = 'camera-scan.jpg'): File {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

