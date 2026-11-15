import AIReportBuilderClient from "@/components/dashboard/report-builder/AIReportBuilderClient";
import ReportsTabs from "@/components/dashboard/reports/ReportsTabs";

export default function ReportBuilderPage() {
  return (
    <>
      <ReportsTabs />
      <AIReportBuilderClient />
    </>
  );
}
