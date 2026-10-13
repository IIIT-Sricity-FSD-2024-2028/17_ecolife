/**
 * Rich demo activity for the "Demo Organization", so every screen has
 * something real to show: three departments, staff in every role, three
 * months of approved usage with calculated emissions, a live review queue,
 * returned/rejected entries, alerts, amendments, reports at every approval
 * stage, targets, invoices and an audit trail.
 *
 * All dates are relative to "today", so the data always looks current.
 * Idempotent: it does nothing if the demo org already has this activity.
 */
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { DataStore, OrgRole, ResourceRecord, SubmissionStatus } from './types';
import { resolveFactors } from '../calculations/factor-resolution';

const SALT_ROUNDS = 10;
const iso = (d: Date) => d.toISOString();
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** First/last day (UTC) of the month `offset` months from now (0 = this month). */
function monthBounds(offset: number) {
  const t = new Date();
  const start = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + offset + 1, 0));
  return { start, end, startStr: ymd(start), endStr: ymd(end), label: start.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
}

type Plan = {
  dept: 'Main Facility' | 'Fleet & Logistics' | 'Corporate Office';
  type: string;
  unit: string;
  /** quantity for months -3, -2, -1 and (optionally) the current month */
  qty: [number, number, number, number?];
  unitCost: number;
  /** status for months -3, -2, -1 and the current month */
  status: [SubmissionStatus, SubmissionStatus, SubmissionStatus, SubmissionStatus?];
  comment?: { month: number; text: string };
};

const L = 'LOCKED' as SubmissionStatus;

const PLANS: Plan[] = [
  // ---- Main Facility ----
  { dept: 'Main Facility', type: 'Grid Electricity', unit: 'kWh', qty: [44200, 45800, 47100, 21500], unitCost: 0.13, status: [L, L, 'SUBMITTED', 'DRAFT'] },
  { dept: 'Main Facility', type: 'Natural Gas', unit: 'm3', qty: [690, 705, 745], unitCost: 0.55, status: [L, L, 'SUBMITTED'] },
  {
    dept: 'Main Facility', type: 'Municipal Water', unit: 'm3', qty: [2980, 3110, 31000], unitCost: 1.6, status: [L, L, 'REJECTED'],
    comment: { month: -1, text: 'This looks like litres entered as m³ (31,000 vs ~3,000 normally). Please correct the unit or quantity and resubmit.' },
  },
  { dept: 'Main Facility', type: 'General Waste (Landfill)', unit: 'kg', qty: [680, 720, 705], unitCost: 0.12, status: [L, L, L] },
  // ---- Fleet & Logistics ----
  { dept: 'Fleet & Logistics', type: 'Diesel Fuel', unit: 'liters', qty: [4150, 4320, 1850], unitCost: 1.45, status: [L, L, 'SUBMITTED'] },
  { dept: 'Fleet & Logistics', type: 'Grid Electricity', unit: 'kWh', qty: [3100, 3250, 3180], unitCost: 0.13, status: [L, L, L] },
  // ---- Corporate Office ----
  {
    dept: 'Corporate Office', type: 'Grid Electricity', unit: 'kWh', qty: [3800, 3720, 7600], unitCost: 0.13, status: [L, L, 'CHANGES_REQUESTED'],
    comment: { month: -1, text: 'This is roughly double the usual ~3,800 kWh — it may cover two billing cycles. Please confirm the meter reading dates.' },
  },
  { dept: 'Corporate Office', type: 'Municipal Water', unit: 'm3', qty: [455, 440, 462], unitCost: 1.6, status: [L, L, L] },
  { dept: 'Corporate Office', type: 'General Waste (Landfill)', unit: 'kg', qty: [250, 245, 260], unitCost: 0.12, status: [L, L, L] },
];

