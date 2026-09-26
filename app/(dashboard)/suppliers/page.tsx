'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Mail, Plus } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { toast } from '@/hooks/useToast';
import SupplierNetworkPanel from '@/components/dashboard/suppliers/SupplierNetworkPanel';

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
  draft: 'Draft',
  sent: 'Sent',
  waiting: 'Waiting',
  received: 'Received',
  overdue: 'Overdue',
};

const STATUS_COLOR: Record<Status, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  waiting: 'bg-amber-100 text-amber-700',
  received: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
};

const EMPTY_FORM = {
  supplierName: '',
  supplierEmail: '',
  material: '',
  deadline: '',
  required: 'Material origin, Energy data',
};

export default function SuppliersPage() {
  const pathname = usePathname();
  const demo = pathname.startsWith('/demo');
  const [rows, setRows] = useState<SupplierReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!form.supplierName || !form.supplierEmail)
      return toast({ title: 'Cần tên & email nhà cung ứng', variant: 'destructive' });
    setSaving(true);
    try {
      await api.post('/suppliers', {
        supplierName: form.supplierName,
        supplierEmail: form.supplierEmail,
        materialSupplied: form.material || null,
        requiredData: form.required
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        deadline: form.deadline || null,
        status: 'draft',
      });
      toast({ title: 'Đã tạo yêu cầu' });
      setOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Lỗi tạo yêu cầu';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const sendMail = async (r: SupplierReq) => {
    const subject = encodeURIComponent(
      `[Weave Carbon] Yêu cầu dữ liệu Scope 3 — ${r.materialSupplied || ''}`
    );
    const body = encodeURIComponent(
      `Kính gửi ${r.supplierName},\n\nChúng tôi cần các dữ liệu sau:\n- ${(r.requiredData || []).join('\n- ')}\n\nHạn: ${r.deadline || '—'}\n\nTrân trọng.`
    );
    window.location.href = `mailto:${r.supplierEmail}?subject=${subject}&body=${body}`;
    if (r.status === 'draft') {
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
  };

  const totalRequests = rows.length;
  const waitingRequests = rows.filter((r) => r.status === 'waiting' || r.status === 'sent').length;
  const receivedRequests = rows.filter((r) => r.status === 'received').length;
  const overdueRequests = rows.filter((r) => r.status === 'overdue').length;

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản trị Nhà cung ứng</h1>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200/80">
              Scope 3 Network
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Thu thập dữ liệu Scope 3 và quản trị mạng lưới nhà cung ứng cho
            phân tích carbon, rủi ro khí hậu và mức độ phụ thuộc chuỗi cung ứng.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-medium">
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
                  onChange={(e) =>
                    setForm({ ...form, supplierName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier-email" className="text-xs font-semibold text-slate-700">Email liên hệ</Label>
                <Input
                  id="supplier-email"
                  type="email"
                  placeholder="supplier@example.com"
                  value={form.supplierEmail}
                  onChange={(e) =>
                    setForm({ ...form, supplierEmail: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier-material" className="text-xs font-semibold text-slate-700">Nguyên vật liệu cung cấp</Label>
                <Input
                  id="supplier-material"
                  placeholder="Ví dụ: Vải sợi Organic Cotton, Nhuộm hoạt tính"
                  value={form.material}
                  onChange={(e) =>
                    setForm({ ...form, material: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier-required-data" className="text-xs font-semibold text-slate-700">
                  Dữ liệu yêu cầu (phân cách bằng dấu phẩy)
                </Label>
                <Input
                  id="supplier-required-data"
                  value={form.required}
                  onChange={(e) =>
                    setForm({ ...form, required: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="supplier-deadline" className="text-xs font-semibold text-slate-700">Hạn phản hồi</Label>
                <Input
                  id="supplier-deadline"
                  type="date"
                  value={form.deadline}
                  onChange={(e) =>
                    setForm({ ...form, deadline: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter className="pt-3">
              <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Lưu và tạo yêu cầu
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-slate-200/80 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-600">Tổng yêu cầu</div>
            <div className="text-2xl font-bold tracking-tight text-slate-900 mt-1">{totalRequests}</div>
          </CardContent>
        </Card>
        <Card className="border border-amber-200/80 bg-amber-50/30 shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-600">Đang chờ phản hồi</div>
            <div className="text-2xl font-bold tracking-tight text-amber-700 mt-1">{waitingRequests}</div>
          </CardContent>
        </Card>
        <Card className="border border-emerald-200/80 bg-emerald-50/30 shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-600">Đã nhận phản hồi</div>
            <div className="text-2xl font-bold tracking-tight text-emerald-700 mt-1">{receivedRequests}</div>
          </CardContent>
        </Card>
        <Card className="border border-rose-200/80 bg-rose-50/30 shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-slate-600">Quá hạn</div>
            <div className="text-2xl font-bold tracking-tight text-rose-700 mt-1">{overdueRequests}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200/80 shadow-xs">
        <CardHeader className="border-b border-slate-200/80 bg-slate-50/60 py-3.5 px-4">
          <CardTitle className="text-base font-semibold text-slate-900">Danh sách yêu cầu dữ liệu</CardTitle>
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
                    <th className="py-3 px-3">Vật liệu</th>
                    <th className="py-3 px-3">Dữ liệu yêu cầu</th>
                    <th className="py-3 px-3">Hạn phản hồi</th>
                    <th className="py-3 px-3">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{r.supplierName}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          {r.supplierEmail}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-700">{r.materialSupplied || '—'}</td>
                      <td className="py-3 px-3 text-xs text-slate-600 max-w-xs truncate">
                        {(r.requiredData || []).join(', ')}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 font-mono whitespace-nowrap">{r.deadline || '—'}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLOR[r.status]}`}
                        >
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <SupplierNetworkPanel demo={demo} />
    </div>
  );
}
