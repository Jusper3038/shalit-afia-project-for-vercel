import { CreditCard, Pill, ScrollText, Settings, ShoppingBag, Store, type LucideIcon } from "lucide-react";

export type ReleasedAppKey =
  | "pharmacy"
  | "payments"
  | "ecommerce"
  | "storefront"
  | "audit_logs"
  | "settings";

export type ReleasedAppOption = {
  key: ReleasedAppKey;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const RELEASED_APP_OPTIONS: ReleasedAppOption[] = [
  {
    key: "pharmacy",
    label: "Pharmacy",
    description: "Reports, inventory, patients, and billing",
    icon: Pill,
  },
  {
    key: "payments",
    label: "Payments",
    description: "M-Pesa requests and payment history",
    icon: CreditCard,
  },
  {
    key: "ecommerce",
    label: "Ecommerce",
    description: "Online shop management tools",
    icon: ShoppingBag,
  },
  {
    key: "storefront",
    label: "Storefront",
    description: "Public shop and store pages",
    icon: Store,
  },
  {
    key: "audit_logs",
    label: "Audit Logs",
    description: "Clinic activity history",
    icon: ScrollText,
  },
  {
    key: "settings",
    label: "Settings",
    description: "Clinic settings and owner controls",
    icon: Settings,
  },
];

export const ALL_RELEASED_APPS = RELEASED_APP_OPTIONS.map((option) => option.key);
