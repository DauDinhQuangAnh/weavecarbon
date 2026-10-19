"use client";

import React, { useState } from "react";
import { Camera, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiDocumentImportModal } from "@/components/ui/AiDocumentImportModal";
import CameraScanner from "@/components/ui/CameraScanner";
import {
  DOCUMENT_CONTEXTS,
  type DomainContextKey,
} from "@/lib/ai/documentContext";
import {
  base64DataUrlToFile,
  extractDocumentWithContext,
} from "@/lib/ai/aiDocumentExtractor";
import { toast } from "sonner";

export interface DataEntryScanTriggerProps {
  contextKey: DomainContextKey;
  onApply: (data: Record<string, unknown>) => void;
  demo?: boolean;
  disabled?: boolean;
  variant?: "inline" | "bar" | "dialog_header";
  className?: string;
  fileButtonLabel?: string;
  cameraButtonLabel?: string;
}

/**
 * DataEntryScanTrigger
 * Standardized AI Scan Trigger for all manual data entry flows.
 * Provides both File Upload OCR and Factory/Mobile Camera Scanner
 * with automated schema normalization and field auto-filling.
 */
export default function DataEntryScanTrigger({
  contextKey,
  onApply,
  demo = false,
  disabled = false,
  variant = "inline",
  className = "",
  fileButtonLabel,
  cameraButtonLabel,
}: DataEntryScanTriggerProps) {
  const [showFileModal, setShowFileModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [processingCamera, setProcessingCamera] = useState(false);

  const contextConfig = DOCUMENT_CONTEXTS[contextKey];
  const fileLabel = fileButtonLabel || `Quét AI từ Tệp (${contextConfig?.badgeLabel || "Tài liệu"})`;
  const cameraLabel = cameraButtonLabel || "Chụp Camera AI";

  const handleCameraCaptured = async (imageData: string) => {
    setShowCamera(false);
    setProcessingCamera(true);
    toast.info("Đang xử lý ảnh chụp và trích xuất dữ liệu qua Gemini Vision AI...");

    try {
      if (!contextConfig) {
        throw new Error(`Không tìm thấy cấu hình ngữ cảnh cho ${contextKey}`);
      }
      const file = base64DataUrlToFile(imageData, `${contextKey}-camera-scan.jpg`);
      const extraction = await extractDocumentWithContext(file, contextConfig, { demo });

      if (extraction.success && Object.keys(extraction.fields).length > 0) {
        onApply(extraction.fields);
        toast.success(
          `AI đã nhận diện thành công ${Object.keys(extraction.fields).length} trường thông số và tự động điền vào biểu mẫu!`
        );
      } else {
        toast.warning("Chưa trích xuất được đủ trường thông số, vui lòng kiểm tra lại biểu mẫu.");
      }
    } catch (err) {
      console.error("Camera OCR error:", err);
      toast.error(err instanceof Error ? err.message : "Lỗi khi trích xuất thông tin từ camera.");
    } finally {
      setProcessingCamera(false);
    }
  };

  return (
    <>
      {variant === "bar" ? (
        <div
          className={`flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs ${className}`}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                Trợ lý Nhập liệu AI · {contextConfig?.badgeLabel || "Tự động"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Quét hóa đơn / chứng từ / ảnh chụp để điền tự động chính xác theo chuẩn dữ liệu.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCamera(true)}
              disabled={disabled || processingCamera}
              className="h-8 border-emerald-600/40 text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 text-xs font-medium gap-1.5"
            >
              {processingCamera ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5 text-emerald-600" />
              )}
              {cameraLabel}
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => setShowFileModal(true)}
              disabled={disabled || processingCamera}
              className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium gap-1.5 shadow-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {fileLabel}
            </Button>
          </div>
        </div>
      ) : variant === "dialog_header" ? (
        <div className={`flex items-center gap-1.5 ${className}`}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowCamera(true)}
            disabled={disabled || processingCamera}
            className="h-7 px-2 border-emerald-500/40 text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 text-[11px] font-medium flex items-center gap-1 transition-colors"
          >
            {processingCamera ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Camera className="h-3 w-3 text-emerald-600" />
            )}
            {cameraLabel}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowFileModal(true)}
            disabled={disabled || processingCamera}
            className="h-7 px-2 border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 text-[11px] font-medium flex items-center gap-1 transition-colors"
          >
            <Sparkles className="h-3 w-3" />
            {fileLabel}
          </Button>
        </div>
      ) : (
        <div className={`inline-flex items-center gap-1.5 ${className}`}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowCamera(true)}
            disabled={disabled || processingCamera}
            className="h-8 border-emerald-600/40 text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 text-xs font-medium gap-1.5"
          >
            {processingCamera ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5 text-emerald-600" />
            )}
            {cameraLabel}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowFileModal(true)}
            disabled={disabled || processingCamera}
            className="h-8 border-primary/30 text-primary hover:bg-primary/10 text-xs font-medium gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {fileLabel}
          </Button>
        </div>
      )}

      {/* AI Document Import Modal */}
      <AiDocumentImportModal
        open={showFileModal}
        onOpenChange={setShowFileModal}
        contextKey={contextKey}
        onApply={(data) => {
          onApply(data);
          toast.success(
            `Đã nạp thành công dữ liệu từ tài liệu [${contextConfig?.badgeLabel || contextKey}] vào biểu mẫu!`
          );
        }}
        demo={demo}
      />

      {/* Camera Scanner Modal */}
      <CameraScanner
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCaptured}
        language="vi"
      />
    </>
  );
}
