import React from "react";
import { Suspense } from "react";
import B2CClient from "@/components/b2c/B2CClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { B2C_NAMESPACES } from "@/lib/i18n/namespaces";

const B2CPage: React.FC = () => {
  return (
    <ScopedIntlProvider namespaces={B2C_NAMESPACES}>
      <Suspense
        fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        }>

        <B2CClient />
      </Suspense>
    </ScopedIntlProvider>);

};

export default B2CPage;
