import React from "react";
import { Suspense } from "react";
import B2CCouponsClient from "@/components/b2c/B2CCouponsClient";

export default function DemoB2CCouponsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      }
    >
      <B2CCouponsClient />
    </Suspense>
  );
}
