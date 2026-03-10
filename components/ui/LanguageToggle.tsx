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

      <SelectTrigger className="w-20 border-2 bg-transparent items-center cursor-pointer hover:border-slate-500">
        <SelectValue>
          <span className={`fi fi-${localeFlagCodes[locale]} text-xl`} />
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
