"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Copy,
  Download,
  Printer,
  QrCode,
  Share2,
  Shield
} from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { useAppRuntime } from "@/lib/demo/routes";
import { env } from "@/lib/env";
import {
  PRODUCT_SNAPSHOT_PARAM,
  encodePublicPassportSnapshot
} from "@/lib/demo/passportSnapshot";
import { isPublishedProductStatus, type ProductRecord } from "@/lib/productsApi";

const normalizePublicBaseUrl = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : "";
};

const resolvePublicOrigin = () => {
  const configuredOrigin =
    normalizePublicBaseUrl(env.NEXT_PUBLIC_APP_PUBLIC_URL) ||
    normalizePublicBaseUrl(env.NEXT_PUBLIC_SITE_URL);

  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
};

const isLocalhostUrl = (value: string) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
};

export interface ProductQRCodeProps {
  productId: string;
  productName: string;
  productCode?: string;
  sku?: string;
  shipmentId?: string;
  /**
   * Full product record. Dùng để cảnh báo khi sản phẩm chưa xuất bản (trang công khai
   * chỉ hiển thị sản phẩm đã xuất bản) và, ở demo, để nhúng snapshot gọn cho sản phẩm
   * tự tạo trong phiên — thiết bị quét không có dữ liệu demo của trình duyệt này.
   */
  product?: ProductRecord;
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
}

