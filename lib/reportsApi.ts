import type {
  Row,
  Workbook,
  Worksheet
} from "exceljs";
import { api } from "@/lib/apiClient";
import { THEME } from "@/lib/reports/excelTheme";
import { sanitizeCsvValue } from "@/lib/reports/csv";

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
  analytics?: number;
  company?: number;
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

const VIETNAMESE_DATASET_TITLES: Record<
  ReportDatasetType,
  { title: string; description: string; sheetName: string }
> = {
  products: {
    sheetName: "Sản phẩm",
    title: "Báo cáo Danh mục Sản phẩm & Phát thải",
    description: "Danh mục sản phẩm, định mức phát thải carbon, sản lượng và thông số kỹ thuật.",
  },
  activity: {
    sheetName: "Hoạt động",
    title: "Báo cáo Dòng Hoạt động Vận hành",
    description: "Nhật ký sự kiện vận hành, tác vụ người dùng và luồng hoạt động.",
  },
  audit: {
    sheetName: "Kiểm toán",
    title: "Báo cáo Nhật ký Kiểm toán & Dấu vết Tuân thủ",
    description: "Nhật ký kiểm toán hệ thống, kiểm soát truy cập và dấu vết tuân thủ.",
  },
  users: {
    sheetName: "Thành viên",
    title: "Báo cáo Danh sách & Vai trò Người dùng",
    description: "Danh sách thành viên, phân quyền truy cập và phân bổ phòng ban.",
  },
  history: {
    sheetName: "Lịch sử Tính",
    title: "Báo cáo Lịch sử Tính toán Phát thải",
    description: "Lịch sử các phiên tính toán carbon, phiên bản công thức và kết quả đối soát.",
  },
  analytics: {
    sheetName: "Phân tích",
    title: "Báo cáo Phân tích & Xu hướng Phát thải",
    description: "Chỉ số tổng hợp, xu hướng giảm phát thải và phân tích chuyên sâu.",
  },
  company: {
    sheetName: "Toàn diện",
    title: "Báo cáo Doanh nghiệp & Kiểm toán Toàn diện",
    description: "Tổng hợp toàn diện các phân hệ dữ liệu chuẩn WeaveCarbon theo tiêu chuẩn ISO 14067 & GHG Protocol.",
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

const BORDER_DARK = "12603A";      // Deep brand green for headers & card frames
const BORDER_GRID = "94A3B8";      // Crisp slate-400 border for table cells - clearly visible!

const formatExampleCell = (examples: unknown[]): string => {
  if (!examples || examples.length === 0) return "—";
  const cleaned = examples
    .map((e) => stringifyValue(e).trim())
    .filter(Boolean);
  if (cleaned.length === 0) return "—";

  const formatted = cleaned.slice(0, 3).map((item) => {
    // If an item is an overly long UUID, ISO date or hash string (e.g. 00000000-0000-4000-8000-000000000100)
    if (item.length > 24) {
      return item.slice(0, 20) + "...";
    }
    return item;
  });

  return formatted.join(" | ");
};

const autoFitWorksheetColumns = (worksheet: Worksheet) => {
  if (worksheet.name.includes("Tổng quan") || worksheet.name.includes("Overview")) {
    return; // Overview sheet has explicit custom column widths
  }

  worksheet.columns?.forEach((column) => {
    let maxLen = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      // Don't let title block (rows 1-4) distort column width
      if (Number(cell.row) <= 4) return;
      const text = stringifyValue(cell.value);
      const lines = text.split("\n");
      const lineLen = Math.max(...lines.map((l) => l.length));
      maxLen = Math.max(maxLen, lineLen);
    });

    // Clean proportional width with safe margins (+4) to prevent any text clipping
    const padded = Math.ceil(maxLen * 1.15) + 4;
    column.width = Math.max(16, Math.min(padded, 65));
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
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accent } };
  worksheet.getRow(1).height = 24;
  worksheet.getRow(2).height = 24;

  for (let c = 1; c <= mergeEnd; c++) {
    const c1 = worksheet.getCell(1, c);
    const c2 = worksheet.getCell(2, c);
    c1.border = { top: { style: "medium", color: { argb: BORDER_DARK } } };
    c2.border = { bottom: { style: "thin", color: { argb: BORDER_DARK } } };
  }

  worksheet.mergeCells(3, 1, 3, mergeEnd);
  const subtitleCell = worksheet.getCell(3, 1);
  subtitleCell.value = subtitle;
  subtitleCell.font = { name: "Calibri", size: 10.5, italic: true, color: { argb: THEME.muted } };
  subtitleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.brandSoft } };
  worksheet.getRow(3).height = 22;

  for (let c = 1; c <= mergeEnd; c++) {
    const c3 = worksheet.getCell(3, c);
    c3.border = { bottom: { style: "medium", color: { argb: THEME.brand } } };
  }
};

