export type MaterialCertificationCategory =
  | "organic"
  | "recycled"
  | "chemical_safety"
  | "forest"
  | "cotton"
  | "animal_welfare"
  | "biobased_circular";

export interface MaterialCertificationDefinition {
  value: string;
  label: string;
  documentCode: string;
  category: MaterialCertificationCategory;
  tags: string[];
  valueAliases?: string[];
  documentCodeAliases?: string[];
}

export const MATERIAL_CERTIFICATION_DEFINITIONS: MaterialCertificationDefinition[] = [
  {
    value: "gots",
    label: "GOTS — Global Organic Textile Standard",
    documentCode: "cert_gots",
    category: "organic",
    tags: ["organic", "chain_of_custody", "environmental_social"]
  },
  {
    value: "ocs",
    label: "OCS — Organic Content Standard",
    documentCode: "cert_ocs",
    category: "organic",
    tags: ["organic_content", "chain_of_custody"]
  },
  {
    value: "ccs",
    label: "CCS — Content Claim Standard",
    documentCode: "cert_ccs",
    category: "organic",
    tags: ["chain_of_custody", "textile_exchange"]
  },
  {
    value: "usda_organic",
    label: "USDA Organic",
    documentCode: "cert_usda_organic",
    category: "organic",
    tags: ["organic", "us_market"],
    valueAliases: ["usdaorganic"]
  },
  {
    value: "grs",
    label: "GRS — Global Recycled Standard",
    documentCode: "cert_grs",
    category: "recycled",
    tags: ["recycled_content", "chain_of_custody", "chemical_social"]
  },
  {
    value: "rcs",
    label: "RCS — Recycled Claim Standard",
    documentCode: "cert_rcs",
    category: "recycled",
    tags: ["recycled_content", "chain_of_custody"]
  },
  {
    value: "iscc_plus",
    label: "ISCC PLUS",
    documentCode: "cert_iscc_plus",
    category: "recycled",
    tags: ["renewable_feedstock", "recycled_feedstock", "mass_balance"]
  },
  {
    value: "iscc_eu",
    label: "ISCC EU",
    documentCode: "cert_iscc_eu",
    category: "recycled",
    tags: ["eu_framework", "sustainability_chain"]
  },
  {
    value: "ul_recycled_content",
    label: "UL Recycled Content Validation",
    documentCode: "cert_ul_recycled_content",
    category: "recycled",
    tags: ["recycled_content", "us_market"],
    valueAliases: ["ul_recycled", "ulrecycledcontent"]
  },
  {
    value: "oeko_tex",
    label: "OEKO-TEX STANDARD 100",
    documentCode: "cert_oeko_tex",
    category: "chemical_safety",
    tags: ["chemical_safety", "harmful_substance_test"],
    valueAliases: ["oeko_tex_standard_100", "oekotex", "oekotex100"],
    documentCodeAliases: ["cert_oeko_tex_standard_100", "cert_oekotex_standard_100"]
  },
  {
    value: "oeko_tex_made_in_green",
    label: "OEKO-TEX MADE IN GREEN",
    documentCode: "cert_oeko_tex_made_in_green",
    category: "chemical_safety",
    tags: ["chemical_safety", "facility_traceability"]
  },
  {
    value: "oeko_tex_step",
    label: "OEKO-TEX STeP",
    documentCode: "cert_oeko_tex_step",
    category: "chemical_safety",
    tags: ["chemical_management", "facility_certification"]
  },
  {
    value: "oeko_tex_eco_passport",
    label: "OEKO-TEX ECO PASSPORT",
    documentCode: "cert_oeko_tex_eco_passport",
    category: "chemical_safety",
    tags: ["chemical_input", "chemical_management"]
  },
  {
    value: "bluesign",
    label: "bluesign",
    documentCode: "cert_bluesign",
    category: "chemical_safety",
    tags: ["chemical_management", "input_stream_management"]
  },
  {
    value: "zdhc_mrsl_conformance",
    label: "ZDHC MRSL Conformance",
    documentCode: "cert_zdhc_mrsl_conformance",
    category: "chemical_safety",
    tags: ["chemical_management", "mrsl", "zdhc"],
    valueAliases: ["zdhc_mrsl", "mrsl_conformance"]
  },
  {
    value: "fsc",
    label: "FSC — Forest Stewardship Council",
    documentCode: "cert_fsc",
    category: "forest",
    tags: ["forest_origin", "chain_of_custody"]
  },
  {
    value: "pefc",
    label: "PEFC",
    documentCode: "cert_pefc",
    category: "forest",
    tags: ["forest_origin", "chain_of_custody"]
  },
  {
    value: "bci",
    label: "Better Cotton (BCI)",
    documentCode: "cert_bci_cotton",
    category: "cotton",
    tags: ["better_practices", "mass_balance", "cotton"],
    valueAliases: ["better_cotton", "bettercotton"],
    documentCodeAliases: ["cert_better_cotton"]
  },
  {
    value: "cmia",
    label: "CmiA — Cotton made in Africa",
    documentCode: "cert_cmia",
    category: "cotton",
    tags: ["cotton", "africa_program"]
  },
  {
    value: "supima",
    label: "Supima",
    documentCode: "cert_supima",
    category: "cotton",
    tags: ["branded_fiber", "cotton"]
  },
  {
    value: "rws",
    label: "RWS — Responsible Wool Standard",
    documentCode: "cert_rws",
    category: "animal_welfare",
    tags: ["animal_welfare", "wool", "chain_of_custody"]
  },
  {
    value: "rds",
    label: "RDS — Responsible Down Standard",
    documentCode: "cert_rds",
    category: "animal_welfare",
    tags: ["animal_welfare", "down", "chain_of_custody"]
  },
  {
    value: "rms",
    label: "RMS — Responsible Mohair Standard",
    documentCode: "cert_rms",
    category: "animal_welfare",
    tags: ["animal_welfare", "mohair", "chain_of_custody"]
  },
  {
    value: "ras",
    label: "RAS — Responsible Alpaca Standard",
    documentCode: "cert_ras",
    category: "animal_welfare",
    tags: ["animal_welfare", "alpaca", "chain_of_custody"]
  },
  {
    value: "lwg",
    label: "LWG — Leather Working Group",
    documentCode: "cert_lwg",
    category: "animal_welfare",
    tags: ["leather", "facility_audit", "environmental_social"]
  },
  {
    value: "usda_certified_biobased",
    label: "USDA Certified Biobased Product",
    documentCode: "cert_usda_certified_biobased",
    category: "biobased_circular",
    tags: ["biobased_content", "us_market"],
    valueAliases: ["usda_biobased", "usda_biopreferred"]
  },
  {
    value: "ok_biobased",
    label: "OK biobased (TUV AUSTRIA)",
    documentCode: "cert_ok_biobased",
    category: "biobased_circular",
    tags: ["biobased_content", "tuv_austria"]
  },
  {
    value: "en_16785_1_biobased",
    label: "EN 16785-1 Biobased Content",
    documentCode: "cert_en_16785_1_biobased",
    category: "biobased_circular",
    tags: ["biobased_content", "en_16785_1"],
    valueAliases: ["nen_en_16785_1_biobased"]
  },
  {
    value: "c2c",
    label: "Cradle to Cradle Certified (C2C)",
    documentCode: "cert_c2c",
    category: "biobased_circular",
    tags: ["circularity", "material_health", "multi_criteria"]
  }
];

