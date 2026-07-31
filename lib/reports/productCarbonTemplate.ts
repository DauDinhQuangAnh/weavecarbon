/**
 * Per-product carbon report (Excel), built on the shared excelTheme engine.
 * Replaces the raw SheetJS (json_to_sheet) export in SummaryClient.
 */
import type { Workbook } from "exceljs";
import {
  newBrandedWorkbook,
  addWorksheet,
  addTitleBlock,
  addKpiStrip,
  addKeyValueTable,
  addDataTable,
  downloadWorkbook,
  type TemplateColumn,
} from "./excelTheme";

export interface ProductCarbonBreakdownRow {
  stage: string;
  label: string;
  co2e: number;
  percentage?: number;
  hasData?: boolean;
  isProxy?: boolean;
  note?: string;
}

export interface ProductCarbonMaterialRow {
  material: string;
  percentage?: number;
  emissionFactor?: number;
  co2e: number;
  source?: string;
  factorSource?: string;
}

export interface ProductCarbonComplianceRow {
  criterion: string;
  status: string;
  note?: string;
}

export interface ProductCarbonReportInput {
  product: {
    id?: string;
    productCode?: string | null;
    productName?: string | null;
    productType?: string | null;
    status?: string | null;
    weightPerUnitG?: number | null;
    destinationMarket?: string | null;
  };
  totalCo2ePerUnit: number;
  confidenceLevel: string;
  confidenceScore: number;
  estimatedDistanceKm: number;
  quantity: number;
  generatedAt: Date;
  breakdown: ProductCarbonBreakdownRow[];
  materials: ProductCarbonMaterialRow[];
  compliance: ProductCarbonComplianceRow[];
}

const KG3 = "#,##0.000";
const NUM1 = "#,##0.0";
const yn = (v: boolean | undefined) => (v ? "Có" : "Không");

