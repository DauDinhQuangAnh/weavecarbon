/**
 * CBAM-style Excel report template.
 *
 * Consumes the data already computed on the CBAM page and renders a branded,
 * styled workbook via the shared excelTheme engine. Replaces the previous raw
 * SheetJS (`aoa_to_sheet`) export which had no formatting.
 */
import type { Workbook } from "exceljs";
import {
  THEME,
  newBrandedWorkbook,
  addWorksheet,
  addTitleBlock,
  addKpiStrip,
  addSectionBar,
  addKeyValueTable,
  addDataTable,
  downloadWorkbook,
  type TemplateColumn,
} from "./excelTheme";

export interface CbamElectricityRow {
  billing_period: string;
  facility_name: string;
  kwh: number;
  emission_factor_kg_per_kwh: number;
  emission_factor_source: string | null;
  scope2_co2e_kg: number;
  status: string;
}

export interface CbamFuelRow {
  billing_period: string;
  fuel_type: string;
  quantity_liters: number;
  emission_factor_kg_per_liter: number | null;
  scope1_co2e_kg: number | null;
  status: string;
}

export interface CbamProductRow {
  sku: string;
  name: string;
  weight: number;
  materials: string[];
  direct: number;
  indirect: number;
  total: number;
  embeddedPerTonne: number | null;
  proxyPct: number;
  confidence: number;
  hasCalc: boolean;
}

export interface CbamReportData {
  company: {
    name?: string;
    business_type?: string | null;
    address?: string | null;
    tax_id?: string | null;
    target_markets?: string[] | null;
  } | null;
  reportingPeriod: string;
  periodStart: string;
  periodEnd: string;
  electricity: CbamElectricityRow[];
  fuels: CbamFuelRow[];
  productSummary: CbamProductRow[];
  totals: { scope1: number; scope2: number; scope3: number; total: number; totalKwh: number };
  checks: { items: { ok: boolean; label: string }[]; score: number; total: number; pct: number };
  evidenceCount: number;
}

const NUM2 = "#,##0.00";
const NUM4 = "#,##0.0000";
const INT = "#,##0";

const fmtDate = () => new Date().toLocaleDateString("vi-VN");

