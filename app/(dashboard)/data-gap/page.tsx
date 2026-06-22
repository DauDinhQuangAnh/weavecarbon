'use client';

import React, { useEffect, useState } from 'react';
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
import { AlertCircle, Loader2, Plus, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/apiClient';
import { toast } from '@/hooks/useToast';

type GapStatus =
  | 'missing'
  | 'proxy'
  | 'self_declared'
  | 'uploaded'
  | 'verified';
type Risk = 'low' | 'medium' | 'high';

interface GapRow {
  id: string;
  data_group: string;
  required_for_audit: boolean;
  current_status: GapStatus;
  risk_level: Risk;
  required_action: string | null;
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
  data_group: '',
  current_status: 'missing' as GapStatus,
  risk_level: 'high' as Risk,
  required_action: '',
  owner: '',
  deadline: '',
};

export default function DataGapPage() {
  const { user } = useAuth();
  const companyId = user?.company_id ?? null;
  const [rows, setRows] = useState<GapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await apiRequest<GapRow[]>(
        `/data-gaps?companyId=${companyId}`
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

  const seed = async () => {
    if (!companyId) return;
    try {
      await apiRequest('/data-gaps/seed', {
        method: 'POST',
        body: JSON.stringify({ company_id: companyId, groups: SEED_GROUPS }),
      });
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
    if (!companyId || !form.data_group) return;
    try {
      await apiRequest('/data-gaps', {
        method: 'POST',
        body: JSON.stringify({
          company_id: companyId,
          data_group: form.data_group,
          required_for_audit: true,
          current_status: form.current_status,
          risk_level: form.risk_level,
          required_action: form.required_action || null,
          owner: form.owner || null,
          deadline: form.deadline || null,
        }),
      });
      setOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (e) {
      toast({ title: (e as Error).message || 'Lỗi thêm mục', variant: 'destructive' });
    }
  };

  const markUploaded = async (r: GapRow) => {
    try {
      await apiRequest(`/data-gaps/${r.id}`, {
        method: 'PUT',
        body: JSON.stringify({ current_status: 'uploaded', risk_level: 'low' }),
      });
      await load();
    } catch (e) {
      toast({ title: (e as Error).message || 'Lỗi cập nhật', variant: 'destructive' });
    }
  };

  const total = rows.length || 1;
  const verifiedOrUploaded = rows.filter(
    (r) => r.current_status === 'verified' || r.current_status === 'uploaded'
  ).length;
  const proxyCount = rows.filter((r) => r.current_status === 'proxy').length;
  const missingCount = rows.filter(
    (r) => r.current_status === 'missing'
  ).length;
  const score = Math.round((verifiedOrUploaded / total) * 100);
  const primaryPct = Math.round((verifiedOrUploaded / total) * 100);
  const proxyPct = Math.round((proxyCount / total) * 100);

  return (
    <div className="flex-1 p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertCircle className="w-6 h-6 text-amber-600" /> Data Gap Checker
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Theo dõi 6 nhóm dữ liệu carbon trọng yếu (ISO 14067 / Ecoinvent
          v3.10 / DEFRA 2024). Bổ sung trước khi xuất Audit Pack hoặc gửi
          buyer.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">
              Audit-ready Score
            </div>
            <div
              className={`text-3xl font-bold ${score >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}
            >
              {score}/100
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Primary data</div>
            <div className="text-3xl font-bold">{primaryPct}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Proxy / Default</div>
            <div className="text-3xl font-bold text-red-600">{proxyPct}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Dữ liệu thiếu</div>
            <div className="text-3xl font-bold">{missingCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            Khoảng trống dữ liệu
          </CardTitle>
          <div className="flex gap-2">
            {rows.length === 0 && !loading && (
              <Button size="sm" variant="outline" onClick={seed}>
                Tạo checklist mặc định
              </Button>
            )}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Thêm mục
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Thêm khoảng trống dữ liệu</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Nhóm dữ liệu</Label>
                    <Input
                      value={form.data_group}
                      onChange={(e) =>
                        setForm({ ...form, data_group: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Trạng thái</Label>
                    <Select
                      value={form.current_status}
                      onValueChange={(v) =>
                        setForm({ ...form, current_status: v as GapStatus })
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
                  <div>
                    <Label>Mức rủi ro</Label>
                    <Select
                      value={form.risk_level}
                      onValueChange={(v) =>
                        setForm({ ...form, risk_level: v as Risk })
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
                  <div>
                    <Label>Hành động yêu cầu</Label>
                    <Input
                      value={form.required_action}
                      onChange={(e) =>
                        setForm({ ...form, required_action: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Người chịu trách nhiệm</Label>
                      <Input
                        placeholder="Tên / phòng ban"
                        value={form.owner}
                        onChange={(e) =>
                          setForm({ ...form, owner: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Hạn xử lý</Label>
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
                <DialogFooter>
                  <Button onClick={addRow}>Lưu</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Đang tải…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Chưa có mục nào. Tạo checklist mặc định để bắt đầu.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-2">Nhóm dữ liệu</th>
                    <th>Bắt buộc</th>
                    <th>Trạng thái</th>
                    <th>Mức rủi ro</th>
                    <th>Hành động yêu cầu</th>
                    <th>Owner</th>
                    <th>Hạn</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{r.data_group}</td>
                      <td>
                        {r.required_for_audit ? (
                          <Badge>Bắt buộc</Badge>
                        ) : (
                          <Badge variant="outline">Tuỳ chọn</Badge>
                        )}
                      </td>
                      <td>
                        <Badge variant="outline">
                          {STATUS_LABEL[r.current_status]}
                        </Badge>
                      </td>
                      <td>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${RISK_COLOR[r.risk_level]}`}
                        >
                          {r.risk_level.toUpperCase()}
                        </span>
                      </td>
                      <td className="text-xs">{r.required_action || '—'}</td>
                      <td className="text-xs">
                        {r.owner || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="text-xs">
                        {r.deadline ? (
                          new Date(r.deadline).toLocaleDateString('vi-VN')
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td>
                        {r.current_status !== 'verified' &&
                          r.current_status !== 'uploaded' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markUploaded(r)}
                            >
                              <Upload className="w-3 h-3 mr-1" />
                              Đánh dấu đã tải
                            </Button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
