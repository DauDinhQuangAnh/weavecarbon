import * as XLSX from "xlsx";
import { BulkProductRow, ValidationError, ValidationResult } from "./types";
import { TEMPLATE_COLUMNS } from "./template";

const HEADER_ALIASES: Record<string, string> = {
  sku: "sku",
  masku: "sku",
  masanpham: "sku",
  productcode: "sku",
  productsku: "sku",
  productname: "productName",
  tensanpham: "productName",
  name: "productName",
  producttype: "productType",
  loaisanpham: "productType",
  category: "productType",
  soluong: "quantity",
  quantity: "quantity",
  qty: "quantity",
  weightperunit: "weightPerUnit",
  weightgram: "weightPerUnit",
  unitweight: "weightPerUnit",
  trongluonggram: "weightPerUnit",
  primarymaterial: "primaryMaterial",
  vaichinh: "primaryMaterial",
  mainmaterial: "primaryMaterial",
  primarymaterialpercentage: "primaryMaterialPercentage",
  primarymaterialpercent: "primaryMaterialPercentage",
  mainmaterialpercentage: "primaryMaterialPercentage",
  tylevaichinh: "primaryMaterialPercentage",
  secondarymaterial: "secondaryMaterial",
  vaiphu: "secondaryMaterial",
  secondarymaterialpercentage: "secondaryMaterialPercentage",
  secondarymaterialpercent: "secondaryMaterialPercentage",
  tylevaiphu: "secondaryMaterialPercentage",
  accessories: "accessories",
  phulieu: "accessories",
  accessoriesweightgram: "accessoriesWeightGram",
  phulieukhoiluonggram: "accessoriesWeightGram",
  phulieugram: "accessoriesWeightGram",
  certification: "certifications",
  certifications: "certifications",
  chungnhan: "certifications",
  giaychungnhan: "certifications",
  materialsource: "materialSource",
  nguonnguyenlieu: "materialSource",
  processes: "processes",
  productionprocesses: "processes",
  congdoansanxuat: "processes",
  energysource: "energySource",
  energysources: "energySource",
  nguonnangluong: "energySource",
  manufacturinglocation: "manufacturingLocation",
  productionlocation: "manufacturingLocation",
  diadiemsanxuat: "manufacturingLocation",
  noisanxuat: "manufacturingLocation",
  wasterecovery: "wasteRecovery",
  thuhoichatthai: "wasteRecovery",
  wastecollection: "wasteRecovery",
  markettype: "marketType",
  market: "marketType",
  thitruong: "marketType",
  exportcountry: "exportCountry",
  destinationcountry: "exportCountry",
  quocgiaxuatkhau: "exportCountry",
  exportcompliancedocuments: "exportComplianceDocuments",
  exportdocuments: "exportComplianceDocuments",
  compliancedocuments: "exportComplianceDocuments",
  hosoxuatkhau: "exportComplianceDocuments",
  chungchixuatkhau: "exportComplianceDocuments",
  transportmode: "transportMode",
  shippingmode: "transportMode",
  hinhthucvanchuyen: "transportMode",
  transportorigin: "transportOrigin",
  originoftransport: "transportOrigin",
  diemdivanchuyen: "transportOrigin",
  noixuatphatvanchuyen: "transportOrigin",
  transportdestination: "transportDestination",
  destinationoftransport: "transportDestination",
  diemdenvanchuyen: "transportDestination",
  noidiemdenvanchuyen: "transportDestination",
  transportdistancekm: "transportDistanceKm",
  distancetransportkm: "transportDistanceKm",
  khoangcachvanchuyenkm: "transportDistanceKm"
};

const MATERIAL_MAP: Record<string, string> = {
  cotton: "cotton",
  organiccotton: "organic_cotton",
  cottonhuuco: "organic_cotton",
  polyester: "polyester",
  recycledpolyester: "recycled_polyester",
  polyestertaiche: "recycled_polyester",
  nylon: "nylon",
  wool: "wool",
  len: "wool",
  silk: "silk",
  lua: "silk",
  linen: "linen",
  lanh: "linen",
  bamboo: "bamboo",
  hemp: "hemp",
  blend: "blend",
  phatron: "blend"
};

