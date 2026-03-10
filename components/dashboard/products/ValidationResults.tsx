import React from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ValidationResult } from "./types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";

interface ValidationResultsProps {
  result: ValidationResult;
}

const ValidationResults: React.FC<ValidationResultsProps> = ({ result }) => {
  const t = useTranslations("products.validationResults");
  const statCardClass =
  "rounded-lg border border-border bg-muted/20 p-4 text-center";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className={`${statCardClass} border-emerald-300 dark:border-emerald-700`}>
          <CheckCircle2 className="w-8 h-8 text-emerald-500/80 dark:text-emerald-400/80 mx-auto mb-2" />
          <p className="text-2xl font-bold text-foreground">
            {result.validCount}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("validRows")}
          </p>
        </div>

        <div className={`${statCardClass} border-rose-300 dark:border-rose-700`}>
          <AlertCircle className="w-8 h-8 text-rose-500/80 dark:text-rose-400/80 mx-auto mb-2" />
          <p className="text-2xl font-bold text-foreground">
            {result.errorCount}
          </p>
          <p className="text-sm text-muted-foreground">{t("errorRows")}</p>
        </div>

        <div className={`${statCardClass} border-amber-300 dark:border-amber-700`}>
          <AlertTriangle className="w-8 h-8 text-amber-500/80 dark:text-amber-400/80 mx-auto mb-2" />
          <p className="text-2xl font-bold text-foreground">
            {result.warningCount}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("warnings")}
          </p>
        </div>
      </div>

      {result.invalidRows.length > 0 &&
      <div className="border border-border rounded-lg bg-background">
          <div className="bg-muted/30 px-4 py-2 border-b border-border">
            <h4 className="font-medium text-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500/80 dark:text-rose-400/80" />
              {t("errorDetails", { count: result.errorCount })}
            </h4>
          </div>
          <ScrollArea className="max-h-60">
            <Accordion type="multiple" className="px-2">
              {result.invalidRows.map((invalid, idx) =>
            <AccordionItem key={idx} value={`error-${idx}`}>
                  <AccordionTrigger className="hover:no-underline py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="destructive" className="text-xs">
                        {t("row", { row: invalid.row })}
                      </Badge>
                      <span className="text-muted-foreground">
                        {invalid.data.sku ||
                    invalid.data.productName ||
                    t("invalidData")}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {t("errorCount", { count: invalid.errors.length })}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-1 pl-4">
                      {invalid.errors.map((error, errorIdx) =>
                  <li
                    key={errorIdx}
                    className="text-sm text-foreground flex items-start gap-2">

                          <span className="text-rose-500/70 dark:text-rose-400/70">•</span>
                          <span>{error.message}</span>
                        </li>
                  )}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
            )}
            </Accordion>
          </ScrollArea>
        </div>
      }

      {result.warnings.length > 0 &&
      <div className="border border-border rounded-lg bg-background">
          <div className="bg-muted/30 px-4 py-2 border-b border-border">
            <h4 className="font-medium text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500/80 dark:text-amber-400/80" />
              {t("warningsTitle", { count: result.warningCount })}
            </h4>
          </div>
          <ScrollArea className="max-h-40">
            <ul className="p-4 space-y-2">
              {result.warnings.map((warning, idx) =>
            <li key={idx} className="text-sm flex items-start gap-2">
                  <Badge
                variant="outline"
                className="text-xs shrink-0 border-border text-muted-foreground bg-background">

                    {t("row", { row: warning.row })}
                  </Badge>
                  <span className="text-foreground">
                    {warning.message}
                  </span>
                </li>
            )}
            </ul>
          </ScrollArea>
        </div>
      }

      {result.isValid && result.validCount > 0 &&
      <div className="bg-muted/20 border border-border rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500/80 dark:text-emerald-400/80" />
            <p className="font-medium text-foreground">
              {t("allValid", { count: result.validCount })}
            </p>
          </div>
        </div>
      }
    </div>);

};

export default ValidationResults;
