import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAudit } from "@/lib/audit";
import { exportToCSV } from "@/lib/csv-export";
import AppLayout from "@/components/AppLayout";
import InvoiceBatchImportDialog from "@/components/InvoiceBatchImportDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Download, Search, ListPlus, PackagePlus, History, ChevronDown, ChevronRight } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { getExpiredStockCostLoss, getExpiryLabel, getSellableStockQuantity, isExpiredDrug, isExpiringSoonDrug } from "@/lib/inventory";
import { readClinicCache, writeClinicCache } from "@/lib/clinic-cache";
import { DRUG_CATALOG, type DrugCatalogItem } from "@/lib/drug-catalog";

const emptyDrugForm = {
  name: "",
  serial_number: "",
  expiry_date: "",
  date_of_purchase: "",
  buying_price: "",
  selling_price: "",
  stock_quantity: "",
  low_stock_threshold: "10",
  movement_reason: "New batch received",
};

type InventoryMovementType = "delivery" | "correction" | "write_off";

const normalizeSearchText = (value: string) =>
  value.toLowerCase().trim().replace(/\s+/g, " ");
const INVENTORY_SUGGESTION_MIN_CHARS = 2;
const INVENTORY_SUGGESTION_DEBOUNCE_MS = 200;

const getDateSearchTokens = (value: string | null) => {
  if (!value) return [];

  const tokens = [value, value.replace(/-/g, "/")];
  const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoDateMatch) return tokens;

  const [, year, month, day] = isoDateMatch;
  tokens.push(
    `${day}-${month}-${year}`,
    `${month}-${day}-${year}`,
    `${day}/${month}/${year}`,
    `${month}/${day}/${year}`
  );

  return tokens;
};

type PendingSensitiveAction =
  | { type: "edit"; drug: Tables<"drugs"> }
  | { type: "delete"; drug: Tables<"drugs"> }
  | { type: "movement"; drug: Tables<"drugs"> }
  | null;

const DrugsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    clinicOwnerId,
    role,
    hasOwnerSecurityPin,
    isSensitiveAccessVerified,
    verifySensitiveAccess,
    setOwnerSecurityPin,
  } = useAuth();
  const [drugs, setDrugs] = useState<Tables<"drugs">[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryLoadError, setInventoryLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [invoiceImportOpen, setInvoiceImportOpen] = useState(false);
  const [editingDrug, setEditingDrug] = useState<Tables<"drugs"> | null>(null);
  const [form, setForm] = useState(emptyDrugForm);
  const [savingDrug, setSavingDrug] = useState(false);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [movementDrug, setMovementDrug] = useState<Tables<"drugs"> | null>(null);
  const [movementType, setMovementType] = useState<InventoryMovementType>("delivery");
  const [movementQuantity, setMovementQuantity] = useState("1");
  const [movementReason, setMovementReason] = useState("");
  const [savingMovement, setSavingMovement] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyDrug, setHistoryDrug] = useState<Tables<"drugs"> | null>(null);
  const [movementHistory, setMovementHistory] = useState<Tables<"inventory_movements">[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [pendingSensitiveAction, setPendingSensitiveAction] = useState<PendingSensitiveAction>(null);
  const [inventorySearch, setInventorySearch] = useState("");
  const [debouncedInventorySearch, setDebouncedInventorySearch] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [isInventorySearchFocused, setIsInventorySearchFocused] = useState(false);
  const [highlightedDrugId, setHighlightedDrugId] = useState<string | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const inventoryRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const highlightTimeoutRef = useRef<number | null>(null);

  const fetchDrugs = useCallback(async () => {
    if (!clinicOwnerId) {
      setLoading(false);
      setInventoryLoadError("Your clinic could not be identified. Sign out and sign in again, then retry.");
      return;
    }
    const cached = readClinicCache<Tables<"drugs">[]>(clinicOwnerId, "drugs");
    if (cached) {
      setDrugs(cached);
      setLoading(false);
    }
    setInventoryLoadError(null);
    const timeoutId = window.setTimeout(() => {
      setLoading(false);
      setInventoryLoadError("Inventory is taking longer than expected. You can retry while the page stays open.");
    }, 5000);
    try {
      const { data, error } = await supabase
        .from("drugs")
        .select("*")
        .eq("user_id", clinicOwnerId)
        .order("created_at", { ascending: false });

      if (error) {
        setInventoryLoadError(error.message);
        return;
      }

      setDrugs(data ?? []);
      writeClinicCache(clinicOwnerId, "drugs", data ?? []);
      setInventoryLoadError(null);
    } catch (error) {
      setInventoryLoadError(error instanceof Error ? error.message : "Could not load inventory.");
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [clinicOwnerId]);

  useEffect(() => { void fetchDrugs(); }, [fetchDrugs]);

  const resetForm = () => {
    setForm(emptyDrugForm);
    setEditingDrug(null);
  };

  const resetPinDialog = () => {
    setPin("");
    setConfirmPin("");
    setPendingSensitiveAction(null);
  };

  const openAddDialog = useCallback((catalogItem?: DrugCatalogItem, existingProductName?: string) => {
    setEditingDrug(null);
    setForm({
      ...emptyDrugForm,
      name: existingProductName ?? catalogItem?.name ?? "",
    });
    setDialogOpen(true);
  }, []);

  useEffect(() => {
    const navigationState = location.state as { openAddBatch?: boolean } | null;
    if (!navigationState?.openAddBatch) return;

    openAddDialog();
    navigate(location.pathname, { replace: true, state: null });
  }, [location.key, location.pathname, location.state, navigate, openAddDialog]);

  const openEditDialog = (drug: Tables<"drugs">) => {
    setEditingDrug(drug);
    setForm({
      name: drug.name,
      serial_number: drug.serial_number ?? "",
      expiry_date: drug.expiry_date ?? "",
      date_of_purchase: drug.date_of_purchase ?? "",
      buying_price: String(drug.buying_price),
      selling_price: String(drug.selling_price),
      stock_quantity: String(drug.stock_quantity),
      low_stock_threshold: String(drug.low_stock_threshold),
      movement_reason: "New batch received",
    });
    setDialogOpen(true);
  };

  const performDelete = async (drug: Tables<"drugs">) => {
    if (drug.stock_quantity > 0) {
      toast.error("Write off or move the remaining stock before deleting this batch.");
      return;
    }
    if (!confirm(`Delete "${drug.name}"?`)) return;
    const { error } = await supabase.from("drugs").delete().eq("id", drug.id);
    if (error) { toast.error(error.message); return; }
    await logAudit("Deleted drug", `Deleted ${drug.name}`);
    toast.success("Drug deleted!");
    fetchDrugs();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicOwnerId) return;

    const trimmedName = form.name.trim();
    const trimmedSerial = form.serial_number.trim();
    const buyingPrice = Number(form.buying_price);
    const sellingPrice = Number(form.selling_price);
    const stockQuantity = Number(form.stock_quantity);
    const lowStockThreshold = Number(form.low_stock_threshold);

    if (!trimmedName) {
      toast.error("Drug name is required.");
      return;
    }

    if (!Number.isFinite(buyingPrice) || buyingPrice < 0) {
      toast.error("Buying price must be a valid number greater than or equal to 0.");
      return;
    }

    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      toast.error("Selling price must be a valid number greater than or equal to 0.");
      return;
    }

    if (sellingPrice < buyingPrice) {
      toast.error("Selling price cannot be lower than buying price.");
      return;
    }

    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      toast.error("Stock quantity must be a whole number greater than or equal to 0.");
      return;
    }

    if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
      toast.error("Low stock threshold must be a whole number greater than or equal to 0.");
      return;
    }

    if (form.expiry_date && form.date_of_purchase && form.date_of_purchase > form.expiry_date) {
      toast.error("Date of purchase cannot be after expiry date.");
      return;
    }

    const payload = {
      name: trimmedName,
      serial_number: trimmedSerial || null,
      expiry_date: form.expiry_date || null,
      date_of_purchase: form.date_of_purchase || null,
      buying_price: buyingPrice,
      selling_price: sellingPrice,
      low_stock_threshold: lowStockThreshold,
    };

    setSavingDrug(true);
    if (editingDrug) {
      const { error } = await supabase.from("drugs").update(payload).eq("id", editingDrug.id);
      if (error) { setSavingDrug(false); toast.error(error.message); return; }
      await logAudit("Updated drug", `Updated ${form.name}`);
      toast.success("Batch details updated.");
    } else {
      const { error } = await supabase.rpc("add_inventory_batch", {
        p_name: trimmedName,
        p_serial_number: trimmedSerial || null,
        p_expiry_date: form.expiry_date || null,
        p_date_of_purchase: form.date_of_purchase || null,
        p_buying_price: buyingPrice,
        p_selling_price: sellingPrice,
        p_stock_quantity: stockQuantity,
        p_low_stock_threshold: lowStockThreshold,
        p_reason: form.movement_reason.trim(),
      });
      if (error) { setSavingDrug(false); toast.error(error.message); return; }
      await logAudit("Received inventory batch", `Added batch ${trimmedSerial || "without a batch number"} of ${trimmedName} (${stockQuantity} units).`);
      toast.success(`New ${trimmedName} batch added. Existing batches were kept separate.`);
      setExpandedProducts((current) => ({ ...current, [normalizeSearchText(trimmedName)]: true }));
    }
    setSavingDrug(false);
    setDialogOpen(false);
    resetForm();
    fetchDrugs();
  };

  const requestSensitiveAction = (action: PendingSensitiveAction) => {
    if (!action) return;

    if (isSensitiveAccessVerified()) {
      if (action.type === "edit") {
        openEditDialog(action.drug);
        return;
      }

      if (action.type === "movement") {
        openMovementDialog(action.drug);
        return;
      }

      void performDelete(action.drug);
      return;
    }

    setPendingSensitiveAction(action);
    setPinDialogOpen(true);
  };

  const handleEdit = (drug: Tables<"drugs">) => {
    requestSensitiveAction({ type: "edit", drug });
  };

  const handleDelete = (drug: Tables<"drugs">) => {
    requestSensitiveAction({ type: "delete", drug });
  };

  const openMovementDialog = (drug: Tables<"drugs">) => {
    setMovementDrug(drug);
    setMovementType("delivery");
    setMovementQuantity("1");
    setMovementReason("");
    setMovementDialogOpen(true);
  };

  const handleStockAction = (drug: Tables<"drugs">) => {
    if (role !== "admin") {
      openMovementDialog(drug);
      return;
    }
    requestSensitiveAction({ type: "movement", drug });
  };

  const submitStockMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementDrug) return;

    const quantity = Number(movementQuantity);
    if (!Number.isInteger(quantity) || quantity === 0) {
      toast.error("Enter a non-zero whole-number quantity.");
      return;
    }
    if (movementType !== "correction" && quantity < 1) {
      toast.error("Enter a positive quantity for deliveries and write-offs.");
      return;
    }
    if (movementReason.trim().length < 3) {
      toast.error("Add a short reason for this stock movement.");
      return;
    }

    setSavingMovement(true);
    const { error } = await supabase.rpc("record_inventory_stock_change", {
      p_drug_id: movementDrug.id,
      p_movement_type: movementType,
      p_quantity: quantity,
      p_reason: movementReason.trim(),
    });
    setSavingMovement(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const actionLabel = movementType === "delivery" ? "Received" : movementType === "write_off" ? "Written off" : "Corrected";
    await logAudit(`Inventory ${movementType.replace("_", " ")}`, `${actionLabel} ${quantity} unit(s) of ${movementDrug.name}, batch ${movementDrug.serial_number || "-"}. Reason: ${movementReason.trim()}`);
    toast.success("Stock movement recorded.");
    setMovementDialogOpen(false);
    fetchDrugs();
  };

  const openMovementHistory = async (drug: Tables<"drugs"> | null = null) => {
    setHistoryDrug(drug);
    setMovementHistory([]);
    setHistoryDialogOpen(true);
    if (!clinicOwnerId) return;

    setLoadingHistory(true);
    let query = supabase
      .from("inventory_movements")
      .select("*")
      .eq("user_id", clinicOwnerId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (drug) query = query.eq("drug_id", drug.id);

    const { data, error } = await query;
    setLoadingHistory(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMovementHistory(data ?? []);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedInventorySearch(inventorySearch),
      INVENTORY_SUGGESTION_DEBOUNCE_MS
    );
    return () => window.clearTimeout(timeoutId);
  }, [inventorySearch]);

  const normalizedInventorySearch = normalizeSearchText(debouncedInventorySearch);
  const inventorySuggestions = useMemo(() => {
    if (!normalizedInventorySearch || normalizedInventorySearch.length < INVENTORY_SUGGESTION_MIN_CHARS) return [];

    const queryTerms = normalizedInventorySearch.split(" ").filter(Boolean);

    return drugs
      .filter((drug) => {
        const searchableText = normalizeSearchText([
          drug.name,
          drug.serial_number ?? "",
          drug.expiry_date ?? "",
          drug.date_of_purchase ?? "",
          ...getDateSearchTokens(drug.expiry_date),
          ...getDateSearchTokens(drug.date_of_purchase),
        ].join(" "));

        return queryTerms.every((term) => searchableText.includes(term));
      })
      .slice(0, 8);
  }, [drugs, normalizedInventorySearch]);

  const jumpToInventoryDrug = (drug: Tables<"drugs">) => {
    setInventorySearch(drug.name);
    setIsInventorySearchFocused(false);
    setHighlightedDrugId(drug.id);
    setExpandedProducts((current) => ({ ...current, [normalizeSearchText(drug.name)]: true }));

    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedDrugId(null);
      highlightTimeoutRef.current = null;
    }, 2200);

    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const row = inventoryRowRefs.current[drug.id];
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
    }));
  };

  const normalizedCatalogSearch = catalogSearch.trim().toLowerCase();
  const catalogMatches = useMemo(() => {
    if (!normalizedCatalogSearch) return DRUG_CATALOG.slice(0, 8);

    return DRUG_CATALOG.filter((item) => {
      const haystack = [
        item.name,
        item.category,
        ...item.commonForms,
      ].join(" ").toLowerCase();

      return haystack.includes(normalizedCatalogSearch);
    }).slice(0, 12);
  }, [normalizedCatalogSearch]);

  const groupedProducts = useMemo(() => {
    const groups = new Map<string, Tables<"drugs">[]>();
    drugs.forEach((drug) => {
      const key = normalizeSearchText(drug.name);
      const batches = groups.get(key) ?? [];
      batches.push(drug);
      groups.set(key, batches);
    });

    return Array.from(groups.entries())
      .map(([key, batches]) => ({
        key,
        name: batches[0]?.name ?? "",
        batches: [...batches].sort((a, b) => {
          if (!a.expiry_date) return b.expiry_date ? 1 : 0;
          if (!b.expiry_date) return -1;
          return a.expiry_date.localeCompare(b.expiry_date);
        }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [drugs]);

  const handleVerifySensitiveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingSensitiveAction) return;

    setVerifyingPin(true);
    const { error } = hasOwnerSecurityPin
      ? await verifySensitiveAccess(pin)
      : await setOwnerSecurityPin(pin);
    setVerifyingPin(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(hasOwnerSecurityPin ? "Owner access verified." : "Security PIN created and owner access unlocked.");

    const action = pendingSensitiveAction;
    setPinDialogOpen(false);
    resetPinDialog();

    if (action.type === "edit") {
      openEditDialog(action.drug);
      return;
    }

    if (action.type === "movement") {
      openMovementDialog(action.drug);
      return;
    }

    await performDelete(action.drug);
  };

  const getStockBadge = (drug: Tables<"drugs">) => {
    const usableStock = getSellableStockQuantity(drug);
    if (isExpiredDrug(drug) && drug.stock_quantity > 0) return <Badge variant="destructive">DEDUCTED</Badge>;
    if (usableStock === 0) return <Badge variant="destructive">OUT OF STOCK</Badge>;
    if (usableStock <= drug.low_stock_threshold) return <Badge className="bg-yellow-500 text-yellow-950">LOW STOCK</Badge>;
    return <Badge className="bg-green-500 text-green-950">In Stock</Badge>;
  };

  const getExpiryBadge = (drug: Tables<"drugs">) => {
    if (!drug.expiry_date) return <Badge variant="outline">No Expiry</Badge>;
    if (isExpiredDrug(drug)) return <Badge variant="destructive">EXPIRED</Badge>;
    if (isExpiringSoonDrug(drug)) return <Badge className="bg-amber-500 text-amber-950">{getExpiryLabel(drug).toUpperCase()}</Badge>;
    return <Badge className="bg-sky-500 text-sky-950">{getExpiryLabel(drug).toUpperCase()}</Badge>;
  };

  const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString() : "-";
  const pinSetupInvalid = !hasOwnerSecurityPin && (pin.length < 4 || pin !== confirmPin);
  const sensitiveActionLabel = pendingSensitiveAction?.type === "delete"
    ? "delete this batch"
    : pendingSensitiveAction?.type === "movement"
      ? "record a stock movement"
      : "edit this batch";

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold">Inventory</h2>
          <div className="flex flex-wrap gap-2">
            <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => exportToCSV(drugs.map(d => ({ Name: d.name, "Serial Number": d.serial_number ?? "", "Expiry Date": d.expiry_date ?? "", "Date of Purchase": d.date_of_purchase ?? "", "Buying Price": d.buying_price, "Selling Price": d.selling_price, "Usable Stock": getSellableStockQuantity(d), "Physical Stock": d.stock_quantity, "Expired Stock Loss": getExpiredStockCostLoss(d) })), "drugs-report")}>
              <Download className="mr-2 h-4 w-4" />CSV
            </Button>
            <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => openMovementHistory()}>
              <History className="mr-2 h-4 w-4" />Stock History
            </Button>
            <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => setInvoiceImportOpen(true)}>
              <Search className="mr-2 h-4 w-4" />Scan Invoice
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto" size="sm" onClick={() => openAddDialog()}><PackagePlus className="mr-2 h-4 w-4" />Receive New Batch</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingDrug ? "Edit Batch Details" : "Receive a New Batch"}</DialogTitle>
                  {!editingDrug && (
                    <DialogDescription>
                      Each delivery is saved as its own batch. You can use the same product name again without replacing existing stock.
                    </DialogDescription>
                  )}
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Product Name</Label>
                    <Input list="inventory-product-names" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} required />
                    <datalist id="inventory-product-names">
                      {Array.from(new Set(drugs.map((drug) => drug.name))).map((name) => <option key={name} value={name} />)}
                    </datalist>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div><Label>Batch / Lot Number</Label><Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} placeholder="Optional batch or lot number" /></div>
                    <div><Label>Expiry Date</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
                  </div>
                  <div><Label>Date of Purchase</Label><Input type="date" value={form.date_of_purchase} onChange={(e) => setForm({ ...form, date_of_purchase: e.target.value })} /></div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div><Label>Buying Price (KSh)</Label><Input type="number" step="0.01" min="0" value={form.buying_price} onChange={(e) => setForm({ ...form, buying_price: e.target.value })} required /></div>
                    <div><Label>Selling Price (KSh)</Label><Input type="number" step="0.01" min="0" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} required /></div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {!editingDrug && (
                      <div><Label>Received Quantity</Label><Input type="number" step="1" min="0" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} required /></div>
                    )}
                    <div><Label>Low Stock Threshold</Label><Input type="number" step="1" min="0" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} required /></div>
                  </div>
                  {!editingDrug ? (
                    <div>
                      <Label>Delivery / Opening Stock Note</Label>
                      <Input value={form.movement_reason} onChange={(e) => setForm({ ...form, movement_reason: e.target.value })} maxLength={240} required />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Stock is changed from the batch actions so every delivery, correction, or write-off is recorded.</p>
                  )}
                  <Button type="submit" className="w-full" disabled={savingDrug}>{savingDrug ? "Saving..." : editingDrug ? "Save Batch Details" : "Save New Batch"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-4 w-4" />
                Find Inventory Item
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Input
                  value={inventorySearch}
                  onFocus={() => setIsInventorySearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setIsInventorySearchFocused(false), 120)}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  placeholder="Search stock by drug name, batch, or date"
                />
                {isInventorySearchFocused && inventorySearch.trim() && (
                  <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-md border bg-background shadow-md">
                    {normalizedInventorySearch.length < INVENTORY_SUGGESTION_MIN_CHARS ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        Type at least {INVENTORY_SUGGESTION_MIN_CHARS} characters to see suggestions.
                      </p>
                    ) : inventorySuggestions.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No matching inventory suggestions.</p>
                    ) : (
                      inventorySuggestions.map((drug) => (
                        <button
                          key={drug.id}
                          type="button"
                          onClick={() => jumpToInventoryDrug(drug)}
                          className="block w-full border-b px-3 py-2 text-left transition last:border-b-0 hover:bg-accent/50"
                        >
                          <p className="truncate text-sm font-medium">{drug.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {drug.serial_number || "No serial"} | Expiry: {formatDate(drug.expiry_date)} | Stock: {drug.stock_quantity}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Suggestions help you jump directly to an item row. The full inventory list below stays unchanged.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListPlus className="h-4 w-4" />
                Drug Catalog Helper
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search a drug name to prefill a new stock item"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {catalogMatches.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => openAddDialog(item)}
                    className="rounded-md border bg-background p-3 text-left transition hover:border-primary/40 hover:bg-accent/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.name}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{item.category}</p>
                      </div>
                      <Plus className="h-4 w-4 shrink-0 text-primary" />
                    </div>
                    <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
                      {item.commonForms.join(", ")}
                    </p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Catalog picks are only a name helper. Each saved entry is a separate inventory batch.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="overflow-x-auto p-0">
            {inventoryLoadError && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4" role="alert">
                <p className="text-sm text-destructive">{inventoryLoadError}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void fetchDrugs()}>
                  Retry inventory
                </Button>
              </div>
            )}
            {loading ? (
              <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
            ) : drugs.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No products yet. Click "Receive New Batch" to get started.</div>
            ) : (
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Batches</TableHead>
                    <TableHead>Usable Stock</TableHead>
                    <TableHead>Physical Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedProducts.map((product) => {
                    const expanded = Boolean(expandedProducts[product.key]);
                    const usableStock = product.batches.reduce((total, batch) => total + getSellableStockQuantity(batch), 0);
                    const physicalStock = product.batches.reduce((total, batch) => total + batch.stock_quantity, 0);
                    const lowStockBatches = product.batches.filter((batch) => {
                      const usable = getSellableStockQuantity(batch);
                      return usable > 0 && usable <= batch.low_stock_threshold;
                    }).length;
                    const expiredBatches = product.batches.filter((batch) => isExpiredDrug(batch) && batch.stock_quantity > 0).length;

                    return (
                      <Fragment key={product.key}>
                        <TableRow>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="border-blue-200 bg-blue-50/50 text-orange-500 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600"
                                aria-label={`${expanded ? "Collapse" : "Expand"} ${product.name} batches`}
                                aria-expanded={expanded}
                                onClick={() => setExpandedProducts((current) => ({ ...current, [product.key]: !current[product.key] }))}
                              >
                                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </Button>
                              <span className="font-medium">{product.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{product.batches.length}</TableCell>
                          <TableCell className="font-medium">{usableStock}</TableCell>
                          <TableCell>{physicalStock}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              {usableStock > 0 && lowStockBatches === 0 && <Badge className="bg-green-500 text-green-950">In Stock</Badge>}
                              {lowStockBatches > 0 && <Badge className="bg-yellow-500 text-yellow-950">{lowStockBatches} low batch{lowStockBatches === 1 ? "" : "es"}</Badge>}
                              {expiredBatches > 0 && <Badge variant="destructive">{expiredBatches} expired</Badge>}
                              {usableStock === 0 && physicalStock === 0 && <Badge variant="destructive">OUT OF STOCK</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAddDialog(undefined, product.name)}
                              aria-label={`Receive another ${product.name} batch`}
                            >
                              <PackagePlus className="mr-2 h-4 w-4" />Add Batch
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expanded && (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted/30 p-3">
                              <Table className="min-w-[900px] bg-background">
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Batch / Lot</TableHead>
                                    <TableHead>Purchase Date</TableHead>
                                    <TableHead>Expiry Date</TableHead>
                                    <TableHead>Buy Price</TableHead>
                                    <TableHead>Sell Price</TableHead>
                                    <TableHead>Usable</TableHead>
                                    <TableHead>Physical</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Batch Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {product.batches.map((batch) => (
                                    <TableRow
                                      key={batch.id}
                                      ref={(row) => {
                                        inventoryRowRefs.current[batch.id] = row;
                                      }}
                                      className={highlightedDrugId === batch.id ? "bg-accent/50 transition-colors" : undefined}
                                    >
                                      <TableCell className="font-medium">{batch.serial_number || "No batch number"}</TableCell>
                                      <TableCell>{formatDate(batch.date_of_purchase)}</TableCell>
                                      <TableCell>{formatDate(batch.expiry_date)}</TableCell>
                                      <TableCell>KSh {Number(batch.buying_price).toLocaleString()}</TableCell>
                                      <TableCell>KSh {Number(batch.selling_price).toLocaleString()}</TableCell>
                                      <TableCell>{getSellableStockQuantity(batch)}</TableCell>
                                      <TableCell>{batch.stock_quantity}</TableCell>
                                      <TableCell><div className="flex flex-wrap gap-2">{getStockBadge(batch)}{getExpiryBadge(batch)}</div></TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                          <Button variant="ghost" size="icon" title="View batch movement history" aria-label={`Movement history for ${product.name}, batch ${batch.serial_number || "without batch number"}`} onClick={() => openMovementHistory(batch)}><History className="h-4 w-4" /></Button>
                                          <Button variant="ghost" size="icon" title="Receive, correct, or write off this batch" aria-label={`Stock actions for ${product.name}, batch ${batch.serial_number || "without batch number"}`} onClick={() => handleStockAction(batch)}><PackagePlus className="h-4 w-4" /></Button>
                                          <Button variant="ghost" size="icon" title="Edit batch details" aria-label={`Edit ${product.name} batch ${batch.serial_number || "without batch number"}`} onClick={() => handleEdit(batch)}><Pencil className="h-4 w-4" /></Button>
                                          <Button variant="ghost" size="icon" title="Delete empty batch" aria-label={`Delete ${product.name} batch ${batch.serial_number || "without batch number"}`} onClick={() => handleDelete(batch)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      <InvoiceBatchImportDialog
        open={invoiceImportOpen}
        onOpenChange={setInvoiceImportOpen}
        inventory={drugs}
        onSaved={(batchCount) => {
          void logAudit("Imported inventory invoice", `Added ${batchCount} inventory batch${batchCount === 1 ? "" : "es"} from an invoice.`);
          void fetchDrugs();
        }}
      />
      <Dialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Stock Movement</DialogTitle>
            <DialogDescription>
              {movementDrug && `${movementDrug.name} · Batch ${movementDrug.serial_number || "without a batch number"} · Current stock: ${movementDrug.stock_quantity}`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitStockMovement} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inventory-movement-type">Movement</Label>
              <select
                id="inventory-movement-type"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={movementType}
                onChange={(e) => {
                  setMovementType(e.target.value as InventoryMovementType);
                  setMovementQuantity("1");
                }}
              >
                <option value="delivery">Receive more of this batch</option>
                <option value="correction">Correct stock count (+ or −)</option>
                <option value="write_off">Write off stock</option>
              </select>
              <p className="text-xs text-muted-foreground">
                To receive a different lot, use “Receive New Batch” so its batch number and expiry stay separate.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inventory-movement-quantity">
                {movementType === "correction" ? "Quantity change (+/- units)" : "Quantity"}
              </Label>
              <Input
                id="inventory-movement-quantity"
                type="number"
                step="1"
                min={movementType === "correction" ? undefined : 1}
                value={movementQuantity}
                onChange={(e) => setMovementQuantity(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inventory-movement-reason">Reason / reference</Label>
              <Input
                id="inventory-movement-reason"
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                placeholder={movementType === "delivery" ? "Supplier delivery or receipt number" : movementType === "write_off" ? "Expired, damaged, or other reason" : "Stock count correction reason"}
                maxLength={240}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMovementDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={savingMovement}>{savingMovement ? "Saving..." : "Save Movement"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{historyDrug ? `${historyDrug.name} Batch History` : "Inventory Movement History"}</DialogTitle>
            <DialogDescription>
              {historyDrug ? `Batch ${historyDrug.serial_number || "without a batch number"}` : "Recent receipts, corrections, write-offs, and sales. Showing up to 200 records."}
            </DialogDescription>
          </DialogHeader>
          {loadingHistory ? (
            <div className="flex h-28 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" /></div>
          ) : movementHistory.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No stock movements recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[840px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product / Batch</TableHead>
                    <TableHead>Movement</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Before → After</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Recorded By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movementHistory.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="whitespace-nowrap">{new Date(movement.created_at).toLocaleString()}</TableCell>
                      <TableCell>{movement.product_name}<div className="text-xs text-muted-foreground">{movement.batch_number || "No batch number"}</div></TableCell>
                      <TableCell className="capitalize">{movement.movement_type.replace(/_/g, " ")}</TableCell>
                      <TableCell className={movement.quantity_change > 0 ? "font-medium text-green-700" : "font-medium text-red-700"}>{movement.quantity_change > 0 ? `+${movement.quantity_change}` : movement.quantity_change}</TableCell>
                      <TableCell>{movement.quantity_before} → {movement.quantity_after}</TableCell>
                      <TableCell className="max-w-[240px] whitespace-normal">{movement.reason || "-"}</TableCell>
                      <TableCell>{movement.created_by_name || (movement.created_by ? movement.created_by.slice(0, 8) : "Opening balance")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={pinDialogOpen}
        onOpenChange={(open) => {
          setPinDialogOpen(open);
          if (!open) {
            resetPinDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{hasOwnerSecurityPin ? "Enter Owner Security PIN" : "Create Owner Security PIN"}</DialogTitle>
            <DialogDescription>
              {hasOwnerSecurityPin
                ? `Enter the owner Security PIN to ${sensitiveActionLabel}.`
                : `Create a 4 to 6 digit owner Security PIN before you can ${sensitiveActionLabel}. Adding new inventory remains open.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleVerifySensitiveAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inventory-owner-pin">Owner Security PIN</Label>
              <PasswordInput
                id="inventory-owner-pin"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 4 to 6 digits"
                required
              />
            </div>
            {!hasOwnerSecurityPin && (
              <div className="space-y-2">
                <Label htmlFor="inventory-owner-pin-confirm">Confirm Security PIN</Label>
                <PasswordInput
                  id="inventory-owner-pin-confirm"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Re-enter Security PIN"
                  required
                />
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={verifyingPin || pinSetupInvalid}>
                {verifyingPin ? "Verifying..." : hasOwnerSecurityPin ? "Unlock Action" : "Save PIN"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default DrugsPage;
