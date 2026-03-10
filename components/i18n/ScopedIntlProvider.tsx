import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getScopedMessages } from "@/lib/i18n/messages";

interface ScopedIntlProviderProps {
  children: ReactNode;
  namespaces: readonly string[];
}

export default async function ScopedIntlProvider({
  children,
  namespaces
}: ScopedIntlProviderProps) {
  const { locale, messages } = await getScopedMessages(namespaces);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>);
}
