import React from 'react';
import { Link } from 'react-router-dom';
import { TroposLogo } from '../../components/common/TroposLogo';
import { Notice } from '../../components/ui';

const TITLES = { terms: 'Terms of use', privacy: 'Privacy policy' };

/** The legal text must be supplied by the company's legal advisor. Until it is, this page says so plainly instead of showing invented terms. */
export default function LegalPage({ kind }) {
  return (
    <div className="flex-1 bg-paper">
      <header className="max-w-3xl mx-auto px-6 py-6"><Link to="/" className="flex items-center gap-2.5 w-fit"><TroposLogo /><span className="text-lg font-semibold">Tropos</span></Link></header>
      <main className="max-w-3xl mx-auto px-6 pb-16">
        <h1 className="text-3xl font-semibold tracking-tight">{TITLES[kind]}</h1>
        <Notice tone="warn" className="mt-5">The {TITLES[kind].toLowerCase()} has not been published yet. It will appear here once it has been reviewed by Tropos' legal advisor.</Notice>
        <p className="mt-6"><Link to="/" className="text-brand-700 hover:underline">Back to the home page</Link></p>
      </main>
    </div>
  );
}
