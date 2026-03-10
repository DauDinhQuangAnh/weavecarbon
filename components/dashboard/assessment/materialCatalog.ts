

export type MaterialType = "fabric" | "trim" | "accessory" | "packaging";

export type MaterialFamily =
"cotton" |
"polyester" |
"wool" |
"leather" |
"silk" |
"linen" |
"nylon" |
"viscose" |
"acrylic" |
"elastane" |
"down" |
"fur" |
"canvas" |
"bamboo" |
"hemp" |
"tencel" |
"metal" |
"plastic" |
"paper" |
"mixed" |
"other";

export type DataQuality = "primary" | "secondary" | "proxy";

export type UserSource = "selected_catalog" | "ai_suggested" | "user_other";

export interface CatalogMaterial {
  id: string;
  displayNameVi: string;
  displayNameEn: string;
  materialType: MaterialType;
  materialFamily: MaterialFamily;
  typicalApplications: string[];
  co2Factor: number;
  recyclabilityDefaultPercent?: number;
  dataQualityDefault: DataQuality;
  isRecycled?: boolean;
  status: "active" | "deprecated";
}

export interface MaterialRequest {
  requestId: string;
  companyId?: string;
  inputName: string;
  inputDescription: string;
  inputImages?: string[];
  detectedCandidates: {materialId: string;name: string;score: number;}[];
  selectedCandidateMaterialId?: string;
  decision: "pending" | "accepted_new" | "mapped_existing" | "rejected";
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface ProductMaterialInput {
  id: string;
  catalogMaterialId?: string;
  customName?: string;
  materialType: MaterialType;
  materialFamily?: MaterialFamily;
  percentage: number;
  weightGram?: number;
  userSource: UserSource;
  confidenceScore: number;
  certifications: string[];
  source: "domestic" | "imported" | "unknown";
  requestId?: string;
  notes?: string;
}



export const MATERIAL_CATALOG: CatalogMaterial[] = [

{
  id: "cat-cotton-100",
  displayNameVi: "Cotton 100%",
  displayNameEn: "100% Cotton",
  materialType: "fabric",
  materialFamily: "cotton",
  typicalApplications: ["body_fabric", "lining"],
  co2Factor: 8.0,
  recyclabilityDefaultPercent: 80,
  dataQualityDefault: "primary",
  status: "active"
},
{
  id: "cat-cotton-organic",
  displayNameVi: "Cotton hữu cơ",
  displayNameEn: "Organic Cotton",
  materialType: "fabric",
  materialFamily: "cotton",
  typicalApplications: ["body_fabric"],
  co2Factor: 4.5,
  recyclabilityDefaultPercent: 90,
  dataQualityDefault: "primary",
  status: "active"
},
{
  id: "cat-cotton-recycled",
  displayNameVi: "Cotton tái chế",
  displayNameEn: "Recycled Cotton",
  materialType: "fabric",
  materialFamily: "cotton",
  typicalApplications: ["body_fabric"],
  co2Factor: 3.2,
  recyclabilityDefaultPercent: 70,
  dataQualityDefault: "secondary",
  isRecycled: true,
  status: "active"
},


{
  id: "cat-polyester-100",
  displayNameVi: "Polyester 100%",
  displayNameEn: "100% Polyester",
  materialType: "fabric",
  materialFamily: "polyester",
  typicalApplications: ["body_fabric", "lining"],
  co2Factor: 5.5,
  recyclabilityDefaultPercent: 60,
  dataQualityDefault: "primary",
  status: "active"
},
{
  id: "cat-polyester-recycled",
  displayNameVi: "Polyester tái chế (rPET)",
  displayNameEn: "Recycled Polyester (rPET)",
  materialType: "fabric",
  materialFamily: "polyester",
  typicalApplications: ["body_fabric", "lining"],
  co2Factor: 2.5,
  recyclabilityDefaultPercent: 70,
  dataQualityDefault: "primary",
  isRecycled: true,
  status: "active"
},


{
  id: "cat-wool-100",
  displayNameVi: "Len 100%",
  displayNameEn: "100% Wool",
  materialType: "fabric",
  materialFamily: "wool",
  typicalApplications: ["body_fabric"],
  co2Factor: 10.1,
  recyclabilityDefaultPercent: 60,
  dataQualityDefault: "primary",
  status: "active"
},
{
  id: "cat-wool-merino",
  displayNameVi: "Len Merino",
  displayNameEn: "Merino Wool",
  materialType: "fabric",
  materialFamily: "wool",
  typicalApplications: ["body_fabric"],
  co2Factor: 11.5,
  recyclabilityDefaultPercent: 65,
  dataQualityDefault: "primary",
  status: "active"
},


{
  id: "cat-silk-100",
  displayNameVi: "Lụa 100%",
  displayNameEn: "100% Silk",
  materialType: "fabric",
  materialFamily: "silk",
  typicalApplications: ["body_fabric", "lining"],
  co2Factor: 7.5,
  recyclabilityDefaultPercent: 40,
  dataQualityDefault: "secondary",
  status: "active"
},


{
  id: "cat-linen-100",
  displayNameVi: "Lanh 100%",
  displayNameEn: "100% Linen",
  materialType: "fabric",
  materialFamily: "linen",
  typicalApplications: ["body_fabric"],
  co2Factor: 5.2,
  recyclabilityDefaultPercent: 85,
  dataQualityDefault: "primary",
  status: "active"
},


{
  id: "cat-nylon-100",
  displayNameVi: "Nylon 100%",
  displayNameEn: "100% Nylon",
  materialType: "fabric",
  materialFamily: "nylon",
  typicalApplications: ["body_fabric", "lining"],
  co2Factor: 6.8,
  recyclabilityDefaultPercent: 50,
  dataQualityDefault: "primary",
  status: "active"
},
{
  id: "cat-nylon-recycled",
  displayNameVi: "Nylon tái chế",
  displayNameEn: "Recycled Nylon",
  materialType: "fabric",
  materialFamily: "nylon",
  typicalApplications: ["body_fabric"],
  co2Factor: 3.5,
  recyclabilityDefaultPercent: 60,
  dataQualityDefault: "secondary",
  isRecycled: true,
  status: "active"
},


{
  id: "cat-bamboo",
  displayNameVi: "Vải Bamboo",
  displayNameEn: "Bamboo Fabric",
  materialType: "fabric",
  materialFamily: "bamboo",
  typicalApplications: ["body_fabric"],
  co2Factor: 3.8,
  recyclabilityDefaultPercent: 70,
  dataQualityDefault: "secondary",
  status: "active"
},
{
  id: "cat-hemp",
  displayNameVi: "Vải Gai dầu",
  displayNameEn: "Hemp Fabric",
  materialType: "fabric",
  materialFamily: "hemp",
  typicalApplications: ["body_fabric"],
  co2Factor: 2.9,
  recyclabilityDefaultPercent: 85,
  dataQualityDefault: "secondary",
  status: "active"
},
{
  id: "cat-tencel",
  displayNameVi: "Tencel/Lyocell",
  displayNameEn: "Tencel/Lyocell",
  materialType: "fabric",
  materialFamily: "tencel",
  typicalApplications: ["body_fabric", "lining"],
  co2Factor: 3.5,
  recyclabilityDefaultPercent: 75,
  dataQualityDefault: "primary",
  status: "active"
},


{
  id: "cat-viscose",
  displayNameVi: "Viscose/Rayon",
  displayNameEn: "Viscose/Rayon",
  materialType: "fabric",
  materialFamily: "viscose",
  typicalApplications: ["body_fabric", "lining"],
  co2Factor: 4.2,
  recyclabilityDefaultPercent: 60,
  dataQualityDefault: "secondary",
  status: "active"
},


{
  id: "cat-acrylic",
  displayNameVi: "Acrylic",
  displayNameEn: "Acrylic",
  materialType: "fabric",
  materialFamily: "acrylic",
  typicalApplications: ["body_fabric"],
  co2Factor: 5.0,
  recyclabilityDefaultPercent: 40,
  dataQualityDefault: "secondary",
  status: "active"
},


{
  id: "cat-leather-genuine",
  displayNameVi: "Da thật",
  displayNameEn: "Genuine Leather",
  materialType: "fabric",
  materialFamily: "leather",
  typicalApplications: ["body_fabric"],
  co2Factor: 17.0,
  recyclabilityDefaultPercent: 30,
  dataQualityDefault: "secondary",
  status: "active"
},
{
  id: "cat-leather-faux",
  displayNameVi: "Da giả/PU",
  displayNameEn: "Faux Leather/PU",
  materialType: "fabric",
  materialFamily: "plastic",
  typicalApplications: ["body_fabric"],
  co2Factor: 7.0,
  recyclabilityDefaultPercent: 20,
  dataQualityDefault: "secondary",
  status: "active"
},


{
  id: "cat-down",
  displayNameVi: "Lông vũ/Down",
  displayNameEn: "Down Feather",
  materialType: "fabric",
  materialFamily: "down",
  typicalApplications: ["padding"],
  co2Factor: 15.0,
  recyclabilityDefaultPercent: 50,
  dataQualityDefault: "proxy",
  status: "active"
},
{
  id: "cat-faux-fur",
  displayNameVi: "Lông giả",
  displayNameEn: "Faux Fur",
  materialType: "fabric",
  materialFamily: "fur",
  typicalApplications: ["body_fabric", "trim"],
  co2Factor: 8.5,
  recyclabilityDefaultPercent: 10,
  dataQualityDefault: "proxy",
  status: "active"
},


{
  id: "cat-canvas-cotton",
  displayNameVi: "Vải Canvas (Cotton)",
  displayNameEn: "Cotton Canvas",
  materialType: "fabric",
  materialFamily: "canvas",
  typicalApplications: ["body_fabric"],
  co2Factor: 9.0,
  recyclabilityDefaultPercent: 75,
  dataQualityDefault: "secondary",
  status: "active"
},


{
  id: "cat-blend-cotton-poly",
  displayNameVi: "Vải pha Cotton/Polyester",
  displayNameEn: "Cotton/Polyester Blend",
  materialType: "fabric",
  materialFamily: "mixed",
  typicalApplications: ["body_fabric"],
  co2Factor: 6.5,
  recyclabilityDefaultPercent: 50,
  dataQualityDefault: "secondary",
  status: "active"
},
{
  id: "cat-blend-wool-poly",
  displayNameVi: "Vải pha Len/Polyester",
  displayNameEn: "Wool/Polyester Blend",
  materialType: "fabric",
  materialFamily: "mixed",
  typicalApplications: ["body_fabric"],
  co2Factor: 7.5,
  recyclabilityDefaultPercent: 45,
  dataQualityDefault: "secondary",
  status: "active"
},


{
  id: "cat-zipper-metal",
  displayNameVi: "Khóa kéo kim loại",
  displayNameEn: "Metal Zipper",
  materialType: "trim",
  materialFamily: "metal",
  typicalApplications: ["zipper"],
  co2Factor: 12.0,
  recyclabilityDefaultPercent: 90,
  dataQualityDefault: "secondary",
  status: "active"
},
{
  id: "cat-zipper-plastic",
  displayNameVi: "Khóa kéo nhựa",
  displayNameEn: "Plastic Zipper",
  materialType: "trim",
  materialFamily: "plastic",
  typicalApplications: ["zipper"],
  co2Factor: 4.0,
  recyclabilityDefaultPercent: 40,
  dataQualityDefault: "secondary",
  status: "active"
},
{
  id: "cat-zipper-nylon",
  displayNameVi: "Khóa kéo nylon",
  displayNameEn: "Nylon Zipper",
  materialType: "trim",
  materialFamily: "nylon",
  typicalApplications: ["zipper"],
  co2Factor: 5.0,
  recyclabilityDefaultPercent: 30,
  dataQualityDefault: "secondary",
  status: "active"
},


{
  id: "cat-button-plastic",
  displayNameVi: "Nút nhựa",
  displayNameEn: "Plastic Button",
  materialType: "trim",
  materialFamily: "plastic",
  typicalApplications: ["button"],
  co2Factor: 3.5,
  recyclabilityDefaultPercent: 50,
  dataQualityDefault: "secondary",
  status: "active"
},
{
  id: "cat-button-metal",
  displayNameVi: "Nút kim loại",
  displayNameEn: "Metal Button",
  materialType: "trim",
  materialFamily: "metal",
  typicalApplications: ["button"],
  co2Factor: 10.0,
  recyclabilityDefaultPercent: 95,
  dataQualityDefault: "secondary",
  status: "active"
},
{
  id: "cat-button-wood",
  displayNameVi: "Nút gỗ",
  displayNameEn: "Wood Button",
  materialType: "trim",
  materialFamily: "other",
  typicalApplications: ["button"],
  co2Factor: 1.5,
  recyclabilityDefaultPercent: 80,
  dataQualityDefault: "proxy",
  status: "active"
},
{
  id: "cat-button-shell",
  displayNameVi: "Nút xà cừ/vỏ sò",
  displayNameEn: "Shell Button",
  materialType: "trim",
  materialFamily: "other",
  typicalApplications: ["button"],
  co2Factor: 2.0,
  recyclabilityDefaultPercent: 60,
  dataQualityDefault: "proxy",
  status: "active"
},


{
  id: "cat-thread-polyester",
  displayNameVi: "Chỉ may Polyester",
  displayNameEn: "Polyester Thread",
  materialType: "accessory",
  materialFamily: "polyester",
  typicalApplications: ["thread"],
  co2Factor: 5.0,
  dataQualityDefault: "proxy",
  status: "active"
},
{
  id: "cat-thread-cotton",
  displayNameVi: "Chỉ may Cotton",
  displayNameEn: "Cotton Thread",
  materialType: "accessory",
  materialFamily: "cotton",
  typicalApplications: ["thread"],
  co2Factor: 7.0,
  dataQualityDefault: "proxy",
  status: "active"
},
{
  id: "cat-elastic-band",
  displayNameVi: "Thun co giãn",
  displayNameEn: "Elastic Band",
  materialType: "accessory",
  materialFamily: "elastane",
  typicalApplications: ["elastic"],
  co2Factor: 6.0,
  dataQualityDefault: "proxy",
  status: "active"
},
{
  id: "cat-label-woven",
  displayNameVi: "Nhãn dệt",
  displayNameEn: "Woven Label",
  materialType: "accessory",
  materialFamily: "polyester",
  typicalApplications: ["label"],
  co2Factor: 4.0,
  dataQualityDefault: "proxy",
  status: "active"
},
{
  id: "cat-label-printed",
  displayNameVi: "Nhãn in",
  displayNameEn: "Printed Label",
  materialType: "accessory",
  materialFamily: "paper",
  typicalApplications: ["label"],
  co2Factor: 2.0,
  dataQualityDefault: "proxy",
  status: "active"
},
{
  id: "cat-lining-polyester",
  displayNameVi: "Vải lót Polyester",
  displayNameEn: "Polyester Lining",
  materialType: "accessory",
  materialFamily: "polyester",
  typicalApplications: ["lining"],
  co2Factor: 5.0,
  dataQualityDefault: "secondary",
  status: "active"
},
{
  id: "cat-padding-polyester",
  displayNameVi: "Đệm/Mút Polyester",
  displayNameEn: "Polyester Padding",
  materialType: "accessory",
  materialFamily: "polyester",
  typicalApplications: ["padding"],
  co2Factor: 6.0,
  dataQualityDefault: "secondary",
  status: "active"
},


{
  id: "cat-packaging-plastic-bag",
  displayNameVi: "Túi nhựa PE",
  displayNameEn: "PE Plastic Bag",
  materialType: "packaging",
  materialFamily: "plastic",
  typicalApplications: ["packaging"],
  co2Factor: 3.0,
  recyclabilityDefaultPercent: 30,
  dataQualityDefault: "secondary",
  status: "active"
},
{
  id: "cat-packaging-paper-box",
  displayNameVi: "Hộp giấy",
  displayNameEn: "Paper Box",
  materialType: "packaging",
  materialFamily: "paper",
  typicalApplications: ["packaging"],
  co2Factor: 1.5,
  recyclabilityDefaultPercent: 85,
  dataQualityDefault: "secondary",
  status: "active"
},


{
  id: "cat-other-generic",
  displayNameVi: "Vật liệu khác (Proxy)",
  displayNameEn: "Other Material (Proxy)",
  materialType: "fabric",
  materialFamily: "other",
  typicalApplications: ["body_fabric", "trim", "accessory"],
  co2Factor: 6.0,
  dataQualityDefault: "proxy",
  status: "active"
}];




export function searchMaterialCatalog(
query: string,
type?: MaterialType)
: CatalogMaterial[] {
  const normalizedQuery = query.toLowerCase().trim();

  return MATERIAL_CATALOG.filter((m) => m.status === "active").
  filter((m) => !type || m.materialType === type).
  filter(
    (m) =>
    m.displayNameVi.toLowerCase().includes(normalizedQuery) ||
    m.displayNameEn.toLowerCase().includes(normalizedQuery) ||
    m.materialFamily.includes(normalizedQuery)
  ).
  slice(0, 10);
}

export function getMaterialById(id: string): CatalogMaterial | undefined {
  return MATERIAL_CATALOG.find((m) => m.id === id);
}

export function getMaterialsByType(type: MaterialType): CatalogMaterial[] {
  return MATERIAL_CATALOG.filter(
    (m) => m.materialType === type && m.status === "active"
  );
}

export function getMaterialsByFamily(
family: MaterialFamily)
: CatalogMaterial[] {
  return MATERIAL_CATALOG.filter(
    (m) => m.materialFamily === family && m.status === "active"
  );
}


export function getProxyEmissionFactor(
family?: MaterialFamily,
application?: string)
: number {
  if (family) {
    const familyMaterials = getMaterialsByFamily(family);
    if (familyMaterials.length > 0) {
      const avgFactor =
      familyMaterials.reduce((sum, m) => sum + m.co2Factor, 0) /
      familyMaterials.length;
      return avgFactor;
    }
  }


  const appDefaults: Record<string, number> = {
    body_fabric: 6.0,
    lining: 5.0,
    trim: 5.0,
    zipper: 6.0,
    button: 4.0,
    thread: 5.5,
    label: 3.0,
    elastic: 6.0,
    padding: 6.0,
    packaging: 2.5
  };

  return appDefaults[application || "body_fabric"] || 6.0;
}


export function getMaterialWarnings(
materials: ProductMaterialInput[])
: string[] {
  const warnings: string[] = [];

  materials.forEach((m) => {
    const catalogMaterial = m.catalogMaterialId ?
    getMaterialById(m.catalogMaterialId) :
    null;

    if (catalogMaterial) {

      if (["leather", "down", "fur"].includes(catalogMaterial.materialFamily)) {
        warnings.push(
          `Vật liệu "${catalogMaterial.displayNameVi}" có thể yêu cầu chứng nhận đặc biệt (welfare certification)`
        );
      }

      if (catalogMaterial.materialFamily === "metal" && m.percentage > 5) {
        warnings.push(
          `Phụ liệu kim loại (${catalogMaterial.displayNameVi}) chiếm tỷ lệ cao, có thể ảnh hưởng đáng kể đến carbon footprint`
        );
      }
    }


    if (m.userSource === "user_other" && m.confidenceScore < 0.5) {
      warnings.push(
        `Vật liệu "${m.customName || "Khác"}" đang dùng hệ số proxy với độ tin cậy thấp`
      );
    }
  });

  return [...new Set(warnings)];
}


export function calculateMaterialConfidence(
materials: ProductMaterialInput[])
: number {
  if (materials.length === 0) return 0;

  const weightedConfidence = materials.reduce((sum, m) => {
    const weight = m.percentage / 100;
    return sum + m.confidenceScore * weight;
  }, 0);

  return Math.round(weightedConfidence * 100) / 100;
}


export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  fabric: "Vải chính",
  trim: "Phụ liệu trim",
  accessory: "Phụ kiện",
  packaging: "Bao bì"
};


export const MATERIAL_FAMILY_LABELS: Record<MaterialFamily, string> = {
  cotton: "Cotton",
  polyester: "Polyester",
  wool: "Len",
  leather: "Da",
  silk: "Lụa",
  linen: "Lanh",
  nylon: "Nylon",
  viscose: "Viscose",
  acrylic: "Acrylic",
  elastane: "Elastane",
  down: "Lông vũ",
  fur: "Lông",
  canvas: "Canvas",
  bamboo: "Bamboo",
  hemp: "Gai dầu",
  tencel: "Tencel",
  metal: "Kim loại",
  plastic: "Nhựa",
  paper: "Giấy",
  mixed: "Pha trộn",
  other: "Khác"
};