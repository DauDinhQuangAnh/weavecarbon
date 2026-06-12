import {
  api,
  apiRequest,
  authTokenStore,
  ensureAccessToken,
  isApiError,
  resolveApiUrl
} from "@/lib/apiClient";
import {
  MARKET_CODES,
  MARKET_DOCUMENT_REQUIREMENTS,
  MARKET_REGULATIONS,
  type CarbonDataItem,
  type ComplianceDocument,
  type ComplianceStatus,
  type DocumentStatus,
  type EmissionFactor,
  type MarketCode,
  type MarketCompliance,
  type Priority,
  type ProductScopeItem,
  type Recommendation
} from "@/components/dashboard/export/types";
import { isDemoPath } from "@/lib/demo/routes";

const EXPORT_MARKETS_ENDPOINT = "/export/markets";

type ScopeKey = CarbonDataItem["scope"];

interface UpsertProductInput {
  marketCode: MarketCode;
  operation?: "add" | "edit";
  productId?: string;
  productName: string;
  hsCode: string;
  productionSite: string;
  exportVolume: number;
  unit: string;
}

interface UpsertCarbonInput {
  marketCode: MarketCode;
  scope: ScopeKey;
  value: number;
  unit: string;
  methodology: string;
  dataSource: string;
  reportingPeriod: string;
}

interface ComplianceReportResult {
  reportId: string;
  status: string;
  title: string;
  downloadPath?: string;
}

export interface ComplianceDocumentImportError {
  row: number;
  code: string;
  message: string;
}

export interface ComplianceDocumentImportResult {
  imported: number;
  failed: number;
  errors: ComplianceDocumentImportError[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asString = (value: unknown, fallback = "") => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
};

const asNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const asCount = (value: unknown, fallback = 0) =>
  Math.max(0, Math.trunc(asNumber(value, fallback)));

const asBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }
  return fallback;
};

const asArray = <T = unknown,>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

const asCollection = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (isObject(value)) return Object.values(value);
  return [];
};

const asStringArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => asString(entry).trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return [];
    return normalized
      .split(/\r?\n|;|\|/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeDocumentKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

const MARKET_CODE_SET = new Set<string>(MARKET_CODES);

const toMarketCode = (value: unknown): MarketCode | null => {
  const normalized = asString(value).trim().toUpperCase();
  if (MARKET_CODE_SET.has(normalized)) {
    return normalized as MarketCode;
  }
  return null;
};

const toComplianceStatus = (value: unknown, score: number): ComplianceStatus => {
  const normalized = asString(value).trim().toLowerCase();
  if (
    normalized === "draft" ||
    normalized === "incomplete" ||
    normalized === "ready" ||
    normalized === "verified"
  ) {
    return normalized;
  }

  if (score >= 90) return "verified";
  if (score >= 80) return "ready";
  if (score >= 50) return "incomplete";
  return "draft";
};

const toDocumentStatus = (value: unknown): DocumentStatus => {
  const normalized = asString(value).trim().toLowerCase();
  if (
    normalized === "missing" ||
    normalized === "uploaded" ||
    normalized === "approved" ||
    normalized === "expired"
  ) {
    return normalized;
  }

  if (normalized.includes("approve") || normalized.includes("valid")) {
    return "approved";
  }
  if (normalized.includes("upload") || normalized.includes("pending")) {
    return "uploaded";
  }
  if (normalized.includes("expire")) {
    return "expired";
  }
  return "missing";
};

const toPriority = (value: unknown): Priority => {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === "mandatory" || normalized === "important" || normalized === "recommended") {
    return normalized;
  }
  if (normalized === "high") return "mandatory";
  if (normalized === "medium") return "important";
  return "recommended";
};

const UUID_LIKE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJECT_ID_LIKE_REGEX = /^[0-9a-f]{24}$/i;
const ULID_LIKE_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const toIdentifierString = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (isObject(value)) {
    return asString(
      value.recommendation_id ??
        value.recommendationId ??
        value.uuid ??
        value.id ??
        value.$oid,
      ""
    ).trim();
  }
  return "";
};

const uniqueStrings = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
};

const collectStrictIdentifiersDeep = (value: unknown, depth = 0): string[] => {
  if (depth > 4) return [];

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    const directMatches: string[] = [];
    if (UUID_LIKE_REGEX.test(trimmed)) directMatches.push(trimmed);
    if (OBJECT_ID_LIKE_REGEX.test(trimmed)) directMatches.push(trimmed);
    if (ULID_LIKE_REGEX.test(trimmed)) directMatches.push(trimmed);

    const embeddedMatches = trimmed.match(UUID_LIKE_REGEX);
    if (embeddedMatches) {
      directMatches.push(...embeddedMatches);
    }

    return uniqueStrings(directMatches);
  }

  if (Array.isArray(value)) {
    return uniqueStrings(value.flatMap((entry) => collectStrictIdentifiersDeep(entry, depth + 1)));
  }

  if (!isObject(value)) {
    return [];
  }

  return uniqueStrings(
    Object.values(value).flatMap((entry) => collectStrictIdentifiersDeep(entry, depth + 1))
  );
};

const collectRecommendationIdCandidates = (recommendation: Record<string, unknown>) =>
  uniqueStrings([
    ...[
      recommendation.recommendation_id,
      recommendation.recommendationId,
      recommendation.recommendation_uuid,
      recommendation.recommendationUuid,
      recommendation.uuid,
      recommendation._id,
      recommendation.id
    ]
      .map(toIdentifierString)
      .filter(Boolean),
    ...Object.entries(recommendation)
      .filter(([key]) => key.toLowerCase().includes("id"))
      .map(([, value]) => toIdentifierString(value))
      .filter(Boolean)
    ,
    ...collectStrictIdentifiersDeep(recommendation)
  ]);

