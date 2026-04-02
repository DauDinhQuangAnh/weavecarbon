import { useCallback, useEffect, useState } from "react";
import { fetchB2CDashboard } from "@/lib/b2cApi";

export interface Activity {
  id: string;
  type: "donate" | "recycle";
  item: string;
  points: number;
  date: string;
  timestamp: number;
  donationId?: string | null;
  status?: string | null;
}

const formatActivityDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString();
};

export const useRecentActivity = (userEmail?: string) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadActivities = useCallback(async () => {
    if (!userEmail) {
      setActivities([]);
      setIsLoaded(true);
      return;
    }

    setIsLoaded(false);

    try {
      const payload = await fetchB2CDashboard();
      const nextActivities = payload.recent_activity.map((activity) => {
        const timestamp = new Date(activity.created_at).getTime();

        return {
          id: activity.id,
          type: activity.type === "charity" ? "donate" : "recycle",
          item: activity.item_label,
          points: activity.points,
          date: formatActivityDate(activity.created_at),
          timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
          donationId: activity.donation_id,
          status: activity.status
        } satisfies Activity;
      });

      setActivities(nextActivities);
    } catch (error) {
      console.error("Error loading B2C activities:", error);
      setActivities([]);
    } finally {
      setIsLoaded(true);
    }
  }, [userEmail]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const addActivity = useCallback(
    (activity: Omit<Activity, "id" | "timestamp">) => {
      const newActivity: Activity = {
        ...activity,
        id: `activity-${Date.now()}`,
        timestamp: Date.now()
      };

      setActivities((current) => [newActivity, ...current].slice(0, 20));
      return newActivity;
    },
    []
  );

  return {
    activities,
    isLoaded,
    addActivity,
    refreshActivities: loadActivities
  };
};
