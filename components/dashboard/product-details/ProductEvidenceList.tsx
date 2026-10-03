'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  FileCheck2,
  FileWarning,
  Loader2,
  ShieldCheck,
  FileText,
  Eye,
  Download,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import { apiRequest, API_BASE_URL, authTokenStore } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { shortHash } from '@/lib/documentHash';

import type { EvidenceDocument } from '@/hooks/useEvidenceUpload';

interface Props {
  productId: string;
  evidenceLookupCode?: string;
  initialDocument?: EvidenceDocument | null;
}

interface EvidenceRow {
  id: string;
  kind: string;
  status: string;
  file_name: string;
  storage_path: string;
  ocr_confidence: number | null;
  created_at: string;
  extracted: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;

const asNullableNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const extractEvidenceItems = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.data)) return payload.data;

  if (isRecord(payload.data)) {
    if (Array.isArray(payload.data.items)) return payload.data.items;
    if (Array.isArray(payload.data.rows)) return payload.data.rows;
  }

  return [];
};

const normalizeEvidenceRow = (value: unknown): EvidenceRow | null => {
  if (!isRecord(value)) return null;

  const id = asString(value.id);
  if (!id) return null;

  const fileName = asString(
    value.file_name ?? value.fileName ?? value.documentName ?? value.document_name,
    'Evidence document'
  );
  const checksum = asString(value.checksumSha256 ?? value.checksum_sha256 ?? value.storage_path ?? value.storagePath);

  return {
    id,
    kind: asString(value.kind ?? value.evidence_type ?? value.evidenceType, 'other'),
    status: asString(value.status, 'pending'),
    file_name: fileName,
    storage_path: asString(value.storage_path ?? value.storagePath, checksum),
    ocr_confidence: asNullableNumber(value.ocr_confidence ?? value.ocrConfidence),
    created_at: asString(value.created_at ?? value.createdAt, new Date().toISOString()),
    extracted: isRecord(value.extracted)
      ? value.extracted
      : isRecord(value.extractedJson)
        ? value.extractedJson
        : {},
  };
};

const normalizeEvidenceRows = (payload: unknown): EvidenceRow[] =>
  extractEvidenceItems(payload)
    .map(normalizeEvidenceRow)
    .filter((row): row is EvidenceRow => row !== null);

const KIND_LABEL: Record<string, string> = {
  electricity_bill: 'Hóa đơn điện (EVN)',
  fuel_receipt: 'Hóa đơn nhiên liệu',
  material_invoice: 'Hóa đơn nguyên liệu',
  transport_bol: 'Vận đơn',
  erp_export: 'Xuất ERP',
  other: 'Khác',
};

const STATUS_STYLE: Record<string, string> = {
  verified: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  extracted: 'bg-blue-100 text-blue-700 border-blue-300',
  processing: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  pending: 'bg-muted text-muted-foreground',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
};

const isImageFileName = (name: string): boolean =>
  /\.(jpe?g|png|webp|gif|svg)$/i.test(name);

const isPdfFileName = (name: string): boolean =>
  /\.pdf$/i.test(name);

