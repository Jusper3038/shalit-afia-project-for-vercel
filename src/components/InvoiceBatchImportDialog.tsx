import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { getClinicDayKey } from "@/lib/reporting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { AlertTriangle, FileUp, Loader2, ScanLine, Trash2 } from "lucide-react";

type InvoiceBatchDraft = {
  id: string;
  selected: boolean;
  name: string;
  serial_number: string;
  expiry_date: string;
  date_of_purchase: string;
  buying_price: string;
  selling_price: string;
  stock_quantity: string;
  low_stock_threshold: string;
  confidence: "review" | "check";
  source_line: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventory: Tables<"drugs">[];
  onSaved: (batchCount: number) => void;
};

const MAX_FILE_SIZE = 12 * 1024 * 1024;
const MAX_PDF_PAGES = 20;
const MAX_INVOICE_ROWS = 100;

const normalizeName = (value: string) => value.toLowerCase().trim().replace(/\s+/g, " ");

const parseDate = (value: string) => {
  const iso = value.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const local = value.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
  if (local) return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  return "";
};

const getInvoiceDate = (text: string) => {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (/invoice\s*date|date\s*of\s*invoice|\bdated\b/i.test(line)) {
      const date = parseDate(line);
      if (date) return date;
    }
  }
  return "";
};

