import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Notice, PageHeader, SelectField, StatusBadge } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid';
import { fmtDate, fmtNum } from '../../utils/formatters';
import { toOptions } from '../../hooks/useOptions';

const TYPE = { I_REC: 'I-REC certificate', REC: 'Indian REC', GEOA_PPA: 'Open-access power contract', GREEN_TARIFF: 'Green tariff from the utility' };

export default function Scope2InstrumentsPage() {
  const { pushToast } = useToast();
  const dialog = useDialog();
  const { data: sites } = useApi('/facilities');
  const { data: periods } = useApi('/periods');
  const [type, setType] = useState('');
  const [tick, setTick] = useState(0);
  const again = () => setTick((t) => t + 1);
  const approved = (sites || []).filter((x) => x.approvalStatus === 'APPROVED');

  async function add() {
    const v = await dialog.form({ title: 'Add a green power certificate', description: 'Certificates and contracts that let you count electricity as green. All four checks must be true or it will not count.', submitLabel: 'Save', wide: true, fields: [
      { name: 'facilityId', type: 'select', label: 'Site it covers', required: true, options: approved.map((x) => ({ value: x.id, label: x.name })) },
      { name: 'instrumentType', type: 'select', label: 'Kind', required: true, options: toOptions(Object.keys(TYPE), TYPE) },
      { name: 'providerName', type: 'text', label: 'Issued by', required: true, placeholder: 'e.g. IEX, utility name' }, { name: 'certificateRef', type: 'text', label: 'Certificate or contract number', required: true, minLength: 3 },
      { name: 'validFrom', type: 'date', label: 'Valid from', required: true }, { name: 'validTo', type: 'date', label: 'Valid until', required: true },
      { name: 'totalMwh', type: 'number', label: 'Total power covered', required: true, unit: 'MWh' }, { name: 'factorKgCo2ePerKwh', type: 'number', label: 'Emissions of that power', required: true, unit: 'kg CO₂e per kWh', hint: 'Use 0 for solar and wind.' },
      { name: 'conveysAttributes', type: 'checkbox', label: 'It states how the power was generated' }, { name: 'uniqueClaim', type: 'checkbox', label: 'Only you can claim it. No one else counts it too' },
      { name: 'retired', type: 'checkbox', label: 'It has been retired in your company’s name' }, { name: 'sameMarket', type: 'checkbox', label: 'It was generated in the same market you use power in' },
      { name: 'retirementRef', type: 'text', label: 'Registry retirement reference', hint: 'Needed if retired.' }] });
    if (!v) return;
    try {
      await apiFetch('/scope2-instruments', { method: 'POST', body: JSON.stringify({ facilityId: v.facilityId, instrumentType: v.instrumentType, providerName: v.providerName.trim(), certificateRef: v.certificateRef.trim(), validFrom: v.validFrom, validTo: v.validTo, totalMwh: Number(v.totalMwh), factorKgCo2ePerKwh: Number(v.factorKgCo2ePerKwh), retirementRef: v.retirementRef || undefined, criteria: { conveysAttributes: !!v.conveysAttributes, uniqueClaim: !!v.uniqueClaim, retired: !!v.retired, sameMarket: !!v.sameMarket } }) });
      pushToast('Saved.'); again();
    } catch (e) { pushToast(e.message, 'error'); }
  }

  async function allocate(r) {
    const open = (periods || []).filter((p) => ['OPEN', 'REOPENED'].includes(p.status));
    const v = await dialog.form({ title: 'Use this certificate for a month', description: `${fmtNum(r.remainingMwh, 1)} MWh left.`, submitLabel: 'Use it', fields: [
      { name: 'periodId', type: 'select', label: 'Month', required: true, options: open.map((p) => ({ value: p.id, label: p.label })) }, { name: 'mwh', type: 'number', label: 'Power to count', required: true, unit: 'MWh' }] });
    if (!v) return;
    try { await apiFetch(`/scope2-instruments/${r.id}/allocate`, { method: 'POST', body: JSON.stringify({ periodId: v.periodId, allocatedMwh: Number(v.mwh) }) }); pushToast('Counted for that month.'); again(); } catch (e) { pushToast(e.message, 'error'); }
  }

  return (
    <div>
      <PageHeader title="Green power certificates" description="Certificates and contracts that reduce your Scope 2 figure." />
      <Notice tone="info" className="mb-4">Your Scope 2 is reported two ways: with the grid average, and after green power. Only certificates that pass all four checks reduce the second figure.</Notice>
      <DataGrid endpoint="/scope2-instruments" params={{ instrumentType: type }} refreshKey={tick} exportName="green-power-certificates"
        toolbar={<><SelectField className="w-64" label="" aria-label="Kind" value={type} onChange={setType} placeholder="All kinds" options={toOptions(Object.keys(TYPE), TYPE)} /><Button onClick={add}><Plus className="w-4 h-4" /> Add a certificate</Button></>}
        columns={[{ key: 'n', label: 'Certificate', render: (r) => <><div className="font-medium">{TYPE[r.instrumentType]}</div><div className="text-xs text-muted">{r.providerName} · {r.certificateRef} · {r.facility?.name}</div></>, value: (r) => r.certificateRef },
          { key: 'v', label: 'Valid', hideOnMobile: true, render: (r) => `${fmtDate(r.validFrom)} to ${fmtDate(r.validTo)}`, value: (r) => r.validFrom },
          { key: 'f', label: 'Emissions (kg CO₂e/kWh)', numeric: true, hideOnMobile: true, render: (r) => fmtNum(r.factorKgCo2ePerKwh, 3), value: (r) => r.factorKgCo2ePerKwh },
          { key: 'm', label: 'Left of total (MWh)', numeric: true, render: (r) => `${fmtNum(r.remainingMwh, 1)} of ${fmtNum(r.totalMwh, 1)}`, value: (r) => r.remainingMwh },
          { key: 'o', label: 'Counts', render: (r) => <StatusBadge status={r.passesAllChecks ? 'ACTIVE' : 'PENDING'} label={r.passesAllChecks ? 'Counts' : 'Fails a check'} />, value: (r) => (r.passesAllChecks ? 'Counts' : 'Fails a check') },
          { key: 'a', label: '', render: (r) => r.passesAllChecks && Number(r.remainingMwh) > 0 ? <Button size="sm" variant="secondary" onClick={() => allocate(r)}>Use for a month</Button> : null }]}
        emptyTitle="No certificates yet" emptyText="Add the certificates or contracts you hold so your green power is counted." />
    </div>
  );
}
