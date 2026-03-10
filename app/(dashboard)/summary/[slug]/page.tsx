import SummaryClient from "@/components/dashboard/SummaryClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_SUMMARY_NAMESPACES } from "@/lib/i18n/namespaces";

interface SummaryPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function SummaryPage({ params }: SummaryPageProps) {
  const { slug } = await params;

  return (
    <ScopedIntlProvider namespaces={DASHBOARD_SUMMARY_NAMESPACES}>
      <SummaryClient productId={slug} />
    </ScopedIntlProvider>);
}
