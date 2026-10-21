'use client';

/**
 * Legal Database detail view — shows a filed legal read-only, with Edit
 * Legal unlocking every field (customer, header, copy, L#, Wednesday run
 * dates, notary) so existing legals can be entered and corrected, including
 * keeping their original L#. Preview and Download Customer Draft always use
 * the values on screen, saved or not.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CustomerLegal } from '@/lib/queries/customer';
import { wednesdaysBetween, legalFooterLine, shortLegalDate } from '@/lib/legal-dates';
import { WednesdayCalendar } from '@/components/portal/wednesday-calendar';
import { CustomerDraftButton } from '@/components/portal/customer-draft-button';
import { LegalDetailPreview } from './legal-detail-preview';
import { updateAdminLegal } from '../actions';

const MAX_BODY_WORDS = 1000;

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export function LegalDetailView({ legal }: { legal: CustomerLegal }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [customer, setCustomer] = useState(legal.customer_name ?? '');
  const [header, setHeader] = useState(legal.header);
  const [body, setBody] = useState(legal.body);
  const [lNumber, setLNumber] = useState(legal.l_number);
  const [startDate, setStartDate] = useState(legal.start_date);
  const [endDate, setEndDate] = useState(legal.end_date);
  const [notary, setNotary] = useState(legal.notary_required);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const bodyWords = wordCount(body);
  const runDates = useMemo(
    () =>
      startDate && endDate && endDate >= startDate
        ? wednesdaysBetween(startDate, endDate)
        : legal.run_dates ?? [],
    [startDate, endDate, legal.run_dates]
  );
  const footerLine = legalFooterLine(lNumber, runDates);

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
    setNotice(null);
    const res = await updateAdminLegal({
      id: legal.id,
      customer_name: customer,
      header,
      body,
      l_number: lNumber,
      start_date: startDate,
      end_date: endDate,
      notary_required: notary,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save.');
      return;
    }
    setEditing(false);
    setNotice('Saved.');
    router.refresh();
  }

  function handleCancel() {
    setCustomer(legal.customer_name ?? '');
    setHeader(legal.header);
    setBody(legal.body);
    setLNumber(legal.l_number);
    setStartDate(legal.start_date);
    setEndDate(legal.end_date);
    setNotary(legal.notary_required);
    setError(null);
    setEditing(false);
  }

  const inputCls =
    'mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red';

  return (
    <div className="max-w-2xl space-y-5">
      <Field label="Customer">
        {editing ? (
          <input value={customer} onChange={(e) => setCustomer(e.target.value)} className={inputCls} />
        ) : (
          <ReadOnlyValue value={customer || '—'} />
        )}
      </Field>

      <Field label="L#">
        {editing ? (
          <>
            <input
              value={lNumber}
              onChange={(e) => setLNumber(e.target.value.toUpperCase())}
              className={`${inputCls} max-w-[12rem] font-mono`}
            />
            <p className="mt-1 text-xs text-zinc-400">
              An L followed by at least 5 digits. Must not be used by another legal.
            </p>
          </>
        ) : (
          <ReadOnlyValue value={lNumber} mono />
        )}
      </Field>

      <Field label="Legal Header">
        {editing ? (
          <input value={header} onChange={(e) => setHeader(e.target.value)} className={inputCls} />
        ) : (
          <ReadOnlyValue value={header} />
        )}
      </Field>

      <Field label="Legal Copy">
        {editing ? (
          <>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className={inputCls}
            />
            <p className={`mt-1 text-xs ${bodyWords > MAX_BODY_WORDS ? 'text-red-600' : 'text-zinc-400'}`}>
              {bodyWords}/{MAX_BODY_WORDS} words
            </p>
          </>
        ) : (
          <div className="mt-1 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 whitespace-pre-wrap max-h-96 overflow-y-auto">
            {body}
          </div>
        )}
      </Field>

      {editing ? (
        <div>
          <div className="block text-sm font-medium text-zinc-700 mb-2">Run Dates</div>
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
          <p className="mt-1 text-xs text-zinc-400">
            Currently {startDate ? shortLegalDate(startDate) : '—'} through{' '}
            {endDate ? shortLegalDate(endDate) : '—'}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <Field label="Start Date">
            <ReadOnlyValue value={shortLegalDate(startDate)} />
          </Field>
          <Field label="End Date">
            <ReadOnlyValue value={shortLegalDate(endDate)} />
          </Field>
        </div>
      )}

      <Field label="To be included at the end of the legal:">
        <ReadOnlyValue value={footerLine} mono />
      </Field>

      {editing ? (
        <label className="flex items-start gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={notary}
            onChange={(e) => setNotary(e.target.checked)}
            className="mt-0.5"
          />
          Notarized copy to be mailed
        </label>
      ) : (
        <Field label="Notarized copy to be mailed">
          <ReadOnlyValue value={notary ? 'Yes' : 'No'} />
        </Field>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-200">
        {editing ? (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark disabled:opacity-60 text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-zinc-300 hover:bg-zinc-50 text-sm font-medium text-zinc-700 rounded transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setEditing(true);
            }}
            className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
          >
            Edit Legal
          </button>
        )}
        <LegalDetailPreview header={header} body={body} footer={footerLine} />
        <CustomerDraftButton
          label="Download Customer Draft"
          customer={customer}
          lNumber={lNumber}
          header={header}
          body={body}
          footerLine={footerLine}
          startDate={startDate}
          endDate={endDate}
          notary={notary}
        />
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
        {notice ? <span className="text-sm text-green-700">{notice}</span> : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="block text-sm font-medium text-zinc-700">{label}</div>
      {children}
    </div>
  );
}

function ReadOnlyValue({ value, mono = false }: { value: string; mono?: boolean }) {
  return (
    <div
      className={`mt-1 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 ${mono ? 'font-mono' : ''}`}
    >
      {value}
    </div>
  );
}
