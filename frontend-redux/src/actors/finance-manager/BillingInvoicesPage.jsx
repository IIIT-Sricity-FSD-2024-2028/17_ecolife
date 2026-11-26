import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAction } from '../../hooks/useAction';
import { useForm } from '../../hooks/useForm';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Card, EmptyState, FormGrid, Notice, PageHeader, StatusBadge, TextAreaField, TextField } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid';
import { downloadFile } from '../../services/downloadService';
import { fmtDate, fmtInr, fmtInrExact } from '../../utils/formatters';

const INV = { UNPAID: 'Waiting for payment', PAID: 'Paid', VOID: 'Cancelled', CANCELLED: 'Cancelled' };

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((ok, fail) => {
    const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = ok; s.onerror = () => fail(new Error('The payment window could not be loaded. Check your connection and try again.')); document.body.appendChild(s);
  });
}

export default function BillingInvoicesPage() {
  const { pushToast } = useToast();
  const send = useAction();
  const navigate = useNavigate();
  const dialog = useDialog();
  const { data, refetch } = useApi('/billing');
  const { data: cfg } = useApi('/billing/payments/config');
  const { data: profile, refetch: refetchProfile } = useApi('/org/profile');
  const page = useForm('billing-page', { form: null, busy: '' });
  const { form, busy } = page.values;
  const setForm = (v) => page.set('form', v);
  const setBusy = (v) => page.set('busy', v);

  const f = form || { gstin: profile?.gstin || '', billingAddress: profile?.billingAddress || '', billingEmail: profile?.billingEmail || '' };
  const missing = !profile?.gstin || !profile?.billingAddress;

  async function saveProfile(e) {
    e.preventDefault();
    const saved = await send({ path: '/org/profile', method: 'PATCH', body: Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v != null)), toast: 'Billing details saved.' });
    if (saved) { setForm(null); refetchProfile(); }
  }
  async function choose(plan) {
    if (!(await dialog.confirm({ title: `Switch to ${plan.name}?`, message: `We will raise a GST invoice for ${fmtInr(plan.priceInrMonth)} a month plus GST. The plan changes as soon as it is paid.`, confirmLabel: 'Raise invoice' }))) return;
    setBusy(plan.id);
    const r = await send({ path: '/billing/upgrade', method: 'POST', body: { planCode: plan.code } });
    if (r) pushToast(r.message || `Invoice ${r.invoice?.invoiceNumber} raised.`);
    setBusy('');
  }
  async function pay(inv) {
    if (cfg?.provider === 'demo') { navigate(`/finance/billing/pay/${inv.id}`); return; }
    setBusy(inv.id);
    const o = await send({ path: `/billing/invoices/${inv.id}/pay`, method: 'POST' });
    if (o) {
      try {
        await loadCheckout();
        new window.Razorpay({
          key: o.keyId, order_id: o.orderId, amount: o.amountPaise, currency: o.currency, name: 'Tropos', description: `Invoice ${o.invoiceNumber}`, theme: { color: '#047857' },
          handler: (r) => send({ path: '/billing/payments/confirm', method: 'POST', body: { orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }, toast: 'Payment received. Thank you.' })
        }).open();
      } catch (err) { pushToast(err.message, 'error'); }
    }
    setBusy('');
  }

  if (!data) return <div className="h-40 animate-pulse" />;
  const unpaid = (data.invoices || []).find((i) => i.status === 'UNPAID');
  const current = data.plans?.find((p) => p.id === data.organization?.planId);
  const trialEnds = data.organization?.trialEndsAt;

  return (
    <div>
      <PageHeader title="Plan and invoices" description={current ? `You are on ${current.name}. ${current.maxFacilities >= 999 ? `${data.usage.facilities} sites` : `${data.usage.facilities} of ${current.maxFacilities} sites`} and ${current.maxUsers >= 999 ? `${data.usage.users} people` : `${data.usage.users} of ${current.maxUsers} people`} in use.` : 'Your plan, your GST details and your invoices.'} />
      {data.invoicingConfigured === false && <Notice tone="warn" className="mb-4">Changing plan online is not switched on yet. Contact Tropos support to change your plan.</Notice>}
      {unpaid && <Notice tone="info" className="mb-4 flex-wrap gap-3"><span>Invoice <strong>{unpaid.invoiceNumber}</strong> for {fmtInrExact(unpaid.totalInr)} is waiting for payment{unpaid.dueAt ? `, due ${fmtDate(unpaid.dueAt)}` : ''}.</span>{cfg?.enabled ? <Button size="sm" loading={busy === unpaid.id} onClick={() => pay(unpaid)}>Pay now</Button> : <span>Pay by bank transfer and tell us the reference.</span>}</Notice>}
      {cfg && !cfg.enabled && unpaid && <Notice tone="info" className="mb-4 flex-col"><div className="font-medium">How to pay</div><div className="whitespace-pre-line">{cfg.instructions || 'Ask your Tropos contact for the payment details. Once we receive the money, the invoice is marked paid.'}</div></Notice>}
      {cfg?.enabled && (cfg.mode === 'test' || cfg.mode === 'demo') && <Notice tone="warn" className="mb-4">Payments are in practice mode. No real money moves.</Notice>}
      {trialEnds && data.organization?.status === 'TRIAL' && <Notice tone="info" className="mb-4">Your free trial ends on {fmtDate(trialEnds)}. After that the workspace becomes read-only until a plan is paid.</Notice>}

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {(data.plans || []).map((p) => {
          const active = current?.id === p.id;
          return (
            <Card key={p.id} className={active ? 'ring-2 ring-brand-500' : ''}>
              <div className="flex items-center justify-between"><h2 className="font-semibold">{p.name}</h2>{active && <StatusBadge status="ACTIVE" label="Your plan" />}</div>
              <div className="text-2xl font-semibold tabular-nums mt-2">{fmtInr(p.priceInrMonth)}<span className="text-sm font-normal text-muted"> a month + GST</span></div>
              <p className="text-sm text-muted mt-1 mb-4">{p.maxFacilities >= 999 && p.maxUsers >= 999 ? 'Any number of sites and people.' : `Up to ${p.maxFacilities >= 999 ? 'any number of' : p.maxFacilities} sites and ${p.maxUsers >= 999 ? 'any number of' : p.maxUsers} people.`}</p>
              {!active && <Button variant="secondary" className="w-full" loading={busy === p.id} disabled={missing} onClick={() => choose(p)}>Switch to this plan</Button>}
            </Card>
          );
        })}
      </div>

      <Card title="Billing details for your GST invoice" description={missing ? 'Add your GSTIN and address before you change plan.' : undefined} className="mb-6">
        <form onSubmit={saveProfile} className="space-y-4">
          <FormGrid cols={2}>
            <TextField label="GSTIN" placeholder="15 characters" maxLength={15} value={f.gstin} onChange={(x) => setForm({ ...f, gstin: x.toUpperCase() })} />
            <TextField label="Billing email" type="email" value={f.billingEmail} onChange={(x) => setForm({ ...f, billingEmail: x })} />
            <TextAreaField className="sm:col-span-2" label="Registered address" rows={2} value={f.billingAddress} onChange={(x) => setForm({ ...f, billingAddress: x })} />
          </FormGrid>
          <div className="flex justify-end"><Button type="submit" disabled={!form}>Save details</Button></div>
        </form>
      </Card>

      <DataGrid endpoint="/billing/invoices" exportName="invoices" initialPageSize={10}
        columns={[{ key: 'n', label: 'Invoice', render: (r) => <><div className="font-medium">{r.invoiceNumber}</div><div className="text-xs text-muted">{r.planName}</div></>, value: (r) => r.invoiceNumber },
          { key: 's', label: 'Amount before GST (₹)', numeric: true, render: (r) => fmtInrExact(r.subtotalInr), value: (r) => r.subtotalInr },
          { key: 'g', label: 'GST (₹)', numeric: true, hideOnMobile: true, render: (r) => fmtInrExact(Number(r.cgstInr) + Number(r.sgstInr) + Number(r.igstInr)), value: (r) => Number(r.cgstInr) + Number(r.sgstInr) + Number(r.igstInr) },
          { key: 't', label: 'Total (₹)', numeric: true, render: (r) => <span className="font-medium">{fmtInrExact(r.totalInr)}</span>, value: (r) => r.totalInr },
          { key: 'st', label: 'Status', render: (r) => <StatusBadge status={r.status} label={INV[r.status] || r.status} />, value: (r) => r.status },
          { key: 'd', label: 'Issued', hideOnMobile: true, render: (r) => fmtDate(r.issuedAt), value: (r) => r.issuedAt },
          { key: 'a', label: '', render: (r) => <div className="flex gap-1.5 justify-end"><Button size="sm" variant="secondary" onClick={() => downloadFile(`/billing/invoices/${r.id}/pdf`, `${r.invoiceNumber.replace('/', '-')}.pdf`)}>Invoice PDF</Button>{r.status === 'UNPAID' && cfg?.enabled && <Button size="sm" loading={busy === r.id} onClick={() => pay(r)}>Pay now</Button>}</div> }]}
        emptyTitle="No invoices yet" emptyText="Invoices appear here when you change plan." />
    </div>
  );
}
