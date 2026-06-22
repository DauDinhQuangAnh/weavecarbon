'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  History,
  ChevronDown,
  ChevronUp,
  User,
  Clock,
  ExternalLink,
} from 'lucide-react';
import type { ProductRecord } from '@/lib/productsApi';

interface Props {
  product: ProductRecord;
}

interface VersionEntry {
  version: string;
  timestamp: string;
  updatedBy: string;
  note: string;
  isCurrent: boolean;
  isLatest: boolean;
}

function buildVersionEntries(product: ProductRecord): VersionEntry[] {
  const v = product.version ?? 1;
  const entries: VersionEntry[] = [];

  for (let i = v; i >= 1; i--) {
    const isLatest = i === v;
    const isCurrent = i === v;
    let timestamp: string;
    if (isLatest) {
      timestamp = product.updatedAt ?? product.createdAt;
    } else if (i === 1) {
      timestamp = product.createdAt;
    } else {
      // Interpolate between createdAt and updatedAt for intermediate versions
      const created = new Date(product.createdAt).getTime();
      const updated = new Date(product.updatedAt ?? product.createdAt).getTime();
      const ratio = (i - 1) / Math.max(v - 1, 1);
      timestamp = new Date(created + ratio * (updated - created)).toISOString();
    }
    entries.push({
      version: `v${i}`,
      timestamp,
      updatedBy: i === 1 ? 'Người tạo' : 'Người chỉnh sửa',
      note:
        i === 1
          ? 'Tạo sản phẩm ban đầu'
          : i === v
          ? 'Cập nhật mới nhất'
          : 'Cập nhật dữ liệu sản phẩm',
      isCurrent,
      isLatest,
    });
  }
  return entries;
}

const VersionHistory: React.FC<Props> = ({ product }) => {
  const router = useRouter();
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
  const entries = buildVersionEntries(product);

  const fmt = (ts: string) =>
    new Date(ts).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5 text-primary" />
            Lịch sử phiên bản
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => router.push('/audit-trail')}
          >
            <ExternalLink className="h-3 w-3" />
            Audit trail đầy đủ
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Chưa có lịch sử phiên bản
          </p>
        ) : (
          entries.map((entry) => (
            <Collapsible
              key={entry.version}
              open={expandedVersion === entry.version}
              onOpenChange={() =>
                setExpandedVersion(
                  expandedVersion === entry.version ? null : entry.version
                )
              }
            >
              <div
                className={`rounded-lg border ${
                  entry.isCurrent
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border'
                }`}
              >
                <CollapsibleTrigger asChild>
                  <div className="flex cursor-pointer items-center justify-between p-3 transition-colors hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">
                            {entry.version}
                          </span>
                          {entry.isLatest && (
                            <Badge variant="secondary" className="text-[10px]">
                              Mới nhất
                            </Badge>
                          )}
                          {entry.isCurrent && (
                            <Badge className="bg-primary/20 text-[10px] text-primary">
                              Hiện tại
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{fmt(entry.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-muted-foreground">
                      {expandedVersion === entry.version ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 px-3 pb-3">
                    <p className="rounded bg-muted/50 p-2 text-sm text-muted-foreground">
                      {entry.note}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{entry.updatedBy}</span>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))
        )}
        <p className="pt-1 text-center text-[10px] text-muted-foreground">
          Xem chi tiết hành động tại{' '}
          <button
            className="underline hover:text-foreground"
            onClick={() => router.push('/audit-trail')}
          >
            Audit Trail
          </button>
        </p>
      </CardContent>
    </Card>
  );
};

export default VersionHistory;
