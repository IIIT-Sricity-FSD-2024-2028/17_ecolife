import React from 'react';
import { Link } from 'react-router-dom';
import { Card, PageHeader } from '../../components/ui';

const MONTH = [
  ['Enter', 'Plant managers add each month’s bills and meter readings under Energy and fuel, Water and waste, and Air, materials and cooling. Records start as drafts.'],
  ['Send for review', 'When a record is right, send it for review. Nobody else sees a draft as final.'],
  ['Review', 'A sustainability lead approves it or sends it back with a note. You cannot approve your own records, so two people always see every number.'],
  ['Close the month', 'When everything is approved the lead closes the month. The numbers are locked and saved, so reports stay the same.'],
  ['Report', 'Reports are built from closed months only. Executives sign off the year, and a verifier can check it.']
];
const TERMS = [
  ['tCO₂e', 'Tonnes of carbon dioxide equivalent. One number that adds up different gases by how much they warm the planet.'],
  ['Scope 1', 'Emissions from fuel you burn yourself: diesel in generators, coal in boilers, gas in furnaces.'],
  ['Scope 2', 'Emissions from the electricity you buy. The power station made them, but your use caused them.'],
  ['Scope 3', 'Emissions in your supply chain: what you buy, how it travels, what happens to your waste.'],
  ['Emission factor', 'How much carbon one unit of something releases, for example one litre of diesel or one unit of grid electricity. Tropos keeps these on file with their source, so every result can be traced.'],
  ['GJ', 'Gigajoule, a measure of energy. Used to compare fuels and electricity on one scale.'],
  ['kL', 'Kilolitre: 1,000 litres, or one cubic metre. Water is measured in kL.'],
  ['Approved', 'A record a second person has checked. Only approved records count in totals and reports.'],
  ['Base year', 'The year you measure a reduction from. A target of “cut 30% by 2030” compares 2030 with this year.'],
  ['SBTi', 'Science Based Targets initiative. It checks that a company’s target is big enough to match what climate science asks for. Tropos tells you if a target would not meet its minimum.'],
  ['Carbon footprint of a product', 'The emissions caused by making one unit of something you buy, such as one tonne of steel. Your suppliers can tell you this, and Tropos can ask them by email.']
];
const FAQ = [
  ['Why can’t I approve my own record?', 'Auditors expect a second person to check every figure. If your company really has one person for everything, an administrator can allow this in Company settings. It is logged.'],
  ['A bill came in after we closed the month. What now?', 'Ask a lead to reopen the month with a reason, add the record, get it approved, then close again. The change and the reason stay in the activity log.'],
  ['What does the yellow warning on a record mean?', 'An automatic check found something unusual, such as an amount far above your usual or a price that does not match your average. It is not an error. The person entering it should explain it, and the reviewer decides.'],
  ['Who can see my data?', 'Only people in your company, and only what their role allows. Tropos staff can look after accounts but cannot read your emission records.'],
  ['A record was sent back to me. What do I do?', 'Open Today or your dashboard. It lists sent-back records with the reviewer’s note. Correct the figure or add what was missing, then send it for review again.'],
  ['How do I change plan, pay or get a GST invoice?', 'Finance managers and administrators open Plan and invoices. Pick a plan, and an invoice is raised. Press Pay now to pay, and your plan starts straight away. Every invoice has an Invoice PDF button that gives you the GST tax invoice.'],
  ['How do I ask a supplier for their carbon footprint?', 'Sustainability leads open Suppliers, choose the supplier and describe the product. Tropos emails them a private link. When they answer, you can accept their figure and it is used in your Scope 3 total.'],
  ['How do I get my data in faster?', 'Photograph a bill and let Tropos read it, upload a CSV, or ask your finance team to import from their accounting software.']
];

export default function HelpPage() {
  return (
    <div className="max-w-4xl">
      <PageHeader title="Help" description="How Tropos works, in plain words." />
      <Card className="mb-4" title="How a month works">
        <ol className="space-y-3">{MONTH.map(([t, d], i) => <li key={t} className="flex gap-3"><span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-sm font-semibold flex items-center justify-center shrink-0">{i + 1}</span><p className="text-sm"><span className="font-semibold text-text">{t}.</span> <span className="text-muted">{d}</span></p></li>)}</ol>
        <p className="mt-4 text-sm text-muted">Stuck on what to do next? Open <Link to="/" className="text-brand-700 hover:underline">Today</Link>. It lists what is waiting for you.</p>
      </Card>
      <Card className="mb-4" title="Words you will see" padded={false}>
        <dl className="divide-y divide-line">{TERMS.map(([t, d]) => <div key={t} className="grid sm:grid-cols-[9rem_1fr] gap-1 sm:gap-4 px-5 py-3"><dt className="font-semibold text-text">{t}</dt><dd className="text-sm text-muted">{d}</dd></div>)}</dl>
      </Card>
      <Card title="Common questions" padded={false}>
        <div className="divide-y divide-line">{FAQ.map(([q, a]) => <details key={q} className="group px-5 py-3"><summary className="cursor-pointer font-medium text-text list-none flex justify-between gap-4">{q}<span className="text-muted group-open:rotate-45 transition-transform" aria-hidden>+</span></summary><p className="mt-2 text-sm text-muted">{a}</p></details>)}</div>
      </Card>
    </div>
  );
}
