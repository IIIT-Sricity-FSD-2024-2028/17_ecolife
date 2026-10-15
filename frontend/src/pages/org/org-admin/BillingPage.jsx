import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Gauge, Receipt, Check, ArrowRightLeft } from 'lucide-react';
import { useSubscription, usePlans, useDepartments, useOrgUsers } from '../../../hooks/useOrgData';
import { useResourceTypes } from '../../../hooks/useResourceRecords';
import { billingService } from '../../../services/miscServices';
import { Card, CardHeader } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { ProgressBar } from '../../../components/ui/charts';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { fmtDate, fmtMoney, fmtRange } from '../../../utils/format';

export function BillingPage() {
  const { data: sub } = useSubscription();
  const { data: plans = [] } = usePlans();
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: billingService.getInvoices });
  const { data: departments = [] } = useDepartments();
  const { data: users = [] } = useOrgUsers();
  const { data: types = [] } = useResourceTypes();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const plan = sub?.plan;

  const quotas = plan && [
    { label: 'Departments', used: departments.length, max: plan.maxDepartments },
    { label: 'Active users', used: users.filter((u) => u.isActive).length, max: plan.maxUsers },
    { label: 'Resource types', used: types.length, max: plan.maxResourceTypes },
  ];

  const change = async (p) => {
    const ok = await confirm({
      title: `Switch to the ${p.name} plan?`,
      message: `${p.priceMonthly === 0 ? 'Free' : `${fmtMoney(p.priceMonthly)} per month`}. Your billing and plan limits change immediately${plan ? ` from ${plan.name}` : ''}.`,
      confirmLabel: 'Switch plan',
      icon: ArrowRightLeft,
    });
    if (!ok) return;
    try {
      await billingService.changePlan(p.id);
      showToast('Plan changed.', 'success');
      qc.invalidateQueries({ queryKey: ['subscription'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    } catch (err) { showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error'); }
  };

  return (
    <div className="stack">
      <PageHeader subtitle="Your plan, how much of it you’re using, and your invoices." />

      <Card>
        <CardHeader
          icon={Gauge}
          title={plan ? `${plan.name} plan` : 'Plan'}
          subtitle={sub ? `${fmtMoney(sub.cycle === 'ANNUAL' ? plan?.priceAnnual : plan?.priceMonthly)} per ${sub.cycle === 'ANNUAL' ? 'year' : 'month'}${sub.renewalDate ? ` · renews ${fmtDate(sub.renewalDate)}` : ''}` : ''}
          actions={sub && <StatusBadge status={sub.status} label={sub.status.charAt(0) + sub.status.slice(1).toLowerCase()} />}
        />
        {quotas?.map((q) => {
          const unlimited = q.max >= 999;
          return (
            <div key={q.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-2) 0' }}>
              <span style={{ width: 130 }}>{q.label}</span>
              <ProgressBar percent={unlimited ? 0 : (q.used / q.max) * 100} />
              <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>{q.used} of {unlimited ? 'unlimited' : q.max}</span>
            </div>
          );
        })}
      </Card>

      <div className="summary-grid" style={{ marginBottom: 0 }}>
        {plans.map((p) => {
          const current = sub?.planId === p.id;
          return (
            <Card key={p.id}>
              <h3 style={{ marginBottom: 'var(--space-1)' }}>{p.name}</h3>
              <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>{p.priceMonthly === 0 ? 'Free' : `${fmtMoney(p.priceMonthly)}/mo`}</p>
              {p.description && <p style={{ marginTop: 'var(--space-2)' }}>{p.description}</p>}
              <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)', margin: 'var(--space-2) 0 var(--space-4)' }}>
                {p.maxUsers >= 999 ? 'Unlimited' : `Up to ${p.maxUsers}`} users · {p.maxDepartments >= 999 ? 'unlimited' : p.maxDepartments} departments · {p.reportFrequency} reports
              </p>
              <Button variant={current ? 'secondary' : 'primary'} icon={current ? Check : ArrowRightLeft} disabled={current} onClick={() => change(p)}>{current ? 'Current plan' : 'Switch to this plan'}</Button>
            </Card>
          );
        })}
      </div>

      <Card padded={false}>
        <div style={{ padding: 'var(--space-5) var(--space-5) 0' }}><CardHeader icon={Receipt} title="Invoice history" /></div>
        {invoices.length === 0 ? <p className="text-muted" style={{ padding: '0 var(--space-5) var(--space-5)' }}>No invoices yet.</p> : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Issued</th><th>Description</th><th>Period</th><th className="num">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {[...invoices].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)).map((i) => (
                  <tr key={i.id}>
                    <td>{fmtDate(i.issuedAt)}</td>
                    <td>{i.description ?? 'Subscription'}</td>
                    <td>{fmtRange(i.periodStart, i.periodEnd)}</td>
                    <td className="num">{fmtMoney(i.amount)} {i.currency}</td>
                    <td><StatusBadge status="ACTIVE" label={i.status === 'mock_paid' ? 'Paid' : i.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
