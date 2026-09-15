import CarbonOperationsClient from "@/components/dashboard/carbon-operations/CarbonOperationsClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_CARBON_OPERATIONS_NAMESPACES } from "@/lib/i18n/namespaces";

export default function DemoCarbonOperationsPage() {
  return <ScopedIntlProvider namespaces={DASHBOARD_CARBON_OPERATIONS_NAMESPACES}><CarbonOperationsClient demo /></ScopedIntlProvider>;
}
