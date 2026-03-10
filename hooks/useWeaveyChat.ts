import { useCallback, useState } from "react";
import { queryRagCollection, readRagRuntimeConfig } from "@/lib/ragApi";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

interface UseWeaveyChatOptions {
  currentPage?: string;
  carbonData?: Record<string, unknown>;
}

export function useWeaveyChat(options: UseWeaveyChatOptions = {}) {
  void options;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: `user_${Date.now()}`,
        role: "user",
        content: input,
        createdAt: new Date()
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const assistantContent = await getWeaveyResponse(input);

        const assistantMessage: ChatMessage = {
          id: `assistant_${Date.now()}`,
          role: "assistant",
          content: assistantContent,
          createdAt: new Date()
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        console.error("Weavey chat error:", error);
        const fallbackErrorMessage =
          "AI is temporarily unavailable. Please verify AI settings and try again.";
        const errorMessage =
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : fallbackErrorMessage;

        setMessages((prev) => [
          ...prev,
          {
            id: `error_${Date.now()}`,
            role: "assistant",
            content: errorMessage,
            createdAt: new Date()
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading]
  );

  const clearHistory = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearHistory
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
        number_docs_retrieval: runtimeConfig.numberDocsRetrieval
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
    console.error("WeaveCarbon API error:", error);
    if (error instanceof Error && error.message.trim().length > 0) {
      throw new Error(error.message);
    }
    throw new Error("Failed to get response from RAG backend.");
  }
}
