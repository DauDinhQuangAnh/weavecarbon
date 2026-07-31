import type {
  Row,
  Workbook,
  Worksheet
} from "exceljs";
import { api } from "@/lib/apiClient";
import { THEME } from "@/lib/reports/excelTheme";

export type ReportDatasetType =
  | "products"
  | "activity"
  | "audit"
  | "users"
  | "history"
  | "analytics"
  | "company";

export type ExportFileFormat = "csv" | "xlsx";

export interface ReportExportSourceCounts {
  products: number;
  activity: number;
  audit: number;
  users: number;
  history: number;
}

export interface ExportDataResponse {
  success: boolean;
  data: {
    dataset_type: string;
    columns: string[];
    rows: Record<string, unknown>[];
    total: number;
  };
}

export interface ReportWorkbookOptions {
  locale?: string;
  requestedBy?: string | null;
  planLabel?: string | null;
  fileNamePrefix?: string;
}

type ColumnType = "number" | "date" | "boolean" | "json" | "text";

interface DatasetMeta {
  sheetName: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  title: string;
  description: string;
}

interface ColumnProfile {
  key: string;
  label: string;
  type: ColumnType;
  filledCount: number;
  completeness: number;
  examples: string[];
}

interface NumericInsight {
  column: string;
  count: number;
  min: number;
  max: number;
  average: number;
  sum: number;
}

interface DatasetAnalysis {
  rowCount: number;
  columnCount: number;
  completionRate: number;
  columnProfiles: ColumnProfile[];
  numericInsights: NumericInsight[];
}

const DEFAULT_SOURCE_COUNTS: ReportExportSourceCounts = {
  products: 0,
  activity: 0,
  audit: 0,
  users: 0,
  history: 0,
};

const EXPORTABLE_DATASETS: ReportDatasetType[] = [
  "products",
  "activity",
  "audit",
  "users",
  "analytics",
  "history",
  "company",
];

const FULL_REPORT_DATASETS: ReportDatasetType[] = [
  "products",
  "audit",
  "users",
  "analytics",
  "history",
];

// Every dataset shares the WeaveCarbon brand palette (single source of truth in
// excelTheme) so the full report matches the CBAM / passport / product reports.
const BRAND_META = { accent: THEME.brand, accentSoft: THEME.brandSoft, accentText: THEME.brandDark };

