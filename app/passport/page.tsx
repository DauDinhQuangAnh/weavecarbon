import { Suspense } from "react";
import PassportClient from "@/components/passport/PassportClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_PASSPORT_NAMESPACES } from "@/lib/i18n/namespaces";

function PassportLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#dff1ea]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-700 border-t-transparent" />
    </div>
  );
}

export default function PassportPage() {
  return (
    <ScopedIntlProvider namespaces={DASHBOARD_PASSPORT_NAMESPACES}>
      <Suspense fallback={<PassportLoading />}>
        <PassportClient />
      </Suspense>
    </ScopedIntlProvider>
  );
}
