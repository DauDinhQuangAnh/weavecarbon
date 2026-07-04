import React from "react";
import { Suspense } from "react";
import B2CDonationDetailClient from "@/components/b2c/B2CDonationDetailClient";

interface DemoB2CDonationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DemoB2CDonationDetailPage({
  params,
}: DemoB2CDonationDetailPageProps) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      }
    >
      <B2CDonationDetailClient donationId={id} />
    </Suspense>
  );
}
