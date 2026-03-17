"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
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
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  displayMode?: "widget" | "page";
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

const getActionErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;

const WeaveyChat: React.FC<WeaveyChatProps> = ({
  variant = "landing",
  displayMode = "widget",
}) => {
  const t = useTranslations("dashboard.weaveyChat");
  const { user } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(variant === "landing");
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [pendingDeleteConversation, setPendingDeleteConversation] =
    useState<ConversationSummary | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
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
  } = useWeaveyChat({
    currentPage: pathname,
    variant,
  });

  const isPageMode = displayMode === "page";
  const isChatVisible = isPageMode || isOpen;
  const welcomeMessage = user ? t("welcomeUser") : t("welcomeGuest");
  const emptyStateMessage = statusMessage || welcomeMessage;
  const deleteConversationTitle = "Delete conversation";
  const deleteConversationAction = "Delete conversation";
  const deletingConversationAction = "Deleting...";
  const deleteConversationSuccess = "Conversation deleted.";
  const deleteConversationFailed = "Unable to delete conversation.";
  const deleteConversationCancel = "Cancel";
  const deleteConversationDescription = useMemo(() => {
    if (!pendingDeleteConversation) {
      return "Are you sure you want to delete this conversation?";
    }

    return `Are you sure you want to delete "${pendingDeleteConversation.title}"?`;
  }, [pendingDeleteConversation]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      if (!isChatVisible) return;

      const viewport = scrollAreaRef.current?.querySelector<HTMLElement>(
        "[data-radix-scroll-area-viewport]"
      );

      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior });
        return;
      }

      messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
    },
    [isChatVisible]
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
    if (isChatVisible) {
      inputRef.current?.focus();
    }
  }, [isChatVisible]);

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

  const handleConfirmDeleteConversation = useCallback(async () => {
    if (!pendingDeleteConversation) {
      return;
    }

    try {
      await deleteConversation(pendingDeleteConversation.id);
      toast.success(deleteConversationSuccess);
      setPendingDeleteConversation(null);
    } catch (error) {
      toast.error(getActionErrorMessage(error, deleteConversationFailed));
    }
  }, [
    deleteConversation,
    deleteConversationFailed,
    deleteConversationSuccess,
    pendingDeleteConversation,
  ]);

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isExpanded) return;
    if (event.target === event.currentTarget) {
      setIsExpanded(false);
    }
  };

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

  if (isPageMode) {
    return (
      <>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 bg-linear-to-r from-primary to-accent p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Weavey</h3>
                <p className="text-sm text-white/80">{t("assistantTitleDashboard")}</p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-white hover:bg-white/20 md:w-auto"
              onClick={startNewChat}
              title={t("newChat")}
            >
              <MessageSquarePlus className="mr-2 h-4 w-4" />
              {t("newChat")}
            </Button>
          </div>

          <div className="flex min-h-[72vh] flex-col overflow-hidden md:flex-row">
            {isRemoteMode ? (
              <ConversationSidebar
                conversations={conversations}
                activeConversationId={activeConversationId}
                isInitializing={isInitializing}
                deletingConversationId={deletingConversationId}
                onSelectConversation={selectConversation}
                onRequestDeleteConversation={setPendingDeleteConversation}
                onStartNewChat={startNewChat}
                title={t("recentConversations")}
                emptyLabel={t("noConversations")}
                newChatLabel={t("newChat")}
                messageCountLabel={(count) => `${count} messages`}
                deleteConversationLabel={deleteConversationAction}
              />
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col">
              <ScrollArea className="flex-1 p-5" ref={scrollAreaRef}>
                <div className="space-y-4">
                  {isInitializing && messages.length === 0 ? (
                    <SystemNotice icon={<Loader2 className="h-4 w-4 animate-spin" />}>
                      {t("loadingHistory")}
                    </SystemNotice>
                  ) : null}

                  {!isInitializing && messages.length === 0 ? (
                    <EmptyStateBubble message={emptyStateMessage} />
                  ) : null}

                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}

                  {isLoading ? <TypingBubble /> : null}
                  <div ref={messagesEndRef} aria-hidden="true" />
                </div>
              </ScrollArea>

              <div className="border-t border-border p-4">
                <form onSubmit={handleSubmit} className="flex gap-3">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    placeholder={t("inputPlaceholderDashboard")}
                    className="h-11 flex-1 text-sm"
                    disabled={isLoading || isInitializing}
                  />

                  <Button
                    type="submit"
                    size="icon"
                    className="h-11 w-11"
                    disabled={isLoading || isInitializing || !inputValue.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>

        <DeleteConversationDialog
          open={Boolean(pendingDeleteConversation)}
          deletingConversationId={deletingConversationId}
          title={deleteConversationTitle}
          description={deleteConversationDescription}
          cancelLabel={deleteConversationCancel}
          confirmLabel={deleteConversationAction}
          confirmingLabel={deletingConversationAction}
          onOpenChange={(open) => {
            if (!open && !deletingConversationId) {
              setPendingDeleteConversation(null);
            }
          }}
          onConfirm={handleConfirmDeleteConversation}
        />
      </>
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
              ? "h-[86dvh] w-full max-w-6xl md:h-[82vh]"
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

          <div
            className={cn(
              "flex flex-1 overflow-hidden",
              isExpanded && isRemoteMode && "flex-col md:flex-row"
            )}
          >
            {isExpanded && isRemoteMode ? (
              <ConversationSidebar
                conversations={conversations}
                activeConversationId={activeConversationId}
                isInitializing={isInitializing}
                deletingConversationId={deletingConversationId}
                onSelectConversation={selectConversation}
                onRequestDeleteConversation={setPendingDeleteConversation}
                onStartNewChat={startNewChat}
                title={t("recentConversations")}
                emptyLabel={t("noConversations")}
                newChatLabel={t("newChat")}
                messageCountLabel={(count) => `${count} messages`}
                deleteConversationLabel={deleteConversationAction}
              />
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col">
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

      <DeleteConversationDialog
        open={Boolean(pendingDeleteConversation)}
        deletingConversationId={deletingConversationId}
        title={deleteConversationTitle}
        description={deleteConversationDescription}
        cancelLabel={deleteConversationCancel}
        confirmLabel={deleteConversationAction}
        confirmingLabel={deletingConversationAction}
        onOpenChange={(open) => {
          if (!open && !deletingConversationId) {
            setPendingDeleteConversation(null);
          }
        }}
        onConfirm={handleConfirmDeleteConversation}
      />
    </div>
  );
};

const DeleteConversationDialog: React.FC<{
  open: boolean;
  deletingConversationId: string | null;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmingLabel: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}> = ({
  open,
  deletingConversationId,
  title,
  description,
  cancelLabel,
  confirmLabel,
  confirmingLabel,
  onOpenChange,
  onConfirm,
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="max-w-md border-slate-200 bg-white">
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={Boolean(deletingConversationId)}>
          {cancelLabel}
        </AlertDialogCancel>
        <AlertDialogAction
          variant="destructive"
          disabled={Boolean(deletingConversationId)}
          onClick={(event) => {
            event.preventDefault();
            void onConfirm();
          }}
        >
          {deletingConversationId ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {confirmingLabel}
            </>
          ) : (
            confirmLabel
          )}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

const ConversationSidebar: React.FC<{
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  isInitializing: boolean;
  deletingConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onRequestDeleteConversation: (conversation: ConversationSummary) => void;
  onStartNewChat: () => void;
  title: string;
  emptyLabel: string;
  newChatLabel: string;
  messageCountLabel: (count: number) => string;
  deleteConversationLabel: string;
}> = ({
  conversations,
  activeConversationId,
  isInitializing,
  deletingConversationId,
  onSelectConversation,
  onRequestDeleteConversation,
  onStartNewChat,
  title,
  emptyLabel,
  newChatLabel,
  messageCountLabel,
  deleteConversationLabel,
}) => {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-border/70 bg-slate-50/70 md:w-80 md:border-b-0 md:border-r lg:w-[21rem]">
      <div className="border-b border-border/70 bg-white/80 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{title}</p>
          <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
            {conversations.length}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full justify-center"
          onClick={onStartNewChat}
        >
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          {newChatLabel}
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        <ScrollArea className="h-full px-3 py-3">
          <div className="space-y-2.5">
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
              <div
                key={conversation.id}
                className={cn(
                  "group rounded-xl border p-2 transition-all",
                  conversation.id === activeConversationId
                    ? "border-primary/30 bg-primary/5 shadow-sm"
                    : "border-slate-200/80 bg-white/90 hover:border-slate-300 hover:bg-white hover:shadow-sm"
                )}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => void onSelectConversation(conversation.id)}
                    className="min-w-0 flex-1 rounded-lg px-1 py-1 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-1 text-sm font-semibold text-slate-900">
                        {conversation.title}
                      </p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatConversationTime(conversation.updatedAt)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                      {conversation.lastMessagePreview || conversation.title}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock3 className="h-3 w-3" />
                      <span>{messageCountLabel(conversation.messageCount)}</span>
                    </div>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 shrink-0 rounded-full text-slate-500",
                      deletingConversationId && deletingConversationId !== conversation.id
                        ? "opacity-50"
                        : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRequestDeleteConversation(conversation);
                    }}
                    disabled={Boolean(deletingConversationId)}
                    title={deleteConversationLabel}
                    aria-label={`${deleteConversationLabel}: ${conversation.title}`}
                  >
                    {deletingConversationId === conversation.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
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
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10",
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
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10",
        compact ? "h-7 w-7" : "h-8 w-8"
      )}
    >
      <Bot className={cn("text-primary", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
    </div>
    <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 shadow-sm">
      <div className="flex gap-1">
        <span
          className={cn(
            "animate-bounce rounded-full bg-primary/60",
            compact ? "h-1.5 w-1.5" : "h-2 w-2"
          )}
          style={{ animationDelay: "0ms" }}
        />
        <span
          className={cn(
            "animate-bounce rounded-full bg-primary/60",
            compact ? "h-1.5 w-1.5" : "h-2 w-2"
          )}
          style={{ animationDelay: "150ms" }}
        />
        <span
          className={cn(
            "animate-bounce rounded-full bg-primary/60",
            compact ? "h-1.5 w-1.5" : "h-2 w-2"
          )}
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
          "min-w-[3.25rem] w-fit max-w-[90%] break-words rounded-2xl px-4 shadow-sm",
          compact ? "py-3" : "py-3.5",
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-muted"
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
