"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  BadgePercent,
  Coffee,
  Filter,
  Gift,
  Search,
  ShoppingBag,
  Sparkles,
  TicketPercent,
  UtensilsCrossed
} from "lucide-react";
import B2CHeader from "@/components/b2c/B2CHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { fetchB2CCoupons, type B2CCoupon } from "@/lib/b2cApi";

type CouponCategoryFilter = "all" | "shopping" | "coffee" | "food" | "beauty" | "other";
type CouponSortOption = "recommended" | "points-asc" | "expiring-soon";

const COUPON_LIMIT = 48;
const EXPIRING_SOON_DAYS = 14;

const categoryFilters: Array<{
  value: CouponCategoryFilter;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "all", icon: BadgePercent },
  { value: "shopping", icon: ShoppingBag },
  { value: "coffee", icon: Coffee },
  { value: "food", icon: UtensilsCrossed },
  { value: "beauty", icon: Sparkles },
  { value: "other", icon: Gift }
];

const getExpiryDate = (value?: string | null) => {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const getCouponAccent = (coupon: B2CCoupon) => {
  const category = coupon.category.toLowerCase();

  if (category === "coffee") {
    return {
      panel: "from-amber-50 via-card to-orange-50/80",
      icon: "bg-amber-500/12 text-amber-700 ring-amber-500/20",
      ribbon: "bg-amber-100 text-amber-800"
    };
  }

  if (category === "food") {
    return {
      panel: "from-rose-50 via-card to-orange-50/70",
      icon: "bg-rose-500/12 text-rose-700 ring-rose-500/20",
      ribbon: "bg-rose-100 text-rose-800"
    };
  }

  if (category === "beauty") {
    return {
      panel: "from-fuchsia-50 via-card to-pink-50/80",
      icon: "bg-fuchsia-500/12 text-fuchsia-700 ring-fuchsia-500/20",
      ribbon: "bg-fuchsia-100 text-fuchsia-800"
    };
  }

  if (category === "shopping") {
    return {
      panel: "from-sky-50 via-card to-cyan-50/80",
      icon: "bg-sky-500/12 text-sky-700 ring-sky-500/20",
      ribbon: "bg-sky-100 text-sky-800"
    };
  }

  return {
    panel: "from-primary/8 via-card to-emerald-50/70",
    icon: "bg-primary/12 text-primary ring-primary/20",
    ribbon: "bg-primary/10 text-primary"
  };
};

const getCouponIcon = (coupon: B2CCoupon) => {
  const category = coupon.category.toLowerCase();

  if (category === "coffee") return Coffee;
  if (category === "food") return UtensilsCrossed;
  if (category === "beauty") return Sparkles;
  if (category === "shopping") return ShoppingBag;
  return TicketPercent;
};

const getDiscountLabel = (coupon: B2CCoupon, t: ReturnType<typeof useTranslations>) => {
  const value = coupon.discount_value;
  const currency = coupon.currency?.trim() || "";

  switch (coupon.discount_type) {
    case "percent":
      return typeof value === "number" ? `${value}% ${t("coupons.discountOff")}` : t("coupons.discountPercent");
    case "amount":
      return typeof value === "number"
        ? `${currency}${value.toLocaleString()} ${t("coupons.discountOff")}`
        : t("coupons.discountAmount");
    case "free_item":
      return t("coupons.freeItem");
    case "cashback":
      return typeof value === "number"
        ? `${value.toLocaleString()} ${currency || t("pointsAbbrev")} ${t("coupons.cashback")}`
        : t("coupons.cashback");
    default:
      return coupon.discount_type;
  }
};

const B2CCouponsClient: React.FC = () => {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const t = useTranslations("b2c");
  const { profile, isLoaded: profileLoaded } = useUserProfile(user?.email);
  const [coupons, setCoupons] = useState<B2CCoupon[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CouponCategoryFilter>("all");
  const [sortOption, setSortOption] = useState<CouponSortOption>("recommended");

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/auth?type=b2c");
      return;
    }

    if (user.user_type === "b2b" || user.user_type === "admin") {
      router.replace("/overview");
    }
  }, [loading, router, user]);

  useEffect(() => {
    let cancelled = false;

    const loadCoupons = async () => {
      setPageLoading(true);
      setPageError(null);

      try {
        const payload = await fetchB2CCoupons({
          status: "active",
          limit: COUPON_LIMIT
        });

        if (cancelled) {
          return;
        }

        setCoupons(payload.items || []);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setPageError(
          error instanceof Error
            ? error.message
            : t.has("coupons.loadError")
              ? t("coupons.loadError")
              : "Unable to load coupons right now."
        );
        setCoupons([]);
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    void loadCoupons();

    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const normalizedSearch = search.trim().toLowerCase();

  const filteredCoupons = useMemo(() => {
    const matchingCoupons = coupons.filter((coupon) => {
      if (category !== "all" && coupon.category.toLowerCase() !== category) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        coupon.title,
        coupon.merchant_name,
        coupon.category,
        coupon.description,
        ...(coupon.tags || [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });

    return [...matchingCoupons].sort((left, right) => {
      if (sortOption === "points-asc") {
        return left.points_cost - right.points_cost;
      }

      if (sortOption === "expiring-soon") {
        const leftExpiry = getExpiryDate(left.valid_until)?.getTime() ?? Number.POSITIVE_INFINITY;
        const rightExpiry = getExpiryDate(right.valid_until)?.getTime() ?? Number.POSITIVE_INFINITY;
        return leftExpiry - rightExpiry;
      }

      const leftScore = (left.is_featured ? -1000 : 0) + left.points_cost;
      const rightScore = (right.is_featured ? -1000 : 0) + right.points_cost;
      return leftScore - rightScore;
    });
  }, [category, coupons, normalizedSearch, sortOption]);

  const stats = useMemo(() => {
    const available = coupons.filter((coupon) => coupon.is_active && (coupon.stock_remaining ?? 1) > 0);

    return {
      availableCount: available.length,
      featuredCount: coupons.filter((coupon) => coupon.is_featured).length,
      expiringSoonCount: coupons.filter((coupon) => {
        const expiry = getExpiryDate(coupon.valid_until);
        if (!expiry) {
          return false;
        }

        const daysLeft = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        return daysLeft >= 0 && daysLeft <= EXPIRING_SOON_DAYS;
      }).length
    };
  }, [coupons]);

  const availablePoints = profile?.circularPoints || 0;
  const cheapestVisibleCoupon = filteredCoupons.find((coupon) => coupon.is_active && (coupon.stock_remaining ?? 1) > 0);
  const pointsGap = cheapestVisibleCoupon
    ? Math.max(0, cheapestVisibleCoupon.points_cost - availablePoints)
    : 0;

  if (loading || !profileLoaded || pageLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <B2CHeader
        profile={profile}
        onSignOut={handleSignOut}
      />

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6 pb-safe">
        <section className="relative overflow-hidden rounded-4xl border border-primary/15 bg-linear-to-br from-primary/10 via-card to-emerald-50/70 p-6 shadow-sm md:p-8">
          <div className="pointer-events-none absolute -left-12 top-6 h-36 w-36 rounded-full bg-primary/15 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-10 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Badge variant="secondary" className="w-fit border-primary/10 bg-card/80 text-primary">
                {t("coupons.heroBadge")}
              </Badge>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  {t("coupons.title")}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                  {t("coupons.subtitle")}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg">
                <Link href="/b2c/donate">
                  {t("coupons.earnMorePoints")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/b2c/history">
                  {t("coupons.viewHistory")}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {t("coupons.stats.available")}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{stats.availableCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("coupons.stats.availableHint")}</p>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {t("coupons.stats.featured")}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{stats.featuredCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("coupons.stats.featuredHint")}</p>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {t("coupons.stats.expiringSoon")}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{stats.expiringSoonCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("coupons.stats.expiringSoonHint")}</p>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {t("coupons.stats.ptsAvailable")}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{availablePoints.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pointsGap > 0
                  ? t("coupons.stats.pointsGap", { points: pointsGap.toLocaleString() })
                  : t("coupons.stats.pointsReady")}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/80 shadow-sm">
          <CardContent className="space-y-4 p-4 md:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Filter className="h-4 w-4" />
                {t("coupons.filterLabel")}
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:min-w-md">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("coupons.searchPlaceholder")}
                  />
                </div>

                <Select value={sortOption} onValueChange={(value) => setSortOption(value as CouponSortOption)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("coupons.sortLabel")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recommended">{t("coupons.sortOptions.recommended")}</SelectItem>
                    <SelectItem value="points-asc">{t("coupons.sortOptions.pointsAsc")}</SelectItem>
                    <SelectItem value="expiring-soon">{t("coupons.sortOptions.expiringSoon")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {categoryFilters.map((filter) => {
                const Icon = filter.icon;
                const isActive = category === filter.value;

                return (
                  <Button
                    key={filter.value}
                    type="button"
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCategory(filter.value)}
                  >
                    <Icon className="h-4 w-4" />
                    {t(`coupons.categories.${filter.value}`)}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {pageError && (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="space-y-3 p-5 text-sm text-destructive">
              <p>{pageError}</p>
              <Button variant="outline" size="sm" onClick={() => router.refresh()}>
                {t("coupons.retry")}
              </Button>
            </CardContent>
          </Card>
        )}

        {filteredCoupons.length === 0 ? (
          <Card className="border-dashed border-border/80 bg-card/60 shadow-sm">
            <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <TicketPercent className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight">{t("coupons.emptyTitle")}</h2>
                <p className="max-w-lg text-sm text-muted-foreground">
                  {normalizedSearch ? t("coupons.emptySearch") : t("coupons.emptyDescription")}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild variant="heroOutline">
                  <Link href="/b2c/donate">{t("coupons.earnMorePoints")}</Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setCategory("all");
                    setSortOption("recommended");
                  }}
                >
                  {t("coupons.resetFilters")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredCoupons.map((coupon) => {
              const accent = getCouponAccent(coupon);
              const Icon = getCouponIcon(coupon);
              const expiry = getExpiryDate(coupon.valid_until);
              const expiryLabel = expiry ? expiry.toLocaleDateString() : null;
              const stockRemaining = coupon.stock_remaining ?? coupon.stock_total ?? null;
              const stockTotal = coupon.stock_total ?? null;
              const stockProgress =
                stockRemaining !== null && stockTotal !== null && stockTotal > 0
                  ? Math.max(0, Math.min(100, (stockRemaining / stockTotal) * 100))
                  : null;
              const canRedeem = coupon.is_active && (coupon.stock_remaining ?? 1) > 0;
              const canAfford = availablePoints >= coupon.points_cost;
              const pointsShortfall = Math.max(0, coupon.points_cost - availablePoints);
              const categoryLabel = t.has(`coupons.categories.${coupon.category}`)
                ? t(`coupons.categories.${coupon.category}`)
                : coupon.category;

              return (
                <Card key={coupon.id} className={`overflow-hidden border-border/80 shadow-sm ${accent.panel}`}>
                  <div className="p-5 pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ${accent.icon}`}>
                        <Icon className="h-7 w-7" />
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {coupon.is_featured && (
                          <Badge className={accent.ribbon} variant="secondary">
                            {t("coupons.featured")}
                          </Badge>
                        )}
                        <Badge variant="outline">{categoryLabel}</Badge>
                      </div>
                    </div>
                  </div>

                  <CardHeader className="space-y-2 px-5 pb-3 pt-4">
                    <CardTitle className="text-xl leading-tight tracking-tight">{coupon.title}</CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-2 text-sm">
                      <span>{coupon.merchant_name}</span>
                      {expiryLabel && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <span>{t("coupons.validUntil", { date: expiryLabel })}</span>
                        </>
                      )}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 px-5 pb-5">
                    <p className="min-h-12 text-sm leading-6 text-muted-foreground">
                      {coupon.description || t("coupons.descriptionFallback")}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="border border-border/60 bg-card/80 text-foreground">
                        <TicketPercent className="h-3.5 w-3.5" />
                        {getDiscountLabel(coupon, t)}
                      </Badge>
                      <Badge variant="secondary" className="border border-border/60 bg-card/80 text-foreground">
                        {coupon.points_cost.toLocaleString()} {t("pointsAbbrev")}
                      </Badge>
                      {coupon.code && (
                        <Badge variant="secondary" className="border border-border/60 bg-card/80 text-foreground">
                          {t("coupons.codeAvailable")}
                        </Badge>
                      )}
                    </div>

                    {stockProgress !== null && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{t("coupons.stockLabel")}</span>
                          <span>
                            {stockRemaining?.toLocaleString() ?? 0}
                            {stockTotal !== null ? ` / ${stockTotal.toLocaleString()}` : ""}
                          </span>
                        </div>
                        <Progress value={stockProgress} className="h-2" />
                      </div>
                    )}

                    <Separator />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {t("coupons.pointsRequired")}
                        </p>
                        <p className="text-lg font-semibold tracking-tight">
                          {coupon.points_cost.toLocaleString()} {t("pointsAbbrev")}
                        </p>
                      </div>

                      <div className="text-right text-xs text-muted-foreground">
                        {canRedeem ? (
                          canAfford ? (
                            <span className="font-medium text-emerald-700">{t("coupons.readyToRedeem")}</span>
                          ) : (
                            <span className="font-medium text-amber-700">
                              {t("coupons.needMorePoints", { points: pointsShortfall.toLocaleString() })}
                            </span>
                          )
                        ) : coupon.is_active ? (
                          <span className="font-medium text-amber-700">{t("coupons.soldOut")}</span>
                        ) : (
                          <span className="font-medium text-muted-foreground">{t("coupons.inactive")}</span>
                        )}
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      variant={canRedeem && canAfford ? "hero" : "outline"}
                      disabled={!canRedeem || !canAfford}
                    >
                      {canRedeem
                        ? canAfford
                          ? t("coupons.redeemNow")
                          : t("coupons.keepEarning")
                        : t("coupons.unavailable")}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default B2CCouponsClient;