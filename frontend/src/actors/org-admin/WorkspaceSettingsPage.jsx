import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/apiClient';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useOptions, toOptions } from '../../hooks/useOptions';
import { Button, Card, CheckField, FormGrid, Notice, PageHeader, SelectField, TextField } from '../../components/ui';
import { MODULE, ASSURANCE } from '../../utils/labels';

export default function WorkspaceSettingsPage() {
  const { organization, setOrganization } = useAuth();
  const { pushToast } = useToast();
  const { enums, rules } = useOptions();
  const { data: profile, refetch } = useApi('/org/profile');
  const [mods, setMods] = useState(null);
  const [single, setSingle] = useState(false);
  const [ccts, setCcts] = useState(false);
  const [std, setStd] = useState('INTERNAL_TRACKING');
  const [co, setCo] = useState(null);
  const [busy, setBusy] = useState('');

  useEffect(() => { if (organization && mods === null) { setMods(organization.enabledModules || []); setSingle(!!organization.allowSingleUserMode); setCcts(!!organization.cctsObligated); setStd(organization.assuranceStandard || 'INTERNAL_TRACKING'); } }, [organization, mods]);
  const all = rules.modules || [];
  const toggle = (m) => setMods((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]));

  async function saveWorkspace() {
    setBusy('ws');
    try { const u = await apiFetch('/org/settings', { method: 'PATCH', body: JSON.stringify({ enabledModules: mods, allowSingleUserMode: single, cctsObligated: ccts, assuranceStandard: std }) }); setOrganization?.({ ...organization, ...u }); pushToast('Settings saved.'); }
    catch (e) { pushToast(e.message, 'error'); } finally { setBusy(''); }
  }
  const c = co || { name: profile?.name || '', cin: profile?.cin || '', industrySector: profile?.industrySector || '' };
  async function saveCompany(e) {
    e.preventDefault(); setBusy('co');
    try { await apiFetch('/org/profile', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(Object.entries(c).filter(([, v]) => v !== '' && v != null))) }); pushToast('Company details saved.'); setCo(null); refetch(); }
    catch (err) { pushToast(err.message, 'error'); } finally { setBusy(''); }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Company settings" description="What you track, how data is approved, and your company details." />
      <Card title="What do you track?" description="Untick what does not apply. It disappears from the menus so people only see what they use. Nothing is deleted." className="mb-6">
        {mods === null ? <div className="h-24 animate-pulse" /> : <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">{all.map((m) => <CheckField key={m} label={MODULE[m] || m} checked={mods.includes(m)} onChange={() => toggle(m)} />)}</div>}
      </Card>
      <Card title="Approvals and audit" className="mb-6">
        <div className="space-y-4">
          <CheckField label="Allow one person to enter and approve their own data" hint="Only for very small teams. Auditors will see that no second person checked the figures." checked={single} onChange={setSingle} />
          <CheckField label="We are covered by the BEE carbon market (CCTS)" hint="Turns on the intensity targets and filings for obligated companies." checked={ccts} onChange={setCcts} />
          <SelectField label="Standard your figures will be audited to" value={std} onChange={setStd} options={toOptions(enums.AssuranceStandard, ASSURANCE)} hint="Choose “Internal tracking only” if no outside audit is planned." />
          <div className="flex justify-end"><Button loading={busy === 'ws'} onClick={saveWorkspace}>Save settings</Button></div>
        </div>
      </Card>
      <Card title="Company details">
        <form onSubmit={saveCompany} className="space-y-4">
          <FormGrid cols={2}>
            <TextField label="Company name" value={c.name} onChange={(x) => setCo({ ...c, name: x })} />
            <TextField label="CIN" optional maxLength={21} placeholder="21 characters" value={c.cin} onChange={(x) => setCo({ ...c, cin: x.toUpperCase() })} />
            <TextField className="sm:col-span-2" label="Industry" optional placeholder="e.g. Auto components" value={c.industrySector} onChange={(x) => setCo({ ...c, industrySector: x })} />
          </FormGrid>
          <div className="flex justify-end"><Button type="submit" disabled={!co} loading={busy === 'co'}>Save details</Button></div>
        </form>
      </Card>
    </div>
  );
}
