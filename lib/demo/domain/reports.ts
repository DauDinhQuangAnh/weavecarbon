"use client";

import { createReportSnapshot, getReportRowsByType } from "@/lib/demo/selectors";
import { readDemoDataset } from "@/lib/demo/storage";
import type {
  DemoDataset,
  DemoReportManifest,
  DemoReportSnapshot,
} from "@/lib/demo/schema";
import type { ReportDatasetType, ReportWorkbookOptions } from "@/lib/reportsApi";
import { downloadAsCsv, downloadAsXlsx } from "@/lib/reportsApi";
import type { MarketCode } from "@/components/dashboard/export/types";

const createId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeFormat = (value: unknown) =>
  String(value || "xlsx").trim().toLowerCase() === "csv" ? "csv" : "xlsx";

const normalizeDatasetType = (value: unknown): ReportDatasetType => {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "products" ||
    normalized === "users" ||
    normalized === "history" ||
    normalized === "analytics" ||
    normalized === "company"
  ) {
    return normalized;
  }
  return "products";
};

const toExportableSheet = (value: string): ReportDatasetType =>
  value === "users" || value === "history" || value === "analytics" || value === "company"
    ? value
    : "products";

const asSingleSnapshot = (value: DemoReportSnapshot | DemoReportSnapshot[]) =>
  (Array.isArray(value) ? value[0] : value) as DemoReportSnapshot;

const getSnapshotRecordCount = (value: DemoReportSnapshot | DemoReportSnapshot[]) =>
  Array.isArray(value)
    ? value.reduce((sum, snapshot) => sum + snapshot.rows.length, 0)
    : value.rows.length;

const buildComplianceRows = (dataset: DemoDataset, marketCode?: MarketCode) => {
  const entries = Object.entries(dataset.exportCompliance)
    .filter(([code]) => !marketCode || code === marketCode)
    .flatMap(([code, value]) => {
      const market = value as Record<string, unknown>;
      const documents = Array.isArray(market.documents) ? (market.documents as Record<string, unknown>[]) : [];
      return documents.map((document) => ({
        marketCode: code,
        marketName: String(market.marketName || code),
        documentId: String(document.id || ""),
        documentName: String(document.name || ""),
        status: String(document.status || "missing"),
        required: Boolean(document.required),
        type: String(document.type || "document"),
      }));
    });

  return {
    datasetType: "company",
    columns: ["marketCode", "marketName", "documentId", "documentName", "status", "required", "type"],
    rows: entries,
  } satisfies DemoReportSnapshot;
};

const buildSnapshotForCreate = (
  dataset: DemoDataset,
  payload: Record<string, unknown>
): { type: string; snapshot: DemoReportSnapshot } => {
  const reportType = String(payload.report_type || payload.type || "carbon_audit").trim().toLowerCase();
  if (reportType === "export_data") {
    const filters =
      payload.filters && typeof payload.filters === "object"
        ? (payload.filters as Record<string, unknown>)
        : {};
    const datasetType = normalizeDatasetType(filters.dataset_type || filters.datasetType);
    return {
      type: datasetType,
      snapshot: asSingleSnapshot(createReportSnapshot(dataset, datasetType)),
    };
  }

  if (reportType === "sustainability") {
    return {
      type: "sustainability",
      snapshot: asSingleSnapshot(createReportSnapshot(dataset, "analytics")),
    };
  }

  if (reportType === "compliance") {
    return {
      type: "compliance",
      snapshot: buildComplianceRows(dataset, (payload.target_market as MarketCode | undefined) || undefined),
    };
  }

  return {
    type: "carbon_audit",
    snapshot: asSingleSnapshot(createReportSnapshot(dataset, "products")),
  };
};

export const getDemoReports = (dataset: DemoDataset) => dataset.reports;

export const createDemoReport = (
  dataset: DemoDataset,
  payload: Record<string, unknown>
): DemoReportManifest => {
  const title = String(payload.title || "").trim();
  if (!title) {
    throw new Error("Report title is required.");
  }

  const { type, snapshot } = buildSnapshotForCreate(dataset, payload);
  if (!snapshot.rows.length) {
    throw new Error("No data available to export.");
  }

  const format = normalizeFormat(payload.file_format || payload.format);
  const manifest: DemoReportManifest = {
    id: createId(),
    title,
    type,
    format: format.toUpperCase(),
    status: "completed",
    createdAt: new Date().toISOString(),
    date: new Date().toISOString().slice(0, 10),
    size: "Pending",
    records: getSnapshotRecordCount(snapshot),
    co2e: null,
    downloadUrl: `demo://report/${type}/${createId()}`,
    snapshot,
  };

  manifest.downloadUrl = `demo://report/${manifest.id}`;
  dataset.reports.unshift(manifest);
  return manifest;
};

export const deleteDemoReport = (dataset: DemoDataset, reportId: string) => {
  dataset.reports = dataset.reports.filter((report) => report.id !== reportId);
};

export const getDemoReportSourceCounts = (dataset: DemoDataset) => {
  const counts = {
    products: getReportRowsByType(dataset, "products").length,
    activity: 0,
    audit: 0,
    users: getReportRowsByType(dataset, "users").length,
    history: getReportRowsByType(dataset, "history").length,
  };
  return counts;
};

export const getDemoReportSourceCount = (dataset: DemoDataset, type: ReportDatasetType) =>
  getReportRowsByType(dataset, type).length;

export const getDemoExportData = (dataset: DemoDataset, type: ReportDatasetType) => {
  const snapshot = asSingleSnapshot(createReportSnapshot(dataset, type));
  return {
    dataset_type: snapshot.datasetType,
    columns: snapshot.columns,
    rows: snapshot.rows,
    total: snapshot.rows.length,
  };
};

export const isDemoReportDownloadPath = (value: string) => value.startsWith("demo://report/");

const extractDemoReportId = (value: string) => value.replace(/^demo:\/\/report\//, "").trim();

export const downloadDemoReportFromPath = async (
  path: string,
  options: ReportWorkbookOptions = {}
) => {
  const dataset = readDemoDataset();
  if (!dataset) {
    throw new Error("Demo dataset is unavailable.");
  }
  const reportId = extractDemoReportId(path);
  const report = dataset.reports.find((item) => item.id === reportId);
  if (!report) {
    throw new Error("Demo report not found.");
  }

  const snapshot = asSingleSnapshot(report.snapshot);
  if (!snapshot) {
    throw new Error("Demo report snapshot is unavailable.");
  }

  const extension = normalizeFormat(report.format);
  const safeTitle = report.title.replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "") || "demo_report";
  const fileName = `${safeTitle}.${extension}`;

  if (extension === "csv") {
    downloadAsCsv(snapshot.columns, snapshot.rows, fileName);
    return;
  }

  await downloadAsXlsx(
    snapshot.columns,
    snapshot.rows,
    fileName,
    toExportableSheet(snapshot.datasetType),
    options
  );
};
