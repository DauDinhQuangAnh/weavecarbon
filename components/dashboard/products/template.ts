import * as XLSX from "@e965/xlsx";
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

export const generateTemplate = (format: "xlsx" | "csv" = "xlsx"): void => {
  const wb = XLSX.utils.book_new();

  const headers = TEMPLATE_COLUMNS.map((col) => col.header);
  const sampleData = buildSampleData();
  const sampleRows = sampleData.map((row) =>
    TEMPLATE_COLUMNS.map((col) => row[col.key] ?? "")
  );

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws["!cols"] = TEMPLATE_COLUMNS.map((col) => ({ wch: col.width }));
  XLSX.utils.book_append_sheet(wb, ws, "Product Data");

  const instructionsData = [
    ["BULK IMPORT TEMPLATE GUIDE"],
    [""],
    ["1) Keep headers unchanged."],
    ["2) Required columns are marked with *."],
    ["3) Use code values from 'Allowed Values' sheet for best compatibility."],
    ["4) For export rows: set marketType=export and exportCountry."],
    ["5) processes / certifications / exportComplianceDocuments accept comma-separated values."],
    ["6) accessoriesWeightGram follows accessories order (e.g. accessories=button,zipper and weights=2,5)."],
    ["7) transportMode / transportDistanceKm / route columns are optional. If blank, logistics stays empty for later completion."],
    ["8) transportOrigin / transportDestination can be used as street or address line; city/state/country columns are optional but recommended."],
    ["9) material percentages should sum to 100."],
    ["10) Sample SKU is generated per download to reduce duplicate SKU errors."],
    [""],
    ["Vietnamese aliases are still accepted by parser (e.g. Trong nuoc, Xuat khau, Duong bien)."]
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions["!cols"] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Guide");

  const optionsData = [
    ["ALLOWED VALUES"],
    [""],
    ["productType", "tshirt, pants, dress, jacket, shoes, bag, accessories, other"],
    ["primaryMaterial / secondaryMaterial", "cotton, organic_cotton, polyester, recycled_polyester, nylon, wool, silk, linen, bamboo, hemp, blend"],
    ["certifications", MATERIAL_CERTIFICATION_OPTIONS_TEXT],
    ["materialSource", "domestic, imported, unknown"],
    ["processes", "knitting, weaving, cutting_sewing, dyeing, printing, finishing"],
    ["energySource", "grid, solar, coal, mixed"],
    ["marketType", "domestic, export"],
    ["exportCountry", "eu, us, jp, kr, other"],
    [
      "exportComplianceDocuments",
      "list codes/names of uploaded export docs for selected market (from /export)"
    ],
    ["transportMode", "road, sea, air, rail, multimodal"],
    [
      "transportOrigin / transportDestination",
      "free-text street/address line; pair with city/state/country columns when available"
    ]
  ];

  const wsOptions = XLSX.utils.aoa_to_sheet(optionsData);
  wsOptions["!cols"] = [{ wch: 30 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(wb, wsOptions, "Allowed Values");

  const fileName = `WeaveCarbon_Template_${new Date().toISOString().split("T")[0]}`;

  if (format === "xlsx") {
    XLSX.writeFile(wb, `${fileName}.xlsx`);
    return;
  }

  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
