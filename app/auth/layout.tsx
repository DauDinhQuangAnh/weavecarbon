import React from "react";
import { Leaf } from "lucide-react";
import Link from "next/link";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { NextIntlClientProvider, createTranslator } from "next-intl";
import type { AbstractIntlMessages } from "use-intl/core";
import { getScopedMessages } from "@/lib/i18n/messages";
import { AUTH_NAMESPACES } from "@/lib/i18n/namespaces";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default async function AuthLayout({
  children
}: AuthLayoutProps) {
  const { locale, messages } = await getScopedMessages(AUTH_NAMESPACES);
  const t = createTranslator({
    locale,
    messages: messages as AbstractIntlMessages,
    namespace: "auth"
  });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="flex min-h-screen flex-col bg-linear-to-br from-background via-background to-primary/5 p-3 md:p-4">
        
        <div className="flex items-center gap-3 mb-4">
          <LanguageToggle />
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-lg">
            
            <div className="text-center mb-8">
              <Link href="/" className="inline-flex items-center gap-0 sm:gap-2">
                <div className="hidden h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary sm:flex">
                  <Leaf className="w-6 h-6 text-primary" />
                </div>
                <span className="text-2xl font-display font-bold text-foreground">
                  {t("welcome")}
                </span>
              </Link>
              <p className="mt-2 text-muted-foreground">{t("description")}</p>
            </div>

            {children}

            <p className="text-center text-sm text-muted-foreground mt-6">
              {t("termsNotice")}
            </p>
          </div>
        </div>
      </div>
    </NextIntlClientProvider>);

}
