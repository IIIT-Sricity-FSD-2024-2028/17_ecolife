import React from 'react';
import { useDispatch } from 'react-redux';
import { reportsRefreshed } from '../../store/slices/monthEnd/reportsSlice';
import { FileText, FileSpreadsheet, Landmark } from 'lucide-react';
import { downloadFile } from '../../services/downloadService';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../hooks/useForm';
import { Button, Card, PageHeader, Notice, SelectField } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid';
import { fmtDate } from '../../utils/formatters';

const REPORTS = [
  { type: 'SME_BUYER_SUMMARY_PDF', icon: FileText, title: 'Summary for your customers', text: 'One page with your emissions, your targets and how the figures were checked. Send it to buyers who ask.', path: '/reports/buyer-pdf', file: 'Tropos_Buyer_Carbon_Summary.pdf', action: 'Download PDF' },
  { type: 'SEBI_BRSR_CORE_P6', icon: FileSpreadsheet, title: 'BRSR Core figures', text: 'The emission, energy, water and waste figures for the SEBI sustainability report, for this year and last.', path: '/reports/brsr-core-export?format=csv', file: 'Tropos_BRSR_Core.csv', action: 'Download spreadsheet' },
  { type: 'BEE_CCTS_FORM_A', icon: Landmark, title: 'Carbon market baseline (CCTS)', text: 'Scope 1 and 2 figures in the form the Bureau of Energy Efficiency asks for.', path: '/reports/ccts-form-a', file: 'Tropos_CCTS_Form_A.csv', action: 'Download spreadsheet' }
];
const NAME = Object.fromEntries(REPORTS.map((r) => [r.type, r.title]));

export default function ReportsExportsPage() {
  const { pushToast } = useToast();
  const dispatch = useDispatch();
  const f = useForm('reports-page', { busy: '', type: '' });
  const { busy, type } = f.values;

  // downloading a report adds a row to the history, so the history is read again
  const refreshHistory = () => dispatch(reportsRefreshed());

  async function run(r) {
    f.set('busy', r.type);
    try { await downloadFile(r.path, r.file); pushToast('Report downloaded and recorded below.'); refreshHistory(); }
    catch (e) { pushToast(e.message, 'error'); } finally { f.set('busy', ''); }
  }

  return (
    <div>
      <PageHeader title="Reports" description="Reports are built only from months you have closed, so every figure is final and can be traced." />
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {REPORTS.map((r) => (
          <Card key={r.type}>
            <r.icon className="w-6 h-6 text-brand-500 mb-3" aria-hidden />
            <h2 className="font-semibold">{r.title}</h2>
            <p className="text-sm text-muted mt-1 mb-4">{r.text}</p>
            <Button variant="secondary" loading={busy === r.type} onClick={() => run(r)}>{r.action}</Button>
          </Card>
        ))}
      </div>
      <Notice tone="info" className="mb-4">If a report is empty, close at least one month first. Open months are drafts and are left out.</Notice>
      <DataGrid endpoint="/reports/history" params={{ reportType: type }} exportName="report-history"
        toolbar={<SelectField className="w-64" label="" aria-label="Report" value={type} onChange={(v) => f.set('type', v)} placeholder="All reports" options={REPORTS.map((r) => ({ value: r.type, label: r.title }))} />}
        columns={[{ key: 'f', label: 'File', render: (r) => <span className="font-medium">{r.fileName}</span>, value: (r) => r.fileName },
          { key: 't', label: 'Report', render: (r) => NAME[r.reportType] || r.reportType, value: (r) => NAME[r.reportType] || r.reportType },
          { key: 'y', label: 'Year', render: (r) => r.financialYear || 'All years', value: (r) => r.financialYear },
          { key: 'h', label: 'File fingerprint', hideOnMobile: true, render: (r) => <code className="text-xs" title="SHA-256. Anyone can re-compute this to confirm the file was not changed.">{r.fileSha256?.slice(0, 16)}…</code>, value: (r) => r.fileSha256 },
          { key: 'd', label: 'Created', render: (r) => fmtDate(r.createdAt), value: (r) => r.createdAt }]}
        emptyTitle="No reports yet" emptyText="Every report you download is listed here with a fingerprint." />
    </div>
  );
}
