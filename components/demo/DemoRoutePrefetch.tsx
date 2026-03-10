"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DEMO_ROUTES } from "@/lib/demo/constants";

const PREFETCH_DELAY_MS = 250;

const DEMO_PREFETCH_ROUTES = [
  DEMO_ROUTES.overview,
  DEMO_ROUTES.products,
  DEMO_ROUTES.logistics,
  DEMO_ROUTES.export,
  DEMO_ROUTES.reports,
] as const;

export default function DemoRoutePrefetch() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const routesToPrefetch = DEMO_PREFETCH_ROUTES.filter((route) => route !== pathname);
    const timer = window.setTimeout(() => {
      routesToPrefetch.forEach((route) => {
        router.prefetch(route);
      });
    }, PREFETCH_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pathname, router]);

  return null;
}
