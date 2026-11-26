import PDFDocument from 'pdfkit';

/** GST state codes → names, for "Place of supply" (GST Rule 46). */
const STATES: Record<string, string> = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh', '24': 'Gujarat', '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory'
};

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function below100(n: number) { return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`; }
function below1000(n: number) { return n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' + below100(n % 100) : ''}` : below100(n); }

/** Indian numbering (crore, lakh, thousand). 35399.00 → "Rupees Thirty Five Thousand Three Hundred Ninety Nine Only". */
export function amountInWords(amount: number): string {
  const paise = Math.round(amount * 100) % 100;
  let n = Math.floor(Math.round(amount * 100) / 100);
  if (n === 0 && paise === 0) return 'Rupees Zero Only';
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${below1000(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (n) parts.push(below1000(n));
  const rupees = parts.join(' ');
  return `Rupees ${rupees}${paise ? `${rupees ? ' and ' : ''}${below100(paise)} Paise` : ''} Only`.replace('Rupees  and', 'Rupees');
}

const inr = (v: any) => Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (d?: Date | null) => (d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '');
const METHOD: Record<string, string> = { BANK_TRANSFER: 'Bank transfer', UPI: 'UPI', CHEQUE: 'Cheque', CARD: 'Card', GATEWAY: 'Online payment' };

export interface InvoicePdfSupplier { name: string; address: string; gstin: string; email?: string; demo?: boolean; instructions?: string }

/** Renders one GST tax invoice (Rule 46 particulars) as a single A4 PDF page. */
export function renderInvoicePdf(inv: any, supplier: InvoicePdfSupplier): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Tax Invoice ${inv.invoiceNumber}`, Author: supplier.name } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const L = 40, R = 555, W = R - L;
    const ink = '#1f2937', muted = '#6b7280', line = '#d1d5db', green = '#047857';
    const paid = inv.status === 'PAID';
    const cancelled = inv.status === 'VOID' || inv.status === 'CANCELLED';

    // Demo watermark sits behind everything.
    if (supplier.demo) {
      doc.save(); doc.rotate(-35, { origin: [300, 420] }).fillColor('#e5e7eb').font('Helvetica-Bold').fontSize(80).text('DEMO', 150, 380, { lineBreak: false }); doc.restore();
    }

    // Header
    doc.fillColor(green).font('Helvetica-Bold').fontSize(20).text(supplier.name, L, 40, { width: 330 });
    doc.fillColor(muted).font('Helvetica').fontSize(9).text(supplier.address, L, doc.y + 2, { width: 300 });
    doc.fillColor(ink).text(`GSTIN: ${supplier.gstin}`, L, doc.y + 2);
    if (supplier.email) doc.fillColor(muted).text(supplier.email, L, doc.y + 1);
    const leftEnd = doc.y;
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(18).text('TAX INVOICE', 380, 40, { width: R - 380, align: 'right' });
    const stamp = cancelled ? 'CANCELLED' : paid ? 'PAID' : 'UNPAID';
    const stampColor = cancelled ? muted : paid ? green : '#b45309';
    doc.roundedRect(R - 90, 66, 90, 22, 3).lineWidth(1.2).strokeColor(stampColor).stroke();
    doc.fillColor(stampColor).font('Helvetica-Bold').fontSize(11).text(stamp, R - 90, 72, { width: 90, align: 'center' });
    doc.fillColor(muted).font('Helvetica').fontSize(8).text('Original for recipient', 380, 94, { width: R - 380, align: 'right' });

    let y = Math.max(leftEnd, 110) + 14;
    doc.moveTo(L, y).lineTo(R, y).strokeColor(line).lineWidth(1).stroke();
    y += 10;

    // Invoice facts (left) and bill-to (right)
    const facts: [string, string][] = [
      ['Invoice number', inv.invoiceNumber], ['Invoice date', dmy(inv.issuedAt)],
      ['Due date', inv.dueAt ? dmy(inv.dueAt) : '—'],
      ['Place of supply', `${STATES[inv.placeOfSupply] ?? 'India'} (${inv.placeOfSupply ?? '—'})`],
      ['Reverse charge', 'No']
    ];
    let fy = y;
    for (const [k, v] of facts) { doc.fillColor(muted).font('Helvetica').fontSize(9).text(k, L, fy, { width: 100 }); doc.fillColor(ink).font('Helvetica-Bold').text(v, L + 105, fy, { width: 170 }); fy += 15; }
    doc.fillColor(muted).font('Helvetica-Bold').fontSize(9).text('BILL TO', 310, y);
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(11).text(inv.customerName ?? '', 310, y + 14, { width: R - 310 });
    doc.fillColor(muted).font('Helvetica').fontSize(9).text(inv.customerAddress ?? '', 310, doc.y + 2, { width: R - 310 });
    doc.fillColor(ink).text(`GSTIN: ${inv.customerGstin ?? 'Unregistered'}`, 310, doc.y + 2);
    y = Math.max(fy, doc.y) + 14;

    // Line item table
    const cols = [
      { x: L, w: 24, h: '#', a: 'left' }, { x: L + 24, w: 200, h: 'Description', a: 'left' }, { x: L + 224, w: 52, h: 'SAC', a: 'left' }, { x: L + 276, w: 30, h: 'Qty', a: 'right' },
      { x: L + 306, w: 70, h: 'Rate (INR)', a: 'right' }, { x: L + 376, w: 70, h: 'Taxable (INR)', a: 'right' }, { x: L + 446, w: 69, h: 'Amount (INR)', a: 'right' }
    ] as const;
    doc.rect(L, y, W, 20).fill('#f3f4f6');
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(8.5);
    for (const c of cols) doc.text(c.h, c.x + 4, y + 6, { width: c.w - 8, align: c.a as any });
    y += 20;
    const periodTxt = inv.servicePeriodStart && inv.servicePeriodEnd ? `Service period ${dmy(inv.servicePeriodStart)} to ${dmy(inv.servicePeriodEnd)}` : 'Service period starts when payment is received';
    const rowH = 48;
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(9).text('1', cols[0].x + 4, y + 8, { width: cols[0].w - 8 });
    doc.text(`Tropos ${inv.planName ?? ''}`, cols[1].x + 4, y + 6, { width: cols[1].w - 8, lineBreak: false });
    doc.fillColor(muted).font('Helvetica').fontSize(8).text('Monthly subscription', cols[1].x + 4, y + 20, { width: cols[1].w - 8 }).text(periodTxt, cols[1].x + 4, y + 31, { width: cols[1].w - 8 });
    doc.fillColor(ink).font('Helvetica').fontSize(9);
    doc.text(inv.sacCode, cols[2].x + 4, y + 8, { width: cols[2].w - 8 });
    doc.text('1', cols[3].x + 4, y + 8, { width: cols[3].w - 8, align: 'right' });
    doc.text(inr(inv.subtotalInr), cols[4].x + 4, y + 8, { width: cols[4].w - 8, align: 'right' });
    doc.text(inr(inv.subtotalInr), cols[5].x + 4, y + 8, { width: cols[5].w - 8, align: 'right' });
    doc.text(inr(inv.subtotalInr), cols[6].x + 4, y + 8, { width: cols[6].w - 8, align: 'right' });
    y += rowH;
    doc.moveTo(L, y).lineTo(R, y).strokeColor(line).stroke();
    y += 10;

    // Tax summary (left) and totals (right)
    const rate = Number(inv.gstRatePct ?? 0);
    const taxRows: [string, number][] = [];
    if (Number(inv.igstInr) > 0) taxRows.push([`IGST @ ${rate}%`, Number(inv.igstInr)]);
    else { taxRows.push([`CGST @ ${rate / 2}%`, Number(inv.cgstInr)]); taxRows.push([`SGST @ ${rate / 2}%`, Number(inv.sgstInr)]); }
    let ty = y;
    doc.fillColor(muted).font('Helvetica').fontSize(9).text('Taxable value', 330, ty, { width: 120 }); doc.fillColor(ink).text(inr(inv.subtotalInr), 450, ty, { width: 105, align: 'right' }); ty += 15;
    for (const [k, v] of taxRows) { doc.fillColor(muted).text(k, 330, ty, { width: 120 }); doc.fillColor(ink).text(inr(v), 450, ty, { width: 105, align: 'right' }); ty += 15; }
    doc.moveTo(330, ty + 2).lineTo(R, ty + 2).strokeColor(line).stroke(); ty += 8;
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(12).text('Total (INR)', 330, ty, { width: 120 }); doc.text(`INR ${inr(inv.totalInr)}`, 450, ty, { width: 105, align: 'right' });
    ty += 22;
    doc.fillColor(muted).font('Helvetica-Bold').fontSize(8.5).text('AMOUNT IN WORDS', L, y); doc.fillColor(ink).font('Helvetica').fontSize(9.5).text(amountInWords(Number(inv.totalInr)), L, y + 13, { width: 270 });
    y = Math.max(ty, doc.y) + 14;

    // Payment block
    doc.rect(L, y, W, 58).strokeColor(line).lineWidth(1).stroke();
    doc.fillColor(muted).font('Helvetica-Bold').fontSize(8.5).text('PAYMENT', L + 10, y + 8);
    if (paid) {
      doc.fillColor(green).font('Helvetica-Bold').fontSize(10).text(`Paid in full on ${dmy(inv.paidAt)}`, L + 10, y + 22);
      doc.fillColor(ink).font('Helvetica').fontSize(9).text(`Method: ${METHOD[inv.paymentMethod] ?? inv.paymentMethod ?? '—'}      Reference: ${inv.paymentReference ?? '—'}`, L + 10, y + 38, { width: W - 20 });
    } else if (cancelled) {
      doc.fillColor(muted).font('Helvetica').fontSize(9.5).text('This invoice was cancelled. No payment is due.', L + 10, y + 24);
    } else {
      doc.fillColor('#b45309').font('Helvetica-Bold').fontSize(10).text(`Amount due: INR ${inr(inv.totalInr)}${inv.dueAt ? `   by ${dmy(inv.dueAt)}` : ''}`, L + 10, y + 22);
      doc.fillColor(ink).font('Helvetica').fontSize(9).text(supplier.instructions || 'Pay online from Plan and invoices in your Tropos account, or pay by bank transfer and quote the invoice number.', L + 10, y + 38, { width: W - 20 });
    }
    y += 74;

    // Terms and footer
    doc.fillColor(muted).font('Helvetica-Bold').fontSize(8.5).text('TERMS', L, y);
    doc.font('Helvetica').fontSize(8).text('Your plan stays active for one month from the day payment is received. Prices are in Indian Rupees and exclude GST, which is shown separately above. Questions about this invoice: reply to the email it came with, or write to our billing team.', L, y + 12, { width: W });
    if (supplier.demo) {
      doc.fillColor('#b45309').font('Helvetica-Bold').fontSize(8.5).text('DEMONSTRATION INVOICE. The supplier name, GSTIN and payment shown are sample data and have no legal or tax value.', L, 770, { width: W, align: 'center' });
    }
    doc.fillColor(muted).font('Helvetica').fontSize(8).text('This is a computer-generated invoice and needs no signature.', L, 788, { width: W, align: 'center' });
    doc.end();
  });
}

/** Supplier block for the PDF, taken from the server settings. Marked demo while the simulated payment portal is on. */
export function supplierFromEnv(e: any): InvoicePdfSupplier {
  return { name: e.BILLING_SUPPLIER_NAME || 'Tropos', address: e.BILLING_SUPPLIER_ADDRESS || '', gstin: e.BILLING_SUPPLIER_GSTIN || '', demo: e.PAYMENT_PROVIDER === 'demo', instructions: e.PAYMENT_INSTRUCTIONS || undefined };
}
