import { api } from "@/lib/apiClient";
import { env } from "@/lib/env";

const RAG_CONFIG_STORAGE_KEY = "weavecarbon_rag_runtime_config_v1";

const DEFAULT_RAG_BASE_URL = "https://weavecarbon.com/rag";
const DEFAULT_COLUMNS = ["chunk"];
const DEFAULT_NUMBER_DOCS_RETRIEVAL = 3;
const DEFAULT_TIMEOUT_MS = 30000;

type PrimitiveRecord = Record<string, unknown>;

const isObjectRecord = (value: unknown): value is PrimitiveRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asRecord = (value: unknown): PrimitiveRecord => (isObjectRecord(value) ? value : {});

const asString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value.trim() : fallback;

const asNullableString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const asNumber = (value: unknown, fallback = 0) => {
  const normalized =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(normalized) ? normalized : fallback;
};

const clampInteger = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Math.trunc(asNumber(value, fallback));
  return Math.min(max, Math.max(min, parsed));
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const normalizeBaseUrl = (value: string) => trimTrailingSlash(value.trim());

const LEGACY_LOOPBACK_BASE_URLS = new Set([
  "http://127.0.0.1:8000",
  "http://localhost:8000",
]);

const isRelativeBaseUrl = (value: string) => {
  const normalized = normalizeBaseUrl(value);
  return normalized.startsWith("/") && !normalized.startsWith("//");
};

const isAbsoluteHttpBaseUrl = (value: string) => {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const isLoopbackBaseUrl = (value: string) => {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) return false;

  if (LEGACY_LOOPBACK_BASE_URLS.has(normalized)) {
    return true;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  } catch {
    return false;
  }
};

const shouldMigrateLoopbackBaseUrl = (candidateBaseUrl: string, fallbackBaseUrl: string) =>
  (isLoopbackBaseUrl(candidateBaseUrl) || isRelativeBaseUrl(candidateBaseUrl)) &&
  isAbsoluteHttpBaseUrl(fallbackBaseUrl) &&
  !isLoopbackBaseUrl(fallbackBaseUrl);

const parseCommaSeparatedColumns = (value: string | null | undefined) => {
  if (!value) return [] as string[];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item, index, all) => item.length > 0 && all.indexOf(item) === index);
};

const parseLegacyWeaveyEndpoint = (value: string | undefined | null) => {
  const raw = asString(value, "");
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    const matchedPath = parsed.pathname.match(/\/collections\/([^/]+)\/query\/?$/i);
    if (!matchedPath) return null;

    return {
      baseUrl: normalizeBaseUrl(`${parsed.protocol}//${parsed.host}`),
      collectionName: decodeURIComponent(matchedPath[1])
    };
  } catch {
    return null;
  }
};

const legacyEndpointConfig = parseLegacyWeaveyEndpoint(env.NEXT_PUBLIC_WEAVEY_API_URL);

const envDefaultBaseUrl = normalizeBaseUrl(
  env.NEXT_PUBLIC_RAG_API_BASE_URL ||
    legacyEndpointConfig?.baseUrl ||
    DEFAULT_RAG_BASE_URL
);
const envDefaultCollection = asString(
  env.NEXT_PUBLIC_RAG_COLLECTION || legacyEndpointConfig?.collectionName || "",
  ""
);
const envDefaultColumns = parseCommaSeparatedColumns(
  env.NEXT_PUBLIC_RAG_COLUMNS_TO_ANSWER || DEFAULT_COLUMNS.join(",")
);
const envDefaultDocsRetrieval = clampInteger(
  env.NEXT_PUBLIC_RAG_NUMBER_DOCS_RETRIEVAL,
  DEFAULT_NUMBER_DOCS_RETRIEVAL,
  1,
  50
);
const envDefaultTimeoutMs = clampInteger(
  env.NEXT_PUBLIC_RAG_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
  1000,
  120000
);

