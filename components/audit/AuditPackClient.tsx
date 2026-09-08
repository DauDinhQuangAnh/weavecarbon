"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Shield,
  Download,
  FileSpreadsheet,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DemoSkuV2 } from "@/lib/weave-v2/demoPackV2";
import {
  buildAuditPackPayloadV2,
  buildAuditPackJsonV2,
  buildAuditRowsCsvV2,
  type AuditPackPayloadV2
} from "@/lib/weave-v2/auditPackV2";
import { fetchAllProducts, type ProductRecord } from "@/lib/productsApi";
import { getProductAuthoritativeCarbonV2, productToDemoSkuV2 } from "@/lib/weave-v2/productReportAdapter";
import { listProductEvidenceV2, type EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";

const PAGE_LOAD_DATE = new Date().toISOString().slice(0, 10);

const formatNum = (v: number | string | null | undefined, digits = 3) => {
  const num = typeof v === "number" ? v : parseFloat(String(v || 0));
  return Number.isFinite(num)
    ? new Intl.NumberFormat("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(num)
    : "—";
};

const downloadFile = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default function AuditPackClient() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productEvidence, setProductEvidence] = useState<Record<string, EvidenceDocumentV2[]>>({});
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const items = await fetchAllProducts({ sort_by: "updated_at", sort_order: "desc" });
        if (!cancelled) {
          setProducts(items || []);
          if (items && items.length > 0) {
            setSelectedProductId(items[0].id);
          }
        }
      } catch {
        if (!cancelled) {
          setProducts([]);
        }
      } finally {
        if (!cancelled) setProductsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || products[0];
  }, [products, selectedProductId]);

  // Load evidence for the active product
  useEffect(() => {
    if (!selectedProduct || productEvidence[selectedProduct.id]) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await listProductEvidenceV2(selectedProduct.id);
        if (!cancelled) {
          setProductEvidence((prev) => ({ ...prev, [selectedProduct.id]: res.items || [] }));
        }
      } catch {
        if (!cancelled) {
          setProductEvidence((prev) => ({ ...prev, [selectedProduct.id]: [] }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProduct, productEvidence]);

  const approvedEvidence = useMemo(() => {
    if (!selectedProduct) return [];
    return (productEvidence[selectedProduct.id] || []).filter((item) =>
      ["locked", "third_party_verified"].includes(item.status)
      && /^[a-f0-9]{64}$/i.test(item.checksumSha256 || "")
      && item.fileSizeBytes > 0
      && Boolean(item.storageKey)
      && (!item.validTo || item.validTo >= PAGE_LOAD_DATE)
    );
  }, [selectedProduct, productEvidence]);

  const auditSku: DemoSkuV2 | null = useMemo(() => selectedProduct
    ? productToDemoSkuV2(selectedProduct, approvedEvidence)
    : null, [approvedEvidence, selectedProduct]);

  const auditPayload: AuditPackPayloadV2 | null = useMemo(() => auditSku
    ? buildAuditPackPayloadV2(auditSku, selectedProduct ? getProductAuthoritativeCarbonV2(selectedProduct) : null)
    : null, [auditSku, selectedProduct]);

  const dataReady = auditPayload?.status === "internal_review";
  // Production downloads stay disabled until the backend stores an immutable manifest + evidence bundle.
  const canExport = false;

  const handleExportJson = () => {
    if (!auditPayload || !auditSku || !canExport) return;
    const json = JSON.stringify(buildAuditPackJsonV2(auditPayload), null, 2);
    downloadFile(`AuditPack_${auditSku.sku}_${new Date().toISOString().slice(0, 10)}.json`, json, "application/json");
  };

  const handleExportCsv = () => {
    if (!auditPayload || !auditSku || !canExport) return;
    const csv = buildAuditRowsCsvV2(auditPayload);
    downloadFile(`AuditRows_${auditSku.sku}_${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8;");
  };

  if (!productsLoaded) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F4F9F6] text-sm text-slate-600">Đang tải dữ liệu hồ sơ…</div>;
  }

  if (!selectedProduct || !auditSku || !auditPayload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F9F6] p-6">
        <Card className="max-w-xl border-amber-200 bg-amber-50"><CardContent className="flex gap-3 p-6 text-sm text-amber-950"><AlertTriangle className="h-5 w-5 shrink-0" /><div><b>Chưa thể lập Audit/Evidence Pack.</b><p className="mt-1">Tài khoản chưa có sản phẩm thật. Hệ thống không dùng dữ liệu demo thay thế trong màn hình production.</p></div></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F9F6] text-slate-900">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-emerald-900/10 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-800 text-white shadow-sm">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-emerald-950">WeaveCarbon</span>
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                Pre-Audit Pack
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-emerald-200 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
              onClick={handleExportCsv}
              disabled={!canExport}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Tải CSV
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-800 text-xs font-semibold text-white hover:bg-emerald-900"
              onClick={handleExportJson}
              disabled={!canExport}
            >
              <Download className="h-3.5 w-3.5" />
              Tải JSON Pack
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="text-sm"><b>{dataReady ? "Dữ liệu đủ để xem xét nội bộ; chưa thể tải gói" : "Đang bị chặn phát hành"}</b><p className="mt-1">Đây chưa phải hồ sơ đảm bảo độc lập và chưa có liên kết chia sẻ được máy chủ ký/xác thực.</p>{auditPayload.blockers.map((blocker) => <p key={blocker} className="mt-1">• {blocker}</p>)}{dataReady ? <p className="mt-1">• Máy chủ chưa tạo manifest và bundle bất biến nên nút tải vẫn bị khóa.</p> : null}</div>
        </div>

        {/* Hero Card */}
        <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
          <div className="bg-emerald-900 px-6 py-5 text-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
                  HỒ SƠ TIỀN KIỂM TOÁN CARBON & CHỨNG TỪ TRUY VẾT
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">
                  {auditSku.name || "Sản phẩm Dệt may"} ({auditSku.sku})
                </h1>
                <p className="mt-1 text-xs text-emerald-100/90">
                  Cơ sở sản xuất: {auditSku.factory} • Địa chỉ: {auditSku.factoryAddress} • Mã HS: {auditSku.cnCode}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge className="border-white/30 bg-emerald-800 text-white">
                  Tham chiếu ISO 14067 · Chưa xác minh độc lập
                </Badge>
                <span className="text-[11px] text-emerald-200">
                  Cấp thẩm tra: {auditSku.verifier || "Chờ kiểm toán độc lập"}
                </span>
              </div>
            </div>
          </div>

          <CardContent className="p-6">
            {/* Product Selector if multiple products exist */}
            {products.length > 1 && (
              <div className="mb-6 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <span className="text-xs font-semibold text-slate-700">Chọn sản phẩm đối soát:</span>
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="h-9 w-[320px] rounded-lg border-slate-300 bg-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.productCode} - {p.productName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* KPI Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                <span className="text-xs font-semibold text-slate-600">Tổng PCF / Sản phẩm</span>
                <p className="mt-1 text-3xl font-extrabold text-emerald-900">
                  {formatNum(auditPayload.totals.total)}
                </p>
                <p className="text-xs text-slate-500">kg CO₂e/chiếc</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <span className="text-xs font-semibold text-slate-600">Nguyên phụ liệu (Scope 3)</span>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {formatNum(auditPayload.totals.materials)}
                </p>
                <p className="text-xs text-slate-500">kg CO₂e/chiếc</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <span className="text-xs font-semibold text-slate-600">Năng lượng & Điện (Scope 2)</span>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {formatNum(auditPayload.totals.energy)}
                </p>
                <p className="text-xs text-slate-500">kg CO₂e/chiếc</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <span className="text-xs font-semibold text-slate-600">Vận chuyển Logistics</span>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {formatNum(auditPayload.totals.transport)}
                </p>
                <p className="text-xs text-slate-500">kg CO₂e/chiếc</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Emission Breakdown Table */}
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Bảng Phân rã Phát thải Chi tiết (Activity Data & Emission Factors)
                </CardTitle>
                <CardDescription className="text-xs">
                  Cơ sở dữ liệu hệ số: {auditPayload.methodology}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/70 text-xs">
                  <TableHead className="py-3 font-semibold text-slate-700">Phân khúc</TableHead>
                  <TableHead className="font-semibold text-slate-700">Chi tiết hoạt động</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Khối lượng / Hoạt độ</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Hệ số (EF)</TableHead>
                  <TableHead className="font-semibold text-slate-700">Nguồn hệ số</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Phát thải (kg CO₂e)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {auditPayload.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                      Chưa có dữ liệu phân rã cho sản phẩm này.
                    </TableCell>
                  </TableRow>
                ) : (
                  auditPayload.rows.map((row, idx) => (
                    <TableRow key={idx} className={row.isDefault ? "bg-amber-50/40" : ""}>
                      <TableCell className="font-medium">{row.segment}</TableCell>
                      <TableCell>{row.detail}</TableCell>
                      <TableCell className="text-right font-mono">{formatNum(row.activity, 4)} {row.activityUnit}</TableCell>
                      <TableCell className="text-right font-mono">{formatNum(row.factor, 6)} {row.factorUnit}</TableCell>
                      <TableCell className="text-slate-600">{row.source}{row.factorVersionId ? <span className="block font-mono text-[10px]">{row.factorVersionId}</span> : null}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-emerald-950">
                        {formatNum(row.kgCo2e, 3)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                <TableRow className="bg-emerald-50/60 font-bold">
                  <TableCell colSpan={5} className="py-3 text-slate-900">
                    Tổng cộng PCF (Cradle-to-Gate)
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-emerald-900">
                    {formatNum(auditPayload.totals.total, 3)} kg CO₂e
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Evidence & Verification Section */}
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">
              Chứng từ Đối soát & Tính Toàn vẹn (Audit Evidence & Integrity Hashes)
            </CardTitle>
            <CardDescription className="text-xs">
              Mỗi tài liệu đính kèm được định danh bằng mã tra cứu và băm SHA-256 đối soát.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/70 text-xs">
                  <TableHead className="py-3 font-semibold text-slate-700">Loại tài liệu</TableHead>
                  <TableHead className="font-semibold text-slate-700">Tên chứng từ</TableHead>
                  <TableHead className="font-semibold text-slate-700">Mã tra cứu</TableHead>
                  <TableHead className="font-mono font-semibold text-slate-700">Mã băm SHA-256</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {auditPayload.evidence.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                      Chưa có chứng từ đính kèm.
                    </TableCell>
                  </TableRow>
                ) : (
                  auditPayload.evidence.map((ev, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-emerald-900">{ev.kind}</TableCell>
                      <TableCell className="font-semibold">{ev.fileName}</TableCell>
                      <TableCell className="font-mono text-slate-600">{ev.lookupCode}</TableCell>
                      <TableCell className="font-mono text-[11px] text-slate-500">
                        {ev.sha256}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
                          Đã duyệt + SHA-256
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Footer Disclaimer */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-sm">
          <p className="font-semibold text-slate-700">Tuyên bố miễn trừ & Chuẩn mực:</p>
          <p className="mt-1">
            Màn hình này là bản chuẩn bị dữ liệu nội bộ. Nó không phải chứng nhận, kết luận đảm bảo, hồ sơ hải quan đã
            chấp nhận hoặc bằng chứng đã được SGS/TÜV/Bureau Veritas xác minh. Chỉ chứng từ thật đã duyệt và có SHA-256
            mới được hiển thị; chức năng tải bị khóa cho đến khi máy chủ tạo và lưu manifest cùng bundle bất biến.
          </p>
        </div>
      </main>
    </div>
  );
}
