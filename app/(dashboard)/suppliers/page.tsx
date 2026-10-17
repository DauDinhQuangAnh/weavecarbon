'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  FileCheck2,
  FileText,
  Loader2,
  Mail,
  Plus,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/apiClient';
import { toast } from '@/hooks/useToast';
import SupplierNetworkPanel from '@/components/dashboard/suppliers/SupplierNetworkPanel';
import { demoSessionCache } from '@/lib/dashboard/demoSessionCache';
import {
  screenSupplierEsgAndCarbon,
  generateSupplierScope3Questionnaire,
  type SupplierEsgScreeningResult,
  type SupplierScope3Questionnaire,
} from '@/lib/ai/supplyChainAndClimateAiService';
import { AiDocumentImportModal } from '@/components/ui/AiDocumentImportModal';

type Status = 'draft' | 'sent' | 'waiting' | 'received' | 'overdue';

interface SupplierReq {
  id: string;
  supplierName: string;
  supplierEmail: string;
  materialSupplied: string | null;
  requiredData: string[];
  deadline: string | null;
  status: Status;
}

const STATUS_LABEL: Record<Status, string> = {
  draft: 'Bản nháp',
  sent: 'Đã gửi',
  waiting: 'Chờ phản hồi',
  received: 'Đã nhận',
  overdue: 'Quá hạn',
};

const STATUS_COLOR: Record<Status, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  waiting: 'bg-amber-100 text-amber-700 border-amber-200',
  received: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  overdue: 'bg-rose-100 text-rose-700 border-rose-200',
};

const EMPTY_FORM = {
  supplierName: '',
  supplierEmail: '',
  material: '',
  deadline: '',
  required: 'Chỉ số điện kWh, Định mức than/sinh khối, Tỷ lệ tái chế %, Chứng chỉ ISO 14064 / OEKO-TEX',
};

