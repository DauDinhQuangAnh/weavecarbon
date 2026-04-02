"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import PermissionDialog from "@/components/ui/PermissionDialog";
import B2CHeader from "./B2CHeader";
import B2CWelcome from "./B2CWelcome";
import B2CQuickActions from "./B2CQuickActions";
import B2CStatsGrid from "./B2CStatsGrid";
import B2CDonateCard from "./B2CDonateCard";
import B2CRecentActivity from "./B2CRecentActivity";
import B2CImagePreview from "./B2CImagePreview";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

const B2CClient: React.FC = () => {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const t = useTranslations("b2c");
  const { profile, isLoaded: profileLoaded } = useUserProfile(user?.email);
  const { activities, isLoaded: activitiesLoaded } = useRecentActivity(
    user?.email
  );

  const [showCameraPermission, setShowCameraPermission] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/auth?type=b2c");
      return;
    }

    if (user.user_type === "b2b" || user.user_type === "admin") {
      router.replace("/overview");
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleCameraClick = () => {
    if (hasCameraPermission) {
      toast.info(t("cameraWorkflowPending"));
    } else {
      setShowCameraPermission(true);
    }
  };

  const handleLocationClick = () => {
    router.push("/b2c/collection-points");
  };

  const handleCameraPermissionAllow = () => {
    setShowCameraPermission(false);
    setHasCameraPermission(true);
  };

  if (loading || !profileLoaded || !activitiesLoaded) {
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
        onNavigateBack={() => router.back()}
        onNavigateHome={() => router.push("/")}
      />

      <main className="container mx-auto space-y-6 px-4 py-6 pb-safe">
        <B2CWelcome profile={profile} />

        <B2CQuickActions
          onCameraClick={handleCameraClick}
          onLocationClick={handleLocationClick}
        />

        <B2CStatsGrid profile={profile} />

        <B2CDonateCard onStartDonate={handleCameraClick} />

        <B2CRecentActivity activities={activities} />

        {capturedImage &&
          <B2CImagePreview
            imageData={capturedImage}
            onRetake={() => setCapturedImage(null)}
            onContinue={() => {
              setCapturedImage(null);
              toast.success(t("imageCapturedSuccess"));
            }}
          />
        }
      </main>

      <PermissionDialog
        open={showCameraPermission}
        onOpenChange={setShowCameraPermission}
        type="camera"
        onAllow={handleCameraPermissionAllow}
        onDeny={() => setShowCameraPermission(false)}
      />
    </div>
  );
};

export default B2CClient;
