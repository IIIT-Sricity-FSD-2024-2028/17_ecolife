import { useEffect, useState } from 'react';
import { useZodForm } from '../../../hooks/useZodForm';
import { reportSchema } from '../../../schemas/formSchemas';
import {
  FileText,
  FilePlus2,
  Send,
  GitBranchPlus,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Check,
  X,
  Trash2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader2,
  Building,
  Boxes,
  CheckCircle2,
  FileEdit,
} from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { Tabs } from '../../../components/ui/Tabs';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { ScopeBadge } from '../../../components/ui/ScopeBadge';
import { FormField, TextInput, TextArea } from '../../../components/ui/FormField';
import { EmptyState } from '../../../components/shared/EmptyState';
import { ReportContent } from '../../../components/shared/ReportContent';
import { CommentThread } from '../../../components/shared/CommentThread';
import { useReports, useGenerateReport, useUpdateReport, useReportActions } from '../../../hooks/useOrgData';
import { reportsService } from '../../../services/reportsService';
import { useQueryClient } from '@tanstack/react-query';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { REPORT_STATUS_LABELS } from '../../../constants/roles';
import { fmtCo2e, fmtDate, fmtMoney, fmtNumber, fmtRange } from '../../../utils/format';
import { PageHeader } from '../../../components/ui/PageHeader';

const PAGE_SIZE = 10;

