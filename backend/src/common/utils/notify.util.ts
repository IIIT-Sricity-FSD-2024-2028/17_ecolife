import { Prisma } from '../../generated/prisma';

type Tx = Prisma.TransactionClient;
type Role = 'ORG_ADMIN' | 'PLANT_MANAGER' | 'FINANCE_MANAGER' | 'SUSTAINABILITY_LEAD' | 'INTERNAL_AUDITOR' | 'EXECUTIVE_APPROVER' | 'EXTERNAL_VERIFIER';

const LEAD: Role = 'SUSTAINABILITY_LEAD';
const EXEC: Role = 'EXECUTIVE_APPROVER';

/** Where to find the person who started something, so they hear back when it is decided. */
const OWNER: Record<string, string> = {
  resourceEntry: 'submittedById', waterLog: 'submittedById', wasteLog: 'submittedById', airEmissionLog: 'submittedById', materialLog: 'submittedById', facilityOutputLog: 'submittedById',
  scope3Purchase: 'enteredById', boundaryExclusion: 'requestedById', inventoryManagementPlan: 'authoredById', emissionFactor: 'createdById',
  recalculationRequest: 'requestedById', greenEconomyCredit: 'createdById', verificationFinding: 'raisedById', assuranceEngagement: 'verifierUserId'
};
const NOTE: Record<string, string> = {
  resourceEntry: 'reviewNote', waterLog: 'reviewNote', wasteLog: 'reviewNote', airEmissionLog: 'reviewNote', materialLog: 'reviewNote', facilityOutputLog: 'reviewNote',
  scope3Purchase: 'reviewNote', recalculationRequest: 'decisionNote'
};
/** A short pointer to the exact item, so a message is never just "something happened". */
const DETAIL: Record<string, { select: Record<string, unknown>; text: (r: any) => string | null }> = {
  resourceEntry: { select: { source: { select: { name: true } } }, text: (r) => r.source?.name ?? null },
  scope3Purchase: { select: { description: true }, text: (r) => r.description },
  boundaryExclusion: { select: { excludedItemName: true }, text: (r) => r.excludedItemName },
  emissionFactor: { select: { name: true }, text: (r) => r.name },
  entity: { select: { name: true }, text: (r) => r.name },
  facility: { select: { name: true }, text: (r) => r.name },
  inventoryManagementPlan: { select: { financialYear: true }, text: (r) => r.financialYear },
  recalculationRequest: { select: { reason: true }, text: (r) => r.reason },
  verificationFinding: { select: { questionText: true }, text: (r) => r.questionText },
  internalAuditFinding: { select: { controlDomain: true, summary: true }, text: (r) => `${r.controlDomain}: ${r.summary}` },
  assuranceEngagement: { select: { verifierFirmName: true }, text: (r) => r.verifierFirmName },
  greenEconomyCredit: { select: { serialRange: true }, text: (r) => r.serialRange },
  reportingPeriod: { select: { label: true }, text: (r) => r.label }
};
const LOG_LABEL: Record<string, string> = { WATER: 'water record', WASTE: 'waste record', AIR_EMISSIONS: 'air emission record', MATERIALS: 'material record', OUTPUTS: 'output record' };

type Plan = { roles?: Role[]; owner?: boolean; category: string; title: string; body: string; withNote?: boolean };

