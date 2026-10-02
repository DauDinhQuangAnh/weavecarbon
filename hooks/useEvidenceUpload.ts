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
  customer_code?: string;
  period_start?: string;
  period_end?: string;
  kwh_total?: number;
  amount_vnd?: number;
  grid_factor_key?: string;
  confidence?: number;
}

export interface EvidenceDocument {
  id: string;
  company_id: string;
  kind: EvidenceKind;
  status: 'pending' | 'processing' | 'extracted' | 'verified' | 'rejected';
  file_name: string;
  storage_path: string;
  mime_type: string;
  extracted: ExtractedInvoice;
  ocr_confidence: number | null;
  ocr_error: string | null;
  created_at: string;
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
      productId?: string
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

        // apiRequest supports FormData natively (serializeRequestBody skips
        // Content-Type for FormData, letting the browser set multipart boundary)
        const doc = await apiRequest<EvidenceDocument>('/evidence/upload', {
          method: 'POST',
          body: formData as unknown as BodyInit,
        });

        setUploading(false);

        let extractedInvoice: ExtractedInvoice = doc.extracted || {};
        if (doc.status === 'processing' || doc.status === 'pending') {
          setProcessing(true);
          // Poll background AI extraction up to 6 times (~15s)
          for (let attempt = 0; attempt < 6; attempt++) {
            await new Promise<void>((resolve) => setTimeout(resolve, 2500));
            try {
              const statusRes = await apiRequest<{
                status: string;
                fieldCount: number;
              }>(`/evidence/${doc.id}/status`);

              if (statusRes.status === 'extract_failed') {
                break;
              }

              if (statusRes.fieldCount > 0) {
                const fields = await apiRequest<
                  Array<{ id: string; confirmed_value: string | null; ai_value: string | null }>
                >(`/evidence/${doc.id}/fields`);

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
                doc.extracted = extractedInvoice;
                doc.status = 'extracted';
                break;
              }
            } catch {
              // Non-fatal polling error — retry next tick
            }
          }
          setProcessing(false);
        }

        if (doc.extracted?.kwh_total != null) {
          toast.success(
            `Đã trích xuất: ${doc.extracted.kwh_total.toLocaleString('vi-VN')} kWh`
          );
        } else {
          toast.success('Tải chứng từ thành công. AI đang xử lý…');
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
