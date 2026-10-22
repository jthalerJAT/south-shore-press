'use client';

/**
 * Customer Draft button - builds the 2-page letter PDF (fields sheet + the
 * real newspaper legal-page preview) and opens it in a new tab for download.
 * Shared by the admin Create New Legal form and the Legal Database detail
 * view, so a draft can be produced before OR after a legal is saved.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CONTENT_W_PX } from '@/lib/newspaper/layout-engine';
import { LegalPage } from '@/components/newspaper/legal-page';
import { LEGAL_PAGE_COLUMNS } from '@/lib/newspaper/legal-page';
import { shortLegalDate } from '@/lib/legal-dates';
import { openCustomerDraftPdf } from '@/lib/customer-draft-pdf';

export function CustomerDraftButton({
  customer,
  contactName = '',
  contactEmail = '',
  contactPhone = '',
  lNumber,
  header,
  body,
  footerLine,
  startDate,
  endDate,
  affidavit = false,
  notary,
  label = 'Customer Draft',
  disabled = false,
  beforeDraft,
}: {
  customer: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  lNumber: string;
  header: string;
  body: string;
  footerLine: string;
  /** ISO YYYY-MM-DD */
  startDate: string;
  endDate: string;
  /** Affidavit of publication required (scanned copy emailed). */
  affidavit?: boolean;
  /** Physical notarized copy to be mailed (+$10). */
  notary: boolean;
  label?: string;
  disabled?: boolean;
  /** Caller-side validation - return an error message to abort, null to go. */
  beforeDraft?: () => string | null;
}) {
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hidden capture nodes, only mounted while generating. The popup window
  // must be opened synchronously in the click handler (popup blockers), so
  // it's stashed in a ref for the effect.
  const fieldsRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const draftWinRef = useRef<Window | null>(null);

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

  function handleClick() {
    const problem = beforeDraft?.() ?? null;
    if (problem) return setError(problem);
    setError(null);
    // Open the tab NOW, while still inside the click - the PDF build is
    // async and a late window.open would be popup-blocked.
    draftWinRef.current = window.open('', '_blank');
    try {
      draftWinRef.current?.document.write(
        '<title>Customer Draft</title><p style="font-family:sans-serif;color:#555;padding:2rem">Preparing customer draft…</p>'
      );
    } catch {
      /* cross-origin quirk - harmless */
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
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || drafting}
        className="inline-flex items-center px-4 py-2 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50 text-sm font-medium text-zinc-700 rounded transition-colors"
      >
        {drafting ? 'Building PDF…' : label}
      </button>
      {error ? <span className="text-sm text-red-600">{error}</span> : null}

      {/* ── Offscreen capture nodes for the PDF ─────────────────────────── */}
      {drafting ? (
        <div
          aria-hidden="true"
          style={{ position: 'fixed', left: -12000, top: 0, pointerEvents: 'none' }}
        >
          {/* Page 1: the fields sheet, 8.5in wide at 96dpi. Kept compact so a
              typical legal fits one page; the PDF builder also shrinks a
              modest overflow to fit before resorting to a second page. */}
          <div
            ref={fieldsRef}
            style={{ width: 816, background: '#fff', color: '#18181b', padding: 40 }}
          >
            <div style={{ borderBottom: '3px solid #1e3a8a', paddingBottom: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1e3a8a' }}>
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
                Legal Notice - Customer Draft - {draftDateLabel}
              </div>
            </div>
            <DraftField label="Customer" value={customer.trim() || '-'} />
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ flex: 1 }}>
                <DraftField label="Contact name" value={contactName.trim() || '-'} />
              </div>
              <div style={{ flex: 1 }}>
                <DraftField label="Contact email" value={contactEmail.trim() || '-'} />
              </div>
              <div style={{ flex: 1 }}>
                <DraftField label="Contact phone" value={contactPhone.trim() || '-'} />
              </div>
            </div>
            <DraftField label="Legal Number" value={lNumber || '-'} />
            <DraftField label="Legal Header" value={header.trim() || '-'} />
            <DraftField label="Legal Copy" value={body.trim() || '-'} pre />
            <div style={{ display: 'flex', gap: 48 }}>
              <DraftField label="Start Date" value={startDate ? shortLegalDate(startDate) : '-'} />
              <DraftField label="End Date" value={endDate ? shortLegalDate(endDate) : '-'} />
            </div>
            <DraftField
              label="To be included at the end of the legal"
              value={footerLine || '-'}
              mono
            />
            <div style={{ display: 'flex', gap: 48 }}>
              <DraftField
                label="Affidavit of publication required"
                value={affidavit || notary ? 'Yes' : 'No'}
              />
              <DraftField
                label="Physical notarized copy to be mailed"
                value={notary ? 'Yes' : 'No'}
              />
            </div>
          </div>
          {/* Page 2: the newspaper preview at natural print size */}
          <div ref={previewRef} style={{ width: CONTENT_W_PX, background: '#fff' }}>
            <LegalPage data={previewData} pageNumber={21} />
          </div>
        </div>
      ) : null}
    </>
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
    <div style={{ marginBottom: 11 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#71717a',
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.4,
          color: '#18181b',
          whiteSpace: pre ? 'pre-wrap' : 'normal',
          fontFamily: mono ? 'ui-monospace, Menlo, Consolas, monospace' : undefined,
          border: '1px solid #e4e4e7',
          borderRadius: 4,
          background: '#fafafa',
          padding: '5px 10px',
        }}
      >
        {value}
      </div>
    </div>
  );
}
