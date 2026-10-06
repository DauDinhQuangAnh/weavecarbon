import Client from "@/components/dashboard/industrial/ActivityDataClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_CARBON_OPERATIONS_NAMESPACES } from "@/lib/i18n/namespaces";
export default function Page() {
  return <ScopedIntlProvider namespaces={DASHBOARD_CARBON_OPERATIONS_NAMESPACES}><Client  demo /></ScopedIntlProvider>;
}
