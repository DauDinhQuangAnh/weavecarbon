'use client';

import React, { useCallback, useEffect, useState } from 'react';
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

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Nhà cung ứng</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Yêu cầu dữ liệu Scope 3 từ nhà cung ứng để nâng kết quả từ proxy
            lên dữ liệu có độ tin cậy cao hơn.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-1" />
              Tạo yêu cầu
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Supplier Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="supplier-name">Tên nhà cung ứng</Label>
                <Input
                  id="supplier-name"
                  value={form.supplierName}
                  onChange={(e) =>
                    setForm({ ...form, supplierName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-email">Email</Label>
                <Input
                  id="supplier-email"
                  type="email"
                  value={form.supplierEmail}
                  onChange={(e) =>
                    setForm({ ...form, supplierEmail: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-material">Vật liệu</Label>
                <Input
                  id="supplier-material"
                  value={form.material}
                  onChange={(e) =>
                    setForm({ ...form, material: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-required-data">
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
              <div className="space-y-2">
                <Label htmlFor="supplier-deadline">Hạn phản hồi</Label>
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
            <DialogFooter className="pt-2">
              <Button onClick={submit} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Lưu nháp
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách yêu cầu</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Đang tải…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Chưa có yêu cầu nào. Bấm &quot;Tạo yêu cầu&quot; để bắt đầu.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-2">Nhà cung ứng</th>
                    <th>Vật liệu</th>
                    <th>Dữ liệu yêu cầu</th>
                    <th>Hạn</th>
                    <th>Trạng thái</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-3">
                        <div className="font-medium">{r.supplierName}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.supplierEmail}
                        </div>
                      </td>
                      <td className="text-xs">{r.materialSupplied || '—'}</td>
                      <td className="text-xs">
                        {(r.requiredData || []).join(', ')}
                      </td>
                      <td className="text-xs">{r.deadline || '—'}</td>
                      <td>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLOR[r.status]}`}
                        >
                          {STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendMail(r)}
                        >
                          <Mail className="w-3 h-3 mr-1" />
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
    </div>
  );
}
