import { useState } from 'react';
import { CircleDollarSign, Layers, Receipt, Users, CheckCircle2, Clock, Plus, Pencil, Archive, ArchiveRestore, Save } from 'lucide-react';
import { useZodForm } from '../../../hooks/useZodForm';
import { planSchema } from '../../../schemas/formSchemas';
import { useAdminPlans, useAdminSubscriptions, useAdminMutations } from '../../../hooks/useAdminData';
import { Card, CardHeader } from '../../../components/ui/Card';
import { SummaryCard } from '../../../components/ui/SummaryCard';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { Drawer } from '../../../components/ui/Drawer';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { FormField, TextInput, TextArea, Select } from '../../../components/ui/FormField';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { fmtDate, fmtMoney } from '../../../utils/format';

const lim = (n) => (n >= 999 ? 'Unlimited' : n);

export function RevenueManagementPage() {
  const [tab, setTab] = useState('plans');
  const { data: plans = [] } = useAdminPlans();
  const { data: subs = [] } = useAdminSubscriptions();
  const paying = subs.filter((s) => s.status === 'ACTIVE' && (s.pricePerCycle ?? 0) > 0).length;
  const invoiced = subs.reduce((n, s) => n + s.invoicedTotal, 0);

  return (
    <div>
      <PageHeader subtitle="Plans, pricing, and every organization’s subscription." />
      <div className="summary-grid">
        <SummaryCard icon={Receipt} label="Subscriptions" value={subs.length} />
        <SummaryCard icon={CheckCircle2} label="Active & paying" value={paying} />
        <SummaryCard icon={Clock} label="On trial" value={subs.filter((s) => s.status === 'TRIAL').length} />
        <SummaryCard icon={CircleDollarSign} label="Total invoiced" value={fmtMoney(invoiced)} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'plans', label: 'Plans', icon: Layers, count: plans.length }, { value: 'subs', label: 'Subscriptions', icon: Users, count: subs.length }]} />
      {tab === 'plans' ? <Plans plans={plans} /> : <Subscriptions subs={subs} />}
    </div>
  );
}

