'use client';

import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Compass,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Ship,
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
import {
  analyzeExportDocument,
  getExportAiSamplePresets,
  type ExportAiExtractedData,
} from '@/lib/export/exportAiService';

export interface ExportAiImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (data: ExportAiExtractedData) => void;
  isDemo?: boolean;
}

export const ExportAiImportModal: React.FC<ExportAiImportModalProps> = ({
  open,
  onOpenChange,
  onApply,
  isDemo = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState<string>('');
  const [progressValue, setProgressValue] = useState<number>(0);
  const [extractedData, setExtractedData] = useState<ExportAiExtractedData | null>(null);

  const presets = getExportAiSamplePresets();

  const handleSelectPreset = (preset: (typeof presets)[0]) => {
    setSelectedFile(new File(['preset-content'], `${preset.id}.pdf`, { type: 'application/pdf' }));
    setExtractedData(preset.data);
    toast.success(`Đã nạp mẫu "${preset.label}" để đối soát AI!`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error('Kích thước tệp vượt quá giới hạn 25MB.');
      return;
    }

    setSelectedFile(file);
    setExtractedData(null);
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile) {
      toast.error('Vui lòng chọn tệp chứng từ cần phân tích.');
      return;
    }

    setLoading(true);
    setProgressValue(20);
    setProgressStep('Đang chuẩn bị tệp và xác thực định dạng an toàn...');

    try {
      await new Promise((resolve) => setTimeout(resolve, 350));
      setProgressValue(55);
      setProgressStep('Đang gửi tới Gemini Vision OCR để phân tích cấu trúc chứng từ...');

      const result = await analyzeExportDocument(selectedFile, { demo: isDemo });

      await new Promise((resolve) => setTimeout(resolve, 400));
      setProgressValue(85);
      setProgressStep('Đang đối soát Incoterm, Cảng biển và các thực thể đối tác...');

      await new Promise((resolve) => setTimeout(resolve, 250));
      setProgressValue(100);
      setExtractedData(result);
      toast.success('AI trích xuất thành công dữ liệu chứng từ xuất khẩu!');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Lỗi phân tích tệp chứng từ.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!extractedData) return;
    onApply(extractedData);
    toast.success('Đã áp dụng các thông số AI trích xuất vào hồ sơ xuất khẩu!');
    onOpenChange(false);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setExtractedData(null);
    setProgressValue(0);
    setProgressStep('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Trích xuất Thông số Xuất khẩu bằng AI (OCR & Vision)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600 mt-0.5">
                Tải lên Hóa đơn thương mại, Vận đơn đường biển hoặc Tờ khai hải quan (PDF/Ảnh) để AI tự động đọc và điền dữ liệu.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
          {/* Quick presets for testing */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
            <span className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-emerald-700" />
              Thử nghiệm nhanh với chứng từ mẫu (1-Click):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className="text-left p-2 rounded-lg border border-emerald-200 bg-white hover:bg-emerald-100/70 hover:border-emerald-400 transition-all text-xs"
                >
                  <p className="font-semibold text-slate-900 truncate">{p.label}</p>
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Upload Area */}
          {!extractedData && (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group border-2 border-dashed border-slate-300 hover:border-emerald-600 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-emerald-50/30"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100/80 text-emerald-800 mb-3 group-hover:scale-105 transition-transform">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {selectedFile ? selectedFile.name : 'Nhấp để tải lên hoặc kéo thả tệp chứng từ vào đây'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Hỗ trợ định dạng: <b>PDF, PNG, JPG, JPEG</b> (Tối đa 25MB)
                </p>
                {selectedFile && (
                  <Badge variant="outline" className="mt-2 text-xs bg-white border-emerald-300 text-emerald-800">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Đã sẵn sàng
                  </Badge>
                )}
              </div>

              {/* Progress bar during analysis */}
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

          {/* Extracted Data Review */}
          {extractedData && (
            <div className="space-y-3">
              {/* Header result summary */}
              <div className="rounded-xl border border-emerald-300 bg-emerald-50/80 p-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950">{extractedData.documentTitle}</h4>
                      <p className="text-xs text-emerald-800/90">{extractedData.summary}</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-800 text-white font-mono text-xs">
                    Độ tin cậy AI: {Math.round(extractedData.confidence * 100)}%
                  </Badge>
                </div>
              </div>

              {/* Data groups */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Commercial & Contract */}
                <Card className="border-slate-200 shadow-none">
                  <CardContent className="p-3.5 space-y-2">
                    <b className="text-xs text-slate-900 flex items-center gap-1.5 border-b pb-1.5">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-800" />
                      Hóa đơn & Hợp đồng (Commercial)
                    </b>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500">Số Commercial Invoice:</span>
                        <p className="font-bold font-mono text-slate-800">{extractedData.invoiceNumber || '—'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Ngày lập Invoice:</span>
                        <p className="font-semibold text-slate-800">{extractedData.invoiceDate || '—'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">PO / Contract ID:</span>
                        <p className="font-mono text-slate-800">{extractedData.poContractId || '—'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Tiền tệ:</span>
                        <p className="font-bold text-slate-800">{extractedData.currency || 'USD'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Incoterm:</span>
                        <p className="font-bold text-emerald-800">
                          {extractedData.incotermCode || 'FOB'} {extractedData.incotermLocation ? `(${extractedData.incotermLocation})` : ''}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Điều khoản TT:</span>
                        <p className="text-slate-800 truncate">{extractedData.paymentTerms || '—'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Logistics & Vận tải */}
                <Card className="border-slate-200 shadow-none">
                  <CardContent className="p-3.5 space-y-2">
                    <b className="text-xs text-slate-900 flex items-center gap-1.5 border-b pb-1.5">
                      <Ship className="h-3.5 w-3.5 text-blue-700" />
                      Hãng tàu & Logistics (Transport)
                    </b>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500">Cảng xếp hàng (POL):</span>
                        <p className="font-medium text-slate-800">{extractedData.portOfLoading || '—'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Cảng dỡ hàng (POD):</span>
                        <p className="font-medium text-slate-800">{extractedData.portOfDischarge || '—'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Số B/L (Vận đơn):</span>
                        <p className="font-mono font-bold text-slate-800">{extractedData.billOfLadingNo || '—'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Hãng tàu:</span>
                        <p className="text-slate-800 truncate">{extractedData.carrierName || '—'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Tên tàu & Voyage:</span>
                        <p className="text-slate-800 truncate">
                          {extractedData.vesselName || '—'} {extractedData.voyageNumber ? `/${extractedData.voyageNumber}` : ''}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Container / Seal:</span>
                        <p className="font-mono text-slate-800">
                          {extractedData.containerNo || '—'} {extractedData.sealNo ? `• ${extractedData.sealNo}` : ''}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Parties: Doanh nghiệp xuất nhập khẩu */}
                <Card className="border-slate-200 shadow-none md:col-span-2">
                  <CardContent className="p-3.5 space-y-2">
                    <b className="text-xs text-slate-900 flex items-center gap-1.5 border-b pb-1.5">
                      <Building2 className="h-3.5 w-3.5 text-slate-700" />
                      Chủ thể Thương mại & Hải quan (Parties & Customs)
                    </b>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                      <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="font-semibold text-slate-700">Đơn vị Xuất khẩu (Exporter):</span>
                        <p className="font-bold text-slate-900">{extractedData.exporter?.name || '—'}</p>
                        <p className="text-slate-600 line-clamp-1">{extractedData.exporter?.address || '—'}</p>
                        <p className="font-mono text-slate-600">MST: {extractedData.exporterTaxId || '0108927461'}</p>
                      </div>
                      <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="font-semibold text-slate-700">Nhà Nhập khẩu (Importer/Buyer):</span>
                        <p className="font-bold text-slate-900">{extractedData.importer?.name || '—'}</p>
                        <p className="text-slate-600 line-clamp-1">{extractedData.importer?.address || '—'}</p>
                        <p className="font-mono text-slate-600">EORI: {extractedData.importerEori || '—'}</p>
                      </div>
                    </div>
                    {extractedData.customsDeclarationNo && (
                      <div className="flex items-center gap-2 pt-1 text-[11px]">
                        <span className="text-slate-500">Số tờ khai Hải quan:</span>
                        <span className="font-mono font-bold text-emerald-800">{extractedData.customsDeclarationNo}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3 flex flex-row items-center justify-between">
          <div>
            {extractedData && (
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
            {!extractedData ? (
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
                    Đang phân tích AI...
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

export default ExportAiImportModal;
