import React, { useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { useAction } from '../../hooks/useAction';
import { useForm } from '../../hooks/useForm';
import { useAuth } from '../../context/AuthContext';
import { useOptions, toOptions } from '../../hooks/useOptions';
import { Button, Card, CheckField, FormGrid, Notice, PageHeader, SelectField, TextField } from '../../components/ui';
import { MODULE, ASSURANCE } from '../../utils/labels';

export default function WorkspaceSettingsPage() {
  const { organization, setOrganization } = useAuth();
  const act = useAction();
  const { enums, rules } = useOptions();
  const { data: profile, refetch } = useApi('/org/profile');
  const f = useForm('workspace-settings', { mods: null, single: false, ccts: false, std: 'INTERNAL_TRACKING', co: null, busy: '' });
  const { mods, single, ccts, std, co, busy } = f.values;

  useEffect(() => { if (organization && mods === null) f.patch({ mods: organization.enabledModules || [], single: !!organization.allowSingleUserMode, ccts: !!organization.cctsObligated, std: organization.assuranceStandard || 'INTERNAL_TRACKING' }); }, [organization, mods]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = rules.modules || [];
  const toggle = (m) => f.set('mods', mods.includes(m) ? mods.filter((x) => x !== m) : [...mods, m]);

  async function saveWorkspace() {
    f.set('busy', 'ws');
    const u = await act({ path: '/org/settings', method: 'PATCH', body: { enabledModules: mods, allowSingleUserMode: single, cctsObligated: ccts, assuranceStandard: std }, toast: 'Settings saved.' });
    if (u) setOrganization?.({ ...organization, ...u });
    f.set('busy', '');
  }
  const c = co || { name: profile?.name || '', cin: profile?.cin || '', industrySector: profile?.industrySector || '' };
  async function saveCompany(e) {
    e.preventDefault(); f.set('busy', 'co');
    const r = await act({ path: '/org/profile', method: 'PATCH', body: Object.fromEntries(Object.entries(c).filter(([, v]) => v !== '' && v != null)), toast: 'Company details saved.' });
    if (r) { f.set('co', null); refetch(); }
    f.set('busy', '');
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Company settings" description="What you track, how data is approved, and your company details." />
      <Card title="What do you track?" description="Untick what does not apply. It disappears from the menus so people only see what they use. Nothing is deleted." className="mb-6">
        {mods === null ? <div className="h-24 animate-pulse" /> : <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">{all.map((m) => <CheckField key={m} label={MODULE[m] || m} checked={mods.includes(m)} onChange={() => toggle(m)} />)}</div>}
      </Card>
      <Card title="Approvals and audit" className="mb-6">
        <div className="space-y-4">
          <CheckField label="Allow one person to enter and approve their own data" hint="Only for very small teams. Auditors will see that no second person checked the figures." checked={single} onChange={(v) => f.set('single', v)} />
          <CheckField label="We are covered by the BEE carbon market (CCTS)" hint="Turns on the intensity targets and filings for obligated companies." checked={ccts} onChange={(v) => f.set('ccts', v)} />
          <SelectField label="Standard your figures will be audited to" value={std} onChange={(v) => f.set('std', v)} options={toOptions(enums.AssuranceStandard, ASSURANCE)} hint="Choose “Internal tracking only” if no outside audit is planned." />
          <div className="flex justify-end"><Button loading={busy === 'ws'} onClick={saveWorkspace}>Save settings</Button></div>
        </div>
      </Card>
      <Card title="Company details">
        <form onSubmit={saveCompany} className="space-y-4">
          <FormGrid cols={2}>
            <TextField label="Company name" value={c.name} onChange={(x) => f.set('co', { ...c, name: x })} />
            <TextField label="CIN" optional maxLength={21} placeholder="21 characters" value={c.cin} onChange={(x) => f.set('co', { ...c, cin: x.toUpperCase() })} />
            <TextField className="sm:col-span-2" label="Industry" optional placeholder="e.g. Auto components" value={c.industrySector} onChange={(x) => f.set('co', { ...c, industrySector: x })} />
          </FormGrid>
          <div className="flex justify-end"><Button type="submit" disabled={!co} loading={busy === 'co'}>Save details</Button></div>
        </form>
      </Card>
    </div>
  );
}
