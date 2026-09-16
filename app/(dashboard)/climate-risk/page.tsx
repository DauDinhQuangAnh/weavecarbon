import ClimateRiskClient from "@/components/dashboard/climate-risk/ClimateRiskClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_CLIMATE_RISK_NAMESPACES } from "@/lib/i18n/namespaces";
export default function ClimateRiskPage() { return <ScopedIntlProvider namespaces={DASHBOARD_CLIMATE_RISK_NAMESPACES}><ClimateRiskClient /></ScopedIntlProvider>; }
