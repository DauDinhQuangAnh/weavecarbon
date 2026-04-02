import React, { Suspense } from "react";
import B2CDonationClient from "@/components/b2c/B2CDonationClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { B2C_NAMESPACES } from "@/lib/i18n/namespaces";

const B2CDonatePage: React.FC = () => {
  return (
    <ScopedIntlProvider namespaces={B2C_NAMESPACES}>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        }
      >
        <B2CDonationClient />
      </Suspense>
    </ScopedIntlProvider>
  );
};

export default B2CDonatePage;
