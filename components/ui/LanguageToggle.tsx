"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import {
  localeFlagCodes,
  localeNames,
  locales,
  type Locale } from
"@/lib/i18n/config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import "flag-icons/css/flag-icons.min.css";

export function LanguageToggle() {
  const { locale, setLocale, isLoading } = useLanguage();

  return (
    <Select
      value={locale}
      onValueChange={(value) => setLocale(value as Locale)}
      disabled={isLoading}>

      <SelectTrigger className="h-9 w-[3.3rem] items-center border-2 bg-transparent px-2 text-xs cursor-pointer hover:border-slate-500 [&_svg]:h-3.5 [&_svg]:w-3.5 sm:h-10 sm:w-20 sm:px-3 sm:text-sm sm:[&_svg]:h-4 sm:[&_svg]:w-4">
        <SelectValue>
          <span className={`fi fi-${localeFlagCodes[locale]} text-base sm:text-xl`} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {locales.map((loc) =>
        <SelectItem className="cursor-pointer" key={loc} value={loc}>
            <span className={`fi fi-${localeFlagCodes[loc]} text-xl`} />
            <span className="px-2">{localeNames[loc]}</span>
          </SelectItem>
        )}
      </SelectContent>
    </Select>);

}
