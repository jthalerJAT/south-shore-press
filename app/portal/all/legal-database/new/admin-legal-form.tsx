'use client';

/**
 * Admin "Create New Legal" form — the staff twin of the customer Legal Portal
 * form, reached from the Legal Database. Same fields as the read-only detail
 * view (Customer · Legal Header · Legal Copy · Wednesday-only run dates ·
 * auto L# footer line · notary), plus:
 *   Preview Legal   the real newspaper legal-page renderer (as everywhere),
 *   Save Legal      files it in customer_legals + the Legal Notices library,
 *   Customer Draft  a 2-page PDF (fields sheet + newspaper preview) opened
 *                   in a new tab for the customer to review/download.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { LegalPage } from '@/components/newspaper/legal-page';
import { LEGAL_PAGE_COLUMNS } from '@/lib/newspaper/legal-page';
import { wednesdaysBetween, legalFooterLine, shortLegalDate } from '@/lib/legal-dates';
import { WednesdayCalendar } from '@/components/portal/wednesday-calendar';
import { openCustomerDraftPdf } from '@/lib/customer-draft-pdf';
import { saveAdminLegal } from '../actions';

const MAX_BODY_WORDS = 1000;
const PREVIEW_SCALE = 0.42;

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export function AdminLegalForm({ reservedLNumber }: { reservedLNumber: string }) {
  const router = useRouter();
  const [customer, setCustomer] = useState('');
  const [header, setHeader] = useState('');
  const [body, setBody] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notary, setNotary] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hidden capture nodes for the Customer Draft PDF — only mounted while
  // generating. The popup window must be opened synchronously in the click
  // handler (popup blockers), so it's stashed in a ref for the effect.
  const fieldsRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const draftWinRef = useRef<Window | null>(null);

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

  function validate(): string | null {
    if (!customer.trim()) return 'Enter the Customer.';
    if (!header.trim()) return 'Enter the Legal Header.';
    if (!body.trim()) return 'Enter the Legal Copy.';
    if (bodyWords > MAX_BODY_WORDS) return `Legal Copy is limited to ${MAX_BODY_WORDS} words.`;
    if (!startDate) return 'Select a Start Date.';
    if (!endDate) return 'Select an End Date.';
    return null;
  }

  async function handleSave() {
    const problem = validate();
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    const res = await saveAdminLegal({
      customer_name: customer,
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
    router.push('/portal/all/legal-database');
    router.refresh();
  }

  function handleCustomerDraft() {
    const problem = validate();
    if (problem) return setError(problem);
    setError(null);
    // Open the tab NOW, while still inside the click — the PDF build is
    // async and a late window.open would be popup-blocked.
    draftWinRef.current = window.open('', '_blank');
    try {
      draftWinRef.current?.document.write(
        '<title>Customer Draft</title><p style="font-family:sans-serif;color:#555;padding:2rem">Preparing customer draft…</p>'
      );
    } catch {
      /* cross-origin quirk — harmless */
    }
    setDrafting(true);
  }

  useEffect(() => {
    if (!drafting) return;
    let cancelled = false;
    (async () => {
      try {
        const fieldsEl = fieldsRef.current;
        const previewEl = previewRef.current;
        if (!fieldsEl || !previewEl) throw new Error('capture nodes missing');
        await openCustomerDraftPdf({ fieldsEl, previewEl, target: draftWinRef.current });
      } catch (err) {
        console.error('[CustomerDraft]', err);
        try {
          draftWinRef.current?.close();
        } catch {
          /* ignore */
        }
        if (!cancelled) setError('Could not generate the customer draft. Please try again.');
      } finally {
        draftWinRef.current = null;
        if (!cancelled) setDrafting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drafting]);

  const draftDateLabel = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-zinc-700">Customer</label>
        <input
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          placeholder="Customer or firm name"
          className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
      </div>

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
          placeholder="Paste or type the full text of the legal notice…"
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
          To be included at the end of the legal:
        </label>
        <div className="mt-1 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-mono text-zinc-800 min-h-[2.4rem]">
          {footerLine || (
            <span className="text-zinc-400 font-sans">
              Select the run dates above — the legal number and every Wednesday it runs will
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
        Does the customer require a notarized copy of this legal to be mailed?
      </label>

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-200">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || drafting}
          className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
        >
          {saving ? 'Saving…' : 'Save Legal'}
        </button>
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
          onClick={handleCustomerDraft}
          disabled={saving || drafting}
          className="inline-flex items-center px-4 py-2 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50 text-sm font-medium text-zinc-700 rounded transition-colors"
        >
          {drafting ? 'Building PDF…' : 'Customer Draft'}
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
          <div className="bg-white rounded-lg shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-zinc-900">
                Preview — how the legal will appear in the paper
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

      {/* ── Offscreen capture nodes for the Customer Draft PDF ─────────── */}
      {drafting ? (
        <div
          aria-hidden="true"
          style={{ position: 'fixed', left: -12000, top: 0, pointerEvents: 'none' }}
        >
          {/* Page 1: the fields sheet, 8.5in wide at 96dpi */}
          <div
            ref={fieldsRef}
            style={{ width: 816, background: '#fff', color: '#18181b', padding: 56 }}
          >
            <div style={{ borderBottom: '3px solid #1e3a8a', paddingBottom: 12, marginBottom: 24 }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#1e3a8a' }}>
                The South Shore Press
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#52525b',
                  marginTop: 2,
                }}
              >
                Legal Notice — Customer Draft · {draftDateLabel}
              </div>
            </div>
            <DraftField label="Customer" value={customer.trim() || '—'} />
            <DraftField label="Legal Number" value={reservedLNumber || '—'} />
            <DraftField label="Legal Header" value={header.trim() || '—'} />
            <DraftField label="Legal Copy" value={body.trim() || '—'} pre />
            <div style={{ display: 'flex', gap: 48 }}>
              <DraftField label="Start Date" value={startDate ? shortLegalDate(startDate) : '—'} />
              <DraftField label="End Date" value={endDate ? shortLegalDate(endDate) : '—'} />
            </div>
            <DraftField label="To be included at the end of the legal" value={footerLine || '—'} mono />
            <DraftField label="Notarized copy to be mailed" value={notary ? 'Yes' : 'No'} />
          </div>
          {/* Page 2: the newspaper preview at natural print size */}
          <div ref={previewRef} style={{ width: CONTENT_W_PX, background: '#fff' }}>
            <LegalPage data={previewData} pageNumber={21} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DraftField({
  label,
  value,
  pre = false,
  mono = false,
}: {
  label: string;
  value: string;
  pre?: boolean;
  mono?: boolean;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#71717a',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.5,
          color: '#18181b',
          whiteSpace: pre ? 'pre-wrap' : 'normal',
          fontFamily: mono ? 'ui-monospace, Menlo, Consolas, monospace' : undefined,
          border: '1px solid #e4e4e7',
          borderRadius: 4,
          background: '#fafafa',
          padding: '8px 12px',
        }}
      >
        {value}
      </div>
    </div>
  );
}
