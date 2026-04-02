"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Clock3,
  ExternalLink,
  HeartHandshake,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Recycle,
  RefreshCw
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import B2CHeader from "@/components/b2c/B2CHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { api } from "@/lib/apiClient";

interface B2CCollectionPointLocation {
  latitude: number;
  longitude: number;
}

interface B2CCollectionPoint {
  id: string;
  name: string;
  address: string;
  city: string;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  operating_hours?: string | null;
  accepts_charity?: boolean | null;
  accepts_recycle?: boolean | null;
  distance_km?: number | null;
}

interface NearbyCollectionPointsPayload {
  current_location?: B2CCollectionPointLocation | null;
  items?: B2CCollectionPoint[];
}

type CollectionPointsStatus = "idle" | "locating" | "loading" | "ready" | "error";

const formatDistance = (distanceKm?: number | null) => {
  if (typeof distanceKm !== "number" || !Number.isFinite(distanceKm)) {
    return null;
  }

  if (distanceKm < 1) {
    return `${Math.max(1, Math.round(distanceKm * 1000))} m`;
  }

  return distanceKm < 10 ? `${distanceKm.toFixed(1)} km` : `${Math.round(distanceKm)} km`;
};

const buildGoogleMapsUrl = (
  point: B2CCollectionPoint,
  currentLocation: B2CCollectionPointLocation | null
) => {
  const destination =
    typeof point.latitude === "number" && typeof point.longitude === "number" ?
      `${point.latitude},${point.longitude}` :
      encodeURIComponent([point.address, point.district, point.city].filter(Boolean).join(", "));

  const origin =
    currentLocation ?
      `&origin=${currentLocation.latitude},${currentLocation.longitude}` :
      "";

  return `https://www.google.com/maps/dir/?api=1&destination=${destination}${origin}`;
};

