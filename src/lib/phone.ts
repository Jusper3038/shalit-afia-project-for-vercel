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

export const normalizePhoneNumber = (countryCode: string, phoneNumber: string) => {
  const digits = phoneNumber.replace(/\D/g, "");
  if (!digits) return "";
  const normalizedLocal = digits.startsWith("0") ? digits.slice(1) : digits;
  return `${countryCode}${normalizedLocal}`;
};
