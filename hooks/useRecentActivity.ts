import { useCallback, useEffect, useState } from "react";

export interface Activity {
  id: string;
  type: "donate" | "recycle";
  item: string;
  points: number;
  date: string;
  timestamp: number;
}

const ACTIVITIES_KEY = "weavecarbon_activities";

export const useRecentActivity = (userEmail?: string) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!userEmail) {
      setActivities([]);
      setIsLoaded(true);
      return;
    }

    try {
      const key = `${ACTIVITIES_KEY}_${userEmail}`;
      const stored = localStorage.getItem(key);
      setActivities(stored ? JSON.parse(stored) : []);
    } catch (error) {
      console.error("Error loading activities:", error);
      setActivities([]);
    } finally {
      setIsLoaded(true);
    }
  }, [userEmail]);

  const addActivity = useCallback(
    (activity: Omit<Activity, "id" | "timestamp">) => {
      if (typeof window !== "undefined" && userEmail) {
        try {
          const key = `${ACTIVITIES_KEY}_${userEmail}`;
          const newActivity: Activity = {
            ...activity,
            id: `activity-${Date.now()}`,
            timestamp: Date.now()
          };

          const updated = [newActivity, ...activities].slice(0, 20);
          localStorage.setItem(key, JSON.stringify(updated));
          setActivities(updated);
          return newActivity;
        } catch (error) {
          console.error("Error adding activity:", error);
        }
      }
      return null;
    },
    [activities, userEmail]
  );

  return {
    activities,
    isLoaded,
    addActivity
  };
};