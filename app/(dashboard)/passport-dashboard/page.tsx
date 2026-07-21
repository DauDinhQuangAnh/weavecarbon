import { Suspense } from "react";
import PassportClient from "@/components/passport/PassportClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_PASSPORT_NAMESPACES } from "@/lib/i18n/namespaces";

function PassportLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-green-50 to-emerald-100">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
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
