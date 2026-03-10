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
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse-soft delay-500" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative w-40 h-40 mb-8">
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

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 bg-gradient-forest rounded-2xl flex items-center justify-center shadow-lg glow-effect">
              <Leaf className="w-10 h-10 text-primary-foreground" />
            </div>
          </div>

          <svg className="absolute inset-0 w-full h-full -rotate-90">
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

        <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }} />
        </div>

        <p className="text-xs text-muted-foreground mt-2">{progress}%</p>
      </div>
    </div>);

};

export default LoadingScreen;
