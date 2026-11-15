"use client";

import { Globe } from "lucide-react";
import { useLandingLanguage, useLandingT, type LandingLanguage } from "./LandingLanguage";

const LanguageToggle = ({ className = "" }: { className?: string }) => {
  const { language, setLanguage, hasProvider } = useLandingLanguage();
  const t = useLandingT("navigation");
  if (!hasProvider) return null;

  const option = (value: LandingLanguage, label: string) => (
    <button
      type="button"
      onClick={() => setLanguage(value)}
      aria-pressed={language === value}
      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
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
      className={`inline-flex items-center gap-1 rounded-xl border border-border/70 bg-background/75 p-1 shadow-sm backdrop-blur-xl ${className}`}
      role="group"
      aria-label={t("language")}
    >
      <Globe className="ml-1 h-4 w-4 text-muted-foreground" aria-hidden="true" />
      {option("vi", "VI")}
      {option("en", "EN")}
    </div>
  );
};

export default LanguageToggle;