const styleHeaderRow = (row: Row, accent: string) => {
  row.height = 28;
  row.eachCell((cell) => {
    cell.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accent } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "medium", color: { argb: BORDER_DARK } },
      bottom: { style: "medium", color: { argb: BORDER_DARK } },
      left: { style: "thin", color: { argb: "FFFFFFFF" } },
      right: { style: "thin", color: { argb: "FFFFFFFF" } },
    };
  });
};

const styleBodyRow = (row: Row, isEven: boolean) => {
  row.height = 25;
  row.eachCell((cell) => {
    const isNum = typeof cell.value === "number";
    cell.alignment = {
      vertical: "middle",
      horizontal: isNum ? "right" : "left",
      indent: isNum ? 0 : 1,
      wrapText: false,
    };
    cell.font = { name: "Calibri", size: 10.5, color: { argb: THEME.ink } };
    cell.border = {
      top: { style: "thin", color: { argb: BORDER_GRID } },
      bottom: { style: "thin", color: { argb: BORDER_GRID } },
      left: { style: "thin", color: { argb: BORDER_GRID } },
      right: { style: "thin", color: { argb: BORDER_GRID } },
    };
    if (isEven) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.zebra } };
    } else {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
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
  const isVi = options.locale?.startsWith("vi");
  const sheet = workbook.addWorksheet(sanitizeWorksheetName(isVi ? "Tổng quan" : "Overview"));
  sheet.properties.tabColor = { argb: meta.accent };
  
  // Custom column widths for Overview: Col 1 has plenty of space (28), others 18-20
  sheet.columns = [
    { width: 28 }, // Col 1: Detail labels need 28 width
    { width: 18 }, // Col 2
    { width: 18 }, // Col 3
    { width: 18 }, // Col 4
    { width: 18 }, // Col 5
    { width: 18 }, // Col 6
    { width: 18 }, // Col 7
    { width: 18 }, // Col 8
  ];
  
  const title = isVi
    ? `WeaveCarbon · ${datasetType === "company" ? "Báo cáo Doanh nghiệp & Kiểm toán Toàn diện" : meta.title}`
    : `WeaveCarbon · ${meta.title}`;
  const subtitle = isVi
    ? (datasetType === "company" ? "Tổng hợp toàn diện danh mục sản phẩm, phát thải carbon, lịch sử tính toán và nhật ký kiểm toán hệ thống" : meta.description)
    : meta.description;

  applyTitleBlock(sheet, title, subtitle, meta.accent, 8);

  // Row 5-7: 4 KPI Cards
  const cards = isVi
    ? [
        { label: "Tổng bản ghi", value: analysis.rowCount, numFmt: "#,##0" },
        { label: "Số trường dữ liệu", value: analysis.columnCount, numFmt: "#,##0" },
        { label: "Độ hoàn thiện", value: analysis.completionRate / 100, numFmt: "0.0%" },
        { label: "Thời điểm tạo", value: formatDateTime(options.locale, new Date()), numFmt: undefined },
      ]
    : [
        { label: "Total Records", value: analysis.rowCount, numFmt: "#,##0" },
        { label: "Total Columns", value: analysis.columnCount, numFmt: "#,##0" },
        { label: "Completion Rate", value: analysis.completionRate / 100, numFmt: "0.0%" },
        { label: "Generated At", value: formatDateTime(options.locale, new Date()), numFmt: undefined },
      ];

  sheet.getRow(5).height = 24;
  sheet.getRow(6).height = 22;
  sheet.getRow(7).height = 22;

  cards.forEach((card, index) => {
    const start = index * 2 + 1;
    const end = start + 1;
    sheet.mergeCells(5, start, 5, end);
    sheet.mergeCells(6, start, 7, end);

    const labelCell = sheet.getCell(5, start);
    labelCell.value = card.label;
    labelCell.font = { name: "Calibri", bold: true, color: { argb: THEME.brandDark }, size: 10.5 };
    labelCell.alignment = { vertical: "middle", horizontal: "center" };
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.brandSoft } };

    const valueCell = sheet.getCell(6, start);
    valueCell.value = card.value;
    if (card.numFmt) {
      valueCell.numFmt = card.numFmt;
    }
    valueCell.font = { name: "Calibri", bold: true, size: 18, color: { argb: THEME.brandDark } };
    valueCell.alignment = { vertical: "middle", horizontal: "center" };
    valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

    // Set full perimeter border around the KPI card
    for (let c = start; c <= end; c++) {
      const topCell = sheet.getCell(5, c);
      topCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.brandSoft } };
      topCell.border = {
        top: { style: "medium", color: { argb: THEME.brand } },
        bottom: { style: "thin", color: { argb: THEME.brand } },
        left: c === start ? { style: "medium", color: { argb: THEME.brand } } : undefined,
        right: c === end ? { style: "medium", color: { argb: THEME.brand } } : undefined,
      };

      for (let r = 6; r <= 7; r++) {
        const valC = sheet.getCell(r, c);
        valC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        valC.border = {
          left: c === start ? { style: "medium", color: { argb: THEME.brand } } : undefined,
          right: c === end ? { style: "medium", color: { argb: THEME.brand } } : undefined,
          bottom: r === 7 ? { style: "medium", color: { argb: THEME.brand } } : undefined,
        };
      }
    }
  });

  // Section bar at Row 9
  sheet.mergeCells(9, 1, 9, 8);
  const sectionCell = sheet.getCell(9, 1);
  sectionCell.value = isVi
    ? "THÔNG TIN DOANH NGHIỆP & KIỂM SOÁT HỆ THỐNG"
    : "ENTERPRISE PROFILE & AUDIT CONTROLS";
  sectionCell.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  sectionCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.brand } };
  sectionCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(9).height = 26;

  for (let c = 1; c <= 8; c++) {
    const sC = sheet.getCell(9, c);
    sC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.brand } };
    sC.border = {
      top: { style: "medium", color: { argb: BORDER_DARK } },
      bottom: { style: "medium", color: { argb: BORDER_DARK } },
      left: c === 1 ? { style: "medium", color: { argb: BORDER_DARK } } : undefined,
      right: c === 8 ? { style: "medium", color: { argb: BORDER_DARK } } : undefined,
    };
  }

  const detailRows = isVi
    ? [
        ["Đơn vị yêu cầu xuất", options.requestedBy || "Doanh nghiệp thành viên WeaveCarbon"],
        ["Gói giải pháp áp dụng", options.planLabel ? `Gói ${options.planLabel}` : "Doanh nghiệp Tiêu chuẩn (Standard / Enterprise)"],
        ["Phân hệ báo cáo", datasetType === "company" ? "Báo cáo Doanh nghiệp & Kiểm toán Toàn diện (WeaveCarbon Verified)" : meta.title],
        ["Trạng thái kiểm toán", "Sẵn sàng & Đã niêm phong mật mã (Verified / Ready)"],
        ["Động cơ khởi tạo", "WeaveCarbon Trust Engine · Tiêu chuẩn ISO 14067 & GHG Protocol"],
      ]
    : [
        ["Requested by", options.requestedBy || "WeaveCarbon Member Company"],
        ["Plan", options.planLabel || "standard"],
        ["Dataset", meta.sheetName],
        ["Status", "Ready & Cryptographically Sealed"],
        ["Generated by", "WeaveCarbon Reporting Engine · ISO 14067 & GHG Protocol"],
      ];

  let cursor = 10;
  detailRows.forEach(([label, value], rIdx) => {
    const row = sheet.getRow(cursor);
    row.height = 25;

    const labelCell = sheet.getCell(cursor, 1);
    labelCell.value = label;
    labelCell.font = { name: "Calibri", bold: true, color: { argb: THEME.brandDark }, size: 10.5 };
    labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.brandSoft } };
    labelCell.border = {
      top: { style: "thin", color: { argb: BORDER_GRID } },
      bottom: { style: "thin", color: { argb: BORDER_GRID } },
      left: { style: "medium", color: { argb: THEME.brand } },
      right: { style: "thin", color: { argb: BORDER_GRID } },
    };

    sheet.mergeCells(cursor, 2, cursor, 8);
    const valueCell = sheet.getCell(cursor, 2);
    valueCell.value = value;
    valueCell.font = { name: "Calibri", size: 10.5, color: { argb: THEME.ink } };
    valueCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    const rowBg = rIdx % 2 === 0 ? "FFFFFFFF" : THEME.zebra;
    for (let c = 2; c <= 8; c++) {
      const vC = sheet.getCell(cursor, c);
      vC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
      vC.border = {
        top: { style: "thin", color: { argb: BORDER_GRID } },
        bottom: { style: "thin", color: { argb: BORDER_GRID } },
        left: c === 2 ? { style: "thin", color: { argb: BORDER_GRID } } : undefined,
        right: c === 8 ? { style: "medium", color: { argb: THEME.brand } } : undefined,
      };
    }

    cursor += 1;
  });

  // Table bottom border
  for (let c = 1; c <= 8; c++) {
    const bC = sheet.getCell(cursor - 1, c);
    const b = bC.border ? { ...bC.border } : {};
    b.bottom = { style: "medium", color: { argb: THEME.brand } };
    bC.border = b;
  }
};

