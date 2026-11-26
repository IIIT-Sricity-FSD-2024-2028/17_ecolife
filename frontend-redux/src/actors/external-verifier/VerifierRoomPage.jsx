import React from 'react';
import { Plus, TriangleAlert } from 'lucide-react';
import { useAction } from '../../hooks/useAction';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useOptions, toOptions } from '../../hooks/useOptions';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Card, EmptyState, Notice, PageHeader, StatusBadge } from '../../components/ui';
import { fmtDate } from '../../utils/formatters';
import { ASSURANCE, ENGAGEMENT_STATUS, FINDING_SEVERITY, FINDING_STATUS, OPINION } from '../../utils/labels';

export default function VerifierRoomPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const send = useAction();
  const dialog = useDialog();
  const { enums } = useOptions();
  const { data: engs, refetch } = useApi('/assurance/engagements');
  const { data: team } = useApi(user?.roles?.some((r) => ['SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER', 'ORG_ADMIN'].includes(r)) ? '/team' : null);
  const { data: periods } = useApi('/periods');
  const roles = user?.roles || [];
  const isVerifier = roles.includes('EXTERNAL_VERIFIER');
  const canCreate = roles.some((r) => ['SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER', 'ORG_ADMIN'].includes(r));
  const canRespond = roles.some((r) => ['SUSTAINABILITY_LEAD', 'FINANCE_MANAGER', 'PLANT_MANAGER'].includes(r));

  const call = (path, method, body, ok) => send({ path, method, body, toast: ok });

  async function create() {
    const verifiers = (team?.users || []).filter((u) => u.isActive && u.roles.includes('EXTERNAL_VERIFIER'));
    if (verifiers.length === 0) { pushToast('Invite the verifier first, with the External verifier role, from Team and access.', 'error'); return; }
    const v = await dialog.form({ title: 'Start a verification', description: 'Choose the outside verifier, the standard, and the months they will look at.', submitLabel: 'Start', wide: true, fields: [
      { name: 'verifierUserId', type: 'select', label: 'Verifier', required: true, options: verifiers.map((u) => ({ value: u.id, label: `${u.fullName} (${u.email})` })) },
      { name: 'verifierFirmName', type: 'text', label: 'Firm', required: true },
      { name: 'standard', type: 'select', label: 'Standard', required: true, options: toOptions(enums.AssuranceStandard, ASSURANCE) },
      { name: 'assuranceLevel', type: 'select', label: 'How deep', required: true, defaultValue: 'LIMITED', options: [{ value: 'LIMITED', label: 'Limited assurance' }, { value: 'REASONABLE', label: 'Reasonable assurance' }] },
      { name: 'acvaAccreditationNo', type: 'text', label: 'ACVA accreditation number', hint: 'Needed for the BEE carbon market standard.' },
      { name: 'periodId', type: 'select', label: 'First month to cover', required: true, options: (periods || []).map((p) => ({ value: p.id, label: p.label })), hint: 'More months can be covered later.' }] });
    if (!v) return;
    call('/assurance/engagements', 'POST', { verifierUserId: v.verifierUserId, verifierFirmName: v.verifierFirmName.trim(), standard: v.standard, assuranceLevel: v.assuranceLevel, acvaAccreditationNo: v.acvaAccreditationNo?.trim() || undefined, periodIds: [v.periodId] }, 'Verification started.');
  }
  async function raise(e) {
    const v = await dialog.form({ title: 'Raise a finding', description: 'The company will be asked to respond.', submitLabel: 'Raise', wide: true, fields: [
      { name: 'periodId', type: 'select', label: 'Month', required: true, defaultValue: e.periods?.[0]?.periodId, options: (e.periods || []).map((p) => ({ value: p.periodId, label: p.period.label })) },
      { name: 'severity', type: 'select', label: 'How serious', required: true, defaultValue: 'CLARIFICATION', options: toOptions(Object.keys(FINDING_SEVERITY), FINDING_SEVERITY) },
      { name: 'questionText', type: 'textarea', label: 'What do you need to know or fix?', required: true, minLength: 10 }] });
    if (!v) return;
    call(`/assurance/engagements/${e.id}/findings`, 'POST', v, 'Finding raised.');
  }
  async function respond(f) {
    const v = await dialog.form({ title: 'Answer the verifier', description: f.questionText, submitLabel: 'Send answer', fields: [{ name: 'responseText', type: 'textarea', label: 'Your answer', required: true, minLength: 10 }] });
    if (!v) return;
    call(`/assurance/findings/${f.id}/respond`, 'PATCH', v, 'Answer sent.');
  }
  async function close(f, status) { call(`/assurance/findings/${f.id}/close`, 'PATCH', { status }, status === 'RESOLVED' ? 'Marked as resolved.' : 'Marked as not resolved.'); }
  async function opinion(e) {
    const v = await dialog.form({ title: 'Issue your opinion', description: 'This ends the verification. It cannot be changed afterwards.', submitLabel: 'Issue opinion', wide: true, fields: [
      { name: 'opinion', type: 'select', label: 'Opinion', required: true, options: toOptions(['UNMODIFIED', 'QUALIFIED', 'ADVERSE', 'DISCLAIMER'], OPINION) },
      { name: 'opinionNotes', type: 'textarea', label: 'Basis for the opinion', required: true, minLength: 20, placeholder: 'What you checked and what you concluded.' }] });
    if (!v) return;
    call(`/assurance/engagements/${e.id}/opinion`, 'POST', v, 'Opinion issued.');
  }

  return (
    <div>
      <PageHeader title="Verification" description={isVerifier ? 'Raise findings, review answers and issue your opinion.' : 'Outside verification of your figures.'} actions={canCreate && <Button onClick={create}><Plus className="w-4 h-4" /> Start a verification</Button>} />
      {!engs ? <div className="h-32 animate-pulse" /> : engs.length === 0 ? <Card><EmptyState title="No verification yet">{canCreate ? 'Start one when an outside verifier is ready to look at your figures.' : 'Nothing has been assigned to you yet.'}</EmptyState></Card> : (
        <div className="space-y-4">{engs.map((e) => {
          const done = e.status === 'OPINION_ISSUED';
          const finds = e.findings || [];
          return (
            <Card key={e.id} title={`${e.verifierFirmName}`} description={`${ASSURANCE[e.standard] || e.standard} · ${e.assuranceLevel === 'LIMITED' ? 'Limited' : 'Reasonable'} assurance · ${(e.periods || []).map((p) => p.period.label).join(', ') || 'no months yet'}`}
              actions={<div className="flex items-center gap-2"><StatusBadge status={done ? 'ACTIVE' : 'PENDING'} label={done ? OPINION[e.opinion] || ENGAGEMENT_STATUS[e.status] : ENGAGEMENT_STATUS[e.status]} />{isVerifier && !done && <><Button size="sm" variant="secondary" onClick={() => raise(e)}>Raise a finding</Button><Button size="sm" onClick={() => opinion(e)}>Issue opinion</Button></>}</div>}>
              {e.periodModifiedAlert && <Notice tone="warn" className="mb-3"><TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" /> A month in this verification was reopened after it started. Check those figures again.</Notice>}
              {done && e.opinionNotes && <p className="text-sm mb-3">{e.opinionNotes}</p>}
              {finds.length === 0 ? <p className="text-sm text-muted">No findings raised.</p> : (
                <ul className="divide-y divide-line -my-1">{finds.map((f) => (
                  <li key={f.id} className="py-3">
                    <div className="flex flex-wrap items-start gap-3"><div className="flex-1 min-w-[14rem]"><div className="text-xs text-muted">{FINDING_SEVERITY[f.severity]} · {f.period?.label} · {fmtDate(f.createdAt)}</div><div className="mt-0.5">{f.questionText}</div>{f.responseText && <div className="mt-1.5 text-sm bg-mist rounded-md px-3 py-2"><span className="text-muted">Company answer: </span>{f.responseText}</div>}</div>
                      <StatusBadge status={f.status === 'RESOLVED' ? 'ACTIVE' : f.status} label={FINDING_STATUS[f.status]} />
                      {canRespond && ['OPEN', 'UNRESOLVED'].includes(f.status) && !done && <Button size="sm" onClick={() => respond(f)}>Answer</Button>}
                      {isVerifier && f.status === 'RESPONDED' && !done && <><Button size="sm" onClick={() => close(f, 'RESOLVED')}>Resolved</Button><Button size="sm" variant="secondary" onClick={() => close(f, 'UNRESOLVED')}>Not resolved</Button></>}
                    </div>
                  </li>))}</ul>)}
            </Card>);
        })}</div>)}
    </div>
  );
}
