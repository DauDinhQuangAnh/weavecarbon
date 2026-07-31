import { WEAVE_V2_COLORS } from "./reportTemplate";
import type { ReportPayloadV2 } from "./reportBuilder";
import { downloadStandardReportPdf } from "@/lib/reports/standardReportPdf";
import { downloadStandardReportXlsx } from "@/lib/reports/standardReportXlsx";
import { csvField } from "@/lib/reports/csv";

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

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
  const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => csvField(row[column])).join(","))].join("\n");
  triggerDownload(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `WEAVE_CARBON_TEMPLATE_v2_${payload.sku.sku}.csv`);
};

/**
 * Product-passport / standard-report workbook — now built on the shared
 * excelTheme engine (see lib/reports/standardReportXlsx), consistent with the
 * PDF export, instead of the previous ad-hoc inline styling.
 */
export const downloadReportXlsxV2 = (payload: ReportPayloadV2) => downloadStandardReportXlsx(payload);

/**
 * Product-passport / standard-report PDF. Data-driven vector document
 * (see lib/reports/standardReportPdf) instead of an html2canvas screenshot —
 * crisp, selectable, small, with correct Vietnamese rendering.
 */
export const downloadReportPdfV2 = (payload: ReportPayloadV2) => downloadStandardReportPdf(payload);
