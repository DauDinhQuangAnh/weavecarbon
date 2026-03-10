export const locales = ["vi", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "vi";

export const localeNames: Record<Locale, string> = {
  vi: "VI",
  en: "EN"
};

export const localeFlagCodes: Record<Locale, string> = {
  vi: "vn",
  en: "gb"
};