export function ReportsPage() {
  const { data: reports = [], isLoading } = useReports();
  const generate = useGenerateReport();
  const { remove } = useReportActions();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [editOnOpen, setEditOnOpen] = useState(false);
  const [offset, setOffset] = useState(0);

  // Group reports by status
  const groups = {
    ALL: reports,
    DRAFT: reports.filter((r) => r.status === 'DRAFT'),
    PENDING_APPROVAL: reports.filter((r) => r.status === 'PENDING_APPROVAL'),
    REVISION_REQUESTED: reports.filter((r) => r.status === 'REVISION_REQUESTED'),
    APPROVED: reports.filter((r) => ['APPROVED', 'SUPERSEDED'].includes(r.status)),
  };

  const shown = groups[tab] || reports;
  const total = shown.length;
  const paged = shown.slice(offset, offset + PAGE_SIZE);
  const open = reports.find((r) => r.id === openId);
  const revisions = groups.REVISION_REQUESTED;

  const askDeleteDraft = async (reportItem, e) => {
    e?.stopPropagation();
    const ok = await confirm({
      title: `Delete draft “${reportItem.title}”?`,
      message: 'This draft report will be permanently removed. The underlying approved entries remain untouched.',
      confirmLabel: 'Delete draft',
      variant: 'danger',
      icon: Trash2,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(reportItem.id);
      showToast('Draft report deleted.', 'success');
      if (openId === reportItem.id) setOpenId(null);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');
    }
  };

  const handleOpenDraftForEdit = (reportItem, e) => {
    e?.stopPropagation();
    setEditOnOpen(true);
    setOpenId(reportItem.id);
  };

  return (
    <div className="stack">
      <PageHeader
        subtitle="Reports summarize approved entries for a period and go to the Executive for sign-off."
        actions={
          <Button
            icon={FilePlus2}
            onClick={() => {
              setShowForm(true);
            }}
          >
            Create report draft
          </Button>
        }
      />

      {revisions.length > 0 && tab !== 'REVISION_REQUESTED' && (
        <div className="callout callout--warning" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <AlertTriangle size={16} aria-hidden="true" style={{ color: 'var(--color-warning)' }} />
            <span>
              {revisions.length} report{revisions.length > 1 ? 's were' : ' was'} sent back by the Executive. Open to read feedback and create a new version.
            </span>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setTab('REVISION_REQUESTED')}>
            View revision requests
          </Button>
        </div>
      )}

      <Tabs
        value={tab}
        onChange={(t) => {
          setTab(t);
          setOffset(0);
        }}
        tabs={[
          { value: 'ALL', label: 'All reports', icon: FileText, count: reports.length },
          { value: 'DRAFT', label: 'Drafts', icon: FileEdit, count: groups.DRAFT.length },
          { value: 'PENDING_APPROVAL', label: 'Awaiting approval', icon: Send, count: groups.PENDING_APPROVAL.length },
          { value: 'REVISION_REQUESTED', label: 'Needs revision', icon: AlertTriangle, count: groups.REVISION_REQUESTED.length },
          { value: 'APPROVED', label: 'Approved', icon: CheckCircle2, count: groups.APPROVED.length },
        ]}
      />

      <Card padded={false}>
        {!isLoading && shown.length === 0 && (
          <EmptyState
            icon={tab === 'DRAFT' ? FileEdit : tab === 'REVISION_REQUESTED' ? AlertTriangle : FileText}
            title={
              tab === 'DRAFT'
                ? 'No draft reports'
                : tab === 'REVISION_REQUESTED'
                ? 'No revision requests'
                : tab === 'PENDING_APPROVAL'
                ? 'No reports waiting for approval'
                : 'No reports yet'
            }
            description={
              tab === 'DRAFT'
                ? 'Click "Create report draft" to build a draft from approved period data.'
                : undefined
            }
          />
        )}
        {shown.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Period</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr
                    key={r.id}
                    className="clickable-row"
                    onClick={() => {
                      setEditOnOpen(false);
                      setOpenId(r.id);
                    }}
                  >
                    <td>
                      <strong>{r.title}</strong>
                      {r.notes && (
                        <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.notes}
                        </div>
                      )}
                    </td>
                    <td>{fmtRange(r.periodStart, r.periodEnd)}</td>
                    <td>v{r.version}</td>
                    <td>
                      <StatusBadge status={r.status} label={REPORT_STATUS_LABELS[r.status]} />
                    </td>
                    <td>{fmtDate(r.updatedAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 'var(--space-1)', alignItems: 'center' }}>
                        {r.status === 'DRAFT' && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={Pencil}
                              onClick={(e) => handleOpenDraftForEdit(r, e)}
                              title="Edit draft details"
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={Trash2}
                              style={{ color: 'var(--color-danger)' }}
                              onClick={(e) => askDeleteDraft(r, e)}
                              title="Delete draft"
                            >
                              Delete
                            </Button>
                          </>
                        )}
                        {r.status === 'REVISION_REQUESTED' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={GitBranchPlus}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditOnOpen(false);
                              setOpenId(r.id);
                            }}
                            title="Review feedback and create new version"
                          >
                            New version
                          </Button>
                        )}
                        {['PENDING_APPROVAL', 'APPROVED', 'SUPERSEDED'].includes(r.status) && (
                          <span className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                            View details
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--color-border)' }}>
            <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
              Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <div className="row-actions">
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronLeft}
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next <ChevronRight size={14} aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Generate / Create Draft Modal with Live Emissions & Resource Cross-Verification Preview */}
      <CreateReportDraftModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onCreated={(createdReport) => {
          setShowForm(false);
          setEditOnOpen(false);
          setOpenId(createdReport.id);
        }}
      />

      {open && (
        <ReportDrawer
          report={open}
          initialEditing={editOnOpen}
          onClose={() => {
            setOpenId(null);
            setEditOnOpen(false);
          }}
          onOpen={(id) => {
            setOpenId(id);
            setEditOnOpen(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * Modal to configure and preview a report draft before creating it.
 * Provides real-time cross-verification of emissions, resource usage by resource,
 * and breakdown by department.
 */
function CreateReportDraftModal({ open, onClose, onCreated }) {
  const generate = useGenerateReport();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [showEntriesList, setShowEntriesList] = useState(false);

  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  // Initialize dates on open if empty
  useEffect(() => {
    if (open && !periodStart && !periodEnd) {
      // Default to last full quarter or month
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth(); // 0-indexed
      // default start of year to today
      setPeriodStart(`${y}-01-01`);
      const endMonth = String(m + 1).padStart(2, '0');
      const endDay = String(now.getDate()).padStart(2, '0');
      setPeriodEnd(`${y}-${endMonth}-${endDay}`);
      setTitle(`${y} YTD Emissions Report`);
    }
  }, [open]);

  // Fetch live preview whenever period dates change
  useEffect(() => {
    if (!open || !periodStart || !periodEnd) return;
    if (periodStart > periodEnd) {
      setPreview(null);
      setPreviewError('Period end date cannot be earlier than period start date.');
      return;
    }

    let active = true;
    setPreviewLoading(true);
    setPreviewError(null);

    reportsService
      .preview(periodStart, periodEnd)
      .then((data) => {
        if (!active) return;
        setPreview(data);
      })
      .catch((err) => {
        if (!active) return;
        setPreview(null);
        setPreviewError(err instanceof ApiError ? err.message : 'Unable to preview data for this period.');
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, periodStart, periodEnd]);

  if (!open) return null;

  const handlePreset = (type) => {
    const today = new Date();
    const y = today.getFullYear();
    if (type === 'Q1') {
      setPeriodStart(`${y}-01-01`);
      setPeriodEnd(`${y}-03-31`);
      setTitle(`Q1 ${y} Emissions Report`);
    } else if (type === 'Q2') {
      setPeriodStart(`${y}-04-01`);
      setPeriodEnd(`${y}-06-30`);
      setTitle(`Q2 ${y} Emissions Report`);
    } else if (type === 'Q3') {
      setPeriodStart(`${y}-07-01`);
      setPeriodEnd(`${y}-09-30`);
      setTitle(`Q3 ${y} Emissions Report`);
    } else if (type === 'YTD') {
      setPeriodStart(`${y}-01-01`);
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      setPeriodEnd(`${y}-${m}-${d}`);
      setTitle(`${y} YTD Emissions Report`);
    }
  };

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Report title is required.', 'error');
      return;
    }
    if (!periodStart || !periodEnd) {
      showToast('Period start and end dates are required.', 'error');
      return;
    }
    if (periodStart > periodEnd) {
      showToast('Period start cannot be after period end.', 'error');
      return;
    }

    try {
      const created = await generate.mutateAsync({
        title: title.trim(),
        periodStart,
        periodEnd,
        notes: notes.trim() || undefined,
      });
      showToast('Report draft saved successfully from approved data.', 'success');
      onCreated(created);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to generate report draft.', 'error');
    }
  };

  const s = preview?.summary;
  const byDept = preview?.byDepartment || {};
  const byType = preview?.byResourceType || {};
  const records = preview?.records || [];

  return (
    <Drawer
      open
      variant="modal"
      width={780}
      title="Create Report Draft"
      subtitle="Preview approved emissions and save a report draft for executive sign-off"
      onClose={onClose}
    >
      <form onSubmit={handleSaveDraft} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <FormField label="Report Title" required>
          <TextInput
            placeholder="e.g. Q3 2026 Emissions Report"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </FormField>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
            <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
              Reporting Period <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
              <button type="button" className="button button--ghost button--sm" onClick={() => handlePreset('Q1')}>
                Q1
              </button>
              <button type="button" className="button button--ghost button--sm" onClick={() => handlePreset('Q2')}>
                Q2
              </button>
              <button type="button" className="button button--ghost button--sm" onClick={() => handlePreset('Q3')}>
                Q3
              </button>
              <button type="button" className="button button--ghost button--sm" onClick={() => handlePreset('YTD')}>
                YTD
              </button>
            </div>
          </div>
          <div className="split-2">
            <TextInput type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} aria-label="Period start" />
            <TextInput type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} aria-label="Period end" />
          </div>
        </div>

        {/* Live Period Emissions & Cross-Verification Preview */}
        <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={15} style={{ color: 'var(--color-primary)' }} />
              Approved Period Data Preview
            </h4>
            {periodStart && periodEnd && (
              <span className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                {fmtRange(periodStart, periodEnd)}
              </span>
            )}
          </div>

          {previewLoading ? (
            <div style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
              <Loader2 size={24} className="spin" style={{ color: 'var(--color-primary)', margin: '0 auto var(--space-2)' }} />
              <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>
                Aggregating locked and approved entries...
              </p>
            </div>
          ) : previewError ? (
            <div className="callout callout--danger" style={{ margin: 0 }}>
              {previewError}
            </div>
          ) : s && s.entryCount === 0 ? (
            <div className="callout callout--warning" style={{ margin: 0 }}>
              <AlertTriangle size={16} style={{ display: 'inline', marginRight: 6 }} />
              <strong>No approved entries found in this period.</strong> Reports are built exclusively from locked/approved submissions. You can adjust the dates above or approve pending entries first.
            </div>
          ) : s ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {/* Summary KPIs */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 'var(--space-2)',
                  background: 'var(--color-surface)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Total Emissions</div>
                  <strong style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-primary)' }}>{fmtCo2e(s.totalCo2eKg)}</strong>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Total Cost</div>
                  <strong style={{ fontSize: 'var(--font-size-md)' }}>{fmtMoney(s.totalCost)}</strong>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Carbon Exposure</div>
                  <strong style={{ fontSize: 'var(--font-size-md)' }}>{fmtMoney(s.totalCarbonExposure)}</strong>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Approved Entries</div>
                  <strong style={{ fontSize: 'var(--font-size-md)' }}>{s.entryCount}</strong>
                </div>
              </div>

              {s.entriesWithoutCalculation > 0 && (
                <div className="callout callout--warning" style={{ margin: 0, padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
                  ⚠️ {s.entriesWithoutCalculation} entry(ies) lack applicable emission factors and will be flagged.
                </div>
              )}

              {/* Resource usage breakdown */}
              {Object.keys(byType).length > 0 && (
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Boxes size={13} /> Resource Usage &amp; Emissions
                  </div>
                  <table className="data-table" style={{ fontSize: 'var(--font-size-xs)' }}>
                    <thead>
                      <tr>
                        <th>Resource</th>
                        <th>Scope</th>
                        <th className="num">Usage</th>
                        <th className="num">Emissions</th>
                        <th className="num">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(byType).map(([typeName, val]) => (
                        <tr key={typeName}>
                          <td><strong>{typeName}</strong></td>
                          <td><ScopeBadge category={val.category} /></td>
                          <td className="num">{val.quantity ? `${fmtNumber(val.quantity, 2)} ${val.unit || ''}` : '—'}</td>
                          <td className="num">{fmtCo2e(val.co2eKg)}</td>
                          <td className="num">{fmtMoney(val.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Department breakdown */}
              {Object.keys(byDept).length > 0 && (
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Building size={13} /> Emissions by Department
                  </div>
                  <table className="data-table" style={{ fontSize: 'var(--font-size-xs)' }}>
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th className="num">Approved Entries</th>
                        <th className="num">Emissions</th>
                        <th className="num">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(byDept).map(([deptName, val]) => (
                        <tr key={deptName}>
                          <td><strong>{deptName}</strong></td>
                          <td className="num">{val.entries}</td>
                          <td className="num">{fmtCo2e(val.co2eKg)}</td>
                          <td className="num">{fmtMoney(val.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Expandable detailed entries verification list */}
              {records.length > 0 && (
                <div style={{ marginTop: 'var(--space-1)' }}>
                  <button
                    type="button"
                    className="link-button"
                    style={{ fontSize: 'var(--font-size-xs)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => setShowEntriesList((v) => !v)}
                  >
                    {showEntriesList ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {showEntriesList ? 'Hide' : 'Cross-verify'} all {records.length} individual approved entries
                  </button>

                  {showEntriesList && (
                    <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 'var(--space-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                      <table className="data-table" style={{ fontSize: '11px' }}>
                        <thead>
                          <tr>
                            <th>Department</th>
                            <th>Resource</th>
                            <th className="num">Quantity</th>
                            <th className="num">Cost</th>
                            <th>Period</th>
                          </tr>
                        </thead>
                        <tbody>
                          {records.map((r) => (
                            <tr key={r.id}>
                              <td>{r.departmentName}</td>
                              <td>{r.resourceTypeName}</td>
                              <td className="num">{fmtNumber(r.quantity, 2)} {r.unit}</td>
                              <td className="num">{fmtMoney(r.cost)}</td>
                              <td>{fmtRange(r.periodStart, r.periodEnd)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted" style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>
              Select a period to preview approved emissions data.
            </p>
          )}
        </div>

        <FormField
          label="Reviewer Notes & Commentary (optional)"
          hint="Explain highlights, abnormal spikes (e.g. diesel generator test), or operational context for the Executive"
        >
          <TextArea
            rows={3}
            maxLength={5000}
            placeholder="e.g. Electricity in Main Facility was within baseline. Diesel usage includes mandated emergency generator testing."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </FormField>

        <div className="row-actions" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" icon={FilePlus2} loading={generate.isPending}>
            Save as Draft
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

/**
 * ReportDrawer: Displays details of a report.
 * - For DRAFT: Allows editing details/commentary, deleting draft, and submitting for approval.
 * - For REVISION_REQUESTED: Clearly displays feedback, avoids mutating the rejected report in-place,
 *   and prominently offers "Create new version (v{version+1})".
 * - For PENDING_APPROVAL / APPROVED: Shows status, feedback, and read-only preview.
 */
function ReportDrawer({ report, initialEditing = false, onClose, onOpen }) {
  const { submit, remove } = useReportActions();
  const updateReport = useUpdateReport();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [isEditing, setIsEditing] = useState(initialEditing && report.status === 'DRAFT');
  const [editTitle, setEditTitle] = useState(report.title || '');
  const [editStart, setEditStart] = useState(report.periodStart || '');
  const [editEnd, setEditEnd] = useState(report.periodEnd || '');
  const [editNotes, setEditNotes] = useState(report.notes || '');

  const [creating, setCreating] = useState(false);
  const [note, setNote] = useState(report.submissionNote || '');

  const isDraft = report.status === 'DRAFT';
  const isRevisionRequested = report.status === 'REVISION_REQUESTED';
  const isPending = report.status === 'PENDING_APPROVAL';

  const fail = (err) => showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');

  useEffect(() => {
    setEditTitle(report.title || '');
    setEditStart(report.periodStart || '');
    setEditEnd(report.periodEnd || '');
    setEditNotes(report.notes || '');
    setNote(report.submissionNote || '');
    setIsEditing(initialEditing && report.status === 'DRAFT');
  }, [report.id, report.updatedAt, initialEditing]);

  const doSubmit = async () => {
    const ok = await confirm({
      title: `Submit “${report.title}” for approval?`,
      message: 'The Executive will be asked to approve it. Once submitted, it cannot be edited while awaiting decision.',
      confirmLabel: 'Submit for approval',
      icon: Send,
    });
    if (!ok) return;
    try {
      await submit.mutateAsync({ id: report.id, note: note.trim() });
      showToast('Submitted to the Executive for approval.', 'success');
    } catch (err) {
      fail(err);
    }
  };

  const newVersion = async () => {
    const ok = await confirm({
      title: `Create Version ${report.version + 1}?`,
      message:
        'This creates a fresh draft rebuilt from the latest approved data, preserving this version and its feedback. You can update commentary and cross-verify before submitting.',
      confirmLabel: `Create v${report.version + 1}`,
      icon: GitBranchPlus,
    });
    if (!ok) return;
    setCreating(true);
    try {
      const v = await reportsService.createNewVersion(report.id);
      qc.invalidateQueries({ queryKey: ['reports'] });
      showToast(`Version ${v.version} draft created from latest approved data.`, 'success');
      onOpen(v.id);
    } catch (err) {
      fail(err);
    } finally {
      setCreating(false);
    }
  };

  const saveEdits = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      showToast('Report title is required.', 'error');
      return;
    }
    try {
      await updateReport.mutateAsync({
        id: report.id,
        title: editTitle.trim(),
        periodStart: editStart,
        periodEnd: editEnd,
        notes: editNotes.trim(),
      });
      showToast('Report draft updated successfully.', 'success');
      setIsEditing(false);
    } catch (err) {
      fail(err);
    }
  };

  const askDelete = async () => {
    const ok = await confirm({
      title: `Delete draft “${report.title}”?`,
      message: 'This draft report will be permanently removed. The underlying approved entries remain safe and untouched.',
      confirmLabel: 'Delete draft',
      variant: 'danger',
      icon: Trash2,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(report.id);
      showToast('Draft report deleted.', 'success');
      onClose();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width={700}
      title={report.title}
      subtitle={`Version ${report.version} · ${fmtRange(report.periodStart, report.periodEnd)}`}
      footer={
        isEditing ? null : (
          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            {isDraft && (
              <FormField
                label="Note for the Executive (optional)"
                hint="Context for their approval decision: highlights, what changed, or known facility callouts."
              >
                <TextArea
                  rows={2}
                  maxLength={1000}
                  placeholder="e.g. Highlights include verified Q3 electricity numbers and generator load test figures."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </FormField>
            )}
            <div className="row-actions" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {isDraft && (
                  <Button icon={Send} onClick={doSubmit} loading={submit.isPending}>
                    Submit for approval
                  </Button>
                )}
                {isRevisionRequested && (
                  <Button variant="primary" icon={GitBranchPlus} onClick={newVersion} loading={creating}>
                    Create new version (v{report.version + 1})
                  </Button>
                )}
                {isDraft && (
                  <Button variant="secondary" icon={Pencil} onClick={() => setIsEditing(true)}>
                    Edit draft details
                  </Button>
                )}
              </div>
              {isDraft && (
                <Button
                  variant="ghost"
                  icon={Trash2}
                  style={{ color: 'var(--color-danger)' }}
                  onClick={askDelete}
                  loading={remove.isPending}
                >
                  Delete draft
                </Button>
              )}
            </div>
          </div>
        )
      }
    >
      {/* Draft banner */}
      {isDraft && !isEditing && (
        <div
          className="callout callout--info"
          style={{
            marginBottom: 'var(--space-4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
          }}
        >
          <div>
            <strong>Draft Report (Unsubmitted)</strong>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-sm)' }}>
              This report is in draft mode. You can edit its title, dates, and commentary, or submit it when ready.
            </p>
          </div>
          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setIsEditing(true)}>
            Edit draft
          </Button>
        </div>
      )}

      {/* Revision requested callout: Preserves history, forbids in-place mutation, guides to new version */}
      {isRevisionRequested && (
        <div className="callout callout--warning" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={18} style={{ color: 'var(--color-warning)' }} />
            <strong>Executive Feedback (Revision Requested)</strong>
          </div>
          <p style={{ margin: 'var(--space-2) 0', whiteSpace: 'pre-wrap', fontWeight: 'var(--font-weight-medium)' }}>
            &ldquo;{report.approvalComment || 'The Executive requested revisions on this report.'}&rdquo;
          </p>
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)' }}>
            To preserve the revision history and audit trail, this version is locked as requested. Click below to generate a new draft version incorporating the latest approved data and address their feedback.
          </div>
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Button variant="primary" size="sm" icon={GitBranchPlus} onClick={newVersion} loading={creating}>
              Create version {report.version + 1}
            </Button>
          </div>
        </div>
      )}

      {/* Submitted note banner */}
      {report.submissionNote && !isDraft && (
        <div className="callout" style={{ marginBottom: 'var(--space-4)' }}>
          <strong>Your note to the Executive</strong>
          <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{report.submissionNote}</p>
        </div>
      )}

      {isEditing ? (
        <form onSubmit={saveEdits} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)' }}>
              Edit report draft details
            </h3>
            <Button size="sm" variant="ghost" icon={X} onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>

          <FormField label="Report Title" required>
            <TextInput value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </FormField>

          <div className="split-2">
            <FormField label="Period Start" required>
              <TextInput type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
            </FormField>
            <FormField label="Period End" required>
              <TextInput type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
            </FormField>
          </div>

          <FormField
            label="Reviewer Notes & Commentary"
            hint="Describe specific facility callouts (e.g. Main Facility electricity) and explain anomalies (e.g. diesel spike) for the Executive."
          >
            <TextArea
              rows={5}
              maxLength={5000}
              placeholder="e.g. Main Facility Electricity: Accounted for 63% of emissions due to continuous line production."
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
          </FormField>

          <div className="row-actions" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
            <Button variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" icon={Check} loading={updateReport.isPending}>
              Save changes
            </Button>
          </div>
        </form>
      ) : (
        <>
          <ReportContent report={report} />
          <CommentThread entityType="report" entityId={report.id} />
        </>
      )}
    </Drawer>
  );
}
