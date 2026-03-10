"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

export type AppRuntimeMode = "real" | "demo";

export const isDemoPath = (pathname: string | null | undefined) => {
  const safePath = (pathname || "").trim().toLowerCase();
  return safePath === "/demo" || safePath.startsWith("/demo/");
};

export const stripDemoPrefix = (pathname: string) => {
  if (!isDemoPath(pathname)) return pathname;
  const stripped = pathname.replace(/^\/demo(?=\/|$)/i, "");
  return stripped || "/";
};

export const withDemoPrefix = (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/demo" || normalized.startsWith("/demo/")) {
    return normalized;
  }
  return `/demo${normalized === "/" ? "/overview" : normalized}`;
};

export const toRuntimePath = (mode: AppRuntimeMode, path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return mode === "demo" ? withDemoPrefix(normalized) : stripDemoPrefix(normalized);
};

export const useAppRuntime = (): AppRuntimeMode => {
  const pathname = usePathname();
  return isDemoPath(pathname) ? "demo" : "real";
};

export const useAppRoutes = () => {
  const mode = useAppRuntime();

  return useMemo(
    () => ({
      mode,
      isDemo: mode === "demo",
      toAppPath: (path: string) => toRuntimePath(mode, path),
      toSummaryPath: (slug: string) =>
        toRuntimePath(mode, `/summary/${encodeURIComponent(slug)}`),
      homePath: toRuntimePath(mode, "/overview"),
    }),
    [mode]
  );
};
