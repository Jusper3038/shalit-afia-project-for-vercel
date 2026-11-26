import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type BackupRow = Record<string, unknown>;

export type ClinicBackup = {
  format: "shalit-clinic-backup";
  version: 1;
  created_at: string;
  clinic_owner_id: string;
  data: {
    profiles: Tables<"profiles">[];
    user_roles: Tables<"user_roles">[];
    drugs: Tables<"drugs">[];
    patients: Tables<"patients">[];
    transactions: Tables<"transactions">[];
    payments: Tables<"payments">[];
    inventory_movements: Tables<"inventory_movements">[];
    audit_logs: Tables<"audit_logs">[];
    ecommerce_stores: Tables<"ecommerce_stores">[];
    ecommerce_store_domains: Tables<"ecommerce_store_domains">[];
    ecommerce_product_categories: Tables<"ecommerce_product_categories">[];
    ecommerce_products: Tables<"ecommerce_products">[];
    ecommerce_customers: Tables<"ecommerce_customers">[];
    ecommerce_orders: Tables<"ecommerce_orders">[];
    ecommerce_order_items: Tables<"ecommerce_order_items">[];
  };
  excluded: string[];
};

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);

    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

const clinicRows = <T extends BackupRow>(
  table: "drugs" | "patients" | "transactions" | "payments" | "inventory_movements" | "audit_logs",
  ownerId: string,
) => fetchAllPages<T>(async (from, to) => {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("user_id", ownerId)
    .range(from, to);
  return { data: data as T[] | null, error };
});

const storeRows = <T extends BackupRow>(
  table: "ecommerce_store_domains" | "ecommerce_product_categories" | "ecommerce_products" | "ecommerce_customers" | "ecommerce_orders",
  storeIds: string[],
) => {
  if (storeIds.length === 0) return Promise.resolve([] as T[]);
  return fetchAllPages<T>(async (from, to) => {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .in("store_id", storeIds)
      .range(from, to);
    return { data: data as T[] | null, error };
  });
};

export async function createClinicBackup(ownerId: string): Promise<ClinicBackup> {
  if (!ownerId) throw new Error("Sign in to create a clinic backup.");

  const [profiles, drugs, patients, transactions, payments, inventoryMovements, auditLogs, stores] = await Promise.all([
    fetchAllPages<Tables<"profiles">>(async (from, to) => {
      const { data, error } = await supabase.from("profiles").select("*").eq("owner_user_id", ownerId).range(from, to);
      return { data, error };
    }),
    clinicRows<Tables<"drugs">>("drugs", ownerId),
    clinicRows<Tables<"patients">>("patients", ownerId),
    clinicRows<Tables<"transactions">>("transactions", ownerId),
    clinicRows<Tables<"payments">>("payments", ownerId),
    clinicRows<Tables<"inventory_movements">>("inventory_movements", ownerId),
    clinicRows<Tables<"audit_logs">>("audit_logs", ownerId),
    fetchAllPages<Tables<"ecommerce_stores">>(async (from, to) => {
      const { data, error } = await supabase.from("ecommerce_stores").select("*").eq("owner_user_id", ownerId).range(from, to);
      return { data, error };
    }),
  ]);

  const profileUserIds = profiles.map((profile) => profile.user_id);
  const storeIds = stores.map((store) => store.id);
  const [roles, domains, categories, products, customers, orders] = await Promise.all([
    profileUserIds.length === 0
      ? Promise.resolve([] as Tables<"user_roles">[])
      : fetchAllPages<Tables<"user_roles">>(async (from, to) => {
          const { data, error } = await supabase.from("user_roles").select("*").in("user_id", profileUserIds).range(from, to);
          return { data, error };
        }),
    storeRows<Tables<"ecommerce_store_domains">>("ecommerce_store_domains", storeIds),
    storeRows<Tables<"ecommerce_product_categories">>("ecommerce_product_categories", storeIds),
    storeRows<Tables<"ecommerce_products">>("ecommerce_products", storeIds),
    storeRows<Tables<"ecommerce_customers">>("ecommerce_customers", storeIds),
    storeRows<Tables<"ecommerce_orders">>("ecommerce_orders", storeIds),
  ]);

  const orderIds = orders.map((order) => order.id);
  const orderItems = orderIds.length === 0
    ? []
    : await fetchAllPages<Tables<"ecommerce_order_items">>(async (from, to) => {
        const { data, error } = await supabase.from("ecommerce_order_items").select("*").in("order_id", orderIds).range(from, to);
        return { data, error };
      });

  return {
    format: "shalit-clinic-backup",
    version: 1,
    created_at: new Date().toISOString(),
    clinic_owner_id: ownerId,
    data: {
      profiles,
      user_roles: roles,
      drugs,
      patients,
      transactions,
      payments,
      inventory_movements: inventoryMovements,
      audit_logs: auditLogs,
      ecommerce_stores: stores,
      ecommerce_store_domains: domains,
      ecommerce_product_categories: categories,
      ecommerce_products: products,
      ecommerce_customers: customers,
      ecommerce_orders: orders,
      ecommerce_order_items: orderItems,
    },
    excluded: [
      "Authentication users and passwords (managed by Supabase Auth)",
      "M-Pesa API credentials and owner security PIN data",
      "Clinic invites and invite codes",
      "Supabase Storage file contents",
      "Platform-wide settings and lead inbox data",
    ],
  };
}

export function downloadClinicBackup(backup: ClinicBackup, clinicName: string) {
  const safeName = clinicName.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "clinic";
  const date = backup.created_at.slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeName}-backup-${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
