import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, CheckCircle2, ClipboardCheck, FileText, ScanLine, ShieldCheck, Target, Truck, Users, ChevronDown, Zap, Droplets, Flame } from 'lucide-react';
import { TroposLogo } from '../../components/common/TroposLogo';
import { LeafVeins } from '../../components/common/LeafVeins';

const STEPS = [
  { icon: ScanLine, title: 'Add your bills and readings', text: 'Upload an electricity or fuel bill and the form fills itself, or type the figures in. Every field tells you where to find the number.' },
  { icon: ClipboardCheck, title: 'Your team reviews and closes the month', text: 'A second person approves each record. When everything is approved, the sustainability lead closes the month and the figures are locked.' },
  { icon: FileText, title: 'Download the reports you need', text: 'BRSR Core, the carbon-credit scheme form and a summary for your buyers come from the same approved records.' }
];
const FEATURES = [
  { icon: Flame, title: 'Energy and fuel', text: 'Electricity, diesel, coal, gas and generator fuel, with the emission factor shown beside every figure.' },
  { icon: Droplets, title: 'Water, waste and air', text: 'Water balance against your permit, waste by type and route, and chimney readings against legal limits.' },
  { icon: BarChart3, title: 'Emissions explorer', text: 'Break emissions down by scope, site, month or source, click any number to see the records behind it, and export.' },
  { icon: Truck, title: 'Suppliers', text: 'Ask suppliers for their data by email link. They answer on one page with no account to create.' },
  { icon: Target, title: 'Targets and projects', text: 'Set a reduction target, see your yearly path, and compare projects by cost per tonne saved.' },
  { icon: ShieldCheck, title: 'Ready for audit', text: 'Every change is logged with who and when. Auditors and verifiers get a read-only view of records and evidence.' }
];
const ROLES = ['Plant manager', 'Sustainability lead', 'Finance', 'Executive approver', 'Auditor and verifier', 'Administrator'];
const FAQ = [
  ['Do I need a sustainability expert to use this?', 'No. Each screen is written for the person who has the bill or the meter reading, with examples and a note on where to find each number. Your sustainability lead reviews and closes the month.'],
  ['Which reports can I produce?', 'A BRSR Core export, the BEE carbon credit scheme (CCTS) form, and a PDF summary for buyers. All of them are built from approved records of closed months.'],
  ['Where do the emission factors come from?', 'From published sources such as the CEA CO₂ baseline database for grid electricity. Every figure shows which factor and version was used, and new releases are reviewed before they go live.'],
  ['Is our data separate from other companies?', 'Yes. Each company\'s records are isolated at the database level, and people only see the sites and screens their role needs.'],
  ['What does it cost?', 'You start with a free trial. Plans and prices are shared when you sign up, so you can see exactly what you would pay before you decide.']
];

