'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, GitCommit, Loader2, Search, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/apiClient';
import { listCompanyMembers } from '@/lib/api/companyMembers';
import { toast } from 'sonner';

interface TrailEntry {
  id: string;
  evidenceDocumentId: string | null;
  dataGroup: string;
  changedField: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  notes: string | null;
  changedBy: string | null;
  createdAt: string;
}

interface AuditTrailResponse {
  data?: TrailEntry[];
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

const ACTION_LABEL: Record<string, string> = {
  // Products
  'product.created': 'Tạo sản phẩm',
  'product.updated': 'Cập nhật sản phẩm',
  'product.published': 'Publish sản phẩm',
  // Evidence
  'evidence.uploaded': 'Tải lên chứng từ',
  'evidence.verified': 'Xác minh chứng từ',
  // Suppliers
  'supplier_request.created': 'Tạo Supplier Request',
  'supplier_request.sent': 'Gửi email cho supplier',
  'supplier_request.updated': 'Cập nhật Supplier Request',
  // Data Gap
  'data_gap.seeded': 'Khởi tạo checklist',
  'data_gap.created': 'Tạo gap',
  'data_gap.updated': 'Cập nhật gap',
  'data_gap.verified': 'Xác minh gap',
  // Logistics
  'shipment.created': 'Tạo lô hàng',
  'shipment.updated': 'Cập nhật lô hàng',
  // Reports
  'report.generated': 'Tạo báo cáo',
  'report.downloaded': 'Tải xuống báo cáo',
  // System
  'demo.seeded': 'Seed dữ liệu demo',
};

export default function AuditTrailPage() {
  const { user } = useAuth();
  const companyId = user?.company_id ?? null;
  const [rows, setRows] = useState<TrailEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  // UID → full_name resolution
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());

  // Load audit trail + member names in parallel
  useEffect(() => {
    if (!companyId) return;
    setLoading(true);

    const trailPromise = apiRequest<TrailEntry[] | AuditTrailResponse>(
      `/audit-trail?companyId=${companyId}&limit=500`
    );

    const membersPromise = listCompanyMembers().then((members) => {
      const map = new Map<string, string>();
      members.forEach((m) => {
        if (m.userId && m.fullName) map.set(m.userId, m.fullName);
      });
      setNameMap(map);
    }).catch(() => {
      // Fail silently — name resolution is non-critical
    });

    Promise.all([trailPromise, membersPromise])
      .then(([data]) => {
        if (Array.isArray(data)) {
          setRows(data);
          return;
        }

        setRows(Array.isArray(data?.data) ? data.data : []);
      })
      .catch((e: Error) =>
        toast.error(e.message || 'Không tải được dữ liệu audit.')
      )
      .finally(() => setLoading(false));
  }, [companyId]);

  // Resolve actor: full_name > uid prefix > 'System'
  const actor = (uid: string | null): string => {
    if (!uid) return 'System';
    return nameMap.get(uid) ?? uid.slice(0, 8);
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchAction =
        actionFilter === 'all' || r.changedField === actionFilter;
      const haystack = `${r.dataGroup} ${r.notes || ''} ${r.changedField || ''} ${r.newValue || ''}`.toLowerCase();
      const matchSearch = !search || haystack.includes(search.toLowerCase());
      return matchAction && matchSearch;
    });
  }, [rows, search, actionFilter]);

  const evidence = filtered.filter(
    (r) => r.evidenceDocumentId || r.changedField === 'evidence.uploaded'
  );
  const versions = filtered.filter(
    (r) => !r.evidenceDocumentId && r.changedField !== 'evidence.uploaded'
  );

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Trail</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lưu vết chứng từ và lịch sử chỉnh sửa theo công ty. Mỗi hành động
          ghi rõ ai đã làm gì và khi nào.
        </p>
      </div>

      <div className="flex flex-col gap-2 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo nhóm dữ liệu, ghi chú…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full md:w-[260px]">
            <SelectValue placeholder="Loại hành động" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả hành động</SelectItem>
            {Object.entries(ACTION_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Đang tải…
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Chưa có bản ghi audit nào khớp bộ lọc. Bản ghi tự động sinh khi
            bạn tải chứng từ, sửa data gap hoặc gửi yêu cầu supplier.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Chứng từ &amp; evidence ({evidence.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-muted-foreground">
                    <tr>
                      <th className="py-2">Thời gian</th>
                      <th>Người thực hiện</th>
                      <th>Hành động</th>
                      <th>Nhóm dữ liệu</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidence.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-3 text-xs">
                          {new Date(r.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="text-xs font-medium">
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                            {actor(r.changedBy)}
                          </span>
                        </td>
                        <td>
                          <Badge variant="outline" className="text-xs">
                            {ACTION_LABEL[r.changedField || ''] ||
                              r.changedField ||
                              '—'}
                          </Badge>
                        </td>
                        <td className="text-xs">{r.dataGroup}</td>
                        <td className="text-xs text-muted-foreground">
                          {r.notes || r.newValue || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCommit className="h-5 w-5" />
                Lịch sử chỉnh sửa ({versions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-muted-foreground">
                    <tr>
                      <th className="py-2">Thời gian</th>
                      <th>Người thực hiện</th>
                      <th>Hành động</th>
                      <th>Nhóm</th>
                      <th>Trước</th>
                      <th>Sau</th>
                      <th>Lý do / Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((v) => (
                      <tr key={v.id} className="border-b last:border-0">
                        <td className="py-3 text-xs">
                          {new Date(v.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="text-xs font-medium">
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                            {actor(v.changedBy)}
                          </span>
                        </td>
                        <td>
                          <Badge variant="outline" className="text-xs">
                            {ACTION_LABEL[v.changedField || ''] ||
                              v.changedField ||
                              '—'}
                          </Badge>
                        </td>
                        <td className="text-xs">{v.dataGroup}</td>
                        <td className="text-xs text-muted-foreground">
                          {v.oldValue || '—'}
                        </td>
                        <td className="text-xs font-medium">
                          {v.newValue || '—'}
                        </td>
                        <td className="text-xs">
                          {v.reason || v.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