const isLikelyRecommendationId = (value: string) => {
  if (UUID_LIKE_REGEX.test(value)) return true;
  if (OBJECT_ID_LIKE_REGEX.test(value)) return true;
  if (ULID_LIKE_REGEX.test(value)) return true;
  return false;
};

const pickRecommendationId = (recommendation: Record<string, unknown>, index: number) => {
  const candidates = collectRecommendationIdCandidates(recommendation);

  const strictUuid = candidates.find((candidate) => UUID_LIKE_REGEX.test(candidate));
  if (strictUuid) return strictUuid;

  const strictObjectId = candidates.find((candidate) => OBJECT_ID_LIKE_REGEX.test(candidate));
  if (strictObjectId) return strictObjectId;

  const strictUlid = candidates.find((candidate) => ULID_LIKE_REGEX.test(candidate));
  if (strictUlid) return strictUlid;

  const embeddedUuid = candidates
    .map((candidate) => candidate.match(UUID_LIKE_REGEX)?.[0] || "")
    .find(Boolean);
  if (embeddedUuid) return embeddedUuid;

  const likelyId = candidates.find((candidate) => isLikelyRecommendationId(candidate));
  if (likelyId) return likelyId;

  return `recommendation-${index + 1}`;
};

const normalizeRecommendationAction = (value: unknown) => {
  const normalized = asString(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (
    normalized === "" ||
    normalized === "apply" ||
    normalized === "done" ||
    normalized === "complete" ||
    normalized === "completed" ||
    normalized === "mark_complete" ||
    normalized === "mark_completed"
  ) {
    return "mark_completed";
  }

  return normalized;
};

const toScope = (value: unknown): ScopeKey | null => {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === "scope1" || normalized === "scope2" || normalized === "scope3") {
    return normalized;
  }
  return null;
};

const toIsoDate = (value: unknown) => {
  const raw = asString(value);
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  return raw;
};

const parseErrorResponse = async (response: Response) => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as unknown;
      if (typeof payload === "string" && payload.trim().length > 0) {
        return payload;
      }
      if (isObject(payload)) {
        if (typeof payload.message === "string" && payload.message.trim().length > 0) {
          return payload.message;
        }
        if (typeof payload.error === "string" && payload.error.trim().length > 0) {
          return payload.error;
        }
        if (isObject(payload.error) && typeof payload.error.message === "string") {
          return payload.error.message;
        }
      }
    } catch {
      return "Request failed.";
    }
  }

  try {
    const text = await response.text();
    return text.trim().length > 0 ? text : "Request failed.";
  } catch {
    return "Request failed.";
  }
};

const parseFilenameFromDisposition = (disposition: string | null, fallback: string) => {
  if (!disposition) return fallback;
  const match = disposition.match(
    /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i
  );
  const raw = match?.[1] || match?.[2];
  if (!raw) return fallback;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const DOWNLOAD_URL_CANDIDATE_KEYS = [
  "download_url",
  "downloadUrl",
  "file_url",
  "fileUrl",
  "document_url",
  "documentUrl",
  "signed_url",
  "signedUrl",
  "presigned_url",
  "presignedUrl",
  "url",
  "path",
  "file_path",
  "filePath"
] as const;

const isPdfContentType = (contentType: string) =>
  contentType.toLowerCase().includes("application/pdf");

const ensurePdfBlobType = (blob: Blob) =>
  blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });

const hasPdfSignature = async (blob: Blob) => {
  try {
    const signature = await blob.slice(0, 5).text();
    return signature === "%PDF-";
  } catch {
    return false;
  }
};

const inferFilenameFromUrl = (url: string, fallback: string) => {
  try {
    const parsed = new URL(url, resolveApiUrl("/"));
    const rawName = decodeURIComponent(parsed.pathname.split("/").pop() || "").trim();
    return rawName || fallback;
  } catch {
    return fallback;
  }
};

const toAbsoluteDownloadUrl = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return "";

  if (
    /^https?:\/\//i.test(normalized) ||
    normalized.startsWith("data:") ||
    normalized.startsWith("blob:")
  ) {
    return normalized;
  }

  if (normalized.startsWith("/demo-assets/")) {
    return normalized;
  }

  if (normalized.startsWith("/")) {
    return resolveApiUrl(normalized);
  }

  if (normalized.startsWith("api/")) {
    return resolveApiUrl(`/${normalized}`);
  }

  if (normalized.includes("/")) {
    return resolveApiUrl(`/${normalized.replace(/^\/+/, "")}`);
  }

  return "";
};

