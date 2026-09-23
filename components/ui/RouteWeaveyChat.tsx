"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stripDemoPrefix } from "@/lib/demo/routes";

const WeaveyChat = dynamic(() => import("./WeaveyChat"), {
  ssr: false,
  loading: () => (
    <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
      <Button
        type="button"
        aria-label="Đang mở trợ lý Weavey"
        className="h-14 w-14 rounded-full bg-linear-to-r from-primary to-accent text-white shadow-lg"
        disabled
      >
        <Loader2 className="h-6 w-6 animate-spin" />
      </Button>
    </div>
  )
});

const DASHBOARD_ROUTE_PREFIXES = [
"/assessment",
"/calculation-history",
"/export",
"/logistics",
"/overview",
"/passport-dashboard",
"/passport",
"/products",
"/reports",
"/settings",
"/summary",
"/track-shipment",
"/transport"];


const shouldShowWeaveyChat = (pathname: string | null) => {
  if (!pathname) return false;
  const normalizedPath = stripDemoPrefix(pathname);
  const isDedicatedAiPage =
    normalizedPath === "/settings/ai" || normalizedPath.startsWith("/settings/ai/");

  if (isDedicatedAiPage) {
    return false;
  }

  return DASHBOARD_ROUTE_PREFIXES.some((prefix) => {
    return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`);
  });
};

const RouteWeaveyChat = () => {
  const pathname = usePathname();
  const [activated, setActivated] = useState(false);

  if (!shouldShowWeaveyChat(pathname)) {
    return null;
  }

  if (activated) {
    return <WeaveyChat variant="dashboard" initiallyOpen />;
  }

  const preloadChat = () => {
    void import("./WeaveyChat");
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
      <Button
        type="button"
        aria-label="Mở trợ lý Weavey"
        onClick={() => setActivated(true)}
        onFocus={preloadChat}
        onPointerEnter={preloadChat}
        className="h-14 w-14 rounded-full bg-linear-to-r from-primary to-accent text-white shadow-lg transition-transform hover:scale-110 hover:shadow-xl"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default RouteWeaveyChat;
