import AssessmentClient from "@/components/dashboard/assessment/AssessmentClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_ASSESSMENT_NAMESPACES } from "@/lib/i18n/namespaces";

export default function DemoAssessmentPage() {
  return (
    <ScopedIntlProvider namespaces={DASHBOARD_ASSESSMENT_NAMESPACES}>
      <AssessmentClient />
    </ScopedIntlProvider>
  );
}
