import React, { useState } from 'react';
import { apiFetch } from '../../services/apiClient';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Card, EmptyState, FormGrid, Notice, PageHeader, StatusBadge, TextAreaField, TextField } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid';
import { fmtDate, fmtInr } from '../../utils/formatters';

const INV = { UNPAID: 'Waiting for payment', PAID: 'Paid', VOID: 'Cancelled', CANCELLED: 'Cancelled' };

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((ok, fail) => {
    const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = ok; s.onerror = () => fail(new Error('The payment window could not be loaded. Check your connection and try again.')); document.body.appendChild(s);
  });
}

export default function BillingInvoicesPage() {
  const { pushToast } = useToast();
  const dialog = useDialog();
  const { data, refetch } = useApi('/billing');
  const { data: cfg } = useApi('/billing/payments/config');
  const { data: profile, refetch: refetchProfile } = useApi('/org/profile');
  const [form, setForm] = useState(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState('');
  const again = () => { refetch(); setTick((t) => t + 1); };

  const f = form || { gstin: profile?.gstin || '', billingAddress: profile?.billingAddress || '', billingEmail: profile?.billingEmail || '' };
  const missing = !profile?.gstin || !profile?.billingAddress;

  async function saveProfile(e) {
    e.preventDefault();
    try { await apiFetch('/org/profile', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v != null))) }); pushToast('Billing details saved.'); setForm(null); refetchProfile(); }
    catch (err) { pushToast(err.message, 'error'); }
  }
  async function choose(plan) {
    if (!(await dialog.confirm({ title: `Switch to ${plan.name}?`, message: `We will raise a GST invoice for ${fmtInr(plan.priceInrMonth)} a month plus GST. The plan changes as soon as it is paid.`, confirmLabel: 'Raise invoice' }))) return;
    setBusy(plan.id);
    try { const r = await apiFetch('/billing/upgrade', { method: 'POST', body: JSON.stringify({ planCode: plan.code }) }); pushToast(r.message || `Invoice ${r.invoice?.invoiceNumber} raised.`); again(); }
    catch (err) { pushToast(err.message, 'error'); } finally { setBusy(''); }
  }
  async function pay(inv) {
    setBusy(inv.id);
    try {
      const o = await apiFetch(`/billing/invoices/${inv.id}/pay`, { method: 'POST' });
      await loadCheckout();
      new window.Razorpay({
        key: o.keyId, order_id: o.orderId, amount: o.amountPaise, currency: o.currency, name: 'Tropos', description: `Invoice ${o.invoiceNumber}`, theme: { color: '#047857' },
        handler: async (r) => {
          try { await apiFetch('/billing/payments/confirm', { method: 'POST', body: JSON.stringify({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }) }); pushToast('Payment received. Thank you.'); again(); }
          catch (err) { pushToast(err.message, 'error'); }
        }
      }).open();
    } catch (err) { pushToast(err.message, 'error'); } finally { setBusy(''); }
  }

  if (!data) return <div className="h-40 animate-pulse" />;
  const unpaid = (data.invoices || []).find((i) => i.status === 'UNPAID');
  const current = data.plans?.find((p) => p.id === data.organization?.planId);
  const trialEnds = data.organization?.trialEndsAt;

  return (
    <div>
      <PageHeader title="Plan and invoices" description={current ? `You are on ${current.name}. ${data.usage.facilities} of ${current.maxFacilities} sites and ${data.usage.users} of ${current.maxUsers} people in use.` : 'Your plan, your GST details and your invoices.'} />
      {data.invoicingConfigured === false && <Notice tone="warn" className="mb-4">Changing plan online is not switched on yet. Contact Tropos support to change your plan.</Notice>}
      {unpaid && <Notice tone="info" className="mb-4 flex-wrap gap-3"><span>Invoice <strong>{unpaid.invoiceNumber}</strong> for {fmtInr(unpaid.totalInr)} is waiting for payment{unpaid.dueAt ? `, due ${fmtDate(unpaid.dueAt)}` : ''}.</span>{cfg?.enabled ? <Button size="sm" loading={busy === unpaid.id} onClick={() => pay(unpaid)}>Pay now</Button> : <span>Pay by bank transfer and tell us the reference.</span>}</Notice>}
      {cfg && !cfg.enabled && unpaid && <Notice tone="info" className="mb-4 flex-col"><div className="font-medium">How to pay</div><div className="whitespace-pre-line">{cfg.instructions || 'Ask your Tropos contact for the payment details. Once we receive the money, the invoice is marked paid.'}</div></Notice>}
      {cfg?.enabled && cfg.mode === 'test' && <Notice tone="warn" className="mb-4">Payments are in test mode. No real money moves.</Notice>}
      {trialEnds && data.organization?.status === 'TRIAL' && <Notice tone="info" className="mb-4">Your free trial ends on {fmtDate(trialEnds)}. After that the workspace becomes read-only until a plan is paid.</Notice>}

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {(data.plans || []).map((p) => {
          const active = current?.id === p.id;
          return (
            <Card key={p.id} className={active ? 'ring-2 ring-brand-500' : ''}>
              <div className="flex items-center justify-between"><h2 className="font-semibold">{p.name}</h2>{active && <StatusBadge status="ACTIVE" label="Your plan" />}</div>
              <div className="text-2xl font-semibold tabular-nums mt-2">{fmtInr(p.priceInrMonth)}<span className="text-sm font-normal text-muted"> a month + GST</span></div>
              <p className="text-sm text-muted mt-1 mb-4">Up to {p.maxFacilities} sites and {p.maxUsers} people.</p>
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

      <DataGrid endpoint="/billing/invoices" refreshKey={tick} exportName="invoices" initialPageSize={10}
        columns={[{ key: 'n', label: 'Invoice', render: (r) => <><div className="font-medium">{r.invoiceNumber}</div><div className="text-xs text-muted">{r.planName}</div></>, value: (r) => r.invoiceNumber },
          { key: 's', label: 'Amount before GST (₹)', numeric: true, render: (r) => fmtInr(r.subtotalInr), value: (r) => r.subtotalInr },
          { key: 'g', label: 'GST (₹)', numeric: true, hideOnMobile: true, render: (r) => fmtInr(Number(r.cgstInr) + Number(r.sgstInr) + Number(r.igstInr)), value: (r) => Number(r.cgstInr) + Number(r.sgstInr) + Number(r.igstInr) },
          { key: 't', label: 'Total (₹)', numeric: true, render: (r) => <span className="font-medium">{fmtInr(r.totalInr)}</span>, value: (r) => r.totalInr },
          { key: 'st', label: 'Status', render: (r) => <StatusBadge status={r.status} label={INV[r.status] || r.status} />, value: (r) => r.status },
          { key: 'd', label: 'Issued', hideOnMobile: true, render: (r) => fmtDate(r.issuedAt), value: (r) => r.issuedAt },
          { key: 'a', label: '', render: (r) => r.status === 'UNPAID' && cfg?.enabled ? <Button size="sm" loading={busy === r.id} onClick={() => pay(r)}>Pay now</Button> : null }]}
        emptyTitle="No invoices yet" emptyText="Invoices appear here when you change plan." />
    </div>
  );
}
