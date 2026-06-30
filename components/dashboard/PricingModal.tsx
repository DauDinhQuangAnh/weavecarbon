import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Check, Crown, Mail, Phone, Sparkles, X, Zap } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import {
  getSubscriptionPlanFamily,
  normalizeSubscriptionPlan,
  type StandardSkuLimit
} from "@/lib/subscriptionPlans";

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
  currentPlan?: string | null;
  trialEndsAt?: string | null;
  trialExpired?: boolean;
  trialDaysRemaining?: number | null;
  forceSelection?: boolean;
  onSelectPlan?: (selection: {
    planId: "trial" | "standard" | "export";
    standardSkuLimit?: StandardSkuLimit;
  }) => void;
}

type MainPlanId = "trial" | "standard" | "export";
type SelectionStep = "plans" | "standard-options";

const ENTERPRISE_CONTACT = {
  name: "DoanThi My Trinh",
  phone: "0828 413 747",
  email: "mytrinh.bb@gmail.com"
} as const;

const pricingPlans: Array<{
  id: MainPlanId;
  icon: typeof Zap;
  color: string;
  popular: boolean;
  featureKeys: string[];
}> = [
  {
    id: "trial",
    icon: Zap,
    color: "bg-blue-500",
    popular: false,
    featureKeys: ["simpleProxy", "domesticTransport", "pdfReport"]
  },
  {
    id: "standard",
    icon: Sparkles,
    color: "bg-primary",
    popular: true,
    featureKeys: ["simpleProxy", "domesticTransport", "exportTransport"]
  },
  {
    id: "export",
    icon: Crown,
    color: "bg-amber-500",
    popular: false,
    featureKeys: [
      "allStandard",
      "usEuCompliance",
      "circularCredit",
      "advancedAudit",
      "erpApi",
      "dedicatedManager"
    ]
  }
];

const standardPackages: Array<{
  skuLimit: StandardSkuLimit;
  price: string;
  popular?: boolean;
}> = [
  { skuLimit: 20, price: "899,000" },
  { skuLimit: 35, price: "1,199,000", popular: true },
  { skuLimit: 50, price: "1,499,000" }
];

const includedFeaturesByPlan: Record<MainPlanId, Set<string>> = {
  trial: new Set(["simpleProxy", "domesticTransport", "pdfReport"]),
  standard: new Set(["simpleProxy", "domesticTransport", "exportTransport"]),
  export: new Set([
    "allStandard",
    "usEuCompliance",
    "circularCredit",
    "advancedAudit",
    "erpApi",
    "dedicatedManager"
  ])
};

const PLAN_COPY: Record<MainPlanId, {
  name: string;
  description: string;
  price: string;
  cycle?: string;
}> = {
  trial: {
    name: "Trial",
    description: "Miễn phí 14 ngày",
    price: "0đ",
    cycle: "Kích hoạt tự động"
  },
  standard: {
    name: "Standard",
    description: "Một gói Standard, chọn thêm mức SKU phù hợp",
    price: "899,000 - 1,499,000"
  },
  export: {
    name: "Export",
    description: "Dành cho hồ sơ xuất khẩu và tuân thủ nâng cao",
    price: "Liên hệ"
  }
};

