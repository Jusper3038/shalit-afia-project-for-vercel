import {
  BarChart3,
  CreditCard,
  Package2,
  Receipt,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AppPermission =
  | "dashboard"
  | "inventory"
  | "patients"
  | "billing"
  | "payments"
  | "audit_logs"
  | "settings";

export type AppPermissionOption = {
  key: AppPermission;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const APP_PERMISSION_OPTIONS: AppPermissionOption[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Sales, stock health, and profit reports",
    icon: BarChart3,
  },
  {
    key: "inventory",
    label: "Inventory",
    description: "Add, edit, and remove stock items",
    icon: Package2,
  },
  {
    key: "patients",
    label: "Patients",
    description: "Patient records and contact details",
    icon: Users,
  },
  {
    key: "billing",
    label: "Billing",
    description: "Record bills and print receipts",
    icon: Receipt,
  },
  {
    key: "payments",
    label: "Payments",
    description: "M-Pesa payment requests and history",
    icon: CreditCard,
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

export const ALL_APP_PERMISSIONS = APP_PERMISSION_OPTIONS.map((option) => option.key);
