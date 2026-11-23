import React, { useState } from 'react';
import { Copy, Plus } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useOptions } from '../../hooks/useOptions';
import { useDialog, Dialog } from '../../components/ui/Dialogs';
import { Button, Card, CheckField, EmptyState, Notice, PageHeader, StatusBadge, TextField } from '../../components/ui';
import { fmtDate } from '../../utils/formatters';
import { ROLE, ROLE_HELP } from '../../utils/labels';

function RolesDialog({ open, onClose, title, description, initial = [], roles, showSites, sites, onSubmit, withEmail, submitLabel }) {
  const [email, setEmail] = useState('');
  const [sel, setSel] = useState(initial);
  const [fac, setFac] = useState([]);
  const [busy, setBusy] = useState(false);
  const toggle = (list, set, v) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  async function go(e) { e.preventDefault(); setBusy(true); try { await onSubmit({ email, roles: sel, facilityIds: fac }); onClose(); } finally { setBusy(false); } }
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <form onSubmit={go} className="space-y-4">
        {withEmail && <TextField label="Work email" type="email" required placeholder="colleague@company.in" value={email} onChange={setEmail} />}
        <fieldset><legend className="text-sm font-medium mb-2">What can they do?</legend>
          <div className="space-y-2">{roles.map((r) => <CheckField key={r} label={ROLE[r] || r} hint={ROLE_HELP[r]} checked={sel.includes(r)} onChange={() => toggle(sel, setSel, r)} />)}</div></fieldset>
        {showSites && sel.includes('PLANT_MANAGER') && sites.length > 0 && <fieldset><legend className="text-sm font-medium mb-2">Which sites can the plant manager enter data for?</legend><div className="space-y-2">{sites.map((s) => <CheckField key={s.id} label={s.name} checked={fac.includes(s.id)} onChange={() => toggle(fac, setFac, s.id)} />)}</div></fieldset>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy} disabled={sel.length === 0 || (withEmail && !email)}>{submitLabel}</Button></div>
      </form>
    </Dialog>
  );
}

