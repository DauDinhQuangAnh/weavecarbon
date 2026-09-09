"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Shield,
  Download,
  AlertTriangle,
  LoaderCircle,
  Copy,
  Link2,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DemoSkuV2 } from "@/lib/weave-v2/demoPackV2";
import {
  buildAuditPackPayloadV2,
  type AuditPackPayloadV2
} from "@/lib/weave-v2/auditPackV2";
import { fetchAllProducts, type ProductRecord } from "@/lib/productsApi";
import { getProductAuthoritativeCarbonV2, productToDemoSkuV2 } from "@/lib/weave-v2/productReportAdapter";
import { listProductEvidenceV2, type EvidenceDocumentV2 } from "@/lib/weave-v2/evidenceV2Api";
import {
  createAuditBundle,
  createAuditBundleAssuranceRecord,
  createAuditBundleShare,
  downloadAuditBundle,
  fetchAuditBundle,
  issueAuditBundle,
  reviewAuditBundle,
  revokeAuditBundleShare,
  type AuditAssuranceOutcome,
  type AuditBundleRecord,
  type AuditQaException,
  type CreatedAuditBundleShare
} from "@/lib/weave-v2/auditBundleApi";

const PAGE_LOAD_DATE = new Date().toISOString().slice(0, 10);
const COVERAGE_GAP_LABELS: Record<string, string> = {
  activity_evidence: "thiếu chứng từ hoạt động đúng loại",
  activity_evidence_term_mapping: "chưa gắn chứng từ hoạt động với số dòng tính",
  activity_evidence_period: "chứng từ hoạt động thiếu/sai kỳ báo cáo",
  factor_evidence: "thiếu tài liệu nguồn hệ số",
  factor_evidence_version_mapping: "tài liệu hệ số chưa khai báo đúng Factor Version ID",
  factor_evidence_period: "tài liệu hệ số thiếu/sai kỳ báo cáo"
};

