import TransportClient from "@/components/dashboard/transport/TransportClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_TRANSPORT_NAMESPACES } from "@/lib/i18n/namespaces";

export default function DemoTransportPage() {
  return (
    <ScopedIntlProvider namespaces={DASHBOARD_TRANSPORT_NAMESPACES}>
      <TransportClient />
    </ScopedIntlProvider>
  );
}
