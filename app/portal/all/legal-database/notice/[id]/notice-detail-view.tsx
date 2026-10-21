'use client';

/**
 * Legal Notices library entry — read-only until Edit Legal unlocks the
 * header and the full print copy (which carries its own L# + run-dates line
 * as its last line, exactly as it prints). Preview uses the on-screen values.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LegalNotice } from '@/lib/queries/legal-notices';
import { LegalDetailPreview } from '../../[id]/legal-detail-preview';
import { updateLegalNotice } from '../../actions';

export function NoticeDetailView({ notice }: { notice: LegalNotice }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [header, setHeader] = useState(notice.header ?? 'PUBLIC NOTICE');
  const [body, setBody] = useState(notice.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!header.trim()) return setError('Enter the Legal Header.');
    if (!body.trim()) return setError('Enter the Legal Copy.');
    setSaving(true);
    setError(null);
    const res = await updateLegalNotice({ id: notice.id, header, body });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save.');
      return;
    }
    setEditing(false);
    setSaved(true);
    router.refresh();
  }

  function handleCancel() {
    setHeader(notice.header ?? 'PUBLIC NOTICE');
    setBody(notice.body);
    setError(null);
    setEditing(false);
  }

  const inputCls =
    'mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red';

  return (
    <div className="max-w-2xl space-y-5">
      <p className="text-sm text-zinc-500">
        This legal lives in the Legal Notices library the newspaper creator places from. Its
        L# and run dates are part of the copy itself — edit the last line to change them.
      </p>

      <div>
        <div className="block text-sm font-medium text-zinc-700">Legal Header</div>
        {editing ? (
          <input value={header} onChange={(e) => setHeader(e.target.value)} className={inputCls} />
        ) : (
          <div className="mt-1 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
            {header}
          </div>
        )}
      </div>

      <div>
        <div className="block text-sm font-medium text-zinc-700">
          Legal Copy (as it prints, L# + run dates last)
        </div>
        {editing ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            className={inputCls}
          />
        ) : (
          <div className="mt-1 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 whitespace-pre-wrap max-h-96 overflow-y-auto">
            {body}
          </div>
        )}
      </div>

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
              setSaved(false);
              setEditing(true);
            }}
            className="inline-flex items-center px-5 py-2.5 bg-brand-red hover:bg-brand-red-dark text-white text-sm font-semibold uppercase tracking-wide rounded transition-colors"
          >
            Edit Legal
          </button>
        )}
        <LegalDetailPreview header={header} body={body} footer="" />
        {error ? <span className="text-sm text-red-600">{error}</span> : null}
        {saved ? <span className="text-sm text-green-700">Saved.</span> : null}
      </div>
    </div>
  );
}
