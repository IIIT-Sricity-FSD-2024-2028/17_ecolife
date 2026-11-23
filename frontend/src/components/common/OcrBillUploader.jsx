import React, { useRef, useState } from 'react';
import { ScanLine, TriangleAlert, CircleCheck } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import { Button } from '../ui';

/** Reads a bill from a photo or PDF and hands the amount, cost and bill number to the form. Nothing is saved until the person saves the record. */
export function OcrBillUploader({ onExtracted }) {
  const inputRef = useRef(null);
  const { pushToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const data = await apiFetch('/ocr/extract-bill', { method: 'POST', body: fd });
      setResult(data); onExtracted?.(data);
      pushToast('Bill read. Check the figures below before saving.');
    } catch (err) { pushToast(err.message || 'The bill could not be read. Type the figures in instead.', 'error'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  }
  const x = result?.extracted;
  return (
    <div className="rounded-[10px] border border-dashed border-brand-500/50 bg-brand-50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <ScanLine className="w-5 h-5 text-brand-600 shrink-0" />
        <div className="flex-1 min-w-[14rem]"><div className="text-sm font-medium text-text">Have the bill? Let Tropos read it.</div><div className="text-sm text-muted">Upload a photo or PDF and the amount, cost and bill number fill in for you. The bill is kept as proof.</div></div>
        <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" aria-label="Choose a bill" onChange={handleFileChange} disabled={busy} />
        <Button type="button" variant="secondary" loading={busy} onClick={() => inputRef.current?.click()}>Read a bill</Button>
      </div>
      {x && (
        <div className="mt-3 pt-3 border-t border-brand-500/20 text-sm space-y-1.5">
          <div className="flex items-center gap-1.5 text-ok-600 font-medium"><CircleCheck className="w-4 h-4" /> Read with {x.confidencePct}% confidence. Please check these:</div>
          <div className="tabular-nums text-text">Amount <strong>{x.quantity ?? '—'} {x.unit ?? ''}</strong> · Cost <strong>{x.costInr ? `₹${x.costInr}` : '—'}</strong> · Bill number <strong>{x.invoiceNumber ?? '—'}</strong></div>
          {x.kvahBlockedWarning && <div className="flex items-start gap-1.5 text-saffron-600"><TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" /> This bill shows kVAh, which cannot be used. Type in the kWh figure instead.</div>}
          {result.duplicateHashDetected && <div className="flex items-start gap-1.5 text-danger-600"><TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" /> The same bill file was uploaded before. Check you are not entering it twice.</div>}
        </div>
      )}
    </div>
  );
}
