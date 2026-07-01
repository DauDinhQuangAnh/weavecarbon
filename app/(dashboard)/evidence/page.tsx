'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  BrainCircuit,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Loader2,
  Upload,
} from 'lucide-react';
import { api } from '@/lib/apiClient';
import { toast } from '@/hooks/useToast';
import { EvidenceLevelBadge } from '@/components/evidence/EvidenceLevelBadge';
import { EvidenceTrustBadge } from '@/components/evidence/EvidenceTrustBadge';

const DOC_TYPES: { value: string; label: string }[] = [
  { value: 'electricity_bill', label: 'Hóa đơn điện' },
  { value: 'fuel_receipt', label: 'Hóa đơn nhiên liệu' },
  { value: 'bom', label: 'BOM' },
  { value: 'material_invoice', label: 'Hóa đơn nguyên liệu' },
  { value: 'warehouse_receipt', label: 'Phiếu kho' },
  { value: 'supplier_certificate', label: 'Chứng chỉ nhà cung ứng' },
  { value: 'supplier_declaration', label: 'Tờ khai nhà cung ứng' },
  { value: 'logistics_invoice', label: 'Hóa đơn vận chuyển' },
  { value: 'bill_of_lading', label: 'Bill of Lading' },
  { value: 'air_waybill', label: 'Air Waybill' },
  { value: 'export_invoice', label: 'Hóa đơn xuất khẩu' },
  { value: 'packing_list', label: 'Packing list' },
  { value: 'other', label: 'Khác' },
];

const ACCEPT =
  '.pdf,.xml,.jpg,.jpeg,.png,.xlsx,.csv,application/pdf,application/xml,image/*';
const RAG_DOCUMENT_ACCEPT =
  '.pdf,.docx,.txt,.text,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';
const MAX_SIZE = 20 * 1024 * 1024;

const STATUS_LABEL: Record<string, string> = {
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
};

interface EvDoc {
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
}

interface ExtractedField {
  id: string;
  label: string;
  ai_value: string | null;
  confirmed_value: string | null;
  confidence: number | null;
}


const PAGE_SIZE = 50;

