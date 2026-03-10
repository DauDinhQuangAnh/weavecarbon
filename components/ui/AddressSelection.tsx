import React from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

export interface AddressData {
  streetAddress: string;
  aptSuite: string;
  city: string;
  state: string;
  zipPostcode: string;
  country: string;
  lat?: string;
  lng?: string;
}

interface AddressSelectionProps {
  value: AddressData;
  onChange: (address: AddressData) => void;
  label?: string;
  showCoordinates?: boolean;
  className?: string;
}

interface OptionItem {
  code: string;
  name: string;
}

const COUNTRIES = [
  { code: "VN", name: "Vietnam" },
  { code: "US", name: "United States" },
  { code: "CN", name: "China" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "CA", name: "Canada" },
  { code: "SG", name: "Singapore" },
  { code: "TH", name: "Thailand" },
  { code: "MY", name: "Malaysia" },
  { code: "ID", name: "Indonesia" },
  { code: "PH", name: "Philippines" },
  { code: "IN", name: "India" },
  { code: "NL", name: "Netherlands" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "TW", name: "Taiwan" },
  { code: "HK", name: "Hong Kong" }
];

const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" }
];

const VN_PROVINCES = [
  { code: "HN", name: "Hà Nội" },
  { code: "HCM", name: "TP. Hồ Chí Minh" },
  { code: "DN", name: "Đà Nẵng" },
  { code: "HP", name: "Hải Phòng" },
  { code: "CT", name: "Cần Thơ" },
  { code: "BD", name: "Bình Dương" },
  { code: "DDN", name: "Đồng Nai" },
  { code: "BT", name: "Bình Thuận" },
  { code: "KH", name: "Khánh Hòa" },
  { code: "QN", name: "Quảng Ninh" },
  { code: "TH", name: "Thanh Hóa" },
  { code: "NA", name: "Nghệ An" },
  { code: "HT", name: "Hà Tĩnh" },
  { code: "QB", name: "Quảng Bình" },
  { code: "QT", name: "Quảng Trị" },
  { code: "TT", name: "Thừa Thiên Huế" },
  { code: "QNA", name: "Quảng Nam" },
  { code: "QNG", name: "Quảng Ngãi" },
  { code: "BDI", name: "Bình Định" },
  { code: "PY", name: "Phú Yên" },
  { code: "GL", name: "Gia Lai" },
  { code: "DL", name: "Đắk Lắk" },
  { code: "LDD", name: "Lâm Đồng" },
  { code: "NT", name: "Ninh Thuận" },
  { code: "TNI", name: "Tây Ninh" },
  { code: "BP", name: "Bình Phước" },
  { code: "VT", name: "Bà Rịa - Vũng Tàu" },
  { code: "LA", name: "Long An" },
  { code: "TG", name: "Tiền Giang" },
  { code: "BT2", name: "Bến Tre" },
  { code: "TV", name: "Trà Vinh" },
  { code: "VL", name: "Vĩnh Long" },
  { code: "DDT", name: "Đồng Tháp" },
  { code: "AG", name: "An Giang" },
  { code: "KG", name: "Kiên Giang" },
  { code: "HGI", name: "Hậu Giang" },
  { code: "ST", name: "Sóc Trăng" },
  { code: "BL", name: "Bạc Liêu" },
  { code: "CM", name: "Cà Mau" }
];

const normalizeLookupToken = (value: string) =>
  value.
    normalize("NFD").
    replace(/[\u0300-\u036f]/g, "").
    toLowerCase().
    replace(/[^a-z0-9]+/g, "");

const COUNTRY_ALIASES: Record<string, string> = {
  vietnam: "VN",
  vietnamese: "VN",
  vietnamcountry: "VN",
  vn: "VN",
  unitedstates: "US",
  unitedstatesofamerica: "US",
  usa: "US",
  us: "US"
};

const resolveCountryCode = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const upper = trimmed.toUpperCase();
  if (COUNTRIES.some((country) => country.code === upper)) {
    return upper;
  }

  const normalized = normalizeLookupToken(trimmed);
  if (COUNTRY_ALIASES[normalized]) {
    return COUNTRY_ALIASES[normalized];
  }

  const matchedCountry = COUNTRIES.find(
    (country) => normalizeLookupToken(country.name) === normalized
  );
  return matchedCountry?.code || "";
};

const normalizeSubdivisionToken = (value: string) =>
  normalizeLookupToken(value).replace(
    /(province|state|city|tinh|thanhpho|tp)/g,
    ""
  );

