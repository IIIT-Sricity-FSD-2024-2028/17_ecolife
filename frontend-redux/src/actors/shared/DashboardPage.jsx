import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useForm } from '../../hooks/useForm';
import { PageHero } from '../../components/ui/PageHero';
import { ACTOR_LABELS } from '../../app/navigation';
import { AdminDashboard, AuditorDashboard, PlatformDashboard, VerifierDashboard } from './dashboards/OversightDashboards';
import { ExecutiveDashboard, FinanceDashboard, LeadDashboard, PlantDashboard } from './dashboards/EmissionsDashboards';

const VIEWS = {
  EXECUTIVE_APPROVER: { C: ExecutiveDashboard, title: 'Company dashboard', text: 'How the company is doing against its targets.' },
  SUSTAINABILITY_LEAD: { C: LeadDashboard, title: 'Emissions dashboard', text: 'Emissions, review progress and targets in one view.' },
  FINANCE_MANAGER: { C: FinanceDashboard, title: 'Finance dashboard', text: 'What fuel and power cost, and what each tonne costs.' },
  PLANT_MANAGER: { C: PlantDashboard, title: 'Plant dashboard', text: 'What is entered, what is waiting and how your sites are doing.' },
  INTERNAL_AUDITOR: { C: AuditorDashboard, title: 'Audit dashboard', text: 'Findings and activity across the company.' },
  EXTERNAL_VERIFIER: { C: VerifierDashboard, title: 'Verification dashboard', text: 'Questions raised, answered and resolved.' },
  ORG_ADMIN: { C: AdminDashboard, title: 'Administration dashboard', text: 'People, access and how much of your plan you use.' }
};
const ORDER = ['EXECUTIVE_APPROVER', 'SUSTAINABILITY_LEAD', 'FINANCE_MANAGER', 'PLANT_MANAGER', 'ORG_ADMIN', 'INTERNAL_AUDITOR', 'EXTERNAL_VERIFIER'];

/** Everyone's first screen: charts for their own job. A person with several roles can switch between them. */
export default function DashboardPage() {
  const { user } = useAuth();
  const mine = ORDER.filter((r) => (user?.roles || []).includes(r));
  const f = useForm('dashboard', { role: null });
  if (user?.isPlatformAdmin) return <div><PageHero title="Platform dashboard" description="Companies, revenue and usage across the platform." /><PlatformDashboard /></div>;
  const role = mine.includes(f.values.role) ? f.values.role : mine[0];
  const view = VIEWS[role];
  if (!view) return <PageHero title="Dashboard" description="Nothing to show for your role yet." />;
  const { C } = view;
  const first = (user?.fullName || '').split(' ')[0];
  return (
    <div>
      <PageHero title={view.title} description={`${first ? `${first}, ` : ''}${view.text[0].toLowerCase()}${view.text.slice(1)}`} actions={mine.length > 1 ? (
        <div className="inline-flex rounded-xl p-1 bg-white/12 ring-1 ring-white/20 backdrop-blur" role="tablist" aria-label="Dashboard for role">
          {mine.map((r) => <button key={r} type="button" role="tab" aria-selected={r === role} onClick={() => f.set('role', r)} className={`px-3 py-1.5 text-sm rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${r === role ? 'bg-white text-[#06382C] font-medium' : 'text-white/85 hover:bg-white/10'}`}>{ACTOR_LABELS[r]}</button>)}
        </div>
      ) : undefined} />
      <C />
    </div>
  );
}
