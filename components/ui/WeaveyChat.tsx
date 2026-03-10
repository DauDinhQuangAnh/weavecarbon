"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Bot, Maximize2, MessageCircle, Minimize2, Send, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useWeaveyChat, type ChatMessage } from "@/hooks/useWeaveyChat";
import { cn } from "@/lib/utils";

interface WeaveyChatProps {
  variant?: "landing" | "dashboard";
}

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

  const { messages, isLoading, sendMessage, clearHistory } = useWeaveyChat({
    currentPage: pathname
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
  }, [isExpanded, isLoading, isOpen, messages.length, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      sendMessage(inputValue);
      setInputValue("");
    }
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
  if (variant === "landing") {
    return (
      <div className="fixed md:bottom-6 md:right-6 z-50">
        {isOpen ?
        <div className="animate-in slide-in-from-bottom-5 flex h-[min(70vh,34rem)] w-[min(22rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl duration-300 sm:h-[36rem] sm:w-[24rem]">
            <div className="bg-linear-to-r from-primary to-accent p-4 flex items-center justify-start">
              <button
                type="button"
                onClick={closeChat}
                className="flex items-center gap-3 rounded-md px-1 py-0.5 text-left hover:bg-white/10"
                title={t("assistantTitleLanding")}>

                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Weavey</h3>
                  <p className="text-xs text-white/80">
                    {t("assistantTitleLanding")}
                  </p>
                </div>
              </button>
            </div>

            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
              <div className="space-y-4">
                {messages.length === 0 &&
              <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                      <div className="text-sm prose prose-sm dark:prose-invert">
                        <ReactMarkdown>{welcomeMessage}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
              }

                {messages.map((message) =>
              <MessageBubble key={message.id} message={message} />
              )}

                {isLoading &&
              <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1">
                        <span
                      className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }} />

                        <span
                      className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }} />

                        <span
                      className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }} />

                      </div>
                    </div>
                  </div>
              }
                <div ref={messagesEndRef} aria-hidden="true" />
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-border">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={t("inputPlaceholderLanding")}
                className="flex-1"
                disabled={isLoading} />

                <Button
                type="submit"
                size="icon"
                disabled={isLoading || !inputValue.trim()}>

                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </div> :

        <Button
          onClick={() => {
            setIsExpanded(false);
            setIsOpen(true);
          }}
          className="w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 bg-linear-to-r from-primary to-accent hover:scale-110">

            <MessageCircle className="w-6 h-6" />
          </Button>
        }
      </div>);

  }

  return (
      <div
        onClick={handleBackdropClick}
        className={cn(
          isExpanded ?
            "fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-2 md:p-8" :
            "fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50"
        )}>
      {isOpen ?
      <div
        className={cn(
          "bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden",
          isExpanded ?
            "h-[86dvh] w-full max-w-5xl md:h-[82vh]" :
            "h-[min(72vh,33rem)] w-[min(24rem,calc(100vw-1rem))] md:h-[36rem] md:w-[min(30rem,calc(100vw-1.5rem))]"
        )}>
          <div className="bg-linear-to-r from-primary to-accent p-3 flex items-center justify-between">
            <button
              type="button"
              onClick={closeChat}
              className="flex items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-white/10"
              title={t("assistantTitleDashboard")}>

              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">Weavey</h3>
                <p className="text-xs text-white/80">{t("assistantTitleDashboard")}</p>
              </div>
            </button>
            <div className="flex items-center gap-1">
              <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-8 w-8"
              onClick={() => setIsExpanded((previous) => !previous)}
              title={isExpanded ? "Thu nhỏ" : "Mở rộng"}>

                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-8 w-8"
              onClick={clearHistory}
              title={t("clearHistory")}>

                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            <div className="space-y-3">
              {messages.length === 0 &&
            <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div
                    className={cn(
                      "bg-muted rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm",
                      isExpanded ? "max-w-[92%]" : "max-w-[90%]"
                    )}>
                    <div className="prose prose-sm max-w-none leading-7 dark:prose-invert">
                      <ReactMarkdown>{welcomeMessage}</ReactMarkdown>
                    </div>
                  </div>
                </div>
            }

              {messages.map((message) =>
            <MessageBubble key={message.id} message={message} compact />
            )}

              {isLoading &&
            <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      <span
                    className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }} />

                      <span
                    className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }} />

                      <span
                    className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }} />

                    </div>
                  </div>
                </div>
            }
              <div ref={messagesEndRef} aria-hidden="true" />
            </div>
          </ScrollArea>

          <div className="p-3 border-t border-border">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t("inputPlaceholderDashboard")}
              className="flex-1 h-9 text-sm"
              disabled={isLoading} />

              <Button
              type="submit"
              size="icon"
              className="h-9 w-9"
              disabled={isLoading || !inputValue.trim()}>

                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div> :

      <Button
        onClick={() => {
          setIsExpanded(false);
          setIsOpen(true);
        }}
        className="w-12 h-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 bg-linear-to-r from-primary to-accent hover:scale-105 relative">

          <MessageCircle className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
        </Button>
      }
    </div>);

};

const MessageBubble: React.FC<{message: ChatMessage;compact?: boolean;}> = ({
  message,
  compact
}) => {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex items-start gap-2", isUser && "flex-row-reverse")}>
      {!isUser &&
      <div
        className={cn(
          "rounded-full bg-primary/10 flex items-center justify-center shrink-0",
          compact ? "w-7 h-7" : "w-8 h-8"
        )}>

          <Bot
          className={cn("text-primary", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />

        </div>
      }
      <div
        className={cn(
          "w-fit break-words rounded-2xl shadow-sm",
          compact ?
            "max-w-[88%] px-4 py-3" :
            "max-w-[90%] px-4 py-3.5",
          isUser ?
          "bg-primary text-primary-foreground rounded-tr-sm" :
          "bg-muted rounded-tl-sm"
        )}>

        <div
          className={cn(
            "prose prose-sm max-w-none leading-7 dark:prose-invert",
            compact && "text-[15px]"
          )}>

          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>);

};

export default WeaveyChat;
