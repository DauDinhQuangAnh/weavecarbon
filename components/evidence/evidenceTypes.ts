export const ACCEPT =
  '.pdf,.xml,.jpg,.jpeg,.png,.xlsx,.csv,application/pdf,application/xml,image/*';
export const MAX_SIZE = 20 * 1024 * 1024;

export const STATUS_LABEL: Record<string, string> = {
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
export const EXTRACTION_OK_STATUSES = new Set([
  'ocr_parsed', 'extracted', 'logic_checked', 'source_matched',
  'cross_checked', 'verified', 'locked',
]);

export interface EvDoc {
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

export interface ExtractedField {
  id: string;
  label: string;
  ai_value: string | null;
  confirmed_value: string | null;
  confidence: number | null;
  /** Giá trị người dùng đã nhập ở form tải lên (ưu tiên hơn số AI đọc). */
  user_entered_value?: string | null;
  /** Cảnh báo kiểm tra hợp lý của trường này (ví dụ kWh bị đọc sai). */
  warning?: string | null;
}
