import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Lock, RotateCcw } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAction } from '../../hooks/useAction';
import { useForm } from '../../hooks/useForm';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Card, EmptyState, PageHeader, SelectField, StatusBadge } from '../../components/ui';
import { fmtDate } from '../../utils/formatters';

/** Closing a month locks its numbers so reports stay the same forever. Reopening needs a written reason and is logged. */
export default function CloseMonthPage() {
  const act = useAction();
  const dialog = useDialog();
  const { data: periods, refetch } = useApi('/periods');
  const years = useMemo(() => [...new Set((periods || []).map((p) => p.financialYear))].sort().reverse(), [periods]);
  const f = useForm('close-month', { fy: '', busy: '' });
  const { fy, busy } = f.values;
  const year = fy || years[0] || '';
  const rows = (periods || []).filter((p) => p.financialYear === year).sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));

  async function close(p) {
    const r = await act({ path: `/periods/${p.id}/readiness`, method: 'GET', silent: true });
    const issues = r?.blockers?.length ? `\n\nStill open:\n• ${r.blockers.join('\n• ')}` : '';
    const ok = await dialog.confirm({ title: `Close ${p.label}?`, message: `Closing locks every approved record for ${p.label} and saves a permanent snapshot. Changing it later means reopening the month with a reason.${issues}`, confirmLabel: `Close ${p.label}` });
    if (!ok) return;
    f.set('busy', p.id);
    const done = await act({ path: `/periods/${p.id}/close`, method: 'POST', toast: `${p.label} is closed.` });
    if (done) refetch();
    f.set('busy', '');
  }
  async function reopen(p) {
    const v = await dialog.form({ title: `Reopen ${p.label}`, description: 'Reopening lets people change closed figures. Your reason is saved in the activity log and the external verifier is told.', submitLabel: 'Reopen month', danger: true,
      fields: [{ name: 'reason', type: 'textarea', label: 'Why does it need to reopen?', placeholder: 'e.g. A late diesel bill for March arrived on 12 April.', required: true, minLength: 10 }] });
    if (!v) return;
    f.set('busy', p.id);
    const done = await act({ path: `/periods/${p.id}/reopen`, method: 'POST', body: { reason: v.reason.trim() }, toast: `${p.label} is open again.` });
    if (done) refetch();
    f.set('busy', '');
  }
  async function openYear() {
    const latest = years[0]; const startYear = latest ? Number(latest.match(/\d{4}/)[0]) + 1 : new Date().getFullYear();
    const v = await dialog.form({ title: 'Open a financial year', description: 'Creates all twelve months at once. Months that already exist are left alone.', submitLabel: 'Open months', fields: [{ name: 'startYear', type: 'number', label: 'Year it starts', required: true, defaultValue: startYear, hint: 'For FY2027-28 enter 2027.' }] });
    if (!v) return;
    const done = await act({ path: '/periods/financial-year', method: 'POST', body: { startYear: Number(v.startYear) }, toast: 'Months opened.' });
    if (done) refetch();
  }

  if (periods && periods.length === 0) return <><PageHeader title="Month-end close" /><div className="card"><EmptyState title="No months yet" action={<Button onClick={openYear}>Open a financial year</Button>}>Open a financial year to start collecting data month by month.</EmptyState></div></>;
  return (
    <div>
      <PageHeader title="Month-end close" description="Close each month once its data is reviewed. Closed months never change, so your reports stay the same."
        actions={<><SelectField label="" aria-label="Financial year" value={year} onChange={(v) => f.set('fy', v)} options={years.map((y) => ({ value: y, label: y }))} /><Button variant="secondary" onClick={openYear}><CalendarPlus className="w-4 h-4" /> Open a year</Button></>} />
      <div className="card overflow-hidden">
        <ul className="divide-y divide-line">
          {rows.map((p) => {
            const isOpen = ['OPEN', 'REOPENED'].includes(p.status); const started = new Date(p.startDate) <= new Date();
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 h-[60px]">
                <div className="w-28 font-medium">{p.label}</div>
                <div className="w-44"><StatusBadge status={p.status} /></div>
                <div className="flex-1 text-sm text-muted hidden md:block">{p.closedAt ? `Closed ${fmtDate(p.closedAt)}` : p.signedOffAt ? `Signed off ${fmtDate(p.signedOffAt)}` : !started ? 'Not started yet' : ''}</div>
                {isOpen && started && <div className="flex gap-2"><Link to="/sustainability/this-month" className="btn btn-ghost btn-sm">Check steps</Link><Button size="sm" loading={busy === p.id} onClick={() => close(p)}><Lock className="w-4 h-4" /> Close month</Button></div>}
                {['CLOSED', 'SIGNED_OFF'].includes(p.status) && <Button size="sm" variant="secondary" loading={busy === p.id} onClick={() => reopen(p)}><RotateCcw className="w-4 h-4" /> Reopen</Button>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