const PRODUCT_TYPE_MAP: Record<string, string> = {
  tshirt: "tshirt",
  aothun: "tshirt",
  tee: "tshirt",
  pants: "pants",
  quan: "pants",
  trousers: "pants",
  dress: "dress",
  vaydam: "dress",
  vay: "dress",
  dam: "dress",
  jacket: "jacket",
  aokhoac: "jacket",
  shoes: "shoes",
  giay: "shoes",
  bag: "bag",
  tui: "bag",
  accessories: "accessories",
  accessory: "accessories",
  phukien: "accessories",
  other: "other",
  khac: "other"
};

const ENERGY_SOURCE_MAP: Record<string, string> = {
  grid: "grid",
  dienluoi: "grid",
  solar: "solar",
  dienmattroi: "solar",
  wind: "mixed",
  diengio: "mixed",
  coal: "coal",
  thanda: "coal",
  gas: "mixed",
  khidot: "mixed",
  mixed: "mixed",
  honhop: "mixed"
};

const TRANSPORT_MODE_MAP: Record<string, string> = {
  road: "road",
  duongbo: "road",
  sea: "sea",
  duongbien: "sea",
  air: "air",
  duonghangkhong: "air",
  rail: "rail",
  duongsat: "rail",
  multimodal: "multimodal",
  daphuongthuc: "multimodal"
};

const MATERIAL_SOURCE_MAP: Record<string, string> = {
  domestic: "domestic",
  trongnuoc: "domestic",
  imported: "imported",
  nhapkhau: "imported",
  unknown: "unknown",
  khongxacdinh: "unknown"
};

const MARKET_TYPE_MAP: Record<string, string> = {
  domestic: "domestic",
  noidia: "domestic",
  vietnam: "domestic",
  export: "export",
  xuatkhau: "export"
};

const EXPORT_COUNTRY_MAP: Record<string, string> = {
  eu: "eu",
  chauau: "eu",
  europe: "eu",
  us: "us",
  usa: "us",
  my: "us",
  hoaky: "us",
  jp: "jp",
  japan: "jp",
  nhatban: "jp",
  kr: "kr",
  korea: "kr",
  hanquoc: "kr",
  other: "other",
  khac: "other"
};

const PROCESS_MAP: Record<string, string> = {
  knitting: "knitting",
  detkim: "knitting",
  weaving: "weaving",
  detthoi: "weaving",
  cuttingsewing: "cutting_sewing",
  cutsew: "cutting_sewing",
  cutting: "cutting_sewing",
  sewing: "cutting_sewing",
  catmay: "cutting_sewing",
  dyeing: "dyeing",
  dye: "dyeing",
  nhuom: "dyeing",
  printing: "printing",
  print: "printing",
  in: "printing",
  finishing: "finishing",
  finish: "finishing",
  hoantat: "finishing"
};

const WASTE_RECOVERY_MAP: Record<string, "none" | "partial" | "full" | "circular"> = {
  none: "none",
  no: "none",
  khong: "none",
  no_recovery: "none",
  norecovery: "none",
  partial: "partial",
  motphan: "partial",
  partly: "partial",
  full: "full",
  complete: "full",
  toanphan: "full",
  circular: "circular",
  circularity: "circular",
  closedloop: "circular",
  tuanhoan: "circular"
};

const normalizeToken = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/%/g, " percent ")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

const normalizeString = (value: unknown): string => String(value ?? "").trim();

const normalizeSku = (value: string) => value.trim().toUpperCase();

const isMissingValue = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
};

const mapValue = <T extends string>(
  value: unknown,
  map: Record<string, string>,
  defaultValue: T
): T => {
  const normalized = normalizeToken(value);
  return (map[normalized] as T | undefined) ?? defaultValue;
};

