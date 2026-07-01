import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import {
  deleteChatConversation as deletePersistedChatConversation,
  getChatConversation,
  listChatConversations,
  sendChatMessage as sendPersistedChatMessage,
  type ChatMessage,
  type ConversationSummary,
} from "@/lib/chatApi";
import { queryRagCollection, readRagRuntimeConfig } from "@/lib/ragApi";interface UseWeaveyChatOptions {
  currentPage?: string;
  carbonData?: Record<string, unknown>;
  variant?: "landing" | "dashboard";
}

const RAW_CHAT_ERROR_PATTERNS = [
  /company_id/i,
  /does not exist/i,
  /undefined column/i,
  /sqlstate/i,
  /postgres/i,
  /database error/i,
  /列".+"は存在しません/,
  /存在しません/,
];

const toErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;

const looksLikeTechnicalChatError = (value: string) =>
  RAW_CHAT_ERROR_PATTERNS.some((pattern) => pattern.test(value));

const sanitizeAssistantContent = (value: string, fallback: string) => {
  const normalized = value.trim();
  if (!normalized) return fallback;
  return looksLikeTechnicalChatError(normalized) ? fallback : normalized;
};

const sanitizeChatMessage = (message: ChatMessage, fallback: string): ChatMessage =>
  message.role === "assistant"
    ? {
        ...message,
        content: sanitizeAssistantContent(message.content, fallback),
      }
    : message;

const sanitizeConversationSummary = (
  summary: ConversationSummary,
  fallback: string
): ConversationSummary => ({
  ...summary,
  lastMessagePreview: summary.lastMessagePreview
    ? sanitizeAssistantContent(summary.lastMessagePreview, fallback)
    : summary.lastMessagePreview,
});

