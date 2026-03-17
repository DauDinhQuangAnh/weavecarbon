import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import {
  getChatConversation,
  getChatSettings,
  listChatConversations,
  sendChatMessage as sendPersistedChatMessage,
  type ChatMessage,
  type ConversationSummary,
  type ResolvedChatSettings,
} from "@/lib/chatApi";
import { queryRagCollection, readRagRuntimeConfig } from "@/lib/ragApi";

interface UseWeaveyChatOptions {
  currentPage?: string;
  carbonData?: Record<string, unknown>;
  variant?: "landing" | "dashboard";
}

const toErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;

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
  const remoteAdminConfigMessage = t("notConfiguredAdmin");
  const remoteMemberConfigMessage = t("notConfiguredMember");
  const failedToLoadHistoryMessage = t("failedToLoadHistory");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [chatSettings, setChatSettings] = useState<ResolvedChatSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isRemoteMode) {
      setConversations([]);
      setActiveConversationId(null);
      setChatSettings(null);
      setLoadError(null);
      return;
    }

    let ignore = false;

    const bootstrapRemoteChat = async () => {
      setIsInitializing(true);
      setLoadError(null);

      try {
        const [resolvedSettings, conversationList] = await Promise.all([
          getChatSettings(),
          listChatConversations(),
        ]);

        if (ignore) return;

        setChatSettings(resolvedSettings);
        setConversations(conversationList.items);

        if (conversationList.items.length === 0) {
          setActiveConversationId(null);
          setMessages([]);
          return;
        }

        const latestConversation = await getChatConversation(conversationList.items[0].id);
        if (ignore) return;

        setActiveConversationId(latestConversation.id);
        setMessages(latestConversation.messages);
      } catch (error) {
        if (ignore) return;

        setMessages([]);
        setConversations([]);
        setActiveConversationId(null);
        setLoadError(toErrorMessage(error, failedToLoadHistoryMessage));
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
  }, [failedToLoadHistoryMessage, isRemoteMode]);

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
        setMessages(detail.messages);
      } catch (error) {
        setLoadError(toErrorMessage(error, failedToLoadHistoryMessage));
      } finally {
        setIsInitializing(false);
      }
    },
    [activeConversationId, failedToLoadHistoryMessage, isRemoteMode]
  );

  const startNewChat = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setLoadError(null);
  }, []);

  const sendLocalMessage = useCallback(
    async (input: string) => {
      const userMessage = createLocalMessage("user", input);
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const assistantContent = await getWeaveyResponse(input);
        const assistantMessage = createLocalMessage("assistant", assistantContent);
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          createLocalMessage("assistant", toErrorMessage(error, localChatErrorMessage)),
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
          return [...withoutOptimistic, result.userMessage, result.assistantMessage];
        });
        setActiveConversationId(result.conversation.id);
        setConversations((prev) => upsertConversationSummary(prev, result.conversation));
        setChatSettings((prev) =>
          prev ?
            {
              ...prev,
              configSource: result.configSource,
            } :
            prev
        );
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          createLocalMessage("assistant", toErrorMessage(error, localChatErrorMessage), {
            source: "client_error",
          }),
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
    loadError ||
    (isRemoteMode && !isInitializing && chatSettings && !chatSettings.config ?
      chatSettings.canEdit ?
        remoteAdminConfigMessage :
        remoteMemberConfigMessage :
      null);

  return {
    messages,
    conversations,
    activeConversationId,
    chatSettings,
    isRemoteMode,
    isLoading,
    isInitializing,
    statusMessage,
    sendMessage,
    selectConversation,
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
  if (!runtimeConfig.columnsToAnswer.length) {
    throw new Error("columns_to_answer is empty. Please update Settings > AI.");
  }

  try {
    const data = await queryRagCollection(
      runtimeConfig.baseUrl,
      runtimeConfig.collectionName,
      {
        query: input,
        columns_to_answer: runtimeConfig.columnsToAnswer,
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

export type { ChatMessage, ConversationSummary, ResolvedChatSettings };
