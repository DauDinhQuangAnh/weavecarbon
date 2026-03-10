import { useCallback, useEffect, useState } from "react";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  circularPoints: number;
  garmentsDonated: number;
  co2Saved: number;
  treesEquivalent: number;
}

const PROFILES_KEY = "weavecarbon_user_profiles";
const CURRENT_USER_KEY = "weavecarbon_current_user";

export const useUserProfile = (userEmail?: string) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentEmail = userEmail || localStorage.getItem(CURRENT_USER_KEY);
    if (!currentEmail) {
      setProfile(null);
      setIsLoaded(true);
      return;
    }

    try {
      const profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || "{}");
      const userProfile = profiles[currentEmail] as UserProfile | undefined;
      setProfile(userProfile || null);
    } catch (error) {
      console.error("Error loading user profile:", error);
      setProfile(null);
    } finally {
      setIsLoaded(true);
    }
  }, [userEmail]);

  const updateProfile = useCallback(
    (updates: Partial<UserProfile>) => {
      if (typeof window !== "undefined" && profile) {
        try {
          const profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || "{}");
          const updated = { ...profile, ...updates };
          profiles[profile.email] = updated;
          localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
          setProfile(updated);
          return updated;
        } catch (error) {
          console.error("Error updating profile:", error);
        }
      }
      return profile;
    },
    [profile]
  );

  const addPoints = useCallback(
    (points: number) => {
      if (profile) {
        return updateProfile({
          circularPoints: profile.circularPoints + points
        });
      }
      return null;
    },
    [profile, updateProfile]
  );

  return {
    profile,
    isLoaded,
    updateProfile,
    addPoints
  };
};