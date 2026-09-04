import type { Metadata } from "next";
import "./globals.css";
import { Toaster as SonnerToaster } from "sonner";
import { NextIntlClientProvider } from "next-intl";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { Be_Vietnam_Pro } from "next/font/google";
import { getScopedMessages } from "@/lib/i18n/messages";
import { ROOT_NAMESPACES } from "@/lib/i18n/namespaces";
import { getBackendHealth } from "@/lib/backendHealth";
import {
  DEFAULT_TOAST_DURATION,
  DEFAULT_TOAST_POSITION,
  DEFAULT_TOAST_SWIPE_DIRECTIONS
} from "@/lib/toastConfig";
import MaintenanceScreen from "@/components/system/MaintenanceScreen";

const beVietnamProBody = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-weavecarbon",
  display: "swap"
});

export const metadata: Metadata = {
  title: "WeaveCarbon",
  description: "Carbon footprint management for textile products",
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
      <body
        className={`${beVietnamProBody.variable} antialiased`}>
        {backendHealth.healthy ? (
          <AuthProvider>
            <NextIntlClientProvider locale={locale} messages={messages}>
              <LanguageProvider>
                {children}
                <SonnerToaster
                  position={DEFAULT_TOAST_POSITION}
                  richColors
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
