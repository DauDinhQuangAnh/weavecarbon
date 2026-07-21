import { api } from "@/lib/apiClient";
import { getDefaultRagRuntimeConfig, type RagRuntimeConfig } from "@/lib/ragApi";

type JsonRecord = Record<string, unknown>;

const isObject = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value.trim() : fallback;

const asNullableString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
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

const normalizeChatSettingsBaseUrl = (value: string) => {
  const raw = trimTrailingSlash(value.trim());
  if (!raw) return "";

  try {
    const parsed =
      typeof window !== "undefined" ?
        new URL(raw, window.location.origin) :
        new URL(raw);

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

const asNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const clampInteger = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Math.trunc(asNumber(value, fallback));
  return Math.min(max, Math.max(min, parsed));
};

const asMetadata = (value: unknown) => (isObject(value) ? value : {});

export type ChatConfigSource = "self" | "company_admin" | "global" | null;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  metadata: JsonRecord;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessagePreview: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ResolvedChatSettings {
  config: RagRuntimeConfig | null;
  configSource: ChatConfigSource;
  canEdit: boolean;
}

export interface ChatSendResult {
  conversation: ConversationSummary;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  configSource: ChatConfigSource;
}

export interface AiCompanyRecommendation {
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  reduction: string;
  difficulty: string;
  category: string;
}

export interface AiCompanyRecommendationResult {
  companyId: string;
  recommendations: AiCompanyRecommendation[];
  configSource: ChatConfigSource;
}

export interface AiProductSuggestion {
  id: string;
  type: string;
  title: string;
  description: string;
  potentialReduction: number;
  difficulty: "easy" | "medium" | "hard";
}

export interface AiProductSuggestionResult {
  productId: string;
  suggestions: AiProductSuggestion[];
  configSource: ChatConfigSource;
}

interface ConversationListResponse {
  items: unknown[];
  pagination?: {
    page?: number;
    page_size?: number;
    total?: number;
    total_pages?: number;
  };
}

export interface ConversationListResult {
  items: ConversationSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const normalizeMessage = (value: unknown): ChatMessage => {
  const candidate = isObject(value) ? value : {};
  const role = asString(candidate.role, "assistant") === "user" ? "user" : "assistant";

  return {
    id: asString(candidate.id, `message_${Date.now()}`),
    role,
    content: asString(candidate.content, ""),
    createdAt: new Date(asString(candidate.created_at, new Date().toISOString())),
    metadata: asMetadata(candidate.metadata),
  };
};

const normalizeConversationSummary = (value: unknown): ConversationSummary => {
  const candidate = isObject(value) ? value : {};

  return {
    id: asString(candidate.id, ""),
    title: asString(candidate.title, "New chat"),
    createdAt: asString(candidate.created_at, new Date().toISOString()),
    updatedAt: asString(candidate.updated_at, new Date().toISOString()),
    messageCount: clampInteger(candidate.message_count, 0, 0, 100000),
    lastMessagePreview: asString(candidate.last_message_preview, ""),
  };
};

const normalizeConversationDetail = (value: unknown): ConversationDetail => {
  const candidate = isObject(value) ? value : {};
  const messages = Array.isArray(candidate.messages) ? candidate.messages.map(normalizeMessage) : [];

  return {
    id: asString(candidate.id, ""),
    title: asString(candidate.title, "New chat"),
    createdAt: asString(candidate.created_at, new Date().toISOString()),
    updatedAt: asString(candidate.updated_at, new Date().toISOString()),
    messages,
  };
};

const normalizeRagConfig = (value: unknown): RagRuntimeConfig | null => {
  if (!isObject(value)) return null;
  const defaults = getDefaultRagRuntimeConfig();

  const columnsRaw = Array.isArray(value.columns_to_answer) ? value.columns_to_answer : [];
  const columnsToAnswer = columnsRaw
    .map((entry) => asString(entry, ""))
    .filter((entry, index, all) => entry.length > 0 && all.indexOf(entry) === index);

  const rawBaseUrl = asString(value.rag_base_url, "");
  const collectionName = asString(value.collection_name, "");
  const baseUrl = isLoopbackOrRelativeBaseUrl(rawBaseUrl) ? defaults.baseUrl : rawBaseUrl;

  if (!baseUrl || !collectionName || columnsToAnswer.length === 0) {
    return null;
  }

  return {
    baseUrl,
    collectionName,
    columnsToAnswer,
    numberDocsRetrieval: clampInteger(value.number_docs_retrieval, 3, 1, 50),
    timeoutMs: clampInteger(value.timeout_ms, 30000, 1000, 120000),
  };
};

export const listChatConversations = async (
  page = 1,
  pageSize = 20
): Promise<ConversationListResult> => {
  const payload = await api.get<ConversationListResponse>(
    `/chat/conversations?page=${page}&page_size=${pageSize}`
  );

  const items = Array.isArray(payload.items) ? payload.items.map(normalizeConversationSummary) : [];
  const pagination = isObject(payload.pagination) ? payload.pagination : {};

  return {
    items,
    pagination: {
      page: clampInteger(pagination.page, page, 1, 100000),
      pageSize: clampInteger(pagination.page_size, pageSize, 1, 100),
      total: clampInteger(pagination.total, items.length, 0, 100000000),
      totalPages: clampInteger(pagination.total_pages, 0, 0, 100000),
    },
  };
};

export const getChatConversation = async (conversationId: string): Promise<ConversationDetail> => {
  const payload = await api.get<unknown>(`/chat/conversations/${encodeURIComponent(conversationId)}`);
  return normalizeConversationDetail(payload);
};

const normalizeConfigSource = (value: unknown): ChatConfigSource => {
  const normalized = asNullableString(value);
  if (normalized === "self" || normalized === "company_admin" || normalized === "global") {
    return normalized;
  }
  return null;
};

const normalizeRecommendationImpact = (
  value: unknown
): AiCompanyRecommendation["impact"] => {
  const normalized = asString(value, "").toLowerCase();
  if (normalized === "high" || normalized === "low") {
    return normalized;
  }
  return "medium";
};

const normalizeSuggestionDifficulty = (
  value: unknown
): AiProductSuggestion["difficulty"] => {
  const normalized = asString(value, "").toLowerCase();
  if (normalized === "easy" || normalized === "hard") {
    return normalized;
  }
  return "medium";
};

const normalizeCompanyRecommendation = (
  value: unknown,
  index: number
): AiCompanyRecommendation => {
  const candidate = isObject(value) ? value : {};

  return {
    id: asString(candidate.id, `recommendation-${index + 1}`),
    title: asString(candidate.title, `Recommendation ${index + 1}`),
    description: asString(candidate.description, ""),
    impact: normalizeRecommendationImpact(candidate.impact),
    reduction: asString(candidate.reduction, "0%"),
    difficulty: asString(candidate.difficulty, ""),
    category: asString(candidate.category, ""),
  };
};

const normalizeProductSuggestion = (
  value: unknown,
  index: number
): AiProductSuggestion => {
  const candidate = isObject(value) ? value : {};

  return {
    id: asString(candidate.id, `suggestion-${index + 1}`),
    type: asString(candidate.type, "manufacturing"),
    title: asString(candidate.title, `Suggestion ${index + 1}`),
    description: asString(candidate.description, ""),
    potentialReduction: Math.max(0, Math.round(asNumber(candidate.potentialReduction, 0))),
    difficulty: normalizeSuggestionDifficulty(candidate.difficulty),
  };
};

export const deleteChatConversation = async (conversationId: string): Promise<void> => {
  await api.delete<unknown>(`/chat/conversations/${encodeURIComponent(conversationId)}`);
};

// Demo-only Weavey response. Routes through the `api` client so the demo API adapter
// (lib/demo/apiAdapter.ts `/chat/direct`) serves a canned answer offline — no RAG
// backend/collection required. Used by useWeaveyChat when in a demo session.
export const requestDemoChatResponse = async (query: string): Promise<string> => {
  const response = await api.post<unknown>("/chat/direct", { query });
  const candidate = isObject(response) ? response : {};
  return asString(candidate.answer, "");
};

export const sendChatMessage = async (payload: {
  conversationId?: string | null;
  content: string;
  currentPage?: string;
}): Promise<ChatSendResult> => {
  const response = await api.post<unknown>("/chat/messages", {
    conversation_id: payload.conversationId || undefined,
    content: payload.content,
    current_page: payload.currentPage || undefined,
  });

  const candidate = isObject(response) ? response : {};

  return {
    conversation: normalizeConversationSummary(candidate.conversation),
    userMessage: normalizeMessage(candidate.user_message),
    assistantMessage: normalizeMessage(candidate.assistant_message),
    configSource: normalizeConfigSource(candidate.config_source),
  };
};

export const getChatSettings = async (): Promise<ResolvedChatSettings> => {
  const response = await api.get<unknown>("/chat/settings");
  const candidate = isObject(response) ? response : {};

  return {
    config: normalizeRagConfig(candidate.config),
    configSource: normalizeConfigSource(candidate.config_source),
    canEdit: candidate.can_edit === true,
  };
};

export const saveChatSettings = async (
  config: RagRuntimeConfig
): Promise<ResolvedChatSettings> => {
  const normalizedBaseUrl = normalizeChatSettingsBaseUrl(config.baseUrl);
  const response = await api.put<unknown>("/chat/settings", {
    rag_base_url: normalizedBaseUrl,
    collection_name: config.collectionName,
    columns_to_answer: config.columnsToAnswer,
    number_docs_retrieval: config.numberDocsRetrieval,
    timeout_ms: config.timeoutMs,
  });

  const candidate = isObject(response) ? response : {};

  return {
    config: normalizeRagConfig(candidate.config),
    configSource: normalizeConfigSource(candidate.config_source) || "self",
    canEdit: candidate.can_edit === true,
  };
};

export const generateCompanyRecommendations = async (
  companyId: string,
  payload: { company_id?: string; language?: string } = {}
): Promise<AiCompanyRecommendationResult> => {
  const response = await api.post<unknown>(
    `/chat/recommendations/company/${encodeURIComponent(companyId)}`,
    {
      company_id: payload.company_id || companyId,
      language: payload.language || "vi",
    }
  );
  const candidate = isObject(response) ? response : {};
  const recommendations = Array.isArray(candidate.recommendations)
    ? candidate.recommendations.map((item, index) =>
        normalizeCompanyRecommendation(item, index)
      )
    : [];

  return {
    companyId: asString(candidate.company_id, companyId),
    recommendations,
    configSource: normalizeConfigSource(candidate.config_source),
  };
};

export const generateProductSuggestions = async (
  productId: string,
  payload: { product_id?: string; language?: string } = {}
): Promise<AiProductSuggestionResult> => {
  const response = await api.post<unknown>(
    `/chat/recommendations/product/${encodeURIComponent(productId)}`,
    {
      product_id: payload.product_id || productId,
      language: payload.language || "vi",
    }
  );
  const candidate = isObject(response) ? response : {};
  const suggestions = Array.isArray(candidate.suggestions)
    ? candidate.suggestions.map((item, index) => normalizeProductSuggestion(item, index))
    : [];

  return {
    productId: asString(candidate.product_id, productId),
    suggestions,
    configSource: normalizeConfigSource(candidate.config_source),
  };
};