/** What should be told to whom for an action, in plain words. Returns null when nobody needs a message. */
function plan(action: string, resourceType: string): Plan | null {
  const log = action.match(/^([A-Z_]+?)_LOG_(SUBMITTED|APPROVED|REJECTED)$/);
  if (log) {
    const what = LOG_LABEL[log[1]] ?? 'record';
    if (log[2] === 'SUBMITTED') return { roles: [LEAD], category: 'REVIEW', title: 'Waiting for your review', body: `A ${what} has been sent for review.` };
    return { owner: true, category: 'DECISION', title: log[2] === 'APPROVED' ? `Your ${what} was approved` : `Your ${what} was sent back`, body: log[2] === 'APPROVED' ? `The reviewer approved your ${what}.` : `Please correct your ${what} and send it again.`, withNote: log[2] === 'REJECTED' };
  }
  switch (action) {
    case 'ENTRY_APPROVED': return { owner: true, category: 'DECISION', title: 'Your entry was approved', body: 'The reviewer approved your energy or fuel entry.' };
    case 'ENTRY_REJECTED': return { owner: true, category: 'DECISION', title: 'Your entry was sent back', body: 'Please correct the entry and send it again.', withNote: true };
    case 'ENTRY_SUBMITTED': return { roles: [LEAD], category: 'REVIEW', title: 'Waiting for your review', body: 'An energy or fuel entry has been sent for review.' };
    case 'SCOPE3_PURCHASE_SUBMITTED': return { roles: [LEAD], category: 'REVIEW', title: 'Waiting for your review', body: 'A Scope 3 purchase has been sent for review.' };
    case 'SCOPE3_PURCHASE_APPROVED': return { owner: true, category: 'DECISION', title: 'Your purchase was approved', body: 'The reviewer approved your Scope 3 purchase.' };
    case 'SCOPE3_PURCHASE_REJECTED': return { owner: true, category: 'DECISION', title: 'Your purchase was sent back', body: 'Please correct the Scope 3 purchase and send it again.', withNote: true };
    case 'PERIOD_CLOSED': return { roles: [EXEC], category: 'SIGN_OFF', title: 'A month is ready for sign-off', body: 'A month has been closed and is waiting for your sign-off.' };
    case 'PERIOD_EXECUTIVE_SIGNED_OFF': return { roles: [LEAD, 'ORG_ADMIN'], category: 'SIGN_OFF', title: 'A month was signed off', body: 'The executive signed off a closed month. Its evidence is now locked.' };
    case 'PERIOD_REOPENED': return { roles: [LEAD, 'PLANT_MANAGER'], category: 'SIGN_OFF', title: 'A month was reopened', body: 'A closed month was reopened for correction. Check the reason on the close page.' };
    case 'ENTITY_CREATED': case 'FACILITY_CREATED': return { roles: [EXEC], category: 'APPROVAL', title: 'Waiting for your approval', body: action === 'ENTITY_CREATED' ? 'A company entity was added and needs approval.' : 'A site was added and needs approval.' };
    case 'ENTITY_APPROVED': case 'ENTITY_REJECTED': case 'FACILITY_APPROVED': case 'FACILITY_REJECTED':
      return { roles: [LEAD], category: 'DECISION', title: `${action.startsWith('ENTITY') ? 'Entity' : 'Site'} ${action.endsWith('APPROVED') ? 'approved' : 'rejected'}`, body: `The executive ${action.endsWith('APPROVED') ? 'approved' : 'rejected'} a ${action.startsWith('ENTITY') ? 'company entity' : 'site'} you added.` };
    case 'BOUNDARY_EXCLUSION_REQUESTED': return { roles: [EXEC], category: 'APPROVAL', title: 'Waiting for your decision', body: 'A request to leave something out of the inventory needs your decision.' };
    case 'BOUNDARY_EXCLUSION_APPROVED': case 'BOUNDARY_EXCLUSION_REJECTED': return { owner: true, category: 'DECISION', title: `Exclusion ${action.endsWith('APPROVED') ? 'approved' : 'rejected'}`, body: `Your request to leave something out was ${action.endsWith('APPROVED') ? 'approved' : 'rejected'}.` };
    case 'IMP_AUTHORED': return { roles: [EXEC], category: 'APPROVAL', title: 'Waiting for your approval', body: 'An inventory plan was written and needs your approval.' };
    case 'IMP_APPROVED': return { roles: [LEAD], category: 'DECISION', title: 'Inventory plan approved', body: 'The executive approved the inventory plan.' };
    case 'FACTOR_PROPOSED': return { roles: [EXEC], category: 'APPROVAL', title: 'Waiting for your approval', body: 'A company-specific emission factor needs approval.' };
    case 'FACTOR_APPROVED': case 'FACTOR_REJECTED': return { owner: true, category: 'DECISION', title: `Factor ${action.endsWith('APPROVED') ? 'approved' : 'rejected'}`, body: `Your emission factor was ${action.endsWith('APPROVED') ? 'approved and is ready to use' : 'rejected'}.` };
    case 'RECALCULATION_REQUESTED': return { roles: [EXEC], category: 'APPROVAL', title: 'Waiting for your decision', body: 'A correction to past figures needs your decision.' };
    case 'RECALCULATION_APPROVED': case 'RECALCULATION_REJECTED': return { owner: true, category: 'DECISION', title: `Correction ${action.endsWith('APPROVED') ? 'approved' : 'rejected'}`, body: `Your request to correct past figures was ${action.endsWith('APPROVED') ? 'approved' : 'rejected'}.`, withNote: true };
    case 'GREEN_CREDIT_STATUS_CHANGED': return { roles: [EXEC], category: 'APPROVAL', title: 'A credit moved on', body: 'A green credit changed status. Credits waiting for retirement need your sign-off.' };
    case 'INTERNAL_AUDIT_FINDING_CREATED': return { roles: [LEAD, EXEC], category: 'AUDIT', title: 'New internal audit finding', body: 'The internal auditor recorded a finding that needs attention.' };
    case 'ASSURANCE_ENGAGEMENT_CREATED': return { owner: true, category: 'AUDIT', title: 'You have a new engagement', body: 'You were appointed on an external assurance engagement.' };
    case 'ASSURANCE_FINDING_RAISED': return { roles: [LEAD], category: 'AUDIT', title: 'The verifier has a question', body: 'The external verifier raised a question that needs your answer.' };
    case 'ASSURANCE_FINDING_RESPONDED': return { owner: true, category: 'AUDIT', title: 'Your question was answered', body: 'The company answered your verification question.' };
    case 'ASSURANCE_FINDING_CLOSED': return { roles: [LEAD], category: 'AUDIT', title: 'A verifier question was closed', body: 'The verifier closed a question you answered.' };
    case 'ASSURANCE_OPINION_ISSUED': return { roles: [LEAD, EXEC], category: 'AUDIT', title: 'Assurance opinion issued', body: 'The external verifier issued an opinion.' };
    default: return null;
  }
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Turns an audit event into in-app notifications ("the bell"). Runs inside the same transaction as the action.
 * It never tells the person who did the thing, and it never throws: a missing message must not undo real work.
 */
export async function notifyFromAudit(tx: Tx, p: { organizationId: string; actorId: string; action: string; resourceType: string; resourceId?: string }) {
  try {
    const pl = plan(p.action, p.resourceType);
    if (!pl) return;
    const delegate = lowerFirst(p.resourceType);
    const recipients = new Set<string>();
    let note = '';
    if (pl.roles?.length) {
      const rows = await tx.userRole.findMany({ where: { organizationId: p.organizationId, role: { in: pl.roles }, user: { isActive: true } }, select: { userId: true } });
      rows.forEach((r) => recipients.add(r.userId));
    }
    if ((pl.owner || pl.withNote) && p.resourceId && OWNER[delegate] && (tx as any)[delegate]) {
      const sel: Record<string, boolean> = { [OWNER[delegate]]: true };
      if (pl.withNote && NOTE[delegate]) sel[NOTE[delegate]] = true;
      const row = await (tx as any)[delegate].findUnique({ where: { id: p.resourceId }, select: sel });
      if (pl.owner && row?.[OWNER[delegate]]) recipients.add(row[OWNER[delegate]]);
      if (pl.withNote && NOTE[delegate] && row?.[NOTE[delegate]]) note = ` Note: ${String(row[NOTE[delegate]]).slice(0, 300)}`;
    }
    let detail = '';
    const d = DETAIL[delegate];
    if (d && p.resourceId && (tx as any)[delegate]) {
      const row = await (tx as any)[delegate].findUnique({ where: { id: p.resourceId }, select: d.select });
      const t = row ? d.text(row) : null;
      if (t) detail = ` (${String(t).slice(0, 110)})`;
    }
    recipients.delete(p.actorId);
    if (!recipients.size) return;
    await tx.notification.createMany({ data: [...recipients].map((userId) => ({ organizationId: p.organizationId, userId, category: pl.category, title: pl.title, body: pl.body + detail + note })) });
  } catch {
    /* a notification is a convenience; it must never block the action itself */
  }
}
