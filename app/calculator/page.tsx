import CalculatorClient from "@/components/calculator/CalculatorClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { CALCULATOR_NAMESPACES } from "@/lib/i18n/namespaces";

export default function CalculatorPage() {
  return (
    <ScopedIntlProvider namespaces={CALCULATOR_NAMESPACES}>
      <CalculatorClient />
    </ScopedIntlProvider>);
}