const ProductQRCode: React.FC<ProductQRCodeProps> = ({
  productId,
  productName,
  productCode,
  sku,
  shipmentId,
  product,
  open,
  isOpen,
  onClose
}) => {
  const t = useTranslations("products.qrCode");
  const isDialogOpen = open ?? isOpen ?? false;
  const code = productCode ?? sku ?? productId;
  const { toast } = useToast();
  const runtime = useAppRuntime();
  const [copied, setCopied] = useState(false);

  // QR luôn trỏ tới trang hộ chiếu công khai /passport (không cần đăng nhập), giống nhau
  // ở tài khoản thật và demo. Demo thêm `demo=1` để trang đọc dữ liệu mẫu thay vì API;
  // sản phẩm có sẵn trong bộ dữ liệu demo gốc chỉ cần id nên link ngắn, QR thưa.
  const [passportUrl, setPassportUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    const build = async () => {
      const publicOrigin = resolvePublicOrigin();
      if (!publicOrigin) return "";
      const params = new URLSearchParams({ id: productId });
      if (shipmentId && shipmentId.trim().length > 0) {
        params.set("shipmentId", shipmentId.trim());
      }
      if (runtime === "demo") {
        params.set("demo", "1");
        const { isSeedDemoProductId } = await import("@/lib/demo/storage");
        if (!isSeedDemoProductId(productId)) {
          const snapshot = await encodePublicPassportSnapshot(product);
          if (snapshot) params.set(PRODUCT_SNAPSHOT_PARAM, snapshot);
        }
      }
      return `${publicOrigin}/passport?${params.toString()}`;
    };
    void build().then((url) => {
      if (!cancelled) setPassportUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [product, productId, runtime, shipmentId]);

  // Link có snapshot dài hơn nên hạ mức sửa lỗi xuống M để QR không quá dày.
  const qrLevel: "L" | "M" | "Q" | "H" = passportUrl.includes(
    `&${PRODUCT_SNAPSHOT_PARAM}=`
  )
    ? "M"
    : "H";

  const isUnpublished = Boolean(product) && !isPublishedProductStatus(product?.status);

  const usesLocalhostUrl = passportUrl ? isLocalhostUrl(passportUrl) : false;

  const handleCopyLink = async () => {
    if (!passportUrl) return;
    try {
      await navigator.clipboard.writeText(passportUrl);
      setCopied(true);
      toast({
        title: t("toasts.copiedTitle"),
        description: t("toasts.copiedDescription")
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: t("toasts.copyErrorTitle"),
        description: t("toasts.copyErrorDescription"),
        variant: "destructive"
      });
    }
  };

  const handleDownload = () => {
    const svg = document.getElementById("product-qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 500;

      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const qrSize = 300;
        const qrX = (canvas.width - qrSize) / 2;
        ctx.drawImage(img, qrX, 30, qrSize, qrSize);

        ctx.fillStyle = "#334155";
        ctx.font = "bold 18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(t("canvas.greenPassport"), canvas.width / 2, 360);

        ctx.fillStyle = "#374151";
        ctx.font = "14px sans-serif";
        ctx.fillText(productName, canvas.width / 2, 390);

        ctx.fillStyle = "#6b7280";
        ctx.font = "12px sans-serif";
        ctx.fillText(`${t("canvas.sku")}: ${code}`, canvas.width / 2, 415);

        ctx.fillText(
          t("canvas.scanToView"),
          canvas.width / 2,
          450
        );
        ctx.fillText("WeaveCarbon", canvas.width / 2, 480);
      }

      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `product-passport-${code}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();

      toast({
        title: t("toasts.downloadedTitle"),
        description: t("toasts.downloadedDescription")
      });
    };

    img.src =
    "data:image/svg+xml;base64," +
    btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const svg = document.getElementById("product-qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${t("print.documentTitle", { code })}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: system-ui, sans-serif;
            }
            .container {
              text-align: center;
              padding: 40px;
              border: 2px solid #94a3b8;
              border-radius: 16px;
            }
            .title {
              color: #334155;
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 20px;
            }
            .product-name {
              font-size: 18px;
              color: #374151;
              margin-top: 20px;
            }
            .sku {
              font-size: 14px;
              color: #6b7280;
              margin-top: 8px;
            }
            .footer {
              font-size: 12px;
              color: #9ca3af;
              margin-top: 16px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="title">${t("print.greenPassport")}</div>
            ${svgData}
            <div class="product-name">${productName}</div>
            <div class="sku">${t("canvas.sku")}: ${code}</div>
            <div class="footer">${t("print.footer")}</div>
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t("share.title", { productName }),
          text: t("share.text", { productName }),
          url: passportUrl
        });
      } catch {

      }
    } else {
      void handleCopyLink();
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-slate-600" />
            {t("dialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("dialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="bg-linear-to-br from-slate-50 to-slate-100">
            <CardContent className="p-6 flex flex-col items-center">
              <div className="bg-white p-4 rounded-xl shadow-sm">
                {passportUrl ?
                <QRCodeSVG
                  id="product-qr-code"
                  value={passportUrl}
                  size={224}
                  level={qrLevel}
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#000000" /> :

                <div className="h-56 w-56 animate-pulse rounded-lg bg-slate-100" aria-hidden />
                }
              </div>

              <div className="mt-4 text-center">
                <Badge className="bg-slate-200 text-slate-700 mb-2">
                  <Shield className="w-3 h-3 mr-1" />
                  {t("badge.verifiedProduct")}
                </Badge>
                <h3 className="font-semibold text-sm">{productName}</h3>
                <p className="text-xs text-muted-foreground">{t("canvas.sku")}: {code}</p>
              </div>
            </CardContent>
          </Card>

          {usesLocalhostUrl && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              QR đang trỏ tới localhost. Điện thoại quét sẽ không mở được trừ khi bạn cấu hình
              `NEXT_PUBLIC_APP_PUBLIC_URL` bằng domain hoặc IP LAN của máy đang chạy FE.
            </div>
          )}

          {isUnpublished && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Sản phẩm chưa xuất bản nên trang hộ chiếu công khai chưa hiển thị. Hãy xuất bản
              sản phẩm trước khi in hoặc gửi mã QR này.
            </div>
          )}

          {passportUrl && (
            <a
              href={passportUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={passportUrl}
              className="block truncate rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {passportUrl}
            </a>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              {t("actions.download")}
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              {t("actions.print")}
            </Button>
            <Button variant="outline" onClick={() => void handleCopyLink()}>
              {copied ?
              <CheckCircle2 className="w-4 h-4 mr-2 text-slate-600" /> :

              <Copy className="w-4 h-4 mr-2" />
              }
              {copied ? t("actions.copied") : t("actions.copyLink")}
            </Button>
            <Button variant="outline" onClick={() => void handleShare()}>
              <Share2 className="w-4 h-4 mr-2" />
              {t("actions.share")}
            </Button>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
            <p className="flex items-start gap-2">
              <QrCode className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
              <span>
                <strong>{t("help.customerTitle")}</strong> {t("help.customerDesc")}
              </span>
            </p>
            <p className="flex items-start gap-2 mt-2">
              <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>{t("help.customsTitle")}</strong> {t("help.customsDesc")}
              </span>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>);

};

export default ProductQRCode;
