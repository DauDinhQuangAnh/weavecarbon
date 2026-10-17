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
      if (field.key === 'name' && raw.facility_name) mappedFields.name = raw.facility_name;
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