const parseProcesses = (value: unknown): string[] => {
  const raw = normalizeString(value);
  if (!raw) return [];

  const mapped = raw
    .split(/[,;|]/)
    .map((item) => {
      const token = normalizeToken(item);
      if (!token) return "";
      return PROCESS_MAP[token] || normalizeString(item).toLowerCase().replace(/\s+/g, "_");
    })
    .filter(Boolean);

  return Array.from(new Set(mapped));
};

const normalizeWasteRecovery = (value: unknown): "none" | "partial" | "full" | "circular" | "" => {
  const raw = normalizeString(value);
  if (!raw) return "";

  const mappedByToken = WASTE_RECOVERY_MAP[normalizeToken(raw)];
  if (mappedByToken) return mappedByToken;

  const percentMatch = raw.match(/-?\d+(?:[.,]\d+)?/);
  if (!percentMatch) return "";
  const parsed = Number(percentMatch[0].replace(",", "."));
  if (!Number.isFinite(parsed)) return "";
  if (parsed <= 0) return "none";
  if (parsed >= 80) return "full";
  return "partial";
};

const buildHeaderKeyMap = (): Record<string, string> => {
  const map: Record<string, string> = {};

  TEMPLATE_COLUMNS.forEach((col) => {
    const tokens = [
      normalizeToken(col.header),
      normalizeToken(col.header.replace(/\*/g, "")),
      normalizeToken(col.key)
    ];
    tokens.forEach((token) => {
      if (token) map[token] = col.key;
    });
  });

  Object.entries(HEADER_ALIASES).forEach(([alias, key]) => {
    map[alias] = key;
  });

  return map;
};

const REQUIRED_COLUMN_KEYS = TEMPLATE_COLUMNS.filter((column) => column.required).map(
  (column) => column.key
);
const EXPECTED_COLUMN_KEYS = TEMPLATE_COLUMNS.map((column) => column.key);

const mapHeaderToColumnKey = (
  header: unknown,
  headerKeyMap: Record<string, string>
): string => {
  const normalizedHeader = normalizeToken(header);
  if (!normalizedHeader) return "";
  return headerKeyMap[normalizedHeader] || normalizedHeader;
};

const pickBestWorksheet = (
  workbook: XLSX.WorkBook,
  headerKeyMap: Record<string, string>
): XLSX.WorkSheet | null => {
  let selectedWorksheet: XLSX.WorkSheet | null = null;
  let bestScore = -1;

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false
    });
    const headerRow = Array.isArray(matrix[0]) ? matrix[0] : [];
    if (headerRow.length === 0) continue;

    const canonicalKeys = headerRow
      .map((cell) => mapHeaderToColumnKey(cell, headerKeyMap))
      .filter(Boolean);
    if (canonicalKeys.length === 0) continue;

    const uniqueKeys = new Set(canonicalKeys);
    const requiredMatches = REQUIRED_COLUMN_KEYS.filter((key) => uniqueKeys.has(key)).length;
    const expectedMatches = EXPECTED_COLUMN_KEYS.filter((key) => uniqueKeys.has(key)).length;
    const score = requiredMatches * 100 + expectedMatches;

    if (score > bestScore) {
      bestScore = score;
      selectedWorksheet = worksheet;
    }
  }

  return selectedWorksheet;
};

export function parseFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const headerKeyMap = buildHeaderKeyMap();
        const worksheet = pickBestWorksheet(workbook, headerKeyMap);
        if (!worksheet) {
          reject(new Error("Không tìm thấy sheet dữ liệu hợp lệ trong file import."));
          return;
        }

        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: "",
          raw: false
        });
        resolve(jsonData);
      } catch {
        reject(new Error("Không thể đọc file. Vui lòng kiểm tra định dạng file."));
      }
    };

    reader.onerror = () => {
      reject(new Error("Lỗi khi đọc file."));
    };

    reader.readAsArrayBuffer(file);
  });
}

