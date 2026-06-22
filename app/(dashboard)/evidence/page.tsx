'use client';

import React, { useEffect, useState } from 'react';
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
  CheckCircle2,
  AlertTriangle,
  FileText,
  Loader2,
  Upload,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/apiClient';
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
  file_name: string;
  kind: string;
  status: string;
  trust_score: number;
  verification_level: number;
  created_at: string;
  file_hash_sha256: string | null;
  warnings: string[] | null;
}

interface ExtractedField {
  id: string;
  field_key: string;
  ai_value: string | null;
  confirmed_value: string | null;
  confidence: number | null;
}


export default function EvidencePage() {
  const { user } = useAuth();
  const companyId = user?.company_id ?? null;
  const [rows, setRows] = useState<EvDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewDoc, setReviewDoc] = useState<EvDoc | null>(null);
  const [reviewFields, setReviewFields] = useState<ExtractedField[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('electricity_bill');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await apiRequest<EvDoc[]>(
        `/evidence?companyId=${companyId}&limit=200`
      );
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [companyId]);

  const handleUpload = async () => {
    if (!file || !companyId)
      return toast({ title: 'Thiếu file hoặc đăng nhập', variant: 'destructive' });
    if (file.size > MAX_SIZE)
      return toast({ title: 'File vượt quá 20MB', variant: 'destructive' });
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', companyId);
      formData.append('kind', docType);
      if (periodStart) formData.append('reportingPeriodStart', periodStart);
      if (periodEnd) formData.append('reportingPeriodEnd', periodEnd);
      if (supplier) formData.append('supplierName', supplier);
      if (notes) formData.append('notes', notes);

      await apiRequest('/evidence/upload', { method: 'POST', body: formData });
      toast({ title: 'Đã tải lên. AI đang đọc chứng từ…' });
      setUploadOpen(false);
      setFile(null);
      setSupplier('');
      setNotes('');
      setPeriodStart('');
      setPeriodEnd('');
      await load();
    } catch (e) {
      toast({ title: (e as Error).message || 'Lỗi tải lên', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const openReview = async (doc: EvDoc) => {
    setReviewDoc(doc);
    try {
      const fields = await apiRequest<ExtractedField[]>(
        `/evidence/${doc.id}/fields`
      );
      setReviewFields(fields);
    } catch {
      setReviewFields([]);
    }
    setReviewOpen(true);
  };

  const confirmReview = async () => {
    if (!reviewDoc) return;
    try {
      await apiRequest(`/evidence/${reviewDoc.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          fields: reviewFields.map((f) => ({
            id: f.id,
            confirmed_value: f.confirmed_value ?? f.ai_value,
          })),
        }),
      });
      toast({ title: 'Chứng từ đã được xác nhận.' });
      setReviewOpen(false);
      await load();
    } catch (e: any) {
      toast({ title: e.message || 'Lỗi xác nhận', variant: 'destructive' });
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
                      <td className="p-3 font-medium">{r.file_name}</td>
                      <td className="p-3">
                        {DOC_TYPES.find((d) => d.value === r.kind)?.label ??
                          r.kind}
                      </td>
                      <td className="p-3">
                        <EvidenceLevelBadge level={r.verification_level} />
                      </td>
                      <td className="p-3">
                        <EvidenceTrustBadge score={r.trust_score} />
                      </td>
                      <td className="p-3 text-xs">
                        {STATUS_LABEL[r.status] ?? r.status}
                      </td>
                      <td className="p-3 font-mono text-xs text-slate-500">
                        {r.file_hash_sha256
                          ? r.file_hash_sha256.slice(0, 10) + '…'
                          : '—'}
                      </td>
                      <td className="p-3 text-xs text-slate-500">
                        {new Date(r.created_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="p-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openReview(r)}
                        >
                          Xem
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tải chứng từ mới</DialogTitle>
            <DialogDescription className="text-xs">
              Ưu tiên tải file XML hoặc PDF gốc từ hệ thống phát hành hóa đơn.
              Ảnh chụp hoặc scan có thể đọc được nhưng confidence level sẽ thấp
              hơn.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
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
              <div>
                <Label>Kỳ bắt đầu</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div>
                <Label>Kỳ kết thúc</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Nhà cung cấp / Bên phát hành</Label>
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="EVN HCMC, Petrolimex…"
              />
            </div>
            <div>
              <Label>
                File (PDF, XML, JPG, PNG, XLSX, CSV — tối đa 20MB)
              </Label>
              <Input
                type="file"
                accept={ACCEPT}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <Label>Ghi chú</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
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
                <EvidenceLevelBadge level={reviewDoc.verification_level} />
                <EvidenceTrustBadge score={reviewDoc.trust_score} />
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
                          <td className="p-2 font-medium">{f.field_key}</td>
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
