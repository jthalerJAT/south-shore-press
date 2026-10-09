'use client';

/**
 * TrafficDashboard — the Traffic Stats tile's page (2026-10-09).
 * Top: four stat cards (Today / Trailing Week / Trailing Month / YTD), each
 * with sequential growth (vs the preceding period of equal length) and
 * year-over-year growth. "—" means the comparison window has no recorded
 * traffic yet (full-site counting began 2026-10-09; earlier history is
 * article views only, and YoY needs a year of data).
 * Bottom: top content by views with a timeframe dropdown, defaulting to
 * This Month.
 */
import { useState } from 'react';
import type { TrafficStat, TopContentFrame } from '@/lib/queries/traffic';

function GrowthChip({ value, label }: { value: number | null; label: string }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
        <span className="font-semibold">—</span> {label}
      </span>
    );
  }
  const pct = value * 100;
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${up ? 'text-emerald-700' : 'text-red-600'}`}
    >
      <span>{up ? '▲' : '▼'}</span>
      {Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(1)}%
      <span className="font-normal text-zinc-500">{label}</span>
    </span>
  );
}

export function TrafficDashboard({
  stats,
  frames,
}: {
  stats: TrafficStat[];
  frames: TopContentFrame[];
}) {
  const [frameKey, setFrameKey] = useState<TopContentFrame['key']>('month');
  const frame = frames.find((f) => f.key === frameKey) ?? frames[0];

  return (
    <div className="space-y-8">
      {/* ── Stat cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.key} className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex items-baseline justify-between">
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                {s.label}
              </div>
              <div className="text-[11px] text-zinc-400">{s.rangeLabel}</div>
            </div>
            <div className="mt-2 text-3xl font-bold text-zinc-900 tabular-nums">
              {s.views.toLocaleString()}
            </div>
            <div className="mt-2 flex flex-col gap-0.5">
              <GrowthChip value={s.seqGrowth} label="vs prior period" />
              <GrowthChip value={s.yoyGrowth} label="vs last year" />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-400">
        Page views, bucketed by UTC day. Full-site counting began Oct 9, 2026 — earlier history
        reflects article views only, so growth rates straddling that date run low. &ldquo;—&rdquo;
        means the comparison window has no recorded traffic yet. For unique visitors, referrers,
        and devices, see{' '}
        <a
          href="https://vercel.com/jat-capital/south-shore-press/analytics"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-red hover:underline"
        >
          Vercel Web Analytics ↗
        </a>{' '}
        (Vercel login required).
      </p>

      {/* ── Top content ────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-widest font-bold text-zinc-500">
            Top Content by Views
          </h2>
          <select
            value={frameKey}
            onChange={(e) => setFrameKey(e.target.value as TopContentFrame['key'])}
            className="rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-brand-red focus:outline-none"
          >
            {frames.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded border border-zinc-200">
          <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-3 py-2 bg-zinc-50 border-b border-zinc-200 text-[11px] uppercase tracking-widest font-bold text-zinc-500">
            <div>#</div>
            <div>Story</div>
            <div className="text-right">Views</div>
          </div>
          {frame && frame.rows.length > 0 ? (
            <ul className="divide-y divide-zinc-100">
              {frame.rows.map((r, i) => (
                <li
                  key={r.id}
                  className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-3 py-2.5"
                >
                  <div className="text-sm font-bold text-zinc-400 tabular-nums">{i + 1}</div>
                  <a
                    href={r.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-zinc-900 hover:text-brand-red hover:underline truncate"
                  >
                    {r.headline}
                  </a>
                  <div className="text-sm font-semibold text-zinc-900 tabular-nums text-right">
                    {r.views.toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-6 text-sm text-zinc-400 italic">
              No recorded views in this timeframe yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
