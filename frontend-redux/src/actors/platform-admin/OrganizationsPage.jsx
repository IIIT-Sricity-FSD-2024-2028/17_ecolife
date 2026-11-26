import React from 'react';
import { useForm } from '../../hooks/useForm';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { PageHeader, SelectField, StatusBadge, TextField } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid';
import { fmtDate } from '../../utils/formatters';

export const ORG_STATUS = { TRIAL: 'On trial', ACTIVE: 'Paying', PAST_DUE: 'Payment late', SUSPENDED: 'Suspended', CLOSED: 'Closed' };

export default function OrganizationsPage() {
  const { data: sum } = useApi('/platform/summary');
  const f = useForm('platform-organizations', { q: '', status: '', planId: '' });
  const { q, status, planId } = f.values;
  const setQ = (v) => f.set('q', v);
  const setStatus = (v) => f.set('status', v);
  const setPlan = (v) => f.set('planId', v);
  return (
    <div>
      <PageHeader title="Companies" description="Every company on the platform. Open one to see its state and take support actions." />
      <DataGrid endpoint="/platform/organizations" params={{ q, status, planId }} exportName="companies"
        toolbar={<><TextField className="w-60" label="" aria-label="Search" placeholder="Name, CIN or GSTIN" value={q} onChange={setQ} /><SelectField className="w-44" label="" aria-label="Status" value={status} onChange={setStatus} placeholder="Any status" options={Object.entries(ORG_STATUS).map(([v, l]) => ({ value: v, label: l }))} /><SelectField className="w-48" label="" aria-label="Plan" value={planId} onChange={setPlan} placeholder="Any plan" options={(sum?.plans || []).map((p) => ({ value: p.id, label: p.name }))} /></>}
        columns={[{ key: 'n', label: 'Company', render: (r) => <Link className="font-medium hover:underline" to={`/platform/organizations/${r.id}`}>{r.name}</Link>, value: (r) => r.name },
          { key: 'p', label: 'Plan', render: (r) => r.plan?.name, value: (r) => r.plan?.name }, { key: 's', label: 'Status', render: (r) => <StatusBadge status={r.status === 'ACTIVE' ? 'ACTIVE' : r.status} label={ORG_STATUS[r.status]} />, value: (r) => r.status },
          { key: 'u', label: 'People', numeric: true, hideOnMobile: true, render: (r) => r._count.users, value: (r) => r._count.users }, { key: 'f', label: 'Sites', numeric: true, hideOnMobile: true, render: (r) => r._count.facilities, value: (r) => r._count.facilities },
          { key: 't', label: 'Trial ends', hideOnMobile: true, render: (r) => (r.status === 'TRIAL' && r.trialEndsAt ? fmtDate(r.trialEndsAt) : ''), value: (r) => r.trialEndsAt }, { key: 'c', label: 'Joined', hideOnMobile: true, render: (r) => fmtDate(r.createdAt), value: (r) => r.createdAt }]}
        emptyTitle="No company matches" emptyText="Try a shorter search." />
    </div>
  );
}
