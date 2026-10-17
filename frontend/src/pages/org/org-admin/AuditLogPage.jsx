import { useState } from 'react';
import { Download, FilterX, ChevronLeft, ChevronRight, SearchX } from 'lucide-react';
import { useAuditLogs, useAuditActions } from '../../../../../../tropos new/frontend/src/hooks/useRoleData';
import { auditLogService } from '../../../../../../tropos new/frontend/src/services/auditLogService';
import { Card, CardHeader } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { FormField, TextInput, Select } from '../../../components/ui/FormField';
import { EmptyState } from '../../../components/shared/EmptyState';
import { Drawer } from '../../../components/ui/Drawer';
import { DetailList } from '../../../components/shared/DetailList';
import { rowProps } from '../../../components/shared/rowProps';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../../../../tropos new/frontend/src/context/ToastContext';
import { describeAction } from '../../../../../../tropos new/frontend/src/utils/auditLabels';
import { downloadText, fmtDateTime, toCsv } from '../../../../../../tropos new/frontend/src/utils/format';

const PAGE = 25;
const empty = { action: '', actor: '', from: '', to: '' };

const humanize = (key) => key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/^./, (c) => c.toUpperCase());
const showValue = (v) => (v !== null && typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v));

function AuditDrawer({ log, showOrg, onClose }) {
  const details = Object.entries(log.metadata ?? {});
  return (
    <Drawer open title={describeAction(log.action)} subtitle={fmtDateTime(log.createdAt)} onClose={onClose}>
      <DetailList
        items={[
          ['Who', log.actorName],
          ['Email', log.actorEmail],
          ...(showOrg ? [['Organization', log.organizationName ?? 'Platform']] : []),
          ['Action key', <code key="a">{log.action}</code>],
          ['Entity type', log.entityType],
          ['Entity ID', <code key="e">{log.entityId}</code>],
        ]}
      />
      <h3 className="section-title">Details</h3>
      {details.length === 0 ? (
        <p className="text-muted">No extra details were recorded for this action.</p>
      ) : (
        <DetailList items={details.map(([k, v]) => [humanize(k), typeof v === 'object' && v !== null ? <pre key={k} className="detail-pre">{showValue(v)}</pre> : showValue(v)])} />
      )}
    </Drawer>
  );
}

/** Org-scoped audit trail. `useLoader` lets the platform admin reuse the same page layout. */
export function AuditLogView({ subtitle, useLogs, useActions, fetchAll, showOrg = false, filenamePrefix }) {
  const [filters, setFilters] = useState(empty);
  const [offset, setOffset] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState(null);
  const { showToast } = useToast();
  const confirm = useConfirm();
  const params = { ...filters, from: filters.from ? `${filters.from}T00:00:00.000Z` : '', to: filters.to ? `${filters.to}T23:59:59.999Z` : '', limit: PAGE, offset };
  const { data, isLoading } = useLogs(params);
  const { data: actions = [] } = useActions();
  const set = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setOffset(0); };

  const exportCsv = async () => {
    const ok = await confirm({ title: 'Export audit log?', message: `A CSV of ${total} matching ${total === 1 ? 'entry' : 'entries'} will be downloaded. It contains names and email addresses, so store it securely.`, confirmLabel: 'Export CSV', icon: Download });
    if (!ok) return;
    setExporting(true);
    try {
      const all = await fetchAll({ ...params, limit: 500, offset: 0 });
      const header = ['Time', ...(showOrg ? ['Organization'] : []), 'Actor', 'Email', 'Action', 'Entity', 'Entity ID', 'Details'];
      const rows = all.map((l) => [l.createdAt, ...(showOrg ? [l.organizationName ?? ''] : []), l.actorName, l.actorEmail, l.action, l.entityType, l.entityId, l.metadata ? JSON.stringify(l.metadata) : '']);
      downloadText(`${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([header, ...rows]));
      showToast(`Exported ${all.length} entries.`, 'success');
    } catch { showToast('Export failed.', 'error'); } finally { setExporting(false); }
  };

  const total = data?.total ?? 0;
  return (
    <div>
      <PageHeader subtitle={subtitle} />
      <Card padded={false}>
        <div style={{ padding: 'var(--space-5)' }}>
          <CardHeader title={`${total} entr${total === 1 ? 'y' : 'ies'}`} actions={<Button variant="secondary" icon={Download} onClick={exportCsv} loading={exporting} disabled={total === 0}>Export CSV</Button>} />
          <div className="filters" style={{ marginBottom: 0 }}>
            <FormField label="Action">
              <Select value={filters.action} onChange={set('action')}>
                <option value="">All actions</option>
                {actions.map((a) => <option key={a} value={a}>{describeAction(a)}</option>)}
              </Select>
            </FormField>
            <FormField label="Person"><TextInput placeholder="Name or email" value={filters.actor} onChange={set('actor')} /></FormField>
            <FormField label="From"><TextInput type="date" value={filters.from} onChange={set('from')} /></FormField>
            <FormField label="To"><TextInput type="date" value={filters.to} onChange={set('to')} /></FormField>
            {Object.values(filters).some(Boolean) && <Button variant="ghost" size="sm" icon={FilterX} onClick={() => { setFilters(empty); setOffset(0); }}>Clear</Button>}
          </div>
        </div>

        {!isLoading && total === 0 && <EmptyState icon={SearchX} title="No matching activity" />}
        {data?.items.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Time</th>{showOrg && <th>Organization</th>}<th>Who</th><th>What</th><th>Entity</th></tr></thead>
              <tbody>
                {data.items.map((l) => (
                  <tr key={l.id} {...rowProps(() => setSelected(l))}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(l.createdAt)}</td>
                    {showOrg && <td>{l.organizationName ?? <span className="text-muted">Platform</span>}</td>}
                    <td>{l.actorName}{l.actorEmail && <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{l.actorEmail}</div>}</td>
                    <td>{describeAction(l.action)}{l.metadata?.comment && <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>“{l.metadata.comment}”</div>}</td>
                    <td className="text-muted">{l.entityType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > PAGE && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) var(--space-5)' }}>
            <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>{offset + 1}–{Math.min(offset + PAGE, total)} of {total}</span>
            <div className="row-actions">
              <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>Next <ChevronRight size={14} aria-hidden="true" /></Button>
            </div>
          </div>
        )}
      </Card>
      {selected && <AuditDrawer log={selected} showOrg={showOrg} onClose={() => setSelected(null)} />}
    </div>
  );
}

async function fetchEverything(params) {
  const items = [];
  let offset = 0;
  // Page through the filtered results (500 per request) until all are fetched.
  for (;;) {
    const res = await auditLogService.list({ ...params, offset });
    items.push(...res.items);
    offset += res.items.length;
    if (offset >= res.total || res.items.length === 0) break;
  }
  return items;
}

export function AuditLogPage() {
  return (
    <AuditLogView
      subtitle="A permanent record of who did what in your organization. Entries can’t be edited or removed."
      useLogs={useAuditLogs}
      useActions={useAuditActions}
      fetchAll={fetchEverything}
      filenamePrefix="tropos-audit-log"
    />
  );
}
