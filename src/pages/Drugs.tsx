import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAudit } from "@/lib/audit";
import { exportToCSV } from "@/lib/csv-export";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { getExpiredStockCostLoss, getExpiryLabel, getSellableStockQuantity, isExpiredDrug, isExpiringSoonDrug } from "@/lib/inventory";

const emptyDrugForm = {
  name: "",
  serial_number: "",
  expiry_date: "",
  date_of_purchase: "",
  buying_price: "",
  selling_price: "",
  stock_quantity: "",
  low_stock_threshold: "10",
};

type PendingSensitiveAction =
  | { type: "edit"; drug: Tables<"drugs"> }
  | { type: "delete"; drug: Tables<"drugs"> }
  | null;

const DrugsPage = () => {
  const {
    user,
    hasOwnerSecurityPin,
    isSensitiveAccessVerified,
    verifySensitiveAccess,
    setOwnerSecurityPin,
  } = useAuth();
  const [drugs, setDrugs] = useState<Tables<"drugs">[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDrug, setEditingDrug] = useState<Tables<"drugs"> | null>(null);
  const [form, setForm] = useState(emptyDrugForm);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [pendingSensitiveAction, setPendingSensitiveAction] = useState<PendingSensitiveAction>(null);

  const fetchDrugs = async () => {
    if (!user) return;
    const { data } = await supabase.from("drugs").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setDrugs(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchDrugs(); }, [user]);

  const resetForm = () => {
    setForm(emptyDrugForm);
    setEditingDrug(null);
  };

  const resetPinDialog = () => {
    setPin("");
    setConfirmPin("");
    setPendingSensitiveAction(null);
  };

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
    });
    setDialogOpen(true);
  };

  const performDelete = async (drug: Tables<"drugs">) => {
    if (!confirm(`Delete "${drug.name}"?`)) return;
    const { error } = await supabase.from("drugs").delete().eq("id", drug.id);
    if (error) { toast.error(error.message); return; }
    await logAudit("Deleted drug", `Deleted ${drug.name}`);
    toast.success("Drug deleted!");
    fetchDrugs();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const payload = {
      user_id: user.id,
      name: form.name,
      serial_number: form.serial_number || null,
      expiry_date: form.expiry_date || null,
      date_of_purchase: form.date_of_purchase || null,
      buying_price: parseFloat(form.buying_price),
      selling_price: parseFloat(form.selling_price),
      stock_quantity: parseInt(form.stock_quantity),
      low_stock_threshold: parseInt(form.low_stock_threshold),
    };

    if (editingDrug) {
      const { error } = await supabase.from("drugs").update(payload).eq("id", editingDrug.id);
      if (error) { toast.error(error.message); return; }
      await logAudit("Updated drug", `Updated ${form.name}`);
      toast.success("Drug updated!");
    } else {
      const { error } = await supabase.from("drugs").insert(payload);
      if (error) { toast.error(error.message); return; }
      await logAudit("Added drug", `Added ${form.name}`);
      toast.success("Drug added!");
    }
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
    return <Badge className="bg-sky-500 text-sky-950">VALID</Badge>;
  };

  const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString() : "-";
  const pinSetupInvalid = !hasOwnerSecurityPin && (pin.length < 4 || pin !== confirmPin);
  const sensitiveActionLabel = pendingSensitiveAction?.type === "delete" ? "delete this item" : "edit this item";

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold">Inventory</h2>
          <div className="flex flex-wrap gap-2">
            <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => exportToCSV(drugs.map(d => ({ Name: d.name, "Serial Number": d.serial_number ?? "", "Expiry Date": d.expiry_date ?? "", "Date of Purchase": d.date_of_purchase ?? "", "Buying Price": d.buying_price, "Selling Price": d.selling_price, "Usable Stock": getSellableStockQuantity(d), "Physical Stock": d.stock_quantity, "Expired Stock Loss": getExpiredStockCostLoss(d) })), "drugs-report")}>
              <Download className="mr-2 h-4 w-4" />CSV
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto" size="sm"><Plus className="mr-2 h-4 w-4" />Add Item</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingDrug ? "Edit Drug" : "Add New Drug"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div><Label>Serial Number</Label><Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} placeholder="Optional batch or serial" /></div>
                    <div><Label>Expiry Date</Label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
                  </div>
                  <div><Label>Date of Purchase</Label><Input type="date" value={form.date_of_purchase} onChange={(e) => setForm({ ...form, date_of_purchase: e.target.value })} /></div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div><Label>Buying Price (KSh)</Label><Input type="number" step="0.01" value={form.buying_price} onChange={(e) => setForm({ ...form, buying_price: e.target.value })} required /></div>
                    <div><Label>Selling Price (KSh)</Label><Input type="number" step="0.01" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} required /></div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div><Label>Stock Quantity</Label><Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} required /></div>
                    <div><Label>Low Stock Threshold</Label><Input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} required /></div>
                  </div>
                  <Button type="submit" className="w-full">{editingDrug ? "Update" : "Add"} Drug</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardContent className="overflow-x-auto p-0">
            {loading ? (
              <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
            ) : drugs.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No drugs yet. Click "Add Drug" to get started.</div>
            ) : (
              <Table className="min-w-[920px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Serial No.</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Purchased</TableHead>
                    <TableHead>Buy Price</TableHead>
                    <TableHead>Sell Price</TableHead>
                    <TableHead>Usable Stock</TableHead>
                    <TableHead>Physical Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drugs.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell>{d.serial_number || "-"}</TableCell>
                      <TableCell>{formatDate(d.expiry_date)}</TableCell>
                      <TableCell>{formatDate(d.date_of_purchase)}</TableCell>
                      <TableCell>KSh {Number(d.buying_price).toLocaleString()}</TableCell>
                      <TableCell>KSh {Number(d.selling_price).toLocaleString()}</TableCell>
                      <TableCell>{getSellableStockQuantity(d)}</TableCell>
                      <TableCell>{d.stock_quantity}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {getStockBadge(d)}
                          {getExpiryBadge(d)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(d)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(d)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
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
