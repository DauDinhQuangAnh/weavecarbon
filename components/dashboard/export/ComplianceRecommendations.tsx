"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
  AlertTriangle,
  FileText,
  Leaf,
  Shield,
  Package,
  ChevronDown,
  CheckCircle2
} from "lucide-react";
import { PRIORITY_CONFIG, type ComplianceDocument, type Recommendation } from "./types";

interface ComplianceRecommendationsProps {
  recommendations: Recommendation[];
  documents: ComplianceDocument[];
}

const TYPE_ICONS = {
  document: FileText,
  carbon_data: Leaf,
  verification: Shield,
  product_scope: Package
} as const;

const ComplianceRecommendations: React.FC<ComplianceRecommendationsProps> = ({
  recommendations,
  documents
}) => {
  const t = useTranslations("export.recommendations");
  const activeRecommendations = recommendations.filter(
    (recommendation) => recommendation.status === "active"
  );
  const mandatoryCount = activeRecommendations.filter(
    (recommendation) => recommendation.priority === "mandatory"
  ).length;
  const recommendedCount = activeRecommendations.filter(
    (recommendation) => recommendation.priority !== "mandatory"
  ).length;

  const normalizeDocumentKey = (value?: string) =>
    (value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");

  const isDocumentFulfilled = (document: ComplianceDocument) =>
    document.status === "uploaded" || document.status === "approved";

  const fallbackDocumentRecommendations: Recommendation[] = documents
    .filter((document) => document.required && !isDocumentFulfilled(document))
    .map((document, index) => ({
      id: `fallback-doc-${document.id || index}`,
      type: "document" as const,
      missingItem: document.name,
      regulatoryReason: t("fallbackRegulatoryReason"),
      businessImpact: t("fallbackBusinessImpact"),
      recommendedAction: [],
      priority: "mandatory" as const,
      ctaLabel: t("uploadCta"),
      ctaAction: "upload_document",
      status: "active" as const,
      relatedDocumentId: document.id
    }));

  const recommendationsToRender =
    activeRecommendations.length > 0 ? activeRecommendations : fallbackDocumentRecommendations;

  const hasDocumentForRecommendation = (recommendation: Recommendation) => {
    if (recommendation.type !== "document") {
      return false;
    }

    const relatedDocumentKey = normalizeDocumentKey(recommendation.relatedDocumentId);
    const missingItemKey = normalizeDocumentKey(recommendation.missingItem);

    return documents.some((document) => {
      if (!isDocumentFulfilled(document)) {
        return false;
      }

      const documentKeys = [
        normalizeDocumentKey(document.id),
        normalizeDocumentKey(document.name),
        normalizeDocumentKey(document.type)
      ].filter(Boolean);

      if (relatedDocumentKey) {
        const byRelatedId = documentKeys.some(
          (key) =>
            key === relatedDocumentKey ||
            key.includes(relatedDocumentKey) ||
            relatedDocumentKey.includes(key)
        );
        if (byRelatedId) {
          return true;
        }
      }

      if (!missingItemKey) {
        return false;
      }

      return documentKeys.some(
        (key) =>
          key === missingItemKey || key.includes(missingItemKey) || missingItemKey.includes(key)
      );
    });
  };

  const getPriorityLabel = (priority: Recommendation["priority"]) => {
    switch (priority) {
      case "mandatory":
        return t("priority.mandatory");
      case "important":
        return t("priority.important");
      default:
        return t("priority.recommended");
    }
  };

  if (recommendationsToRender.length === 0) {
    return (
      <Card className="border-slate-200 bg-white">
        <CardContent className="p-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-600" />
          <h3 className="font-semibold text-green-800">{t("allComplete")}</h3>
          <p className="mt-1 text-sm text-green-600">{t("allCompleteDesc")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-col gap-2 text-lg md:flex-row md:items-center">
          <Badge variant="secondary" className="static md:hidden">
            {t("items", { count: recommendationsToRender.length })}
          </Badge>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            {t("title")}
          </div>
          <Badge variant="secondary" className="ml-auto hidden md:static">
            {t("items", { count: recommendationsToRender.length })}
          </Badge>
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Badge className="border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50">
            {mandatoryCount} {t("priority.mandatory")}
          </Badge>
          <Badge className="border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50">
            {recommendedCount} {t("priority.recommended")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendationsToRender.map((recommendation) => {
          const Icon = TYPE_ICONS[recommendation.type];
          const priorityConfig = PRIORITY_CONFIG[recommendation.priority];
          const hasRequiredDocument = hasDocumentForRecommendation(recommendation);
          const impactText =
            typeof recommendation.businessImpact === "string" &&
            recommendation.businessImpact.trim().length > 0
              ? recommendation.businessImpact
              : t("noImpactInfo");

          return (
            <Collapsible key={recommendation.id} className="mx-auto max-w-xs md:max-w-full">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-start gap-3 p-4 text-left transition-colors hover:bg-slate-50">
                    <div className="shrink-0 rounded-lg bg-slate-100 p-2">
                      <Icon className={`h-4 w-4 ${priorityConfig.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge className="border border-slate-200 bg-slate-50 text-xs text-slate-700">
                          {getPriorityLabel(recommendation.priority)}
                        </Badge>
                        {hasRequiredDocument && (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            {t("alreadyAvailable")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-900">{recommendation.missingItem}</p>
                    </div>
                    <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent className="w-full">
                  <div className="space-y-4 border-t border-slate-200 bg-white px-4 pb-4 pt-0">
                    <div className="pt-4">
                      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("legalReason")}
                      </h4>
                      <p className="text-sm text-slate-700">{recommendation.regulatoryReason}</p>
                    </div>

                    <div>
                      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("impact")}
                      </h4>
                      <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        {impactText}
                      </p>
                    </div>

                    {recommendation.recommendedAction.length > 0 && (
                      <div>
                        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("actionGuide")}
                        </h4>
                        <div className="space-y-2">
                          {recommendation.recommendedAction.map((action, index) => (
                            <div
                              key={`${recommendation.id}-action-${index}`}
                              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                            >
                              {action}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ComplianceRecommendations;
