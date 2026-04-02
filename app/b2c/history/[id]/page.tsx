import React, { Suspense } from "react";
import B2CDonationDetailClient from "@/components/b2c/B2CDonationDetailClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { B2C_NAMESPACES } from "@/lib/i18n/namespaces";

interface B2CDonationDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function B2CDonationDetailPage({
  params
}: B2CDonationDetailPageProps) {
  const { id } = await params;

  return (
    <ScopedIntlProvider namespaces={B2C_NAMESPACES}>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        }
      >
        <B2CDonationDetailClient donationId={id} />
      </Suspense>
    </ScopedIntlProvider>
  );
}
