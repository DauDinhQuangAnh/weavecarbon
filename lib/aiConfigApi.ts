import { api } from "@/lib/apiClient";
import { getDefaultRagRuntimeConfig, type RagRuntimeConfig } from "@/lib/ragApi";

type JsonRecord = Record<string, unknown>;

const isObject = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value.trim() : fallback;

const asNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const clampInteger = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Math.trunc(asNumber(value, fallback));
  return Math.min(max, Math.max(min, parsed));
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const isLoopbackOrRelativeBaseUrl = (value: string) => {
  const normalized = trimTrailingSlash(value.trim());
  if (!normalized) return false;
  if (normalized.startsWith("/") && !normalized.startsWith("//")) return true;

  try {
    const parsed = new URL(normalized);
    return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  } catch {
    return false;
  }
};

const normalizeAbsoluteBaseUrl = (value: string) => {
  const raw = trimTrailingSlash(value.trim());
  if (!raw) return "";

  try {
    const parsed =
      typeof window !== "undefined" ? new URL(raw, window.location.origin) : new URL(raw);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return raw;
    }

    const pathname =
      parsed.pathname && parsed.pathname !== "/" ? trimTrailingSlash(parsed.pathname) : "";

    return trimTrailingSlash(`${parsed.protocol}//${parsed.host}${pathname}`);
  } catch {
    return raw;
  }
};

const normalizeRuntimeConfig = (value: unknown): RagRuntimeConfig => {
  const defaults = getDefaultRagRuntimeConfig();
  if (!isObject(value)) return defaults;

  const columnsRaw = Array.isArray(value.columns_to_answer)
    ? value.columns_to_answer
    : Array.isArray(value.columnsToAnswer)
      ? value.columnsToAnswer
      : defaults.columnsToAnswer;

  const columnsToAnswer = columnsRaw
    .map((entry) => asString(entry, ""))
    .filter((entry, index, all) => entry.length > 0 && all.indexOf(entry) === index);

  const rawBaseUrl =
    asString(value.rag_base_url, "") ||
    asString(value.baseUrl, "") ||
    defaults.baseUrl;

  return {
    baseUrl: isLoopbackOrRelativeBaseUrl(rawBaseUrl) ? defaults.baseUrl : rawBaseUrl,
    collectionName:
      asString(value.collection_name, "") ||
      asString(value.collectionName, "") ||
      defaults.collectionName,
    columnsToAnswer: columnsToAnswer.length > 0 ? columnsToAnswer : defaults.columnsToAnswer,
    numberDocsRetrieval: clampInteger(
      value.number_docs_retrieval ?? value.numberDocsRetrieval,
      defaults.numberDocsRetrieval,
      1,
      50
    ),
    timeoutMs: clampInteger(value.timeout_ms ?? value.timeoutMs, defaults.timeoutMs, 1000, 120000)
  };
};

export const getGlobalAiRuntimeConfig = async (): Promise<RagRuntimeConfig> => {
  const response = await api.get<unknown>("/ai-config/runtime");
  return normalizeRuntimeConfig(response);
};

export const saveGlobalAiRuntimeConfig = async (
  config: RagRuntimeConfig
): Promise<RagRuntimeConfig> => {
  const response = await api.put<unknown>("/ai-config/runtime", {
    rag_base_url: normalizeAbsoluteBaseUrl(config.baseUrl),
    collection_name: config.collectionName,
    columns_to_answer: config.columnsToAnswer,
    number_docs_retrieval: config.numberDocsRetrieval,
    timeout_ms: config.timeoutMs
  });

  return normalizeRuntimeConfig(response);
};
