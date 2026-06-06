import { useCallback, useEffect, useState } from "react";
import { fetchB2CDashboard } from "@/lib/b2cApi";
import { ensureAccessToken, isApiError } from "@/lib/apiClient";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  circularPoints: number;
  garmentsDonated: number;
  co2Saved: number;
  treesEquivalent: number;
  totalItemsDonated: number;
  totalWeightKg: number;
  currentLevel: string;
}

const emptyProfile: UserProfile | null = null;

export const useUserProfile = (userEmail?: string) => {
  const [profile, setProfile] = useState<UserProfile | null>(emptyProfile);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!userEmail) {
      setProfile(null);
      setIsLoaded(true);
      return;
    }

    setIsLoaded(false);

    try {
      const token = await ensureAccessToken();
      if (!token) {
        setProfile(null);
        return;
      }

      const payload = await fetchB2CDashboard();
      setProfile({
        id: payload.profile.id,
        email: payload.profile.email,
        fullName:
          payload.profile.full_name?.trim() ||
          payload.profile.email ||
          userEmail,
        circularPoints: payload.rewards_summary.total_points,
        garmentsDonated: payload.rewards_summary.total_items_donated,
        co2Saved: payload.rewards_summary.total_co2_saved,
        treesEquivalent: payload.rewards_summary.trees_equivalent,
        totalItemsDonated: payload.rewards_summary.total_items_donated,
        totalWeightKg: payload.rewards_summary.total_weight_kg,
        currentLevel: payload.rewards_summary.current_level
      });
    } catch (error) {
      const isMissingToken =
        isApiError(error) &&
        (error.status === 401 ||
          String(error.message || "").toLowerCase().includes("no token provided"));

      if (!isMissingToken) {
        console.warn(
          "Unable to load B2C profile:",
          error instanceof Error ? error.message : String(error)
        );
      }
      setProfile(null);
    } finally {
      setIsLoaded(true);
    }
  }, [userEmail]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const updateProfile = useCallback(
    (updates: Partial<UserProfile>) => {
      setProfile((current) => (current ? { ...current, ...updates } : current));
      return profile ? { ...profile, ...updates } : null;
    },
    [profile]
  );

  const addPoints = useCallback(
    (points: number) => {
      if (!profile) {
        return null;
      }

      const nextProfile = {
        ...profile,
        circularPoints: profile.circularPoints + points
      };
      setProfile(nextProfile);
      return nextProfile;
    },
    [profile]
  );

  return {
    profile,
    isLoaded,
    updateProfile,
    addPoints,
    refreshProfile: loadProfile
  };
};
