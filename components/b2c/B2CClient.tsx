"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import B2CHeader from "./B2CHeader";
import B2CWelcome from "./B2CWelcome";
import B2CQuickActions from "./B2CQuickActions";
import B2CStatsGrid from "./B2CStatsGrid";
import B2CDonateCard from "./B2CDonateCard";
import B2CRecentActivity from "./B2CRecentActivity";

const B2CClient: React.FC = () => {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const { profile, isLoaded: profileLoaded } = useUserProfile(user?.email);
  const { activities, isLoaded: activitiesLoaded } = useRecentActivity(
    user?.email
  );

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

  if (loading || !profileLoaded || !activitiesLoaded) {
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

      <main className="container mx-auto space-y-6 px-4 py-6 pb-safe">
        <B2CWelcome profile={profile} />

        <B2CQuickActions
          onDonateClick={() => router.push("/b2c/donate")}
          onLocationClick={() => router.push("/b2c/collection-points")}
          onHistoryClick={() => router.push("/b2c/history")}
        />

        <B2CStatsGrid profile={profile} />

        <B2CDonateCard onStartDonate={() => router.push("/b2c/donate")} />

        <B2CRecentActivity activities={activities} />
      </main>
    </div>
  );
};

export default B2CClient;