const formatNum = (v: number | string | null | undefined, digits = 3) => {
  const num = typeof v === "number" ? v : parseFloat(String(v || 0));
  return Number.isFinite(num)
    ? new Intl.NumberFormat("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(num)
    : "—";
};

export default function AuditPackClient() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productEvidence, setProductEvidence] = useState<Record<string, EvidenceDocumentV2[]>>({});
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [auditBundle, setAuditBundle] = useState<AuditBundleRecord | null>(null);
  const [bundleBusy, setBundleBusy] = useState(false);
  const [bundleError, setBundleError] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [issueAssertion, setIssueAssertion] = useState("");
  const [issueCriteria, setIssueCriteria] = useState("");
  const [qaExceptions, setQaExceptions] = useState<AuditQaException[]>([]);
  const [signatureAcknowledged, setSignatureAcknowledged] = useState(false);
  const [shareLabel, setShareLabel] = useState("Đối tác kiểm toán");
  const [shareExpiresInHours, setShareExpiresInHours] = useState("168");
  const [shareMaxDownloads, setShareMaxDownloads] = useState("10");
  const [createdShare, setCreatedShare] = useState<CreatedAuditBundleShare | null>(null);
  const [actionNotice, setActionNotice] = useState("");
  const [assuranceOutcome, setAssuranceOutcome] = useState<AuditAssuranceOutcome>("requested");
  const [assuranceProvider, setAssuranceProvider] = useState("");
  const [assurancePractitioner, setAssurancePractitioner] = useState("");
  const [assuranceStandard, setAssuranceStandard] = useState("");
  const [assuranceScope, setAssuranceScope] = useState("");
  const [assuranceStatementDate, setAssuranceStatementDate] = useState("");
  const [assuranceValidTo, setAssuranceValidTo] = useState("");
  const [assuranceEvidenceId, setAssuranceEvidenceId] = useState("");

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

  const thirdPartyEvidence = useMemo(
    () => approvedEvidence.filter((item) => item.status === "third_party_verified"),
    [approvedEvidence]
  );

  const auditSku: DemoSkuV2 | null = useMemo(() => selectedProduct
    ? productToDemoSkuV2(selectedProduct, approvedEvidence)
    : null, [approvedEvidence, selectedProduct]);

  const auditPayload: AuditPackPayloadV2 | null = useMemo(() => auditSku
    ? buildAuditPackPayloadV2(auditSku, selectedProduct ? getProductAuthoritativeCarbonV2(selectedProduct) : null)
    : null, [auditSku, selectedProduct]);

  const dataReady = auditPayload?.status === "internal_review";
  const canCreateBundle = Boolean(dataReady && selectedProduct);
  const assuranceNeedsEvidence = !["requested", "withdrawn"].includes(assuranceOutcome);
  const parsedShareExpiry = Number(shareExpiresInHours);
  const parsedShareDownloadLimit = Number(shareMaxDownloads);
  const shareInputsValid = Number.isInteger(parsedShareExpiry)
    && parsedShareExpiry >= 1 && parsedShareExpiry <= 720
    && Number.isInteger(parsedShareDownloadLimit)
    && parsedShareDownloadLimit >= 1 && parsedShareDownloadLimit <= 100;

  useEffect(() => {
    if (!auditBundle || auditBundle.status !== "processing") return;
    let cancelled = false;
    const interval = window.setInterval(() => {
      void fetchAuditBundle(auditBundle.id)
        .then((next) => {
          if (!cancelled) setAuditBundle(next);
        })
        .catch((error: unknown) => {
          if (!cancelled) setBundleError(error instanceof Error ? error.message : "Không thể kiểm tra trạng thái Audit Pack.");
        });
    }, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [auditBundle]);

  const handleAuditBundle = async () => {
    if (!selectedProduct || !canCreateBundle || bundleBusy) return;
    setBundleBusy(true);
    setBundleError("");
    try {
      if (auditBundle?.status === "completed") {
        await downloadAuditBundle(auditBundle);
      } else {
        setAuditBundle(await createAuditBundle(selectedProduct.id));
      }
    } catch (error) {
      setBundleError(error instanceof Error ? error.message : "Không thể tạo Audit Pack.");
    } finally {
      setBundleBusy(false);
    }
  };

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    setAuditBundle(null);
    setBundleError("");
    setReviewNotes("");
    setIssueAssertion("");
    setIssueCriteria("");
    setQaExceptions([]);
    setSignatureAcknowledged(false);
    setCreatedShare(null);
    setActionNotice("");
    setAssuranceEvidenceId("");
  };

  const refreshBundle = async () => {
    if (!auditBundle) return;
    setAuditBundle(await fetchAuditBundle(auditBundle.id));
  };

  const handleReview = async (decision: "approved" | "rejected") => {
    if (!auditBundle || auditBundle.status !== "completed" || bundleBusy) return;
    setBundleBusy(true);
    setBundleError("");
    try {
      await reviewAuditBundle(auditBundle.id, {
        decision,
        notes: reviewNotes || undefined,
        qaExceptions
      });
      await refreshBundle();
    } catch (error) {
      setBundleError(error instanceof Error ? error.message : "Không thể ghi nhận kết quả rà soát.");
    } finally {
      setBundleBusy(false);
    }
  };

  const handleIssue = async () => {
    if (!auditBundle || auditBundle.lifecycleStatus !== "ready" || bundleBusy || !signatureAcknowledged) return;
    setBundleBusy(true);
    setBundleError("");
    try {
      await issueAuditBundle(auditBundle.id, {
        assertion: issueAssertion,
        criteria: issueCriteria,
        signatureAcknowledged: true
      });
      await refreshBundle();
    } catch (error) {
      setBundleError(error instanceof Error ? error.message : "Không thể phát hành Audit Pack nội bộ.");
    } finally {
      setBundleBusy(false);
    }
  };

  const updateQaException = (index: number, patch: Partial<AuditQaException>) => {
    setQaExceptions((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item
    ));
  };

  const handleCreateShare = async () => {
    if (!auditBundle?.issuance?.signatureValid || bundleBusy || !shareInputsValid) return;
    setBundleBusy(true);
    setBundleError("");
    setActionNotice("");
    try {
      const share = await createAuditBundleShare(auditBundle.id, {
        label: shareLabel.trim() || undefined,
        expiresInHours: parsedShareExpiry,
        maxDownloads: parsedShareDownloadLimit
      });
      setCreatedShare(share);
      await refreshBundle();
      setActionNotice("Link chỉ hiển thị đầy đủ một lần. Hãy sao chép và gửi qua kênh an toàn.");
    } catch (error) {
      setBundleError(error instanceof Error ? error.message : "Không thể tạo link chia sẻ.");
    } finally {
      setBundleBusy(false);
    }
  };

  const handleCopyShare = async () => {
    if (!createdShare || typeof window === "undefined") return;
    const fullUrl = new URL(createdShare.shareUrl, window.location.origin).toString();
    await navigator.clipboard.writeText(fullUrl);
    setActionNotice("Đã sao chép link chia sẻ có hạn dùng.");
  };

  const handleRevokeShare = async (shareId: string) => {
    if (!auditBundle || bundleBusy) return;
    setBundleBusy(true);
    setBundleError("");
    try {
      await revokeAuditBundleShare(auditBundle.id, shareId);
      if (createdShare?.id === shareId) setCreatedShare(null);
      await refreshBundle();
      setActionNotice("Đã thu hồi link chia sẻ.");
    } catch (error) {
      setBundleError(error instanceof Error ? error.message : "Không thể thu hồi link chia sẻ.");
    } finally {
      setBundleBusy(false);
    }
  };

  const handleRecordAssurance = async () => {
    if (!auditBundle?.issuance?.signatureValid || bundleBusy) return;
    setBundleBusy(true);
    setBundleError("");
    try {
      await createAuditBundleAssuranceRecord(auditBundle.id, {
        outcome: assuranceOutcome,
        providerName: assuranceProvider.trim(),
        practitionerName: assurancePractitioner.trim() || undefined,
        standard: assuranceStandard.trim() || undefined,
        scope: assuranceScope.trim(),
        statementDate: assuranceNeedsEvidence ? assuranceStatementDate : undefined,
        validTo: assuranceValidTo || undefined,
        evidenceDocumentId: assuranceNeedsEvidence ? assuranceEvidenceId : undefined
      });
      await refreshBundle();
      setActionNotice("Đã ghi thêm một bản ghi assurance bất biến; chứng từ gốc không bị thay đổi.");
    } catch (error) {
      setBundleError(error instanceof Error ? error.message : "Không thể ghi nhận external assurance.");
    } finally {
      setBundleBusy(false);
    }
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
              size="sm"
              className="gap-1.5 bg-emerald-800 text-xs font-semibold text-white hover:bg-emerald-900"
              onClick={() => void handleAuditBundle()}
              disabled={!canCreateBundle || bundleBusy || auditBundle?.status === "processing"}
            >
              {bundleBusy || auditBundle?.status === "processing"
                ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                : <Download className="h-3.5 w-3.5" />}
              {auditBundle?.status === "completed" ? "Tải Audit Pack ZIP" :
                auditBundle?.status === "processing" ? "Đang tạo Audit Pack" : "Tạo Audit Pack"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="text-sm"><b>{dataReady ? "Dữ liệu đủ để tạo gói xem xét nội bộ" : "Đang bị chặn phát hành"}</b><p className="mt-1">Đây chưa phải hồ sơ đảm bảo độc lập. Link chia sẻ chỉ được tạo sau khi có review, phát hành và chữ ký platform hợp lệ.</p>{auditPayload.blockers.map((blocker) => <p key={blocker} className="mt-1">• {blocker}</p>)}{auditBundle?.status === "completed" ? <p className="mt-1">• Bundle v{auditBundle.version} đã được máy chủ khóa nội dung; SHA-256: <span className="font-mono">{auditBundle.bundleSha256}</span>.</p> : null}{auditBundle?.status === "failed" ? <p className="mt-1">• Tạo bundle thất bại: {auditBundle.errorMessage || "Không xác định"}</p> : null}{bundleError ? <p className="mt-1">• {bundleError}</p> : null}</div>
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
                  Trạng thái assurance: {auditBundle?.assuranceStatus || "not_verified"}
                </Badge>
                <span className="text-[11px] text-emerald-200">
                  Hồ sơ mới nhất: {auditBundle?.externalAssurance?.providerName || "Chưa có bản ghi external assurance"}
                </span>
              </div>
            </div>
          </div>

          <CardContent className="p-6">
            {/* Product Selector if multiple products exist */}
            {products.length > 1 && (
              <div className="mb-6 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <span className="text-xs font-semibold text-slate-700">Chọn sản phẩm đối soát:</span>
                <Select value={selectedProductId} onValueChange={handleProductChange}>
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
                  <TableHead className="w-12 py-3 font-semibold text-slate-700">#</TableHead>
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
                    <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                      Chưa có dữ liệu phân rã cho sản phẩm này.
                    </TableCell>
                  </TableRow>
                ) : (
                  auditPayload.rows.map((row, idx) => (
                    <TableRow key={idx} className={row.isDefault ? "bg-amber-50/40" : ""}>
                      <TableCell className="font-mono text-slate-500">{idx + 1}</TableCell>
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
                  <TableCell colSpan={6} className="py-3 text-slate-900">
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

        {auditBundle?.status === "completed" ? (
          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold text-slate-900">Rà soát và phát hành nội bộ</CardTitle>
              <CardDescription className="text-xs">
                Vòng đời hiện tại: {auditBundle.lifecycleStatus || "blocked"}. Phát hành nội bộ không thay đổi trạng thái đảm bảo “chưa xác minh”.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <b>Độ phủ bằng chứng theo phép tính:</b>{" "}
                {auditBundle.termEvidenceCoverage
                  ? `${auditBundle.termEvidenceCoverage.coveredTermCount}/${auditBundle.termEvidenceCoverage.termCount} dòng đầy đủ bằng chứng hoạt động, hệ số và kỳ báo cáo.`
                  : "Bundle cũ chưa có ma trận liên kết bằng chứng."}
                {auditBundle.termEvidenceCoverage?.status !== "complete" ? (
                  <div className="mt-1 text-amber-800">
                    <p>Chưa thể phát hành: cần tạo bundle mới sau khi bổ sung và khóa chứng từ còn thiếu.</p>
                    {auditBundle.termEvidenceCoverage?.terms
                      .filter((term) => term.status === "incomplete")
                      .slice(0, 10)
                      .map((term) => (
                        <p key={term.termKey} className="mt-1">
                          • Dòng {term.termIndex + 1} ({term.detail || term.stage}): {term.missing
                            .map((gap) => COVERAGE_GAP_LABELS[gap] || gap).join("; ")}.
                        </p>
                      ))}
                  </div>
                ) : null}
              </div>
              {auditBundle.latestReview ? (
                <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-700">
                  <b>Review gần nhất:</b> {auditBundle.latestReview.decision} — {auditBundle.latestReview.reviewerName || auditBundle.latestReview.reviewedBy}
                  {auditBundle.latestReview.reviewerEmail ? ` (${auditBundle.latestReview.reviewerEmail})` : ""}.
                  {auditBundle.latestReview.qaExceptions.length > 0 ? (
                    <p className="mt-1">Có {auditBundle.latestReview.qaExceptions.length} QA exception được đóng băng trong quyết định này.</p>
                  ) : null}
                </div>
              ) : null}

              {!auditBundle.issuance && auditBundle.lifecycleStatus !== "superseded" ? (
                <div className="space-y-4">
                  <div className="space-y-2 rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">QA exceptions có cấu trúc</p>
                        <p className="text-xs text-slate-500">Mỗi lần duyệt sẽ đóng băng toàn bộ danh sách hiện tại.</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setQaExceptions((current) => [...current, {
                          code: `QA-${current.length + 1}`,
                          message: "",
                          severity: "blocking",
                          status: "open"
                        }])}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Thêm lỗi
                      </Button>
                    </div>
                    {qaExceptions.map((item, index) => (
                      <div key={index} className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[120px_1fr_140px_120px_auto]">
                        <input
                          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs"
                          value={item.code}
                          maxLength={100}
                          placeholder="Mã lỗi"
                          onChange={(event) => updateQaException(index, { code: event.target.value })}
                        />
                        <input
                          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs"
                          value={item.message}
                          maxLength={1000}
                          placeholder="Mô tả lỗi/ngoại lệ"
                          onChange={(event) => updateQaException(index, { message: event.target.value })}
                        />
                        <select
                          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs"
                          value={item.severity || "blocking"}
                          onChange={(event) => updateQaException(index, { severity: event.target.value as "warning" | "blocking" })}
                        >
                          <option value="warning">Cảnh báo</option>
                          <option value="blocking">Chặn</option>
                        </select>
                        <select
                          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs"
                          value={item.status || "open"}
                          onChange={(event) => updateQaException(index, { status: event.target.value as "open" | "resolved" })}
                        >
                          <option value="open">Đang mở</option>
                          <option value="resolved">Đã xử lý</option>
                        </select>
                        <Button type="button" size="icon" variant="ghost" onClick={() => setQaExceptions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Textarea
                    value={reviewNotes}
                    onChange={(event) => setReviewNotes(event.target.value)}
                    placeholder="Ghi chú rà soát của người duyệt (không ghi nhận xác minh độc lập nếu chưa có)."
                    maxLength={5000}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" disabled={bundleBusy} onClick={() => void handleReview("rejected")}>Từ chối</Button>
                    <Button disabled={bundleBusy || qaExceptions.some((item) => !item.code.trim() || !item.message.trim())} onClick={() => void handleReview("approved")}>Duyệt nội bộ</Button>
                  </div>

                  <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                    <p className="text-sm font-semibold text-emerald-950">Tuyên bố và chữ ký phát hành</p>
                    <p className="text-xs text-emerald-900">Người phát hành phải khác người review gần nhất. Máy chủ ký Ed25519 vào đúng assertion, criteria, bundle hash, manifest hash, danh tính và thời điểm.</p>
                    <Textarea
                      value={issueAssertion}
                      onChange={(event) => setIssueAssertion(event.target.value)}
                      placeholder="Tuyên bố nội bộ đi kèm hồ sơ"
                      maxLength={5000}
                    />
                    <Textarea
                      value={issueCriteria}
                      onChange={(event) => setIssueCriteria(event.target.value)}
                      placeholder="Tiêu chí/phương pháp rà soát và phiên bản áp dụng"
                      maxLength={5000}
                    />
                    <label className="flex items-start gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4"
                        checked={signatureAcknowledged}
                        onChange={(event) => setSignatureAcknowledged(event.target.checked)}
                      />
                      Tôi xác nhận phát hành assertion này với danh tính tài khoản hiện tại. Đây là platform attestation nội bộ, không phải chữ ký số đủ điều kiện hoặc kết luận assurance độc lập.
                    </label>
                    <Button
                      disabled={bundleBusy || auditBundle.lifecycleStatus !== "ready" || !issueAssertion.trim() || !issueCriteria.trim() || !signatureAcknowledged}
                      onClick={() => void handleIssue()}
                    >
                      Phát hành nội bộ có chữ ký
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-950">
                  {auditBundle.lifecycleStatus === "superseded" ? (
                    <p>Bundle này đã được phiên bản mới thay thế; các link cũ tự động hết hiệu lực.</p>
                  ) : (
                    <>
                      <p><b>Đã phát hành nội bộ:</b> {auditBundle.issuance?.issuedAt || "—"} bởi {auditBundle.issuance?.signerName || auditBundle.issuance?.issuedBy || "—"}.</p>
                      <p className="mt-1"><b>Chữ ký platform:</b> {auditBundle.issuance?.signatureValid ? "Hợp lệ" : "Thiếu/không hợp lệ"} · {auditBundle.issuance?.signatureAlgorithm || "legacy unsigned"}</p>
                      {auditBundle.issuance?.signaturePayloadSha256 ? <p className="mt-1 break-all font-mono">Payload SHA-256: {auditBundle.issuance.signaturePayloadSha256}</p> : null}
                    </>
                  )}
                </div>
              )}

              {auditBundle.issuance?.signatureValid && auditBundle.lifecycleStatus === "issued" ? (
                <div className="space-y-4 border-t border-slate-200 pt-5">
                  <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Link2 className="h-4 w-4" /> Link chia sẻ chỉ đọc</p>
                      <p className="mt-1 text-xs text-slate-500">Token chỉ được trả về một lần; máy chủ chỉ lưu hash. Link hết hạn, giới hạn lượt tải và có thể thu hồi.</p>
                    </div>
                    <div className="grid gap-2 md:grid-cols-3">
                      <input className="h-9 rounded-md border border-slate-300 px-2 text-xs" value={shareLabel} maxLength={200} onChange={(event) => setShareLabel(event.target.value)} placeholder="Nhãn người nhận" />
                      <input className="h-9 rounded-md border border-slate-300 px-2 text-xs" type="number" min={1} max={720} value={shareExpiresInHours} onChange={(event) => setShareExpiresInHours(event.target.value)} placeholder="Số giờ hiệu lực" />
                      <input className="h-9 rounded-md border border-slate-300 px-2 text-xs" type="number" min={1} max={100} value={shareMaxDownloads} onChange={(event) => setShareMaxDownloads(event.target.value)} placeholder="Lượt tải tối đa" />
                    </div>
                    <Button size="sm" disabled={bundleBusy || !shareInputsValid} onClick={() => void handleCreateShare()}><Link2 className="mr-1 h-4 w-4" /> Tạo link có hạn dùng</Button>
                    {createdShare ? (
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                        <span className="break-all">{typeof window !== "undefined" ? new URL(createdShare.shareUrl, window.location.origin).toString() : createdShare.shareUrl}</span>
                        <Button type="button" size="sm" variant="outline" onClick={() => void handleCopyShare()}><Copy className="mr-1 h-3.5 w-3.5" /> Sao chép</Button>
                      </div>
                    ) : null}
                    {(auditBundle.shareLinks || []).map((share) => (
                      <div key={share.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                        <span>{share.label || "Không nhãn"} · hết hạn {share.expiresAt} · {share.downloadCount}/{share.maxDownloads ?? "∞"} lượt tải{share.revokedAt ? " · đã thu hồi" : ""}</span>
                        {!share.revokedAt ? <Button type="button" size="sm" variant="ghost" disabled={bundleBusy} onClick={() => void handleRevokeShare(share.id)}>Thu hồi</Button> : null}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">External assurance — bản ghi append-only</p>
                      <p className="mt-1 text-xs text-slate-500">WeaveCarbon không tự xác minh. Kết luận assurance chỉ được ghi khi có file third-party đã khóa, đúng sản phẩm và còn hiệu lực.</p>
                    </div>
                    {auditBundle.externalAssurance ? (
                      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                        <b>{auditBundle.externalAssurance.outcome}</b> — {auditBundle.externalAssurance.providerName}; phạm vi: {auditBundle.externalAssurance.scope}.
                      </div>
                    ) : null}
                    <div className="grid gap-2 md:grid-cols-2">
                      <select className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs" value={assuranceOutcome} onChange={(event) => setAssuranceOutcome(event.target.value as AuditAssuranceOutcome)}>
                        <option value="requested">Đã yêu cầu assurance</option>
                        <option value="evidence_received">Đã nhận statement — chưa kết luận</option>
                        <option value="limited_assurance">Limited assurance</option>
                        <option value="reasonable_assurance">Reasonable assurance</option>
                        <option value="qualified">Qualified</option>
                        <option value="adverse">Adverse</option>
                        <option value="withdrawn">Thu hồi kết luận trước</option>
                      </select>
                      <input className="h-9 rounded-md border border-slate-300 px-2 text-xs" value={assuranceProvider} maxLength={300} onChange={(event) => setAssuranceProvider(event.target.value)} placeholder="Tổ chức assurance" />
                      <input className="h-9 rounded-md border border-slate-300 px-2 text-xs" value={assurancePractitioner} maxLength={300} onChange={(event) => setAssurancePractitioner(event.target.value)} placeholder="Người hành nghề/phụ trách" />
                      <input className="h-9 rounded-md border border-slate-300 px-2 text-xs" value={assuranceStandard} maxLength={500} onChange={(event) => setAssuranceStandard(event.target.value)} placeholder="Chuẩn/criteria do bên assurance nêu" />
                    </div>
                    <Textarea value={assuranceScope} onChange={(event) => setAssuranceScope(event.target.value)} maxLength={5000} placeholder="Phạm vi assurance chính xác" />
                    {assuranceNeedsEvidence ? (
                      <div className="grid gap-2 md:grid-cols-3">
                        <input className="h-9 rounded-md border border-slate-300 px-2 text-xs" type="date" value={assuranceStatementDate} onChange={(event) => setAssuranceStatementDate(event.target.value)} />
                        <input className="h-9 rounded-md border border-slate-300 px-2 text-xs" type="date" value={assuranceValidTo} onChange={(event) => setAssuranceValidTo(event.target.value)} />
                        <select className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs" value={assuranceEvidenceId} onChange={(event) => setAssuranceEvidenceId(event.target.value)}>
                          <option value="">Chọn statement third-party đã xác minh</option>
                          {thirdPartyEvidence.map((evidence) => <option key={evidence.id} value={evidence.id}>{evidence.documentName}</option>)}
                        </select>
                      </div>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={bundleBusy || !assuranceProvider.trim() || !assuranceScope.trim() || (assuranceNeedsEvidence && (!assuranceStatementDate || !assuranceEvidenceId))}
                      onClick={() => void handleRecordAssurance()}
                    >
                      Ghi bản assurance mới
                    </Button>
                  </div>
                  {actionNotice ? <p className="text-xs text-emerald-800">{actionNotice}</p> : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {/* Footer Disclaimer */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-sm">
          <p className="font-semibold text-slate-700">Tuyên bố miễn trừ & Chuẩn mực:</p>
          <p className="mt-1">
            Màn hình này là bản chuẩn bị dữ liệu nội bộ. Nó không phải chứng nhận, kết luận đảm bảo, hồ sơ hải quan đã
            chấp nhận hoặc bằng chứng đã được SGS/TÜV/Bureau Veritas xác minh. Chỉ chứng từ thật đã duyệt và có SHA-256
            mới được hiển thị; chức năng tải chỉ mở sau khi máy chủ tạo, lưu và kiểm tra manifest cùng bundle bất biến.
            Chữ ký Ed25519 ở đây là platform attestation nội bộ; external assurance chỉ phản ánh bản ghi và statement đã gắn,
            không biến WeaveCarbon thành tổ chức chứng nhận.
          </p>
        </div>
      </main>
    </div>
  );
}
