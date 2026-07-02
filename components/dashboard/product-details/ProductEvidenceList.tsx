'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileCheck2, FileWarning, Loader2, ShieldCheck, FileText } from 'lucide-react';
import { apiRequest } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { shortHash } from '@/lib/documentHash';

interface Props {
  productId: string;
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
  const checksum = asString(value.checksumSha256 ?? value.checksum_sha256);

  return {
    id,
    kind: asString(value.kind, 'other'),
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

const ProductEvidenceList: React.FC<Props> = ({ productId }) => {
  const { user } = useAuth();
  const companyId = user?.company_id ?? null;
  const [rows, setRows] = useState<EvidenceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    apiRequest<unknown>(`/evidence?productId=${productId}`)
      .then((data) => {
        if (!cancelled) setRows(normalizeEvidenceRows(data));
      })
      .catch(() => {
        /* fail silently — empty list is fine */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, productId]);

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
              return (
                <li key={r.id} className="flex items-start gap-3 py-3">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">
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
    </Card>
  );
};

export default ProductEvidenceList;
