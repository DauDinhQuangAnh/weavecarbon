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
  Search,
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
import { useImageAnalysis } from "@/hooks/useImageAnalysis";
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
import {
  convertAnalysisResultToFormItems,
  getAnalysisErrorMessage,
  getAnalysisSummary,
  hasMultipleProductsDetected,
  isAnalysisUsable
} from "@/components/b2c/ImageAnalysisService";

type DonationCategory = "charity" | "recycle";
type DeliveryMethod = "drop_off" | "shipping";
const OTHER_MATERIAL_ID = DEFAULT_OTHER_MATERIAL_ID;
const RECOMMENDED_COLLECTION_POINT_MAX_DISTANCE_KM = 20;
const DROP_OFF_CONFIRM_DISTANCE_KM = 0.2;
const COLLECTION_POINT_SEARCH_MIN_CHARS = 2;
const COLLECTION_POINT_SEARCH_LIMIT = 12;

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

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistanceKm = (
  origin: B2CCollectionPointLocation,
  destination: B2CCollectionPointLocation
) => {
  const dLat = toRadians(destination.latitude - origin.latitude);
  const dLng = toRadians(destination.longitude - origin.longitude);
  const lat1 = toRadians(origin.latitude);
  const lat2 = toRadians(destination.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) *
      Math.sin(dLng / 2) *
      Math.cos(lat1) *
      Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
};

const formatDistance = (distanceKm?: number | null) => {
  if (!isFiniteNumber(distanceKm)) {
    return null;
  }

  if (distanceKm < 1) {
    return `${Math.max(1, Math.round(distanceKm * 1000))} m`;
  }

  return distanceKm < 10 ? `${distanceKm.toFixed(1)} km` : `${Math.round(distanceKm)} km`;
};

