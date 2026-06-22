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

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

export function useEvidenceUpload(companyId: string | null) {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);

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
        toast.error('File vượt quá 15 MB. Vui lòng chọn file nhỏ hơn.');
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

        if (doc.status === 'processing' || doc.status === 'pending') {
          setProcessing(true);
          // OCR is async on the BE — show processing state briefly then clear
          await new Promise<void>((resolve) => setTimeout(resolve, 2000));
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

  const verify = useCallback(async (id: string): Promise<boolean> => {
    try {
      await apiRequest(`/evidence/${id}/verify`, { method: 'POST' });
      toast.success('Đã xác nhận — chuyển sang dữ liệu sơ cấp.');
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Xác nhận thất bại.';
      toast.error(message);
      return false;
    }
  }, []);

  return { upload, verify, uploading, processing };
}