export default function SuppliersPage() {
  const pathname = usePathname();
  const demo = pathname.startsWith('/demo');
  const [rows, setRows] = useState<SupplierReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // AI Dialogs & Inspectors
  const [showAiImport, setShowAiImport] = useState(false);
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false);
  const [selectedQuestionnaireSector, setSelectedQuestionnaireSector] = useState('Nhuộm & hoàn tất');
  const [generatedQuestionnaire, setGeneratedQuestionnaire] = useState<SupplierScope3Questionnaire | null>(null);
  const [inspectingEsgSupplier, setInspectingEsgSupplier] = useState<SupplierEsgScreeningResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    if (demo) {
      setRows(demoSessionCache.getSupplierRequests());
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<SupplierReq[]>('/suppliers');
      setRows(
        data.map((r) => ({
          ...r,
          requiredData: Array.isArray(r.requiredData) ? r.requiredData : [],
        }))
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [demo]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!form.supplierName.trim() || !form.supplierEmail.trim()) {
      return toast({ title: 'Cần tên & email nhà cung ứng', variant: 'destructive' });
    }
    setSaving(true);
    const payload = {
      supplierName: form.supplierName.trim(),
      supplierEmail: form.supplierEmail.trim(),
      materialSupplied: form.material.trim() || null,
      requiredData: form.required
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      deadline: form.deadline || null,
      status: 'draft' as const,
    };

    if (demo) {
      demoSessionCache.addSupplierRequest(payload);
      toast({ title: 'Đã tạo yêu cầu dữ liệu Scope 3 (Lưu demo 1 giờ)' });
      setOpen(false);
      setForm(EMPTY_FORM);
      setSaving(false);
      await load();
      return;
    }

    try {
      await api.post('/suppliers', payload);
      toast({ title: 'Đã tạo yêu cầu thu thập dữ liệu' });
      setOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Lỗi tạo yêu cầu';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const sendMail = async (r: SupplierReq) => {
    const subject = encodeURIComponent(
      `[Weave Carbon] Yêu cầu dữ liệu phát thải Scope 3 — ${r.materialSupplied || 'Vật tư cung ứng'}`
    );
    const body = encodeURIComponent(
      `Kính gửi ${r.supplierName},\n\nĐể phục vụ kiểm kê phát thải khí nhà kính chuỗi cung ứng (Scope 3 Category 1) và tuân thủ các quy định xuất khẩu xanh (EU CBAM / ISO 14064), chúng tôi đề nghị Quý công ty phối hợp cung cấp các dữ liệu sau:\n- ${(r.requiredData || []).join('\n- ')}\n\nThời hạn phản hồi: ${r.deadline || 'Trong vòng 14 ngày làm việc'}\n\nTrân trọng cảm ơn sự hợp tác của Quý đối tác.`
    );
    window.location.href = `mailto:${r.supplierEmail}?subject=${subject}&body=${body}`;

    if (r.status === 'draft') {
      if (demo) {
        demoSessionCache.updateSupplierRequest(r.id, { status: 'sent' });
        await load();
      } else {
        try {
          await api.put(`/suppliers/${r.id}`, {
            status: 'sent',
            sentAt: new Date().toISOString(),
          });
          await load();
        } catch {
          /* non-critical */
        }
      }
    }
  };

  const handleOpenQuestionnaireGen = (initialSector?: string) => {
    const sec = initialSector || 'Nhuộm & hoàn tất';
    setSelectedQuestionnaireSector(sec);
    setGeneratedQuestionnaire(generateSupplierScope3Questionnaire(sec));
    setShowQuestionnaireModal(true);
  };

  const applyQuestionnaireToForm = () => {
    if (!generatedQuestionnaire) return;
    const questionsSummary = generatedQuestionnaire.sections
      .flatMap((s) => s.questions.map((q) => q.label))
      .join(', ');
    setForm((prev) => ({
      ...prev,
      required: questionsSummary,
    }));
    setShowQuestionnaireModal(false);
    setOpen(true);
    toast({ title: 'Đã nạp câu hỏi khảo sát AI vào biểu mẫu yêu cầu' });
  };

  const copyQuestionnaireText = () => {
    if (!generatedQuestionnaire) return;
    const text = `${generatedQuestionnaire.title}\nThời lượng ước tính: ${generatedQuestionnaire.estimatedCompletionMinutes} phút\n\n` +
      generatedQuestionnaire.sections.map((s) => `${s.title}\n` + s.questions.map((q, idx) => `  ${idx + 1}. ${q.label} (${q.ghgScopeCategory})${q.unit ? ` [Đơn vị: ${q.unit}]` : ''}`).join('\n')).join('\n\n');
    void navigator.clipboard.writeText(text);
    toast({ title: 'Đã sao chép bộ câu hỏi khảo sát Scope 3' });
  };

  const handleAiExtractedSupplier = (data: Record<string, unknown>) => {
    setForm((prev) => ({
      ...prev,
      supplierName: String(data.legalName || data.name || prev.supplierName),
      material: String(data.sector || data.material || prev.material),
    }));
    setOpen(true);
    toast({ title: 'Đã nhận diện thông tin nhà cung ứng từ tài liệu AI' });
  };

  const totalRequests = rows.length;
  const waitingRequests = rows.filter((r) => r.status === 'waiting' || r.status === 'sent').length;
  const receivedRequests = rows.filter((r) => r.status === 'received').length;
  const overdueRequests = rows.filter((r) => r.status === 'overdue').length;

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6">
      {/* Header with Title and AI Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản trị Nhà cung ứng</h1>
            <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-800">
              Scope 3 Category 1 Intelligence
            </Badge>
          </div>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Thu thập dữ liệu phát thải Scope 3, đánh giá rủi ro ESG chuỗi cung ứng và quản trị mạng lưới nhà cung ứng theo chuẩn GHG Protocol và EU CBAM.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* AI Scope 3 Questionnaire Copilot */}
          <Button
            variant="outline"
            onClick={() => handleOpenQuestionnaireGen()}
            className="border-emerald-300 bg-emerald-50/60 text-xs font-medium text-emerald-800 hover:bg-emerald-100 flex items-center gap-1.5 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Soạn bộ câu hỏi Scope 3 (AI)
          </Button>

          {/* AI Document Import */}
          <Button
            variant="outline"
            onClick={() => setShowAiImport(true)}
            className="border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-xs"
          >
            <FileText className="w-3.5 h-3.5 text-primary" />
            Quét hồ sơ NCC (AI)
          </Button>

          {/* Create Request Dialog Trigger */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-medium text-xs">
                <Plus className="w-4 h-4 mr-1.5" />
                Tạo yêu cầu dữ liệu
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-slate-900">Yêu cầu dữ liệu Nhà cung ứng</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="supplier-name" className="text-xs font-semibold text-slate-700">Tên nhà cung ứng</Label>
                  <Input
                    id="supplier-name"
                    placeholder="Ví dụ: Công ty Dệt May ABC"
                    value={form.supplierName}
                    onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="supplier-email" className="text-xs font-semibold text-slate-700">Email liên hệ</Label>
                  <Input
                    id="supplier-email"
                    type="email"
                    placeholder="supplier@example.com"
                    value={form.supplierEmail}
                    onChange={(e) => setForm({ ...form, supplierEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="supplier-material" className="text-xs font-semibold text-slate-700">Nguyên vật liệu cung cấp</Label>
                  <Input
                    id="supplier-material"
                    placeholder="Ví dụ: Vải sợi Organic Cotton, Nhuộm hoạt tính"
                    value={form.material}
                    onChange={(e) => setForm({ ...form, material: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="supplier-required-data" className="text-xs font-semibold text-slate-700">
                      Dữ liệu yêu cầu (phân cách bằng dấu phẩy)
                    </Label>
                    <button
                      type="button"
                      onClick={() => handleOpenQuestionnaireGen(form.material || 'Dệt may')}
                      className="text-[11px] font-medium text-emerald-700 hover:underline inline-flex items-center gap-1"
                    >
                      <Sparkles className="h-3 w-3" /> Gợi ý AI
                    </button>
                  </div>
                  <Input
                    id="supplier-required-data"
                    value={form.required}
                    onChange={(e) => setForm({ ...form, required: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="supplier-deadline" className="text-xs font-semibold text-slate-700">Hạn phản hồi</Label>
                  <Input
                    id="supplier-deadline"
                    type="date"
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter className="pt-3">
                <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {demo ? 'Lưu yêu cầu (Demo 1 giờ)' : 'Lưu và tạo yêu cầu'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quick summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-slate-200/80 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-600">Tổng yêu cầu dữ liệu</div>
            <div className="text-2xl font-bold tracking-tight text-slate-900 mt-1">{totalRequests}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Theo dõi chuỗi giá trị Scope 3</p>
          </CardContent>
        </Card>
        <Card className="border border-amber-200/80 bg-amber-50/30 shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-600">Đang chờ phản hồi</div>
            <div className="text-2xl font-bold tracking-tight text-amber-700 mt-1">{waitingRequests}</div>
            <p className="text-[11px] text-amber-600/80 mt-0.5">Cần nhắc nhở trước hạn</p>
          </CardContent>
        </Card>
        <Card className="border border-emerald-200/80 bg-emerald-50/30 shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-600">Đã nhận phản hồi</div>
            <div className="text-2xl font-bold tracking-tight text-emerald-700 mt-1">{receivedRequests}</div>
            <p className="text-[11px] text-emerald-600/80 mt-0.5">Sẵn sàng đối soát định lượng</p>
          </CardContent>
        </Card>
        <Card className="border border-rose-200/80 bg-rose-50/30 shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-600">Quá hạn phản hồi</div>
            <div className="text-2xl font-bold tracking-tight text-rose-700 mt-1">{overdueRequests}</div>
            <p className="text-[11px] text-rose-600/80 mt-0.5">Rủi ro thiếu dữ liệu kiểm toán</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Scope 3 Requests Table with AI ESG Screener */}
      <Card className="border border-slate-200/80 shadow-xs">
        <CardHeader className="border-b border-slate-200/80 bg-slate-50/60 py-3.5 px-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">Danh sách yêu cầu thu thập dữ liệu Scope 3</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Tích hợp AI đánh giá sơ bộ rủi ro ESG và ước tính cường độ carbon vật tư cung ứng
            </p>
          </div>
          <Badge variant="outline" className="text-[11px] border-emerald-300 bg-emerald-50 text-emerald-800">
            {rows.length} đối tác cung ứng
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="w-5 h-5 mr-2 animate-spin text-emerald-600" />
              Đang tải dữ liệu nhà cung ứng…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              Chưa có yêu cầu nào. Bấm &quot;Tạo yêu cầu dữ liệu&quot; để bắt đầu thu thập Scope 3.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs font-semibold text-slate-600 border-b border-slate-200/80 bg-slate-50/40">
                  <tr>
                    <th className="py-3 px-4">Nhà cung ứng</th>
                    <th className="py-3 px-3">Vật liệu cung cấp</th>
                    <th className="py-3 px-3">Giám định ESG & Carbon (AI)</th>
                    <th className="py-3 px-3">Dữ liệu yêu cầu</th>
                    <th className="py-3 px-3">Hạn phản hồi</th>
                    <th className="py-3 px-3">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => {
                    const esg = screenSupplierEsgAndCarbon({
                      id: r.id,
                      name: r.supplierName,
                      materialSupplied: r.materialSupplied,
                    });
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{r.supplierName}</div>
                          <div className="text-xs text-slate-500 font-mono">{r.supplierEmail}</div>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-700 font-medium">
                          {r.materialSupplied || '—'}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setInspectingEsgSupplier(esg)}
                              className="text-left group cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-semibold ${
                                    esg.esgRiskLevel === 'low'
                                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                      : esg.esgRiskLevel === 'medium'
                                      ? 'border-amber-300 bg-amber-50 text-amber-800'
                                      : 'border-rose-300 bg-rose-50 text-rose-800'
                                  }`}
                                >
                                  ESG: {esg.esgScore}/100 · {esg.esgRiskLevel.toUpperCase()}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  ~{esg.scope3EstimatedIntensityKgCo2e} kgCO₂e/kg
                                </span>
                              </div>
                              <span className="text-[10px] text-emerald-600 group-hover:underline block mt-0.5">
                                Xem phân tích AI &rarr;
                              </span>
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 max-w-xs truncate" title={(r.requiredData || []).join(', ')}>
                          {(r.requiredData || []).join(', ')}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 font-mono whitespace-nowrap">
                          {r.deadline || '—'}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLOR[r.status]}`}>
                            {STATUS_LABEL[r.status]}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-slate-200 text-xs font-medium text-slate-700 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50/50"
                            onClick={() => sendMail(r)}
                          >
                            <Mail className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            Gửi email
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI ESG Screening Inspector Dialog */}
      {inspectingEsgSupplier && (
        <Dialog open={Boolean(inspectingEsgSupplier)} onOpenChange={() => setInspectingEsgSupplier(null)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                <DialogTitle className="text-base font-bold text-slate-900">
                  Hồ sơ Giám định ESG & Carbon Chuỗi cung ứng (AI Screener)
                </DialogTitle>
              </div>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h4 className="font-semibold text-slate-900">{inspectingEsgSupplier.supplierName}</h4>
                  <p className="text-xs text-slate-500">
                    Phân hạng dữ liệu: <strong className="text-slate-800">{inspectingEsgSupplier.emissionTier}</strong>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500">Điểm ESG tổng hợp</span>
                  <div className="text-2xl font-bold text-emerald-600">{inspectingEsgSupplier.esgScore}/100</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border p-3 bg-slate-50">
                  <span className="text-slate-500 block">Ước tính cường độ phát thải</span>
                  <p className="text-base font-bold text-slate-900 mt-1">
                    {inspectingEsgSupplier.scope3EstimatedIntensityKgCo2e} <span className="text-xs font-normal text-slate-500">kgCO₂e/kg</span>
                  </p>
                  <span className="text-[10px] text-slate-400 mt-1 block">Dựa trên cơ sở dữ liệu vật tư GHG Protocol</span>
                </div>
                <div className="rounded-lg border p-3 bg-slate-50">
                  <span className="text-slate-500 block">Mức độ ưu tiên tương tác</span>
                  <p className="text-base font-bold text-amber-700 mt-1 capitalize">
                    {inspectingEsgSupplier.priorityEngagement}
                  </p>
                  <span className="text-[10px] text-slate-400 mt-1 block">Theo ma trận rủi ro CBAM 2026</span>
                </div>
              </div>

              {/* Certifications */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">Chứng nhận sinh thái & môi trường phát hiện</Label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {inspectingEsgSupplier.certificationsDetected.length > 0 ? (
                    inspectingEsgSupplier.certificationsDetected.map((c, i) => (
                      <Badge key={i} variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                        {c}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">Chưa phát hiện chứng nhận môi trường của bên thứ ba</span>
                  )}
                </div>
              </div>

              {/* Risk Flags */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">Cảnh báo rủi ro chuỗi cung ứng</Label>
                <ul className="mt-1 space-y-1 text-xs text-slate-600">
                  {inspectingEsgSupplier.riskFlags.map((flag, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 rounded-md bg-amber-50/50 p-2 border border-amber-200/60">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>{flag}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommendations */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-900 leading-relaxed">
                <strong>Khuyến nghị hành động AI:</strong> {inspectingEsgSupplier.recommendedAction}
              </div>
            </div>
            <DialogFooter className="pt-3">
              <Button variant="outline" onClick={() => setInspectingEsgSupplier(null)}>Đóng</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* AI Scope 3 Questionnaire Copilot Modal */}
      {showQuestionnaireModal && generatedQuestionnaire && (
        <Dialog open={showQuestionnaireModal} onOpenChange={setShowQuestionnaireModal}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                <DialogTitle className="text-base font-bold text-slate-900">
                  Bộ câu hỏi Thu thập dữ liệu Scope 3 Chuẩn hóa (AI Copilot)
                </DialogTitle>
              </div>
            </DialogHeader>
            <div className="space-y-4 pt-1 max-h-[70vh] overflow-y-auto pr-1">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <div>
                  <h4 className="font-semibold text-sm text-slate-900">{generatedQuestionnaire.title}</h4>
                  <span className="text-xs text-slate-500">Thời gian trả lời dự kiến: ~{generatedQuestionnaire.estimatedCompletionMinutes} phút</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={copyQuestionnaireText} className="h-8 text-xs">
                    <Copy className="h-3.5 w-3.5 mr-1 text-slate-600" /> Sao chép văn bản
                  </Button>
                  <Button size="sm" onClick={applyQuestionnaireToForm} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                    Áp dụng vào mẫu
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {generatedQuestionnaire.sections.map((sec, idx) => (
                  <div key={idx} className="rounded-lg border bg-slate-50/60 p-3 space-y-2">
                    <h5 className="font-semibold text-xs text-emerald-800 uppercase tracking-wide">{sec.title}</h5>
                    <div className="space-y-2">
                      {sec.questions.map((q) => (
                        <div key={q.id} className="rounded border bg-white p-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-900">{q.label}</span>
                            <Badge variant="outline" className="text-[10px] text-slate-500">{q.ghgScopeCategory}</Badge>
                          </div>
                          {q.hint && <p className="text-[11px] text-slate-400 mt-1">{q.hint}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => setShowQuestionnaireModal(false)}>Đóng</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* AI Document Import Modal */}
      <AiDocumentImportModal
        open={showAiImport}
        onOpenChange={setShowAiImport}
        contextKey="supplier"
        onApply={handleAiExtractedSupplier}
      />

      {/* Deep Supplier Network Panel */}
      <SupplierNetworkPanel demo={demo} />
    </div>
  );
}
