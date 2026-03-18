"use client";

import { Leaf } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface LoadingScreenProps {
  onComplete?: () => void;
  minDuration?: number;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  onComplete,
  minDuration = 2500
}) => {
  const t = useTranslations("loading");
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, minDuration / 50);

    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => {
        onComplete?.();
      }, 500);
    }, minDuration);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [minDuration, onComplete]);

  return (
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"}`
        }>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 hidden h-96 w-96 rounded-full bg-primary/5 blur-3xl animate-pulse-soft lg:block" />
        <div className="absolute bottom-1/4 right-1/4 hidden h-96 w-96 rounded-full bg-accent/5 blur-3xl animate-pulse-soft delay-500 lg:block" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative mb-8 h-28 w-28 sm:h-32 sm:w-32 lg:h-40 lg:w-40">
          <div className="hidden lg:block">
            {[0, 1, 2, 3, 4, 5].map((index) =>
            <div
              key={index}
              className="absolute inset-0 animate-spin"
              style={{
                animationDuration: "4s",
                animationDelay: `${index * 0.3}s`,
                animationTimingFunction: "linear"
              }}>
                <div
                className="absolute w-6 h-6"
                style={{
                  top: "0%",
                  left: "50%",
                  transform: `translateX(-50%) rotate(${index * 60}deg)`,
                  transformOrigin: "center 80px"
                }}>
                  <Leaf
                  className="w-6 h-6 text-primary animate-pulse"
                  style={{
                    animationDelay: `${index * 0.2}s`,
                    opacity: 0.5 + index * 0.1
                  }} />
                </div>
              </div>
            )}
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-forest shadow-lg lg:h-20 lg:w-20 lg:glow-effect">
              <Leaf className="h-8 w-8 text-primary-foreground lg:h-10 lg:w-10" />
            </div>
          </div>

          <svg
            className="absolute inset-0 h-full w-full -rotate-90"
            viewBox="0 0 160 160"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="hsl(140 15% 92%)"
              strokeWidth="2" />
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="hsl(150 60% 20%)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={440}
              strokeDashoffset={440 - 440 * progress / 100}
              className="transition-all duration-100" />
          </svg>
        </div>

        <h1 className="text-3xl font-display font-bold mb-2">
          WEAVE<span className="text-primary">CARBON</span>
        </h1>

        <p className="text-muted-foreground text-sm mb-6">
          {t("systemLoading")}
        </p>

        <div className="h-1 w-40 overflow-hidden rounded-full bg-muted sm:w-44 lg:w-48">
          <div
            className="h-full bg-primary rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }} />
        </div>

        <p className="text-xs text-muted-foreground mt-2">{progress}%</p>
      </div>
    </div>);

};

export default LoadingScreen;
