import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAudit } from "@/lib/audit";
import { exportToCSV } from "@/lib/csv-export";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Download, Plus, Receipt, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { clampPercent, getDiscountedUnitPrice, getMaxDiscountPercentageForDrug, getProtectedUnitPrice } from "@/lib/discounts";
import { getExpiryLabel, isExpiredDrug, isExpiringSoonDrug } from "@/lib/inventory";
import { downloadReceiptPdf } from "@/lib/pdf-receipt";
import { formatClinicDateTime } from "@/lib/reporting";

type BillItem = {
  itemName: string;
  quantity: number;
  discountPercentage: number;
};

type BatchAllocation = {
  drug: Tables<"drugs">;
  quantity: number;
};

type ReceiptLine = {
  itemName: string;
  quantity: number;
  lineTotal: number;
  allocations: BatchAllocation[];
};

type ReceiptData = {
  receiptNumber: string;
  patientName: string;
  clinicName: string;
  createdAt: string;
  total: number;
  lines: ReceiptLine[];
};

type TransactionGroup = {
  key: string;
  createdAt: string;
  patientName: string;
  total: number;
  lines: ReceiptLine[];
};

const BillingPage = () => {
  const { user, profile, clinicOwnerId } = useAuth();
  const [patients, setPatients] = useState<Tables<"patients">[]>([]);
  const [drugs, setDrugs] = useState<Tables<"drugs">[]>([]);
  const [transactions, setTransactions] = useState<Tables<"transactions">[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedDrug, setSelectedDrug] = useState("");
  const [drugPickerOpen, setDrugPickerOpen] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [discountPercentage, setDiscountPercentage] = useState("0");
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [latestReceipt, setLatestReceipt] = useState<ReceiptData | null>(null);
  const [maximumDiscountPercentage, setMaximumDiscountPercentage] = useState(
    String(profile?.minimum_profit_retention_percentage ?? 0)
  );

  const fetchAll = async () => {
    if (!clinicOwnerId) return;
    const [pRes, dRes, tRes] = await Promise.all([
      supabase.from("patients").select("*").eq("user_id", clinicOwnerId),
      supabase.from("drugs").select("*").eq("user_id", clinicOwnerId),
      supabase.from("transactions").select("*").eq("user_id", clinicOwnerId).order("date", { ascending: false }),
    ]);
    setPatients(pRes.data ?? []);
    setDrugs(dRes.data ?? []);
    setTransactions(tRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [clinicOwnerId]);
  useEffect(() => {
    setMaximumDiscountPercentage(String(profile?.minimum_profit_retention_percentage ?? 0));
  }, [profile?.minimum_profit_retention_percentage]);

  const availableDrugs = drugs.filter((d) => d.stock_quantity > 0);
  const billReservedByItem = billItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.itemName] = (acc[item.itemName] ?? 0) + item.quantity;
    return acc;
  }, {});

  const getBatchSortValue = (drug: Tables<"drugs">) => {
    if (drug.expiry_date) return new Date(drug.expiry_date).getTime();
    if (drug.date_of_purchase) return new Date(drug.date_of_purchase).getTime();
    return Number.MAX_SAFE_INTEGER;
  };

  const validBatches = availableDrugs
    .filter((d) => !isExpiredDrug(d))
    .sort((a, b) => {
      const expiryCompare = getBatchSortValue(a) - getBatchSortValue(b);
      if (expiryCompare !== 0) return expiryCompare;
      return a.name.localeCompare(b.name);
    });

  const itemSummaries = Object.values(
    validBatches.reduce<Record<string, {
      itemName: string;
      totalStock: number;
      nextExpiry: string | null;
      serials: string[];
      batches: Tables<"drugs">[];
    }>>((acc, drug) => {
      const existing = acc[drug.name];
      if (existing) {
        existing.totalStock += drug.stock_quantity;
        existing.batches.push(drug);
        if (drug.serial_number) existing.serials.push(drug.serial_number);
        if (!existing.nextExpiry || (drug.expiry_date && new Date(drug.expiry_date) < new Date(existing.nextExpiry))) {
          existing.nextExpiry = drug.expiry_date;
        }
      } else {
        acc[drug.name] = {
          itemName: drug.name,
          totalStock: drug.stock_quantity,
          nextExpiry: drug.expiry_date,
          serials: drug.serial_number ? [drug.serial_number] : [],
          batches: [drug],
        };
      }

      return acc;
    }, {})
  ).sort((a, b) => a.itemName.localeCompare(b.itemName));

  const selectedItemSummary = itemSummaries.find((item) => item.itemName === selectedDrug);
  const draftQuantity = parseInt(quantity || "0", 10);
  const configuredMaximumDiscountPercentage = clampPercent(
    parseFloat(maximumDiscountPercentage || "0")
  );

  const getDrugById = (drugId: string) => drugs.find((drug) => drug.id === drugId);
  const getPatientById = (patientId: string | null) => patients.find((patient) => patient.id === patientId);
  const selectedPatientData = patients.find((patient) => patient.id === selectedPatient);

  const getRemainingStock = (itemName: string) => {
    const summary = itemSummaries.find((item) => item.itemName === itemName);
    if (!summary) return 0;
    return Math.max(summary.totalStock - (billReservedByItem[itemName] ?? 0), 0);
  };

  const getBatchAllocations = (itemName: string, quantityNeeded: number): BatchAllocation[] | null => {
    const matchingBatches = validBatches.filter((drug) => drug.name === itemName);
    let remaining = quantityNeeded;
    const allocations: BatchAllocation[] = [];

    for (const batch of matchingBatches) {
      if (remaining <= 0) break;
      const quantityFromBatch = Math.min(batch.stock_quantity, remaining);
      if (quantityFromBatch > 0) {
        allocations.push({ drug: batch, quantity: quantityFromBatch });
        remaining -= quantityFromBatch;
      }
    }

    return remaining > 0 ? null : allocations;
  };

  const getMaxDiscountPercentageForItem = (itemName: string, quantityNeeded: number) => {
    const allocations = getBatchAllocations(itemName, quantityNeeded);
    if (!allocations || allocations.length === 0) return 0;

    return Math.min(
        ...allocations.map((allocation) =>
        getMaxDiscountPercentageForDrug(allocation.drug, configuredMaximumDiscountPercentage)
      )
    );
  };

  const buildDiscountedAllocations = (itemName: string, quantityNeeded: number, requestedDiscountPercentage: number) => {
    const allocations = getBatchAllocations(itemName, quantityNeeded);
    if (!allocations) return null;

    const maxAllowedDiscountPercentage = getMaxDiscountPercentageForItem(itemName, quantityNeeded);
    const appliedDiscountPercentage = Math.min(clampPercent(requestedDiscountPercentage), maxAllowedDiscountPercentage);

    return {
      allocations,
      maxAllowedDiscountPercentage,
      appliedDiscountPercentage,
      pricedAllocations: allocations.map((allocation) => {
        const discountedUnitPrice = getDiscountedUnitPrice(
          allocation.drug,
          configuredMaximumDiscountPercentage,
          appliedDiscountPercentage
        );
        const protectedUnitPrice = getProtectedUnitPrice(
          allocation.drug,
          configuredMaximumDiscountPercentage
        );

        return {
          ...allocation,
          discountedUnitPrice,
          protectedUnitPrice,
          lineTotal: discountedUnitPrice * allocation.quantity,
        };
      }),
    };
  };

  const draftDiscountPercentage = clampPercent(parseFloat(discountPercentage || "0"));
  const draftPricing = selectedItemSummary ? buildDiscountedAllocations(selectedItemSummary.itemName, draftQuantity, draftDiscountPercentage) : null;
  const draftLineTotal = draftPricing
    ? draftPricing.pricedAllocations.reduce((sum, allocation) => sum + allocation.lineTotal, 0)
    : 0;

  const billTotal = billItems.reduce((sum, item) => {
    const pricing = buildDiscountedAllocations(item.itemName, item.quantity, item.discountPercentage);
    return pricing
      ? sum + pricing.pricedAllocations.reduce((lineSum, allocation) => lineSum + allocation.lineTotal, 0)
      : sum;
  }, 0);

  const addItemToBill = () => {
    if (!selectedItemSummary) {
      toast.error("Select an item first");
      return;
    }

    if (!Number.isInteger(draftQuantity) || draftQuantity <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }

    const remainingStock = getRemainingStock(selectedItemSummary.itemName);
    if (draftQuantity > remainingStock) {
      toast.error(`Only ${remainingStock} item(s) remaining for ${selectedItemSummary.itemName}`);
      return;
    }

    const maxAllowedDiscountPercentage = getMaxDiscountPercentageForItem(selectedItemSummary.itemName, draftQuantity);
    const appliedDiscountPercentage = Math.min(draftDiscountPercentage, maxAllowedDiscountPercentage);

    setBillItems((current) => {
      const existingItem = current.find((item) => item.itemName === selectedItemSummary.itemName);
      if (existingItem) {
        return current.map((item) =>
          item.itemName === selectedItemSummary.itemName
            ? {
                ...item,
                quantity: item.quantity + draftQuantity,
                discountPercentage: Math.min(item.discountPercentage, getMaxDiscountPercentageForItem(item.itemName, item.quantity + draftQuantity)),
              }
            : item
        );
      }

      return [...current, {
        itemName: selectedItemSummary.itemName,
        quantity: draftQuantity,
        discountPercentage: appliedDiscountPercentage,
      }];
    });

    toast.success(`${selectedItemSummary.itemName} added to bill`);
    setSelectedDrug("");
    setQuantity("1");
    setDiscountPercentage("0");
  };

  const updateBillItemQuantity = (itemName: string, nextValue: string) => {
    const nextQuantity = parseInt(nextValue || "0", 10);
    if (!Number.isInteger(nextQuantity) || nextQuantity <= 0) {
      setBillItems((current) => current.filter((item) => item.itemName !== itemName));
      return;
    }

    const currentLineQuantity = billItems.find((item) => item.itemName === itemName)?.quantity ?? 0;
    const availableStock = itemSummaries.find((item) => item.itemName === itemName)?.totalStock ?? 0;
    const maxAllowed = availableStock - ((billReservedByItem[itemName] ?? 0) - currentLineQuantity);

    if (nextQuantity > maxAllowed) {
      toast.error(`Only ${maxAllowed} item(s) available for this line`);
      return;
    }

    setBillItems((current) =>
      current.map((item) =>
        item.itemName === itemName
          ? {
              ...item,
              quantity: nextQuantity,
              discountPercentage: Math.min(item.discountPercentage, getMaxDiscountPercentageForItem(itemName, nextQuantity)),
            }
          : item
      )
    );
  };

  const updateBillItemDiscount = (itemName: string, nextValue: string) => {
    const requestedDiscountPercentage = clampPercent(parseFloat(nextValue || "0"));

    setBillItems((current) =>
      current.map((item) => {
        if (item.itemName !== itemName) return item;
        return {
          ...item,
          discountPercentage: Math.min(requestedDiscountPercentage, getMaxDiscountPercentageForItem(itemName, item.quantity)),
        };
      })
    );
  };

  const removeBillItem = (itemName: string) => {
    setBillItems((current) => current.filter((item) => item.itemName !== itemName));
  };

  const buildReceiptMarkup = (receipt: ReceiptData) => {
    const rows = receipt.lines.map((line) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${line.itemName}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${line.allocations.map((allocation) => `${allocation.drug.serial_number || "Batch"} x${allocation.quantity}`).join(", ")}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${line.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">KSh ${line.lineTotal.toLocaleString()}</td>
      </tr>
    `).join("");

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Receipt ${receipt.receiptNumber}</title>
  </head>
  <body style="font-family: Arial, sans-serif; padding: 24px; color: #111827;">
    <div style="max-width: 760px; margin: 0 auto;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px;">
        <div>
          <h1 style="margin:0 0 8px; font-size:24px;">${receipt.clinicName}</h1>
          <div style="color:#4b5563;">Billing Receipt</div>
        </div>
        <div style="text-align:right;">
          <div><strong>Receipt:</strong> ${receipt.receiptNumber}</div>
          <div><strong>Date:</strong> ${formatClinicDateTime(receipt.createdAt)}</div>
          <div><strong>Patient:</strong> ${receipt.patientName}</div>
        </div>
      </div>
      <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px; text-align:left;">Item</th>
            <th style="padding:10px; text-align:left;">Batch Used</th>
            <th style="padding:10px; text-align:center;">Qty</th>
            <th style="padding:10px; text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="text-align:right; font-size:20px; font-weight:700;">
        Total: KSh ${receipt.total.toLocaleString()}
      </div>
    </div>
    <script>window.onload = () => { window.print(); };</script>
  </body>
</html>`;
  };

  const handlePrintReceipt = (receipt: ReceiptData) => {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast.error("Unable to open print window");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildReceiptMarkup(receipt));
    printWindow.document.close();
  };

  const handleDownloadReceiptPdf = (receipt: ReceiptData) => {
    downloadReceiptPdf({
      receiptNumber: receipt.receiptNumber,
      patientName: receipt.patientName,
      clinicName: receipt.clinicName,
      createdAt: receipt.createdAt,
      total: receipt.total,
      lines: receipt.lines.map((line) => ({
        itemName: line.itemName,
        quantity: line.quantity,
        lineTotal: line.lineTotal,
        batchSummary: line.allocations.map((allocation) => `${allocation.drug.serial_number || "Batch"} x${allocation.quantity}`).join(", "),
      })),
    });
  };

  const buildReceiptFromGroup = (group: TransactionGroup): ReceiptData => ({
    receiptNumber: `RCPT-${group.key.replace(/[^0-9]/g, "").slice(0, 14) || Date.now()}`,
    patientName: group.patientName,
    clinicName: profile?.clinic_name || "SHALIT AFIA",
    createdAt: group.createdAt,
    total: group.total,
    lines: group.lines,
  });

  const groupedTransactions = Object.values(
    transactions.reduce<Record<string, TransactionGroup>>((acc, transaction) => {
      const key = `${transaction.date}::${transaction.patient_id ?? "walk-in"}`;
      const drug = getDrugById(transaction.drug_id || "");
      const patientName = getPatientById(transaction.patient_id)?.name || "Walk-in Customer";

      if (!acc[key]) {
        acc[key] = {
          key,
          createdAt: transaction.date,
          patientName,
          total: 0,
          lines: [],
        };
      }

      acc[key].total += Number(transaction.total_cost);

      const existingLine = acc[key].lines.find((line) => line.itemName === (drug?.name || "Item"));
      const allocation = drug ? { drug, quantity: transaction.quantity } : null;

      if (existingLine && allocation) {
        existingLine.quantity += transaction.quantity;
        existingLine.lineTotal += Number(transaction.total_cost);
        existingLine.allocations.push(allocation);
      } else {
        acc[key].lines.push({
          itemName: drug?.name || "Item",
          quantity: transaction.quantity,
          lineTotal: Number(transaction.total_cost),
          allocations: allocation ? [allocation] : [],
        });
      }

      return acc;
    }, {})
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (billItems.length === 0) {
      toast.error("Add at least one item to the bill");
      return;
    }

    const invalidItem = billItems.find((item) => !getBatchAllocations(item.itemName, item.quantity));
    if (invalidItem) {
      toast.error(`Not enough valid stock for ${invalidItem.itemName}`);
      return;
    }

    setSubmitting(true);

    const transactionInputs = billItems.flatMap((item) => {
      const pricing = buildDiscountedAllocations(item.itemName, item.quantity, item.discountPercentage);
      return (pricing?.pricedAllocations ?? []).map((allocation) => ({
        drug_id: allocation.drug.id,
        quantity: allocation.quantity,
        unit_selling_price: allocation.discountedUnitPrice,
      }));
    });

    const { data: recordedRows, error: txErr } = await supabase.rpc("record_sale", {
      p_patient_id: selectedPatient || null,
      p_items: transactionInputs,
      p_recorded_at: new Date().toISOString(),
    });
    if (txErr || !recordedRows || recordedRows.length === 0) {
      toast.error(txErr?.message || "Failed to record sale");
      setSubmitting(false);
      return;
    }

    const saleDate = recordedRows[0].date;
    const recordedTotal = recordedRows.reduce((sum, row) => sum + Number(row.total_cost), 0);

    const summary = billItems
      .map((item) => `${item.itemName} x${item.quantity}`)
      .join(", ");

    const receiptLines: ReceiptLine[] = billItems.map((item) => {
      const allocations = buildDiscountedAllocations(item.itemName, item.quantity, item.discountPercentage)?.allocations ?? [];
      return {
        itemName: item.itemName,
        quantity: item.quantity,
        lineTotal: allocations.reduce((sum, allocation) => {
          const row = recordedRows.find((entry) => entry.drug_id === allocation.drug.id);
          return sum + Number(row?.total_cost ?? 0);
        }, 0),
        allocations,
      };
    });

    const receipt: ReceiptData = {
      receiptNumber: `RCPT-${Date.now()}`,
      patientName: selectedPatientData?.name || "Walk-in Customer",
      clinicName: profile?.clinic_name || "SHALIT AFIA",
      createdAt: saleDate,
      total: recordedTotal,
      lines: receiptLines,
    };

    await logAudit("Recorded sale", `${summary} = KSh ${recordedTotal}`);
    toast.success(`Bill recorded: KSh ${recordedTotal.toLocaleString()}`);
    setLatestReceipt(receipt);
    setSelectedPatient("");
    setSelectedDrug("");
    setQuantity("1");
    setBillItems([]);
    setSubmitting(false);
    fetchAll();
  };

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <h2 className="text-2xl font-bold">Billing</h2>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              New Bill
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBill} className="space-y-6">
              <div>
                <Label>Patient</Label>
                <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                  <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border p-3 sm:p-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_120px_140px_160px] lg:items-end">
                  <div>
                    <Label>Item</Label>
                    <Popover open={drugPickerOpen} onOpenChange={setDrugPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={drugPickerOpen}
                          className="w-full min-w-0 justify-between font-normal"
                        >
                          <span className="min-w-0 truncate text-left">
                            {selectedItemSummary
                              ? `${selectedItemSummary.itemName} (Stock: ${getRemainingStock(selectedItemSummary.itemName)})`
                              : "Search and select item"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search item or serial number..." />
                          <CommandList>
                            <CommandEmpty>No matching item found.</CommandEmpty>
                            <CommandGroup>
                              {itemSummaries
                                .filter((item) => getRemainingStock(item.itemName) > 0)
                                .map((item) => (
                                  <CommandItem
                                    key={item.itemName}
                                    value={`${item.itemName} ${item.serials.join(" ")} ${item.nextExpiry ?? ""}`}
                                    onSelect={() => {
                                      setSelectedDrug(item.itemName);
                                      setDrugPickerOpen(false);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", selectedDrug === item.itemName ? "opacity-100" : "opacity-0")} />
                                    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                      <span className="truncate">{item.itemName}</span>
                                      <span className="text-xs text-muted-foreground sm:text-right">
                                        Stock: {getRemainingStock(item.itemName)}
                                        {item.serials.length > 0 ? ` | ${item.serials.length} batch(es)` : ""}
                                        {item.nextExpiry ? ` | Next: ${getExpiryLabel(item.batches[0])}` : ""}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      max={selectedItemSummary ? getRemainingStock(selectedItemSummary.itemName) : 999}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Discount (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max={selectedItemSummary ? getMaxDiscountPercentageForItem(selectedItemSummary.itemName, Math.max(draftQuantity, 1)) : 0}
                      step="0.01"
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(e.target.value)}
                    />
                  </div>

                  <Button type="button" onClick={addItemToBill} disabled={!selectedDrug}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>

                {selectedItemSummary && (
                  <div className="mt-4 rounded-md bg-accent p-3">
                    <p className="text-sm text-muted-foreground">Available Stock: {getRemainingStock(selectedItemSummary.itemName)}</p>
                    <p className="text-sm text-muted-foreground">Batches available: {selectedItemSummary.batches.length}</p>
                    {draftPricing && draftPricing.allocations.length > 0 && (
                      <p className={cn("text-sm", isExpiringSoonDrug(draftPricing.allocations[0].drug) ? "text-amber-700 font-medium" : "text-muted-foreground")}>
                        First batch used: {draftPricing.allocations[0].drug.serial_number || draftPricing.allocations[0].drug.name} | {getExpiryLabel(draftPricing.allocations[0].drug)}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Max allowed discount: {selectedItemSummary ? getMaxDiscountPercentageForItem(selectedItemSummary.itemName, Math.max(draftQuantity, 1)).toFixed(2) : "0.00"}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Global discount limit: {configuredMaximumDiscountPercentage.toFixed(2)}%
                    </p>
                    {draftPricing && draftPricing.appliedDiscountPercentage > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Applied discount: {draftPricing.appliedDiscountPercentage.toFixed(2)}%
                      </p>
                    )}
                    <p className="text-lg font-bold">Line Total: KSh {draftLineTotal.toLocaleString()}</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-semibold">Bill Items</h3>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{billItems.length} item(s)</p>
                    <p className="text-xl font-bold">KSh {billTotal.toLocaleString()}</p>
                  </div>
                </div>

                {billItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                    No items added yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {billItems.map((item) => {
                      const pricing = buildDiscountedAllocations(item.itemName, item.quantity, item.discountPercentage);
                      if (!pricing) return null;

                      const lineTotal = pricing.pricedAllocations.reduce((sum, allocation) => sum + allocation.lineTotal, 0);
                      const maxAllowedDiscountPercentage = getMaxDiscountPercentageForItem(item.itemName, item.quantity);

                      return (
                        <div key={item.itemName} className="grid gap-3 rounded-lg border p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_110px_120px_140px_48px] lg:items-center">
                          <div className="min-w-0">
                            <p className="font-medium">{item.itemName}</p>
                            <p className="text-sm text-muted-foreground">
                              {pricing.allocations.map((allocation) => `${allocation.drug.serial_number || "Batch"} x${allocation.quantity}`).join(" | ")}
                            </p>
                          </div>
                          <Input
                            type="number"
                            min="1"
                            max={(itemSummaries.find((summary) => summary.itemName === item.itemName)?.totalStock ?? item.quantity)}
                            value={String(item.quantity)}
                            onChange={(e) => updateBillItemQuantity(item.itemName, e.target.value)}
                          />
                          <Input
                            type="number"
                            min="0"
                            max={maxAllowedDiscountPercentage}
                            step="0.01"
                            value={String(item.discountPercentage)}
                            onChange={(e) => updateBillItemDiscount(item.itemName, e.target.value)}
                          />
                          <div className="font-semibold">KSh {lineTotal.toLocaleString()}</div>
                          <Button type="button" variant="ghost" size="icon" className="justify-self-start lg:justify-self-auto" onClick={() => removeBillItem(item.itemName)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={billItems.length === 0 || submitting}>
                {submitting ? "Processing..." : `Record Bill - KSh ${billTotal.toLocaleString()}`}
              </Button>
            </form>
          </CardContent>
        </Card>

        {latestReceipt && (
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>Latest Receipt</span>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" className="w-full sm:w-auto" variant="outline" onClick={() => handleDownloadReceiptPdf(latestReceipt)}>
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                  <Button type="button" className="w-full sm:w-auto" onClick={() => handlePrintReceipt(latestReceipt)}>
                    <Receipt className="mr-2 h-4 w-4" />
                    Print Receipt
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{latestReceipt.clinicName}</p>
                  <p className="text-sm text-muted-foreground">Receipt No: {latestReceipt.receiptNumber}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Patient: {latestReceipt.patientName}</p>
                  <p>Date: {formatClinicDateTime(latestReceipt.createdAt)}</p>
                </div>
              </div>

              <div className="space-y-3">
                {latestReceipt.lines.map((line) => (
                            <div key={line.itemName} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-medium">{line.itemName}</p>
                      <p className="font-semibold">KSh {line.lineTotal.toLocaleString()}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">Qty: {line.quantity}</p>
                    <p className="text-sm text-muted-foreground">
                      Batches: {line.allocations.map((allocation) => `${allocation.drug.serial_number || "Batch"} x${allocation.quantity}`).join(" | ")}
                    </p>
                  </div>
                ))}
              </div>

              <div className="text-right text-xl font-bold">
                Total: KSh {latestReceipt.total.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-semibold">Billing History</h3>
          <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => exportToCSV(
            transactions.map(t => ({
              Date: new Date(t.date).toLocaleDateString(),
              Item: getDrugById(t.drug_id || "")?.name || "-",
              Batch: getDrugById(t.drug_id || "")?.serial_number || "-",
              Quantity: t.quantity,
              "Total Cost": t.total_cost,
            })), "transactions-report"
          )}>
            <Download className="mr-2 h-4 w-4" />CSV
          </Button>
        </div>
        <Card>
          <CardContent className="overflow-x-auto p-0">
            {loading ? (
              <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
            ) : groupedTransactions.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No transactions yet.</div>
            ) : (
              <Table className="min-w-[960px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="text-right">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedTransactions.map((group) => (
                    <TableRow key={group.key}>
                      <TableCell>{formatClinicDateTime(group.createdAt)}</TableCell>
                      <TableCell>{group.patientName}</TableCell>
                      <TableCell className="max-w-md">
                        <div className="space-y-1">
                          {group.lines.map((line) => (
                            <div key={`${group.key}-${line.itemName}`} className="text-sm">
                              <span className="font-medium">{line.itemName}</span>
                              <span className="text-muted-foreground"> x{line.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">KSh {group.total.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => handleDownloadReceiptPdf(buildReceiptFromGroup(group))}>
                            PDF
                          </Button>
                          <Button type="button" size="sm" onClick={() => handlePrintReceipt(buildReceiptFromGroup(group))}>
                            Print
                          </Button>
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
    </AppLayout>
  );
};

export default BillingPage;
