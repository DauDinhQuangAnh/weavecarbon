import React from "react";
import { useTranslations } from "next-intl";
import { Leaf } from "lucide-react";
import type { BulkProductRow } from "./types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

interface PreviewTableProps {
  rows: BulkProductRow[];
  showCarbonData?: boolean;
}

const CONFIDENCE_BADGE_CLASS =
"text-xs border-border bg-background text-muted-foreground gap-1.5";

const CONFIDENCE_DOT_CLASS = {
  high: "bg-emerald-500/80 dark:bg-emerald-400/80",
  medium: "bg-amber-500/80 dark:bg-amber-400/80",
  low: "bg-rose-500/80 dark:bg-rose-400/80"
};

const SCOPE_LABELS = {
  scope1: "Scope 1",
  scope1_2: "Scope 1-2",
  scope1_2_3: "Scope 1-2-3"
};

const PreviewTable: React.FC<PreviewTableProps> = ({
  rows,
  showCarbonData = false
}) => {
  const t = useTranslations("products.previewTable");
  const displayLocale = "vi-VN";

  const confidenceLabels = {
    high: t("confidence.high"),
    medium: t("confidence.medium"),
    low: t("confidence.low")
  };

  return (
    <div className="border rounded-lg">
      <ScrollArea className="h-100">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-12.5">#</TableHead>
              <TableHead className="min-w-25">{t("headers.sku")}</TableHead>
              <TableHead className="min-w-50">{t("headers.productName")}</TableHead>
              <TableHead className="w-20">{t("headers.quantity")}</TableHead>
              <TableHead className="min-w-25">{t("headers.primaryMaterial")}</TableHead>
              <TableHead className="w-25">{t("headers.market")}</TableHead>
              {showCarbonData &&
              <>
                  <TableHead className="w-25 text-right">{t("headers.co2eKg")}</TableHead>
                  <TableHead className="w-25">{t("headers.scope")}</TableHead>
                  <TableHead className="w-25">{t("headers.confidence")}</TableHead>
                </>
              }
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) =>
            <TableRow key={index}>
                <TableCell className="text-muted-foreground text-sm">
                  {index + 1}
                </TableCell>
                <TableCell className="font-mono text-sm">{row.sku}</TableCell>
                <TableCell
                className="max-w-50 truncate"
                title={row.productName}>

                  {row.productName}
                </TableCell>
                <TableCell className="text-right">
                  {row.quantity.toLocaleString(displayLocale)}
                </TableCell>
                <TableCell>
                  <span className="capitalize">
                    {row.primaryMaterial.replace("_", " ")}
                  </span>
                  {row.primaryMaterialPercentage < 100 &&
                <span className="text-muted-foreground text-xs ml-1">
                      ({row.primaryMaterialPercentage}%)
                    </span>
                }
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {row.marketType === "export" ?
                  row.exportCountry?.toUpperCase() || t("market.export") :
                  t("market.domestic")}
                  </Badge>
                </TableCell>
                {showCarbonData &&
              <>
                    <TableCell className="text-right font-medium">
                      <div className="flex items-center justify-end gap-1">
                        <Leaf className="w-3 h-3 text-primary" />
                        <span>{row.calculatedCO2?.toFixed(3)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {row.scope ? SCOPE_LABELS[row.scope] : "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.confidenceLevel &&
                  <Badge variant="outline" className={CONFIDENCE_BADGE_CLASS}>
                          <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${CONFIDENCE_DOT_CLASS[row.confidenceLevel]}`} />

                          {confidenceLabels[row.confidenceLevel]}
                        </Badge>
                  }
                    </TableCell>
                  </>
              }
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      <div className="border-t bg-muted/50 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t("summary.totalProducts", { count: rows.length })}
          </span>
          {showCarbonData &&
          <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                {t("summary.totalQuantity", {
                count: rows.
                reduce((sum, r) => sum + r.quantity, 0).
                toLocaleString(displayLocale)
              })}
              </span>
              <span className="text-primary font-medium flex items-center gap-1">
                <Leaf className="w-4 h-4" />
                {t("summary.totalCo2e", {
                value: rows.
                reduce(
                  (sum, r) => sum + (r.calculatedCO2 || 0) * r.quantity,
                  0
                ).
                toFixed(2)
              })}
              </span>
            </div>
          }
        </div>
      </div>
    </div>);

};

export default PreviewTable;

