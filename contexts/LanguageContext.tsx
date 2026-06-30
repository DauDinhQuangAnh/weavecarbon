
"use client";

import React, {
  createContext,
  useContext,
  ReactNode } from
"react";
import { type Locale, defaultLocale } from "@/lib/i18n/config";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export function LanguageProvider({ children }: {children: ReactNode;}) {
  return (
    <LanguageContext.Provider
      value={{ locale: defaultLocale, setLocale: () => {}, isLoading: false }}>
      {children}
    </LanguageContext.Provider>);

}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
