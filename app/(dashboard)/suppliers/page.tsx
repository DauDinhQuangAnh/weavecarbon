'use client';

import React, { useEffect, useState } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/apiClient';
import { toast } from '@/hooks/useToast';

type Status = 'draft' | 'sent' | 'waiting' | 'received' | 'overdue';

interface SupplierReq {
  id: string;
  supplier_name: string;
  supplier_email: string;
  material_supplied: string | null;
  required_data: string[];
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
  supplier_name: '',
  supplier_email: '',
  material: '',
  deadline: '',
  required: 'Material origin, Energy data',
};

export default function SuppliersPage() {
  const { user } = useAuth();
  const companyId = user?.company_id ?? null;
  const [rows, setRows] = useState<SupplierReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await apiRequest<SupplierReq[]>(
        `/suppliers?companyId=${companyId}`
      );
      setRows(
        data.map((r) => ({
          ...r,
          required_data: Array.isArray(r.required_data) ? r.required_data : [],
        }))
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const submit = async () => {
    if (!companyId)
      return toast({ title: 'Chưa có công ty', variant: 'destructive' });
    if (!form.supplier_name || !form.supplier_email)
      return toast({ title: 'Cần tên & email', variant: 'destructive' });
    setSaving(true);
    try {
      await apiRequest('/suppliers', {
        method: 'POST',
        body: JSON.stringify({
          company_id: companyId,
          supplier_name: form.supplier_name,
          supplier_email: form.supplier_email,
          material_supplied: form.material || null,
          required_data: form.required
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          deadline: form.deadline || null,
          status: 'draft',
        }),
      });
      toast({ title: 'Đã tạo yêu cầu' });
      setOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (e: any) {
      toast({
        title: e.message || 'Lỗi tạo yêu cầu',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const sendMail = async (r: SupplierReq) => {
    const subject = encodeURIComponent(
      `[Weave Carbon] Yêu cầu dữ liệu Scope 3 — ${r.material_supplied || ''}`
    );
    const body = encodeURIComponent(
      `Kính gửi ${r.supplier_name},\n\nChúng tôi cần các dữ liệu sau:\n- ${(r.required_data || []).join('\n- ')}\n\nHạn: ${r.deadline || '—'}\n\nTrân trọng.`
    );
    window.location.href = `mailto:${r.supplier_email}?subject=${subject}&body=${body}`;
    if (r.status === 'draft') {
      try {
        await apiRequest(`/suppliers/${r.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            status: 'sent',
            sent_at: new Date().toISOString(),
          }),
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supplier Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Tên nhà cung ứng</Label>
                <Input
                  value={form.supplier_name}
                  onChange={(e) =>
                    setForm({ ...form, supplier_name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.supplier_email}
                  onChange={(e) =>
                    setForm({ ...form, supplier_email: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Vật liệu</Label>
                <Input
                  value={form.material}
                  onChange={(e) =>
                    setForm({ ...form, material: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Dữ liệu yêu cầu (phân cách bằng dấu phẩy)</Label>
                <Input
                  value={form.required}
                  onChange={(e) =>
                    setForm({ ...form, required: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Hạn phản hồi</Label>
                <Input
                  type="date"
                  value={form.deadline}
                  onChange={(e) =>
                    setForm({ ...form, deadline: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
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
              Chưa có yêu cầu nào. Bấm "Tạo yêu cầu" để bắt đầu.
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
                        <div className="font-medium">{r.supplier_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.supplier_email}
                        </div>
                      </td>
                      <td className="text-xs">{r.material_supplied || '—'}</td>
                      <td className="text-xs">
                        {(r.required_data || []).join(', ')}
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
