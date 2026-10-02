'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  CheckCircle2,
  FileCheck2,
  Loader2,
  Pencil,
  Plus,
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
};

export default function DataGapPage() {
  const { user } = useAuth();
  const isViewer = user?.company_role === 'viewer';
  const companyId = user?.company_id ?? null;
  const [rows, setRows] = useState<GapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [editOpen, setEditOpen] = useState(false);
  const [editingGap, setEditingGap] = useState<GapRow | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolvingGap, setResolvingGap] = useState<GapRow | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await api.get<GapRow[]>('/data-gaps');
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const seed = async () => {
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

  const addRow = async () => {
    if (!companyId || !form.dataGroup) return;
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
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editingGap || !editForm.dataGroup) return;
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
    try {
      const updatedAction = resolveNotes
        ? `${resolveNotes} (Đã gắn chứng từ #${selectedEvidenceId.slice(0, 8)})`
        : `Đã gắn chứng từ #${selectedEvidenceId.slice(0, 8)}`;

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

  const total = rows.length || 1;
  const availableCount = rows.filter(
    (r) => r.currentStatus === 'verified' || r.currentStatus === 'uploaded'
  ).length;
  const verifiedCount = rows.filter((r) => r.currentStatus === 'verified').length;
  const proxyCount = rows.filter((r) => r.currentStatus === 'proxy').length;
  const missingCount = rows.filter(
    (r) => r.currentStatus === 'missing'
  ).length;
  const score = Math.round((availableCount / total) * 100);
  const primaryPct = Math.round((verifiedCount / total) * 100);
  const proxyPct = Math.round((proxyCount / total) * 100);

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6">
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
            Theo dõi độ đầy đủ của 6 nhóm dữ liệu carbon nội bộ. Việc tải tệp lên
            không đồng nghĩa dữ liệu đã được xác minh, phù hợp ISO hoặc được kiểm toán.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {rows.length === 0 && !loading && (
            <Button size="sm" variant="outline" onClick={seed} className="border-slate-200 text-slate-700 hover:bg-slate-50">
              Tạo checklist mặc định
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs">
                <Plus className="w-4 h-4 mr-1.5" />
                Thêm mục mới
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-slate-900">Thêm khoảng trống dữ liệu</DialogTitle>
              </DialogHeader>
              <div className="space-y-3.5 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Nhóm dữ liệu</Label>
                  <Input
                    placeholder="Ví dụ: Hóa đơn điện Q3, Dữ liệu nhiên liệu lò hơi"
                    value={form.dataGroup}
                    onChange={(e) =>
                      setForm({ ...form, dataGroup: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Trạng thái hiện tại</Label>
                    <Select
                      value={form.currentStatus}
                      onValueChange={(v) =>
                        setForm({ ...form, currentStatus: v as GapStatus })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABEL) as GapStatus[]).map(
                          (s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Mức rủi ro</Label>
                    <Select
                      value={form.riskLevel}
                      onValueChange={(v) =>
                        setForm({ ...form, riskLevel: v as Risk })
                      }
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
                    onChange={(e) =>
                      setForm({ ...form, requiredAction: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Người chịu trách nhiệm</Label>
                    <Input
                      placeholder="Tên / phòng ban"
                      value={form.owner}
                      onChange={(e) =>
                        setForm({ ...form, owner: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Hạn xử lý</Label>
                    <Input
                      type="date"
                      value={form.deadline}
                      onChange={(e) =>
                        setForm({ ...form, deadline: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="pt-3">
                <Button onClick={addRow} className="bg-emerald-600 hover:bg-emerald-700 text-white">Lưu mục mới</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-slate-200/80 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-600">
              Độ đầy đủ hồ sơ
            </div>
            <div
              className={`text-2xl font-bold tracking-tight mt-1 ${score >= 75 ? 'text-emerald-700' : 'text-amber-700'}`}
            >
              {score}<span className="text-sm font-normal text-slate-500">/100</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-emerald-200/80 bg-emerald-50/30 shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-600">Đã xác minh nguồn</div>
            <div className="text-2xl font-bold tracking-tight text-emerald-700 mt-1">{primaryPct}%</div>
          </CardContent>
        </Card>
        <Card className="border border-amber-200/80 bg-amber-50/30 shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-600">Proxy / Mặc định</div>
            <div className="text-2xl font-bold tracking-tight text-amber-700 mt-1">{proxyPct}%</div>
          </CardContent>
        </Card>
        <Card className="border border-rose-200/80 bg-rose-50/30 shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-600">Dữ liệu còn thiếu</div>
            <div className="text-2xl font-bold tracking-tight text-rose-700 mt-1">{missingCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200/80 shadow-xs">
        <CardHeader className="border-b border-slate-200/80 bg-slate-50/60 py-3.5 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            Bảng theo dõi khoảng trống dữ liệu
          </CardTitle>
          <div className="text-xs font-medium text-slate-500">
            {rows.length} mục kiểm toán
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="w-5 h-5 mr-2 animate-spin text-emerald-600" />
              Đang tải danh mục kiểm tra…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              Chưa có mục nào. Tạo checklist mặc định để bắt đầu rà soát.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs font-semibold text-slate-600 border-b border-slate-200/80 bg-slate-50/40">
                  <tr>
                    <th className="py-3 px-4">Nhóm dữ liệu</th>
                    <th className="py-3 px-3">Yêu cầu</th>
                    <th className="py-3 px-3">Trạng thái</th>
                    <th className="py-3 px-3">Mức rủi ro</th>
                    <th className="py-3 px-3">Hành động yêu cầu</th>
                    <th className="py-3 px-3">Phụ trách</th>
                    <th className="py-3 px-3">Hạn chót</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900">{r.dataGroup}</td>
                      <td className="py-3 px-3">
                        {r.requiredForAudit ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                            Bắt buộc
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            Tùy chọn
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
                          {STATUS_LABEL[r.currentStatus]}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${RISK_COLOR[r.riskLevel]}`}
                        >
                          {r.riskLevel.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-700">{r.requiredAction || '—'}</td>
                      <td className="py-3 px-3 text-xs text-slate-600">
                        {r.owner || (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 font-mono whitespace-nowrap">
                        {r.deadline ? (
                          new Date(r.deadline).toLocaleDateString('vi-VN')
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.currentStatus !== 'verified' &&
                            r.currentStatus !== 'uploaded' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-emerald-200 text-xs font-medium text-emerald-800 bg-emerald-50/50 hover:bg-emerald-100"
                                onClick={() => openResolve(r)}
                                title="Gắn chứng từ để giải quyết khoảng trống"
                              >
                                <Upload className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                Gắn chứng từ
                              </Button>
                            )}
                          {!isViewer && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                onClick={() => openEdit(r)}
                                title="Chỉnh sửa mục kiểm toán"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => deleteRow(r.id, r.dataGroup)}
                                title="Xoá mục kiểm toán"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Data Gap Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Chỉnh sửa khoảng trống dữ liệu</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Cập nhật thông tin nhóm dữ liệu, trạng thái, người phụ trách và hạn chót.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Nhóm dữ liệu</Label>
              <Input
                placeholder="Tên nhóm dữ liệu"
                value={editForm.dataGroup}
                onChange={(e) => setEditForm({ ...editForm, dataGroup: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Trạng thái</Label>
                <Select
                  value={editForm.currentStatus}
                  onValueChange={(v) => setEditForm({ ...editForm, currentStatus: v as GapStatus })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as GapStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Mức rủi ro</Label>
                <Select
                  value={editForm.riskLevel}
                  onValueChange={(v) => setEditForm({ ...editForm, riskLevel: v as Risk })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['low', 'medium', 'high'] as Risk[]).map((r) => (
                      <SelectItem key={r} value={r}>{r.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Hành động yêu cầu</Label>
              <Input
                placeholder="Cần thu thập tài liệu gì..."
                value={editForm.requiredAction}
                onChange={(e) => setEditForm({ ...editForm, requiredAction: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Người phụ trách</Label>
                <Input
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={editForm.owner}
                  onChange={(e) => setEditForm({ ...editForm, owner: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Hạn chót</Label>
                <Input
                  type="date"
                  value={editForm.deadline}
                  onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>
              Hủy
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={saveEdit}>
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve / Link Evidence Modal */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-emerald-600" />
              Giải quyết khoảng trống: {resolvingGap?.dataGroup}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Chọn chứng từ thật từ Evidence Vault để xác minh và hoàn tất mục kiểm toán này.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Chứng từ đính kèm</Label>
              <EvidenceSelector
                value={selectedEvidenceId}
                onChange={(id) => setSelectedEvidenceId(id)}
                placeholder="Chọn chứng từ đã lưu..."
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Ghi chú đối chiếu / Giải trình</Label>
              <Input
                placeholder="Ví dụ: Hóa đơn điện tháng 5 kèm chữ ký số"
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setResolveOpen(false)}>
              Hủy
            </Button>
            <Button
              size="sm"
              disabled={!selectedEvidenceId}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={confirmResolve}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Xác nhận hoàn tất
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
