import SummaryClient from "@/components/dashboard/SummaryClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_SUMMARY_NAMESPACES } from "@/lib/i18n/namespaces";

interface DemoSummaryPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function DemoSummaryPage({ params }: DemoSummaryPageProps) {
  const { slug } = await params;

  return (
    <ScopedIntlProvider namespaces={DASHBOARD_SUMMARY_NAMESPACES}>
      <SummaryClient productId={slug} />
    </ScopedIntlProvider>
  );
}

