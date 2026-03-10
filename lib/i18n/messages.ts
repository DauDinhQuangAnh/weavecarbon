import { getLocale } from "next-intl/server";
import { cache } from "react";
import { defaultLocale, locales, type Locale } from "./config";
import { SHARED_NAMESPACES } from "./namespaces";

type MessageTree = Record<string, unknown>;

const isMessageTree = (value: unknown): value is MessageTree =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const mergeMessageTrees = (base: unknown, override: unknown): unknown => {
  if (isMessageTree(base) && isMessageTree(override)) {
    const merged: MessageTree = { ...base };

    Object.entries(override).forEach(([key, value]) => {
      merged[key] = mergeMessageTrees(base[key], value);
    });

    return merged;
  }

  return typeof override === "undefined" ? base : override;
};

const resolveFallbackLocale = (locale: Locale): Locale | null => {
  const fallback = locales.find((item) => item !== locale);
  return fallback ?? null;
};

const getMessageByPath = (messages: MessageTree, path: string[]): unknown => {
  let current: unknown = messages;
  for (const segment of path) {
    if (!isMessageTree(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
};

const setMessageByPath = (messages: MessageTree, path: string[], value: unknown) => {
  let current: MessageTree = messages;
  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index];
    const nextValue = current[segment];
    if (!isMessageTree(nextValue)) {
      current[segment] = {};
    }
    current = current[segment] as MessageTree;
  }

  current[path[path.length - 1]] = value;
};

const loadCommonMessages = cache(async (locale: Locale): Promise<MessageTree> => {
  const messagesModule = await import(`@/locales/${locale}/common.json`);
  return messagesModule.default as MessageTree;
});

export const pickMessagesByNamespaces = (messages: MessageTree, namespaces: string[]): MessageTree => {
  const picked: MessageTree = {};
  const uniqueNamespaces = [...new Set(namespaces.map((namespace) => namespace.trim()).filter(Boolean))];

  uniqueNamespaces.forEach((namespace) => {
    const path = namespace.split(".").map((segment) => segment.trim()).filter(Boolean);
    if (path.length === 0) return;

    const value = getMessageByPath(messages, path);
    if (typeof value === "undefined") return;

    setMessageByPath(picked, path, value);
  });

  return picked;
};

export const getScopedMessagesForLocale = async (
  locale: Locale,
  namespaces: string[]
): Promise<MessageTree> => {
  const commonMessages = await loadCommonMessages(locale);
  const localeScopedMessages = pickMessagesByNamespaces(commonMessages, namespaces);
  const fallbackLocale = resolveFallbackLocale(locale);

  if (!fallbackLocale) {
    return localeScopedMessages;
  }

  const fallbackMessages = await loadCommonMessages(fallbackLocale);
  const fallbackScopedMessages = pickMessagesByNamespaces(fallbackMessages, namespaces);

  return mergeMessageTrees(fallbackScopedMessages, localeScopedMessages) as MessageTree;
};

export const normalizeLocale = (locale: string): Locale =>
  locales.includes(locale as Locale) ? locale as Locale : defaultLocale;

export const getScopedMessages = async (namespaces: readonly string[]) => {
  const locale = normalizeLocale(await getLocale());
  const allNamespaces = [...new Set([...SHARED_NAMESPACES, ...namespaces])];
  const messages = await getScopedMessagesForLocale(locale, allNamespaces);

  return { locale, messages };
};
