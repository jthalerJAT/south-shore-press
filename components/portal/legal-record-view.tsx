'use client';

/**
 * The one legal record screen — identical fields everywhere a legal is
 * viewed or edited in the Legal Database (filed legals AND Legal Notices
 * library entries): Customer · L# · Legal Header · Legal Copy · Wednesday
 * run dates · auto footer line · notary. Read-only until Edit Legal; fields
 * with nothing on file show blank/—. Preview and Download Customer Draft
 * always use the values on screen.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { wednesdaysBetween, legalFooterLine, shortLegalDate } from '@/lib/legal-dates';
import { WednesdayCalendar } from '@/components/portal/wednesday-calendar';
import { CustomerDraftButton } from '@/components/portal/customer-draft-button';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { LegalPage } from '@/components/newspaper/legal-page';
import { LEGAL_PAGE_COLUMNS } from '@/lib/newspaper/legal-page';

const MAX_BODY_WORDS = 1000;
const PREVIEW_SCALE = 0.42;

export type LegalRecordValues = {
  customer: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  header: string;
  body: string;
  lNumber: string;
  startDate: string; // ISO or ''
  endDate: string; // ISO or ''
  /** Affidavit of publication needed (scanned PDF emailed). */
  affidavit: boolean;
  /** Physical notarized copy to be mailed (+$10, any client). */
  notary: boolean;
};

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export function LegalRecordView({
  initial,
  note,
  onSave,
}: {
  initial: LegalRecordValues;
  /** Context line above the fields (e.g. where this record lives). */
  note?: string;
  onSave: (
    v: LegalRecordValues
  ) => Promise<{ ok: boolean; error?: string; redirectTo?: string }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [customer, setCustomer] = useState(initial.customer);
  const [contactName, setContactName] = useState(initial.contactName);
  const [contactEmail, setContactEmail] = useState(initial.contactEmail);
  const [contactPhone, setContactPhone] = useState(initial.contactPhone);
  const [header, setHeader] = useState(initial.header);
  const [body, setBody] = useState(initial.body);
  const [lNumber, setLNumber] = useState(initial.lNumber);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [affidavit, setAffidavit] = useState(initial.affidavit);
  const [notary, setNotary] = useState(initial.notary);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const bodyWords = wordCount(body);
  const runDates = useMemo(
    () =>
      startDate && endDate && endDate >= startDate ? wednesdaysBetween(startDate, endDate) : [],
    [startDate, endDate]
  );
  const footerLine =
    lNumber && runDates.length
      ? legalFooterLine(lNumber, runDates)
      : lNumber || '';

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
    if (!header.trim()) return 'Enter the Legal Header.';
    if (!body.trim()) return 'Enter the Legal Copy.';
    if (bodyWords > MAX_BODY_WORDS) return `Legal Copy is limited to ${MAX_BODY_WORDS} words.`;
    if (lNumber.trim() && !/^L\d{5,}$/.test(lNumber.trim().toUpperCase()))
      return 'The L# must be an L followed by at least 5 digits (e.g. L40001).';
    return null;
  }

  async function handleSave() {
    const problem = validate();
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    setNotice(null);
    const res = await onSave({
      customer: customer.trim(),
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone.trim(),
      header,
      body,
      lNumber: lNumber.trim().toUpperCase(),
      startDate,
      endDate,
      affidavit: affidavit || notary,
      notary,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save.');
      return;
    }
    if (res.redirectTo) {
      router.push(res.redirectTo);
      router.refresh();
      return;
    }
    setEditing(false);
    setNotice('Saved.');
    router.refresh();
  }

  function handleCancel() {
    setCustomer(initial.customer);
    setContactName(initial.contactName);
    setContactEmail(initial.contactEmail);
    setContactPhone(initial.contactPhone);
    setHeader(initial.header);
    setBody(initial.body);
    setLNumber(initial.lNumber);
    setStartDate(initial.startDate);
    setEndDate(initial.endDate);
    setAffidavit(initial.affidavit);
    setNotary(initial.notary);
    setError(null);
    setEditing(false);
  }

  const inputCls =
    'mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red';

  return (
    <div className="max-w-2xl space-y-5">
      {note ? <p className="text-sm text-zinc-500">{note}</p> : null}

      <Field label="Customer">
        {editing ? (
          <input value={customer} onChange={(e) => setCustomer(e.target.value)} className={inputCls} />
        ) : (
          <ReadOnlyValue value={customer || '—'} />
        )}
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Contact name">
          {editing ? (
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className={inputCls}
            />
          ) : (
            <ReadOnlyValue value={contactName || '—'} />
          )}
        </Field>
        <Field label="Contact email">
          {editing ? (
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className={inputCls}
            />
          ) : (
            <ReadOnlyValue value={contactEmail || '—'} />
          )}
        </Field>
        <Field label="Contact phone">
          {editing ? (
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className={inputCls}
            />
          ) : (
            <ReadOnlyValue value={contactPhone || '—'} />
          )}
        </Field>
      </div>

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
          <ReadOnlyValue value={lNumber || '—'} mono />
        )}
      </Field>

      <Field label="Legal Header">
        {editing ? (
          <input value={header} onChange={(e) => setHeader(e.target.value)} className={inputCls} />
        ) : (
          <ReadOnlyValue value={header || '—'} />
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
            {body || '—'}
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
            <ReadOnlyValue value={startDate ? shortLegalDate(startDate) : '—'} />
          </Field>
          <Field label="End Date">
            <ReadOnlyValue value={endDate ? shortLegalDate(endDate) : '—'} />
          </Field>
        </div>
      )}

      <Field label="To be included at the end of the legal:">
        <ReadOnlyValue value={footerLine || '—'} mono />
      </Field>

      {editing ? (
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
      ) : (
        <div className="grid grid-cols-2 gap-4 max-w-lg">
          <Field label="Affidavit required">
            <ReadOnlyValue value={affidavit || notary ? 'Yes' : 'No'} />
          </Field>
          <Field label="Physical copy mailed (+$10)">
            <ReadOnlyValue value={notary ? 'Yes' : 'No'} />
          </Field>
        </div>
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
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          disabled={!body.trim()}
          className="inline-flex items-center px-4 py-2 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50 text-sm font-medium text-zinc-700 rounded transition-colors"
        >
          Preview Legal
        </button>
        <CustomerDraftButton
          label="Download Customer Draft"
          customer={customer}
          lNumber={lNumber}
          header={header}
          body={body}
          footerLine={footerLine}
          startDate={startDate}
          endDate={endDate}
          affidavit={affidavit || notary}
          notary={notary}
        />
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
        {notice ? <span className="text-sm text-green-700">{notice}</span> : null}
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
