"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Printer,
  X,
  Package,
  PlusCircle,
  Loader2,
  ArrowRight
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { REPORT_TABS_V2, WEAVE_V2_COLORS } from "@/lib/weave-v2/reportTemplate";
import { downloadReportCsvV2, downloadReportPdfV2, downloadReportXlsxV2 } from "@/lib/weave-v2/reportExporters";
import { fetchAllProducts, type ProductRecord } from "@/lib/productsApi";
import { isDemoPath, useAppRoutes } from "@/lib/demo/routes";
import { buildReportPayloadFromProductWithEvidenceV2 } from "@/lib/weave-v2/productReportAdapter";
import { saveReportSnapshotV2 } from "@/lib/weave-v2/reportsV2Api";
import { listProductEvidenceV2, type EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";

interface ReportPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatNumber = (value: number, digits = 3) =>
  new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);

const DonutChart: React.FC<{ data: Array<{ name: string; value: number; color: string }> }> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0) || 1;
  const segments = data.map((item) => (Math.max(0, item.value) / total) * 100);

  return (
    <svg viewBox="0 0 160 160" className="h-48 w-48" aria-hidden="true">
      <circle cx="80" cy="80" r="52" fill="none" stroke="#e5eee9" strokeWidth="34" />
      {data.map((item, index) => {
        const segment = segments[index];
        const strokeDashoffset = -segments.slice(0, index).reduce((sum, current) => sum + current, 0);
        return (
          <circle
            key={item.name}
            cx="80"
            cy="80"
            r="52"
            fill="none"
            stroke={item.color}
            strokeWidth="34"
            pathLength="100"
            strokeDasharray={`${segment} ${100 - segment}`}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 80 80)"
          />
        );
      })}
      <circle cx="80" cy="80" r="34" fill="#ffffff" />
    </svg>
  );
};

