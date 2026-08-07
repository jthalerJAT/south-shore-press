'use client';

/**
 * Customer "new legal" form:
 *   Legal Header · Legal Copy (≤1000 words) · Start/End Wednesday-only
 *   calendars · auto footer line ("L40001 8/5/26, 8/12/26, …") · notarized
 *   copy checkbox · Preview (the real newspaper legal-page renderer with this
 *   legal dropped in) · Save.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { LegalPage } from '@/components/newspaper/legal-page';
import { LEGAL_PAGE_COLUMNS } from '@/lib/newspaper/legal-page';
import { isWednesday, wednesdaysBetween, legalFooterLine } from '@/lib/legal-dates';
import { saveCustomerLegal } from '../actions';

const MAX_BODY_WORDS = 1000;
const PREVIEW_SCALE = 0.42;

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

/* ── Wednesday-only month calendar ────────────────────────────────────── */

function WednesdayCalendar({
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

/* ── The form ─────────────────────────────────────────────────────────── */

export function NewLegalForm({ reservedLNumber }: { reservedLNumber: string }) {
  const router = useRouter();
  const [header, setHeader] = useState('');
  const [body, setBody] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notary, setNotary] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bodyWords = wordCount(body);
  const runDates = useMemo(
    () => (startDate && endDate && endDate >= startDate ? wednesdaysBetween(startDate, endDate) : []),
    [startDate, endDate]
  );
  const footerLine = useMemo(
    () => (reservedLNumber ? legalFooterLine(reservedLNumber, runDates) : ''),
    [reservedLNumber, runDates]
  );

  const previewData = useMemo(
    () => ({
      v: 1 as const,
      notices: [
        {
          id: 'preview',
          header: header.trim() || undefined,
          body: `${body.trim()}\n${footerLine}`.trim(),
        },
      ],
      columns: LEGAL_PAGE_COLUMNS,
    }),
    [header, body, footerLine]
  );

  async function handleSave() {
    if (!header.trim()) return setError('Enter the Legal Header.');
    if (!body.trim()) return setError('Enter the Legal Copy.');
    if (bodyWords > MAX_BODY_WORDS)
      return setError(`Legal Copy is limited to ${MAX_BODY_WORDS} words.`);
    if (!startDate) return setError('Select a Start Date.');
    if (!endDate) return setError('Select an End Date.');
    setSaving(true);
    setError(null);
    const res = await saveCustomerLegal({
      header,
      body,
      l_number: reservedLNumber,
      start_date: startDate,
      end_date: endDate,
      notary_required: notary,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save.');
      return;
    }
    router.push('/legal-portal');
    router.refresh();
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-zinc-700">Legal Header</label>
        <input
          value={header}
          onChange={(e) => setHeader(e.target.value)}
          placeholder="PUBLIC NOTICE"
          className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">Legal Copy</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          placeholder="Paste or type the full text of your legal notice…"
        />
        <p className={`mt-1 text-xs ${bodyWords > MAX_BODY_WORDS ? 'text-red-600' : 'text-zinc-400'}`}>
          {bodyWords}/{MAX_BODY_WORDS} words
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">Run Dates</label>
        <div className="flex flex-wrap gap-4">
          <WednesdayCalendar
            label="Start Date"
            value={startDate}
            onSelect={(iso) => {
              setStartDate(iso);
              if (endDate && endDate < iso) setEndDate('');
            }}
          />
          <WednesdayCalendar
            label="End Date"
            value={endDate}
            minDate={startDate || undefined}
            onSelect={setEndDate}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">
          To be included at the end of your legal:
        </label>
        <div className="mt-1 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-mono text-zinc-800 min-h-[2.4rem]">
          {footerLine || (
            <span className="text-zinc-400 font-sans">
              Select your run dates above — the legal number and every Wednesday it runs will
              appear here automatically.
            </span>
          )}
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm text-zinc-800">
        <input
          type="checkbox"
          checked={notary}
          onChange={(e) => setNotary(e.target.checked)}
          className="mt-0.5"
        />
        Do you require a notarized copy of this legal to be mailed to you?
      </label>

      <div className="flex items-center gap-3 pt-2 border-t border-zinc-200">
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          disabled={!body.trim()}
          className="inline-flex items-center px-4 py-2 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50 text-sm font-medium text-zinc-700 rounded transition-colors"
        >
          Preview Legal
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
        >
          {saving ? 'Saving…' : 'Save Legal'}
        </button>
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
      </div>

      {showPreview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-zinc-900">
                Preview — how your legal will appear in the paper
              </h3>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="text-sm text-zinc-500 hover:text-zinc-900"
              >
                Close
              </button>
            </div>
            <div
              className="border border-zinc-300 overflow-hidden bg-white"
              style={{
                width: CONTENT_W_PX * PREVIEW_SCALE,
                height: CONTENT_H_PX * PREVIEW_SCALE,
              }}
            >
              <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
                <LegalPage data={previewData} pageNumber={21} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
