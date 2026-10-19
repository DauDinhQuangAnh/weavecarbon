"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, X, SwitchCamera, Flashlight, FlashlightOff, RefreshCw, Check } from "lucide-react";
import Image from "next/image";

interface CameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageData: string) => void;
  language?: "vi" | "en";
}

/**
 * CameraScanner - Section 28 Visual Spec
 * - Full-screen black background
 * - Top & bottom gradients (black/70 -> transparent)
 * - Center 256x256px scan frame with 4 white corner markers
 * - Capture button 64x64px circular white
 * - Preview state with Retake & Use Photo actions
 */
export default function CameraScanner({
  isOpen,
  onClose,
  onCapture,
  language = "vi",
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [flashOn, setFlashOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setError(null);
    } catch (err) {
      console.error("Camera error:", err);
      setError(
        language === "vi"
          ? "Không thể truy cập camera. Vui lòng kiểm tra quyền trên trình duyệt."
          : "Unable to access camera. Please check browser permissions."
      );
    }
  }, [facingMode, language]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (isOpen && !capturedPreview) {
      void Promise.resolve().then(() => {
        if (active) void startCamera();
      });
    } else {
      stopCamera();
    }

    return () => {
      active = false;
      stopCamera();
    };
  }, [isOpen, capturedPreview, startCamera, stopCamera]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL("image/jpeg", 0.88);
        setCapturedPreview(imageData);
        stopCamera();
      }
    }
  };

  const handleConfirmPhoto = () => {
    if (capturedPreview) {
      onCapture(capturedPreview);
      setCapturedPreview(null);
      onClose();
    }
  };

  const handleRetake = () => {
    setCapturedPreview(null);
    startCamera();
  };

  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const toggleFlash = async () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
        torch?: boolean;
      };

      if (capabilities && capabilities.torch) {
        try {
          await track.applyConstraints({
            advanced: [{ torch: !flashOn } as MediaTrackConstraintSet],
          });
          setFlashOn(!flashOn);
        } catch (err) {
          console.error("Flash error:", err);
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between select-none">
      {/* Top Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setCapturedPreview(null);
            onClose();
          }}
          className="text-white hover:bg-white/20 h-10 w-10 rounded-full"
        >
          <X className="w-6 h-6" />
        </Button>
        <h2 className="text-white font-medium text-base tracking-wide">
          {language === "vi" ? "Scan document / Chụp chứng từ" : "Scan document"}
        </h2>
        <div className="w-10" />
      </div>

      {/* Main View Area */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {error ? (
          <Card className="max-w-sm mx-4 bg-neutral-900 border-neutral-800 text-white">
            <CardHeader>
              <CardTitle className="text-destructive text-center">
                {language === "vi" ? "Lỗi truy cập Camera" : "Camera Error"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-neutral-400 mb-4 text-sm">{error}</p>
              <Button onClick={startCamera} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {language === "vi" ? "Thử lại" : "Retry"}
              </Button>
            </CardContent>
          </Card>
        ) : capturedPreview ? (
          /* Preview State */
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <Image
              src={capturedPreview}
              alt="Document Preview"
              fill
              unoptimized
              className="object-contain"
            />
            <div className="absolute top-16 left-0 right-0 text-center">
              <span className="inline-block bg-black/60 text-white/90 text-xs px-3 py-1.5 rounded-full backdrop-blur-md">
                {language === "vi" ? "Xem trước chứng từ đã chụp" : "Preview captured document"}
              </span>
            </div>
          </div>
        ) : (
          /* Live Stream & Center Scan Frame (256x256px with 4 corner markers) */
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-2 border-white/50 rounded-2xl relative shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col items-center">
        {capturedPreview ? (
          /* Preview State Action Buttons */
          <div className="flex items-center justify-center gap-6 w-full max-w-sm">
            <Button
              variant="outline"
              size="lg"
              onClick={handleRetake}
              className="flex-1 gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20 backdrop-blur-md rounded-xl"
            >
              <RefreshCw className="w-4 h-4" />
              {language === "vi" ? "Chụp lại" : "Retake"}
            </Button>
            <Button
              size="lg"
              onClick={handleConfirmPhoto}
              className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
            >
              <Check className="w-4 h-4" />
              {language === "vi" ? "Dùng ảnh" : "Use photo"}
            </Button>
          </div>
        ) : (
          /* Capture Controls */
          <>
            <div className="flex items-center justify-center gap-8">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFlash}
                className="text-white hover:bg-white/20 w-12 h-12 rounded-full"
                title="Flashlight"
              >
                {flashOn ? <Flashlight className="w-6 h-6 text-amber-400" /> : <FlashlightOff className="w-6 h-6" />}
              </Button>

              <button
                type="button"
                onClick={handleCapture}
                className="w-16 h-16 rounded-full bg-white hover:bg-white/90 active:scale-95 transition-transform flex items-center justify-center shadow-lg ring-4 ring-white/30"
                aria-label="Capture photo"
              >
                <Camera className="w-8 h-8 text-neutral-900" />
              </button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleSwitchCamera}
                className="text-white hover:bg-white/20 w-12 h-12 rounded-full"
                title="Switch camera"
              >
                <SwitchCamera className="w-6 h-6" />
              </Button>
            </div>

            <p className="text-center text-white/75 text-xs mt-4">
              {language === "vi"
                ? "Align the document inside the frame / Căn chỉnh chứng từ trong khung quét"
                : "Align the document inside the frame"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
