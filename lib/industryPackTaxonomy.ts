/**
 * Taxonomy loại quy trình dùng chung giữa /processes và Industry Packs.
 *
 * Industry Packs (BE) chỉ nhận quy trình có processType nằm trong `pilotProcesses` của gói.
 * /processes dùng 6 công đoạn chung để nhóm quy trình. Module này:
 *  - liệt kê loại quy trình theo từng gói ngành (để gợi ý đúng mã khi tạo quy trình),
 *  - ánh xạ mỗi mã ngành về một công đoạn chung (để sơ đồ công đoạn đếm được cả loại ngành).
 */

export type GenericProcessStage =
  | "material_preparation"
  | "production"
  | "thermal_process"
  | "utilities"
  | "wastewater_treatment"
  | "packaging_finishing";

export const GENERIC_PROCESS_TYPES: Array<{ value: GenericProcessStage; label: string }> = [
  { value: "material_preparation", label: "Chuẩn bị nguyên liệu" },
  { value: "production", label: "Sản xuất chính" },
  { value: "thermal_process", label: "Lò nung / lò hơi / sấy" },
  { value: "utilities", label: "Điện & tiện ích" },
  { value: "wastewater_treatment", label: "Xử lý chất thải & khí thải" },
  { value: "packaging_finishing", label: "Đóng gói & hoàn tất" },
];

export interface PackProcessType {
  value: string;
  label: string;
  stage: GenericProcessStage;
}

export interface PackProcessTaxonomy {
  packId: string;
  label: string;
  /** Loại quy trình được gói chấp nhận khi tạo pilot snapshot (khớp `pilotProcesses` của BE). */
  processes: PackProcessType[];
}

export const INDUSTRY_PACK_PROCESS_TAXONOMY: PackProcessTaxonomy[] = [
  {
    packId: "textile_apparel",
    label: "Dệt may & Da giày",
    processes: [
      { value: "spinning", label: "Kéo sợi", stage: "production" },
      { value: "weaving", label: "Dệt thoi", stage: "production" },
      { value: "knitting", label: "Dệt kim", stage: "production" },
      { value: "dyeing", label: "Nhuộm", stage: "thermal_process" },
      { value: "finishing", label: "Hoàn tất vải (định hình, sấy)", stage: "thermal_process" },
      { value: "garment", label: "May thành phẩm", stage: "production" },
    ],
  },
  {
    packId: "steel",
    label: "Thép & Hợp kim sắt",
    processes: [
      { value: "bf", label: "Lò cao (BF)", stage: "thermal_process" },
      { value: "bof", label: "Lò thổi oxy (BOF)", stage: "production" },
      { value: "eaf", label: "Lò điện hồ quang (EAF)", stage: "production" },
    ],
  },
  {
    packId: "cement",
    label: "Xi măng & Clinker",
    processes: [
      { value: "kiln", label: "Lò nung", stage: "thermal_process" },
      { value: "clinker", label: "Sản xuất clinker", stage: "thermal_process" },
    ],
  },
  {
    packId: "aluminium",
    label: "Nhôm & Đúc kim loại",
    processes: [
      { value: "alumina", label: "Tinh luyện alumina", stage: "thermal_process" },
      { value: "smelting", label: "Điện phân nhôm", stage: "production" },
      { value: "casting", label: "Đúc", stage: "production" },
    ],
  },
  {
    packId: "construction_materials",
    label: "Vật liệu xây dựng & Gốm sứ",
    processes: [
      { value: "quarry", label: "Khai thác mỏ đá", stage: "material_preparation" },
      { value: "crushing", label: "Nghiền sàng", stage: "material_preparation" },
      { value: "cutting", label: "Cắt", stage: "production" },
      { value: "ceramics", label: "Nung gốm sứ", stage: "thermal_process" },
      { value: "glass", label: "Nấu thủy tinh", stage: "thermal_process" },
      { value: "concrete", label: "Sản xuất bê tông", stage: "production" },
    ],
  },
  {
    packId: "fertiliser_chemicals",
    label: "Hóa chất & Phân bón",
    processes: [
      { value: "ammonia", label: "Tổng hợp amoniac", stage: "production" },
      { value: "nitric_acid", label: "Sản xuất axit nitric", stage: "production" },
      { value: "urea", label: "Sản xuất urê", stage: "production" },
      { value: "fertiliser_blending", label: "Phối trộn phân bón", stage: "material_preparation" },
      { value: "chemical_processing", label: "Chế biến hóa chất", stage: "production" },
    ],
  },
  {
    packId: "mining_minerals",
    label: "Khai khoáng & Khoáng sản",
    processes: [
      { value: "extraction", label: "Khai thác", stage: "material_preparation" },
      { value: "crushing", label: "Nghiền sàng", stage: "material_preparation" },
      { value: "beneficiation", label: "Tuyển khoáng", stage: "production" },
      { value: "processing", label: "Chế biến khoáng sản", stage: "production" },
    ],
  },
];

const GENERIC_STAGE_SET = new Set<string>(GENERIC_PROCESS_TYPES.map((item) => item.value));

const PACK_TYPE_INDEX = new Map<string, PackProcessType>();
for (const pack of INDUSTRY_PACK_PROCESS_TAXONOMY) {
  for (const process of pack.processes) {
    if (!PACK_TYPE_INDEX.has(process.value)) PACK_TYPE_INDEX.set(process.value, process);
  }
}

const normalizeType = (value: string | null | undefined) => String(value || "").trim().toLowerCase();

/** Công đoạn chung của một loại quy trình (loại chung hoặc mã ngành); null nếu không xác định. */
export function stageForProcessType(processType: string | null | undefined): GenericProcessStage | null {
  const type = normalizeType(processType);
  if (GENERIC_STAGE_SET.has(type)) return type as GenericProcessStage;
  return PACK_TYPE_INDEX.get(type)?.stage ?? null;
}

/** Nhãn tiếng Việt của loại quy trình; trả undefined nếu là mã tự do. */
export function processTypeLabel(processType: string | null | undefined): string | undefined {
  const type = normalizeType(processType);
  return GENERIC_PROCESS_TYPES.find((item) => item.value === type)?.label ?? PACK_TYPE_INDEX.get(type)?.label;
}

/** Các gói ngành chấp nhận loại quy trình này. */
export function packsAcceptingProcessType(processType: string | null | undefined): string[] {
  const type = normalizeType(processType);
  return INDUSTRY_PACK_PROCESS_TAXONOMY.filter((pack) => pack.processes.some((item) => item.value === type)).map(
    (pack) => pack.packId
  );
}

/** Gói ngành có nhiều quy trình khớp nhất trong danh sách; null nếu không quy trình nào khớp. */
export function dominantPackForProcessTypes(processTypes: Array<string | null | undefined>): string | null {
  let best: { packId: string; count: number } | null = null;
  for (const pack of INDUSTRY_PACK_PROCESS_TAXONOMY) {
    const accepted = new Set(pack.processes.map((item) => item.value));
    const count = processTypes.filter((type) => accepted.has(normalizeType(type))).length;
    if (count > 0 && (!best || count > best.count)) best = { packId: pack.packId, count };
  }
  return best?.packId ?? null;
}
