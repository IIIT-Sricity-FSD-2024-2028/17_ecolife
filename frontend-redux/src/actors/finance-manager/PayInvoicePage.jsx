import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CreditCard, Landmark, Smartphone, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAction } from '../../hooks/useAction';
import { useForm } from '../../hooks/useForm';
import { useApi } from '../../hooks/useApi';
import { Button, Card, Notice, PageHeader } from '../../components/ui';
import { downloadFile } from '../../services/downloadService';
import { fmtInrExact } from '../../utils/formatters';

const METHODS = [
  { id: 'UPI', icon: Smartphone, title: 'UPI', text: 'Pay from any UPI app.' },
  { id: 'CARD', icon: CreditCard, title: 'Debit or credit card', text: 'Visa, Mastercard, RuPay.' },
  { id: 'NETBANKING', icon: Landmark, title: 'Net banking', text: 'Pay from your bank account.' }
];
const METHOD_NAME = { UPI: 'UPI', CARD: 'card', NETBANKING: 'net banking' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Practice payment page. It looks like a real checkout but no money moves, and nothing is asked that could be a real card or bank detail. */
export default function PayInvoicePage() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const send = useAction();
  const { data } = useApi('/billing');
  const s = useForm(`pay-${invoiceId}`, { method: 'UPI', stage: 'choose', result: null });
  const { method, stage, result } = s.values;

  if (!data) return <div className="h-40 animate-pulse" />;
  const inv = (data.invoices || []).find((i) => i.id === invoiceId);
  if (!inv) return <PageHeader title="Invoice not found" description="Go back to Plan and invoices and pick one from the list." actions={<Button onClick={() => navigate('/finance/billing')}>Back to invoices</Button>} />;
  const gst = Number(inv.cgstInr) + Number(inv.sgstInr) + Number(inv.igstInr);
  const alreadyPaid = inv.status === 'PAID' && stage !== 'done';

  async function pay() {
    s.set('stage', 'processing');
    await wait(1600);
    const r = await send({ path: `/billing/invoices/${inv.id}/demo-pay`, method: 'POST', body: { method } });
    if (r) { s.set('result', r); s.set('stage', 'done'); } else s.set('stage', 'choose');
  }

  if (stage === 'done') {
    return (
      <div className="max-w-xl mx-auto">
        <Card className="p-8 text-center">
          <CheckCircle2 className="w-14 h-14 text-brand-600 mx-auto" />
          <h1 className="text-2xl font-semibold mt-3">Payment received</h1>
          <p className="text-muted mt-1">{fmtInrExact(inv.totalInr)} paid for invoice {inv.invoiceNumber}. Your plan is now active.</p>
          <dl className="text-sm text-left mt-6 divide-y divide-line border border-line rounded-lg">
            <div className="flex justify-between px-4 py-2.5"><dt className="text-muted">Invoice</dt><dd className="font-medium">{inv.invoiceNumber}</dd></div>
            <div className="flex justify-between px-4 py-2.5"><dt className="text-muted">Paid by</dt><dd className="font-medium">{METHOD_NAME[result?.method] || 'online'}</dd></div>
            <div className="flex justify-between px-4 py-2.5"><dt className="text-muted">Payment reference</dt><dd className="font-medium">{result?.reference}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-2 justify-center mt-6">
            <Button onClick={() => downloadFile(`/billing/invoices/${inv.id}/pdf`, `${inv.invoiceNumber.replace('/', '-')}.pdf`)}>Download tax invoice</Button>
            <Button variant="secondary" onClick={() => navigate('/finance/billing')}>Back to plan and invoices</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="Pay invoice" description={`Invoice ${inv.invoiceNumber} for ${inv.planName || 'your plan'}.`} />
      <Notice tone="warn" className="mb-4">This is a practice payment page. No real money moves, so do not enter any real card or bank details. Pick a way to pay and press the button.</Notice>
      {alreadyPaid && <Notice tone="info" className="mb-4">This invoice is already paid.</Notice>}
      <div className="grid md:grid-cols-5 gap-6">
        <Card className="md:col-span-2 p-5 h-fit">
          <h2 className="font-semibold">Order summary</h2>
          <dl className="text-sm mt-3 space-y-2">
            <div className="flex justify-between"><dt className="text-muted">{inv.planName} plan, 1 month</dt><dd>{fmtInrExact(inv.subtotalInr)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">GST ({Number(inv.gstRatePct)}%)</dt><dd>{fmtInrExact(gst)}</dd></div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd>{fmtInrExact(inv.totalInr)}</dd></div>
          </dl>
          <p className="text-xs text-muted mt-4 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> A GST tax invoice is ready to download as soon as you pay.</p>
        </Card>
        <Card className="md:col-span-3 p-5">
          <h2 className="font-semibold">How would you like to pay?</h2>
          <div role="radiogroup" aria-label="Payment method" className="mt-3 space-y-2">
            {METHODS.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={method === m.id} disabled={stage === 'processing' || alreadyPaid} onClick={() => s.set('method', m.id)}
                className={`w-full flex items-center gap-3 text-left rounded-lg border px-4 py-3 transition ${method === m.id ? 'border-brand-600 bg-brand-50' : 'border-line hover:bg-slate-50'}`}>
                <m.icon className="w-5 h-5 text-brand-700 shrink-0" />
                <span><span className="block font-medium">{m.title}</span><span className="block text-sm text-muted">{m.text}</span></span>
              </button>
            ))}
          </div>
          <Button className="w-full mt-5" disabled={stage === 'processing' || alreadyPaid} onClick={pay}>{stage === 'processing' ? 'Processing your payment…' : `Pay ${fmtInrExact(inv.totalInr)}`}</Button>
          <Button variant="ghost" className="w-full mt-2" disabled={stage === 'processing'} onClick={() => navigate('/finance/billing')}>Cancel and go back</Button>
        </Card>
      </div>
    </div>
  );
}
