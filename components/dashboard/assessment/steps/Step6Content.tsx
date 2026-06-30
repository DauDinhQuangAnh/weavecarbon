import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Save,
  Send,
  Clock,
  CheckCircle2,
  FileText,
  Package,
  Leaf,
  Factory,
  Truck,
  AlertCircle,
  Loader2
} from "lucide-react";
import {
  ProductAssessmentData,
  DraftVersion,
  PRODUCT_TYPES,
  DESTINATION_MARKETS
} from "./types";

interface Step6SaveHistoryProps {
  data: ProductAssessmentData;
  isEditing?: boolean;
  draftHistory: DraftVersion[];
  onSaveDraft: () => void;
  onPublish: () => void;
  isSubmitting?: boolean;
  submissionMode?: "draft" | "publish" | null;
}

const Step6Content: React.FC<Step6SaveHistoryProps> = ({
  data,
  isEditing = false,
  draftHistory,
  onSaveDraft,
  onPublish,
  isSubmitting = false,
  submissionMode = null
}) => {
  const t = useTranslations("assessment.step6");
  const displayLocale = "vi-VN";

  const productType = PRODUCT_TYPES.find((type) => type.value === data.productType);
  const productTypeLabel =
    productType && t.has(`productTypes.${productType.value}`)
      ? t(`productTypes.${productType.value}`)
      : productType?.label || data.productType;

  const market = DESTINATION_MARKETS.find(
    (destination) => destination.value === data.destinationMarket
  );
  const marketLabel =
    market && t.has(`markets.${market.value}`)
      ? t(`markets.${market.value}`)
      : market?.label || data.destinationMarket;

  const canPublish =
    Boolean(data.carbonResults) &&
    Boolean(data.productCode) &&
    Boolean(data.productName) &&
    data.quantity > 0 &&
    data.materials.length > 0;

  const publishActionLabel =
    isEditing && data.status === "published"
      ? t("actions.updatePublished")
      : t("actions.publish");
  const publishProcessingLabel = t("actions.publishing");

  const isHighConfidence = data.carbonResults?.confidenceLevel === "high";
  const canSaveDraft = !isEditing && data.status !== "published";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{t("summary.title")}</CardTitle>
              <p className="text-sm text-muted-foreground">{t("summary.subtitle")}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("summary.productCode")}</p>
              <p className="font-semibold">{data.productCode || "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("summary.productName")}</p>
              <p className="font-semibold">{data.productName || "-"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("summary.productType")}</p>
              <p className="font-medium">{productTypeLabel}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("summary.quantity")}</p>
              <p className="font-medium">
                {t("summary.quantityValue", {
                  value: data.quantity?.toLocaleString(displayLocale) || "0"
                })}
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <Leaf className="mx-auto mb-1 h-5 w-5 text-green-600" />
              <p className="text-xs text-muted-foreground">{t("stats.materials")}</p>
              <p className="font-semibold">{data.materials.length}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <Factory className="mx-auto mb-1 h-5 w-5 text-blue-600" />
              <p className="text-xs text-muted-foreground">{t("stats.processes")}</p>
              <p className="font-semibold">{data.productionProcesses?.length || 0}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <Truck className="mx-auto mb-1 h-5 w-5 text-purple-600" />
              <p className="text-xs text-muted-foreground">{t("stats.transportLegs")}</p>
              <p className="font-semibold">{data.transportLegs?.length || 0}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <Package className="mx-auto mb-1 h-5 w-5 text-primary" />
              <p className="text-xs text-muted-foreground">{t("stats.market")}</p>
              <p className="text-xs font-semibold">{marketLabel || "-"}</p>
            </div>
          </div>

          <Separator />

          {data.carbonResults ? (
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">{t("result.title")}</p>
                <Badge
                  variant="outline"
                  className={
                    data.carbonResults.confidenceLevel === "high"
                      ? "border-green-500/30 bg-green-500/10 text-green-600"
                      : data.carbonResults.confidenceLevel === "medium"
                        ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-600"
                        : "border-red-500/30 bg-red-500/10 text-red-600"
                  }
                >
                  {t("result.confidenceLabel")}:{" "}
                  {data.carbonResults.confidenceLevel === "high"
                    ? t("result.confidence.high")
                    : data.carbonResults.confidenceLevel === "medium"
                      ? t("result.confidence.medium")
                      : t("result.confidence.low")}
                </Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">{t("result.co2PerProduct")}</p>
                  <p className="text-2xl font-bold text-primary">
                    {data.carbonResults.perProduct.total.toFixed(3)} {t("result.unitKg")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("result.totalBatch")}</p>
                  <p className="text-2xl font-bold text-primary">
                    {data.carbonResults.totalBatch.total.toFixed(2)} {t("result.unitKg")}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{t("actions.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canPublish ? (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 text-yellow-600" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-700">{t("actions.notReady")}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-yellow-600">
                    {!data.productCode ? <li>{t("actions.missing.productCode")}</li> : null}
                    {!data.productName ? <li>{t("actions.missing.productName")}</li> : null}
                    {!data.quantity ? <li>{t("actions.missing.quantity")}</li> : null}
                    {data.materials.length === 0 ? (
                      <li>{t("actions.missing.materials")}</li>
                    ) : null}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-4 sm:flex-row">
            {canSaveDraft ? (
              <Button
                variant="outline"
                size="lg"
                onClick={onSaveDraft}
                disabled={isSubmitting}
                className="w-full sm:flex-1"
              >
                {submissionMode === "draft" ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {t("actions.savingDraft")}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    {t("actions.saveDraft")}
                  </>
                )}
              </Button>
            ) : null}
            <Button
              size="lg"
              onClick={onPublish}
              disabled={!canPublish || isSubmitting}
              className={canSaveDraft ? "w-full sm:flex-1" : "w-full"}
            >
              {isSubmitting ? (
                submissionMode === "publish" ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {publishProcessingLabel}
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-5 w-5" />
                    {publishActionLabel}
                  </>
                )
              ) : (
                <>
                  <Send className="mr-2 h-5 w-5" />
                  {publishActionLabel}
                </>
              )}
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            {isHighConfidence ? t("actions.readyNote") : t("actions.needMoreDataNote")}
          </p>
        </CardContent>
      </Card>

      {draftHistory.length > 0 ? (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">{t("history.title")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {draftHistory.map((draft, index) => (
                <div
                  key={draft.id}
                  className="flex flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Badge variant="outline">v{draft.version}</Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {new Date(draft.timestamp).toLocaleDateString(displayLocale, {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </p>
                      {draft.note ? (
                        <p className="truncate text-xs text-muted-foreground">{draft.note}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {index === 0 ? (
                      <Badge className="border-0 bg-primary/10 text-primary">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {t("history.current")}
                      </Badge>
                    ) : null}
                    <Button variant="ghost" size="sm">
                      {t("history.view")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default Step6Content;