export default function EvidencePage() {
  const [rows, setRows] = useState<EvDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewDoc, setReviewDoc] = useState<EvDoc | null>(null);
  const [reviewFields, setReviewFields] = useState<ExtractedField[]>([]);
  const [ingestingId, setIngestingId] = useState<string | null>(null);
  const [ingestedIds, setIngestedIds] = useState<Set<string>>(new Set());

  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('electricity_bill');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const result = await api.get<{ items?: EvDoc[]; total?: number } | EvDoc[]>(
        `/evidence?page=${p}&page_size=${PAGE_SIZE}`
      );
      if (Array.isArray(result)) {
        setRows(result);
        setTotal(result.length < PAGE_SIZE ? (p - 1) * PAGE_SIZE + result.length : 0);
      } else {
        setRows((result as { items?: EvDoc[] }).items ?? []);
        setTotal((result as { total?: number }).total ?? 0);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  const handleUpload = async () => {
    if (!file)
      return toast({ title: 'Vui lòng chọn file', variant: 'destructive' });
    if (file.size > MAX_SIZE)
      return toast({ title: 'File vượt quá 20MB', variant: 'destructive' });
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('kind', docType);
      if (periodStart) formData.append('reportingPeriodStart', periodStart);
      if (periodEnd) formData.append('reportingPeriodEnd', periodEnd);
      if (supplier) formData.append('supplierName', supplier);
      if (notes) formData.append('notes', notes);

      await api.post('/evidence/upload', formData);
      toast({ title: 'Đã tải lên. AI đang đọc chứng từ — kết quả hiện sau 5-10 giây.' });
      setUploadOpen(false);
      setFile(null);
      setSupplier('');
      setNotes('');
      setPeriodStart('');
      setPeriodEnd('');
      setPage(1);
      await load(1);
      // Auto-refresh after AI extraction completes (~8s)
      setTimeout(() => load(1), 8000);
    } catch (e) {
      toast({ title: (e as Error).message || 'Lỗi tải lên', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const openReview = async (doc: EvDoc) => {
    setReviewDoc(doc);
    try {
      const fields = await api.get<ExtractedField[]>(`/evidence/${doc.id}/fields`);
      setReviewFields(fields);
    } catch {
      setReviewFields([]);
    }
    setReviewOpen(true);
  };

  const confirmReview = async () => {
    if (!reviewDoc) return;
    try {
      await api.post(`/evidence/${reviewDoc.id}/confirm`, {
        fields: reviewFields.map((f) => ({
          id: f.id,
          confirmed_value: f.confirmed_value ?? f.ai_value,
        })),
      });
      toast({ title: 'Chứng từ đã được xác nhận.' });
      setReviewOpen(false);
      await load(page);
    } catch (e) {
      toast({ title: (e as Error).message || 'Lỗi xác nhận', variant: 'destructive' });
    }
  };

  const ingestToRag = async (doc: EvDoc, ragFile: File) => {
    setIngestingId(doc.id);
    try {
      const form = new FormData();
      form.append('file', ragFile);
      form.append('chunking_profile', 'hybrid');
      const data = await api.post<{ rows?: number; chunks?: number }>(
        `/evidence/${doc.id}/rag-ingest`,
        form
      );
      setIngestedIds((current) => new Set([...current, doc.id]));
      toast({
        title: `Đã đưa ${data.rows ?? 0} khối nguồn vào RAG (${data.chunks ?? 0} chunks)`,
      });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Lỗi ingest RAG',
        variant: 'destructive',
      });
    } finally {
      setIngestingId(null);
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-emerald-600" /> Tải chứng từ
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Tải hóa đơn, BOM, vận đơn hoặc chứng từ nhà cung ứng để hệ thống
            đọc dữ liệu, kiểm tra tính nhất quán và lưu vào Audit Trail.
          </p>
        </div>
        <Button
          onClick={() => setUploadOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Upload className="h-4 w-4 mr-2" /> Tải chứng từ mới
        </Button>
      </div>

      <Alert className="border-sky-200 bg-sky-50">
        <AlertDescription className="text-xs text-sky-900">
          AI hỗ trợ đọc, kiểm tra tính nhất quán và đánh giá mức độ tin cậy
          của chứng từ. Chứng từ chỉ được xem là{' '}
          <strong>đã đối chiếu nguồn</strong> khi có file XML, mã tra cứu, chữ
          ký số, dữ liệu từ cổng phát hành hoặc xác nhận từ bên cung cấp. Chỉ{' '}
          <strong>Level 5</strong> mới được xem là third-party verified.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Audit Trail · Chứng từ
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có chứng từ nào.
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="text-left p-3">File</th>
                    <th className="text-left p-3">Loại</th>
                    <th className="text-left p-3">Level</th>
                    <th className="text-left p-3">Trust Score</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Hash</th>
                    <th className="text-left p-3">Tải lên</th>
                    <th className="text-left p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t hover:bg-slate-50"
                    >
                      <td className="p-3 font-medium">{r.fileName || r.documentName}</td>
                      <td className="p-3">
                        {DOC_TYPES.find((d) => d.value === r.kind)?.label ??
                          r.kind}
                      </td>
                      <td className="p-3">
                        <EvidenceLevelBadge level={r.verificationLevel} />
                      </td>
                      <td className="p-3">
                        <EvidenceTrustBadge score={r.trustScore} />
                      </td>
                      <td className="p-3 text-xs">
                        {STATUS_LABEL[r.status] ?? r.status}
                      </td>
                      <td className="p-3 font-mono text-xs text-slate-500">
                        {r.checksumSha256
                          ? r.checksumSha256.slice(0, 10) + '…'
                          : '—'}
                      </td>
                      <td className="p-3 text-xs text-slate-500">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openReview(r)}
                          >
                            Xem
                          </Button>
                          {!ingestedIds.has(r.id) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              disabled={ingestingId === r.id}
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = RAG_DOCUMENT_ACCEPT;
                                input.onchange = (event) => {
                                  const selectedFile = (event.target as HTMLInputElement).files?.[0];
                                  if (selectedFile) void ingestToRag(r, selectedFile);
                                };
                                input.click();
                              }}
                            >
                              {ingestingId === r.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <BrainCircuit className="h-3.5 w-3.5 mr-1" />
                              )}
                              RAG
                            </Button>
                          )}
                          {ingestedIds.has(r.id) && (
                            <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200">
                              RAG
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {(total > PAGE_SIZE || page > 1) && (
              <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-slate-600">
                <span>
                  Trang {page}{total > 0 ? ` · ${total} chứng từ` : ''}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    ← Trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={rows.length < PAGE_SIZE}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Tiếp →
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="space-y-2">
            <DialogTitle>Tải chứng từ mới</DialogTitle>
            <DialogDescription className="text-xs">
              Ưu tiên tải file XML hoặc PDF gốc từ hệ thống phát hành hóa đơn.
              Ảnh chụp hoặc scan có thể đọc được nhưng confidence level sẽ thấp
              hơn.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Loại chứng từ</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kỳ bắt đầu</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kỳ kết thúc</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nhà cung cấp / Bên phát hành</Label>
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="EVN HCMC, Petrolimex…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                File (PDF, XML, JPG, PNG, XLSX, CSV — tối đa 20MB)
              </Label>
              <Input
                type="file"
                accept={ACCEPT}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ghi chú</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setUploadOpen(false)}>
              Huỷ
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Tải lên &amp; cho AI đọc
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Modal */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Xem &amp; xác nhận dữ liệu AI đã đọc
            </DialogTitle>
            <DialogDescription className="text-xs">
              AI hỗ trợ đọc và đánh giá mức độ tin cậy — vui lòng kiểm tra
              trước khi dùng cho tính carbon.
            </DialogDescription>
          </DialogHeader>
          {reviewDoc && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <EvidenceLevelBadge level={reviewDoc.verificationLevel} />
                <EvidenceTrustBadge score={reviewDoc.trustScore} />
                <Badge variant="outline">
                  {STATUS_LABEL[reviewDoc.status] ?? reviewDoc.status}
                </Badge>
              </div>
              {Array.isArray(reviewDoc.warnings) &&
                reviewDoc.warnings.length > 0 && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-700" />
                    <AlertDescription className="text-xs text-amber-900 space-y-1">
                      {reviewDoc.warnings.map((w, i) => (
                        <div key={i}>• {w}</div>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-2">Field</th>
                      <th className="text-left p-2">AI đọc được</th>
                      <th className="text-left p-2">Bạn xác nhận</th>
                      <th className="text-left p-2">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewFields.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-3 text-center text-slate-500"
                        >
                          AI chưa trích xuất được trường nào.
                        </td>
                      </tr>
                    ) : (
                      reviewFields.map((f, i) => (
                        <tr key={f.id} className="border-t">
                          <td className="p-2 font-medium">{f.label || f.id}</td>
                          <td className="p-2 text-slate-600 max-w-[180px] truncate">
                            {f.ai_value ?? '—'}
                          </td>
                          <td className="p-2">
                            <Input
                              className="h-7 text-xs"
                              defaultValue={
                                f.confirmed_value ?? f.ai_value ?? ''
                              }
                              onChange={(e) => {
                                const v = e.target.value;
                                setReviewFields((arr) =>
                                  arr.map((x, j) =>
                                    j === i
                                      ? { ...x, confirmed_value: v }
                                      : x
                                  )
                                );
                              }}
                            />
                          </td>
                          <td className="p-2 font-mono">
                            {f.confidence != null
                              ? `${Math.round(Number(f.confidence) * 100)}%`
                              : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setReviewOpen(false)}>
              Huỷ
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setReviewOpen(false);
                setUploadOpen(true);
              }}
            >
              Tải lại chứng từ
            </Button>
            <Button
              onClick={confirmReview}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Xác nhận dữ liệu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
