import Footer from "@/components/landing/Footer";
import HomeClient from "../components/ui/HomeClient";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import Stats from "@/components/landing/Stats";
import CTA from "@/components/landing/CTA";
import Problem from "@/components/landing/Problem";
import Solution from "@/components/landing/Solution";
import USP from "@/components/landing/USP";
import DemoReportsPreview from "@/components/landing/DemoReportsPreview";
import Pricing from "@/components/landing/Pricing";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { HOME_NAMESPACES } from "@/lib/i18n/namespaces";


export default function Home() {
  return (
    <ScopedIntlProvider namespaces={HOME_NAMESPACES}>
      <HomeClient>
        <Header />
        <main className="relative overflow-hidden">
          <Hero />
          <Problem />
          <Solution />
          <USP />
          <Features />
          <HowItWorks />
          <DemoReportsPreview />
          <Stats />
          <Pricing />
          <CTA />
        </main>
        <Footer />
      </HomeClient>
    </ScopedIntlProvider>);

}
