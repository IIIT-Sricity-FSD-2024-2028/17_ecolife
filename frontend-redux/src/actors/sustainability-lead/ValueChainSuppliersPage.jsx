import React from 'react';
import { Plus, Copy } from 'lucide-react';
import { useAction } from '../../hooks/useAction';
import { useForm } from '../../hooks/useForm';
import { useApi } from '../../hooks/useApi';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useOptions, toOptions } from '../../hooks/useOptions';
import { useDialog, Dialog } from '../../components/ui/Dialogs';
import { Pager } from '../../components/ui/Pager';
import { Button, Card, EmptyState, FormGrid, NumberField, Notice, PageHeader, SelectField, StatusBadge, TextField } from '../../components/ui';
import { fmtNum } from '../../utils/formatters';
import { SCOPE3_CATEGORY, SCOPE3_METHOD, ENTRY_STATUS, unitName } from '../../utils/labels';

const REQ = { SENT: 'Waiting for supplier', OTP_VERIFIED: 'Supplier is filling it in', SUBMITTED: 'Waiting for your review', ACCEPTED: 'Accepted', REJECTED: 'Rejected', EXPIRED: 'Expired' };

const EMPTY_PURCHASE = { supplierQ: '', periodId: '', scope3Category: '1', method: 'AVERAGE_DATA', supplierId: '', description: '', quantity: '', unit: '', spendInr: '', factorId: '', q: '' };

function PurchaseDialog({ open, onClose, periods }) {
  const send = useAction();
  const { enums, rules } = useOptions();
  const form = useForm('value-chain-purchase', { v: EMPTY_PURCHASE, busy: false });
  const { v, busy } = form.values;
  const { data: factors } = useApi(open ? `/factors?page=1&pageSize=50&status=PUBLISHED${v.q ? `&q=${encodeURIComponent(v.q)}` : ''}` : null);
  const { data: supplierPage } = useApi(open ? `/suppliers?page=1&pageSize=50${v.supplierQ ? `&q=${encodeURIComponent(v.supplierQ)}` : ''}` : null);
  const suppliers = supplierPage?.items || [];
  const set = (k) => (x) => form.set('v', { ...v, [k]: x });
  const open_ = periods.filter((p) => ['OPEN', 'REOPENED'].includes(p.status));
  const pid = v.periodId || open_[0]?.id || '';
  const factor = factors?.items?.find((f) => f.id === v.factorId);
  async function save(e) {
    e.preventDefault(); form.set('busy', true);
    const saved = await send({ path: '/scope3-purchases', method: 'POST', body: { periodId: pid, scope3Category: Number(v.scope3Category), method: v.method, supplierId: v.supplierId || undefined, description: v.description.trim(), quantity: Number(v.quantity), unit: v.unit, spendInr: v.spendInr === '' ? undefined : Number(v.spendInr), factorId: v.factorId }, toast: 'Saved as a draft.' });
    form.reset({ v: saved ? EMPTY_PURCHASE : v, busy: false });
    if (saved) onClose();
  }
  return (
    <Dialog open={open} onClose={onClose} wide title="Add a purchase" description="Something you bought that carries emissions from your suppliers. It is saved as a draft until you send it for review.">
      <form onSubmit={save} className="space-y-4">
        <FormGrid cols={2}>
          <SelectField label="Month" required value={pid} onChange={set('periodId')} options={open_.map((p) => ({ value: p.id, label: p.label }))} />
          <SelectField label="Kind of purchase" required value={v.scope3Category} onChange={set('scope3Category')} options={Object.entries(SCOPE3_CATEGORY).map(([k, l]) => ({ value: k, label: l }))} />
          <SelectField label="How do you know the emissions?" required value={v.method} onChange={set('method')} options={toOptions(enums.Scope3Method, SCOPE3_METHOD)} />
          <TextField label="Find a supplier" optional value={v.supplierQ} onChange={set('supplierQ')} placeholder="Type part of the name" hint={supplierPage && supplierPage.total > suppliers.length ? `Showing ${suppliers.length} of ${supplierPage.total}. Type to narrow the list.` : undefined} />
          <SelectField label="Supplier" optional={v.method !== 'SUPPLIER_PCF'} required={v.method === 'SUPPLIER_PCF'} value={v.supplierId} onChange={set('supplierId')} placeholder="Choose a supplier" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
          <TextField className="sm:col-span-2" label="What was bought?" required placeholder="e.g. 40 tonnes of forged steel blanks" value={v.description} onChange={set('description')} />
          <NumberField label="Amount" required min="0" value={v.quantity} onChange={set('quantity')} />
          <SelectField label="Unit" required value={v.unit} onChange={set('unit')} placeholder="Choose" options={(rules.units || []).map((u) => ({ value: u.key, label: u.label }))} />
          {v.method === 'SPEND_BASED' && <NumberField label="Money spent" required unit="₹" min="0" value={v.spendInr} onChange={set('spendInr')} />}
          <TextField className="sm:col-span-2" label="Find the emission factor" optional placeholder="Type steel, plastic, paper…" value={v.q} onChange={set('q')} />
          <SelectField className="sm:col-span-2" label="Emission factor" required value={v.factorId} onChange={set('factorId')} placeholder="Choose the closest match" options={(factors?.items || []).map((f) => ({ value: f.id, label: `${f.name} (per ${unitName(f.canonicalUnit)})` }))} hint={factor ? `Amounts are converted to ${factor.canonicalUnit}.` : 'The factor turns the amount into emissions.'} />
        </FormGrid>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy} disabled={!pid || !v.description.trim() || v.quantity === '' || !v.unit || !v.factorId || (v.method === 'SUPPLIER_PCF' && !v.supplierId) || (v.method === 'SPEND_BASED' && v.spendInr === '')}>Save draft</Button></div>
      </form>
    </Dialog>
  );
}

