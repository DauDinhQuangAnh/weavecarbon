export interface LocalizedB2CMaterialRewardDefault {
  id: string;
  materialNameEn: string;
  materialNameVi: string;
  materialCategory: string;
  pointsPerKg: number;
  co2SavedPerKg: number;
  descriptionEn: string;
  descriptionVi: string;
}

export const DEFAULT_OTHER_MATERIAL_ID =
  "10a00000-0000-4000-8000-000000000024";

export const DEFAULT_B2C_MATERIAL_REWARDS: LocalizedB2CMaterialRewardDefault[] = [
  {
    id: "10a00000-0000-4000-8000-000000000001",
    materialNameEn: "100% Cotton",
    materialNameVi: "Cotton 100%",
    materialCategory: "fabric",
    pointsPerKg: 32,
    co2SavedPerKg: 8.0,
    descriptionEn: "Default reward profile for cotton garments.",
    descriptionVi: "Cau hinh diem thuong mac dinh cho san pham cotton."
  },
  {
    id: "10a00000-0000-4000-8000-000000000002",
    materialNameEn: "Organic Cotton",
    materialNameVi: "Cotton huu co",
    materialCategory: "fabric",
    pointsPerKg: 18,
    co2SavedPerKg: 4.5,
    descriptionEn: "Lower-carbon cotton with a reduced proxy footprint.",
    descriptionVi: "Cotton huu co voi he so carbon proxy thap hon."
  },
  {
    id: "10a00000-0000-4000-8000-000000000003",
    materialNameEn: "Recycled Cotton",
    materialNameVi: "Cotton tai che",
    materialCategory: "fabric",
    pointsPerKg: 16,
    co2SavedPerKg: 3.2,
    descriptionEn: "Reward profile for recycled cotton fabrics.",
    descriptionVi: "Cau hinh diem thuong cho vai cotton tai che."
  },
  {
    id: "10a00000-0000-4000-8000-000000000004",
    materialNameEn: "100% Polyester",
    materialNameVi: "Polyester 100%",
    materialCategory: "fabric",
    pointsPerKg: 24,
    co2SavedPerKg: 5.5,
    descriptionEn: "Default reward profile for polyester garments.",
    descriptionVi: "Cau hinh diem thuong mac dinh cho san pham polyester."
  },
  {
    id: "10a00000-0000-4000-8000-000000000005",
    materialNameEn: "Recycled Polyester (rPET)",
    materialNameVi: "Polyester tai che (rPET)",
    materialCategory: "fabric",
    pointsPerKg: 12,
    co2SavedPerKg: 2.5,
    descriptionEn: "Reward profile for recycled polyester fabrics.",
    descriptionVi: "Cau hinh diem thuong cho vai polyester tai che."
  },
  {
    id: "10a00000-0000-4000-8000-000000000006",
    materialNameEn: "100% Wool",
    materialNameVi: "Len 100%",
    materialCategory: "fabric",
    pointsPerKg: 40,
    co2SavedPerKg: 10.1,
    descriptionEn: "Default reward profile for wool garments.",
    descriptionVi: "Cau hinh diem thuong mac dinh cho san pham len."
  },
  {
    id: "10a00000-0000-4000-8000-000000000007",
    materialNameEn: "Merino Wool",
    materialNameVi: "Len Merino",
    materialCategory: "fabric",
    pointsPerKg: 44,
    co2SavedPerKg: 11.5,
    descriptionEn: "Premium wool profile for merino garments.",
    descriptionVi: "Cau hinh diem thuong cho san pham len merino."
  },
  {
    id: "10a00000-0000-4000-8000-000000000008",
    materialNameEn: "100% Silk",
    materialNameVi: "Lua 100%",
    materialCategory: "fabric",
    pointsPerKg: 30,
    co2SavedPerKg: 7.5,
    descriptionEn: "Reward profile for silk fabrics.",
    descriptionVi: "Cau hinh diem thuong cho vai lua."
  },
  {
    id: "10a00000-0000-4000-8000-000000000009",
    materialNameEn: "100% Linen",
    materialNameVi: "Lanh 100%",
    materialCategory: "fabric",
    pointsPerKg: 20,
    co2SavedPerKg: 5.2,
    descriptionEn: "Reward profile for linen fabrics.",
    descriptionVi: "Cau hinh diem thuong cho vai lanh."
  },
  {
    id: "10a00000-0000-4000-8000-000000000010",
    materialNameEn: "100% Nylon",
    materialNameVi: "Nylon 100%",
    materialCategory: "fabric",
    pointsPerKg: 28,
    co2SavedPerKg: 6.8,
    descriptionEn: "Reward profile for nylon fabrics.",
    descriptionVi: "Cau hinh diem thuong cho vai nylon."
  },
  {
    id: "10a00000-0000-4000-8000-000000000011",
    materialNameEn: "Recycled Nylon",
    materialNameVi: "Nylon tai che",
    materialCategory: "fabric",
    pointsPerKg: 14,
    co2SavedPerKg: 3.5,
    descriptionEn: "Reward profile for recycled nylon fabrics.",
    descriptionVi: "Cau hinh diem thuong cho vai nylon tai che."
  },
  {
    id: "10a00000-0000-4000-8000-000000000012",
    materialNameEn: "Bamboo Fabric",
    materialNameVi: "Vai Bamboo",
    materialCategory: "fabric",
    pointsPerKg: 15,
    co2SavedPerKg: 3.8,
    descriptionEn: "Reward profile for bamboo-based fabrics.",
    descriptionVi: "Cau hinh diem thuong cho vai bamboo."
  },
  {
    id: "10a00000-0000-4000-8000-000000000013",
    materialNameEn: "Hemp Fabric",
    materialNameVi: "Vai Gai dau",
    materialCategory: "fabric",
    pointsPerKg: 14,
    co2SavedPerKg: 2.9,
    descriptionEn: "Reward profile for hemp-based fabrics.",
    descriptionVi: "Cau hinh diem thuong cho vai gai dau."
  },
  {
    id: "10a00000-0000-4000-8000-000000000014",
    materialNameEn: "Tencel/Lyocell",
    materialNameVi: "Tencel/Lyocell",
    materialCategory: "fabric",
    pointsPerKg: 16,
    co2SavedPerKg: 3.5,
    descriptionEn: "Reward profile for Tencel and lyocell fabrics.",
    descriptionVi: "Cau hinh diem thuong cho vai Tencel va lyocell."
  },
  {
    id: "10a00000-0000-4000-8000-000000000015",
    materialNameEn: "Viscose/Rayon",
    materialNameVi: "Viscose/Rayon",
    materialCategory: "fabric",
    pointsPerKg: 17,
    co2SavedPerKg: 4.2,
    descriptionEn: "Reward profile for viscose and rayon fabrics.",
    descriptionVi: "Cau hinh diem thuong cho vai viscose va rayon."
  },
  {
    id: "10a00000-0000-4000-8000-000000000016",
    materialNameEn: "Acrylic",
    materialNameVi: "Acrylic",
    materialCategory: "fabric",
    pointsPerKg: 20,
    co2SavedPerKg: 5.0,
    descriptionEn: "Reward profile for acrylic fabrics.",
    descriptionVi: "Cau hinh diem thuong cho vai acrylic."
  },
  {
    id: "10a00000-0000-4000-8000-000000000017",
    materialNameEn: "Genuine Leather",
    materialNameVi: "Da that",
    materialCategory: "fabric",
    pointsPerKg: 50,
    co2SavedPerKg: 17.0,
    descriptionEn: "Reward profile for leather garments and accessories.",
    descriptionVi: "Cau hinh diem thuong cho san pham da that."
  },
  {
    id: "10a00000-0000-4000-8000-000000000018",
    materialNameEn: "Faux Leather/PU",
    materialNameVi: "Da gia/PU",
    materialCategory: "fabric",
    pointsPerKg: 28,
    co2SavedPerKg: 7.0,
    descriptionEn: "Reward profile for faux leather and PU materials.",
    descriptionVi: "Cau hinh diem thuong cho da gia va vat lieu PU."
  },
  {
    id: "10a00000-0000-4000-8000-000000000019",
    materialNameEn: "Down Feather",
    materialNameVi: "Long vu/Down",
    materialCategory: "fabric",
    pointsPerKg: 48,
    co2SavedPerKg: 15.0,
    descriptionEn: "Reward profile for down-filled products.",
    descriptionVi: "Cau hinh diem thuong cho san pham long vu."
  },
  {
    id: "10a00000-0000-4000-8000-000000000020",
    materialNameEn: "Faux Fur",
    materialNameVi: "Long gia",
    materialCategory: "fabric",
    pointsPerKg: 32,
    co2SavedPerKg: 8.5,
    descriptionEn: "Reward profile for faux fur products.",
    descriptionVi: "Cau hinh diem thuong cho san pham long gia."
  },
  {
    id: "10a00000-0000-4000-8000-000000000021",
    materialNameEn: "Cotton Canvas",
    materialNameVi: "Vai Canvas (Cotton)",
    materialCategory: "fabric",
    pointsPerKg: 34,
    co2SavedPerKg: 9.0,
    descriptionEn: "Reward profile for cotton canvas products.",
    descriptionVi: "Cau hinh diem thuong cho vai canvas cotton."
  },
  {
    id: "10a00000-0000-4000-8000-000000000022",
    materialNameEn: "Cotton/Polyester Blend",
    materialNameVi: "Vai pha Cotton/Polyester",
    materialCategory: "fabric",
    pointsPerKg: 26,
    co2SavedPerKg: 6.5,
    descriptionEn: "Reward profile for blended cotton and polyester fabrics.",
    descriptionVi: "Cau hinh diem thuong cho vai pha cotton va polyester."
  },
  {
    id: "10a00000-0000-4000-8000-000000000023",
    materialNameEn: "Wool/Polyester Blend",
    materialNameVi: "Vai pha Len/Polyester",
    materialCategory: "fabric",
    pointsPerKg: 32,
    co2SavedPerKg: 7.5,
    descriptionEn: "Reward profile for blended wool and polyester fabrics.",
    descriptionVi: "Cau hinh diem thuong cho vai pha len va polyester."
  },
  {
    id: "10a00000-0000-4000-8000-000000000024",
    materialNameEn: "Other Material (Proxy)",
    materialNameVi: "Vat lieu khac (Proxy)",
    materialCategory: "fabric",
    pointsPerKg: 24,
    co2SavedPerKg: 6.0,
    descriptionEn: "Fallback reward profile for user-defined materials.",
    descriptionVi: "Cau hinh diem thuong du phong cho vat lieu nguoi dung tu nhap."
  }
];