const addSummarySheet = (
  workbook: Workbook,
  datasetType: ReportDatasetType,
  analysis: DatasetAnalysis,
  options: ReportWorkbookOptions = {}
) => {
  const meta = DATASET_META[datasetType];
  const isVi = options.locale?.startsWith("vi") ?? false;
  const viMeta = VIETNAMESE_DATASET_TITLES[datasetType];
  const sheetName = isVi ? `${viMeta.sheetName} - Tóm tắt` : `${meta.sheetName} Summary`;
  const sheet = workbook.addWorksheet(sanitizeWorksheetName(sheetName));
  sheet.properties.tabColor = { argb: meta.accent };
  
  const title = isVi ? `${viMeta.title} · Chỉ số tổng hợp` : `${meta.title} - Summary`;
  const subtitle = isVi ? "Kiểm tra chất lượng dữ liệu và các chỉ số thống kê định lượng" : "Quality checks and metric highlights";
  applyTitleBlock(sheet, title, subtitle, meta.accent, 6);

  const numericHeader = sheet.addRow(
    isVi
      ? ["Chỉ số định lượng", "Số lượng", "Giá trị nhỏ nhất", "Giá trị lớn nhất", "Giá trị trung bình", "Tổng cộng"]
      : ["Metric", "Count", "Min", "Max", "Average", "Sum"]
  );
  styleHeaderRow(numericHeader, meta.accent);

  if (analysis.numericInsights.length === 0) {
    const row = sheet.addRow(
      isVi
        ? ["Không có trường số", 0, 0, 0, 0, 0]
        : ["No numeric fields", 0, 0, 0, 0, 0]
    );
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
      const c2 = row.getCell(2);
      c2.numFmt = "#,##0";
      c2.alignment = { vertical: "middle", horizontal: "right" };
      for (let c = 3; c <= 6; c++) {
        const cell = row.getCell(c);
        cell.numFmt = "#,##0.00";
        cell.alignment = { vertical: "middle", horizontal: "right" };
      }
    });
  }

  sheet.addRow([]);
  const profileHeader = sheet.addRow(
    isVi
      ? ["Trường dữ liệu", "Kiểu dữ liệu", "Đã điền", "Độ hoàn thiện", "Dữ liệu mẫu", ""]
      : ["Field", "Type", "Filled", "Completion", "Examples", ""]
  );
  styleHeaderRow(profileHeader, meta.accent);

  analysis.columnProfiles.forEach((profile, index) => {
    const row = sheet.addRow([
      profile.label,
      profile.type,
      profile.filledCount,
      profile.completeness / 100,
      formatExampleCell(profile.examples),
      "",
    ]);
    styleBodyRow(row, index % 2 === 0);
    const c3 = row.getCell(3);
    c3.numFmt = "#,##0";
    c3.alignment = { vertical: "middle", horizontal: "right" };
    const c4 = row.getCell(4);
    c4.numFmt = "0.0%";
    c4.alignment = { vertical: "middle", horizontal: "right" };
  });

  autoFitWorksheetColumns(sheet);
};

