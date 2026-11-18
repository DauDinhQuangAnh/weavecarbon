"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Sends anonymous visitors to the sign-in page (used by /audit, which used to
 * render an account-specific message to signed-out visitors).
 */
export function RequireSignedIn({ children }: { children: ReactNode }) {
  const { authStatus, loading } = useAuth();
  const router = useRouter();
  const signedOut = !loading && (authStatus === "anonymous" || authStatus === "expired");

  useEffect(() => {
    if (signedOut) router.replace("/auth?forceLogin=1");
  }, [router, signedOut]);

  if (loading || authStatus === "checking" || signedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F9F6] text-sm text-slate-600">
        Đang kiểm tra đăng nhập…
      </div>
    );
  }
  return <>{children}</>;
}
