import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { useOptions, toOptions } from '../../hooks/useOptions';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Card, EmptyState, Notice, PageHeader, SelectField, StatusBadge } from '../../components/ui';
import { fmtNum } from '../../utils/formatters';
import { CREDIT_CLASS, CREDIT_STATUS } from '../../utils/labels';

const n = (v) => (v === '' || v === undefined ? undefined : Number(v));

export default function GreenEconomyCctsPage() {
  const { pushToast } = useToast();
  const dialog = useDialog();
  const { enums } = useOptions();
  const { data: entities } = useApi('/entities');
  const { data, refetch } = useApi('/green-economy');
  const [status, setStatus] = useState('');
  const [cls, setCls] = useState('');
  const credits = (data?.credits || []).filter((c) => (!status || c.status === status) && (!cls || c.instrumentClass === cls));
  const approved = (entities || []).filter((x) => x.approvalStatus === 'APPROVED');

  async function addCredit() {
    const v = await dialog.form({ title: 'Record a credit', description: 'Credits are kept in their own register. They are never subtracted from your emissions.', submitLabel: 'Record credit', wide: true, fields: [
      ...(approved.length > 1 ? [{ name: 'entityId', type: 'select', label: 'Which company holds it?', required: true, options: approved.map((x) => ({ value: x.id, label: x.name })) }] : []),
      { name: 'instrumentClass', type: 'select', label: 'Kind of credit', required: true, defaultValue: 'BEE_CCTS_ICC', options: toOptions(enums.CreditClass || ['BEE_CCTS_ICC', 'VOLUNTARY_CARBON_CREDIT', 'MOEFCC_GREEN_CREDIT'], CREDIT_CLASS) },
      { name: 'registryName', type: 'text', label: 'Registry', required: true, placeholder: 'e.g. Verra, Gold Standard, BEE' }, { name: 'projectId', type: 'text', label: 'Project ID in the registry', required: true },
      { name: 'serialRange', type: 'text', label: 'Serial numbers', required: true, placeholder: 'e.g. 1001-1500' }, { name: 'vintageYear', type: 'number', label: 'Year it was created', required: true },
      { name: 'quantity', type: 'number', label: 'Quantity', required: true, unit: 'tCO₂e' }, { name: 'status', type: 'select', label: 'How did you get it?', required: true, defaultValue: 'PROCURED', options: [{ value: 'PROCURED', label: 'Bought' }, { value: 'ISSUED', label: 'Issued to us' }] },
      { name: 'canopyDensityPct', type: 'number', label: 'Tree cover (government green credits only)', unit: '%', hint: 'At least 40%. Leave empty for other credits.' },
      { name: 'restorationYears', type: 'number', label: 'Years of restoration (green credits only)', unit: 'years' }, { name: 'restorationParcelId', type: 'text', label: 'Land parcel ID (green credits only)' }] });
    if (!v) return;
    const entityId = v.entityId || approved[0]?.id;
    try {
      await apiFetch('/green-economy/credits', { method: 'POST', body: JSON.stringify({ entityId, instrumentClass: v.instrumentClass, registryName: v.registryName.trim(), projectId: v.projectId.trim(), serialRange: v.serialRange.trim(), vintageYear: Number(v.vintageYear), quantity: Number(v.quantity), status: v.status, ...(v.instrumentClass === 'MOEFCC_GREEN_CREDIT' ? { canopyDensityPct: n(v.canopyDensityPct), restorationYears: n(v.restorationYears), restorationParcelId: v.restorationParcelId || undefined } : {}) }) });
      pushToast('Credit recorded.'); refetch();
    } catch (e) { pushToast(e.message, 'error'); }
  }

  async function change(row, next) {
    const body = { status: next };
    if (next === 'TRANSFERRED_SUBSIDIARY') {
      const v = await dialog.form({ title: 'Move to another company', description: 'The credit moves to that company’s register and stops counting here.', submitLabel: 'Move', fields: [{ name: 'to', type: 'select', label: 'Receiving company', required: true, options: approved.filter((x) => x.id !== row.entityId).map((x) => ({ value: x.id, label: x.name })) }] });
      if (!v) return; body.transferredToEntityId = v.to;
    } else if (['RETIRED', 'EXTINGUISHED'].includes(next) && !(await dialog.confirm({ title: next === 'RETIRED' ? 'Mark as used up?' : 'Cancel this credit?', message: 'This cannot be undone.', confirmLabel: 'Yes, continue', danger: next === 'EXTINGUISHED' }))) return;
    try { await apiFetch(`/green-economy/credits/${row.id}/status`, { method: 'PATCH', body: JSON.stringify(body) }); pushToast('Updated.'); refetch(); } catch (e) { pushToast(e.message, 'error'); }
  }

  const total = credits.reduce((s, c) => s + Number(c.quantity), 0);
  return (
    <div>
      <PageHeader title="Carbon credits" description="Credits you hold, kept apart from your emissions." actions={<Button onClick={addCredit}><Plus className="w-4 h-4" /> Record a credit</Button>} />
      <Notice tone="info" className="mb-4">Credits are never taken off your Scope 1, 2 or 3 figures. They are reported separately, as the rules require.</Notice>
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-line">
          <SelectField className="w-56" label="" aria-label="Kind" value={cls} onChange={setCls} placeholder="All kinds" options={toOptions(['BEE_CCTS_ICC', 'VOLUNTARY_CARBON_CREDIT', 'MOEFCC_GREEN_CREDIT'], CREDIT_CLASS)} />
          <SelectField className="w-52" label="" aria-label="Status" value={status} onChange={setStatus} placeholder="Any status" options={toOptions(enums.CreditStatus, CREDIT_STATUS)} />
          <span className="ml-auto text-sm text-muted tabular-nums">{fmtNum(total, 1)} tCO₂e shown</span>
        </div>
        {!data ? <div className="h-24 animate-pulse" /> : credits.length === 0 ? <EmptyState title="No credits" action={<Button onClick={addCredit}>Record a credit</Button>}>Record credits you buy or are issued so they can be tracked until they are used.</EmptyState> : (
          <ul className="divide-y divide-line">{credits.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="flex-1 min-w-[14rem]"><div className="font-medium">{CREDIT_CLASS[c.instrumentClass]}</div><div className="text-sm text-muted">{c.registryName} · {c.serialRange} · {c.vintageYear}{c.entity?.name && approved.length > 1 ? ` · ${c.entity.name}` : ''}</div></div>
              <div className="text-right tabular-nums"><div className="font-medium">{fmtNum(c.quantity, 1)}</div><div className="text-xs text-muted">tCO₂e</div></div>
              <StatusBadge status={c.status} label={CREDIT_STATUS[c.status]} />
              <div className="flex gap-1.5">
                {['ISSUED', 'PROCURED'].includes(c.status) && <><Button size="sm" variant="secondary" onClick={() => change(c, 'PENDING_RETIREMENT')}>Request to use</Button>{approved.length > 1 && <Button size="sm" variant="secondary" onClick={() => change(c, 'TRANSFERRED_SUBSIDIARY')}>Move</Button>}</>}
                {c.status === 'PENDING_RETIREMENT' && <><Button size="sm" onClick={() => change(c, 'RETIRED')}>Mark used up</Button><Button size="sm" variant="secondary" onClick={() => change(c, 'EXTINGUISHED')}>Cancel</Button></>}
              </div>
            </li>))}</ul>)}
      </Card>
    </div>
  );
}
