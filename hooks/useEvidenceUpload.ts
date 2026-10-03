import { useState, useCallback } from 'react';
import { apiRequest } from '@/lib/apiClient';
import { toast } from 'sonner';

export type EvidenceKind =
  | 'electricity_bill'
  | 'fuel_receipt'
  | 'material_invoice'
  | 'transport_bol'
  | 'erp_export'
  | 'other';

export interface ExtractedInvoice {
  supplier?: string;
  facility_name?: string;
  customer_code?: string;
  period_start?: string;
  period_end?: string;
  billing_period?: string;
  kwh_total?: number;
  kwh?: number;
  fuel_type?: string;
  fuel_liters?: number;
  amount_vnd?: number;
  grid_factor_key?: string;
  confidence?: number;
  summary?: string;
}

export interface EvidenceDocument {
  id: string;
  company_id?: string;
  kind?: EvidenceKind | string;
  status: string;
  file_name?: string;
  fileName?: string;
  documentName?: string;
  storage_path?: string;
  mime_type?: string;
  extracted?: ExtractedInvoice;
  extractedJson?: Record<string, unknown>;
  ocr_confidence?: number | null;
  ocr_error?: string | null;
  created_at?: string;
  aiAnalysis?: AiAnalysisResult | null;
}

export interface AiAnalysisResult {
  success: boolean;
  source: string;
  detected_kind: string;
  document_title: string;
  supplier_name: string | null;
  period_start: string | null;
  period_end: string | null;
  billing_period: string | null;
  facility_name: string | null;
  kwh_total: number | null;
  fuel_type: string | null;
  fuel_liters: number | null;
  emission_factor: number | null;
  emission_factor_source: string | null;
  total_amount: number | null;
  currency: string | null;
  meter_number: string | null;
  invoice_number: string | null;
  confidence: number;
  summary: string;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export function useEvidenceUpload(companyId: string | null) {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const analyzeFile = useCallback(
    async (file: File, hintKind?: string): Promise<AiAnalysisResult | null> => {
      setAnalyzing(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (hintKind) formData.append('hintKind', hintKind);

        const res = await apiRequest<{ data?: AiAnalysisResult } | AiAnalysisResult>('/evidence/analyze-file', {
          method: 'POST',
          body: formData as unknown as BodyInit,
        });

        const data = ((res as { data?: AiAnalysisResult })?.data || res) as AiAnalysisResult;
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Không thể phân tích tệp tin.';
        toast.error(`Lỗi phân tích AI: ${message}`);
        return null;
      } finally {
        setAnalyzing(false);
      }
    },
    []
  );

  const upload = useCallback(
    async (
      file: File,
      kind: EvidenceKind,
      productId?: string,
      aiAnalysis?: AiAnalysisResult | null
    ): Promise<EvidenceDocument | null> => {
      if (!companyId) {
        toast.error('Không xác định được công ty. Vui lòng đăng nhập lại.');
        return null;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error('File vượt quá 20 MB. Vui lòng chọn file nhỏ hơn.');
        return null;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('companyId', companyId);
        formData.append('kind', kind);
        if (productId) formData.append('productId', productId);

        const rawDoc = await apiRequest<Record<string, unknown>>('/evidence/upload', {
          method: 'POST',
          body: formData as unknown as BodyInit,
        });

        setUploading(false);

        const fileName = (rawDoc.fileName || rawDoc.documentName || rawDoc.file_name || file.name) as string;
        let initialStatus = (rawDoc.status as string) || 'uploaded';
        const rawExtracted = (rawDoc.extracted || rawDoc.extractedJson || {}) as Record<string, unknown>;

        let extractedInvoice: ExtractedInvoice = {
          supplier: (rawExtracted.supplier || rawExtracted.supplier_name) as string | undefined,
          facility_name: (rawExtracted.facility_name || rawExtracted.facility) as string | undefined,
          period_start: (rawExtracted.period_start || rawExtracted.billing_period) as string | undefined,
          period_end: rawExtracted.period_end as string | undefined,
          billing_period: (rawExtracted.billing_period || rawExtracted.period_start) as string | undefined,
          kwh_total: typeof rawExtracted.kwh_total === 'number'
            ? rawExtracted.kwh_total
            : typeof rawExtracted.kwh === 'number'
            ? rawExtracted.kwh
            : undefined,
          fuel_type: rawExtracted.fuel_type as string | undefined,
          fuel_liters: typeof rawExtracted.fuel_liters === 'number' ? rawExtracted.fuel_liters : undefined,
          amount_vnd: typeof rawExtracted.amount_vnd === 'number'
            ? rawExtracted.amount_vnd
            : typeof rawExtracted.total_amount === 'number'
            ? rawExtracted.total_amount
            : undefined,
          confidence: typeof rawExtracted.confidence === 'number' ? rawExtracted.confidence : undefined,
          summary: rawExtracted.summary as string | undefined,
        };

        if (aiAnalysis) {
          extractedInvoice = {
            ...extractedInvoice,
            supplier: aiAnalysis.supplier_name || extractedInvoice.supplier,
            facility_name: aiAnalysis.facility_name || extractedInvoice.facility_name,
            period_start: aiAnalysis.period_start || aiAnalysis.billing_period || extractedInvoice.period_start,
            period_end: aiAnalysis.period_end || extractedInvoice.period_end,
            billing_period: aiAnalysis.billing_period || extractedInvoice.billing_period,
            kwh_total: aiAnalysis.kwh_total ?? extractedInvoice.kwh_total,
            fuel_type: aiAnalysis.fuel_type || extractedInvoice.fuel_type,
            fuel_liters: aiAnalysis.fuel_liters ?? extractedInvoice.fuel_liters,
            amount_vnd: aiAnalysis.total_amount ?? extractedInvoice.amount_vnd,
            confidence: aiAnalysis.confidence ?? extractedInvoice.confidence,
            summary: aiAnalysis.summary || extractedInvoice.summary,
          };
          if (initialStatus === 'processing' || initialStatus === 'uploaded' || initialStatus === 'pending') {
            initialStatus = 'extracted';
          }
        }

        const docId = (rawDoc.id as string) || `ev-${Date.now()}`;

        if (initialStatus === 'processing' || initialStatus === 'pending') {
          setProcessing(true);
          // Poll background AI extraction up to 4 times
          for (let attempt = 0; attempt < 4; attempt++) {
            await new Promise<void>((resolve) => setTimeout(resolve, 2000));
            try {
              const statusRes = await apiRequest<{
                status: string;
                fieldCount: number;
              }>(`/evidence/${docId}/status`);

              if (statusRes.status === 'extract_failed') {
                initialStatus = 'extract_failed';
                break;
              }

              if (statusRes.fieldCount > 0) {
                const fields = await apiRequest<
                  Array<{ id: string; confirmed_value: string | null; ai_value: string | null }>
                >(`/evidence/${docId}/fields`);

                const fieldMap: Record<string, string> = {};
                for (const f of fields || []) {
                  if (f.id && (f.confirmed_value || f.ai_value)) {
                    fieldMap[f.id] = f.confirmed_value || f.ai_value || '';
                  }
                }

                extractedInvoice = {
                  ...extractedInvoice,
                  supplier: fieldMap['supplier_name'] || extractedInvoice.supplier,
                  period_start: fieldMap['reporting_period_start'] || extractedInvoice.period_start,
                  period_end: fieldMap['reporting_period_end'] || extractedInvoice.period_end,
                  kwh_total: fieldMap['kwh_total'] ? Number(fieldMap['kwh_total']) : extractedInvoice.kwh_total,
                };
                initialStatus = 'extracted';
                break;
              }
            } catch {
              // Non-fatal polling error — continue
            }
          }
          setProcessing(false);
        }

        const doc: EvidenceDocument = {
          id: docId,
          company_id: (rawDoc.company_id || rawDoc.companyId || companyId) as string,
          kind: (rawDoc.kind as EvidenceKind) || kind,
          status: initialStatus,
          file_name: fileName,
          fileName,
          documentName: fileName,
          storage_path: (rawDoc.storage_path as string) || '',
          mime_type: (rawDoc.mime_type as string) || file.type || 'application/pdf',
          extracted: extractedInvoice,
          ocr_confidence: typeof rawDoc.ocr_confidence === 'number'
            ? rawDoc.ocr_confidence
            : typeof rawDoc.trustScore === 'number'
            ? rawDoc.trustScore / 100
            : aiAnalysis?.confidence ?? 0.92,
          ocr_error: (rawDoc.ocr_error || rawDoc.extractionError || null) as string | null,
          created_at: (rawDoc.createdAt || rawDoc.created_at || new Date().toISOString()) as string,
          aiAnalysis: aiAnalysis || null,
        };

        if (doc.extracted?.kwh_total != null) {
          toast.success(
            `Đã trích xuất: ${doc.extracted.kwh_total.toLocaleString('vi-VN')} kWh`
          );
        } else if (doc.extracted?.fuel_liters != null) {
          toast.success(
            `Đã trích xuất: ${doc.extracted.fuel_liters.toLocaleString('vi-VN')} lít nhiên liệu`
          );
        } else if (aiAnalysis?.summary) {
          toast.success(`AI đã đọc chứng từ: ${aiAnalysis.document_title || fileName}`);
        } else {
          toast.success('Tải chứng từ thành công. AI đã ghi nhận dữ liệu.');
        }

        return doc;
      } catch (err) {
        setUploading(false);
        setProcessing(false);
        const message =
          err instanceof Error ? err.message : 'Tải chứng từ thất bại.';
        toast.error(message);
        return null;
      }
    },
    [companyId]
  );

  return { upload, uploading, processing, analyzeFile, analyzing };
}
