
"use client";

import { useState, useEffect } from "react";
import LoadingScreen from "@/app/loading";

export default function HomeClient({
  children


}: {children: React.ReactNode;}) {
  const [isLoading, setIsLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {

    const hasSeenLoading = sessionStorage.getItem("hasSeenLoading");
    if (hasSeenLoading) {
      setIsLoading(false);
      setShowContent(true);
    }
  }, []);

  const handleLoadingComplete = () => {
    sessionStorage.setItem("hasSeenLoading", "true");
    setIsLoading(false);
    setTimeout(() => setShowContent(true), 100);
  };

  return (
    <>
      {isLoading &&
      <LoadingScreen onComplete={handleLoadingComplete} minDuration={2500} />
      }

      {!isLoading &&
      <div
        className={`min-h-screen bg-background transition-opacity duration-500 ${showContent ? "opacity-100" : "opacity-0"}`}>

          {children}
        </div>
      }
    </>);

}