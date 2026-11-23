import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, ScanLine, ShieldCheck } from 'lucide-react';
import { TroposLogo } from '../common/TroposLogo';
import { LeafVeins } from '../common/LeafVeins';

const POINTS = [
  [ScanLine, 'Upload a bill and the form fills itself', 'Every field says where to find the number.'],
  [ClipboardCheck, 'A second person approves each record', 'Only approved records count when the month closes.'],
  [ShieldCheck, 'Audit-ready from day one', 'Every change is logged with who made it and when.']
];

/** Sign-in, sign-up and account pages: a brand panel beside the form, so these pages feel like part of the product. */
export function AuthShell({ title, subtitle, children, footer, wide = false }) {
  return (
    <div className="flex-1 grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] min-h-screen">
      <aside className="band relative overflow-hidden rounded-none hidden lg:flex flex-col justify-between p-10">
        <LeafVeins />
        <Link to="/" className="relative flex items-center gap-2.5 w-fit"><TroposLogo /><span className="text-lg font-semibold text-white">Tropos</span></Link>
        <div className="relative space-y-6 max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">Close each month with figures your auditor can check.</h2>
          <ul className="space-y-3">
            {POINTS.map(([Icon, head, text]) => (
              <li key={head} className="glass p-4 flex gap-3"><Icon className="w-5 h-5 mt-0.5 shrink-0 text-white" /><div><div className="font-medium">{head}</div><div className="text-sm text-white/80">{text}</div></div></li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/70 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> GHG Protocol · IPCC AR6 · CEA grid factors · BRSR Core · BEE CCTS</p>
      </aside>
      <main className="flex items-center justify-center px-5 py-10 bg-paper">
        <div className={`w-full ${wide ? 'max-w-xl' : 'max-w-md'}`}>
          <Link to="/" className="lg:hidden flex items-center gap-2.5 mb-8 w-fit"><TroposLogo /><span className="text-lg font-semibold">Tropos</span></Link>
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 pt-5 border-t border-line text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
