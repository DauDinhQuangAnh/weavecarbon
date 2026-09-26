"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  FolderCheck,
  Globe,
  History,
  Leaf,
  Loader2,
  Lock,
  Package,
  QrCode,
  Save,
  Send,
  Shield,
  ShieldCheck,
  Ship,
  Smartphone,
  Sparkles,
  Webhook
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { DEMO_PACK_V2 } from "@/lib/weave-v2/demoPackV2";
import { DEFAULT_EXPORT_CONFIG_V2, buildDppPayloadV2, getAllCarbonBreakdownsV2, type DppPayloadV2, type ExportConfigV2 } from "@/lib/weave-v2/exportLogisticsDocs";
import { buildBuyerWebhookPayloadV2, createDppLockV2, downloadExportDocumentV2, fetchExportConfigurationV2, saveExportConfigurationV2 } from "@/lib/weave-v2/exportV2Api";
import { exportFullStandardReport } from "@/lib/reportsApi";
import { exportBrandedTradeDocumentXlsx } from "@/lib/reports/tradeDocumentsXlsx";
import { fetchAllProducts, type ProductRecord } from "@/lib/productsApi";
import { fetchComplianceMarkets } from "@/lib/exportComplianceApi";
import { isDemoPath } from "@/lib/demo/routes";
import { getProductAuthoritativeCarbonV2, getProductEmbeddedBreakdownV2, productToDemoSkuV2 } from "@/lib/weave-v2/productReportAdapter";
import { listProductEvidenceV2, type EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";
import { buildAuditPackJsonV2, buildAuditPackPayloadV2, buildAuditRowsCsvV2 } from "@/lib/weave-v2/auditPackV2";
import CompanyDataExportCardV2 from "./CompanyDataExportCardV2";
import ComplianceDetailModal from "./ComplianceDetailModal";
import ShipmentExportPortal from "./ShipmentExportPortal";
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

export interface DemoExportConfigurationPortalV2Props {
  documentManagerSlot?: React.ReactNode;
  onOpenMarketDetail?: (market: MarketCode) => void;
}

const DemoExportConfigurationPortalV2: React.FC<DemoExportConfigurationPortalV2Props> = ({
  documentManagerSlot,
  onOpenMarketDetail
}) => {
  const pathname = usePathname();
  const isDemoRuntime = isDemoPath(pathname);
  const [activeTab, setActiveTab] = useState<string>("shipment");
  const [enterpriseExportOpen, setEnterpriseExportOpen] = useState(false);
  const [isExportingFullReport, setIsExportingFullReport] = useState(false);
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
  const [selectedDocPreview, setSelectedDocPreview] = useState<"commercial-invoice" | "packing-list" | "bill-of-lading">("commercial-invoice");
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

  useEffect(() => {
    if (isDemoRuntime && !dpp && selectedSku) {
      void buildDppPayloadV2(selectedSku).then(setDpp);
    }
  }, [dpp, isDemoRuntime, selectedSku]);
  const totals = useMemo(
    () => breakdowns.reduce((sum, item) => sum + item.embeddedTonnesBatch, 0),
    [breakdowns]
  );
  const auditPayload = useMemo(
    () => buildAuditPackPayloadV2(
      selectedSku,
      useRealProducts && selectedProduct
        ? getProductAuthoritativeCarbonV2(selectedProduct)
        : null,
      { allowDemoPreview: isDemoRuntime }
    ),
    [isDemoRuntime, selectedProduct, selectedSku, useRealProducts]
  );
  const selectedCarbon = auditPayload.totals;
  const auditRows = auditPayload.rows;
  const selectedEvidence = auditPayload.evidence;
  const marketReadiness = useMemo<Array<{ code: MarketCode; name: string; regulation: string; score: number }>>(() => [
    { code: "EU", name: "Thị trường Châu Âu", regulation: "EU Green Deal, ESPR/DPP (CBAM chưa áp dụng cho ngành này)", score: 85 },
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
        productionSite: product.facility || product.manufacturingLocation || "Cơ sở sản xuất",
        exportVolume: Number(product.quantity || 0),
        unit: "units"
      }))
      : DEMO_PACK_V2.slice(0, 4).map((sku) => ({
        productId: sku.sku,
        productName: sku.name,
        hsCode: sku.cnCode,
        productionSite: sku.factory || "Cơ sở sản xuất",
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
      if (isDemoRuntime) {
        const localPayload = await buildDppPayloadV2(selectedSku, cfg);
        setDpp(localPayload);
        toast.success("Đã khóa số liệu & sinh QR DPP (chế độ demo — dữ liệu mẫu, chưa lưu lên server).");
        return;
      }

      await handleSaveConfig();
      try {
        const remoteLock = await createDppLockV2(
          selectedProduct ? { productId: selectedProduct.id } : { sku: selectedSku.sku }
        );
        setDpp({
          ...(remoteLock.payload as unknown as DppPayloadV2),
          payloadSha256: remoteLock.payloadSha256,
          decentralizedUrl: remoteLock.decentralizedUrl,
          carbonAuthority: remoteLock.carbonAuthority
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
    "commercial-invoice": "Commercial Invoice (Hóa đơn thương mại)",
    "packing-list": "Packing List (Phiếu đóng gói)",
    "bill-of-lading": "Bill of Lading (Vận đơn B/L & Phụ lục Carbon)"
  };

  const buildDemoDocumentCsv = (type: "commercial-invoice" | "packing-list" | "bill-of-lading") => {
    if (type === "commercial-invoice") {
      const header = [
        "Invoice No",
        "Invoice Date",
        "Buyer / Importer",
        "PO Contract ID",
        "SKU",
        "Product Description",
        "HS Code",
        "Quantity (Pcs)",
        "Unit Price (USD)",
        "Total Amount (USD)",
        "Embedded Carbon (kg CO2e/pc)",
        "Total Carbon (tCO2e)",
        "CBAM Carbon Intensity Scope"
      ];
      const rows = breakdowns.map((item, idx) => {
        const unitPrice = 8.5 + (idx % 3) * 3.75;
        const totalAmount = (item.sku.units * unitPrice).toFixed(2);
        return [
          `INV-${cfg.poContractId || "2026-EU-01"}`,
          "2026-09-26",
          cfg.buyerBrand || "H&M Hennes & Mauritz GBC AB",
          cfg.poContractId || "PO-2026-0891",
          item.sku.sku,
          item.sku.name,
          item.sku.cnCode,
          String(item.sku.units),
          unitPrice.toFixed(2),
          totalAmount,
          item.embeddedKgPerUnit.toFixed(3),
          item.embeddedTonnesBatch.toFixed(4),
          "Scope 1+2+3 Certified (ISO 14067)"
        ];
      });
      return [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    }

    if (type === "packing-list") {
      const header = [
        "Packing List No",
        "Container No",
        "Carton Range",
        "Package Type",
        "SKU",
        "Product Description",
        "Pcs per Carton",
        "Total Cartons",
        "Total Units (Pcs)",
        "Net Weight (kg)",
        "Gross Weight (kg)",
        "Measurement (CBM)",
        "Packaging Carbon (kg CO2e)",
        "Cargo Embedded Carbon (tCO2e)"
      ];
      let cartonCounter = 1;
      const rows = breakdowns.map((item) => {
        const pcsPerCtn = 50;
        const totalCtns = Math.ceil(item.sku.units / pcsPerCtn);
        const fromCtn = cartonCounter;
        const toCtn = cartonCounter + totalCtns - 1;
        cartonCounter = toCtn + 1;
        const netWeight = (item.sku.units * 0.22).toFixed(1);
        const grossWeight = (item.sku.units * 0.25).toFixed(1);
        const cbm = (totalCtns * 0.045).toFixed(2);
        const pkgCarbon = (totalCtns * 0.42).toFixed(2);
        return [
          `PL-${cfg.poContractId || "2026-EU-01"}`,
          cfg.containerNo || "MSKU9012445",
          `CTN ${String(fromCtn).padStart(3, "0")} - ${String(toCtn).padStart(3, "0")}`,
          "Corrugated Carton (5-ply Recycled)",
          item.sku.sku,
          item.sku.name,
          String(pcsPerCtn),
          String(totalCtns),
          String(item.sku.units),
          netWeight,
          grossWeight,
          cbm,
          pkgCarbon,
          item.embeddedTonnesBatch.toFixed(4)
        ];
      });
      return [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    }

    // bill-of-lading (Carbon Annex)
    const header = [
      "B/L Number",
      "Vessel / Voyage",
      "Port of Loading (POL)",
      "Port of Discharge (POD)",
      "Container No",
      "Seal No",
      "SKU",
      "Total Packages",
      "Gross Weight (MT)",
      "Ocean Transit Distance (nm)",
      "Maritime Emission Scope 3.4 (tCO2e - GLEC)",
      "Cargo Embedded Production (tCO2e)",
      "Total Shipped Carbon Footprint (tCO2e)"
    ];
    const rows = breakdowns.map((item) => {
      const grossWeightMt = (item.sku.units * 0.00025).toFixed(3);
      const maritimeEmission = (Number(grossWeightMt) * 0.098).toFixed(4);
      const totalFootprint = (Number(maritimeEmission) + item.embeddedTonnesBatch).toFixed(4);
      return [
        cfg.billOfLadingNo || "ONEVNHAN260411",
        "ONE APUS / 012E",
        "Cat Lai Port, Ho Chi Minh City, VN (VNSGN)",
        "Port of Rotterdam, Netherlands (NLRTM)",
        cfg.containerNo || "MSKU9012445",
        "VN-SEAL-892104",
        item.sku.sku,
        `${Math.ceil(item.sku.units / 50)} CTNS`,
        grossWeightMt,
        "10,450",
        maritimeEmission,
        item.embeddedTonnesBatch.toFixed(4),
        totalFootprint
      ];
    });
    return [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  };

  const handleDownloadDocument = async (type: "commercial-invoice" | "packing-list" | "bill-of-lading") => {
    if (isDemoRuntime) {
      downloadText(
        `${type}_${cfg.poContractId || "demo"}.csv`,
        buildDemoDocumentCsv(type),
        "text/csv;charset=utf-8"
      );
      toast.success(`Đã tải xuống file mẫu ${DOCUMENT_TYPE_LABELS[type]} (CSV).`);
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

  const [downloadingXlsx, setDownloadingXlsx] = useState<string | null>(null);

  const handleDownloadXlsx = async (type: "commercial-invoice" | "packing-list" | "bill-of-lading") => {
    setDownloadingXlsx(type);
    try {
      await exportBrandedTradeDocumentXlsx(type, cfg, breakdowns, totals);
      toast.success(`Đã tải xuống file Excel chuẩn WeaveCarbon: ${DOCUMENT_TYPE_LABELS[type]}`);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Xuất file Excel thất bại. Vui lòng thử lại.");
    } finally {
      setDownloadingXlsx(null);
    }
  };

  const handleExportFullReport = async () => {
    setIsExportingFullReport(true);
    try {
      const result = await exportFullStandardReport("xlsx", {
        locale: "vi",
        requestedBy: "Doanh nghiệp Dệt may WeaveCarbon",
        planLabel: "Enterprise / Standard",
      });
      toast.success(
        `Đã tải xuống Báo cáo Doanh nghiệp Đầy đủ (${result.total} bản ghi, ${result.datasets} phân hệ dữ liệu) định dạng chuẩn WeaveCarbon!`
      );
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.trim()
          ? `Xuất báo cáo thất bại: ${error.message}`
          : "Xuất báo cáo thất bại. Vui lòng thử lại."
      );
    } finally {
      setIsExportingFullReport(false);
    }
  };

  const averageReadiness = useMemo(() => {
    if (!displayMarketCards.length) return 0;
    const sum = displayMarketCards.reduce((acc, item) => acc + item.score, 0);
    return Math.round(sum / displayMarketCards.length);
  }, [displayMarketCards]);

  const handleOpenMarket = (code: MarketCode) => {
    if (onOpenMarketDetail) {
      onOpenMarketDetail(code);
    } else {
      openMarketDetail(code);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Quick Action */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between md:p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
              Xuất khẩu & Tuân thủ Quốc tế
            </h2>
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs">
              ISO 14067 & ESPR
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            Quản lý hồ sơ xuất khẩu lô hàng, cấp Hộ chiếu số DPP và kiểm tra tuân thủ tiêu chuẩn quốc tế.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-emerald-200 bg-emerald-50/50 text-emerald-900 hover:bg-emerald-100 shadow-sm"
            onClick={() => setEnterpriseExportOpen(true)}
          >
            <Download className="h-4 w-4 text-emerald-800" />
            <span className="font-medium text-xs sm:text-sm">Báo cáo Doanh nghiệp (XLSX)</span>
            <Badge variant="secondary" className="bg-emerald-200/60 text-emerald-900 text-[10px] px-1.5 py-0">
              {breakdowns.length} SKU
            </Badge>
          </Button>
        </div>
      </div>

      {/* Enterprise Export Dialog */}
      <Dialog open={enterpriseExportOpen} onOpenChange={setEnterpriseExportOpen}>
        <DialogContent className="max-w-lg border-emerald-200 bg-white p-6 rounded-2xl shadow-2xl">
          <DialogHeader className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                  <Leaf className="h-4 w-4" />
                </div>
                <span>Báo cáo Doanh nghiệp & Kiểm toán</span>
              </div>
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 font-medium text-xs">
                WeaveCarbon XLSX
              </Badge>
            </div>
            <DialogDescription className="text-xs text-slate-600">
              Xuất khẩu trọn gói các phân hệ dữ liệu chuẩn theo tiêu chuẩn ISO 14067 & GHG Protocol, phục vụ kiểm toán nội bộ, đối tác chuỗi cung ứng và kê khai CBAM.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-800" />
                    <p className="text-sm font-bold text-emerald-950">File Excel đa phân hệ chuẩn</p>
                  </div>
                  <p className="text-xs text-slate-600">
                    Bao gồm Sheet Tổng quan, Tóm tắt Danh mục, Từ điển Dữ liệu và các bảng dữ liệu chi tiết
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={isExportingFullReport}
                  className="h-9 shrink-0 rounded-lg bg-emerald-800 px-4 text-white shadow-sm hover:bg-emerald-900 transition-colors"
                  onClick={() => void handleExportFullReport()}
                >
                  {isExportingFullReport ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang kết xuất...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Tải File XLSX
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Các phân hệ dữ liệu được tích hợp
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 text-slate-800">
                  <Package className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span className="font-medium truncate">Sản phẩm ({breakdowns.length} SKU)</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 text-slate-800">
                  <BarChart3 className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span className="font-medium truncate">Phân tích & Xu hướng</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 text-slate-800">
                  <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span className="font-medium truncate">Audit log & Tuân thủ</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 text-slate-800">
                  <History className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span className="font-medium truncate">Lịch sử tính phát thải</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-[11px] text-slate-600 flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                Báo cáo tự động áp dụng bảng màu xanh ngọc WeaveCarbon, cố định dòng tiêu đề, định dạng số thập phân chuẩn hóa và kiểm toán mật mã.
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick KPI Overview Cards */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Lô hàng xuất khẩu</span>
              <Ship className="h-4 w-4 text-emerald-700" />
            </div>
            <p className="mt-1 truncate text-sm sm:text-base font-bold text-slate-900">{cfg.poContractId || "PO-2026-TXT-099"}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">B/L: {cfg.billOfLadingNo || "ONEVNHAN260411"}</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Phát thải lô hàng</span>
              <Package className="h-4 w-4 text-emerald-700" />
            </div>
            <p className="mt-1 text-sm sm:text-base font-bold text-slate-900">{totals.toFixed(2)} <span className="text-xs font-normal text-slate-500">tCO₂e</span></p>
            <p className="mt-0.5 truncate text-[11px] text-emerald-700 font-medium">~{selectedCarbon.total.toFixed(3)} kg CO₂e/chiếc</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Hộ chiếu số DPP</span>
              <QrCode className="h-4 w-4 text-emerald-700" />
            </div>
            <p className="mt-1 text-sm sm:text-base font-bold text-slate-900">{dpp ? "Đã khóa SHA-256" : "Sẵn sàng khóa"}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">Chuẩn GS1 Digital Link</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Mức sẵn sàng thị trường</span>
              <Globe className="h-4 w-4 text-emerald-700" />
            </div>
            <p className="mt-1 text-sm sm:text-base font-bold text-emerald-700">EU 85% · JP 72%</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">Trung bình: {averageReadiness}% hoàn thiện</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-xl bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="shipment" className="flex items-center gap-1.5 text-xs sm:text-sm font-medium">
            <Package className="h-4 w-4 shrink-0" />
            <span className="truncate">Lô hàng & Chứng từ</span>
          </TabsTrigger>
          <TabsTrigger value="passport" className="flex items-center gap-1.5 text-xs sm:text-sm font-medium">
            <QrCode className="h-4 w-4 shrink-0" />
            <span className="truncate">Hộ chiếu số (DPP)</span>
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center gap-1.5 text-xs sm:text-sm font-medium">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span className="truncate">Kiểm toán & Tuân thủ</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Lô hàng & Chứng từ */}
        <TabsContent value="shipment" className="space-y-5">
          {/* Cổng Cấu hình Xuất khẩu */}
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <FileSpreadsheet className="h-5 w-5 text-emerald-800" />
                Cổng Cấu hình Xuất khẩu (Export Configuration Portal)
              </CardTitle>
              <p className="text-xs text-slate-600 sm:text-sm">
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
            <CardContent className="space-y-4">
              <div className="grid gap-3.5 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Mã Số Tờ Khai Hải Quan</Label>
                  <Input value={cfg.customsDeclarationNo} onChange={(event) => update("customsDeclarationNo", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Mã Hợp Đồng Thương Mại (PO/Contract ID)</Label>
                  <Input value={cfg.poContractId} onChange={(event) => update("poContractId", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Mã Vận Đơn Đường Biển (Bill of Lading)</Label>
                  <Input value={cfg.billOfLadingNo} onChange={(event) => update("billOfLadingNo", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Số Hiệu Container</Label>
                  <Input value={cfg.containerNo} onChange={(event) => update("containerNo", event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Chuẩn Định Danh Barcode Sản Phẩm</Label>
                  <Select value={cfg.barcodeStandard} onValueChange={(value) => update("barcodeStandard", value as ExportConfigV2["barcodeStandard"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GS1-Digital">GS1 Digital Link (khuyến nghị EU ESPR)</SelectItem>
                      <SelectItem value="GS1-128">GS1-128</SelectItem>
                      <SelectItem value="EAN-13">EAN-13</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Nhà mua hàng (Brand)</Label>
                  <Input value={cfg.buyerBrand} onChange={(event) => update("buyerBrand", event.target.value)} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700">Webhook ERP của Brand</Label>
                  <Input value={cfg.buyerWebhookUrl} onChange={(event) => update("buyerWebhookUrl", event.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5 pt-1">
                <Button
                  className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium"
                  disabled={locking || saving}
                  onClick={async () => {
                    await handleLockDpp();
                    setActiveTab("passport");
                  }}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Khóa số liệu & Xem Hộ chiếu số (DPP)
                </Button>
                <Button variant="outline" disabled={saving} onClick={handleSaveConfig}>
                  <Save className="mr-2 h-4 w-4" />
                  Lưu cấu hình
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Bộ chứng từ Vận tải & Thương mại */}
          <Card className="border border-emerald-200/80 bg-gradient-to-b from-emerald-50/30 via-white to-white shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-emerald-100/80 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-800 text-white shadow-sm">
                      <Leaf className="h-4 w-4 text-emerald-300" />
                    </div>
                    <CardTitle className="text-base font-bold text-slate-900 sm:text-lg">
                      Chứng từ Vận tải & Thương mại nhúng Carbon (WeaveCarbon Verified)
                    </CardTitle>
                  </div>
                  <p className="text-xs text-slate-600 sm:text-sm">
                    Bộ chứng từ xuất khẩu xanh được chuẩn hóa theo đúng thực tế giao dịch: Thương mại (Hải quan), Đóng gói (Kho bãi) và Vận đơn biển (Hãng tàu).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold text-xs py-1 px-2.5">
                    <Sparkles className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                    ISO 14067 & CBAM Compliant
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-4 sm:p-6">
              {/* 3 Interactive Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    title: "Commercial Invoice",
                    subtitle: "Hóa đơn thương mại nhúng Carbon",
                    icon: FileText,
                    type: "commercial-invoice" as const,
                    badge: "Thương mại & CBAM",
                    kpiLabel: "Tổng giá trị & Thuế CBAM",
                    kpiValue: `$${breakdowns.reduce((sum, item, idx) => sum + item.sku.units * (8.5 + (idx % 3) * 3.75), 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} · Scope 1+2+3`,
                    copy: "Phục vụ thanh toán ngân hàng & Hải quan EU: Bổ sung đơn giá, thành tiền, chỉ số phát thải carbon (kg CO₂e/chiếc) và tổng phát thải để khai báo thuế CBAM."
                  },
                  {
                    title: "Packing List",
                    subtitle: "Phiếu đóng gói & Phân bổ Carbon",
                    icon: Package,
                    type: "packing-list" as const,
                    badge: "Kho vận & Container",
                    kpiLabel: "Quy cách & Thể tích",
                    kpiValue: `${breakdowns.reduce((sum, item) => sum + Math.ceil(item.sku.units / 50), 0)} Thùng · ${(breakdowns.reduce((sum, item) => sum + Math.ceil(item.sku.units / 50), 0) * 0.045).toFixed(1)} CBM`,
                    copy: "Phục vụ bốc xếp cảng & kiểm đếm kho: Chi tiết dãy thùng (Carton Range), Net/Gross Weight, CBM và carbon bao bì phân bổ cụ thể theo container."
                  },
                  {
                    title: "Bill of Lading (Carbon Annex)",
                    subtitle: "Phụ lục Vận tải Vận đơn B/L",
                    icon: Ship,
                    type: "bill-of-lading" as const,
                    badge: "Hải trình & Hãng tàu",
                    kpiLabel: "Phát thải tàu biển Scope 3.4",
                    kpiValue: `10,450 NM · ${(breakdowns.reduce((sum, item) => sum + item.sku.units, 0) * 0.00025 * 0.098).toFixed(3)} tCO₂e`,
                    copy: "Phục vụ hãng tàu & logistics: Đo lường phát thải vận tải biển quốc tế Well-to-Wake (chuẩn GLEC / IMO DCS) từ cảng Cát Lái (VN) đến Rotterdam (EU)."
                  }
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = selectedDocPreview === item.type;
                  const isDownloadingThis = downloadingXlsx === item.type;
                  return (
                    <div
                      key={item.type}
                      onClick={() => setSelectedDocPreview(item.type)}
                      className={`group relative flex flex-col justify-between rounded-2xl border p-4 sm:p-5 transition-all cursor-pointer ${
                        isSelected
                          ? "border-emerald-600 bg-gradient-to-br from-emerald-50/90 via-emerald-50/50 to-teal-50/30 shadow-md ring-2 ring-emerald-600/30"
                          : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/20 hover:shadow-sm"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 font-semibold text-slate-900">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                              isSelected
                                ? "bg-emerald-800 text-white shadow-sm"
                                : "bg-emerald-50 text-emerald-800 group-hover:bg-emerald-100"
                            }`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-950 sm:text-base">{item.title}</p>
                              <p className="text-[11px] font-medium text-slate-500">{item.subtitle}</p>
                            </div>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] shrink-0 font-semibold px-2 py-0.5 rounded-full ${
                              isSelected
                                ? "bg-emerald-800 text-white shadow-xs"
                                : "bg-emerald-100/80 text-emerald-800"
                            }`}
                          >
                            {isSelected ? "✓ Đang xem trước" : item.badge}
                          </Badge>
                        </div>

                        {/* Mini KPI Pill */}
                        <div className="mt-3 rounded-lg bg-emerald-950/[0.04] p-2 border border-emerald-900/10">
                          <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                            {item.kpiLabel}
                          </span>
                          <span className="text-xs font-bold text-slate-900 tabular-nums">
                            {item.kpiValue}
                          </span>
                        </div>

                        <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">{item.copy}</p>
                      </div>

                      {/* Action buttons */}
                      <div className="mt-4 pt-3 border-t border-emerald-100 flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          disabled={isDownloadingThis}
                          className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs shadow-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDownloadXlsx(item.type);
                          }}
                        >
                          <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-200" />
                          {isDownloadingThis ? "Đang xuất..." : "Tải Excel (.XLSX)"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDownloadDocument(item.type);
                          }}
                        >
                          <Download className="mr-1 h-3 w-3" />
                          CSV
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dynamic Document Preview Section with WeaveCarbon Header */}
              <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
                {/* Official WeaveCarbon Dossier Header Bar */}
                <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 p-4 sm:p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Leaf className="h-4 w-4 text-emerald-400" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-300">
                        WeaveCarbon Digital Trade Dossier
                      </span>
                      <Badge className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[10px] font-mono py-0">
                        SHA-256 VERIFIED
                      </Badge>
                    </div>
                    <h4 className="text-base sm:text-lg font-bold text-white">
                      {selectedDocPreview === "commercial-invoice" && `Commercial Invoice (Hóa đơn số: INV-${cfg.poContractId || "2026-EU-01"})`}
                      {selectedDocPreview === "packing-list" && `Packing List (Phiếu đóng gói: PL-${cfg.poContractId || "2026-EU-01"})`}
                      {selectedDocPreview === "bill-of-lading" && `Bill of Lading Maritime Annex (Vận đơn B/L: ${cfg.billOfLadingNo || "ONEVNHAN260411"})`}
                    </h4>
                    <p className="text-xs text-emerald-100/80">
                      {selectedDocPreview === "commercial-invoice" && `Nhà mua hàng: ${cfg.buyerBrand || "H&M Hennes & Mauritz GBC AB"} · Hợp đồng/PO: ${cfg.poContractId || "PO-2026-0891"} · Ngày phát hành: 26/09/2026`}
                      {selectedDocPreview === "packing-list" && `Số hiệu Container: ${cfg.containerNo || "MSKU9012445"} · Đóng gói: Thùng carton 5 lớp FSC · Trọng tải: ${(breakdowns.reduce((sum, item) => sum + item.sku.units, 0) * 0.25).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} kg`}
                      {selectedDocPreview === "bill-of-lading" && `Hải trình: Cảng Cát Lái (VNSGN) ➔ Cảng Rotterdam (NLRTM) · Tàu: ONE APUS / 012E · Khoảng cách: 10,450 Hải lý`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      disabled={downloadingXlsx === selectedDocPreview}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm"
                      onClick={() => void handleDownloadXlsx(selectedDocPreview)}
                    >
                      <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                      Tải bản Excel (.XLSX)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-700 bg-emerald-900/60 text-emerald-100 hover:bg-emerald-800 text-xs"
                      onClick={() => void handleDownloadDocument(selectedDocPreview)}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Tải CSV
                    </Button>
                  </div>
                </div>

                {/* Table Content */}
                <div className="p-4 sm:p-5 space-y-4">
                  {selectedDocPreview === "commercial-invoice" && (
                    <div className="overflow-x-auto rounded-xl border border-emerald-100 shadow-2xs">
                      <table className="w-full min-w-[780px] text-xs sm:text-sm">
                        <thead className="bg-emerald-900/5 text-emerald-950 font-bold border-b-2 border-emerald-300">
                          <tr>
                            <th className="px-3.5 py-3 text-left">Mã SKU & Tên sản phẩm</th>
                            <th className="px-3.5 py-3 text-center">Mã HS / CN</th>
                            <th className="px-3.5 py-3 text-right">Số lượng (Pcs)</th>
                            <th className="px-3.5 py-3 text-right">Đơn giá (USD)</th>
                            <th className="px-3.5 py-3 text-right">Thành tiền (USD)</th>
                            <th className="px-3.5 py-3 text-right">Carbon nhúng (kg CO₂e/sp)</th>
                            <th className="px-3.5 py-3 text-right">Tổng carbon dòng (tCO₂e)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {breakdowns.map((item, idx) => {
                            const unitPrice = 8.5 + (idx % 3) * 3.75;
                            const amount = item.sku.units * unitPrice;
                            return (
                              <tr key={item.sku.sku} className="border-t border-emerald-50 even:bg-emerald-50/20 hover:bg-emerald-50/60 transition-colors">
                                <td className="px-3.5 py-2.5 font-medium text-slate-900">
                                  {item.sku.sku} <span className="text-[11px] text-slate-500 font-normal">({item.sku.name})</span>
                                </td>
                                <td className="px-3.5 py-2.5 text-center text-slate-600 font-mono">{item.sku.cnCode}</td>
                                <td className="px-3.5 py-2.5 text-right tabular-nums">{item.sku.units.toLocaleString("vi-VN")}</td>
                                <td className="px-3.5 py-2.5 text-right tabular-nums text-slate-700">${unitPrice.toFixed(2)}</td>
                                <td className="px-3.5 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                                  ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="px-3.5 py-2.5 text-right tabular-nums font-bold text-emerald-800 bg-emerald-50/40">
                                  {item.embeddedKgPerUnit.toFixed(3)}
                                </td>
                                <td className="px-3.5 py-2.5 text-right tabular-nums font-bold text-slate-900">
                                  {item.embeddedTonnesBatch.toFixed(4)}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="bg-gradient-to-r from-emerald-100 via-emerald-50 to-teal-100 font-bold border-t-2 border-emerald-500 text-emerald-950">
                            <td className="px-3.5 py-3.5" colSpan={2}>Tổng giá trị thương mại & phát thải hóa đơn</td>
                            <td className="px-3.5 py-3.5 text-right tabular-nums">{breakdowns.reduce((sum, item) => sum + item.sku.units, 0).toLocaleString("vi-VN")} pcs</td>
                            <td className="px-3.5 py-3.5 text-right">-</td>
                            <td className="px-3.5 py-3.5 text-right tabular-nums text-emerald-950 font-extrabold">
                              ${breakdowns.reduce((sum, item, idx) => sum + item.sku.units * (8.5 + (idx % 3) * 3.75), 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-3.5 py-3.5 text-right">-</td>
                            <td className="px-3.5 py-3.5 text-right tabular-nums text-emerald-950 font-extrabold text-sm">
                              {totals.toFixed(4)} tCO₂e
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {selectedDocPreview === "packing-list" && (
                    <div className="overflow-x-auto rounded-xl border border-emerald-100 shadow-2xs">
                      <table className="w-full min-w-[780px] text-xs sm:text-sm">
                        <thead className="bg-emerald-900/5 text-emerald-950 font-bold border-b-2 border-emerald-300">
                          <tr>
                            <th className="px-3.5 py-3 text-center">Dãy kiện (Carton Range)</th>
                            <th className="px-3.5 py-3 text-left">Mã SKU</th>
                            <th className="px-3.5 py-3 text-right">Pcs/Thùng</th>
                            <th className="px-3.5 py-3 text-right">Số thùng (Ctns)</th>
                            <th className="px-3.5 py-3 text-right">Số lượng (Pcs)</th>
                            <th className="px-3.5 py-3 text-right">Net Wt (kg)</th>
                            <th className="px-3.5 py-3 text-right">Gross Wt (kg)</th>
                            <th className="px-3.5 py-3 text-right">Thể tích (CBM)</th>
                            <th className="px-3.5 py-3 text-right">Carbon vỏ (kg)</th>
                            <th className="px-3.5 py-3 text-right">Carbon hàng (tCO₂e)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            let cartonCounter = 1;
                            return breakdowns.map((item) => {
                              const pcsPerCtn = 50;
                              const totalCtns = Math.ceil(item.sku.units / pcsPerCtn);
                              const fromCtn = cartonCounter;
                              const toCtn = cartonCounter + totalCtns - 1;
                              cartonCounter = toCtn + 1;
                              const netWeight = item.sku.units * 0.22;
                              const grossWeight = item.sku.units * 0.25;
                              const cbm = totalCtns * 0.045;
                              const pkgCarbon = totalCtns * 0.42;
                              return (
                                <tr key={item.sku.sku} className="border-t border-emerald-50 even:bg-emerald-50/20 hover:bg-emerald-50/60 transition-colors">
                                  <td className="px-3.5 py-2.5 text-center font-mono text-emerald-900 font-semibold bg-emerald-50/40">
                                    CTN {String(fromCtn).padStart(3, "0")} - {String(toCtn).padStart(3, "0")}
                                  </td>
                                  <td className="px-3.5 py-2.5 font-medium text-slate-900">{item.sku.sku}</td>
                                  <td className="px-3.5 py-2.5 text-right tabular-nums">{pcsPerCtn}</td>
                                  <td className="px-3.5 py-2.5 text-right tabular-nums font-semibold">{totalCtns}</td>
                                  <td className="px-3.5 py-2.5 text-right tabular-nums">{item.sku.units.toLocaleString("vi-VN")}</td>
                                  <td className="px-3.5 py-2.5 text-right tabular-nums">{netWeight.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} kg</td>
                                  <td className="px-3.5 py-2.5 text-right tabular-nums">{grossWeight.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} kg</td>
                                  <td className="px-3.5 py-2.5 text-right tabular-nums">{cbm.toFixed(2)} m³</td>
                                  <td className="px-3.5 py-2.5 text-right tabular-nums text-slate-600">{pkgCarbon.toFixed(1)}</td>
                                  <td className="px-3.5 py-2.5 text-right tabular-nums font-bold text-slate-900">{item.embeddedTonnesBatch.toFixed(4)}</td>
                                </tr>
                              );
                            });
                          })()}
                          <tr className="bg-gradient-to-r from-emerald-100 via-emerald-50 to-teal-100 font-bold border-t-2 border-emerald-500 text-emerald-950">
                            <td className="px-3.5 py-3.5" colSpan={3}>Tổng kiện & trọng lượng đóng gói</td>
                            <td className="px-3.5 py-3.5 text-right tabular-nums">{breakdowns.reduce((sum, item) => sum + Math.ceil(item.sku.units / 50), 0)} thùng</td>
                            <td className="px-3.5 py-3.5 text-right tabular-nums">{breakdowns.reduce((sum, item) => sum + item.sku.units, 0).toLocaleString("vi-VN")} pcs</td>
                            <td className="px-3.5 py-3.5 text-right tabular-nums">{(breakdowns.reduce((sum, item) => sum + item.sku.units, 0) * 0.22).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} kg</td>
                            <td className="px-3.5 py-3.5 text-right tabular-nums">{(breakdowns.reduce((sum, item) => sum + item.sku.units, 0) * 0.25).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} kg</td>
                            <td className="px-3.5 py-3.5 text-right tabular-nums">{(breakdowns.reduce((sum, item) => sum + Math.ceil(item.sku.units / 50), 0) * 0.045).toFixed(2)} m³</td>
                            <td className="px-3.5 py-3.5 text-right tabular-nums">{(breakdowns.reduce((sum, item) => sum + Math.ceil(item.sku.units / 50), 0) * 0.42).toFixed(1)} kg</td>
                            <td className="px-3.5 py-3.5 text-right tabular-nums text-sm font-extrabold">{totals.toFixed(4)} tCO₂e</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {selectedDocPreview === "bill-of-lading" && (
                    <>
                      <div className="grid gap-3 sm:grid-cols-3 text-xs">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                          <span className="text-emerald-800 font-semibold block uppercase text-[10px] tracking-wider">Phát thải vận tải biển (Scope 3.4)</span>
                          <p className="text-lg font-bold text-slate-900 mt-0.5">
                            {(breakdowns.reduce((sum, item) => sum + item.sku.units, 0) * 0.00025 * 0.098).toFixed(4)} tCO₂e
                          </p>
                          <p className="text-[11px] text-slate-600 mt-0.5">Hải trình 10,450 NM (Cát Lái ➔ Rotterdam) theo GLEC v3.0</p>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                          <span className="text-emerald-800 font-semibold block uppercase text-[10px] tracking-wider">Carbon nhúng hàng hóa (Cradle-to-Gate)</span>
                          <p className="text-lg font-bold text-emerald-900 mt-0.5">
                            {totals.toFixed(4)} tCO₂e
                          </p>
                          <p className="text-[11px] text-slate-600 mt-0.5">Tích lũy từ bông, kéo sợi, dệt may theo ISO 14067</p>
                        </div>
                        <div className="rounded-xl border border-emerald-400 bg-gradient-to-br from-emerald-100/90 to-teal-100/80 p-3 shadow-2xs">
                          <span className="text-emerald-950 font-bold block uppercase text-[10px] tracking-wider">Tổng phát thải giao nhận toàn diện</span>
                          <p className="text-lg font-extrabold text-emerald-950 mt-0.5">
                            {(totals + breakdowns.reduce((sum, item) => sum + item.sku.units, 0) * 0.00025 * 0.098).toFixed(4)} tCO₂e
                          </p>
                          <p className="text-[11px] text-emerald-900 font-medium mt-0.5">Đầy đủ vòng đời vận chuyển quốc tế bàn giao tại cảng EU</p>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-emerald-100 shadow-2xs">
                        <table className="w-full min-w-[780px] text-xs sm:text-sm">
                          <thead className="bg-emerald-900/5 text-emerald-950 font-bold border-b-2 border-emerald-300">
                            <tr>
                              <th className="px-3.5 py-3 text-left">Container / Chì niêm phong</th>
                              <th className="px-3.5 py-3 text-left">Mã SKU</th>
                              <th className="px-3.5 py-3 text-right">Số kiện (CTN)</th>
                              <th className="px-3.5 py-3 text-right">Trọng tải (Tấn)</th>
                              <th className="px-3.5 py-3 text-right">Vận tải biển (tCO₂e)</th>
                              <th className="px-3.5 py-3 text-right">Carbon nhúng (tCO₂e)</th>
                              <th className="px-3.5 py-3 text-right">Tổng dấu chân B/L (tCO₂e)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {breakdowns.map((item) => {
                              const grossWeightMt = item.sku.units * 0.00025;
                              const maritimeEmission = grossWeightMt * 0.098;
                              const totalFootprint = maritimeEmission + item.embeddedTonnesBatch;
                              return (
                                <tr key={item.sku.sku} className="border-t border-emerald-50 even:bg-emerald-50/20 hover:bg-emerald-50/60 transition-colors">
                                  <td className="px-3.5 py-2.5 font-mono text-slate-800 font-medium">
                                    {cfg.containerNo || "MSKU9012445"} <span className="text-[11px] text-slate-500 font-normal">/ VN-892104</span>
                                  </td>
                                  <td className="px-3.5 py-2.5 font-medium text-slate-900">{item.sku.sku}</td>
                                  <td className="px-3.5 py-2.5 text-right tabular-nums">{Math.ceil(item.sku.units / 50)} thùng</td>
                                  <td className="px-3.5 py-2.5 text-right tabular-nums">{grossWeightMt.toFixed(3)} MT</td>
                                  <td className="px-3.5 py-2.5 text-right tabular-nums text-slate-700">{maritimeEmission.toFixed(4)}</td>
                                  <td className="px-3.5 py-2.5 text-right tabular-nums text-emerald-800 font-bold bg-emerald-50/40">{item.embeddedTonnesBatch.toFixed(4)}</td>
                                  <td className="px-3.5 py-2.5 text-right tabular-nums font-bold text-slate-950">{totalFootprint.toFixed(4)}</td>
                                </tr>
                              );
                            })}
                            <tr className="bg-gradient-to-r from-emerald-100 via-emerald-50 to-teal-100 font-bold border-t-2 border-emerald-500 text-emerald-950">
                              <td className="px-3.5 py-3.5" colSpan={2}>Tổng phát thải cả vận đơn B/L ({cfg.billOfLadingNo || "ONEVNHAN260411"})</td>
                              <td className="px-3.5 py-3.5 text-right tabular-nums">{breakdowns.reduce((sum, item) => sum + Math.ceil(item.sku.units / 50), 0)} thùng</td>
                              <td className="px-3.5 py-3.5 text-right tabular-nums">{(breakdowns.reduce((sum, item) => sum + item.sku.units, 0) * 0.00025).toFixed(3)} MT</td>
                              <td className="px-3.5 py-3.5 text-right tabular-nums">{(breakdowns.reduce((sum, item) => sum + item.sku.units, 0) * 0.00025 * 0.098).toFixed(4)} tCO₂e</td>
                              <td className="px-3.5 py-3.5 text-right tabular-nums">{totals.toFixed(4)} tCO₂e</td>
                              <td className="px-3.5 py-3.5 text-right tabular-nums text-sm font-extrabold">
                                {(totals + breakdowns.reduce((sum, item) => sum + item.sku.units, 0) * 0.00025 * 0.098).toFixed(4)} tCO₂e
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* WeaveCarbon Cryptographic Audit Seal Bar */}
                  <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50/40 to-emerald-50/80 p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-800 text-white shadow-xs">
                        <ShieldCheck className="h-5 w-5 text-emerald-200" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-emerald-950 text-sm">Chứng thực Dấu chân Carbon WeaveCarbon Trust Engine</p>
                          <Badge variant="outline" className="border-emerald-300 bg-white text-emerald-800 text-[10px]">ISO 14067:2018</Badge>
                        </div>
                        <p className="text-slate-600 text-[11px] mt-0.5">
                          Đơn vị kiểm toán độc lập: <b>SGS Vietnam</b> · Mã Hash niêm phong: <span className="font-mono text-emerald-900 font-semibold">{dpp?.payloadSha256 ? `${dpp.payloadSha256.slice(0, 16)}...` : "7f8a92b0c1e4...8a2f"}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      <Button
                        size="sm"
                        disabled={downloadingXlsx === selectedDocPreview}
                        className="flex-1 sm:flex-initial bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs shadow-xs"
                        onClick={() => void handleDownloadXlsx(selectedDocPreview)}
                      >
                        <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-200" />
                        Xuất file Excel (.XLSX)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-50 text-xs"
                        onClick={() => void handleDownloadDocument(selectedDocPreview)}
                      >
                        <Download className="mr-1 h-3 w-3" />
                        CSV
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cổng API / Webhook Brand */}
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <Webhook className="h-5 w-5 text-emerald-800" />
                Cổng Tích hợp API Brand (ERP Ingestion)
              </CardTitle>
              <p className="text-xs text-slate-600 sm:text-sm">
                Kết xuất payload JSON có cấu trúc để đồng bộ PO và phát thải lũy kế sang hệ thống ERP của nhà mua hàng ({cfg.buyerBrand || "Brand"}).
              </p>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="border-slate-300" onClick={handleBrandPayload}>
                <Send className="mr-2 h-4 w-4 text-emerald-800" />
                Tải Buyer Webhook Payload JSON
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Hộ chiếu số (DPP QR) */}
        <TabsContent value="passport" className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
            {/* Cột Trái: Cấu hình và thông tin DPP */}
            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <QrCode className="h-5 w-5 text-emerald-800" />
                  Hộ chiếu Số Sản phẩm (Digital Product Passport - ESPR)
                </CardTitle>
                <p className="text-xs text-slate-600 sm:text-sm">
                  Cấp định danh phi tập trung và mã QR theo chuẩn EU Ecodesign (ESPR) kết hợp chuẩn GS1 Digital Link.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Label className="text-xs font-semibold text-slate-700">SKU áp dụng:</Label>
                  <Select value={activeSku} onValueChange={setActiveSku}>
                    <SelectTrigger className="w-full sm:w-[320px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {skuOptions.map((item) => (
                        <SelectItem key={item.key} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="bg-emerald-800 hover:bg-emerald-900 text-white"
                    disabled={locking}
                    onClick={handleLockDpp}
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    Sinh QR & Khóa số liệu
                  </Button>
                </div>

                {dpp ? (
                  <div className="space-y-4 pt-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-emerald-700 text-white hover:bg-emerald-700">
                        <Lock className="mr-1 h-3 w-3" />
                        SHA-256 Locked
                      </Badge>
                      <Badge variant="outline" className="font-mono text-slate-700">
                        GTIN {dpp.gtin}
                      </Badge>
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 border-emerald-200">
                        Chuẩn ISO 14067:2018
                      </Badge>
                    </div>

                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs">
                      <div>
                        <span className="font-semibold text-slate-800">Decentralized GS1 Link:</span>
                        <div className="mt-1 flex items-center justify-between gap-2 rounded bg-white p-2 border border-slate-200 font-mono text-[11px] text-emerald-900">
                          <span className="truncate">{dpp.decentralizedUrl}</span>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs shrink-0" onClick={() => copy(dpp.decentralizedUrl)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="pt-1">
                        <span className="font-semibold text-slate-800">SHA-256 Payload Hash:</span>
                        <div className="mt-1 flex items-center justify-between gap-2 rounded bg-white p-2 border border-slate-200 font-mono text-[11px] text-slate-600">
                          <span className="truncate">{dpp.payloadSha256}</span>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs shrink-0" onClick={() => copy(dpp.payloadSha256)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="pt-1 flex items-center gap-2 text-emerald-800 font-medium">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" />
                        <span>Đơn vị kiểm toán độc lập: SGS Vietnam · Tiêu chuẩn ISO 14067</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" className="bg-emerald-800 hover:bg-emerald-900 text-white" onClick={downloadQrSvg}>
                        <Download className="mr-2 h-4 w-4" />
                        Tải file QR SVG in ấn
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => copy(dpp.decentralizedUrl)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Sao chép Link tra cứu
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => copy(dpp.payloadSha256)}>
                        Sao chép SHA-256
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                    <p className="text-sm text-slate-600">
                      Nhấn nút <b className="text-emerald-800">&quot;Sinh QR & Khóa số liệu&quot;</b> ở trên để tạo Hộ chiếu Số phi tập trung cho sản phẩm này.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cột Phải: Mockup Smartphone Hải quan EU */}
            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Smartphone className="h-4 w-4 text-emerald-800" />
                  Mô phỏng quét mã QR (Hải quan EU & Brand)
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center pb-6">
                <div className="w-[270px] rounded-[32px] border-[8px] border-slate-900 bg-white p-3.5 shadow-2xl">
                  {/* Speaker notch */}
                  <div className="mx-auto mb-3 h-3.5 w-20 rounded-full bg-slate-900" />

                  {dpp ? (
                    <div className="space-y-2.5">
                      <div className="rounded-xl bg-emerald-900 p-3 text-white text-center shadow-inner">
                        <p className="text-[10px] uppercase tracking-wider text-emerald-200 font-semibold">Digital Product Passport</p>
                        <p className="mt-0.5 text-xs font-bold leading-snug">{dpp.productName}</p>
                        <p className="text-[10px] text-emerald-300">SKU {dpp.sku} · HS {dpp.cnCode}</p>
                      </div>

                      <div className="flex justify-center py-2 bg-slate-50 rounded-xl border border-slate-100">
                        <QRCodeSVG id={`dpp-qr-${dpp.sku}`} value={dpp.decentralizedUrl} size={150} includeMargin />
                      </div>

                      <div className="space-y-1.5 rounded-lg bg-slate-50 p-2.5 text-[11px] border border-slate-100">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Embedded Carbon:</span>
                          <span className="font-bold text-emerald-900">{dpp.embeddedKgPerUnit.toFixed(3)} kg CO₂e</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                          <span>Bằng chứng EVN:</span>
                          <span className="font-mono">{dpp.evidenceHashes[0]?.sha256.slice(0, 12)}...</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold pt-0.5 border-t border-slate-200">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Verified by SGS Vietnam</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-20 text-center text-xs text-slate-400">
                      Chưa có mã QR đã khóa
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: Kiểm toán & Tuân thủ Quốc tế */}
        <TabsContent value="compliance" className="space-y-6">
          {/* Mức độ sẵn sàng theo thị trường (CHỈ 1 LẦN DUY NHẤT) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                <Globe className="h-5 w-5 text-emerald-800" />
                Mức độ sẵn sàng theo thị trường xuất khẩu
              </h3>
              <Badge variant="outline" className="text-xs text-slate-600">
                4 thị trường mục tiêu
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {displayMarketCards.map((market) => (
                <Card
                  key={market.code}
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-emerald-300 hover:shadow-md"
                  onClick={() => handleOpenMarket(market.code)}
                >
                  <CardContent className="p-3.5 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 font-bold text-sm">
                        {market.code}
                      </div>
                      <Badge className={market.score >= 80 ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-amber-100 text-amber-800 hover:bg-amber-100"}>
                        {market.score}%
                      </Badge>
                    </div>

                    <div className="mt-2.5">
                      <p className="truncate text-sm font-semibold text-slate-900">{market.name}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{market.regulation}</p>
                      <Progress value={market.score} className="mt-2 h-1.5" />
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                      <div className={`flex items-center gap-1 text-[11px] font-medium ${market.score >= 80 ? "text-emerald-700" : "text-amber-700"}`}>
                        {market.score >= 80 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                        <span>{market.score >= 80 ? "Sẵn sàng xuất khẩu" : "2 mục cần bổ sung"}</span>
                      </div>
                      <span className="flex items-center text-slate-400 hover:text-slate-600 text-[11px]">
                        Chi tiết <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Pre-Audit Pack */}
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
                      <th className="px-3 py-2 font-bold">#</th>
                      <th className="px-3 py-2 font-bold">Phân đoạn</th>
                      <th className="px-3 py-2 text-right font-bold">Sản lượng (AD)</th>
                      <th className="px-3 py-2 text-right font-bold">Hệ số (EF)</th>
                      <th className="px-3 py-2 font-bold">Nguồn gốc EF</th>
                      <th className="px-3 py-2 text-right font-bold">kg CO₂e</th>
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
                        Mô phỏng rủi ro kiểu CBAM (pre-audit, giả định 85 €/tCO₂e × dư phát thải {(selectedCarbon.gap / 1000).toFixed(4)} t — không phải khoản phí CBAM thực tế)
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
                    <div key={`${item.lookupCode}-${item.sha256}`} className="flex items-center justify-between gap-2 rounded border border-slate-200 px-2 py-1 bg-white">
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="h-3 w-3 shrink-0 text-slate-500" />
                        <span className="truncate">{item.fileName}</span>
                        <Badge variant="outline" className="rounded px-1 py-0 text-[10px]">Mã tra cứu: {item.lookupCode}</Badge>
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-500 font-mono">SHA-256 {item.sha256.slice(0, 12).toUpperCase()}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" className="bg-emerald-800 text-white hover:bg-emerald-900" onClick={downloadAuditPackJson}>
                    <Download className="mr-2 h-4 w-4" />
                    Audit Pack (JSON)
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => downloadAuditCsv(`KiemKeKNK_${selectedSku.sku}.csv`)}>
                    <Download className="mr-2 h-4 w-4" />
                    Mẫu kiểm kê KNK (TT 38/2023/TT-BCT)
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => downloadAuditCsv(`CBAM_${selectedSku.sku}.csv`)}>
                    <Download className="mr-2 h-4 w-4" />
                    CBAM-style template (DG TAXUD, pre-audit)
                  </Button>
                </div>
                <div className="pt-2 text-[10px] text-emerald-900">
                  ISO 14067:2018 · Ecoinvent v3.10 · DEFRA 2024 · Bộ TN&MT VN
                </div>
              </div>
            </Card>
          </div>

          {/* Kho Tài liệu Tuân thủ & Chứng nhận Vật liệu (Document Manager) */}
          {documentManagerSlot && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                <FolderCheck className="h-5 w-5 text-emerald-800" />
                Kho Tài liệu Tuân thủ & Chứng chỉ Vật liệu
              </h3>
              {documentManagerSlot}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Local Compliance Detail Modal Fallback */}
      {!onOpenMarketDetail && (
        <ComplianceDetailModal
          open={marketDetailOpen}
          onOpenChange={setMarketDetailOpen}
          marketCode={selectedMarketCode}
          complianceData={displayComplianceData}
        />
      )}
    </div>
  );
};

export interface ExportConfigurationPortalV2Props {
  documentManagerSlot?: React.ReactNode;
  onOpenMarketDetail?: (market: MarketCode) => void;
}

const ExportConfigurationPortalV2: React.FC<ExportConfigurationPortalV2Props> = ({
  documentManagerSlot,
  onOpenMarketDetail
}) => {
  const pathname = usePathname();
  if (isDemoPath(pathname)) {
    return (
      <DemoExportConfigurationPortalV2
        documentManagerSlot={documentManagerSlot}
        onOpenMarketDetail={onOpenMarketDetail}
      />
    );
  }
  return (
    <div className="space-y-6">
      <ShipmentExportPortal />
      {documentManagerSlot}
    </div>
  );
};

export default ExportConfigurationPortalV2;