function Plans({ plans }) {
  const { createPlan, updatePlan } = useAdminMutations();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null); // plan | 'new'
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useZodForm(planSchema, { name: '', description: '', priceMonthly: '', priceAnnual: '', maxDepartments: '', maxUsers: '', maxResourceTypes: '', reportFrequency: 'monthly' });
  const [serverError, setServerError] = useState(null);

  const open = (p) => {
    setEditing(p); setServerError(null);
    // Inputs hold text, so numbers go into the form as strings.
    reset(p === 'new'
      ? { name: '', description: '', maxDepartments: '5', maxUsers: '25', maxResourceTypes: '10', reportFrequency: 'monthly', priceMonthly: '0', priceAnnual: '0' }
      : { name: p.name, description: p.description ?? '', maxDepartments: String(p.maxDepartments), maxUsers: String(p.maxUsers), maxResourceTypes: String(p.maxResourceTypes), reportFrequency: p.reportFrequency, priceMonthly: String(p.priceMonthly), priceAnnual: String(p.priceAnnual) });
  };
  const onSubmit = async (v) => {
    setServerError(null);
    const isNew = editing === 'new';
    const ok = await confirm({
      title: isNew ? `Create the ${v.name.trim()} plan?` : `Save changes to ${editing.name}?`,
      message: isNew ? 'The plan becomes available to organizations straight away.' : `This applies to every subscriber on the ${editing.name} plan (${editing.subscribers}).`,
      confirmLabel: isNew ? 'Create plan' : 'Save changes',
      icon: Save,
    });
    if (!ok) return;
    const payload = { name: v.name.trim(), description: (v.description ?? '').trim(), maxDepartments: Number(v.maxDepartments), maxUsers: Number(v.maxUsers), maxResourceTypes: Number(v.maxResourceTypes), reportFrequency: v.reportFrequency, priceMonthly: Number(v.priceMonthly), priceAnnual: Number(v.priceAnnual) };
    try {
      if (editing === 'new') await createPlan.mutateAsync(payload); else await updatePlan.mutateAsync({ id: editing.id, payload });
      showToast(editing === 'new' ? 'Plan created.' : 'Plan updated.', 'success'); setEditing(null);
    } catch (e) { setServerError(e instanceof ApiError ? e.message : 'Something went wrong.'); }
  };
  const toggleActive = async (p) => {
    const ok = await confirm({
      title: p.isActive ? `Retire ${p.name}?` : `Restore ${p.name}?`,
      message: p.isActive ? 'New organizations will no longer be able to pick this plan. Existing subscribers keep it.' : 'Organizations will be able to choose this plan again.',
      confirmLabel: p.isActive ? 'Retire plan' : 'Restore plan',
      danger: p.isActive,
      icon: p.isActive ? Archive : ArchiveRestore,
    });
    if (!ok) return;
    try { await updatePlan.mutateAsync({ id: p.id, payload: { isActive: !p.isActive } }); showToast(p.isActive ? 'Plan retired — existing subscribers keep it.' : 'Plan is available again.', 'success'); }
    catch (e) { showToast(e instanceof ApiError ? e.message : 'Something went wrong.', 'error'); }
  };

  return (
    <Card padded={false}>
      <div style={{ padding: 'var(--space-5)' }}><CardHeader icon={Layers} title="Plans" subtitle="Changes apply to every subscriber on the plan. Retiring a plan hides it from new sign-ups only." actions={<Button icon={Plus} onClick={() => open('new')}>New plan</Button>} /></div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Plan</th><th className="num">Monthly</th><th className="num">Annual</th><th className="num">Departments</th><th className="num">Users</th><th className="num">Resource types</th><th>Reports</th><th className="num">Subscribers</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong>{p.description && <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)', maxWidth: 320 }}>{p.description}</div>}</td>
                <td className="num">{fmtMoney(p.priceMonthly)}</td><td className="num">{fmtMoney(p.priceAnnual)}</td>
                <td className="num">{lim(p.maxDepartments)}</td><td className="num">{lim(p.maxUsers)}</td><td className="num">{lim(p.maxResourceTypes)}</td>
                <td>{p.reportFrequency}</td><td className="num">{p.subscribers}</td>
                <td><StatusBadge status={p.isActive ? 'ACTIVE' : 'SUSPENDED'} label={p.isActive ? 'Available' : 'Retired'} /></td>
                <td><div className="row-actions" style={{ justifyContent: 'flex-end' }}><Button variant="ghost" size="sm" icon={Pencil} onClick={() => open(p)}>Edit</Button><Button variant="ghost" size="sm" icon={p.isActive ? Archive : ArchiveRestore} onClick={() => toggleActive(p)}>{p.isActive ? 'Retire' : 'Restore'}</Button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'New plan' : `Edit ${editing?.name}`} width={460}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField label="Name" error={errors.name} required><TextInput placeholder="e.g. Business" error={errors.name} {...register('name')} /></FormField>
          <FormField label="Description" error={errors.description} hint="One line shown to organizations when they choose a plan. Up to 200 characters."><TextArea rows={2} maxLength={200} placeholder="e.g. For growing teams with several departments." error={errors.description} {...register('description')} /></FormField>
          <div className="split-2">
            <FormField label="Monthly price ($)" error={errors.priceMonthly} required><TextInput type="number" inputMode="decimal" step="any" min="0" placeholder="0.00" error={errors.priceMonthly} {...register('priceMonthly')} /></FormField>
            <FormField label="Annual price ($)" error={errors.priceAnnual} required><TextInput type="number" inputMode="decimal" step="any" min="0" placeholder="0.00" error={errors.priceAnnual} {...register('priceAnnual')} /></FormField>
            <FormField label="Max departments" error={errors.maxDepartments} required hint="999 = unlimited"><TextInput type="number" inputMode="numeric" step="1" min="1" max="999" placeholder="5" error={errors.maxDepartments} {...register('maxDepartments')} /></FormField>
            <FormField label="Max users" error={errors.maxUsers} required><TextInput type="number" inputMode="numeric" step="1" min="1" max="999" placeholder="25" error={errors.maxUsers} {...register('maxUsers')} /></FormField>
            <FormField label="Max resource types" error={errors.maxResourceTypes} required><TextInput type="number" inputMode="numeric" step="1" min="1" max="999" placeholder="10" error={errors.maxResourceTypes} {...register('maxResourceTypes')} /></FormField>
            <FormField label="Report frequency" required><Select error={errors.reportFrequency} {...register('reportFrequency')}><option value="monthly">Monthly</option><option value="weekly">Weekly</option></Select></FormField>
          </div>
          {serverError && <p className="auth-error" role="alert">{serverError}</p>}
          <Button type="submit" icon={editing === 'new' ? Plus : Save} loading={isSubmitting}>{editing === 'new' ? 'Create plan' : 'Save changes'}</Button>
        </form>
      </Drawer>
    </Card>
  );
}

function Subscriptions({ subs }) {
  const [status, setStatus] = useState('');
  const shown = subs.filter((s) => !status || s.status === status);
  return (
    <Card padded={false}>
      <div style={{ padding: 'var(--space-5)' }}>
        <CardHeader icon={Receipt} title="Organization subscriptions" subtitle="Organizations change their own plan from their Billing page." />
        <div className="filters" style={{ marginBottom: 0 }}>
          <FormField label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}</Select></FormField>
        </div>
      </div>
      {shown.length === 0 ? <EmptyState icon={Receipt} title="No subscriptions" /> : (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Organization</th><th>Plan</th><th>Status</th><th>Cycle</th><th className="num">Price</th><th>Renews</th><th className="num">Invoices</th><th className="num">Invoiced</th></tr></thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.organizationName}</strong></td><td>{s.planName}</td>
                  <td><StatusBadge status={s.status === 'ACTIVE' ? 'ACTIVE' : s.status === 'TRIAL' ? 'PENDING_APPROVAL' : 'SUSPENDED'} label={s.status.replace('_', ' ').toLowerCase()} /></td>
                  <td>{s.cycle.toLowerCase()}</td><td className="num">{fmtMoney(s.pricePerCycle)}</td><td>{fmtDate(s.renewalDate)}</td>
                  <td className="num">{s.invoiceCount}</td><td className="num">{fmtMoney(s.invoicedTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