const resolveSubdivisionName = (
  value: string,
  options: OptionItem[]
) => {
  const trimmed = value.trim();
  if (!trimmed || options.length === 0) return "";

  const upper = trimmed.toUpperCase();
  const byCode = options.find((option) => option.code === upper);
  if (byCode) return byCode.name;

  const normalized = normalizeSubdivisionToken(trimmed);
  if (!normalized) return "";

  const byName = options.find(
    (option) =>
      normalizeSubdivisionToken(option.name) === normalized ||
      normalizeSubdivisionToken(option.name).includes(normalized) ||
      normalized.includes(normalizeSubdivisionToken(option.name))
  );
  return byName?.name || "";
};

const AddressSelection: React.FC<AddressSelectionProps> = ({
  value,
  onChange,
  label,
  showCoordinates = false,
  className = ""
}) => {
  const t = useTranslations("addressSelection");

  const updateField = (field: keyof AddressData, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  const countryCode = resolveCountryCode(value.country);

  const getStateProvinceOptions = () => {
    if (countryCode === "US") return US_STATES;
    if (countryCode === "VN") return VN_PROVINCES;
    return [];
  };

  const stateProvinceOptions = getStateProvinceOptions();
  const resolvedStateName = resolveSubdivisionName(value.state, stateProvinceOptions);
  const showStateDropdown =
    stateProvinceOptions.length > 0 &&
    (value.state.trim().length === 0 || resolvedStateName.length > 0);

  return (
    <div className={`space-y-4 ${className}`}>
      {label ? <Label className="text-sm font-medium">{label}</Label> : null}

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{t("streetAddressLabel")}</Label>
        <Input
          placeholder={t("streetAddressPlaceholder")}
          value={value.streetAddress}
          onChange={(event) => updateField("streetAddress", event.target.value)}
          className="bg-background border border-foreground/10"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{t("aptSuiteLabel")}</Label>
        <Input
          placeholder={t("aptSuitePlaceholder")}
          value={value.aptSuite}
          onChange={(event) => updateField("aptSuite", event.target.value)}
          className="bg-background border border-foreground/10"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{t("cityLabel")}</Label>
        <Input
          placeholder={t("cityPlaceholder")}
          value={value.city}
          onChange={(event) => updateField("city", event.target.value)}
          className="bg-background border border-foreground/10"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            {countryCode === "VN" ? t("provinceLabel") : t("stateProvinceLabel")}
          </Label>
          {showStateDropdown ? (
            <Select
              value={resolvedStateName || undefined}
              onValueChange={(nextValue) => updateField("state", nextValue)}
            >
              <SelectTrigger className="bg-background border border-foreground/10">
                <SelectValue placeholder={t("selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent className="max-h-60 bg-background border shadow-lg z-50">
                {stateProvinceOptions.map((item) => (
                  <SelectItem key={item.code} value={item.name}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              placeholder={t("stateProvincePlaceholder")}
              value={value.state}
              onChange={(event) => updateField("state", event.target.value)}
              className="bg-background border border-foreground/10"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t("zipPostcodeLabel")}</Label>
          <Input
            placeholder={t("zipPostcodePlaceholder")}
            value={value.zipPostcode}
            onChange={(event) => updateField("zipPostcode", event.target.value)}
            className="bg-background border border-foreground/10"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{t("countryLabel")}</Label>
        <Select
          value={countryCode || undefined}
          onValueChange={(nextCountry) => {
            const selectedCountry = COUNTRIES.find((country) => country.code === nextCountry);
            onChange({
              ...value,
              country: selectedCountry?.name || nextCountry,
              state: ""
            });
          }}
        >
          <SelectTrigger className="bg-background border border-foreground/10">
            <SelectValue placeholder={t("countryPlaceholder")} />
          </SelectTrigger>
          <SelectContent className="max-h-60 bg-background border shadow-lg z-50">
            {COUNTRIES.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showCoordinates ? (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t("latitude")}</Label>
            <Input
              placeholder="10.7769"
              value={value.lat || ""}
              onChange={(event) => updateField("lat", event.target.value)}
              className="bg-background border border-foreground/10"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t("longitude")}</Label>
            <Input
              placeholder="106.7009"
              value={value.lng || ""}
              onChange={(event) => updateField("lng", event.target.value)}
              className="bg-background border border-foreground/10"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AddressSelection;
