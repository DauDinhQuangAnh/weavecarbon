import React from "react";
import OnboardingClient from "@/components/onboarding/OnboardingClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { ONBOARDING_NAMESPACES } from "@/lib/i18n/namespaces";

export const metadata = {
  title: "Business Onboarding - WeaveCARBON",
  description:
  "Set up your business profile and start tracking your carbon footprint"
};

const OnboardingPage = () => {
  return (
    <ScopedIntlProvider namespaces={ONBOARDING_NAMESPACES}>
      <OnboardingClient />
    </ScopedIntlProvider>);
};

export default OnboardingPage;
