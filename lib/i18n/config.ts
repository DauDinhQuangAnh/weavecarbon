export const locales = ["vi"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "vi";