/** Build the styled CBAM-style workbook (no DOM; safe to unit-test in Node). */
export async function buildCbamWorkbook(data: CbamReportData): Promise<Workbook> {
  const wb = await newBrandedWorkbook();
  const co = data.company;

  // ── Sheet 1: Tổng quan (cover) ────────────────────────────────────────────
  {
    const s = addWorksheet(wb, "Tổng quan");
    let r = addTitleBlock(
      s,
      "Báo cáo carbon cấu trúc CBAM",
      `${co?.name ?? "—"} · Kỳ ${data.reportingPeriod} (${data.periodStart} → ${data.periodEnd})`,
      8,
      `Cấu trúc phỏng theo EU CBAM communication template · Tạo ngày ${fmtDate()}`,
    );

    r = addKpiStrip(s, r, [
      { label: "Scope 1 (nhiên liệu)", value: data.totals.scope1.toFixed(1), unit: "kg CO₂e" },
      { label: "Scope 2 (điện lưới)", value: data.totals.scope2.toFixed(1), unit: "kg CO₂e" },
      { label: "Scope 3 (chuỗi cung ứng)", value: data.totals.scope3.toFixed(1), unit: "kg CO₂e" },
      { label: "Tổng phát thải", value: data.totals.total.toFixed(1), unit: "kg CO₂e" },
    ]);

    r = addSectionBar(s, r, `Mức độ hoàn chỉnh: ${data.checks.pct}%  (${data.checks.score}/${data.checks.total} mục)`, 8);
    const checkStart = r; // header row of the key/value table; data rows follow at checkStart+1+i
    r = addKeyValueTable(
      s,
      checkStart,
      data.checks.items.map((it) => ({
        label: it.label,
        value: it.ok ? "Đạt" : "Thiếu",
        source: it.ok ? "" : "cần bổ sung",
      })),
      false,
    );
    // Colour the status cells green/red.
    data.checks.items.forEach((it, i) => {
      const cell = s.getCell(checkStart + 1 + i, 2);
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: it.ok ? THEME.brand : THEME.red } };
    });

    r = addSectionBar(s, r, "Tuyên bố miễn trừ trách nhiệm", 8);
    s.mergeCells(r, 1, r + 2, 8);
    const disc = s.getCell(r, 1);
    disc.value =
      "Đây là báo cáo dữ liệu carbon tiền-thẩm tra (pre-audit) phục vụ chuẩn bị/ESG. " +
      "KHÔNG phải tờ khai CBAM và KHÔNG phải chứng nhận. Hàng dệt may hiện chưa thuộc phạm vi CBAM " +
      "(Quy định EU 2023/956); cấu trúc chỉ phỏng theo mẫu DG TAXUD. Cần đơn vị thẩm tra độc lập để dùng chính thức.";
    disc.font = { name: "Calibri", size: 8.5, italic: true, color: { argb: THEME.muted } };
    disc.alignment = { vertical: "top", horizontal: "left", wrapText: true };

    s.getColumn(1).width = 26;
    for (let c = 2; c <= 8; c++) s.getColumn(c).width = 16;
  }

  // ── Sheet 2: A. Cơ sở ─────────────────────────────────────────────────────
  {
    const s = addWorksheet(wb, "A. Cơ sở");
    const r = addTitleBlock(s, "A. Hồ sơ cơ sở (A_InstData)", "Thông tin cơ sở sản xuất và thị trường mục tiêu", 3);
    addKeyValueTable(s, r, [
      { label: "Tên doanh nghiệp", value: co?.name ?? "—", source: "companies.name" },
      { label: "Loại hình kinh doanh", value: co?.business_type ?? "—", source: "companies.business_type" },
      { label: "Địa chỉ nhà máy", value: co?.address ?? "Chưa cập nhật", source: "companies.address" },
      { label: "Mã số thuế / EORI", value: co?.tax_id ?? "Chưa cập nhật", source: "companies.tax_id" },
      { label: "Kỳ báo cáo", value: data.reportingPeriod, source: "selected" },
      { label: "Từ ngày", value: data.periodStart, source: "computed" },
      { label: "Đến ngày", value: data.periodEnd, source: "computed" },
      { label: "Thị trường mục tiêu", value: (co?.target_markets ?? []).join(", ") || "—", source: "companies.target_markets" },
    ]);
    s.getColumn(1).width = 24;
    s.getColumn(2).width = 46;
    s.getColumn(3).width = 26;
  }

  // ── Sheet 3: B. Điện (Scope 2) ────────────────────────────────────────────
  {
    const s = addWorksheet(wb, "B. Điện (Scope 2)");
    const r = addTitleBlock(s, "B. Hóa đơn điện — Scope 2", "Hệ số EVN (Bộ TN&MT). CO₂e = kWh × EF", 7);
    const cols: TemplateColumn<CbamElectricityRow>[] = [
      { header: "Kỳ", width: 12, value: (e) => e.billing_period },
      { header: "Cơ sở", width: 22, value: (e) => e.facility_name },
      { header: "kWh", width: 12, align: "right", numFmt: INT, total: true, value: (e) => Number(e.kwh) || 0 },
      { header: "EF (kg/kWh)", width: 12, align: "right", numFmt: NUM4, value: (e) => Number(e.emission_factor_kg_per_kwh) || 0 },
      { header: "Nguồn EF", width: 22, value: (e) => e.emission_factor_source ?? "EVN 2024" },
      { header: "CO₂e (kg)", width: 14, align: "right", numFmt: NUM2, total: true, value: (e) => Number(e.scope2_co2e_kg) || 0 },
      { header: "Trạng thái", width: 14, value: (e) => e.status },
    ];
    addDataTable(s, { startRow: r, columns: cols, rows: data.electricity, emptyText: "Chưa có hóa đơn điện.", totalsLabel: "Tổng" });
  }

  // ── Sheet 4: C. Nhiên liệu (Scope 1) ──────────────────────────────────────
  {
    const s = addWorksheet(wb, "C. Nhiên liệu (Scope 1)");
    const r = addTitleBlock(s, "C. Hóa đơn nhiên liệu — Scope 1", "Hệ số DEFRA 2024 / IPCC 2006", 6);
    const cols: TemplateColumn<CbamFuelRow>[] = [
      { header: "Kỳ", width: 12, value: (f) => f.billing_period },
      { header: "Loại nhiên liệu", width: 18, value: (f) => f.fuel_type },
      { header: "Lượng (L)", width: 14, align: "right", numFmt: "#,##0.0", total: true, value: (f) => Number(f.quantity_liters) || 0 },
      { header: "EF (kg/L)", width: 12, align: "right", numFmt: NUM4, value: (f) => (f.emission_factor_kg_per_liter == null ? null : Number(f.emission_factor_kg_per_liter)) },
      { header: "CO₂e (kg)", width: 14, align: "right", numFmt: NUM2, total: true, value: (f) => Number(f.scope1_co2e_kg) || 0 },
      { header: "Trạng thái", width: 14, value: (f) => f.status },
    ];
    addDataTable(s, { startRow: r, columns: cols, rows: data.fuels, emptyText: "Chưa có hóa đơn nhiên liệu.", totalsLabel: "Tổng" });
  }

  // ── Sheet 5: D. Sản phẩm (Embedded) ───────────────────────────────────────
  {
    const s = addWorksheet(wb, "D. Sản phẩm (Embedded)");
    const r = addTitleBlock(
      s,
      "D. Phát thải theo SKU (Embedded Emissions)",
      "Chỉ số CBAM cốt lõi: tCO₂e/tấn (phát thải trực tiếp). Direct = Scope 1+2 phân bổ · Indirect = Scope 3",
      11,
    );
    const cols: TemplateColumn<CbamProductRow>[] = [
      { header: "SKU", width: 16, value: (p) => p.sku },
      { header: "Tên sản phẩm", width: 26, value: (p) => p.name },
      { header: "Khối lượng (kg)", width: 13, align: "right", numFmt: NUM2, value: (p) => p.weight },
      { header: "Vật liệu", width: 24, value: (p) => p.materials.join(", ") },
      { header: "Direct (kg CO₂e)", width: 14, align: "right", numFmt: NUM2, total: true, value: (p) => +p.direct.toFixed(3) },
      { header: "Indirect (kg CO₂e)", width: 14, align: "right", numFmt: NUM2, total: true, value: (p) => +p.indirect.toFixed(3) },
      { header: "Tổng (kg CO₂e)", width: 14, align: "right", numFmt: NUM2, total: true, value: (p) => +p.total.toFixed(3) },
      { header: "Embedded (tCO₂e/tấn)", width: 16, align: "right", numFmt: NUM4, value: (p) => (p.embeddedPerTonne != null ? +p.embeddedPerTonne.toFixed(4) : null) },
      { header: "% Proxy", width: 10, align: "right", numFmt: INT, value: (p) => p.proxyPct },
      { header: "Confidence", width: 11, align: "right", numFmt: INT, value: (p) => p.confidence },
      { header: "Nguồn tính toán", width: 18, value: (p) => (p.hasCalc ? "Tính toán thực" : "Proxy (hệ số mặc định)") },
    ];
    addDataTable(s, { startRow: r, columns: cols, rows: data.productSummary, emptyText: "Chưa có sản phẩm.", totalsLabel: "Tổng" });
  }

  // ── Sheet 6: E. Tổng hợp ──────────────────────────────────────────────────
  {
    const s = addWorksheet(wb, "E. Tổng hợp");
    const r = addTitleBlock(s, "E. Chỉ tiêu tổng hợp (Summary)", "Bản tóm tắt gửi buyer / đơn vị thẩm tra", 3);
    addKeyValueTable(
      s,
      r,
      [
        { label: "Kỳ báo cáo", value: data.reportingPeriod, source: "" },
        { label: "Scope 1", value: `${data.totals.scope1.toFixed(2)} kg CO₂e`, source: "fuel_invoices" },
        { label: "Scope 2", value: `${data.totals.scope2.toFixed(2)} kg CO₂e`, source: "electricity_invoices" },
        { label: "Scope 3", value: `${data.totals.scope3.toFixed(2)} kg CO₂e`, source: "carbon_calculations" },
        { label: "Tổng phát thải", value: `${data.totals.total.toFixed(2)} kg CO₂e`, source: "computed" },
        { label: "Điện tiêu thụ", value: `${data.totals.totalKwh.toLocaleString("vi-VN")} kWh`, source: "electricity_invoices" },
        { label: "Số SKU", value: `${data.productSummary.length} sản phẩm`, source: "products" },
        { label: "Chứng từ tải lên", value: `${data.evidenceCount} tài liệu`, source: "evidence" },
        { label: "Mức hoàn chỉnh", value: `${data.checks.pct}% (${data.checks.score}/${data.checks.total})`, source: "checklist" },
      ],
    );
    s.getColumn(1).width = 22;
    s.getColumn(2).width = 30;
    s.getColumn(3).width = 24;
  }

  return wb;
}

/** Build and trigger a browser download of the CBAM-style workbook. */
export async function downloadCbamReport(data: CbamReportData): Promise<void> {
  const wb = await buildCbamWorkbook(data);
  const filename = `WeaveCarbon_CBAM_${data.reportingPeriod.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(wb, filename);
}
