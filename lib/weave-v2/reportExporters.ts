import { REPORT_TABS_V2, WEAVE_V2_COLORS } from "./reportTemplate";
import type { ReportPayloadV2 } from "./reportBuilder";
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

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const toSrgbByte = (value: number) => {
  const normalized = Math.max(0, Math.min(1, value));
  return clampByte(
    (normalized <= 0.0031308
      ? normalized * 12.92
      : 1.055 * normalized ** (1 / 2.4) - 0.055) * 255
  );
};

const oklchToRgb = (value: string) => {
  const match = value.match(/oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)(?:deg)?(?:\s*\/\s*([0-9.]+%?))?\s*\)/i);
  if (!match) return value;

  const l = match[1].endsWith("%") ? Number.parseFloat(match[1]) / 100 : Number.parseFloat(match[1]);
  const c = Number.parseFloat(match[2]);
  const h = Number.parseFloat(match[3]) * Math.PI / 180;
  const alphaRaw = match[4];
  const alpha =
    alphaRaw === undefined
      ? 1
      : alphaRaw.endsWith("%")
        ? Number.parseFloat(alphaRaw) / 100
        : Number.parseFloat(alphaRaw);
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b;
  const lCube = lPrime ** 3;
  const mCube = mPrime ** 3;
  const sCube = sPrime ** 3;
  const red = toSrgbByte(4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube);
  const green = toSrgbByte(-1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube);
  const blue = toSrgbByte(-0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube);

  return alpha >= 1 ? `rgb(${red}, ${green}, ${blue})` : `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const oklabToRgb = (value: string) => {
  const match = value.match(/oklab\(\s*([0-9.]+%?)\s+([-0-9.]+%?)\s+([-0-9.]+%?)(?:\s*\/\s*([0-9.]+%?))?\s*\)/i);
  if (!match) return value;

  const l = match[1].endsWith("%") ? Number.parseFloat(match[1]) / 100 : Number.parseFloat(match[1]);
  const a = match[2].endsWith("%") ? Number.parseFloat(match[2]) / 100 * 0.4 : Number.parseFloat(match[2]);
  const b = match[3].endsWith("%") ? Number.parseFloat(match[3]) / 100 * 0.4 : Number.parseFloat(match[3]);
  const alphaRaw = match[4];
  const alpha =
    alphaRaw === undefined
      ? 1
      : alphaRaw.endsWith("%")
        ? Number.parseFloat(alphaRaw) / 100
        : Number.parseFloat(alphaRaw);
  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b;
  const lCube = lPrime ** 3;
  const mCube = mPrime ** 3;
  const sCube = sPrime ** 3;
  const red = toSrgbByte(4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube);
  const green = toSrgbByte(-1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube);
  const blue = toSrgbByte(-0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube);

  return alpha >= 1 ? `rgb(${red}, ${green}, ${blue})` : `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const labToRgbFromChannels = (l: number, a: number, b: number, alpha = 1) => {
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const pivot = (channel: number) => {
    const cube = channel ** 3;
    return cube > 0.008856 ? cube : (channel - 16 / 116) / 7.787;
  };

  const xD50 = 0.96422 * pivot(fx);
  const yD50 = pivot(fy);
  const zD50 = 0.82521 * pivot(fz);
  const x = 0.9555766 * xD50 - 0.0230393 * yD50 + 0.0631636 * zD50;
  const y = -0.0282895 * xD50 + 1.0099416 * yD50 + 0.0210077 * zD50;
  const z = 0.0122982 * xD50 - 0.0204830 * yD50 + 1.3299098 * zD50;
  const red = toSrgbByte(3.2404542 * x - 1.5371385 * y - 0.4985314 * z);
  const green = toSrgbByte(-0.9692660 * x + 1.8760108 * y + 0.0415560 * z);
  const blue = toSrgbByte(0.0556434 * x - 0.2040259 * y + 1.0572252 * z);

  return alpha >= 1 ? `rgb(${red}, ${green}, ${blue})` : `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const labToRgb = (value: string) => {
  const match = value.match(/lab\(\s*([0-9.]+%?)\s+([-0-9.]+%?)\s+([-0-9.]+%?)(?:\s*\/\s*([0-9.]+%?))?\s*\)/i);
  if (!match) return value;

  const l = match[1].endsWith("%") ? Number.parseFloat(match[1]) : Number.parseFloat(match[1]);
  const a = match[2].endsWith("%") ? Number.parseFloat(match[2]) * 1.25 : Number.parseFloat(match[2]);
  const b = match[3].endsWith("%") ? Number.parseFloat(match[3]) * 1.25 : Number.parseFloat(match[3]);
  const alphaRaw = match[4];
  const alpha =
    alphaRaw === undefined
      ? 1
      : alphaRaw.endsWith("%")
        ? Number.parseFloat(alphaRaw) / 100
        : Number.parseFloat(alphaRaw);

  return labToRgbFromChannels(l, a, b, alpha);
};

const lchToRgb = (value: string) => {
  const match = value.match(/lch\(\s*([0-9.]+%?)\s+([0-9.]+%?)\s+([-0-9.]+)(?:deg)?(?:\s*\/\s*([0-9.]+%?))?\s*\)/i);
  if (!match) return value;

  const l = match[1].endsWith("%") ? Number.parseFloat(match[1]) : Number.parseFloat(match[1]);
  const c = match[2].endsWith("%") ? Number.parseFloat(match[2]) * 1.5 : Number.parseFloat(match[2]);
  const h = Number.parseFloat(match[3]) * Math.PI / 180;
  const alphaRaw = match[4];
  const alpha =
    alphaRaw === undefined
      ? 1
      : alphaRaw.endsWith("%")
        ? Number.parseFloat(alphaRaw) / 100
        : Number.parseFloat(alphaRaw);
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  return labToRgbFromChannels(l, a, b, alpha);
};

const normalizeCanvasColor = (value: string) =>
  value.includes("oklch(") ? oklchToRgb(value) :
  value.includes("oklab(") ? oklabToRgb(value) :
  value.includes("lch(") ? lchToRgb(value) :
  value.includes("lab(") ? labToRgb(value) :
  value;

const copyCanvasSafeStyles = (source: Element, target: Element) => {
  if (!(target instanceof HTMLElement || target instanceof SVGElement)) return;
  const computed = window.getComputedStyle(source);
  const style = (target as HTMLElement | SVGElement).style;
  style.color = normalizeCanvasColor(computed.color);
  style.backgroundColor = normalizeCanvasColor(computed.backgroundColor);
  style.borderTopColor = normalizeCanvasColor(computed.borderTopColor);
  style.borderRightColor = normalizeCanvasColor(computed.borderRightColor);
  style.borderBottomColor = normalizeCanvasColor(computed.borderBottomColor);
  style.borderLeftColor = normalizeCanvasColor(computed.borderLeftColor);
  style.outlineColor = normalizeCanvasColor(computed.outlineColor);
  style.textDecorationColor = normalizeCanvasColor(computed.textDecorationColor);
  style.fill = normalizeCanvasColor(computed.fill);
  style.stroke = normalizeCanvasColor(computed.stroke);
  if (
    computed.backgroundImage.includes("oklab(") ||
    computed.backgroundImage.includes("oklch(") ||
    computed.backgroundImage.includes("lab(") ||
    computed.backgroundImage.includes("lch(")
  ) {
    style.backgroundImage = "none";
  }
  style.boxShadow = "none";
  style.textShadow = "none";
};

const sanitizeCanvasClone = (sourceRoot: HTMLElement, clonedRoot: Element) => {
  copyCanvasSafeStyles(sourceRoot, clonedRoot);
  const sourceElements = Array.from(sourceRoot.querySelectorAll("*"));
  const clonedElements = Array.from(clonedRoot.querySelectorAll("*"));
  sourceElements.forEach((source, index) => {
    const cloned = clonedElements[index];
    if (cloned) {
      copyCanvasSafeStyles(source, cloned);
    }
  });
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

export const downloadReportPdfV2 = async (element: HTMLElement | null, sku: string) => {
  if (!element) return;

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf")
  ]);

  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: Math.max(2.5, Math.min(4, window.devicePixelRatio * 2 || 3)),
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    onclone: (_document, clonedElement) => {
      sanitizeCanvasClone(element, clonedElement);
    }
  });

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const imageWidth = pageWidth - margin * 2;
  const imageHeight = canvas.height * imageWidth / canvas.width;
  const pageContentHeight = pageHeight - margin * 2;
  const sourcePageHeight = Math.floor(canvas.width * pageContentHeight / imageWidth);
  let sourceY = 0;
  let pageIndex = 0;

  while (sourceY < canvas.height) {
    const sliceHeight = Math.min(sourcePageHeight, canvas.height - sourceY);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;
    const context = pageCanvas.getContext("2d");
    if (!context) break;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    context.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight
    );

    if (pageIndex > 0) {
      pdf.addPage();
    }
    const pageImageHeight = sliceHeight * imageWidth / canvas.width;
    pdf.addImage(
      pageCanvas.toDataURL("image/jpeg", 0.98),
      "JPEG",
      margin,
      margin,
      imageWidth,
      Math.min(pageImageHeight, pageContentHeight),
      undefined,
      "SLOW"
    );
    sourceY += sliceHeight;
    pageIndex += 1;
  }

  if (pageIndex === 0) {
    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.98),
      "JPEG",
      margin,
      margin,
      imageWidth,
      Math.min(imageHeight, pageContentHeight),
      undefined,
      "SLOW"
    );
  }

  pdf.save(`WEAVE_CARBON_TEMPLATE_v2_${sku}.pdf`);
};
