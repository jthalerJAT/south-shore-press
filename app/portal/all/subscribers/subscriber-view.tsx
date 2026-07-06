'use client';

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import type { PaidSubscriberList } from '@/lib/simplecirc/types';
import { runSubscriberTemplate } from './actions';
import { SubscriberTable } from './subscriber-table';

export function SubscriberView() {
  const [result, setResult] = useState<PaidSubscriberList | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await runSubscriberTemplate();
      setResult(res);
    });
  }

  const total = result?.totalPaid ?? 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-headline text-2xl font-bold text-zinc-900">
            {result
              ? `${result.rows.length.toLocaleString()} Total Paid Subscriber${result.rows.length === 1 ? '' : 's'}`
              : 'Paid Subscribers'}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Reproduces the SimpleCirc “Paid Subscribers” export (one row per subscription, amount
            paid&nbsp;≠&nbsp;0). Click any column heading to sort.
            {result && result.rows.length > 0 ? (
              <>
                {' '}
                Total paid:{' '}
                <span className="font-semibold text-zinc-700">
                  {total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </span>
                .
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-2 rounded bg-brand-red px-4 py-2 text-sm font-semibold text-white hover:bg-brand-red-dark disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${pending ? 'animate-spin' : ''}`} />
          {pending ? 'Pulling…' : result ? 'Re-run Template' : 'Run Template'}
        </button>
      </div>

      <div className="mt-5">
        {!result ? (
          <div className="rounded border border-dashed border-zinc-300 px-4 py-12 text-center text-sm text-zinc-500">
            Press <span className="font-semibold text-zinc-700">Run Template</span> to pull the
            current paid subscriber list from SimpleCirc.
          </div>
        ) : result.error ? (
          <div className="rounded-lg border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-800">
            {result.error} Please try again in a moment.
          </div>
        ) : (
          <>
            <SubscriberTable rows={result.rows} />
            {result.rows.length === 0 && result.rawSample ? (
              <div className="mt-6 rounded-lg border border-zinc-300 bg-zinc-50 p-4">
                <p className="text-sm font-semibold text-zinc-700">
                  Connected to SimpleCirc, but no rows matched the expected fields.
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Below is one raw record exactly as SimpleCirc returned it. Send this over so the
                  column mapping can be locked to your account’s field names.
                </p>
                <pre className="mt-3 max-h-96 overflow-auto rounded border border-zinc-200 bg-white p-3 text-[11px] leading-relaxed text-zinc-700">
                  {JSON.stringify(result.rawSample, null, 2)}
                </pre>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
