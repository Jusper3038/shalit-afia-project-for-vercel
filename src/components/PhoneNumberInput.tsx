import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const COUNTRY_CODES = [
  { code: "+254", label: "Kenya", flag: "KE" },
  { code: "+255", label: "Tanzania", flag: "TZ" },
  { code: "+256", label: "Uganda", flag: "UG" },
  { code: "+250", label: "Rwanda", flag: "RW" },
  { code: "+257", label: "Burundi", flag: "BI" },
  { code: "+251", label: "Ethiopia", flag: "ET" },
  { code: "+252", label: "Somalia", flag: "SO" },
  { code: "+211", label: "South Sudan", flag: "SS" },
  { code: "+1", label: "United States", flag: "US" },
  { code: "+44", label: "United Kingdom", flag: "GB" },
  { code: "+91", label: "India", flag: "IN" },
] as const;

type PhoneNumberInputProps = {
  countryCode: string;
  phoneNumber: string;
  onCountryCodeChange: (value: string) => void;
  onPhoneNumberChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  inputClassName?: string;
  selectClassName?: string;
};

export const normalizePhoneNumber = (countryCode: string, phoneNumber: string) => {
  const digits = phoneNumber.replace(/\D/g, "");
  if (!digits) return "";
  const normalizedLocal = digits.startsWith("0") ? digits.slice(1) : digits;
  return `${countryCode}${normalizedLocal}`;
};

const PhoneNumberInput = ({
  countryCode,
  phoneNumber,
  onCountryCodeChange,
  onPhoneNumberChange,
  id,
  placeholder = "712345678",
  required = false,
  disabled = false,
  inputClassName,
  selectClassName,
}: PhoneNumberInputProps) => (
  <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-2">
    <Select value={countryCode} onValueChange={onCountryCodeChange} disabled={disabled}>
      <SelectTrigger aria-label="Country code" className={selectClassName}>
        <SelectValue placeholder="Code" />
      </SelectTrigger>
      <SelectContent>
        {COUNTRY_CODES.map((country) => (
          <SelectItem key={`${country.flag}-${country.code}`} value={country.code}>
            {country.flag} {country.code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <Input
      id={id}
      inputMode="tel"
      value={phoneNumber}
      onChange={(event) => onPhoneNumberChange(event.target.value.replace(/[^\d\s-]/g, ""))}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={inputClassName}
    />
  </div>
);

export default PhoneNumberInput;
