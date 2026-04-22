
"use client";

import { useEffect, useState } from "react";
import LoadingScreen from "@/app/loading";

const FIRST_VISIT_LOADING_MS = 900;

export default function HomeClient({
  children
}: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const hasSeenLoading = sessionStorage.getItem("hasSeenLoading");
      if (hasSeenLoading) {
        setIsLoading(false);
      }
    } catch {
      setIsLoading(false);
    }
  }, []);

  const handleLoadingComplete = () => {
    try {
      sessionStorage.setItem("hasSeenLoading", "true");
    } catch {
      // Ignore storage failures and continue showing the page.
    }
    setIsLoading(false);
  };

  return (
    <>
      <div className="min-h-screen overflow-x-clip bg-background">
        {children}
      </div>

      {isLoading ? (
        <LoadingScreen
          onComplete={handleLoadingComplete}
          minDuration={FIRST_VISIT_LOADING_MS}
        />
      ) : null}
    </>
  );
}