function ScopeCard() {
  const bars = [['Scope 1', 30, 'h-28', 'bg-white'], ['Scope 2', 25, 'h-24', 'bg-brand-100'], ['Scope 3', 45, 'h-40', 'bg-sage']];
  return (
    <div className="glass p-5 w-full max-w-md ml-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-white/80">Total emissions</div>
          <div className="text-3xl font-semibold tabular-nums leading-tight mt-0.5">1,240 <span className="text-base font-normal text-white/80">tCO₂e</span></div>
        </div>
        <span className="text-xs px-2 py-1 rounded-md bg-white/15 border border-white/25">Example data</span>
      </div>
      <div className="flex items-end gap-3 mt-5 h-44">
        {bars.map(([label, pct, h, bg]) => (
          <div key={label} className="flex-1 flex flex-col justify-end">
            <div className="text-sm font-medium mb-1.5 tabular-nums">{pct}%</div>
            <div className={`${h} ${bg} rounded-md`} />
            <div className="text-xs text-white/80 mt-1.5">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm text-white/90"><span className="w-2 h-2 rounded-full bg-ok-600 ring-2 ring-white/40" /> 4 of 5 sections approved for April</div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex-1 flex flex-col text-text">
      <section className="band relative overflow-hidden rounded-none">
        <LeafVeins />
        <header className="relative max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5"><TroposLogo /><span className="text-lg font-semibold text-white">Tropos</span></Link>
          <nav className="flex items-center gap-2">
            <a href="#how" className="hidden sm:block px-3 py-2 text-sm text-white/85 hover:text-white">How it works</a>
            <a href="#faq" className="hidden sm:block px-3 py-2 text-sm text-white/85 hover:text-white">Questions</a>
            <Link to="/login" className="px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg">Sign in</Link>
            <Link to="/signup" className="btn bg-white text-forest-800 hover:bg-brand-50 font-semibold">Start free trial</Link>
          </nav>
        </header>
        <div className="relative max-w-6xl mx-auto px-6 pt-10 pb-20 lg:pt-16 lg:pb-28 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <h1 className="text-4xl sm:text-[3.4rem] font-semibold leading-[1.07] tracking-tight">Know your plant's carbon number every month, without hiring a consultant.</h1>
            <p className="mt-5 text-lg text-white/85 max-w-xl leading-relaxed">Tropos turns electricity bills, fuel records and water and waste logs into approved, audit-ready emissions figures for your BRSR report.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className="btn bg-white text-forest-800 hover:bg-brand-50 font-semibold !min-h-12 px-6 text-base">Start free trial <ArrowRight className="w-4 h-4" /></Link>
              <Link to="/login" className="btn !min-h-12 px-6 text-base text-white border border-white/40 hover:bg-white/10">Sign in</Link>
            </div>
            <p className="mt-6 text-sm text-white/75">Built for Indian manufacturers: GHG Protocol, IPCC AR6, CEA grid factors, SEBI BRSR Core and BEE CCTS.</p>
          </div>
          <div className="lg:col-span-5"><ScopeCard /></div>
        </div>
      </section>

      <section id="how" className="max-w-6xl w-full mx-auto px-6 py-16">
        <h2 className="text-3xl font-semibold tracking-tight max-w-2xl">From a stack of bills to a closed month in three steps</h2>
        <ol className="mt-8 grid md:grid-cols-3 gap-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card p-5">
              <div className="flex items-center gap-3"><span className="w-9 h-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-semibold tabular-nums">{i + 1}</span><s.icon className="w-5 h-5 text-brand-600" /></div>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-muted leading-relaxed">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-brand-50 border-y border-line">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-semibold tracking-tight max-w-2xl">Everything the monthly cycle needs, in one place</h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-5 bg-white">
                <f.icon className="w-6 h-6 text-brand-600" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl w-full mx-auto px-6 py-16 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Everyone sees what they need and nothing more</h2>
          <p className="mt-3 text-muted max-w-lg leading-relaxed">A plant manager sees this month's to-do list. The sustainability lead sees what is waiting for review. Finance, executives, auditors and administrators each get their own simple view.</p>
          <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2">
            {ROLES.map((r) => <li key={r} className="flex items-center gap-2 text-sm"><CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />{r}</li>)}
          </ul>
        </div>
        <div className="band p-7 relative overflow-hidden">
          <LeafVeins />
          <div className="relative space-y-3">
            <div className="glass-solid p-4 flex items-center gap-3"><Zap className="w-5 h-5 text-brand-600" /><div className="text-sm"><div className="font-medium">Electricity, Pune plant</div><div className="text-muted">Bill uploaded and matched to the meter</div></div></div>
            <div className="glass-solid p-4 flex items-center gap-3"><Users className="w-5 h-5 text-brand-600" /><div className="text-sm"><div className="font-medium">Waiting for your review</div><div className="text-muted">3 records from the Pune plant</div></div></div>
            <div className="glass-solid p-4 flex items-center gap-3"><FileText className="w-5 h-5 text-brand-600" /><div className="text-sm"><div className="font-medium">BRSR Core export</div><div className="text-muted">Ready once April is closed</div></div></div>
          </div>
        </div>
      </section>

      <section id="faq" className="bg-brand-50 border-t border-line">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-semibold tracking-tight">Questions people ask</h2>
          <div className="mt-6 space-y-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="card bg-white group">
                <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none font-medium">{q}<ChevronDown className="w-5 h-5 text-muted shrink-0 transition-transform group-open:rotate-180" /></summary>
                <p className="px-5 pb-4 -mt-1 text-muted leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="band rounded-none relative overflow-hidden">
        <LeafVeins />
        <div className="relative max-w-6xl mx-auto px-6 py-14 flex flex-wrap items-center justify-between gap-6">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight max-w-xl">Close your first month with figures your auditor can check.</h2>
          <Link to="/signup" className="btn bg-white text-forest-800 hover:bg-brand-50 font-semibold !min-h-12 px-6 text-base">Start free trial <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </section>

      <footer className="bg-forest-900 text-white/75 text-sm">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5"><TroposLogo /><span className="text-white font-semibold">Tropos</span></div>
          <div className="flex gap-5"><Link to="/terms" className="hover:text-white">Terms of use</Link><Link to="/privacy" className="hover:text-white">Privacy policy</Link><Link to="/login" className="hover:text-white">Sign in</Link></div>
        </div>
      </footer>
    </div>
  );
}
