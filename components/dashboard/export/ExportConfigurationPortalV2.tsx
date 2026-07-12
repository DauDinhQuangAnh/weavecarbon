"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronRight, Copy, Download, FileText, Globe, Lock, Package, QrCode, Send, Shield, Ship, Smartphone, Webhook } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DEMO_PACK_V2 } from "@/lib/weave-v2/demoPackV2";
import { DEFAULT_EXPORT_CONFIG_V2, buildDppPayloadV2, getAllCarbonBreakdownsV2, type DppPayloadV2, type ExportConfigV2 } from "@/lib/weave-v2/exportLogisticsDocs";
import { buildBuyerWebhookPayloadV2, createDppLockV2, downloadExportDocumentV2, fetchExportConfigurationV2, saveExportConfigurationV2 } from "@/lib/weave-v2/exportV2Api";
import { exportFullStandardReport } from "@/lib/reportsApi";
import { fetchAllProducts, type ProductRecord } from "@/lib/productsApi";
import { fetchComplianceMarkets } from "@/lib/exportComplianceApi";
import { isDemoPath } from "@/lib/demo/routes";
import { getProductEmbeddedBreakdownV2, productToDemoSkuV2 } from "@/lib/weave-v2/productReportAdapter";
import { listProductEvidenceV2, type EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";
import { buildAuditPackJsonV2, buildAuditPackPayloadV2, buildAuditRowsCsvV2 } from "@/lib/weave-v2/auditPackV2";
import CompanyDataExportCardV2 from "./CompanyDataExportCardV2";
import ComplianceDetailModal from "./ComplianceDetailModal";
import { MARKET_REGULATIONS, type MarketCode, type MarketCompliance } from "./types";

const downloadText = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const ExportConfigurationPortalV2: React.FC = () => {
  const pathname = usePathname();
  const isDemoRuntime = isDemoPath(pathname);
  const [cfg, setCfg] = useState<ExportConfigV2>(DEFAULT_EXPORT_CONFIG_V2);
  const [activeSku, setActiveSku] = useState(DEMO_PACK_V2[0]?.sku || "");
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productEvidence, setProductEvidence] = useState<Record<string, EvidenceDocumentV2[]>>({});
  const [realComplianceData, setRealComplianceData] = useState<Record<MarketCode, MarketCompliance> | null>(null);
  const [dpp, setDpp] = useState<DppPayloadV2 | null>(null);
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [selectedMarketCode, setSelectedMarketCode] = useState<MarketCode | null>(null);
  const [marketDetailOpen, setMarketDetailOpen] = useState(false);
  const useRealProducts = !isDemoRuntime && products.length > 0;
  const breakdowns = useMemo(
    () => useRealProducts ? products.map((product) => getProductEmbeddedBreakdownV2(product)) : getAllCarbonBreakdownsV2(),
    [products, useRealProducts]
  );
  const selectedProduct = useMemo(
    () => products.find((item) => item.id === activeSku || item.productCode === activeSku) || products[0],
    [activeSku, products]
  );
  const selectedSku = useMemo(
    () => useRealProducts && selectedProduct
      ? productToDemoSkuV2(selectedProduct, productEvidence[selectedProduct.id] || [])
      : DEMO_PACK_V2.find((item) => item.sku === activeSku) || DEMO_PACK_V2[0],
    [activeSku, productEvidence, selectedProduct, useRealProducts]
  );
  const totals = useMemo(
    () => breakdowns.reduce((sum, item) => sum + item.embeddedTonnesBatch, 0),
    [breakdowns]
  );
  const auditPayload = useMemo(() => buildAuditPackPayloadV2(selectedSku), [selectedSku]);
  const selectedCarbon = auditPayload.totals;
  const auditRows = auditPayload.rows;
  const selectedEvidence = auditPayload.evidence;
  const marketReadiness = useMemo<Array<{ code: MarketCode; name: string; regulation: string; score: number }>>(() => [
    { code: "EU", name: "Thị trường Châu Âu", regulation: "CBAM, EU Green Deal", score: 85 },
    { code: "US", name: "Thị trường Hoa Kỳ", regulation: "California Climate", score: 65 },
    { code: "JP", name: "Thị trường Nhật Bản", regulation: "JIS Standards", score: 72 },
    { code: "KR", name: "Thị trường Hàn Quốc", regulation: "K-ETS", score: 58 }
  ], []);
  const marketProductScope = useMemo(
    () => useRealProducts
      ? products.slice(0, Math.max(2, Math.min(4, products.length))).map((product) => ({
        productId: product.id,
        productName: product.productName,
        hsCode: product.hsCode || product.cnCode || "-",
        productionSite: product.facility || product.manufacturingLocation || "Nha may Binh Duong",
        exportVolume: Number(product.quantity || 0),
        unit: "units"
      }))
      : DEMO_PACK_V2.slice(0, 4).map((sku) => ({
        productId: sku.sku,
        productName: sku.name,
        hsCode: sku.cnCode,
        productionSite: "Nha may Binh Duong",
        exportVolume: sku.units,
        unit: "units"
      })),
    [products, useRealProducts]
  );
  const marketComplianceData = useMemo(() => {
    return marketReadiness.reduce((acc, market) => {
      const status = market.score >= 85 ? "ready" : market.score >= 50 ? "incomplete" : "draft";
      const uploadedRequired = market.score >= 80 ? 1 : 0;
      acc[market.code] = {
        market: market.code,
        marketName: market.name,
        regulation: MARKET_REGULATIONS[market.code],
        score: market.score,
        status,
        lastUpdated: "2026-06-07",
        requiredDocuments: [`${market.code} calculation sheet`],
        requiredDocumentsCount: 1,
        requiredDocumentsUploadedCount: uploadedRequired,
        requiredDocumentsMissingCount: 1 - uploadedRequired,
        documentsTotalCount: 3,
        documentsUploadedCount: market.score >= 80 ? 2 : 1,
        documentsMissingCount: market.score >= 80 ? 1 : 2,
        documents: [
          {
            id: `${market.code.toLowerCase()}-calculation`,
            name: `${market.code} Carbon Calculation Sheet`,
            type: "calculation_sheet",
            required: true,
            status: market.score >= 80 ? "approved" : "uploaded",
            uploadedBy: "Nguyen Van A",
            validTo: "2024-12-31"
          },
          {
            id: `${market.code.toLowerCase()}-ped`,
            name: "Product Environmental Declaration",
            type: "environmental_declaration",
            required: false,
            status: market.score >= 80 ? "uploaded" : "missing"
          },
          {
            id: `${market.code.toLowerCase()}-verification`,
            name: "Verification Statement",
            type: "verification_statement",
            required: false,
            status: "uploaded",
            uploadedBy: "Nguyen Van A",
            validTo: "2024-12-31"
          }
        ],
        carbonData: [
          {
            scope: "scope1",
            value: 125.5,
            unit: "kgCO2e",
            methodology: "GHG Protocol",
            dataSource: "Internal measurement",
            reportingPeriod: "Q4 2024",
            isComplete: true
          },
          {
            scope: "scope2",
            value: 89.3,
            unit: "kgCO2e",
            methodology: "GHG Protocol",
            dataSource: "Utility bills",
            reportingPeriod: "Q4 2024",
            isComplete: true
          },
          {
            scope: "scope3",
            value: 234.8,
            unit: "kgCO2e",
            methodology: "GHG Protocol",
            dataSource: "Supplier data",
            reportingPeriod: "Q4 2024",
            isComplete: true
          }
        ],
        productScope: marketProductScope,
        emissionFactors: [
          {
            name: "Grid Electricity - Vietnam",
            source: "DEFRA 2024",
            version: "v2024.1",
            appliedDate: "2026-06-07"
          },
          {
            name: "Cotton Fiber - Organic",
            source: "Ecoinvent v3.9",
            version: "v3.9.1",
            appliedDate: "2026-06-07"
          }
        ],
        recommendations: market.score >= 80
          ? []
          : [
            {
              id: `${market.code}-ped`,
              type: "document",
              missingItem: "Product Environmental Declaration chua duoc nop",
              regulatoryReason: "Thi truong yeu cau ho so moi truong san pham de doi chieu khai bao carbon.",
              businessImpact: "Ho so co the bi brand hoac cong hai quan yeu cau bo sung truoc khi duyet.",
              recommendedAction: ["Tai Product Environmental Declaration", "Doi chieu ma HS voi SKU xuat khau"],
              priority: "mandatory",
              ctaLabel: "Tai len",
              ctaAction: "upload_document",
              status: "active",
              relatedDocumentId: `${market.code.toLowerCase()}-ped`
            },
            {
              id: `${market.code}-hs`,
              type: "product_scope",
              missingItem: "Mot so san pham chua co ma HS Code day du",
              regulatoryReason: "Ma HS/CN la khoa de khop yeu cau ho so thi truong va chung tu thuong mai.",
              businessImpact: "Bao cao thi truong co the bi lech so voi Commercial Invoice / Packing List / B/L.",
              recommendedAction: ["Cap nhat HS Code cho SKU con thieu"],
              priority: "recommended",
              ctaLabel: "Cap nhat SKU",
              ctaAction: "edit_product_scope",
              status: "active"
            }
          ],
        verificationRequired: market.code === "EU" || market.code === "JP",
        verificationStatus: market.score >= 80 ? "verified" : "pending"
      };
      return acc;
    }, {} as Record<MarketCode, MarketCompliance>);
  }, [marketProductScope, marketReadiness]);

  const displayComplianceData = realComplianceData || marketComplianceData;
  const displayMarketCards = useMemo(() => {
    if (realComplianceData) {
      return (Object.keys(realComplianceData) as MarketCode[])
        .map((code) => {
          const market = realComplianceData[code];
          if (!market) return null;
          return {
            code,
            name: market.marketName,
            regulation: market.regulation?.code || MARKET_REGULATIONS[code]?.code || code,
            score: market.score
          };
        })
        .filter((item): item is { code: MarketCode; name: string; regulation: string; score: number } => Boolean(item));
    }

    return marketReadiness;
  }, [marketReadiness, realComplianceData]);

  const openMarketDetail = (market: MarketCode) => {
    setSelectedMarketCode(market);
    setMarketDetailOpen(true);
  };

  const skuOptions = useMemo(
    () => useRealProducts
      ? products.map((item) => ({
        key: item.id,
        value: item.id,
        label: `${item.productCode} - ${item.productName}`
      }))
      : DEMO_PACK_V2.map((item) => ({
        key: item.sku,
        value: item.sku,
        label: `${item.sku} - ${item.name}`
      })),
    [products, useRealProducts]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const remote = await fetchExportConfigurationV2();
        if (!cancelled && remote) {
          setCfg({ ...DEFAULT_EXPORT_CONFIG_V2, ...remote });
        }
      } catch {
        // Demo/offline mode keeps local defaults.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isDemoRuntime) return;
    let cancelled = false;
    void (async () => {
      try {
        const items = await fetchAllProducts({ sort_by: "updated_at", sort_order: "desc" });
        if (cancelled) return;
        setProducts(items);
        if (items.length > 0) {
          setActiveSku((current) =>
            items.some((item) => item.id === current || item.productCode === current)
              ? current
              : items[0].id
          );
        }
      } catch {
        if (!cancelled) {
          setProducts([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDemoRuntime]);

  useEffect(() => {
    if (isDemoRuntime) return;
    let cancelled = false;
    void (async () => {
      try {
        const markets = await fetchComplianceMarkets();
        if (!cancelled) {
          setRealComplianceData(markets);
        }
      } catch {
        if (!cancelled) {
          setRealComplianceData(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDemoRuntime]);

  useEffect(() => {
    if (!useRealProducts || !selectedProduct || productEvidence[selectedProduct.id]) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await listProductEvidenceV2(selectedProduct.id);
        if (!cancelled) {
          setProductEvidence((current) => ({ ...current, [selectedProduct.id]: response.items || [] }));
        }
      } catch {
        if (!cancelled) {
          setProductEvidence((current) => ({ ...current, [selectedProduct.id]: [] }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productEvidence, selectedProduct, useRealProducts]);

  const update = <K extends keyof ExportConfigV2>(key: K, value: ExportConfigV2[K]) => {
    setCfg((current) => ({ ...current, [key]: value }));
  };

  const handleSaveConfig = async () => {
    if (isDemoRuntime) {
      toast.success("Đã lưu cấu hình xuất khẩu (chế độ demo — chỉ lưu tạm trên trình duyệt).");
      return;
    }

    setSaving(true);
    try {
      await saveExportConfigurationV2(cfg);
      toast.success("Đã lưu cấu hình xuất khẩu");
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.trim()
          ? `Lưu cấu hình thất bại: ${error.message}`
          : "Lưu cấu hình thất bại. Vui lòng thử lại."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLockDpp = async () => {
    if (!isDemoRuntime && !useRealProducts) {
      toast.error("Chưa có sản phẩm nào được đánh giá carbon. Vui lòng thêm và xuất bản ít nhất 1 sản phẩm trước khi khóa số liệu & sinh QR DPP.");
      return;
    }

    setLocking(true);
    try {
      const localPayload = await buildDppPayloadV2(selectedSku, cfg);
      setDpp(localPayload);

      if (isDemoRuntime) {
        toast.success("Đã khóa số liệu & sinh QR DPP (chế độ demo — dữ liệu mẫu, chưa lưu lên server).");
        return;
      }

      await handleSaveConfig();
      try {
        const remoteLock = await createDppLockV2(
          selectedProduct ? { productId: selectedProduct.id } : { sku: selectedSku.sku }
        );
        setDpp({
          ...localPayload,
          payloadSha256: remoteLock.payloadSha256 || localPayload.payloadSha256,
          decentralizedUrl: remoteLock.decentralizedUrl || localPayload.decentralizedUrl
        });
        toast.success("Đã khóa số liệu & sinh QR DPP");
      } catch (error) {
        toast.error(
          error instanceof Error && error.message.trim()
            ? `Khóa số liệu thất bại: ${error.message}`
            : "Khóa số liệu thất bại. Vui lòng thử lại."
        );
      }
    } finally {
      setLocking(false);
    }
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success("Đã copy");
  };

  const downloadQrSvg = () => {
    if (!dpp) return;
    const svg = document.getElementById(`dpp-qr-${dpp.sku}`);
    if (!svg) return;
    const content = new XMLSerializer().serializeToString(svg);
    downloadText(`DPP_QR_${dpp.sku}.svg`, content, "image/svg+xml;charset=utf-8");
  };

  const handleBrandPayload = async () => {
    try {
      const payload = await buildBuyerWebhookPayloadV2();
      downloadText(`Buyer_Webhook_${cfg.poContractId}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    } catch {
      const payload = {
        buyerBrand: cfg.buyerBrand,
        poContractId: cfg.poContractId,
        billOfLadingNo: cfg.billOfLadingNo,
        shipment: breakdowns.map((item) => ({
          sku: item.sku.sku,
          hsCode: item.sku.cnCode,
          units: item.sku.units,
          embeddedKgPerUnit: Number(item.embeddedKgPerUnit.toFixed(4)),
          embeddedTonnesBatch: Number(item.embeddedTonnesBatch.toFixed(4))
        }))
      };
      downloadText(`Buyer_Webhook_${cfg.poContractId}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    }
  };

  const downloadAuditPackJson = () => {
    downloadText(
      `AuditPack_${selectedSku.sku}.json`,
      JSON.stringify(buildAuditPackJsonV2(auditPayload), null, 2),
      "application/json;charset=utf-8"
    );
  };

  const downloadAuditCsv = (filename: string) => {
    downloadText(filename, buildAuditRowsCsvV2(auditPayload), "text/csv;charset=utf-8");
  };

  const DOCUMENT_TYPE_LABELS: Record<"commercial-invoice" | "packing-list" | "bill-of-lading", string> = {
    "commercial-invoice": "Commercial Invoice",
    "packing-list": "Packing List",
    "bill-of-lading": "Bill of Lading"
  };

  const buildDemoDocumentCsv = (type: "commercial-invoice" | "packing-list" | "bill-of-lading") => {
    const header = ["Document", "SKU", "HS Code", "Units", "kg CO2e/pc", "Total (tCO2e)", "PO/Contract", "B/L No", "Container No"];
    const rows = breakdowns.map((item) => [
      DOCUMENT_TYPE_LABELS[type],
      item.sku.sku,
      item.sku.cnCode,
      String(item.sku.units),
      item.embeddedKgPerUnit.toFixed(3),
      item.embeddedTonnesBatch.toFixed(4),
      cfg.poContractId,
      cfg.billOfLadingNo,
      cfg.containerNo
    ]);
    return [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  };

  const handleDownloadDocument = async (type: "commercial-invoice" | "packing-list" | "bill-of-lading") => {
    if (isDemoRuntime) {
      downloadText(
        `${type}_demo_${cfg.poContractId}.csv`,
        buildDemoDocumentCsv(type),
        "text/csv;charset=utf-8"
      );
      toast.info(`${DOCUMENT_TYPE_LABELS[type]}: chế độ demo tải bản CSV dữ liệu mẫu (bản XLSX đầy đủ chỉ có ở tài khoản thật).`);
      return;
    }

    if (!useRealProducts) {
      toast.error("Chưa có sản phẩm nào được đánh giá carbon. Vui lòng thêm và xuất bản ít nhất 1 sản phẩm trước khi tải chứng từ.");
      return;
    }

    try {
      await downloadExportDocumentV2(type);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.trim()
          ? `Tải ${DOCUMENT_TYPE_LABELS[type]} thất bại: ${error.message}`
          : `Tải ${DOCUMENT_TYPE_LABELS[type]} thất bại. Vui lòng thử lại.`
      );
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Xuất khẩu & Tuân thủ</h2>
        <p className="text-sm text-slate-600">Quản lý hồ sơ xuất khẩu, DPP QR và dữ liệu carbon nhúng cho chứng từ thương mại.</p>
      </div>

      <CompanyDataExportCardV2
        productCount={breakdowns.length}
        onExportFull={() => void exportFullStandardReport("xlsx", { locale: "vi" })}
      />

      <Card className="border border-emerald-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-5 w-5 text-emerald-800" />
            Cổng Cấu hình Xuất khẩu (Export Configuration Portal)
          </CardTitle>
          <p className="text-sm text-slate-600">
            Đồng bộ số liệu carbon nhúng với Commercial Invoice / Packing List / B/L, sinh DPP QR và payload webhook cho ERP của nhà mua hàng.
          </p>
          {!isDemoRuntime && !useRealProducts && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Công ty bạn chưa có sản phẩm nào được đánh giá carbon — dữ liệu SKU hiển thị bên dưới chỉ là dữ liệu mẫu minh họa.
                Hãy thêm và xuất bản sản phẩm trước khi khóa số liệu hoặc tải chứng từ thật.
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Mã Số Tờ Khai Hải Quan</Label>
              <Input value={cfg.customsDeclarationNo} onChange={(event) => update("customsDeclarationNo", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Mã Hợp Đồng Thương Mại (PO/Contract ID)</Label>
              <Input value={cfg.poContractId} onChange={(event) => update("poContractId", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Mã Vận Đơn Đường Biển (Bill of Lading)</Label>
              <Input value={cfg.billOfLadingNo} onChange={(event) => update("billOfLadingNo", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Số Hiệu Container</Label>
              <Input value={cfg.containerNo} onChange={(event) => update("containerNo", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Chuẩn Định Danh Barcode Sản Phẩm</Label>
              <Select value={cfg.barcodeStandard} onValueChange={(value) => update("barcodeStandard", value as ExportConfigV2["barcodeStandard"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GS1-Digital">GS1 Digital Link (khuyến nghị EU ESPR)</SelectItem>
                  <SelectItem value="GS1-128">GS1-128</SelectItem>
                  <SelectItem value="EAN-13">EAN-13</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nhà mua hàng (Brand)</Label>
              <Input value={cfg.buyerBrand} onChange={(event) => update("buyerBrand", event.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Webhook ERP của Brand</Label>
              <Input value={cfg.buyerWebhookUrl} onChange={(event) => update("buyerWebhookUrl", event.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="bg-emerald-800 hover:bg-emerald-900" disabled={locking || saving} onClick={handleLockDpp}>
              <Lock className="mr-2 h-4 w-4" />
              Khóa số liệu bất biến & Xuất mã QR Hộ chiếu số (DPP)
            </Button>
            <Button variant="outline" disabled={saving} onClick={handleSaveConfig}>Lưu cấu hình</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <Shield className="h-5 w-5 text-emerald-800" />
          Pre-Audit Pack — Sẵn sàng kiểm toán SGS / BV / CBAM
        </h3>
        <Card className="overflow-hidden rounded-xl border-2 border-slate-200 bg-white font-mono text-sm shadow-sm">
          <div className="border-b border-dashed border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-center text-xs font-bold tracking-[0.22em] text-emerald-900">
              WEAVE CARBON CORE ENGINE — AUDIT COMPLIANCE PANEL
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-md font-mono">SKU: {selectedSku.sku}</Badge>
                <Badge className="rounded-md bg-emerald-600 font-mono text-white hover:bg-emerald-600">
                  <Lock className="mr-1 h-3 w-3" />
                  ĐÃ KHÓA SỬA ĐỔI (SHA-256)
                </Badge>
              </div>
              {selectedCarbon.gap > 0 ? (
                <Badge className="rounded-md bg-red-500 font-mono text-white hover:bg-red-500">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  +20% PROXY (EU 2023/1773)
                </Badge>
              ) : (
                <Badge className="rounded-md bg-emerald-700 font-mono text-white hover:bg-emerald-700">
                  AUDIT-READY
                </Badge>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-xs">
              <thead className="bg-slate-50 text-left text-emerald-950">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Phân đoạn</th>
                  <th className="px-3 py-2 text-right">Sản lượng (AD)</th>
                  <th className="px-3 py-2 text-right">Hệ số (EF)</th>
                  <th className="px-3 py-2">Nguồn gốc EF</th>
                  <th className="px-3 py-2 text-right">kg CO₂e</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((row, index) => (
                  <tr key={`${row.segment}-${row.detail}-${index}`} className={`border-t border-slate-100 ${row.isDefault ? "bg-red-50" : ""}`}>
                    <td className="px-3 py-3 text-emerald-900">{index + 1}</td>
                    <td className="px-3 py-3">
                      <div className="font-semibold">{row.segment}</div>
                      <div className="text-[11px] text-emerald-900">{row.detail}</div>
                      {row.isDefault && <Badge className="mt-1 rounded bg-red-500 px-1 py-0 text-[10px] text-white">DEFAULT</Badge>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.activity.toFixed(3)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.factor.toFixed(4)}</td>
                    <td className="px-3 py-3 text-[11px] text-emerald-900">{row.source}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{row.kgCo2e.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-emerald-50">
                  <td colSpan={5} className="px-3 py-3 font-bold">TỔNG DẤU CHÂN CARBON SẢN PHẨM (ISO 14067)</td>
                  <td className="px-3 py-3 text-right text-base font-bold tabular-nums">
                    {selectedCarbon.total.toFixed(3)} <span className="text-xs font-normal">kg CO₂e/chiếc</span>
                  </td>
                </tr>
                <tr className="bg-red-50 text-red-600">
                  <td colSpan={5} className="px-3 py-3">
                    Rủi ro CBAM (giả định 85 €/tCO₂e × dư phát thải {(selectedCarbon.gap / 1000).toFixed(4)} t)
                  </td>
                  <td className="px-3 py-3 text-right font-bold">€ {selectedSku.cbamPenaltyEurPerUnit.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="space-y-3 border-t border-dashed border-slate-200 p-4">
            <div className="text-xs font-bold tracking-wide text-emerald-900">
              &gt;&gt;&gt; HỒ SƠ CHỨNG TỪ GỐC (TẢI VỀ CHO KIỂM TOÁN VIÊN SGS / TÜV RHEINLAND) &lt;&lt;&lt;
            </div>
            <div className="space-y-1 text-xs">
              {selectedEvidence.map((item) => (
                <div key={`${item.lookupCode}-${item.sha256}`} className="flex items-center justify-between gap-2 rounded border border-slate-200 px-2 py-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="h-3 w-3 shrink-0 text-slate-500" />
                    <span className="truncate">{item.fileName}</span>
                    <Badge variant="outline" className="rounded px-1 py-0 text-[10px]">Mã tra cứu: {item.lookupCode}</Badge>
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-500">SHA-256 {item.sha256.slice(0, 12).toUpperCase()}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" className="bg-emerald-800 text-white hover:bg-emerald-900" onClick={downloadAuditPackJson}>
                <Download className="mr-2 h-4 w-4" />
                Audit Pack (JSON)
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadAuditCsv(`TT01_${selectedSku.sku}.csv`)}>
                <Download className="mr-2 h-4 w-4" />
                Mẫu 01 — TT 01/2022
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadAuditCsv(`CBAM_${selectedSku.sku}.csv`)}>
                <Download className="mr-2 h-4 w-4" />
                CBAM template (DG TAXUD)
              </Button>
            </div>
            <div className="pt-2 text-[10px] text-emerald-900">
              ISO 14067:2018 · Ecoinvent v3.10 · DEFRA 2024 · Bộ TN&MT VN
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <Globe className="h-5 w-5 text-emerald-800" />
          Mức độ sẵn sàng theo thị trường
        </h3>
        <div className="grid gap-3">
          {displayMarketCards.map((market) => (
            <Card
              key={market.code}
              className="cursor-pointer rounded-xl border border-emerald-100 bg-white shadow-sm transition-shadow hover:shadow-md"
              onClick={() => openMarketDetail(market.code)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                    <span className="text-lg font-bold text-emerald-800">{market.code}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-slate-950">{market.name}</p>
                      <Badge className={market.score >= 80 ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}>
                        {market.score}%
                      </Badge>
                    </div>
                    <p className="mb-2 truncate text-xs text-slate-600">{market.regulation}</p>
                    <Progress value={market.score} className="h-2" />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-emerald-100 pt-3">
                  <div className={`flex items-center gap-1 text-xs ${market.score >= 80 ? "text-emerald-600" : "text-amber-600"}`}>
                    {market.score >= 80 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    <span>{market.score >= 80 ? "Sẵn sàng xuất khẩu" : "2 mục cần bổ sung"}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={(event) => {
                      event.stopPropagation();
                      openMarketDetail(market.code);
                    }}
                  >
                    Chi tiết
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-emerald-800" />
            Chứng từ Vận tải & Thương mại (đã nhúng Embedded Carbon)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { title: "Commercial Invoice", icon: FileText, type: "commercial-invoice" as const, copy: "Thêm cột Embedded Carbon Intensity và tổng theo dòng." },
              { title: "Packing List", icon: Package, type: "packing-list" as const, copy: "Carbon nhúng theo từng carton và container." },
              { title: "Bill of Lading (Carbon Annex)", icon: Ship, type: "bill-of-lading" as const, copy: "Tổng phát thải nhúng của lô theo B/L." }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.type} className="rounded-xl border border-emerald-100 p-4">
                  <div className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 text-emerald-800" />{item.title}</div>
                  <p className="mt-1 text-xs text-slate-600">{item.copy}</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => void handleDownloadDocument(item.type)}>
                    <Download className="mr-2 h-4 w-4" />Tải XLSX
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">HS</th>
                  <th className="px-3 py-2 text-right">Units</th>
                  <th className="px-3 py-2 text-right">kg CO2e / pc</th>
                  <th className="px-3 py-2 text-right">Tổng (tCO2e)</th>
                </tr>
              </thead>
              <tbody>
                {breakdowns.map((item) => (
                  <tr key={item.sku.sku} className="border-t">
                    <td className="px-3 py-2 font-medium">{item.sku.sku}</td>
                    <td className="px-3 py-2">{item.sku.cnCode}</td>
                    <td className="px-3 py-2 text-right">{item.sku.units.toLocaleString("vi-VN")}</td>
                    <td className="px-3 py-2 text-right">{item.embeddedKgPerUnit.toFixed(3)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{item.embeddedTonnesBatch.toFixed(4)}</td>
                  </tr>
                ))}
                <tr className="bg-emerald-50 font-bold">
                  <td className="px-3 py-2" colSpan={4}>Tổng cả lô (B/L {cfg.billOfLadingNo})</td>
                  <td className="px-3 py-2 text-right">{totals.toFixed(4)} tCO2e</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><QrCode className="h-5 w-5 text-emerald-800" />Hộ chiếu Số (DPP QR)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Label>SKU áp dụng:</Label>
              <Select value={activeSku} onValueChange={setActiveSku}>
                <SelectTrigger className="w-[320px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {skuOptions.map((item) => (
                    <SelectItem key={item.key} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleLockDpp}><Lock className="mr-2 h-4 w-4" />Sinh QR</Button>
            </div>
            {dpp ? (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-emerald-700">SHA-256 Locked</Badge>
                  <Badge variant="outline">GTIN {dpp.gtin}</Badge>
                </div>
                <p className="break-all"><span className="font-medium">Decentralized link:</span> {dpp.decentralizedUrl}</p>
                <p className="break-all font-mono text-xs text-slate-600">{dpp.payloadSha256}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={downloadQrSvg}><Download className="mr-2 h-4 w-4" />Tải QR SVG</Button>
                  <Button size="sm" variant="outline" onClick={() => copy(dpp.decentralizedUrl)}><Copy className="mr-2 h-4 w-4" />Copy link</Button>
                  <Button size="sm" variant="outline" onClick={() => copy(dpp.payloadSha256)}>Copy SHA-256</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">Nhấn khóa số liệu để sinh Hộ chiếu Số cho SKU này.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm"><Smartphone className="h-4 w-4 text-emerald-800" />Giao diện Hải quan EU khi quét QR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mx-auto w-[260px] rounded-[28px] border-[8px] border-slate-800 bg-white p-4 shadow-xl">
              {dpp ? (
                <>
                  <div className="rounded-t-2xl bg-emerald-800 p-3 text-white">
                    <p className="text-xs">DIGITAL PRODUCT PASSPORT</p>
                    <p className="font-bold">{dpp.productName}</p>
                    <p className="text-xs">SKU {dpp.sku} - HS {dpp.cnCode}</p>
                  </div>
                  <div className="grid place-items-center py-4">
                    <QRCodeSVG id={`dpp-qr-${dpp.sku}`} value={dpp.decentralizedUrl} size={148} includeMargin />
                  </div>
                  <div className="space-y-2 text-xs">
                    <p className="flex justify-between"><span>Embedded carbon</span><b>{dpp.embeddedKgPerUnit.toFixed(3)} kg CO2e</b></p>
                    <p className="break-all text-slate-500">Hash EVN: {dpp.evidenceHashes[0]?.sha256.slice(0, 28)}...</p>
                    <p className="text-emerald-700">Verified by SGS Vietnam</p>
                  </div>
                </>
              ) : (
                <div className="py-16 text-center text-sm text-slate-500">Chưa có QR đã khóa</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Webhook className="h-5 w-5 text-emerald-800" />Cổng API Brand</CardTitle>
          <p className="text-sm text-slate-600">Kết xuất payload để đồng bộ PO và phát thải lũy kế sang ERP của nhà mua hàng.</p>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleBrandPayload}><Send className="mr-2 h-4 w-4" />Tải Buyer Webhook Payload JSON</Button>
        </CardContent>
      </Card>

      <ComplianceDetailModal
        open={marketDetailOpen}
        onOpenChange={setMarketDetailOpen}
        marketCode={selectedMarketCode}
        complianceData={displayComplianceData}
      />
    </div>
  );
};

export default ExportConfigurationPortalV2;
