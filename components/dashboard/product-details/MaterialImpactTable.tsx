import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Leaf, Info, FileCheck, FileQuestion } from "lucide-react";
import { MaterialImpactItem } from "@/lib/carbonDetailData";

interface MaterialImpactTableProps {
  materials: MaterialImpactItem[];
}

const MaterialImpactTable: React.FC<MaterialImpactTableProps> = ({ materials }) => {
  const t = useTranslations("productDetail.materialImpact");
  const totalCo2e = materials.reduce((sum, material) => sum + material.co2e, 0);

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-200 bg-slate-50/70">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Leaf className="h-5 w-5 text-primary" />
          {t("title")}
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4">
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-2">
          <Table className="w-full">
            <TableHeader className="bg-slate-50/80">
              <TableRow className="border-slate-200">
                <TableHead className="font-semibold text-slate-700">{t("material")}</TableHead>
                <TableHead className="w-24 text-right font-semibold text-slate-700">{t("ratio")}</TableHead>
                <TableHead className="w-28 text-right font-semibold text-slate-700">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="inline-flex w-full items-center justify-end gap-1">
                        {t("emissionFactor")}
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t("emissionFactorTooltip")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="w-32 text-right font-semibold text-slate-700">
                  {t("co2Column")}
                </TableHead>
                <TableHead className="text-center font-semibold text-slate-700">{t("source")}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {materials.map((material, index) => (
                <TableRow key={index} className="border-slate-200 hover:bg-slate-50/70">
                  <TableCell className="font-medium">{material.material}</TableCell>

                  <TableCell className="text-right tabular-nums">{material.percentage}%</TableCell>

                  <TableCell className="text-right">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="inline-flex w-full justify-end">
                          <span className="text-sm tabular-nums text-slate-900">
                            {material.emissionFactor.toFixed(2)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">
                            {t("sourceLabel")}
                            {material.factorSource}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>

                  <TableCell className="text-right font-bold tabular-nums">{material.co2e.toFixed(2)}</TableCell>

                  <TableCell className="text-center">
                    {material.source === "documented" ? (
                      <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                        <FileCheck className="mr-1 h-3 w-3" />
                        {t("verified")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                        <FileQuestion className="mr-1 h-3 w-3" />
                        {t("proxy")}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}

              <TableRow className="border-slate-200 bg-slate-50/80 font-bold">
                <TableCell>{t("total")}</TableCell>
                <TableCell className="text-right tabular-nums">100%</TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right tabular-nums text-emerald-700">{totalCo2e.toFixed(2)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex items-start gap-2 text-xs text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("factorNote")}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default MaterialImpactTable;