const addDictionarySheet = (
  workbook: Workbook,
  datasetType: ReportDatasetType,
  analysis: DatasetAnalysis,
  options: ReportWorkbookOptions = {}
) => {
  const meta = DATASET_META[datasetType];
  const isVi = options.locale?.startsWith("vi") ?? false;
  const viMeta = VIETNAMESE_DATASET_TITLES[datasetType];
  const sheetName = isVi ? `${viMeta.sheetName} - Từ điển` : `${meta.sheetName} Dictionary`;
  const sheet = workbook.addWorksheet(sanitizeWorksheetName(sheetName));
  sheet.properties.tabColor = { argb: meta.accent };
  
  const title = isVi ? `${viMeta.title} · Từ điển dữ liệu` : `${meta.title} - Dictionary`;
  const subtitle = isVi ? "Cấu trúc trường dữ liệu, độ hoàn thiện và mô tả kiểu" : "Field structure and completeness";
  applyTitleBlock(sheet, title, subtitle, meta.accent, 6);

  const header = sheet.addRow(
    isVi
      ? ["Tên trường", "Kiểu dữ liệu", "Đã điền", "Còn trống", "Độ hoàn thiện", "Dữ liệu mẫu"]
      : ["Field", "Type", "Filled", "Empty", "Completion", "Examples"]
  );
  styleHeaderRow(header, meta.accent);

  analysis.columnProfiles.forEach((profile, index) => {
    const row = sheet.addRow([
      profile.label,
      profile.type,
      profile.filledCount,
      Math.max(analysis.rowCount - profile.filledCount, 0),
      profile.completeness / 100,
      formatExampleCell(profile.examples),
    ]);
    styleBodyRow(row, index % 2 === 0);
    const c3 = row.getCell(3);
    c3.numFmt = "#,##0";
    c3.alignment = { vertical: "middle", horizontal: "right" };
    const c4 = row.getCell(4);
    c4.numFmt = "#,##0";
    c4.alignment = { vertical: "middle", horizontal: "right" };
    const c5 = row.getCell(5);
    c5.numFmt = "0.0%";
    c5.alignment = { vertical: "middle", horizontal: "right" };
  });

  autoFitWorksheetColumns(sheet);
};

