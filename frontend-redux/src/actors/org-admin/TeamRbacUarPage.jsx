import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Copy, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useOptions } from '../../hooks/useOptions';
import { useDialog, Dialog } from '../../components/ui/Dialogs';
import { Button, Card, CheckField, EmptyState, Notice, PageHeader, StatusBadge, TextField } from '../../components/ui';
import { fmtDate } from '../../utils/formatters';
import { ROLE, ROLE_HELP } from '../../utils/labels';
import { useApi } from '../../hooks/useApi';
import {
  cancelInvitation, dialogClosed, draftEmailChanged, draftFacilityToggled, draftRoleToggled, fetchTeam, inviteDialogOpened, inviteMember,
  queryChanged, recordAccessReview, rolesDialogOpened, selectCertifications, selectInvitations, selectMemberById, selectTeamBusy,
  selectTeamDraft, selectTeamError, selectTeamLoaded, selectTeamStatus, selectTeamUi, selectVisibleMembers, setMemberActive, updateRoles
} from '../../store/slices/workspace/teamSlice';

/** The invite / change-roles form. Every field lives in the team slice (draft), not in the component. */
function RolesDialog({ title, description, roles, sites, withEmail, submitLabel, onSubmit, busy }) {
  const dispatch = useDispatch();
  const draft = useSelector(selectTeamDraft);
  const close = () => dispatch(dialogClosed());
  const go = (e) => { e.preventDefault(); onSubmit(draft); };
  return (
    <Dialog open onClose={close} title={title} description={description}>
      <form onSubmit={go} className="space-y-4">
        {withEmail && <TextField label="Work email" type="email" required placeholder="colleague@company.in" value={draft.email} onChange={(v) => dispatch(draftEmailChanged(v))} />}
        <fieldset><legend className="text-sm font-medium mb-2">What can they do?</legend>
          <div className="space-y-2">{roles.map((r) => <CheckField key={r} label={ROLE[r] || r} hint={ROLE_HELP[r]} checked={draft.roles.includes(r)} onChange={() => dispatch(draftRoleToggled(r))} />)}</div></fieldset>
        {withEmail && draft.roles.includes('PLANT_MANAGER') && sites.length > 0 && <fieldset><legend className="text-sm font-medium mb-2">Which sites can the plant manager enter data for?</legend><div className="space-y-2">{sites.map((s) => <CheckField key={s.id} label={s.name} checked={draft.facilityIds.includes(s.id)} onChange={() => dispatch(draftFacilityToggled(s.id))} />)}</div></fieldset>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={close}>Cancel</Button><Button type="submit" loading={busy} disabled={draft.roles.length === 0 || (withEmail && !draft.email)}>{submitLabel}</Button></div>
      </form>
    </Dialog>
  );
}

export default function TeamRbacUarPage() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const dialog = useDialog();
  const { enums } = useOptions();
  const status = useSelector(selectTeamStatus);
  const loadError = useSelector(selectTeamError);
  const loaded = useSelector(selectTeamLoaded);
  const users = useSelector(selectVisibleMembers);
  const invitations = useSelector(selectInvitations);
  const certifications = useSelector(selectCertifications);
  const { data: sitesData } = useApi('/facilities');
  const sites = sitesData || [];
  const ui = useSelector(selectTeamUi);
  const busy = useSelector(selectTeamBusy);
  const editing = useSelector((s) => (ui.editingId ? selectMemberById(s, ui.editingId) : null));
  const roles = enums.TenantRole || [];
  const isAdmin = user?.roles?.includes('ORG_ADMIN');
  const link = ui.invitePath ? `${window.location.origin}${ui.invitePath}` : '';

  useEffect(() => { dispatch(fetchTeam()); }, [dispatch]);

  const sendInvite = (d) => dispatch(inviteMember({ ...d, toast: 'Invitation sent by email.' }));
  async function setActive(u, isActive) {
    if (!isActive && !(await dialog.confirm({ title: `Remove access for ${u.fullName}?`, message: 'They are signed out at once and cannot sign in. Their past work stays on record. You can restore access later.', confirmLabel: 'Remove access', danger: true }))) return;
    dispatch(setMemberActive({ id: u.id, isActive, toast: isActive ? 'Access restored.' : 'Access removed.' }));
  }
  async function certify() {
    const q = Math.floor(((new Date().getMonth() + 9) % 12) / 3) + 1;
    const v = await dialog.form({ title: 'Confirm who has access', description: 'Record that you reviewed everyone’s access today. A snapshot of people and roles is saved for auditors.', submitLabel: 'Confirm review', fields: [{ name: 'periodLabel', type: 'text', label: 'Review name', required: true, defaultValue: `Q${q} review ${new Date().getFullYear()}` }, { name: 'notes', type: 'textarea', label: 'Notes', placeholder: 'e.g. Removed two former staff.' }] });
    if (!v) return;
    dispatch(recordAccessReview({ periodLabel: v.periodLabel, notes: v.notes?.trim(), toast: 'Review recorded.' }));
  }

  return (
    <div>
      <PageHeader title="Team and access" description="Who can do what in your workspace." actions={isAdmin && <Button onClick={() => dispatch(inviteDialogOpened())}><Plus className="w-4 h-4" /> Invite someone</Button>} />
      {link && <Notice tone="ok" className="mb-4 flex-wrap gap-2"><span>Invitation sent. You can also share this link: <strong className="select-all break-all">{link}</strong></span><button className="underline inline-flex items-center gap-1" onClick={() => { navigator.clipboard?.writeText(link); pushToast('Link copied.'); }}><Copy className="w-3.5 h-3.5" />Copy</button></Notice>}
      <Card padded={false} className="mb-6">
        <div className="px-4 py-3 border-b border-line"><TextField className="w-64" label="" aria-label="Search people" placeholder="Search by name or email" value={ui.query} onChange={(v) => dispatch(queryChanged(v))} /></div>
        {!loaded ? (status === 'failed' ? <div className="p-4"><Notice tone="danger" className="flex-wrap gap-2"><span>{loadError}</span><button className="underline" onClick={() => dispatch(fetchTeam())}>Try again</button></Notice></div> : <div className="h-24 animate-pulse" />) : users.length === 0 ? <EmptyState title="No one found" /> : (
          <ul className="divide-y divide-line">{users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="flex-1 min-w-[14rem]"><div className="font-medium">{u.fullName}{u.id === user?.id && <span className="text-muted font-normal"> (you)</span>}</div><div className="text-sm text-muted">{u.email} · {u.lastLoginAt ? `last signed in ${fmtDate(u.lastLoginAt)}` : 'never signed in'}</div><div className="mt-1 flex flex-wrap gap-1">{u.roles.map((r) => <span key={r} className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">{ROLE[r] || r}</span>)}</div></div>
              <StatusBadge status={u.isActive ? 'ACTIVE' : 'PENDING'} label={u.isActive ? (u.twoFactorEnabled ? 'Active · 2-step on' : 'Active') : 'No access'} />
              {isAdmin && <div className="flex gap-1.5"><Button size="sm" variant="secondary" onClick={() => dispatch(rolesDialogOpened(u.id))}>Change roles</Button>{u.id !== user?.id && <Button size="sm" variant="secondary" onClick={() => setActive(u, !u.isActive)}>{u.isActive ? 'Remove access' : 'Restore'}</Button>}</div>}
            </li>))}</ul>)}
      </Card>
      {invitations.length > 0 && <Card title="Invitations waiting" padded={false} className="mb-6"><ul className="divide-y divide-line">{invitations.map((i) => <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3"><div className="flex-1"><div className="font-medium">{i.email}</div><div className="text-sm text-muted">{(i.roles || []).map((r) => ROLE[r] || r).join(', ')} · expires {fmtDate(i.expiresAt)}</div></div>{isAdmin && <Button size="sm" variant="secondary" loading={busy?.key === 'cancel' && busy.id === i.id} onClick={() => dispatch(cancelInvitation({ id: i.id, toast: 'Invitation cancelled.' }))}>Cancel</Button>}</li>)}</ul></Card>}
      <Card title="Access reviews" description="Auditors expect a regular check of who can see what." actions={<Button size="sm" variant="secondary" loading={busy?.key === 'review'} onClick={certify}>Confirm access review</Button>} padded={false}>
        {!certifications.length ? <EmptyState title="No reviews recorded">Confirm the review after you check the list above.</EmptyState> : <ul className="divide-y divide-line">{certifications.map((c) => <li key={c.id} className="px-5 py-2.5 flex justify-between gap-3"><span className="font-medium">{c.periodLabel}</span><span className="text-sm text-muted">{fmtDate(c.certifiedAt)}{c.notes ? ` · ${c.notes}` : ''}</span></li>)}</ul>}
      </Card>
      {ui.dialog === 'invite' && <RolesDialog title="Invite someone" description="They get an email with a link to set their password." roles={roles} sites={sites} withEmail submitLabel="Send invitation" busy={busy?.key === 'invite'} onSubmit={sendInvite} />}
      {ui.dialog === 'roles' && editing && <RolesDialog title={`Roles for ${editing.fullName}`} description="Some combinations are not allowed, for example entering data and approving it. You will be told if so." roles={roles} sites={sites} submitLabel="Save roles" busy={busy?.key === 'roles'} onSubmit={(d) => dispatch(updateRoles({ id: editing.id, roles: d.roles, toast: 'Roles saved.' }))} />}
    </div>
  );
}
