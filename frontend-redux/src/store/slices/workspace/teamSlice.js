import { createEntityAdapter, createSelector, isAnyOf } from '@reduxjs/toolkit';
import { apiThunk } from '../../apiThunk';
import { createResourceSlice, markStale } from '../../resourceSlice';

/**
 * Team: the people in one company, their invitations and access reviews.
 * Backend resource: /team, /team/invitations, /access-certifications.
 *
 * This is the reference slice. CRUD maps onto the backend like this:
 *   Create  inviteMember          POST   /team/invitations
 *   Read    fetchTeam             GET    /team
 *   Update  updateRoles           PATCH  /team/:id/roles
 *           setMemberActive       PATCH  /team/:id/status   (remove or restore access)
 *   Delete  cancelInvitation      DELETE /team/invitations/:id
 * Every change waits for the backend to say yes, then the store is updated from its reply.
 */
const users = createEntityAdapter();

export const fetchTeam = apiThunk('team/load', () => ({ path: '/team' }), { silent: true });
export const inviteMember = apiThunk('team/invite', (a) => ({ path: '/team/invitations', method: 'POST', body: { email: a.email.trim(), roles: a.roles, facilityIds: a.facilityIds } }));
export const updateRoles = apiThunk('team/updateRoles', (a) => ({ path: `/team/${a.id}/roles`, method: 'PATCH', body: { roles: a.roles } }));
export const setMemberActive = apiThunk('team/setActive', (a) => ({ path: `/team/${a.id}/status`, method: 'PATCH', body: { isActive: a.isActive } }));
export const cancelInvitation = apiThunk('team/cancelInvitation', (a) => ({ path: `/team/invitations/${a.id}`, method: 'DELETE' }));
export const recordAccessReview = apiThunk('team/accessReview', (a) => ({ path: '/access-certifications', method: 'POST', body: { periodLabel: a.periodLabel.trim(), notes: a.notes || undefined } }));

const emptyDraft = { email: '', roles: [], facilityIds: [] };
const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

const slice = createResourceSlice('team', {
  initialState: users.getInitialState({
    status: 'idle', error: '',
    invitations: [], certifications: [],
    busy: null,                       // { key, id } while a change is on its way to the backend
    ui: { dialog: null, editingId: null, invitePath: '', query: '' },
    draft: emptyDraft
  }),
  reducers: {
    inviteDialogOpened(s) { s.ui.dialog = 'invite'; s.draft = emptyDraft; },
    rolesDialogOpened(s, a) { s.ui.dialog = 'roles'; s.ui.editingId = a.payload; s.draft = { ...emptyDraft, roles: s.entities[a.payload]?.roles || [] }; },
    dialogClosed(s) { s.ui.dialog = null; s.ui.editingId = null; },
    draftEmailChanged(s, a) { s.draft.email = a.payload; },
    draftRoleToggled(s, a) { s.draft.roles = toggle(s.draft.roles, a.payload); },
    draftFacilityToggled(s, a) { s.draft.facilityIds = toggle(s.draft.facilityIds, a.payload); },
    queryChanged(s, a) { s.ui.query = a.payload; }
  },
  extraReducers: (b) => {
    b.addCase(fetchTeam.pending, (s) => { s.status = 'loading'; s.error = ''; });
    b.addCase(fetchTeam.fulfilled, (s, a) => { s.status = 'ready'; users.setAll(s, a.payload.users); s.invitations = a.payload.invitations; s.certifications = a.payload.certifications; });
    b.addCase(fetchTeam.rejected, (s, a) => { s.status = 'failed'; s.error = a.payload?.message || 'Could not load the team.'; });

    b.addCase(inviteMember.fulfilled, (s, a) => { s.invitations.unshift(a.payload.invitation); s.ui.invitePath = a.payload.inviteUrlPath || ''; s.ui.dialog = null; });
    b.addCase(updateRoles.fulfilled, (s, a) => { users.updateOne(s, { id: a.payload.userId, changes: { roles: a.payload.roles } }); s.ui.dialog = null; s.ui.editingId = null; });
    b.addCase(setMemberActive.fulfilled, (s, a) => { users.updateOne(s, { id: a.payload.id, changes: { isActive: a.payload.isActive } }); });
    b.addCase(cancelInvitation.fulfilled, (s, a) => { s.invitations = s.invitations.filter((i) => i.id !== a.payload.id); });
    b.addCase(recordAccessReview.fulfilled, (s, a) => { s.certifications.unshift(a.payload); });

    // one busy marker for every change, so a button can disable itself while its own request is running
    const changes = [inviteMember, updateRoles, setMemberActive, cancelInvitation, recordAccessReview];
    const keyOf = { [inviteMember.typePrefix]: 'invite', [updateRoles.typePrefix]: 'roles', [setMemberActive.typePrefix]: 'status', [cancelInvitation.typePrefix]: 'cancel', [recordAccessReview.typePrefix]: 'review' };
    b.addMatcher(isAnyOf(...changes.map((t) => t.fulfilled)), markStale); // other pages reading /team refresh
    b.addMatcher(isAnyOf(...changes.map((t) => t.pending)), (s, a) => { s.busy = { key: keyOf[a.type.replace('/pending', '')], id: a.meta.arg.id || null }; });
    b.addMatcher(isAnyOf(...changes.flatMap((t) => [t.fulfilled, t.rejected])), (s) => { s.busy = null; });
  }
});

export const { inviteDialogOpened, rolesDialogOpened, dialogClosed, draftEmailChanged, draftRoleToggled, draftFacilityToggled, queryChanged } = slice.actions;

const sel = users.getSelectors((s) => s.team);
export const selectTeamStatus = (s) => s.team.status;
export const selectTeamError = (s) => s.team.error;
export const selectTeamLoaded = (s) => s.team.status === 'ready';
export const selectInvitations = (s) => s.team.invitations;
export const selectCertifications = (s) => s.team.certifications;
export const selectTeamUi = (s) => s.team.ui;
export const selectTeamDraft = (s) => s.team.draft;
export const selectTeamBusy = (s) => s.team.busy;
export const selectMemberById = sel.selectById;
export const selectVisibleMembers = createSelector([sel.selectAll, (s) => s.team.ui.query], (all, q) => {
  const needle = q.trim().toLowerCase();
  return needle ? all.filter((u) => `${u.fullName} ${u.email}`.toLowerCase().includes(needle)) : all;
});
export default slice.reducer;