const B2CCollectionPointsClient: React.FC = () => {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const t = useTranslations("b2c");
  const { profile, isLoaded: profileLoaded } = useUserProfile(user?.email);
  const autoLocateStartedRef = useRef(false);
  const [status, setStatus] = useState<CollectionPointsStatus>("idle");
  const [items, setItems] = useState<B2CCollectionPoint[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<B2CCollectionPointLocation | null>(null);

  const getText = useCallback(
    (key: string, fallback: string) => (t.has(key) ? t(key) : fallback),
    [t]
  );

  const toLocationErrorMessage = useCallback((error?: GeolocationPositionError) => {
    switch (error?.code) {
      case 1:
        return getText(
          "collectionPoints.permissionDenied",
          "Location permission is blocked. Please allow access in your browser settings."
        );
      case 2:
        return getText(
          "collectionPoints.positionUnavailable",
          "The device could not determine your location. Please try again."
        );
      case 3:
        return getText(
          "collectionPoints.locationTimeout",
          "Location lookup took too long. Please try again."
        );
      default:
        return getText(
          "collectionPoints.cannotGetLocation",
          "Unable to get your current location."
        );
    }
  }, [getText]);

  const loadNearbyCollectionPoints = useCallback(async (latitude: number, longitude: number) => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const query = new URLSearchParams({
        lat: String(latitude),
        lng: String(longitude),
        limit: "6"
      });
      const payload = await api.get<NearbyCollectionPointsPayload>(
        `/b2c/collection-points/nearby?${query.toString()}`
      );

      setCurrentLocation(payload.current_location || { latitude, longitude });
      setItems(payload.items || []);
      setStatus("ready");
    } catch (error) {
      setItems([]);
      setStatus("error");
      setErrorMessage(
        error instanceof Error ?
          error.message :
          getText(
            "collectionPoints.unknownError",
            "Something went wrong while loading collection points."
          )
      );
    }
  }, [getText]);

  const requestCurrentLocation = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!navigator.geolocation) {
      setStatus("error");
      setErrorMessage(
        getText(
          "collectionPoints.browserNotSupported",
          "Your browser does not support geolocation."
        )
      );
      return;
    }

    setStatus("locating");
    setItems([]);
    setErrorMessage(null);
    setCurrentLocation(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };

        void loadNearbyCollectionPoints(nextLocation.latitude, nextLocation.longitude);
      },
      (error) => {
        setItems([]);
        setStatus("error");
        setErrorMessage(toLocationErrorMessage(error));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000
      }
    );
  }, [getText, loadNearbyCollectionPoints, toLocationErrorMessage]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth?type=b2c");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (loading || !user || autoLocateStartedRef.current) {
      return;
    }

    autoLocateStartedRef.current = true;
    requestCurrentLocation();
  }, [loading, requestCurrentLocation, user]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const isBusy = status === "locating" || status === "loading";
  const isEmpty = status === "ready" && items.length === 0;

  if (loading || !profileLoaded) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <B2CHeader
        profile={profile}
        onSignOut={handleSignOut}
        onNavigateBack={() => router.push("/b2c")}
        onNavigateHome={() => router.push("/")}
      />

      <main className="container mx-auto space-y-6 px-4 py-6 pb-safe">
        <Card className="border-accent/15 bg-card/95 shadow-sm">
          <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <MapPin className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <CardTitle>{getText("collectionPoints.title", "Collection points near you")}</CardTitle>
                  <CardDescription>
                    {getText(
                      "collectionPoints.description",
                      "We use your current location to show the nearest drop-off points."
                    )}
                  </CardDescription>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {getText(
                  "collectionPoints.permissionManagedByBrowser",
                  "Location access is managed by your browser. Once you allow it, later visits reuse that permission automatically."
                )}
              </p>
            </div>

            <Button type="button" variant="outline" onClick={requestCurrentLocation} disabled={isBusy}>
              <RefreshCw className={isBusy ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              {getText("collectionPoints.retry", "Try again")}
            </Button>
          </CardHeader>
        </Card>

        {isBusy &&
          <Card>
            <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="max-w-xs text-sm text-muted-foreground">
                {status === "locating" ?
                  getText("collectionPoints.locating", "Locating your device...") :
                  getText("collectionPoints.loading", "Loading nearby collection points...")}
              </p>
            </CardContent>
          </Card>
        }

        {status === "error" &&
          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">
                {getText("collectionPoints.errorTitle", "Unable to load collection points")}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {errorMessage || getText(
                  "collectionPoints.unknownError",
                  "Something went wrong while loading collection points."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button type="button" onClick={requestCurrentLocation}>
                <RefreshCw className="h-4 w-4" />
                {getText("collectionPoints.retry", "Try again")}
              </Button>
              <Button asChild variant="outline">
                <Link href="/b2c">
                  {getText("collectionPoints.backToDashboard", "Back to dashboard")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        }

        {status === "ready" && currentLocation &&
          <Card className="border-primary/15 bg-primary/[0.05]">
            <CardContent className="flex items-start gap-3 p-5">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Navigation className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {getText("collectionPoints.currentLocation", "Your current location")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
                </p>
              </div>
            </CardContent>
          </Card>
        }

        {isEmpty &&
          <Card>
            <CardHeader>
              <CardTitle>{getText("collectionPoints.emptyTitle", "No collection points found")}</CardTitle>
              <CardDescription>
                {getText(
                  "collectionPoints.emptyDescription",
                  "There are no active collection points near this location yet."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" onClick={requestCurrentLocation}>
                <RefreshCw className="h-4 w-4" />
                {getText("collectionPoints.retry", "Try again")}
              </Button>
            </CardContent>
          </Card>
        }

        {status === "ready" && items.length > 0 &&
          <div className="grid gap-4">
            {items.map((point) => {
              const distance = formatDistance(point.distance_km);
              const directionsUrl = buildGoogleMapsUrl(point, currentLocation);

              return (
                <Card key={point.id} className="border-border/70 shadow-sm">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold">{point.name}</h2>
                          {distance &&
                            <Badge variant="secondary">
                              {distance} {getText("collectionPoints.distanceAway", "away")}
                            </Badge>
                          }
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {[point.address, point.district, point.city].filter(Boolean).join(", ")}
                        </p>
                      </div>

                      <Button asChild variant="outline" size="sm">
                        <a href={directionsUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          {getText("collectionPoints.openInMaps", "Open in Maps")}
                        </a>
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {point.accepts_charity &&
                        <Badge variant="outline">
                          <HeartHandshake className="h-3 w-3" />
                          {getText("collectionPoints.acceptedForCharity", "Charity")}
                        </Badge>
                      }
                      {point.accepts_recycle &&
                        <Badge variant="outline">
                          <Recycle className="h-3 w-3" />
                          {getText("collectionPoints.acceptedForRecycle", "Recycle")}
                        </Badge>
                      }
                    </div>

                    <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                      <div className="flex items-start gap-2">
                        <Phone className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          {point.phone?.trim() ||
                            getText("collectionPoints.phoneUnavailable", "Phone not available")}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          {point.operating_hours?.trim() ||
                            getText(
                              "collectionPoints.hoursUnavailable",
                              "Operating hours not available"
                            )}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        }
      </main>
    </div>
  );
};

export default B2CCollectionPointsClient;
