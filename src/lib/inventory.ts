import type { Tables } from "@/integrations/supabase/types";
import { getClinicDayKey } from "@/lib/reporting";

const EXPIRY_WARNING_DAYS = 30;

export const parseInventoryDate = (value: string | null) => {
  if (!value) return null;
  const dayKey = value.slice(0, 10);
  const parsed = new Date(`${dayKey}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dayKey ? null : parsed;
};

export const getDaysUntilExpiry = (expiryDate: string | null) => {
  const parsed = parseInventoryDate(expiryDate);
  if (!parsed) return null;

  const todayKey = getClinicDayKey(new Date());
  const today = new Date(`${todayKey}T00:00:00.000Z`);
  const diffMs = parsed.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

export const isExpiredDrug = (drug: Tables<"drugs">) => {
  const daysUntilExpiry = getDaysUntilExpiry(drug.expiry_date);
  return daysUntilExpiry !== null && daysUntilExpiry < 0;
};

export const isExpiringSoonDrug = (drug: Tables<"drugs">) => {
  const daysUntilExpiry = getDaysUntilExpiry(drug.expiry_date);
  return daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= EXPIRY_WARNING_DAYS;
};

export const getSellableStockQuantity = (drug: Tables<"drugs">) =>
  isExpiredDrug(drug) ? 0 : drug.stock_quantity;

export const getExpiredStockQuantity = (drug: Tables<"drugs">) =>
  isExpiredDrug(drug) ? drug.stock_quantity : 0;

export const getSellableCostValue = (drug: Tables<"drugs">) =>
  Number(drug.buying_price) * getSellableStockQuantity(drug);

export const getSellableRetailValue = (drug: Tables<"drugs">) =>
  Number(drug.selling_price) * getSellableStockQuantity(drug);

export const getExpiredStockCostLoss = (drug: Tables<"drugs">) =>
  Number(drug.buying_price) * getExpiredStockQuantity(drug);

export const getExpiredStockRetailLoss = (drug: Tables<"drugs">) =>
  Number(drug.selling_price) * getExpiredStockQuantity(drug);

export const getExpiryLabel = (drug: Tables<"drugs">) => {
  const daysUntilExpiry = getDaysUntilExpiry(drug.expiry_date);
  if (daysUntilExpiry === null) return "No expiry";
  if (daysUntilExpiry < 0) return "Expired";
  if (daysUntilExpiry === 0) return "Expires today";
  return `Expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`;
};
