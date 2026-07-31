/**
 * "Báo cáo Chuẩn" / product passport PDF, built as a vector document from the
 * report payload (replaces the html2canvas screenshot approach — crisp, selectable,
 * small, and Vietnamese renders correctly via the embedded font).
 */
import type { jsPDF } from "jspdf";
import type { ReportPayloadV2 } from "@/lib/weave-v2/reportBuilder";
import {
  PDF,
  newPdf,
  loadPdfFonts,
  header,
  section,
  kpiRow,
  table,
  percentBars,
  paragraph,
  footers,
  type PdfColumn,
  type FontPair,
} from "./pdfTheme";

const num = (v: unknown, d = 3): string => {
  const x = Number(v);
  return Number.isFinite(x) ? x.toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";
};
const str = (v: unknown): string => (v == null ? "" : String(v));

/** Draw the standard report into an existing (font-registered) jsPDF document. */
export function buildStandardReportPdf(doc: jsPDF, payload: ReportPayloadV2): void {
  const sku = payload.sku;
  let y = header(
    doc,
    `Hộ chiếu Sản phẩm — ${str(sku.name)}`,
    `SKU ${str(sku.sku)} · Mã CN ${str(sku.cnCode)} · ${str(payload.facility.name)}`,
    new Date(payload.generatedAt).toLocaleDateString("vi-VN"),
  );

  y = kpiRow(doc, y, [
    { label: "PCF / sản phẩm", value: num(payload.totals.pcfKgPerUnit, 2), unit: "kg CO₂e" },
    { label: "Tối ưu (tiềm năng)", value: num(payload.totals.optimalKgPerUnit, 2), unit: "kg CO₂e" },
    { label: "Rủi ro CBAM", value: num(payload.totals.cbamRiskEurPerUnit, 2), unit: "EUR/sản phẩm" },
    { label: "Cả lô hàng", value: num(payload.totals.batchTonnes, 3), unit: "tCO₂e" },
  ]);

  // ── Bóc tách PCF (ISO 14067) ──────────────────────────────────────────────
  y = section(doc, y, "Bóc tách phát thải theo giai đoạn (ISO 14067)");
  const bcols: PdfColumn<ReportPayloadV2["breakdownRows"][number]>[] = [
    { header: "Giai đoạn", width: 26, value: (r) => str(r.stage) },
    { header: "Hoạt động", width: 40, value: (r) => str(r.activity) },
    { header: "Lượng", width: 24, align: "right", value: (r) => `${num(r.amount, 2)} ${str(r.unit)}` },
    { header: "Nguồn", width: 34, value: (r) => str(r.source) },
    { header: "kg CO₂e", width: 22, align: "right", value: (r) => num(r.kgCo2e, 3), color: (r) => (r.isDefault ? PDF.red : PDF.ink) },
    { header: "Công thức", width: 36, value: (r) => str(r.formula) },
  ];
  y = table(doc, y, bcols, payload.breakdownRows, {
    footRow: ["Tổng PCF", "", "", "", `${num(payload.totals.pcfKgPerUnit, 3)}`, ""],
    emptyText: "Chưa có dữ liệu bóc tách.",
  });

  // ── Cơ cấu phát thải ──────────────────────────────────────────────────────
  y = section(doc, y, "Cơ cấu phát thải theo nhóm");
  y = percentBars(
    doc,
    y,
    payload.pieData.map((p) => ({ label: str(p.name), value: Number(p.value) || 0, color: str(p.color) })),
  );

  // ── ESG (TT 01/2022) ──────────────────────────────────────────────────────
  y = section(doc, y, "Phát thải theo Scope — ESG (TT 01/2022)");
  const ecols: PdfColumn<Record<string, string | number>>[] = [
    { header: "Phạm vi", width: 40, value: (r) => str(r.scope) },
    { header: "tCO₂e", width: 40, align: "right", value: (r) => num(r.tCO2e, 4) },
    { header: "Nguồn", width: 102, value: (r) => str(r.source) },
  ];
  y = table(doc, y, ecols, payload.esgRows, { emptyText: "Chưa có dữ liệu ESG." });

  // ── CBAM EU (DG TAXUD) ────────────────────────────────────────────────────
  y = section(doc, y, "Chỉ tiêu CBAM EU (DG TAXUD)");
  const ccols: PdfColumn<Record<string, string | number>>[] = [
    { header: "Trường", width: 70, value: (r) => str(r.field) },
    { header: "Giá trị", width: 70, align: "right", value: (r) => (typeof r.value === "number" ? num(r.value, 4) : str(r.value)) },
    { header: "Đơn vị", width: 42, value: (r) => str(r.unit) },
  ];
  y = table(doc, y, ccols, payload.cbamRows, { emptyText: "Chưa có dữ liệu CBAM." });

  // ── Chứng từ (Evidence) ───────────────────────────────────────────────────
  y = section(doc, y, "Chứng từ truy vết (Evidence)");
  const vcols: PdfColumn<ReportPayloadV2["evidence"][number]>[] = [
    { header: "Loại", width: 34, value: (r) => str(r.kind) },
    { header: "Tên tài liệu", width: 60, value: (r) => str(r.fileName) },
    { header: "Mã tra cứu", width: 40, value: (r) => str(r.lookupCode) },
    { header: "SHA-256", width: 48, value: (r) => str(r.sha256).slice(0, 24) + (str(r.sha256).length > 24 ? "…" : "") },
  ];
  y = table(doc, y, vcols, payload.evidence, { emptyText: "Chưa có chứng từ đính kèm.", fontSize: 7.5 });

  // ── Disclaimer ────────────────────────────────────────────────────────────
  y = section(doc, y, "Tuyên bố miễn trừ trách nhiệm");
  paragraph(
    doc,
    y,
    "Báo cáo tiền-thẩm tra (pre-audit) tạo tự động từ dữ liệu người dùng, không phải chứng nhận CBAM chính thức " +
      "và cần đơn vị thẩm tra độc lập để dùng trong giao dịch thương mại. " +
      `Nguồn hệ số: ${payload.sources.join(" · ")}.`,
  );

  footers(doc, "Phương pháp: ISO 14067:2018 · GHG Protocol · DEFRA 2024 · Ecoinvent v3.10 · WeaveCarbon");
}

/** Browser: fetch fonts, build, and trigger the download. */
export async function downloadStandardReportPdf(payload: ReportPayloadV2): Promise<void> {
  const fonts = await loadPdfFonts();
  const doc = await newPdf(fonts);
  buildStandardReportPdf(doc, payload);
  doc.save(`WeaveCarbon_HoChieu_${str(payload.sku.sku)}.pdf`);
}

/** Test/Node helper: build with explicitly-provided font bytes and return the document. */
export async function buildStandardReportPdfWithFonts(payload: ReportPayloadV2, fonts: FontPair): Promise<jsPDF> {
  const doc = await newPdf(fonts);
  buildStandardReportPdf(doc, payload);
  return doc;
}
