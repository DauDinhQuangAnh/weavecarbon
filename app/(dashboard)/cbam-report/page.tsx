"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppRoutes } from "@/lib/demo/routes";

// The CBAM pre-audit tool is now a tab inside the unified Reports page
// (/reports?tab=cbam). This route is kept as a redirect so old links,
// bookmarks and any lingering references still resolve.
export default function CbamReportRedirect() {
  const router = useRouter();
  const appRoutes = useAppRoutes();

  useEffect(() => {
    router.replace(`${appRoutes.toAppPath("/reports")}?tab=cbam`);
  }, [appRoutes, router]);

  return null;
}