export async function seedDemoActivity(store: DataStore) {
  const org = store.organizations.find((o) => o.slug === 'demo-organization');
  if (!org) return;
  if (store.departments.some((d) => d.organizationId === org.id && d.name === 'Fleet & Logistics')) {
    console.log('Demo activity already exists, skipping.');
    return;
  }
  console.log('\nSeeding demo activity...');

  const today = new Date();
  const m = { '-3': monthBounds(-3), '-2': monthBounds(-2), '-1': monthBounds(-1), '0': monthBounds(0) } as const;
  const monthKey = (i: number) => String(i) as keyof typeof m;

  // ---- Departments & locations -------------------------------------------
  const main = store.departments.find((d) => d.organizationId === org.id && d.name === 'Main Facility')!;
  const mkDept = (name: string, description: string) => {
    const d = { id: uuidv4(), organizationId: org.id, name, description, createdAt: iso(addDays(today, -120)), updatedAt: iso(addDays(today, -120)) };
    store.departments.push(d);
    return d;
  };
  const fleet = mkDept('Fleet & Logistics', 'Delivery vehicles and depot operations');
  const office = mkDept('Corporate Office', 'Head office and administration');
  const depts: Record<string, typeof main> = { 'Main Facility': main, 'Fleet & Logistics': fleet, 'Corporate Office': office };

  const mkLoc = (departmentId: string, name: string, address: string) =>
    store.locations.push({ id: uuidv4(), departmentId, name, address, createdAt: iso(addDays(today, -110)) });
  mkLoc(main.id, 'Plant A', '12 Industrial Way');
  mkLoc(main.id, 'Warehouse B', '14 Industrial Way');
  mkLoc(fleet.id, 'North Depot', '88 Haulage Road');
  mkLoc(office.id, 'Head Office, Floor 3', '1 Commerce Square');

  // ---- Users ----------------------------------------------------------------
  const hash = await bcrypt.hash('DemoPass1!', SALT_ROUNDS);
  const mkUser = (email: string, fullName: string, role: OrgRole, departmentId: string | null, isActive = true, phone: string | null = null) => {
    const u = {
      id: uuidv4(), organizationId: org.id, email, passwordHash: hash, fullName, phone, role, isOwner: false, isActive,
      departmentId, invitedById: null, createdAt: iso(addDays(today, -100)), updatedAt: iso(addDays(today, -100)), lastLogin: isActive ? iso(addDays(today, -1)) : null,
    };
    store.orgUsers.push(u);
    return u;
  };
  const owner = store.orgUsers.find((u) => u.email === 'owner@demo.tropos.dev')!;
  const contributorMain = store.orgUsers.find((u) => u.email === 'contributor@demo.tropos.dev')!;
  const reviewer = store.orgUsers.find((u) => u.email === 'reviewer@demo.tropos.dev')!;
  const executive = store.orgUsers.find((u) => u.email === 'executive@demo.tropos.dev')!;
  const contributorFleet = mkUser('fleet@demo.tropos.dev', 'Fiona Fleet', 'CONTRIBUTOR', fleet.id, true, '+1 555 0142');
  const contributorOffice = mkUser('office@demo.tropos.dev', 'Oscar Office', 'CONTRIBUTOR', office.id);
  mkUser('former@demo.tropos.dev', 'Frank Former', 'CONTRIBUTOR', main.id, false);
  contributorMain.phone = '+1 555 0101';
  const contributorOf = (dept: string) => (dept === 'Main Facility' ? contributorMain : dept === 'Fleet & Logistics' ? contributorFleet : contributorOffice);
  console.log('Created departments, locations and users (fleet@ / office@ / former@demo.tropos.dev, password DemoPass1!)');

  // ---- Audit helper ---------------------------------------------------------
  const audit = (userId: string | null, action: string, entityType: string, entityId: string, at: Date, metadata: Record<string, unknown> | null = null) =>
    store.auditLogs.push({ id: uuidv4(), organizationId: org.id, orgUserId: userId, platformAdminId: null, action, entityType, entityId, metadata, createdAt: iso(at) });

  audit(owner.id, 'department.created', 'department', fleet.id, addDays(today, -120));
  audit(owner.id, 'department.created', 'department', office.id, addDays(today, -120));
  audit(owner.id, 'org_user.invited', 'org_user', contributorFleet.id, addDays(today, -100), { role: 'CONTRIBUTOR' });
  audit(owner.id, 'org_user.invited', 'org_user', contributorOffice.id, addDays(today, -100), { role: 'CONTRIBUTOR' });
  [owner, contributorMain, contributorFleet, reviewer, executive].forEach((u, i) => audit(u.id, 'auth.login', 'org_user', u.id, addDays(today, -(i + 1))));

  // ---- Targets (quarter-to-date: the first two months are approved so far, the third is still in review)
  const qStart = m['-3'].startStr;
  const qEnd = m['-1'].endStr;
  const mkTarget = (departmentId: string | null, resourceCategory: any, metric: string, targetValue: number) => {
    const t = { id: uuidv4(), organizationId: org.id, departmentId, resourceCategory, targetValue, metric, periodStart: qStart, periodEnd: qEnd, createdById: reviewer.id, createdAt: iso(addDays(today, -95)), updatedAt: iso(addDays(today, -95)) };
    store.targets.push(t);
    audit(reviewer.id, 'target.created', 'target', t.id, addDays(today, -95));
    return t;
  };
  mkTarget(main.id, 'ELECTRICITY', 'usage', 85000);
  mkTarget(main.id, null, 'emissions', 75000);
  mkTarget(fleet.id, 'FUEL', 'usage', 9000);
  mkTarget(office.id, null, 'emissions', 16000);
  mkTarget(null, null, 'cost', 45000);

  // ---- Resource records, submissions, evidence, calculations ----------------
  const carbonPrice = org.carbonPricePerTon;
  const createdRecords: { record: ResourceRecord; monthIdx: number; plan: Plan }[] = [];

  for (const plan of PLANS) {
    const type = store.resourceTypes.find((t) => t.name === plan.type);
    if (!type) continue;
    const dept = depts[plan.dept];
    const author = contributorOf(plan.dept);

    for (const monthIdx of [-3, -2, -1, 0]) {
      const idx = monthIdx + 3;
      const quantity = plan.qty[idx];
      const status = plan.status[idx];
      if (quantity === undefined || status === undefined) continue;

      const b = m[monthKey(monthIdx)];
      const periodEnd = monthIdx === 0 ? ymd(addDays(today, -1)) : b.endStr;
      const enteredAt = monthIdx === 0 ? addDays(today, -2) : addDays(b.end, 2);
      const needsEvidence = type.evidenceThreshold !== null && quantity > type.evidenceThreshold;
      const reviewComment = plan.comment && plan.comment.month === monthIdx ? plan.comment.text : null;

      const record: ResourceRecord = {
        id: uuidv4(), organizationId: org.id, departmentId: dept.id,
        locationId: plan.dept === 'Main Facility' ? store.locations.find((l) => l.departmentId === main.id)!.id : null,
        resourceTypeId: type.id, quantity, unit: plan.unit, cost: Math.round(quantity * plan.unitCost * 100) / 100,
        periodStart: b.startStr, periodEnd, notes: null, status,
        evidenceRequirement: needsEvidence ? 'REQUIRED' : 'NOT_REQUIRED', createdById: author.id,
        submittedAt: status === 'DRAFT' ? null : iso(addDays(enteredAt, 1)),
        lockedAt: status === 'LOCKED' ? iso(addDays(enteredAt, 3)) : null,
        createdAt: iso(enteredAt), updatedAt: iso(addDays(enteredAt, status === 'LOCKED' ? 3 : 1)),
      };
      if (plan.type === 'Diesel Fuel' && monthIdx === -1) record.notes = 'Includes one-off emergency relief run.';
      store.resourceRecords.push(record);
      createdRecords.push({ record, monthIdx, plan });
      audit(author.id, 'resource_record.created', 'resource_record', record.id, enteredAt);

      // Evidence for everything past draft that needs it (a draft is left without, to show the gap)
      if (needsEvidence && status !== 'DRAFT') {
        const ev = {
          id: uuidv4(), resourceRecordId: record.id, fileName: `${plan.type.split(' ')[0].toLowerCase()}-invoice-${b.startStr.slice(0, 7)}.pdf`,
          filePath: `uploads/seed/${record.id}.pdf`, mimeType: 'application/pdf', fileSizeBytes: 180_000 + Math.floor(quantity % 90_000), uploadedById: author.id, uploadedAt: iso(addDays(enteredAt, 0)),
        };
        store.evidence.push(ev);
        audit(author.id, 'evidence.uploaded', 'resource_record', record.id, enteredAt, { fileName: ev.fileName });
      }

      if (status === 'DRAFT') continue;

      // Submission row
      const reviewed = status !== 'SUBMITTED';
      const reviewedAt = addDays(enteredAt, 3);
      store.submissions.push({
        id: uuidv4(), resourceRecordId: record.id, organizationId: org.id, departmentId: dept.id, status,
        reviewedById: reviewed ? reviewer.id : null,
        reviewComment: reviewed ? (reviewComment ?? (status === 'LOCKED' ? 'Matches the invoice. Approved.' : null)) : null,
        reviewedAt: reviewed ? iso(reviewedAt) : null, version: status === 'CHANGES_REQUESTED' ? 1 : 1,
        createdAt: iso(addDays(enteredAt, 1)), updatedAt: iso(reviewed ? reviewedAt : addDays(enteredAt, 1)),
      });
      audit(author.id, 'submission.created', 'resource_record', record.id, addDays(enteredAt, 1));

      if (status === 'LOCKED') {
        audit(reviewer.id, 'submission.approved', 'resource_record', record.id, reviewedAt);
        audit(reviewer.id, 'resource_record.locked', 'resource_record', record.id, reviewedAt);

        // Calculation — same rule the live engine uses (org override > global)
        const { rows } = resolveFactors(store, record);
        if (rows.length) {
          const co2eKg = rows.reduce((s, f) => s + quantity * f.factorValue * f.gwp, 0);
          rows.forEach((f) => (f.isLocked = true));
          const target = store.targets.find(
            (t) => t.organizationId === org.id && t.departmentId === dept.id && t.resourceCategory === type.category && t.metric === 'usage' && t.periodStart <= record.periodStart && t.periodEnd >= record.periodEnd,
          );
          store.calculationResults.push({
            id: uuidv4(), resourceRecordId: record.id, factorVersionId: rows[0].id, co2eKg,
            costOfUsage: record.cost, savingsVsBaseline: target ? target.targetValue - quantity : null,
            carbonExposure: (co2eKg / 1000) * carbonPrice, calculatedAt: iso(reviewedAt), recalculatedCount: 0,
          });
        }
      } else if (reviewed) {
        audit(reviewer.id, status === 'REJECTED' ? 'submission.rejected' : 'submission.changes_requested', 'resource_record', record.id, reviewedAt, { comment: reviewComment });
      }
    }
  }
  console.log(`Created ${createdRecords.length} resource records with submissions, evidence and calculations`);

  const find = (dept: string, type: string, monthIdx: number) =>
    createdRecords.find((c) => c.plan.dept === dept && c.plan.type === type && c.monthIdx === monthIdx)!.record;

  // ---- Alerts ----------------------------------------------------------------
  const diesel = find('Fleet & Logistics', 'Diesel Fuel', -1);
  store.alerts.push({
    id: uuidv4(), organizationId: org.id, severity: 'CRITICAL', status: 'OPEN', type: 'usage_anomaly',
    message: `Unusually high usage logged: ${diesel.quantity} ${diesel.unit} — more than 3x the evidence threshold.`,
    relatedResourceRecordId: diesel.id, relatedDepartmentId: fleet.id, createdAt: diesel.createdAt,
  });
  const officeElec = find('Corporate Office', 'Grid Electricity', -1);
  store.alerts.push({
    id: uuidv4(), organizationId: org.id, severity: 'WARNING', status: 'OPEN', type: 'usage_anomaly',
    message: `Usage is roughly double the recent monthly average: ${officeElec.quantity} ${officeElec.unit}.`,
    relatedResourceRecordId: officeElec.id, relatedDepartmentId: office.id, createdAt: iso(addDays(new Date(officeElec.createdAt), 1)),
  });
  store.alerts.push({
    id: uuidv4(), organizationId: org.id, severity: 'WARNING', status: 'OPEN', type: 'overdue_submission',
    message: 'No usage data has been logged for "Corporate Office" this month.',
    relatedResourceRecordId: null, relatedDepartmentId: office.id, createdAt: iso(addDays(today, -2)),
  });

  const resolvedAlert = (rec: ResourceRecord, text: string, action: 'fixed' | 'confirmed_accurate', who: typeof contributorMain, message: string) => {
    const a = {
      id: uuidv4(), organizationId: org.id, severity: 'CRITICAL' as const, status: 'RESOLVED' as const, type: 'usage_anomaly', message,
      relatedResourceRecordId: rec.id, relatedDepartmentId: rec.departmentId, createdAt: rec.createdAt,
    };
    store.alerts.push(a);
    store.alertResponses.push({ id: uuidv4(), alertId: a.id, respondedById: who.id, responseText: text, action, createdAt: iso(addDays(new Date(rec.createdAt), 2)) });
    audit(who.id, 'alert.responded', 'alert', a.id, addDays(new Date(rec.createdAt), 2), { action });
  };
  const elecJul = find('Main Facility', 'Grid Electricity', -2);
  resolvedAlert(elecJul, 'Explanation: Production ran extra shifts to clear a backlog.\n\nCorrective measures: Added a weekly check of shift schedules against energy plan.', 'confirmed_accurate', contributorMain,
    `Unusually high usage logged: ${elecJul.quantity} ${elecJul.unit} — more than 3x the evidence threshold.`);
  const dieselOld = find('Fleet & Logistics', 'Diesel Fuel', -3);
  resolvedAlert(dieselOld, 'Explanation: Quantity was keyed in gallons but saved as liters.\n\nCorrective measures: Corrected the unit and added a unit check to the depot checklist.', 'fixed', contributorFleet,
    `Unusually high usage logged: ${dieselOld.quantity} ${dieselOld.unit} — more than 3x the evidence threshold.`);

  // ---- Amendments ---------------------------------------------------------------
  const gasLocked = find('Main Facility', 'Natural Gas', -2);
  const gasProposed = 780;
  const gasMat = (Math.abs(gasProposed - gasLocked.quantity) / gasLocked.quantity) * 100;
  const amPending = {
    id: uuidv4(), resourceRecordId: gasLocked.id, status: 'PENDING_APPROVAL' as const, reason: 'Utility issued a corrected invoice after a meter re-read.',
    proposedQuantity: gasProposed, proposedCost: null, materialityPercent: gasMat, triggersBaselineRecalc: gasMat > 5,
    proposedById: reviewer.id, approvedById: null, approvalComment: null, createdAt: iso(addDays(today, -3)), resolvedAt: null,
  };
  store.amendments.push(amPending);
  audit(reviewer.id, 'amendment.proposed', 'amendment', amPending.id, addDays(today, -3));

  const officeOld = find('Corporate Office', 'Grid Electricity', -3);
  const offProposed = 3700;
  const offMat = (Math.abs(offProposed - officeOld.quantity) / officeOld.quantity) * 100;
  const amRejected = {
    id: uuidv4(), resourceRecordId: officeOld.id, status: 'REJECTED' as const, reason: 'Sub-meter reading suggests slightly lower consumption.',
    proposedQuantity: offProposed, proposedCost: null, materialityPercent: offMat, triggersBaselineRecalc: offMat > 5,
    proposedById: reviewer.id, approvedById: executive.id, approvalComment: 'Difference is within normal meter tolerance — no restatement needed.',
    createdAt: iso(addDays(today, -20)), resolvedAt: iso(addDays(today, -18)),
  };
  store.amendments.push(amRejected);
  audit(reviewer.id, 'amendment.proposed', 'amendment', amRejected.id, addDays(today, -20));
  audit(executive.id, 'amendment.rejected', 'amendment', amRejected.id, addDays(today, -18));

  // ---- Reports (same aggregation the live generator uses) -----------------------
  const buildContent = (from: string, to: string) => {
    const records = store.resourceRecords.filter((r) => r.organizationId === org.id && r.status === 'LOCKED' && r.periodStart >= from && r.periodEnd <= to);
    const byDepartment: Record<string, any> = {};
    const byResourceType: Record<string, any> = {};
    const sum = { totalCo2eKg: 0, totalCost: 0, totalSavings: 0, totalCarbonExposure: 0, entryCount: 0 };
    for (const r of records) {
      const c = store.calculationResults.find((x) => x.resourceRecordId === r.id);
      if (!c) continue;
      sum.entryCount++; sum.totalCo2eKg += c.co2eKg; sum.totalCost += c.costOfUsage ?? 0; sum.totalSavings += c.savingsVsBaseline ?? 0; sum.totalCarbonExposure += c.carbonExposure ?? 0;
      const dn = store.departments.find((d) => d.id === r.departmentId)?.name ?? 'Unknown';
      const t = store.resourceTypes.find((x) => x.id === r.resourceTypeId);
      byDepartment[dn] ??= { co2eKg: 0, cost: 0, entries: 0 };
      byDepartment[dn].co2eKg += c.co2eKg; byDepartment[dn].cost += c.costOfUsage ?? 0; byDepartment[dn].entries += 1;
      const tn = t?.name ?? 'Unknown';
      byResourceType[tn] ??= { co2eKg: 0, cost: 0, category: t?.category };
      byResourceType[tn].co2eKg += c.co2eKg; byResourceType[tn].cost += c.costOfUsage ?? 0;
    }
    return { summary: sum, byDepartment, byResourceType, generatedAt: iso(today) };
  };
  const mkReport = (title: string, from: string, to: string, status: any, extra: Partial<Record<string, any>> = {}) => {
    const r = {
      id: uuidv4(), organizationId: org.id, title, periodStart: from, periodEnd: to, contentJson: buildContent(from, to), pdfFilePath: null, status, version: 1,
      createdById: reviewer.id, approvedById: null, approvalComment: null, approvedAt: null, supersedesId: null, isScheduled: false,
      createdAt: iso(addDays(today, -10)), updatedAt: iso(addDays(today, -6)), ...extra,
    };
    store.reports.push(r as any);
    audit(reviewer.id, 'report.generated', 'report', r.id, new Date(r.createdAt));
    return r;
  };
  const rApproved = mkReport(`${m['-3'].label} Emissions Report`, m['-3'].startStr, m['-3'].endStr, 'APPROVED', {
    approvedById: executive.id, approvalComment: 'Approved for publication.', approvedAt: iso(addDays(today, -8)), createdAt: iso(addDays(today, -14)), updatedAt: iso(addDays(today, -8)),
  });
  audit(reviewer.id, 'report.submitted_for_approval', 'report', rApproved.id, addDays(today, -12));
  audit(executive.id, 'report.approved', 'report', rApproved.id, addDays(today, -8));

  const rPending = mkReport(`${m['-2'].label} Emissions Report`, m['-2'].startStr, m['-2'].endStr, 'PENDING_APPROVAL');
  audit(reviewer.id, 'report.submitted_for_approval', 'report', rPending.id, addDays(today, -6));

  const rRevision = mkReport(`${m['-3'].label.split(' ')[0]}–${m['-2'].label} Summary`, m['-3'].startStr, m['-2'].endStr, 'REVISION_REQUESTED', {
    approvalComment: 'Please call out Main Facility electricity separately and add a note on the diesel spike before I can sign this off.',
  });
  audit(reviewer.id, 'report.submitted_for_approval', 'report', rRevision.id, addDays(today, -7));
  audit(executive.id, 'report.revision_requested', 'report', rRevision.id, addDays(today, -6));

  // ---- Billing: a few past invoices ------------------------------------------------
  const sub = store.subscriptions.find((s) => s.organizationId === org.id);
  if (sub) {
    for (let i = 4; i >= 1; i--) {
      const s = monthBounds(-i);
      store.invoices.push({
        id: uuidv4(), organizationId: org.id, subscriptionId: sub.id, amount: 199, currency: 'USD', status: 'mock_paid',
        issuedAt: iso(s.start), periodStart: s.startStr, periodEnd: s.endStr, description: 'Growth plan, monthly subscription',
      });
    }
  }

  // ---- A CSV import in the history ------------------------------------------------------
  store.importBatches.push({
    id: uuidv4(), organizationId: org.id, initiatedById: contributorOffice.id, fileName: 'office-usage-q3.csv', totalRows: 9, successRows: 8, errorRows: 1,
    errorsJson: [{ row: 6, errors: ['Unit "gallons" is not valid for resource type "Grid Electricity"'] }], status: 'completed',
    createdAt: iso(addDays(today, -40)), completedAt: iso(addDays(today, -40)),
  });
  audit(contributorOffice.id, 'import.csv_processed', 'import_batch', store.importBatches[store.importBatches.length - 1].id, addDays(today, -40), { total: 9, success: 8, errors: 1 });

  // ---- A second organization + second platform admin (for the admin portal) ----------
  if (!store.organizations.some((o) => o.slug === 'northwind-retail')) {
    const nw = {
      id: uuidv4(), name: 'Northwind Retail', slug: 'northwind-retail', status: 'TRIAL' as const, maintenanceMode: false, sessionTimeoutOverrideMin: null,
      carbonPricePerTon: 30, currency: 'USD', baselineYear: null, createdAt: iso(addDays(today, -9)), updatedAt: iso(addDays(today, -9)),
    };
    store.organizations.push(nw);
    const starter = store.plans.find((p) => p.name === 'Starter');
    if (starter) {
      store.subscriptions.push({ id: uuidv4(), organizationId: nw.id, planId: starter.id, status: 'TRIAL', cycle: 'MONTHLY', startDate: iso(addDays(today, -9)), renewalDate: iso(addDays(today, 5)), cancelledAt: null, updatedAt: iso(addDays(today, -9)) });
    }
    store.orgUsers.push({
      id: uuidv4(), organizationId: nw.id, email: 'owner@northwind.dev', passwordHash: hash, fullName: 'Nina Northwind', role: 'ORG_ADMIN', isOwner: true, isActive: true,
      departmentId: null, invitedById: null, createdAt: iso(addDays(today, -9)), updatedAt: iso(addDays(today, -9)), lastLogin: iso(addDays(today, -2)),
    });
    console.log('Created second organization: Northwind Retail (owner@northwind.dev / DemoPass1!)');
  }
  if (!store.platformAdmins.some((a) => a.email === 'admin@tropos.dev')) {
    store.platformAdmins.push({
      id: uuidv4(), email: 'admin@tropos.dev', passwordHash: await bcrypt.hash('PlatformAdmin1!', SALT_ROUNDS), fullName: 'Pat Platform', role: 'PLATFORM_ADMIN', isActive: true,
      invitedById: null, createdAt: iso(addDays(today, -60)), updatedAt: iso(addDays(today, -60)), lastLogin: null,
    });
    console.log('Created platform admin: admin@tropos.dev / PlatformAdmin1!');
  }

  console.log('Demo activity seeded.');
}
