import * as XLSX from 'xlsx';
import { BulkProductRow, ValidationError, ValidationResult } from './types';
import { TEMPLATE_COLUMNS } from './template';

const MATERIAL_MAP: Record<string, string> = {
  cotton: 'cotton',
  polyester: 'polyester',
  nylon: 'nylon',
  len: 'wool',
  lụa: 'silk',
  linen: 'linen',
  'polyester tái chế': 'recycled_polyester',
  'cotton hữu cơ': 'organic_cotton',
  bamboo: 'bamboo',
  hemp: 'hemp',
  'pha trộn': 'blend',
};

const PRODUCT_TYPE_MAP: Record<string, string> = {
  'áo thun': 'tshirt',
  quần: 'pants',
  'váy/đầm': 'dress',
  váy: 'dress',
  đầm: 'dress',
  'áo khoác': 'jacket',
  giày: 'shoes',
  túi: 'bag',
  'phụ kiện': 'accessories',
  khác: 'other',
};

const ENERGY_SOURCE_MAP: Record<string, string> = {
  'điện lưới': 'grid',
  'điện mặt trời': 'solar',
  'than đá': 'coal',
  'hỗn hợp': 'mixed',
};

const TRANSPORT_MODE_MAP: Record<string, string> = {
  'đường bộ': 'road',
  'đường biển': 'sea',
  'đường hàng không': 'air',
  'đường sắt': 'rail',
  'đa phương thức': 'multimodal',
};

const MATERIAL_SOURCE_MAP: Record<string, string> = {
  'trong nước': 'domestic',
  'nhập khẩu': 'imported',
  'không xác định': 'unknown',
};

const MARKET_TYPE_MAP: Record<string, string> = {
  'nội địa': 'domestic',
  'xuất khẩu': 'export',
};

const EXPORT_COUNTRY_MAP: Record<string, string> = {
  'eu (châu âu)': 'eu',
  'châu âu': 'eu',
  eu: 'eu',
  mỹ: 'us',
  us: 'us',
  usa: 'us',
  'nhật bản': 'jp',
  nhật: 'jp',
  jp: 'jp',
  japan: 'jp',
  'hàn quốc': 'kr',
  hàn: 'kr',
  kr: 'kr',
  korea: 'kr',
  khác: 'other',
  other: 'other',
};

const PROCESS_MAP: Record<string, string> = {
  'dệt kim': 'knitting',
  'dệt thoi': 'weaving',
  'cắt may': 'cutting',
  nhuộm: 'dyeing',
  in: 'printing',
  'hoàn tất': 'finishing',
};

function normalizeString(str: unknown): string {
  return str?.toString().trim().toLowerCase() || '';
}

function mapValue<T extends string>(
  value: unknown,
  map: Record<string, string>,
  defaultValue: T
): T {
  const normalized = normalizeString(value);
  return (map[normalized] as T) || defaultValue;
}

function parseProcesses(value: unknown): string[] {
  if (!value) return [];
  return String(value)
    .split(/[,;]/)
    .map((p) => {
      const normalized = normalizeString(p);
      return PROCESS_MAP[normalized] || normalized;
    })
    .filter(Boolean);
}

export function parseFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          worksheet,
          { defval: '', raw: false }
        );
        resolve(jsonData);
      } catch {
        reject(new Error('Không thể đọc file. Vui lòng kiểm tra định dạng file.'));
      }
    };
    reader.onerror = () => reject(new Error('Lỗi khi đọc file.'));
    reader.readAsArrayBuffer(file);
  });
}

