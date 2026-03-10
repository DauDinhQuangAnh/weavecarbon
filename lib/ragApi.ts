const RAG_CONFIG_STORAGE_KEY = "weavecarbon_rag_runtime_config_v1";

const DEFAULT_RAG_BASE_URL = "http://127.0.0.1:8000";
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

const legacyEndpointConfig = parseLegacyWeaveyEndpoint(process.env.NEXT_PUBLIC_WEAVEY_API_URL);

const envDefaultBaseUrl = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_RAG_API_BASE_URL ||
    legacyEndpointConfig?.baseUrl ||
    DEFAULT_RAG_BASE_URL
);
const envDefaultCollection = asString(
  process.env.NEXT_PUBLIC_RAG_COLLECTION || legacyEndpointConfig?.collectionName || "",
  ""
);
const envDefaultColumns = parseCommaSeparatedColumns(
  process.env.NEXT_PUBLIC_RAG_COLUMNS_TO_ANSWER || DEFAULT_COLUMNS.join(",")
);
const envDefaultDocsRetrieval = clampInteger(
  process.env.NEXT_PUBLIC_RAG_NUMBER_DOCS_RETRIEVAL,
  DEFAULT_NUMBER_DOCS_RETRIEVAL,
  1,
  50
);
const envDefaultTimeoutMs = clampInteger(
  process.env.NEXT_PUBLIC_RAG_TIMEOUT_MS,
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
}

export interface RagQueryRequest {
  query: string;
  columns_to_answer: string[];
  number_docs_retrieval?: number;
}

export interface RagQueryResponse {
  answer: string;
  retrieved_data: string;
  metadatas: unknown;
  full_prompt: string | null;
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
    return sanitizeRuntimeConfig(parsed);
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

export const getCollectionDescription = (collection: RagCollectionDetail | null) =>
  asNullableString(collection?.metadata?.description) || "";

export const checkRagHealth = async (baseUrl: string): Promise<RagHealthResponse> => {
  const payload = await ragRequest<unknown>(baseUrl, "/health");
  const candidate = asRecord(payload);
  return {
    status: asString(candidate.status, "unknown")
  };
};

export const testRagDatabase = async (baseUrl: string): Promise<RagDbTestResponse> => {
  const payload = await ragRequest<unknown>(baseUrl, "/db/test");
  const candidate = asRecord(payload);
  return {
    status: asString(candidate.status, "unknown"),
    message: asString(candidate.message, ""),
    database: asNullableString(candidate.database),
    version: asNullableString(candidate.version)
  };
};

export const listRagCollections = async (baseUrl: string): Promise<string[]> => {
  const payload = await ragRequest<unknown>(baseUrl, "/collections");
  const collections = asRecord(payload).collections;
  if (!Array.isArray(collections)) return [];
  const normalized = collections
    .map((entry) => asString(entry, ""))
    .filter((entry, index, all) => entry.length > 0 && all.indexOf(entry) === index);
  return normalized;
};

export const getRagCollection = async (
  baseUrl: string,
  collectionName: string
): Promise<RagCollectionDetail> => {
  const payload = await ragRequest<unknown>(
    baseUrl,
    `/collections/${encodeURIComponent(collectionName)}`
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
  baseUrl: string,
  payload: {
    name: string;
    description?: string;
  }
) => {
  const response = await ragRequest<unknown>(baseUrl, "/collections", {
    method: "POST",
    body: {
      name: payload.name,
      description: payload.description
    }
  });
  return normalizeCollectionDetail(response, payload.name);
};

export const updateRagCollection = async (
  baseUrl: string,
  collectionName: string,
  payload: {
    new_name?: string;
    metadata?: PrimitiveRecord;
  }
) => {
  const response = await ragRequest<unknown>(
    baseUrl,
    `/collections/${encodeURIComponent(collectionName)}`,
    {
      method: "PATCH",
      body: payload
    }
  );
  return normalizeCollectionDetail(response, payload.new_name || collectionName);
};

export const deleteRagCollection = async (baseUrl: string, collectionName: string) => {
  await ragRequest<unknown>(baseUrl, `/collections/${encodeURIComponent(collectionName)}`, {
    method: "DELETE"
  });
};

export const ingestRagCsv = async (
  baseUrl: string,
  payload: {
    file: File;
    indexColumn: string;
    collectionName?: string;
  }
): Promise<RagIngestResult> => {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("index_column", payload.indexColumn);
  if (payload.collectionName) {
    formData.append("collection_name", payload.collectionName);
  }

  const response = await ragRequest<unknown>(baseUrl, "/ingest", {
    method: "POST",
    body: formData,
    headers: {}
  });

  const candidate = asRecord(response);
  return {
    collection_name: asString(candidate.collection_name, payload.collectionName || ""),
    rows: Math.max(0, Math.trunc(asNumber(candidate.rows, 0))),
    chunks: Math.max(0, Math.trunc(asNumber(candidate.chunks, 0)))
  };
};

export const queryRagCollection = async (
  baseUrl: string,
  collectionName: string,
  payload: RagQueryRequest,
  timeoutMs?: number
): Promise<RagQueryResponse> => {
  const response = await ragRequest<unknown>(
    baseUrl,
    `/collections/${encodeURIComponent(collectionName)}/query`,
    {
      method: "POST",
      timeoutMs,
      body: {
        query: payload.query,
        columns_to_answer: payload.columns_to_answer,
        number_docs_retrieval: clampInteger(
          payload.number_docs_retrieval,
          DEFAULT_NUMBER_DOCS_RETRIEVAL,
          1,
          50
        )
      }
    }
  );
  const candidate = asRecord(response);
  return {
    answer: asString(candidate.answer, ""),
    retrieved_data: asString(candidate.retrieved_data, ""),
    metadatas: candidate.metadatas ?? null,
    full_prompt: asNullableString(candidate.full_prompt)
  };
};
