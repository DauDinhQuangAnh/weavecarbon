import ReportRegistryClient from "@/components/dashboard/reports/ReportRegistryClient";
import ReportsTabs from "@/components/dashboard/reports/ReportsTabs";

export default function ReportRegistryPage() {
  return (
    <>
      <ReportsTabs />
      <ReportRegistryClient />
    </>
  );
}