export function validateAndTransformData(rawData: Record<string, unknown>[]): ValidationResult {
  const validRows: BulkProductRow[] = [];
  const invalidRows: { row: number; data: Partial<BulkProductRow>; errors: ValidationError[] }[] =
    [];
  const warnings: ValidationError[] = [];
  const skuRowNumbers = new Map<string, number[]>();
  const headerKeyMap = buildHeaderKeyMap();

  rawData.forEach((row, index) => {
    const rowNumber = index + 2;
    const rowErrors: ValidationError[] = [];

    const mappedRow: Record<string, unknown> = {};
    Object.entries(row).forEach(([key, value]) => {
      const normalizedKey = normalizeToken(key);
      const mappedKey = headerKeyMap[normalizedKey] || key;
      mappedRow[mappedKey] = value;
    });

    const requiredFields = TEMPLATE_COLUMNS.filter((col) => col.required).map((col) => col.key);
    requiredFields.forEach((field) => {
      const headerInfo = TEMPLATE_COLUMNS.find((col) => col.key === field);
      if (isMissingValue(mappedRow[field])) {
        rowErrors.push({
          row: rowNumber,
          field,
          message: `Trường "${headerInfo?.header.replace(" *", "")}" là bắt buộc`,
          severity: "error"
        });
      }
    });

    const sku = normalizeString(mappedRow.sku);
    const productName = normalizeString(mappedRow.productName);
    const productType = mapValue(mappedRow.productType, PRODUCT_TYPE_MAP, "other");
    const quantity = parseInt(String(mappedRow.quantity ?? "0"), 10);
    const weightPerUnit = parseFloat(String(mappedRow.weightPerUnit ?? "0"));

    if (Number.isNaN(quantity) || quantity <= 0) {
      rowErrors.push({
        row: rowNumber,
        field: "quantity",
        message: "Số lượng phải là số dương",
        severity: "error"
      });
    }
    if (Number.isNaN(weightPerUnit) || weightPerUnit <= 0) {
      rowErrors.push({
        row: rowNumber,
        field: "weightPerUnit",
        message: "Trọng lượng phải là số dương",
        severity: "error"
      });
    }

    const primaryMaterial = mapValue(mappedRow.primaryMaterial, MATERIAL_MAP, "cotton");
    const primaryMaterialPercentage = parseFloat(
      String(mappedRow.primaryMaterialPercentage ?? "100")
    );
    const secondaryMaterial = mapValue(mappedRow.secondaryMaterial, MATERIAL_MAP, "");
    const secondaryMaterialPercentage = parseFloat(
      String(mappedRow.secondaryMaterialPercentage ?? "0")
    );

    const totalPercentage = primaryMaterialPercentage + (secondaryMaterialPercentage || 0);
    if (Number.isFinite(totalPercentage) && Math.abs(totalPercentage - 100) > 0.001) {
      warnings.push({
        row: rowNumber,
        field: "materialPercentage",
        message: `Tổng tỷ lệ vật liệu là ${totalPercentage}%, nên là 100%`,
        severity: "warning"
      });
    }

    const accessories = normalizeString(mappedRow.accessories);
    const accessoriesWeightGram = normalizeString(mappedRow.accessoriesWeightGram);
    const certifications = normalizeString(mappedRow.certifications);
    const materialSource = mapValue(mappedRow.materialSource, MATERIAL_SOURCE_MAP, "unknown") as
      | "domestic"
      | "imported"
      | "unknown";

    const processes = parseProcesses(mappedRow.processes);
    const energySource = mapValue(mappedRow.energySource, ENERGY_SOURCE_MAP, "grid") as
      | "grid"
      | "solar"
      | "coal"
      | "mixed";

    const marketType = mapValue(mappedRow.marketType, MARKET_TYPE_MAP, "domestic") as
      | "domestic"
      | "export";
    const exportCountry = mapValue(mappedRow.exportCountry, EXPORT_COUNTRY_MAP, "");
    const exportComplianceDocuments = normalizeString(mappedRow.exportComplianceDocuments);
    const transportMode = mapValue(mappedRow.transportMode, TRANSPORT_MODE_MAP, "sea") as
      | "road"
      | "sea"
      | "air"
      | "rail"
      | "multimodal";
    const manufacturingLocation = normalizeString(mappedRow.manufacturingLocation);
    const rawWasteRecovery = normalizeString(mappedRow.wasteRecovery);
    const wasteRecovery = normalizeWasteRecovery(mappedRow.wasteRecovery);
    const transportOrigin = normalizeString(mappedRow.transportOrigin);
    const transportDestination = normalizeString(mappedRow.transportDestination);
    const rawTransportDistance = normalizeString(mappedRow.transportDistanceKm);
    const normalizedTransportDistance = rawTransportDistance.replace(/,/g, ".");
    const parsedTransportDistance = normalizedTransportDistance
      ? Number(normalizedTransportDistance)
      : Number.NaN;
    const transportDistanceKm =
      Number.isFinite(parsedTransportDistance) && parsedTransportDistance > 0
        ? parsedTransportDistance
        : undefined;

    if (rawTransportDistance && !transportDistanceKm) {
      warnings.push({
        row: rowNumber,
        field: "transportDistanceKm",
        message: "Khoảng cách vận chuyển phải là số dương (km)",
        severity: "warning"
      });
    }
    if (!transportOrigin || !transportDestination) {
      warnings.push({
        row: rowNumber,
        field: "transportRoute",
        message: "Nên khai báo đầy đủ điểm đi và điểm đến vận chuyển",
        severity: "warning"
      });
    }
    if (rawWasteRecovery && !wasteRecovery) {
      warnings.push({
        row: rowNumber,
        field: "wasteRecovery",
        message: "Gia tri thu hoi chat thai khong hop le, hay dung none/partial/full/circular hoac %.",
        severity: "warning"
      });
    }
    if (marketType === "export" && !exportCountry) {
      warnings.push({
        row: rowNumber,
        field: "exportCountry",
        message: "Sản phẩm xuất khẩu nhưng chưa chỉ định quốc gia đích",
        severity: "warning"
      });
    }
    if (marketType === "export" && !exportComplianceDocuments) {
      warnings.push({
        row: rowNumber,
        field: "exportComplianceDocuments",
        message: "Nên khai báo hồ sơ xuất khẩu đã có (nếu đã tải trong module /export).",
        severity: "warning"
      });
    }

    const transformedRow: BulkProductRow = {
      sourceRow: rowNumber,
      sku,
      productName,
      productType,
      quantity,
      weightPerUnit,
      primaryMaterial,
      primaryMaterialPercentage,
      secondaryMaterial: secondaryMaterial || undefined,
      secondaryMaterialPercentage: secondaryMaterialPercentage || undefined,
      accessories: accessories || undefined,
      accessoriesWeightGram: accessoriesWeightGram || undefined,
      certifications: certifications || undefined,
      materialSource,
      processes,
      energySource,
      marketType,
      exportCountry: exportCountry || undefined,
      exportComplianceDocuments: exportComplianceDocuments || undefined,
      transportMode,
      manufacturingLocation: manufacturingLocation || undefined,
      wasteRecovery: wasteRecovery || undefined,
      transportOrigin: transportOrigin || undefined,
      transportDestination: transportDestination || undefined,
      transportDistanceKm
    };

    if (rowErrors.length > 0) {
      invalidRows.push({
        row: rowNumber,
        data: transformedRow,
        errors: rowErrors
      });
    } else {
      validRows.push(transformedRow);
      const normalizedSku = normalizeSku(sku);
      if (normalizedSku) {
        const rows = skuRowNumbers.get(normalizedSku) || [];
        rows.push(rowNumber);
        skuRowNumbers.set(normalizedSku, rows);
      }
    }
  });

  skuRowNumbers.forEach((rows, normalizedSku) => {
    if (rows.length <= 1) return;
    rows.forEach((rowNumber) => {
      warnings.push({
        row: rowNumber,
        field: "sku",
        message: `SKU "${normalizedSku}" bị trùng trong file import`,
        severity: "warning"
      });
    });
  });

  return {
    isValid: invalidRows.length === 0,
    validRows,
    invalidRows,
    warnings,
    totalRows: rawData.length,
    validCount: validRows.length,
    errorCount: invalidRows.length,
    warningCount: warnings.length
  };
}
