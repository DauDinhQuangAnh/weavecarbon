import IndustryPacksClient from "@/components/dashboard/industry-packs/IndustryPacksClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_INDUSTRY_PACKS_NAMESPACES } from "@/lib/i18n/namespaces";
export default function IndustryPacksPage() { return <ScopedIntlProvider namespaces={DASHBOARD_INDUSTRY_PACKS_NAMESPACES}><IndustryPacksClient /></ScopedIntlProvider>; }