export async function buildProductCarbonWorkbook(data: ProductCarbonReportInput): Promise<Workbook> {
  const wb = await newBrandedWorkbook();
  const p = data.product;
  const qty = data.quantity > 0 ? data.quantity : 1;

  // ── Tổng quan ─────────────────────────────────────────────────────────────
  {
    const s = addWorksheet(wb, "Tổng quan");
    let r = addTitleBlock(
      s,
      "Báo cáo Dấu chân Carbon Sản phẩm",
      `${p.productName || p.productCode || "—"} · ${p.productCode || ""}`,
      8,
      `ISO 14067:2018 · GHG Protocol · Tạo ngày ${data.generatedAt.toLocaleDateString("vi-VN")}`,
    );

    r = addKpiStrip(s, r, [
      { label: "CO₂e / sản phẩm", value: data.totalCo2ePerUnit.toFixed(3), unit: "kg CO₂e" },
      { label: "CO₂e cả lô", value: (data.totalCo2ePerUnit * qty).toFixed(2), unit: "kg CO₂e" },
      { label: "Độ tin cậy", value: `${Math.round(data.confidenceScore)}%`, unit: data.confidenceLevel },
      { label: "Số lượng", value: qty.toLocaleString("vi-VN"), unit: "sản phẩm" },
    ]);

    addKeyValueTable(s, r, [
      { label: "Mã sản phẩm", value: p.productCode ?? "—", source: "products.code" },
      { label: "Tên sản phẩm", value: p.productName ?? "—", source: "products.name" },
      { label: "Loại sản phẩm", value: p.productType ?? "—", source: "products.type" },
      { label: "Trạng thái", value: p.status ?? "—", source: "products.status" },
      { label: "Khối lượng / đơn vị (g)", value: p.weightPerUnitG ?? "—", source: "products.weight" },
      { label: "Thị trường đích", value: p.destinationMarket ?? "—", source: "products.market" },
      { label: "Quãng đường ước tính (km)", value: data.estimatedDistanceKm || "—", source: "computed" },
      { label: "Mức tin cậy", value: data.confidenceLevel, source: "carbon.confidence" },
    ]);

    s.getColumn(1).width = 26;
    for (let c = 2; c <= 8; c++) s.getColumn(c).width = 16;
  }

  // ── Bóc tách ──────────────────────────────────────────────────────────────
  {
    const s = addWorksheet(wb, "Bóc tách");
    const r = addTitleBlock(s, "Bóc tách phát thải theo giai đoạn", "CO₂e/sản phẩm và cả lô, theo vòng đời (ISO 14067)", 8);
    const cols: TemplateColumn<ProductCarbonBreakdownRow>[] = [
      { header: "Giai đoạn", width: 18, value: (b) => b.stage },
      { header: "Hạng mục", width: 24, value: (b) => b.label },
      { header: "CO₂e/SP (kg)", width: 14, align: "right", numFmt: KG3, total: true, value: (b) => Number(b.co2e) || 0 },
      { header: "CO₂e/lô (kg)", width: 14, align: "right", numFmt: KG3, total: true, value: (b) => (Number(b.co2e) || 0) * qty },
      { header: "Tỷ trọng (%)", width: 12, align: "right", numFmt: NUM1, value: (b) => Number(b.percentage) || 0 },
      { header: "Có dữ liệu", width: 11, value: (b) => yn(b.hasData) },
      { header: "Dùng proxy", width: 11, value: (b) => yn(b.isProxy) },
      { header: "Ghi chú", width: 40, value: (b) => b.note ?? "" },
    ];
    addDataTable(s, { startRow: r, columns: cols, rows: data.breakdown, emptyText: "Chưa có bóc tách phát thải.", totalsLabel: "Tổng" });
  }

  // ── Vật liệu ──────────────────────────────────────────────────────────────
  {
    const s = addWorksheet(wb, "Vật liệu");
    const r = addTitleBlock(s, "Đóng góp phát thải theo vật liệu", "Hệ số phát thải và nguồn cho từng vật liệu", 7);
    const cols: TemplateColumn<ProductCarbonMaterialRow>[] = [
      { header: "Vật liệu", width: 26, value: (m) => m.material },
      { header: "Tỷ trọng (%)", width: 12, align: "right", numFmt: NUM1, value: (m) => Number(m.percentage) || 0 },
      { header: "EF (kg CO₂e/kg)", width: 15, align: "right", numFmt: KG3, value: (m) => Number(m.emissionFactor) || 0 },
      { header: "CO₂e/SP (kg)", width: 14, align: "right", numFmt: KG3, total: true, value: (m) => Number(m.co2e) || 0 },
      { header: "CO₂e/lô (kg)", width: 14, align: "right", numFmt: KG3, total: true, value: (m) => (Number(m.co2e) || 0) * qty },
      { header: "Nguồn", width: 16, value: (m) => m.source ?? "" },
      { header: "Nguồn hệ số", width: 30, value: (m) => m.factorSource ?? "" },
    ];
    addDataTable(s, { startRow: r, columns: cols, rows: data.materials, emptyText: "Chưa có dữ liệu vật liệu.", totalsLabel: "Tổng" });
  }

  // ── Tuân thủ ──────────────────────────────────────────────────────────────
  {
    const s = addWorksheet(wb, "Tuân thủ");
    const r = addTitleBlock(s, "Kiểm tra tuân thủ", "Tiêu chí phát thải / xuất khẩu và trạng thái", 3);
    const cols: TemplateColumn<ProductCarbonComplianceRow>[] = [
      { header: "Tiêu chí", width: 60, value: (c) => c.criterion },
      { header: "Trạng thái", width: 24, value: (c) => c.status },
      { header: "Ghi chú", width: 70, value: (c) => c.note ?? "" },
    ];
    addDataTable(s, { startRow: r, columns: cols, rows: data.compliance, emptyText: "Chưa có tiêu chí tuân thủ." });
  }

  return wb;
}

export async function downloadProductCarbonReport(data: ProductCarbonReportInput, fileBase: string): Promise<void> {
  const wb = await buildProductCarbonWorkbook(data);
  const datePart = data.generatedAt.toISOString().slice(0, 10);
  await downloadWorkbook(wb, `${fileBase || "carbon-report"}-${datePart}.xlsx`);
}
