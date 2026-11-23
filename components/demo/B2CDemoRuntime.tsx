"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import DemoB2CProvider from "@/components/demo/DemoB2CProvider";
import { loadB2CDemoUser } from "@/contexts/auth/userBuilders";

const subscribeNoop = () => () => {};
const readOfflineDemo = () => Boolean(loadB2CDemoUser());
const readOfflineDemoOnServer = () => null;

/**
 * /b2c is shared by real B2C accounts and the offline B2C demo started from the landing
 * page (a mock user in localStorage, no server tokens). Without the demo API adapter the
 * offline demo sent its requests to the real /api/b2c/* endpoints and got 401/403.
 * Real sessions, including the server-issued demo account from /auth, keep using the API.
 */
export default function B2CDemoRuntime({ children }: { children: ReactNode }) {
  const offlineDemo = useSyncExternalStore<boolean | null>(
    subscribeNoop,
    readOfflineDemo,
    readOfflineDemoOnServer
  );

  if (offlineDemo === null) return null;
  if (offlineDemo) return <DemoB2CProvider>{children}</DemoB2CProvider>;
  return <>{children}</>;
}
