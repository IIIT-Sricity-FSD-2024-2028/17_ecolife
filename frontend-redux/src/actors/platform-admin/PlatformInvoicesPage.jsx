import React from 'react';
import { useAction } from '../../hooks/useAction';
import { useForm } from '../../hooks/useForm';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Notice, PageHeader, SelectField, StatusBadge, TextField } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid';
import { downloadFile } from '../../services/downloadService';
import { fmtDate, fmtInrExact } from '../../utils/formatters';

const INV = { UNPAID: 'Waiting for payment', PAID: 'Paid', CANCELLED: 'Cancelled' };

export default function PlatformInvoicesPage() {
  const send = useAction();
  const dialog = useDialog();
  const f = useForm('platform-invoices', { q: '', status: '' });
  const { q, status } = f.values;
  const setQ = (v) => f.set('q', v);
  const setStatus = (v) => f.set('status', v);
  async function paid(i) {
    const v = await dialog.form({ title: `Mark ${i.invoiceNumber} as paid`, description: 'Only after the money is in the bank. The company’s plan switches on.', submitLabel: 'Mark as paid', fields: [
      { name: 'paymentMethod', type: 'select', label: 'How was it paid?', required: true, defaultValue: 'BANK_TRANSFER', options: [{ value: 'BANK_TRANSFER', label: 'Bank transfer' }, { value: 'UPI', label: 'UPI' }, { value: 'CHEQUE', label: 'Cheque' }, { value: 'CARD', label: 'Card' }] },
      { name: 'paymentReference', type: 'text', label: 'Bank reference', required: true, minLength: 4, hint: 'UTR, cheque number or transaction ID.' }] });
    if (!v) return;
    await send({ path: `/platform/invoices/${i.id}/mark-paid`, method: 'POST', body: { paymentMethod: v.paymentMethod, paymentReference: v.paymentReference.trim() }, toast: 'Marked paid. The plan is active.' });
  }
  async function cancel(i) {
    const v = await dialog.form({ title: `Cancel ${i.invoiceNumber}`, danger: true, submitLabel: 'Cancel invoice', fields: [{ name: 'reason', type: 'textarea', label: 'Why?', required: true, minLength: 5 }] });
    if (!v) return;
    await send({ path: `/platform/invoices/${i.id}/cancel`, method: 'POST', body: { reason: v.reason.trim() }, toast: 'Cancelled.' });
  }
  return (
    <div>
      <PageHeader title="Invoices" description="GST invoices for all companies." />
      <Notice tone="info" className="mb-4">Card payments through the payment provider are marked paid automatically. Use “Mark as paid” for bank transfers.</Notice>
      <DataGrid endpoint="/platform/invoices" params={{ q, status }} exportName="invoices"
        toolbar={<><TextField className="w-60" label="" aria-label="Search" placeholder="Invoice number or company" value={q} onChange={setQ} /><SelectField className="w-48" label="" aria-label="Status" value={status} onChange={setStatus} placeholder="Any status" options={Object.entries(INV).map(([v, l]) => ({ value: v, label: l }))} /></>}
        columns={[{ key: 'n', label: 'Invoice', render: (r) => <><div className="font-medium">{r.invoiceNumber}</div><div className="text-xs text-muted">{r.organization?.name}</div></>, value: (r) => r.invoiceNumber },
          { key: 'p', label: 'Plan', hideOnMobile: true, render: (r) => r.planName, value: (r) => r.planName }, { key: 't', label: 'Total (₹)', numeric: true, render: (r) => fmtInrExact(r.totalInr), value: (r) => r.totalInr },
          { key: 's', label: 'Status', render: (r) => <StatusBadge status={r.status === 'PAID' ? 'ACTIVE' : r.status} label={INV[r.status]} />, value: (r) => r.status }, { key: 'd', label: 'Issued', hideOnMobile: true, render: (r) => fmtDate(r.issuedAt), value: (r) => r.issuedAt },
          { key: 'a', label: '', render: (r) => <div className="flex gap-1.5 justify-end"><Button size="sm" variant="secondary" onClick={() => downloadFile(`/platform/invoices/${r.id}/pdf`, `${r.invoiceNumber.replace('/', '-')}.pdf`)}>Invoice PDF</Button>{r.status === 'UNPAID' && <><Button size="sm" onClick={() => paid(r)}>Mark as paid</Button><Button size="sm" variant="secondary" onClick={() => cancel(r)}>Cancel</Button></>}</div> }]}
        emptyTitle="No invoices" emptyText="Nothing matches these filters." />
    </div>
  );
}
