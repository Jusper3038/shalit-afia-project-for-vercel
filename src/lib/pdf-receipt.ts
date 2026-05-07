type PdfReceiptLine = {
  itemName: string;
  quantity: number;
  lineTotal: number;
  batchSummary: string;
};

export type PdfReceiptData = {
  receiptNumber: string;
  patientName: string;
  clinicName: string;
  createdAt: string;
  total: number;
  lines: PdfReceiptLine[];
};

const escapePdfText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const normalizePdfLine = (value: string) =>
  value
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .trimEnd();

const buildReceiptLines = (receipt: PdfReceiptData) => {
  const lines = [
    receipt.clinicName,
    "Billing Receipt",
    "",
    `Receipt: ${receipt.receiptNumber}`,
    `Date: ${new Date(receipt.createdAt).toLocaleString()}`,
    `Patient: ${receipt.patientName}`,
    "",
    "Items",
  ];

  receipt.lines.forEach((line, index) => {
    lines.push(`${index + 1}. ${line.itemName}`);
    lines.push(`   Qty: ${line.quantity} | Amount: KSh ${line.lineTotal.toLocaleString()}`);
    lines.push(`   Batches: ${line.batchSummary}`);
  });

  lines.push("");
  lines.push(`Total: KSh ${receipt.total.toLocaleString()}`);
  return lines;
};

export const downloadReceiptPdf = (receipt: PdfReceiptData) => {
  const textLines = buildReceiptLines(receipt).map(normalizePdfLine);
  const content = [
    "BT",
    "/F1 12 Tf",
    "14 TL",
    "72 780 Td",
    ...textLines.map((line, index) =>
      index === 0
        ? `(${escapePdfText(line)}) Tj`
        : `T* (${escapePdfText(line)}) Tj`
    ),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.forEach((offset) => {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${receipt.receiptNumber}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};