const PricingModal: React.FC<PricingModalProps> = ({
  open,
  onClose,
  currentPlan,
  trialExpired = false,
  forceSelection = false,
  onSelectPlan
}) => {
  const t = useTranslations("pricingModal");
  const [selectionStep, setSelectionStep] = useState<SelectionStep>("plans");
  const [isMobileView, setIsMobileView] = useState(false);
  const [enterpriseContactOpen, setEnterpriseContactOpen] = useState(false);

  const normalizedCurrentPlan = normalizeSubscriptionPlan(currentPlan, "free");
  const currentPlanFamily = getSubscriptionPlanFamily(normalizedCurrentPlan);

  useEffect(() => {
    if (open) {
      setSelectionStep("plans");
      setEnterpriseContactOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncMobileView = () => setIsMobileView(mediaQuery.matches);

    syncMobileView();
    mediaQuery.addEventListener("change", syncMobileView);

    return () => {
      mediaQuery.removeEventListener("change", syncMobileView);
    };
  }, []);

  const handleSubmitSelection = (
    planId: MainPlanId,
    standardSkuLimit?: StandardSkuLimit
  ) => {
    if (getSubscriptionPlanFamily(planId) === "trial") {
      return;
    }

    onSelectPlan?.({
      planId,
      standardSkuLimit
    });

    if (typeof window !== "undefined") {
      localStorage.setItem("weavecarbon_pricing_seen", "true");
    }

    if (!forceSelection) {
      onClose();
    }
  };

  const handleSkip = () => {
    if (forceSelection) return;
    if (typeof window !== "undefined") {
      localStorage.setItem("weavecarbon_pricing_seen", "true");
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleSkip();
        }
      }}
    >
      <DialogContent
        className={
          isMobileView
            ? "max-h-dvh overflow-y-auto p-3 pb-[calc(env(safe-area-inset-bottom)+0.9rem)]"
            : "max-w-6xl! max-h-[90vh] overflow-y-auto"
        }
        hideCloseButton={forceSelection}
        onEscapeKeyDown={(event) => {
          if (forceSelection) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (forceSelection) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader className={isMobileView ? "pb-1 text-center" : "pb-4 text-center"}>
          <DialogTitle className={isMobileView ? "text-xl font-bold leading-snug" : "text-2xl font-bold"}>
            {selectionStep === "plans"
              ? t("title")
              : "Chọn mức mở rộng SKU cho gói Standard"}
          </DialogTitle>
          <DialogDescription className={isMobileView ? "text-sm leading-5" : "text-base"}>
            {selectionStep === "plans"
              ? t("description")
              : "Các mức SKU được mua nhiều nhất cho gói Standard. Tính năng giữ nguyên, chỉ thay đổi giới hạn SKU."}
          </DialogDescription>
        </DialogHeader>

        {forceSelection && (
          <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            Gói Trial 14 ngày đã hết hạn. Bạn cần nâng cấp để tiếp tục sử dụng hệ thống.
          </p>
        )}

        {selectionStep === "plans" ? (
          <div className={isMobileView ? "mt-3 grid grid-cols-1 gap-3" : "mt-4 grid gap-4 md:grid-cols-3"}>
            {pricingPlans.map((plan) => {
              const Icon = plan.icon;
              const copy = PLAN_COPY[plan.id];
              const isStarterCard = plan.id === "trial";
              const isStandardCard = plan.id === "standard";
              const isCurrentPlan =
                plan.id === "standard"
                  ? currentPlanFamily === "standard"
                  : normalizedCurrentPlan === plan.id;
              const isBlockedByExport =
                currentPlanFamily === "export" && plan.id === "standard";
              const featureKeys = isMobileView
                ? plan.featureKeys.slice(0, plan.id === "export" ? 4 : 3)
                : plan.featureKeys;

              return (
                <Card
                  key={plan.id}
                  className={`relative transition-all hover:shadow-lg ${
                    plan.popular ? "ring-2 ring-primary shadow-md" : ""
                  }`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                      Mua nhiều nhất
                    </Badge>
                  )}
                  <CardHeader className={isMobileView ? "pb-1 text-center" : "pb-2 text-center"}>
                    <div
                      className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${plan.color}`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">
                      {copy.name}
                      <span className="mt-1 block text-sm font-normal text-muted-foreground">
                        {isStandardCard && isMobileView
                          ? "Chọn mức SKU phù hợp"
                          : copy.description}
                      </span>
                    </CardTitle>
                    <div className="mt-2">
                      <span className="text-2xl font-bold">{copy.price}</span>
                      <span className="block text-sm text-muted-foreground">
                        {isStarterCard ? copy.cycle : t("currencyPerMonth")}
                      </span>
                    </div>
                    {isStarterCard && !trialExpired && !isMobileView && (
                      <p className="mt-1 text-xs font-medium text-emerald-700">
                        Trial 14 ngày tự động kích hoạt khi tạo tài khoản mới.
                      </p>
                    )}
                    {isStandardCard && !isMobileView && (
                      <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        Chọn thêm 20, 35 hoặc 50 SKU theo nhu cầu sử dụng.
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className={isMobileView ? "space-y-3" : "space-y-4"}>
                    <ul className={isMobileView ? "space-y-1.5" : "space-y-2"}>
                      {featureKeys.map((featureKey) => {
                        const included = includedFeaturesByPlan[plan.id].has(featureKey);
                        return (
                          <li key={`${plan.id}-${featureKey}`} className="flex items-start gap-2 text-sm">
                            {included ? (
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                            ) : (
                              <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className={included ? "" : "text-muted-foreground"}>
                              {t(`features.${featureKey}`)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {isMobileView && plan.featureKeys.length > featureKeys.length && (
                      <p className="text-xs text-muted-foreground">
                        +{plan.featureKeys.length - featureKeys.length} tính năng khác
                      </p>
                    )}

                    {isStarterCard ? (
                      <Button
                        variant="secondary"
                        className={isMobileView ? "w-full" : "h-auto w-full whitespace-normal py-2 text-center"}
                        disabled
                      >
                        Trial được kích hoạt tự động
                      </Button>
                    ) : isStandardCard ? (
                      <Button
                        variant={plan.popular ? "default" : "outline"}
                        className="w-full"
                        onClick={() => setSelectionStep("standard-options")}
                        disabled={isBlockedByExport}
                      >
                        {isBlockedByExport ? "Không áp dụng" : "Mua thêm SKU"}
                      </Button>
                    ) : isCurrentPlan ? (
                      <Button variant="secondary" className="w-full" disabled>
                        Không áp dụng
                      </Button>
                    ) : plan.id === "export" ? (
                      <Popover
                        open={enterpriseContactOpen}
                        onOpenChange={setEnterpriseContactOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                          >
                            {t("enterpriseContact.button")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          side={isMobileView ? "top" : "bottom"}
                          align="center"
                          sideOffset={10}
                          collisionPadding={16}
                          className="w-[min(20rem,calc(100vw-2rem))] rounded-[1.6rem] border border-emerald-950/25 bg-[#1f2a18] p-0 text-emerald-50 shadow-2xl"
                        >
                          <div className="space-y-4 p-5">
                            <div className="space-y-1">
                              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-emerald-200/70">
                                {t("enterpriseContact.badge")}
                              </p>
                              <p className="text-xl font-bold leading-tight text-white">
                                {ENTERPRISE_CONTACT.name}
                              </p>
                            </div>
                            <div className="space-y-3 border-t border-white/10 pt-4">
                              <a
                                href={`tel:${ENTERPRISE_CONTACT.phone.replace(/\s+/g, "")}`}
                                className="flex items-center gap-3 text-sm font-medium text-emerald-50 transition-colors hover:text-emerald-200"
                              >
                                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5">
                                  <Phone className="h-4 w-4" />
                                </span>
                                <span>{ENTERPRISE_CONTACT.phone}</span>
                              </a>
                              <a
                                href={`mailto:${ENTERPRISE_CONTACT.email}`}
                                className="flex items-center gap-3 text-sm font-medium text-emerald-50 transition-colors hover:text-emerald-200"
                              >
                                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5">
                                  <Mail className="h-4 w-4" />
                                </span>
                                <span className="break-all">{ENTERPRISE_CONTACT.email}</span>
                              </a>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <Button
                        variant={plan.popular ? "default" : "outline"}
                        className="w-full"
                        onClick={() => handleSubmitSelection(plan.id)}
                      >
                        {t("selectPlan")}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Các mức mở rộng SKU được chọn nhiều nhất
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  Bạn chỉ cần chọn mức SKU phù hợp, toàn bộ tính năng Standard vẫn giữ nguyên.
                </p>
              </div>
              <Button variant="outline" onClick={() => setSelectionStep("plans")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Quay lại chọn gói
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {standardPackages.map((pkg) => {
                const isBlockedByExport = currentPlanFamily === "export";

                return (
                  <Card
                    key={pkg.skuLimit}
                    className={`relative border transition-all ${
                      pkg.popular
                        ? "border-emerald-300 shadow-sm shadow-emerald-100 ring-2 ring-emerald-500"
                        : "border-slate-200"
                    }`}
                  >
                    {pkg.popular && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600">
                        Mua nhiều nhất
                      </Badge>
                    )}
                    <CardHeader className="space-y-3 pb-3 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-semibold text-slate-900">
                          Standard
                        </CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          +{pkg.skuLimit} SKU
                        </p>
                      </div>
                      <div>
                        <span className="text-3xl font-bold text-slate-900">{pkg.price}</span>
                        <span className="block text-sm text-muted-foreground">
                          {t("currencyPerMonth")}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        <p className="font-medium text-slate-900">
                          Mua thêm {pkg.skuLimit} SKU vào giới hạn hiện tại
                        </p>
                        <p className="mt-1">
                          Giữ nguyên toàn bộ tính năng Standard, chỉ tăng giới hạn SKU.
                        </p>
                      </div>

                      {isBlockedByExport ? (
                        <Button variant="secondary" className="w-full" disabled>
                          Không áp dụng
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          onClick={() => handleSubmitSelection("standard", pkg.skuLimit)}
                        >
                          Mua thêm {pkg.skuLimit} SKU
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {!forceSelection && (
          <div className={isMobileView ? "mt-4 flex justify-center" : "mt-6 flex justify-center"}>
            <Button variant="ghost" onClick={handleSkip}>
              {t("skip")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PricingModal;
