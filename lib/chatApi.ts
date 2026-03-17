import { api } from "@/lib/apiClient";
import type { RagRuntimeConfig } from "@/lib/ragApi";

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

export type ChatConfigSource = "self" | "company_admin" | null;

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

  const columnsRaw = Array.isArray(value.columns_to_answer) ? value.columns_to_answer : [];
  const columnsToAnswer = columnsRaw
    .map((entry) => asString(entry, ""))
    .filter((entry, index, all) => entry.length > 0 && all.indexOf(entry) === index);

  const baseUrl = asString(value.rag_base_url, "");
  const collectionName = asString(value.collection_name, "");

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
    configSource: (asNullableString(candidate.config_source) as ChatConfigSource) || null,
  };
};

export const getChatSettings = async (): Promise<ResolvedChatSettings> => {
  const response = await api.get<unknown>("/chat/settings");
  const candidate = isObject(response) ? response : {};

  return {
    config: normalizeRagConfig(candidate.config),
    configSource: (asNullableString(candidate.config_source) as ChatConfigSource) || null,
    canEdit: candidate.can_edit === true,
  };
};

export const saveChatSettings = async (
  config: RagRuntimeConfig
): Promise<ResolvedChatSettings> => {
  const response = await api.put<unknown>("/chat/settings", {
    rag_base_url: config.baseUrl,
    collection_name: config.collectionName,
    columns_to_answer: config.columnsToAnswer,
    number_docs_retrieval: config.numberDocsRetrieval,
    timeout_ms: config.timeoutMs,
  });

  const candidate = isObject(response) ? response : {};

  return {
    config: normalizeRagConfig(candidate.config),
    configSource: (asNullableString(candidate.config_source) as ChatConfigSource) || "self",
    canEdit: candidate.can_edit === true,
  };
};