export default function TeamRbacUarPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const dialog = useDialog();
  const { enums } = useOptions();
  const { data, refetch } = useApi('/team');
  const { data: sites } = useApi('/facilities');
  const [invite, setInvite] = useState(false);
  const [edit, setEdit] = useState(null);
  const [link, setLink] = useState('');
  const [q, setQ] = useState('');
  const roles = enums.TenantRole || [];
  const isAdmin = user?.roles?.includes('ORG_ADMIN');
  const users = (data?.users || []).filter((u) => !q || `${u.fullName} ${u.email}`.toLowerCase().includes(q.toLowerCase()));

  async function call(path, method, body, ok) { try { const r = await apiFetch(path, { method, body: body ? JSON.stringify(body) : undefined }); if (ok) pushToast(ok); refetch(); return r; } catch (e) { pushToast(e.message, 'error'); } }
  async function sendInvite(v) { const r = await call('/team/invitations', 'POST', { email: v.email.trim(), roles: v.roles, facilityIds: v.facilityIds }, 'Invitation sent by email.'); if (r?.inviteUrlPath) setLink(`${window.location.origin}${r.inviteUrlPath}`); }
  async function setActive(u, isActive) {
    if (!isActive && !(await dialog.confirm({ title: `Remove access for ${u.fullName}?`, message: 'They are signed out at once and cannot sign in. Their past work stays on record. You can restore access later.', confirmLabel: 'Remove access', danger: true }))) return;
    call(`/team/${u.id}/status`, 'PATCH', { isActive }, isActive ? 'Access restored.' : 'Access removed.');
  }
  async function certify() {
    const q = Math.floor(((new Date().getMonth() + 9) % 12) / 3) + 1;
    const v = await dialog.form({ title: 'Confirm who has access', description: 'Record that you reviewed everyone’s access today. A snapshot of people and roles is saved for auditors.', submitLabel: 'Confirm review', fields: [{ name: 'periodLabel', type: 'text', label: 'Review name', required: true, defaultValue: `Q${q} review ${new Date().getFullYear()}` }, { name: 'notes', type: 'textarea', label: 'Notes', placeholder: 'e.g. Removed two former staff.' }] });
    if (!v) return;
    call('/access-certifications', 'POST', { periodLabel: v.periodLabel.trim(), notes: v.notes?.trim() || undefined }, 'Review recorded.');
  }

  return (
    <div>
      <PageHeader title="Team and access" description="Who can do what in your workspace." actions={isAdmin && <Button onClick={() => setInvite(true)}><Plus className="w-4 h-4" /> Invite someone</Button>} />
      {link && <Notice tone="ok" className="mb-4 flex-wrap gap-2"><span>Invitation sent. You can also share this link: <strong className="select-all break-all">{link}</strong></span><button className="underline inline-flex items-center gap-1" onClick={() => { navigator.clipboard?.writeText(link); pushToast('Link copied.'); }}><Copy className="w-3.5 h-3.5" />Copy</button></Notice>}
      <Card padded={false} className="mb-6">
        <div className="px-4 py-3 border-b border-line"><TextField className="w-64" label="" aria-label="Search people" placeholder="Search by name or email" value={q} onChange={setQ} /></div>
        {!data ? <div className="h-24 animate-pulse" /> : users.length === 0 ? <EmptyState title="No one found" /> : (
          <ul className="divide-y divide-line">{users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="flex-1 min-w-[14rem]"><div className="font-medium">{u.fullName}{u.id === user?.id && <span className="text-muted font-normal"> (you)</span>}</div><div className="text-sm text-muted">{u.email} · {u.lastLoginAt ? `last signed in ${fmtDate(u.lastLoginAt)}` : 'never signed in'}</div><div className="mt-1 flex flex-wrap gap-1">{u.roles.map((r) => <span key={r} className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">{ROLE[r] || r}</span>)}</div></div>
              <StatusBadge status={u.isActive ? 'ACTIVE' : 'PENDING'} label={u.isActive ? (u.twoFactorEnabled ? 'Active · 2-step on' : 'Active') : 'No access'} />
              {isAdmin && <div className="flex gap-1.5"><Button size="sm" variant="secondary" onClick={() => setEdit(u)}>Change roles</Button>{u.id !== user?.id && <Button size="sm" variant="secondary" onClick={() => setActive(u, !u.isActive)}>{u.isActive ? 'Remove access' : 'Restore'}</Button>}</div>}
            </li>))}</ul>)}
      </Card>
      {(data?.invitations || []).length > 0 && <Card title="Invitations waiting" padded={false} className="mb-6"><ul className="divide-y divide-line">{data.invitations.map((i) => <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3"><div className="flex-1"><div className="font-medium">{i.email}</div><div className="text-sm text-muted">{(i.roles || []).map((r) => ROLE[r] || r).join(', ')} · expires {fmtDate(i.expiresAt)}</div></div>{isAdmin && <Button size="sm" variant="secondary" onClick={() => call(`/team/invitations/${i.id}`, 'DELETE', null, 'Invitation cancelled.')}>Cancel</Button>}</li>)}</ul></Card>}
      <Card title="Access reviews" description="Auditors expect a regular check of who can see what." actions={<Button size="sm" variant="secondary" onClick={certify}>Confirm access review</Button>} padded={false}>
        {!(data?.certifications || []).length ? <EmptyState title="No reviews recorded">Confirm the review after you check the list above.</EmptyState> : <ul className="divide-y divide-line">{data.certifications.map((c) => <li key={c.id} className="px-5 py-2.5 flex justify-between gap-3"><span className="font-medium">{c.periodLabel}</span><span className="text-sm text-muted">{fmtDate(c.certifiedAt)}{c.notes ? ` · ${c.notes}` : ''}</span></li>)}</ul>}
      </Card>
      {invite && <RolesDialog open onClose={() => setInvite(false)} title="Invite someone" description="They get an email with a link to set their password." roles={roles} showSites sites={sites || []} withEmail submitLabel="Send invitation" onSubmit={sendInvite} />}
      {edit && <RolesDialog open onClose={() => setEdit(null)} title={`Roles for ${edit.fullName}`} description="Some combinations are not allowed, for example entering data and approving it. You will be told if so." initial={edit.roles} roles={roles} submitLabel="Save roles" onSubmit={(v) => call(`/team/${edit.id}/roles`, 'PATCH', { roles: v.roles }, 'Roles saved.')} />}
    </div>
  );
}