const DATASET_META: Record<ReportDatasetType, DatasetMeta> = {
  products: {
    sheetName: "Products",
    ...BRAND_META,
    title: "Product report",
    description: "Product catalog, emissions, quantities, and key product metrics.",
  },
  activity: {
    sheetName: "Activity",
    ...BRAND_META,
    title: "Activity report",
    description: "Operational events, actions, and activity stream details.",
  },
  audit: {
    sheetName: "Audit",
    ...BRAND_META,
    title: "Audit report",
    description: "Audit trail and system control records for traceability.",
  },
  users: {
    sheetName: "Users",
    ...BRAND_META,
    title: "User report",
    description: "User list, role mapping, and participation overview.",
  },
  history: {
    sheetName: "History",
    ...BRAND_META,
    title: "Calculation history report",
    description: "Historical carbon calculations, versions, and recalculation records.",
  },
  analytics: {
    sheetName: "Analytics",
    ...BRAND_META,
    title: "Analytics report",
    description: "Aggregate metrics, trends, and analytical breakdowns.",
  },
  company: {
    sheetName: "Company",
    ...BRAND_META,
    title: "Full company report",
    description: "Detailed standard-plan workbook across the main reporting datasets.",
  },
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const hasValue = (value: unknown) => {
  if (value === null || typeof value === "undefined") return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const toBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return null;
};

const stringifyValue = (value: unknown) => {
  if (value === null || typeof value === "undefined") return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? `${value}` : "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (Array.isArray(value) || isObject(value)) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const prettifyColumnName = (column: string) =>
  column
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

const sanitizeWorksheetName = (value: string) =>
  value.replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 31) || "Sheet";

const formatDateTime = (locale: string | undefined, value: Date) => {
  try {
    return new Intl.DateTimeFormat(locale || "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(value);
  } catch {
    return value.toISOString();
  }
};

const detectColumnType = (values: unknown[]): ColumnType => {
  const list = values.filter(hasValue);
  if (list.length === 0) return "text";
  if (list.every((value) => toNumber(value) !== null)) return "number";
  if (list.every((value) => toDate(value) !== null)) return "date";
  if (list.every((value) => toBoolean(value) !== null)) return "boolean";
  if (list.some((value) => Array.isArray(value) || isObject(value))) return "json";
  return "text";
};

const analyzeDataset = (columns: string[], rows: Record<string, unknown>[]): DatasetAnalysis => {
  const rowCount = rows.length;
  const columnCount = columns.length;
  const totalCells = Math.max(rowCount * Math.max(columnCount, 1), 1);
  let filledCells = 0;

  const columnProfiles = columns.map((column) => {
    const values = rows.map((row) => row[column]);
    const type = detectColumnType(values);
    const present = values.filter(hasValue);
    filledCells += present.length;
    const examples = Array.from(new Set(present.map((value) => stringifyValue(value)).filter(Boolean))).slice(0, 3);
    return {
      key: column,
      label: prettifyColumnName(column),
      type,
      filledCount: present.length,
      completeness: rowCount > 0 ? (present.length / rowCount) * 100 : 0,
      examples,
    } satisfies ColumnProfile;
  });

  const numericInsights = columnProfiles
    .filter((profile) => profile.type === "number")
    .map((profile) => {
      const values = rows
        .map((row) => toNumber(row[profile.key]))
        .filter((value): value is number => value !== null);
      if (values.length === 0) return null;
      const sum = values.reduce((acc, value) => acc + value, 0);
      return {
        column: profile.label,
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        average: sum / values.length,
        sum,
      } satisfies NumericInsight;
    })
    .filter((value): value is NumericInsight => value !== null);

  return {
    rowCount,
    columnCount,
    completionRate: (filledCells / totalCells) * 100,
    columnProfiles,
    numericInsights,
  };
};
const triggerBlobDownload = (blob: Blob, filename: string) => {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 60000);
};

const autoFitWorksheetColumns = (worksheet: Worksheet, maxWidth = 42) => {
  worksheet.columns?.forEach((column) => {
    let width = 14;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const text = stringifyValue(cell.value);
      width = Math.max(width, Math.min(text.length + 2, maxWidth));
    });
    column.width = width;
  });
};

const applyTitleBlock = (
  worksheet: Worksheet,
  title: string,
  subtitle: string,
  accent: string,
  totalColumns = 6
) => {
  const mergeEnd = Math.max(totalColumns, 6);
  worksheet.mergeCells(1, 1, 2, mergeEnd);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accent } };

  worksheet.mergeCells(3, 1, 3, mergeEnd);
  const subtitleCell = worksheet.getCell(3, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = { size: 10, italic: true, color: { argb: THEME.muted } };
};

const styleHeaderRow = (row: Row, accent: string) => {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accent } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: THEME.border } },
      left: { style: "thin", color: { argb: THEME.border } },
      bottom: { style: "thin", color: { argb: THEME.border } },
      right: { style: "thin", color: { argb: THEME.border } },
    };
  });
};

const styleBodyRow = (row: Row, isEven: boolean) => {
  row.eachCell((cell) => {
    cell.alignment = { vertical: "top", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: THEME.border } },
      left: { style: "thin", color: { argb: THEME.border } },
      bottom: { style: "thin", color: { argb: THEME.border } },
      right: { style: "thin", color: { argb: THEME.border } },
    };
    if (isEven) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.zebra } };
    }
  });
};

