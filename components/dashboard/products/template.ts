import { MATERIAL_CERTIFICATION_OPTIONS } from "@/lib/materialCertificationDefinitions";

interface TemplateColumn {
  key: string;
  header: string;
  width: number;
  required: boolean;
  example: string;
  options?: string;
}

const MATERIAL_CERTIFICATION_VALUES = MATERIAL_CERTIFICATION_OPTIONS.map(
  (item) => item.value
);
const MATERIAL_CERTIFICATION_OPTIONS_TEXT = MATERIAL_CERTIFICATION_VALUES.join(", ");

export const TEMPLATE_COLUMNS: TemplateColumn[] = [
  {
    key: "sku",
    header: "SKU *",
    width: 18,
    required: true,
    example: "SKU-20260301-001"
  },
  {
    key: "productName",
    header: "Product Name *",
    width: 30,
    required: true,
    example: "Organic Cotton T-shirt"
  },
  {
    key: "productType",
    header: "Product Type *",
    width: 24,
    required: true,
    example: "tshirt",
    options: "tshirt, pants, dress, jacket, shoes, bag, accessories, other"
  },
  {
    key: "hsCode",
    header: "HS/CN Code",
    width: 18,
    required: false,
    example: "62052000"
  },
  {
    key: "facility",
    header: "Facility / Factory",
    width: 34,
    required: false,
    example: "Weave Demo Garment Factory - Hanoi"
  },
  {
    key: "quantity",
    header: "Quantity *",
    width: 12,
    required: true,
    example: "1000"
  },
  {
    key: "weightPerUnit",
    header: "Weight Per Unit (gram) *",
    width: 24,
    required: true,
    example: "250"
  },
  {
    key: "primaryMaterial",
    header: "Primary Material *",
    width: 24,
    required: true,
    example: "organic_cotton",
    options:
      "cotton, organic_cotton, polyester, recycled_polyester, nylon, wool, silk, linen, bamboo, hemp, blend"
  },
  {
    key: "primaryMaterialPercentage",
    header: "Primary Material % *",
    width: 20,
    required: true,
    example: "100"
  },
  {
    key: "secondaryMaterial",
    header: "Secondary Material",
    width: 24,
    required: false,
    example: "polyester"
  },
  {
    key: "secondaryMaterialPercentage",
    header: "Secondary Material %",
    width: 22,
    required: false,
    example: "0"
  },
  {
    key: "accessories",
    header: "Accessories",
    width: 28,
    required: false,
    example: "label, thread"
  },
  {
    key: "accessoriesWeightGram",
    header: "Accessories Weight (gram)",
    width: 24,
    required: false,
    example: "2,5"
  },
  {
    key: "certifications",
    header: "Certifications",
    width: 28,
    required: false,
    example: "gots,grs",
    options: MATERIAL_CERTIFICATION_OPTIONS_TEXT
  },
  {
    key: "materialSource",
    header: "Material Source *",
    width: 20,
    required: true,
    example: "domestic",
    options: "domestic, imported, unknown"
  },
  {
    key: "supplierCountry",
    header: "Supplier Country",
    width: 20,
    required: false,
    example: "Vietnam"
  },
  {
    key: "supplyGap",
    header: "Supply Gap / Scope 3 Missing",
    width: 28,
    required: false,
    example: "false",
    options: "true, false"
  },
  {
    key: "evidenceLookupCode",
    header: "Evidence Lookup Code",
    width: 24,
    required: false,
    example: "EVN-HN-009412"
  },
  {
    key: "processes",
    header: "Production Processes *",
    width: 34,
    required: true,
    example: "knitting,cutting_sewing,dyeing",
    options: "knitting, weaving, cutting_sewing, dyeing, printing, finishing"
  },
  {
    key: "energySource",
    header: "Energy Source *",
    width: 18,
    required: true,
    example: "grid",
    options: "grid, solar, coal, mixed"
  },
  {
    key: "manufacturingLocation",
    header: "Manufacturing Location",
    width: 30,
    required: false,
    example: "Bien Hoa, Dong Nai"
  },
  {
    key: "wasteRecovery",
    header: "Waste Recovery",
    width: 18,
    required: false,
    example: "partial",
    options: "none, partial, full, circular (or % e.g. 80%)"
  },
  {
    key: "marketType",
    header: "Market Type *",
    width: 16,
    required: true,
    example: "export",
    options: "domestic, export"
  },
  {
    key: "exportCountry",
    header: "Export Country",
    width: 18,
    required: false,
    example: "eu",
    options: "eu, us, jp, kr, other"
  },
  {
    key: "exportComplianceDocuments",
    header: "Export Compliance Documents",
    width: 40,
    required: false,
    example:
      "textile_fibre_composition_labeling,reach_market_access_compliance_declaration",
    options: "comma-separated document code/name already uploaded in /export for selected market"
  },
  {
    key: "customsDeclarationNo",
    header: "Customs Declaration No",
    width: 24,
    required: false,
    example: "106429381040"
  },
  {
    key: "poContractId",
    header: "PO/Contract ID",
    width: 24,
    required: false,
    example: "PO-2026-TXT-099"
  },
  {
    key: "billOfLadingNo",
    header: "Bill of Lading No",
    width: 24,
    required: false,
    example: "ONEVNHAN260411"
  },
  {
    key: "containerNo",
    header: "Container No",
    width: 20,
    required: false,
    example: "ONEU1234567"
  },
  {
    key: "transportMode",
    header: "Transport Mode",
    width: 18,
    required: false,
    example: "sea",
    options: "road, sea, air, rail, multimodal"
  },
  {
    key: "transportOrigin",
    header: "Transport Origin / Street",
    width: 34,
    required: false,
    example: "Tan Hiep Industrial Zone"
  },
  {
    key: "transportOriginCity",
    header: "Origin City",
    width: 18,
    required: false,
    example: "Bien Hoa"
  },
  {
    key: "transportOriginStateRegion",
    header: "Origin State / Province",
    width: 22,
    required: false,
    example: "Dong Nai"
  },
  {
    key: "transportOriginCountry",
    header: "Origin Country",
    width: 18,
    required: false,
    example: "Vietnam"
  },
  {
    key: "transportDestination",
    header: "Transport Destination / Street",
    width: 34,
    required: false,
    example: "Port of Los Angeles"
  },
  {
    key: "transportDestinationCity",
    header: "Destination City",
    width: 18,
    required: false,
    example: "Los Angeles"
  },
  {
    key: "transportDestinationStateRegion",
    header: "Destination State / Province",
    width: 24,
    required: false,
    example: "California"
  },
  {
    key: "transportDestinationCountry",
    header: "Destination Country",
    width: 22,
    required: false,
    example: "United States"
  },
  {
    key: "transportDistanceKm",
    header: "Transport Distance (km)",
    width: 22,
    required: false,
    example: "11922"
  }
];

