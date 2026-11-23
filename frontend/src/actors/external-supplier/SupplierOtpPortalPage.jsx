import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../../services/apiClient';
import { TroposLogo } from '../../components/common/TroposLogo';
import { Button, Notice, SelectField, TextAreaField, TextField } from '../../components/ui';

export default function SupplierOtpPortalPage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [units, setUnits] = useState([]);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(null);
  const [otp, setOtp] = useState('');
  const [form, setForm] = useState({ value: '', unit: 'kg', note: '' });
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setInfo(await apiFetch(`/supplier-portal/${token}`)); } catch (e) { setErr(e.message || 'This link cannot be opened.'); }
  }
  useEffect(() => { load(); apiFetch('/meta/public').then((m) => setUnits(m.units || [])).catch(() => {}); }, [token]);

  async function run(fn) { setBusy(true); setErr(''); try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(false); } }
  const requestOtp = () => run(async () => { const r = await apiFetch(`/supplier-portal/${token}/request-otp`, { method: 'POST' }); setSent(r); });
  const verify = (e) => { e.preventDefault(); run(async () => { await apiFetch(`/supplier-portal/${token}/verify-otp`, { method: 'POST', body: JSON.stringify({ otpCode: otp }) }); await load(); }); };
  const submit = (e) => { e.preventDefault(); run(async () => { await apiFetch(`/supplier-portal/${token}/submit`, { method: 'POST', body: JSON.stringify({ submittedFactorVal: Number(form.value), submittedUnit: form.unit, methodologyNote: form.note }) }); await load(); }); };

  const answered = info && ['SUBMITTED', 'ACCEPTED', 'REJECTED'].includes(info.status);
  const unitOptions = units.filter((u) => u.dimension !== 'money').map((u) => ({ value: u.key, label: `per ${u.label}` }));

  return (
    <main className="min-h-screen bg-page flex items-start sm:items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-xl border border-line shadow-sm p-6 sm:p-8 space-y-5">
        <TroposLogo variant="sidebar" />
        <h1 className="text-xl font-semibold text-text">Share your product's carbon footprint</h1>
        {err && <Notice tone="danger">{err}</Notice>}
        {info && (
          <>
            <div className="rounded-lg bg-mist p-4 text-sm space-y-1">
              <div><strong>{info.organizationName}</strong> has asked {info.supplierName} for the carbon footprint of:</div>
              <div className="font-medium">{info.productDescription}</div>
              <div className="text-muted">We will send a code to {info.maskedEmail}.</div>
            </div>
            {answered ? (
              <Notice tone="ok">Thank you. Your answer was sent{info.submittedFactorVal != null ? `: ${info.submittedFactorVal} kg CO₂e ${info.submittedUnit ? `per ${info.submittedUnit}` : ''}` : ''}. You can close this page.</Notice>
            ) : !info.otpVerified ? (
              !sent ? (
                <div className="space-y-3"><p className="text-sm text-muted">To make sure this is really you, we email a 6-digit code first. You do not need an account.</p><Button className="w-full" loading={busy} onClick={requestOtp}>Email me a code</Button></div>
              ) : (
                <form onSubmit={verify} className="space-y-3">
                  <Notice tone="info">We sent a code to {sent.maskedEmail}. It works for 10 minutes.</Notice>
                  <TextField label="6-digit code" inputMode="numeric" maxLength={6} value={otp} onChange={setOtp} />
                  <div className="flex gap-2"><Button type="submit" className="flex-1" loading={busy} disabled={otp.length !== 6}>Confirm code</Button><Button type="button" variant="secondary" disabled={busy} onClick={requestOtp}>Send again</Button></div>
                </form>
              )
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="kg CO₂e" type="number" step="any" min="0" value={form.value} onChange={(v) => setForm({ ...form, value: v })} />
                  <SelectField label="For each" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} options={unitOptions} />
                </div>
                <TextAreaField label="How you worked it out" hint="For example the standard used (ISO 14067) and what is included. At least 10 characters." rows={3} value={form.note} onChange={(v) => setForm({ ...form, note: v })} />
                <Button type="submit" className="w-full" loading={busy} disabled={!(Number(form.value) > 0) || form.note.trim().length < 10}>Send answer</Button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
