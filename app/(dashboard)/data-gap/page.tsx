'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  FileCheck2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/apiClient';
import { toast } from '@/hooks/useToast';
import { EvidenceSelector } from '@/components/evidence/EvidenceSelector';
import { demoSessionCache } from '@/lib/dashboard/demoSessionCache';
import { scanAuditDataGaps } from '@/lib/ai/carbonDataAiService';
import { AiDocumentImportModal } from '@/components/ui/AiDocumentImportModal';

type GapStatus =
  | 'missing'
  | 'proxy'
  | 'self_declared'
  | 'uploaded'
  | 'verified';
type Risk = 'low' | 'medium' | 'high';

interface GapRow {
  id: string;
  dataGroup: string;
  requiredForAudit: boolean;
  currentStatus: GapStatus;
  riskLevel: Risk;
  requiredAction: string | null;
  owner: string | null;
  deadline: string | null;
  regulationTag?: string;
}

const STATUS_LABEL: Record<GapStatus, string> = {
  missing: 'Thiếu',
  proxy: 'Proxy',
  self_declared: 'Tự khai báo',
  uploaded: 'Đã tải lên',
  verified: 'Đã xác minh',
};

const RISK_COLOR: Record<Risk, string> = {
  low: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

const SEED_GROUPS = [
  'Dyeing supplier energy data',
  'Diesel/thermal process evidence',
  'Sea freight document (LOT-EU-2026-001)',
  'BOM and electricity invoice',
  'GOTS certification for cotton lot 2026',
  'Scope 1 fuel emission factor verification',
];

const EMPTY_FORM = {
  dataGroup: '',
  currentStatus: 'missing' as GapStatus,
  riskLevel: 'high' as Risk,
  requiredAction: '',
  owner: '',
  deadline: '',
  regulationTag: 'Kiểm toán nội bộ',
};

export default function DataGapPage() {
  const { user } = useAuth();
  const companyId = user?.company_id ?? null;
  const isDemo = !companyId || (typeof window !== 'undefined' && window.location.pathname.startsWith('/demo'));

  const [rows, setRows] = useState<GapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [frameworkFilter, setFrameworkFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAiImport, setShowAiImport] = useState(false);
  const [scanningAi, setScanningAi] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingGap, setEditingGap] = useState<GapRow | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolvingGap, setResolvingGap] = useState<GapRow | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    if (isDemo) {
      const demoRows = demoSessionCache.getDataGaps();
      setRows(demoRows);
      setLoading(false);
      return;
    }
    if (!companyId) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<GapRow[]>('/data-gaps');
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, isDemo]);

  useEffect(() => {
    void load();
  }, [load]);

  const seed = async () => {
    if (isDemo) {
      const seeded = demoSessionCache.seedDataGaps(SEED_GROUPS);
      setRows(seeded);
      toast({ title: 'Đã tạo checklist mặc định (lưu cache demo)' });
      return;
    }
    if (!companyId) return;
    try {
      await api.post('/data-gaps/seed', { groups: SEED_GROUPS });
      toast({ title: 'Đã tạo checklist mặc định' });
      await load();
    } catch (e) {
      toast({
        title: (e as Error).message || 'Lỗi tạo checklist',
        variant: 'destructive',
      });
    }
  };

  // Run AI Audit Gap Scanner
  const handleRunAiScanner = () => {
    setScanningAi(true);
    setTimeout(() => {
      const result = scanAuditDataGaps({ framework: frameworkFilter === 'all' ? 'ISO_14064' : frameworkFilter });
      if (isDemo) {
        result.detectedGaps.forEach((g) => {
          demoSessionCache.addDataGap({
            dataGroup: g.dataGroup,
            riskLevel: g.riskLevel,
            currentStatus: g.currentStatus,
            requiredAction: g.requiredAction,
            owner: g.owner,
            deadline: g.deadline,
            regulationTag: g.regulationTag,
          });
        });
        setRows(demoSessionCache.getDataGaps());
      } else {
        // Real mode: add to state
        setRows((prev) => {
          const existing = new Set(prev.map((p) => p.dataGroup));
          const newGaps: GapRow[] = result.detectedGaps
            .filter((g) => !existing.has(g.dataGroup))
            .map((g) => ({
              id: g.id,
              dataGroup: g.dataGroup,
              requiredForAudit: true,
              currentStatus: g.currentStatus,
              riskLevel: g.riskLevel,
              requiredAction: g.requiredAction,
              owner: g.owner,
              deadline: g.deadline,
              regulationTag: g.regulationTag,
            }));
          return [...newGaps, ...prev];
        });
      }
      setScanningAi(false);
      toast({
        title: 'AI đã quét phát hiện khoảng trống dữ liệu',
        description: `Xác định các hạng mục phát thải cần bổ sung đối soát theo khung ${frameworkFilter.toUpperCase()}.`,
      });
    }, 450);
  };

  const handleApplyAiData = (data: Record<string, unknown>) => {
    setForm((prev) => ({
      ...prev,
      dataGroup: String(data.dataGroup || prev.dataGroup),
      riskLevel: (data.riskLevel as Risk) || prev.riskLevel,
      currentStatus: (data.currentStatus as GapStatus) || prev.currentStatus,
      requiredAction: String(data.requiredAction || prev.requiredAction),
      owner: String(data.owner || prev.owner),
      deadline: String(data.deadline || prev.deadline),
      regulationTag: String(data.regulationTag || prev.regulationTag),
    }));
    setOpen(true);
    toast({ title: 'Đã nạp dữ liệu trích xuất từ tài liệu AI vào biểu mẫu.' });
  };

  const addRow = async () => {
    if (!form.dataGroup) return;

    if (isDemo) {
      demoSessionCache.addDataGap({
        dataGroup: form.dataGroup,
        requiredForAudit: true,
        currentStatus: form.currentStatus,
        riskLevel: form.riskLevel,
        requiredAction: form.requiredAction || null,
        owner: form.owner || null,
        deadline: form.deadline || null,
        regulationTag: form.regulationTag || 'Kiểm toán nội bộ',
      });
      setOpen(false);
      setForm(EMPTY_FORM);
      setRows(demoSessionCache.getDataGaps());
      toast({ title: 'Đã thêm khoảng trống dữ liệu vào cache demo.' });
      return;
    }

    if (!companyId) return;
    try {
      await api.post('/data-gaps', {
        dataGroup: form.dataGroup,
        requiredForAudit: true,
        currentStatus: form.currentStatus,
        riskLevel: form.riskLevel,
        requiredAction: form.requiredAction || null,
        owner: form.owner || null,
        deadline: form.deadline || null,
      });
      setOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (e) {
      toast({ title: (e as Error).message || 'Lỗi thêm mục', variant: 'destructive' });
    }
  };

  const openEdit = (r: GapRow) => {
    setEditingGap(r);
    setEditForm({
      dataGroup: r.dataGroup,
      currentStatus: r.currentStatus,
      riskLevel: r.riskLevel,
      requiredAction: r.requiredAction || '',
      owner: r.owner || '',
      deadline: r.deadline ? r.deadline.slice(0, 10) : '',
      regulationTag: r.regulationTag || 'Kiểm toán nội bộ',
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editingGap || !editForm.dataGroup) return;

    if (isDemo) {
      demoSessionCache.updateDataGap(editingGap.id, {
        dataGroup: editForm.dataGroup,
        currentStatus: editForm.currentStatus,
        riskLevel: editForm.riskLevel,
        requiredAction: editForm.requiredAction || null,
        owner: editForm.owner || null,
        deadline: editForm.deadline || null,
        regulationTag: editForm.regulationTag,
      });
      setEditOpen(false);
      setEditingGap(null);
      setRows(demoSessionCache.getDataGaps());
      toast({ title: 'Đã cập nhật mục đối soát demo.' });
      return;
    }

    try {
      await api.put(`/data-gaps/${editingGap.id}`, {
        dataGroup: editForm.dataGroup,
        currentStatus: editForm.currentStatus,
        riskLevel: editForm.riskLevel,
        requiredAction: editForm.requiredAction || null,
        owner: editForm.owner || null,
        deadline: editForm.deadline || null,
      });
      setEditOpen(false);
      setEditingGap(null);
      toast({ title: 'Đã cập nhật mục kiểm toán.' });
      await load();
    } catch (e) {
      toast({ title: (e as Error).message || 'Lỗi cập nhật', variant: 'destructive' });
    }
  };

  const deleteRow = async (id: string, name: string) => {
    if (!window.confirm(`Xoá mục kiểm toán "${name}"? Hành động này sẽ được ghi vào nhật ký kiểm toán.`)) return;

    if (isDemo) {
      demoSessionCache.deleteDataGap(id);
      setRows(demoSessionCache.getDataGaps());
      toast({ title: 'Đã xoá mục trong cache demo.' });
      return;
    }

    try {
      await api.delete(`/data-gaps/${id}`);
      toast({ title: 'Đã xoá mục kiểm toán.' });
      await load();
    } catch (e) {
      toast({ title: (e as Error).message || 'Lỗi xoá mục', variant: 'destructive' });
    }
  };

  const openResolve = (r: GapRow) => {
    setResolvingGap(r);
    setSelectedEvidenceId(null);
    setResolveNotes(r.requiredAction || '');
    setResolveOpen(true);
  };

  const confirmResolve = async () => {
    if (!resolvingGap) return;
    if (!selectedEvidenceId) {
      toast({
        title: 'Chưa chọn chứng từ',
        description: 'Vui lòng chọn chứng từ thật từ Evidence Vault để hoàn tất khoảng trống.',
        variant: 'destructive',
      });
      return;
    }

    const updatedAction = resolveNotes
      ? `${resolveNotes} (Đã gắn chứng từ #${selectedEvidenceId.slice(0, 8)})`
      : `Đã gắn chứng từ #${selectedEvidenceId.slice(0, 8)}`;

    if (isDemo) {
      demoSessionCache.updateDataGap(resolvingGap.id, {
        currentStatus: 'uploaded',
        requiredAction: updatedAction,
      });
      setResolveOpen(false);
      setResolvingGap(null);
      setSelectedEvidenceId(null);
      setRows(demoSessionCache.getDataGaps());
      toast({ title: 'Đã liên kết chứng từ và đánh dấu Đã tải lên (cache demo).' });
      return;
    }

    try {
      await api.put(`/data-gaps/${resolvingGap.id}`, {
        currentStatus: 'uploaded',
        requiredAction: updatedAction,
      });
      setResolveOpen(false);
      setResolvingGap(null);
      setSelectedEvidenceId(null);
      toast({ title: 'Đã liên kết chứng từ và đánh dấu Đã tải lên.' });
      await load();
    } catch (e) {
      toast({ title: (e as Error).message || 'Lỗi liên kết chứng từ', variant: 'destructive' });
    }
  };

  // Metrics calculation
  const total = rows.length || 1;
  const availableCount = rows.filter(
    (r) => r.currentStatus === 'verified' || r.currentStatus === 'uploaded'
  ).length;
  const verifiedCount = rows.filter((r) => r.currentStatus === 'verified').length;
  const proxyCount = rows.filter((r) => r.currentStatus === 'proxy').length;
  const missingCount = rows.filter((r) => r.currentStatus === 'missing').length;
  const score = Math.round((availableCount / total) * 100);
  const primaryPct = Math.round((verifiedCount / total) * 100);
  const proxyPct = Math.round((proxyCount / total) * 100);

  // Filter rows
  const filteredRows = rows.filter((r) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        r.dataGroup.toLowerCase().includes(q) ||
        (r.requiredAction && r.requiredAction.toLowerCase().includes(q)) ||
        (r.owner && r.owner.toLowerCase().includes(q)) ||
        (r.regulationTag && r.regulationTag.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (statusFilter !== 'all' && r.currentStatus !== statusFilter) return false;
    if (frameworkFilter !== 'all') {
      const tag = (r.regulationTag || '').toLowerCase();
      if (frameworkFilter === 'iso' && !tag.includes('iso')) return false;
      if (frameworkFilter === 'qd13' && !tag.includes('13') && !tag.includes('06')) return false;
      if (frameworkFilter === 'cbam' && !tag.includes('cbam')) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-amber-600" />
              Kiểm tra Khoảng trống Dữ liệu
            </h1>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200/80">
              Audit Readiness
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Theo dõi độ đầy đủ của các nhóm dữ liệu carbon nội bộ. Việc tải tệp lên
            không đồng nghĩa dữ liệu đã được xác minh, phù hợp ISO hoặc được kiểm toán.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {rows.length === 0 && !loading && (
            <Button size="sm" variant="outline" onClick={seed} className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs">
              Tạo checklist mặc định
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleRunAiScanner}
            disabled={scanningAi}
            className="border-primary/40 text-primary hover:bg-primary/10 text-xs font-medium"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            {scanningAi ? 'Đang quét lỗ hổng…' : 'Quét lỗ hổng rà soát bằng AI'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAiImport(true)}
            className="border-slate-300 text-xs font-medium"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Quét Hóa đơn / Hồ sơ AI
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs">
                <Plus className="w-4 h-4 mr-1.5" />
                Thêm mục mới
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-slate-900">Thêm khoảng trống dữ liệu</DialogTitle>
                <DialogDescription className="text-xs">
                  Khai báo nhóm dữ liệu phát thải còn thiếu hoặc cần đối soát.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3.5 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Nhóm dữ liệu</Label>
                  <Input
                    placeholder="Ví dụ: Hóa đơn điện Q3, Dữ liệu nhiên liệu lò hơi"
                    value={form.dataGroup}
                    onChange={(e) => setForm({ ...form, dataGroup: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Trạng thái hiện tại</Label>
                    <Select
                      value={form.currentStatus}
                      onValueChange={(v) => setForm({ ...form, currentStatus: v as GapStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABEL) as GapStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Mức rủi ro</Label>
                    <Select
                      value={form.riskLevel}
                      onValueChange={(v) => setForm({ ...form, riskLevel: v as Risk })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['low', 'medium', 'high'] as Risk[]).map((r) => (
                          <SelectItem key={r} value={r}>
                            {r.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Hành động yêu cầu</Label>
                  <Input
                    placeholder="Ví dụ: Liên hệ nhà máy lấy hóa đơn gốc"
                    value={form.requiredAction}
                    onChange={(e) => setForm({ ...form, requiredAction: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Người chịu trách nhiệm</Label>
                    <Input
                      placeholder="Tên / phòng ban"
                      value={form.owner}
                      onChange={(e) => setForm({ ...form, owner: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Hạn xử lý</Label>
                    <Input
                      type="date"
                      value={form.deadline}
                      onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Quy chuẩn áp dụng</Label>
                  <Input
                    placeholder="ISO 14064, QĐ 13/2024, CBAM..."
                    value={form.regulationTag}
                    onChange={(e) => setForm({ ...form, regulationTag: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter className="pt-3">
                <Button onClick={addRow} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                  Lưu mục mới
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 2. Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-slate-200/80 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-600">Độ đầy đủ hồ sơ</div>
            <div className={`text-2xl font-bold tracking-tight mt-1 ${score >= 75 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {score}
              <span className="text-sm font-normal text-slate-500">/100</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-emerald-200/80 bg-emerald-50/30 shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-600">Đã xác minh nguồn</div>
            <div className="text-2xl font-bold tracking-tight text-emerald-700 mt-1">{primaryPct}%</div>
          </CardContent>
        </Card>

        <Card className="border border-sky-200/80 bg-sky-50/30 shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-600">Proxy ước tính</div>
            <div className="text-2xl font-bold tracking-tight text-sky-700 mt-1">{proxyPct}%</div>
          </CardContent>
        </Card>

        <Card className="border border-red-200/80 bg-red-50/30 shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-600">Thiếu chứng từ</div>
            <div className="text-2xl font-bold tracking-tight text-red-700 mt-1">{missingCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Search and Framework Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Tìm theo nhóm dữ liệu, người phụ trách, hành động…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <select
          aria-label="Lọc theo quy chuẩn"
          value={frameworkFilter}
          onChange={(e) => setFrameworkFilter(e.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs"
        >
          <option value="all">Tất cả quy chuẩn</option>
          <option value="iso">ISO 14064-1:2018</option>
          <option value="qd13">QĐ 13/2024 & NĐ 06/2022</option>
          <option value="cbam">EU CBAM Regulation</option>
        </select>

        <select
          aria-label="Lọc theo trạng thái"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="missing">Thiếu</option>
          <option value="proxy">Proxy</option>
          <option value="self_declared">Tự khai báo</option>
          <option value="uploaded">Đã tải lên</option>
          <option value="verified">Đã xác minh</option>
        </select>
      </div>

      {/* 4. Table of Data Gaps */}
      <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Nhóm dữ liệu</th>
                <th className="p-3">Quy chuẩn</th>
                <th className="p-3">Rủi ro</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Hành động yêu cầu</th>
                <th className="p-3">Người phụ trách</th>
                <th className="p-3">Hạn xử lý</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Chưa có mục nào trong danh sách. Nhấn &ldquo;Quét lỗ hổng rà soát bằng AI&rdquo; hoặc &ldquo;Tạo checklist mặc định&rdquo;.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-semibold text-slate-900 max-w-[200px] truncate">
                      {r.dataGroup}
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {r.regulationTag || 'Kiểm toán nội bộ'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${RISK_COLOR[r.riskLevel]}`}>
                        {r.riskLevel.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px] font-medium">
                        {STATUS_LABEL[r.currentStatus]}
                      </Badge>
                    </td>
                    <td className="p-3 text-slate-600 max-w-[240px] truncate">
                      {r.requiredAction || '—'}
                    </td>
                    <td className="p-3 text-slate-600 whitespace-nowrap">
                      {r.owner || 'Chưa phân công'}
                    </td>
                    <td className="p-3 text-slate-500 whitespace-nowrap">
                      {r.deadline ? r.deadline.slice(0, 10) : '—'}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openResolve(r)}
                        className="h-7 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                      >
                        <FileCheck2 className="w-3.5 h-3.5 mr-1" />
                        Gắn chứng từ
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(r)}
                        className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteRow(r.id, r.dataGroup)}
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. AI Document Import Modal */}
      <AiDocumentImportModal
        open={showAiImport}
        onOpenChange={setShowAiImport}
        contextKey="data_gap"
        onApply={handleApplyAiData}
        demo={isDemo}
      />

      {/* 6. Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">Sửa mục kiểm toán</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nhóm dữ liệu</Label>
              <Input
                value={editForm.dataGroup}
                onChange={(e) => setEditForm({ ...editForm, dataGroup: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Trạng thái</Label>
                <Select
                  value={editForm.currentStatus}
                  onValueChange={(v) => setEditForm({ ...editForm, currentStatus: v as GapStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as GapStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Mức rủi ro</Label>
                <Select
                  value={editForm.riskLevel}
                  onValueChange={(v) => setEditForm({ ...editForm, riskLevel: v as Risk })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['low', 'medium', 'high'] as Risk[]).map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Hành động yêu cầu</Label>
              <Input
                value={editForm.requiredAction}
                onChange={(e) => setEditForm({ ...editForm, requiredAction: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Người chịu trách nhiệm</Label>
                <Input
                  value={editForm.owner}
                  onChange={(e) => setEditForm({ ...editForm, owner: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Hạn xử lý</Label>
                <Input
                  type="date"
                  value={editForm.deadline}
                  onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="pt-3">
            <Button onClick={saveEdit} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. Resolve with Evidence Vault Dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">Liên kết chứng từ để hoàn tất khoảng trống</DialogTitle>
            <DialogDescription className="text-xs">
              Chọn chứng từ từ Evidence Vault để chứng minh cho mục &ldquo;{resolvingGap?.dataGroup}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <EvidenceSelector
              value={selectedEvidenceId}
              onChange={(id) => setSelectedEvidenceId(id)}
              filterKind="financial"
            />
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Ghi chú đối soát</Label>
              <Input
                placeholder="Ghi chú xác thực chứng từ..."
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="pt-3">
            <Button onClick={confirmResolve} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
              Xác nhận liên kết chứng từ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
