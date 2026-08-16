"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppRoutes } from "@/lib/demo/routes";

// CBAM is merged into the unified Reports page; redirect to /demo/reports?tab=cbam.
export default function DemoCbamReportRedirect() {
  const router = useRouter();
  const appRoutes = useAppRoutes();

  useEffect(() => {
    router.replace(`${appRoutes.toAppPath("/reports")}?tab=cbam`);
  }, [appRoutes, router]);

  return null;
}
