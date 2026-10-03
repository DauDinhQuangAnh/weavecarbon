'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileCheck2,
  Loader2,
  AlertCircle,
  Zap,
  Flame,
  CheckCircle2,
  Sparkles,
  FileText,
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

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Chờ xử lý', className: 'bg-muted text-muted-foreground' },
  uploaded: { label: 'Đã tải lên', className: 'bg-muted text-muted-foreground' },
  processing: { label: 'Đang AI đọc…', className: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  ocr_parsed: { label: 'AI đã đọc', className: 'bg-amber-500/10 text-amber-700 border-amber-200' },
  extracted: { label: 'Đã trích xuất', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
  needs_review: { label: 'Cần xem lại', className: 'bg-amber-500/10 text-amber-700 border-amber-200' },
  logic_checked: { label: 'Đã kiểm tra logic', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
  source_matched: { label: 'Đã đối chiếu nguồn', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
  cross_checked: { label: 'Đã đối chiếu vận hành', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
  ready_for_calculation: { label: 'Sẵn sàng tính', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
  verified: { label: 'Đã xác nhận', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
  third_party_verified: { label: 'Đã xác minh', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
  locked: { label: 'Đã khoá', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  rejected: { label: 'Từ chối', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  extract_failed: { label: 'AI đọc lỗi', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const EvidenceUploader: React.FC<Props> = ({
  companyId,
  productId,
  defaultKind = 'electricity_bill',
  onExtracted,
}) => {
  const router = useRouter();
  const { upload, uploading, processing, analyzeFile, analyzing } = useEvidenceUpload(companyId);
  const [kind, setKind] = useState<EvidenceKind>(defaultKind);
  const [latest, setLatest] = useState<EvidenceDocument | null>(null);
  const [applied, setApplied] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    setApplied(false);
    let uploadKind = kind;
    const analysis = await analyzeFile(file, kind);
    if (analysis?.detected_kind && analysis.detected_kind in KIND_LABELS) {
      uploadKind = analysis.detected_kind as EvidenceKind;
      setKind(uploadKind);
    }
    const doc = await upload(file, uploadKind, productId, analysis);
    if (doc) {
      setLatest(doc);
      if (onExtracted) {
        onExtracted(doc);
        setApplied(true);
      }
    }
  };

  const handleApply = () => {
    if (!latest) return;
    onExtracted?.(latest);
    setApplied(true);
  };

  const handleReview = () => {
    if (!latest) return;
    router.push(`/evidence?highlight=${encodeURIComponent(latest.id)}`);
  };

  const isBusy = uploading || processing || analyzing;
  const displayName = latest?.file_name || latest?.fileName || latest?.documentName || 'Chứng từ đã tải';

  const ext = latest?.extracted;
  const rawExt = (latest?.extracted || (latest as Record<string, unknown> | null)?.extractedJson) as Record<string, unknown> | undefined;
  const kwhTotal = ext?.kwh_total ?? ext?.kwh ?? latest?.aiAnalysis?.kwh_total;
  const fuelLiters = ext?.fuel_liters ?? latest?.aiAnalysis?.fuel_liters;
  const supplierName = ext?.supplier ?? (typeof rawExt?.supplier_name === "string" ? rawExt.supplier_name : undefined) ?? latest?.aiAnalysis?.supplier_name;
  const facilityName = ext?.facility_name ?? (typeof rawExt?.facility === "string" ? rawExt.facility : undefined) ?? latest?.aiAnalysis?.facility_name;
  const billingPeriod =
    ext?.period_start && ext?.period_end
      ? `${ext.period_start} → ${ext.period_end}`
      : ext?.billing_period ?? latest?.aiAnalysis?.billing_period;
  const amountVnd = ext?.amount_vnd ?? (typeof rawExt?.total_amount === "number" ? rawExt.total_amount : undefined) ?? latest?.aiAnalysis?.total_amount;
  const confidence = latest?.ocr_confidence ?? latest?.aiAnalysis?.confidence;

  const hasExtractedData = Boolean(
    kwhTotal != null ||
    fuelLiters != null ||
    supplierName ||
    billingPeriod ||
    amountVnd != null ||
    latest?.aiAnalysis?.summary
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="h-4 w-4 text-primary" />
          Tải chứng từ — Inherited Credibility (AI OCR)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Kind selector */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(KIND_LABELS) as EvidenceKind[]).map((k) => (
            <Badge
              key={k}
              variant={kind === k ? 'default' : 'outline'}
              className="cursor-pointer transition-colors"
              onClick={() => setKind(k)}
            >
              {KIND_LABELS[k]}
            </Badge>
          ))}
        </div>

        {/* Upload area with drag-and-drop */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            const droppedFile = e.dataTransfer.files?.[0];
            if (droppedFile && !isBusy) {
              void handleFile(droppedFile);
            }
          }}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
            isBusy
              ? 'pointer-events-none opacity-60 bg-muted/30 border-muted'
              : dragOver
                ? 'border-primary bg-primary/10 scale-[0.99]'
                : 'cursor-pointer border-slate-300 hover:border-primary/60 hover:bg-slate-50/80'
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
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2 shadow-sm">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {analyzing ? 'AI đang đọc và nhận dạng chứng từ…' : uploading ? 'Đang tải lên…' : 'AI đang trích xuất dữ liệu…'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Vui lòng đợi giây lát trong khi AI phân tích tệp
              </p>
            </>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2 shadow-sm border border-primary/20">
                <FileCheck2 className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-semibold text-slate-800">Chọn file hoặc kéo thả PDF/JPG/PNG</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Hóa đơn EVN, hóa đơn nhiên liệu, hợp đồng nguyên liệu, vận đơn… (≤20 MB)
              </p>
            </>
          )}
        </label>

        {/* Extracted result */}
        {latest && (
          <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b pb-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
              </div>
              <StatusBadge status={latest.status} />
            </div>

            {latest.ocr_error && (
              <p className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 p-2 rounded-md">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {latest.ocr_error}
              </p>
            )}

            {hasExtractedData && (
              <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                {supplierName && <Field label="Nhà cung cấp / Phát hành" value={String(supplierName)} />}
                {facilityName && <Field label="Cơ sở / Nhà máy" value={String(facilityName)} />}
                {billingPeriod && <Field label="Kỳ thanh toán / Ngày" value={String(billingPeriod)} />}
                {kwhTotal != null && (
                  <Field
                    label="Sản lượng điện"
                    value={
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                        <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        {Number(kwhTotal).toLocaleString('vi-VN')} kWh
                      </span>
                    }
                  />
                )}
                {fuelLiters != null && (
                  <Field
                    label="Nhiên liệu"
                    value={
                      <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                        <Flame className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
                        {Number(fuelLiters).toLocaleString('vi-VN')} lít {ext?.fuel_type ? `(${ext.fuel_type})` : ''}
                      </span>
                    }
                  />
                )}
                {amountVnd != null && (
                  <Field
                    label="Tổng số tiền"
                    value={
                      <span className="font-semibold text-slate-800">
                        {Number(amountVnd).toLocaleString('vi-VN')} ₫
                      </span>
                    }
                  />
                )}
                {confidence != null && (
                  <Field
                    label="Độ tin cậy AI"
                    value={
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                        <Sparkles className="h-3 w-3 text-emerald-600" />
                        {Math.round(Number(confidence) > 1 ? Number(confidence) : Number(confidence) * 100)}%
                      </span>
                    }
                  />
                )}
              </div>
            )}

            {latest.aiAnalysis?.summary && (
              <div className="rounded-lg bg-emerald-50/70 border border-emerald-200/80 p-2.5 text-xs text-emerald-900">
                <p className="font-semibold flex items-center gap-1 mb-0.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  Tóm tắt phân tích AI
                </p>
                <p className="text-[11px] leading-relaxed text-emerald-800">
                  {latest.aiAnalysis.summary}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              {onExtracted && (
                <Button
                  size="sm"
                  type="button"
                  variant={applied ? "outline" : "default"}
                  className={`flex-1 text-xs font-semibold ${
                    applied
                      ? "text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  }`}
                  onClick={handleApply}
                >
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  {applied ? "Đã áp dụng vào sản phẩm" : "Áp dụng vào sản phẩm"}
                </Button>
              )}
              <Button
                size="sm"
                type="button"
                variant="outline"
                className="text-xs text-slate-700 hover:bg-slate-100"
                onClick={handleReview}
              >
                Mở kiểm duyệt AI/OCR
              </Button>
            </div>
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
    <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
      {label}
    </p>
    <div className="text-xs text-foreground mt-0.5">{value ?? '—'}</div>
  </div>
);

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  const v = (status && STATUS_CONFIG[status]) || {
    label: status ? String(status) : 'Đã tải',
    className: 'bg-muted text-muted-foreground',
  };
  return (
    <Badge variant="outline" className={`text-[10px] font-medium ${v.className}`}>
      {v.label}
    </Badge>
  );
};

export default EvidenceUploader;