export interface RagRuntimeConfig {
  baseUrl: string;
  collectionName: string;
  columnsToAnswer: string[];
  numberDocsRetrieval: number;
  timeoutMs: number;
}

export interface RagCollectionDetail {
  name: string;
  metadata: PrimitiveRecord | null;
  count: number;
}

export interface RagHealthResponse {
  status: string;
}

export interface RagDbTestResponse {
  status: string;
  message: string;
  database?: string | null;
  version?: string | null;
}

export interface RagIngestResult {
  collection_name: string;
  rows: number;
  chunks: number;
  warnings?: string[];
  chunking_profile?: string | null;
  chunk_stats?: PrimitiveRecord;
}

export interface RagQueryRequest {
  query: string;
  columns_to_answer?: string[];
  number_docs_retrieval?: number;
  include_debug_info?: boolean;
}

export interface RagQueryResponse {
  answer: string;
  retrieved_data: string;
  metadatas: unknown;
  full_prompt: string | null;
  citations: RagCitation[];
}

export interface RagCitation {
  id: number;
  source: string | null;
  source_type: string | null;
  page_number: number | null;
  chunk_index: number | null;
  section_title: string | null;
  section_path: string | null;
  chunk_type: string | null;
  snippet: string;
}

export interface RagDocumentInfo {
  source: string;
  source_type: string | null;
  chunk_count: number;
  doc_id: string | null;
}

export interface RagCollectionRecords {
  collection_name: string;
  count: number;
  limit: number;
  offset: number;
  ids: string[];
  metadatas: unknown[];
  documents: string[];
}

export interface RagProductSuggestionRequest {
  product_id?: string;
  language?: string;
}

export interface RagCompanyRecommendationRequest {
  company_id?: string;
  language?: string;
}

export interface RagCompanyRecommendation {
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  reduction: string;
  difficulty: string;
  category: string;
}

export interface RagCompanyRecommendationResponse {
  company_id: string;
  recommendations: RagCompanyRecommendation[];
}

export interface RagProductSuggestion {
  id: string;
  type: string;
  title: string;
  description: string;
  potentialReduction: number;
  difficulty: "easy" | "medium" | "hard";
}

export interface RagProductSuggestionResponse {
  product_id: string;
  suggestions: RagProductSuggestion[];
}

export class RagApiError extends Error {
  status: number;
  detail: string | null;

  constructor(message: string, status: number, detail: string | null = null) {
    super(message);
    this.name = "RagApiError";
    this.status = status;
    this.detail = detail;
  }
}

export const getDefaultRagRuntimeConfig = (): RagRuntimeConfig => ({
  baseUrl: envDefaultBaseUrl || DEFAULT_RAG_BASE_URL,
  collectionName: envDefaultCollection,
  columnsToAnswer: envDefaultColumns.length > 0 ? envDefaultColumns : [...DEFAULT_COLUMNS],
  numberDocsRetrieval: envDefaultDocsRetrieval,
  timeoutMs: envDefaultTimeoutMs
});

const sanitizeRuntimeConfig = (value: unknown): RagRuntimeConfig => {
  const defaults = getDefaultRagRuntimeConfig();
  const candidate = asRecord(value);
  const columns = parseCommaSeparatedColumns(
    Array.isArray(candidate.columnsToAnswer) ?
      candidate.columnsToAnswer.map((item) => asString(item, "")).join(",") :
      asNullableString(candidate.columnsToAnswer) ||
      asNullableString(candidate.columns_to_answer) ||
      defaults.columnsToAnswer.join(",")
  );

  return {
    baseUrl: normalizeBaseUrl(asString(candidate.baseUrl, defaults.baseUrl)) || defaults.baseUrl,
    collectionName: asString(candidate.collectionName, defaults.collectionName),
    columnsToAnswer: columns.length > 0 ? columns : defaults.columnsToAnswer,
    numberDocsRetrieval: clampInteger(
      candidate.numberDocsRetrieval ?? candidate.number_docs_retrieval,
      defaults.numberDocsRetrieval,
      1,
      50
    ),
    timeoutMs: clampInteger(candidate.timeoutMs, defaults.timeoutMs, 1000, 120000)
  };
};

