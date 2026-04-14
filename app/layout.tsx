import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";
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
  variable: "--font-plus-jakarta-sans",
  display: "swap"
});

const beVietnamProHeading = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
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
  const googleTagManagerId = (process.env.NEXT_PUBLIC_GTM_ID || "").trim();
  const googleTagManagerSnippet = googleTagManagerId
    ? `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer',${JSON.stringify(googleTagManagerId)});`
    : "";
  return (
    <html data-scroll-behavior="smooth" lang={locale} suppressHydrationWarning>
      {googleTagManagerId ? (
        <Script id="google-tag-manager" strategy="beforeInteractive">
          {googleTagManagerSnippet}
        </Script>
      ) : null}
      <body
        className={`${beVietnamProBody.variable} ${beVietnamProHeading.variable} antialiased`}>
        {googleTagManagerId ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${googleTagManagerId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }} />
          </noscript>
        ) : null}
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
    </html>);

}
