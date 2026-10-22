"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Factory,
  Flame,
  Info,
  Leaf,
  Loader2,
  Search,
  Sparkles,
  Truck,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  recommendEmissionFactor,
  queryRagSemanticFactor,
  type FactorRecommendationResult,
  type RecommendedFactorItem,
  type InstantEmissionsEstimate,
  type RagFactorLookupResult,
} from "@/lib/ai/factorRecommendationAiService";

interface SmartFactorSuggestionCardProps {
  activityType: string;
  quantity?: number | string | null;
  canonicalUnit?: string | null;
  reference?: string | null;
  geography?: string | null;
  onApplyFactor?: (factor: RecommendedFactorItem, instantEstimate?: InstantEmissionsEstimate) => void;
  compact?: boolean;
  className?: string;
}

export default function SmartFactorSuggestionCard({
  activityType,
  quantity,
  canonicalUnit,
  reference,
  geography = "VN",
  onApplyFactor,
  compact = false,
  className = "",
}: SmartFactorSuggestionCardProps) {
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [selectedFactorOverride, setSelectedFactorOverride] = useState<RecommendedFactorItem | null>(null);
  const [applied, setApplied] = useState(false);
  const [showRagSearch, setShowRagSearch] = useState(false);
  const [ragQuery, setRagQuery] = useState("");
  const [isSearchingRag, setIsSearchingRag] = useState(false);
  const [ragResult, setRagResult] = useState<RagFactorLookupResult | null>(null);

  const handleSearchRag = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!ragQuery.trim()) return;
    setIsSearchingRag(true);
    try {
      const res = await queryRagSemanticFactor(ragQuery, {
        activityType,
        canonicalUnit: canonicalUnit || undefined,
      });
      setRagResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingRag(false);
    }
  };

  // Tính toán gợi ý từ AI
  const recommendation: FactorRecommendationResult = useMemo(() => {
    return recommendEmissionFactor({
      activityType,
      quantity,
      canonicalUnit,
      reference,
      geography,
    });
  }, [activityType, quantity, canonicalUnit, reference, geography]);

  // Nếu người dùng chọn một hệ số thay thế
  const activeFactor = selectedFactorOverride || recommendation.primaryFactor;

  // Tính lại ước tính nếu chọn override
  const activeEstimate: InstantEmissionsEstimate | undefined = useMemo(() => {
    if (!selectedFactorOverride || !recommendation.instantEstimate) {
      return recommendation.instantEstimate;
    }
    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty < 0) return undefined;

    const emissionsKgCo2e = numQty * selectedFactorOverride.factorValue;
    const emissionsTco2e = emissionsKgCo2e / 1000;
    let biogenicTco2: number | undefined;
    if (selectedFactorOverride.biogenicCarbonKgPerUnit) {
      biogenicTco2 = (numQty * selectedFactorOverride.biogenicCarbonKgPerUnit) / 1000;
    }

    return {
      quantity: numQty,
      inputUnit: canonicalUnit || selectedFactorOverride.unit,
      factorValue: selectedFactorOverride.factorValue,
      factorUnit: selectedFactorOverride.unit,
      emissionsKgCo2e: Number(emissionsKgCo2e.toFixed(3)),
      emissionsTco2e: Number(emissionsTco2e.toFixed(4)),
      biogenicTco2: biogenicTco2 ? Number(biogenicTco2.toFixed(4)) : undefined,
      formulaExplanation: `${numQty.toLocaleString("en-US")} ${canonicalUnit || selectedFactorOverride.unit} × ${selectedFactorOverride.factorValue} ${selectedFactorOverride.unit} = ${emissionsTco2e.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 4 })} tCO₂e`,
    };
  }, [selectedFactorOverride, recommendation.instantEstimate, quantity, canonicalUnit]);

  const handleApply = (factor: RecommendedFactorItem) => {
    if (onApplyFactor) {
      onApplyFactor(factor, activeEstimate);
    }
    setApplied(true);
    setTimeout(() => setApplied(false), 2500);
  };

  const getScopeBadgeColor = (scope: string) => {
    if (scope.includes("Scope 1")) return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300";
    if (scope.includes("Scope 2")) return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300";
    return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300";
  };

  const getActivityIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes("elect") || t.includes("power")) return <Zap className="h-4 w-4 text-amber-500" />;
    if (t.includes("diesel") || t.includes("coal") || t.includes("lpg") || t.includes("gas"))
      return <Flame className="h-4 w-4 text-orange-500" />;
    if (t.includes("biomass") || t.includes("cotton") || t.includes("organic"))
      return <Leaf className="h-4 w-4 text-emerald-500" />;
    if (t.includes("freight") || t.includes("transport") || t.includes("logistics"))
      return <Truck className="h-4 w-4 text-sky-500" />;
    return <Factory className="h-4 w-4 text-slate-500" />;
  };

  return (
    <div
      className={`rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 via-slate-50/50 to-white p-3.5 shadow-xs dark:border-emerald-900/50 dark:from-emerald-950/20 dark:via-slate-900/40 dark:to-slate-950 ${className}`}
    >
      {/* 1. Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-emerald-100/70 dark:border-emerald-900/30">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
            <Sparkles className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              AI Gợi Ý Hệ Số Phát Thải
              <span className="text-[10px] font-normal text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded font-mono">
                {activeFactor.matchScore}% phù hợp
              </span>
            </h4>
            <p className="text-[11px] text-muted-foreground truncate max-w-[280px]">
              {activeFactor.matchReasonVi}
            </p>
          </div>
        </div>

        {onApplyFactor && (
          <Button
            type="button"
            size="sm"
            onClick={() => handleApply(activeFactor)}
            className={`h-7 px-2.5 text-xs font-semibold shadow-xs transition-all ${
              applied
                ? "bg-emerald-700 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600"
            }`}
          >
            {applied ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1" />
                Đã áp dụng
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 mr-1" />
                Áp dụng hệ số
              </>
            )}
          </Button>
        )}
      </div>

      {/* 2. Active Factor Card */}
      <div className="pt-2.5 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <div className="flex items-center gap-1.5">
            {getActivityIcon(activityType)}
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {activeFactor.label}
            </span>
          </div>

          <div className="flex items-baseline gap-1 self-start sm:self-auto">
            <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
              {activeFactor.factorValue}
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {activeFactor.unit}
            </span>
          </div>
        </div>

        {/* Tags & Metadata */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className={`px-1.5 py-0.5 rounded border font-medium ${getScopeBadgeColor(activeFactor.scope)}`}>
            {activeFactor.scope}
          </span>
          <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300">
            {activeFactor.sourceName}
          </span>
          <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-mono">
            {activeFactor.gwpBasis}
          </span>
          <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400">
            {activeFactor.boundary}
          </span>
        </div>

        {/* 3. Instant Emissions Preview (nếu có số lượng) */}
        {activeEstimate && (
          <div className="rounded-lg border border-emerald-200/90 bg-emerald-50/50 p-2.5 text-xs dark:border-emerald-900/40 dark:bg-emerald-950/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                Ước tính phát thải tức thời:
              </span>
              <span className="text-sm font-extrabold text-emerald-800 dark:text-emerald-200 font-mono">
                {activeEstimate.emissionsTco2e.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 4 })}{" "}
                <span className="text-xs font-bold">tCO₂e</span>
              </span>
            </div>

            <div className="text-[10px] text-muted-foreground font-mono truncate" title={activeEstimate.formulaExplanation}>
              Công thức: {activeEstimate.formulaExplanation}
            </div>

            {activeEstimate.biogenicTco2 !== undefined && (
              <div className="text-[10px] text-amber-800 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200/60 flex items-center gap-1">
                <Leaf className="h-3 w-3 text-amber-600" />
                <span>
                  CO₂ sinh học (Biogenic): <strong>{activeEstimate.biogenicTco2.toLocaleString("en-US", { minimumFractionDigits: 3 })} tCO₂</strong> (Tách biệt theo GHG Protocol)
                </span>
              </div>
            )}

            {activeEstimate.unitWarning && (
              <div className="text-[10px] text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200/60 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />
                <span>{activeEstimate.unitWarning}</span>
              </div>
            )}
          </div>
        )}

        {/* 4. Alternatives Toggle & Dropdown */}
        {recommendation.alternatives.length > 0 && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAlternatives(!showAlternatives)}
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 flex items-center gap-1 transition-colors"
            >
              <span>Xem {recommendation.alternatives.length} hệ số thay thế khả dụng</span>
              {showAlternatives ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showAlternatives && (
              <div className="mt-2 space-y-1.5 border-t border-dashed border-emerald-200/60 pt-2 dark:border-emerald-900/40">
                {recommendation.alternatives.map((alt) => {
                  const isCurrent = activeFactor.factorId === alt.factorId;
                  return (
                    <div
                      key={alt.factorId}
                      className={`flex items-center justify-between rounded-md p-2 text-xs transition-colors border ${
                        isCurrent
                          ? "bg-emerald-100/50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-700"
                          : "bg-white/60 hover:bg-white border-slate-200/60 dark:bg-slate-900/40 dark:hover:bg-slate-900"
                      }`}
                    >
                      <div className="space-y-0.5 pr-2">
                        <div className="font-medium text-slate-800 dark:text-slate-200 text-[11px] flex items-center gap-1">
                          <span>{alt.label}</span>
                          <span className="text-[9px] text-muted-foreground font-mono">({alt.scope})</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[260px]">
                          {alt.sourceName} · {alt.matchReasonVi}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                          {alt.factorValue} <span className="text-[10px] text-muted-foreground">{alt.unit}</span>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isCurrent}
                          onClick={() => {
                            setSelectedFactorOverride(alt);
                            if (onApplyFactor) handleApply(alt);
                          }}
                          className="h-6 px-1.5 text-[10px] text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100/60 dark:text-emerald-400"
                        >
                          {isCurrent ? "Đang chọn" : "Chọn"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {/* 5. RAG Extended Search Section */}
        <div className="pt-2 border-t border-emerald-100/70 dark:border-emerald-900/30">
          <button
            type="button"
            onClick={() => setShowRagSearch(!showRagSearch)}
            className="text-[11px] font-semibold text-sky-700 hover:text-sky-800 dark:text-sky-400 flex items-center gap-1.5 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5 text-sky-600" />
            <span>Tra cứu hệ số mở rộng bằng RAG Knowledge Base</span>
            {showRagSearch ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showRagSearch && (
            <div className="mt-2 space-y-2 rounded-lg border border-sky-200/80 bg-sky-50/50 p-2.5 text-xs dark:border-sky-900/50 dark:bg-sky-950/20">
              <form onSubmit={handleSearchRag} className="flex items-center gap-1.5">
                <Input
                  placeholder="Nhập tên vật tư, hóa chất, thuốc nhuộm, bao bì..."
                  value={ragQuery}
                  onChange={(e) => setRagQuery(e.target.value)}
                  className="h-7 text-xs bg-white dark:bg-slate-900"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSearchingRag || !ragQuery.trim()}
                  className="h-7 px-2.5 text-xs bg-sky-600 hover:bg-sky-700 text-white shrink-0"
                >
                  {isSearchingRag ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Search className="h-3.5 w-3.5 mr-1" />
                      Tìm RAG
                    </>
                  )}
                </Button>
              </form>

              {ragResult && (
                <div className="rounded-md border border-sky-300/80 bg-white p-2.5 text-xs space-y-1.5 dark:bg-slate-900 dark:border-sky-700">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 text-[11px]">
                      <Sparkles className="h-3 w-3 text-sky-600" />
                      {ragResult.factor.label}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono text-sky-700 border-sky-300 bg-sky-50 dark:bg-sky-950/50">
                      RAG Verified ({ragResult.factor.matchScore}%)
                    </Badge>
                  </div>

                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {ragResult.factor.scope} · {ragResult.factor.sourceName}
                    </span>
                    <span className="font-bold text-sky-700 dark:text-sky-400 font-mono text-sm">
                      {ragResult.factor.factorValue} <span className="text-[10px] text-muted-foreground">{ragResult.factor.unit}</span>
                    </span>
                  </div>

                  {ragResult.citation && (
                    <div className="text-[10px] text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded border border-slate-200/50">
                      📚 Dẫn chứng: {ragResult.citation}
                    </div>
                  )}

                  <div className="pt-1 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setSelectedFactorOverride(ragResult.factor);
                        if (onApplyFactor) handleApply(ragResult.factor);
                      }}
                      className="h-6 px-2 text-[10px] bg-sky-600 hover:bg-sky-700 text-white"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Áp dụng hệ số RAG này
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
