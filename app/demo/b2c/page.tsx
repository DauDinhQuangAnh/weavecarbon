import React from "react";
import { Suspense } from "react";
import B2CClient from "@/components/b2c/B2CClient";

export default function DemoB2CPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      }
    >
      <B2CClient />
    </Suspense>
  );
}
