import DataGovernanceClient from "@/components/dashboard/data-governance/DataGovernanceClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_DATA_GOVERNANCE_NAMESPACES } from "@/lib/i18n/namespaces";
export default function DemoDataGovernancePage() { return <ScopedIntlProvider namespaces={DASHBOARD_DATA_GOVERNANCE_NAMESPACES}><DataGovernanceClient demo /></ScopedIntlProvider>; }
