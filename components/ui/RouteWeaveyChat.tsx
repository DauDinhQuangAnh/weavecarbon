"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { stripDemoPrefix } from "@/lib/demo/routes";

const WeaveyChat = dynamic(() => import("./WeaveyChat"), {
  ssr: false,
  loading: () => null
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

  return DASHBOARD_ROUTE_PREFIXES.some((prefix) => {
    return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`);
  });
};

const RouteWeaveyChat = () => {
  const pathname = usePathname();

  if (!shouldShowWeaveyChat(pathname)) {
    return null;
  }

  return <WeaveyChat variant="dashboard" />;
};

export default RouteWeaveyChat;
