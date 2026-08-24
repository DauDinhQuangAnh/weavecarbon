import { Suspense } from "react";
import AuditPackClient from "@/components/audit/AuditPackClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_REPORTS_NAMESPACES } from "@/lib/i18n/namespaces";

function AuditLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F9F6]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
        <p className="text-xs font-semibold text-emerald-900">Đang tải hồ sơ Pre-Audit Pack...</p>
      </div>
    </div>
  );
}

export default function AuditPage() {
  return (
    <ScopedIntlProvider namespaces={DASHBOARD_REPORTS_NAMESPACES}>
      <Suspense fallback={<AuditLoading />}>
        <AuditPackClient />
      </Suspense>
    </ScopedIntlProvider>
  );
}
