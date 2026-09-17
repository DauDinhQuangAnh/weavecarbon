import WeavenodeClient from "@/components/dashboard/weavenode/WeavenodeClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_WEAVENODE_NAMESPACES } from "@/lib/i18n/namespaces";

export default function WeavenodePage() {
  return <ScopedIntlProvider namespaces={DASHBOARD_WEAVENODE_NAMESPACES}><WeavenodeClient /></ScopedIntlProvider>;
}
