/**
 * Nhãn hiển thị cho danh mục đa ngành (thép, xi măng, nhôm, phân bón, khai khoáng,
 * vật liệu xây dựng, nông sản, dệt may). Dùng cho dữ liệu demo và hồ sơ sản phẩm công nghiệp.
 */
import { getMaterialById } from "@/lib/carbon/materialCatalog";

export const INDUSTRY_CATEGORY_LABELS: Record<string, string> = {
  steel: "Thép",
  cement: "Xi măng",
  aluminium: "Nhôm",
  fertiliser: "Phân bón & hoá chất",
  mining: "Khai khoáng",
  construction_materials: "Vật liệu xây dựng",
  agriculture: "Nông nghiệp & chế biến nông sản",
  textile: "Dệt may",
};

export const INDUSTRIAL_PRODUCT_TYPE_LABELS: Record<string, string> = {
  steel_coil: "Thép cuộn",
  steel_rebar: "Thép thanh",
  cement: "Xi măng",
  aluminium_profile: "Nhôm định hình",
  fertiliser: "Phân bón",
  coffee: "Cà phê nhân",
  rice: "Gạo",
  natural_rubber: "Cao su tự nhiên",
  cashew: "Hạt điều nhân",
  ceramic_tile: "Gạch ceramic",
  aac_block: "Gạch bê tông khí",
  mineral_concentrate: "Tinh quặng",
  yarn: "Sợi",
  spice: "Gia vị",
  steel_product: "Sản phẩm thép",
};

export const INDUSTRIAL_MATERIAL_LABELS: Record<string, string> = {
  steel_scrap: "Thép phế liệu",
  iron_ore_pellet: "Quặng sắt viên",
  clinker: "Clinker",
  gypsum_additives: "Thạch cao & phụ gia",
  primary_aluminium: "Nhôm nguyên sinh",
  recycled_aluminium: "Nhôm tái chế",
  natural_gas_feedstock: "Khí tự nhiên (nguyên liệu)",
  coffee_cherry: "Cà phê quả tươi",
  black_pepper: "Hạt tiêu đen",
  paddy_rice: "Lúa",
  field_latex: "Mủ cao su",
  clay_feldspar: "Đất sét & tràng thạch",
  glaze_frit: "Men frit",
  heavy_mineral_sand: "Cát sa khoáng",
  cotton_fibre: "Xơ bông",
  raw_cashew_nut: "Hạt điều thô",
  ammonia: "Amoniac",
  phosphate_rock: "Quặng phosphat",
  potash: "Kali",
  cement_lime: "Xi măng & vôi",
  silica_sand: "Cát silic",
};

export const INDUSTRIAL_PROCESS_LABELS: Record<string, string> = {
  eaf_melting: "Luyện lò điện hồ quang",
  hot_rolling: "Cán nóng",
  bar_rolling: "Cán thép thanh",
  clinker_kiln: "Nung clinker",
  cement_grinding: "Nghiền xi măng",
  billet_casting: "Đúc phôi",
  extrusion: "Ép đùn",
  anodizing: "Anode hoá",
  ammonia_synthesis: "Tổng hợp amoniac",
  urea_granulation: "Tạo hạt urê",
  blending: "Phối trộn",
  granulation: "Tạo hạt",
  drying: "Sấy",
  hulling: "Xát vỏ",
  sorting: "Phân loại",
  milling: "Xay xát",
  polishing: "Lau bóng",
  coagulation: "Đánh đông",
  crumbing: "Cán cốm",
  pressing: "Ép",
  kiln_firing: "Nung",
  glazing: "Tráng men",
  mining: "Khai thác",
  gravity_separation: "Tuyển trọng lực",
  magnetic_separation: "Tuyển từ",
  spinning: "Kéo sợi",
  winding: "Đánh ống",
  steaming: "Hấp",
  shelling: "Tách vỏ",
  peeling: "Bóc lụa",
  mixing: "Phối liệu",
  autoclaving: "Chưng áp",
  cutting: "Cắt",
};

const humanize = (value: string) => value.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Tên vật liệu hiển thị: nhãn đa ngành → danh mục vật liệu dệt may → chuỗi gốc đã làm đẹp. */
export function materialDisplayName(value: string): string {
  if (!value) return "";
  return INDUSTRIAL_MATERIAL_LABELS[value] || getMaterialById(value)?.displayNameVi || humanize(value.replace(/^cat-/, ""));
}

export function productTypeDisplayName(value: string): string | undefined {
  return INDUSTRIAL_PRODUCT_TYPE_LABELS[value];
}

export function processDisplayName(value: string): string | undefined {
  return INDUSTRIAL_PROCESS_LABELS[value];
}
