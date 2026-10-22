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
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { LegalPage } from '@/components/newspaper/legal-page';
import { LEGAL_PAGE_COLUMNS } from '@/lib/newspaper/legal-page';
import { wednesdaysBetween, legalFooterLine } from '@/lib/legal-dates';
import { WednesdayCalendar } from '@/components/portal/wednesday-calendar';
import { CustomerDraftButton } from '@/components/portal/customer-draft-button';
import { saveAdminLegal } from '../actions';

const MAX_BODY_WORDS = 1000;
const PREVIEW_SCALE = 0.42;

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export function AdminLegalForm({ reservedLNumber }: { reservedLNumber: string }) {
  const router = useRouter();
  const [customer, setCustomer] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [header, setHeader] = useState('');
  const [body, setBody] = useState('');
  // Pre-filled with the number reserved on page load, but editable — existing
  // legals get entered under their original L#. A typed L# that's already in
  // use errors on save rather than being silently renumbered.
  const [lNumber, setLNumber] = useState(reservedLNumber);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [affidavit, setAffidavit] = useState(false);
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
    () => (lNumber ? legalFooterLine(lNumber, runDates) : ''),
    [lNumber, runDates]
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
    if (!/^L\d{5,}$/.test(lNumber.trim().toUpperCase()))
      return 'The L# must be an L followed by at least 5 digits (e.g. L40001).';
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
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      header,
      body,
      l_number: lNumber.trim().toUpperCase(),
      start_date: startDate,
      end_date: endDate,
      affidavit_required: affidavit || notary,
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700">Contact name</label>
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Contact email</label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700">Contact phone</label>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700">L#</label>
        <input
          value={lNumber}
          onChange={(e) => setLNumber(e.target.value.toUpperCase())}
          className="mt-1 block w-full max-w-[12rem] rounded border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        />
        <p className="mt-1 text-xs text-zinc-400">
          Auto-assigned for new legals — change it only when entering an existing legal that
          already has a number.
        </p>
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

      <div className="space-y-2">
        <label className="flex items-start gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={affidavit || notary}
            disabled={notary}
            onChange={(e) => setAffidavit(e.target.checked)}
            className="mt-0.5"
          />
          Affidavit of publication required (scanned copy emailed)
        </label>
        <label className="flex items-start gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={notary}
            onChange={(e) => {
              setNotary(e.target.checked);
              if (e.target.checked) setAffidavit(true);
            }}
            className="mt-0.5"
          />
          Physical notarized copy to be mailed (+$10)
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-200">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
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
        <CustomerDraftButton
          customer={customer}
          contactName={contactName}
          contactEmail={contactEmail}
          contactPhone={contactPhone}
          lNumber={reservedLNumber}
          header={header}
          body={body}
          footerLine={footerLine}
          startDate={startDate}
          endDate={endDate}
          affidavit={affidavit || notary}
          notary={notary}
          disabled={saving}
          beforeDraft={validate}
        />
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
    </div>
  );
}
