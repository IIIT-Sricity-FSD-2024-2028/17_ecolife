import React from 'react';
import { Link } from 'react-router-dom';
import { useAction } from '../../hooks/useAction';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Card, EmptyState, PageHeader, Stat } from '../../components/ui';
import { fmtDate, fmtInr } from '../../utils/formatters';

const ORG = { TRIAL: 'On trial', ACTIVE: 'Paying', PAST_DUE: 'Payment late', SUSPENDED: 'Suspended', CLOSED: 'Closed' };

export default function PlatformOverviewPage() {
  const { user } = useAuth();
  const send = useAction();
  const dialog = useDialog();
  const { data, refetch } = useApi('/platform/summary');

  async function decide(a, status) {
    if (!(await dialog.confirm({ title: status === 'APPROVED' ? `Close ${a.organization?.name}?` : 'Reject this request?', message: status === 'APPROVED' ? 'The company is closed, everyone is signed out, and its records are kept for 8 years. This cannot be undone.' : 'Nothing will be closed.', confirmLabel: status === 'APPROVED' ? 'Approve and close' : 'Reject', danger: status === 'APPROVED' }))) return;
    await send({ path: `/platform/approvals/${a.id}/decide`, method: 'PATCH', body: { status }, toast: 'Decision recorded.' });
  }
  if (!data) return <div className="h-40 animate-pulse" />;
  const o = data.organizations || {};
  const total = Object.values(o).reduce((a, b) => a + b, 0);
  return (
    <div>
      <PageHeader title="Platform overview" description="How the customers are doing, and what needs a second pair of eyes." />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <Stat label="Companies" value={total} note={`${o.ACTIVE || 0} paying · ${o.TRIAL || 0} on trial`} />
        <Stat label="People" value={data.users} />
        <Stat label="Unpaid invoices" value={data.unpaidInvoices.count} note={fmtInr(data.unpaidInvoices.totalInr)} tone={data.unpaidInvoices.count ? 'warn' : undefined} />
        <Stat label="Factor rows waiting" value={data.pendingFactorRows} note={data.pendingFactorRows ? 'Needs a second admin' : 'None'} tone={data.pendingFactorRows ? 'warn' : undefined} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Waiting for a second administrator" padded={false}>
          {data.pendingApprovals.length === 0 ? <EmptyState title="Nothing waiting" /> : <ul className="divide-y divide-line">{data.pendingApprovals.map((a) => (
            <li key={a.id} className="px-5 py-3"><div className="font-medium">Close {a.organization?.name}</div><div className="text-sm text-muted">{a.reason}</div><div className="mt-2 flex gap-2">{a.requestedById === user?.userId ? <span className="text-sm text-muted">You asked for this. Another administrator must decide.</span> : <><Button size="sm" onClick={() => decide(a, 'APPROVED')}>Approve</Button><Button size="sm" variant="secondary" onClick={() => decide(a, 'REJECTED')}>Reject</Button></>}</div></li>))}</ul>}
          {data.pendingFactorRows > 0 && <div className="px-5 py-3 border-t border-line text-sm"><Link className="text-link underline" to="/platform/factors-gwp">Review the emission factor release</Link></div>}
        </Card>
        <Card title="Trials ending this week" padded={false}>
          {data.trialsEndingSoon.length === 0 ? <EmptyState title="No trials ending soon" /> : <ul className="divide-y divide-line">{data.trialsEndingSoon.map((t) => <li key={t.id} className="flex justify-between gap-3 px-5 py-3"><Link className="font-medium hover:underline" to={`/platform/organizations/${t.id}`}>{t.name}</Link><span className="text-sm text-muted">ends {fmtDate(t.trialEndsAt)}</span></li>)}</ul>}
        </Card>
      </div>
      <Card title="Companies by status" className="mt-4"><div className="flex flex-wrap gap-x-8 gap-y-2">{Object.entries(ORG).map(([k, l]) => <div key={k}><span className="text-2xl font-semibold tabular-nums">{o[k] || 0}</span> <span className="text-muted text-sm">{l}</span></div>)}</div></Card>
    </div>
  );
}