const ProductEvidenceList: React.FC<Props> = ({
  productId,
  evidenceLookupCode,
  initialDocument,
}) => {
  const { user } = useAuth();
  const companyId = user?.company_id ?? null;
  const [rows, setRows] = useState<EvidenceRow[]>(() => {
    if (initialDocument) {
      const row = normalizeEvidenceRow(initialDocument);
      return row ? [row] : [];
    }
    return [];
  });
  const [loading, setLoading] = useState(true);
  const [activeEvidence, setActiveEvidence] = useState<EvidenceRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeEvidence) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);

    const token = authTokenStore.getAccessToken();
    const downloadUrl = `${API_BASE_URL}/evidence/${activeEvidence.id}/download?inline=true${token ? `&token=${encodeURIComponent(token)}` : ''}`;

    fetch(downloadUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Không thể tải tệp tin (${res.status})`);
        }
        const blob = await res.blob();
        if (!cancelled) {
          const objectUrl = URL.createObjectURL(blob);
          setPreviewUrl(objectUrl);
          setPreviewLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPreviewError(err?.message || 'Lỗi khi tải ảnh/tài liệu xem trước');
          setPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeEvidence]);

  const handleDownload = (doc: EvidenceRow | null) => {
    if (!doc) return;
    const token = authTokenStore.getAccessToken();
    const url = `${API_BASE_URL}/evidence/${doc.id}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    window.open(url, '_blank');
  };

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const loadEvidence = async () => {
      try {
        const data = await apiRequest<unknown>(`/evidence?productId=${productId}`);
        const normalized = normalizeEvidenceRows(data);
        if (!cancelled && normalized.length > 0) {
          setRows(normalized);
          setLoading(false);
          return;
        }

        // Fallback 1: Query by lookupCode if present
        if (evidenceLookupCode) {
          try {
            const fallbackData = await apiRequest<unknown>(
              `/evidence?lookup_code=${encodeURIComponent(evidenceLookupCode)}`
            );
            const fallbackRows = normalizeEvidenceRows(fallbackData);
            if (!cancelled && fallbackRows.length > 0) {
              setRows(fallbackRows);
              setLoading(false);
              // Auto-heal relationship in database
              apiRequest('/evidence', {
                method: 'POST',
                body: JSON.stringify({
                  action: 'link',
                  evidenceId: fallbackRows[0].id,
                  productId,
                }),
              }).catch(() => {});
              return;
            }
          } catch {
            // Ignore fallback lookup errors
          }
        }

        // Fallback 2: Use in-memory initialDocument
        if (initialDocument) {
          const directRow = normalizeEvidenceRow(initialDocument);
          if (directRow && !cancelled) {
            setRows([directRow]);
            setLoading(false);
            if (directRow.id) {
              apiRequest('/evidence', {
                method: 'POST',
                body: JSON.stringify({
                  action: 'link',
                  evidenceId: directRow.id,
                  productId,
                }),
              }).catch(() => {});
            }
            return;
          }
        }

        if (!cancelled) setRows([]);
      } catch {
        if (initialDocument && !cancelled) {
          const directRow = normalizeEvidenceRow(initialDocument);
          if (directRow) setRows([directRow]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadEvidence();
    return () => {
      cancelled = true;
    };
  }, [companyId, productId, evidenceLookupCode, initialDocument]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Chứng từ đã khoá (Evidence Locker)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải chứng từ…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <FileWarning className="mx-auto mb-2 h-10 w-10 opacity-40" />
            <p>Chưa có chứng từ nào được upload cho sản phẩm này.</p>
            <p className="mt-1 text-xs">
              Upload hoá đơn EVN, BOL, hoá đơn nguyên liệu để khoá SHA-256 và truy vết audit.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => {
              const hashHex =
                r.storage_path.split('/').pop()?.split('.')[0] ?? '';
              const isImg = isImageFileName(r.file_name);
              return (
                <li
                  key={r.id}
                  className="group flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/40 cursor-pointer"
                  onClick={() => setActiveEvidence(r)}
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground group-hover:border-primary/40 group-hover:text-primary">
                    {isImg ? (
                      <ImageIcon className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium group-hover:text-primary transition-colors">
                        {r.file_name}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${STATUS_STYLE[r.status] ?? ''}`}
                      >
                        {r.status === 'verified' && (
                          <FileCheck2 className="mr-1 h-3 w-3" />
                        )}
                        {r.status}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {KIND_LABEL[r.kind] ?? r.kind}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>
                        {new Date(r.created_at).toLocaleDateString('vi-VN')}
                      </span>
                      {hashHex && hashHex.length >= 12 && (
                        <span className="font-mono">
                          SHA-256 · {shortHash(hashHex)}
                        </span>
                      )}
                      {r.ocr_confidence !== null && (
                        <span>OCR {Math.round(r.ocr_confidence * 100)}%</span>
                      )}
                    </div>
                    {r.extracted && Object.keys(r.extracted).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {Boolean(r.extracted.supplier || r.extracted.supplier_name) && (
                          <span className="rounded bg-muted/80 px-1.5 py-0.5 font-medium text-foreground">
                            {String(r.extracted.supplier || r.extracted.supplier_name)}
                          </span>
                        )}
                        {Boolean(r.extracted.billing_period || r.extracted.period_start) && (
                          <span className="rounded bg-muted/60 px-1.5 py-0.5 text-muted-foreground">
                            Kỳ: {String(r.extracted.billing_period || r.extracted.period_start)}
                          </span>
                        )}
                        {typeof (r.extracted.kwh_total ?? r.extracted.kwh) === 'number' && (
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-700">
                            {Number(r.extracted.kwh_total ?? r.extracted.kwh).toLocaleString('vi-VN')} kWh
                          </span>
                        )}
                        {typeof (r.extracted.fuel_liters) === 'number' && (
                          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-700">
                            {Number(r.extracted.fuel_liters).toLocaleString('vi-VN')} L
                          </span>
                        )}
                        {typeof (r.extracted.amount_vnd ?? r.extracted.total_amount) === 'number' && (
                          <span className="rounded bg-blue-500/10 px-1.5 py-0.5 font-semibold text-blue-700">
                            {Number(r.extracted.amount_vnd ?? r.extracted.total_amount).toLocaleString('vi-VN')} ₫
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-xs text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveEvidence(r);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Xem
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 border-t pt-3 text-[11px] text-muted-foreground">
          Mỗi file được hash SHA-256 ngay khi upload — mọi thay đổi byte sẽ sinh hash khác,
          đảm bảo tamper-evident cho audit (ISO 14044 §4.4.2).
        </p>
      </CardContent>

      <Dialog
        open={Boolean(activeEvidence)}
        onOpenChange={(open) => {
          if (!open) setActiveEvidence(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {activeEvidence && isImageFileName(activeEvidence.file_name) ? (
                <ImageIcon className="h-5 w-5 text-primary" />
              ) : (
                <FileText className="h-5 w-5 text-primary" />
              )}
              <span className="truncate">{activeEvidence?.file_name}</span>
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
              <span>{KIND_LABEL[activeEvidence?.kind || ''] ?? activeEvidence?.kind}</span>
              <span>•</span>
              <span className="font-mono">
                SHA-256: {activeEvidence ? shortHash(activeEvidence.storage_path.split('/').pop()?.split('.')[0] ?? '') : ''}
              </span>
              {activeEvidence?.ocr_confidence !== null && (
                <>
                  <span>•</span>
                  <span>Độ tin cậy OCR: {Math.round((activeEvidence?.ocr_confidence ?? 0) * 100)}%</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2">
            {previewLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Đang tải bản xem trước...</p>
              </div>
            ) : previewError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
                <FileWarning className="h-10 w-10 text-destructive/70" />
                <p className="text-sm text-destructive">{previewError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(activeEvidence)}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Tải trực tiếp về máy
                </Button>
              </div>
            ) : previewUrl ? (
              <div className="flex flex-col gap-4">
                {activeEvidence && isImageFileName(activeEvidence.file_name) ? (
                  <div className="flex justify-center items-center bg-muted/20 rounded-lg p-2 border overflow-hidden max-h-[55vh]">
                    <img
                      src={previewUrl}
                      alt={activeEvidence.file_name}
                      className="max-h-[50vh] w-auto object-contain rounded shadow-sm"
                    />
                  </div>
                ) : activeEvidence && isPdfFileName(activeEvidence.file_name) ? (
                  <iframe
                    src={previewUrl}
                    title={activeEvidence.file_name}
                    className="w-full h-[55vh] border rounded-lg"
                  />
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    <FileText className="mx-auto mb-2 h-12 w-12 opacity-50" />
                    <p className="text-sm">Định dạng file không hỗ trợ xem trực tiếp trong khung xem trước.</p>
                  </div>
                )}

                {activeEvidence?.extracted && Object.keys(activeEvidence.extracted).length > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                    <p className="font-semibold text-foreground mb-1.5">Thông tin AI/OCR đã trích xuất:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-muted-foreground">
                      {Boolean(activeEvidence.extracted.supplier || activeEvidence.extracted.supplier_name) && (
                        <div>
                          <span className="block text-[10px] uppercase font-semibold text-muted-foreground/80">Nhà cung cấp</span>
                          <span className="font-medium text-foreground">{String(activeEvidence.extracted.supplier || activeEvidence.extracted.supplier_name)}</span>
                        </div>
                      )}
                      {Boolean(activeEvidence.extracted.billing_period || activeEvidence.extracted.period_start) && (
                        <div>
                          <span className="block text-[10px] uppercase font-semibold text-muted-foreground/80">Kỳ thanh toán</span>
                          <span className="font-medium text-foreground">{String(activeEvidence.extracted.billing_period || activeEvidence.extracted.period_start)}</span>
                        </div>
                      )}
                      {typeof (activeEvidence.extracted.kwh_total ?? activeEvidence.extracted.kwh) === 'number' && (
                        <div>
                          <span className="block text-[10px] uppercase font-semibold text-muted-foreground/80">Điện năng tiêu thụ</span>
                          <span className="font-semibold text-emerald-600">{Number(activeEvidence.extracted.kwh_total ?? activeEvidence.extracted.kwh).toLocaleString('vi-VN')} kWh</span>
                        </div>
                      )}
                      {typeof (activeEvidence.extracted.fuel_liters) === 'number' && (
                        <div>
                          <span className="block text-[10px] uppercase font-semibold text-muted-foreground/80">Nhiên liệu</span>
                          <span className="font-semibold text-amber-600">{Number(activeEvidence.extracted.fuel_liters).toLocaleString('vi-VN')} L</span>
                        </div>
                      )}
                      {typeof (activeEvidence.extracted.amount_vnd ?? activeEvidence.extracted.total_amount) === 'number' && (
                        <div>
                          <span className="block text-[10px] uppercase font-semibold text-muted-foreground/80">Tổng tiền</span>
                          <span className="font-semibold text-blue-600">{Number(activeEvidence.extracted.amount_vnd ?? activeEvidence.extracted.total_amount).toLocaleString('vi-VN')} ₫</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between pt-3 border-t mt-2">
            <span className="text-xs text-muted-foreground">
              {activeEvidence?.created_at
                ? `Ngày tải lên: ${new Date(activeEvidence.created_at).toLocaleString('vi-VN')}`
                : ''}
            </span>
            <div className="flex gap-2">
              {previewUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(previewUrl, '_blank')}
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Mở tab mới
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={() => handleDownload(activeEvidence)}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Tải file gốc
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ProductEvidenceList;