const addOverviewSheet = (
  workbook: Workbook,
  datasetType: ReportDatasetType,
  analysis: DatasetAnalysis,
  options: ReportWorkbookOptions
) => {
  const meta = DATASET_META[datasetType];
  const sheet = workbook.addWorksheet(sanitizeWorksheetName("Overview"));
  sheet.properties.tabColor = { argb: meta.accent };
  sheet.columns = Array.from({ length: 8 }, () => ({ width: 18 }));
  applyTitleBlock(sheet, meta.title, meta.description, meta.accent, 8);

  const cards = [
    ["Records", analysis.rowCount.toLocaleString(options.locale || "en-US")],
    ["Columns", analysis.columnCount.toLocaleString(options.locale || "en-US")],
    ["Completion", `${analysis.completionRate.toFixed(1)}%`],
    ["Generated", formatDateTime(options.locale, new Date())],
  ];

  cards.forEach(([label, value], index) => {
    const start = index * 2 + 1;
    sheet.mergeCells(5, start, 5, start + 1);
    sheet.mergeCells(6, start, 7, start + 1);
    const labelCell = sheet.getCell(5, start);
    labelCell.value = label;
    labelCell.font = { bold: true, color: { argb: meta.accentText } };
    labelCell.alignment = { vertical: "middle", horizontal: "center" };
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: meta.accentSoft } };
    const valueCell = sheet.getCell(6, start);
    valueCell.value = value;
    valueCell.font = { bold: true, size: 16, color: { argb: "0F172A" } };
    valueCell.alignment = { vertical: "middle", horizontal: "center" };
    valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF" } };
  });

  const detailRows = [
    ["Requested by", options.requestedBy || "-"],
    ["Plan", options.planLabel || "standard"],
    ["Dataset", meta.sheetName],
    ["Status", "Ready"],
    ["Generated by", "WeaveCarbon Reporting Engine"],
  ];

  let cursor = 10;
  detailRows.forEach(([label, value]) => {
    sheet.getCell(cursor, 1).value = label;
    sheet.getCell(cursor, 1).font = { bold: true, color: { argb: "334155" } };
    sheet.mergeCells(cursor, 2, cursor, 8);
    sheet.getCell(cursor, 2).value = value;
    sheet.getCell(cursor, 2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: cursor % 2 === 0 ? "F8FAFC" : "FFFFFF" },
    };
    cursor += 1;
  });
};

const addSummarySheet = (
  workbook: Workbook,
  datasetType: ReportDatasetType,
  analysis: DatasetAnalysis
) => {
  const meta = DATASET_META[datasetType];
  const sheet = workbook.addWorksheet(sanitizeWorksheetName(`${meta.sheetName} Summary`));
  sheet.properties.tabColor = { argb: meta.accent };
  applyTitleBlock(sheet, `${meta.title} - Summary`, "Quality checks and metric highlights", meta.accent, 6);

  const numericHeader = sheet.addRow(["Metric", "Count", "Min", "Max", "Average", "Sum"]);
  styleHeaderRow(numericHeader, meta.accent);

  if (analysis.numericInsights.length === 0) {
    const row = sheet.addRow(["No numeric fields", 0, 0, 0, 0, 0]);
    styleBodyRow(row, false);
  } else {
    analysis.numericInsights.slice(0, 12).forEach((insight, index) => {
      const row = sheet.addRow([
        insight.column,
        insight.count,
        insight.min,
        insight.max,
        insight.average,
        insight.sum,
      ]);
      styleBodyRow(row, index % 2 === 0);
    });
  }

  sheet.addRow([]);
  const profileHeader = sheet.addRow(["Field", "Type", "Filled", "Completion", "Examples", ""]);
  styleHeaderRow(profileHeader, meta.accent);

  analysis.columnProfiles.forEach((profile, index) => {
    const row = sheet.addRow([
      profile.label,
      profile.type,
      profile.filledCount,
      `${profile.completeness.toFixed(1)}%`,
      profile.examples.join(" | "),
      "",
    ]);
    styleBodyRow(row, index % 2 === 0);
  });

  autoFitWorksheetColumns(sheet);
};

