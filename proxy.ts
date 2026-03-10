import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, locales, type Locale } from "./lib/i18n/config";

export async function proxy(request: NextRequest) {



  const localeCookie = request.cookies.get("locale")?.value;


  const locale: Locale = locales.includes(localeCookie as Locale) ?
  localeCookie as Locale :
  defaultLocale;

  const response = NextResponse.next({
    request
  });


  if (!localeCookie) {
    response.cookies.set("locale", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365
    });
  }

  return response;
}

export const config = {
  matcher: [

  "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]

};