const buildSampleData = (): Array<Record<string, string | number>> => {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes()
  ).padStart(2, "0")}`;

  return [
    {
      sku: `SKU-${stamp}-001`,
      productName: "Organic Cotton T-shirt",
      productType: "tshirt",
      quantity: 1000,
      weightPerUnit: 250,
      primaryMaterial: "organic_cotton",
      primaryMaterialPercentage: 100,
      secondaryMaterial: "",
      secondaryMaterialPercentage: 0,
      accessories: "label,thread",
      accessoriesWeightGram: "2,5",
      certifications: "gots,grs",
      materialSource: "domestic",
      processes: "knitting,cutting_sewing",
      energySource: "grid",
      manufacturingLocation: "Bien Hoa, Dong Nai",
      wasteRecovery: "full",
      marketType: "export",
      exportCountry: "eu",
      exportComplianceDocuments:
        "textile_fibre_composition_labeling,reach_market_access_compliance_declaration",
      transportMode: "sea",
      transportOrigin: "Tan Hiep Industrial Zone",
      transportOriginCity: "Bien Hoa",
      transportOriginStateRegion: "Dong Nai",
      transportOriginCountry: "Vietnam",
      transportDestination: "Port of Rotterdam",
      transportDestinationCity: "Rotterdam",
      transportDestinationStateRegion: "South Holland",
      transportDestinationCountry: "Netherlands",
      transportDistanceKm: 10000
    },
    {
      sku: `SKU-${stamp}-002`,
      productName: "Recycled Denim Jeans",
      productType: "pants",
      quantity: 500,
      weightPerUnit: 450,
      primaryMaterial: "recycled_polyester",
      primaryMaterialPercentage: 80,
      secondaryMaterial: "cotton",
      secondaryMaterialPercentage: 20,
      accessories: "button,zipper",
      accessoriesWeightGram: "4,7",
      certifications: "grs,rcs",
      materialSource: "imported",
      processes: "weaving,cutting_sewing,dyeing",
      energySource: "mixed",
      manufacturingLocation: "Thu Duc, Ho Chi Minh City",
      wasteRecovery: "partial",
      marketType: "export",
      exportCountry: "us",
      exportComplianceDocuments: "ftc_textile_labeling_package,country_of_origin_marking",
      transportMode: "sea",
      transportOrigin: "Cat Lai Port",
      transportOriginCity: "Ho Chi Minh City",
      transportOriginStateRegion: "",
      transportOriginCountry: "Vietnam",
      transportDestination: "Port of Los Angeles",
      transportDestinationCity: "Los Angeles",
      transportDestinationStateRegion: "California",
      transportDestinationCountry: "United States",
      transportDistanceKm: 14000
    },
    {
      sku: `SKU-${stamp}-003`,
      productName: "Canvas Tote Bag",
      productType: "bag",
      quantity: 2000,
      weightPerUnit: 180,
      primaryMaterial: "cotton",
      primaryMaterialPercentage: 100,
      secondaryMaterial: "",
      secondaryMaterialPercentage: 0,
      accessories: "strap",
      accessoriesWeightGram: "12",
      certifications: "fsc,bluesign",
      materialSource: "domestic",
      processes: "cutting_sewing,printing",
      energySource: "solar",
      manufacturingLocation: "Tam Hiep, Bien Hoa, Dong Nai",
      wasteRecovery: "partial",
      marketType: "domestic",
      exportCountry: "",
      exportComplianceDocuments: "",
      transportMode: "road",
      transportOrigin: "Tam Hiep",
      transportOriginCity: "Bien Hoa",
      transportOriginStateRegion: "Dong Nai",
      transportOriginCountry: "Vietnam",
      transportDestination: "Dai Dong",
      transportDestinationCity: "",
      transportDestinationStateRegion: "Nghe An",
      transportDestinationCountry: "Vietnam",
      transportDistanceKm: 1250
    }
  ];
};

const csvEscape = (value: unknown): string => {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const generateTemplate = async (format: "xlsx" | "csv" = "xlsx"): Promise<void> => {
  const headers = TEMPLATE_COLUMNS.map((col) => col.header);
  const sampleData = buildSampleData();
  const sampleRows = sampleData.map((row) => TEMPLATE_COLUMNS.map((col) => row[col.key] ?? ""));
  const fileName = `WeaveCarbon_Template_${new Date().toISOString().split("T")[0]}`;

  if (format === "csv") {
    const csv = [
      headers.map(csvEscape).join(","),
      ...sampleRows.map((row) => row.map(csvEscape).join(",")),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  const { downloadFormTemplate } = await import("@/lib/reports/formTemplate");
  await downloadFormTemplate(
    {
      sheets: [
        {
          name: "Product Data",
          title: "M\u1eabu nh\u1eadp s\u1ea3n ph\u1ea9m h\u00e0ng lo\u1ea1t",
          subtitle: "M\u1ed7i d\u00f2ng l\u00e0 m\u1ed9t SKU",
          columns: TEMPLATE_COLUMNS.map((col) => ({ header: col.header, width: col.width })),
          sampleRows,
        },
      ],
      info: [
        {
          name: "Guide",
          title: "H\u01b0\u1edbng d\u1eabn nh\u1eadp li\u1ec7u (Bulk import)",
          rows: [
            "1) Gi\u1eef nguy\u00ean ti\u00eau \u0111\u1ec1 c\u1ed9t.",
            "2) C\u1ed9t b\u1eaft bu\u1ed9c \u0111\u01b0\u1ee3c \u0111\u00e1nh d\u1ea5u *.",
            "3) D\u00f9ng gi\u00e1 tr\u1ecb m\u00e3 trong sheet 'Allowed Values' \u0111\u1ec3 t\u01b0\u01a1ng th\u00edch t\u1ed1t nh\u1ea5t.",
            "4) V\u1edbi d\u00f2ng xu\u1ea5t kh\u1ea9u: \u0111\u1eb7t marketType=export v\u00e0 exportCountry.",
            "5) processes / certifications / exportComplianceDocuments nh\u1eadn nhi\u1ec1u gi\u00e1 tr\u1ecb, ng\u0103n b\u1eb1ng d\u1ea5u ph\u1ea9y.",
            "6) accessoriesWeightGram theo th\u1ee9 t\u1ef1 accessories (vd accessories=button,zipper v\u00e0 weights=2,5).",
            "7) C\u1ed9t transportMode / transportDistanceKm l\u00e0 tu\u1ef3 ch\u1ecdn; \u0111\u1ec3 tr\u1ed1ng th\u00ec logistics \u0111\u1ec3 ho\u00e0n thi\u1ec7n sau.",
            "8) transportOrigin / transportDestination c\u00f3 th\u1ec3 l\u00e0 \u0111\u1ecba ch\u1ec9; city/state/country l\u00e0 tu\u1ef3 ch\u1ecdn nh\u01b0ng n\u00ean c\u00f3.",
            "9) T\u1ed5ng ph\u1ea7n tr\u0103m v\u1eadt li\u1ec7u n\u00ean b\u1eb1ng 100.",
            "10) SKU m\u1eabu \u0111\u01b0\u1ee3c sinh m\u1edbi m\u1ed7i l\u1ea7n t\u1ea3i \u0111\u1ec3 tr\u00e1nh tr\u00f9ng.",
            "Ghi ch\u00fa: parser v\u1eabn ch\u1ea5p nh\u1eadn ti\u1ebfng Vi\u1ec7t (vd Trong nuoc, Xuat khau, Duong bien).",
          ],
        },
        {
          name: "Allowed Values",
          title: "Gi\u00e1 tr\u1ecb h\u1ee3p l\u1ec7",
          rows: [
            ["productType", "tshirt, pants, dress, jacket, shoes, bag, accessories, other"],
            ["primaryMaterial / secondaryMaterial", "cotton, organic_cotton, polyester, recycled_polyester, nylon, wool, silk, linen, bamboo, hemp, blend"],
            ["certifications", MATERIAL_CERTIFICATION_OPTIONS_TEXT],
            ["materialSource", "domestic, imported, unknown"],
            ["processes", "knitting, weaving, cutting_sewing, dyeing, printing, finishing"],
            ["energySource", "grid, solar, coal, mixed"],
            ["marketType", "domestic, export"],
            ["exportCountry", "eu, us, jp, kr, other"],
            ["exportComplianceDocuments", "m\u00e3/t\u00ean ch\u1ee9ng t\u1eeb xu\u1ea5t kh\u1ea9u \u0111\u00e3 t\u1ea3i cho th\u1ecb tr\u01b0\u1eddng \u0111\u00e3 ch\u1ecdn (t\u1eeb /export)"],
            ["transportMode", "road, sea, air, rail, multimodal"],
            ["transportOrigin / transportDestination", "\u0111\u1ecba ch\u1ec9 t\u1ef1 do; gh\u00e9p v\u1edbi c\u1ed9t city/state/country khi c\u00f3"],
          ],
        },
      ],
    },
    `${fileName}.xlsx`,
  );
};
