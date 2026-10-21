'use client';

/**
 * Wednesday-only month calendar — the paper runs on Wednesdays, so legal run
 * dates may only land on one. Shared by the customer Legal Portal form and
 * the admin Legal Database create form.
 */
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { isWednesday } from '@/lib/legal-dates';

export function WednesdayCalendar({
  label,
  value,
  minDate,
  onSelect,
}: {
  label: string;
  value: string;
  /** Earliest selectable date (ISO) — the End Date calendar passes the
   *  selected Start Date. */
  minDate?: string;
  onSelect: (iso: string) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-based

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startPad = first.getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const out: Array<{ day: number; iso: string; wednesday: boolean } | null> = [];
    for (let i = 0; i < startPad; i++) out.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      out.push({ day, iso, wednesday: isWednesday(iso) });
    }
    return out;
  }, [viewYear, viewMonth]);

  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 w-64">
      <div className="text-[11px] uppercase tracking-widest font-bold text-zinc-500 mb-2">
        {label}
      </div>
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="p-1 text-zinc-500 hover:text-zinc-900"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-sm font-semibold text-zinc-900">{monthLabel}</div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="p-1 text-zinc-500 hover:text-zinc-900"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-zinc-400 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((c, i) =>
          c === null ? (
            <div key={`pad-${i}`} />
          ) : (
            <button
              key={c.iso}
              type="button"
              disabled={!c.wednesday || c.iso < todayIso || (minDate ? c.iso < minDate : false)}
              onClick={() => onSelect(c.iso)}
              className={`h-8 rounded text-xs transition-colors ${
                value === c.iso
                  ? 'bg-brand-red text-white font-bold'
                  : c.wednesday && c.iso >= todayIso && (!minDate || c.iso >= minDate)
                    ? 'text-zinc-900 hover:bg-red-50 border border-zinc-200'
                    : 'text-zinc-300 cursor-not-allowed'
              }`}
            >
              {c.day}
            </button>
          )
        )}
      </div>
      <p className="mt-2 text-[10px] text-zinc-400">
        The paper runs on Wednesdays — only Wednesdays are selectable.
      </p>
    </div>
  );
}
