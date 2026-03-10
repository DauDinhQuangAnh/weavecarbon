import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, type Locale, locales } from "./config";

export default getRequestConfig(async () => {

  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("locale")?.value;

  const locale: Locale = locales.includes(localeCookie as Locale) ?
  localeCookie as Locale :
  defaultLocale;

  return { locale };
});
