'use client';

/** "Preview Legal" on the admin read-only view — same renderer the customer
 *  saw when submitting. */
import { useState } from 'react';
import { CONTENT_W_PX, CONTENT_H_PX } from '@/lib/newspaper/layout-engine';
import { LegalPage } from '@/components/newspaper/legal-page';
import { LEGAL_PAGE_COLUMNS } from '@/lib/newspaper/legal-page';

const PREVIEW_SCALE = 0.42;

export function LegalDetailPreview({
  header,
  body,
  footer,
}: {
  header: string;
  body: string;
  footer: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center px-4 py-2 border border-zinc-300 hover:bg-zinc-50 text-sm font-medium text-zinc-700 rounded transition-colors"
      >
        Preview Legal
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div className="bg-white rounded-lg shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-zinc-900">Preview</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-zinc-500 hover:text-zinc-900"
              >
                Close
              </button>
            </div>
            <div
              className="border border-zinc-300 overflow-hidden bg-white"
              style={{ width: CONTENT_W_PX * PREVIEW_SCALE, height: CONTENT_H_PX * PREVIEW_SCALE }}
            >
              <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
                <LegalPage
                  data={{
                    v: 1,
                    notices: [{ id: 'preview', header, body: `${body}\n${footer}` }],
                    columns: LEGAL_PAGE_COLUMNS,
                  }}
                  pageNumber={21}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
