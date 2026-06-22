'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileCheck2,
  Loader2,
  AlertCircle,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import {
  useEvidenceUpload,
  type EvidenceDocument,
  type EvidenceKind,
} from '@/hooks/useEvidenceUpload';

interface Props {
  companyId: string | null;
  productId?: string;
  defaultKind?: EvidenceKind;
  onExtracted?: (doc: EvidenceDocument) => void;
}

const KIND_LABELS: Record<EvidenceKind, string> = {
  electricity_bill: 'Hóa đơn điện (EVN)',
  fuel_receipt: 'Hóa đơn nhiên liệu',
  material_invoice: 'Hóa đơn nguyên liệu',
  transport_bol: 'Vận đơn',
  erp_export: 'Xuất ERP',
  other: 'Khác',
};

const EvidenceUploader: React.FC<Props> = ({
  companyId,
  productId,
  defaultKind = 'electricity_bill',
  onExtracted,
}) => {
  const { upload, verify, uploading, processing } = useEvidenceUpload(companyId);
  const [kind, setKind] = useState<EvidenceKind>(defaultKind);
  const [latest, setLatest] = useState<EvidenceDocument | null>(null);

  const handleFile = async (file: File) => {
    const doc = await upload(file, kind, productId);
    if (doc) {
      setLatest(doc);
      if (doc.status === 'extracted') onExtracted?.(doc);
    }
  };

  const handleVerify = async () => {
    if (!latest) return;
    const ok = await verify(latest.id);
    if (ok) {
      const updated = { ...latest, status: 'verified' as const };
      setLatest(updated);
      onExtracted?.(updated);
    }
  };

  const isBusy = uploading || processing;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="h-4 w-4" />
          Tải chứng từ — Inherited Credibility
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Kind selector */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(KIND_LABELS) as EvidenceKind[]).map((k) => (
            <Badge
              key={k}
              variant={kind === k ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setKind(k)}
            >
              {KIND_LABELS[k]}
            </Badge>
          ))}
        </div>

        {/* Upload area */}
        <label
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition ${
            isBusy
              ? 'pointer-events-none opacity-60'
              : 'cursor-pointer hover:border-primary/50'
          }`}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            disabled={isBusy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
            }}
          />
          {isBusy ? (
            <>
              <Loader2 className="mb-2 h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-medium">
                {uploading ? 'Đang tải lên…' : 'AI đang đọc hóa đơn…'}
              </p>
            </>
          ) : (
            <>
              <FileCheck2 className="mb-2 h-6 w-6 text-primary" />
              <p className="text-sm font-medium">Chọn file PDF/JPG/PNG</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Hóa đơn EVN, hợp đồng nguyên liệu, vận đơn… (≤15 MB)
              </p>
            </>
          )}
        </label>

        {/* Extracted result */}
        {latest && (
          <div className="space-y-2 rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm font-semibold">{latest.file_name}</p>
              <StatusBadge status={latest.status} />
            </div>

            {latest.ocr_error && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {latest.ocr_error}
              </p>
            )}

            {latest.extracted?.kwh_total != null && (
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <Field label="Nhà cung cấp" value={latest.extracted.supplier} />
                <Field
                  label="Kỳ"
                  value={
                    latest.extracted.period_start && latest.extracted.period_end
                      ? `${latest.extracted.period_start} → ${latest.extracted.period_end}`
                      : undefined
                  }
                />
                <Field
                  label="Điện năng"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Zap className="h-3 w-3 text-amber-500" />
                      <strong>
                        {latest.extracted.kwh_total.toLocaleString('vi-VN')}
                      </strong>{' '}
                      kWh
                    </span>
                  }
                />
                <Field
                  label="Số tiền"
                  value={
                    latest.extracted.amount_vnd != null
                      ? `${latest.extracted.amount_vnd.toLocaleString('vi-VN')} ₫`
                      : undefined
                  }
                />
                {latest.ocr_confidence != null && (
                  <Field
                    label="AI tin cậy"
                    value={`${Math.round(latest.ocr_confidence * 100)}%`}
                  />
                )}
              </div>
            )}

            {latest.status === 'extracted' && (
              <Button size="sm" className="w-full" onClick={() => void handleVerify()}>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Xác nhận chứng từ (chuyển sang dữ liệu sơ cấp)
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Field: React.FC<{ label: string; value?: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div>
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p className="text-xs text-foreground">{value ?? '—'}</p>
  </div>
);

const StatusBadge: React.FC<{ status: EvidenceDocument['status'] }> = ({
  status,
}) => {
  const map: Record<
    EvidenceDocument['status'],
    { label: string; className: string }
  > = {
    pending: { label: 'Chờ xử lý', className: 'bg-muted text-muted-foreground' },
    processing: { label: 'Đang OCR', className: 'bg-blue-500/10 text-blue-600' },
    extracted: {
      label: 'Đã trích xuất',
      className: 'bg-amber-500/10 text-amber-700',
    },
    verified: {
      label: 'Đã xác nhận',
      className: 'bg-emerald-500/10 text-emerald-700',
    },
    rejected: {
      label: 'Từ chối',
      className: 'bg-destructive/10 text-destructive',
    },
  };
  const v = map[status];
  return (
    <Badge variant="outline" className={`text-[10px] ${v.className}`}>
      {v.label}
    </Badge>
  );
};

export default EvidenceUploader;
