import type { Tables } from "@/integrations/supabase/types";

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

export const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
};

export const getProtectedUnitPrice = (
  drug: Pick<Tables<"drugs">, "buying_price" | "selling_price">,
  maximumDiscountPercentage: number
) => {
  const buyingPrice = Number(drug.buying_price);
  const sellingPrice = Number(drug.selling_price);
  const configuredDiscountShare = clampPercent(maximumDiscountPercentage) / 100;

  if (sellingPrice <= buyingPrice) {
    return roundCurrency(sellingPrice);
  }

  const discountedFloorPrice = sellingPrice * (1 - configuredDiscountShare);
  return roundCurrency(Math.max(buyingPrice, discountedFloorPrice));
};

export const getMaxDiscountPercentageForDrug = (
  drug: Pick<Tables<"drugs">, "buying_price" | "selling_price">,
  maximumDiscountPercentage: number
) => {
  const buyingPrice = Number(drug.buying_price);
  const sellingPrice = Number(drug.selling_price);
  if (sellingPrice <= 0) return 0;

  const configuredMaximumDiscount = clampPercent(maximumDiscountPercentage);
  const costSafeMaximumDiscount = sellingPrice <= buyingPrice
    ? 0
    : ((sellingPrice - buyingPrice) / sellingPrice) * 100;

  return roundCurrency(Math.min(configuredMaximumDiscount, costSafeMaximumDiscount));
};

export const getDiscountedUnitPrice = (
  drug: Pick<Tables<"drugs">, "buying_price" | "selling_price">,
  maximumDiscountPercentage: number,
  requestedDiscountPercentage: number
) => {
  const sellingPrice = Number(drug.selling_price);
  const maxDiscountPercentage = getMaxDiscountPercentageForDrug(drug, maximumDiscountPercentage);
  const appliedDiscountPercentage = Math.min(clampPercent(requestedDiscountPercentage), maxDiscountPercentage);

  return roundCurrency(
    sellingPrice * (1 - appliedDiscountPercentage / 100)
  );
};
