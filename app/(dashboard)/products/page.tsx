import ProductsClient from "@/components/dashboard/ProductsClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import {
  DASHBOARD_ASSESSMENT_NAMESPACES,
  DASHBOARD_PRODUCTS_NAMESPACES
} from "@/lib/i18n/namespaces";

const PRODUCTS_PAGE_NAMESPACES = [
...DASHBOARD_PRODUCTS_NAMESPACES,
...DASHBOARD_ASSESSMENT_NAMESPACES] as const;

export default function ProductsPage() {
  return (
    <ScopedIntlProvider namespaces={PRODUCTS_PAGE_NAMESPACES}>
      <ProductsClient />
    </ScopedIntlProvider>);
}
