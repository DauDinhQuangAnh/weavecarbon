"use client";

import { useSyncExternalStore } from "react";

export type AppLanguage = "vi" | "en";

/** Shared with the landing page toggle so the visitor's choice carries into the workspace. */
export const APP_LANGUAGE_STORAGE_KEY = "weavecarbon_language";
const CHANGE_EVENT = "weavecarbon-language-change";

export const readAppLanguage = (): AppLanguage => {
  if (typeof window === "undefined") return "vi";
  try {
    return window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY) === "en" ? "en" : "vi";
  } catch {
    return "vi";
  }
};

export const setAppLanguage = (language: AppLanguage) => {
  try {
    window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: language }));
};

const subscribe = (callback: () => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === APP_LANGUAGE_STORAGE_KEY) callback();
  };
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
};

export const useAppLanguage = (): AppLanguage =>
  useSyncExternalStore(subscribe, readAppLanguage, () => "vi");
