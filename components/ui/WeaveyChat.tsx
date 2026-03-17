"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  Bot,
  Clock3,
  Loader2,
  Maximize2,
  MessageCircle,
  MessageSquarePlus,
  Minimize2,
  Send,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import {
  useWeaveyChat,
  type ChatMessage,
  type ConversationSummary,
} from "@/hooks/useWeaveyChat";
import { cn } from "@/lib/utils";

interface WeaveyChatProps {
  variant?: "landing" | "dashboard";
}

const formatConversationTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const now = new Date();
  const isSameDay = parsed.toDateString() === now.toDateString();

  return isSameDay
    ? parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : parsed.toLocaleDateString([], { month: "short", day: "numeric" });
};

const WeaveyChat: React.FC<WeaveyChatProps> = ({ variant = "landing" }) => {
  const t = useTranslations("dashboard.weaveyChat");
  const { user } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(variant === "landing");
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
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
  } = useWeaveyChat({
    currentPage: pathname,
    variant,
  });

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      if (!isOpen) return;

      const viewport = scrollAreaRef.current?.querySelector<HTMLElement>(
        "[data-radix-scroll-area-viewport]"
      );
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior });
        return;
      }

      messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
    },
    [isOpen]
  );

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      scrollToBottom(messages.length > 0 ? "smooth" : "auto");
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isExpanded, isLoading, isInitializing, isOpen, messages.length, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputValue.trim() || isLoading || isInitializing) {
      return;
    }

    void sendMessage(inputValue);
    setInputValue("");
  };

  const closeChat = () => {
    setIsOpen(false);
    setIsExpanded(false);
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isExpanded) return;
    if (event.target === event.currentTarget) {
      setIsExpanded(false);
    }
  };

  const welcomeMessage = user ? t("welcomeUser") : t("welcomeGuest");
  const emptyStateMessage = statusMessage || welcomeMessage;
  const showInheritedNotice =
    variant === "dashboard" &&
    isRemoteMode &&
    chatSettings?.configSource === "company_admin" &&
    Boolean(chatSettings.config);

  if (variant === "landing") {
    return (
      <div className="fixed z-50 md:bottom-6 md:right-6">
        {isOpen ? (
          <div className="animate-in slide-in-from-bottom-5 flex h-[min(70vh,34rem)] w-[min(22rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl duration-300 sm:h-[36rem] sm:w-[24rem]">
            <div className="flex items-center justify-start bg-linear-to-r from-primary to-accent p-4">
              <button
                type="button"
                onClick={closeChat}
                className="flex items-center gap-3 rounded-md px-1 py-0.5 text-left hover:bg-white/10"
                title={t("assistantTitleLanding")}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Weavey</h3>
                  <p className="text-xs text-white/80">{t("assistantTitleLanding")}</p>
                </div>
              </button>
            </div>

            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
              <div className="space-y-4">
                {messages.length === 0 ? <EmptyStateBubble message={emptyStateMessage} /> : null}

                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}

                {isLoading ? <TypingBubble /> : null}
                <div ref={messagesEndRef} aria-hidden="true" />
              </div>
            </ScrollArea>

            <div className="border-t border-border p-4">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  placeholder={t("inputPlaceholderLanding")}
                  className="flex-1"
                  disabled={isLoading}
                />

                <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => {
              setIsExpanded(false);
              setIsOpen(true);
            }}
            className="h-14 w-14 rounded-full bg-linear-to-r from-primary to-accent shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl"
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={handleBackdropClick}
      className={cn(
        isExpanded
          ? "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-2 md:p-8"
          : "fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6"
      )}
    >
      {isOpen ? (
        <div
          className={cn(
            "flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
            isExpanded
              ? "h-[86dvh] w-full max-w-5xl md:h-[82vh]"
              : "h-[min(72vh,33rem)] w-[min(24rem,calc(100vw-1rem))] md:h-[36rem] md:w-[min(30rem,calc(100vw-1.5rem))]"
          )}
        >
          <div className="flex items-center justify-between bg-linear-to-r from-primary to-accent p-3">
            <button
              type="button"
              onClick={closeChat}
              className="flex items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-white/10"
              title={t("assistantTitleDashboard")}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Weavey</h3>
                <p className="text-xs text-white/80">{t("assistantTitleDashboard")}</p>
              </div>
            </button>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={startNewChat}
                title={t("newChat")}
              >
                <MessageSquarePlus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={() => setIsExpanded((previous) => !previous)}
                title={isExpanded ? t("collapse") : t("expand")}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className={cn("flex flex-1 overflow-hidden", isExpanded && isRemoteMode && "flex-col md:flex-row")}>
            {isExpanded && isRemoteMode ? (
              <ConversationSidebar
                conversations={conversations}
                activeConversationId={activeConversationId}
                isInitializing={isInitializing}
                onSelectConversation={selectConversation}
                onStartNewChat={startNewChat}
                title={t("recentConversations")}
                emptyLabel={t("noConversations")}
                newChatLabel={t("newChat")}
              />
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col">
              {showInheritedNotice ? (
                <div className="border-b border-border/70 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  {t("inheritedFromAdmin")}
                </div>
              ) : null}

              <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                <div className="space-y-3">
                  {isInitializing && messages.length === 0 ? (
                    <SystemNotice icon={<Loader2 className="h-4 w-4 animate-spin" />}>
                      {t("loadingHistory")}
                    </SystemNotice>
                  ) : null}

                  {!isInitializing && messages.length === 0 ? (
                    <EmptyStateBubble message={emptyStateMessage} compact />
                  ) : null}

                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} compact />
                  ))}

                  {isLoading ? <TypingBubble compact /> : null}
                  <div ref={messagesEndRef} aria-hidden="true" />
                </div>
              </ScrollArea>

              <div className="border-t border-border p-3">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    placeholder={t("inputPlaceholderDashboard")}
                    className="h-9 flex-1 text-sm"
                    disabled={isLoading || isInitializing}
                  />

                  <Button
                    type="submit"
                    size="icon"
                    className="h-9 w-9"
                    disabled={isLoading || isInitializing || !inputValue.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => {
            setIsExpanded(false);
            setIsOpen(true);
          }}
          className="relative h-12 w-12 rounded-full bg-linear-to-r from-primary to-accent shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
        </Button>
      )}
    </div>
  );
};