const addDictionarySheet = (
  workbook: Workbook,
  datasetType: ReportDatasetType,
  analysis: DatasetAnalysis
) => {
  const meta = DATASET_META[datasetType];
  const sheet = workbook.addWorksheet(sanitizeWorksheetName(`${meta.sheetName} Dictionary`));
  sheet.properties.tabColor = { argb: meta.accent };
  applyTitleBlock(sheet, `${meta.title} - Dictionary`, "Field structure and completeness", meta.accent, 6);

  const header = sheet.addRow(["Field", "Type", "Filled", "Empty", "Completion", "Examples"]);
  styleHeaderRow(header, meta.accent);

  analysis.columnProfiles.forEach((profile, index) => {
    const row = sheet.addRow([
      profile.label,
      profile.type,
      profile.filledCount,
      Math.max(analysis.rowCount - profile.filledCount, 0),
      `${profile.completeness.toFixed(1)}%`,
      profile.examples.join(" | "),
    ]);
    styleBodyRow(row, index % 2 === 0);
  });

  autoFitWorksheetColumns(sheet);
};

const addDataSheet = (
  workbook: Workbook,
  datasetType: ReportDatasetType,
  columns: string[],
  rows: Record<string, unknown>[],
  analysis: DatasetAnalysis,
  subtitle: string
) => {
  const meta = DATASET_META[datasetType];
  const sheet = workbook.addWorksheet(sanitizeWorksheetName(`${meta.sheetName} Data`));
  sheet.properties.tabColor = { argb: meta.accent };
  applyTitleBlock(sheet, `${meta.title} - Data`, subtitle, meta.accent, Math.max(columns.length, 6));

  const headerRowIndex = 5;
  const header = sheet.getRow(headerRowIndex);
  columns.forEach((column, index) => {
    header.getCell(index + 1).value = prettifyColumnName(column);
  });
  styleHeaderRow(header, meta.accent);

  rows.forEach((sourceRow, rowIndex) => {
    const row = sheet.addRow(
      columns.map((column, columnIndex) => {
        const profile = analysis.columnProfiles[columnIndex];
        const value = sourceRow[column];
        if (profile?.type === "number") return toNumber(value) ?? stringifyValue(value);
        if (profile?.type === "date") return toDate(value) ?? stringifyValue(value);
        if (profile?.type === "boolean") {
          const booleanValue = toBoolean(value);
          return booleanValue === null ? stringifyValue(value) : booleanValue ? "Yes" : "No";
        }
        return stringifyValue(value);
      })
    );
    styleBodyRow(row, rowIndex % 2 === 0);

    columns.forEach((_, columnIndex) => {
      const profile = analysis.columnProfiles[columnIndex];
      const cell = row.getCell(columnIndex + 1);
      if (profile?.type === "number" && typeof cell.value === "number") {
        cell.numFmt = "#,##0.00";
        cell.alignment = { vertical: "top", horizontal: "right" };
      }
      if (profile?.type === "date" && cell.value instanceof Date) {
        cell.numFmt = "yyyy-mm-dd hh:mm";
      }
    });
  });

  sheet.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: Math.max(columns.length, 1) },
  };
  sheet.views = [{ state: "frozen", ySplit: headerRowIndex, xSplit: 0 }];
  sheet.columns = columns.map(() => ({ width: 16 }));
  autoFitWorksheetColumns(sheet);
};

export const buildSingleDatasetWorkbook = async (
  datasetType: ReportDatasetType,
  columns: string[],
  rows: Record<string, unknown>[],
  options: ReportWorkbookOptions = {}
) => {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "WeaveCarbon Reporting Engine";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const analysis = analyzeDataset(columns, rows);
  addOverviewSheet(workbook, datasetType, analysis, options);
  addSummarySheet(workbook, datasetType, analysis);
  addDictionarySheet(workbook, datasetType, analysis);
  addDataSheet(workbook, datasetType, columns, rows, analysis, `Records: ${analysis.rowCount}`);

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, analysis };
};

