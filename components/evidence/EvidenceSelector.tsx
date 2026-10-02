'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Check,
  FileCheck2,
  FileText,
  Loader2,
  Search,
  UploadCloud,
  X,
} from 'lucide-react';
import { api } from '@/lib/apiClient';
import { EvidenceLevelBadge } from './EvidenceLevelBadge';

export interface EvidenceItem {
  id: string;
  kind: string;
  documentName: string;
  fileName: string;
  verificationLevel: number;
  trustScore: number | null;
  status: string;
  createdAt?: string;
  sourceVendor?: string | null;
}

export interface EvidenceSelectorProps {
  value?: string | null;
  onChange: (evidenceId: string, item?: EvidenceItem | null) => void;
  filterKind?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

export const EvidenceSelector: React.FC<EvidenceSelectorProps> = ({
  value,
  onChange,
  filterKind,
  placeholder = 'Chọn chứng từ từ Evidence Vault...',
  disabled = false,
  className = '',
  required = false,
}) => {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<EvidenceItem | null>(null);

  const fetchEvidence = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: EvidenceItem[]; total: number }>(
        '/evidence?pageSize=100'
      );
      const list = res?.items ?? (Array.isArray(res) ? (res as unknown as EvidenceItem[]) : []);
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && items.length === 0) {
      void fetchEvidence();
    }
  }, [open, items.length, fetchEvidence]);

  // Keep selectedItem in sync with `value` prop
  useEffect(() => {
    if (!value) {
      setSelectedItem(null);
      return;
    }
    const found = items.find((i) => i.id === value);
    if (found) {
      setSelectedItem(found);
    } else if (!selectedItem || selectedItem.id !== value) {
      // Lazy load the specific evidence if not in the current list
      void api
        .get<EvidenceItem>(`/evidence/${value}`)
        .then((doc) => {
          if (doc && doc.id) {
            setSelectedItem(doc);
          }
        })
        .catch(() => {
          // If individual fetch not supported or doc missing, keep id
          setSelectedItem({
            id: value,
            documentName: `Chứng từ #${value.slice(0, 8)}...`,
            fileName: value,
            kind: 'document',
            verificationLevel: 1,
            trustScore: null,
            status: 'linked',
          });
        });
    }
  }, [value, items, selectedItem]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterKind && item.kind !== filterKind) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const name = (item.documentName || item.fileName || '').toLowerCase();
      const vendor = (item.sourceVendor || '').toLowerCase();
      const kind = (item.kind || '').toLowerCase();
      return name.includes(term) || vendor.includes(term) || kind.includes(term);
    });
  }, [items, filterKind, searchTerm]);

  const handleSelect = (item: EvidenceItem) => {
    setSelectedItem(item);
    onChange(item.id, item);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItem(null);
    onChange('', null);
  };

  return (
    <div className={`relative ${className}`}>
      {selectedItem ? (
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 text-xs transition-all">
          <div className="flex items-center gap-2 min-w-0">
            <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 truncate">
                {selectedItem.documentName || selectedItem.fileName}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <EvidenceLevelBadge level={selectedItem.verificationLevel} />
                <span className="text-[10px] text-slate-500 font-mono">
                  {selectedItem.id.slice(0, 8)}…
                </span>
              </div>
            </div>
          </div>
          {!disabled && (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(true)}
                className="h-7 px-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100/60"
              >
                Đổi
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleClear}
                className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                title="Gỡ liên kết chứng từ"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className="w-full justify-start h-10 rounded-xl border-dashed border-slate-300 text-xs text-slate-500 hover:text-slate-800 hover:border-slate-400 font-normal bg-white"
            >
              <FileText className="w-4 h-4 mr-2 text-slate-400" />
              <span>{placeholder}</span>
              {required && <span className="text-red-500 ml-1">*</span>}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                Chọn chứng từ kiểm toán (Evidence Vault)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Chỉ liên kết các chứng từ hợp lệ đã tải lên trong hệ thống của doanh nghiệp.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Tìm theo tên file, nhà cung ứng, loại chứng từ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-lg"
                />
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
                {loading ? (
                  <div className="flex items-center justify-center p-6 text-xs text-slate-500 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    Đang tải danh sách chứng từ...
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                    <p>Không tìm thấy chứng từ phù hợp.</p>
                    <a
                      href="/evidence"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-600 font-medium hover:underline text-xs"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      Mở Evidence Vault để tải chứng từ mới
                    </a>
                  </div>
                ) : (
                  filteredItems.map((item) => {
                    const isSelected = item.id === value;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        className={`flex items-center justify-between p-3 hover:bg-slate-50 cursor-pointer text-xs transition-colors ${
                          isSelected ? 'bg-emerald-50/60 font-semibold' : ''
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <p className="text-slate-900 truncate font-medium">
                            {item.documentName || item.fileName}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span>{item.kind}</span>
                            <span>•</span>
                            <EvidenceLevelBadge level={item.verificationLevel} />
                            {item.sourceVendor && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-[120px]">
                                  {item.sourceVendor}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default EvidenceSelector;
