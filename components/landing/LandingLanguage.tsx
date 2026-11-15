"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { landingMessages, type LandingLanguage } from "./landingMessages";

export type { LandingLanguage };

const STORAGE_KEY = "weavecarbon_language";

interface LandingLanguageContextValue {
  language: LandingLanguage;
  setLanguage: (language: LandingLanguage) => void;
  hasProvider: boolean;
}

const LandingLanguageContext = createContext<LandingLanguageContextValue>({
  language: "vi",
  setLanguage: () => {},
  hasProvider: false,
});

export function LandingLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LandingLanguage>("vi");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "vi") setLanguageState(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    return () => {
      document.documentElement.lang = "vi";
    };
  }, [language]);

  const setLanguage = useCallback((next: LandingLanguage) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
    setLanguageState(next);
  }, []);

  const value = useMemo(() => ({ language, setLanguage, hasProvider: true }), [language, setLanguage]);

  return <LandingLanguageContext.Provider value={value}>{children}</LandingLanguageContext.Provider>;
}

export const useLandingLanguage = () => useContext(LandingLanguageContext);

const lookup = (tree: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((node, segment) => {
    if (node && typeof node === "object" && segment in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[segment];
    }
    return undefined;
  }, tree);

/** next-intl style translator for landing copy, switching between the VI and EN dictionaries. */
export function useLandingT(namespace: keyof (typeof landingMessages)["vi"]) {
  const { language } = useLandingLanguage();
  return useMemo(() => {
    const resolve = (key: string) => lookup(landingMessages[language][namespace], key);
    return Object.assign(
      (key: string) => {
        const value = resolve(key);
        return typeof value === "string" ? value : `${String(namespace)}.${key}`;
      },
      { has: (key: string) => typeof resolve(key) === "string" }
    );
  }, [language, namespace]);
}