const doesCollectionPointSupportCategory = (
  point: B2CCollectionPoint,
  category: DonationCategory
) =>
  category === "charity"
    ? point.accepts_charity !== false
    : point.accepts_recycle !== false;

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
  const [recommendedCollectionPoints, setRecommendedCollectionPoints] = useState<
    B2CCollectionPoint[]
  >([]);
  const [searchedCollectionPoints, setSearchedCollectionPoints] = useState<
    B2CCollectionPoint[]
  >([]);
  const [collectionPointSearch, setCollectionPointSearch] = useState("");
  const [selectedCollectionPointId, setSelectedCollectionPointId] = useState("");
  const [selectedCollectionPointSnapshot, setSelectedCollectionPointSnapshot] =
    useState<B2CCollectionPoint | null>(null);
  const [currentLocation, setCurrentLocation] =
    useState<B2CCollectionPointLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [collectionPointSearchStatus, setCollectionPointSearchStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [collectionPointSearchError, setCollectionPointSearchError] =
    useState<string | null>(null);
  const [materialRewards, setMaterialRewards] = useState<MaterialReward[]>([]);
  const [materialsLoaded, setMaterialsLoaded] = useState(false);
  const [materialsRefreshing, setMaterialsRefreshing] = useState(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [usingMaterialFallback, setUsingMaterialFallback] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successDonation, setSuccessDonation] = useState<DonationDetail | null>(null);

  // Camera AI image analysis state
  const {
    isLoading: analysisLoading,
    result: analysisResult,
    error: analysisError,
    isCompleted: analysisCompleted,
    analyzeImage,
    resetAnalysis,
    clearError: clearAnalysisError
  } = useImageAnalysis();
  const [showAnalysisAlert, setShowAnalysisAlert] = useState(true);

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
  const selectedCollectionPoint = useMemo(
    () =>
      [
        ...recommendedCollectionPoints,
        ...searchedCollectionPoints
      ].find((point) => point.id === selectedCollectionPointId) ||
      (selectedCollectionPointSnapshot?.id === selectedCollectionPointId
        ? selectedCollectionPointSnapshot
        : null),
    [
      recommendedCollectionPoints,
      searchedCollectionPoints,
      selectedCollectionPointId,
      selectedCollectionPointSnapshot
    ]
  );
  const searchedCollectionPointResults = useMemo(
    () =>
      searchedCollectionPoints.filter(
        (point) =>
          !recommendedCollectionPoints.some(
            (recommendedPoint) => recommendedPoint.id === point.id
          )
      ),
    [recommendedCollectionPoints, searchedCollectionPoints]
  );
  const selectedCollectionPointDistanceKm = useMemo(() => {
    if (
      !currentLocation ||
      !selectedCollectionPoint ||
      !isFiniteNumber(selectedCollectionPoint.latitude) ||
      !isFiniteNumber(selectedCollectionPoint.longitude)
    ) {
      return null;
    }

    return calculateDistanceKm(currentLocation, {
      latitude: selectedCollectionPoint.latitude,
      longitude: selectedCollectionPoint.longitude
    });
  }, [currentLocation, selectedCollectionPoint]);
  const selectedCollectionPointDistanceLabel = useMemo(
    () => formatDistance(selectedCollectionPointDistanceKm),
    [selectedCollectionPointDistanceKm]
  );
  const willConfirmDropOffWithGps =
    deliveryMethod === "drop_off" &&
    Boolean(currentLocation) &&
    isFiniteNumber(selectedCollectionPointDistanceKm) &&
    selectedCollectionPointDistanceKm <= DROP_OFF_CONFIRM_DISTANCE_KM;
  const normalizedCollectionPointSearch = collectionPointSearch.trim();

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

  const selectCollectionPoint = useCallback((point: B2CCollectionPoint) => {
    setSelectedCollectionPointId(point.id);
    setSelectedCollectionPointSnapshot(point);
    setSubmitError(null);
  }, []);

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

    // Reset existing analysis and show analysis alert for new image
    resetAnalysis();
    setShowAnalysisAlert(true);

    // Trigger Camera AI image analysis
    void (async () => {
      try {
        await analyzeImage(file, category);
      } catch (error) {
        console.error("Image analysis failed:", error);
        // Error is handled in hook state, show user-friendly message
      }
    })();
  };

  const loadRecommendedCollectionPoints = useCallback(
    async (location: B2CCollectionPointLocation) => {
      try {
        const payload = await fetchB2CNearbyCollectionPoints({
          latitude: location.latitude,
          longitude: location.longitude,
          category,
          limit: COLLECTION_POINT_SEARCH_LIMIT
        });
        const nextLocation = payload.current_location || location;
        const nextRecommendedPoints = (payload.items || []).filter(
          (point) =>
            isFiniteNumber(point.distance_km) &&
            point.distance_km <= RECOMMENDED_COLLECTION_POINT_MAX_DISTANCE_KM
        );

        setCurrentLocation(nextLocation);
        setRecommendedCollectionPoints(nextRecommendedPoints);
        setLocationError(null);
        setLocationStatus("ready");

        if (selectedCollectionPointId) {
          const refreshedSelectedPoint = nextRecommendedPoints.find(
            (point) => point.id === selectedCollectionPointId
          );

          if (refreshedSelectedPoint) {
            setSelectedCollectionPointSnapshot(refreshedSelectedPoint);
          }
        } else if (nextRecommendedPoints.length > 0) {
          selectCollectionPoint(nextRecommendedPoints[0]);
        }
      } catch (error) {
        setRecommendedCollectionPoints([]);
        setLocationStatus("error");
        setLocationError(
          error instanceof Error
            ? error.message
            : t.has("donationWizard.locationLookupError")
              ? t("donationWizard.locationLookupError")
              : "Unable to load nearby collection points."
        );
      }
    },
    [category, selectCollectionPoint, selectedCollectionPointId, t]
  );

  const requestCurrentLocation = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setCurrentLocation(null);
      setRecommendedCollectionPoints([]);
      setLocationStatus("error");
      setLocationError(
        t.has("donationWizard.locationUnavailable")
          ? t("donationWizard.locationUnavailable")
          : "Your browser does not support location access."
      );
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

        await loadRecommendedCollectionPoints(nextLocation);
      },
      async () => {
        setCurrentLocation(null);
        setRecommendedCollectionPoints([]);
        setLocationStatus("error");
        setLocationError(
          t.has("donationWizard.locationPermissionDenied")
            ? t("donationWizard.locationPermissionDenied")
            : "Allow location to see nearby drop-off recommendations. You can still search for another collection point manually."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000
      }
    );
  }, [loadRecommendedCollectionPoints, t]);

  useEffect(() => {
    if (step !== 3 || deliveryMethod !== "drop_off" || locationStatus !== "idle") {
      return;
    }

    void requestCurrentLocation();
  }, [deliveryMethod, locationStatus, requestCurrentLocation, step]);

  useEffect(() => {
    if (deliveryMethod !== "drop_off") {
      setCollectionPointSearchStatus("idle");
      setCollectionPointSearchError(null);
      setSearchedCollectionPoints([]);
      return;
    }

    if (!normalizedCollectionPointSearch) {
      setCollectionPointSearchStatus("idle");
      setCollectionPointSearchError(null);
      setSearchedCollectionPoints([]);
      return;
    }

    if (normalizedCollectionPointSearch.length < COLLECTION_POINT_SEARCH_MIN_CHARS) {
      setCollectionPointSearchStatus("idle");
      setCollectionPointSearchError(null);
      setSearchedCollectionPoints([]);
      return;
    }

    let isCancelled = false;
    setCollectionPointSearchStatus("loading");
    setCollectionPointSearchError(null);

    const timeoutId = window.setTimeout(async () => {
      try {
        const payload = await fetchB2CCollectionPoints({
          search: normalizedCollectionPointSearch,
          category,
          limit: COLLECTION_POINT_SEARCH_LIMIT
        });

        if (isCancelled) {
          return;
        }

        setSearchedCollectionPoints(payload.items || []);
        setCollectionPointSearchStatus("ready");
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setSearchedCollectionPoints([]);
        setCollectionPointSearchStatus("error");
        setCollectionPointSearchError(
          error instanceof Error
            ? error.message
            : t.has("donationWizard.collectionPointSearchError")
              ? t("donationWizard.collectionPointSearchError")
              : "Unable to search collection points right now."
        );
      }
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [category, deliveryMethod, normalizedCollectionPointSearch, t]);

  useEffect(() => {
    if (!selectedCollectionPointSnapshot) {
      return;
    }

    if (doesCollectionPointSupportCategory(selectedCollectionPointSnapshot, category)) {
      return;
    }

    setSelectedCollectionPointId("");
    setSelectedCollectionPointSnapshot(null);
  }, [category, selectedCollectionPointSnapshot]);

  // Handle Camera AI analysis results - auto-fill donation items
  useEffect(() => {
    if (!analysisCompleted || !isAnalysisUsable(analysisResult) || !analysisResult) {
      return;
    }

    const fallbackMaterialId = materialRewards[0]?.id || "";
    if (!fallbackMaterialId) {
      return;
    }

    // Convert AI analysis results to form items
    const analyzedItems = convertAnalysisResultToFormItems(
      analysisResult,
      materialMap,
      fallbackMaterialId
    );

    if (analyzedItems.length === 0) {
      return;
    }

    // Replace current items with analyzed items
    setItems(analyzedItems);

    // Show helpful messages based on detection results
    if (hasMultipleProductsDetected(analysisResult)) {
      toast.info(
        t.has("donationWizard.analysis.multipleItemsDetected")
          ? t("donationWizard.analysis.multipleItemsDetected")
          : `Detected ${analyzedItems.length} items! Review and adjust as needed.`
      );
    } else {
      toast.success(
        t.has("donationWizard.analysis.itemsAutoFilled")
          ? t("donationWizard.analysis.itemsAutoFilled")
          : "Item information auto-filled from image!"
      );
    }
  }, [analysisCompleted, analysisResult, materialRewards, materialMap, t]);

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
              : Boolean(selectedCollectionPointId)
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

  const renderCollectionPointOption = (point: B2CCollectionPoint) => {
    const isSelected = selectedCollectionPointId === point.id;
    const distanceLabel = formatDistance(point.distance_km);

    return (
      <button
        key={point.id}
        type="button"
        onClick={() => selectCollectionPoint(point)}
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
              {[point.address, point.district, point.city].filter(Boolean).join(", ")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {distanceLabel && <Badge variant="secondary">{distanceLabel}</Badge>}
            {isSelected && (
              <Badge variant="outline">
                {t.has("donationWizard.selectedCollectionPoint")
                  ? t("donationWizard.selectedCollectionPoint")
                  : "Selected"}
              </Badge>
            )}
          </div>
        </div>
      </button>
    );
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
        deliveryMethod === "drop_off" && willConfirmDropOffWithGps && currentLocation
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

                  {/* Camera AI Analysis Section */}
                  {analysisLoading && (
                    <Card className="border-primary/30 bg-primary/5">
                      <CardContent className="flex items-center gap-3 p-4">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <div className="text-sm">
                          <p className="font-medium text-primary">
                            {t.has("donationWizard.analysis.analyzing")
                              ? t("donationWizard.analysis.analyzing")
                              : "Camera AI is analyzing your image..."}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t.has("donationWizard.analysis.analyzing_help")
                              ? t("donationWizard.analysis.analyzing_help")
                              : "This may take a moment."}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {analysisCompleted && analysisError && showAnalysisAlert && (
                    <Card className="border-amber-200 bg-amber-50/80">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium text-amber-900">
                              {t.has("donationWizard.analysis.failed")
                                ? t("donationWizard.analysis.failed")
                                : "Analysis failed"}
                            </p>
                            <p className="text-sm text-amber-800 mt-1">
                              {getAnalysisErrorMessage(
                                analysisError,
                                (key) => t.has(key),
                                (key) => t(key)
                              )}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAnalysisAlert(false)}
                          className="w-full border-amber-300 text-amber-900 hover:bg-amber-100"
                        >
                          {t.has("donationWizard.analysis.dismiss")
                            ? t("donationWizard.analysis.dismiss")
                            : "Dismiss"}
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {analysisCompleted && analysisResult && isAnalysisUsable(analysisResult) && showAnalysisAlert && (
                    <Card className="border-green-200 bg-green-50/80">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium text-green-900">
                              {t.has("donationWizard.analysis.success")
                                ? t("donationWizard.analysis.success")
                                : "Analysis complete"}
                            </p>
                            <p className="text-sm text-green-800 mt-1">
                              {getAnalysisSummary(
                                analysisResult,
                                (key) => t.has(key),
                                (key) => t(key)
                              )}
                            </p>
                            {hasMultipleProductsDetected(analysisResult) && (
                              <p className="text-xs text-green-700 mt-2 font-medium">
                                {t.has("donationWizard.analysis.multipleProducts")
                                  ? t("donationWizard.analysis.multipleProducts")
                                  : "Multiple items detected! You can add or remove items in the next step."}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAnalysisAlert(false)}
                          className="w-full border-green-300 text-green-900 hover:bg-green-100"
                        >
                          {t.has("donationWizard.analysis.dismiss")
                            ? t("donationWizard.analysis.dismiss")
                            : "Dismiss"}
                        </Button>
                      </CardContent>
                    </Card>
                  )}
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

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {t.has("donationWizard.recommendedCollectionPointsTitle")
                          ? t("donationWizard.recommendedCollectionPointsTitle")
                          : "Nearby recommendations"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t.has("donationWizard.recommendedCollectionPointsDescription")
                          ? t("donationWizard.recommendedCollectionPointsDescription")
                          : "We only recommend collection points within 20 km of your current location."}
                      </p>
                    </div>

                    {locationStatus === "ready" &&
                      recommendedCollectionPoints.length === 0 && (
                        <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                          {t.has("donationWizard.noNearbyCollectionPoints")
                            ? t("donationWizard.noNearbyCollectionPoints")
                            : "No nearby collection point was found within 20 km. Use search below to choose another drop-off location."}
                        </div>
                      )}

                    {recommendedCollectionPoints.length > 0 && (
                      <div className="grid gap-3">
                        {recommendedCollectionPoints.map(renderCollectionPointOption)}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="collection-point-search">
                        {t.has("donationWizard.searchCollectionPointsLabel")
                          ? t("donationWizard.searchCollectionPointsLabel")
                          : "Search other collection points"}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {t.has("donationWizard.searchCollectionPointsDescription")
                          ? t("donationWizard.searchCollectionPointsDescription")
                          : "Use search if you plan to drop off at a farther location for a specific reason."}
                      </p>
                    </div>

                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="collection-point-search"
                        value={collectionPointSearch}
                        onChange={(event) => setCollectionPointSearch(event.target.value)}
                        placeholder={
                          t.has("donationWizard.searchCollectionPointsPlaceholder")
                            ? t("donationWizard.searchCollectionPointsPlaceholder")
                            : "Search by point name, address, district, or city"
                        }
                        className="pl-10"
                      />
                    </div>

                    {normalizedCollectionPointSearch.length > 0 &&
                      normalizedCollectionPointSearch.length <
                        COLLECTION_POINT_SEARCH_MIN_CHARS && (
                        <p className="text-xs text-muted-foreground">
                          {t.has("donationWizard.collectionPointSearchHint")
                            ? t("donationWizard.collectionPointSearchHint")
                            : "Type at least 2 characters to search all active collection points."}
                        </p>
                      )}

                    {collectionPointSearchStatus === "loading" && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>
                          {t.has("donationWizard.searchingCollectionPoints")
                            ? t("donationWizard.searchingCollectionPoints")
                            : "Searching collection points..."}
                        </span>
                      </div>
                    )}

                    {collectionPointSearchError && (
                      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                        {collectionPointSearchError}
                      </div>
                    )}

                    {collectionPointSearchStatus === "ready" &&
                      searchedCollectionPointResults.length === 0 && (
                        <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                          {t.has("donationWizard.collectionPointSearchEmpty")
                            ? t("donationWizard.collectionPointSearchEmpty")
                            : "No collection points matched your search yet."}
                        </div>
                      )}

                    {searchedCollectionPointResults.length > 0 && (
                      <div className="grid gap-3">
                        {searchedCollectionPointResults.map(renderCollectionPointOption)}
                      </div>
                    )}
                  </div>

                  {selectedCollectionPoint && (
                    <div
                      className={`rounded-xl border p-4 text-sm ${
                        willConfirmDropOffWithGps
                          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                          : "border-primary/15 bg-primary/[0.05] text-foreground"
                      }`}
                    >
                      <p className="font-medium">{selectedCollectionPoint.name}</p>
                      <p className="mt-1 text-sm">
                        {willConfirmDropOffWithGps
                          ? t.has("donationWizard.dropOffConfirmNowHelper")
                            ? t("donationWizard.dropOffConfirmNowHelper")
                            : "You are close enough to confirm this drop-off now. Submitting will attach a GPS check-in."
                          : selectedCollectionPointDistanceLabel
                            ? t.has("donationWizard.dropOffConfirmLaterWithDistance")
                              ? t("donationWizard.dropOffConfirmLaterWithDistance", {
                                  distance: selectedCollectionPointDistanceLabel
                                })
                              : `You are currently ${selectedCollectionPointDistanceLabel} away from this point. We will save it as a planned drop-off and you can confirm when you arrive.`
                            : t.has("donationWizard.dropOffConfirmLaterNoLocation")
                              ? t("donationWizard.dropOffConfirmLaterNoLocation")
                              : "We will save this as a planned drop-off. You can confirm it later when you arrive at the selected collection point."}
                      </p>
                    </div>
                  )}
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
                      {selectedCollectionPoint?.name || selectedCollectionPointId}
                    </span>
                  </div>
                )}
              </div>

              {deliveryMethod === "drop_off" && selectedCollectionPoint && (
                <div
                  className={`rounded-2xl border p-4 text-sm ${
                    willConfirmDropOffWithGps
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-border/70 bg-muted/30 text-muted-foreground"
                  }`}
                >
                  {willConfirmDropOffWithGps
                    ? t.has("donationWizard.confirmStepDropOffConfirmed")
                      ? t("donationWizard.confirmStepDropOffConfirmed")
                      : "This submit will confirm the drop-off immediately with GPS."
                    : t.has("donationWizard.confirmStepDropOffPending")
                      ? t("donationWizard.confirmStepDropOffPending")
                      : "This submit will save a planned drop-off. The donation stays pending until you reach the selected collection point."}
                </div>
              )}

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
