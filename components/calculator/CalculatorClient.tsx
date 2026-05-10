"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle } from
"@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Calculator,
  Leaf,
  Factory,
  Truck,
  Package,
  ArrowLeft,
  Info } from
"lucide-react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { useTranslations } from "next-intl";const materialFactors: Record<string, number> = {
  cotton: 5.9,
  polyester: 6.4,
  wool: 10.1,
  silk: 8.5,
  linen: 1.5,
  recycledPoly: 2.1,
  organicCotton: 3.8
};


const routeEmissions: Record<string, {distance: number;factor: number;}> = {
  vnEu: { distance: 15000, factor: 0.00016 },
  vnUs: { distance: 12500, factor: 0.00016 },
  vnJp: { distance: 3800, factor: 0.00016 },
  vnDomestic: { distance: 500, factor: 0.00025 },
  vnKr: { distance: 3200, factor: 0.00016 }
};


const manufacturingFactor = 2.5;
const packagingFactor = 0.3;

interface EmissionBreakdown {
  material: number;
  manufacturing: number;
  transport: number;
  packaging: number;
  total: number;
}

const MATERIALS = [
{ value: "cotton", label: "materials.cotton" },
{ value: "polyester", label: "materials.polyester" },
{ value: "wool", label: "materials.wool" },
{ value: "silk", label: "materials.silk" },
{ value: "linen", label: "materials.linen" },
{ value: "recycledPoly", label: "materials.recycledPoly" },
{ value: "organicCotton", label: "materials.organicCotton" }];


const ROUTES = [
{ value: "vnEu", label: "routes.vnEu" },
{ value: "vnUs", label: "routes.vnUs" },
{ value: "vnJp", label: "routes.vnJp" },
{ value: "vnDomestic", label: "routes.vnDomestic" },
{ value: "vnKr", label: "routes.vnKr" }];


export default function CalculatorClient() {
  const [weight, setWeight] = useState<string>("");
  const [material, setMaterial] = useState<string>("");
  const [route, setRoute] = useState<string>("");
  const [emissions, setEmissions] = useState<EmissionBreakdown | null>(null);
  const t = useTranslations("calculator");

  const calculateEmissions = () => {
    if (!weight || !material || !route) return;

    const weightNum = parseFloat(weight);
    const materialEmission = weightNum * materialFactors[material];
    const manufacturingEmission = weightNum * manufacturingFactor;
    const routeData = routeEmissions[route];
    const transportEmission = weightNum * routeData.distance * routeData.factor;
    const packagingEmission = weightNum * packagingFactor;
    const total =
    materialEmission +
    manufacturingEmission +
    transportEmission +
    packagingEmission;

    setEmissions({
      material: materialEmission,
      manufacturing: manufacturingEmission,
      transport: transportEmission,
      packaging: packagingEmission,
      total
    });
  };

  const getPercentage = (value: number, total: number) => value / total * 100;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16 pb-16 md:pt-20">
        <div className="container mx-auto px-4 md:px-6">
          
          <Link
            href="/"
            className="mb-5 inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground md:mb-6">
            
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">{t("backToHome")}</span>
          </Link>

          <div
            className={`mx-auto grid gap-5 ${
              emissions ? "max-w-5xl lg:grid-cols-2 lg:gap-8" : "max-w-2xl"
            }`}
          >
            
            <Card className="border-border/50 shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Calculator className="w-5 h-5 text-primary" />
                  </div>
                  {t("title")}
                </CardTitle>
                <CardDescription>{t("description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                <div className="space-y-2">
                  <Label htmlFor="weight">{t("productWeight")}</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0.5"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="bg-background" />
                  
                </div>

                
                <div className="space-y-2">
                  <Label>{t("materialType")}</Label>
                  <Select value={material} onValueChange={setMaterial}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder={t("selectMaterial")} />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIALS.map((m) =>
                      <SelectItem key={m.value} value={m.value}>
                          {t(m.label)}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                
                <div className="space-y-2">
                  <Label>{t("shippingRoute")}</Label>
                  <Select value={route} onValueChange={setRoute}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder={t("selectRoute")} />
                    </SelectTrigger>
                    <SelectContent>
                      {ROUTES.map((r) =>
                      <SelectItem key={r.value} value={r.value}>
                          {t(r.label)}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="hero"
                  className="w-full"
                  onClick={calculateEmissions}
                  disabled={!weight || !material || !route}>
                  
                  {t("calculate")}
                </Button>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{t("description")}</span>
                </div>
              </CardContent>
            </Card>

            
            {emissions && (
              <Card className="border-border/50 shadow-soft transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                      <Leaf className="w-5 h-5 text-primary" />
                    </div>
                    {t("result")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="text-center p-6 rounded-2xl bg-gradient-forest text-primary-foreground">
                      <p className="text-sm font-medium opacity-80 mb-2">
                        {t("result")}
                      </p>
                      <p className="text-5xl font-display font-bold mb-1">
                        {emissions.total.toFixed(2)}
                      </p>
                      <p className="text-sm opacity-80">{t("kgCO2e")}</p>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold text-foreground">
                        {t("breakdown")}
                      </h4>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Leaf className="w-4 h-4" />
                            {t("material")}
                          </span>
                          <span className="font-medium text-foreground">
                            {emissions.material.toFixed(2)} {t("kgCO2e")}
                          </span>
                        </div>
                        <Progress
                          value={getPercentage(
                            emissions.material,
                            emissions.total
                          )}
                          className="h-2"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Factory className="w-4 h-4" />
                            {t("manufacturing")}
                          </span>
                          <span className="font-medium text-foreground">
                            {emissions.manufacturing.toFixed(2)} {t("kgCO2e")}
                          </span>
                        </div>
                        <Progress
                          value={getPercentage(
                            emissions.manufacturing,
                            emissions.total
                          )}
                          className="h-2"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Truck className="w-4 h-4" />
                            {t("transport")}
                          </span>
                          <span className="font-medium text-foreground">
                            {emissions.transport.toFixed(2)} {t("kgCO2e")}
                          </span>
                        </div>
                        <Progress
                          value={getPercentage(
                            emissions.transport,
                            emissions.total
                          )}
                          className="h-2"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Package className="w-4 h-4" />
                            {t("packaging")}
                          </span>
                          <span className="font-medium text-foreground">
                            {emissions.packaging.toFixed(2)} {t("kgCO2e")}
                          </span>
                        </div>
                        <Progress
                          value={getPercentage(
                            emissions.packaging,
                            emissions.total
                          )}
                          className="h-2"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>);

}