export const readRagRuntimeConfig = (): RagRuntimeConfig => {
  const defaults = getDefaultRagRuntimeConfig();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(RAG_CONFIG_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeRuntimeConfig(parsed);

    if (!shouldMigrateLoopbackBaseUrl(sanitized.baseUrl, defaults.baseUrl)) {
      return sanitized;
    }

    const migratedConfig: RagRuntimeConfig = {
      ...sanitized,
      baseUrl: defaults.baseUrl,
    };

    window.localStorage.setItem(
      RAG_CONFIG_STORAGE_KEY,
      JSON.stringify(migratedConfig),
    );

    return migratedConfig;
  } catch {
    return defaults;
  }
};

export const saveRagRuntimeConfig = (config: RagRuntimeConfig) => {
  if (typeof window === "undefined") return;
  const sanitized = sanitizeRuntimeConfig(config);
  window.localStorage.setItem(RAG_CONFIG_STORAGE_KEY, JSON.stringify(sanitized));
};

export const resetRagRuntimeConfig = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(RAG_CONFIG_STORAGE_KEY);
};

const resolveErrorDetail = (payload: unknown) => {
  const candidate = asRecord(payload);
  const detail = candidate.detail;
  if (typeof detail === "string" && detail.trim().length > 0) {
    return detail.trim();
  }
  if (Array.isArray(detail)) {
    const flattened = detail
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0)
      .join("; ");
    if (flattened.length > 0) return flattened;
  }
  return null;
};

interface RagRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: BodyInit | PrimitiveRecord | null;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

