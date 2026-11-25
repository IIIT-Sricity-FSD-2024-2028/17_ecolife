import React from 'react';
import { Link } from 'react-router-dom';
import { TroposLogo } from '../../components/shell/TroposLogo';
import { Notice } from '../../components/ui';

const TITLES = { terms: 'Terms of use', privacy: 'Privacy policy' };
const UPDATED = '25 November 2026';

/** Plain-language drafts written for this academic project. A real launch needs review by a lawyer. */
const TEXT = {
  terms: [
    ['Who these terms are for', 'Tropos is a carbon-accounting service for manufacturers in India. By creating an account or signing in, you agree to these terms on behalf of your company. If you do not agree, please do not use the service.'],
    ['What you can do with Tropos', 'You can record energy, fuel, water, waste and supplier data, calculate emissions, set targets, prepare reports for your customers and auditors, and invite your colleagues to help. Each person gets a role, and sees only what that role allows.'],
    ['Your account', 'Keep your password private and switch on two-step sign-in if you can. You are responsible for what is done from your accounts. Tell your company administrator straight away if you think someone else has used your account.'],
    ['Your data stays yours', 'The figures, files and records you add belong to your company. We use them only to run the service for you. Your company’s data is kept apart from every other company’s data.'],
    ['Keeping figures honest', 'Reports are only as good as the data behind them. Do not enter figures you know to be wrong. Every change is logged with who made it and when, and the log cannot be edited, so your auditor can rely on it.'],
    ['Plans, invoices and payment', 'Paid plans are billed monthly. Each invoice is a GST tax invoice, and GST is shown separately. Your plan switches on when payment is received and runs for one month from that day. In this demonstration version, payments are practice payments and no real money moves.'],
    ['Emission factors and reports', 'Calculations use published factors and standards, which we update from time to time. Reports are prepared in good faith to help you meet your customers’ and regulators’ requests, but you are responsible for what you submit to them.'],
    ['Acceptable use', 'Do not try to break into the service, use someone else’s account, upload harmful files, or copy the service to sell it.'],
    ['Stopping the service', 'You can ask us to close your account at any time. We may pause an account that is unpaid for a long time or that breaks these terms, and we will tell you why first wherever we can.'],
    ['Changes to these terms', 'If we change these terms in a way that matters, we will tell you before the change starts. The date at the top shows when they were last updated.'],
    ['Questions', 'Write to the Tropos team through the contact your company was given when it joined.']
  ],
  privacy: [
    ['What this policy covers', 'It explains what information Tropos keeps about you and your company, why, and what you can ask us to do with it.'],
    ['What we keep about you', 'Your name, work email, role, and when you last signed in. Passwords are never stored as you typed them. If you switch on two-step sign-in, we keep what is needed to check your code.'],
    ['What we keep about your company', 'Company name, GST number, billing address, sites, the energy, fuel, water, waste and supplier records you enter, uploaded bills and evidence files, targets, reports, and invoices and payments for your plan.'],
    ['Why we keep it', 'To run your account, calculate your emissions, prepare your reports, keep a record of who changed what, bill you, and keep the service secure. We do not sell your information and we do not use it for advertising.'],
    ['Who can see it', 'Only people in your own company, according to the role you gave them. External reviewers can see only what you invite them to. A small number of Tropos staff can help with sign-in and billing problems, but they cannot see your company’s emissions data.'],
    ['Suppliers and other people you invite', 'When you ask a supplier for a carbon footprint, we email them a private link. They see only the request you sent. We keep their answer with your records.'],
    ['How long we keep it', 'While your account is active. If you close it, we keep records that the law or your auditors may need for a limited time, then delete them. Activity logs are kept because they are your evidence trail.'],
    ['How we protect it', 'Each company’s data is separated from others by the database itself, sign-in is protected against repeated guessing, files are checked when uploaded, and changes are logged.'],
    ['Your choices', 'You can ask to see the information we hold about you, correct it, or have it deleted, as the Digital Personal Data Protection Act, 2023 allows. Ask your company administrator, or write to the Tropos team.'],
    ['Cookies', 'We use only what is needed to keep you signed in. We do not use advertising trackers.'],
    ['Changes', 'If we change this policy in a way that matters, we will tell you first. The date at the top shows when it was last updated.']
  ]
};

export default function LegalPage({ kind }) {
  return (
    <div className="flex-1 bg-paper">
      <header className="max-w-3xl mx-auto px-6 py-6"><Link to="/" className="flex items-center gap-2.5 w-fit"><TroposLogo /><span className="text-lg font-semibold">Tropos</span></Link></header>
      <main className="max-w-3xl mx-auto px-6 pb-16">
        <h1 className="text-3xl font-semibold tracking-tight">{TITLES[kind]}</h1>
        <p className="text-sm text-muted mt-1">Last updated {UPDATED}</p>
        <Notice tone="warn" className="mt-5">This is a plain-language draft written for a college project. It is not legal advice. A company launching this service would have a lawyer review it first.</Notice>
        <div className="mt-6 space-y-6">
          {TEXT[kind].map(([h, p]) => (
            <section key={h}><h2 className="text-lg font-semibold">{h}</h2><p className="mt-1.5 text-text leading-relaxed">{p}</p></section>
          ))}
        </div>
        <p className="mt-10"><Link to="/" className="text-brand-700 hover:underline">Back to the home page</Link></p>
      </main>
    </div>
  );
}
