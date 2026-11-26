/** Plain-language names for the activity log. Anything not listed falls back to readable words. */
const ACTION = {
  API_KEY_CREATED: 'Access key created', API_KEY_REVOKED: 'Access key revoked', ASSURANCE_ENGAGEMENT_CREATED: 'Assurance review started',
  ASSURANCE_FINDING_CLOSED: 'Reviewer finding closed', ASSURANCE_FINDING_RAISED: 'Reviewer finding raised', ASSURANCE_FINDING_RESPONDED: 'Reviewer finding answered',
  ASSURANCE_OPINION_ISSUED: 'Reviewer opinion issued', BOUNDARY_EXCLUSION_REQUESTED: 'Exclusion from the footprint requested', CREATED: 'Added', CREATED_VIA_API: 'Added by a connected system',
  DATA_REMINDERS_QUEUED: 'Data reminders sent', DUAL_ADMIN_APPROVAL_REQUESTED: 'Second administrator’s approval requested', EDITED: 'Changed', ENTITY_CREATED: 'Company added',
  ENTRY_SUBMITTED: 'Entry sent for approval', ENTRY_APPROVED: 'Entry approved', ENTRY_REJECTED: 'Entry sent back', EVIDENCE_UPLOADED: 'Evidence file uploaded', FACILITY_CREATED: 'Site added',
  FACTOR_PROPOSED: 'Emission factor proposed', FACTOR_RELEASE_PROPOSED: 'Factor release proposed', FINANCIAL_METRICS_CERTIFIED: 'Financial figures confirmed',
  FINANCIAL_YEAR_OPENED: 'Financial year opened', GREEN_CREDIT_REGISTERED: 'Green credit recorded', GREEN_CREDIT_STATUS_CHANGED: 'Green credit status changed',
  IMPORT_BATCH_ROLLED_BACK: 'Import undone', IMP_APPROVED: 'Data management plan approved', IMP_AUTHORED: 'Data management plan written',
  INTERNAL_AUDIT_FINDING_CREATED: 'Audit finding recorded', INTERNAL_AUDIT_FINDING_UPDATED: 'Audit finding updated', INVITATION_CREATED: 'Person invited',
  INVOICE_CANCELLED: 'Invoice cancelled', ORG_PROFILE_UPDATED: 'Company details changed', ORG_SETTINGS_UPDATED: 'Company settings changed', PERIOD_CLOSED: 'Month closed',
  PERIOD_CREATED: 'Month opened', PERIOD_EXECUTIVE_SIGNED_OFF: 'Month signed off', PERIOD_REOPENED: 'Month reopened', PLAN_CHANGE_REQUESTED: 'Plan change requested',
  RECALCULATION_REQUESTED: 'Recalculation requested', REDUCTION_ACTION_CREATED: 'Reduction project added', REDUCTION_ACTION_UPDATED: 'Reduction project updated',
  REFRIGERANT_EQUIPMENT_REGISTERED: 'Cooling equipment added', REPORT_EXPORTED: 'Report downloaded', SOURCE_CREATED: 'Meter or source added', SUBMITTED: 'Sent for approval',
  SUPPLIER_CREATED: 'Supplier added', SUPPLIER_PCF_ACCEPTED: 'Supplier carbon footprint accepted', TARGET_CREATED: 'Target set', TARGET_EVALUATED: 'Target checked',
  TRIAL_EXTENDED: 'Free trial extended', UAR_CERTIFIED: 'Access review confirmed', USER_ROLES_UPDATED: 'Person’s roles changed', USER_UNLOCKED: 'Person unlocked',
  VERIFICATION_RESENT: 'Verification email sent again', WITHDRAWN: 'Withdrawn', LOGIN: 'Signed in', LOGOUT: 'Signed out',
  INVOICE_MARKED_PAID: 'Invoice marked paid', INVOICE_PAID_BY_GATEWAY: 'Invoice paid online',
  DUAL_ADMIN_APPROVED: 'Second administrator approved', DUAL_ADMIN_REJECTED: 'Second administrator refused', ORG_STATUS_PAST_DUE: 'Company marked as overdue', ORG_STATUS_SUSPENDED: 'Company suspended',
  IMPORT_COMMITTED: 'Import saved', IMPORT_PREVIEWED: 'Import checked', SCOPE2_ALLOCATED: 'Green power allocated', SCOPE2_INSTRUMENT_CREATED: 'Green power certificate added',
  SUPPLIER_PCF_REJECTED: 'Supplier carbon footprint sent back'
};
const RESOURCE = {
  AccessCertification: 'Access review', ApiKey: 'Access key', AssuranceEngagement: 'Assurance review', BoundaryExclusion: 'Footprint exclusion', EmissionFactor: 'Emission factor',
  Entity: 'Company', EvidenceFile: 'Evidence file', ExportReport: 'Report', Facility: 'Site', FinancialYearMetrics: 'Financial figures', GreenEconomyCredit: 'Green credit',
  ImportBatch: 'Import', InternalAuditFinding: 'Audit finding', InventoryManagementPlan: 'Data management plan', Invitation: 'Invitation', Invoice: 'Invoice', Organization: 'Company',
  RecalculationRequest: 'Recalculation', ReductionAction: 'Reduction project', RefrigerantEquipment: 'Cooling equipment', ReportingPeriod: 'Month', ResourceEntry: 'Data entry',
  ResourceSource: 'Meter or source', Supplier: 'Supplier', SupplierPcfRequest: 'Supplier product footprint', Target: 'Target', User: 'Person', VerificationFinding: 'Reviewer finding',
  AirEmissionLog: 'Air emission reading', Recalculation: 'Recalculation', airEmissionLog: 'Air emission reading', facilityOutputLog: 'Product output record', materialLog: 'Material record', wasteLog: 'Waste record', waterLog: 'Water record', Scope2Allocation: 'Green power allocation', Scope2Instrument: 'Green power certificate', Scope3Purchase: 'Supply chain purchase'
};
const SUBJECT = { AIR_EMISSIONS_LOG: 'Air emission reading', MATERIALS_LOG: 'Material record', OUTPUTS_LOG: 'Product output record', WASTE_LOG: 'Waste record', WATER_LOG: 'Water record', SCOPE3_PURCHASE: 'Supply chain purchase',
  ENTITY: 'Company', FACILITY: 'Site', FACTOR: 'Emission factor', RECALCULATION: 'Recalculation', BOUNDARY_EXCLUSION: 'Footprint exclusion', ENTRY: 'Entry' };
const VERB = { CREATED: 'added', SUBMITTED: 'sent for approval', APPROVED: 'approved', REJECTED: 'sent back' };
const readable = (s) => String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
export const actionLabel = (a) => {
  const k = String(a || '').toUpperCase();
  if (ACTION[k]) return ACTION[k];
  const m = k.match(/^(.+)_(CREATED|SUBMITTED|APPROVED|REJECTED)$/);
  return m && SUBJECT[m[1]] ? `${SUBJECT[m[1]]} ${VERB[m[2]]}` : readable(a);
};
export const resourceLabel = (t) => RESOURCE[t] || readable(t);