const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({ open, onOpenChange }) => {
  const router = useRouter();
  const pathname = usePathname();
  const appRoutes = useAppRoutes();
  const isDemoRuntime = isDemoPath(pathname);

  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productEvidence, setProductEvidence] = useState<Record<string, EvidenceDocumentV2[]>>({});
  const [selectedSku, setSelectedSku] = useState("");
  const [activeTab, setActiveTab] = useState<(typeof REPORT_TABS_V2)[number]["key"]>("overview");
  const printableRef = useRef<HTMLDivElement | null>(null);

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === selectedSku || item.productCode === selectedSku) || products[0],
    [products, selectedSku]
  );
  const payload = useMemo(
    () => selectedProduct
      ? buildReportPayloadFromProductWithEvidenceV2(selectedProduct, productEvidence[selectedProduct.id] || [])
      : null,
    [productEvidence, selectedProduct]
  ) as ReturnType<typeof buildReportPayloadFromProductWithEvidenceV2>;
  const skuOptions = useMemo(
    () => products.map((item) => ({
            key: item.id,
            value: item.id,
            label: `${item.productCode} - ${item.productName}`
          })),
    [products]
  );

  const gapRow = payload?.breakdownRows.find((row) => row.isDefault);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingProducts(true);
    void (async () => {
      try {
        const items = await fetchAllProducts({ sort_by: "updated_at", sort_order: "desc" });
        if (cancelled) return;
        setProducts(items);
        if (items.length > 0) {
          setSelectedSku((current) =>
            items.some((item) => item.id === current || item.productCode === current)
              ? current
              : items[0].id
          );
        }
      } catch {
        if (!cancelled) {
          setProducts([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingProducts(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !selectedProduct || productEvidence[selectedProduct.id]) return;
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
  }, [open, productEvidence, selectedProduct]);

  const persistSnapshot = async () => {
    if (isDemoRuntime || !payload) return;
    try {
      await saveReportSnapshotV2(payload);
    } catch {
      // Do not block file export if snapshot persistence is temporarily unavailable.
    }
  };

  const isRealAccountEmpty = !loadingProducts && !payload;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-[1180px] overflow-y-auto border-slate-200 bg-[#F8FBF9] p-0">
        <DialogHeader className="sticky top-0 z-10 border-b border-slate-200 bg-[#F8FBF9] px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <FileSpreadsheet className="h-5 w-5 text-emerald-800" />
                Xem trước báo cáo - WEAVE_CARBON_TEMPLATE_v2.0
              </DialogTitle>
              <p className="mt-1 text-sm text-slate-600">
                Bóc tách theo đúng format chuẩn: Tổng quan, Nhập liệu, ISO 14067, ESG · Kiểm kê KNK, CBAM EU.
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {payload && !loadingProducts && (
            <>
              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">SKU:</span>
                  <Select value={selectedSku || selectedProduct?.id || ""} onValueChange={setSelectedSku}>
                    <SelectTrigger className="h-11 w-[310px] rounded-xl border-emerald-700 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {skuOptions.map((item) => (
                        <SelectItem key={item.key} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => void persistSnapshot().finally(() => downloadReportCsvV2(payload))}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Tải CSV
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => void persistSnapshot().finally(() => void downloadReportXlsxV2(payload))}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Tải Excel (5 sheet + công thức)
                  </Button>
                  <Button
                    className="gap-2 bg-emerald-800 hover:bg-emerald-900"
                    onClick={() => void persistSnapshot().finally(() => void downloadReportPdfV2(payload))}
                  >
                    <Printer className="h-4 w-4" />
                    Tải PDF (đầy đủ màu & biểu đồ)
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-5 gap-2 rounded-xl bg-[#E8F0EC] p-1">
                {REPORT_TABS_V2.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`rounded-lg px-3 py-2 text-sm transition ${
                      activeTab === tab.key
                        ? "bg-white font-semibold text-slate-950 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </DialogHeader>

        <div className="p-6">
          {loadingProducts ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
              <p className="mt-3 text-sm text-slate-600">Đang tải danh sách sản phẩm...</p>
            </div>
          ) : isRealAccountEmpty ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-white p-10 text-center shadow-sm">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-800">
                <Package className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">
                Tài khoản chưa có sản phẩm nào
              </h3>
              <p className="mt-2 max-w-md text-sm text-slate-600">
                Bạn chưa tạo sản phẩm hoặc chưa hoàn tất tính toán phát thải (PCF). Vui lòng thêm sản phẩm và nguyên phụ liệu tại mục <strong>Sản phẩm</strong> để xuất báo cáo chính thức cho doanh nghiệp.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button
                  className="gap-2 bg-emerald-800 hover:bg-emerald-900"
                  onClick={() => {
                    onOpenChange(false);
                    router.push(appRoutes.toAppPath("/products"));
                  }}
                >
                  <PlusCircle className="h-4 w-4" />
                  Đến trang tạo sản phẩm
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div ref={printableRef} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="rounded-xl px-4 py-3 text-white" style={{ backgroundColor: WEAVE_V2_COLORS.primary }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">WEAVE CARBON v2.0 - DẤU CHÂN CARBON SẢN PHẨM & TUÂN THỦ ESG</h2>
                    <p className="text-xs text-white/85">SECTOR: DỆT MAY - HÀNG MAY MẶC VIỆT NAM</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="border-white/40 bg-emerald-700 text-white">Audit-Ready</Badge>
                    <Badge className="border-white/40 bg-sky-700 text-white">SHA-256 Certified</Badge>
                  </div>
                </div>
              </div>

              {activeTab === "overview" && (
                <div className="mt-5 space-y-4">
                  <p className="text-xs text-slate-600">Data sources: {payload.sources.join(", ")}</p>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl p-4 text-white" style={{ backgroundColor: WEAVE_V2_COLORS.secondary }}>
                      <p className="text-sm font-semibold">1. Tổng dấu chân carbon sản phẩm</p>
                      <p className="mt-3 text-4xl font-bold">{formatNumber(payload.totals.pcfKgPerUnit)}</p>
                      <p className="text-sm">kg CO2e/chiếc</p>
                    </div>
                    <div className="rounded-xl bg-emerald-700 p-4 text-white">
                      <p className="text-sm font-semibold">2. Mức phát thải tối ưu có thể đạt</p>
                      <p className="mt-3 text-4xl font-bold">{formatNumber(payload.totals.optimalKgPerUnit)}</p>
                      <p className="text-sm">kg CO2e/chiếc</p>
                    </div>
                    <div className="rounded-xl p-4 text-white" style={{ backgroundColor: WEAVE_V2_COLORS.red }}>
                      <p className="text-sm font-semibold">3. Rủi ro phạt CBAM ước tính</p>
                      <p className="mt-3 text-4xl font-bold">{payload.totals.cbamRiskEurPerUnit.toFixed(2)}</p>
                      <p className="text-sm">EUR/sản phẩm</p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr_1fr]">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <h3 className="mb-3 text-sm font-bold">BẢNG PHÂN RÃ PCF (MÃ SKU: {payload.sku.sku})</h3>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-left text-slate-600">
                            <th className="py-2">Giai đoạn</th>
                            <th>Hoạt động</th>
                            <th>Khối lượng</th>
                            <th>Nguồn hệ số EF</th>
                            <th className="text-right">kg CO2e</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payload.breakdownRows.map((row) => (
                            <tr
                              key={`${row.stage}-${row.activity}`}
                              className={row.isDefault ? "bg-red-50 text-red-800" : "border-b"}
                            >
                              <td className="py-2 font-medium">{row.stage}</td>
                              <td>{row.activity}</td>
                              <td>
                                {row.amount} {row.unit}
                              </td>
                              <td>{row.source}</td>
                              <td className="text-right font-semibold">{formatNumber(row.kgCo2e)}</td>
                            </tr>
                          ))}
                          <tr className="bg-emerald-50 font-bold">
                            <td colSpan={4} className="py-2">
                              Tổng
                            </td>
                            <td className="text-right">{formatNumber(payload.totals.pcfKgPerUnit)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <h3 className="mb-2 text-sm font-bold">CẤU TRÚC PHÁT THẢI</h3>
                      <div className="mx-auto grid h-48 w-48 place-items-center">
                        <DonutChart data={payload.pieData} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        {payload.pieData.map((item) => (
                          <div key={item.name} className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            <span>
                              {item.name}: {item.value}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <h3 className="mb-3 text-sm font-bold">THEO DÕI ĐỘ HOÀN THIỆN DỮ LIỆU & KIỂM TOÁN</h3>
                      <div className="space-y-2 text-sm">
                        <p>
                          <span className="text-slate-500">Tên cơ sở:</span> {payload.facility.name}
                        </p>
                        <p>
                          <span className="text-slate-500">Mã HS:</span> {payload.sku.cnCode}
                        </p>
                        <p className="font-semibold text-red-700">
                          Cảnh báo: {gapRow ? "CẢNH BÁO ĐỎ: KHUYẾT SCOPE 3" : "Không có red flag"}
                        </p>
                        <p>
                          <span className="text-slate-500">Dấu vết:</span> SHA-256 Verified
                        </p>
                        <div>
                          <span className="text-slate-500">Audit evidence:</span>
                          {payload.evidence.length > 0 ? (
                            <ul className="mt-1 list-disc pl-5 text-emerald-800">
                              {payload.evidence.map((evidence) => (
                                <li key={evidence.sha256}>{evidence.fileName}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-slate-400">Chưa có chứng từ đính kèm.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab !== "overview" && (
                <div className="mt-5 rounded-xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-base font-bold">
                    {REPORT_TABS_V2.find((tab) => tab.key === activeTab)?.label}
                  </h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {(activeTab === "input"
                        ? payload.evidence.map((item) => ({
                            field: item.kind,
                            value: item.fileName,
                            source: item.lookupCode,
                            hash: item.sha256
                          }))
                        : activeTab === "iso14067"
                        ? payload.breakdownRows.map((item) => ({
                            field: item.stage,
                            value: item.formula,
                            source: item.source,
                            hash: item.kgCo2e.toFixed(4)
                          }))
                        : activeTab === "esgTt01"
                        ? payload.esgRows.map((item) => ({
                            field: item.scope,
                            value: item.tCO2e,
                            source: item.source,
                            hash: "tCO2e"
                          }))
                        : payload.cbamRows.map((item) => ({
                            field: item.field,
                            value: item.value,
                            source: "DG TAXUD",
                            hash: item.unit || ""
                          }))
                      ).map((row) => (
                        <tr key={`${row.field}-${row.value}`} className="border-b">
                          <td className="w-1/4 py-2 font-medium">{row.field}</td>
                          <td>{row.value}</td>
                          <td className="text-slate-600">{row.source}</td>
                          <td className="font-mono text-xs text-slate-500">{row.hash}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
                Nguồn: {payload.sources.join(" · ")}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportPreviewModal;