const ConversationSidebar: React.FC<{
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  isInitializing: boolean;
  onSelectConversation: (conversationId: string) => void;
  onStartNewChat: () => void;
  title: string;
  emptyLabel: string;
  newChatLabel: string;
}> = ({
  conversations,
  activeConversationId,
  isInitializing,
  onSelectConversation,
  onStartNewChat,
  title,
  emptyLabel,
  newChatLabel,
}) => {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-border/70 bg-muted/20 md:w-72 md:border-b-0 md:border-r">
      <div className="flex items-center justify-between px-3 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-muted-foreground">{conversations.length}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onStartNewChat}>
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          {newChatLabel}
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        <ScrollArea className="h-full px-2 pb-2">
          <div className="space-y-2">
            {isInitializing && conversations.length === 0 ? (
              <SystemNotice icon={<Loader2 className="h-4 w-4 animate-spin" />}>
                {title}
              </SystemNotice>
            ) : null}

            {!isInitializing && conversations.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-3 py-6 text-center text-sm text-muted-foreground">
                {emptyLabel}
              </p>
            ) : null}

            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => void onSelectConversation(conversation.id)}
                className={cn(
                  "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                  conversation.id === activeConversationId
                    ? "border-primary/40 bg-primary/10"
                    : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                    {conversation.title}
                  </p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatConversationTime(conversation.updatedAt)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {conversation.lastMessagePreview || conversation.title}
                </p>
                <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock3 className="h-3 w-3" />
                  <span>{conversation.messageCount}</span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
};

const EmptyStateBubble: React.FC<{ message: string; compact?: boolean }> = ({
  message,
  compact,
}) => (
  <div className={cn("flex gap-3", compact && "gap-2")}>
    <div
      className={cn(
        "shrink-0 rounded-full bg-primary/10 flex items-center justify-center",
        compact ? "h-7 w-7" : "h-8 w-8"
      )}
    >
      <Bot className={cn("text-primary", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
    </div>
    <div
      className={cn(
        "max-w-[90%] rounded-2xl rounded-tl-sm bg-muted shadow-sm",
        compact ? "px-4 py-3" : "px-4 py-3.5"
      )}
    >
      <div className="prose prose-sm max-w-none leading-7 dark:prose-invert">
        <ReactMarkdown>{message}</ReactMarkdown>
      </div>
    </div>
  </div>
);

const TypingBubble: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div className={cn("flex gap-3", compact && "gap-2")}>
    <div
      className={cn(
        "shrink-0 rounded-full bg-primary/10 flex items-center justify-center",
        compact ? "h-7 w-7" : "h-8 w-8"
      )}
    >
      <Bot className={cn("text-primary", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
    </div>
    <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 shadow-sm">
      <div className="flex gap-1">
        <span
          className={cn("animate-bounce rounded-full bg-primary/60", compact ? "h-1.5 w-1.5" : "h-2 w-2")}
          style={{ animationDelay: "0ms" }}
        />
        <span
          className={cn("animate-bounce rounded-full bg-primary/60", compact ? "h-1.5 w-1.5" : "h-2 w-2")}
          style={{ animationDelay: "150ms" }}
        />
        <span
          className={cn("animate-bounce rounded-full bg-primary/60", compact ? "h-1.5 w-1.5" : "h-2 w-2")}
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  </div>
);

const SystemNotice: React.FC<{ icon?: React.ReactNode; children: React.ReactNode }> = ({
  icon,
  children,
}) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-3 py-3 text-sm text-muted-foreground">
    <div className="flex items-center gap-2">
      {icon}
      <span>{children}</span>
    </div>
  </div>
);

const MessageBubble: React.FC<{ message: ChatMessage; compact?: boolean }> = ({
  message,
  compact,
}) => {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex items-start gap-2", isUser && "flex-row-reverse")}>
      {!isUser ? (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-primary/10",
            compact ? "h-7 w-7" : "h-8 w-8"
          )}
        >
          <Bot className={cn("text-primary", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        </div>
      ) : null}

      <div
        className={cn(
          "w-fit max-w-[90%] break-words rounded-2xl px-4 shadow-sm",
          compact ? "py-3" : "py-3.5",
          isUser ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-muted"
        )}
      >
        <div
          className={cn(
            "prose prose-sm max-w-none leading-7 dark:prose-invert",
            compact && "text-[15px]"
          )}
        >
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default WeaveyChat;