const ragRequest = async <T,>(
  baseUrl: string,
  path: string,
  options: RagRequestOptions = {}
): Promise<T> => {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    throw new Error("RAG API base URL is missing.");
  }

  const method = options.method || "GET";
  const timeoutMs = clampInteger(options.timeoutMs, envDefaultTimeoutMs, 1000, 120000);
  const headers: Record<string, string> = {
    ...(options.headers || {})
  };

  let requestBody: BodyInit | undefined;
  if (options.body instanceof FormData) {
    requestBody = options.body;
  } else if (isObjectRecord(options.body)) {
    requestBody = JSON.stringify(options.body);
    headers["Content-Type"] = "application/json";
  } else if (typeof options.body === "string") {
    requestBody = options.body;
    if (!headers["Content-Type"]) {
      headers["Content-Type"] = "text/plain";
    }
  } else {
    requestBody = undefined;
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${normalizedBaseUrl}${path}`, {
      method,
      headers,
      body: requestBody,
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") || "";
    const payload =
      contentType.includes("application/json") ?
        await response.json().catch(() => null) :
        await response.text().catch(() => "");

    if (!response.ok) {
      const detail = resolveErrorDetail(payload);
      throw new RagApiError(
        detail || `RAG API request failed with status ${response.status}.`,
        response.status,
        detail
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof RagApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("RAG API request timed out.");
    }
    if (error instanceof Error) {
      throw new Error(error.message || "Failed to connect to RAG API.");
    }
    throw new Error("Failed to connect to RAG API.");
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const normalizeCollectionDetail = (payload: unknown, fallbackName = ""): RagCollectionDetail => {
  const candidate = asRecord(payload);
  const metadata = asRecord(candidate.metadata);
  return {
    name: asString(candidate.name, fallbackName),
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
    count: Math.max(0, Math.trunc(asNumber(candidate.count, 0)))
  };
};

const normalizeSuggestionDifficulty = (
  value: unknown
): RagProductSuggestion["difficulty"] => {
  const normalized = asString(value, "").toLowerCase();
  if (normalized === "easy" || normalized === "hard") {
    return normalized;
  }
  return "medium";
};

const normalizeRecommendationImpact = (
  value: unknown
): RagCompanyRecommendation["impact"] => {
  const normalized = asString(value, "").toLowerCase();
  if (normalized === "high" || normalized === "low") {
    return normalized;
  }
  return "medium";
};

const normalizeCompanyRecommendation = (
  payload: unknown,
  index: number
): RagCompanyRecommendation => {
  const candidate = asRecord(payload);

  return {
    id: asString(candidate.id, `recommendation-${index + 1}`),
    title: asString(candidate.title, `Recommendation ${index + 1}`),
    description: asString(candidate.description, ""),
    impact: normalizeRecommendationImpact(candidate.impact),
    reduction: asString(candidate.reduction, "0%"),
    difficulty: asString(candidate.difficulty, ""),
    category: asString(candidate.category, "")
  };
};

const normalizeProductSuggestion = (
  payload: unknown,
  index: number
): RagProductSuggestion => {
  const candidate = asRecord(payload);

  return {
    id: asString(candidate.id, `suggestion-${index + 1}`),
    type: asString(candidate.type, "manufacturing"),
    title: asString(candidate.title, `Suggestion ${index + 1}`),
    description: asString(candidate.description, ""),
    potentialReduction: Math.max(
      0,
      Math.round(asNumber(candidate.potentialReduction, 0))
    ),
    difficulty: normalizeSuggestionDifficulty(candidate.difficulty)
  };
};

export const getCollectionDescription = (collection: RagCollectionDetail | null) =>
  asNullableString(collection?.metadata?.description) || "";

export const checkRagHealth = async (_baseUrl: string): Promise<RagHealthResponse> => {
  void _baseUrl;
  const payload = await api.get<unknown>("/ai-config/rag/health");
  const candidate = asRecord(payload);
  return {
    status: asString(candidate.status, "unknown")
  };
};

const normalizeRagCitation = (payload: unknown, index: number): RagCitation => {
  const candidate = asRecord(payload);
  return {
    id: Math.trunc(asNumber(candidate.id, index + 1)),
    source: asNullableString(candidate.source),
    source_type: asNullableString(candidate.source_type),
    page_number:
      typeof candidate.page_number === "undefined" ? null : Math.trunc(asNumber(candidate.page_number, 0)),
    chunk_index:
      typeof candidate.chunk_index === "undefined" ? null : Math.trunc(asNumber(candidate.chunk_index, 0)),
    section_title: asNullableString(candidate.section_title),
    section_path: asNullableString(candidate.section_path),
    chunk_type: asNullableString(candidate.chunk_type),
    snippet: asString(candidate.snippet, "")
  };
};

const normalizeDocumentInfo = (payload: unknown): RagDocumentInfo => {
  const candidate = asRecord(payload);
  return {
    source: asString(candidate.source, ""),
    source_type: asNullableString(candidate.source_type),
    chunk_count: Math.max(0, Math.trunc(asNumber(candidate.chunk_count, 0))),
    doc_id: asNullableString(candidate.doc_id)
  };
};

export const testRagDatabase = async (_baseUrl: string): Promise<RagDbTestResponse> => {
  void _baseUrl;
  const payload = await api.get<unknown>("/ai-config/rag/runtime-status");
  const candidate = asRecord(payload);
  const chroma = asRecord(candidate.chroma);
  return {
    status: asString(candidate.status, "unknown"),
    message: asString(candidate.message, asString(chroma.local, "")),
    database: asNullableString(chroma.local),
    version: asNullableString(candidate.embedding_model)
  };
};

export const listRagCollections = async (_baseUrl: string): Promise<string[]> => {
  void _baseUrl;
  const payload = await api.get<unknown>("/ai-config/rag/collections");
  const collections = asRecord(payload).collections;
  if (!Array.isArray(collections)) return [];
  const normalized = collections
    .map((entry) => asString(entry, ""))
    .filter((entry, index, all) => entry.length > 0 && all.indexOf(entry) === index);
  return normalized;
};

export const getRagCollection = async (
  _baseUrl: string,
  collectionName: string
): Promise<RagCollectionDetail> => {
  void _baseUrl;
  const payload = await api.get<unknown>(
    `/ai-config/rag/collections/${encodeURIComponent(collectionName)}`
  );
  return normalizeCollectionDetail(payload, collectionName);
};

export const fetchRagCollectionsWithDetails = async (baseUrl: string) => {
  const names = await listRagCollections(baseUrl);
  const details = await Promise.all(
    names.map(async (name) => {
      try {
        return await getRagCollection(baseUrl, name);
      } catch {
        return {
          name,
          metadata: null,
          count: 0
        } satisfies RagCollectionDetail;
      }
    })
  );

  return details.sort((left, right) => left.name.localeCompare(right.name));
};

export const createRagCollection = async (
  _baseUrl: string,
  payload: {
    name: string;
    description?: string;
  }
) => {
  void _baseUrl;
  const response = await api.post<unknown>("/ai-config/rag/collections", {
    name: payload.name,
    description: payload.description
  });
  return normalizeCollectionDetail(response, payload.name);
};

export const updateRagCollection = async (
  _baseUrl: string,
  collectionName: string,
  payload: {
    new_name?: string;
    metadata?: PrimitiveRecord;
  }
) => {
  void _baseUrl;
  const response = await api.patch<unknown>(
    `/ai-config/rag/collections/${encodeURIComponent(collectionName)}`,
    payload
  );
  return normalizeCollectionDetail(response, payload.new_name || collectionName);
};

export const deleteRagCollection = async (_baseUrl: string, collectionName: string) => {
  void _baseUrl;
  await api.delete<unknown>(`/ai-config/rag/collections/${encodeURIComponent(collectionName)}`);
};

export const getRagCollectionRecords = async (
  _baseUrl: string,
  collectionName: string,
  options: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<RagCollectionRecords> => {
  void _baseUrl;
  const params = new URLSearchParams({
    limit: String(clampInteger(options.limit, 200, 1, 5000)),
    offset: String(Math.max(0, Math.trunc(asNumber(options.offset, 0))))
  });
  const response = await api.get<unknown>(
    `/ai-config/rag/collections/${encodeURIComponent(collectionName)}/records?${params.toString()}`
  );
  const candidate = asRecord(response);
  const ids = Array.isArray(candidate.ids) ? candidate.ids.map((entry) => asString(entry, "")) : [];
  const documents = Array.isArray(candidate.documents)
    ? candidate.documents.map((entry) => asString(entry, ""))
    : [];
  return {
    collection_name: asString(candidate.collection_name, collectionName),
    count: Math.max(0, Math.trunc(asNumber(candidate.count, 0))),
    limit: Math.max(1, Math.trunc(asNumber(candidate.limit, options.limit || 200))),
    offset: Math.max(0, Math.trunc(asNumber(candidate.offset, options.offset || 0))),
    ids,
    metadatas: Array.isArray(candidate.metadatas) ? candidate.metadatas : [],
    documents
  };
};

export const listRagDocuments = async (
  _baseUrl: string,
  collectionName: string
): Promise<RagDocumentInfo[]> => {
  void _baseUrl;
  const response = await api.get<unknown>(
    `/ai-config/rag/collections/${encodeURIComponent(collectionName)}/documents`
  );
  const documents = asRecord(response).documents;
  return Array.isArray(documents)
    ? documents.map(normalizeDocumentInfo).filter((item) => item.source.length > 0)
    : [];
};

export const deleteRagDocument = async (
  _baseUrl: string,
  collectionName: string,
  source: string
) => {
  void _baseUrl;
  await api.post<unknown>(
    `/ai-config/rag/collections/${encodeURIComponent(collectionName)}/documents/delete`,
    { source }
  );
};

export const ingestRagDocument = async (
  _baseUrl: string,
  payload: {
    file: File;
    collectionName?: string;
    chunkingProfile?: string;
  }
): Promise<RagIngestResult> => {
  void _baseUrl;
  const formData = new FormData();
  formData.append("file", payload.file);
  if (payload.collectionName) {
    formData.append("collection_name", payload.collectionName);
  }
  if (payload.chunkingProfile) {
    formData.append("chunking_profile", payload.chunkingProfile);
  }

  const response = await api.post<unknown>("/ai-config/rag/ingest", formData);

  const candidate = asRecord(response);
  return {
    collection_name: asString(candidate.collection_name, payload.collectionName || ""),
    rows: Math.max(0, Math.trunc(asNumber(candidate.rows, 0))),
    chunks: Math.max(0, Math.trunc(asNumber(candidate.chunks, 0))),
    warnings: Array.isArray(candidate.warnings)
      ? candidate.warnings.map((entry) => asString(entry, "")).filter(Boolean)
      : [],
    chunking_profile: asNullableString(candidate.chunking_profile),
    chunk_stats: asRecord(candidate.chunk_stats)
  };
};

export const queryRagCollection = async (
  _baseUrl: string,
  collectionName: string,
  payload: RagQueryRequest,
  timeoutMs?: number
): Promise<RagQueryResponse> => {
  void _baseUrl;
  void timeoutMs;
  const response = await api.post<unknown>(
    `/ai-config/rag/collections/${encodeURIComponent(collectionName)}/query`,
    {
      query: payload.query,
      number_docs_retrieval: clampInteger(
        payload.number_docs_retrieval,
        DEFAULT_NUMBER_DOCS_RETRIEVAL,
        1,
        50
      ),
      include_debug_info: payload.include_debug_info === true
    }
  );
  const candidate = asRecord(response);
  const citations = Array.isArray(candidate.citations) ? candidate.citations : [];
  return {
    answer: asString(candidate.answer, ""),
    retrieved_data: asString(candidate.retrieved_data, ""),
    metadatas: candidate.metadatas ?? null,
    full_prompt: asNullableString(candidate.full_prompt),
    citations: citations.map((entry, index) => normalizeRagCitation(entry, index))
  };
};

export const generateProductSuggestions = async (
  baseUrl: string,
  productId: string,
  payload: RagProductSuggestionRequest = {},
  timeoutMs?: number
): Promise<RagProductSuggestionResponse> => {
  const response = await ragRequest<unknown>(
    baseUrl,
    `/recommendations/product/${encodeURIComponent(productId)}`,
    {
      method: "POST",
      timeoutMs,
      body: {
        product_id: payload.product_id || productId,
        language: asString(payload.language, "vi") || "vi"
      }
    }
  );
  const candidate = asRecord(response);
  const suggestions = Array.isArray(candidate.suggestions)
    ? candidate.suggestions.map((entry, index) =>
        normalizeProductSuggestion(entry, index)
      )
    : [];

  return {
    product_id: asString(candidate.product_id, productId),
    suggestions
  };
};

export const generateCompanyRecommendations = async (
  baseUrl: string,
  companyId: string,
  payload: RagCompanyRecommendationRequest = {},
  timeoutMs?: number
): Promise<RagCompanyRecommendationResponse> => {
  const response = await ragRequest<unknown>(
    baseUrl,
    `/recommendations/company/${encodeURIComponent(companyId)}`,
    {
      method: "POST",
      timeoutMs,
      body: {
        company_id: payload.company_id || companyId,
        language: asString(payload.language, "vi") || "vi"
      }
    }
  );
  const candidate = asRecord(response);
  const recommendations = Array.isArray(candidate.recommendations)
    ? candidate.recommendations.map((entry, index) =>
        normalizeCompanyRecommendation(entry, index)
      )
    : [];

  return {
    company_id: asString(candidate.company_id, companyId),
    recommendations
  };
};
