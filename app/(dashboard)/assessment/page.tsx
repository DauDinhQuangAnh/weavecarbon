import React from "react";
import AssessmentClient from "@/components/dashboard/assessment/AssessmentClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_ASSESSMENT_NAMESPACES } from "@/lib/i18n/namespaces";

const AssessmentPage: React.FC = () => {
  return (
    <ScopedIntlProvider namespaces={DASHBOARD_ASSESSMENT_NAMESPACES}>
      <AssessmentClient />
    </ScopedIntlProvider>);
};

export default AssessmentPage;
