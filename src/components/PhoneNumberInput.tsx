import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRY_CODES } from "@/lib/phone";

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
  <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[132px_minmax(0,1fr)]">
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
