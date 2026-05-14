"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import B2CDonationImage from "@/components/b2c/B2CDonationImage";
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
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { fetchB2CDonationById, type DonationDetail } from "@/lib/b2cApi";

interface B2CDonationDetailClientProps {
  donationId: string;
}

const B2CDonationDetailClient: React.FC<B2CDonationDetailClientProps> = ({
  donationId
}) => {
  const router = useRouter();
  const { user, loading, authStatus, signOut } = useAuth();
  const t = useTranslations("b2c");
  const { profile, isLoaded: profileLoaded } = useUserProfile(user?.email);
  const [donation, setDonation] = useState<DonationDetail | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || authStatus === "checking" || authStatus === "recovering") return;

    if (!user) {
      router.push("/auth?type=b2c");
      return;
    }

    if (user.user_type === "b2b" || user.user_type === "admin") {
      router.replace("/overview");
    }
  }, [authStatus, loading, router, user]);

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      setPageLoading(true);
      setPageError(null);

      try {
        const payload = await fetchB2CDonationById(donationId);
        if (!cancelled) {
          setDonation(payload);
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(
            error instanceof Error
              ? error.message
              : t.has("history.loadDetailError")
                ? t("history.loadDetailError")
                : "Unable to load donation detail."
          );
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [donationId, t]);

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

      <main className="container mx-auto max-w-4xl space-y-6 px-4 py-6 pb-safe">
        {pageError && (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">
              {pageError}
            </CardContent>
          </Card>
        )}

        {!pageError && donation && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>
                  {t.has("history.detailTitle")
                    ? t("history.detailTitle")
                    : "Donation detail"}
                </CardTitle>
                <CardDescription>{donation.id}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {donation.image_available && (
                  <B2CDonationImage
                    donationId={donation.id}
                    alt={donation.item_description || donation.id}
                    className="aspect-square w-full max-w-sm rounded-2xl object-cover"
                  />
                )}

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    +{donation.total_points} {t("pointsAbbrev")}
                  </Badge>
                  <Badge variant="outline">{donation.status}</Badge>
                  <Badge variant="outline">{donation.category}</Badge>
                  <Badge variant="outline">{donation.delivery_method}</Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t.has("history.detailItems")
                        ? t("history.detailItems")
                        : "Items"}
                    </p>
                    <p className="mt-2 text-xl font-semibold">{donation.total_items}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t.has("history.detailWeight")
                        ? t("history.detailWeight")
                        : "Weight"}
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {donation.total_weight_kg.toFixed(2)} kg
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t.has("history.detailCo2")
                        ? t("history.detailCo2")
                        : "CO2 saved"}
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {donation.co2_saved.toFixed(2)} kg
                    </p>
                  </div>
                </div>

                {donation.collection_point && (
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">
                      {donation.collection_point.name}
                    </p>
                    <p>
                      {[
                        donation.collection_point.address,
                        donation.collection_point.district,
                        donation.collection_point.city
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {t.has("history.detailItemsList")
                    ? t("history.detailItemsList")
                    : "Donation items"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {donation.items.map((item) => (
                  <div key={item.id} className="space-y-3 rounded-2xl border border-border/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.material_name || item.material_id}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        +{item.points_earned} {t("pointsAbbrev")}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>{item.weight_kg} kg</span>
                      {item.condition && <span>{item.condition}</span>}
                      {item.item_type && <span>{item.item_type}</span>}
                    </div>
                  </div>
                ))}

                <Separator />

                <Button variant="outline" onClick={() => router.push("/b2c/history")}>
                  {t.has("history.backToHistory")
                    ? t("history.backToHistory")
                    : "Back to history"}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default B2CDonationDetailClient;
