import { useState } from 'react';
import {
  CircleDollarSign,
  Layers,
  Receipt,
  Users,
  CheckCircle2,
  Clock,
  Plus,
  Save,
  LayoutGrid,
  Table as TableIcon,
  ArrowRightLeft,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Check,
  Building,
  Zap,
  Archive,
  ArchiveRestore,
  Trash2,
} from 'lucide-react';
import { useZodForm } from '../../../hooks/useZodForm';
import { planSchema } from '../../../schemas/formSchemas';
import {
  useAdminPlans,
  useAdminSubscriptions,
  useAdminInvoices,
  useAdminMutations,
} from '../../../hooks/useAdminData';
import { Card, CardHeader } from '../../../components/ui/Card';
import { SummaryCard } from '../../../components/ui/SummaryCard';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { Drawer } from '../../../components/ui/Drawer';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { FormField, TextInput, TextArea, Select } from '../../../components/ui/FormField';
import { Checkbox } from '../../../components/ui/Checkbox';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { fmtDate, fmtMoney, fmtRange } from '../../../utils/format';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { PLATFORM_ROLES } from '../../../constants/roles';

const lim = (n) => (n >= 999 ? 'Unlimited' : n);
const fail = (showToast) => (err) =>
  showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');

export function RevenueManagementPage() {
  const [tab, setTab] = useState('plans');
  const { data: plans = [] } = useAdminPlans();
  const { data: subs = [] } = useAdminSubscriptions();
  const { data: invoices = [] } = useAdminInvoices();

  // Financial calculations
  const activeSubs = subs.filter((s) => s.status === 'ACTIVE');
  const payingSubs = activeSubs.filter((s) => (s.pricePerCycle ?? 0) > 0);
  const trialingSubs = subs.filter((s) => s.status === 'TRIAL');
  const pastDueSubs = subs.filter((s) => s.status === 'PAST_DUE');

  // Live MRR (Monthly Recurring Revenue)
  const totalMrr = activeSubs.reduce((sum, s) => {
    if (s.mrr != null) return sum + s.mrr;
    const plan = plans.find((p) => p.id === s.planId);
    if (!plan) return sum;
    return sum + (s.cycle === 'ANNUAL' ? plan.priceAnnual / 12 : plan.priceMonthly);
  }, 0);

  const totalArr = totalMrr * 12;
  const arpu = payingSubs.length > 0 ? totalMrr / payingSubs.length : 0;
  const lifetimeInvoiced = invoices.reduce((sum, i) => sum + (i.amount ?? 0), 0);
  const atRiskMrr = pastDueSubs.reduce((sum, s) => {
    const plan = plans.find((p) => p.id === s.planId);
    if (!plan) return sum;
    return sum + (s.cycle === 'ANNUAL' ? plan.priceAnnual / 12 : plan.priceMonthly);
  }, 0);

  return (
    <div>
      <PageHeader
        subtitle="Manage product tiers, track live MRR/ARR financial metrics, oversee customer subscriptions, and audit billing ledger transactions."
      />

      {/* Real-World SaaS Executive Financial Metrics */}
      <div className="summary-grid">
        <SummaryCard icon={TrendingUp} label="Monthly Recurring Revenue (MRR)" value={fmtMoney(totalMrr)}>
          <span className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
            ARR: {fmtMoney(totalArr)}
          </span>
        </SummaryCard>
        <SummaryCard icon={Users} label="Paying Subscriptions" value={payingSubs.length}>
          <span className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
            {activeSubs.length} active · {trialingSubs.length} trial
          </span>
        </SummaryCard>
        <SummaryCard icon={CircleDollarSign} label="Avg Revenue Per Account (ARPU)" value={fmtMoney(arpu)}>
          <span className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
            per active paying org
          </span>
        </SummaryCard>
        <SummaryCard icon={Receipt} label="Lifetime Invoiced" value={fmtMoney(lifetimeInvoiced)}>
          {pastDueSubs.length > 0 ? (
            <span style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
              {pastDueSubs.length} past due ({fmtMoney(atRiskMrr)} at risk)
            </span>
          ) : (
            <span className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
              {invoices.length} total invoice{invoices.length === 1 ? '' : 's'}
            </span>
          )}
        </SummaryCard>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'plans', label: 'Plans & Pricing Tiers', icon: Layers, count: plans.length },
          { value: 'subs', label: 'Customer Subscriptions', icon: Users, count: subs.length },
          { value: 'invoices', label: 'Billing Ledger & Invoices', icon: Receipt, count: invoices.length },
        ]}
      />

      {tab === 'plans' && <Plans plans={plans} subs={subs} />}
      {tab === 'subs' && <Subscriptions subs={subs} plans={plans} />}
      {tab === 'invoices' && <InvoicesLedger invoices={invoices} />}
    </div>
  );
}

