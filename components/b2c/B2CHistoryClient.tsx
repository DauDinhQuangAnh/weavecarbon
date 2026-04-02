"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarClock, Gift, History, Recycle, Star } from "lucide-react";
import B2CDonationImage from "@/components/b2c/B2CDonationImage";
import B2CHeader from "@/components/b2c/B2CHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  fetchB2CDonations,
  fetchB2CRewardTransactions,
  type DonationSummary,
  type RewardTransaction
} from "@/lib/b2cApi";

const B2CHistoryClient: React.FC = () => {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const t = useTranslations("b2c");
  const { profile, isLoaded: profileLoaded } = useUserProfile(user?.email);
  const [donations, setDonations] = useState<DonationSummary[]>([]);
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

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

    const loadHistory = async () => {
      setPageLoading(true);
      setPageError(null);

      try {
        const [donationPayload, rewardPayload] = await Promise.all([
          fetchB2CDonations(20),
          fetchB2CRewardTransactions(30)
        ]);

        if (cancelled) {
          return;
        }

        setDonations(donationPayload.items || []);
        setTransactions(rewardPayload.items || []);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setPageError(
          error instanceof Error
            ? error.message
            : t.has("history.loadError")
              ? t("history.loadError")
              : "Unable to load B2C history."
        );
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

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

      <main className="container mx-auto max-w-5xl space-y-6 px-4 py-6 pb-safe">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t.has("history.title") ? t("history.title") : "B2C history"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.has("history.subtitle")
              ? t("history.subtitle")
              : "Review your donation records and reward transactions in one place."}
          </p>
        </div>

        {pageError && (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">
              {pageError}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="donations">
          <TabsList>
            <TabsTrigger value="donations">
              {t.has("history.donationsTab")
                ? t("history.donationsTab")
                : "Donations"}
            </TabsTrigger>
            <TabsTrigger value="rewards">
              {t.has("history.rewardsTab")
                ? t("history.rewardsTab")
                : "Reward transactions"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="donations" className="space-y-4">
            {donations.length === 0 && (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  {t.has("history.emptyDonations")
                    ? t("history.emptyDonations")
                    : "You have not submitted any donations yet."}
                </CardContent>
              </Card>
            )}

            {donations.map((donation) => (
              <Card key={donation.id}>
                <CardContent className="flex flex-col gap-4 p-5 md:flex-row">
                  <div className="w-full md:w-40">
                    {donation.image_available ? (
                      <B2CDonationImage
                        donationId={donation.id}
                        alt={donation.item_description || donation.id}
                        className="aspect-square w-full rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                        <History className="h-8 w-8" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">
                          {donation.item_description || donation.id}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(donation.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          +{donation.total_points} {t("pointsAbbrev")}
                        </Badge>
                        <Badge variant="outline">{donation.status}</Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>{donation.total_items} item(s)</span>
                      <span>{donation.total_weight_kg.toFixed(2)} kg</span>
                      <span>{donation.co2_saved.toFixed(2)} kg CO2</span>
                    </div>

                    {donation.collection_point && (
                      <p className="text-sm text-muted-foreground">
                        {donation.collection_point.name}
                      </p>
                    )}

                    <Button asChild variant="outline">
                      <Link href={`/b2c/history/${donation.id}`}>
                        {t.has("history.viewDetail")
                          ? t("history.viewDetail")
                          : "View detail"}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="rewards" className="space-y-4">
            {transactions.length === 0 && (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  {t.has("history.emptyRewards")
                    ? t("history.emptyRewards")
                    : "No reward transactions found yet."}
                </CardContent>
              </Card>
            )}

            {transactions.map((transaction) => (
              <Card key={transaction.id}>
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {transaction.transaction_type === "earn" ? (
                      <Star className="h-5 w-5" />
                    ) : transaction.description?.toLowerCase().includes("recycle") ? (
                      <Recycle className="h-5 w-5" />
                    ) : (
                      <Gift className="h-5 w-5" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {transaction.description || transaction.transaction_type}
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarClock className="h-4 w-4" />
                          {new Date(transaction.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        +{transaction.points} {t("pointsAbbrev")}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default B2CHistoryClient;
