import type { Tables } from "@/integrations/supabase/types";

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

export const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
};

export const getProtectedUnitPrice = (
  drug: Pick<Tables<"drugs">, "buying_price" | "selling_price">,
  minimumProfitRetentionPercentage: number
) => {
  const buyingPrice = Number(drug.buying_price);
  const sellingPrice = Number(drug.selling_price);
  const retainedProfitShare = clampPercent(minimumProfitRetentionPercentage) / 100;

  if (sellingPrice <= buyingPrice) {
    return roundCurrency(sellingPrice);
  }

  return roundCurrency(
    buyingPrice + (sellingPrice - buyingPrice) * retainedProfitShare
  );
};

export const getMaxDiscountPercentageForDrug = (
  drug: Pick<Tables<"drugs">, "buying_price" | "selling_price">,
  minimumProfitRetentionPercentage: number
) => {
  const sellingPrice = Number(drug.selling_price);
  if (sellingPrice <= 0) return 0;

  const protectedUnitPrice = getProtectedUnitPrice(drug, minimumProfitRetentionPercentage);
  return roundCurrency(
    ((sellingPrice - protectedUnitPrice) / sellingPrice) * 100
  );
};

export const getDiscountedUnitPrice = (
  drug: Pick<Tables<"drugs">, "buying_price" | "selling_price">,
  minimumProfitRetentionPercentage: number,
  requestedDiscountPercentage: number
) => {
  const sellingPrice = Number(drug.selling_price);
  const maxDiscountPercentage = getMaxDiscountPercentageForDrug(drug, minimumProfitRetentionPercentage);
  const appliedDiscountPercentage = Math.min(clampPercent(requestedDiscountPercentage), maxDiscountPercentage);

  return roundCurrency(
    sellingPrice * (1 - appliedDiscountPercentage / 100)
  );
};