const createLocalMessage = (
  role: "user" | "assistant",
  content: string,
  metadata: Record<string, unknown> = {}
): ChatMessage => ({
  id: `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  role,
  content,
  createdAt: new Date(),
  metadata,
});

const sortConversations = (items: ConversationSummary[]) =>
  [...items].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });

const upsertConversationSummary = (
  items: ConversationSummary[],
  nextConversation: ConversationSummary
) => {
  const filtered = items.filter((item) => item.id !== nextConversation.id);
  return sortConversations([nextConversation, ...filtered]);
};

export function useWeaveyChat(options: UseWeaveyChatOptions = {}) {
  void options.carbonData;

  const t = useTranslations("dashboard.weaveyChat");
  const { user, isDemoSession } = useAuth();
  const variant = options.variant || "landing";
  const isRemoteMode = variant === "dashboard" && Boolean(user?.id) && !isDemoSession;
  const localChatErrorMessage = t("localUnavailable");
  const failedToLoadHistoryMessage = t("failedToLoadHistory");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasTrackedOpen, setHasTrackedOpen] = useState(false);

  useEffect(() => {
    if (hasTrackedOpen) {
      return;
    }

    setHasTrackedOpen(true);
  }, [hasTrackedOpen, variant]);

  useEffect(() => {
    if (!isRemoteMode) {
      setConversations([]);
      setActiveConversationId(null);
      setLoadError(null);
      return;
    }

    let ignore = false;

    const bootstrapRemoteChat = async () => {
      setIsInitializing(true);
      setLoadError(null);

      try {
        const conversationList = await listChatConversations();

        if (ignore) return;

        setConversations(
          conversationList.items.map((item) => sanitizeConversationSummary(item, localChatErrorMessage))
        );

        if (conversationList.items.length === 0) {
          setActiveConversationId(null);
          setMessages([]);
          return;
        }

        const latestConversation = await getChatConversation(conversationList.items[0].id);
        if (ignore) return;

        setActiveConversationId(latestConversation.id);
        setMessages(
          latestConversation.messages.map((message) =>
            sanitizeChatMessage(message, localChatErrorMessage)
          )
        );
      } catch (error) {
        if (ignore) return;

        setMessages([]);
        setConversations([]);
        setActiveConversationId(null);
        setLoadError(
          sanitizeAssistantContent(
            toErrorMessage(error, failedToLoadHistoryMessage),
            failedToLoadHistoryMessage
          )
        );
      } finally {
        if (!ignore) {
          setIsInitializing(false);
        }
      }
    };

    void bootstrapRemoteChat();

    return () => {
      ignore = true;
    };
  }, [failedToLoadHistoryMessage, isRemoteMode, localChatErrorMessage]);

  const selectConversation = useCallback(
    async (conversationId: string) => {
      if (!isRemoteMode || !conversationId || conversationId === activeConversationId) {
        return;
      }

      setIsInitializing(true);
      setLoadError(null);

      try {
        const detail = await getChatConversation(conversationId);
        setActiveConversationId(detail.id);
        setMessages(
          detail.messages.map((message) => sanitizeChatMessage(message, localChatErrorMessage))
        );
      } catch (error) {
        setLoadError(
          sanitizeAssistantContent(
            toErrorMessage(error, failedToLoadHistoryMessage),
            failedToLoadHistoryMessage
          )
        );
      } finally {
        setIsInitializing(false);
      }
    },
    [activeConversationId, failedToLoadHistoryMessage, isRemoteMode, localChatErrorMessage]
  );

  const startNewChat = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setLoadError(null);
  }, []);

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      if (!isRemoteMode || !conversationId) {
        return;
      }

      setDeletingConversationId(conversationId);
      setLoadError(null);

      try {
        await deletePersistedChatConversation(conversationId);
        let remainingConversations: ConversationSummary[] = [];
        setConversations((previous) => {
          remainingConversations = previous.filter((conversation) => conversation.id !== conversationId);
          return remainingConversations;
        });

        if (activeConversationId !== conversationId) {
          return;
        }

        setActiveConversationId(null);
        setMessages([]);

        const nextConversation = remainingConversations[0];
        if (!nextConversation) {
          return;
        }

        try {
          const detail = await getChatConversation(nextConversation.id);
          setActiveConversationId(detail.id);
          setMessages(
            detail.messages.map((message) => sanitizeChatMessage(message, localChatErrorMessage))
          );
        } catch (error) {
          setLoadError(
            sanitizeAssistantContent(
              toErrorMessage(error, failedToLoadHistoryMessage),
              failedToLoadHistoryMessage
            )
          );
        }
      } catch (error) {
        const message = sanitizeAssistantContent(
          toErrorMessage(error, failedToLoadHistoryMessage),
          failedToLoadHistoryMessage
        );
        setLoadError(message);
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setDeletingConversationId(null);
      }
    },
    [activeConversationId, failedToLoadHistoryMessage, isRemoteMode, localChatErrorMessage]
  );

  const sendLocalMessage = useCallback(
    async (input: string) => {
      const userMessage = createLocalMessage("user", input);
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const assistantContent = await getWeaveyResponse(input);
        const assistantMessage = createLocalMessage(
          "assistant",
          sanitizeAssistantContent(assistantContent, localChatErrorMessage)
        );
        setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
        setMessages((prev) => [
          ...prev,
          createLocalMessage(
            "assistant",
            sanitizeAssistantContent(toErrorMessage(error, localChatErrorMessage), localChatErrorMessage)
          ),
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [localChatErrorMessage]
  );

  const sendRemoteMessage = useCallback(
    async (input: string) => {
      const optimisticUserMessage = createLocalMessage("user", input, {
        optimistic: true,
      });

      setMessages((prev) => [...prev, optimisticUserMessage]);
      setIsLoading(true);

      try {
        const result = await sendPersistedChatMessage({
          conversationId: activeConversationId,
          content: input,
          currentPage: options.currentPage,
        });

        setMessages((prev) => {
          const withoutOptimistic = prev.filter((message) => message.id !== optimisticUserMessage.id);
          return [
            ...withoutOptimistic,
            result.userMessage,
            sanitizeChatMessage(result.assistantMessage, localChatErrorMessage),
          ];
        });
        setActiveConversationId(result.conversation.id);
        setConversations((prev) =>
          upsertConversationSummary(
            prev,
            sanitizeConversationSummary(result.conversation, localChatErrorMessage)
          )
        );
        } catch (error) {
        setMessages((prev) => [
          ...prev,
          createLocalMessage(
            "assistant",
            sanitizeAssistantContent(toErrorMessage(error, localChatErrorMessage), localChatErrorMessage),
            {
              source: "client_error",
            }
          ),
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [activeConversationId, localChatErrorMessage, options.currentPage]
  );

  const sendMessage = useCallback(
    async (input: string) => {
      const normalizedInput = input.trim();
      if (!normalizedInput || isLoading || isInitializing) return;

      if (isRemoteMode) {
        await sendRemoteMessage(normalizedInput);
        return;
      }

      await sendLocalMessage(normalizedInput);
    },
    [isInitializing, isLoading, isRemoteMode, sendLocalMessage, sendRemoteMessage]
  );

  const statusMessage =
    loadError || null;

  return {
    messages,
    conversations,
    activeConversationId,
    isRemoteMode,
    isLoading,
    isInitializing,
    deletingConversationId,
    statusMessage,
    sendMessage,
    selectConversation,
    deleteConversation,
    startNewChat,
  };
}

async function getWeaveyResponse(input: string): Promise<string> {
  const runtimeConfig = readRagRuntimeConfig();

  if (!runtimeConfig.baseUrl) {
    throw new Error("RAG API base URL is missing. Please update Settings > AI.");
  }
  if (!runtimeConfig.collectionName) {
    throw new Error("AI collection is not configured. Please update Settings > AI.");
  }
  try {
    const data = await queryRagCollection(
      runtimeConfig.baseUrl,
      runtimeConfig.collectionName,
      {
        query: input,
        number_docs_retrieval: runtimeConfig.numberDocsRetrieval,
      },
      runtimeConfig.timeoutMs
    );

    if (data.answer.trim().length > 0) {
      return data.answer;
    }
    if (data.retrieved_data.trim().length > 0) {
      return data.retrieved_data;
    }

    throw new Error("No answer returned by RAG backend.");
  } catch (error) {
    if (error instanceof Error && error.message.trim().length > 0) {
      throw new Error(error.message);
    }
    throw new Error("Failed to get response from RAG backend.");
  }
}

export type { ChatMessage, ConversationSummary };