const buildFullCompanyWorkbook = async (
  datasets: Array<{ type: ReportDatasetType; columns: string[]; rows: Record<string, unknown>[] }>,
  options: ReportWorkbookOptions = {}
) => {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "WeaveCarbon Reporting Engine";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const enriched = datasets.map((dataset) => ({
    ...dataset,
    analysis: analyzeDataset(dataset.columns, dataset.rows),
  }));

  const overviewAnalysis = analyzeDataset(
    ["datasets", "records"],
    [{ datasets: enriched.length, records: enriched.reduce((sum, item) => sum + item.rows.length, 0) }]
  );

  addOverviewSheet(workbook, "company", overviewAnalysis, options);

  const summary = workbook.addWorksheet("Portfolio Summary");
  summary.properties.tabColor = { argb: DATASET_META.company.accent };
  applyTitleBlock(summary, DATASET_META.company.title, DATASET_META.company.description, DATASET_META.company.accent, 6);
  const summaryHeader = summary.addRow(["Report type", "Records", "Columns", "Completion", "Status", "Description"]);
  styleHeaderRow(summaryHeader, DATASET_META.company.accent);
  enriched.forEach((dataset, index) => {
    const meta = DATASET_META[dataset.type];
    const row = summary.addRow([
      meta.title,
      dataset.analysis.rowCount,
      dataset.analysis.columnCount,
      `${dataset.analysis.completionRate.toFixed(1)}%`,
      "Ready",
      meta.description,
    ]);
    styleBodyRow(row, index % 2 === 0);
  });
  autoFitWorksheetColumns(summary);

  const dictionary = workbook.addWorksheet("Global Dictionary");
  dictionary.properties.tabColor = { argb: DATASET_META.company.accent };
  applyTitleBlock(dictionary, "Global dictionary", "All fields across exported standard datasets", DATASET_META.company.accent, 7);
  const dictHeader = dictionary.addRow(["Report type", "Field", "Type", "Filled", "Empty", "Completion", "Examples"]);
  styleHeaderRow(dictHeader, DATASET_META.company.accent);
  let index = 0;
  enriched.forEach((dataset) => {
    dataset.analysis.columnProfiles.forEach((profile) => {
      const row = dictionary.addRow([
        DATASET_META[dataset.type].title,
        profile.label,
        profile.type,
        profile.filledCount,
        Math.max(dataset.analysis.rowCount - profile.filledCount, 0),
        `${profile.completeness.toFixed(1)}%`,
        profile.examples.join(" | "),
      ]);
      styleBodyRow(row, index % 2 === 0);
      index += 1;
    });
  });
  autoFitWorksheetColumns(dictionary);

  enriched.forEach((dataset) => {
    addDataSheet(
      workbook,
      dataset.type,
      dataset.columns,
      dataset.rows,
      dataset.analysis,
      `Records: ${dataset.analysis.rowCount}`
    );
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    buffer,
    total: enriched.reduce((sum, item) => sum + item.analysis.rowCount, 0),
  };
};
export const getDefaultReportExportSourceCounts = () => DEFAULT_SOURCE_COUNTS;

export const fetchReportExportSourceCounts = async (): Promise<ReportExportSourceCounts> => {
  try {
    const payload = await api.get<unknown>("/reports/export-sources");
    const data = isObject(payload) && isObject(payload.data)
      ? payload.data
      : isObject(payload)
        ? payload
        : {};

    return {
      products: Math.max(0, asNumber(data.products, 0)),
      activity: Math.max(0, asNumber(data.activity, 0)),
      audit: Math.max(0, asNumber(data.audit, 0)),
      users: Math.max(0, asNumber(data.users, 0)),
      history: Math.max(0, asNumber(data.history, 0)),
    };
  } catch (error) {
    console.error("Failed to fetch export source counts:", error);
    return { ...DEFAULT_SOURCE_COUNTS };
  }
};

export const fetchReportExportSourceCount = async (
  type: ReportDatasetType
): Promise<number> => {
  try {
    const payload = await api.get<unknown>(`/reports/export-sources/${type}`);
    const wrapper = isObject(payload) && isObject(payload.data)
      ? payload.data
      : isObject(payload)
        ? payload
        : {};

    return Math.max(
      0,
      asNumber(
        wrapper.count ??
        wrapper.total ??
        wrapper.records ??
        wrapper.record_count,
        0
      )
    );
  } catch {
    return 0;
  }
};

export const fetchExportData = async (type: ReportDatasetType): Promise<ExportDataResponse> => {
  const payload = await api.get<unknown>(`/reports/export-data/${type}`);
  if (!isObject(payload)) {
    throw new Error("Invalid export data response.");
  }

  const wrapper = isObject(payload.data) ? payload.data : payload;
  const columns = Array.isArray(wrapper.columns) ? (wrapper.columns as string[]) : [];
  const rows = Array.isArray(wrapper.rows) ? (wrapper.rows as Record<string, unknown>[]) : [];
  const total = asNumber(wrapper.total, rows.length);

  return {
    success: true,
    data: {
      dataset_type: typeof wrapper.dataset_type === "string" ? wrapper.dataset_type : type,
      columns,
      rows,
      total,
    },
  };
};

export const downloadAsCsv = (
  columns: string[],
  rows: Record<string, unknown>[],
  filename: string
) => {
  const escapeValue = (value: unknown) => {
    const text = stringifyValue(value).replace(/\r?\n/g, " ").trim();
    if (/[",;]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => escapeValue(row[column])).join(",")),
  ];

  const blob = new Blob(["\ufeff" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  triggerBlobDownload(blob, filename);
};

export const downloadAsXlsx = async (
  columns: string[],
  rows: Record<string, unknown>[],
  filename: string,
  sheetName: ReportDatasetType = "products",
  options: ReportWorkbookOptions = {}
) => {
  const normalized = EXPORTABLE_DATASETS.includes(sheetName) ? sheetName : "products";
  const { buffer } = await buildSingleDatasetWorkbook(normalized, columns, rows, options);
  triggerBlobDownload(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename
  );
};

export const exportDataset = async (
  type: ReportDatasetType,
  format: ExportFileFormat = "xlsx",
  options: ReportWorkbookOptions = {}
): Promise<{ total: number }> => {
  const response = await fetchExportData(type);
  const { columns, rows, total } = response.data;

  if (total === 0) {
    throw new Error(options.locale?.startsWith("vi") ? "Không có dữ liệu để xuất." : "No data available to export.");
  }

  const date = new Date().toISOString().split("T")[0];
  const filename = `${options.fileNamePrefix || type}_report_${date}.${format}`;

  if (format === "xlsx") {
    await downloadAsXlsx(columns, rows, filename, type, options);
  } else {
    downloadAsCsv(columns, rows, filename);
  }

  return { total };
};

export const exportFullStandardReport = async (
  format: ExportFileFormat = "xlsx",
  options: ReportWorkbookOptions = {}
): Promise<{ total: number; datasets: number }> => {
  if (format !== "xlsx") {
    throw new Error(
      options.locale?.startsWith("vi")
        ? "Báo cáo đầy đủ chỉ hỗ trợ XLSX."
        : "Full detailed report is available only in XLSX format."
    );
  }

  const settled = await Promise.allSettled(
    FULL_REPORT_DATASETS.map(async (type) => {
      const response = await fetchExportData(type);
      return {
        type,
        columns: response.data.columns,
        rows: response.data.rows,
      };
    })
  );

  const datasets = settled
    .filter((result): result is PromiseFulfilledResult<{ type: ReportDatasetType; columns: string[]; rows: Record<string, unknown>[] }> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((dataset) => dataset.rows.length > 0);

  if (datasets.length === 0) {
    throw new Error(
      options.locale?.startsWith("vi")
        ? "Không có dữ liệu chuẩn để tạo báo cáo đầy đủ."
        : "No standard datasets available for the full report."
    );
  }

  const { buffer, total } = await buildFullCompanyWorkbook(datasets, options);
  const date = new Date().toISOString().split("T")[0];
  const filename = `${options.fileNamePrefix || "standard_full"}_report_${date}.xlsx`;
  triggerBlobDownload(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename
  );

  return { total, datasets: datasets.length };
};
