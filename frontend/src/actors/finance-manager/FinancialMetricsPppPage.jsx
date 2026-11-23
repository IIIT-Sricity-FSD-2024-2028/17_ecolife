import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Card, EmptyState, Notice, PageHeader } from '../../components/ui';
import { fmtInr, fmtNum } from '../../utils/formatters';

const fyLabel = (y) => `FY${y}-${String((y + 1) % 100).padStart(2, '0')}`;
const thisFy = (() => { const d = new Date(); return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; })();

export default function FinancialMetricsPppPage() {
  const { pushToast } = useToast();
  const dialog = useDialog();
  const { data: rows, refetch } = useApi('/financial-metrics');

  async function add() {
    const v = await dialog.form({ title: 'Add financial figures for a year', description: 'These turn your emissions into emissions per rupee of sales, which buyers and regulators compare.', submitLabel: 'Save', wide: true, fields: [
      { name: 'financialYear', type: 'select', label: 'Financial year', required: true, defaultValue: fyLabel(thisFy - 1), options: Array.from({ length: 6 }, (_, i) => { const l = fyLabel(thisFy + 1 - i); return { value: l, label: l }; }) },
      { name: 'revenueInr', type: 'number', label: 'Turnover for the year', required: true, unit: '₹', hint: 'Use the audited figure.' },
      { name: 'imfPppFactor', type: 'number', label: 'Rupees per international dollar (PPP)', required: true, hint: 'Published by the IMF or World Bank for the year you report.' },
      { name: 'pppReferenceYear', type: 'number', label: 'Year that figure is from', required: true, defaultValue: String(thisFy) }] });
    if (!v) return;
    try { await apiFetch('/financial-metrics', { method: 'POST', body: JSON.stringify({ financialYear: v.financialYear, revenueInr: Number(v.revenueInr), imfPppFactor: Number(v.imfPppFactor), pppReferenceYear: Number(v.pppReferenceYear) }) }); pushToast('Saved.'); refetch(); }
    catch (e) { pushToast(e.message, 'error'); }
  }

  return (
    <div>
      <PageHeader title="Financial figures" description="Yearly turnover, used to show emissions per rupee of sales." actions={<Button onClick={add}><Plus className="w-4 h-4" /> Add a year</Button>} />
      <Notice tone="info" className="mb-4">The BRSR report asks for emissions per rupee of turnover, adjusted to international dollars. Without these figures that line stays empty.</Notice>
      <Card padded={false}>
        {!rows ? <div className="h-24 animate-pulse" /> : rows.length === 0 ? <EmptyState title="No financial figures yet" action={<Button onClick={add}>Add the first year</Button>}>Add turnover for each financial year you report.</EmptyState> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted border-b border-line"><th className="px-5 py-2.5 font-medium">Year</th><th className="text-right font-medium">Turnover (₹)</th><th className="text-right font-medium">PPP rate (₹ per $)</th><th className="text-right px-5 font-medium">Turnover in international $</th></tr></thead><tbody>
            {rows.map((r) => <tr key={r.id} className="border-b border-line last:border-0"><td className="px-5 py-3 font-medium">{r.financialYear}</td><td className="text-right tabular-nums">{fmtInr(r.revenueInr)}</td><td className="text-right tabular-nums">{fmtNum(r.imfPppFactor, 2)}</td><td className="text-right px-5 tabular-nums">{fmtNum(r.pppAdjustedRevenueUsd, 0)}</td></tr>)}
          </tbody></table></div>)}
      </Card>
    </div>
  );
}
