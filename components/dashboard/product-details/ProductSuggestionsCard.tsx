"use client";

import React, { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingDown,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  generateProductSuggestions,
  readRagRuntimeConfig,
  type RagProductSuggestion,
} from "@/lib/ragApi";

interface ProductSuggestionsCardProps {
  productId: string;
}

const DIFFICULTY_STYLES: Record<RagProductSuggestion["difficulty"], string> = {
  easy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  hard: "border-rose-200 bg-rose-50 text-rose-700",
};

const TYPE_STYLES: Record<string, string> = {
  material: "border-teal-200 bg-teal-50 text-teal-700",
  transport: "border-sky-200 bg-sky-50 text-sky-700",
  manufacturing: "border-violet-200 bg-violet-50 text-violet-700",
  packaging: "border-orange-200 bg-orange-50 text-orange-700",
  end_of_life: "border-slate-200 bg-slate-100 text-slate-700",
};

const normalizeDifficulty = (
  value: string
): RagProductSuggestion["difficulty"] => {
  if (value === "easy" || value === "hard") {
    return value;
  }
  return "medium";
};

const ProductSuggestionsCard: React.FC<ProductSuggestionsCardProps> = ({
  productId,
}) => {
  const locale = useLocale();
  const t = useTranslations("productDetail.aiSuggestions");
  const requestSequenceRef = useRef(0);
  const [suggestions, setSuggestions] = useState<RagProductSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    requestSequenceRef.current += 1;
    setSuggestions([]);
    setIsLoading(false);
    setError(null);
    setHasLoaded(false);
  }, [productId]);

  const getDifficultyLabel = (value: string) => {
    const normalized = normalizeDifficulty(value);
    return t(`difficulty.${normalized}`);
  };

  const getTypeLabel = (value: string) => {
    if (t.has(`types.${value}`)) {
      return t(`types.${value}`);
    }
    return value;
  };

  const getTypeStyle = (value: string) =>
    TYPE_STYLES[value] || "border-slate-200 bg-slate-100 text-slate-700";

  const handleGenerateSuggestions = async () => {
    if (!productId || isLoading) return;

    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    const runtimeConfig = readRagRuntimeConfig();

    setIsLoading(true);
    setError(null);

    try {
      const response = await generateProductSuggestions(
        runtimeConfig.baseUrl,
        productId,
        {
          product_id: productId,
          language: locale.toLowerCase().startsWith("vi") ? "vi" : "en",
        },
        runtimeConfig.timeoutMs
      );

      if (requestSequenceRef.current !== requestId) return;

      setSuggestions(response.suggestions);
      setHasLoaded(true);
    } catch (err) {
      if (requestSequenceRef.current !== requestId) return;

      setSuggestions([]);
      setHasLoaded(true);
      setError(
        err instanceof Error && err.message.trim().length > 0
          ? err.message
          : t("errors.generic")
      );
    } finally {
      if (requestSequenceRef.current === requestId) {
        setIsLoading(false);
      }
    }
  };

  const buttonLabel = isLoading
    ? t("buttonLoading")
    : hasLoaded
      ? t("buttonRegenerate")
      : t("buttonGenerate");

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-200 bg-slate-50/70 px-4 py-3 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              {t("title")}
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-slate-600">
              {t("subtitle")}
            </CardDescription>
          </div>

          <Button
            type="button"
            size="sm"
            className="shrink-0"
            onClick={() => void handleGenerateSuggestions()}
            disabled={isLoading || !productId}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : hasLoaded ? (
              <RefreshCw className="mr-2 h-4 w-4" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {buttonLabel}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-5">
        {!hasLoaded && !isLoading ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-sm text-slate-700">{t("idleDescription")}</p>
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("loadingState")}
              </div>
              <p className="mt-2 text-sm text-slate-600">{t("loadingHint")}</p>
            </div>
            <div className="h-24 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
            <div className="h-24 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div>
                <p className="text-sm font-medium text-rose-800">
                  {t("errorTitle")}
                </p>
                <p className="mt-1 text-sm text-rose-700">{error}</p>
              </div>
            </div>
          </div>
        ) : null}

        {!isLoading && hasLoaded && !error && suggestions.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700">{t("empty")}</p>
          </div>
        ) : null}

        {!isLoading &&
          suggestions.map((suggestion) => {
            const difficulty = normalizeDifficulty(suggestion.difficulty);

            return (
              <div
                key={suggestion.id}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-slate-900">
                          {suggestion.title}
                        </h4>
                        <Badge
                          variant="outline"
                          className={getTypeStyle(suggestion.type)}
                        >
                          {getTypeLabel(suggestion.type)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={DIFFICULTY_STYLES[difficulty]}
                        >
                          {getDifficultyLabel(difficulty)}
                        </Badge>
                      </div>
                      <p className="text-sm leading-6 text-slate-700">
                        {suggestion.description}
                      </p>
                    </div>

                    <Badge
                      variant="outline"
                      className="border-emerald-200 bg-emerald-50 text-emerald-700"
                    >
                      <TrendingDown className="mr-1 h-3.5 w-3.5" />
                      {t("reductionLabel", {
                        value: Math.round(suggestion.potentialReduction),
                      })}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
};

export default ProductSuggestionsCard;
