import type { Tables } from "@/integrations/supabase/types";

const EXPIRY_WARNING_DAYS = 30;

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

export const parseInventoryDate = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
};

export const getDaysUntilExpiry = (expiryDate: string | null) => {
  const parsed = parseInventoryDate(expiryDate);
  if (!parsed) return null;

  const today = startOfDay(new Date());
  const diffMs = parsed.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

export const isExpiredDrug = (drug: Tables<"drugs">) => {
  const daysUntilExpiry = getDaysUntilExpiry(drug.expiry_date);
  return daysUntilExpiry !== null && daysUntilExpiry < 0;
};

export const isExpiringSoonDrug = (drug: Tables<"drugs">) => {
  const daysUntilExpiry = getDaysUntilExpiry(drug.expiry_date);
  return daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= EXPIRY_WARNING_DAYS;
};

export const getExpiryLabel = (drug: Tables<"drugs">) => {
  const daysUntilExpiry = getDaysUntilExpiry(drug.expiry_date);
  if (daysUntilExpiry === null) return "No expiry";
  if (daysUntilExpiry < 0) return "Expired";
  if (daysUntilExpiry === 0) return "Expires today";
  if (daysUntilExpiry <= EXPIRY_WARNING_DAYS) return `Expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`;
  return "Valid";
};