export function validateAndTransformData(
  rawData: Record<string, unknown>[]
): ValidationResult {
  const validRows: BulkProductRow[] = [];
  const invalidRows: {
    row: number;
    data: Partial<BulkProductRow>;
    errors: ValidationError[];
  }[] = [];
  const warnings: ValidationError[] = [];

  const headerKeyMap: Record<string, string> = {};
  TEMPLATE_COLUMNS.forEach((col) => {
    const cleanHeader = col.header.replace(' *', '').toLowerCase();
    headerKeyMap[cleanHeader] = col.key;
  });

  rawData.forEach((row, index) => {
    const rowNumber = index + 2;
    const rowErrors: ValidationError[] = [];

    const mappedRow: Record<string, unknown> = {};
    Object.entries(row).forEach(([key, value]) => {
      const cleanKey = key.replace(' *', '').toLowerCase();
      const mappedKey = headerKeyMap[cleanKey] || key;
      mappedRow[mappedKey] = value;
    });

    const requiredFields = TEMPLATE_COLUMNS.filter((col) => col.required).map(
      (col) => col.key
    );
    requiredFields.forEach((field) => {
      const headerInfo = TEMPLATE_COLUMNS.find((col) => col.key === field);
      if (!mappedRow[field] || mappedRow[field] === '') {
        rowErrors.push({
          row: rowNumber,
          field,
          message: `Trường "${headerInfo?.header.replace(' *', '')}" là bắt buộc`,
          severity: 'error',
        });
      }
    });

    const sku = String(mappedRow.sku || '').trim();
    const productName = String(
      mappedRow.productName || mappedRow['Tên sản phẩm'] || ''
    ).trim();
    const productType = mapValue(
      mappedRow.productType || mappedRow['Loại sản phẩm'],
      PRODUCT_TYPE_MAP,
      'other'
    );
    const quantity = parseInt(
      String(mappedRow.quantity || mappedRow['Số lượng'] || '0')
    );
    const weightPerUnit = parseFloat(
      String(
        mappedRow.weightPerUnit || mappedRow['Trọng lượng (gram)'] || '0'
      )
    );

    if (isNaN(quantity) || quantity <= 0) {
      rowErrors.push({
        row: rowNumber,
        field: 'quantity',
        message: 'Số lượng phải là số dương',
        severity: 'error',
      });
    }

    if (isNaN(weightPerUnit) || weightPerUnit <= 0) {
      rowErrors.push({
        row: rowNumber,
        field: 'weightPerUnit',
        message: 'Trọng lượng phải là số dương',
        severity: 'error',
      });
    }

    const primaryMaterial = mapValue(
      mappedRow.primaryMaterial || mappedRow['Vải chính'],
      MATERIAL_MAP,
      'cotton'
    );
    const primaryMaterialPercentage = parseFloat(
      String(
        mappedRow.primaryMaterialPercentage ||
          mappedRow['Tỷ lệ vải chính (%)'] ||
          '100'
      )
    );
    const secondaryMaterial = mapValue(
      mappedRow.secondaryMaterial || mappedRow['Vải phụ'],
      MATERIAL_MAP,
      ''
    );
    const secondaryMaterialPercentage = parseFloat(
      String(
        mappedRow.secondaryMaterialPercentage ||
          mappedRow['Tỷ lệ vải phụ (%)'] ||
          '0'
      )
    );

    const totalPercentage =
      primaryMaterialPercentage + (secondaryMaterialPercentage || 0);
    if (totalPercentage !== 100) {
      warnings.push({
        row: rowNumber,
        field: 'materialPercentage',
        message: `Tổng tỷ lệ vật liệu là ${totalPercentage}%, nên là 100%`,
        severity: 'warning',
      });
    }

    const accessories = String(
      mappedRow.accessories || mappedRow['Phụ liệu'] || ''
    );
    const materialSource = mapValue(
      mappedRow.materialSource || mappedRow['Nguồn nguyên liệu'],
      MATERIAL_SOURCE_MAP,
      'unknown'
    ) as 'domestic' | 'imported' | 'unknown';

    const processes = parseProcesses(
      mappedRow.processes || mappedRow['Công đoạn sản xuất']
    );
    const energySource = mapValue(
      mappedRow.energySource || mappedRow['Nguồn năng lượng'],
      ENERGY_SOURCE_MAP,
      'grid'
    ) as 'grid' | 'solar' | 'coal' | 'mixed';

    const marketType = mapValue(
      mappedRow.marketType || mappedRow['Thị trường'],
      MARKET_TYPE_MAP,
      'domestic'
    ) as 'domestic' | 'export';
    const exportCountry = mapValue(
      mappedRow.exportCountry || mappedRow['Quốc gia xuất khẩu'],
      EXPORT_COUNTRY_MAP,
      ''
    );
    const transportMode = mapValue(
      mappedRow.transportMode || mappedRow['Hình thức vận chuyển'],
      TRANSPORT_MODE_MAP,
      'sea'
    ) as 'road' | 'sea' | 'air' | 'rail' | 'multimodal';

    if (marketType === 'export' && !exportCountry) {
      warnings.push({
        row: rowNumber,
        field: 'exportCountry',
        message: 'Sản phẩm xuất khẩu nhưng chưa chỉ định quốc gia đích',
        severity: 'warning',
      });
    }

    const transformedRow: BulkProductRow = {
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
      materialSource,
      processes,
      energySource,
      marketType,
      exportCountry: exportCountry || undefined,
      transportMode,
    };

    if (rowErrors.length > 0) {
      invalidRows.push({ row: rowNumber, data: transformedRow, errors: rowErrors });
    } else {
      validRows.push(transformedRow);
    }
  });

  return {
    isValid: invalidRows.length === 0,
    validRows,
    invalidRows,
    warnings,
    totalRows: rawData.length,
    validCount: validRows.length,
    errorCount: invalidRows.length,
    warningCount: warnings.length,
  };
}