const addDataSheet = (
  workbook: Workbook,
  datasetType: ReportDatasetType,
  columns: string[],
  rows: Record<string, unknown>[],
  analysis: DatasetAnalysis,
  subtitle: string,
  options: ReportWorkbookOptions = {}
) => {
  const meta = DATASET_META[datasetType];
  const isVi = options.locale?.startsWith("vi") ?? false;
  const viMeta = VIETNAMESE_DATASET_TITLES[datasetType];
  const sheetName = isVi ? `${viMeta.sheetName} - Dữ liệu` : `${meta.sheetName} Data`;
  const sheet = workbook.addWorksheet(sanitizeWorksheetName(sheetName));
  sheet.properties.tabColor = { argb: meta.accent };
  
  const title = isVi ? `${viMeta.title} · Chi tiết Dữ liệu` : `${meta.title} - Data`;
  const sub = isVi ? `Tổng số bản ghi: ${analysis.rowCount.toLocaleString("vi-VN")}` : subtitle;
  applyTitleBlock(sheet, title, sub, meta.accent, Math.max(columns.length, 6));

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
          return booleanValue === null
            ? stringifyValue(value)
            : booleanValue
            ? isVi ? "Có" : "Yes"
            : isVi ? "Không" : "No";
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
  addSummarySheet(workbook, datasetType, analysis, options);
  addDictionarySheet(workbook, datasetType, analysis, options);
  addDataSheet(workbook, datasetType, columns, rows, analysis, `Records: ${analysis.rowCount}`, options);

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

  const isVi = options.locale?.startsWith("vi") ?? false;

  const enriched = datasets.map((dataset) => ({
    ...dataset,
    analysis: analyzeDataset(dataset.columns, dataset.rows),
  }));

  const overviewAnalysis = analyzeDataset(
    ["datasets", "records"],
    [{ datasets: enriched.length, records: enriched.reduce((sum, item) => sum + item.rows.length, 0) }]
  );

  addOverviewSheet(workbook, "company", overviewAnalysis, options);

  // Sheet 2: Portfolio Summary / Tóm tắt Danh mục
  const summarySheetName = isVi ? "Tóm tắt Danh mục" : "Portfolio Summary";
  const summary = workbook.addWorksheet(summarySheetName);
  summary.properties.tabColor = { argb: DATASET_META.company.accent };
  applyTitleBlock(
    summary,
    isVi ? "TỔNG HỢP DANH MỤC PHÂN HỆ DỮ LIỆU" : DATASET_META.company.title,
    isVi ? "Tỷ lệ hoàn thiện dữ liệu, số lượng bản ghi và trạng thái sẵn sàng theo từng phân hệ" : DATASET_META.company.description,
    DATASET_META.company.accent,
    6
  );
  const summaryHeader = summary.addRow(
    isVi
      ? ["Phân hệ báo cáo", "Số bản ghi", "Số cột dữ liệu", "Tỷ lệ hoàn thiện", "Trạng thái kiểm toán", "Mô tả phân hệ"]
      : ["Report type", "Records", "Columns", "Completion", "Status", "Description"]
  );
  styleHeaderRow(summaryHeader, DATASET_META.company.accent);
  enriched.forEach((dataset, index) => {
    const meta = DATASET_META[dataset.type];
    const viMeta = VIETNAMESE_DATASET_TITLES[dataset.type];
    const title = isVi ? viMeta.title : meta.title;
    const desc = isVi ? viMeta.description : meta.description;
    const row = summary.addRow([
      title,
      dataset.analysis.rowCount,
      dataset.analysis.columnCount,
      dataset.analysis.completionRate / 100,
      isVi ? "Đã sẵn sàng" : "Ready",
      desc,
    ]);
    styleBodyRow(row, index % 2 === 0);
    const c2 = row.getCell(2);
    c2.numFmt = "#,##0";
    c2.alignment = { vertical: "middle", horizontal: "right" };
    const c3 = row.getCell(3);
    c3.numFmt = "#,##0";
    c3.alignment = { vertical: "middle", horizontal: "right" };
    const c4 = row.getCell(4);
    c4.numFmt = "0.0%";
    c4.alignment = { vertical: "middle", horizontal: "right" };
    const c5 = row.getCell(5);
    c5.alignment = { vertical: "middle", horizontal: "center" };
    c5.font = { name: "Calibri", bold: true, color: { argb: THEME.brandDark } };
  });
  autoFitWorksheetColumns(summary);

  // Sheet 3: Global Dictionary / Từ điển Dữ liệu Toàn diện
  const dictSheetName = isVi ? "Từ điển Dữ liệu" : "Global Dictionary";
  const dictionary = workbook.addWorksheet(dictSheetName);
  dictionary.properties.tabColor = { argb: DATASET_META.company.accent };
  applyTitleBlock(
    dictionary,
    isVi ? "TỪ ĐIỂN DỮ LIỆU TOÀN DIỆN" : "Global dictionary",
    isVi ? "Định nghĩa toàn bộ các trường dữ liệu trên tất cả các phân hệ xuất khẩu chuẩn WeaveCarbon" : "All fields across exported standard datasets",
    DATASET_META.company.accent,
    7
  );
  const dictHeader = dictionary.addRow(
    isVi
      ? ["Phân hệ", "Tên trường dữ liệu", "Kiểu dữ liệu", "Đã điền", "Còn trống", "Độ hoàn thiện", "Dữ liệu mẫu"]
      : ["Report type", "Field", "Type", "Filled", "Empty", "Completion", "Examples"]
  );
  styleHeaderRow(dictHeader, DATASET_META.company.accent);
  let index = 0;
  enriched.forEach((dataset) => {
    const viMeta = VIETNAMESE_DATASET_TITLES[dataset.type];
    dataset.analysis.columnProfiles.forEach((profile) => {
      const row = dictionary.addRow([
        isVi ? viMeta.sheetName : DATASET_META[dataset.type].title,
        profile.label,
        profile.type,
        profile.filledCount,
        Math.max(dataset.analysis.rowCount - profile.filledCount, 0),
        profile.completeness / 100,
        formatExampleCell(profile.examples),
      ]);
      styleBodyRow(row, index % 2 === 0);
      const c4 = row.getCell(4);
      c4.numFmt = "#,##0";
      c4.alignment = { vertical: "middle", horizontal: "right" };
      const c5 = row.getCell(5);
      c5.numFmt = "#,##0";
      c5.alignment = { vertical: "middle", horizontal: "right" };
      const c6 = row.getCell(6);
      c6.numFmt = "0.0%";
      c6.alignment = { vertical: "middle", horizontal: "right" };
      index += 1;
    });
  });
  autoFitWorksheetColumns(dictionary);

  // Data sheets for each dataset
  enriched.forEach((dataset) => {
    addDataSheet(
      workbook,
      dataset.type,
      dataset.columns,
      dataset.rows,
      dataset.analysis,
      `Records: ${dataset.analysis.rowCount}`,
      options
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
      analytics: Math.max(0, asNumber(data.analytics, 0)),
      company: Math.max(0, asNumber(data.company, 0)),
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
    // Sanitise against CSV formula injection before quoting.
    const text = sanitizeCsvValue(stringifyValue(value).replace(/\r?\n/g, " ").trim());
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