const extractDownloadUrlFromPayload = (payload: unknown, depth = 0): string | null => {
  if (depth > 4) return null;

  if (typeof payload === "string") {
    const resolved = toAbsoluteDownloadUrl(payload);
    return resolved || null;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const nested = extractDownloadUrlFromPayload(item, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  if (!isObject(payload)) return null;

  for (const key of DOWNLOAD_URL_CANDIDATE_KEYS) {
    const rawValue = payload[key];
    const resolved = toAbsoluteDownloadUrl(asString(rawValue, ""));
    if (resolved) return resolved;
  }

  const nestedKeyCandidates = ["data", "result", "document", "file", "payload"] as const;
  for (const key of nestedKeyCandidates) {
    if (!(key in payload)) continue;
    const nested = extractDownloadUrlFromPayload(payload[key], depth + 1);
    if (nested) return nested;
  }

  for (const value of Object.values(payload)) {
    const nested = extractDownloadUrlFromPayload(value, depth + 1);
    if (nested) return nested;
  }

  return null;
};

const shouldTryParseBodyAsDownloadPointer = (contentType: string, size: number) =>
  contentType.includes("application/json") ||
  contentType.startsWith("text/") ||
  size <= 4096;

const isSameOriginAsApi = (url: string) => {
  try {
    const apiOrigin = new URL(resolveApiUrl("/")).origin;
    const targetOrigin = new URL(url, resolveApiUrl("/")).origin;
    return apiOrigin === targetOrigin;
  } catch {
    return false;
  }
};

const isDemoRuntime = () =>
  typeof window !== "undefined" && isDemoPath(window.location.pathname);

const fetchWithOptionalAuth = async (url: string, accessToken: string | null) => {
  const sameOrigin = isSameOriginAsApi(url);
  return fetch(url, {
    method: "GET",
    credentials: sameOrigin ? "include" : "omit",
    headers:
      sameOrigin && accessToken
        ? {
            Authorization: `Bearer ${accessToken}`
          }
        : undefined
  });
};

const normalizePdfFilename = (filename: string) => {
  const trimmed = filename.trim();
  if (!trimmed) return "compliance-document.pdf";
  return trimmed.toLowerCase().endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
};

const resolvePdfBlobFromResponse = async (
  response: Response,
  fallbackFilename: string,
  accessToken: string | null,
  allowPointerResolution = true
): Promise<{ blob: Blob; filename: string }> => {
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const filename = parseFilenameFromDisposition(
    response.headers.get("content-disposition"),
    fallbackFilename
  );
  const blob = await response.blob();

  if (blob.size <= 0) {
    throw new Error("Downloaded file is empty.");
  }

  const pdfFromHeader = isPdfContentType(contentType) || isPdfContentType(blob.type || "");
  const pdfFromSignature = await hasPdfSignature(blob);
  if (pdfFromHeader || pdfFromSignature) {
    return {
      blob: ensurePdfBlobType(blob),
      filename: normalizePdfFilename(filename)
    };
  }

  if (allowPointerResolution && shouldTryParseBodyAsDownloadPointer(contentType, blob.size)) {
    const payloadText = (await blob.text()).trim();
    if (payloadText) {
      if (payloadText.toLowerCase().includes("weavecarbon dev placeholder document")) {
        throw new Error("Document file is not available yet. Please upload the actual PDF again.");
      }

      let pointerPayload: unknown = payloadText;
      try {
        pointerPayload = JSON.parse(payloadText) as unknown;
      } catch {
        pointerPayload = payloadText;
      }

      const downloadUrl = extractDownloadUrlFromPayload(pointerPayload);
      if (downloadUrl) {
        const pointedResponse = await fetchWithOptionalAuth(downloadUrl, accessToken);
        return resolvePdfBlobFromResponse(
          pointedResponse,
          inferFilenameFromUrl(downloadUrl, fallbackFilename),
          accessToken,
          false
        );
      }
    }
  }

  throw new Error("Document content is not a valid PDF.");
};

const normalizeDocuments = (value: unknown): ComplianceDocument[] =>
  asArray(value)
    .filter(isObject)
    .map((document, index) => ({
      id:
        asString(
          document.id ??
            document.document_id ??
            document.document_code ??
            document.code ??
            document.requirement_id,
          ""
        ) ||
        `doc-${index + 1}`,
      code:
        asString(
          document.document_code ??
            document.code ??
            document.requirement_code,
          ""
        ) || undefined,
      name: asString(
        document.name ??
          document.document_name ??
          document.document_code ??
          document.code,
        `Document ${index + 1}`
      ),
      type: asString(
        document.type ?? document.document_type ?? document.document_group ?? document.group,
        "general"
      ),
      required: asBoolean(document.required ?? document.is_required, false),
      status: toDocumentStatus(document.status),
      downloadUrl:
        toAbsoluteDownloadUrl(
          asString(
            document.download_url ??
              document.downloadUrl ??
              document.file_url ??
              document.fileUrl ??
              document.document_url ??
              document.documentUrl ??
              document.signed_url ??
              document.signedUrl ??
              document.presigned_url ??
              document.presignedUrl ??
              document.file_path ??
              document.filePath ??
              document.path ??
              document.url,
            ""
          )
        ) || undefined,
      uploadedBy: asString(
        document.uploaded_by_name ?? document.uploaded_by ?? document.updated_by,
        ""
      ) || undefined,
      uploadedDate: asString(document.uploaded_at ?? document.uploaded_date, "") || undefined,
      validFrom: asString(document.valid_from, "") || undefined,
      validTo: asString(document.valid_to ?? document.expires_at, "") || undefined,
      linkedProducts: asArray(document.linked_products ?? document.products)
        .map((entry) => asString(entry))
        .filter(Boolean)
    }));

interface DocumentRequirementItem {
  id: string;
  name: string;
  required: boolean;
  type: string;
  matchKeys: string[];
}

const normalizeDocumentRequirements = (value: unknown): DocumentRequirementItem[] =>
  asCollection(value)
    .map((requirement, index) => {
      if (!isObject(requirement)) {
        const raw = asString(requirement, "").trim();
        if (!raw) return null;
        return {
          id: `required-doc-${index + 1}`,
          name: raw,
          required: true,
          type: "general",
          matchKeys: [raw]
        };
      }

      const id = asString(
        requirement.id ??
          requirement.document_id ??
          requirement.document_code ??
          requirement.requirement_id ??
          requirement.requirement_code,
        ""
      ).trim();
      const name = asString(
        requirement.name ??
          requirement.title ??
          requirement.document_name ??
          requirement.requirement_name ??
          requirement.document_code ??
          requirement.requirement_code,
        ""
      ).trim();
      const type = asString(
        requirement.type ?? requirement.document_type ?? requirement.category,
        "general"
      ).trim();
      const rawKeys = [
        id,
        name,
        asString(requirement.document_code, "").trim(),
        asString(requirement.requirement_code, "").trim(),
        asString(requirement.document_id, "").trim(),
        asString(requirement.requirement_id, "").trim(),
        asString(requirement.code, "").trim()
      ].filter(Boolean);

      if (rawKeys.length === 0) return null;

      return {
        id: id || `required-doc-${index + 1}`,
        name: name || id || `Required document ${index + 1}`,
        required: asBoolean(
          requirement.required ??
            requirement.is_required ??
            requirement.mandatory ??
            (asString(requirement.priority).toLowerCase() === "mandatory"),
          true
        ),
        type: type || "general",
        matchKeys: uniqueStrings(rawKeys)
      };
    })
    .filter((item): item is DocumentRequirementItem => item !== null)
    .filter((item) => item.matchKeys.length > 0);

const normalizeRequiredDocumentNames = (value: unknown): string[] =>
  uniqueStrings(
    asCollection(value)
      .map((entry) => {
        if (!isObject(entry)) {
          return asString(entry, "").trim();
        }

        return asString(
          entry.name ??
            entry.title ??
            entry.document_name ??
            entry.requirement_name ??
            entry.document_code ??
            entry.requirement_id ??
            entry.id,
          ""
        ).trim();
      })
      .filter(Boolean)
  );

const isDocumentFulfilledStatus = (status: DocumentStatus) => status === "uploaded" || status === "approved";

const applyMarketDocumentRequirementsFallback = (
  marketCode: MarketCode,
  documents: ComplianceDocument[]
) => {
  const fallbackRequirements = MARKET_DOCUMENT_REQUIREMENTS[marketCode];
  if (!fallbackRequirements || fallbackRequirements.length === 0) {
    return documents;
  }

  const requirementByKey = new Map<string, { name: string; required: boolean }>();
  for (const requirement of fallbackRequirements) {
    const key = normalizeDocumentKey(requirement.name);
    if (!key || requirementByKey.has(key)) continue;
    requirementByKey.set(key, requirement);
  }

  const mergedDocuments = documents.map((document) => {
    const documentKeys = uniqueStrings([
      document.id,
      document.code ?? "",
      document.name,
      document.type
    ])
      .map(normalizeDocumentKey)
      .filter(Boolean);

    const matchedRequirement = documentKeys
      .map((key) => requirementByKey.get(key))
      .find((item): item is { name: string; required: boolean } => Boolean(item));
    if (!matchedRequirement) {
      return document;
    }

    return {
      ...document,
      // Market fallback must be authoritative so optional docs are not forced to required.
      required: matchedRequirement.required
    };
  });

  const existingKeys = new Set(
    mergedDocuments
      .flatMap((document) =>
        uniqueStrings([document.id, document.code ?? "", document.name, document.type]).map(
          normalizeDocumentKey
        )
      )
      .filter(Boolean)
  );

  fallbackRequirements.forEach((requirement, index) => {
    const key = normalizeDocumentKey(requirement.name);
    if (!key || existingKeys.has(key)) return;

    mergedDocuments.push({
      id: `fallback-${marketCode}-${index + 1}`,
      name: requirement.name,
      type: "document",
      required: requirement.required,
      status: "missing",
      linkedProducts: []
    });
    existingKeys.add(key);
  });

  return mergedDocuments;
};

const mergeDocumentsWithRequirements = (
  documents: ComplianceDocument[],
  requirements: DocumentRequirementItem[]
) => {
  if (requirements.length === 0) {
    return documents;
  }

  const requirementByKey = new Map<string, DocumentRequirementItem>();
  for (const requirement of requirements) {
    const keys = uniqueStrings([requirement.id, requirement.name, ...requirement.matchKeys])
      .map(normalizeDocumentKey)
      .filter(Boolean);
    for (const key of keys) {
      if (!requirementByKey.has(key)) {
        requirementByKey.set(key, requirement);
      }
    }
  }

  const mergedDocuments = documents.map((document) => {
    const documentKeys = uniqueStrings([document.id, document.name, document.type])
      .map(normalizeDocumentKey)
      .filter(Boolean);
    const requirement = documentKeys
      .map((key) => requirementByKey.get(key))
      .find((entry): entry is DocumentRequirementItem => Boolean(entry));
    if (!requirement) return document;
    return {
      ...document,
      required: requirement.required,
      type: document.type || requirement.type
    };
  });

  const existingKeys = new Set(
    mergedDocuments
      .flatMap((document) =>
        uniqueStrings([document.id, document.name, document.type]).map(normalizeDocumentKey)
      )
      .filter(Boolean)
  );

  for (const requirement of requirements) {
    const requirementKeys = uniqueStrings([requirement.id, requirement.name, ...requirement.matchKeys])
      .map(normalizeDocumentKey)
      .filter(Boolean);
    if (requirementKeys.some((key) => existingKeys.has(key))) {
      continue;
    }
    if (!requirement.name.trim()) {
      continue;
    }

    mergedDocuments.push({
      id: requirement.id,
      name: requirement.name,
      type: requirement.type,
      required: requirement.required,
      status: "missing",
      linkedProducts: []
    });
    for (const key of requirementKeys) {
      existingKeys.add(key);
    }
  }

  return mergedDocuments;
};

const normalizeProductScope = (value: unknown): ProductScopeItem[] =>
  asArray(value)
    .filter(isObject)
    .map((product, index) => ({
      productId:
        asString(product.product_id ?? product.id, "") ||
        `product-${index + 1}`,
      productName: asString(product.product_name ?? product.name, ""),
      hsCode: asString(product.hs_code ?? product.hsCode, ""),
      productionSite: asString(
        product.production_site ?? product.productionSite ?? product.site,
        ""
      ),
      exportVolume: Math.max(0, asNumber(product.export_volume ?? product.exportVolume, 0)),
      unit: asString(product.unit, "pcs")
    }))
    .filter((item) => item.productName.length > 0);

const normalizeCarbonData = (value: unknown): CarbonDataItem[] => {
  const byScope = new Map<ScopeKey, CarbonDataItem>();
  const sourceArray = Array.isArray(value)
    ? value
    : isObject(value)
      ? [value.scope1, value.scope2, value.scope3]
      : [];

  for (const entry of sourceArray) {
    if (!isObject(entry)) continue;
    const scope = toScope(entry.scope ?? entry.scope_code ?? entry.key);
    if (!scope) continue;

    const rawValue = entry.value ?? entry.emission_value;
    const normalizedValue =
      rawValue === null || rawValue === undefined ? null : asNumber(rawValue, 0);

    byScope.set(scope, {
      scope,
      value: normalizedValue,
      unit: asString(entry.unit, "kgCO2e"),
      methodology: asString(entry.methodology, "GHG Protocol"),
      dataSource: asString(entry.data_source ?? entry.dataSource, ""),
      reportingPeriod: asString(entry.reporting_period ?? entry.reportingPeriod, ""),
      isComplete: asBoolean(
        entry.is_complete,
        normalizedValue !== null && asString(entry.methodology).length > 0
      )
    });
  }

  const orderedScopes: ScopeKey[] = ["scope1", "scope2", "scope3"];
  return orderedScopes.map((scope) => {
    const current = byScope.get(scope);
    if (current) return current;
    return {
      scope,
      value: null,
      unit: "kgCO2e",
      methodology: "",
      dataSource: "",
      reportingPeriod: "",
      isComplete: false
    };
  });
};

const normalizeEmissionFactors = (value: unknown): EmissionFactor[] =>
  asArray(value)
    .filter(isObject)
    .map((factor) => ({
      name: asString(factor.name, "Unknown factor"),
      source: asString(factor.source, "Unknown source"),
      version: asString(factor.version, "N/A"),
      appliedDate: toIsoDate(factor.applied_date ?? factor.appliedDate)
    }));

const normalizeRecommendations = (value: unknown): Recommendation[] =>
  asArray(value)
    .filter(isObject)
    .map((recommendation, index) => {
      const apiIdCandidates = collectRecommendationIdCandidates(recommendation);
      const recommendedAction = asStringArray(
        recommendation.recommended_action ??
          recommendation.recommendedAction ??
          recommendation.actions ??
          recommendation.action_guide ??
          recommendation.actionGuide ??
          recommendation.steps ??
          recommendation.suggested_steps
      );

      const missingItem = asString(
        recommendation.missing_item ??
          recommendation.missingItem ??
          recommendation.title ??
          recommendation.name ??
          recommendation.document_name ??
          recommendation.requirement_name,
        ""
      ).trim();

      const regulatoryReason = asString(
        recommendation.regulatory_reason ??
          recommendation.regulatoryReason ??
          recommendation.legal_reason ??
          recommendation.legalReason ??
          recommendation.reason ??
          recommendation.description,
        ""
      ).trim();

      const businessImpact = asString(
        recommendation.business_impact ??
          recommendation.businessImpact ??
          recommendation.impact_if_missing ??
          recommendation.impactIfMissing ??
          recommendation.missing_impact ??
          recommendation.missingImpact ??
          recommendation.consequence_if_missing ??
          recommendation.consequenceIfMissing ??
          recommendation.business_risk ??
          recommendation.businessRisk ??
          recommendation.risk_if_missing ??
          recommendation.riskIfMissing ??
          (isObject(recommendation.impact)
            ? recommendation.impact.if_missing ??
              recommendation.impact.ifMissing ??
              recommendation.impact.message ??
              recommendation.impact.description
            : undefined) ??
          recommendation.impact ??
          recommendation.impact_message ??
          recommendation.consequence,
        ""
      ).trim();

      return {
        id: pickRecommendationId(recommendation, index),
        apiIdCandidates,
        relatedDocumentId:
          asString(
            recommendation.document_id ??
              recommendation.documentId ??
              recommendation.missing_document_id ??
              recommendation.missingDocumentId ??
              recommendation.requirement_id ??
              recommendation.requirementId,
            ""
          ) || undefined,
        type: (() => {
          const raw = asString(
            recommendation.type ?? recommendation.category ?? recommendation.scope
          ).toLowerCase();
          if (
            raw === "document" ||
            raw === "carbon_data" ||
            raw === "verification" ||
            raw === "product_scope"
          ) {
            return raw;
          }
          if (raw.includes("carbon")) return "carbon_data";
          if (raw.includes("verify")) return "verification";
          if (raw.includes("product")) return "product_scope";
          return "document";
        })(),
        missingItem: missingItem || "Missing compliance item",
        regulatoryReason: regulatoryReason || "No legal reason provided.",
        businessImpact: businessImpact || "Chua co thong tin anh huong neu thieu.",
        recommendedAction,
        priority: toPriority(
          recommendation.priority ?? recommendation.severity ?? recommendation.impact_level
        ),
        ctaLabel: asString(
          recommendation.cta_label ??
            recommendation.ctaLabel ??
            recommendation.action_label ??
            recommendation.button_label,
          "Apply"
        ),
        ctaAction: normalizeRecommendationAction(
          recommendation.cta_action ??
            recommendation.ctaAction ??
            recommendation.action ??
            recommendation.action_type
        ),
        status: (() => {
          const raw = asString(recommendation.status).toLowerCase();
          if (raw === "active" || raw === "completed" || raw === "ignored" || raw === "pending") {
            if (raw === "pending") return "active";
            return raw;
          }
          return "active";
        })()
      };
    });

const normalizeMarketCompliance = (value: unknown): MarketCompliance | null => {
  if (!isObject(value)) return null;

  const marketCode = toMarketCode(
    value.market_code ?? value.market ?? value.code ?? value.target_market
  );
  if (!marketCode) return null;

  const score = Math.max(0, Math.min(100, asNumber(value.score, 0)));

  const regulationPayload = isObject(value.regulation)
    ? value.regulation
    : MARKET_REGULATIONS[marketCode];
  const regulationRecord = regulationPayload as Record<string, unknown>;

  const normalizedDocuments = normalizeDocuments(
    value.documents ?? value.document_list ?? value.compliance_documents
  );
  const normalizedRequirements = normalizeDocumentRequirements(
    value.document_requirements ??
      value.required_documents ??
      value.documents_required ??
      value.requirements
  );
  const mergedDocuments = mergeDocumentsWithRequirements(normalizedDocuments, normalizedRequirements);
  const requiredDocumentsFromList = normalizeRequiredDocumentNames(
    value.required_documents ?? value.requiredDocuments
  );
  const requiredDocumentKeySet = new Set(
    requiredDocumentsFromList.map(normalizeDocumentKey).filter(Boolean)
  );
  const shouldApplyRequiredNamesFallback =
    normalizedRequirements.length === 0 && requiredDocumentKeySet.size > 0;
  const documentsWithRequiredFlag = shouldApplyRequiredNamesFallback
    ? mergedDocuments.map((document) => {
        if (document.required) return document;
        const documentKeys = uniqueStrings([document.id, document.name, document.type])
          .map(normalizeDocumentKey)
          .filter(Boolean);
        if (documentKeys.some((key) => requiredDocumentKeySet.has(key))) {
          return { ...document, required: true };
        }
        return document;
      })
    : mergedDocuments;
  const documentsWithMarketFallback = applyMarketDocumentRequirementsFallback(
    marketCode,
    documentsWithRequiredFlag
  );
  const requiredDocumentsFromMerged = documentsWithMarketFallback.filter((document) => document.required);
  const requiredDocumentsUploadedFromMerged = requiredDocumentsFromMerged.filter((document) =>
    isDocumentFulfilledStatus(document.status)
  ).length;
  const requiredDocumentsMissingFromMerged = Math.max(
    0,
    requiredDocumentsFromMerged.length - requiredDocumentsUploadedFromMerged
  );
  const documentsUploadedFromMerged = documentsWithMarketFallback.filter((document) =>
    isDocumentFulfilledStatus(document.status)
  ).length;
  const documentsMissingFromMerged = Math.max(
    0,
    documentsWithMarketFallback.length - documentsUploadedFromMerged
  );
  const requiredDocuments =
    shouldApplyRequiredNamesFallback && requiredDocumentsFromList.length > 0
      ? requiredDocumentsFromList
      : uniqueStrings(requiredDocumentsFromMerged.map((document) => document.name).filter(Boolean));

  return {
    market: marketCode,
    marketName: asString(value.market_name ?? value.marketName, marketCode),
    regulation: {
      code: asString(regulationRecord.code, MARKET_REGULATIONS[marketCode].code),
      name: asString(regulationRecord.name, MARKET_REGULATIONS[marketCode].name),
      legalReference: asString(
        regulationRecord.legal_reference ?? regulationRecord.legalReference,
        MARKET_REGULATIONS[marketCode].legalReference
      ),
      guideUrl: asString(
        regulationRecord.guide_url ?? regulationRecord.guideUrl,
        MARKET_REGULATIONS[marketCode].guideUrl
      ),
      reportingScope: asString(
        regulationRecord.reporting_scope ?? regulationRecord.reportingScope,
        MARKET_REGULATIONS[marketCode].reportingScope
      ),
      reportingFrequency: asString(
        regulationRecord.reporting_frequency ?? regulationRecord.reportingFrequency,
        MARKET_REGULATIONS[marketCode].reportingFrequency
      ),
      enforcementDate: asString(
        regulationRecord.enforcement_date ?? regulationRecord.enforcementDate,
        MARKET_REGULATIONS[marketCode].enforcementDate
      ),
      description: asString(
        regulationRecord.description,
        MARKET_REGULATIONS[marketCode].description
      )
    },
    score,
    status: toComplianceStatus(value.status, score),
    lastUpdated: toIsoDate(value.updated_at ?? value.last_updated ?? value.lastUpdated),
    requiredDocuments,
    requiredDocumentsCount: asCount(
      value.required_documents_count ?? value.requiredDocumentsCount,
      requiredDocumentsFromMerged.length
    ),
    requiredDocumentsUploadedCount: asCount(
      value.required_documents_uploaded_count ?? value.requiredDocumentsUploadedCount,
      requiredDocumentsUploadedFromMerged
    ),
    requiredDocumentsMissingCount: asCount(
      value.required_documents_missing_count ?? value.requiredDocumentsMissingCount,
      requiredDocumentsMissingFromMerged
    ),
    documentsTotalCount: asCount(
      value.documents_total_count ?? value.documentsTotalCount,
      documentsWithMarketFallback.length
    ),
    documentsUploadedCount: asCount(
      value.documents_uploaded_count ?? value.documentsUploadedCount,
      documentsUploadedFromMerged
    ),
    documentsMissingCount: asCount(
      value.documents_missing_count ?? value.documentsMissingCount,
      documentsMissingFromMerged
    ),
    documents: documentsWithMarketFallback,
    carbonData: normalizeCarbonData(value.carbon_data ?? value.carbonData),
    productScope: normalizeProductScope(value.product_scope ?? value.productScope),
    emissionFactors: normalizeEmissionFactors(
      value.emission_factors ?? value.emissionFactors
    ),
    recommendations: normalizeRecommendations(value.recommendations),
    verificationRequired: asBoolean(
      value.verification_required ?? value.verificationRequired,
      false
    ),
    verifiedBy:
      asString(value.verified_by_name ?? value.verified_by, "") || undefined,
    verificationStatus: (() => {
      const raw = asString(value.verification_status ?? value.verificationStatus).toLowerCase();
      if (raw === "pending" || raw === "verified" || raw === "rejected") {
        return raw;
      }
      return undefined;
    })(),
    approvalNote: asString(value.approval_note ?? value.approvalNote, "") || undefined
  };
};

const normalizeMarketsPayload = (payload: unknown): Record<MarketCode, MarketCompliance> => {
  const result: Partial<Record<MarketCode, MarketCompliance>> = {};
  const addMarket = (entry: unknown, keyHint?: MarketCode) => {
    const withHint =
      keyHint && isObject(entry)
        ? {
            ...entry,
            market_code:
              entry.market_code ??
              entry.market ??
              entry.code ??
              entry.target_market ??
              keyHint
          }
        : entry;
    const normalized = normalizeMarketCompliance(withHint);
    if (!normalized) return;
    result[normalized.market] = normalized;
  };

  const items = Array.isArray(payload)
    ? payload
    : isObject(payload) && Array.isArray(payload.markets)
      ? payload.markets
      : isObject(payload) && Array.isArray(payload.items)
        ? payload.items
        : isObject(payload) && Array.isArray(payload.data)
          ? payload.data
          : [];

  for (const item of items) {
    addMarket(item);
  }

  if (Object.keys(result).length === 0 && isObject(payload)) {
    for (const [key, value] of Object.entries(payload)) {
      const keyAsMarketCode = toMarketCode(key);
      if (!keyAsMarketCode || !isObject(value)) continue;
      addMarket(value, keyAsMarketCode);
    }
  }

  return result as Record<MarketCode, MarketCompliance>;
};

const normalizeComplianceReportResult = (
  payload: unknown,
  marketCode: MarketCode
): ComplianceReportResult => {
  const candidate =
    isObject(payload) && isObject(payload.report)
      ? payload.report
      : isObject(payload) && isObject(payload.data)
        ? payload.data
        : payload;

  if (!isObject(candidate)) {
    throw new Error("Invalid compliance report response.");
  }

  const reportId = asString(
    candidate.id ?? candidate.report_id ?? candidate.reportId,
    ""
  );
  if (!reportId) {
    throw new Error("Compliance report response missing id.");
  }

  return {
    reportId,
    status: asString(candidate.status, "processing"),
    title: asString(
      candidate.title,
      `${marketCode} Compliance Report ${new Date().getFullYear()}`
    ),
    downloadPath:
      asString(candidate.download_url ?? candidate.file_url, "") || undefined
  };
};

const withEncodedMarketPath = (marketCode: MarketCode) =>
  `${EXPORT_MARKETS_ENDPOINT}/${encodeURIComponent(marketCode)}`;

export const fetchComplianceMarkets = async () => {
  const payload = await api.get<unknown>(EXPORT_MARKETS_ENDPOINT);
  return normalizeMarketsPayload(payload);
};

export const runComplianceRecommendationAction = async (
  marketCode: MarketCode,
  recommendationId: string,
  action: string
) => {
  const normalizedAction = normalizeRecommendationAction(action);
  await api.post<unknown>(
    `${withEncodedMarketPath(marketCode)}/recommendations/${encodeURIComponent(recommendationId)}/actions`,
    { action: normalizedAction }
  );
};

export const upsertComplianceProduct = async (input: UpsertProductInput) => {
  const payload = {
    product_id: input.productId,
    product_name: input.productName,
    hs_code: input.hsCode,
    production_site: input.productionSite,
    export_volume: input.exportVolume,
    unit: input.unit
  };

  if (input.operation === "edit" && input.productId) {
    await api.patch<unknown>(
      `${withEncodedMarketPath(input.marketCode)}/products/${encodeURIComponent(input.productId)}`,
      payload
    );
    return;
  }

  await api.post<unknown>(`${withEncodedMarketPath(input.marketCode)}/products`, payload);
};

export const removeComplianceProduct = async (
  marketCode: MarketCode,
  productId: string
) => {
  await api.delete<unknown>(
    `${withEncodedMarketPath(marketCode)}/products/${encodeURIComponent(productId)}`
  );
};

export const upsertComplianceCarbonData = async (input: UpsertCarbonInput) => {
  await api.patch<unknown>(
    `${withEncodedMarketPath(input.marketCode)}/carbon-data/${encodeURIComponent(input.scope)}`,
    {
      value: input.value,
      unit: input.unit,
      methodology: input.methodology,
      data_source: input.dataSource,
      reporting_period: input.reportingPeriod
    }
  );
};

export const uploadComplianceDocument = async (
  marketCode: MarketCode,
  documentId: string,
  file: File
) => {
  const body = new FormData();
  body.append("file", file);

  await apiRequest<unknown>(
    `${withEncodedMarketPath(marketCode)}/documents/${encodeURIComponent(documentId)}/upload`,
    {
      method: "POST",
      body
    }
  );
};

export const importComplianceDocumentMappings = async (
  marketCode: MarketCode,
  rows: Record<string, unknown>[]
): Promise<ComplianceDocumentImportResult> => {
  const payload = await api.post<unknown>(
    `${withEncodedMarketPath(marketCode)}/documents/import`,
    { rows }
  );

  if (!isObject(payload)) {
    return {
      imported: 0,
      failed: 0,
      errors: []
    };
  }

  const errors = asArray(payload.errors)
    .filter(isObject)
    .map((error, index) => ({
      row: asCount(error.row, index + 1),
      code: asString(error.code, "IMPORT_ERROR"),
      message: asString(error.message, "Failed to import row")
    }));

  return {
    imported: asCount(payload.imported, 0),
    failed: asCount(payload.failed, errors.length),
    errors
  };
};

const fetchDocumentBlob = async (
  marketCode: MarketCode,
  documentId: string,
  preferredDownloadUrl?: string
): Promise<{ blob: Blob; filename: string }> => {
  const accessToken = (await ensureAccessToken()) || authTokenStore.getAccessToken();
  const fallbackFilename = `compliance-document-${documentId}.pdf`;
  const demoRuntime = isDemoRuntime();
  const demoMissingDocumentMessage =
    "Demo document file is unavailable. Please upload the PDF in demo mode and try again.";
  const preferredUrl = typeof preferredDownloadUrl === "string" ? preferredDownloadUrl.trim() : "";

  if (preferredUrl) {
    try {
      const preferredResponse = await fetchWithOptionalAuth(preferredUrl, accessToken);
      return resolvePdfBlobFromResponse(
        preferredResponse,
        inferFilenameFromUrl(preferredUrl, fallbackFilename),
        accessToken,
        true
      );
    } catch (preferredDownloadError) {
      if (demoRuntime) {
        throw new Error(demoMissingDocumentMessage);
      }
      console.warn("Preferred compliance document URL failed, fallback to download endpoint:", preferredDownloadError);
    }
  }

  if (demoRuntime) {
    throw new Error(demoMissingDocumentMessage);
  }

  const path = `${withEncodedMarketPath(marketCode)}/documents/${encodeURIComponent(documentId)}/download`;

  const response = await fetch(resolveApiUrl(path), {
    method: "GET",
    credentials: "include",
    headers: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`
        }
      : undefined
  });

  return resolvePdfBlobFromResponse(
    response,
    fallbackFilename,
    accessToken,
    true
  );
};

export const downloadComplianceDocument = async (
  marketCode: MarketCode,
  documentId: string,
  preferredDownloadUrl?: string
) => {
  const { blob, filename } = await fetchDocumentBlob(marketCode, documentId, preferredDownloadUrl);
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
};

export const openComplianceDocumentInNewTab = async (
  marketCode: MarketCode,
  documentId: string,
  preferredDownloadUrl?: string
) => {
  const { blob } = await fetchDocumentBlob(marketCode, documentId, preferredDownloadUrl);
  const href = URL.createObjectURL(blob);
  window.open(href, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(href), 60000);
};

export const getComplianceDocumentObjectUrl = async (
  marketCode: MarketCode,
  documentId: string,
  preferredDownloadUrl?: string
) => {
  const { blob } = await fetchDocumentBlob(marketCode, documentId, preferredDownloadUrl);
  return URL.createObjectURL(blob);
};

export const removeComplianceDocument = async (
  marketCode: MarketCode,
  documentId: string
) => {
  await api.delete<unknown>(
    `${withEncodedMarketPath(marketCode)}/documents/${encodeURIComponent(documentId)}`
  );
};

export const approveComplianceDocument = async (
  marketCode: MarketCode,
  documentId: string
) => {
  await api.post<unknown>(
    `${withEncodedMarketPath(marketCode)}/documents/${encodeURIComponent(documentId)}/approve`,
    {}
  );
};

export const createComplianceMarketReport = async (
  marketCode: MarketCode,
  format: "csv" | "xlsx" | "pdf" = "xlsx"
) => {
  try {
    const payload = await api.post<unknown>(`${withEncodedMarketPath(marketCode)}/reports`, {
      file_format: format
    });
    return normalizeComplianceReportResult(payload, marketCode);
  } catch (error) {
    if (!isApiError(error) || ![404, 405, 501].includes(error.status)) {
      throw error;
    }

    const payload = await api.post<unknown>("/reports", {
      title: `${marketCode} Compliance Report ${new Date().getFullYear()}`,
      report_type: "compliance",
      file_format: format,
      target_market: marketCode
    });
    return normalizeComplianceReportResult(payload, marketCode);
  }
};
