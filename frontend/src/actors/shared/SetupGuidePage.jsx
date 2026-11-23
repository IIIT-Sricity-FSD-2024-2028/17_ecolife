import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';
import { useSetupProgress } from '../../hooks/useSetupProgress';
import { Card, PageHeader } from '../../components/ui';

export default function SetupGuidePage() {
  const { steps, loading, complete, canSetUp } = useSetupProgress();
  const done = steps.filter((s) => s.done).length;
  return (
    <div className="max-w-2xl">
      <PageHeader title="Set up your workspace" description={complete ? 'Everything is in place.' : `${done} of ${steps.length} done. You can come back to this at any time.`} />
      {!canSetUp && <p className="text-sm text-muted">Only a sustainability lead or company administrator can set up the workspace.</p>}
      {canSetUp && (
        <Card padded={false}>
          <ol className="divide-y divide-line">
            {steps.map((s) => (
              <li key={s.key} className="flex items-start gap-3 px-5 py-4">
                {s.done ? <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" aria-label="Done" /> : <Circle className="w-5 h-5 text-sage mt-0.5 shrink-0" aria-label="Not done" />}
                <div className="flex-1 min-w-0"><div className="font-medium text-text">{s.title}</div><p className="text-sm text-muted">{s.text}</p></div>
                {!loading && !s.done && s.canOpen && <Link to={s.path} className="shrink-0 text-sm font-medium text-emerald-700 hover:underline min-h-[44px] inline-flex items-center">{s.action}</Link>}
              </li>))}
          </ol>
        </Card>
      )}
    </div>
  );
}
