"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  Bot,
  ChevronDown,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isLauncherArmed, setIsLauncherArmed] = useState(false);
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [pendingDeleteConversation, setPendingDeleteConversation] =
    useState<ConversationSummary | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherButtonRef = useRef<HTMLButtonElement>(null);

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
  const isMobilePageMode = isPageMode && isMobileViewport;
  const isChatVisible = isPageMode || isOpen;
  const welcomeMessage = user ? t("welcomeUser") : t("welcomeGuest");
  const emptyStateMessage = statusMessage || welcomeMessage;
  const deleteConversationTitle = t("deleteConversationTitle");
  const deleteConversationAction = t("deleteConversationAction");
  const deletingConversationAction = t("deletingConversationAction");
  const deleteConversationSuccess = t("deleteConversationSuccess");
  const deleteConversationFailed = t("deleteConversationFailed");
  const deleteConversationCancel = t("cancel");
  const deleteConversationDescription = useMemo(() => {
    if (!pendingDeleteConversation) {
      return t("deleteConversationFallback");
    }

    return t("deleteConversationDescription", {
      title: pendingDeleteConversation.title,
    });
  }, [pendingDeleteConversation, t]);

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
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => {
      const isMobile = mediaQuery.matches;
      setIsMobileViewport(isMobile);

      if (!isMobile) {
        setIsLauncherArmed(false);
      }
    };

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

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

  useEffect(() => {
    if (isOpen) {
      setIsLauncherArmed(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isMobileViewport) {
      setIsMobileHistoryOpen(false);
    }
  }, [isMobileViewport]);

  useEffect(() => {
    if (isMobilePageMode && activeConversationId) {
      setIsMobileHistoryOpen(false);
    }
  }, [activeConversationId, isMobilePageMode]);

  useEffect(() => {
    if (!isMobileViewport || isOpen || isPageMode || !isLauncherArmed) {
      return;
    }

    const clearArmedState = () => {
      setIsLauncherArmed(false);
    };

    const timeoutId = window.setTimeout(clearArmedState, 3500);
    const handlePointerDown = (event: PointerEvent) => {
      if (launcherButtonRef.current?.contains(event.target as Node)) {
        return;
      }

      clearArmedState();
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isLauncherArmed, isMobileViewport, isOpen, isPageMode]);

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
    setIsLauncherArmed(false);
  };

  const openChat = useCallback(() => {
    setIsExpanded(false);
    setIsOpen(true);
    setIsLauncherArmed(false);
  }, []);

  const handleLauncherClick = useCallback(() => {
    if (isMobileViewport && !isLauncherArmed) {
      setIsLauncherArmed(true);
      return;
    }

    openChat();
  }, [isLauncherArmed, isMobileViewport, openChat]);

  const launcherClassName = cn(
    "rounded-full transition-all duration-300",
    isMobileViewport && !isLauncherArmed
      ? "border border-white/80 bg-linear-to-r from-primary/55 to-accent/55 text-white/90 opacity-45 shadow-md backdrop-blur-[2px]"
      : "bg-linear-to-r from-primary to-accent text-white shadow-lg hover:shadow-xl"
  );

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
            ref={launcherButtonRef}
            onClick={handleLauncherClick}
            className={cn(
              "h-14 w-14",
              launcherClassName,
              !isMobileViewport && "hover:scale-110"
            )}
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
        )}
      </div>
    );
  }

  if (isPageMode) {
    if (isMobilePageMode) {
      return (
        <>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="bg-linear-to-br from-primary to-accent px-3 py-3">
              <div className="flex items-center gap-2">
                {isRemoteMode ? (
                  <button
                    type="button"
                    onClick={() => setIsMobileHistoryOpen(true)}
                    className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-left shadow-sm backdrop-blur-sm transition-colors hover:bg-white/15"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/18 text-white">
                      <Clock3 className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                      {t("historyShort")}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                        {conversations.length}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 text-white/85" />
                    </div>
                  </button>
                ) : (
                  <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 shadow-sm backdrop-blur-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/18 text-white">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 truncate text-sm font-semibold text-white">
                      {t("assistantTitleDashboard")}
                    </span>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 shrink-0 rounded-xl border border-white/15 bg-white/12 px-3 text-xs font-semibold text-white shadow-none backdrop-blur-sm hover:bg-white/20"
                  onClick={startNewChat}
                  title={t("newChat")}
                >
                  <span className="flex items-center gap-1.5">
                    <MessageSquarePlus className="h-4 w-4 shrink-0" />
                    <span>{t("newChatShort")}</span>
                  </span>
                </Button>
              </div>
            </div>

            <div className="flex min-h-[58vh] flex-col bg-white">
              <ScrollArea className="flex-1 px-3 py-4" ref={scrollAreaRef}>
                <div className="space-y-3">
                  {isInitializing && messages.length === 0 ? (
                    <SystemNotice icon={<Loader2 className="h-4 w-4 animate-spin" />}>
                      {t("loadingHistory")}
                    </SystemNotice>
                  ) : null}

                  {!isInitializing && messages.length === 0 ? (
                    <MobilePageEmptyState message={emptyStateMessage} />
                  ) : null}

                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} compact />
                  ))}

                  {isLoading ? <TypingBubble compact /> : null}
                  <div ref={messagesEndRef} aria-hidden="true" />
                </div>
              </ScrollArea>

              <div className="border-t border-border bg-white/95 p-3">
                <form onSubmit={handleSubmit} className="flex items-end gap-2">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    placeholder={t("inputPlaceholderDashboard")}
                    className="h-10 flex-1 rounded-xl border-slate-200 bg-slate-50 px-3 text-sm shadow-none"
                    disabled={isLoading || isInitializing}
                  />

                  <Button
                    type="submit"
                    size="icon"
                    className="h-10 w-10 rounded-xl"
                    disabled={isLoading || isInitializing || !inputValue.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
          </div>

          {isRemoteMode ? (
            <MobileConversationHistoryDialog
              open={isMobileHistoryOpen}
              conversations={conversations}
              activeConversationId={activeConversationId}
              isInitializing={isInitializing}
              deletingConversationId={deletingConversationId}
              onOpenChange={setIsMobileHistoryOpen}
              onSelectConversation={selectConversation}
              onRequestDeleteConversation={setPendingDeleteConversation}
              title={t("historyShort")}
              emptyLabel={t("noConversations")}
              conversationsCountLabel={(count) => t("conversationsCount", { count })}
              deleteConversationLabel={deleteConversationAction}
            />
          ) : null}

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
                messageCountLabel={(count) => t("messagesCount", { count })}
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
        isExpanded || (isMobileViewport && isOpen)
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
              : isMobileViewport
                ? "h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none"
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
              {!isMobileViewport ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={() => setIsExpanded((previous) => !previous)}
                  title={isExpanded ? t("collapse") : t("expand")}
                >
                  {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              ) : null}
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
                messageCountLabel={(count) => t("messagesCount", { count })}
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

              <div className="border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
          ref={launcherButtonRef}
          onClick={handleLauncherClick}
          className={cn(
            "relative h-12 w-12",
            launcherClassName,
            !isMobileViewport && "hover:scale-105"
          )}
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

const MobileConversationHistoryDialog: React.FC<{
  open: boolean;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  isInitializing: boolean;
  deletingConversationId: string | null;
  onOpenChange: (open: boolean) => void;
  onSelectConversation: (conversationId: string) => void;
  onRequestDeleteConversation: (conversation: ConversationSummary) => void;
  title: string;
  emptyLabel: string;
  conversationsCountLabel: (count: number) => string;
  deleteConversationLabel: string;
}> = ({
  open,
  conversations,
  activeConversationId,
  isInitializing,
  deletingConversationId,
  onOpenChange,
  onSelectConversation,
  onRequestDeleteConversation,
  title,
  emptyLabel,
  conversationsCountLabel,
  deleteConversationLabel,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="max-w-md gap-0 overflow-hidden border-slate-200 bg-white p-0 shadow-xl sm:rounded-2xl max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:h-auto max-sm:max-h-[68dvh] max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-[28px] max-sm:rounded-b-none max-sm:border-b-0"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-200" />
        <DialogHeader className="space-y-2 border-b border-slate-200 px-4 pb-3 pt-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-semibold text-slate-900">{title}</DialogTitle>
            <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
              {conversations.length}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            {conversations.length > 0 ? conversationsCountLabel(conversations.length) : emptyLabel}
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[56dvh] px-3 py-3">
          <div className="space-y-1.5">
            {isInitializing && conversations.length === 0 ? (
              <SystemNotice icon={<Loader2 className="h-4 w-4 animate-spin" />}>
                {title}
              </SystemNotice>
            ) : null}

            {!isInitializing && conversations.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-3 py-5 text-center text-sm text-muted-foreground">
                {emptyLabel}
              </p>
            ) : null}

            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={cn(
                  "rounded-2xl border px-3 py-2.5 transition-all",
                  conversation.id === activeConversationId
                    ? "border-primary/25 bg-primary/5 shadow-sm"
                    : "border-slate-200 bg-white"
                )}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void onSelectConversation(conversation.id);
                      onOpenChange(false);
                    }}
                    className="min-w-0 flex-1 rounded-lg text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-semibold text-slate-900">
                        {conversation.title}
                      </p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatConversationTime(conversation.updatedAt)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs leading-5 text-slate-500">
                      {conversation.lastMessagePreview || conversation.title}
                    </p>
                  </button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-0.5 h-8 w-8 shrink-0 rounded-full text-slate-500"
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
      </DialogContent>
    </Dialog>
  );
};

const MobilePageEmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex min-h-[15rem] items-center justify-center">
    <div className="w-full rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-8 text-center shadow-sm">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-4 prose prose-sm max-w-none text-sm leading-6 text-slate-600 [&_*]:text-slate-600">
        <ReactMarkdown>{message}</ReactMarkdown>
      </div>
    </div>
  </div>
);

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
