'use client';

import React, { useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { DOCUMENT_CONTEXTS, type DocumentContextConfig, type DomainContextKey } from '@/lib/ai/documentContext';
import {
  extractDocumentWithContext,
  type AiDocumentExtractionResult,
} from '@/lib/ai/aiDocumentExtractor';

export interface AiDocumentImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: DocumentContextConfig;
  contextKey?: DomainContextKey;
  onApply: (data: Record<string, unknown>) => void;
  isDemo?: boolean;
  demo?: boolean;
}

export const AiDocumentImportModal: React.FC<AiDocumentImportModalProps> = ({
  open,
  onOpenChange,
  config: propConfig,
  contextKey,
  onApply,
  isDemo = false,
  demo = false,
}) => {
  const activeConfig = propConfig || (contextKey ? DOCUMENT_CONTEXTS[contextKey] : undefined);
  if (!activeConfig) {
    throw new Error('AiDocumentImportModal requires either config or contextKey');
  }
  const config = activeConfig;
  const effectiveDemo = isDemo || demo;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState<string>('');
  const [progressValue, setProgressValue] = useState<number>(0);
  const [result, setResult] = useState<AiDocumentExtractionResult | null>(null);

  const handleSelectPreset = (preset: (typeof config.samplePresets)[0]) => {
    setSelectedFile(new File(['preset-content'], `${preset.id}.pdf`, { type: 'application/pdf' }));
    setResult({
      success: true,
      confidence: 0.96,
      source: 'gemini-vision-preset',
      documentTitle: preset.label,
      summary: preset.description,
      fields: { ...preset.data },
    });
    toast.success(`Đã nạp mẫu "${preset.label}"!`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error('Kích thước tệp vượt quá giới hạn 25MB.');
      return;
    }

    setSelectedFile(file);
    setResult(null);
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile) {
      toast.error('Vui lòng chọn tệp chứng từ cần phân tích.');
      return;
    }

    setLoading(true);
    setProgressValue(25);
    setProgressStep(`Đang xác thực tệp và thiết lập ngữ cảnh [${config.badgeLabel}]...`);

    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setProgressValue(60);
      setProgressStep('Đang gửi hình ảnh & ngữ cảnh tới Gemini Vision OCR...');

      const extResult = await extractDocumentWithContext(selectedFile, config, { demo: effectiveDemo });

      await new Promise((resolve) => setTimeout(resolve, 350));
      setProgressValue(90);
      setProgressStep('Đang chuẩn hóa dữ liệu theo cấu trúc nghiệp vụ...');

      await new Promise((resolve) => setTimeout(resolve, 200));
      setProgressValue(100);
      setResult(extResult);
      toast.success(`AI đã trích xuất thành công dữ liệu ${config.badgeLabel}!`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Lỗi phân tích tài liệu bằng AI.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    onApply(result.fields);
    toast.success(`Đã tự động điền các thông số từ AI vào form!`);
    onOpenChange(false);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResult(null);
    setProgressValue(0);
    setProgressStep('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">{config.title}</DialogTitle>
                <DialogDescription className="text-xs text-slate-600 mt-0.5">
                  {config.subtitle}
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className={`text-xs py-0.5 px-2.5 font-semibold ${config.badgeTone}`}>
              {config.badgeLabel}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
          {/* Quick presets */}
          {config.samplePresets.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
              <span className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-emerald-700" />
                Chứng từ mẫu thử nghiệm nhanh (1-Click):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {config.samplePresets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className="text-left p-2.5 rounded-lg border border-emerald-200 bg-white hover:bg-emerald-100/70 hover:border-emerald-400 transition-all text-xs"
                  >
                    <p className="font-semibold text-slate-900 truncate">{p.label}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{p.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Upload Area */}
          {!result && (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group border-2 border-dashed border-slate-300 hover:border-emerald-600 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-emerald-50/30"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={config.acceptedMimeTypes.join(',')}
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100/80 text-emerald-800 mb-2.5 group-hover:scale-105 transition-transform">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {selectedFile ? selectedFile.name : 'Nhấp để chọn tệp hoặc kéo thả vào đây'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Định dạng được hỗ trợ: <b>PDF, PNG, JPG, JPEG</b> (Tối đa 25MB)
                </p>
                {selectedFile && (
                  <Badge variant="outline" className="mt-2 text-xs bg-white border-emerald-300 text-emerald-800">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Sẵn sàng phân tích
                  </Badge>
                )}
              </div>

              {/* Context target fields summary */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs">
                <span className="font-semibold text-slate-700 block mb-1">
                  🎯 Ngữ cảnh trích xuất mục tiêu ({config.expectedFields.length} trường):
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {config.expectedFields.map((f) => (
                    <span key={f.key} className="rounded bg-white px-2 py-0.5 border border-slate-200 text-slate-700 font-mono text-[11px]">
                      {f.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Progress Bar */}
              {loading && (
                <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-emerald-950 flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-700" />
                      {progressStep}
                    </span>
                    <span className="font-bold text-emerald-800">{progressValue}%</span>
                  </div>
                  <Progress value={progressValue} className="h-2 bg-emerald-200" />
                </div>
              )}
            </div>
          )}

          {/* Results Review */}
          {result && (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950">{result.documentTitle}</h4>
                      <p className="text-xs text-emerald-800/90">{result.summary}</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-800 text-white font-mono text-xs">
                    Độ tin cậy: {Math.round(result.confidence * 100)}%
                  </Badge>
                </div>
              </div>

              {/* Extracted fields list */}
              <Card className="border-slate-200 shadow-none">
                <CardContent className="p-3.5 space-y-2.5">
                  <b className="text-xs text-slate-900 border-b pb-1.5 block">
                    Bảng đối soát dữ liệu trích xuất ({Object.keys(result.fields).length} trường)
                  </b>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {config.expectedFields.map((field) => {
                      const val = result.fields[field.key];
                      return (
                        <div key={field.key} className="space-y-0.5 rounded-lg border border-slate-100 bg-slate-50/60 p-2">
                          <span className="text-[11px] text-slate-500 font-medium">{field.label}:</span>
                          <p className="font-semibold text-slate-900 text-xs break-words">
                            {val !== undefined && val !== null && String(val).trim() ? String(val) : '—'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3 flex flex-row items-center justify-between">
          <div>
            {result && (
              <Button type="button" variant="outline" size="sm" onClick={handleReset} className="text-xs">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Quét tệp khác
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
              Đóng
            </Button>
            {!result ? (
              <Button
                type="button"
                size="sm"
                className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold"
                disabled={!selectedFile || loading}
                onClick={handleStartAnalysis}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Đang quét...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Bắt đầu trích xuất AI
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold"
                onClick={handleApply}
              >
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Áp dụng vào Form (Auto-fill)
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AiDocumentImportModal;
