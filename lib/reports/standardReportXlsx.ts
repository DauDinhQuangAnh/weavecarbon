/**
 * "Báo cáo Chuẩn" / product passport as an Excel workbook, built on the shared
 * excelTheme engine (consistent with standardReportPdf). Replaces the ad-hoc
 * ExcelJS styling previously inline in reportExporters.downloadReportXlsxV2.
 */
import type { Workbook } from "exceljs";
import type { ReportPayloadV2 } from "@/lib/weave-v2/reportBuilder";
import {
  newBrandedWorkbook,
  addWorksheet,
  addTitleBlock,
  addKpiStrip,
  addKeyValueTable,
  addSectionBar,
  addDataTable,
  downloadWorkbook,
  THEME,
  type TemplateColumn,
} from "./excelTheme";

const KG3 = "#,##0.000";
const KG4 = "#,##0.0000";
const str = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function buildStandardReportWorkbook(payload: ReportPayloadV2): Promise<Workbook> {
  const wb = await newBrandedWorkbook();
  const sku = payload.sku;

  // ── Tổng quan ─────────────────────────────────────────────────────────────
  {
    const s = addWorksheet(wb, "Tổng quan");
    let r = addTitleBlock(
      s,
      `Hộ chiếu Sản phẩm — ${str(sku.name)}`,
      `SKU ${str(sku.sku)} · Mã CN ${str(sku.cnCode)} · ${str(payload.facility.name)}`,
      7,
      `ISO 14067:2018 · GHG Protocol · ${new Date(payload.generatedAt).toLocaleDateString("vi-VN")}`,
    );
    r = addKpiStrip(s, r, [
      { label: "PCF / sản phẩm", value: n(payload.totals.pcfKgPerUnit).toFixed(3), unit: "kg CO₂e" },
      { label: "Tối ưu", value: n(payload.totals.optimalKgPerUnit).toFixed(3), unit: "kg CO₂e" },
      { label: "Rủi ro CBAM", value: n(payload.totals.cbamRiskEurPerUnit).toFixed(2), unit: "EUR/SP" },
      { label: "Cả lô", value: n(payload.totals.batchTonnes).toFixed(3), unit: "tCO₂e" },
    ]);
    const cols: TemplateColumn<ReportPayloadV2["breakdownRows"][number]>[] = [
      { header: "Giai đoạn", width: 22, value: (b) => str(b.stage) },
      { header: "Hoạt động", width: 30, value: (b) => str(b.activity) },
      { header: "Lượng", width: 12, align: "right", numFmt: KG3, value: (b) => n(b.amount) },
      { header: "ĐVT", width: 10, value: (b) => str(b.unit) },
      { header: "Nguồn", width: 24, value: (b) => str(b.source) },
      { header: "kg CO₂e", width: 14, align: "right", numFmt: KG4, total: true, value: (b) => n(b.kgCo2e) },
      { header: "Công thức", width: 34, value: (b) => str(b.formula) },
    ];
    let rr = addDataTable(s, { startRow: r, columns: cols, rows: payload.breakdownRows, totalsLabel: "Tổng PCF", emptyText: "Chưa có dữ liệu." });

    // Boundary & disclosure (ISO 14067) — anti-greenwashing statement on the buyer document.
    rr = addSectionBar(s, rr, "Ranh giới hệ thống & Tuyên bố miễn trừ", 7);
    s.mergeCells(rr, 1, rr + 3, 7);
    const disc = s.getCell(rr, 1);
    disc.value =
      "PCF bán phần (partial CFP): cradle-to-gate + gate-to-market; LOẠI TRỪ giai đoạn sử dụng (B) và cuối vòng đời (C). " +
      "GHG được báo cáo tách biệt theo ISO 14067 (6.4.9): GWP-fossil = tổng PCF; GWP-biogenic (carbon sinh học lưu trữ trong gỗ) báo cáo RIÊNG, KHÔNG trừ vào tổng fossil; GWP-luluc chưa được mô hình hoá. " +
      "Chỉ số này không đại diện cho toàn bộ vòng đời sản phẩm và chưa được xác minh độc lập (not independently verified).";
    disc.font = { name: "Calibri", size: 11, italic: true, color: { argb: THEME.muted } };
    disc.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    for (let i = rr; i <= rr + 3; i++) s.getRow(i).height = 20;
  }

  // ── Cơ sở ─────────────────────────────────────────────────────────────────
  {
    const s = addWorksheet(wb, "Cơ sở");
    const r = addTitleBlock(s, "Hồ sơ cơ sở", "Thông tin cơ sở sản xuất", 3);
    addKeyValueTable(s, r, [
      { label: "Cơ sở", value: str(payload.facility.name), source: "facility" },
      { label: "Địa chỉ", value: str(payload.facility.address), source: "facility" },
      { label: "UN/LOCODE", value: str(payload.facility.unLocode), source: "facility" },
      { label: "SKU", value: str(sku.sku), source: "product" },
      { label: "Mã CN", value: str(sku.cnCode), source: "product" },
    ]);
    s.getColumn(1).width = 22;
    s.getColumn(2).width = 44;
    s.getColumn(3).width = 20;
  }

  // ── Chứng từ ──────────────────────────────────────────────────────────────
  {
    const s = addWorksheet(wb, "Chứng từ");
    const r = addTitleBlock(s, "Chứng từ truy vết (Evidence)", "Chứng từ gốc gắn với sản phẩm", 4);
    const cols: TemplateColumn<ReportPayloadV2["evidence"][number]>[] = [
      { header: "Loại", width: 24, value: (e) => str(e.kind) },
      { header: "Tên tài liệu", width: 40, value: (e) => str(e.fileName) },
      { header: "Mã tra cứu", width: 22, value: (e) => str(e.lookupCode) },
      { header: "SHA-256", width: 40, value: (e) => str(e.sha256) },
    ];
    addDataTable(s, { startRow: r, columns: cols, rows: payload.evidence, emptyText: "Chưa có chứng từ đính kèm." });
  }

  // ── ISO 14067 ─────────────────────────────────────────────────────────────
  {
    const s = addWorksheet(wb, "ISO 14067");
    const r = addTitleBlock(s, "Vết tính toán ISO 14067", "Chi tiết theo từng giai đoạn vòng đời", 6);
    const rows = payload.breakdownRows.map((b, i) => ({ ...b, idx: i + 1 }));
    const cols: TemplateColumn<(typeof rows)[number]>[] = [
      { header: "#", width: 6, align: "right", value: (b) => String(b.idx) },
      { header: "Giai đoạn", width: 22, value: (b) => str(b.stage) },
      { header: "Dữ liệu hoạt động", width: 22, align: "right", value: (b) => `${n(b.amount)} ${str(b.unit)}` },
      { header: "Nguồn hệ số", width: 26, value: (b) => str(b.source) },
      { header: "Công thức", width: 34, value: (b) => str(b.formula) },
      { header: "kg CO₂e", width: 14, align: "right", numFmt: KG4, total: true, value: (b) => n(b.kgCo2e) },
    ];
    addDataTable(s, { startRow: r, columns: cols, rows, totalsLabel: "Tổng", emptyText: "Chưa có dữ liệu." });
  }

  // ── ESG ───────────────────────────────────────────────────────────────────
  {
    const s = addWorksheet(wb, "ESG");
    const r = addTitleBlock(s, "Phát thải theo Scope — Kiểm kê KNK (TT 38/2023/TT-BCT)", "Scope 1 / 2 / 3", 3);
    const cols: TemplateColumn<Record<string, string | number>>[] = [
      { header: "Phạm vi", width: 20, value: (e) => str(e.scope) },
      { header: "tCO₂e", width: 16, align: "right", numFmt: KG4, value: (e) => n(e.tCO2e) },
      { header: "Nguồn", width: 50, value: (e) => str(e.source) },
    ];
    addDataTable(s, { startRow: r, columns: cols, rows: payload.esgRows, emptyText: "Chưa có dữ liệu ESG." });
  }

  // ── CBAM EU ───────────────────────────────────────────────────────────────
  {
    const s = addWorksheet(wb, "CBAM EU");
    const r = addTitleBlock(s, "Chỉ tiêu CBAM EU (DG TAXUD)", "Embedded emissions & mô phỏng rủi ro", 3);
    const cols: TemplateColumn<Record<string, string | number>>[] = [
      { header: "Trường", width: 40, value: (c) => str(c.field) },
      { header: "Giá trị", width: 26, align: "right", value: (c) => (typeof c.value === "number" ? n(c.value) : str(c.value)) },
      { header: "Đơn vị", width: 16, value: (c) => str(c.unit) },
    ];
    addDataTable(s, { startRow: r, columns: cols, rows: payload.cbamRows, emptyText: "Chưa có dữ liệu CBAM." });
  }

  return wb;
}

export async function downloadStandardReportXlsx(payload: ReportPayloadV2): Promise<void> {
  const wb = await buildStandardReportWorkbook(payload);
  await downloadWorkbook(wb, `WeaveCarbon_HoChieu_${str(payload.sku.sku)}.xlsx`);
}