export default function ValueChainSuppliersPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const send = useAction();
  const dialog = useDialog();
  const { data: periods } = useApi('/periods');
  const page = useForm('value-chain-page', { tab: 'suppliers', dlg: false, link: '', sPage: 1, sSize: 25, sq: '', pPage: 1, pSize: 25, pStatus: '' });
  const { tab, dlg, link, sPage, sSize, sq, pPage, pSize, pStatus } = page.values;
  const setTab = (v) => page.set('tab', v);
  const setDlg = (v) => page.set('dlg', v);
  const setLink = (v) => page.set('link', v);
  const q = useDebounce(sq, 300);
  const { data: sData } = useApi(tab === 'suppliers' ? `/suppliers?page=${sPage}&pageSize=${sSize}${q ? `&q=${encodeURIComponent(q)}` : ''}` : null);
  const { data: reqData } = useApi(tab === 'suppliers' ? '/supplier-requests?status=SUBMITTED&page=1&pageSize=50' : null);
  const { data: pData } = useApi(tab === 'purchases' ? `/scope3-purchases?page=${pPage}&pageSize=${pSize}${pStatus ? `&status=${pStatus}` : ''}` : null);
  const { data: reviewCount } = useApi('/scope3-purchases?page=1&pageSize=1&status=SUBMITTED');
  const suppliers = sData?.items || [];
  const purchases = pData?.items || [];
  const pending = (reqData?.items || []).map((r) => ({ ...r, supplierName: r.supplier?.name }));
  const toReview = { length: reviewCount?.total || 0 };

  const call = (path, method, body, ok) => send({ path, method, body: body || undefined, toast: ok });

  async function addSupplier() {
    const v = await dialog.form({ title: 'Add a supplier', submitLabel: 'Add supplier', fields: [
      { name: 'name', type: 'text', label: 'Supplier name', required: true }, { name: 'contactEmail', type: 'email', label: 'Contact email', required: true, hint: 'The person who can tell you the emissions of what they sell you.' },
      { name: 'category', type: 'text', label: 'What do they supply?', required: true, placeholder: 'e.g. Steel and forgings' },
      { name: 'tradeSharePct', type: 'number', label: 'Share of your purchases', unit: '%', hint: 'Suppliers above 2% have to be listed in your BRSR report.' }] });
    if (!v) return;
    call('/suppliers', 'POST', { name: v.name.trim(), contactEmail: v.contactEmail, category: v.category.trim(), tradeSharePct: v.tradeSharePct === '' ? undefined : Number(v.tradeSharePct), isTop2PctPartner: Number(v.tradeSharePct) >= 2 }, 'Supplier added.');
  }
  async function ask(s) {
    const v = await dialog.form({ title: `Ask ${s.name} for their carbon figure`, description: 'They get an email with a link and a one-time code. They do not need an account.', submitLabel: 'Send request', fields: [{ name: 'productDescription', type: 'text', label: 'Which product?', required: true, defaultValue: `${s.category}`, hint: 'e.g. Forged steel blanks, 12 mm' }] });
    if (!v) return;
    const r = await call(`/suppliers/${s.id}/pcf-requests`, 'POST', { productDescription: v.productDescription.trim() }, 'Request sent by email.');
    if (r?.portalPath) setLink(`${window.location.origin}${r.portalPath}`);
  }
  async function reviewPcf(r, decision) {
    let reviewNote;
    if (decision === 'REJECTED') { const v = await dialog.form({ title: 'Reject this figure', danger: true, submitLabel: 'Reject', fields: [{ name: 'note', type: 'textarea', label: 'What is wrong?', required: true, minLength: 5 }] }); if (!v) return; reviewNote = v.note; }
    call(`/supplier-requests/${r.id}/review`, 'PATCH', { decision, reviewNote }, decision === 'ACCEPTED' ? 'Accepted. It can now be used as an emission factor.' : 'Rejected.');
  }
  async function reviewPurchase(p, decision) {
    let reviewNote;
    if (decision === 'REJECTED') { const v = await dialog.form({ title: 'Send back for correction', submitLabel: 'Send back', fields: [{ name: 'note', type: 'textarea', label: 'What must be corrected?', required: true, minLength: 5 }] }); if (!v) return; reviewNote = v.note; }
    call(`/scope3-purchases/${p.id}/review`, 'POST', { decision, reviewNote }, decision === 'APPROVED' ? 'Approved.' : 'Sent back.');
  }
  async function remove(p) { if (await dialog.confirm({ title: 'Delete this draft?', message: p.description, confirmLabel: 'Delete', danger: true })) call(`/scope3-purchases/${p.id}`, 'DELETE', null, 'Deleted.'); }

  const TABS = [['suppliers', 'Suppliers'], ['purchases', `Supply-chain purchases${toReview.length ? ` (${toReview.length} to review)` : ''}`]];
  return (
    <div>
      <PageHeader title="Suppliers" description="Ask suppliers for their carbon figures and record what you buy from them." actions={tab === 'suppliers' ? <Button onClick={addSupplier}><Plus className="w-4 h-4" /> Add a supplier</Button> : <Button onClick={() => setDlg(true)}><Plus className="w-4 h-4" /> Add a purchase</Button>} />
      <div role="tablist" className="flex flex-wrap gap-1.5 mb-4">{TABS.map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`h-9 px-3.5 rounded-md text-sm font-medium border ${tab === id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-text border-line-strong hover:bg-brand-50'}`}>{l}</button>)}</div>
      {link && <Notice tone="ok" className="mb-4 flex-wrap gap-2"><span>Request sent. You can also share this link yourself: <strong className="select-all break-all">{link}</strong></span><button className="underline inline-flex items-center gap-1" onClick={() => { navigator.clipboard?.writeText(link); pushToast('Link copied.'); }}><Copy className="w-3.5 h-3.5" />Copy</button></Notice>}

      {tab === 'suppliers' && <div className="space-y-4">
        {pending.length > 0 && <Card title={`Figures waiting for your review (${pending.length})`} padded={false}><ul className="divide-y divide-line">{pending.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3"><div className="flex-1 min-w-[12rem]"><div className="font-medium">{r.supplierName}: {r.productDescription}</div><div className="text-sm text-muted tabular-nums">{fmtNum(r.submittedFactorVal, 4)} kg CO₂e per {r.submittedUnit}</div></div><Button size="sm" onClick={() => reviewPcf(r, 'ACCEPTED')}>Accept</Button><Button size="sm" variant="secondary" onClick={() => reviewPcf(r, 'REJECTED')}>Reject</Button></li>)}</ul></Card>}
        <Card padded={false}><div className="p-3 border-b border-line"><TextField label="Search suppliers" value={sq} onChange={(x) => { page.set('sq', x); page.set('sPage', 1); }} placeholder="Name, product or e-mail" /></div>{!sData ? <div className="h-24 animate-pulse" /> : suppliers.length === 0 ? (sq ? <EmptyState title="No supplier matches">Try a different name.</EmptyState> : <EmptyState title="No suppliers yet" action={<Button onClick={addSupplier}>Add your first supplier</Button>}>Add the suppliers whose products you buy most.</EmptyState>) : (
          <ul className="divide-y divide-line">{suppliers.map((s) => { const last = (s.requests || [])[0]; return <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3"><div className="flex-1 min-w-[12rem]"><div className="font-medium">{s.name}</div><div className="text-sm text-muted">{s.category} · {s.contactEmail}{s.tradeSharePct != null ? ` · ${fmtNum(s.tradeSharePct, 1)}% of purchases` : ''}</div></div>{s.approvedFactorId && <StatusBadge status="ACTIVE" label="Has own figure" />}{last && !s.approvedFactorId && <StatusBadge status={last.status} label={REQ[last.status] || last.status} />}<Button size="sm" variant="secondary" onClick={() => ask(s)}>Ask for figure</Button></li>; })}</ul>)}{sData && <Pager page={sPage} pageSize={sSize} total={sData.total} totalPages={sData.totalPages} onPage={(x) => page.set('sPage', x)} onPageSize={(x) => { page.set('sSize', x); page.set('sPage', 1); }} />}</Card>
      </div>}

      {tab === 'purchases' && <Card padded={false}><div className="p-3 border-b border-line"><SelectField label="Show" value={pStatus} onChange={(x) => { page.set('pStatus', x); page.set('pPage', 1); }} placeholder="Everything" options={Object.entries(ENTRY_STATUS).map(([k, l]) => ({ value: k, label: l }))} /></div>{!pData ? <div className="h-24 animate-pulse" /> : purchases.length === 0 ? <EmptyState title="No purchases recorded" action={<Button onClick={() => setDlg(true)}>Add a purchase</Button>}>Record the big things you buy so their emissions are counted.</EmptyState> : (
        <ul className="divide-y divide-line">{purchases.map((p) => <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3"><div className="flex-1 min-w-[14rem]"><div className="font-medium">{p.description}</div><div className="text-sm text-muted">{p.period?.label} · {SCOPE3_CATEGORY[p.scope3Category]} · {SCOPE3_METHOD[p.method]}{p.supplier ? ` · ${p.supplier.name}` : ''}</div>{p.status === 'REJECTED' && p.reviewNote && <div className="text-sm text-danger-600 mt-0.5">Sent back: {p.reviewNote}</div>}</div><div className="text-right tabular-nums"><div className="font-medium">{fmtNum(p.calculatedTco2eAr6, 2)}</div><div className="text-xs text-muted">tCO₂e</div></div><StatusBadge status={p.status} label={ENTRY_STATUS[p.status]} />
          {['DRAFT', 'REJECTED'].includes(p.status) && <><Button size="sm" onClick={() => call(`/scope3-purchases/${p.id}/submit`, 'POST', null, 'Sent for review.')}>Send for review</Button><Button size="sm" variant="secondary" onClick={() => remove(p)}>Delete</Button></>}
          {p.status === 'SUBMITTED' && p.enteredById !== user?.id && user?.roles?.some((r) => ['SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER'].includes(r)) && <><Button size="sm" onClick={() => reviewPurchase(p, 'APPROVED')}>Approve</Button><Button size="sm" variant="secondary" onClick={() => reviewPurchase(p, 'REJECTED')}>Send back</Button></>}</li>)}</ul>)}{pData && <Pager page={pPage} pageSize={pSize} total={pData.total} totalPages={pData.totalPages} onPage={(x) => page.set('pPage', x)} onPageSize={(x) => { page.set('pSize', x); page.set('pPage', 1); }} />}</Card>}
      <PurchaseDialog open={dlg} onClose={() => setDlg(false)} periods={periods || []} />
    </div>
  );
}