const parseMoney = (value: string) => {
  const parsed = Number(value.replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const parseInvoiceRows = (text: string, inventory: Tables<"drugs">[]): InvoiceBatchDraft[] => {
  const invoiceDate = getInvoiceDate(text);
  const skippedLine = /^(?:\s*\d+\s*)?(?:total|subtotal|sub total|grand total|tax|vat|balance|amount due|invoice|date|page|discount|delivery|supplier|customer|cash|terms|receipt|item\s+description|description\s+qty)/i;
  const drafts: InvoiceBatchDraft[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const sourceLine = rawLine.replace(/[|¦]/g, " ").replace(/\s+/g, " ").trim();
    if (sourceLine.length < 8 || skippedLine.test(sourceLine)) continue;

    let line = sourceLine;
    const labeledExpiryMatch = line.match(/(?:exp(?:iry)?\s*(?:date)?\s*[:#-]?\s*)(\d{1,2}[-/.]\d{1,2}[-/.]20\d{2}|20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})/i);
    const rowDateMatch = line.match(/\b(?:20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]20\d{2})\b/);
    const expiryDate = labeledExpiryMatch
      ? parseDate(labeledExpiryMatch[1])
      : rowDateMatch ? parseDate(rowDateMatch[0]) : "";
    if (labeledExpiryMatch) line = line.replace(labeledExpiryMatch[0], " ");

    const batchMatch = line.match(/(?:batch|lot)\s*(?:no\.?|number|#)?\s*[:#-]?\s*([a-z0-9/-]{3,})/i);
    const serialNumber = batchMatch?.[1] ?? "";
    if (batchMatch) line = line.replace(batchMatch[0], " ");

    line = line.replace(/\b(?:20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]20\d{2})\b/g, " ");
    const tokens = line.split(/\s+/).filter(Boolean);
    if (tokens.length < 3) continue;

    const trailingNumbers: number[] = [];
    while (tokens.length > 0 && /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(tokens[tokens.length - 1])) {
      const parsed = parseMoney(tokens.pop()!);
      if (parsed === null) break;
      trailingNumbers.unshift(parsed);
      if (trailingNumbers.length === 3) break;
    }
    if (trailingNumbers.length < 2) continue;

    // Most supplier tables end with quantity, unit cost, and line amount.
    const hasLineAmount = trailingNumbers.length >= 3;
    const quantity = hasLineAmount ? trailingNumbers[0] : trailingNumbers[0];
    const buyingPrice = hasLineAmount ? trailingNumbers[1] : trailingNumbers[1];
    if (!Number.isInteger(quantity) || quantity <= 0 || buyingPrice < 0) continue;

    if (tokens.length > 1 && /^\d{1,4}[.)]?$/.test(tokens[0])) tokens.shift();
    const name = tokens.join(" ").replace(/^[\W_]+|[\W_]+$/g, "").trim();
    if (name.length < 2 || /\b(?:qty|quantity|rate|price|amount|total)\b/i.test(name)) continue;

    const key = `${normalizeName(name)}|${serialNumber}|${expiryDate}|${quantity}|${buyingPrice}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const matched = inventory.find((drug) => normalizeName(drug.name) === normalizeName(name));
    const purchaseDate = invoiceDate || new Date().toISOString().slice(0, 10);
    drafts.push({
      id: crypto.randomUUID(),
      selected: true,
      name: matched?.name ?? name,
      serial_number: serialNumber,
      expiry_date: expiryDate,
      date_of_purchase: purchaseDate || getClinicDayKey(new Date()),
      buying_price: String(buyingPrice),
      selling_price: String(matched?.selling_price ?? buyingPrice),
      stock_quantity: String(quantity),
      low_stock_threshold: String(matched?.low_stock_threshold ?? 10),
      confidence: serialNumber || expiryDate ? "check" : "review",
      source_line: sourceLine,
    });
    if (drafts.length >= MAX_INVOICE_ROWS) break;
  }

  return drafts;
};

const renderPdfPages = async (file: File, onPage: (page: number, total: number) => void) => {
  const [{ getDocument, GlobalWorkerOptions }, pdfWorker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  GlobalWorkerOptions.workerSrc = pdfWorker.default;
  const pdf = await getDocument({ data: await file.arrayBuffer() }).promise;
  if (pdf.numPages > MAX_PDF_PAGES) throw new Error(`This PDF has ${pdf.numPages} pages. Split it into files with ${MAX_PDF_PAGES} pages or fewer.`);
  const canvases: HTMLCanvasElement[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    onPage(pageNumber, pdf.numPages);
    const page = await pdf.getPage(pageNumber);
    const original = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 1800 / Math.max(original.width, original.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    canvases.push(canvas);
  }
  return canvases;
};

const renderImage = async (file: File) => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare this image for reading.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
};

const InvoiceBatchImportDialog = ({ open, onOpenChange, inventory, onSaved }: Props) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<InvoiceBatchDraft[]>([]);
  const [invoiceReference, setInvoiceReference] = useState("");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const selectedCount = useMemo(() => rows.filter((row) => row.selected).length, [rows]);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setRows([]);
      setInvoiceReference("");
      setProgress(0);
      setProgressLabel("");
      setScanning(false);
      setSaving(false);
    }
  }, [open]);

  const handleFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles?.length) return;
    const nextFiles = Array.from(selectedFiles);
    if (nextFiles.some((file) => file.size > MAX_FILE_SIZE)) {
      toast.error("Each invoice file must be 12 MB or smaller.");
      return;
    }
    if (nextFiles.some((file) => !file.type.startsWith("image/") && file.type !== "application/pdf")) {
      toast.error("Choose invoice images or PDF files.");
      return;
    }
    if (nextFiles.length > 10) {
      toast.error("Choose up to 10 invoice pages or files at a time.");
      return;
    }
    setFiles(nextFiles);
    setRows([]);
    setInvoiceReference(nextFiles[0].name.replace(/\.[^.]+$/, ""));
  };

  const scanInvoice = async () => {
    if (!files.length) {
      toast.error("Choose an invoice photo or PDF first.");
      return;
    }
    setScanning(true);
    setProgress(0);
    setProgressLabel("Preparing invoice pages…");
    let worker: { recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> } | null = null;
    try {
      const canvases: HTMLCanvasElement[] = [];
      for (const file of files) {
        if (file.type === "application/pdf") {
          const pages = await renderPdfPages(file, (page, total) => setProgressLabel(`Preparing PDF page ${page} of ${total}…`));
          canvases.push(...pages);
        } else {
          canvases.push(await renderImage(file));
        }
      }
      if (canvases.length > MAX_PDF_PAGES) throw new Error(`Choose up to ${MAX_PDF_PAGES} total invoice pages at a time.`);

      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("eng", 1, {
        logger: (message) => {
          if (message.status === "recognizing text" && typeof message.progress === "number") {
            setProgress(Math.round(message.progress * 100));
            setProgressLabel("Reading invoice text on this device…");
          }
        },
      });
      let extractedText = "";
      for (let index = 0; index < canvases.length; index += 1) {
        setProgressLabel(`Reading invoice page ${index + 1} of ${canvases.length}…`);
        const result = await worker.recognize(canvases[index]);
        extractedText += `\n${result.data.text}`;
      }

      const parsedRows = parseInvoiceRows(extractedText, inventory);
      if (!parsedRows.length) {
        toast.error("I couldn't find clear item rows. Try a sharper photo or add batches manually.");
        return;
      }
      setRows(parsedRows);
      toast.success(`Read ${parsedRows.length} possible item${parsedRows.length === 1 ? "" : "s"}. Review every row before saving.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read this invoice.");
    } finally {
      await worker?.terminate();
      setScanning(false);
      setProgressLabel("");
    }
  };

  const updateRow = (id: string, key: keyof InvoiceBatchDraft, value: string | boolean) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [key]: value } : row));
  };

  const saveBatches = async () => {
    const selectedRows = rows.filter((row) => row.selected);
    if (!selectedRows.length) {
      toast.error("Select at least one invoice row to save.");
      return;
    }
    for (const row of selectedRows) {
      const quantity = Number(row.stock_quantity);
      const buying = Number(row.buying_price);
      const selling = Number(row.selling_price);
      const threshold = Number(row.low_stock_threshold);
      if (!row.name.trim() || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(buying) || buying < 0 || !Number.isFinite(selling) || selling < buying || !Number.isInteger(threshold) || threshold < 0) {
        toast.error(`Check product name, quantity, and prices for “${row.name || "unnamed item"}”.`);
        return;
      }
      if (row.expiry_date && row.date_of_purchase && row.date_of_purchase > row.expiry_date) {
        toast.error(`Purchase date is after expiry date for “${row.name}”.`);
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase.rpc("add_inventory_batches", {
      p_batches: selectedRows.map((row) => ({
        name: row.name.trim(),
        serial_number: row.serial_number.trim() || null,
        expiry_date: row.expiry_date || null,
        date_of_purchase: row.date_of_purchase || null,
        buying_price: Number(row.buying_price),
        selling_price: Number(row.selling_price),
        stock_quantity: Number(row.stock_quantity),
        low_stock_threshold: Number(row.low_stock_threshold) || 0,
      })),
      p_reason: `Invoice: ${invoiceReference.trim() || "invoice import"}`,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Saved ${selectedRows.length} invoice item${selectedRows.length === 1 ? "" : "s"} as separate inventory batches.`);
    onSaved(selectedRows.length);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-7xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-primary" />Import batches from invoice</DialogTitle>
          <DialogDescription>
            Select invoice photos or PDFs. Text is read on this device; no invoice is uploaded to an AI service. Check every extracted value before adding stock.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[1fr_260px]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input ref={inputRef} className="hidden" type="file" accept="image/*,application/pdf,.pdf" multiple onChange={(event) => handleFiles(event.target.files)} />
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={scanning || saving}>
                <FileUp className="mr-2 h-4 w-4" />Choose invoice files
              </Button>
              <Button type="button" onClick={scanInvoice} disabled={!files.length || scanning || saving}>
                {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
                {scanning ? "Reading invoice…" : rows.length ? "Read again" : "Read all items"}
              </Button>
              <span className="text-xs text-muted-foreground">Up to 10 files / 20 PDF pages, 12 MB per file</span>
            </div>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((file) => <Badge key={`${file.name}-${file.lastModified}`} variant="secondary">{file.name}</Badge>)}
              </div>
            )}
            {scanning && (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3" aria-live="polite">
                <p className="text-sm">{progressLabel}</p>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${Math.max(progress, 5)}%` }} /></div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice-reference">Invoice number / reference</Label>
            <Input id="invoice-reference" value={invoiceReference} onChange={(event) => setInvoiceReference(event.target.value)} maxLength={200} placeholder="Supplier invoice reference" />
          </div>
        </div>

        {rows.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>OCR guesses may be wrong. Verify product, batch, dates, quantity, and prices; selling price for new products starts at cost.</span></div>
              <span>{selectedCount} of {rows.length} selected</span>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-[1250px]">
                <TableHeader><TableRow>
                  <TableHead className="w-10"><input type="checkbox" checked={selectedCount === rows.length} aria-label="Select all invoice items" onChange={(event) => setRows((current) => current.map((row) => ({ ...row, selected: event.target.checked })))} /></TableHead>
                  <TableHead>Product</TableHead><TableHead>Batch / Lot</TableHead><TableHead>Purchase date</TableHead><TableHead>Expiry date</TableHead><TableHead>Quantity</TableHead><TableHead>Buy price</TableHead><TableHead>Sell price</TableHead><TableHead>Low stock</TableHead><TableHead className="w-16">Review</TableHead><TableHead />
                </TableRow></TableHeader>
                <TableBody>{rows.map((row) => (
                  <TableRow key={row.id} data-state={!row.selected ? "inactive" : undefined}>
                    <TableCell><input type="checkbox" checked={row.selected} aria-label={`Select ${row.name}`} onChange={(event) => updateRow(row.id, "selected", event.target.checked)} /></TableCell>
                    <TableCell><Input aria-label="Product name" value={row.name} onChange={(event) => updateRow(row.id, "name", event.target.value)} maxLength={120} /></TableCell>
                    <TableCell><Input aria-label="Batch or lot number" value={row.serial_number} onChange={(event) => updateRow(row.id, "serial_number", event.target.value)} maxLength={120} /></TableCell>
                    <TableCell><Input aria-label="Purchase date" type="date" value={row.date_of_purchase} onChange={(event) => updateRow(row.id, "date_of_purchase", event.target.value)} /></TableCell>
                    <TableCell><Input aria-label="Expiry date" type="date" value={row.expiry_date} onChange={(event) => updateRow(row.id, "expiry_date", event.target.value)} /></TableCell>
                    <TableCell><Input aria-label="Quantity" type="number" min="1" step="1" value={row.stock_quantity} onChange={(event) => updateRow(row.id, "stock_quantity", event.target.value)} className="w-24" /></TableCell>
                    <TableCell><Input aria-label="Buying price" type="number" min="0" step="0.01" value={row.buying_price} onChange={(event) => updateRow(row.id, "buying_price", event.target.value)} className="w-28" /></TableCell>
                    <TableCell><Input aria-label="Selling price" type="number" min="0" step="0.01" value={row.selling_price} onChange={(event) => updateRow(row.id, "selling_price", event.target.value)} className="w-28" /></TableCell>
                    <TableCell><Input aria-label="Low-stock threshold" type="number" min="0" step="1" value={row.low_stock_threshold} onChange={(event) => updateRow(row.id, "low_stock_threshold", event.target.value)} className="w-24" /></TableCell>
                    <TableCell><Badge variant="outline">{row.confidence === "check" ? "Check" : "Review"}</Badge></TableCell>
                    <TableCell><Button type="button" variant="ghost" size="icon" aria-label={`Remove ${row.name}`} title="Remove row" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer">Show original OCR lines</summary>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md bg-muted p-3 font-mono text-xs">
                {rows.map((row) => <p key={row.id}>{row.source_line}</p>)}
              </div>
            </details>
          </>
        ) : (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Choose an invoice photo or PDF to prepare multiple batch rows at once.</p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={scanning || saving}>Cancel</Button>
          <Button type="button" onClick={saveBatches} disabled={!rows.length || !selectedCount || scanning || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? "Saving batches…" : `Save ${selectedCount} batch${selectedCount === 1 ? "" : "es"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceBatchImportDialog;
