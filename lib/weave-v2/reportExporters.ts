import { REPORT_TABS_V2, WEAVE_V2_COLORS } from "./reportTemplate";
import type { ReportPayloadV2 } from "./reportBuilder";
import { downloadStandardReportPdf } from "@/lib/reports/standardReportPdf";
import type { Cell, Row } from "exceljs";

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const csvEscape = (value: unknown) => {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  return /[",;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const stripHash = (value: string) => value.replace("#", "");

export const downloadReportCsvV2 = (payload: ReportPayloadV2) => {
  const rows: Array<Record<string, unknown>> = [
    ...payload.breakdownRows.map((row) => ({
      section: "pcf_breakdown",
      sku: payload.sku.sku,
      stage: row.stage,
      activity: row.activity,
      amount: row.amount,
      unit: row.unit,
      source: row.source,
      kg_co2e: row.kgCo2e.toFixed(4),
      formula: row.formula,
      color_hex: row.color,
      chart_series: row.stage
    })),
    ...payload.pieData.map((row) => ({
      section: "pie_chart",
      sku: payload.sku.sku,
      stage: row.name,
      activity: "Emission structure",
      amount: row.value,
      unit: "%",
      source: "report_payload",
      kg_co2e: "",
      formula: "stage kg CO2e / total kg CO2e",
      color_hex: row.color,
      chart_series: "pcf_structure"
    })),
    ...payload.cbamRows.map((row) => ({
      section: "cbam_eu",
      sku: payload.sku.sku,
      stage: row.field,
      activity: row.value,
      amount: "",
      unit: row.unit || "",
      source: "DG TAXUD CBAM",
      kg_co2e: "",
      formula: "",
      color_hex: WEAVE_V2_COLORS.formula,
      chart_series: "cbam"
    }))
  ];
  const columns = Object.keys(rows[0] || {});
  const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
  triggerDownload(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `WEAVE_CARBON_TEMPLATE_v2_${payload.sku.sku}.csv`);
};

const addTitle = (sheet: {
  mergeCells: (range: string) => void;
  getCell: (address: string) => Cell;
  getRow: (row: number) => Row;
}, title: string) => {
  sheet.mergeCells("A1:H1");
  const cell = sheet.getCell("A1");
  cell.value = title;
  cell.font = { color: { argb: "FFFFFFFF" }, bold: true, size: 14 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: stripHash(WEAVE_V2_COLORS.primary) } };
  cell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 28;
};

const styleHeaderRow = (row: Row) => {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: stripHash(WEAVE_V2_COLORS.secondary) } };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
};

export const downloadReportXlsxV2 = async (payload: ReportPayloadV2) => {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Weave Carbon";
  workbook.created = new Date();

  const overview = workbook.addWorksheet(REPORT_TABS_V2[0].sheetName);
  addTitle(overview, "WEAVE CARBON v2.0 - DAU CHAN CARBON SAN PHAM & TUAN THU ESG");
  overview.addRow([]);
  overview.addRow(["SKU", payload.sku.sku, "Product", payload.sku.name, "HS/CN", payload.sku.cnCode]);
  overview.addRow(["Total PCF", payload.totals.pcfKgPerUnit, "kg CO2e/pc", "Optimal", payload.totals.optimalKgPerUnit, "kg CO2e/pc"]);
  overview.addRow(["CBAM risk", payload.totals.cbamRiskEurPerUnit, "EUR/product", "Batch total", payload.totals.batchTonnes, "tCO2e"]);
  overview.addRow([]);
  overview.addRow(["Stage", "Activity", "Amount", "Unit", "Source", "kg CO2e", "Formula", "Color"]);
  styleHeaderRow(overview.getRow(7));
  payload.breakdownRows.forEach((item) => {
    overview.addRow([item.stage, item.activity, item.amount, item.unit, item.source, item.kgCo2e, item.formula, item.color]);
  });
  const totalRow = overview.addRow(["Tong", "", "", "", "", { formula: `SUM(F8:F${7 + payload.breakdownRows.length})`, result: payload.totals.pcfKgPerUnit }, "", WEAVE_V2_COLORS.secondary]);
  totalRow.font = { bold: true };
  totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEFE8" } };

  const input = workbook.addWorksheet(REPORT_TABS_V2[1].sheetName);
  addTitle(input, "NHAP LIEU SAN PHAM");
  input.addRow(["Field", "Value", "Source / Evidence", "SHA-256"]);
  styleHeaderRow(input.getRow(2));
  input.addRows([
    ["Facility", payload.facility.name, "Baseline onboarding", ""],
    ["Address", payload.facility.address, "Baseline onboarding", ""],
    ["UN/LOCODE", payload.facility.unLocode, "Customs reference", ""],
    ...payload.evidence.map((evidence) => [evidence.kind, evidence.fileName, evidence.lookupCode, evidence.sha256])
  ]);

  const iso = workbook.addWorksheet(REPORT_TABS_V2[2].sheetName);
  addTitle(iso, "ISO 14067 CALCULATION TRAIL");
  iso.addRow(["#", "Life-cycle stage", "Activity data", "Emission factor", "EF source", "Formula", "kg CO2e"]);
  styleHeaderRow(iso.getRow(2));
  payload.breakdownRows.forEach((row, index) => {
    iso.addRow([index + 1, row.stage, `${row.amount} ${row.unit}`, row.source, row.source, row.formula, row.kgCo2e]);
  });

  const esg = workbook.addWorksheet(REPORT_TABS_V2[3].sheetName);
  addTitle(esg, "ESG TT01/2022");
  esg.addRow(Object.keys(payload.esgRows[0] || {}));
  styleHeaderRow(esg.getRow(2));
  payload.esgRows.forEach((row) => esg.addRow(Object.values(row)));

  const cbam = workbook.addWorksheet(REPORT_TABS_V2[4].sheetName);
  addTitle(cbam, "CBAM EU - DG TAXUD");
  cbam.addRow(["Official tab", "Field", "Value", "Unit"]);
  styleHeaderRow(cbam.getRow(2));
  Object.entries(payload.officialCbamRows).forEach(([tab, rows]) => {
    rows.forEach((row) => {
      const values = Object.entries(row);
      if (values.length === 0) return;
      cbam.addRow([tab, values[0][0], values[0][1], row.unit || ""]);
      values.slice(1).forEach(([field, value]) => cbam.addRow([tab, field, value, row.unit || ""]));
    });
  });

  for (const sheet of workbook.worksheets) {
    sheet.columns.forEach((column) => {
      column.width = 22;
    });
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFD6E3DC" } },
          left: { style: "thin", color: { argb: "FFD6E3DC" } },
          bottom: { style: "thin", color: { argb: "FFD6E3DC" } },
          right: { style: "thin", color: { argb: "FFD6E3DC" } }
        };
        cell.alignment = { vertical: "middle", wrapText: true };
      });
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `WEAVE_CARBON_TEMPLATE_v2_${payload.sku.sku}.xlsx`
  );
};

/**
 * Product-passport / standard-report PDF. Now a data-driven vector document
 * (see lib/reports/standardReportPdf) instead of an html2canvas screenshot —
 * crisp, selectable, small, with correct Vietnamese rendering.
 */
export const downloadReportPdfV2 = (payload: ReportPayloadV2) => downloadStandardReportPdf(payload);