// ============================================================================
// 1. Plans & Product Tiers (Real-World Cards + Dense Matrix + Full CRUD)
// ============================================================================
function Plans({ plans, subs }) {
  const { createPlan, updatePlan, deletePlan } = useAdminMutations();
  const { admin } = useAdminAuth();
  const canEditPlans = admin?.role === PLATFORM_ROLES.SUPER_ADMIN;
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'annual'
  const [editing, setEditing] = useState(null); // plan | 'new'

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useZodForm(planSchema, {
    name: '',
    description: '',
    priceMonthly: '',
    priceAnnual: '',
    maxDepartments: '',
    maxUsers: '',
    maxResourceTypes: '',
    reportFrequency: 'monthly',
  });
  const [serverError, setServerError] = useState(null);

  const openForm = (p) => {
    setEditing(p);
    setServerError(null);
    reset(
      p === 'new'
        ? {
            name: '',
            description: '',
            maxDepartments: '5',
            maxUsers: '25',
            maxResourceTypes: '10',
            reportFrequency: 'monthly',
            priceMonthly: '0',
            priceAnnual: '0',
          }
        : {
            name: p.name,
            description: p.description ?? '',
            maxDepartments: String(p.maxDepartments),
            maxUsers: String(p.maxUsers),
            maxResourceTypes: String(p.maxResourceTypes),
            reportFrequency: p.reportFrequency,
            priceMonthly: String(p.priceMonthly),
            priceAnnual: String(p.priceAnnual),
          },
    );
  };

  const onSubmit = async (v) => {
    setServerError(null);
    const isNew = editing === 'new';

    const payload = {
      name: v.name.trim(),
      description: (v.description ?? '').trim() || null,
      maxDepartments: Number(v.maxDepartments),
      maxUsers: Number(v.maxUsers),
      maxResourceTypes: Number(v.maxResourceTypes),
      reportFrequency: v.reportFrequency,
      priceMonthly: Number(v.priceMonthly),
      priceAnnual: Number(v.priceAnnual),
    };

    try {
      if (isNew) {
        await createPlan.mutateAsync(payload);
        showToast(`Plan “${payload.name}” created successfully.`, 'success');
      } else {
        await updatePlan.mutateAsync({ id: editing.id, payload });
        showToast(`Plan “${payload.name}” updated successfully.`, 'success');
      }
      setEditing(null);
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : 'Something went wrong.');
    }
  };

  const toggleActive = async (p) => {
    const isRetiring = p.isActive;
    const ok = await confirm({
      title: isRetiring ? `Retire plan “${p.name}”?` : `Restore plan “${p.name}”?`,
      message: isRetiring
        ? 'New organizations will no longer be able to select this plan. Existing subscribers retain access to their plan without interruption.'
        : 'Organizations will be able to select and switch to this plan again in the organization portal.',
      confirmLabel: isRetiring ? 'Retire plan' : 'Restore plan',
      cancelLabel: 'Cancel',
      danger: isRetiring,
      icon: isRetiring ? Archive : ArchiveRestore,
    });
    if (!ok) return;

    try {
      await updatePlan.mutateAsync({ id: p.id, payload: { isActive: !p.isActive } });
      showToast(isRetiring ? `Plan “${p.name}” retired (hidden from new sign-ups).` : `Plan “${p.name}” restored to catalog.`, 'success');
    } catch (e) {
      fail(showToast)(e);
    }
  };

  const handleDeletePlan = async (p) => {
    const subCount = p.subscribers ?? 0;
    if (subCount > 0) {
      await confirm({
        title: `Cannot delete plan “${p.name}”`,
        message: `This plan has ${subCount} active subscriber organization(s). To protect accounting records and subscriber access, plans with active subscribers cannot be permanently deleted. You can Retire this plan instead to hide it from new sign-ups while grandfathering existing subscribers.`,
        confirmLabel: 'Understood',
        cancelLabel: 'Close',
        icon: AlertTriangle,
      });
      return;
    }

    const ok = await confirm({
      title: `Permanently delete plan “${p.name}”?`,
      message: 'This plan has no active subscribers and will be completely removed from the catalog. This action cannot be undone.',
      confirmLabel: 'Delete plan permanently',
      cancelLabel: 'Cancel',
      danger: true,
      icon: Trash2,
    });
    if (!ok) return;

    try {
      await deletePlan.mutateAsync(p.id);
      showToast(`Plan “${p.name}” deleted permanently.`, 'success');
    } catch (e) {
      fail(showToast)(e);
    }
  };

  return (
    <Card padded={false}>
      <div style={{ padding: 'var(--space-5)' }}>
        <CardHeader
          icon={Layers}
          title="Product plans & subscription tiers"
          subtitle="Tier limits determine platform quotas. Changes preserve dependencies and grandfather active subscribers when retired."
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              {/* View Mode Toggle */}
              <div style={{ display: 'inline-flex', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', padding: 3 }}>
                <button
                  type="button"
                  className={`btn btn--sm ${viewMode === 'cards' ? 'btn--primary' : 'btn--ghost'}`}
                  style={{ padding: '4px 10px', fontSize: 'var(--font-size-xs)' }}
                  onClick={() => setViewMode('cards')}
                  title="Product Cards View"
                >
                  <LayoutGrid size={14} style={{ marginRight: 6 }} /> Cards
                </button>
                <button
                  type="button"
                  className={`btn btn--sm ${viewMode === 'table' ? 'btn--primary' : 'btn--ghost'}`}
                  style={{ padding: '4px 10px', fontSize: 'var(--font-size-xs)' }}
                  onClick={() => setViewMode('table')}
                  title="Matrix Table View"
                >
                  <TableIcon size={14} style={{ marginRight: 6 }} /> Matrix
                </button>
              </div>

              {/* Annual / Monthly Toggle for visual cards */}
              {viewMode === 'cards' && (
                <div style={{ display: 'inline-flex', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', padding: 3 }}>
                  <button
                    type="button"
                    className={`btn btn--sm ${billingCycle === 'monthly' ? 'btn--secondary' : 'btn--ghost'}`}
                    style={{ padding: '4px 10px', fontSize: 'var(--font-size-xs)' }}
                    onClick={() => setBillingCycle('monthly')}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    className={`btn btn--sm ${billingCycle === 'annual' ? 'btn--secondary' : 'btn--ghost'}`}
                    style={{ padding: '4px 10px', fontSize: 'var(--font-size-xs)' }}
                    onClick={() => setBillingCycle('annual')}
                  >
                    Annual <span style={{ color: 'var(--color-success)', fontWeight: 600, marginLeft: 4 }}>-17%</span>
                  </button>
                </div>
              )}

              {canEditPlans && (
                <Button icon={Plus} size="sm" onClick={() => openForm('new')}>
                  New plan
                </Button>
              )}
            </div>
          }
        />
      </div>

      {plans.length === 0 && <EmptyState icon={Layers} title="No plans configured" />}

      {/* Visual Product Tier Cards (Real World SaaS Pricing Cards) */}
      {viewMode === 'cards' && plans.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 'var(--space-4)',
            padding: '0 var(--space-5) var(--space-5)',
          }}
        >
          {plans.map((p) => {
            const isAnnual = billingCycle === 'annual';
            const price = isAnnual ? p.priceAnnual : p.priceMonthly;
            const priceFormatted = price === 0 ? 'Free' : fmtMoney(price);
            const periodLabel = price === 0 ? 'Forever' : isAnnual ? '/year' : '/month';
            const subCount = p.subscribers ?? 0;
            const isGrowth = p.name.toLowerCase().includes('growth');
            const isRetired = !p.isActive;

            return (
              <div
                key={p.id}
                style={{
                  border: isGrowth ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-bg-primary)',
                  padding: 'var(--space-5)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  opacity: isRetired ? 0.78 : 1,
                  boxShadow: isGrowth ? '0 4px 16px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {/* Header Section */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>{p.name}</h3>
                      {isGrowth && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: 'var(--color-primary)',
                            color: '#fff',
                            padding: '2px 8px',
                            borderRadius: '12px',
                          }}
                        >
                          Popular
                        </span>
                      )}
                    </div>
                    <StatusBadge
                      status={p.isActive ? 'ACTIVE' : 'SUPERSEDED'}
                      label={p.isActive ? 'Available' : 'Retired'}
                    />
                  </div>

                  <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)', minHeight: 40, margin: '0 0 var(--space-3)' }}>
                    {p.description || 'Standard corporate greenhouse gas accounting tier.'}
                  </p>

                  {/* Price Banner */}
                  <div style={{ margin: 'var(--space-2) 0 var(--space-4)', display: 'flex', alignItems: 'baseline', gap: 'var(--space-1)' }}>
                    <span style={{ fontSize: '28px', fontWeight: 800 }}>{priceFormatted}</span>
                    <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                      {periodLabel}
                    </span>
                    {isAnnual && price > 0 && p.priceMonthly > 0 && (
                      <span
                        className="text-muted"
                        style={{ fontSize: 'var(--font-size-xs)', marginLeft: 'var(--space-2)' }}
                      >
                        ({fmtMoney(price / 12)}/mo billed annually)
                      </span>
                    )}
                  </div>

                  {/* Feature & Limits Checklist */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                      Plan Entitlements & Quotas
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <Check size={16} color="var(--color-success)" />
                        <span>
                          <strong>{lim(p.maxUsers)}</strong> team user account{p.maxUsers === 1 ? '' : 's'}
                        </span>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <Check size={16} color="var(--color-success)" />
                        <span>
                          <strong>{lim(p.maxDepartments)}</strong> tracked department{p.maxDepartments === 1 ? '' : 's'}
                        </span>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <Check size={16} color="var(--color-success)" />
                        <span>
                          <strong>{lim(p.maxResourceTypes)}</strong> measurable resource stream{p.maxResourceTypes === 1 ? '' : 's'}
                        </span>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <Check size={16} color="var(--color-success)" />
                        <span>
                          <strong>{p.reportFrequency === 'weekly' ? 'Weekly' : 'Monthly'}</strong> compliance review cycle
                        </span>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <Check size={16} color="var(--color-success)" />
                        <span>Scope 1, 2, 3 conversion & audit logging</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Footer Section: Subscriber Counts & Actions */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-3)' }}>
                    <span className="text-muted">Subscribers: <strong>{subCount}</strong></span>
                    <span className="text-muted">Tier MRR: <strong>{fmtMoney(p.planMrr ?? 0)}/mo</strong></span>
                  </div>

                  {canEditPlans && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openForm(p)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant={p.isActive ? 'ghost-warning' : 'ghost-success'}
                        size="sm"
                        onClick={() => toggleActive(p)}
                      >
                        {p.isActive ? 'Retire' : 'Restore'}
                      </Button>
                      <Button
                        variant="ghost-danger"
                        size="sm"
                        onClick={() => handleDeletePlan(p)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dense Matrix Table View */}
      {viewMode === 'table' && plans.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Plan Name</th>
                <th className="num">Monthly</th>
                <th className="num">Annual</th>
                <th className="num">Departments</th>
                <th className="num">Users</th>
                <th className="num">Resource types</th>
                <th>Reports</th>
                <th className="num">Subscribers</th>
                <th className="num">Tier MRR</th>
                <th>Status</th>
                <th style={{ width: 140, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const subCount = p.subscribers ?? 0;
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      {p.description && (
                        <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)', maxWidth: 260 }}>
                          {p.description}
                        </div>
                      )}
                    </td>
                    <td className="num">{fmtMoney(p.priceMonthly)}</td>
                    <td className="num">{fmtMoney(p.priceAnnual)}</td>
                    <td className="num">{lim(p.maxDepartments)}</td>
                    <td className="num">{lim(p.maxUsers)}</td>
                    <td className="num">{lim(p.maxResourceTypes)}</td>
                    <td>{p.reportFrequency}</td>
                    <td className="num">{subCount}</td>
                    <td className="num">{fmtMoney(p.planMrr ?? 0)}</td>
                    <td>
                      <StatusBadge
                        status={p.isActive ? 'ACTIVE' : 'SUPERSEDED'}
                        label={p.isActive ? 'Available' : 'Retired'}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {canEditPlans && (
                        <div className="row-actions" style={{ justifyContent: 'flex-end', display: 'flex', gap: 'var(--space-1)' }}>
                          <Button variant="ghost-info" size="sm" onClick={() => openForm(p)}>
                            Edit
                          </Button>
                          <Button
                            variant={p.isActive ? 'ghost-warning' : 'ghost-success'}
                            size="sm"
                            onClick={() => toggleActive(p)}
                          >
                            {p.isActive ? 'Retire' : 'Restore'}
                          </Button>
                          <Button
                            variant="ghost-danger"
                            size="sm"
                            onClick={() => handleDeletePlan(p)}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer: Plan Create / Edit */}
      <Drawer
        key={editing === 'new' ? 'new' : editing?.id}
        variant="modal"
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Create new product plan tier' : `Edit plan · ${editing?.name}`}
        width={480}
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField label="Plan name" error={errors.name} required>
            <TextInput placeholder="e.g. Professional" error={errors.name} {...register('name')} />
          </FormField>
          <FormField
            label="Target audience / description"
            error={errors.description}
            hint="Shown on the customer plan picker. Summarize who this tier is built for."
          >
            <TextArea
              rows={2}
              maxLength={200}
              placeholder="e.g. For scaling companies with multi-department ESG reporting and monthly compliance review."
              error={errors.description}
              {...register('description')}
            />
          </FormField>

          <div className="split-2">
            <FormField label="Monthly price ($ USD)" error={errors.priceMonthly} required>
              <TextInput
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                placeholder="199.00"
                error={errors.priceMonthly}
                {...register('priceMonthly')}
              />
            </FormField>
            <FormField label="Annual price ($ USD)" error={errors.priceAnnual} required hint="Annual prepayment rate">
              <TextInput
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                placeholder="1990.00"
                error={errors.priceAnnual}
                {...register('priceAnnual')}
              />
            </FormField>

            <FormField
              label="Max departments"
              error={errors.maxDepartments}
              required
              hint="999 = unlimited organization units"
            >
              <TextInput
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                max="999"
                placeholder="15"
                error={errors.maxDepartments}
                {...register('maxDepartments')}
              />
            </FormField>
            <FormField label="Max team users" error={errors.maxUsers} required hint="999 = unlimited users">
              <TextInput
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                max="999"
                placeholder="50"
                error={errors.maxUsers}
                {...register('maxUsers')}
              />
            </FormField>

            <FormField
              label="Max resource types"
              error={errors.maxResourceTypes}
              required
              hint="999 = unlimited streams"
            >
              <TextInput
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                max="999"
                placeholder="20"
                error={errors.maxResourceTypes}
                {...register('maxResourceTypes')}
              />
            </FormField>
            <FormField label="Report compliance frequency" required>
              <Select error={errors.reportFrequency} {...register('reportFrequency')}>
                <option value="monthly">Monthly review</option>
                <option value="weekly">Weekly fast-track</option>
              </Select>
            </FormField>
          </div>

          {serverError && (
            <div
              style={{
                padding: 'var(--space-3)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--color-danger)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-danger)',
                fontSize: 'var(--font-size-sm)',
                marginBottom: 'var(--space-4)',
              }}
            >
              <AlertTriangle size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              {serverError}
            </div>
          )}

          <Button type="submit" icon={editing === 'new' ? Plus : Save} loading={isSubmitting}>
            {editing === 'new' ? 'Create plan tier' : 'Save plan changes'}
          </Button>
        </form>
      </Drawer>
    </Card>
  );
}

// ============================================================================
// 2. Customer Subscriptions (Plan assignment, cycle switch, status manager)
// ============================================================================
function Subscriptions({ subs, plans }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [search, setSearch] = useState('');
  const [managingSub, setManagingSub] = useState(null);
  const [viewingInvoicesSub, setViewingInvoicesSub] = useState(null);

  const filtered = subs.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (planFilter && s.planId !== planFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchOrg = s.organizationName?.toLowerCase().includes(q);
      const matchOwner = s.ownerName?.toLowerCase().includes(q) || s.ownerEmail?.toLowerCase().includes(q);
      if (!matchOrg && !matchOwner) return false;
    }
    return true;
  });

  return (
    <Card padded={false}>
      <div style={{ padding: 'var(--space-5)' }}>
        <CardHeader
          icon={Receipt}
          title="Customer subscriptions & recurring billing"
          subtitle="Manage active customer accounts, reassign plan tiers, switch billing cycles, and view invoice histories."
        />
        <div className="filters" style={{ marginBottom: 0 }}>
          <FormField label="Search customer">
            <TextInput
              placeholder="Organization or owner…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </FormField>
          <FormField label="Plan tier">
            <Select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
              <option value="">All plans</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Subscription status">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active (Paying)</option>
              <option value="TRIAL">Trial</option>
              <option value="PAST_DUE">Past due (At risk)</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="EXPIRED">Expired</option>
            </Select>
          </FormField>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Receipt} title="No subscriptions match current filters" />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Organization & Owner</th>
                <th>Plan Tier</th>
                <th>Status</th>
                <th>Cycle</th>
                <th className="num">MRR</th>
                <th className="num">Price / Cycle</th>
                <th>Next Renewal</th>
                <th className="num">Invoices</th>
                <th className="num">Total Invoiced</th>
                <th style={{ width: 130, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.organizationName}</strong>
                    {s.ownerName && (
                      <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                        {s.ownerName} {s.ownerEmail ? `(${s.ownerEmail})` : ''}
                      </div>
                    )}
                  </td>
                  <td>
                    <strong>{s.planName}</strong>
                  </td>
                  <td>
                    <StatusBadge
                      status={s.status === 'ACTIVE' ? 'ACTIVE' : s.status === 'TRIAL' ? 'TRIAL' : s.status === 'PAST_DUE' ? 'CHANGES_REQUESTED' : 'REJECTED'}
                      label={s.status.replace('_', ' ').toLowerCase()}
                    />
                  </td>
                  <td>
                    <span style={{ textTransform: 'capitalize' }}>{s.cycle.toLowerCase()}</span>
                  </td>
                  <td className="num">
                    <strong>{fmtMoney(s.mrr ?? 0)}/mo</strong>
                  </td>
                  <td className="num">{fmtMoney(s.pricePerCycle)}</td>
                  <td>{s.renewalDate ? fmtDate(s.renewalDate) : '—'}</td>
                  <td className="num">{s.invoiceCount}</td>
                  <td className="num">{fmtMoney(s.invoicedTotal)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row-actions" style={{ justifyContent: 'flex-end', display: 'flex', gap: 'var(--space-1)' }}>
                      <Button
                        variant="ghost-info"
                        size="sm"
                        onClick={() => setManagingSub(s)}
                      >
                        Manage
                      </Button>
                      <Button
                        variant="ghost-success"
                        size="sm"
                        onClick={() => setViewingInvoicesSub(s)}
                      >
                        Invoices
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer: Manage Subscription */}
      {managingSub && (
        <ManageSubscriptionDrawer
          key={managingSub.id}
          sub={managingSub}
          plans={plans}
          open={!!managingSub}
          onClose={() => setManagingSub(null)}
        />
      )}

      {/* Drawer: Customer Invoices */}
      {viewingInvoicesSub && (
        <CustomerInvoicesDrawer
          key={viewingInvoicesSub.id}
          sub={viewingInvoicesSub}
          open={!!viewingInvoicesSub}
          onClose={() => setViewingInvoicesSub(null)}
        />
      )}
    </Card>
  );
}

function ManageSubscriptionDrawer({ sub, plans, open, onClose }) {
  const { updateSubscription } = useAdminMutations();
  const { showToast } = useToast();
  const [planId, setPlanId] = useState(sub.planId);
  const [cycle, setCycle] = useState(sub.cycle);
  const [status, setStatus] = useState(sub.status);
  const [renewalDate, setRenewalDate] = useState(sub.renewalDate ? sub.renewalDate.slice(0, 10) : '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateSubscription.mutateAsync({
        id: sub.id,
        payload: {
          planId,
          cycle,
          status,
          renewalDate: renewalDate ? new Date(`${renewalDate}T00:00:00Z`).toISOString() : null,
        },
      });
      showToast(`Subscription for ${sub.organizationName} updated.`, 'success');
      onClose();
    } catch (err) {
      fail(showToast)(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer variant="modal" open={open} onClose={onClose} title={`Manage subscription · ${sub.organizationName}`} width={460}>
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Assigned plan tier" required>
          <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({fmtMoney(p.priceMonthly)}/mo, {fmtMoney(p.priceAnnual)}/yr)
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Billing cycle" required>
          <Select value={cycle} onChange={(e) => setCycle(e.target.value)}>
            <option value="MONTHLY">Monthly</option>
            <option value="ANNUAL">Annual (Prepaid)</option>
          </Select>
        </FormField>

        <FormField label="Subscription status" required>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ACTIVE">Active (Paying customer)</option>
            <option value="TRIAL">Trial period</option>
            <option value="PAST_DUE">Past due (Billing failure)</option>
            <option value="CANCELLED">Cancelled (Access revoked)</option>
            <option value="EXPIRED">Expired trial</option>
          </Select>
        </FormField>

        <FormField label="Next renewal / expiration date" hint="Sets the next scheduled billing or grace period date.">
          <TextInput type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />
        </FormField>

        <Button type="submit" icon={Save} loading={submitting}>
          Save subscription updates
        </Button>
      </form>
    </Drawer>
  );
}

function CustomerInvoicesDrawer({ sub, open, onClose }) {
  const { data: allInvoices = [] } = useAdminInvoices();
  const customerInvoices = allInvoices.filter((i) => i.organizationId === sub.organizationId);

  return (
    <Drawer variant="modal" open={open} onClose={onClose} title={`Invoices · ${sub.organizationName}`} width={540}>
      <div>
        <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
          {customerInvoices.length} billing statement{customerInvoices.length === 1 ? '' : 's'} recorded for {sub.organizationName}.
        </p>

        {customerInvoices.length === 0 ? (
          <EmptyState icon={Receipt} title="No invoices issued for this customer yet." />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Issued</th>
                  <th>Description</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {customerInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{fmtDate(inv.issuedAt)}</td>
                    <td>
                      <div>{inv.description || 'Subscription'}</div>
                      <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                        {fmtRange(inv.periodStart, inv.periodEnd)}
                      </div>
                    </td>
                    <td className="num">
                      <strong>{fmtMoney(inv.amount)}</strong> {inv.currency}
                    </td>
                    <td>
                      <StatusBadge status="ACTIVE" label={inv.status === 'mock_paid' ? 'Paid' : inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Drawer>
  );
}

// ============================================================================
// 3. Billing Ledger & Invoices (Real-World Invoices Across Entire Platform)
// ============================================================================
function InvoicesLedger({ invoices }) {
  const [search, setSearch] = useState('');
  const [viewingReceipt, setViewingReceipt] = useState(null);

  const filtered = invoices.filter((inv) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      inv.organizationName?.toLowerCase().includes(q) ||
      inv.description?.toLowerCase().includes(q) ||
      inv.id?.toLowerCase().includes(q)
    );
  });

  return (
    <Card padded={false}>
      <div style={{ padding: 'var(--space-5)' }}>
        <CardHeader
          icon={Receipt}
          title="Platform billing ledger & mock invoices"
          subtitle="Itemized record of recurring billing charges, receipts, and subscription invoices generated across all organizations."
        />
        <div className="filters" style={{ marginBottom: 0 }}>
          <FormField label="Search ledger">
            <TextInput
              placeholder="Search by organization or invoice ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </FormField>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Receipt} title="No invoice records found in ledger" />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Organization</th>
                <th>Description / Line Item</th>
                <th>Billing Period</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th>Issued Date</th>
                <th style={{ width: 80, textAlign: 'right' }}>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      INV-{inv.id.slice(0, 8).toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <strong>{inv.organizationName}</strong>
                  </td>
                  <td>{inv.description || 'Subscription charge'}</td>
                  <td>{fmtRange(inv.periodStart, inv.periodEnd)}</td>
                  <td className="num">
                    <strong>{fmtMoney(inv.amount)}</strong> {inv.currency}
                  </td>
                  <td>
                    <StatusBadge status="ACTIVE" label={inv.status === 'mock_paid' ? 'Paid' : inv.status} />
                  </td>
                  <td>{fmtDate(inv.issuedAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Button
                      variant="ghost-success"
                      size="sm"
                      onClick={() => setViewingReceipt(inv)}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer: Detailed Itemized Receipt */}
      {viewingReceipt && (
        <InvoiceReceiptModal
          key={viewingReceipt.id}
          invoice={viewingReceipt}
          open={!!viewingReceipt}
          onClose={() => setViewingReceipt(null)}
        />
      )}
    </Card>
  );
}

function InvoiceReceiptModal({ invoice, open, onClose }) {
  return (
    <Drawer variant="modal" open={open} onClose={onClose} title="Invoice Receipt" width={480}>
      <div style={{ padding: 'var(--space-2) 0' }}>
        {/* Receipt Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--border-color)', paddingBottom: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, margin: 0, color: 'var(--color-primary)' }}>TROPOS</h2>
            <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Enterprise Carbon Governance</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 'var(--font-size-md)' }}>
              INV-{invoice.id.slice(0, 8).toUpperCase()}
            </span>
            <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Issued: {fmtDate(invoice.issuedAt)}</div>
          </div>
        </div>

        {/* Bill To */}
        <div style={{ marginBottom: 'var(--space-4)', background: 'var(--color-bg-secondary)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 4 }}>
            Billed To
          </div>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)' }}>{invoice.organizationName}</div>
          <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Billing Period: {fmtRange(invoice.periodStart, invoice.periodEnd)}</div>
        </div>

        {/* Line Items */}
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--color-text-muted)', paddingBottom: 'var(--space-2)' }}>
            <span>Item Description</span>
            <span>Total</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{invoice.description || 'Subscription service'}</div>
              <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Automated recurring billing charge</div>
            </div>
            <div style={{ fontWeight: 700 }}>
              {fmtMoney(invoice.amount)} {invoice.currency}
            </div>
          </div>
        </div>

        {/* Total Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="text-muted">Subtotal:</span>
            <span>{fmtMoney(invoice.amount)} {invoice.currency}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="text-muted">Estimated Tax:</span>
            <span>$0.00</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border-color)', paddingTop: 'var(--space-2)', fontSize: 'var(--font-size-md)', fontWeight: 800 }}>
            <span>Total Amount Paid:</span>
            <span style={{ color: 'var(--color-primary)' }}>{fmtMoney(invoice.amount)} {invoice.currency}</span>
          </div>
        </div>

        {/* Payment Confirmation Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3)', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid var(--color-success)', borderRadius: 'var(--radius-sm)', color: 'var(--color-success)', fontSize: 'var(--font-size-sm)' }}>
          <CheckCircle2 size={18} />
          <span>Payment settled · Mock Payment Transaction Processed</span>
        </div>
      </div>
    </Drawer>
  );
}
