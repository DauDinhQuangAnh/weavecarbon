"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  MapPin,
  Package2,
  Plus,
  RefreshCw,
  Trash2,
  Truck
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  createB2CDonation,
  fetchB2CCollectionPoints,
  fetchB2CMaterialRewards,
  fetchB2CNearbyCollectionPoints,
  type B2CCollectionPoint,
  type B2CCollectionPointLocation,
  type CreateB2CDonationPayload,
  type DonationDetail,
  type DonationDraftImage,
  type MaterialReward
} from "@/lib/b2cApi";
import {
  DEFAULT_B2C_MATERIAL_REWARDS,
  DEFAULT_OTHER_MATERIAL_ID
} from "@/lib/b2cMaterialRewardsDefaults";

type DonationCategory = "charity" | "recycle";
type DeliveryMethod = "drop_off" | "shipping";
const OTHER_MATERIAL_ID = DEFAULT_OTHER_MATERIAL_ID;

interface DonationItemFormState {
  id: string;
  item_name: string;
  item_type: string;
  condition: string;
  material_id: string;
  custom_material_name: string;
  weight_kg: string;
}

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

const createEmptyDonationItem = (materialId = ""): DonationItemFormState => ({
  id: `item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  item_name: "",
  item_type: "",
  condition: "good",
  material_id: materialId,
  custom_material_name: "",
  weight_kg: ""
});

const buildFallbackMaterialRewards = (locale: string): MaterialReward[] =>
  DEFAULT_B2C_MATERIAL_REWARDS.map((material) => ({
      id: material.id,
      material_name:
        locale.startsWith("vi") ? material.materialNameVi : material.materialNameEn,
      material_category: material.materialCategory,
      points_per_kg: material.pointsPerKg,
      co2_saved_per_kg: material.co2SavedPerKg,
      description:
        locale.startsWith("vi") ? material.descriptionVi : material.descriptionEn,
      is_active: true
    }))
    .sort((left, right) =>
      left.material_name.localeCompare(right.material_name, locale)
    );

const B2CDonationClient: React.FC = () => {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const t = useTranslations("b2c");
  const locale = useLocale();
  const { profile, isLoaded: profileLoaded } = useUserProfile(user?.email);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState(0);
  const [draftImage, setDraftImage] = useState<DonationDraftImage | null>(null);
  const [category, setCategory] = useState<DonationCategory>("charity");
  const [items, setItems] = useState<DonationItemFormState[]>([
    createEmptyDonationItem()
  ]);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("drop_off");
  const [shippingTrackingNumber, setShippingTrackingNumber] = useState("");
  const [collectionPoints, setCollectionPoints] = useState<B2CCollectionPoint[]>([]);
  const [selectedCollectionPointId, setSelectedCollectionPointId] = useState("");
  const [currentLocation, setCurrentLocation] =
    useState<B2CCollectionPointLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [materialRewards, setMaterialRewards] = useState<MaterialReward[]>([]);
  const [materialsLoaded, setMaterialsLoaded] = useState(false);
  const [materialsRefreshing, setMaterialsRefreshing] = useState(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [usingMaterialFallback, setUsingMaterialFallback] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successDonation, setSuccessDonation] = useState<DonationDetail | null>(null);

  const stepTitles = [
    t.has("donationWizard.steps.photo")
      ? t("donationWizard.steps.photo")
      : "Photo",
    t.has("donationWizard.steps.category")
      ? t("donationWizard.steps.category")
      : "Category",
    t.has("donationWizard.steps.items")
      ? t("donationWizard.steps.items")
      : "Items",
    t.has("donationWizard.steps.delivery")
      ? t("donationWizard.steps.delivery")
      : "Delivery",
    t.has("donationWizard.steps.confirm")
      ? t("donationWizard.steps.confirm")
      : "Confirm"
  ];

  const materialMap = useMemo(
    () => new Map(materialRewards.map((reward) => [reward.id, reward])),
    [materialRewards]
  );
  const fallbackMaterialRewards = useMemo(
    () => buildFallbackMaterialRewards(locale),
    [locale]
  );
  const hasMaterialOptions = materialRewards.length > 0;

  const metrics = items.reduce(
    (accumulator, item) => {
      const reward = materialMap.get(item.material_id);
      const weightKg = Number(item.weight_kg);

      if (!reward || !Number.isFinite(weightKg) || weightKg <= 0) {
        return accumulator;
      }

      accumulator.totalWeightKg += weightKg;
      accumulator.basePoints += Math.round(reward.points_per_kg * weightKg);
      accumulator.co2Saved += reward.co2_saved_per_kg * weightKg;
      return accumulator;
    },
    {
      basePoints: 0,
      totalWeightKg: 0,
      co2Saved: 0
    }
  );

  const bonusPoints =
    category === "charity" ? Math.round(metrics.basePoints * 0.5) : 0;
  const estimatedTotalPoints = metrics.basePoints + bonusPoints;
  const estimatedCo2Saved = Number(metrics.co2Saved.toFixed(4));

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

  const loadMaterialRewards = useCallback(
    async (showBlockingSpinner = false) => {
      if (showBlockingSpinner) {
        setMaterialsLoaded(false);
      } else {
        setMaterialsRefreshing(true);
      }

      setMaterialsError(null);

      try {
        const payload = await fetchB2CMaterialRewards();
        const nextRewards = (payload.items || []).filter((reward) => reward.is_active);
        const fallbackMaterialId = nextRewards[0]?.id || "";

        if (nextRewards.length > 0) {
          setUsingMaterialFallback(false);
          setMaterialRewards(nextRewards);
          setItems((currentItems) =>
            currentItems.map((item) => {
              const stillValid = nextRewards.some(
                (reward) => reward.id === item.material_id
              );

              return stillValid
                ? item
                : { ...item, material_id: fallbackMaterialId, custom_material_name: "" };
            })
          );
        } else {
          const fallbackMaterialId = fallbackMaterialRewards[0]?.id || "";
          setUsingMaterialFallback(true);
          setMaterialRewards(fallbackMaterialRewards);
          setItems((currentItems) =>
            currentItems.map((item) => {
              const stillValid = fallbackMaterialRewards.some(
                (reward) => reward.id === item.material_id
              );

              return stillValid
                ? item
                : { ...item, material_id: fallbackMaterialId, custom_material_name: "" };
            })
          );
        }
      } catch (error) {
        const fallbackMaterialId = fallbackMaterialRewards[0]?.id || "";
        setUsingMaterialFallback(true);
        setMaterialRewards(fallbackMaterialRewards);
        setItems((currentItems) =>
          currentItems.map((item) => {
            const stillValid = fallbackMaterialRewards.some(
              (reward) => reward.id === item.material_id
            );

            return stillValid
              ? item
              : { ...item, material_id: fallbackMaterialId, custom_material_name: "" };
          })
        );
        setMaterialsError(
          error instanceof Error
            ? error.message
            : t.has("donationWizard.materialLoadError")
              ? t("donationWizard.materialLoadError")
              : "Unable to load material rewards."
        );
      } finally {
        setMaterialsLoaded(true);
        setMaterialsRefreshing(false);
      }
    },
    [fallbackMaterialRewards, t]
  );

  useEffect(() => {
    void loadMaterialRewards(true);
  }, [loadMaterialRewards]);

  useEffect(() => {
    return () => {
      if (draftImage?.previewUrl) {
        URL.revokeObjectURL(draftImage.previewUrl);
      }
    };
  }, [draftImage]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleDraftImageChange = (
    fileList: FileList | null,
    source: DonationDraftImage["source"]
  ) => {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error(
        t.has("donationWizard.errors.invalidImageType")
          ? t("donationWizard.errors.invalidImageType")
          : "Please choose an image file."
      );
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error(
        t.has("donationWizard.errors.imageTooLarge")
          ? t("donationWizard.errors.imageTooLarge")
          : "Please choose an image smaller than 8MB."
      );
      return;
    }

    if (draftImage?.previewUrl) {
      URL.revokeObjectURL(draftImage.previewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setDraftImage({
      file,
      previewUrl,
      source
    });
    setSubmitError(null);
  };

  const requestCurrentLocation = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationStatus("error");
      setLocationError(
        t.has("donationWizard.locationUnavailable")
          ? t("donationWizard.locationUnavailable")
          : "Your browser does not support location access."
      );

      try {
        const payload = await fetchB2CCollectionPoints({ limit: 12 });
        setCollectionPoints(payload.items || []);
      } catch {
        setCollectionPoints([]);
      }
      return;
    }

    setLocationStatus("loading");
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };

        try {
          const payload = await fetchB2CNearbyCollectionPoints({
            latitude: nextLocation.latitude,
            longitude: nextLocation.longitude,
            limit: 6
          });

          setCurrentLocation(payload.current_location || nextLocation);
          setCollectionPoints(payload.items || []);
          setLocationStatus("ready");
          if (!selectedCollectionPointId && (payload.items || []).length > 0) {
            setSelectedCollectionPointId(payload.items?.[0]?.id || "");
          }
        } catch (error) {
          setLocationStatus("error");
          setLocationError(
            error instanceof Error
              ? error.message
              : t.has("donationWizard.locationLookupError")
                ? t("donationWizard.locationLookupError")
                : "Unable to load nearby collection points."
          );

          try {
            const payload = await fetchB2CCollectionPoints({ limit: 12 });
            setCollectionPoints(payload.items || []);
          } catch {
            setCollectionPoints([]);
          }
        }
      },
      async () => {
        setLocationStatus("error");
        setLocationError(
          t.has("donationWizard.locationPermissionDenied")
            ? t("donationWizard.locationPermissionDenied")
            : "Location permission is required for drop-off confirmation."
        );

        try {
          const payload = await fetchB2CCollectionPoints({ limit: 12 });
          setCollectionPoints(payload.items || []);
        } catch {
          setCollectionPoints([]);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000
      }
    );
  }, [selectedCollectionPointId, t]);

  useEffect(() => {
    if (step !== 3 || deliveryMethod !== "drop_off" || locationStatus !== "idle") {
      return;
    }

    void requestCurrentLocation();
  }, [deliveryMethod, locationStatus, requestCurrentLocation, step]);

  const isItemValid = (item: DonationItemFormState) => {
    const weight = Number(item.weight_kg);
    return (
      item.item_name.trim().length > 0 &&
      item.material_id.trim().length > 0 &&
      (item.material_id !== OTHER_MATERIAL_ID ||
        item.custom_material_name.trim().length > 0) &&
      Number.isFinite(weight) &&
      weight > 0
    );
  };

  const canProceed =
    step === 0
      ? Boolean(draftImage)
      : step === 1
        ? Boolean(category)
        : step === 2
          ? items.length > 0 && items.every(isItemValid)
          : step === 3
            ? deliveryMethod === "shipping"
              ? true
              : Boolean(selectedCollectionPointId && currentLocation)
            : true;

  const handleNext = () => {
    if (!canProceed) {
      return;
    }

    setStep((currentStep) => Math.min(currentStep + 1, 4));
  };

  const handleBack = () => {
    setStep((currentStep) => Math.max(currentStep - 1, 0));
  };

  const updateItem = (
    itemId: string,
    field: keyof DonationItemFormState,
    value: string
  ) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
              ...(field === "material_id" && value !== OTHER_MATERIAL_ID
                ? { custom_material_name: "" }
                : {})
            }
          : item
      )
    );
  };

  const addItem = () => {
    setItems((currentItems) => [
      ...currentItems,
      createEmptyDonationItem(materialRewards[0]?.id || "")
    ]);
  };

  const removeItem = (itemId: string) => {
    setItems((currentItems) => {
      if (currentItems.length === 1) {
        return currentItems;
      }

      return currentItems.filter((item) => item.id !== itemId);
    });
  };

  const handleSubmit = async () => {
    if (!draftImage) {
      return;
    }

    const payload: CreateB2CDonationPayload = {
      category,
      delivery_method: deliveryMethod,
      items: items.map((item) => {
        const customMaterialName = item.custom_material_name.trim();
        const normalizedItemType = item.item_type.trim();
        const normalizedItemTypeWithCustomMaterial =
          item.material_id === OTHER_MATERIAL_ID && customMaterialName
            ? [normalizedItemType, `Other material: ${customMaterialName}`]
                .filter(Boolean)
                .join(" | ")
            : normalizedItemType;

        return {
          item_name: item.item_name.trim(),
          item_type: normalizedItemTypeWithCustomMaterial || undefined,
          condition: item.condition || undefined,
          material_id: item.material_id,
          weight_kg: Number(item.weight_kg)
        };
      }),
      shipping_tracking_number:
        deliveryMethod === "shipping" && shippingTrackingNumber.trim()
          ? shippingTrackingNumber.trim()
          : undefined,
      collection_point_id:
        deliveryMethod === "drop_off" ? selectedCollectionPointId || undefined : undefined,
      gps_checkin:
        deliveryMethod === "drop_off" && currentLocation
          ? {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              checked_at: new Date().toISOString()
            }
          : undefined
    };

    setSubmitting(true);
    setSubmitError(null);

    try {
      const donation = await createB2CDonation(payload, draftImage.file);
      setSuccessDonation(donation);
      toast.success(
        t.has("donationWizard.successToast")
          ? t("donationWizard.successToast")
          : "Donation submitted successfully."
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t.has("donationWizard.submitError")
            ? t("donationWizard.submitError")
            : "Unable to submit donation.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !profileLoaded || !materialsLoaded) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (successDonation) {
    return (
      <div className="min-h-dvh bg-background">
        <B2CHeader
          profile={profile}
          onSignOut={handleSignOut}
        />

        <main className="container mx-auto max-w-3xl space-y-6 px-4 py-6 pb-safe">
          <Card className="border-primary/15 bg-primary/[0.05]">
            <CardContent className="space-y-4 p-6 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold">
                  {t.has("donationWizard.successTitle")
                    ? t("donationWizard.successTitle")
                    : "Donation submitted"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t.has("donationWizard.successDescription")
                    ? t("donationWizard.successDescription")
                    : "Your photo, donation items, and rewards have been saved."}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Badge variant="secondary">
                  +{successDonation.total_points} {t("pointsAbbrev")}
                </Badge>
                <Badge variant="outline">
                  {successDonation.total_items}{" "}
                  {t.has("donationWizard.itemsAbbrev")
                    ? t("donationWizard.itemsAbbrev")
                    : "items"}
                </Badge>
                <Badge variant="outline">
                  {successDonation.co2_saved.toFixed(2)} kg CO2
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {t.has("donationWizard.successSnapshot")
                  ? t("donationWizard.successSnapshot")
                  : "Donation snapshot"}
              </CardTitle>
              <CardDescription>{successDonation.id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {draftImage && (
                <Image
                  src={draftImage.previewUrl}
                  alt={
                    t.has("donationWizard.photoAlt")
                      ? t("donationWizard.photoAlt")
                      : "Donation photo"
                  }
                  width={720}
                  height={720}
                  unoptimized
                  className="aspect-square w-full max-w-sm rounded-2xl object-cover"
                />
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {successDonation.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-border/70 bg-muted/30 p-4"
                  >
                    <p className="font-medium">{item.item_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.material_name || item.material_id}
                    </p>
                    <p className="mt-2 text-sm">
                      {item.weight_kg} kg - +{item.points_earned} {t("pointsAbbrev")}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => router.push("/b2c/history")}>
                  {t.has("donationWizard.viewHistory")
                    ? t("donationWizard.viewHistory")
                    : "View history"}
                </Button>
                <Button variant="outline" onClick={() => router.push("/b2c")}>
                  {t.has("donationWizard.backToDashboard")
                    ? t("donationWizard.backToDashboard")
                    : "Back to dashboard"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/b2c/history/${successDonation.id}`)}
                >
                  {t.has("donationWizard.viewDetail")
                    ? t("donationWizard.viewDetail")
                    : "View detail"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
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
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t.has("donationWizard.title")
              ? t("donationWizard.title")
              : "Start a donation"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.has("donationWizard.subtitle")
              ? t("donationWizard.subtitle")
              : "Upload or capture one photo first, then complete the donation steps."}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          {stepTitles.map((stepTitle, index) => (
            <Card
              key={stepTitle}
              className={index === step ? "border-primary bg-primary/[0.04]" : ""}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    index <= step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </div>
                <span className="text-sm font-medium">{stepTitle}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {usingMaterialFallback && (
          <Card className="border-amber-200 bg-amber-50/80">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-amber-900">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-4 w-4" />
                <div className="space-y-1">
                  <p>
                    {t.has("donationWizard.materialFallbackNotice")
                      ? t("donationWizard.materialFallbackNotice")
                      : "Using the built-in material list because the backend has not returned material rewards yet."}
                  </p>
                  {materialsError && (
                    <p className="text-xs text-amber-800/80">{materialsError}</p>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadMaterialRewards()}
                disabled={materialsRefreshing}
              >
                {materialsRefreshing && <Loader2 className="h-4 w-4 animate-spin" />}
                {!materialsRefreshing && <RefreshCw className="h-4 w-4" />}
                {t.has("donationWizard.materialRetry")
                  ? t("donationWizard.materialRetry")
                  : "Reload materials"}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                {t.has("donationWizard.photoTitle")
                  ? t("donationWizard.photoTitle")
                  : "Add one donation photo"}
              </CardTitle>
              <CardDescription>
                {t.has("donationWizard.photoDescription")
                  ? t("donationWizard.photoDescription")
                  : "This temporary step replaces Camera AI. Choose one photo before continuing."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto justify-start gap-3 p-5"
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <ImagePlus className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">
                      {t.has("donationWizard.importImage")
                        ? t("donationWizard.importImage")
                        : "Import image"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.has("donationWizard.importImageHelp")
                        ? t("donationWizard.importImageHelp")
                        : "Choose an existing photo from your device."}
                    </div>
                  </div>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-auto justify-start gap-3 p-5"
                  onClick={() => captureInputRef.current?.click()}
                >
                  <Camera className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">
                      {t.has("donationWizard.captureImage")
                        ? t("donationWizard.captureImage")
                        : "Capture photo"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.has("donationWizard.captureImageHelp")
                        ? t("donationWizard.captureImageHelp")
                        : "Open the native camera picker on supported devices."}
                    </div>
                  </div>
                </Button>
              </div>

              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) =>
                  handleDraftImageChange(event.target.files, "upload")
                }
              />
              <input
                ref={captureInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) =>
                  handleDraftImageChange(event.target.files, "capture")
                }
              />

              {draftImage && (
                <div className="space-y-3">
                  <Image
                    src={draftImage.previewUrl}
                    alt={
                      t.has("donationWizard.photoAlt")
                        ? t("donationWizard.photoAlt")
                        : "Donation photo"
                    }
                    width={720}
                    height={720}
                    unoptimized
                    className="aspect-square w-full max-w-md rounded-2xl object-cover"
                  />
                  <Badge variant="secondary">
                    {draftImage.source === "capture"
                      ? t.has("donationWizard.photoSourceCapture")
                        ? t("donationWizard.photoSourceCapture")
                        : "Captured photo"
                      : t.has("donationWizard.photoSourceImport")
                        ? t("donationWizard.photoSourceImport")
                        : "Imported image"}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>
                {t.has("donationWizard.categoryTitle")
                  ? t("donationWizard.categoryTitle")
                  : "Choose donation category"}
              </CardTitle>
              <CardDescription>
                {t.has("donationWizard.categoryDescription")
                  ? t("donationWizard.categoryDescription")
                  : "Charity donations get a 50% bonus on top of base points."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={category}
                onValueChange={(value) => setCategory(value as DonationCategory)}
                className="grid gap-4 md:grid-cols-2"
              >
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4">
                  <RadioGroupItem value="charity" />
                  <div className="space-y-1">
                    <p className="font-medium">
                      {t.has("donationWizard.charityLabel")
                        ? t("donationWizard.charityLabel")
                        : "Charity"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t.has("donationWizard.charityDescription")
                        ? t("donationWizard.charityDescription")
                        : "Support re-use and receive bonus points."}
                    </p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4">
                  <RadioGroupItem value="recycle" />
                  <div className="space-y-1">
                    <p className="font-medium">
                      {t.has("donationWizard.recycleLabel")
                        ? t("donationWizard.recycleLabel")
                        : "Recycle"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t.has("donationWizard.recycleDescription")
                        ? t("donationWizard.recycleDescription")
                        : "Recycle items for verified material recovery."}
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {items.map((item, index) => (
              <Card key={item.id}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">
                      {t.has("donationWizard.itemCardTitle")
                        ? t("donationWizard.itemCardTitle", { index: index + 1 })
                        : `Item ${index + 1}`}
                    </CardTitle>
                    <CardDescription>
                      {t.has("donationWizard.itemCardDescription")
                        ? t("donationWizard.itemCardDescription")
                        : "Describe one item in this donation."}
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${item.id}-name`}>
                      {t.has("donationWizard.itemNameLabel")
                        ? t("donationWizard.itemNameLabel")
                        : "Item name"}
                    </Label>
                    <Input
                      id={`${item.id}-name`}
                      value={item.item_name}
                      onChange={(event) =>
                        updateItem(item.id, "item_name", event.target.value)
                      }
                      placeholder={
                        t.has("donationWizard.itemNamePlaceholder")
                          ? t("donationWizard.itemNamePlaceholder")
                          : "Oversized cotton shirt"
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`${item.id}-type`}>
                      {t.has("donationWizard.itemTypeLabel")
                        ? t("donationWizard.itemTypeLabel")
                        : "Item type"}
                    </Label>
                    <Input
                      id={`${item.id}-type`}
                      value={item.item_type}
                      onChange={(event) =>
                        updateItem(item.id, "item_type", event.target.value)
                      }
                      placeholder={
                        t.has("donationWizard.itemTypePlaceholder")
                          ? t("donationWizard.itemTypePlaceholder")
                          : "Shirt, jeans, tote bag..."
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      {t.has("donationWizard.materialLabel")
                        ? t("donationWizard.materialLabel")
                        : "Material"}
                    </Label>
                    <Select
                      value={item.material_id}
                      onValueChange={(value) =>
                        updateItem(item.id, "material_id", value)
                      }
                      disabled={!hasMaterialOptions}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            t.has("donationWizard.materialPlaceholder")
                              ? t("donationWizard.materialPlaceholder")
                              : "Choose a material"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {materialRewards.map((reward) => (
                          <SelectItem key={reward.id} value={reward.id}>
                            {reward.material_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!hasMaterialOptions && (
                      <p className="text-xs text-destructive">
                        {t.has("donationWizard.materialUnavailableHelper")
                          ? t("donationWizard.materialUnavailableHelper")
                          : "Material options are unavailable right now. Please reload and try again."}
                      </p>
                    )}
                    {item.material_id === OTHER_MATERIAL_ID && (
                      <div className="space-y-2 pt-2">
                        <Label htmlFor={`${item.id}-custom-material`}>
                          {t.has("donationWizard.otherMaterialLabel")
                            ? t("donationWizard.otherMaterialLabel")
                            : "Other material name"}
                        </Label>
                        <Input
                          id={`${item.id}-custom-material`}
                          value={item.custom_material_name}
                          onChange={(event) =>
                            updateItem(
                              item.id,
                              "custom_material_name",
                              event.target.value
                            )
                          }
                          placeholder={
                            t.has("donationWizard.otherMaterialPlaceholder")
                              ? t("donationWizard.otherMaterialPlaceholder")
                              : "Example: spandex blend"
                          }
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`${item.id}-weight`}>
                      {t.has("donationWizard.weightLabel")
                        ? t("donationWizard.weightLabel")
                        : "Weight (kg)"}
                    </Label>
                    <Input
                      id={`${item.id}-weight`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.1"
                      value={item.weight_kg}
                      onChange={(event) =>
                        updateItem(item.id, "weight_kg", event.target.value)
                      }
                      placeholder="0.5"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>
                      {t.has("donationWizard.conditionLabel")
                        ? t("donationWizard.conditionLabel")
                        : "Condition"}
                    </Label>
                    <Select
                      value={item.condition}
                      onValueChange={(value) =>
                        updateItem(item.id, "condition", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="good">
                          {t.has("donationWizard.conditionGood")
                            ? t("donationWizard.conditionGood")
                            : "Good"}
                        </SelectItem>
                        <SelectItem value="fair">
                          {t.has("donationWizard.conditionFair")
                            ? t("donationWizard.conditionFair")
                            : "Fair"}
                        </SelectItem>
                        <SelectItem value="worn">
                          {t.has("donationWizard.conditionWorn")
                            ? t("donationWizard.conditionWorn")
                            : "Worn"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addItem}
              disabled={!hasMaterialOptions}
            >
              <Plus className="h-4 w-4" />
              {t.has("donationWizard.addItem")
                ? t("donationWizard.addItem")
                : "Add another item"}
            </Button>
          </div>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>
                {t.has("donationWizard.deliveryTitle")
                  ? t("donationWizard.deliveryTitle")
                  : "Choose delivery method"}
              </CardTitle>
              <CardDescription>
                {t.has("donationWizard.deliveryDescription")
                  ? t("donationWizard.deliveryDescription")
                  : "Drop-off needs GPS confirmation. Shipping is available without location access."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup
                value={deliveryMethod}
                onValueChange={(value) => setDeliveryMethod(value as DeliveryMethod)}
                className="grid gap-4 md:grid-cols-2"
              >
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4">
                  <RadioGroupItem value="drop_off" />
                  <div className="space-y-1">
                    <p className="font-medium">
                      {t.has("donationWizard.dropOffLabel")
                        ? t("donationWizard.dropOffLabel")
                        : "Drop-off"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t.has("donationWizard.dropOffDescription")
                        ? t("donationWizard.dropOffDescription")
                        : "Select a collection point and confirm near it with GPS."}
                    </p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4">
                  <RadioGroupItem value="shipping" />
                  <div className="space-y-1">
                    <p className="font-medium">
                      {t.has("donationWizard.shippingLabel")
                        ? t("donationWizard.shippingLabel")
                        : "Shipping"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t.has("donationWizard.shippingDescription")
                        ? t("donationWizard.shippingDescription")
                        : "Ship later and add tracking if you already have it."}
                    </p>
                  </div>
                </label>
              </RadioGroup>

              {deliveryMethod === "shipping" && (
                <div className="space-y-2">
                  <Label htmlFor="shipping-tracking">
                    {t.has("donationWizard.shippingTrackingLabel")
                      ? t("donationWizard.shippingTrackingLabel")
                      : "Tracking number (optional)"}
                  </Label>
                  <Input
                    id="shipping-tracking"
                    value={shippingTrackingNumber}
                    onChange={(event) => setShippingTrackingNumber(event.target.value)}
                    placeholder={
                      t.has("donationWizard.shippingTrackingPlaceholder")
                        ? t("donationWizard.shippingTrackingPlaceholder")
                        : "VN123456789"
                    }
                  />
                </div>
              )}

              {deliveryMethod === "drop_off" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <Button type="button" variant="outline" onClick={requestCurrentLocation}>
                      <MapPin className="h-4 w-4" />
                      {t.has("donationWizard.refreshLocation")
                        ? t("donationWizard.refreshLocation")
                        : "Refresh location"}
                    </Button>
                    {currentLocation && (
                      <Badge variant="secondary">
                        {currentLocation.latitude.toFixed(5)},{" "}
                        {currentLocation.longitude.toFixed(5)}
                      </Badge>
                    )}
                  </div>

                  {locationStatus === "loading" && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>
                        {t.has("donationWizard.locating")
                          ? t("donationWizard.locating")
                          : "Checking your current location..."}
                      </span>
                    </div>
                  )}

                  {locationError && (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                      {locationError}
                    </div>
                  )}

                  <div className="grid gap-3">
                    {collectionPoints.map((point) => {
                      const isSelected = selectedCollectionPointId === point.id;
                      return (
                        <button
                          key={point.id}
                          type="button"
                          onClick={() => setSelectedCollectionPointId(point.id)}
                          className={`rounded-2xl border p-4 text-left transition-colors ${
                            isSelected
                              ? "border-primary bg-primary/[0.05]"
                              : "border-border/70 hover:border-primary/40"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium">{point.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {[point.address, point.district, point.city]
                                  .filter(Boolean)
                                  .join(", ")}
                              </p>
                            </div>
                            {typeof point.distance_km === "number" && (
                              <Badge variant="secondary">
                                {point.distance_km < 1
                                  ? `${Math.round(point.distance_km * 1000)} m`
                                  : `${point.distance_km.toFixed(1)} km`}
                              </Badge>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>
                {t.has("donationWizard.confirmTitle")
                  ? t("donationWizard.confirmTitle")
                  : "Confirm your donation"}
              </CardTitle>
              <CardDescription>
                {t.has("donationWizard.confirmDescription")
                  ? t("donationWizard.confirmDescription")
                  : "Review the payload that will be submitted to the B2C API."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {draftImage && (
                <Image
                  src={draftImage.previewUrl}
                  alt={
                    t.has("donationWizard.photoAlt")
                      ? t("donationWizard.photoAlt")
                      : "Donation photo"
                  }
                  width={720}
                  height={720}
                  unoptimized
                  className="aspect-square w-full max-w-sm rounded-2xl object-cover"
                />
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t.has("donationWizard.summaryPoints")
                      ? t("donationWizard.summaryPoints")
                      : "Estimated points"}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {estimatedTotalPoints}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t.has("donationWizard.summaryWeight")
                      ? t("donationWizard.summaryWeight")
                      : "Total weight"}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {metrics.totalWeightKg.toFixed(2)} kg
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t.has("donationWizard.summaryCo2")
                      ? t("donationWizard.summaryCo2")
                      : "CO2 saved"}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {estimatedCo2Saved.toFixed(2)} kg
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Package2 className="h-4 w-4" />
                  <span>
                    {t.has("donationWizard.categorySummary")
                      ? t("donationWizard.categorySummary")
                      : "Category"}
                    :{" "}
                    <strong>
                      {category === "charity"
                        ? t.has("donationWizard.charityLabel")
                          ? t("donationWizard.charityLabel")
                          : "Charity"
                        : t.has("donationWizard.recycleLabel")
                          ? t("donationWizard.recycleLabel")
                          : "Recycle"}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="h-4 w-4" />
                  <span>
                    {t.has("donationWizard.deliverySummary")
                      ? t("donationWizard.deliverySummary")
                      : "Delivery"}
                    :{" "}
                    <strong>
                      {deliveryMethod === "drop_off"
                        ? t.has("donationWizard.dropOffLabel")
                          ? t("donationWizard.dropOffLabel")
                          : "Drop-off"
                        : t.has("donationWizard.shippingLabel")
                          ? t("donationWizard.shippingLabel")
                          : "Shipping"}
                    </strong>
                  </span>
                </div>
                {deliveryMethod === "drop_off" && selectedCollectionPointId && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {collectionPoints.find((point) => point.id === selectedCollectionPointId)
                        ?.name || selectedCollectionPointId}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid gap-3">
                {items.map((item) => {
                  const reward = materialMap.get(item.material_id);
                  const materialLabel =
                    item.material_id === OTHER_MATERIAL_ID &&
                    item.custom_material_name.trim().length > 0
                      ? t.has("donationWizard.otherMaterialDisplay")
                        ? t("donationWizard.otherMaterialDisplay", {
                            name: item.custom_material_name.trim()
                          })
                        : `Other: ${item.custom_material_name.trim()}`
                      : reward?.material_name || item.material_id;
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border/70 bg-muted/30 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{item.item_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {materialLabel}
                          </p>
                        </div>
                        <Badge variant="outline">{item.weight_kg} kg</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>

              {submitError && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                  {submitError}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap justify-between gap-3">
          <Button variant="outline" onClick={handleBack} disabled={step === 0 || submitting}>
            {t.has("donationWizard.back") ? t("donationWizard.back") : "Back"}
          </Button>

          {step < 4 ? (
            <Button onClick={handleNext} disabled={!canProceed}>
              {t.has("donationWizard.next") ? t("donationWizard.next") : "Next"}
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting || !draftImage}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.has("donationWizard.submit")
                ? t("donationWizard.submit")
                : "Submit donation"}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default B2CDonationClient;
