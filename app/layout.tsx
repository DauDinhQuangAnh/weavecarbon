import type { Metadata } from "next";
import "./globals.css";
import { Toaster as SonnerToaster } from "sonner";
import { NextIntlClientProvider } from "next-intl";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ScrollExperience from "@/components/motion/ScrollExperience";
import { getScopedMessages } from "@/lib/i18n/messages";
import { ROOT_NAMESPACES } from "@/lib/i18n/namespaces";
import { getBackendHealth } from "@/lib/backendHealth";
import {
  DEFAULT_TOAST_DURATION,
  DEFAULT_TOAST_EXPAND,
  DEFAULT_TOAST_POSITION,
  DEFAULT_TOAST_SWIPE_DIRECTIONS,
  DEFAULT_TOAST_VISIBLE
} from "@/lib/toastConfig";
import MaintenanceScreen from "@/components/system/MaintenanceScreen";


// Availability is a runtime concern. Keep the shell dynamic so a deployment
// never bakes a transient healthy/unhealthy result into every generated page;
// getBackendHealth() still coalesces checks within its short server-side TTL.
export const dynamic = "force-dynamic";

const SITE_URL = "https://weavecarbon.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "WeaveCarbon",
  description: "Industrial carbon and climate data infrastructure",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "WeaveCarbon",
    title: "WeaveCarbon · Industrial carbon & climate data infrastructure",
    description: "Hạ tầng dữ liệu carbon và rủi ro khí hậu cho chuỗi cung ứng công nghiệp.",
    locale: "vi_VN"
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" }
    ],
    shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export default async function RootLayout({
  children
}: Readonly<{children: React.ReactNode;}>) {
  const backendHealth = await getBackendHealth();
  const { locale, messages } = await getScopedMessages(ROOT_NAMESPACES);
  return (
    <html data-scroll-behavior="smooth" lang={locale} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" />
      </head>
      <body
        className="antialiased">
        <ScrollExperience />
        {backendHealth.healthy ? (
          <AuthProvider>
            <NextIntlClientProvider locale={locale} messages={messages}>
              <LanguageProvider>
                {children}
                <SonnerToaster
                  position={DEFAULT_TOAST_POSITION}
                  richColors
                  expand={DEFAULT_TOAST_EXPAND}
                  visibleToasts={DEFAULT_TOAST_VISIBLE}
                  closeButton={false}
                  duration={DEFAULT_TOAST_DURATION}
                  swipeDirections={[...DEFAULT_TOAST_SWIPE_DIRECTIONS]} />
              </LanguageProvider>
            </NextIntlClientProvider>
          </AuthProvider>
        ) : (
          <MaintenanceScreen healthUrl={backendHealth.healthUrl} />
        )}
      </body>
    </html>
  );
}
