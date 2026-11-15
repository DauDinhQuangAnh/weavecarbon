"use client";

import { Globe } from "lucide-react";
import { setAppLanguage, useAppLanguage, type AppLanguage } from "@/lib/i18n/appLanguage";

/** VI / EN switch for the workspace. The labels stay fixed so the switch is never auto-translated. */
export default function AppLanguageToggle({ compact = false }: { compact?: boolean }) {
  const language = useAppLanguage();

  const option = (value: AppLanguage, label: string) => (
    <button
      type="button"
      onClick={() => setAppLanguage(value)}
      aria-pressed={language === value}
      className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-all duration-200 ${
        language === value
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      data-no-auto-i18n
      role="group"
      aria-label={language === "en" ? "Language" : "Ngôn ngữ"}
      className="inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-background/80 p-0.5 shadow-sm"
    >
      {!compact && <Globe className="mx-1 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
      {option("vi", "VI")}
      {option("en", "EN")}
    </div>
  );
}