const normalizeToken = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const dedupeStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const VALUE_ALIAS_TO_CANONICAL = new Map<string, string>();
const DOCUMENT_CODE_TO_CANONICAL = new Map<string, string>();

for (const definition of MATERIAL_CERTIFICATION_DEFINITIONS) {
  const canonicalValue = normalizeToken(definition.value);
  if (canonicalValue) {
    VALUE_ALIAS_TO_CANONICAL.set(canonicalValue, definition.value);
  }

  for (const alias of definition.valueAliases || []) {
    const normalizedAlias = normalizeToken(alias);
    if (normalizedAlias) {
      VALUE_ALIAS_TO_CANONICAL.set(normalizedAlias, definition.value);
    }
  }

  const canonicalDocumentCode = normalizeToken(definition.documentCode);
  if (canonicalDocumentCode) {
    DOCUMENT_CODE_TO_CANONICAL.set(canonicalDocumentCode, definition.documentCode);
  }

  for (const aliasCode of definition.documentCodeAliases || []) {
    const normalizedAliasCode = normalizeToken(aliasCode);
    if (normalizedAliasCode) {
      DOCUMENT_CODE_TO_CANONICAL.set(normalizedAliasCode, definition.documentCode);
    }
  }
}

export const normalizeMaterialCertificationValue = (value: string | null | undefined) => {
  const normalized = normalizeToken(value);
  return VALUE_ALIAS_TO_CANONICAL.get(normalized) || normalized || "";
};

export const normalizeMaterialCertificationDocumentCode = (
  code: string | null | undefined
) => {
  const normalized = normalizeToken(code);
  return DOCUMENT_CODE_TO_CANONICAL.get(normalized) || normalized || "";
};

export const MATERIAL_CERTIFICATION_OPTIONS = MATERIAL_CERTIFICATION_DEFINITIONS.map((item) => ({
  value: item.value,
  label: item.label
}));

export const MATERIAL_CERTIFICATION_DOCUMENT_CODES = dedupeStrings(
  MATERIAL_CERTIFICATION_DEFINITIONS.map((item) => item.documentCode)
);

export const MATERIAL_CERTIFICATION_ALL_DOCUMENT_CODES = dedupeStrings(
  MATERIAL_CERTIFICATION_DEFINITIONS.flatMap((item) => [
    item.documentCode,
    ...(item.documentCodeAliases || [])
  ]).map((code) => normalizeMaterialCertificationDocumentCode(code))
);

export const MATERIAL_CERTIFICATION_LABEL_BY_VALUE = MATERIAL_CERTIFICATION_DEFINITIONS.reduce<
  Record<string, string>
>((acc, item) => {
  acc[item.value] = item.label;
  for (const alias of item.valueAliases || []) {
    acc[normalizeMaterialCertificationValue(alias)] = item.label;
  }
  return acc;
}, {});

export const MATERIAL_CERTIFICATION_DOCUMENT_CODE_BY_VALUE =
  MATERIAL_CERTIFICATION_DEFINITIONS.reduce<Record<string, string>>((acc, item) => {
    acc[item.value] = item.documentCode;
    for (const alias of item.valueAliases || []) {
      acc[normalizeMaterialCertificationValue(alias)] = item.documentCode;
    }
    return acc;
  }, {});

export const MATERIAL_CERTIFICATION_VALUE_BY_DOCUMENT_CODE =
  MATERIAL_CERTIFICATION_DEFINITIONS.reduce<Record<string, string>>((acc, item) => {
    const codes = [
      item.documentCode,
      ...(item.documentCodeAliases || []),
      item.documentCode.replace(/^cert_/, "")
    ];
    for (const code of codes) {
      const normalizedCode = normalizeMaterialCertificationDocumentCode(code);
      if (normalizedCode) {
        acc[normalizedCode] = item.value;
      }
    }
    return acc;
  }, {});
